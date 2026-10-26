// Lupa (app) · o objeto `chrome` do content.js, no mundo isolado do preload das abas do jogo.
// Fala com o processo principal por IPC. Nada do armazém vai para a página: o único uso do contextBridge é o
// executeInMainWorld do disfarce de Firefox nas páginas do Google, logo abaixo.
const { ipcRenderer, contextBridge } = require('electron');

// login do Google: o main.js manda o cabeçalho de um Firefox nas páginas dele, e aqui o JavaScript da página vê o mesmo
// Firefox (userAgent, plataforma, sem userAgentData e sem window.chrome). Com qualquer pista de Chromium, o Google recusa
// o login ("esse navegador ou app pode não ser seguro"). Roda síncrono, antes do primeiro script da página: com o
// webFrame.executeJavaScript (assíncrono) os scripts do Google às vezes chegavam antes. Limitação conhecida: vale só no
// frame principal; iframes e workers da página ainda veem o Chromium (ver ARQUITETURA.md).
if (/(^|\.)(google\.com(\.br)?|youtube\.com)$/.test(location.hostname)) {
  const ua = ipcRenderer.sendSync('lupa:uaFirefox');
  contextBridge.executeInMainWorld({
    func: (ua) => {
      const fixo = (alvo, nome, valor) => { try { Object.defineProperty(alvo, nome, { get: () => valor, configurable: true }); } catch {} };
      // o Firefox não tem estas: apaga de verdade ('x' in navigator dá false); se não der, fica ao menos undefined
      // (atribuindo, que funciona em propriedade gravável não configurável, ou trocando por um getter)
      const apaga = (alvo, dono, nome) => {
        try { delete dono[nome]; } catch {}
        if (!(nome in alvo)) return;
        try { dono[nome] = undefined; } catch {}
        if (alvo[nome] !== undefined) fixo(dono, nome, undefined);
      };
      const n = Navigator.prototype;
      fixo(n, 'userAgent', ua);
      fixo(n, 'appVersion', '5.0 (Windows)');
      fixo(n, 'platform', 'Win32');
      fixo(n, 'vendor', '');
      fixo(n, 'productSub', '20100101');
      fixo(n, 'oscpu', 'Windows NT 10.0; Win64; x64');
      apaga(navigator, n, 'userAgentData');
      apaga(window, window, 'chrome');
    },
    args: [ua]
  });
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
