// Lupa (app) · trabalhador do simulador (Web Worker de módulo, na página escondida sim.html)
// Importa o motor PÚBLICO do jogo (baixado de lolidle.com/js para a pasta do app, servido aqui por lupasim://app/jogo/) e roda
// o combate dele, como o gerar-tabelas.mjs do site: sem chefes e sem monstro furioso, nível e XP presos, morte volta na hora
// para a zona. Não lê nem grava nada fora da mensagem que recebe: a página não tem rede (CSP e o main cortam).
import * as M from './jogo/motor.js';

for (const l of M.LOCAIS) if (l.chefe) l.chefe = null;      // sem chefes
M.FURIOSO.chance = 0;                                       // e sem monstro furioso

const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const DT = 0.05;

// o campeão pelo nome das habilidades que a ficha mostra ({ Q: 'Tempestade de Aço', ... }): a ficha não diz o campeão
function campeaoDe(habs) {
  const pares = Object.entries(habs || {});
  return Object.keys(M.KITS).find((id) => pares.length && pares.every(([t, nome]) => !M.KITS[id].hab[t] || M.KITS[id].hab[t].nome === nome)
    && pares.some(([t]) => M.KITS[id].hab[t])) || null;
}

// uma caçada de j.minutos com a semente dada: { abates, mortes }
function cacar(j, campeao, semente) {
  Math.random = mulberry(semente);
  const e = M.novoEstado(campeao);
  Object.assign(e, { nivel: j.nivel, xp: 0, relogio: 12 * 3600, pontos: 0, pontosAtrib: 0, itens: j.itens.slice(), barra: j.barra.slice(), local: j.zona, pocoes: { vida: 0, vidaF: 0, vidaS: 0, mana: 0, manaF: 0 } });
  e.atrib = { forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: 0, ...j.atrib };
  e.ranks = { ...e.ranks, ...j.ranks };
  const a0 = M.atributos(e); e.vida = a0.vida; e.mana = a0.mana;
  const c = M.criarCombate();
  let mortes = 0;
  for (let t = 0; t < j.minutos * 60; t += DT) {
    const n0 = e.nivel;
    M.passo(e, c, DT);
    e.nivel = n0; e.xp = 0; e.ouro = 0;
    c.eventos.length = 0;
    if (e.local !== j.zona) { mortes++; e.local = j.zona; const a = M.atributos(e); e.vida = a.vida; e.mana = a.mana; c.darius.morto = 0; c.inimigos = []; }
  }
  return { abates: e.totais.abates, mortes };
}

// job: { id, habs, nivel, zona, atrib, ranks, barra, itens, minutos, sementes: [n...] } → { id, campeao, abatesH: [por semente], mortes }
self.onmessage = (ev) => {
  const j = ev.data;
  try {
    const campeao = campeaoDe(j.habs);
    if (!campeao) throw new Error('não reconheci o campeão pelas habilidades da ficha');
    if (!M.LOCAL?.[j.zona]) throw new Error('zona desconhecida no motor: ' + j.zona);
    const abatesH = [], mortes = [];
    for (const s of j.sementes) { const r = cacar(j, campeao, s); abatesH.push((r.abates * 60) / j.minutos); mortes.push(r.mortes); }
    self.postMessage({ id: j.id, campeao, abatesH, mortes });
  } catch (e) {
    self.postMessage({ id: j.id, erro: String(e?.message || e) });
  }
};
self.postMessage({ pronto: true });
