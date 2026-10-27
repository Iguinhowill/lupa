// Lupa (app) · as entradas que o app manda ao jogo nas ações que o jogador pede (puro, testado em acoes.test.js).
// Só duas ações, liberadas pelo Brunox em 27/10/2026: "Entregar e seguir" (botão do painel) e a setinha da coluna (Alt+L).
// Cada pedido do jogador autoriza UMA aba por pouco tempo e um número máximo de entradas; o preload do jogo
// (acao-jogo.js) pede cada clique ou tecla, e o main só manda se a autorização vale.
'use strict';

// ms: quanto tempo a autorização vale; entradas: quantos cliques/teclas no máximo (a tarefa tem até 9 passos, e cada um
// pode repetir a entrada uma vez se a primeira se perder)
const REGRAS = { tarefa: { ms: 4 * 60e3, entradas: 24 }, coluna: { ms: 5e3, entradas: 1 } };
// só as teclas de atalho do jogo que a entrega usa: B (volta para a Fonte) e M (mapa)
const TECLAS = new Set(['b', 'm']);
// ms entre entrar, mover, apertar e soltar o mouse (e entre apertar e soltar a tecla), como a mão
const INTERVALO = 40;

const autorizacao = (tipo, agora = Date.now()) => (REGRAS[tipo] ? { tipo, ate: agora + REGRAS[tipo].ms, resta: REGRAS[tipo].entradas } : null);
// gasta uma entrada se a autorização ainda vale (muda `aut`); devolve se pode
function gastar(aut, agora = Date.now()) {
  if (!aut || agora > aut.ate || !(aut.resta > 0)) return false;
  aut.resta--;
  return true;
}
// ponto em px CSS da página → px da view (vezes o zoom do jogo); null se cair fora dela
function pontoNaView(p, zoom, tam) {
  const x = Number(p?.x), y = Number(p?.y), z = Number(zoom) || 1;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const px = Math.round(x * z), py = Math.round(y * z);
  if (px < 0 || py < 0 || px >= tam.width || py >= tam.height) return null;
  return { x: px, y: py };
}
// um clique do botão esquerdo: o mouse entra na página e vai até o ponto (como a pessoa faria), aperta e solta
const clique = ({ x, y }) => [
  { type: 'mouseEnter', x, y },
  { type: 'mouseMove', x, y },
  { type: 'mouseDown', x, y, button: 'left', clickCount: 1 },
  { type: 'mouseUp', x, y, button: 'left', clickCount: 1 }
];
// apertar e soltar uma das teclas permitidas; null para qualquer outra
function tecla(k) {
  const t = String(k || '').toLowerCase();
  return TECLAS.has(t) ? [{ type: 'keyDown', keyCode: t }, { type: 'keyUp', keyCode: t }] : null;
}

module.exports = { REGRAS, TECLAS, INTERVALO, autorizacao, gastar, pontoNaView, clique, tecla };
