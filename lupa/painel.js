// Lupa · painel lateral
// Casco do painel: lê o storage, escolhe o personagem e desenha as abas com as peças de ui.js.
// Não fala com o jogo: só lê o storage e grava a configuração. No app, o botão "Entregar e seguir" pede a ação ao app
// (lupaApp.acao), que é quem clica no jogo; o andamento volta pelo storage (acao:<nome>).
'use strict';

const NO_APP = !!globalThis.lupaApp;   // no app de PC a escolha de personagem e a Central ficam nas abas do app
const ABAS = [['ficha', 'Ficha'], ['cacada', 'Caçada'], ['tarefa', 'Tarefa'], ['timers', 'Timers'], ['chat', 'Chat'], ['ajustes', 'Ajustes']];

// ---------- estado ----------
let config = mesclarConfig(), estados = {}, cacadas = {}, eventos = {}, icones = {}, menores = {}, escolhido = null, semBonus = false;
let nuvem = {};      // "nuvem:status" escrito pelo envio.js (a sessão com os tokens fica em outra chave e não vem para cá)
let acoes = {};      // "acao:<nome>": o andamento do "Entregar e seguir" (só no app)
let gastos = {};     // "gastar:<nome>": a conta do Onde gastar o ouro (o app calcula)
let treinos = {};    // "treino:<nome>": a conta dos Pontos e barra (a mesma rodada)
let aba = (() => { try { return localStorage.getItem('lupa-aba') || 'ficha'; } catch { return 'ficha'; } })();
if (!ABAS.some(([id]) => id === aba)) aba = 'ficha';

function guardar(k, v) {
  if (k === 'config') config = mesclarConfig(v);
  else if (k === 'icones') icones = v || {};
  else if (k === 'mercado:menores') menores = v || {};
  else if (k === 'nuvem:status') nuvem = v || {};
  else if (k.startsWith('estado:')) { if (v) estados[k.slice(7)] = v; else delete estados[k.slice(7)]; }
  else if (k.startsWith('cacada:')) { if (v) cacadas[k.slice(7)] = v; else delete cacadas[k.slice(7)]; }
  else if (k.startsWith('eventos:')) { if (v) eventos[k.slice(8)] = v; else delete eventos[k.slice(8)]; }
  else if (k.startsWith('acao:')) { if (v) acoes[k.slice(5)] = v; else delete acoes[k.slice(5)]; }
  else if (k.startsWith('gastar:')) { if (v) gastos[k.slice(7)] = v; else delete gastos[k.slice(7)]; }
  else if (k.startsWith('treino:')) { if (v) treinos[k.slice(7)] = v; else delete treinos[k.slice(7)]; }
}
// o botão Calcular do Onde gastar o ouro: o app recusou (sem ficha...) → o motivo aparece no cartão
async function pedirGasto(nome) {
  const r = await globalThis.lupaApp.gastar(nome).catch((e) => ({ erro: String(e?.message || e) }));
  if (r?.erro) { gastos[nome] = { ...(gastos[nome] || {}), estado: 'erro', erro: r.erro }; desenhar(true); }
}
// o app recusou o pedido (aba fechada, sem personagem...): o motivo aparece no cartão como um erro
async function pedirAcao(tipo, nome) {
  const r = await globalThis.lupaApp.acao(tipo, nome).catch((e) => ({ erro: String(e?.message || e) }));
  if (r?.erro) { acoes[nome] = { tipo: 'tarefa', estado: 'erro', texto: r.erro, em: Date.now() }; desenhar(true); }
}
const salvarConfig = (mud) => chrome.storage.local.set({ config: { ...config, ...mud, avisos: { ...config.avisos, ...(mud.avisos || {}) } } });
const alternarAviso = (k) => salvarConfig({ avisos: { [k]: !config.avisos[k] } });

// contexto entregue às funções de ui.js (getters: sempre o valor atual)
const ctx = {
  get config() { return config; },
  get cacadas() { return cacadas; },
  get eventos() { return eventos; },
  get icones() { return icones; },
  get menores() { return menores; },
  get semBonus() { return semBonus; },
  get acoes() { return acoes; },
  get gastos() { return gastos; },
  get treinos() { return treinos; },
  setSemBonus(v) { semBonus = !!v; desenhar(true); },
  salvarConfig, alternarAviso,
  // só no app (que sabe clicar no jogo); na extensão o cartão "Entregar e seguir" nem aparece
  iniciarAcao: NO_APP && typeof globalThis.lupaApp.acao === 'function' ? pedirAcao : null,
  // só no app (que tem o simulador); na extensão o cartão "Onde gastar o ouro" nem aparece
  calcularGasto: NO_APP && typeof globalThis.lupaApp.gastar === 'function' ? pedirGasto : null,
  redesenhar() { desenhar(true); }
};

function atual() {
  if (escolhido && estados[escolhido]) return estados[escolhido];
  return Object.values(estados).sort((a, b) => b.ts - a.ts)[0] || null;
}

// ---------- desenho ----------
let ultimaChave = '', pendente = false, apertado = false;
document.addEventListener('pointerdown', () => (apertado = true), true);
document.addEventListener('pointerup', () => { apertado = false; if (pendente) agendar(); }, true);
function agendar() {
  pendente = true;
  if (apertado) return;      // não troca o botão debaixo do dedo no meio do clique
  requestAnimationFrame(() => { if (pendente) { pendente = false; desenhar(); } });
}

function desenhar(forcar = false) {
  const e = atual();
  desenharTopo(e);
  desenharAbas(e);
  const minuto = Math.floor(Date.now() / 30e3);
  const fatia = aba === 'ajustes' ? [config, nuvem]
    : !e ? null
    : aba === 'ficha' ? [e.ficha, e.mochila, e.pontos, e.zona, e.nivel, e.tarefa === null, planoAbertoChave(), Object.keys(icones).length, menores, gastos[e.nome], gastoAberto, treinos[e.nome]]
    : aba === 'cacada' ? [cacadas[e.nome], semBonus, config.novaSessao, config.novaSessaoPor?.[e.nome], e.bonus, minuto]
    : aba === 'tarefa' ? [e.tarefa, e.diarias, e.rastreio, config.avisos.tarefa, minuto, acoes[e.nome]]
    : aba === 'timers' ? [e.timers, e.rastreio, config.avisos]
    : [e.chat, e.recentes, config.esconderLoot, Object.keys(icones).length];
  // Ajustes não depende do XP; nas outras abas, ele entra para a barra e a caçada andarem
  const k = JSON.stringify(aba === 'ajustes' ? [aba, fatia] : [aba, e?.nome, fatia, e?.xpNivel, cacadas[e?.nome]?.sessoes?.at(-1)?.xp]);
  // nunca redesenha por baixo de quem está digitando (o formulário do Lupa Online perdia o texto e o foco)
  const foco = document.activeElement, digitando = !!foco?.closest?.('#conteudo') && /^(INPUT|TEXTAREA|SELECT)$/.test(foco.tagName);
  if (!forcar && (k === ultimaChave || digitando)) return;
  ultimaChave = k;
  const corpo = aba === 'ajustes' ? desenharAjustes()
    : !e ? vazio('Abra o lolidle.com e entre no seu personagem. A Lupa começa a ler sozinha.')
    : aba === 'ficha' ? desenharFicha(e, ctx)
    : aba === 'cacada' ? desenharCacada(e, ctx)
    : aba === 'tarefa' ? desenharTarefa(e, ctx)
    : aba === 'timers' ? desenharTimers(e, ctx)
    : desenharChat(e, ctx);
  document.getElementById('conteudo').replaceChildren(corpo);
}
// o cartão do plano muda de tamanho sozinho; entra na chave só para o redesenho forçado já cobrir
const planoAbertoChave = () => (typeof planoAberto !== 'undefined' ? planoAberto : false);

function desenharTopo(e) {
  document.getElementById('quem').textContent = e ? [e.nome, e.nivel && `nv ${e.nivel}`, e.zona].filter(Boolean).join(' · ') : 'aguardando o jogo';
  const st = document.getElementById('status'), idade = e ? Date.now() - e.ts : 0, fresco = e && idade < 20e3;
  st.className = 'status' + (fresco ? ' ok' : e && idade > 60e3 ? ' velho' : '');
  st.textContent = !e ? 'sem leitura' : fresco ? 'lendo a página' : idade > 60e3 ? `sem leitura há ${Math.max(1, Math.floor(idade / 60e3))} min` : `última leitura ${hora(e.ts)}`;
  const recentes = Object.values(estados).filter((x) => Date.now() - x.ts < 10 * 60e3).sort((a, b) => a.nome.localeCompare(b.nome));
  const box = document.getElementById('personagens');
  box.hidden = NO_APP || recentes.length < 2;
  if (!box.hidden) box.replaceChildren(...recentes.map((x) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(x.nome === e?.nome), onclick: () => { escolhido = x.nome; desenhar(true); } }, x.nome)));
  const xp = document.getElementById('xp-topo'), barra = e ? barraXp(e, ctx) : null;
  xp.hidden = !barra;
  xp.replaceChildren(...(barra ? [barra] : []));
}

function desenharAbas(e) {
  const alerta = !!(e?.tarefa?.cacandoFora || e?.tarefa?.pronta);
  document.getElementById('abas').replaceChildren(...ABAS.map(([id, nome]) => h('button', {
    type: 'button', 'aria-pressed': String(aba === id),
    onclick: () => { aba = id; try { localStorage.setItem('lupa-aba', id); } catch {} desenhar(true); window.scrollTo(0, 0); }
  }, nome, id === 'tarefa' && alerta ? h('span', { class: 'ponto', 'aria-label': 'atenção' }) : null)));
}

// ---------- Ajustes ----------
function desenharAjustes() {
  const av = config.avisos;
  return h('div', { class: 'pilha' },
    secaoNuvem(),
    secao('Lateral do jogo',
      chave(config.tema, 'Tema da Lupa: painéis escuros e botões discretos no lugar do visual do jogo', () => salvarConfig({ tema: !config.tema })),
      chave(config.semBonusLateral, 'Esconder a lista de bônus de XP (Twitch, Kick, voto e guilda estão na aba Timers)', () => salvarConfig({ semBonusLateral: !config.semBonusLateral })),
      nota('Esconder a coluna e recolher os blocos agora é do próprio jogo: a setinha na borda entre o jogo e a coluna e o ▾ de cada bloco'
        + (NO_APP ? ' (no app, Alt+L aperta a setinha).' : '.') + ' Em ⚙ Configurações → Coluna da direita ficam também esconder o Local, a faixa de redes e a guilda, a ordem dos blocos, a altura do chat e o Modo economia.')),
    secao('Jogo em segundo plano',
      chave(config.manterAcordado, 'Manter o PC acordado enquanto o jogo estiver aberto', () => salvarConfig({ manterAcordado: !config.manterAcordado })),
      nota('A tela pode apagar; o computador não entra em suspensão. A Lupa também impede o navegador de descartar a aba do jogo.')),
    secao('Avisos',
      chave(av.mochila, 'Mochila quase cheia', () => alternarAviso('mochila')),
      chave(av.chao, 'Item que ficou no chão', () => alternarAviso('chao')),
      chave(av.morte, 'Morte do personagem', () => alternarAviso('morte')),
      chave(av.pontos, 'Pontos livres de habilidade ou atributo', () => alternarAviso('pontos')),
      chave(av.nivel, 'Subiu de nível', () => alternarAviso('nivel')),
      chave(av.lendario, 'Caiu um lendário', () => alternarAviso('lendario')),
      chave(av.premio, 'Prêmio diário ainda não pego', () => alternarAviso('premio')),
      chave(av.diaria, 'Missão diária pronta para entregar', () => alternarAviso('diaria')),
      chave(av.guerra, 'Guerra de Guildas (abriu ou começou)', () => alternarAviso('guerra')),
      chave(av.vilemaw, 'Vilemaw acordou', () => alternarAviso('vilemaw')),
      chave(av.covil, 'Covil liberado', () => alternarAviso('covil')),
      chave(av.reinicio, 'Reinício do servidor chegando', () => alternarAviso('reinicio')),
      nota('Os avisos de bônus (Kick, Twitch, voto, evento e convites) ficam nos sinos da aba Timers; o da tarefa, na aba Tarefa.')),
    secao('Chat do jogo',
      chave(config.esconderLoot, 'Esconder as linhas de loot (aba Servidor)', () => salvarConfig({ esconderLoot: !config.esconderLoot }))),
    nota('Tudo aqui só muda a aparência da página. Os botões continuam sendo os do jogo, e desligar volta ao visual original na hora.'));
}

// Lupa Online: o login fica aqui; quem envia é o envio.js no service worker
function secaoNuvem() {
  const st = nuvem;
  if (st.conectado) {
    const quando = st.ultimoEnvio ? `último envio às ${hora(st.ultimoEnvio)}` : 'ainda não enviou';
    return secao('Lupa Online',
      h('p', { class: 'nuvem-linha' }, icone(st.erro ? 'alerta' : 'ok', 16), h('span', null, `Conectado como ${st.email} · ${quando}`)),
      st.erro ? h('p', { class: 'nuvem-erro', role: 'alert' }, st.erro) : null,
      h('div', { class: 'nuvem-bts' },
        h('button', { type: 'button', class: 'botao', onclick: () => chrome.runtime.sendMessage({ tipo: 'nuvem-enviar' }) }, 'Enviar agora'),
        st.site ? h('button', { type: 'button', class: 'botao', onclick: () => chrome.tabs.create({ url: st.site }) }, 'Abrir o site') : null,
        h('button', { type: 'button', class: 'botao', onclick: () => chrome.runtime.sendMessage({ tipo: 'nuvem-sair' }) }, 'Sair')),
      nota('Envia o que a Lupa lê (ficha, drops, níveis, caçada e o Mercado quando você abre) para o seu banco, para ver de outro computador. Só fala com o seu banco, nunca com o servidor do jogo.'));
  }
  const msg = h('p', { class: 'nuvem-erro', role: 'alert' }, st.erro || '');
  const entrar = h('button', { type: 'submit', class: 'botao' }, 'Entrar');
  const form = h('form', {
    class: 'nuvem-form',
    onsubmit: (ev) => {
      ev.preventDefault();
      const d = new FormData(form);
      entrar.disabled = true; msg.textContent = 'Entrando…';
      chrome.runtime.sendMessage({ tipo: 'nuvem-entrar', email: d.get('email'), senha: d.get('senha') }).then((r) => {
        entrar.disabled = false;
        msg.textContent = r?.ok ? '' : r?.erro || 'Não deu para entrar.';
      }).catch(() => { entrar.disabled = false; msg.textContent = 'Não deu para falar com o serviço da Lupa: recarregue a extensão.'; });
    }
  },
  h('label', null, 'E-mail', h('input', { type: 'email', name: 'email', autocomplete: 'username', required: true })),
  h('label', null, 'Senha', h('input', { type: 'password', name: 'senha', autocomplete: 'current-password', required: true })),
  entrar, msg);
  return secao('Lupa Online', nota('Entre com a conta do Lupa Online para ver tudo de outro computador. Sem entrar, nada sai deste navegador.'), form);
}

// ---------- início ----------
if (NO_APP) {
  document.getElementById('central')?.setAttribute('hidden', '');
  const r = document.querySelector('.rodape span');
  if (r) r.textContent = 'Lê a tela; só clica no jogo quando você aperta Entregar e seguir ou o Alt+L.';
}
document.getElementById('central')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('central.html') }));
chrome.storage.local.get(null).then((tudo) => { for (const [k, v] of Object.entries(tudo)) guardar(k, v); desenhar(true); });
chrome.storage.onChanged.addListener((mud, area) => {
  if (area !== 'local') return;
  for (const [k, { newValue }] of Object.entries(mud)) guardar(k, newValue);
  agendar();
});
// no app, o main avisa qual personagem escolher ao trocar de aba (no Chrome não existe e não faz nada)
globalThis.lupaApp?.aoEscolher?.((nome) => { escolhido = nome; desenhar(true); });
setInterval(() => desenharTopo(atual()), 5000);
desenhar(true);
