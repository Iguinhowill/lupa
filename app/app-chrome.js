// Lupa (app) · faz o global `chrome` destas páginas ser o window.lupaChrome (exposto pelo preload-lupa.js).
// No Electron já existe um window.chrome (objeto interno do Chromium); defineProperty troca mesmo que ele seja
// somente leitura, desde que configurável, e a atribuição simples é o plano B.
(function () {
  const api = window.lupaChrome;
  if (!api) return;
  try {
    Object.defineProperty(window, 'chrome', { value: api, configurable: true, writable: true, enumerable: true });
  } catch {
    try { window.chrome = api; } catch {}
  }
})();
