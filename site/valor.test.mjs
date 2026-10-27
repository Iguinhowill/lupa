// node --test: as contas de valor do painel (lupa/ui.js: valorDrop, valorDrops, chaveMercado), com as tabelas de src/dados-jogo.js.
// O ui.js é script de navegador: roda num contexto do vm com o JOGO global, sem DOM (estas funções não desenham nada).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const J = createRequire(import.meta.url)('./src/dados-jogo.js');
const ui = vm.createContext({ JOGO: J, Intl, URL, Blob: class {} });
vm.runInContext(readFileSync(new URL('../lupa/ui.js', import.meta.url), 'utf8') + ';globalThis.__ui = { valorDrop, valorDrops, chaveMercado };', ui);
const { valorDrop, valorDrops, chaveMercado } = ui.__ui;
const esp = J.ESPOLIOS['escama-dragao'], gume = J.itemPorNome('Gume do Infinito');

test('valorDrop: espólio pelo preço do jogo, item pela qualidade e refino do texto (B quando não há)', () => {
  assert.deepEqual({ ...valorDrop(esp.nome) }, { tipo: 'espolio', loja: esp.valor });
  assert.equal(valorDrop('Gume do Infinito [A]').loja, J.valorVenda(gume.id, 0, 'A'));
  assert.equal(valorDrop('Gume do Infinito +2 [S]').loja, J.valorVenda(gume.id, 2, 'S'));
  assert.equal(valorDrop('Gume do Infinito').loja, J.valorVenda(gume.id, 0, 'B'));
  assert.equal(valorDrop('Gume do Infinito [?]'), null, 'qualidade fora do formato não casa com nada');
  assert.equal(valorDrop('Runa da Fúria'), null);
  assert.equal(valorDrop(''), null);
});
test('valorDrops: soma por tipo e conta as unidades sem preço', () => {
  const r = valorDrops({ [esp.nome]: 100, 'Gume do Infinito [C]': 2, 'Runa da Fúria': 3 });
  assert.equal(r.espolios, esp.valor * 100);
  assert.equal(r.itens, 2 * J.valorVenda(gume.id, 0, 'C'));
  assert.equal(r.total, r.espolios + r.itens);
  assert.equal(r.semPreco, 3);
  assert.equal(valorDrops(undefined).total, 0);
});
test('chaveMercado: a mesma versão sem a carta, como o Mercado agrupa', () => {
  assert.equal(chaveMercado('3031+4#velocidade2~B'), '3031+4~B');
  assert.equal(chaveMercado('3031~A'), '3031~A');
  assert.equal(chaveMercado('3031!+2~SS'), '3031!+2~SS');
  assert.equal(chaveMercado('3031~?'), null, 'qualidade ainda sendo sorteada');
  assert.equal(chaveMercado('esp:pele-lobo:37'), null);
});
