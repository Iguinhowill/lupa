// Lupa (app) · as entradas que o app manda ao jogo nas ações que o jogador pede (puro, testado em acoes.test.js).
// Só duas ações, liberadas pelo Brunox em 27/10/2026: "Entregar e seguir" (botão do painel) e a setinha da coluna (Alt+L).
// Cada pedido autoriza UMA aba por pouco tempo e um número máximo de entradas; o preload do jogo (acao-jogo.js) pede cada
// clique ou tecla, e o main só manda se a autorização vale. As missões automáticas (opção da aba Ajustes, teste pedido pelo
// Brunox em 29/10/2026) fazem o mesmo pedido do botão quando a tarefa fica pronta; as regras de quando podem estão no fim.
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

// ---------- missões automáticas ----------
// fresco: a leitura da Lupa precisa ser recente; semUso: espera a pessoa parar de digitar e de clicar no app (o foco vai para
// o jogo da ação, um B ou M digitado no meio viraria atalho do jogo, e o personagem sairia do que ela está fazendo);
// espera: nova olhada depois de uma tentativa que nem começou (janela coberta, leitura atrasada); pausa: depois de uma falha; falhas: com tantas na mesma tarefa, o automático para até
// a próxima (ou até o jogador apertar o botão); depoisOk: a leitura ainda mostra a tarefa entregue como pronta por uns segundos
const AUTO = { fresco: 30e3, semUso: 10e3, espera: 30e3, pausa: 5 * 60e3, falhas: 3, depoisOk: 60e3 };
// Por que a conta não tenta agora (null = pode). `est` é o último estado:<nome>, `reg` o registro das tentativas dessa tarefa
// ({ falhas, proxima }), `aVista` se a aba dela está na tela (aba ativa ou lado a lado), `ultimoUso` a última tecla ou clique
// da pessoa no app
function autoMotivo({ est, reg, agora, aVista, ultimoUso = 0 }) {
  const t = est && est.tarefa;
  if (!t || !t.pronta) return 'sem-tarefa';
  if (!(agora - est.ts <= AUTO.fresco)) return 'leitura-velha';
  if (!aVista) return 'fora-da-tela';
  if (agora - ultimoUso < AUTO.semUso) return 'em-uso';
  // parado vem antes da mochila: o painel não troca o "Parado por você" (ou o erro) por uma espera que nunca vai andar
  if (reg && reg.falhas >= AUTO.falhas) return 'parado';
  const m = est.mochila;      // o Capitão não entrega com a mochila cheia (o item do prêmio não tem onde ir)
  if (m && m.total > 0 && m.usados >= m.total) return 'mochila';
  if (reg && agora < reg.proxima) return 'aguarda';
  return null;
}
// o registro depois de uma tentativa: 'ok' só segura a próxima por um minuto; 'espera' (não começou) olha de novo em 30 s;
// 'parado' (o jogador apertou Parar) para o automático nessa tarefa; erro conta uma falha e espera 5 min
function autoDepois(reg, resultado, agora) {
  const r = { falhas: 0, proxima: 0, ...reg };
  if (resultado === 'ok') return { falhas: 0, proxima: agora + AUTO.depoisOk };
  if (resultado === 'espera') r.proxima = agora + AUTO.espera;
  else if (resultado === 'parado') r.falhas = AUTO.falhas;
  else { r.falhas++; r.proxima = agora + AUTO.pausa; }
  return r;
}

module.exports = { REGRAS, TECLAS, INTERVALO, autorizacao, gastar, pontoNaView, clique, tecla, AUTO, autoMotivo, autoDepois };
