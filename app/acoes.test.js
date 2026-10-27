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

test('ofertas: quantidade, tempo, XP, ouro e zona como o jogo escreve', () => {
  assert.deepEqual(OFERTA.lerOferta('120 monstros em Fosso do Dragão', '~15 min · 120.3k de XP · 30.1k de ouro · item épico'), { qtd: 120, min: 15, xp: 120300, ouro: 30100, zona: 'Fosso do Dragão' });
  assert.deepEqual(OFERTA.lerOferta('400 monstros em Covil do Barão', '~1,5 h · 1.2M de XP · 310.5k de ouro'), { qtd: 400, min: 90, xp: 1.2e6, ouro: 310500, zona: 'Covil do Barão' });
  assert.deepEqual(OFERTA.lerOferta('60 Larva do Vazio em Toca do Vazio', '~12 min · 9800 de XP · 2400 de ouro'), { qtd: 60, min: 12, xp: 9800, ouro: 2400, zona: 'Toca do Vazio' });
  assert.equal(OFERTA.lerOferta('1.890 monstros em Fosso do Dragão', '~3 h · 436.6k de XP').qtd, 1890);
  const velha = OFERTA.lerOferta('20× Lobo Gigante', 'Toca dos Lobos · 300 de ouro · 900 de XP');
  assert.equal(velha.min, null);
  assert.equal(velha.zona, null);
});

test('escolher sem ritmo medido: a de mais prêmio por minuto; empate fica com a mais curta; sem dados não entra', () => {
  const o = (min, xp, zona = 'Z') => ({ min, xp, zona });
  assert.equal(OFERTA.escolher([o(15, 120e3), o(60, 600e3), o(7, 50e3)]), 1);      // 8k, 10k, 7,1k por minuto
  assert.equal(OFERTA.escolher([o(30, 300e3), o(15, 150e3)]), 1);
  assert.equal(OFERTA.escolher([o(null, 1e6), o(10, 0), o(10, 50e3, null)]), -1);
  assert.equal(OFERTA.escolher([]), -1);
  assert.equal(OFERTA.escolher(undefined), -1);
});

// sessões de caçada como a Lupa guarda (cacada:<nome>): início, fim e, por zona, segundos, abates, XP e XP sem live
const sessao = (ini, zonas) => ({ ini, fim: ini + 3600e3, zonas });
const HORA = 3600;

test('ritmosDe: por zona, só sessões que começaram nos últimos 7 dias, só zona com 10 min ou mais, XP sem live', () => {
  const agora = 1e12, dia = 864e5;
  const r = OFERTA.ritmosDe([
    sessao(agora - dia, { 'Fosso do Dragão': { seg: HORA, abates: 2850, xp: 2291400, xpBase: 1909500 }, Fonte: { seg: 300, abates: 0, xp: 0 } }),
    sessao(agora - 2 * dia, { 'fosso do dragão': { seg: HORA, abates: 2850, xp: 1909500 } }),      // sem xpBase (sessão antiga): vale o xp
    { ini: agora - 8 * dia, fim: agora - dia, zonas: { 'Covil do Barão': { seg: 10 * HORA, abates: 20000, xp: 13e6 } } },      // começou há 8 dias
    { fim: agora, zonas: { Rio: { seg: HORA, abates: 2000, xp: 1e6 } } },      // sem início
    sessao(agora, { Rio: { seg: 599, abates: 300, xp: 150000 } }),
    null
  ], agora);
  assert.deepEqual(Object.keys(r), ['fosso do dragão']);
  assert.ok(Math.abs(r['fosso do dragão'].abatesMin - 47.5) < 1e-9);
  assert.ok(Math.abs(r['fosso do dragão'].xpAbate - 670) < 1e-9);
  assert.deepEqual(OFERTA.ritmosDe(undefined), {});
});

// as 5 ofertas do Capitão como o jogo monta (ritmo do jogo 10,5 abates/min no Fosso e 11,25 no Covil, prêmio = abates ×
// XP-base do abate × fator do tipo) e com o prêmio escrito como o jogo escreve ("147.0k"): Rápida, Normal, o Desafio da
// zona de cima, Expedição e Grande Expedição
const of = (tipo, zona, qtd, min, xp) => ({ tipo, zona, qtd, min, xp: OFERTA.numero((xp >= 1e4 ? (xp / 1e3).toFixed(1) + 'k' : String(Math.round(xp)))) });
const OFERTAS = [
  of('Rápida', 'Fosso do Dragão', 70, 7, 70 * 500 * 0.42),
  of('Normal', 'Fosso do Dragão', 160, 15, 160 * 500 * 0.43),
  of('Desafio', 'Covil do Barão', 170, 15, 170 * 650 * 0.44),
  of('Expedição', 'Fosso do Dragão', 630, 60, 630 * 500 * 0.462),
  of('Grande Expedição', 'Fosso do Dragão', 1890, 180, 1890 * 500 * 0.462)
];
const CUSTO = OFERTA.CUSTO_ENTREGA_MIN;

test('escolher no seu ritmo: o Desafio da zona de cima não ganha só por pagar mais por minuto no papel', () => {
  assert.equal(OFERTA.escolher(OFERTAS), 2, 'sem ritmo medido, pelo prêmio por minuto do jogo, o Desafio no Covil parece melhor');
  const aphelios = { 'fosso do dragão': { abatesMin: 47.5, xpAbate: 670 } };      // só o Fosso medido (o caso relatado)
  const k = OFERTA.escolher(OFERTAS, aphelios);
  assert.equal(OFERTAS[k].zona, 'Fosso do Dragão');
  assert.equal(OFERTAS[k].tipo, 'Grande Expedição', 'mais prêmio por abate e o custo da entrega dividido por mais abates');
  const v = OFERTA.noSeuRitmo(OFERTAS[k], OFERTAS, aphelios);
  assert.ok(Math.abs(v.min - 1890 / 47.5) < 1e-9);
  assert.ok(Math.abs(v.xpHora - ((1890 * 670 + OFERTAS[k].xp) / (1890 / 47.5 + CUSTO)) * 60) < 1e-6);
  assert.equal(OFERTA.noSeuRitmo(OFERTAS[2], OFERTAS, aphelios), null, 'sem medição no Covil');
});

test('escolher: empate até 1% (o arredondamento do prêmio que o jogo mostra) fica com a mais curta', () => {
  const a = { tipo: 'Normal', zona: 'Z', qtd: 100, min: 10, xp: 1000 }, b = { tipo: 'Normal', zona: 'Z', qtd: 50, min: 5, xp: 1004 };
  assert.equal(OFERTA.escolher([a, b]), 1, 'sem ritmo: 200,8 contra 100 por minuto');
  const c = { tipo: 'Normal', zona: 'Z', qtd: 100, min: 10, xp: 1000 }, d = { tipo: 'Normal', zona: 'Z', qtd: 99, min: 9.95, xp: 1000 };
  assert.equal(OFERTA.escolher([c, d]), 1, 'diferença de 0,5%: a mais curta');
  // no seu ritmo: a mesma oferta com o prêmio 0,5% maior pelo arredondamento empata com a original, e fica a mais curta
  const r = { z: { abatesMin: 40, xpAbate: 600 } };
  const e = { tipo: 'Normal', zona: 'Z', qtd: 200, min: 20, xp: 46200 }, f = { tipo: 'Normal', zona: 'Z', qtd: 201, min: 20.1, xp: 46200 * 1.005 * 1.005 };
  assert.ok(OFERTA.noSeuRitmo(f, [], r).xpHora > OFERTA.noSeuRitmo(e, [], r).xpHora);
  assert.equal(OFERTA.escolher([f, e], r), 1);
});

test('escolher no seu ritmo: com as duas zonas medidas, vale a que rende mais para você', () => {
  const covilMelhor = { 'fosso do dragão': { abatesMin: 30, xpAbate: 500 }, 'covil do barão': { abatesMin: 40, xpAbate: 800 } };
  assert.equal(OFERTA.escolher(OFERTAS, covilMelhor), 2);
  const lento = { 'fosso do dragão': { abatesMin: 47.5, xpAbate: 670 }, 'covil do barão': { abatesMin: 15, xpAbate: 800 } };
  assert.equal(OFERTAS[OFERTA.escolher(OFERTAS, lento)].zona, 'Fosso do Dragão', 'no Covil mata devagar demais');
});

test('abatesDa: a Caça e a Fúria valem o tempo do jogo vezes o ritmo dele na zona (pelo selo ou pelo título)', () => {
  const caca = of('Caça', 'Fosso do Dragão', 40, 12, 9000);
  assert.equal(OFERTA.abatesDa(OFERTAS[1], OFERTAS), 160);
  const lista = [...OFERTAS, caca];
  const ritmoJogo = (70 / 7 + 160 / 15 + 630 / 60 + 1890 / 180) / 4;
  assert.ok(Math.abs(OFERTA.abatesDa(caca, lista) - 12 * ritmoJogo) < 1e-9);
  assert.ok(Math.abs(OFERTA.abatesDa(of('Fúria', 'Rio', 3, 16, 5000), lista) - 16 * ((70 / 7 + 160 / 15 + 170 / 15 + 630 / 60 + 1890 / 180) / 5)) < 1e-9, 'zona sem outra oferta: o ritmo de todas');
  // selo com outro rótulo: o título decide ("<n> monstros em" conta todo abate; o nome da espécie ou "furiosos", não)
  const especie = { tipo: 'Caçada', titulo: '40 Larva do Vazio em Fosso do Dragão', zona: 'Fosso do Dragão', qtd: 40, min: 12, xp: 9000 };
  const furiosos = { tipo: 'Furor', titulo: '3 monstros furiosos em Fosso do Dragão', zona: 'Fosso do Dragão', qtd: 3, min: 16, xp: 9000 };
  const normal = { tipo: 'Comum', titulo: '160 monstros em Fosso do Dragão', zona: 'Fosso do Dragão', qtd: 160, min: 15, xp: 34400 };
  assert.ok(Math.abs(OFERTA.abatesDa(especie, lista) - 12 * ritmoJogo) < 1e-9);
  assert.ok(Math.abs(OFERTA.abatesDa(furiosos, lista) - 16 * ritmoJogo) < 1e-9);
  assert.equal(OFERTA.abatesDa(normal, lista), 160);
});
