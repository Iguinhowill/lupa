// Lupa (app) · casos do armazém (npm test): grava mesmo com mudança contínua, guarda o .bak e não cai com erro de disco.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Armazem } = require('./armazem');

const pasta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lupa-armazem-'));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

test('mudando a cada 20 ms, grava no máximo na espera máxima', async () => {
  const arq = path.join(pasta(), 'dados.json');
  const a = new Armazem(arq, { espera: 50, esperaMax: 200 });
  const fim = Date.now() + 400;
  let n = 0;
  while (Date.now() < fim && !fs.existsSync(arq)) { a.set({ x: n++ }); await dormir(20); }
  assert.ok(fs.existsSync(arq), 'não gravou enquanto mudava');
  a.gravar();
});

test('parado, grava depois da espera curta', async () => {
  const arq = path.join(pasta(), 'dados.json');
  const a = new Armazem(arq, { espera: 30, esperaMax: 1000 });
  a.set({ y: 1 });
  await dormir(80);
  assert.deepEqual(JSON.parse(fs.readFileSync(arq, 'utf8')), { y: 1 });
});

test('guarda a versão anterior e lê o .bak quando o principal está estragado', () => {
  const arq = path.join(pasta(), 'dados.json');
  const a = new Armazem(arq);
  a.set({ v: 1 }); a.gravar();
  a.set({ v: 2 }); a.gravar();
  assert.deepEqual(JSON.parse(fs.readFileSync(arq + '.bak', 'utf8')), { v: 1 });
  fs.writeFileSync(arq, '{ pela metade');
  assert.deepEqual(new Armazem(arq).get('v'), { v: 1 });
});

test('erro de disco não derruba (pasta que não existe)', () => {
  const a = new Armazem(path.join(pasta(), 'nao-existe', 'dados.json'));
  a.set({ z: 1 });
  assert.doesNotThrow(() => a.gravar());
});
