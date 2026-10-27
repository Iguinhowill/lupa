// node --test: confere as tabelas do jogo em src/dados-jogo.js (geradas por gerar-tabelas.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const J = createRequire(import.meta.url)('./src/dados-jogo.js');

test('o nível máximo é 100 e a tabela de XP tem uma linha por nível', () => {
  assert.equal(J.NIVEL_MAX, 100);
  assert.equal(J.XP_NIVEL.length, 100);
});
test('xpParaNivel é positivo e cresce de nível em nível', () => {
  for (let n = 1; n < 100; n++) {
    assert.ok(J.xpParaNivel(n) > 0, `nível ${n}`);
    assert.ok(J.xpParaNivel(n + 1) > J.xpParaNivel(n), `nível ${n} -> ${n + 1}`);
  }
});
test('a soma do XP até o 100 bate com a soma dos níveis 1 a 99', () => {
  let t = 0;
  for (let n = 1; n < 100; n++) t += J.xpParaNivel(n);
  assert.equal(J.xpEntre(1, 100), t);
  assert.equal(J.xpEntre(50, 50), 0);
  assert.equal(J.xpEntre(10, 12), J.xpParaNivel(10) + J.xpParaNivel(11));
});
test('fatorXp: 100% até 5 níveis de diferença, -10% por nível acima disso, mínimo 10%', () => {
  assert.equal(J.fatorXp(30, 30), 1);
  assert.equal(J.fatorXp(30, 25), 1);          // 5 de diferença ainda vale tudo
  assert.ok(Math.abs(J.fatorXp(30, 24) - 0.9) < 1e-9);
  assert.ok(Math.abs(J.fatorXp(30, 20) - 0.5) < 1e-9);
  assert.equal(J.fatorXp(30, 10), 0.1);        // 20 de diferença: no chão
  assert.equal(J.fatorXp(100, 1), 0.1);
  assert.equal(J.fatorXp(10, 40), 1);          // monstro mais forte não dá bônus
});
test('as zonas cobrem do nível 1 ao 100 e porAbateZona dá XP, ouro e vida positivos', () => {
  assert.equal(J.zonaIdeal(1).id, 'rota-inf');
  assert.ok(J.zonaIdeal(100).faixa[1] >= 100);
  for (const z of J.ZONAS) { const p = J.porAbateZona(z); assert.ok(p.xp > 0 && p.ouro > 0 && p.hp > 0, z.id); }
});
test('forja: chances do jogo, VIP e a garantia do Ornn na tentativa 12.000 do +7', () => {
  assert.equal(J.chanceForja(0, 0, false), 0.30);
  assert.ok(Math.abs(J.chanceForja(0, 0, true) - 0.36) < 1e-12);
  assert.equal(J.chanceForja(5, 0, true), 0.0005 * 1.2);
  assert.ok(J.chanceForja(6, 11998, false) < 1);
  assert.equal(J.chanceForja(6, 11999, false), 1);     // 12.000ª tentativa
  assert.equal(J.chanceForja(2, 119, false), 1);       // +3: garantido na 120ª
});
test('preço de refino e valor de venda', () => {
  const i = J.ITENS.find((x) => x.preco > 0);
  assert.equal(J.valorVenda(i.id, 0, 'B'), Math.floor(i.preco * 0.5));
  assert.ok(J.valorVenda(i.id, 3, 'S') > J.valorVenda(i.id, 3, 'B'));
  assert.equal(J.precoRefino(i.id, 0), Math.round(i.preco * 0.5));
  assert.equal(J.valorVenda('xxxx', 0, 'B'), null);
});
test('a data e a versão do motor foram gravadas', () => {
  assert.ok(Date.parse(J.meta.geradoEm) > 0);
  assert.match(J.meta.motorSha256, /^[0-9a-f]{64}$/);
  assert.ok(J.meta.versaoJogo);
});
