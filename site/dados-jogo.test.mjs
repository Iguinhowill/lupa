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

// ---------- ficha da build (fichaDaBuild) ----------
// As contas abaixo são feitas à mão a partir das tabelas; o gerador também confere o resultado contra o motor do jogo (milhares de builds).
const Y = (itens, extra = {}) => J.fichaDaBuild({ campeao: 'yasuo', nivel: 1, atrib: {}, itens, ...extra });
test('fichaDaBuild: Yasuo nível 1 só com Gume +0 B (conta à mão)', () => {
  const f = Y(['3031~B']), C = J.CAMPEOES.yasuo, gume = J.item('3031').e;
  assert.ok(Math.abs(f.ad - (C.adBase + gume.ad)) < 1e-9);
  assert.equal(f.vida, C.stats.hp);
  assert.ok(Math.abs(f.velAtaque - C.stats.attackspeed) < 1e-9);
  // crítico: (item + base da passiva) x 2; dano crítico: (1,75 + 0,4 do Gume) x 0,8
  assert.ok(Math.abs(f.critico - (gume.critico + C.critBase[0]) * C.critMult) < 1e-9);
  assert.ok(Math.abs(f.danoCritico - (1.75 + 0.4) * C.critDano) < 1e-9);
});
test('fichaDaBuild: refino (+12% por nível) e qualidade multiplicam os bônus do item', () => {
  const sem = Y(['3031~B']), com = Y(['3031+4~A']), gume = J.item('3031').e, m = (1 + J.BONUS_REFINO * 4) * J.QUALIDADES.A.mult;
  assert.ok(Math.abs(com.ad - sem.ad - gume.ad * (m - 1)) < 1e-9);
  assert.ok(Math.abs(com.criticoBruto - sem.criticoBruto - gume.critico * (m - 1) * J.CAMPEOES.yasuo.critMult) < 1e-9);
  assert.equal(Y(['3031']).ad, sem.ad, 'sem marca de qualidade vale B');
});
test('fichaDaBuild: as cartas somam no mesmo multiplicador (2 cartas de Ataque Rara = +10%)', () => {
  const itens = ['3031+3~B', '3153+3~B'], sem = Y(itens).ad, com = Y(['3031+3#ataque2~B', '3153+3#ataque2~B']).ad;
  assert.ok(Math.abs(com / sem - (1 + 2 * J.CARTA_VALOR.ataque2)) < 1e-9);
  // item e carta podem vir como objeto ou como texto
  assert.equal(Y([{ id: '3031', refino: 3, qual: 'B', carta: 'ataque2' }, { id: '3153', refino: 3, qual: 'B', carta: 'ataque2' }]).ad, com);
});
test('fichaDaBuild: atributos (Força +1,2 de dano, Agilidade +0,8% de velocidade) e crescimento por nível', () => {
  const a = J.fichaDaBuild({ campeao: 'yasuo', nivel: 30, atrib: {}, itens: [] }), b = J.fichaDaBuild({ campeao: 'yasuo', nivel: 30, atrib: { forca: 50, agilidade: 25 }, itens: [] });
  assert.ok(Math.abs(b.ad - a.ad - 60) < 1e-9);
  assert.ok(b.velAtaque > a.velAtaque);
  assert.ok(a.ad > J.fichaDaBuild({ campeao: 'yasuo', nivel: 10, atrib: {}, itens: [] }).ad);
});
test('o crítico tem teto de 100% (o excedente fica em criticoBruto) e o Gume dá dano crítico extra', () => {
  const f = J.fichaDaBuild({ campeao: 'yasuo', nivel: 30, atrib: {}, itens: ['3031+5~A', '3036+5~A', '3085+5~A', '3046+5~A'] });
  assert.equal(f.critico, 1);
  assert.ok(f.criticoBruto > 1.5);
  const sem = J.fichaDaBuild({ campeao: 'yasuo', nivel: 30, atrib: {}, itens: ['3036+5~A'] }), com = J.fichaDaBuild({ campeao: 'yasuo', nivel: 30, atrib: {}, itens: ['3036+5~A', '3031+0~B'] });
  assert.ok(Math.abs(com.danoCritico - sem.danoCritico - 0.4 * J.CAMPEOES.yasuo.critDano) < 1e-9);
});
test('a velocidade de ataque da ficha tem teto de 3,0 e o relógio do jogo anda em passos de 0,05 s', () => {
  const f = J.fichaDaBuild({ campeao: 'aphelios', nivel: 40, atrib: { agilidade: 60 }, itens: ['3046+5~A', '3085+5~A', '3172+5~A', '3078+5~A'] });
  assert.equal(f.velAtaque, J.VEL_ATAQUE_MAX);
  assert.equal(f.velAtaque, 3);
  assert.ok(f.periodoAtaque >= 1 / (3 * f.aceleracao) - 1e-9, 'o relógio perde a sobra: o período nunca é menor que 1 / (velocidade x aceleração)');
  assert.ok(Math.abs(f.periodoAtaque / J.DT - Math.round(f.periodoAtaque / J.DT)) < 1e-6, 'múltiplo de 0,05 s');
  assert.ok(Math.abs(f.velEfetiva - 1 / f.periodoAtaque) < 1e-12);
});
test('degrau da velocidade de ataque: 1 ou 2 cartas de velocidade às vezes não mudam o período do ataque', () => {
  const itens = ['3031+2~B', '3172+2~B', '3153+2~B', '3074+2~B'], ficha = (n) => J.fichaDaBuild({ campeao: 'yasuo', nivel: 30, atrib: { forca: 60, agilidade: 20 }, itens: itens.map((x, i) => (i < n ? x.replace('~', '#velocidade1~') : x)) });
  const f = [0, 1, 2, 3].map(ficha);
  assert.ok(f[1].velAtaque > f[0].velAtaque && f[2].velAtaque > f[1].velAtaque, 'a ficha sobe a cada carta');
  assert.equal(f[1].periodoAtaque, f[0].periodoAtaque);
  assert.equal(f[2].periodoAtaque, f[0].periodoAtaque);
  assert.ok(f[3].periodoAtaque < f[0].periodoAtaque, 'a 3ª carta passa o degrau');
  // o período nunca aumenta com a velocidade e é sempre um múltiplo do passo
  let ant = Infinity;
  for (let v = 0.5; v <= 3; v += 0.01) { const p = J.periodoAtaque(v, 1); assert.ok(p <= ant + 1e-9 && p >= 1 / v - 1e-9); ant = p; }
});
test('fichaDaBuild: as habilidades passivas que mudam a ficha (Taric, Darius) usam os ranks', () => {
  const sem = J.fichaDaBuild({ campeao: 'taric', nivel: 30, atrib: {}, itens: [], ranks: { W: 0 } }), com = J.fichaDaBuild({ campeao: 'taric', nivel: 30, atrib: {}, itens: [], ranks: { W: 10 } });
  assert.ok(com.armadura > sem.armadura);
  assert.ok(J.fichaDaBuild({ campeao: 'darius', nivel: 30, atrib: {}, itens: [], ranks: { E: 10 } }).penArmadura > 0);
});
test('as tabelas de campeões, cartas e farm foram gravadas', () => {
  assert.ok(Object.keys(J.CAMPEOES).length >= 9);
  assert.equal(J.CARTA_VALOR.ataque2, 0.05);
  assert.ok(J.CAMPEOES.yasuo.critBase.length === 100 && J.CAMPEOES.yasuo.critBase[29] > 0.1);
  assert.ok(J.FARM && J.FARM.kHab);
  const e = J.meta.erroComparador;
  assert.ok(e && Number.isFinite(e.mediana) && Number.isFinite(e.max) && e.max >= e.mediana, 'o erro medido do comparador está em meta.erroComparador');
});
