// Lupa · service worker
// Abre o painel lateral pelo ícone e mostra os avisos que o content script pede (ele não tem acesso a notificações).
// Clicar no aviso só traz a aba do jogo para a frente.
// Também impede o navegador de descartar a aba do jogo e, se config.manterAcordado, segura o PC acordado.
// O envio para o Lupa Online (quando você entra em Ajustes) fica em envio.js; os planos iniciais vêm de planos.js.

importScripts('planos.js', 'envio.js');

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

const abaDoAviso = new Map();

// ---------- manter o jogo ativo ----------
// o service worker morre à toa: a lista de abas do jogo fica em storage.session
async function lerAbas() {
  try { return (await chrome.storage.session.get('abasJogo')).abasJogo || []; } catch { return []; }
}
async function guardarAbas(lista) {
  try { await chrome.storage.session.set({ abasJogo: lista }); } catch {}
}

// tira da lista as abas que não existem mais
async function limparAbas() {
  const lista = await lerAbas();
  const vivas = [];
  for (const id of lista) {
    try { if (await chrome.tabs.get(id)) vivas.push(id); } catch {}
  }
  if (vivas.length !== lista.length) await guardarAbas(vivas);
  return vivas;
}

async function aplicarAcordado() {
  const vivas = await limparAbas();
  let manter = false;
  try { manter = !!(await chrome.storage.local.get('config')).config?.manterAcordado; } catch {}
  if (manter && vivas.length) chrome.power.requestKeepAwake('system');
  else chrome.power.releaseKeepAwake();
}

async function registrarAba(id) {
  chrome.tabs.update(id, { autoDiscardable: false }).catch(() => {});
  const lista = await lerAbas();
  if (!lista.includes(id)) { lista.push(id); await guardarAbas(lista); }
  aplicarAcordado();
}

// a notificação de um aviso; com a aba de origem, clicar nela traz o jogo para a frente
function mostrarAviso(chave, titulo, texto, aba) {
  const id = `lupa-${chave}-${Date.now()}`;
  if (aba) abaDoAviso.set(id, { aba: aba.id, janela: aba.windowId });
  chrome.notifications.create(id, { type: 'basic', iconUrl: 'icones/128.png', title: titulo, message: texto, priority: 1 });
}
// o envio.js (alerta de preço) avisa por aqui: não tem aba de origem
self.lupaAvisar = (id, titulo, texto) => mostrarAviso(id, titulo, texto, null);

chrome.runtime.onMessage.addListener((msg, remetente) => {
  if (msg?.tipo === 'ola') {
    if (remetente.tab) registrarAba(remetente.tab.id);
    return;
  }
  if (msg?.tipo !== 'aviso') return;
  mostrarAviso(msg.id, msg.titulo, msg.texto, remetente.tab);
});

chrome.storage.onChanged.addListener((mud, area) => { if (area === 'local' && mud.config) aplicarAcordado(); });
chrome.tabs.onRemoved.addListener(() => aplicarAcordado());
aplicarAcordado();   // o service worker acabou de iniciar

chrome.notifications.onClicked.addListener((id) => {
  const alvo = abaDoAviso.get(id);
  chrome.notifications.clear(id);
  if (!alvo) return;
  chrome.tabs.update(alvo.aba, { active: true }).catch(() => {});
  chrome.windows.update(alvo.janela, { focused: true }).catch(() => {});
  abaDoAviso.delete(id);
});

chrome.notifications.onClosed.addListener((id) => abaDoAviso.delete(id));
