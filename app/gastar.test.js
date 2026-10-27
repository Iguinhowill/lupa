// Testes do Onde gastar o ouro (gastar.js): leitura da ficha, opções, estatística pareada e o resumo. O simulador entra falso.
// Rode com: npm test (o copiar-lupa.mjs põe as tabelas e o calculos.js em app/lupa)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('./gastar');
const ESTADO = require('./teste-gastar/estado-yasuo.json');

const DIA = 864e5;
const copia = (o) => JSON.parse(JSON.stringify(o));

test('número da ficha', () => {
  assert.equal(G.numero('11.4M'), 11.4e6);
  assert.equal(G.numero('950.2k'), 950200);
  assert.equal(G.numero('9800'), 9800);
  assert.equal(G.numero('1.234.567'), 1234567);
  assert.equal(G.numero(''), null);
  assert.equal(G.numero('—'), null);
});

test('cartas pelo nome', () => {
  assert.equal(G.cartaPorNome('Carta de Ataque Rara'), 'ataque2');
  assert.equal(G.cartaPorNome('Carta de Velocidade de Ataque Lendária'), 'velocidade3');
  assert.equal(G.cartaPorNome('Carta misteriosa'), null);
  assert.equal(G.nomeCarta('critico1'), 'Carta de Crítico Básica');
});

test('build a partir da ficha', () => {
  const b = G.buildDoEstado(ESTADO);
  assert.equal(b.nivel, 37);
  assert.deepEqual(b.zona, { id: 'barao', nome: 'Covil do Barão' });
  assert.equal(b.perfil, 'ad');
  assert.equal(b.ouro, 11.4e6);
  assert.equal(b.atrib.forca, 108);
  assert.equal(b.ranks.Q, 10);
  assert.deepEqual(b.barra, ['Q', 'R', 'F', 'G']);
  assert.equal(b.equip.length, 5);
  assert.equal(b.cartas.velocidade2, 3);
  assert.equal(b.habs.Q, 'Tempestade de Aço');
  assert.ok(b.mochila.every((o) => o.qual), 'a mochila só com itens conhecidos');
  assert.equal(G.buildDoEstado({ ...ESTADO, ficha: null }), null);
  assert.equal(G.buildDoEstado({ ...ESTADO, ficha: { ...ESTADO.ficha, equip: [] } }), null);
  // fora de zona de caça: a zona mais caçada na última sessão
  const naFonte = G.buildDoEstado({ ...ESTADO, zona: 'Fonte' }, [{ zonas: { 'Rio': { seg: 100 }, 'Fosso do Dragão': { seg: 900 } } }]);
  assert.equal(naFonte.zona.id, 'dragao');
});

test('assinatura muda com a build e não com o ouro', () => {
  const a = G.assinatura(G.buildDoEstado(ESTADO));
  const rico = copia(ESTADO); rico.ficha.stats.ouro = '99M';
  assert.equal(G.assinatura(G.buildDoEstado(rico)), a);
  const outro = copia(ESTADO); outro.ficha.equip[1].id = '3031+6#ataque2~B';
  assert.notEqual(G.assinatura(G.buildDoEstado(outro)), a);
});

test('opções: forja, cartas, mochila, Mercado e reset', () => {
  const agora = Date.now();
  const b = G.buildDoEstado(ESTADO);
  const menores = {
    '3074+5~A': { ouro: 3e6, em: agora },                  // Hidra: entra
    '3074+6~A': { ouro: 30e6, em: agora },                 // mais forte, mas o ouro não paga: fica só a que cabe e a mais barata
    '3031+4~B': { ouro: 1e6, em: agora },                  // Gume pior que o equipado: não entra
    '3031+6~B': { ouro: 9e6, em: agora },                  // Gume melhor: entra no lugar do Gume
    '3153+5~S': { ouro: 2e6, em: agora - 8 * DIA },        // preço velho: não entra
    '3085+5#ataque2~A': { ouro: 2e6, em: agora },          // com carta: não entra (o Mercado agrupa sem carta)
    'gema:ataque3': { ouro: 8e6, em: agora },
  };
  const c = G.candidatos(b, { menores, agora });
  const de = (t) => c.filter((x) => x.tipo === t);
  assert.equal(de('forja').length, 5);
  assert.ok(de('forja').every((x) => x.custo > 0 && x.custoP90 >= x.custo));
  // cartas da bolsa custam só tirar a velha (100 mil a rara); a lendária do Mercado soma o preço
  const vel = de('carta').find((x) => /Velocidade de Ataque Rara/.test(x.titulo));
  assert.equal(vel.custo, 100000);
  const lend = de('carta').find((x) => /Ataque Lendária/.test(x.titulo));
  assert.equal(lend.custo, 8.1e6);
  assert.ok(!de('carta').some((x) => /pela Carta de Ataque Rara/.test(x.titulo)), 'trocar por uma igual não entra');
  // Mercado
  const merc = de('mercado').map((x) => x.titulo);
  assert.ok(merc.some((t) => /Hidra Raivosa \+5 A/.test(t)));
  assert.ok(!merc.some((t) => /Hidra Raivosa \+6 A/.test(t)), 'de cada item, a mais forte que o ouro paga e a mais barata: a +6 (30 mi) não cabe nos 11,4 mi');
  assert.ok(merc.some((t) => /Gume do Infinito \+6 B.*lugar de Gume do Infinito/.test(t)));
  assert.ok(!merc.some((t) => /Gume do Infinito \+6 B.*lugar de (?!Gume)/.test(t)), 'o Gume não entra no lugar de outro: ficariam dois');
  assert.ok(!merc.some((t) => /Gume do Infinito \+4/.test(t)));
  assert.ok(!merc.some((t) => /Espada do Rei Destruído \+5 S/.test(t)));
  assert.ok(!merc.some((t) => /Runaan \+5/.test(t)));
  assert.ok(de('mercado').every((x) => x.custo === x.custo && x.custo > 0));
  // mochila: o Zelo (crítico e velocidade) entra; a Warmog (vida) e a Dançarina +0 (pior que a equipada) não
  const moch = de('mochila').map((x) => x.titulo);
  assert.ok(moch.some((t) => /Zelo/.test(t)));
  assert.ok(!moch.some((t) => /Warmog/.test(t)));
  assert.ok(!moch.some((t) => /Dançarina Fantasma \+0 B da mochila no lugar de Dançarina/.test(t)));
  // reset: 25 mil × nível, sem repetir a distribuição atual (108 em Força)
  assert.ok(de('atributos').length >= 2 && de('atributos').every((x) => x.custo === 25000 * 37));
  assert.ok(!de('atributos').some((x) => /tudo em Força/.test(x.titulo)));
  // ids únicos
  assert.equal(new Set(c.map((x) => x.id)).size, c.length);
});

test('forja: item no +7 não forja; mítico só do nível 50', () => {
  const e = copia(ESTADO); e.ficha.equip[1].id = '3031+7#ataque2~B';
  const b = G.buildDoEstado(e);
  assert.ok(!G.candidatos(b).some((x) => x.id === 'forja:1'));
  const mitico = require('./lupa/dados-jogo.js').ITENS.find((i) => i.raridade === 'mitico' && i.e.ad);
  if (mitico) {
    const menores = { [`${mitico.id}~C`]: { ouro: 1e6, em: Date.now() } };
    assert.equal(G.candidatos(b, { menores }).filter((x) => x.tipo === 'mercado').length, 0);
    const e50 = copia(e); e50.nivel = '50';
    assert.ok(G.candidatos(G.buildDoEstado(e50), { menores }).some((x) => x.tipo === 'mercado'));
  }
});

test('ganho pareado', () => {
  assert.deepEqual(G.ganhoPareado({ abatesH: [100, 200] }, { abatesH: [100, 200] }), { ganho: 0, erro: 0 });
  const r = G.ganhoPareado({ abatesH: [100, 100, 100, 100] }, { abatesH: [104, 106, 104, 106] });
  assert.ok(Math.abs(r.ganho - 0.05) < 1e-12);
  assert.ok(r.erro > 0 && r.erro < 0.02);
});

test('da triagem para a conferência', () => {
  const opcoes = [
    { id: 'forja:0', tipo: 'forja', custo: 5e6 }, { id: 'forja:1', tipo: 'forja', custo: 5e6 },
    { id: 'gratis-bom', tipo: 'mochila', custo: 0 }, { id: 'gratis-ruim', tipo: 'mochila', custo: 0 },
    { id: 'caro', tipo: 'mercado', custo: 9e6 }, { id: 'barato', tipo: 'mercado', custo: 1e6 }, { id: 'piora', tipo: 'mercado', custo: 1e6 },
  ];
  const r = (g) => ({ abatesH: [100 * (1 + g), 100 * (1 + g)] });
  const tri = { base: r(0), 'forja:0': r(-0.01), 'forja:1': r(0), 'gratis-bom': r(0.02), 'gratis-ruim': r(-0.02), caro: r(0.05), barato: r(0.02), piora: r(-0.03) };
  const ids = G.escolherParaConferir(opcoes, tri).map((x) => x.id);
  assert.deepEqual(ids, ['forja:0', 'forja:1', 'gratis-bom', 'barato', 'caro']);
});

test('economia medida na zona', () => {
  const agora = Date.now();
  const s = [
    { ini: agora - DIA, zonas: { 'Covil do Barão': { seg: 1800, abates: 1000, xpBase: 600000, xp: 900000, ouro: 200000 } } },
    { ini: agora - 2 * DIA, zonas: { 'Covil do Barão': { seg: 1800, abates: 1000, xp: 600000, ouro: 200000 }, Rio: { seg: 3600, abates: 9, ouro: 1 } } },
    { ini: agora - 9 * DIA, zonas: { 'Covil do Barão': { seg: 99999, abates: 1, ouro: 1 } } },
  ];
  const e = G.economiaMedida(s, 'Covil do Barão', agora);
  assert.equal(Math.round(e.abatesH), 2000);
  assert.equal(Math.round(e.xpH), 1200000, 'XP sem o bônus de live (xpBase) quando a sessão tem');
  assert.equal(Math.round(e.ouroH), 400000);
  assert.equal(G.economiaMedida(s, 'Fosso do Dragão', agora), null);
  assert.equal(G.economiaMedida([{ ini: agora, zonas: { Rio: { seg: 300, abates: 50 } } }], 'Rio', agora), null, 'menos de 10 min não conta');
});

test('a conta inteira com o simulador falso', async () => {
  const agora = Date.now();
  // o "motor" falso: a Hidra dá +5%, a carta de velocidade tira 1%, o resto não muda nada; sementes dão ruído pequeno e igual
  const rodar = async (jobs) => Object.fromEntries(jobs.map((j) => {
    const ganho = j.itens.some((x) => x.startsWith('3074')) ? 0.05 : j.itens.some((x) => x.includes('velocidade2')) ? -0.01 : 0;
    return [j.id, { id: j.id, campeao: 'yasuo', abatesH: j.sementes.map((s) => 2000 * (1 + ganho) * (1 + (s % 3) * 0.001)), mortes: j.sementes.map(() => 0) }];
  }));
  const sessoes = [{ ini: agora - DIA, zonas: { 'Covil do Barão': { seg: 3600, abates: 2000, xpBase: 1e6, ouro: 400000 } } }];
  const g = await G.calcular({ estado: ESTADO, sessoes, menores: { '3074+5~A': { ouro: 3e6, em: agora } }, agora, rodar, motor: { sha: 'x' } });
  assert.equal(g.estado, 'pronto');
  assert.equal(g.campeao, 'yasuo');
  assert.ok(g.base.economia.medido);
  assert.ok(g.opcoes.length >= 1 && g.opcoes.every((l) => /Hidra/.test(l.titulo)), 'só a Hidra rende');
  assert.equal(g.opcoes.length, 1, 'a mesma Hidra em lugares diferentes: fica só o melhor lugar');
  const melhor = g.opcoes[0];
  assert.ok(Math.abs(melhor.ganho - 0.05) < 1e-6);
  assert.equal(melhor.xpH, 50000);
  assert.equal(melhor.ouroH, 20000);
  assert.equal(melhor.horas, Math.round(melhor.custo / 20000));
  assert.ok(g.semGanho.some((l) => /Forjar/.test(l.titulo)), 'as forjas conferidas e sem ganho vão para "não muda nada"');
  assert.ok(!g.semGanho.some((l) => /Velocidade/.test(l.titulo)), 'o que piorou na triagem nem é conferido');
  assert.equal(g.assinatura, G.assinatura(G.buildDoEstado(ESTADO)));
  await assert.rejects(G.calcular({ estado: { nome: 'x' }, rodar }), /ficha/);
});

test('item equipado que a conta não reconhece: recusa em vez de simular sem ele', async () => {
  const e = copia(ESTADO); e.ficha.equip[2].id = '3153+5#ataque2~?';      // qualidade ainda sendo avaliada
  const b = G.buildDoEstado(e);
  assert.equal(b.faltam, 1);
  assert.equal(b.equip.length, 4);
  await assert.rejects(G.calcular({ estado: e, rodar: async () => ({}) }), /avaliado/);
  const novo = copia(ESTADO); novo.ficha.equip[2].id = '999999+5~B';      // item mais novo que as tabelas
  assert.equal(G.buildDoEstado(novo).faltam, 1);
});

test('espaço vazio no equipamento também recebe sugestão', () => {
  const e = copia(ESTADO); e.ficha.equip = e.ficha.equip.filter((i) => !i.id.startsWith('3085'));      // sem a Runaan: 1 bota + 3
  const b = G.buildDoEstado(e);
  const agora = Date.now();
  const c = G.candidatos(b, { menores: { '3074+5~A': { ouro: 3e6, em: agora }, '3172+3~B': { ouro: 1e6, em: agora } }, agora });
  const vazio = c.filter((x) => /espaço vazio/.test(x.titulo));
  assert.ok(vazio.some((x) => /Hidra Raivosa/.test(x.titulo) && x.equip.length === 5), 'a Hidra entra no espaço vazio');
  assert.ok(!vazio.some((x) => /Grevas/.test(x.titulo)), 'bota não entra no vazio: já tem uma');
  assert.ok(vazio.every((x) => x.custo === 3e6 || x.tipo === 'mochila'), 'no vazio não há carta para tirar');
  // com os 4 lugares ocupados, nada vai para o vazio
  assert.ok(!G.candidatos(G.buildDoEstado(ESTADO), { menores: { '3074+5~A': { ouro: 3e6, em: agora } }, agora }).some((x) => /espaço vazio/.test(x.titulo)));
});

test('a triagem manda os 2 melhores lugares de cada item para a conferência', () => {
  const opcoes = ['a@0', 'a@1', 'a@2', 'a@3'].map((id) => ({ id, grupo: 'mercado:a', tipo: 'mercado', custo: 1e6 })).concat([{ id: 'b@0', grupo: 'mercado:b', tipo: 'mercado', custo: 1e6 }]);
  const r = (g) => ({ abatesH: [100 * (1 + g), 100 * (1 + g)] });
  const tri = { base: r(0), 'a@0': r(0.01), 'a@1': r(0.04), 'a@2': r(0.02), 'a@3': r(0.03), 'b@0': r(0.005) };
  assert.deepEqual(G.escolherParaConferir(opcoes, tri).map((x) => x.id), ['a@1', 'a@3', 'b@0']);
});

test('o ouro da ficha: o cartão (ui.js) lê igual à conta', () => {
  const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
  const ctx = vm.createContext({ JOGO: require('./lupa/dados-jogo.js'), Intl, URL, Blob: class {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'lupa', 'ui.js'), 'utf8') + ';globalThis.__o = ouroDaFicha;', ctx);
  for (const t of ['11.4M', '950.2k', '9800', '1.234.567', '2,5M', '', '—', null]) assert.equal(ctx.__o(t), G.numero(t), String(t));
});
