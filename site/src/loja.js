// Lupa Online · Loja: a lista "Quero comprar" (alertas de preço) e quanto vale o que cada personagem está usando,
// pelo Mercado dos jogadores. Os preços vêm do Mercado aberto no PC de casa (a Lupa lê a tela; aberta, o jogo atualiza
// a janela a cada 30 s).
'use strict';

const vivo = (g) => !!g && g.ouro != null && !g.sumiu;
const versaoTxt = (qual, ref) => `${qual} +${ref || 0}`;

// casa um item equipado com o Mercado pelo código que a tela traz (3031+4#velocidade2~B)
function analisar(it, precos) {
  const m = String(it.id || '').match(RE_CHAVE);
  if (!m) return { it, semCodigo: true };
  const [, num, marca, refS, carta, qual] = m, ref = +(refS || 0);
  const base = `${num}${marca}${ref ? '+' + ref : ''}~${qual}`;
  const igual = precos.porChave.get(it.id) || null;
  const semCarta = carta ? precos.porChave.get(base) || null : null;
  const pCarta = carta ? precos.porChave.get('gema:' + carta) || null : null;
  const perto = [...precos.porChave.values()].map((g) => {
    const mm = g.chave.match(RE_CHAVE);
    if (!mm || mm[1] !== num || g.chave === it.id || g.chave === base) return null;
    const dr = (+(mm[3] || 0)) - ref, dq = QUALS.indexOf(mm[5]) - QUALS.indexOf(qual);
    return Math.abs(dr) + Math.abs(dq) <= 2 ? { g, dr, dq, dist: Math.abs(dr) + 2 * Math.abs(dq) } : null;
  }).filter(Boolean).sort((a, b) => a.dist - b.dist || (a.g.ouro ?? Infinity) - (b.g.ouro ?? Infinity));

  // referência: o menor entre a mesma versão com a mesma carta e (sem carta + a carta); sem nada igual, a mais perto
  const cands = [];
  if (vivo(igual)) cands.push({ v: igual.ouro, como: carta ? 'a mesma versão com a mesma carta' : 'a mesma versão' });
  if (vivo(semCarta) && vivo(pCarta)) cands.push({ v: semCarta.ouro + pCarta.ouro, como: 'sem carta + a carta' });
  let refer = cands.sort((a, b) => a.v - b.v)[0] || null;
  if (!refer) {
    const p = perto.find((x) => vivo(x.g) && !x.g.carta && x.dq === 0 && x.dr < 0) || perto.find((x) => vivo(x.g) && !x.g.carta);
    if (p) refer = { v: p.g.ouro + (carta && vivo(pCarta) ? pCarta.ouro : 0), como: `aprox.: ${versaoTxt(p.g.qual, p.g.refino)}${carta && vivo(pCarta) ? ' + a carta' : ''}`, aprox: true };
  }
  return { it, num, qual, ref, carta, base, igual, semCarta, pCarta, perto: perto.slice(0, 3), refer };
}

(async () => {
  await exigirLogin();
  montarNav();
  const raiz = $id('pagina');
  let quem = lerPref('loja-quem', '');
  let estados, precos, icones, alertas, avisos;
  try {
    const [est, merc, ic, , al, av] = await Promise.all([Nuvem.estados(), Nuvem.mercado(60), Nuvem.icones(), Nuvem.planos(), Nuvem.alertas(), Nuvem.avisos()]);
    estados = est; precos = indicePrecos(merc); icones = ic; alertas = al; avisos = av;
  } catch (e) { erroNaPagina(raiz, e); return; }
  const ctx = { icones };
  const nomes = Object.keys(estados).sort();
  if (!nomes.includes(quem)) quem = nomes[0] || '';

  // ---------- Quero comprar (alertas de preço) ----------
  // A seção é montada uma vez e só as partes vivas (situação, lista, avisos) são redesenhadas: o formulário não perde
  // o que está sendo digitado quando a página se atualiza.
  const NOME_QUAL = { '': 'Qualquer', C: 'C ou melhor', B: 'B ou melhor', A: 'A ou melhor', S: 'S ou melhor', SS: 'SS' };
  const precoDe = (a, g) => (a.moeda === 'orbs' ? g.gemas : g.ouro);

  // o que dá para escolher: tudo que já apareceu no Mercado e o que os personagens usam ou carregam
  function catalogo() {
    const m = new Map(), por = (nome, alvo) => { if (nome && alvo && !m.has(nome.toLowerCase())) m.set(nome.toLowerCase(), { nome, alvo }); };
    for (const g of precos.porChave.values()) {
      if (g.chave.startsWith('gema:')) por(g.nome, g.chave);
      else { const x = g.chave.match(RE_CHAVE); if (x) por(g.nome.replace(/\s*\[[A-Z]+\]$/, '').replace(/\s\+\d+$/, ''), x[1]); }
    }
    for (const e of Object.values(estados)) {
      for (const it of [...(e.ficha?.equip || []), ...(e.ficha?.mochila || [])]) { const x = String(it.id || '').match(RE_CHAVE); if (x) por(it.nome, x[1]); }
    }
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // situação da vigia: o estado de cada personagem diz se o Mercado está aberto em casa
  function situacao() {
    const frescos = Object.values(estados).filter((e) => Date.now() - e.ts < 5 * 60e3);
    const comprar = frescos.find((e) => e.mercado?.aba === 'comprar'), aberto = frescos.find((e) => e.mercado);
    const visto = Math.max(0, ...alertas.map((a) => Date.parse(a.visto_em || 0)));
    if (comprar && !comprar.mercado.filtro) return ['pronta', `Vigiando: o Mercado está aberto em casa na aba Comprar${visto ? ` · conferido às ${hora(visto)}` : ''}.`];
    if (comprar) return ['fora', 'O Mercado está aberto em casa, mas com filtro: só os itens que a busca mostra são conferidos.'];
    if (aberto) return ['fora', 'O Mercado está aberto em casa, mas fora da aba Comprar: os alertas esperam você voltar para ela.'];
    return ['fora', 'O Mercado está fechado em casa: os alertas só funcionam com a janela aberta (tecla J, aba Comprar, sem filtro). Pode deixar aberta e sair.'];
  }

  // agora: o que a Lupa conferiu por último; antes da primeira conferência, a última leitura enviada
  function agoraDe(a) {
    if (a.visto_em) return { g: a.menor, preco: a.menor?.preco ?? null, em: Date.parse(a.visto_em) };
    const g = [...precos.porChave.values()].filter((x) => !x.sumiu && precoDe(a, x) != null && atendeAlerta(a, x)).sort((x, y) => precoDe(a, x) - precoDe(a, y))[0];
    return g ? { g, preco: precoDe(a, g), em: g.lidoEm, velho: true } : null;
  }

  async function mudarAlerta(a, mud) {
    const { error } = mud ? await SB.from('alertas').update(mud).eq('id', a.id) : await SB.from('alertas').delete().eq('id', a.id);
    if (error) { msgForm.textContent = 'Não deu: ' + error.message; return; }
    await atualizar();
  }

  function linhaAlerta(a) {
    const ag = agoraDe(a), abaixo = ag?.preco != null && ag.preco <= a.preco_max;
    const exige = a.alvo.startsWith('gema:') ? [] : [a.qual_min ? NOME_QUAL[a.qual_min] : null, a.refino_min ? `+${a.refino_min} ou mais` : null, a.so_sem_carta ? 'sem carta' : null].filter(Boolean);
    return h('li', { class: 'alerta-linha' + (a.ativo ? '' : ' pausado') },
      h('div', { class: 'item' }, imagem(a.nome, ctx, { tam: 32 }),
        h('div', { class: 'item-texto' }, h('span', { class: 'item-nome' }, a.nome), exige.length ? h('span', { class: 'fraco' }, exige.join(' · ')) : null)),
      h('div', null, h('span', { class: 'rot' }, 'Quero até'), h('b', { class: 'num' }, precoMoeda(a.preco_max, a.moeda))),
      h('div', null, h('span', { class: 'rot' }, a.ativo ? 'Agora' : 'Pausado'),
        !ag ? h('span', { class: 'fraco' }, 'Sem leitura do Mercado ainda')
          : ag.preco == null ? h('span', { class: 'fraco' }, `Nenhum à venda · ${hora(ag.em)}`)
            : h('span', null, h('b', { class: 'num' + (abaixo ? ' acao-boa' : '') }, precoMoeda(ag.preco, a.moeda)),
              h('span', { class: 'fraco' }, ` · ${ag.g.n || '?'} à venda · ${ag.velho ? 'leitura de ' + dataHora(ag.em) : hora(ag.em)}`),
              abaixo ? h('span', { class: 'etiqueta abaixo' }, 'abaixo do alvo') : null)),
      h('div', { class: 'nuvem-bts' },
        h('button', { type: 'button', class: 'botao', onclick: () => mudarAlerta(a, { ativo: !a.ativo }) }, a.ativo ? 'Pausar' : 'Retomar'),
        h('button', { type: 'button', class: 'botao', onclick: () => { if (confirm(`Excluir o alerta de ${a.nome}?`)) mudarAlerta(a, null); } }, 'Excluir')));
  }

  const situacaoEl = h('div'), listaEl = h('div'), avisosEl = h('div'), notifEl = h('div'), msgForm = h('p', { class: 'nuvem-erro', role: 'status' });
  const opcoes = (pares) => pares.map(([v, t]) => h('option', { value: v }, t));
  const campo = (rot, el) => h('label', null, rot, el);
  const listaItens = h('datalist', { id: 'itens-mercado' });
  const form = h('form', { class: 'alerta-form', novalidate: '' },
    campo('Item', h('input', { name: 'nome', list: 'itens-mercado', autocomplete: 'off', placeholder: 'Ex.: Gume do Infinito', required: '' })),
    campo('Qualidade', h('select', { name: 'qual' }, opcoes(['', ...QUALS].map((q) => [q, NOME_QUAL[q]])))),
    campo('Refino', h('select', { name: 'refino' }, opcoes([0, 1, 2, 3, 4, 5, 6, 7].map((n) => [n, n ? `+${n} ou mais` : 'Qualquer'])))),
    campo('Carta', h('select', { name: 'carta' }, opcoes([['', 'Com ou sem'], ['sem', 'Só sem carta']]))),
    campo('Pagar até', h('input', { name: 'preco', inputmode: 'decimal', placeholder: '1,5 mi', autocomplete: 'off', required: '' })),
    campo('Moeda', h('select', { name: 'moeda' }, opcoes([['ouro', 'Ouro'], ['orbs', '💠']]))),
    h('button', { type: 'submit', class: 'botao principal' }, 'Adicionar'),
    listaItens);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const f = form.elements, txt = f.namedItem('nome').value.trim().toLowerCase();
    const achado = catalogo().find((c) => c.nome.toLowerCase() === txt);
    if (!achado) { msgForm.textContent = 'Escolha um item da lista: os nomes vêm das leituras do Mercado e dos itens dos seus personagens.'; return; }
    const preco = lerPreco(f.namedItem('preco').value);
    if (!preco) { msgForm.textContent = 'Não entendi o preço: escreva como "1,5 mi", "800 mil" ou "1500000".'; return; }
    const gema = achado.alvo.startsWith('gema:');
    msgForm.textContent = 'Salvando…';
    const { error } = await SB.from('alertas').insert({
      alvo: achado.alvo, nome: achado.nome, preco_max: preco, moeda: f.namedItem('moeda').value,
      qual_min: gema ? null : f.namedItem('qual').value || null, refino_min: gema ? 0 : +f.namedItem('refino').value, so_sem_carta: !gema && f.namedItem('carta').value === 'sem'
    });
    if (error) { msgForm.textContent = 'Não salvou: ' + error.message; return; }
    form.reset(); msgForm.textContent = '';
    await atualizar();
  };

  function desenharNotif() {
    if (!('Notification' in window)) { notifEl.replaceChildren(nota('Este navegador não mostra notificações: o aviso aparece só no canto da página.')); return; }
    const p = Notification.permission;
    notifEl.replaceChildren(p === 'granted' ? nota('Notificações ligadas neste navegador. O aviso chega com o site aberto numa aba, mesmo em segundo plano.')
      : p === 'denied' ? nota('As notificações deste site estão bloqueadas no navegador: libere no cadeado da barra de endereço.')
        : h('div', { class: 'nuvem-bts' }, h('button', { type: 'button', class: 'botao principal', onclick: () => Notification.requestPermission().then(desenharNotif) }, 'Ativar notificações neste navegador'),
          h('span', { class: 'nota' }, 'Sem isso, o aviso aparece só no canto da página.')));
  }

  function desenharQuero() {
    const [cl, txt] = situacao();
    situacaoEl.replaceChildren(h('div', { class: 'alerta ' + cl }, icone(cl === 'pronta' ? 'sino' : 'alerta', 20), h('span', null, txt)));
    listaEl.replaceChildren(alertas.length ? h('ul', { class: 'alertas-lista' }, alertas.map(linhaAlerta)) : vazio('Nenhum alerta ainda. Escolha o item e o preço máximo abaixo.'));
    avisosEl.replaceChildren(avisos.length ? h('details', null, h('summary', null, `Últimos avisos (${avisos.length})`),
      h('ul', { class: 'perto' }, avisos.map((v) => h('li', null, h('span', null, `${dataHora(Date.parse(v.em))} · ${v.nome}`),
        h('span', { class: 'num' }, precoMoeda(v.preco, v.moeda), h('span', { class: 'fraco' }, ` (alvo ${precoMoeda(v.preco_max, v.moeda)})`)))))) : '');
    listaItens.replaceChildren(...catalogo().map((c) => h('option', { value: c.nome })));
  }
  const secQuero = h('section', { class: 'cartao quero' }, h('h2', { class: 'rotulo' }, 'Quero comprar'),
    situacaoEl, notifEl, listaEl, form, msgForm, avisosEl,
    nota('O aviso sai quando a oferta mais barata que atende fica abaixo do seu preço, e de novo só se ela baixar mais ou se for vendida e aparecer outra. Comprar é sempre você, pelo Mercado no jogo.'));

  async function atualizar() {
    try { [estados, alertas, avisos] = await Promise.all([Nuvem.estados(), Nuvem.alertas(), Nuvem.avisos()]); } catch { return; }
    desenharQuero();
  }
  desenharNotif();
  desenharQuero();
  setInterval(atualizar, 60e3);

  function cartaoItem(a) {
    const it = a.it, selo = [it.refino || '+0', it.qual].filter(Boolean).join(' ');
    const cab = h('div', { class: 'item-cab' }, imagem(it.nome, ctx, { tam: 44, raridade: it.raridade, selo }),
      h('div', null, h('h3', null, it.nome || 'Item'),
        h('div', { class: 'etiquetas' }, h('span', { class: 'etiqueta' }, selo || '?'), h('span', { class: 'etiqueta carta' }, it.carta || 'sem carta'))));
    if (a.semCodigo) return h('article', { class: 'cartao item-cartao' }, cab, nota('Este item veio de uma leitura antiga, sem o código do jogo. Com a Lupa 0.4 no PC de casa ele casa com o Mercado na próxima leitura.'));
    const lido = (g) => (g.sumiu ? `não estava na leitura completa de ${dataHora(g.sumiuEm)}` : `${g.n} à venda · ${dataHora(g.lidoEm)}`);
    const igualTxt = a.igual
      ? [h('span', { class: 'val' }, precoTxt(a.igual.ouro)), h('span', { class: 'st-sub' }, lido(a.igual))]
      : [h('span', { class: 'val nada' }, 'Nenhuma'), h('span', { class: 'st-sub' }, `nenhuma ${versaoTxt(a.qual, a.ref)}${a.carta ? ' com essa carta' : ''} nas leituras`)];
    if (a.semCarta) igualTxt.push(h('span', { class: 'st-sub' }, `sem carta: ${precoTxt(a.semCarta.ouro)} (${lido(a.semCarta)})`));
    const hist = precos.historico(a.igual ? it.id : a.base);
    const precosHist = hist.map((x) => x.ouro).filter((x) => x != null);
    return h('article', { class: 'cartao item-cartao' }, cab,
      h('div', { class: 'dois' },
        h('div', { class: 'caixa' }, h('span', { class: 'rot' }, 'A mesma versão à venda'), igualTxt),
        h('div', { class: 'caixa' }, h('span', { class: 'rot' }, 'Valor de referência'),
          h('span', { class: 'val' + (a.refer ? '' : ' nada') }, a.refer ? (a.refer.aprox ? '≈ ' : '') + precoTxt(a.refer.v) : '—'),
          h('span', { class: 'st-sub' }, a.refer ? a.refer.como : 'sem leitura parecida ainda'))),
      a.perto.length ? h('div', null, h('span', { class: 'rotulo' }, 'Versões mais perto à venda'),
        h('ul', { class: 'perto' }, a.perto.map((x) => h('li', null,
          h('span', null, `${versaoTxt(x.g.qual, x.g.refino)}${x.g.carta ? ' · com carta' : ', sem carta'}`),
          h('span', { class: 'num' }, precoTxt(x.g.ouro), h('span', { class: 'fraco' }, ` (${x.g.n})`)))))) : null,
      nota(precosHist.length >= 2
        ? `Histórico: ${hist.length} leituras desde ${dataHora(hist[0].lidoEm)}, de ${precoTxt(Math.min(...precosHist))} a ${precoTxt(Math.max(...precosHist))}.`
        : 'Histórico de preço: começa a encher a partir da 2ª leitura do Mercado.'));
  }

  function desenhar() {
    const e = estados[quem], equip = e?.ficha?.equip || [];
    const itens = equip.map((it) => analisar(it, precos));
    const comRef = itens.filter((a) => a.refer), aprox = comRef.filter((a) => a.refer.aprox).length;
    const total = comRef.reduce((s0, a) => s0 + a.refer.v, 0);
    const ult = precos.ultima, compl = precos.ultimaCompleta;

    const cartas = {};
    for (const a of itens) if (a.carta) (cartas[a.carta] ||= { nome: a.it.carta || a.pCarta?.nome || a.carta, qtd: 0, g: a.pCarta }).qtd++;

    raiz.replaceChildren(
      h('div', { class: 'pagina-cab' },
        h('h1', null, 'Loja', h('small', null, 'O que você quer comprar, com aviso de preço, e quanto vale o que cada personagem usa.'))),
      secQuero,
      h('div', { class: 'pagina-cab' },
        h('h2', { class: 'sub-cab' }, 'Quanto vale o que você está usando', h('small', null, 'Cada item equipado comparado com o Mercado dos jogadores.')),
        chips('Personagem', nomes.map((n) => [n, nomeCurto(n)]), quem, (v) => { quem = v; gravarPref('loja-quem', v); desenhar(); })),
      h('div', { class: 'grade-cartoes' },
        h('section', { class: 'destaque', 'aria-label': 'Valor da build' },
          h('div', null, h('span', { class: 'rotulo' }, `Valor da build · ${nomeCurto(quem)}`),
            h('span', { class: 'grande' }, comRef.length ? '≈ ' + precoTxt(total) : '—'),
            h('span', null, comRef.length ? `${comRef.length} de ${itens.length} itens com preço${aprox ? ` · ${aprox} por aproximação` : ''}` : 'Sem leitura do Mercado que sirva ainda.'))),
        h('div', { class: ult && Date.now() - ult.lidoEm > 12 * HORA ? 'alerta fora' : 'alerta pronta' }, icone('relogio', 20),
          h('span', null,
            ult ? h('b', null, `Última leitura do Mercado: ${dataHora(ult.lidoEm)}${ult.completa ? '' : ' (com filtro)'}`) : h('b', null, 'Nenhuma leitura do Mercado ainda.'),
            compl && compl !== ult ? ` Última completa: ${dataHora(compl.lidoEm)}.` : '',
            h('br'), 'Os preços vêm do Mercado aberto no PC de casa (tecla J, aba Comprar, sem filtro); aberto, ele sobe a cada 10 min.'))),
      itens.length ? h('div', { class: 'grade-cartoes' }, itens.map(cartaoItem)) : vazio('Sem ficha deste personagem ainda.'),
      Object.keys(cartas).length ? cartao('Cartas encaixadas', h('ul', { class: 'perto' }, Object.values(cartas).map((c) => h('li', null,
        h('span', null, `${c.nome} × ${c.qtd}`),
        h('span', { class: 'num' }, c.g ? (c.g.ouro != null ? `${precoTxt(c.g.ouro)} cada` : `${inteiro(c.g.gemas)} gemas`) : '—', c.g ? h('span', { class: 'fraco' }, ` (${c.g.n} à venda)`) : null)))),
      nota('Valor de referência: o menor entre a mesma versão com a mesma carta e a versão sem carta somada ao preço da carta. Sem a mesma versão à venda, usa a mais perto e marca como aproximado.')) : null);
    raiz.removeAttribute('aria-busy');
  }
  desenhar();
})();
