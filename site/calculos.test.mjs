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

test('forja com regressão (+2 → +3): leva mais tentativas que a chance sozinha e os percentis ficam em ordem', () => {
  const r = C.simularForja({ id: '3031', de: 2, ate: 3, vip: false });
  const semRegressao = 1 / J.chanceForja(2, 0, false);      // geométrica pura, sem voltar ao +1 nem a persistência
  assert.ok(J.REGRESSAO_REFINO[2] > 0, 'o +2 → +3 tem regressão');
  assert.ok(r.tent.p50 <= r.tent.p90, 'p50 <= p90');
  assert.ok(r.tent.media > 1 && r.tent.media < semRegressao * 1.5, `média plausível: ${r.tent.media} (geométrica ${semRegressao})`);
});

test('a mesma conta da forja vem do cache (mesmo objeto)', () => {
  const o = { id: '3031', de: 0, ate: 2, vip: true };
  assert.equal(C.simularForja(o), C.simularForja({ ...o }));
});

// ---------- modelo de farm: estimarFarm ----------
const FARM_TESTE = { kHab: { yasuo: 0.9, aphelios: 0.7 }, aoe: { yasuo: 0.2, aphelios: 0.25 }, vaHab: {} };      // parâmetros fixos: o teste não depende da calibração do dia
const bYasuo = (extra = {}) => ({ campeao: 'yasuo', nivel: 30, atrib: { forca: 40 }, itens: ['3031+3~B', '3172+2~B', '3153+3~B', '3074+3~B'], ...extra });
const farm = (b, zona = 'dragao', opts = {}) => C.estimarFarm(J.fichaDaBuild(b), b.campeao, zona, b.nivel, { farm: FARM_TESTE, build: { ranks: { Q: 5, E: 5, R: 3, G: 5, D: 5 }, barra: ['Q', 'E', 'R', 'G'] }, ...opts });

test('estimarFarm monotônico: mais dano nunca dá mais tempo por abate (e a faixa inteira dá menos)', () => {
  let ant = Infinity, primeiro = null;
  for (let forca = 0; forca <= 200; forca += 10) {
    const r = farm(bYasuo({ atrib: { forca } }));
    assert.ok(r.tAbate <= ant + 1e-9, `Força ${forca}: ${r.tAbate} > ${ant}`);
    assert.ok(r.abatesH > 0 && Number.isFinite(r.xpH) && Number.isFinite(r.ouroH));
    ant = r.tAbate; primeiro ??= r.tAbate;
  }
  assert.ok(ant < primeiro * 0.85, 'com muito mais dano o abate fica bem mais rápido');
  // o mesmo com o refino (mais dano pela ficha) e com a qualidade
  let t = Infinity;
  for (let ref = 0; ref <= 7; ref++) { const r = farm(bYasuo({ itens: [`3031+${ref}~B`, '3172+2~B', '3153+3~B', '3074+3~B'] })); assert.ok(r.tAbate <= t + 1e-9); t = r.tAbate; }
  assert.ok(farm(bYasuo({ itens: ['3031+3~SS', '3172+2~B', '3153+3~B', '3074+3~B'] })).tAbate < farm(bYasuo({ itens: ['3031+3~C', '3172+2~B', '3153+3~B', '3074+3~B'] })).tAbate);
});
test('estimarFarm: o degrau da velocidade de ataque (DT de 0,05 s) vale no farm: carta que não passa o degrau não muda nada', () => {
  const itens = ['3031+2~B', '3172+2~B', '3153+2~B', '3074+2~B'], com = (n) => bYasuo({ atrib: { forca: 60, agilidade: 20 }, itens: itens.map((x, i) => (i < n ? x.replace('~', '#velocidade1~') : x)) });
  const r = [0, 1, 2, 3].map((n) => farm(com(n), 'dragao', { build: { ranks: {}, barra: [] } }));      // sem habilidades: só o auto-ataque (os bônus de velocidade das habilidades misturam degraus)
  assert.equal(r[1].tAbate, r[0].tAbate);
  assert.equal(r[2].tAbate, r[0].tAbate);
  assert.ok(r[3].tAbate < r[0].tAbate, 'a 3ª carta passa o degrau e o abate acelera');
  assert.ok(r[3].periodoAtaque < r[0].periodoAtaque);
});
test('estimarFarm: o crítico acima do teto de 100% não rende, abaixo dele rende', () => {
  const b = bYasuo({ itens: ['3031+5~A', '3036+5~A', '3085+5~A', '3172+2~B'] }), mais = bYasuo({ itens: ['3031+5#critico3~A', '3036+5~A', '3085+5~A', '3172+2~B'] });
  assert.equal(J.fichaDaBuild(b).critico, 1);
  assert.ok(J.fichaDaBuild(mais).criticoBruto > J.fichaDaBuild(b).criticoBruto);
  assert.equal(farm(mais).abatesH, farm(b).abatesH);
  // sem estar no teto, mais crítico dá mais abates
  const baixo = bYasuo({ itens: ['3172+2~B', '3153+3~B'], atrib: { forca: 60 } }), baixoMais = bYasuo({ itens: ['3172+2~B', '3153+3#critico2~B'], atrib: { forca: 60 } });
  assert.ok(J.fichaDaBuild(baixo).critico < 1 && farm(baixoMais).abatesH > farm(baixo).abatesH);
});
test('estimarFarm: monstros mais fortes (zona mais alta) demoram mais; o modelo devolve XP e ouro por hora coerentes', () => {
  const b = bYasuo(), baixa = farm(b, 'rota-inf'), alta = farm(b, 'dragao');
  assert.ok(alta.tLuta > baixa.tLuta && alta.vidaMonstro > baixa.vidaMonstro);
  assert.ok(Math.abs(alta.xpH - alta.abatesH * alta.xpAbate) < 1e-6 && Math.abs(alta.ouroH - alta.abatesH * alta.ouroAbate) < 1e-6);
  assert.ok(Math.abs(alta.abatesH - 3600 / alta.tAbate) < 1e-6, 'abates por hora = 3600 / tempo por abate');
  assert.equal(C.estimarFarm(J.fichaDaBuild(b), 'nao-existe', 'dragao', 30), null);
});
test('estimarFarm: item de área (Hidra Raivosa) encurta o grupo, e a barra de habilidades soma dano', () => {
  const f = J.fichaDaBuild(bYasuo({ itens: ['3031+3~B', '3172+2~B'] })), comHidra = { ...f, tem: (id) => id === '3074' || f.tem(id) };
  const r0 = C.estimarFarm(f, 'yasuo', 'dragao', 30, { farm: FARM_TESTE }), r1 = C.estimarFarm(comHidra, 'yasuo', 'dragao', 30, { farm: FARM_TESTE });
  assert.ok(r1.tLuta < r0.tLuta);
  const ranks = { Q: 8, E: 8, R: 4, G: 5 }, h2 = C.habilidades(f, 'yasuo', { ranks, barra: ['Q', 'E'] }), h4 = C.habilidades(f, 'yasuo', { ranks, barra: ['Q', 'E', 'R', 'G'] });
  assert.ok(h4.dano > h2.dano && h4.casts > h2.casts);
  assert.ok(h4.buffs.some((x) => x.t === 'G' && x.va > 0 && x.U > 0), 'a Respiração do Vento entra como bônus de velocidade por parte do tempo');
  assert.equal(C.habilidades(f, 'yasuo', { ranks, barra: ['W'] }).dano, 0, 'a Parede de Vento não causa dano');
  assert.equal(C.habilidades(f, 'taric', { ranks, barra: ['Q'] }).dano, 0, 'campeão sem tabela de habilidades: sem habilidades no modelo');
});
test('estimarFarm com a calibração gravada: Yasuo e Aphelios calibrados; o erro medido está nas tabelas', () => {
  for (const campeao of ['yasuo', 'aphelios']) {
    const b = { ...bYasuo(), campeao }, r = C.estimarFarm(J.fichaDaBuild(b), campeao, 'dragao', 30, { build: { ranks: { Q: 5, W: 5, E: 5, G: 5, D: 5 }, barra: ['Q', 'W', 'E', 'G'] } });
    assert.equal(r.calibrado, true, campeao);
    assert.ok(r.abatesH > 100 && r.abatesH < 20000, `${campeao}: ${r.abatesH} abates/h`);
    const e = J.meta.erroComparador.porCampeao[campeao];
    assert.ok(e.n >= 30 && e.mediana >= 0 && e.p90 >= e.mediana && e.max >= e.p90, campeao);
  }
  assert.equal(C.estimarFarm(J.fichaDaBuild({ ...bYasuo(), campeao: 'taric' }), 'taric', 'dragao', 30, {}).calibrado, false);
});
