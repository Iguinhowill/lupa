// Lupa (app) · casos do layout e do zoom (npm test)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./layout');

test('conta sozinha com painel', () => {
  const r = L.calcular({ largura: 1520, altura: 940, modo: 'conta1', painelAberto: true, larguraPainel: 380 });
  assert.deepEqual(r.jogos.conta1, { x: 0, y: 44, width: 1140, height: 896 });
  assert.deepEqual(r.painel, { x: 1140, y: 44, width: 380, height: 896 });
  assert.equal(r.jogos.conta2, null);
  assert.equal(r.casca.height, 44);
});

test('lado a lado: metades + filete de 1 px, sem painel por padrão', () => {
  const r = L.calcular({ largura: 1520, altura: 940, modo: 'lado' });
  assert.equal(r.casca.height, 66);
  assert.equal(r.jogos.conta1.width + 1 + r.jogos.conta2.width, 1520);
  assert.equal(r.jogos.conta2.x, r.jogos.conta1.width + 1);
  assert.equal(r.jogos.conta1.y, 66);
  assert.equal(r.painel, null);
  assert.equal(r.etiquetas.length, 2);
});

test('lado a lado com painel estreita as metades', () => {
  const r = L.calcular({ largura: 1520, altura: 940, modo: 'lado', painelAberto: true, larguraPainel: 520 });
  assert.equal(r.painel.width, 520);
  assert.equal(r.jogos.conta1.width + 1 + r.jogos.conta2.width, 1000);
  assert.equal(r.painel.x, 1000);
});

test('central ocupa tudo e nunca tem painel', () => {
  const r = L.calcular({ largura: 1000, altura: 700, modo: 'central', painelAberto: true });
  assert.deepEqual(r.central, { x: 0, y: 44, width: 1000, height: 656 });
  assert.equal(r.painel, null);
});

test('painel largo não come o jogo todo', () => {
  const r = L.calcular({ largura: 800, altura: 600, modo: 'conta1', painelAberto: true, larguraPainel: 520 });
  assert.ok(r.jogos.conta1.width >= 320);
});

test('zoom automático: layout normal do jogo por metade', () => {
  assert.equal(L.zoomAuto(1920 / 2), 0.95);
  assert.equal(L.zoomAuto(1500), 1);
  assert.equal(L.zoomAuto(759.5), 0.752);
  assert.equal(L.zoomAuto(10), 0.25);
  // 1520 sem painel: metade de 759 px → zoom 0.752 → ≈ 1009 px CSS (≥ 1001: layout normal)
  const w = L.calcular({ largura: 1520, altura: 900, modo: 'lado' }).jogos.conta1.width;
  assert.ok(w / L.zoomAuto(w) >= 1001);
});

test('zoom por modo e ajuste do usuário', () => {
  assert.equal(L.zoomDoJogo('conta1', 1140, 1), 1);
  assert.equal(L.zoomDoJogo('conta1', 1140, 0.8), 0.8);
  assert.equal(L.zoomDoJogo('lado', 760, 1), 0.752);
  assert.equal(L.zoomDoJogo('lado', 760, 1.1), 0.827);
  assert.equal(L.ajustarZoom(1, 'mais'), 1.1);
  assert.equal(L.ajustarZoom(0.25, 'menos'), 0.25);
  assert.equal(L.ajustarZoom(3, 'mais'), 3);
  assert.equal(L.ajustarZoom(1.7, 'zero'), 1);
  assert.equal(L.grupoDe('conta2'), 'solo');
  assert.equal(L.grupoDe('lado'), 'lado');
});

test('modoValido sem a Conta 2', () => {
  assert.equal(L.modoValido('lado', true), 'conta1');
  assert.equal(L.modoValido('conta2', true), 'conta1');
  assert.equal(L.modoValido('lado', false), 'lado');
  assert.equal(L.modoValido('central', true), 'central');
  assert.equal(L.modoValido('xyz', false), 'conta1');
});

test('janela salva ainda visível?', () => {
  const telas = [{ x: 0, y: 0, width: 1920, height: 1040 }];
  assert.equal(L.visivel({ x: 100, y: 50, width: 1520, height: 940 }, telas), true);
  assert.equal(L.visivel({ x: 2500, y: 50, width: 1520, height: 940 }, telas), false);      // monitor que sumiu
  assert.equal(L.visivel({ x: 1850, y: 50, width: 1520, height: 940 }, telas), false);      // só 70 px à mostra
  assert.equal(L.visivel({ x: -1900, y: 0, width: 1920, height: 1000 }, [{ x: -1920, y: 0, width: 1920, height: 1040 }, ...telas]), true);
  assert.equal(L.visivel(null, telas), false);
  assert.equal(L.visivel({ x: NaN, y: 0, width: 100, height: 100 }, telas), false);
});
