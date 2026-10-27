// Lupa (app) · página escondida do simulador: distribui os combates entre alguns trabalhadores (sim-trabalho.js) e devolve os
// resultados ao processo principal, que chama window.rodar(...) por executeJavaScript. Sem rede, sem preload, sem Node.
'use strict';

let andamento = { feito: 0, total: 0 }, avisouEm = 0;
// o andamento vai ao processo principal pelo console (a página não tem preload): uma linha por segundo no máximo
const avisar = (agora = Date.now()) => { if (agora - avisouEm >= 1000) { avisouEm = agora; console.log('lupa-andamento:' + JSON.stringify(andamento)); } };

// jobs: [{ id, ... }], n: quantos trabalhadores. Devolve { [id]: resultado } ou rejeita com o primeiro erro
window.rodar = (jobs, n) => new Promise((ok, falha) => {
  const fila = jobs.slice(), saida = {}, trabalhadores = [];
  andamento = { feito: 0, total: jobs.length };
  let acabou = false;
  const fim = (erro) => {
    if (acabou) return;
    acabou = true;
    for (const t of trabalhadores) t.terminate();
    if (erro) falha(new Error(erro)); else ok(saida);
  };
  const proximo = (t) => { const j = fila.shift(); if (j) t.postMessage(j); else if (andamento.feito >= andamento.total) fim(); };
  if (!jobs.length) return fim();
  for (let k = 0; k < Math.max(1, Math.min(n, jobs.length)); k++) {
    const t = new Worker('sim-trabalho.js', { type: 'module' });
    trabalhadores.push(t);
    t.onmessage = (ev) => {
      const r = ev.data;
      if (r.pronto) return proximo(t);
      if (r.erro) return fim(r.erro);
      saida[r.id] = r;
      andamento.feito++;
      avisar();
      proximo(t);
    };
    // erro ao carregar o motor (o jogo mudou o formato, arquivo faltando): o trabalhador nem chega a dizer "pronto"
    t.onerror = (ev) => { ev.preventDefault?.(); fim('o motor do jogo não carregou: ' + (ev.message || 'erro no trabalhador')); };
  }
});
