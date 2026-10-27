// node --test: as ações que o jogador pede (acoes.js: autorização e entradas) e a leitura das ofertas do Capitão (oferta.js)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Acoes = require('./acoes');
const OFERTA = require('./oferta');

test('autorização: vale por pouco tempo e por um número de entradas', () => {
  const agora = 1e12, a = Acoes.autorizacao('tarefa', agora);
  assert.equal(a.tipo, 'tarefa');
  for (let k = 0; k < Acoes.REGRAS.tarefa.entradas; k++) assert.equal(Acoes.gastar(a, agora + 1000), true);
  assert.equal(Acoes.gastar(a, agora + 1000), false, 'acabaram as entradas');
  const c = Acoes.autorizacao('coluna', agora);
  assert.equal(Acoes.gastar(c, agora + Acoes.REGRAS.coluna.ms + 1), false, 'passou do tempo');
  assert.equal(Acoes.gastar(Acoes.autorizacao('coluna', agora), agora), true);
  assert.equal(Acoes.autorizacao('outra'), null);
  assert.equal(Acoes.gastar(undefined), false);
});

test('ponto do clique: px CSS vezes o zoom, só dentro da view', () => {
  const tam = { x: 0, y: 44, width: 800, height: 600 };
  assert.deepEqual(Acoes.pontoNaView({ x: 100.4, y: 50.6 }, 1, tam), { x: 100, y: 51 });
  assert.deepEqual(Acoes.pontoNaView({ x: 100, y: 50 }, 0.8, tam), { x: 80, y: 40 });
  assert.equal(Acoes.pontoNaView({ x: 900, y: 50 }, 1, tam), null);
  assert.equal(Acoes.pontoNaView({ x: -1, y: 50 }, 1, tam), null);
  assert.equal(Acoes.pontoNaView({ x: 'a', y: 50 }, 1, tam), null);
  assert.equal(Acoes.pontoNaView(null, 1, tam), null);
});

test('clique e teclas: só B e M, apertar e soltar', () => {
  assert.deepEqual(Acoes.clique({ x: 3, y: 4 }).map((e) => e.type), ['mouseEnter', 'mouseMove', 'mouseDown', 'mouseUp']);
  assert.deepEqual(Acoes.tecla('B').map((e) => [e.type, e.keyCode]), [['keyDown', 'b'], ['keyUp', 'b']]);
  assert.ok(Acoes.tecla('m'));
  for (const k of ['q', 'Enter', '', null, 'bm']) assert.equal(Acoes.tecla(k), null, String(k));
});

test('ofertas: tempo, XP, ouro e zona como o jogo escreve', () => {
  assert.deepEqual(OFERTA.lerOferta('120 monstros em Fosso do Dragão', '~15 min · 120.3k de XP · 30.1k de ouro · item épico'), { min: 15, xp: 120300, ouro: 30100, zona: 'Fosso do Dragão' });
  assert.deepEqual(OFERTA.lerOferta('400 monstros em Covil do Barão', '~1,5 h · 1.2M de XP · 310.5k de ouro'), { min: 90, xp: 1.2e6, ouro: 310500, zona: 'Covil do Barão' });
  assert.deepEqual(OFERTA.lerOferta('60 Larva do Vazio em Toca do Vazio', '~12 min · 9800 de XP · 2400 de ouro'), { min: 12, xp: 9800, ouro: 2400, zona: 'Toca do Vazio' });
  const velha = OFERTA.lerOferta('20× Lobo Gigante', 'Toca dos Lobos · 300 de ouro · 900 de XP');
  assert.equal(velha.min, null);
  assert.equal(velha.zona, null);
});

test('escolher: a de mais XP por minuto; empate fica com a mais curta; sem dados não entra', () => {
  const o = (min, xp, zona = 'Z') => ({ min, xp, zona });
  assert.equal(OFERTA.escolher([o(15, 120e3), o(60, 600e3), o(7, 50e3)]), 1);      // 8k, 10k, 7,1k por minuto
  assert.equal(OFERTA.escolher([o(30, 300e3), o(15, 150e3)]), 1);
  assert.equal(OFERTA.escolher([o(null, 1e6), o(10, 0), o(10, 50e3, null)]), -1);
  assert.equal(OFERTA.escolher([]), -1);
  assert.equal(OFERTA.escolher(undefined), -1);
});
