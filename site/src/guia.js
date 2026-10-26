// Lupa Online · Guia: o plano de cada personagem (avaliarPlano, o mesmo da Lupa) conferido com a última ficha,
// as notas do guia e a edição do plano. É a única coisa que o site grava no banco.
'use strict';

(async () => {
  const sessao = await exigirLogin();
  montarNav();
  const raiz = $id('pagina');
  let quem = lerPref('guia-quem', 'todos'), editando = null, msgSalvar = '';
  let estados, linhasPlano;
  async function carregar() {
    [estados, linhasPlano] = await Promise.all([Nuvem.estados(), Nuvem.planos()]);
  }
  try { await carregar(); } catch (e) { erroNaPagina(raiz, e); return; }

  const ICO = { ok: 'ok', proximo: 'proximo', aviso: 'info' };
  const ROT = { ok: 'Em dia', proximo: 'Próximo', aviso: 'Atenção' };

  function cartaoPersonagem(p) {
    const e = estados[p], plano = LUPA_PLANOS[p], notas = LUPA_NOTAS[p] || [];
    const linhas = e && plano ? avaliarPlano(e, plano) : [];
    const prox = linhas.find((l) => l.estado === 'proximo');
    const atualizado = linhasPlano.find((r) => r.personagem === p)?.atualizado_em;
    const corpo = [
      h('div', { class: 'c-pers-topo' },
        h('div', { class: 'quem' }, h('strong', null, nomeCurto(p)),
          h('span', null, [e?.nivel && `nível ${e.nivel}`, e?.zona, e ? `ficha de ${dataHora(e.ts)}` : 'sem ficha lida ainda'].filter(Boolean).join(' · '))),
        h('button', { type: 'button', class: 'botao', 'aria-expanded': String(editando === p), onclick: () => { editando = editando === p ? null : p; msgSalvar = ''; desenhar(); } }, editando === p ? 'Fechar edição' : 'Editar plano')),
      prox ? h('div', { class: 'alerta pronta' }, icone('proximo', 20), h('span', null, h('b', null, 'Próximo passo: '), prox.texto)) : null,
      linhas.length
        ? h('ul', { class: 'plano-lista' }, linhas.filter((l) => l !== prox).map((l) => h('li', { class: 'plano-linha ' + l.estado },
          h('span', { class: 'plano-ico' }, icone(ICO[l.estado] || 'info', 16)), h('span', null, h('span', { class: 'fraco' }, ROT[l.estado] + ' · '), l.texto))))
        : vazio(plano ? 'Sem ficha lida ainda: o plano aparece quando a Lupa enviar a primeira leitura.' : 'Sem plano para este personagem. Use "Editar plano" para criar.'),
      notas.length ? h('div', null, h('h3', { class: 'rotulo' }, 'Notas do guia'), h('ul', { class: 'notas' }, notas.map((n) => h('li', null, n)))) : null,
      atualizado ? nota(`Plano atualizado em ${dataHora(Date.parse(atualizado))}.`) : null
    ];
    if (editando === p) corpo.push(editor(p, plano, notas));
    return h('article', { class: 'cartao' }, corpo);
  }

  function editor(p, plano, notas) {
    const txtNotas = h('textarea', { id: 'ed-notas', 'aria-label': 'Notas do guia, uma por linha' });
    txtNotas.value = notas.join('\n');
    const txtPlano = h('textarea', { id: 'ed-plano', 'aria-label': 'Plano em JSON', spellcheck: 'false' });
    txtPlano.value = JSON.stringify(plano || { campeao: '' }, null, 2);
    const msg = h('p', { class: 'nuvem-erro', role: 'status' }, msgSalvar);
    const salvar = async () => {
      let novo;
      try { novo = JSON.parse(txtPlano.value); } catch (e) { msg.textContent = 'O plano não é um JSON válido: ' + e.message; return; }
      msg.textContent = 'Salvando…';
      const { error } = await SB.from('planos').upsert({
        dono: sessao.user.id, personagem: p, plano: novo, atualizado_em: new Date().toISOString(),
        notas: txtNotas.value.split('\n').map((x) => x.trim()).filter(Boolean)
      }, { onConflict: 'dono,personagem' });
      if (error) { msg.textContent = 'Não salvou: ' + error.message; return; }
      await carregar();
      editando = null; msgSalvar = '';
      desenhar();
    };
    return h('div', { class: 'editor' },
      h('label', { for: 'ed-notas', class: 'rotulo' }, 'Notas do guia (uma por linha)'), txtNotas,
      h('details', null, h('summary', null, 'Regras do plano (avançado)'),
        nota('Campos: habs [{ t, ate }], fixas, barra { antes, depois, nivelTroca, avisoTroca }, atributo, itens { tipo }, semCarta, zonas [{ de, ate, nome }], tarefaSempre. Campo que faltar desliga a regra.'),
        txtPlano),
      h('div', { class: 'nuvem-bts' }, h('button', { type: 'button', class: 'botao principal', onclick: salvar }, 'Salvar'),
        h('button', { type: 'button', class: 'botao', onclick: () => { editando = null; desenhar(); } }, 'Cancelar')),
      msg,
      nota('A Lupa no PC de casa continua usando o planos.js dela; o que você salva aqui vale para o site.'));
  }

  function desenhar() {
    const nomes = [...new Set([...Object.keys(estados), ...Object.keys(LUPA_PLANOS)])].sort();
    const vis = nomes.filter((n) => quem === 'todos' || n === quem);
    raiz.replaceChildren(
      h('div', { class: 'pagina-cab' },
        h('h1', null, 'Guia', h('small', null, 'O plano de cada personagem conferido com a última ficha que a Lupa enviou.')),
        chips('Personagem', [['todos', 'Os dois'], ...nomes.map((n) => [n, nomeCurto(n)])], quem, (v) => { quem = v; gravarPref('guia-quem', v); desenhar(); })),
      vis.length ? h('div', { class: 'grade-cartoes' }, vis.map(cartaoPersonagem)) : vazio('Nenhum personagem ainda: entre no Lupa Online pela Lupa no PC de casa.'));
    raiz.removeAttribute('aria-busy');
  }
  desenhar();
})();
