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
const ler = (arq) => JSON.parse(fs.readFileSync(arq, 'utf8'));

test('mudando a cada 20 ms, grava no máximo na espera máxima', async () => {
  const arq = path.join(pasta(), 'dados.json');
  const a = new Armazem(arq, { espera: 50, esperaMax: 200 });
  const fim = Date.now() + 1000;
  let n = 0;
  while (Date.now() < fim && !fs.existsSync(arq)) { a.set({ x: n++ }); await dormir(20); }
  assert.ok(fs.existsSync(arq), 'não gravou enquanto mudava');
  a.gravar();
});

test('parado, grava depois da espera curta', async () => {
  const arq = path.join(pasta(), 'dados.json');
  const a = new Armazem(arq, { espera: 30, esperaMax: 1000 });
  a.set({ y: 1 });
  await dormir(300);
  assert.deepEqual(ler(arq), { y: 1 });
});

test('guarda a versão anterior e lê o .bak quando o principal está estragado ou sumiu', () => {
  const arq = path.join(pasta(), 'dados.json');
  const a = new Armazem(arq);
  a.set({ v: 1 }); a.gravar();
  a.set({ v: 2 }); a.gravar();
  assert.deepEqual(ler(arq + '.bak'), { v: 1 });
  fs.writeFileSync(arq, '{ pela metade');
  assert.deepEqual(new Armazem(arq).get('v'), { v: 1 });
  fs.writeFileSync(arq, '[1, 2]');      // JSON válido, mas não é objeto
  assert.deepEqual(new Armazem(arq).get('v'), { v: 1 });
  fs.rmSync(arq);
  assert.deepEqual(new Armazem(arq).get('v'), { v: 1 });
});

test('principal estragado não sobrescreve o .bak bom', () => {
  const arq = path.join(pasta(), 'dados.json');
  fs.writeFileSync(arq + '.bak', JSON.stringify({ bom: true }));
  fs.writeFileSync(arq, '{ estragado');
  const a = new Armazem(arq);
  a.set({ novo: 1 }); a.gravar();
  assert.deepEqual(ler(arq + '.bak'), { bom: true });
  assert.deepEqual(ler(arq), { bom: true, novo: 1 });
});

test('erro de disco não derruba e tenta de novo sozinho', async () => {
  const dir = path.join(pasta(), 'ainda-nao-existe'), arq = path.join(dir, 'dados.json');
  const a = new Armazem(arq, { retentar: 50 });
  a.set({ z: 1 });
  assert.doesNotThrow(() => a.gravar());
  assert.ok(!fs.existsSync(arq));
  fs.mkdirSync(dir);
  await dormir(300);
  assert.deepEqual(ler(arq), { z: 1 });
});
