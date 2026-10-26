// Lupa · avalia o estado lido da tela contra o plano pessoal (planos.js).
// Devolve linhas { estado: 'ok' | 'proximo' | 'aviso', texto }: próximos passos, avisos, ok.
// Classic script (global) e também módulo no Node, para teste.
function avaliarPlano(estado, plano) {
  var proximo = [], aviso = [], ok = [];
  if (!estado || !plano) return [];
  var ficha = estado.ficha || {};
  var norm = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); };
  var nivel = parseInt(estado.nivel, 10);
  var nivelOk = !isNaN(nivel);
  var pontos = estado.pontos || {};
  var livresHab = Number(pontos.habilidade) || 0;
  var livresAtr = Number(pontos.atributo) || 0;
  var rank = function (h) { var m = String((h && h.rank) || '').match(/^(\d+)\s*\/\s*(\d+)/); return m ? { a: +m[1], max: +m[2] } : null; };
  var tem = function (lista, trecho) { return (lista || []).some(function (i) { return i && norm(i.nome).indexOf(trecho) >= 0; }); };

  // habilidades em ordem de prioridade
  if (plano.habs && Array.isArray(ficha.habs)) {
    var alvo = null;
    for (var i = 0; i < plano.habs.length && !alvo; i++) {
      var p = plano.habs[i];
      var h = ficha.habs.filter(function (x) { return x.t === p.t; })[0], r = rank(h);
      if (r && r.a < p.ate) alvo = { t: p.t, rank: r.a + '/' + r.max };
    }
    if (alvo) {
      proximo.push({ estado: 'proximo', texto: livresHab > 0
        ? 'Você tem ' + livresHab + (livresHab > 1 ? ' pontos' : ' ponto') + ' de habilidade livre: coloque em ' + alvo.t + ' (' + alvo.rank + ')'
        : 'Próximo ponto de habilidade: ' + alvo.t + ' (' + alvo.rank + ')' });
    } else {
      ok.push({ estado: 'ok', texto: 'Habilidades do plano completas' });
    }
    (plano.fixas || []).forEach(function (f) {
      var r = rank(ficha.habs.filter(function (x) { return x.t === f.t; })[0]);
      if (r && r.a > f.valor) aviso.push({ estado: 'aviso', texto: f.t + ' está em ' + r.a + '/' + r.max + ' e o plano deixa em ' + f.valor + '. Só um aviso; não precisa resetar.' });
    });
  }

  // barra
  if (plano.barra && Array.isArray(ficha.barra)) {
    var b = plano.barra, usaDepois = b.depois && nivelOk && nivel >= b.nivelTroca;
    var esperado = usaDepois ? b.depois : b.antes;
    var atual = ficha.barra.filter(Boolean).map(function (x) { return x.t; });
    var txt = esperado.join(' ');
    if (atual.join(' ') === txt) ok.push({ estado: 'ok', texto: 'Barra ' + txt + ', igual ao plano' });
    else aviso.push({ estado: 'aviso', texto: 'O plano manda a barra ' + txt + '; a sua está ' + (atual.join(' ') || 'vazia') });
    if (b.depois && nivelOk && nivel < b.nivelTroca) proximo.push({ estado: 'proximo', texto: b.avisoTroca });
  }

  // atributos
  if (plano.atributo && Array.isArray(ficha.atributos)) {
    if (livresAtr > 0) proximo.push({ estado: 'proximo', texto: livresAtr + (livresAtr > 1 ? ' pontos de atributo livres' : ' ponto de atributo livre') + ': coloque em ' + plano.atributo });
    else ok.push({ estado: 'ok', texto: 'Atributos em ' + plano.atributo + (estado.pontos ? ' · nenhum ponto livre' : '') });
  }

  // itens do farm
  if (plano.itens && Array.isArray(ficha.equip)) {
    var eq = ficha.equip, t = plano.itens.tipo;
    if (t === 'hidra') {
      var hidra = tem(eq, 'hidra'), dominik = tem(eq, 'dominik');
      var guardado = tem(ficha.mochila, 'dominik');
      if (dominik && !hidra) aviso.push({ estado: 'aviso', texto: 'Dominik equipado sem a Hidra Raivosa: no farm o plano usa a Hidra; Dominik fica na mochila para chefe' });
      else if (dominik) aviso.push({ estado: 'aviso', texto: 'Dominik equipado junto com a Hidra: tire o Dominik, ele é só para chefe' });
      else if (hidra) ok.push({ estado: 'ok', texto: 'Hidra no farm' + (guardado ? ' · Dominik guardado para chefe' : '') });
      else proximo.push({ estado: 'proximo', texto: 'Equipe a Hidra Raivosa para o farm' + (guardado ? ' (Dominik fica na mochila para chefe)' : '') });
    } else if (t === 'dancarina') {
      var danc = tem(eq, 'dancarina fantasma'), trind = tem(eq, 'forca da trindade');
      if (trind && !danc) aviso.push({ estado: 'aviso', texto: 'Força da Trindade equipada: no farm o plano usa a Dançarina Fantasma' });
      else if (danc) ok.push({ estado: 'ok', texto: 'Dançarina Fantasma no farm' });
      else proximo.push({ estado: 'proximo', texto: 'Equipe a Dançarina Fantasma no farm (em vez da Força da Trindade)' });
    }
  }

  // cartas proibidas
  if (plano.semCarta && Array.isArray(ficha.equip)) {
    var ruins = ficha.equip.filter(function (i) { return i && norm(i.carta).indexOf(norm(plano.semCarta)) >= 0; }).map(function (i) { return i.nome; });
    if (ruins.length) aviso.push({ estado: 'aviso', texto: 'Carta de ' + plano.semCarta + ' em: ' + ruins.join(', ') });
    else ok.push({ estado: 'ok', texto: 'Nenhuma carta de ' + plano.semCarta });
  }

  // zona
  if (plano.zonas && nivelOk && estado.zona) {
    var z = plano.zonas.filter(function (x) { return (x.ate == null || nivel <= x.ate) && (x.de == null || nivel >= x.de); })[0];
    if (z) {
      var faixa = z.ate != null ? 'até o ' + z.ate : 'do ' + z.de + ' em diante';
      if (norm(estado.zona).indexOf(norm(z.nome)) >= 0) ok.push({ estado: 'ok', texto: 'Zona certa: ' + z.nome + ' (' + faixa + (z.extra ? ', ' + z.extra : '') + ')' });
      else aviso.push({ estado: 'aviso', texto: 'O plano manda ' + z.nome + ' ' + faixa + (z.extra ? ' (' + z.extra + ')' : '') + '; você está em ' + estado.zona });
    }
  }

  // tarefa do Capitão
  if (plano.tarefaSempre && estado.tarefa !== undefined) {
    if (estado.tarefa === null) proximo.push({ estado: 'proximo', texto: 'Pegue uma tarefa com o Capitão da Legião' });
    else ok.push({ estado: 'ok', texto: 'Tarefa do Capitão ativa' });
  }

  return proximo.concat(aviso, ok);
}
if (typeof module !== 'undefined') module.exports = { avaliarPlano };
