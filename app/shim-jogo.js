// Lupa (app) · o objeto `chrome` do content.js, no mundo isolado do preload das abas do jogo.
// Fala com o processo principal por IPC. Não expõe NADA à página (sem contextBridge): o jogo não pode ver o armazém.
const { ipcRenderer, webFrame } = require('electron');

// login do Google: nas páginas dele o main.js apresenta o app como Firefox, e o Firefox não tem navigator.userAgentData
// (com ele, o Google percebe o Chromium embutido e recusa o login)
if (/(^|\.)google\.com$/.test(location.hostname)) {
  webFrame.executeJavaScript("try { Object.defineProperty(Navigator.prototype, 'userAgentData', { get() { return undefined; }, configurable: true }); } catch (e) {}").catch(() => {});
}

const chrome = (() => {
  const ouvintes = new Set();
  // o main avisa toda gravação; o Chrome entrega (mudanças, área) e a área aqui é sempre 'local'
  ipcRenderer.on('armazem:mudou', (_e, mud) => {
    for (const fn of [...ouvintes]) { try { fn(mud, 'local'); } catch {} }
  });
  return {
    storage: {
      local: {
        // chaves: null, string, string[] ou objeto de padrões, como no Chrome (a regra fica no main)
        get: (chaves) => ipcRenderer.invoke('armazem:get', chaves ?? null),
        set: (obj) => ipcRenderer.invoke('armazem:set', obj),
        remove: (chaves) => ipcRenderer.invoke('armazem:remove', chaves),
      },
      onChanged: {
        addListener: (fn) => { ouvintes.add(fn); },
        removeListener: (fn) => { ouvintes.delete(fn); },
      },
    },
    runtime: {
      id: 'lupa-app', // o content.js usa o id para saber se a extensão "continua viva"
      sendMessage: (msg) => ipcRenderer.invoke('lupa:mensagem', msg),
    },
  };
})();
