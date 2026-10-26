// Lupa (app) · processo principal
// Uma janela com a barra de abas (casca), uma aba por conta do jogo (cada uma na sua partição: login separado), o
// painel da Lupa à direita e a Central. Faz o papel do service worker da extensão: guarda os dados (armazem.js), roda
// o envio.js da Lupa num vm com um `chrome` equivalente, mostra os avisos e segura o PC acordado. Só lê a tela: nada
// aqui clica, aperta tecla ou fala com o servidor do jogo. Liberado pelo Brunox em 26/10/2026. Ver ARQUITETURA.md.
'use strict';

const { app, BaseWindow, BrowserWindow, Menu, WebContentsView, ipcMain, Notification, powerSaveBlocker, shell, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Armazem } = require('./armazem');

const JOGO = process.env.LUPA_JOGO || 'https://lolidle.com/jogar';
const ORIGEM_JOGO = new URL(JOGO).origin;
// a sessão do Lupa Online (tokens) fica só no processo principal, com o envio.js: nenhuma página lê, grava ou recebe
const PRIVADAS = new Set(['nuvem:sessao']);
const semPrivadas = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => !PRIVADAS.has(k)));
const ALTURA_CASCA = 44, LARGURA_PAINEL = 380;
const LUPA = path.join(__dirname, 'lupa');
const ICONE = path.join(__dirname, 'icone.png');
// páginas que o jogo abre numa janela e que precisam da mesma partição (login do Google, Twitch e Discord); o resto
// vai para o navegador do sistema
const DA_CONTA = /^https:\/\/((www\.)?lolidle\.com\/|accounts\.google\.com\/|id\.twitch\.tv\/|discord\.com\/(api\/)?oauth2\/)/;
// subdomínios de conta do Google (accounts, myaccount, gds...), menos o www: o google.com/url?q= redireciona para qualquer
// lugar
const DO_JOGO = /^https:\/\/((www\.)?lolidle\.com|(?!www\.)[a-z0-9-]+\.google\.com|id\.twitch\.tv|discord\.com)\//;

if (!app.requestSingleInstanceLock()) app.exit(0);
app.setAppUserModelId('com.iguinhowill.lupa');
Menu.setApplicationMenu(null);
// a identificação vira a de um Chrome comum; nas páginas do Google (login), a de um Firefox: o Google recusa login em
// Chromium embutido ("esse navegador ou app pode não ser seguro"). Aqui troca o cabeçalho; o shim-jogo.js faz o
// JavaScript da página ver o mesmo Firefox
const nomeNoUa = app.getName().replace(/[^\w.-]/g, '').replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
const UA_CHROME = app.userAgentFallback.replace(new RegExp(`\\s(Electron|${nomeNoUa}|lupa|Lupa)\\/\\S+`, 'g'), '');
const UA_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';
const DO_GOOGLE = /^https:\/\/([a-z0-9-]+\.)*(google\.com(\.br)?|gstatic\.com|googleusercontent\.com|youtube\.com)\//;
// páginas de login entre as quais um login anda sozinho (o do Google passa pelo accounts.youtube.com; a Twitch manda
// para a página de login dela); só as de conta, não o youtube.com ou o googleusercontent.com inteiros
const NO_LOGIN = /^https:\/\/((accounts|myaccount|gds)\.google\.com(\.br)?\/|accounts\.youtube\.com\/|(id|passport)\.twitch\.tv\/|www\.twitch\.tv\/login|discord\.com\/)/;
const origemDe = (url) => { try { return new URL(url).origin; } catch { return ''; } };
// a aba do jogo fica no jogo e nos logins; de uma página de login, pode seguir para outra página de login
function permitido(url, atual) {
  return DO_JOGO.test(url) || origemDe(url) === ORIGEM_JOGO || (NO_LOGIN.test(atual || '') && NO_LOGIN.test(url));
}
app.userAgentFallback = UA_CHROME;

let armazem, janela, casca, painel, central, mini = null;
const abas = [
  { id: 'conta1', tipo: 'jogo', particao: 'persist:conta1', padrao: 'Conta 1' },
  { id: 'conta2', tipo: 'jogo', particao: 'persist:conta2', padrao: 'Conta 2' },
  { id: 'central', tipo: 'central', padrao: 'Central' }
];
let pref = { ativa: 'conta1', painelAberto: true, nomes: {} };
let atualizacao = { tipo: app.isPackaged ? 'procurando' : 'dev' };

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
const abaAtiva = () => abas.find((a) => a.id === pref.ativa) || abas[0];
const abaDe = (wc) => abas.find((a) => a.view?.webContents === wc);
const salvarPref = () => armazem.set({ 'app:pref': pref });

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
  const ctx = vm.createContext({ chrome, fetch, console, setTimeout, clearTimeout, setInterval, clearInterval, structuredClone, URL, URLSearchParams, AbortController });
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
function avisar(msg, aba) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: String(msg.titulo || 'Lupa'), body: String(msg.texto || ''), icon: ICONE });
  avisosVivos.add(n);
  n.on('click', () => { if (aba) ativar(aba.id); mostrarJanela(); });
  n.on('close', () => avisosVivos.delete(n));
  n.show();
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
  // navegação que já começa no Google ("Tentar novamente"); o "Entrar com Google" chega por redirecionamento, e aí
  // quem garante o Firefox é o cabeçalho (acima) e o shim-jogo.js. Não trocar no did-redirect-navigation: o
  // setUserAgent no meio do redirecionamento trava o processo principal (Electron 44)
  // `salto` é o endereço atual da navegação, inclusive no meio de uma cadeia de redirecionamentos
  let salto = '';
  wc.on('did-start-navigation', (d) => {
    if (!d.isMainFrame) return;
    if (!d.isSameDocument) salto = d.url;      // pushState/hash do jogo não é salto de cadeia nenhuma
    wc.setUserAgent(DO_GOOGLE.test(d.url) ? UA_FIREFOX : UA_CHROME);
  });
  wc.on('did-redirect-navigation', (d) => { if (d.isMainFrame) salto = d.url; });      // só guarda: nada de setUserAgent aqui
  const tema = fs.readFileSync(path.join(LUPA, 'tema.css'), 'utf8');
  wc.on('dom-ready', () => { if (/^https?:\/\/((www\.)?lolidle\.com|127\.0\.0\.1|localhost)[:/]/.test(wc.getURL())) wc.insertCSS(tema).catch(() => {}); });
  wc.setWindowOpenHandler(({ url }) => {
    if (DA_CONTA.test(url)) return { action: 'allow', overrideBrowserWindowOptions: { width: 560, height: 760, autoHideMenuBar: true, icon: ICONE } };
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // fora do jogo e dos logins, abre no navegador do sistema (origem exata: "lolidle.com.outro.site" não passa). Todo
  // link e todo redirecionamento é conferido: a aba não tem barra de endereço, e um redirecionamento aberto (o
  // google.com/url?q=, por exemplo) levaria qualquer página para dentro dela. Entre páginas de login o salto segue
  // (NO_LOGIN); um login corporativo com provedor de fora não funciona aqui dentro e abre no navegador.
  const barrar = (e) => { e.preventDefault(); if (/^https?:\/\//.test(e.url)) shell.openExternal(e.url); };
  wc.on('will-navigate', (e) => { if (e.isMainFrame && !permitido(e.url, wc.getURL())) barrar(e); });
  wc.on('will-redirect', (e) => { if (e.isMainFrame && !permitido(e.url, salto)) barrar(e); });
  wc.loadURL(JOGO);
  janela.contentView.addChildView(a.view);
}

function criarJanela() {
  janela = new BaseWindow({ width: 1520, height: 940, minWidth: 960, minHeight: 600, title: 'Lupa', backgroundColor: '#161922', icon: ICONE, show: false });
  casca = new WebContentsView({ webPreferences: prefs(path.join(__dirname, 'preload-casca.js')) });
  casca.setBackgroundColor('#161922');
  casca.webContents.loadFile(path.join(__dirname, 'casca.html'));
  janela.contentView.addChildView(casca);
  for (const a of abas) if (a.tipo === 'jogo') criarJogo(a);
  painel = new WebContentsView({ webPreferences: prefs(path.join(__dirname, 'preload-lupa.js')) });
  painel.setBackgroundColor('#161922');
  painel.webContents.loadFile(path.join(LUPA, 'painel.html'));
  painel.webContents.on('did-finish-load', escolherNoPainel);
  central = new WebContentsView({ webPreferences: prefs(path.join(__dirname, 'preload-lupa.js')) });
  central.setBackgroundColor('#161922');
  central.webContents.loadFile(path.join(LUPA, 'central.html'));
  abas.find((a) => a.id === 'central').view = central;
  janela.contentView.addChildView(painel);
  janela.contentView.addChildView(central);
  for (const v of [casca, painel, central]) v.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  janela.on('resize', arrumar);
  janela.on('closed', () => { janela = null; app.quit(); });
  arrumar();
  if (process.argv.includes(AO_INICIAR[0])) janela.minimize();      // oculta, já aparece direto minimizada
  else janela.show();
}

// a aba ativa ocupa a área abaixo da casca; num jogo, o painel da Lupa fica à direita
function arrumar() {
  if (!janela) return;
  const [L, A] = janela.getContentSize(), alt = Math.max(0, A - ALTURA_CASCA), aba = abaAtiva();
  const comPainel = aba.tipo === 'jogo' && pref.painelAberto;
  casca.setBounds({ x: 0, y: 0, width: L, height: ALTURA_CASCA });
  for (const a of abas) {
    const vis = a === aba;
    a.view.setVisible(vis);
    if (vis) a.view.setBounds({ x: 0, y: ALTURA_CASCA, width: comPainel ? Math.max(0, L - LARGURA_PAINEL) : L, height: alt });
  }
  painel.setVisible(comPainel);
  if (comPainel) painel.setBounds({ x: L - LARGURA_PAINEL, y: ALTURA_CASCA, width: LARGURA_PAINEL, height: alt });
}

function escolherNoPainel() {
  const nome = pref.nomes[abaAtiva().id];
  if (nome && painel) painel.webContents.send('lupa:escolher', nome);
}

function ativar(id) {
  if (!abas.some((a) => a.id === id)) return;
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
const estadoCasca = () => ({
  abas: abas.map((a) => ({ id: a.id, tipo: a.tipo, rotulo: rotulo(a) })),
  ativa: pref.ativa, painelAberto: pref.painelAberto, versao: app.getVersion(), atualizacao,
  instalado: app.isPackaged, iniciarComWindows: iniciaComWindows()
});
function avisarCasca() { if (casca && !casca.webContents.isDestroyed()) casca.webContents.send('casca:mudou', estadoCasca()); }

// ---------- atualização (Releases do GitHub Iguinhowill/lupa) ----------
function mudarAtualizacao(x) { atualizacao = x; avisarCasca(); }
const procurar = () => { if (app.isPackaged) autoUpdater.checkForUpdates().catch(() => {}); };
function prepararAtualizacao() {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.on('checking-for-update', () => mudarAtualizacao({ tipo: 'procurando' }));
  autoUpdater.on('update-available', (i) => mudarAtualizacao({ tipo: 'disponivel', versao: i.version }));
  autoUpdater.on('update-not-available', () => mudarAtualizacao({ tipo: 'em-dia' }));
  autoUpdater.on('download-progress', (p) => mudarAtualizacao({ tipo: 'baixando', versao: atualizacao.versao, pct: Math.round(p.percent || 0) }));
  autoUpdater.on('update-downloaded', (i) => mudarAtualizacao({ tipo: 'pronta', versao: i.version }));
  autoUpdater.on('error', (e) => mudarAtualizacao({ tipo: 'erro', msg: String(e?.message || e).slice(0, 200) }));
  procurar();
  setInterval(procurar, 6 * 3600e3);
}
function atualizar() {
  if (atualizacao.tipo === 'disponivel') { mudarAtualizacao({ tipo: 'baixando', versao: atualizacao.versao, pct: 0 }); autoUpdater.downloadUpdate().catch(() => {}); }
  else if (atualizacao.tipo === 'pronta') { armazem.gravar(); autoUpdater.quitAndInstall(true, true); }
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
    if (nome && pref.nomes[a.id] !== nome) { pref.nomes[a.id] = nome; salvarPref(); avisarCasca(); if (a === abaAtiva()) escolherNoPainel(); }
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
    else if (/^https?:\/\//.test(u)) shell.openExternal(u);
  });
  ipcMain.handle('casca:estado', () => estadoCasca());
  ipcMain.handle('casca:ativar', (_e, id) => ativar(id));
  ipcMain.handle('casca:painel', () => { pref.painelAberto = !pref.painelAberto; salvarPref(); arrumar(); avisarCasca(); });
  ipcMain.handle('casca:recarregar', () => { const a = abaAtiva(); if (a.tipo === 'jogo') a.view.webContents.reload(); });
  ipcMain.handle('casca:procurar', () => procurar());
  ipcMain.handle('casca:atualizar', () => atualizar());
  ipcMain.handle('casca:iniciarComWindows', (_e, sim) => { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: !!sim, args: AO_INICIAR }); avisarCasca(); });

  // cada mudança do armazém vai para o envio.js e para as páginas da Lupa (jogos, painel, Central, mini)
  armazem.on('mudou', (mud) => {
    for (const fn of ouvintesMud) { try { fn(mud, 'local'); } catch {} }
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
app.on('before-quit', () => { try { armazem?.gravar(); } catch {} });
app.whenReady().then(() => {
  armazem = new Armazem(path.join(app.getPath('userData'), 'lupa-dados.json'));
  pref = { ...pref, ...(armazem.get('app:pref')['app:pref'] || {}) };
  ligarIpc();
  migrarInicio();
  envio = iniciarEnvio();
  criarJanela();
  aplicarAcordado();
  prepararAtualizacao();
});
