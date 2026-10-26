// Lupa (app) · preload do painel, da Central e da mini janela.
// Expõe window.lupaChrome (o mesmo `chrome` da extensão, via IPC) e window.lupaApp. Só require('electron'): sandbox.
const { contextBridge, ipcRenderer } = require('electron');

const ouvintes = new Map(); // fn da página → fn do ipcRenderer (para o removeListener achar a certa)

contextBridge.exposeInMainWorld('lupaChrome', {
  storage: {
    local: {
      get: (chaves) => ipcRenderer.invoke('armazem:get', chaves ?? null),
      set: (obj) => ipcRenderer.invoke('armazem:set', obj),
      remove: (chaves) => ipcRenderer.invoke('armazem:remove', chaves),
    },
    onChanged: {
      addListener: (fn) => {
        if (typeof fn !== 'function' || ouvintes.has(fn)) return;
        const ponte = (_e, mud) => { try { fn(mud, 'local'); } catch {} };
        ouvintes.set(fn, ponte);
        ipcRenderer.on('armazem:mudou', ponte);
      },
      removeListener: (fn) => {
        const ponte = ouvintes.get(fn);
        if (!ponte) return;
        ipcRenderer.removeListener('armazem:mudou', ponte);
        ouvintes.delete(fn);
      },
    },
  },
  runtime: {
    id: 'lupa-app',
    sendMessage: (msg) => ipcRenderer.invoke('lupa:mensagem', msg),
    getURL: (c) => new URL(c, location.href).href,
  },
  tabs: {
    create: (o) => ipcRenderer.invoke('lupa:abrir', o && o.url),
    getCurrent: () => Promise.resolve(null), // não há "aba" de extensão aqui
    update: () => Promise.reject(new Error('sem tabs.update no app')), // a Central cai no tabs.create
  },
  windows: {
    create: (o) => ipcRenderer.invoke('lupa:abrir', o && o.url),
    update: () => Promise.reject(new Error('sem windows.update no app')),
  },
});

contextBridge.exposeInMainWorld('lupaApp', {
  // o main manda o personagem da aba ativa; o painel passa a mostrar esse
  aoEscolher: (fn) => { ipcRenderer.on('lupa:escolher', (_e, nome) => fn(nome)); },
});
