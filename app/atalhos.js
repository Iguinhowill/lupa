// Lupa (app) · quais teclas são do app (puro, para testar em alertas.test.js). O main captura SÓ estas e impede que
// cheguem ao jogo; todo o resto passa para a página como sempre. O app nunca envia tecla para o jogo.
'use strict';

const LISTA = [
  ['Ctrl+1', 'Conta 1'], ['Ctrl+2', 'Conta 2'], ['Ctrl+3', 'Lado a lado'], ['Ctrl+4', 'Central'],
  ['Ctrl+Tab', 'Próxima aba'], ['Ctrl+B', 'Mostrar ou esconder o painel'], ['F5', 'Recarregar o jogo'],
  ['Ctrl + / Ctrl − / Ctrl 0', 'Zoom: aumentar, diminuir, padrão']
];

// `input` é o do before-input-event ({ type, key, control, alt, meta, shift }). Devolve a ação ou null
function atalhoDe(input) {
  if (!input || input.type !== 'keyDown' || input.alt || input.meta) return null;
  const k = String(input.key || '');
  if (!input.control) return k === 'F5' && !input.shift ? 'recarregar' : null;
  if (k === '1') return 'aba:conta1';
  if (k === '2') return 'aba:conta2';
  if (k === '3') return 'aba:lado';
  if (k === '4') return 'aba:central';
  if (k === 'Tab') return input.shift ? 'aba:anterior' : 'aba:proxima';
  if (/^[bB]$/.test(k) && !input.shift) return 'painel';
  if (k === '0') return 'zoom:zero';
  if (k === '=' || k === '+' || k === 'Add') return 'zoom:mais';
  if (k === '-' || k === '_' || k === 'Subtract') return 'zoom:menos';
  return null;
}

module.exports = { atalhoDe, LISTA };
