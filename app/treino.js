// Lupa (app) · Pontos e barra: onde pôr os pontos de habilidade e de atributo e qual barra rende mais caça, pela simulação do motor
// do jogo (o mesmo simulador do Onde gastar o ouro, ver gastar.js e simulador.js). Um ponto sozinho mexe uns 0,2 a 0,4%, menos que a
// margem da simulação; por isso a pergunta é para onde vão os pontos dos próximos 5 níveis (os livres mais os que vêm): todos numa
// habilidade, ou todos num atributo, comparados no nível de chegada contra uma base nesse nível com os pontos guardados. A barra
// compara as combinações de 4 das habilidades já aprendidas (a ordem não importa: o jogo usa as da barra pela prioridade do campeão).
// Puro (sem Electron): o simulador entra como a função `rodar` (treino.test.js). Só calcula: não mexe em nada no jogo.
'use strict';

const JOGO = require('./lupa/dados-jogo.js');
const G = require('./gastar');

const NOMES_ATRIB = Object.fromEntries(G.ATRIBUTOS);
const CONFERIR = { habilidade: 4, atributo: 5, barra: 4 };      // quantas de cada parte vão da triagem para a conferência (os 5 atributos sempre)
const MAX_TRIAGEM = 200, HORIZONTE = 5;      // níveis à frente que entram na conta dos pontos

// as combinações de k elementos da lista, na ordem dela
function combinacoes(lista, k) {
  const out = [];
  const ir = (i, atual) => {
    if (atual.length === k) return void out.push(atual.slice());
    for (let j = i; j < lista.length; j++) { atual.push(lista[j]); ir(j + 1, atual); atual.pop(); }
  };
  ir(0, []);
  return out;
}
const mesmaBarra = (a, b) => a.length === b.length && a.every((t) => b.includes(t));

// os pontos que o personagem terá daqui a HORIZONTE níveis: os livres mais os que vêm (1 de habilidade por nível até o 50, 3 de
// atributo por nível)
function pontosAte(b, livres) {
  const nivel = Math.min(JOGO.NIVEL_MAX, b.nivel + HORIZONTE);
  let hab = livres.habilidade;
  for (let n = b.nivel + 1; n <= nivel; n++) if (n <= JOGO.NIVEL_PONTOS_HAB) hab++;
  return { nivel, habilidade: hab, atributo: livres.atributo + JOGO.PONTOS_POR_NIVEL * (nivel - b.nivel) };
}

// as opções: { id, grupo, parte: 'habilidade' | 'atributo' | 'barra', titulo, nivel, ranks?, atrib?, barra? }
function opcoesTreino(b, campeao, livres) {
  const kit = JOGO.KIT_HABS[campeao], nome = (t) => `${kit[t]?.nome || t} (${t})`, lista = [];
  const alvo = pontosAte(b, livres), nivelHab = alvo.habilidade > 0 ? alvo.nivel : null;
  // 1) os pontos de habilidade: todos numa habilidade (até o rank que o nível de chegada deixa)
  if (nivelHab) for (const [t, h] of Object.entries(kit)) {
    const r = b.ranks[t] || 0, mais = Math.min(alvo.habilidade, JOGO.rankMaximo(campeao, t, nivelHab) - r);
    if (mais <= 0) continue;
    const ranks = { ...b.ranks, [t]: r + mais };
    if (!h.passiva && !b.barra.includes(t)) {
      // fora da barra o jogo não usa a habilidade: os pontos nela só rendem com ela na barra (no espaço vazio ou no lugar de cada
      // uma; fica o melhor lugar). A nova (rank 0) é comparada com a barra atual (aprender e pôr na barra é uma coisa só); a
      // aprendida que está fora, com uma base que já tem a mesma barra, para o ganho ser só o dos pontos (a troca de barra
      // sozinha aparece na parte Barra)
      const lugares = b.barra.length < JOGO.BARRA ? [-1] : b.barra.map((_, k) => k);
      for (const k of lugares) {
        const barra = k < 0 ? [...b.barra, t] : b.barra.map((x, j) => (j === k ? t : x)), onde = k < 0 ? 'na barra' : `na barra no lugar de ${nome(b.barra[k])}`;
        lista.push({ id: `hab:${t}@${k}`, grupo: 'hab:' + t, parte: 'habilidade', nivel: nivelHab, ranks, barra,
          base: r > 0 ? { id: `base@${nivelHab}:${barra.join('')}`, nivel: nivelHab, barra } : null,
          titulo: r === 0 ? `Aprender ${nome(t)}${mais > 1 ? ` até o rank ${mais}` : ''} e pôr ${onde}` : `${nome(t)}: rank ${r} → ${r + mais}, com ela ${onde}` });
      }
    } else lista.push({ id: 'hab:' + t, grupo: 'hab:' + t, parte: 'habilidade', nivel: nivelHab, ranks, titulo: `${nome(t)}: rank ${r} → ${r + mais}` });
  }
  // 2) os pontos de atributo, todos num atributo só
  const qtd = alvo.atributo, nivelAtrib = alvo.nivel;
  if (qtd > 0) for (const [k] of G.ATRIBUTOS) lista.push({ id: 'atrib:' + k, grupo: 'atrib:' + k, parte: 'atributo', nivel: nivelAtrib,
    atrib: { ...b.atrib, [k]: (b.atrib[k] || 0) + qtd }, titulo: `${qtd === 1 ? 'O ponto' : `Os ${qtd} pontos`} em ${NOMES_ATRIB[k]}` });
  // 3) a barra: as combinações das habilidades aprendidas que não são passivas
  const aprendidas = Object.keys(kit).filter((t) => (b.ranks[t] || 0) > 0 && !kit[t].passiva);
  for (const c of combinacoes(aprendidas, Math.min(JOGO.BARRA, aprendidas.length))) {
    if (mesmaBarra(c, b.barra)) continue;
    const sai = b.barra.filter((t) => !c.includes(t)), entra = c.filter((t) => !b.barra.includes(t));
    lista.push({ id: 'barra:' + c.join(''), grupo: 'barra:' + c.join(''), parte: 'barra', nivel: b.nivel, barra: c,
      titulo: sai.length ? `Barra ${c.join(' ')}: tirar ${sai.map(nome).join(' e ')} e pôr ${entra.map(nome).join(' e ')}` : `Barra ${c.join(' ')}: pôr ${entra.map(nome).join(' e ')}` });
  }
  return { lista, nivelHab, nivelAtrib, qtdAtrib: qtd, qtdHab: alvo.habilidade };
}

// as bases de comparação: a build atual em cada nível usado (o atual e o de chegada dos pontos) e as de barra trocada que alguma
// opção pede (habilidade aprendida fora da barra)
const baseDo = (nivel) => ({ id: 'base@' + nivel, nivel });
const basesDe = (opcoes, nivel) => {
  const m = new Map([...new Set(opcoes.map((c) => c.nivel).concat(nivel))].map((n) => [`base@${n}`, baseDo(n)]));
  for (const c of opcoes) if (c.base) m.set(c.base.id, c.base);
  return [...m.values()];
};
const ganhoDe = (r, c) => G.ganhoPareado(r[c.base?.id || 'base@' + c.nivel], r[c.id]);

// da triagem para a conferência: de cada parte, as melhores (de cada habilidade nova, o melhor lugar na barra)
function escolher(opcoes, triagem) {
  const porGrupo = new Map();
  for (const c of opcoes.filter((x) => triagem[x.id])) {
    const g = ganhoDe(triagem, c).ganho, m = porGrupo.get(c.grupo);
    if (!m || g > m.g) porGrupo.set(c.grupo, { c, g });
  }
  const out = [];
  for (const parte of Object.keys(CONFERIR)) out.push(...[...porGrupo.values()].filter((x) => x.c.parte === parte).sort((x, y) => y.g - x.g).slice(0, CONFERIR[parte]).map((x) => x.c));
  return out;
}

async function calcular({ estado, sessoes = [], agora = Date.now(), rodar }) {
  const b = G.buildDoEstado(estado, sessoes);
  if (!b) throw new Error('A ficha ainda não tem itens equipados e nível: abra o personagem no jogo.');
  if (b.faltam > 0) throw new Error('Um item equipado ainda está sendo avaliado ou é novo demais para as tabelas da Lupa: a conta espera a ficha ficar completa.');
  const campeao = JOGO.campeaoPelasHabs(b.habs);
  if (!campeao) throw new Error('Não reconheci o campeão pelas habilidades da ficha (abra a aba de habilidades no jogo uma vez).');
  const livres = { habilidade: Math.max(0, Number(estado.pontos?.habilidade) || 0), atributo: Math.max(0, Number(estado.pontos?.atributo) || 0) };
  const { lista, nivelHab, nivelAtrib, qtdAtrib, qtdHab } = opcoesTreino(b, campeao, livres);
  const opcoes = lista.slice(0, MAX_TRIAGEM), bases = basesDe(opcoes, b.nivel);
  const triagem = await rodar(G.jobsDe(b, opcoes, G.SIM.triagem, bases), 'triagem');
  const escolhidas = escolher(opcoes, triagem);
  const basesConf = basesDe(escolhidas, b.nivel);
  const conf = await rodar(G.jobsDe(b, escolhidas, G.SIM.conferir, basesConf), 'conferir');
  const base = conf['base@' + b.nivel], media = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const econ = G.economiaMedida(sessoes, b.zona.nome, agora) || G.economiaSimulada(b, media(base.abatesH));
  const linha = (c) => {
    const g = ganhoDe(conf, c), r = conf[c.id];
    return { parte: c.parte, titulo: c.titulo, nivel: c.nivel, ganho: +g.ganho.toFixed(5), erro: +g.erro.toFixed(5), rende: g.ganho > Math.max(G.SIGNIFICATIVO, g.erro),
      xpH: Math.round(g.ganho * econ.xpH), ouroH: Math.round(g.ganho * econ.ouroH), mortesH: +media(r.mortes).toFixed(2) };
  };
  const parte = (p) => escolhidas.filter((c) => c.parte === p && conf[c.id]).map(linha).sort((x, y) => y.ganho - x.ganho);
  const testadas = (p) => opcoes.filter((c) => c.parte === p).length;
  return { v: 1, estado: 'pronto', em: agora, assinatura: G.assinatura(b), nivel: b.nivel, zona: b.zona, campeao, livres,
    barraAtual: b.barra, habilidade: { nivel: nivelHab, pontos: qtdHab, testadas: testadas('habilidade'), opcoes: parte('habilidade') },
    atributo: { nivel: nivelAtrib, pontos: qtdAtrib, testadas: testadas('atributo'), opcoes: parte('atributo') },
    barra: { testadas: testadas('barra'), opcoes: parte('barra') },
    base: { abatesH: Math.round(media(base.abatesH)), mortesH: +media(base.mortes).toFixed(2), economia: { ...econ, abatesH: Math.round(econ.abatesH), xpH: Math.round(econ.xpH), ouroH: Math.round(econ.ouroH) } },
    sim: { conferir: { minutos: G.SIM.conferir.minutos, cacadas: G.SIM.conferir.sementes.length } } };
}

module.exports = { calcular, opcoesTreino, pontosAte, combinacoes, escolher, HORIZONTE };
