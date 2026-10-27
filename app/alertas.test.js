// Lupa (app) · casos dos alertas, das notas da versão e dos atalhos (npm test)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { alertasDe, notasEmTexto } = require('./alertas');
const { atalhoDe } = require('./atalhos');

const AGORA = 1_000_000_000;
const tipos = (e, desde = 0) => alertasDe(e, AGORA, desde).map((a) => a.tipo);

test('estado ausente ou sem novidade não alerta', () => {
  assert.deepEqual(alertasDe(undefined, AGORA), []);
  assert.deepEqual(alertasDe({}, AGORA), []);
  assert.deepEqual(alertasDe({ nome: 'X', ts: AGORA - 1000 }, AGORA), []);
});

test('cada alerta', () => {
  assert.deepEqual(tipos({ tarefa: { pronta: true } }), ['tarefa']);
  assert.deepEqual(tipos({ tarefa: { pronta: false } }), []);
  assert.deepEqual(tipos({ mochila: { usados: 90, total: 100 } }), ['mochila']);
  assert.deepEqual(tipos({ mochila: { usados: 89, total: 100 } }), []);
  assert.deepEqual(tipos({ mochila: { usados: 5, total: 0 } }), []);
  assert.deepEqual(tipos({ pontos: { habilidade: 0, atributo: 2 } }), ['pontos']);
  assert.deepEqual(tipos({ pontos: { habilidade: 0, atributo: 0 } }), []);
  assert.deepEqual(tipos({ rastreio: { login: { dia: 3 } } }), ['premio']);
  assert.deepEqual(tipos({ rastreio: { login: null } }), []);
});

test('textos', () => {
  const a = alertasDe({ mochila: { usados: 46, total: 50 }, pontos: { habilidade: 1, atributo: 3 } }, AGORA);
  assert.equal(a[0].texto, 'Mochila 92% cheia (46/50)');
  assert.equal(a[1].texto, 'Pontos livres: 1 de habilidade e 3 de atributo');
});

test('sem leitura: mais de 3 min, contados a partir da abertura do app', () => {
  assert.deepEqual(tipos({ ts: AGORA - 179e3 }), []);
  assert.deepEqual(tipos({ ts: AGORA - 181e3 }), ['sem-leitura']);
  assert.deepEqual(tipos({ ts: AGORA - 3600e3 }, AGORA - 60e3), []);      // app recém-aberto
  assert.match(alertasDe({ ts: AGORA - 600e3 }, AGORA)[0].texto, /10 min/);
});

test('todos juntos', () => {
  const e = { tarefa: { pronta: true }, mochila: { usados: 50, total: 50 }, pontos: { habilidade: 1 }, rastreio: { login: {} }, ts: AGORA - 999e3 };
  assert.equal(alertasDe(e, AGORA).length, 5);
});

test('notas da versão em texto puro', () => {
  assert.equal(notasEmTexto('<h2>Novo</h2><ul><li>Lado a lado</li><li>Bandeja &amp; avisos</li></ul>'), 'Novo\n- Lado a lado\n- Bandeja & avisos');
  assert.equal(notasEmTexto([{ version: '1', note: '<p>um</p>' }, { version: '2', note: 'dois' }]), 'um\ndois');
  assert.equal(notasEmTexto(null), '');
  assert.equal(notasEmTexto('<script>x()</script>ok'), 'ok');
  const longa = notasEmTexto('a'.repeat(500));
  assert.equal(longa.length, 300);
  assert.ok(longa.endsWith('…'));
});

const tecla = (key, extra = {}) => atalhoDe({ type: 'keyDown', key, control: false, alt: false, meta: false, shift: false, ...extra });
test('atalhos do app', () => {
  assert.equal(tecla('1', { control: true }), 'aba:conta1');
  assert.equal(tecla('2', { control: true }), 'aba:conta2');
  assert.equal(tecla('3', { control: true }), 'aba:lado');
  assert.equal(tecla('4', { control: true }), 'aba:central');
  assert.equal(tecla('Tab', { control: true }), 'aba:proxima');
  assert.equal(tecla('Tab', { control: true, shift: true }), 'aba:anterior');
  assert.equal(tecla('b', { control: true }), 'painel');
  assert.equal(tecla('F5'), 'recarregar');
  assert.equal(tecla('0', { control: true }), 'zoom:zero');
  assert.equal(tecla('=', { control: true }), 'zoom:mais');
  assert.equal(tecla('+', { control: true, shift: true }), 'zoom:mais');
  assert.equal(tecla('-', { control: true }), 'zoom:menos');
});

test('o resto das teclas passa para o jogo', () => {
  assert.equal(tecla('1'), null);
  assert.equal(tecla('b'), null);
  assert.equal(tecla('Tab'), null);
  assert.equal(tecla('c', { control: true }), null);
  assert.equal(tecla('5', { control: true }), null);
  assert.equal(tecla('1', { control: true, alt: true }), null);
  assert.equal(tecla('F5', { shift: true }), null);
  assert.equal(atalhoDe({ type: 'keyUp', key: 'F5', control: false }), null);
  assert.equal(atalhoDe(null), null);
});

test('conta fora da tela só vira "sem leitura" depois de 10 min', () => {
  const { alertasDe: a } = require('./alertas');
  const agora = 1e12, est = { ts: agora - 5 * 60e3 };
  assert.ok(a(est, agora, 0, true).some((x) => x.tipo === 'sem-leitura'), 'visível: 5 min já é sem leitura');
  assert.ok(!a(est, agora, 0, false).some((x) => x.tipo === 'sem-leitura'), 'escondida: 5 min ainda não');
  assert.ok(a({ ts: agora - 11 * 60e3 }, agora, 0, false).some((x) => x.tipo === 'sem-leitura'), 'escondida: 11 min sim');
});
