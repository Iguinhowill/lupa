// node --test: as contas das calculadoras (src/calculos.js) contra valores que dá para calcular à mão
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const J = req('./src/dados-jogo.js'), C = req('./src/calculos.js');

// esperança exata do número de tentativas de UM refino sem regressão (+1 e +2 nunca voltam): soma de P(ainda falhando)
function esperancaExata(ref, vip) {
  let viva = 1, e = 0;
  for (let f = 0; viva > 1e-12 && f < 100000; f++) { e += viva; viva *= 1 - J.chanceForja(ref, f, vip); }
  return e;
}

test('Monte Carlo da forja bate com a conta exata no +0 → +1 (sem VIP e com VIP)', () => {
  for (const vip of [false, true]) {
    const r = C.simularForja({ id: '3031', de: 0, ate: 1, vip, n: 20000 });
    const exata = esperancaExata(0, vip);
    assert.ok(Math.abs(r.tent.media - exata) / exata < 0.03, `vip=${vip}: ${r.tent.media} vs ${exata}`);
  }
});
test('Monte Carlo: +0 → +2 soma as duas esperanças (nenhum dos dois regride) e o custo segue o preço', () => {
  const r = C.simularForja({ id: '3031', de: 0, ate: 2, vip: false, n: 20000 });
  const exata = esperancaExata(0, false) + esperancaExata(1, false);
  assert.ok(Math.abs(r.tent.media - exata) / exata < 0.03, `${r.tent.media} vs ${exata}`);
  assert.ok(Math.abs(r.custo.media - (esperancaExata(0, false) * J.precoRefino('3031', 0) + esperancaExata(1, false) * J.precoRefino('3031', 1))) / r.custo.media < 0.03);
});
test('semente fixa: a mesma conta dá o mesmo resultado', () => {
  const a = C.simularForja({ id: '3031', de: 3, ate: 4, vip: false }), b = C.simularForja({ id: '3031', de: 3, ate: 4, vip: false });
  assert.deepEqual(a, b);
});
test('a garantia do Ornn limita o pior caso: percentil 90 do +6 → +7 não passa de 12.000 tentativas contando só esse passo', () => {
  const r = C.simularForja({ id: '3031', de: 6, ate: 7, vip: false, n: 400 });
  assert.ok(r.tent.p50 <= 12000 && r.tent.p90 <= 12000 * 1.01, `${r.tent.p50} / ${r.tent.p90}`);
  assert.ok(r.tent.media > 1000);
});
test('falhas acumuladas adiantam a garantia', () => {
  const sem = C.simularForja({ id: '3031', de: 2, ate: 3, vip: false, n: 3000 }), com = C.simularForja({ id: '3031', de: 2, ate: 3, vip: false, falhas0: 100, n: 3000 });
  assert.ok(com.tent.media < sem.tent.media);
  assert.ok(com.tent.p90 <= 20);   // garantido na 80ª+: 100 falhas já passam da faixa "subir" e a chance chega a 100% em poucas tentativas
});
test('horasAte: sem perda é XP ÷ XP/h; com perda do fatorXp demora mais quando os monstros ficam para trás', () => {
  const xpH = 1e6, falta = 2e6;
  assert.equal(C.horasAte(30, 31, falta, xpH, 34, false), 2);
  const fixo = C.horasAte(30, 50, falta, xpH, 34, false), perda = C.horasAte(30, 50, falta, xpH, 34, true);
  assert.ok(perda > fixo);
  assert.equal(C.horasAte(30, 35, falta, xpH, 34, true), C.horasAte(30, 35, falta, xpH, 34, false));   // até o 39 o monstro 34 dá o XP inteiro
});
test('XP/h das sessões e dos baldes', () => {
  const agora = 1e12, h = 3600e3;
  const sess = [{ ini: agora - 10 * h, fim: agora - 5 * h, seg: 18000, xp: 1.8e7, baldes: [] }, { ini: agora - 2 * h, fim: agora, seg: 7200, xp: 1.44e7, baldes: [{ t: agora - 20 * 60e3, xp: 1e5 }, { t: agora - 15 * 60e3, xp: 1e5 }, { t: agora - 10 * 60e3, xp: 1e5 }] }];
  assert.ok(Math.abs(C.xpHoraSessoes(sess, 24 * h, agora) - (1.8e7 + 1.44e7) / (25200 / 3600)) < 1e-6);
  assert.equal(C.xpHoraSessoes([], 24 * h, agora), null);
  assert.equal(C.xpHoraBaldes(sess, agora), 3e5 / (900 / 3600));      // 3 baldes de 5 min = 15 min a 1,2 M/h
  assert.equal(C.xpHoraBaldes([], agora), null);
});
