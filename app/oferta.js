// Lupa (app) · as ofertas do Capitão da Legião pelo texto que o jogo mostra, e qual delas rende mais no ritmo do jogador
// (puro). Entra no preload do jogo (copiar-lupa.mjs) e no teste (acoes.test.js). Ex.: título "120 monstros em Fosso do
// Dragão" e detalhe "~15 min · 120.3k de XP · 30.1k de ouro · item épico" → { qtd: 120, min: 15, xp: 120300, ouro: 30100,
// zona: 'Fosso do Dragão' }.
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
  // quantidade, tempo ("~15 min" ou "~1,5 h"), XP, ouro e a zona ("... em <zona>"); o que não achar fica null
  function lerOferta(titulo, detalhe) {
    const d = String(detalhe || ''), t = String(titulo || '').replace(/\s+/g, ' ').trim();
    const h = d.match(/~\s*([\d.,]+)\s*h\b/), m = d.match(/~\s*([\d.,]+)\s*min\b/);
    const min = h ? parseFloat(h[1].replace(',', '.')) * 60 : m ? numero(m[1]) : null;
    const xp = d.match(/([\d.,]+\s*[kM]?) de XP/), ouro = d.match(/([\d.,]+\s*[kM]?) de ouro/);
    const zona = t.match(/\sem (.+)$/), qtd = t.match(/^(\d[\d.]*)\s/);
    return { qtd: qtd ? numero(qtd[1]) : null, min: min > 0 ? min : null, xp: xp ? numero(xp[1]) : null, ouro: ouro ? numero(ouro[1]) : null, zona: zona ? zona[1].trim() : null };
  }

  const chaveZona = (z) => String(z || '').trim().toLowerCase();
  // o ritmo do jogador em cada zona, pelas sessões de caçada que a Lupa mediu (cacada:<nome>): só as que começaram nos
  // últimos `dias` (uma sessão longa de dias atrás traria o ritmo de níveis antigos), e só zona com 10 min ou mais.
  // { [zona em minúsculas]: { abatesMin, xpAbate } }. O XP é o sem bônus de live (xpBase): uma zona medida com a live
  // ligada pareceria render mais que outra medida sem ela. Limite: o tempo da sessão só conta com abate no último minuto,
  // então a demora depois de uma morte fica de fora (a Lupa não guarda mortes por zona)
  function ritmosDe(sessoes, agora = Date.now(), dias = 7) {
    const soma = {};
    for (const s of sessoes || []) {
      if (!s || !(s.ini > 0) || agora - s.ini > dias * 864e5) continue;
      for (const [z, v] of Object.entries(s.zonas || {})) {
        const t = (soma[chaveZona(z)] ||= { seg: 0, abates: 0, xp: 0 });
        t.seg += +v?.seg || 0; t.abates += +v?.abates || 0; t.xp += +(v?.xpBase ?? v?.xp) || 0;
      }
    }
    const r = {};
    for (const [z, t] of Object.entries(soma)) if (t.seg >= 600 && t.abates > 0 && t.xp > 0) r[z] = { abatesMin: t.abates / (t.seg / 60), xpAbate: t.xp / t.abates };
    return r;
  }

  // a Caça (uma espécie da zona) e a Fúria (só os furiosos) não contam todo abate: valem mais abates do que a quantidade.
  // Pelo selo ("Caça", "Fúria") ou, se o rótulo mudar, pelo título: as outras dizem "<n> monstros em <zona>", a Caça diz o
  // nome da espécie e a Fúria diz "monstros furiosos"
  const PARCIAL = /^(caça|fúria)$/i;
  const parcial = (o) => PARCIAL.test(o?.tipo || '') || (!!o?.titulo && !/^\d[\d.]* monstros em /.test(o.titulo));
  // quantos abates (de qualquer monstro da zona) a oferta leva. As que contam todo abate valem a quantidade; a Caça e a Fúria,
  // o tempo do jogo vezes o ritmo que o jogo usa na zona, tirado das outras ofertas dela (é o mesmo para todas as ofertas)
  function abatesDa(o, ofertas) {
    if (!parcial(o) && o.qtd > 0) return o.qtd;
    const ritmo = (lista) => { const r = lista.filter((x) => x && !parcial(x) && x.qtd > 0 && x.min > 0).map((x) => x.qtd / x.min); return r.length ? r.reduce((s, x) => s + x, 0) / r.length : null; };
    const g = ritmo((ofertas || []).filter((x) => x && chaveZona(x.zona) === chaveZona(o.zona))) ?? ritmo(ofertas || []);
    return g && o.min > 0 ? g * o.min : null;
  }
  // cada entrega custa um tempo fixo além dos abates (Fonte, Capitão, viagem e a demora até apertar o botão): sem ele, a
  // tarefa curta pareceria render mais do que rende
  const CUSTO_ENTREGA_MIN = 1;
  // a oferta no ritmo do jogador: minutos caçando até terminar e XP por hora com ela (os abates mais o prêmio do Capitão,
  // contando o custo da entrega); null sem medição na zona
  function noSeuRitmo(o, ofertas, ritmos) {
    const r = ritmos?.[chaveZona(o?.zona)], E = o ? abatesDa(o, ofertas) : null;
    if (!r || !(E > 0) || !(o.xp > 0)) return null;
    const min = E / r.abatesMin;
    return { min, xpHora: ((E * r.xpAbate + o.xp) / (min + CUSTO_ENTREGA_MIN)) * 60 };
  }
  // a melhor oferta: a de mais XP por hora caçando com ela, no seu ritmo, entre as das zonas em que a Lupa já mediu você (o
  // Desafio da zona de cima o jogo calcula como se você matasse no mesmo ritmo lá, e por isso parecia render mais). Sem
  // medição em nenhuma, a de mais prêmio por minuto pelo tempo do jogo. Empate (até 1%, o arredondamento do prêmio que o jogo
  // mostra, como "145.5k"): a mais curta. Devolve o índice ou -1
  function escolher(ofertas, ritmos = {}) {
    const validas = (ofertas || []).map((o, k) => ({ o, k })).filter(({ o }) => o && o.min > 0 && o.xp > 0 && o.zona);
    const medidas = validas.map((x) => ({ ...x, v: noSeuRitmo(x.o, ofertas, ritmos) })).filter((x) => x.v);
    const lista = medidas.length ? medidas.map((x) => ({ k: x.k, nota: x.v.xpHora, min: x.v.min })) : validas.map(({ o, k }) => ({ k, nota: o.xp / o.min, min: o.min }));
    const EMPATE = 0.01;
    let melhor = null;
    for (const x of lista) if (!melhor || x.nota > melhor.nota * (1 + EMPATE) || (x.nota >= melhor.nota * (1 - EMPATE) && x.min < melhor.min)) melhor = x;
    return melhor ? melhor.k : -1;
  }
  return { numero, lerOferta, ritmosDe, abatesDa, noSeuRitmo, escolher, CUSTO_ENTREGA_MIN };
})();

if (typeof module === 'object' && module && module.exports) module.exports = OFERTA;
