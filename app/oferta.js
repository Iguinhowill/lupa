// Lupa (app) · as ofertas do Capitão da Legião pelo texto que o jogo mostra (puro). Entra no preload do jogo
// (copiar-lupa.mjs) e no teste (acoes.test.js). Ex.: título "120 monstros em Fosso do Dragão" e detalhe
// "~15 min · 120.3k de XP · 30.1k de ouro · item épico" → { min: 15, xp: 120300, ouro: 30100, zona: 'Fosso do Dragão' }.
'use strict';

const OFERTA = (() => {
  // números como o jogo escreve (fmt do cena.js): "670", "12.3k", "1.2M"; e "5.697.935" (inteiro com milhar)
  function numero(s) {
    const m = String(s ?? '').trim().match(/^([\d.,]+)\s*([kM])?/);
    if (!m) return 0;
    const mult = m[2] === 'M' ? 1e6 : m[2] === 'k' ? 1e3 : 1;
    const n = mult > 1 ? m[1].replace(',', '.') : m[1].replace(/[.,](?=\d{3}(?!\d))/g, '').replace(',', '.');
    return (parseFloat(n) || 0) * mult;
  }
  // tempo ("~15 min" ou "~1,5 h"), XP, ouro e a zona ("... em <zona>"); o que não achar fica null
  function lerOferta(titulo, detalhe) {
    const d = String(detalhe || ''), t = String(titulo || '').replace(/\s+/g, ' ').trim();
    const h = d.match(/~\s*([\d.,]+)\s*h\b/), m = d.match(/~\s*([\d.,]+)\s*min\b/);
    const min = h ? parseFloat(h[1].replace(',', '.')) * 60 : m ? numero(m[1]) : null;
    const xp = d.match(/([\d.,]+\s*[kM]?) de XP/), ouro = d.match(/([\d.,]+\s*[kM]?) de ouro/);
    const zona = t.match(/\sem (.+)$/);
    return { min: min > 0 ? min : null, xp: xp ? numero(xp[1]) : null, ouro: ouro ? numero(ouro[1]) : null, zona: zona ? zona[1].trim() : null };
  }
  // a de mais XP por minuto (no empate, a mais curta); sem tempo, XP ou zona não entra. Devolve o índice ou -1
  function escolher(ofertas) {
    let melhor = -1, taxa = -1;
    (ofertas || []).forEach((o, k) => {
      if (!o || !(o.min > 0) || !(o.xp > 0) || !o.zona) return;
      const r = o.xp / o.min;
      if (r > taxa + 1e-9 || (Math.abs(r - taxa) <= 1e-9 && o.min < ofertas[melhor].min)) { melhor = k; taxa = r; }
    });
    return melhor;
  }
  return { numero, lerOferta, escolher };
})();

if (typeof module === 'object' && module && module.exports) module.exports = OFERTA;
