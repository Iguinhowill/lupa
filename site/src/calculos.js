// Lupa Online · contas das calculadoras (sem DOM, para testar no Node): Monte Carlo da forja do Ornn, XP/h medido e horas até um nível.
// Usa as tabelas de dados-jogo.js (global JOGO no navegador). Tudo o que sai daqui é ESTIMATIVA.
'use strict';

const CALC = (() => {
  const J = typeof JOGO !== 'undefined' ? JOGO : require('./dados-jogo.js');
  const HORA_MS = 3600e3;
  const mulberry32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const percentil = (ord, p) => ord[Math.min(ord.length - 1, Math.max(0, Math.ceil(p * ord.length) - 1))];      // posto mais próximo

  // chance da tentativa por (refino atual, falhas seguidas): uma tabela por refino, feita uma vez
  const tabChance = new Map();
  function chanceTab(ref, vip) {
    const k = ref + (vip ? 'v' : 'n');
    if (!tabChance.has(k)) {
      const regra = J.PERSISTENCIA[ref + 1], n = (regra?.max || 50) + 1;
      tabChance.set(k, Float64Array.from({ length: n }, (_, f) => J.chanceForja(ref, f, vip)));
    }
    return tabChance.get(k);
  }
  // Monte Carlo com semente fixa: forja do refino "de" até "ate". As falhas contam por refino alvo (+1..+7) e só zeram quando aquele
  // alvo dá certo (voltar de nível ao falhar não zera); falhas0 = falhas já acumuladas no primeiro alvo.
  // a mesma conta (semente fixa) dá sempre o mesmo resultado: guarda as últimas para não refazer a cada redesenho
  const memoForja = new Map();
  function simularForja(opts) {
    const k = JSON.stringify(opts);
    if (!memoForja.has(k)) { if (memoForja.size > 40) memoForja.delete(memoForja.keys().next().value); memoForja.set(k, simularForjaJa(opts)); }
    return memoForja.get(k);
  }
  function simularForjaJa({ id, de, ate, vip, falhas0 = 0, n = 2000, semente = 20261026 }) {
    const rnd = mulberry32(semente), preco = Array.from({ length: 8 }, (_, r) => (r < 7 ? J.precoRefino(id, r) : 0));
    const tab = Array.from({ length: 7 }, (_, r) => chanceTab(r, vip));
    const tent = new Float64Array(n), custo = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const falhas = new Int32Array(9);
      falhas[de + 1] = falhas0;
      let ref = de, t = 0, c = 0;
      while (ref < ate && t < 5e6) {
        const f = falhas[ref + 1], tb = tab[ref], p = tb[Math.min(f, tb.length - 1)];
        t++; c += preco[ref];
        if (rnd() < p) { ref++; falhas[ref] = 0; }
        else { falhas[ref + 1]++; if (rnd() < J.REGRESSAO_REFINO[ref]) ref--; }
      }
      tent[i] = t; custo[i] = c;
    }
    const media = (v) => v.reduce((a, b) => a + b, 0) / n, ot = Float64Array.from(tent).sort(), oc = Float64Array.from(custo).sort();
    return { n, tent: { media: media(tent), p50: percentil(ot, 0.5), p90: percentil(ot, 0.9) }, custo: { media: media(custo), p50: percentil(oc, 0.5), p90: percentil(oc, 0.9) } };
  }

  // XP/h medido pelas sessões (tempo caçando), numa janela em ms; a sessão cortada pela janela entra proporcional
  function xpHoraSessoes(sessoes, janela, agora = Date.now()) {
    let xp = 0, seg = 0;
    for (const x of sessoes || []) {
      const a = Math.max(x.ini, agora - janela), b = Math.min(x.fim, agora);
      if (b <= a) continue;
      const f = x.fim > x.ini ? (b - a) / (x.fim - x.ini) : 1;
      xp += x.xp * f; seg += x.seg * f;
    }
    return seg >= 60 ? (xp / seg) * 3600 : null;
  }
  // última hora: pelos baldes de 5 min (só existem enquanto caça)
  function xpHoraBaldes(sessoes, agora = Date.now()) {
    let xp = 0, n = 0;
    for (const x of sessoes || []) for (const b of x.baldes || []) if (b.t >= agora - HORA_MS && b.t <= agora) { xp += b.xp || 0; n++; }
    return n >= 3 ? xp / ((n * 300) / 3600) : null;
  }
  // horas de caça para sair do nível "de" (faltando "falta" de XP) até "ate"; com perda, o XP/h cai pelo fatorXp se ficar numa zona
  // de monstros de nível nm (xpH foi medido no nível "de")
  function horasAte(de, ate, falta, xpH, nm, comPerda) {
    const f0 = J.fatorXp(de, nm);
    let h = 0;
    for (let n = de; n < ate; n++) {
      const xp = n === de ? falta : J.xpParaNivel(n), ritmo = xpH * (comPerda ? J.fatorXp(n, nm) / f0 : 1);
      h += xp / ritmo;
    }
    return h;
  }
  return { simularForja, xpHoraSessoes, xpHoraBaldes, horasAte };
})();
if (typeof module !== 'undefined') module.exports = CALC;
