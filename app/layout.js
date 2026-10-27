// Lupa (app) · contas puras de posição e zoom das views (sem Electron, para testar em layout.test.js)
'use strict';

const ALTURA_CASCA = 44;        // a faixa de abas
const ALTURA_ETIQUETAS = 22;    // a faixa fina com o nome de cada metade (só no lado a lado)
const LARGURA_IDEAL = 1010;     // o jogo troca para o layout compacto abaixo de 1001 px CSS: mira com folga
const ZOOM_MIN = 0.25, ZOOM_MAX = 3;
const LARGURAS_PAINEL = [320, 380, 520];

const limitar = (z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 1000) / 1000));
// zoom que mantém o layout normal do jogo numa área de `largura` px (nunca amplia)
const zoomAuto = (largura) => limitar(Math.min(1, largura / LARGURA_IDEAL));

// um modo só vale se as contas existirem: sem a Conta 2, "conta2" e "lado" voltam para a Conta 1
function modoValido(id, soConta1) {
  if (!['conta1', 'conta2', 'lado', 'central'].includes(id)) return 'conta1';
  return soConta1 && (id === 'conta2' || id === 'lado') ? 'conta1' : id;
}

// o zoom guardado é por grupo de modo: um jogo sozinho, o lado a lado e a Central
const grupoDe = (id) => (id === 'lado' ? 'lado' : id === 'central' ? 'central' : 'solo');

// Retângulos de tudo, em px da janela. Entrada: { largura, altura, modo, painelAberto, larguraPainel }.
// Saída: { casca, jogos: { conta1, conta2 }, central, painel, etiquetas: [{ id, x, largura }], divisor }
function calcular({ largura: L, altura: A, modo, painelAberto = false, larguraPainel = 380 }) {
  const lado = modo === 'lado';
  const topo = ALTURA_CASCA + (lado ? ALTURA_ETIQUETAS : 0);
  const alt = Math.max(0, A - topo);
  const comPainel = !!painelAberto && modo !== 'central';
  const lp = comPainel ? Math.min(larguraPainel, Math.max(0, L - 320)) : 0;      // sempre sobra espaço para o jogo
  const area = Math.max(0, L - lp);
  const r = { casca: { x: 0, y: 0, width: L, height: topo }, jogos: { conta1: null, conta2: null }, central: null, painel: null, etiquetas: [], divisor: null };
  if (modo === 'central') r.central = { x: 0, y: ALTURA_CASCA, width: L, height: Math.max(0, A - ALTURA_CASCA) };
  else if (lado) {
    const esq = Math.floor((area - 1) / 2), dir = area - 1 - esq;      // 1 px de filete no meio
    r.jogos.conta1 = { x: 0, y: topo, width: esq, height: alt };
    r.jogos.conta2 = { x: esq + 1, y: topo, width: dir, height: alt };
    r.etiquetas = [{ id: 'conta1', x: 0, largura: esq }, { id: 'conta2', x: esq + 1, largura: dir }];
    r.divisor = { x: esq, y: topo, width: 1, height: alt };
  } else r.jogos[modo] = { x: 0, y: topo, width: area, height: alt };
  if (comPainel) r.painel = { x: area, y: topo, width: lp, height: alt };
  return r;
}

// zoom de cada jogo. `ajuste` é o que o usuário guardou: no lado a lado multiplica o zoom automático da metade; nos
// demais modos é o próprio zoom
function zoomDoJogo(modo, larguraDaView, ajuste = 1) {
  return modo === 'lado' ? limitar(zoomAuto(larguraDaView) * ajuste) : limitar(ajuste);
}
// Ctrl +/−: passo de 10 %, 0 volta ao padrão
const PASSO_ZOOM = 0.1;
const ajustarZoom = (ajuste, acao) => (acao === 'zero' ? 1 : limitar((ajuste || 1) + (acao === 'mais' ? PASSO_ZOOM : -PASSO_ZOOM)));

// a janela salva ainda aparece em algum monitor? (precisa de uma área mínima à mostra, para dar para arrastar)
function visivel(b, areas, minimo = 120) {
  if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y) || !(b.width > 0) || !(b.height > 0)) return false;
  return areas.some((a) => Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x) >= minimo
    && Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y) >= minimo);
}

module.exports = { ALTURA_CASCA, ALTURA_ETIQUETAS, LARGURA_IDEAL, LARGURAS_PAINEL, calcular, zoomAuto, zoomDoJogo, ajustarZoom, modoValido, grupoDe, visivel };
