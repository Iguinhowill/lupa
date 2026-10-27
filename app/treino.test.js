// Testes dos Pontos e barra (treino.js): pontos dos próximos níveis, opções e a conta com o simulador falso.
// Rode com: npm test (o copiar-lupa.mjs põe as tabelas em app/lupa)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('./treino');
const G = require('./gastar');
const ESTADO = require('./teste-gastar/estado-yasuo.json');
const copia = (o) => JSON.parse(JSON.stringify(o));

test('combinações', () => {
  assert.equal(T.combinacoes(['a', 'b', 'c', 'd', 'e'], 4).length, 5);
  assert.deepEqual(T.combinacoes(['a', 'b', 'c'], 2), [['a', 'b'], ['a', 'c'], ['b', 'c']]);
  assert.equal(T.combinacoes(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 4).length, 35);
});

test('pontos dos próximos 5 níveis', () => {
  const b = (nivel) => ({ nivel });
  assert.deepEqual(T.pontosAte(b(37), { habilidade: 0, atributo: 0 }), { nivel: 42, habilidade: 5, atributo: 15 });
  assert.deepEqual(T.pontosAte(b(37), { habilidade: 2, atributo: 1 }), { nivel: 42, habilidade: 7, atributo: 16 });
  assert.deepEqual(T.pontosAte(b(48), { habilidade: 0, atributo: 0 }), { nivel: 53, habilidade: 2, atributo: 15 }, 'habilidade só até o 50');
  assert.deepEqual(T.pontosAte(b(100), { habilidade: 0, atributo: 4 }), { nivel: 100, habilidade: 0, atributo: 4 });
});

test('opções do Yasuo: ranks até o máximo do nível, atributos e as barras das habilidades aprendidas', () => {
  const b = G.buildDoEstado(ESTADO);
  const { lista, nivelHab, nivelAtrib, qtdAtrib, qtdHab } = T.opcoesTreino(b, 'yasuo', { habilidade: 0, atributo: 0 });
  assert.equal(nivelHab, 42); assert.equal(nivelAtrib, 42); assert.equal(qtdAtrib, 15); assert.equal(qtdHab, 5);
  const hab = lista.filter((x) => x.parte === 'habilidade'), ids = hab.map((x) => x.id);
  assert.ok(!ids.includes('hab:Q'), 'Q já está no 10');
  assert.ok(!ids.includes('hab:R'), 'R já tem o que o nível 42 deixa');
  const f = hab.find((x) => x.id === 'hab:F');
  assert.equal(f.ranks.F, 9); assert.equal(f.nivel, 42);
  // habilidade nova: aprende e entra na barra no lugar de cada uma das 4
  const nova = hab.filter((x) => x.grupo === 'hab:T');
  assert.equal(nova.length, 4);
  assert.ok(nova.every((x) => x.barra.includes('T') && x.barra.length === 4));
  assert.equal(lista.filter((x) => x.parte === 'atributo').length, 5);
  assert.ok(lista.filter((x) => x.parte === 'atributo').every((x) => Object.values(x.atrib).reduce((s, v) => s + v, 0) === 108 + 15));
  // barra: 7 aprendidas sem passiva (Q W E R G A F) → 35 combinações, menos a atual
  const barras = lista.filter((x) => x.parte === 'barra');
  assert.equal(barras.length, 34);
  assert.ok(!barras.some((x) => x.barra.includes('D')), 'passiva não vai na barra');
  // com ponto livre agora, conta a partir dele
  const livre = T.opcoesTreino(b, 'yasuo', { habilidade: 1, atributo: 3 });
  assert.equal(livre.qtdHab, 6); assert.equal(livre.qtdAtrib, 18);
});

test('a conta com o simulador falso', async () => {
  // o "motor": cada rank de F dá +0,6%, cada ponto em Força ou Foco +0,1%; a barra atual é a melhor (qualquer troca −2%);
  // o nível de cima dá +5% em tudo (a base dele tem de ser a do mesmo nível)
  const rodar = async (jobs) => Object.fromEntries(jobs.map((j) => {
    let f = 1 + (j.nivel - 37) * 0.01;
    f *= 1 + 0.006 * ((j.ranks.F || 0) - 4) + 0.001 * ((j.atrib.forca || 0) - 108 + (j.atrib.foco || 0));
    if (['Q', 'R', 'F', 'G'].some((t) => !j.barra.includes(t))) f *= 0.98;
    return [j.id, { id: j.id, campeao: 'yasuo', abatesH: j.sementes.map((s) => 2000 * f * (1 + (s % 3) * 0.0005)), mortes: j.sementes.map(() => 0) }];
  }));
  const r = await T.calcular({ estado: ESTADO, rodar });
  assert.equal(r.campeao, 'yasuo');
  assert.equal(r.habilidade.opcoes[0].titulo, 'Lâmina Fantasma (F): rank 4 → 9');
  assert.ok(Math.abs(r.habilidade.opcoes[0].ganho - 0.03) < 1e-6, 'ganho contra a base do nível 42, não a do 37');
  assert.ok(r.habilidade.opcoes[0].rende);
  const at = r.atributo.opcoes;
  assert.equal(at.length, 5);
  assert.ok(at.slice(0, 2).every((l) => /Força|Foco/.test(l.titulo) && l.rende));
  assert.ok(r.barra.opcoes.every((l) => !l.rende && l.ganho < 0), 'a barra atual é a melhor');
  assert.equal(r.barra.testadas, 34);
  assert.equal(r.assinatura, G.assinatura(G.buildDoEstado(ESTADO)));
  const sem = copia(ESTADO); sem.ficha.habs = [{ t: 'Q', nome: 'Habilidade que não existe', rank: '1/10' }];
  await assert.rejects(T.calcular({ estado: sem, rodar }), /campeão/);
});
