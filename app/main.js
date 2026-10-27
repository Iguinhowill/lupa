// Lupa (app) · processo principal
// Uma janela com a barra de abas (casca), uma aba por conta do jogo (cada uma na sua partição: login separado), o
// painel da Lupa à direita e a Central. Faz o papel do service worker da extensão: guarda os dados (armazem.js), roda
// o envio.js da Lupa num vm com um `chrome` equivalente, mostra os avisos e segura o PC acordado. Lê a tela e nunca fala
// com o servidor do jogo. Liberado pelo Brunox em 26/10/2026. Clica ou aperta tecla no jogo só em duas ações que o jogador
// pede (o botão "Entregar e seguir" e o Alt+L), liberadas por ele em 27/10/2026: ver acoes.js e ARQUITETURA.md.
'use strict';

const { app, BaseWindow, BrowserWindow, Menu, Tray, WebContentsView, ipcMain, Notification, nativeImage, powerSaveBlocker, screen, shell, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Armazem } = require('./armazem');
// regras de navegação (o que fica na aba do jogo e nas janelas de login), com teste em regras.test.js
const { DA_CONTA, DO_GOOGLE, permitido: permitidoNo } = require('./regras');
// posição e zoom das views, alertas das abas e teclas do app: tudo puro, com teste (layout/alertas.test.js)
const Layout = require('./layout');
const { alertasDe, notasEmTexto } = require('./alertas');
const { atalhoDe, LISTA: ATALHOS } = require('./atalhos');
// as ações que o jogador pede (entregar a tarefa, a setinha da coluna): autorização e entradas, puro (acoes.test.js)
const Acoes = require('./acoes');

const JOGO = process.env.LUPA_JOGO || 'https://lolidle.com/jogar';
const ORIGEM_JOGO = new URL(JOGO).origin;
const permitido = (url, atual) => permitidoNo(url, atual, ORIGEM_JOGO);
// a sessão do Lupa Online (tokens) fica só no processo principal, com o envio.js: nenhuma página lê, grava ou recebe
const PRIVADAS = new Set(['nuvem:sessao']);
const semPrivadas = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !PRIVADAS.has(k)));
const LUPA = path.join(__dirname, 'lupa');
const ICONE = path.join(__dirname, 'icone.png');

// só para testar o app sem tocar nas contas de verdade: LUPA_DADOS troca a pasta de dados (login, sessão do Lupa Online,
// armazém). Vale só fora do pacote: o app instalado nunca lê essa variável
if (!app.isPackaged && process.env.LUPA_DADOS) app.setPath('userData', process.env.LUPA_DADOS);
if (!app.requestSingleInstanceLock()) app.exit(0);
app.setAppUserModelId('com.iguinhowill.lupa');
Menu.setApplicationMenu(null);
// a identificação vira a de um Chrome comum; nas páginas do Google (login), a de um Firefox: o Google recusa login em
// Chromium embutido ("esse navegador ou app pode não ser seguro"). Aqui troca o cabeçalho; o shim-jogo.js faz o
// JavaScript da página ver o mesmo Firefox
const nomeNoUa = app.getName().replace(/[^\w.-]/g, '').replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const UA_CHROME = app.userAgentFallback.replace(new RegExp(`\\s(Electron|${nomeNoUa}|lupa|Lupa)\\/\\S+`, 'g'), '');
const UA_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';
app.userAgentFallback = UA_CHROME;

let armazem, janela, casca, painel, central, mini, bandeja = null;
// as views: um jogo por conta e a Central. As "abas" da casca são modos (`modos()`): o Lado a lado não tem view própria
const abas = [
  { id: 'conta1', tipo: 'jogo', particao: 'persist:conta1', padrao: 'Conta 1' },
  { id: 'conta2', tipo: 'jogo', particao: 'persist:conta2', padrao: 'Conta 2' },
  { id: 'central', tipo: 'central', padrao: 'Central' }
];
// `ativa` é o modo: conta1, conta2, lado ou central. O painel tem uma chave por modo (no lado a lado começa escondido);
// `zoom` é o ajuste do usuário por grupo de modo (ver layout.js)
const PREF_PADRAO = { ativa: 'conta1', painelAberto: true, painelLado: false, larguraPainel: 380, fecharParaBandeja: true, avisouBandeja: false, soConta1: false, janela: null };
let pref = { ...PREF_PADRAO, zoom: { solo: 1, lado: 1, central: 1 }, nomes: {} };
let atualizacao = { tipo: app.isPackaged ? 'procurando' : 'dev' };
let ultimoFoco = 'conta1';      // a metade do lado a lado que teve o foco por último
let menuAberto = false;         // o menu de ajustes da casca aberto: a casca cobre a janela toda
let saindo = false;             // "Sair", atualização ou fim da sessão do Windows: aí o X fecha de verdade
const INICIO = Date.now();

// aberto pelo Windows ao iniciar: vem com este argumento e começa minimizado (o mesmo args precisa ir no get e no set)
const AO_INICIAR = ['--ao-iniciar'];
const iniciaComWindows = () => app.isPackaged && app.getLoginItemSettings({ args: AO_INICIAR }).openAtLogin;
// a 0.6.0 registrava sem o argumento: a entrada continua abrindo o app, mas sem ele a chave aparecia desligada e o app
// não começava minimizado. Regrava com o argumento (mesmo nome de entrada, então substitui).
function migrarInicio() {
  if (app.isPackaged && app.getLoginItemSettings().executableWillLaunchAtLogin && !iniciaComWindows()) {
    app.setLoginItemSettings({ openAtLogin: true, args: AO_INICIAR });
  }
}
const prefs = (preload, extra = {}) => ({ preload, contextIsolation: true, sandbox: true, nodeIntegration: false, ...extra });
const abaDe = (wc) => abas.find((a) => a.view?.webContents === wc);
const salvarPref = () => armazem.set({ 'app:pref': pref });
// movimentos de janela e zoom gravam com calma, não a cada pixel
let esperaPref = null;
const salvarPrefDepois = () => { clearTimeout(esperaPref); esperaPref = setTimeout(salvarPref, 600); };

// modos da casca (as abas) e o que cada um mostra
const modos = () => [
  { id: 'conta1', tipo: 'jogo' },
  ...(pref.soConta1 ? [] : [{ id: 'conta2', tipo: 'jogo' }, { id: 'lado', tipo: 'lado' }]),
  { id: 'central', tipo: 'central' }
];
const modo = () => pref.ativa;
// a view "da vez": a do modo, ou no lado a lado a metade que teve o foco por último
const abaAtiva = () => abas.find((a) => a.id === (modo() === 'lado' ? ultimoFoco : modo())) || abas[0];
const painelVisivel = () => (modo() === 'lado' ? pref.painelLado : modo() === 'central' ? false : pref.painelAberto);

// ---------- o envio.js da Lupa, no processo principal ----------
// O mesmo arquivo do service worker da extensão, rodando num vm com o `chrome` que ele usa (armazém, mensagens, alarmes).
const ouvintesMsg = [], ouvintesMud = [], ouvintesAlarme = [], alarmes = new Map();
function iniciarEnvio() {
  const chrome = {
    storage: {
      local: { get: async (c) => armazem.get(c), set: async (o) => armazem.set(o), remove: async (c) => armazem.remove(c) },
      onChanged: { addListener: (fn) => ouvintesMud.push(fn) }
    },
    runtime: { id: 'lupa-app', onMessage: { addListener: (fn) => ouvintesMsg.push(fn) } },
    alarms: {
      get: async (nome) => (alarmes.has(nome) ? { name: nome } : undefined),
      create(nome, { periodInMinutes = 1 } = {}) {
        clearInterval(alarmes.get(nome));
        alarmes.set(nome, setInterval(() => ouvintesAlarme.forEach((fn) => fn({ name: nome })), periodInMinutes * 60e3));
      },
      onAlarm: { addListener: (fn) => ouvintesAlarme.push(fn) }
    }
  };
  // lupaAvisar(id, titulo, texto): o envio.js avisa (preço novo etc.) sem aba; o clique só mostra a janela
  const lupaAvisar = (_id, titulo, texto) => avisar({ titulo, texto }, null);
  const ctx = vm.createContext({ chrome, lupaAvisar, fetch, console, setTimeout, clearTimeout, setInterval, clearInterval, structuredClone, URL, URLSearchParams, AbortController });
  for (const f of ['planos.js', 'envio.js']) vm.runInContext(fs.readFileSync(path.join(LUPA, f), 'utf8'), ctx, { filename: f });
  return ctx;
}
// como o chrome.runtime.sendMessage: o ouvinte que devolve true responde depois
function despachar(msg) {
  return new Promise((ok) => {
    let depois = false;
    for (const fn of ouvintesMsg) { try { if (fn(msg, {}, ok) === true) depois = true; } catch {} }
    if (!depois) ok(undefined);
  });
}

// ---------- avisos e PC acordado ----------
const avisosVivos = new Set();      // sem referência, o Windows perde o clique do aviso
function mostrarAviso(titulo, texto, aba) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: titulo, body: texto, icon: ICONE });
  avisosVivos.add(n);
  if (avisosVivos.size > 50) avisosVivos.delete(avisosVivos.values().next().value);
  n.on('click', () => { if (aba) ativar(aba.id); mostrarJanela(); });
  for (const ev of ['close', 'failed']) n.on(ev, () => avisosVivos.delete(n));
  n.show();
}
// o jogador está olhando para esta conta agora: janela em foco e a conta na tela (aba ativa ou lado a lado)
const aVista = (aba) => !!aba && !!janela && janela.isVisible() && !janela.isMinimized() && janela.isFocused() && (modo() === aba.id || modo() === 'lado');
function avisar(msg, aba) {
  if (aVista(aba)) return;
  const nome = aba && pref.nomes[aba.id], titulo = String(msg.titulo || 'Lupa');
  mostrarAviso(nome && !titulo.includes(nome) ? `${nome} · ${titulo}` : titulo, String(msg.texto || ''), aba);
  if (janela && !janela.isFocused()) janela.flashFrame(true);      // pisca na barra de tarefas até a janela ganhar foco
}
let bloqueio = null;
function aplicarAcordado() {
  const manter = !!armazem.get('config').config?.manterAcordado;
  if (manter && bloqueio == null) bloqueio = powerSaveBlocker.start('prevent-app-suspension');
  else if (!manter && bloqueio != null) { powerSaveBlocker.stop(bloqueio); bloqueio = null; }
}

// ---------- janela ----------
function mostrarJanela() {
  if (!janela) return;
  if (janela.isMinimized()) janela.restore();
  janela.show(); janela.focus();
}

function criarJogo(a) {
  const ses = session.fromPartition(a.particao);
  ses.setPermissionRequestHandler((_wc, perm, ok) => ok(['notifications', 'fullscreen', 'clipboard-sanitized-write'].includes(perm)));
  ses.webRequest.onBeforeSendHeaders({ urls: ['https://*.google.com/*', 'https://*.google.com.br/*', 'https://*.gstatic.com/*', 'https://*.googleusercontent.com/*', 'https://*.youtube.com/*'] }, (d, cb) => {
    const cab = { ...d.requestHeaders, 'User-Agent': UA_FIREFOX };
    for (const k of Object.keys(cab)) if (/^sec-ch-ua/i.test(k)) delete cab[k];
    cb({ requestHeaders: cab });
  });
  a.view = new WebContentsView({ webPreferences: prefs(path.join(__dirname, 'gerado', 'preload-jogo.js'), { partition: a.particao }) });
  const wc = a.view.webContents;
  proteger(wc);
  ligarAtalhos(wc);
  wc.on('focus', () => { if (ultimoFoco !== a.id) { ultimoFoco = a.id; if (modo() === 'lado') { escolherNoPainel(); avisarCasca(); } } });
  wc.on('did-navigate', () => aplicarZoom());      // o Chromium pode devolver o zoom ao padrão na troca de página
  // a página recarregou ou caiu no meio de uma ação: a autorização some e o painel não fica parado em "rodando"
  wc.on('did-start-navigation', (d) => { if (d.isMainFrame && !d.isSameDocument) encerrarAcao(a, 'A página do jogo recarregou no meio. Aperte de novo.'); });
  wc.on('render-process-gone', () => encerrarAcao(a, 'A página do jogo caiu no meio. Aperte de novo.'));
  const tema = fs.readFileSync(path.join(LUPA, 'tema.css'), 'utf8');
  wc.on('dom-ready', () => { if (/^https?:\/\/((www\.)?lolidle\.com|127\.0\.0\.1|localhost)[:/]/.test(wc.getURL())) wc.insertCSS(tema).catch(() => {}); });
  wc.loadURL(JOGO);
  janela.contentView.addChildView(a.view);
}

const externo = (url) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); };
const janelasDeLogin = new WeakSet();
// Vale para a aba do jogo e para cada janela de login que ela abre (as duas sem barra de endereço): só o jogo e os
// logins; o resto abre no navegador do sistema (origem exata: "lolidle.com.outro.site" não passa). Todo link e todo
// redirecionamento é conferido, porque um redirecionamento aberto (google.com/url?q=, OAuth com client_id de outro)
// levaria qualquer página para dentro dela. Entre páginas de login o salto segue (NO_LOGIN, no regras.js); um login
// corporativo com provedor de fora não funciona aqui dentro e abre no navegador.
function proteger(wc, inicial = '') {
  // `salto` é o endereço atual da navegação, inclusive no meio de uma cadeia de redirecionamentos. O User-Agent só troca
  // quando a navegação começa (o "Tentar novamente" do Google); o "Entrar com Google" chega por redirecionamento, e aí
  // quem garante o Firefox é o cabeçalho (onBeforeSendHeaders) e o shim-jogo.js. Não trocar no did-redirect-navigation:
  // o setUserAgent no meio do redirecionamento trava o processo principal (Electron 44)
  let salto = inicial;      // a janela de login aberta com ctrl/clique do meio já começa a carregar antes de chegar aqui
  wc.on('did-start-navigation', (d) => {
    if (!d.isMainFrame) return;
    if (!d.isSameDocument) salto = d.url;      // pushState/hash não é salto de cadeia nenhuma
    wc.setUserAgent(DO_GOOGLE.test(d.url) ? UA_FIREFOX : UA_CHROME);
  });
  wc.on('did-redirect-navigation', (d) => { if (d.isMainFrame) salto = d.url; });      // só guarda
  const barrar = (e) => {
    e.preventDefault();
    externo(e.url);
    // janela de login que nem chegou a mostrar nada: fecha em vez de ficar em branco
    if (janelasDeLogin.has(wc) && !wc.getURL()) setImmediate(() => BrowserWindow.fromWebContents(wc)?.close());
  };
  wc.on('will-navigate', (e) => { if (e.isMainFrame && !permitido(e.url, wc.getURL())) barrar(e); });
  wc.on('will-redirect', (e) => { if (e.isMainFrame && !permitido(e.url, salto)) barrar(e); });
  // o login que o jogo abre numa janela fica na mesma partição (a sessão volta para a conta) e ganha as mesmas regras;
  // uma janela de login não abre outra: vai para o navegador
  wc.setWindowOpenHandler(({ url }) => {
    if (DA_CONTA.test(url) && !janelasDeLogin.has(wc)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 560, height: 760, autoHideMenuBar: true, icon: ICONE } };
    }
    externo(url);
    return { action: 'deny' };
  });
  wc.on('did-create-window', (filha, { url }) => { janelasDeLogin.add(filha.webContents); proteger(filha.webContents, url); });
}

const novaView = (preload, ouvirTeclas = true) => {
  const v = new WebContentsView({ webPreferences: prefs(preload) });
  v.setBackgroundColor('#161922');
  if (ouvirTeclas) ligarAtalhos(v.webContents);
  return v;
};

// tamanho e posição da última vez, se ainda couberem num monitor (o monitor pode ter sumido)
function limitesIniciais() {
  const j = pref.janela, base = { width: 1520, height: 940 };
  if (j && Layout.visivel(j, screen.getAllDisplays().map((d) => d.workArea))) return { x: j.x, y: j.y, width: j.width, height: j.height };
  return base;
}
function guardarJanela() {
  if (!janela || janela.isDestroyed()) return;
  pref.janela = { ...janela.getNormalBounds(), maximizada: janela.isMaximized() };
  salvarPrefDepois();
}

function criarJanela() {
  // o fundo da janela aparece no filete de 1 px entre as metades do lado a lado
  janela = new BaseWindow({ ...limitesIniciais(), minWidth: 960, minHeight: 600, title: 'Lupa', backgroundColor: '#2a303d', icon: ICONE, show: false });
  if (pref.janela?.maximizada) janela.maximize();
  casca = new WebContentsView({ webPreferences: prefs(path.join(__dirname, 'preload-casca.js')) });
  casca.setBackgroundColor('#00000000');      // transparente: com o menu de ajustes aberto a casca cobre a janela toda
  ligarAtalhos(casca.webContents);
  // a casca recarregou ou caiu com o menu aberto: fecha o menu, senão ela ficaria cobrindo os jogos e prendendo os cliques
  for (const ev of ['did-start-loading', 'render-process-gone']) casca.webContents.on(ev, () => { if (menuAberto) fecharMenu(); });
  casca.webContents.loadFile(path.join(__dirname, 'casca.html'));
  janela.contentView.addChildView(casca);
  for (const a of abas) if (a.tipo === 'jogo' && !(a.id === 'conta2' && pref.soConta1)) criarJogo(a);
  painel = novaView(path.join(__dirname, 'preload-lupa.js'));
  painel.webContents.loadFile(path.join(LUPA, 'painel.html'));
  painel.webContents.on('did-finish-load', escolherNoPainel);
  central = novaView(path.join(__dirname, 'preload-lupa.js'));
  central.webContents.loadFile(path.join(LUPA, 'central.html'));
  abas.find((a) => a.id === 'central').view = central;
  janela.contentView.addChildView(painel);
  janela.contentView.addChildView(central);
  for (const v of [casca, painel, central]) v.webContents.setWindowOpenHandler(({ url }) => { externo(url); return { action: 'deny' }; });
  janela.on('resize', arrumar);
  janela.on('restore', arrumar);
  for (const ev of ['resize', 'move', 'maximize', 'unmaximize']) janela.on(ev, guardarJanela);
  janela.on('focus', () => janela.flashFrame(false));
  janela.on('blur', () => { if (menuAberto) fecharMenu(); });
  // o X esconde na bandeja (a primeira vez avisa); "Sair", a atualização e o fim da sessão fecham de verdade
  janela.on('close', (e) => {
    guardarJanela();
    if (saindo || !pref.fecharParaBandeja || !bandeja) return;
    e.preventDefault();
    janela.hide();
    if (!pref.avisouBandeja) { pref.avisouBandeja = true; salvarPref(); mostrarAviso('Lupa', 'A Lupa continua rodando na bandeja', null); }
  });
  // não segurar o desligamento do Windows; se outro programa vetar o "query", o X volta a esconder na bandeja em 1 min
  let vetado = 0;
  janela.on('query-session-end', () => { saindo = true; clearTimeout(vetado); vetado = setTimeout(() => { saindo = false; }, 60e3); });
  janela.on('session-end', () => { clearTimeout(vetado); saindo = true; });
  janela.on('closed', () => { janela = null; app.quit(); });
  arrumar();
  if (process.argv.includes(AO_INICIAR[0])) janela.minimize();      // oculta, já aparece direto minimizada
  else janela.show();
}

// ---------- bandeja ----------
function criarBandeja() {
  bandeja = new Tray(nativeImage.createFromPath(ICONE).resize({ width: 32, height: 32 }));
  bandeja.setToolTip('Lupa');
  bandeja.on('double-click', mostrarJanela);
  atualizarBandeja();
}
let assinaturaBandeja = '';
function atualizarBandeja() {
  if (!bandeja) return;
  const itens = modos().map((m) => ({ id: m.id, label: m.id === 'lado' ? 'Lado a lado' : m.id === 'central' ? 'Central' : rotulo(abas.find((a) => a.id === m.id)) }));
  const ass = JSON.stringify(itens);
  if (ass === assinaturaBandeja) return;
  assinaturaBandeja = ass;
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mostrar', click: mostrarJanela },
    { type: 'separator' },
    ...itens.map((m) => ({ label: m.label, click: () => { ativar(m.id); mostrarJanela(); } })),
    { type: 'separator' },
    { label: 'Sair', click: sair }
  ]));
}
function sair() { saindo = true; app.quit(); }

// ---------- posição das views ----------
function layoutAtual() {
  const [L, A] = janela.getContentSize();
  return Layout.calcular({ largura: L, altura: A, modo: modo(), painelAberto: painelVisivel(), larguraPainel: pref.larguraPainel });
}

// o modo ativo ocupa a área abaixo da casca (a casca cresce 22 px no lado a lado, para as etiquetas); com painel, ele
// fica à direita
function arrumar() {
  if (!janela) return;
  const [L, A] = janela.getContentSize();
  if (L <= 0 || A <= 0) return;      // minimizada: o Windows informa tamanho zero; o restore arruma de novo
  const r = layoutAtual();
  casca.setBounds(menuAberto ? { x: 0, y: 0, width: L, height: A } : r.casca);
  for (const a of abas) {
    if (!a.view) continue;
    const rect = a.tipo === 'jogo' ? r.jogos[a.id] : modo() === 'central' ? r.central : null;
    a.view.setVisible(!!rect);
    if (rect) a.view.setBounds(rect);
  }
  painel.setVisible(!!r.painel);
  if (r.painel) painel.setBounds(r.painel);
  aplicarZoom(r);
  if (modo() === 'lado') avisarCasca();      // as etiquetas seguem as metades
}

// zoom de cada view: no lado a lado, o automático da metade (mantém o layout normal do jogo) vezes o ajuste do usuário
function aplicarZoom(r = layoutAtual()) {
  const gj = modo() === 'lado' ? 'lado' : 'solo';      // os jogos escondidos já ficam com o zoom do modo seguinte
  for (const a of abas) {
    if (!a.view) continue;
    // só os jogos: as páginas do app são todas file://, e o Chromium guarda o zoom por host (a Central levaria a casca junto)
    const largura = (a.tipo === 'jogo' ? r.jogos[a.id] : r.central)?.width || a.view.getBounds().width;
    const z = a.tipo === 'jogo' ? Layout.zoomDoJogo(gj, largura, pref.zoom[gj]) : 1;
    const wc = a.view.webContents;
    if (!wc.isDestroyed() && Math.abs(wc.getZoomFactor() - z) > 0.001) wc.setZoomFactor(z);
  }
}
function ajustarZoomAtivo(acao) {
  if (modo() === 'central') return;      // a Central não tem zoom (ver aplicarZoom)
  const g = Layout.grupoDe(modo());
  pref.zoom[g] = Layout.ajustarZoom(pref.zoom[g], acao);
  aplicarZoom();
  salvarPrefDepois();
}

function escolherNoPainel() {
  const nome = pref.nomes[abaAtiva().id];
  if (nome && painel) painel.webContents.send('lupa:escolher', nome);
}

function ativar(id) {
  if (!modos().some((m) => m.id === id)) return;
  pref.ativa = id;
  salvarPref();
  arrumar();
  escolherNoPainel();
  avisarCasca();
}

function abrirMini() {
  if (mini && !mini.isDestroyed()) { mini.show(); mini.focus(); return; }
  mini = new BrowserWindow({ width: 380, height: 620, alwaysOnTop: true, autoHideMenuBar: true, title: 'Lupa · mini', icon: ICONE, backgroundColor: '#161922', webPreferences: prefs(path.join(__dirname, 'preload-lupa.js')) });
  mini.loadFile(path.join(LUPA, 'central.html'), { hash: 'mini' });
  mini.on('closed', () => { mini = null; });
}

// ---------- casca ----------
function rotulo(a) {
  const nome = pref.nomes[a.id];
  if (!nome) return a.padrao;
  const campeao = vm.runInContext('typeof LUPA_PLANOS === "object" ? LUPA_PLANOS : {}', envio)[nome]?.campeao;
  return campeao ? `${nome} · ${campeao}` : nome;
}
const rotuloDoModo = (m) => (m.id === 'lado' ? 'Lado a lado' : rotulo(abas.find((a) => a.id === m.id)));
const estadoCasca = () => {
  const m = modos().find((x) => x.id === modo());
  return {
    abas: modos().map((x) => ({ id: x.id, tipo: x.tipo, rotulo: rotuloDoModo(x), alertas: alertas[x.id] || [] })),
    ativa: modo(), modo: m.tipo === 'jogo' ? 'conta' : m.tipo, painelAberto: painelVisivel(), menuAberto,
    versao: app.getVersion(), atualizacao, instalado: app.isPackaged, iniciarComWindows: iniciaComWindows(),
    fecharParaBandeja: pref.fecharParaBandeja, larguraPainel: pref.larguraPainel, soConta1: pref.soConta1,
    // só no lado a lado: onde fica a etiqueta de cada metade (x e largura em px da janela)
    etiquetas: janela && modo() === 'lado'
      ? layoutAtual().etiquetas.map((e) => ({ ...e, rotulo: rotulo(abas.find((a) => a.id === e.id)), alertas: alertas[e.id] || [], foco: e.id === ultimoFoco }))
      : [],
    atalhos: ATALHOS
  };
};
function avisarCasca() {
  if (casca && !casca.webContents.isDestroyed()) casca.webContents.send('casca:mudou', estadoCasca());
  atualizarBandeja();
}
function fecharMenu() { menuAberto = false; arrumar(); avisarCasca(); }

// ---------- alertas (o ponto nas abas e o selo na barra de tarefas) ----------
// calculados aqui, do último estado:<nome> de cada conta (alertas.js); a cada estado novo e a cada 30 s (sem leitura)
const estados = new Map();      // nome do personagem → último estado:<nome>
let alertas = {}, totalAlertas = 0, iconePonto = null;
function recalcularAlertas() {
  const agora = Date.now(), novo = {};
  for (const a of abas) if (a.tipo === 'jogo' && a.view) novo[a.id] = alertasDe(estados.get(pref.nomes[a.id]), agora, INICIO, modo() === a.id || modo() === 'lado');
  if (JSON.stringify(novo) === JSON.stringify(alertas)) return;
  alertas = novo;
  atualizarSelo();
  avisarCasca();
}
// um ponto vermelho 16x16 (BGRA, com borda suave) sem arquivo novo
function pontoDoSelo() {
  const T = 16, buf = Buffer.alloc(T * T * 4);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const d = Math.hypot(x + 0.5 - T / 2, y + 0.5 - T / 2), alfa = Math.max(0, Math.min(1, T / 2 - 0.5 - d + 1)), o = (y * T + x) * 4;
    buf[o] = 0x4d; buf[o + 1] = 0x48; buf[o + 2] = 0xe5; buf[o + 3] = Math.round(alfa * 255);
  }
  return nativeImage.createFromBitmap(buf, { width: T, height: T });
}
function atualizarSelo() {
  const total = Object.values(alertas).reduce((s, l) => s + l.length, 0);
  if (total === totalAlertas || !janela) return;
  totalAlertas = total;
  iconePonto ||= pontoDoSelo();
  janela.setOverlayIcon(total ? iconePonto : null, total ? `${total} alerta${total > 1 ? 's' : ''}` : '');
}

// ---------- ações no jogo (só quando o jogador pede) ----------
// O pedido (botão do painel ou Alt+L) autoriza UMA aba por pouco tempo (Acoes.REGRAS), e só uma ação por vez entre as contas:
// no lado a lado, duas juntas disputariam o foco entre o apertar e o soltar do mouse. O preload do jogo (acao-jogo.js) pede
// cada clique ou tecla e o main manda uma entrada de verdade (sendInputEvent), só na aba que está à vista.
let acaoAtual = null;      // { aba, tipo, ate, resta }: a ação em andamento
const emAndamento = () => !!acaoAtual && Date.now() <= acaoAtual.ate;
// recusa (false) se já tem uma ação em andamento: um segundo pedido não troca nem renova a autorização da primeira
function pedirAcao(a, tipo) {
  if (!a?.view || a.tipo !== 'jogo' || emAndamento()) return false;
  acaoAtual = { aba: a.id, ...Acoes.autorizacao(tipo) };
  a.view.webContents.send('acao:iniciar', { tipo });
  return true;
}
// a ação daquela aba acabou, foi parada ou a página dela foi embora: a autorização some. Com `motivo` (página recarregou ou
// caiu), o painel deixa de mostrar "rodando" e mostra o motivo
function encerrarAcao(a, motivo) {
  if (!acaoAtual || acaoAtual.aba !== a.id) return;
  const tipo = acaoAtual.tipo, nome = pref.nomes[a.id];
  acaoAtual = null;
  if (motivo && tipo === 'tarefa' && nome) armazem.set({ ['acao:' + nome]: { tipo, estado: 'erro', texto: motivo, em: Date.now() } });
}
// a aba que mandou o pedido de entrada, se é a da ação e está à vista (com a janela aberta); null se não pode
function abaAutorizada(wc) {
  const a = abaDe(wc);
  if (!a || a.tipo !== 'jogo' || acaoAtual?.aba !== a.id || !janela || !janela.isVisible() || janela.isMinimized()) return null;
  const r = layoutAtual().jogos[a.id];
  return r ? { a, r } : null;
}

// ---------- atalhos do app ----------
// só as teclas do atalhos.js são do app: o preventDefault vale só para elas, o resto segue para a página. Fora as duas
// ações acima, o app não injeta tecla, clique ou comando no jogo
function ligarAtalhos(wc) {
  wc.on('before-input-event', (e, input) => {
    const acao = atalhoDe(input);
    if (!acao) return;
    e.preventDefault();
    if (input.isAutoRepeat && !acao.startsWith('zoom')) return;
    executarAtalho(acao);
  });
}
function executarAtalho(acao) {
  if (acao.startsWith('aba:')) {
    const ids = modos().map((m) => m.id), alvo = acao.slice(4), i = ids.indexOf(modo());
    if (alvo === 'proxima') ativar(ids[(i + 1) % ids.length]);
    else if (alvo === 'anterior') ativar(ids[(i + ids.length - 1) % ids.length]);
    else ativar(alvo);      // ativar() ignora o que não existe (Conta 2 desligada)
  } else if (acao === 'painel') alternarPainel();
  else if (acao === 'recarregar') recarregarAba();
  else if (acao.startsWith('zoom:')) ajustarZoomAtivo(acao.slice(5));
  else if (acao === 'coluna' && modo() !== 'central') pedirAcao(abaAtiva(), 'coluna');      // a setinha do próprio jogo
}
function alternarPainel() {
  if (modo() === 'central') return;
  if (modo() === 'lado') pref.painelLado = !pref.painelLado; else pref.painelAberto = !pref.painelAberto;
  salvarPref(); arrumar(); escolherNoPainel(); avisarCasca();
}
function recarregarAba() { const a = abaAtiva(); if (a.tipo === 'jogo') a.view.webContents.reload(); }

// "Usar só a Conta 1": a view da Conta 2 nem existe (economiza memória); a aba e o Lado a lado somem
function aplicarSoConta1() {
  const a = abas.find((x) => x.id === 'conta2');
  if (pref.soConta1 && a.view) { janela.contentView.removeChildView(a.view); a.view.webContents.close(); a.view = null; }
  else if (!pref.soConta1 && !a.view) criarJogo(a);
  if (pref.soConta1 && ultimoFoco === 'conta2') ultimoFoco = 'conta1';
  pref.ativa = Layout.modoValido(pref.ativa, pref.soConta1);
  salvarPref(); recalcularAlertas(); arrumar(); escolherNoPainel(); avisarCasca();
}

// ---------- atualização (Releases do GitHub Iguinhowill/lupa) ----------
function mudarAtualizacao(x) { atualizacao = x; avisarCasca(); }
const procurar = () => { if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {}); };
function prepararAtualizacao() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.on('checking-for-update', () => mudarAtualizacao({ tipo: 'procurando' }));
  autoUpdater.on('update-available', (i) => mudarAtualizacao({ tipo: 'disponivel', versao: i.version, notas: notasEmTexto(i.releaseNotes) }));
  autoUpdater.on('update-not-available', () => mudarAtualizacao({ tipo: 'em-dia' }));
  autoUpdater.on('download-progress', (p) => mudarAtualizacao({ tipo: 'baixando', versao: atualizacao.versao, notas: atualizacao.notas, pct: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', (i) => mudarAtualizacao({ tipo: 'pronta', versao: i.version, notas: atualizacao.notas }));
  autoUpdater.on('error', (e) => mudarAtualizacao({ tipo: 'erro', msg: String(e?.message || e).slice(0, 200) }));
  procurar();
  setInterval(procurar, 6 * 3600e3);
}
function atualizar() {
  if (atualizacao.tipo === 'disponivel') { mudarAtualizacao({ tipo: 'baixando', versao: atualizacao.versao, notas: atualizacao.notas, pct: 0 }); autoUpdater.downloadUpdate().catch(() => {}); }
  else if (atualizacao.tipo === 'pronta') {
    armazem.gravar();
    saindo = true;      // senão o X da janela só a esconderia na bandeja e a instalação não começaria
    setTimeout(() => { saindo = false; }, 20e3);      // se a instalação não fechar o app, o X volta ao normal
    autoUpdater.quitAndInstall(true, true);
  }
}

// ---------- IPC (ver ARQUITETURA.md) ----------
let envio;
function ligarIpc() {
  ipcMain.on('lupa:uaFirefox', (e) => { e.returnValue = UA_FIREFOX; });      // síncrono: o preload das páginas do Google
  ipcMain.handle('armazem:get', (_e, c) => semPrivadas(armazem.get(c)));
  ipcMain.handle('armazem:set', (e, obj) => {
    obj = semPrivadas(obj);
    // a primeira ficha lida numa aba diz de quem é a conta
    const a = abaDe(e.sender), nome = a && Object.keys(obj).find((k) => k.startsWith('estado:'))?.slice(7);
    if (nome) estados.set(nome, obj['estado:' + nome]);
    if (nome && pref.nomes[a.id] !== nome) { pref.nomes[a.id] = nome; salvarPref(); avisarCasca(); if (a === abaAtiva()) escolherNoPainel(); }
    if (nome) recalcularAlertas();
    armazem.set(obj);
  });
  ipcMain.handle('armazem:remove', (_e, c) => armazem.remove([].concat(c || []).filter((k) => !PRIVADAS.has(k))));
  ipcMain.handle('lupa:mensagem', (e, msg) => {
    if (msg?.tipo === 'ola') return undefined;
    if (msg?.tipo === 'aviso') { avisar(msg, abaDe(e.sender)); return undefined; }
    return despachar(msg);
  });
  ipcMain.handle('lupa:abrir', (_e, url) => {
    const u = String(url || '');
    if (/central\.html#mini$/.test(u)) abrirMini();
    else if (/^file:.*central\.html(#.*)?$/.test(u)) { ativar('central'); mostrarJanela(); }
    else externo(u);
  });
  // o botão "Entregar e seguir" do painel (tipo 'tarefa') e o Parar: na aba do personagem que o painel mostra
  ipcMain.handle('lupa:acao', (e, { tipo, nome } = {}) => {
    if (!painel || e.sender !== painel.webContents || !['tarefa', 'parar'].includes(tipo)) return { erro: 'Pedido inválido.' };
    const a = abas.find((x) => x.tipo === 'jogo' && x.view && pref.nomes[x.id] === nome);
    if (!a) return { erro: 'Não achei a aba desse personagem.' };
    if (tipo === 'parar') { a.view.webContents.send('acao:parar'); encerrarAcao(a); return { ok: true }; }
    if (emAndamento()) return { erro: acaoAtual.aba === a.id ? 'Já tem uma ação em andamento nesta conta.' : 'A outra conta está no meio de uma ação: espere ela terminar.' };
    if (modo() !== a.id && modo() !== 'lado') ativar(a.id);      // a ação acontece à vista
    return pedirAcao(a, 'tarefa') ? { ok: true } : { erro: 'A aba do jogo não está pronta.' };
  });
  // as entradas que o acao-jogo.js pede: clique em px CSS da página e as teclas B e M; devolve se mandou
  ipcMain.handle('acao:clicar', async (e, p) => {
    const v = abaAutorizada(e.sender);
    if (!v) return false;
    const wc = v.a.view.webContents, pt = Acoes.pontoNaView(p, wc.getZoomFactor(), v.r);
    if (!pt || !Acoes.gastar(acaoAtual)) return false;
    // o foco vai para o jogo, como num clique de verdade: com o foco no painel (onde está o botão "Entregar e seguir"), o
    // Chromium descartava o apertar e o soltar e só o mover chegava. Mover, apertar e soltar com um intervalo, como a mão
    if (!wc.isFocused()) { wc.focus(); await new Promise((ok) => setTimeout(ok, 120)); }      // o foco não muda na hora
    for (const ev of Acoes.clique(pt)) { if (wc.isDestroyed()) return false; wc.sendInputEvent(ev); await new Promise((ok) => setTimeout(ok, Acoes.INTERVALO)); }
    return true;
  });
  ipcMain.handle('acao:tecla', async (e, p) => {
    const v = abaAutorizada(e.sender), evs = Acoes.tecla(p?.tecla);
    if (!v || !evs || !Acoes.gastar(acaoAtual)) return false;
    const wc = v.a.view.webContents;
    if (!wc.isFocused()) { wc.focus(); await new Promise((ok) => setTimeout(ok, 120)); }      // a tecla vai para a view em foco
    for (const ev of evs) { if (wc.isDestroyed()) return false; wc.sendInputEvent(ev); await new Promise((ok) => setTimeout(ok, Acoes.INTERVALO)); }
    return true;
  });
  ipcMain.handle('acao:fim', (e) => { const a = abaDe(e.sender); if (a) encerrarAcao(a); });
  ipcMain.handle('casca:estado', () => estadoCasca());
  ipcMain.handle('casca:ativar', (_e, id) => ativar(id));
  ipcMain.handle('casca:painel', () => alternarPainel());
  ipcMain.handle('casca:recarregar', () => recarregarAba());
  ipcMain.handle('casca:menu', (_e, aberto) => {
    menuAberto = !!aberto;
    if (menuAberto) { janela.contentView.addChildView(casca); casca.webContents.focus(); }      // de novo = vai para o topo, sobre os jogos
    arrumar(); avisarCasca();
  });
  // opções do menu de ajustes: { chave, valor }, só as conhecidas
  ipcMain.handle('casca:opcao', (_e, { chave, valor } = {}) => {
    if (chave === 'fecharParaBandeja') pref.fecharParaBandeja = !!valor;
    else if (chave === 'larguraPainel' && Layout.LARGURAS_PAINEL.includes(valor)) pref.larguraPainel = valor;
    else if (chave === 'soConta1') { pref.soConta1 = !!valor; aplicarSoConta1(); return; }
    else return;
    salvarPref(); arrumar(); avisarCasca();
  });
  ipcMain.handle('casca:procurar', () => procurar());
  ipcMain.handle('casca:atualizar', () => atualizar());
  ipcMain.handle('casca:iniciarComWindows', (_e, sim) => { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!sim, args: AO_INICIAR }); avisarCasca(); });

  // cada mudança do armazém vai para o envio.js e para as páginas da Lupa (jogos, painel, Central, mini)
  armazem.on('mudou', (mud) => {
    for (const fn of ouvintesMud) { try { fn(mud, 'local'); } catch {} }
    let novoEstado = false;
    for (const k of Object.keys(mud)) if (k.startsWith('estado:')) { estados.set(k.slice(7), mud[k].newValue); novoEstado = true; }
    if (novoEstado) recalcularAlertas();
    const pub = semPrivadas(mud);
    if (Object.keys(pub).length) {
      const alvos = [...abas.map((a) => a.view), painel].map((v) => v?.webContents);
      if (mini && !mini.isDestroyed()) alvos.push(mini.webContents);
      for (const wc of alvos) if (wc && !wc.isDestroyed()) wc.send('armazem:mudou', pub);
    }
    if ('config' in mud) aplicarAcordado();
  });
}

// ---------- início ----------
app.on('second-instance', mostrarJanela);
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { saindo = true; try { bandeja?.destroy(); bandeja = null; } catch {} try { clearTimeout(esperaPref); guardarJanela(); salvarPref(); armazem?.gravar(); } catch {} });
app.whenReady().then(() => {
  armazem = new Armazem(path.join(app.getPath('userData'), 'lupa-dados.json'));
  const salvo = armazem.get('app:pref')['app:pref'] || {};
  pref = { ...pref, ...salvo, zoom: { ...pref.zoom, ...salvo.zoom }, nomes: { ...salvo.nomes } };
  pref.ativa = Layout.modoValido(pref.ativa, pref.soConta1);
  if (!Layout.LARGURAS_PAINEL.includes(pref.larguraPainel)) pref.larguraPainel = 380;
  for (const [k, v] of Object.entries(armazem.get(null))) if (k.startsWith('estado:')) estados.set(k.slice(7), v);
  ligarIpc();
  migrarInicio();
  envio = iniciarEnvio();
  criarJanela();
  criarBandeja();
  recalcularAlertas();
  setInterval(recalcularAlertas, 30e3);      // o "sem leitura" nasce do tempo passando, não de um estado novo
  aplicarAcordado();
  prepararAtualizacao();
});
