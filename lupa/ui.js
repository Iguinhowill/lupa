// Lupa · peças de interface compartilhadas (painel lateral, Central e mini janela).
// Script clássico, funções globais. Só desenha e lê o que já está no storage: não fala com o jogo.
//
// Contrato do `ctx` (quem chama monta e mantém atualizado):
//   ctx = {
//     config,                 // config do storage já mesclada com PADRAO (use mesclarConfig)
//     cacadas,                // { [nome]: { sessoes: [...] } }  (chave "cacada:<nome>")
//     eventos,                // { [nome]: [{ ts, tipo, titulo, texto, item?, raridade?, qual? }] }  (chave "eventos:<nome>")
//     icones,                 // { chave: dataURL }  (chave "icones")
//     menores,                // { [chave]: { ouro, gemas, n, em } }  (chave "mercado:menores": menor preço visto no Mercado por versão)
//     salvarConfig(mud),      // grava uma mudança parcial em config (avisos é mesclado)
//     alternarAviso(k),       // liga/desliga config.avisos[k]
//     semBonus,               // boolean: Caçada sem bônus de live
//     setSemBonus(v),         // troca semBonus e redesenha
//     redesenhar()            // pede um novo desenho (sem cache)
//   }
'use strict';

const COR_RARIDADE = { basico: '#d0d0d0', epico: '#c88aff', lendario: '#ffc040', mitico: '#ff5a78' };
const PADRAO = {
  esconderLoot: false, tema: true, semBonusLateral: false, semRedes: false, novaSessao: 0,
  manterAcordado: false, lateralFechada: false, novaSessaoPor: {},
  recolhidos: { status: false, local: false, abas: false },
  avisos: { kick: true, twitch: true, voto: true, tarefa: true, evento: true, convites: false, mochila: true, chao: true, morte: true, pontos: true, nivel: true,
    premio: true, diaria: true, guerra: true, vilemaw: true, covil: true, reinicio: true, lendario: true }
};
// mesma cor de --borda-forte do CSS (o atributo style não enxerga as variáveis do :root)
const COR_BORDA_FORTE = '#3a4150';
const PAUSA = 15 * 60e3, BALDE = 5 * 60e3;

// Mescla o config salvo com os padrões (inclusive os objetos aninhados).
function mesclarConfig(c) {
  return { ...PADRAO, ...c, recolhidos: { ...PADRAO.recolhidos, ...(c?.recolhidos || {}) }, avisos: { ...PADRAO.avisos, ...(c?.avisos || {}) } };
}

// ---------- formatos ----------
const nf = new Intl.NumberFormat('pt-BR');
const inteiro = (n) => nf.format(Math.round(n || 0));
const curto = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2).replace('.', ',') + ' M' : n >= 1e4 ? (n / 1e3).toFixed(1).replace('.', ',') + ' k' : inteiro(n));
const duracao = (seg) => { const m = Math.floor((seg || 0) / 60), h = Math.floor(m / 60); return h ? `${h} h ${m % 60} min` : `${m} min`; };
const hora = (ts) => new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataHora = (ts) => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const porHora = (v, seg) => (seg >= 60 ? v / (seg / 3600) : null);
const ouTraco = (v, f = curto) => (v == null ? '—' : f(v));
const mult = (n) => '×' + Number(n).toFixed(2).replace('.', ',');
// ms até a meia-noite de Brasília (o jogo vira o dia lá); o fuso vem do Intl, não é fixo
function msAteViradaDia(agora = Date.now()) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(agora).map((x) => [x.type, x.value]));
    return (86400 - (+p.hour * 3600 + +p.minute * 60 + +p.second)) * 1000;
  } catch { return null; }
}
const textoVirada = (ms) => { const m = Math.ceil(ms / 60e3); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };

// ---------- DOM ----------
function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat(Infinity)) if (f != null && f !== false) el.append(f instanceof Node ? f : String(f));
  return el;
}
const NS = 'http://www.w3.org/2000/svg';
function s(tag, attrs, ...filhos) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  for (const f of filhos.flat()) if (f) el.append(f);
  return el;
}
const ICONES = {
  sino: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  alerta: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
  estrela: ['M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z'],
  ok: ['M5 12.5l4.5 4.5L19 7.5'],
  proximo: ['M5 12h14', 'M13 6l6 6-6 6'],
  info: ['M12 11v5', 'M12 7.5h.01', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'],
  coroa: ['M4 17l-1-9 5 4 4-7 4 7 5-4-1 9z', 'M4 20h16'],
  subir: ['M12 19V5', 'M6 11l6-6 6 6'],
  relogio: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2']
};
const icone = (nome, tam = 18) => s('svg', { viewBox: '0 0 24 24', width: tam, height: tam, class: 'ico', 'aria-hidden': 'true' }, ICONES[nome].map((d) => s('path', { d })));
const secao = (titulo, ...filhos) => h('section', { class: 'secao' }, h('h2', { class: 'rotulo' }, titulo), ...filhos);
const vazio = (texto) => h('p', { class: 'vazio' }, texto);
const nota = (texto) => h('p', { class: 'nota' }, texto);
const stat = (rot, val, extra = '') => h('div', { class: 'stat ' + extra }, h('span', { class: 'rot' }, rot), h('span', { class: 'val' + (extra.includes('destaque') ? ' ouro' : '') }, val));
const par = (rot, val) => h('div', { class: 'par' }, h('span', { class: 'rot' }, rot), h('span', { class: 'val' }, val));
const chave = (ligada, texto, aoMudar) => h('button', { type: 'button', class: 'chave', 'aria-pressed': String(!!ligada), onclick: aoMudar }, h('span', { class: 'trilho', 'aria-hidden': 'true' }), h('span', null, texto));

// Imagem copiada do jogo (dataURL em ctx.icones). Sem ela, um quadrado com borda na cor da raridade.
// opções: tam (px, padrão 32), raridade, selo (texto curto sobreposto no canto, ex.: refino+qualidade), alt.
function imagem(chaveIcone, ctx, { tam = 32, raridade, selo, alt } = {}) {
  const cor = COR_RARIDADE[raridade] || COR_BORDA_FORTE;
  const url = chaveIcone && ctx?.icones?.[chaveIcone];
  const base = url
    ? h('img', { class: 'img-ico', src: url, alt: alt ?? '', width: tam, height: tam, style: `border-color:${cor}` })
    : h('span', { class: 'img-ico vago', style: `width:${tam}px;height:${tam}px;border-color:${cor}`, 'aria-hidden': 'true' });
  const caixa = h('span', { class: 'img-caixa', style: `width:${tam}px;height:${tam}px` }, base);
  if (selo) caixa.append(h('span', { class: 'img-selo', style: `color:${cor}` }, selo));
  return caixa;
}

// ---------- Ficha ----------
// Quanto vale o item: a Loja do jogo (JOGO.valorVenda, tabelas públicas) e o menor preço que a Lupa viu no Mercado para a MESMA
// versão (item, qualidade e refino, sem carta: com carta é outro grupo). Só mostra números, não vende nada.
const RE_CHAVE_ITEM = /^(\d+)(!?)(?:\+(\d+))?(?:#([a-z]+\d))?~([A-Z]+)$/;
const VALIDADE_MENOR = 7 * 24 * 3600e3;
function milhar(n) {
  if (n == null) return '—';
  if (n >= 999.5e3) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '').replace('.', ',') + ' mi';      // 999.999 já é "1 mi", não "1000 mil"
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '').replace('.', ',') + ' mil';
  return inteiro(n);
}
function haQuanto(ms) {
  const m = Math.floor(ms / 60e3);
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 48 * 60 ? `há ${Math.floor(m / 60)} h` : `há ${Math.floor(m / 1440)} d`;
}
// a chave da mesma versão sem a carta, como o Mercado agrupa ("3031+4#velocidade2~B" → "3031+4~B"); null fora do formato
function chaveMercado(id) {
  const m = String(id || '').match(RE_CHAVE_ITEM);
  return m ? `${m[1]}${m[2]}${m[3] && +m[3] ? '+' + +m[3] : ''}~${m[5]}` : null;
}
// O preço de um item pelo código da tela: loja (null sem as tabelas ou com a qualidade ainda sendo sorteada, "~?") e o menor visto
// no Mercado nos últimos 7 dias (visto: { ouro, gemas, n, em } ou null). comCarta: o Mercado é o da mesma versão sem a carta.
function precoItem(it, ctx) {
  const m = String(it?.id || '').match(RE_CHAVE_ITEM);
  if (!m) return null;
  const refino = +(m[3] || 0), base = chaveMercado(it.id);
  let loja = null;
  try { loja = typeof JOGO !== 'undefined' ? JOGO.valorVenda(m[1], refino, m[5]) : null; } catch { loja = null; }
  const v = ctx?.menores?.[base];
  const visto = v && Date.now() - v.em < VALIDADE_MENOR && (v.ouro != null || v.gemas != null) ? v : null;
  return { loja, visto, comCarta: !!m[4] };
}
// Linha sob o nome: "Loja 12,5 mil · Mercado 850 mil · há 2 h" ("—" se a Lupa nunca viu a versão; sem JOGO, só o Mercado)
function textoValor(it, ctx, qtd = 1) {
  const p = precoItem(it, ctx);
  if (!p) return null;
  const n = (v) => h('span', { class: 'num' }, v), partes = [];
  if (p.loja != null) partes.push(['Loja ', n(milhar(p.loja)), qtd > 1 ? [' cada · ', n(milhar(p.loja * qtd))] : null]);
  // sem leitura do Mercado (nem a local da Lupa nem a do banco, no site) a parte do Mercado nem aparece
  if (ctx?.menores) {
    const v = p.visto;
    // item com carta: o preço é o da mesma versão SEM carta, e o texto diz isso
    partes.push(['Mercado ', !v ? '—' : n(v.ouro != null ? milhar(v.ouro) : `${inteiro(v.gemas)} gemas`), v && p.comCarta ? ' sem carta' : null, v ? [' · ', h('span', { class: 'inteiro' }, haQuanto(Date.now() - v.em))] : null]);
  }
  if (!partes.length) return null;
  return h('span', { class: 'item-valor fraco' }, partes.map((x, k) => [k ? ' · ' : '', x]));
}

// Um drop da caçada pelo texto do chat ("Gume do Infinito +2 [A]", "Escama de Dragão") → quanto o Lojista paga por um.
// A qualidade da linha de loot ainda não é a sorteada (o jogo escreve B até o servidor avaliar), então item comum conta como B;
// o lendário que cai na caçada já entra com a qualidade certa. Runa, gema e o que as tabelas não conhecem: null.
const RE_DROP = /^(.+?)(?:\s\+(\d+))?(?:\s\[([A-Z+]+)\])?$/;
function valorDrop(texto) {
  if (typeof JOGO === 'undefined') return null;
  const m = String(texto || '').trim().match(RE_DROP);
  if (!m) return null;
  try {
    const esp = JOGO.espolioPorNome?.(m[1]);
    if (esp) return { tipo: 'espolio', loja: esp.valor };
    const it = JOGO.itemPorNome?.(m[1]);
    if (it) return { tipo: 'item', loja: JOGO.valorVenda(it.id, +(m[2] || 0), JOGO.QUALIDADES[m[3]] ? m[3] : 'B') };
  } catch {}
  return null;
}
// soma de um mapa { texto do drop: quantidade } (a sessão de caçada, os materiais do relatório); semPreco conta as unidades sem valor
function valorDrops(drops) {
  const r = { total: 0, espolios: 0, itens: 0, semPreco: 0 };
  for (const [d, q] of Object.entries(drops || {})) {
    const v = valorDrop(d);
    if (v?.loja == null) { r.semPreco += q; continue; }
    r.total += v.loja * q;
    r[v.tipo === 'espolio' ? 'espolios' : 'itens'] += v.loja * q;
  }
  return r;
}

function linhaItem(it, ctx, tam = 40, qtd = 1) {
  const selo = [it.refino || '+0', it.qual || '?'].join(' ');
  return h('div', { class: 'item' },
    imagem(it.nome, ctx, { tam, raridade: it.raridade, selo: tam >= 40 ? selo : null }),
    h('span', { class: 'item-texto' },
      h('span', { class: 'item-nome' }, qtd > 1 ? `${qtd}× ` : '', it.nome || 'Item sem dica (passe o mouse nele no jogo)'),
      h('span', { class: 'item-sub' }, tam >= 40 ? (it.carta || 'sem carta') : `${selo} · ${it.carta || 'sem carta'}`),
      textoValor(it, ctx, qtd)),
    null);
}

// Pilha de espólio da mochila: { id, nome, qtd, cada }. Vale o preço das tabelas (exato); o da dica do jogo (cada) fica para o
// espólio que as tabelas ainda não conhecem, porque a dica arredonda de 10 mil para cima ("75.0k")
const cadaEspolio = (x) => (typeof JOGO !== 'undefined' ? JOGO.valorEspolio?.(x.id) : null) ?? x.cada ?? null;
function linhaEspolio(x, ctx) {
  const cada = cadaEspolio(x);
  return h('div', { class: 'item' },
    imagem(x.nome, ctx, { tam: 28 }),
    h('span', { class: 'item-texto' },
      h('span', { class: 'item-nome' }, `${inteiro(x.qtd)}× ${x.nome}`),
      h('span', { class: 'item-sub' }, 'espólio: só serve para vender'),
      cada != null ? h('span', { class: 'item-valor fraco' }, 'Loja ', h('span', { class: 'num' }, milhar(cada)), ' cada · ', h('span', { class: 'num' }, milhar(cada * x.qtd))) : null),
    null);
}

// A mochila inteira: o total no Lojista (itens e espólios) e o dos itens pelo menor preço visto no Mercado, depois os itens
// iguais juntos (do mais caro para o mais barato na Loja) e as pilhas de espólio. Só soma o que a tela mostra: não vende nada.
function secaoMochila(e, ctx) {
  const f = e.ficha, oc = e.mochila;
  const grupos = new Map();
  for (const it of f.mochila || []) { const k = it.id || it.nome; const g = grupos.get(k); if (g) g.qtd++; else grupos.set(k, { it, qtd: 1, p: precoItem(it, ctx) }); }
  // do que mais vale no Lojista para o que menos vale; os sem preço vão para o fim, os mais numerosos primeiro
  const itens = [...grupos.values()].sort((a, b) => (b.p?.loja != null) - (a.p?.loja != null) || (b.p?.loja ?? 0) * b.qtd - (a.p?.loja ?? 0) * a.qtd || b.qtd - a.qtd);
  const esp = (f.espolios || []).map((x) => ({ x, total: (cadaEspolio(x) ?? 0) * x.qtd })).sort((a, b) => b.total - a.total);
  if (!itens.length && !esp.length) return null;
  const somaItens = itens.reduce((s0, g) => s0 + (g.p?.loja ?? 0) * g.qtd, 0), somaEsp = esp.reduce((s0, y) => s0 + y.total, 0);
  // "~?" no código: o servidor ainda está sorteando a qualidade, e o Lojista não compra até sair
  const comMercado = itens.filter((g) => g.p?.visto?.ouro != null), avaliando = itens.filter((g) => /~\?$/.test(g.it.id || '')).reduce((s0, g) => s0 + g.qtd, 0);
  // item que as tabelas não conhecem (mais novo que o dados-jogo.js) não soma no Lojista: o detalhe diz quantos ficaram de fora
  const semPreco = typeof JOGO === 'undefined' ? 0 : itens.filter((g) => g.p?.loja == null && !/~\?$/.test(g.it.id || '')).reduce((s0, g) => s0 + g.qtd, 0);
  const mercado = comMercado.reduce((s0, g) => s0 + g.p.visto.ouro * g.qtd, 0), nItens = itens.reduce((s0, g) => s0 + g.qtd, 0);
  const temLoja = typeof JOGO !== 'undefined' || esp.some((y) => y.x.cada != null);
  const titulo = `Mochila${oc?.total ? ` · ${oc.usados}/${oc.total}` : ''}`;
  const detalhe = [itens.length ? `itens ${milhar(somaItens)}` : null, esp.length ? `espólios ${milhar(somaEsp)}` : null, avaliando ? `${avaliando} sendo avaliado${avaliando > 1 ? 's' : ''} (sem preço ainda)` : null,
    semPreco ? `${semPreco} sem preço nas tabelas (não somado${semPreco > 1 ? 's' : ''})` : null].filter(Boolean).join(' · ');
  return secao(titulo,
    temLoja ? h('div', { class: 'valor-mochila' },
      h('div', { class: 'grade-2' },
        stat('Vale no Lojista', milhar(somaItens + somaEsp), 'grande destaque'),
        ctx?.menores && itens.length ? stat('Itens no Mercado', comMercado.length ? milhar(mercado) : '—', 'grande') : null),
      detalhe ? h('span', { class: 'fraco valor-detalhe' }, detalhe) : null,
      ctx?.menores && itens.length ? h('span', { class: 'fraco valor-detalhe' }, comMercado.length
        ? `Mercado: menor preço visto da mesma versão (${comMercado.reduce((s0, g) => s0 + g.qtd, 0)} de ${nItens} ${nItens > 1 ? 'itens' : 'item'}). Espólio não vai ao Mercado.`
        : 'Mercado: nenhum destes itens visto nos últimos 7 dias (abra o Mercado no jogo, aba Comprar).') : null) : null,
    itens.map((g) => linhaItem(g.it, ctx, 28, g.qtd)),
    esp.map((y) => linhaEspolio(y.x, ctx)));
}

let planoAberto = false;
// Cartão do plano pessoal (LUPA_PLANOS[e.nome]). Sem plano: devolve null.
function desenharPlano(e, ctx, { compacto = true } = {}) {
  const plano = typeof LUPA_PLANOS !== 'undefined' ? LUPA_PLANOS[e.nome] : null;
  if (!plano || typeof avaliarPlano !== 'function') return null;
  const linhas = avaliarPlano(e, plano);
  if (!linhas.length) return null;
  const pend = linhas.filter((l) => l.estado !== 'ok'), oks = linhas.filter((l) => l.estado === 'ok');
  const tudo = !compacto || planoAberto;
  let mostrar = tudo ? linhas : pend.slice(0, 3);
  const extra = [];
  if (!tudo && pend.length < 3 && oks.length) extra.push({ estado: 'ok', texto: pend.length ? `${oks.length} de ${linhas.length} em dia` : `Tudo em dia (${oks.length} de ${linhas.length})`, resumo: true });
  mostrar = mostrar.concat(extra);
  const ico = { ok: 'ok', proximo: 'proximo', aviso: 'info' };
  const escondidas = !tudo && (pend.length > 3 || (oks.length && !extra.length) || (pend.length === 3 && oks.length));
  return h('section', { class: 'cartao plano', 'aria-label': 'Seu plano' },
    h('h2', { class: 'rotulo' }, `Seu plano · ${plano.campeao || e.nome}`),
    h('ul', { class: 'plano-lista' }, mostrar.map((l) => h('li', { class: 'plano-linha ' + l.estado + (l.resumo ? ' resumo' : '') },
      h('span', { class: 'plano-ico' }, icone(ico[l.estado] || 'info', 16)), h('span', null, l.texto)))),
    compacto && (planoAberto || escondidas) ? h('button', { type: 'button', class: 'botao plano-ver', 'aria-expanded': String(planoAberto), onclick: () => { planoAberto = !planoAberto; ctx.redesenhar(); } }, planoAberto ? 'Recolher' : 'Ver detalhes') : null);
}

function avisoMochila(e) {
  const m = e.mochila;
  if (!m || !m.total || m.usados / m.total < 0.9) return null;
  return h('div', { class: 'alerta fora', role: 'alert' }, icone('alerta', 20),
    h('span', null, `Mochila ${m.usados}/${m.total}: ${m.usados >= m.total ? 'cheia' : 'quase cheia'}. Venda ou desmanche antes que itens fiquem no chão.`));
}

// opts.semPlano: a Central já mostra o plano completo ao lado, então a ficha não repete o resumo
function desenharFicha(e, ctx, opts = {}) {
  const f = e.ficha;
  if (!f) return vazio('Não consegui ler a ficha nesta versão do jogo.');
  const ranks = Object.fromEntries((f.habs || []).map((x) => [x.t, x]));
  const barra = f.barra.length ? f.barra : [null, null, null, null];
  const fora = (f.habs || []).filter((x) => !x.naBarra && x.rank && !x.rank.startsWith('0/'));
  const st = f.stats || {};
  const stats = [
    ...(f.atributos || []).filter((a) => a.valor && a.valor !== '0').map((a) => [a.nome, a.valor]),
    ['Dano', st.dano], ['Poder de hab.', st.poderHab], ['Vel. ataque', st.velAtaque], ['Crítico', st.critico],
    ['Dano crítico', st.danoCritico], ['Recarga', st.recarga], ['Esquiva', st.esquiva], ['Armadura', st.armadura], ['Res. mágica', st.resMagica], ['Poder', st.poder]
  ].filter(([, v]) => v);
  return h('div', { class: 'pilha' },
    opts.semPlano ? null : desenharPlano(e, ctx, { compacto: true }),
    avisoMochila(e),
    secao('Equipamento', f.equip.length ? f.equip.map((i) => linhaItem(i, ctx, 40)) : vazio('Nenhum item equipado.')),
    secao('Barra de combate',
      h('div', { class: 'grade-4' }, barra.map((b) => (!b ? h('div', { class: 'hab vaga' }, 'vazia') : h('div', { class: 'hab', title: b.nome },
        h('span', { class: 'tecla' + (b.tecla && b.tecla !== b.t ? ' troca' : '') }, b.tecla ? `tecla ${b.tecla}` : 'sem tecla'),
        ctx.icones?.['hab:' + b.t] ? imagem('hab:' + b.t, ctx, { tam: 32 }) : null,
        h('span', { class: 'letra' }, b.t),
        h('span', { class: 'hab-nome' }, b.nome),
        h('span', { class: 'rank' }, ranks[b.t]?.rank || ''))))),
      fora.length ? nota('Fora da barra: ' + fora.map((x) => `${x.t} ${x.rank}${x.passiva ? ' (passiva)' : ''} · ${x.nome}`).join(' — ')) : null),
    secao('Atributos e ficha', stats.length ? h('div', { class: 'grade-3' }, stats.map(([r, v]) => stat(r, v))) : vazio('Abra a aba Atributos no jogo uma vez para a Lupa ler.')),
    secaoMochila(e, ctx),
    (f.cartas.length || f.cartasMisteriosas) ? secao('Cartas guardadas', h('ul', { class: 'lista-simples' },
      f.cartasMisteriosas ? h('li', { class: 'com-img' }, imagem('Carta misteriosa', ctx, { tam: 24 }), `${f.cartasMisteriosas}× Carta misteriosa`) : null,
      f.cartas.map((c) => h('li', { class: 'com-img' }, imagem(c.nome, ctx, { tam: 24 }), `${c.qtd}× ${c.nome}`)))) : null);
}

// ---------- barra de XP do nível ----------
// Nível atual → próximo, barra e "~N min no ritmo atual" (XP que falta ÷ XP/h da sessão atual).
function barraXp(e, ctx) {
  const x = e?.xpNivel;
  if (!x || !x.total) return null;
  const falta = Math.max(0, x.total - x.atual), pct = Math.min(100, (100 * x.atual) / x.total);
  const sessao = ctx?.cacadas?.[e.nome]?.sessoes?.at(-1);
  const ativa = sessao && Date.now() - (sessao.ultimoAbate || sessao.fim) < PAUSA;
  const xph = ativa ? porHora(ctx.semBonus ? sessao.xpBase : sessao.xp, sessao.seg) : null;
  const nivel = parseInt(e.nivel, 10);
  const rotulo = isNaN(nivel) ? 'Próximo nível' : `Nível ${nivel} → ${nivel + 1}`;
  const min = xph > 0 ? Math.max(1, Math.round((falta / xph) * 60)) : 0;
  const prazo = min >= 60 ? `~${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `~${min} min`;
  const resto = xph > 0 ? `faltam ${curto(falta)} XP · ${prazo} no ritmo atual` : `faltam ${curto(falta)} XP`;
  return h('div', { class: 'xp', role: 'group', 'aria-label': `${rotulo}: ${resto}` },
    h('div', { class: 'xp-linha' }, h('span', null, rotulo), h('span', { class: 'num fraco' }, `${Math.floor(pct)}%`)),
    h('div', { class: 'progresso', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.floor(pct)) }, h('i', { style: `width:${pct}%` })),
    h('span', { class: 'xp-resto' }, resto));
}

// ---------- Caçada ----------
const zonaPrincipal = (sessao) => Object.entries(sessao.zonas || {}).sort((a, b) => b[1].seg - a[1].seg)[0]?.[0] || '';

let serieGrafico = 'xp';   // 'xp' | 'abates': qual série o gráfico da caçada mostra (uma de cada vez, sem dois eixos)
function grafico(sessao, campoXp, ativa, ctx) {
  const baldes = (sessao.baldes || []).filter((b) => !(ativa && b.t + BALDE > Date.now())).slice(-24);
  if (baldes.length < 2) return nota('O gráfico aparece depois de uns 10 minutos de caçada.');
  const abates = serieGrafico === 'abates', campo = abates ? 'abates' : campoXp, nomeSerie = abates ? 'Abates' : 'XP';
  const val = (b) => b[campo] || 0, fmt = abates ? inteiro : curto;
  const max = Math.max(...baldes.map(val)) || 1, passo = 320 / (baldes.length - 1);
  const pontos = baldes.map((b, k) => `${(k * passo).toFixed(1)},${(66 - (val(b) / max) * 60).toFixed(1)}`).join(' ');
  const trocas = baldes.map((b, k) => (k && b.zona !== baldes[k - 1].zona ? k : null)).filter((k) => k != null);
  const media = baldes.reduce((t, b) => t + val(b), 0) / baldes.length;
  return h('div', { class: 'cartao grafico' },
    h('div', { class: 'linha-topo' },
      h('span', { class: 'fraco', style: 'font-size:13px' }, `${nomeSerie} a cada 5 min`),
      h('div', { class: 'segmento mini-seg', role: 'group', 'aria-label': 'Série do gráfico' },
        [['xp', 'XP'], ['abates', 'Abates']].map(([id, nome]) => h('button', { type: 'button', 'aria-pressed': String(serieGrafico === id), onclick: () => { serieGrafico = id; ctx?.redesenhar?.(); } }, nome)))),
    s('svg', { viewBox: '0 0 320 70', preserveAspectRatio: 'none', role: 'img', 'aria-label': `${nomeSerie} a cada 5 minutos: média de ${fmt(media)}, máximo de ${fmt(max)}` },
      trocas.map((k) => s('line', { class: 'guia', x1: k * passo, y1: 0, x2: k * passo, y2: 70 })),
      s('polyline', { class: 'linha', points: pontos })),
    h('div', { class: 'eixo' }, h('span', null, hora(baldes[0].t)), h('span', null, `média ${fmt(media)} · máx. ${fmt(max)}`), h('span', null, hora(baldes.at(-1).t + BALDE))),
    trocas.length ? nota(trocas.map((k) => `${baldes[k - 1].zona} → ${baldes[k].zona} às ${hora(baldes[k].t)}`).join(' · ')) : null);
}

function exportarCsv(nome, sessoes) {
  const dec = (v, d = 0) => (v == null ? '' : v.toFixed(d).replace('.', ','));
  const iso = (ts) => new Date(ts).toLocaleString('pt-BR');
  const linhas = [['inicio', 'fim', 'minutos_cacando', 'zona_principal', 'abates', 'xp', 'xp_sem_live', 'ouro', 'mortes', 'abates_por_h', 'xp_por_h', 'ouro_por_h', 'drops_no_lojista', 'drops_no_lojista_por_h'].join(';')];
  for (const x of sessoes) {
    const vd = valorDrops(x.drops).total;
    linhas.push([iso(x.ini), iso(x.fim), dec(x.seg / 60, 1), zonaPrincipal(x), x.abates, Math.round(x.xp), Math.round(x.xpBase), Math.round(x.ouro), x.mortes,
      dec(porHora(x.abates, x.seg)), dec(porHora(x.xp, x.seg)), dec(porHora(x.ouro, x.seg)), Math.round(vd), dec(porHora(vd, x.seg))].join(';'));
  }
  const url = URL.createObjectURL(new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: `lupa-${nome}-cacadas.csv` });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function desenharCacada(e, ctx) {
  const semBonus = !!ctx.semBonus, config = ctx.config;
  const sessoes = ctx.cacadas[e.nome]?.sessoes || [], x = sessoes.at(-1);
  if (!x) return vazio('Ainda não há caçada registrada para este personagem. Os números aparecem depois do primeiro abate com a Lupa ligada.');
  const ativa = Date.now() - (x.ultimoAbate || x.fim) < PAUSA, campo = semBonus ? 'xpBase' : 'xp';
  const zonas = Object.entries(x.zonas || {}).filter(([, z]) => z.seg >= 30 || z.abates).sort((a, b) => b[1].seg - a[1].seg);
  // o que caiu, do que mais vale no Lojista para o que menos vale (sem preço: no fim, os mais numerosos primeiro)
  const vd = valorDrops(x.drops);
  const drops = Object.entries(x.drops || {}).map(([n, q]) => ({ n, q, v: valorDrop(n)?.loja ?? null }))
    .sort((a, b) => (b.v != null) - (a.v != null) || (b.v ?? 0) * b.q - (a.v ?? 0) * a.q || b.q - a.q).slice(0, 8);
  const anteriores = sessoes.slice(0, -1).slice(-5).reverse();
  // melhor zona por XP/h: só entre as que têm 2 min para a taxa valer, e se houver mais de uma para comparar
  const taxaZona = (z) => (z.seg >= 120 ? porHora(z[campo], z.seg) : null);
  const candidatas = zonas.filter(([, z]) => taxaZona(z) > 0);
  const melhor = candidatas.length >= 2 ? candidatas.reduce((m, c) => (taxaZona(c[1]) > taxaZona(m[1]) ? c : m))[0] : null;
  const novaDe = Math.max(config.novaSessao || 0, config.novaSessaoPor?.[e.nome] || 0);
  return h('div', { class: 'pilha' },
    h('div', { class: 'linha-topo' },
      h('b', null, `${ativa ? 'Sessão atual' : `Última sessão (até ${hora(x.fim)})`} · ${duracao(x.seg)} caçando`),
      h('span', { class: 'pilula' }, 'não zera ao recarregar')),
    h('div', { class: 'segmento' },
      h('button', { type: 'button', 'aria-pressed': String(!semBonus), onclick: () => ctx.setSemBonus(false) }, 'Com bônus'),
      h('button', { type: 'button', 'aria-pressed': String(semBonus), onclick: () => ctx.setSemBonus(true) }, 'Sem bônus de live')),
    h('div', { class: 'grade-3' },
      stat('Abates/h', ouTraco(porHora(x.abates, x.seg), inteiro), 'grande'),
      stat('XP/h', ouTraco(porHora(x[campo], x.seg)), 'grande destaque'),
      stat('Ouro/h', ouTraco(porHora(x.ouro, x.seg)), 'grande')),
    vd.total > 0 ? h('div', { class: 'grade-2' },
      stat('Drops no Lojista/h', ouTraco(porHora(vd.total, x.seg))),
      stat('Ouro + drops/h', ouTraco(porHora(x.ouro + vd.total, x.seg)), 'destaque')) : null,
    e.bonus && (e.bonus.xp > 1 || e.bonus.ouro > 1) ? h('p', { class: 'bonus-mult', title: 'Multiplicador somado dos bônus ativos' },
      'Bônus agora: ', [e.bonus.xp > 1 ? `XP ${mult(e.bonus.xp)}` : null, e.bonus.ouro > 1 ? `ouro ${mult(e.bonus.ouro)}` : null].filter(Boolean).join(' · ')) : null,
    nota(`${inteiro(x.abates)} abates · ${curto(x[campo])} de XP · ${curto(x.ouro)} de ouro${vd.total > 0 ? ` · drops valem ${curto(vd.total)} no Lojista` : ''} · ${x.mortes} ${x.mortes === 1 ? 'morte' : 'mortes'}`
      + (semBonus ? '. Sem bônus de live é uma estimativa: tira o bônus da Kick e da Twitch de cada abate.' : '')),
    grafico(x, campo, ativa, ctx),
    zonas.length ? secao('Por zona', h('div', { class: 'tabela' },
      ['Zona', 'Tempo', 'Abates/h', 'XP/h'].map((c) => h('span', { class: 'cab' }, c)),
      zonas.map(([nome, z]) => { const mz = nome === melhor ? ' melhor' : ''; return [h('span', { class: 'forte' + mz, title: mz ? `${nome} · melhor XP/h` : nome }, mz ? '★ ' : '', nome), h('span', { class: mz.trim() }, duracao(z.seg)),
        h('span', { class: 'num' + mz }, ouTraco(porHora(z.abates, z.seg), inteiro)), h('span', { class: 'num' + mz }, ouTraco(porHora(z[campo], z.seg)))]; }),
      melhor ? h('span', { class: 'nota tabela-nota' }, '★ melhor XP/h entre as zonas desta sessão') : null)) : null,
    drops.length ? secao(`O que caiu nesta sessão${vd.total > 0 ? ` · ${curto(vd.total)} no Lojista` : ''}`,
      h('ul', { class: 'lista-simples' }, drops.map((d) => h('li', { class: 'com-img' }, imagem(d.n.replace(/\s\[[A-Z+]+\]$/, '').replace(/\s\+\d+$/, ''), ctx, { tam: 24 }),
        h('span', { class: 'drop-nome' }, `${inteiro(d.q)}× ${d.n}`), d.v != null ? h('span', { class: 'num drop-valor' }, curto(d.v * d.q)) : null))),
      vd.total > 0 ? nota('Valor no Lojista: espólio pelo preço do jogo; item comum como qualidade B (a da linha de loot ainda não é a sorteada); lendário com a qualidade que saiu.'
        + (vd.semPreco ? ` ${inteiro(vd.semPreco)} sem preço no Lojista (runas, gemas ou itens que as tabelas ainda não conhecem) não entram na soma.` : '')) : null) : null,
    h('div', { class: 'botoes' },
      h('button', { type: 'button', class: 'botao', onclick: () => ctx.salvarConfig({ novaSessaoPor: { ...config.novaSessaoPor, [e.nome]: Date.now() } }) }, 'Nova sessão'),
      h('button', { type: 'button', class: 'botao', onclick: () => exportarCsv(e.nome, sessoes) }, 'Exportar CSV')),
    novaDe > x.ini ? nota('Uma sessão nova começa no próximo abate.') : null,
    anteriores.length ? secao('Sessões anteriores', h('div', { class: 'tabela' },
      ['Início', 'Tempo', 'Abates/h', 'XP/h'].map((c) => h('span', { class: 'cab' }, c)),
      anteriores.map((a) => [h('span', { class: 'forte', title: zonaPrincipal(a) }, `${dataHora(a.ini)} · ${zonaPrincipal(a)}`), h('span', null, duracao(a.seg)),
        h('span', { class: 'num' }, ouTraco(porHora(a.abates, a.seg), inteiro)), h('span', { class: 'num' }, ouTraco(porHora(a[campo], a.seg)))]))) : null,
    nota('Conta só o tempo caçando (com abate no último minuto), pelas linhas de loot do chat do servidor.'));
}

// ---------- Hoje ainda falta ----------
// Lista o que está pendente hoje (só o que existe nos dados) e quanto falta para virar o dia em Brasília.
function itensHoje(e) {
  const r = e.rastreio || {}, itens = [];
  if (r.login) itens.push({ ic: 'estrela', tom: 'ouro', texto: r.login.dia ? `Prêmio diário (dia ${r.login.dia}) ainda não pego` : r.login.texto || 'Prêmio diário ainda não pego' });
  for (const d of e.diarias || []) {
    if (d.pronta) itens.push({ ic: 'ok', tom: 'ouro', texto: `Entregar a diária: ${d.nome}`, sub: d.texto });
    else itens.push({ ic: 'proximo', tom: d.fora ? 'laranja' : '', texto: `Diária: ${d.nome}`, sub: d.texto });
  }
  if (r.covil?.livre) itens.push({ ic: 'info', tom: 'verde', texto: r.covil.texto || 'Covil liberado' });
  if (r.vilemaw?.ativa) itens.push({ ic: 'alerta', tom: 'laranja', texto: r.vilemaw.texto || 'Vilemaw acordada' });
  if (r.guerra) {
    const fase = { agendada: 'agendada', aberta: 'aberta', acontecendo: 'acontecendo agora' }[r.guerra.fase] || '';
    itens.push({ ic: 'coroa', tom: r.guerra.fase === 'acontecendo' ? 'laranja' : '', texto: r.guerra.texto || `Guerra de Guildas ${fase}`.trim() });
  }
  return itens;
}

function cartaoHoje(e) {
  const ms = msAteViradaDia(), virada = ms == null ? '' : `vira o dia em ${textoVirada(ms)}`;
  // o que o jogo mostrava na última leitura: de antes da meia-noite já não vale para hoje, e velha diz de quando é
  const lidoEm = e.ts || 0, inicioHoje = ms == null ? 0 : Date.now() + ms - 24 * 3600e3;
  if (lidoEm && lidoEm < inicioHoje) return h('section', { class: 'cartao hoje vazio-hoje', 'aria-label': 'Hoje ainda falta' },
    icone('info', 16), h('span', null, 'Sem leitura hoje', h('span', { class: 'fraco' }, ` · a última foi em ${new Date(lidoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`)));
  const velha = lidoEm && Date.now() - lidoEm > 10 * 60e3 ? `leitura das ${hora(lidoEm)}` : '';
  const itens = itensHoje(e), detalhe = [velha, virada].filter(Boolean).join(' · ');
  if (!itens.length) return h('section', { class: 'cartao hoje vazio-hoje', 'aria-label': 'Hoje ainda falta' },
    icone('ok', 16), h('span', null, 'Nada pendente hoje', detalhe ? h('span', { class: 'fraco' }, ` · ${detalhe}`) : null));
  return h('section', { class: 'cartao hoje', 'aria-label': 'Hoje ainda falta' },
    h('div', { class: 'linha-topo' }, h('h2', { class: 'rotulo' }, 'Hoje ainda falta'), detalhe ? h('span', { class: 'fraco hoje-virada' }, detalhe) : null),
    h('ul', { class: 'plano-lista' }, itens.map((i) => h('li', { class: 'plano-linha hoje-' + (i.tom || 'neutro') },
      h('span', { class: 'plano-ico' }, icone(i.ic, 16)),
      h('span', null, i.texto, i.sub ? h('span', { class: 'hoje-sub' }, i.sub) : null)))));
}

// ---------- Tarefa ----------
// opts.semHoje: a Central põe o cartão "Hoje ainda falta" em outro lugar
function desenharTarefa(e, ctx, opts = {}) {
  const t = e.tarefa, partes = [];
  if (!opts.semHoje) partes.push(cartaoHoje(e));
  if (!t) partes.push(vazio('Nenhuma tarefa ativa. Pegue uma com o Capitão da Legião, na Fonte.'));
  else {
    if (t.pronta) partes.push(h('div', { class: 'alerta pronta', role: 'status' }, icone('estrela', 20), h('span', null, 'Tarefa pronta! Volte à Fonte e fale com o Capitão da Legião.')));
    else if (t.cacandoFora) partes.push(h('div', { class: 'alerta fora', role: 'alert' }, icone('alerta', 20), h('span', null, `Esses abates não contam para a tarefa. Zona da tarefa: ${t.local} · você está em: ${t.zona}.`)));
    const pct = t.qtd ? Math.min(100, (100 * t.feitos) / t.qtd) : t.pronta ? 100 : 0;
    const ritmo = t.pronta ? 'concluída'
      : t.ritmo ? `≈ ${Math.max(1, Math.round(t.eta))} min (${t.ritmo.toFixed(1).replace('.', ',')} abates/min)`
      : t.naZona ? 'medindo o ritmo…' : 'parada: você não está na zona';
    partes.push(h('div', { class: 'cartao' },
      h('div', { class: 'linha-topo', style: 'justify-content:flex-start' },
        t.local ? h('span', { class: 'pilula neutra' }, t.local) : null,
        h('span', { style: `font-size:12.5px;color:${t.naZona ? 'var(--verde)' : 'var(--laranja)'}` }, t.naZona ? 'você está aqui' : `você está em ${t.zona || '?'}`)),
      h('span', { class: 'titulo-tarefa' }, t.titulo),
      t.qtd ? h('div', { class: 'secao' },
        h('div', { class: 'progresso' + (t.naZona ? '' : ' parada') }, h('i', { style: `width:${pct}%` })),
        h('div', { class: 'linha-topo' }, h('span', { class: 'num' }, `${inteiro(t.feitos)} / ${inteiro(t.qtd)} abates`), h('span', { class: 'num fraco' }, `${Math.floor(pct)}%`))) : null,
      t.pronta ? nota(t.dica) : h('div', { class: 'grade-2' },
        par('Faltam', t.faltam != null ? `${inteiro(t.faltam)} abates` : '—'),
        par('Termina por volta de', t.eta != null ? hora(Date.now() + t.eta * 60e3) : '—'),
        h('div', { style: 'grid-column:1/-1' }, par('No ritmo atual', ritmo)))));
  }
  if (e.diarias?.length) partes.push(secao('Missões diárias', e.diarias.map((d) => h('div', { class: 'cartao', style: 'gap:2px' },
    h('b', null, d.nome), h('span', { class: d.fora ? '' : 'fraco', style: d.fora ? 'color:var(--laranja);font-size:13px' : 'font-size:13px' }, d.texto)))));
  partes.push(chave(ctx.config.avisos.tarefa, 'Avisar quando a tarefa ficar pronta, faltar 5 min ou eu caçar fora da zona', () => ctx.alternarAviso('tarefa')));
  return h('div', { class: 'pilha' }, partes);
}

// ---------- Timers ----------
function desenharTimers(e, ctx) {
  const t = e.timers, avisos = ctx.config.avisos;
  if (!t) return vazio('Não consegui ler os bônus nesta versão do jogo.');
  const v = t.voto;
  const linhas = [
    { nome: 'Bônus da Kick', detalhe: t.kick.ativo ? 'ativo' : t.kick.oferta ? `desligado · rende ${t.kick.oferta}` : 'desligado', valor: t.kick.ativo ? t.kick.texto : '—', ativo: t.kick.ativo, sino: 'kick', fala: 'quando acabar' },
    { nome: 'Bônus da Twitch', detalhe: t.twitch.ativo ? 'ativo (enquanto assiste)' : t.twitch.oferta ? `desligado · rende ${t.twitch.oferta}` : 'desligado', valor: t.twitch.ativo ? t.twitch.texto : '—', ativo: t.twitch.ativo, sino: 'twitch', fala: 'quando acabar' },
    { nome: 'Voto no TopIdle', detalhe: !v ? 'sem informação ainda' : v.estado === 'ativo' ? `bônus ativo ${v.bonus ? '· ' + v.bonus.split('·')[0].trim() : ''}` : v.estado === 'espera' ? 'vota de novo em' : 'pode votar agora',
      valor: !v ? '—' : v.estado === 'pode' ? 'agora' : v.texto, ativo: v?.estado === 'pode' || v?.estado === 'ativo', sino: 'voto', fala: 'quando liberar' },
    { nome: 'Evento de XP', detalhe: t.evento || 'nenhum agora', valor: t.evento ? 'ativo' : '—', ativo: !!t.evento, sino: 'evento', fala: 'quando começar' },
    { nome: 'Convites da Dungeon', detalhe: t.convites?.detalhe || '', valor: (t.convites?.titulo || '—').replace(/ Convites? da Dungeon/, ''), ativo: false, sino: 'convites', fala: 'quando ganhar um' },
    { nome: 'Bônus da guilda', detalhe: '1% por membro online, até 4%', valor: t.guilda || '—', ativo: !!t.guilda },
    { nome: 'VIP', detalhe: t.vip?.dica || '', valor: (t.vip?.texto || '—').replace(/^VIP\s*/, '').replace(/^(\d+)d$/, (_, n) => `${n} ${n === '1' ? 'dia' : 'dias'}`) || 'sem VIP', ativo: false }
  ];
  // buffs novos: só aparecem enquanto ativos (texto vazio = inativo)
  for (const [k, nome, detalhe] of [['barao', 'Bônus do Barão', 'Barão Nashor derrotado'], ['guerra', 'Bônus da Guerra ×2', 'prêmio da Guerra de Guildas'], ['lojaXp', 'Loja: bônus de XP', ''], ['lojaOuro', 'Loja: bônus de ouro', ''], ['disciplina', 'Disciplina', '']]) {
    if (t[k]) linhas.push({ nome, detalhe, valor: t[k], ativo: true });
  }
  const r = e.rastreio || {}, info = [], fases = { agendada: 'agendada', aberta: 'aberta', acontecendo: 'acontecendo agora' };
  if (r.guerra) info.push({ nome: r.guerra.texto || 'Guerra de Guildas', detalhe: fases[r.guerra.fase] || '', valor: '', ativo: r.guerra.fase !== 'agendada', extra: r.guerra.pronto === true ? 'pronto' : r.guerra.pronto === false ? 'não pronto' : '' });
  if (r.vilemaw) info.push({ nome: r.vilemaw.texto || 'Vilemaw', detalhe: '', valor: '', ativo: !!r.vilemaw.ativa });
  if (r.covil) info.push({ nome: r.covil.texto || 'Covil', detalhe: '', valor: '', ativo: !!r.covil.livre });
  for (const c of r.chaves || []) info.push({ nome: `Chave: ${c.nome}`, detalhe: c.acabando ? 'acabando' : '', valor: c.resta || '—', ativo: false, alerta: !!c.acabando });
  if (r.sorteio) info.push({ nome: r.sorteio.texto || 'Sorteio', detalhe: r.sorteio.participando ? '' : 'você não entrou', valor: '', ativo: !!r.sorteio.participando });
  if (r.caveira) info.push({ nome: r.caveira.texto || 'Caveira', detalhe: '', valor: '', ativo: false, alerta: !!r.caveira.vermelha });
  const reinicio = r.reinicio ? h('div', { class: 'alerta ' + (r.reinicio.urgente ? 'fora' : 'pronta'), role: r.reinicio.urgente ? 'alert' : 'status' }, icone('relogio', 20),
    h('span', null, h('b', null, 'Reinício do servidor'), ' · ', r.reinicio.texto)) : null;
  return h('div', { class: 'pilha' },
    reinicio,
    h('div', { class: 'secao' }, linhas.map((l) => h('div', { class: 'timer' },
      h('div', { class: 'meio' }, h('b', null, l.nome), l.detalhe ? h('span', null, l.detalhe) : null),
      h('span', { class: 'valor' + (l.ativo ? ' ativo' : '') }, l.valor),
      l.sino ? h('button', { type: 'button', class: 'sino', 'aria-pressed': String(!!avisos[l.sino]), 'aria-label': `${avisos[l.sino] ? 'Desligar' : 'Ligar'} aviso ${l.fala}: ${l.nome}`, title: `Avisar ${l.fala}`, onclick: () => ctx.alternarAviso(l.sino) }, icone('sino', 20))
        : h('span', { class: 'sem-sino' })))),
    info.length ? secao('No jogo agora', info.map((l) => h('div', { class: 'timer' },
      h('div', { class: 'meio' }, h('b', { class: l.alerta ? 'perigo' : '' }, l.nome), l.detalhe ? h('span', null, l.detalhe) : null),
      l.extra ? h('span', { class: 'pilula' + (l.extra === 'pronto' ? '' : ' neutra') }, l.extra) : null,
      l.valor ? h('span', { class: 'valor longo' + (l.ativo ? ' ativo' : '') + (l.alerta ? ' perigo' : '') }, l.valor) : null))) : null,
    nota('O sino avisa por notificação do navegador. A Lupa não renova bônus nem clica em nada.'));
}

// ---------- Chat ----------
function desenharChat(e, ctx) {
  const r = e.recentes || { abates: 0 };
  const desde = r.desde && Date.now() - r.desde < r.minutos * 60e3 - 30e3 ? `desde ${hora(r.desde)}` : `últimos ${r.minutos} min`;
  return h('div', { class: 'pilha' },
    chave(ctx.config.esconderLoot, 'Esconder as linhas de loot no chat do jogo (aba Servidor)', () => ctx.salvarConfig({ esconderLoot: !ctx.config.esconderLoot })),
    h('div', { class: 'cartao' },
      h('span', { class: 'rotulo' }, `Resumo do loot · ${desde}`),
      r.abates ? [h('div', { class: 'grade-3' }, stat('Abates', inteiro(r.abates)), stat('XP', curto(r.xp)), stat('Ouro', curto(r.ouro))),
        r.drops?.length ? h('ul', { class: 'lista-simples' }, r.drops.map(([n, q]) => h('li', { class: 'com-img' }, imagem(n, ctx, { tam: 24 }), `${n} ×${q}`))) : null]
        : nota('Nenhum abate desde que a página abriu.')),
    secao('Mensagens do servidor (sem o loot)', e.chat?.length
      ? h('div', { class: 'msgs' }, [...e.chat].reverse().map((m) => h('p', { class: 'msg ' + (m.tipo || '') }, h('span', { class: 'hora' }, m.hora), m.texto)))
      : vazio('Nenhuma mensagem ainda.')));
}

// ---------- Feed de eventos ----------
// drops = itens e lendários; alertas = o que pede atenção; o chefe derrotado só aparece em "tudo"
const TIPOS_DROP = ['drop', 'lendario'], TIPOS_INFO = ['drop', 'lendario', 'chefe'];
const ICONE_EVENTO = { chefe: 'coroa', morte: 'alerta', chao: 'alerta', pontos: 'proximo', nivel: 'subir', tarefa: 'estrela', bonus: 'relogio' };
// eventos: lista { ts, tipo, titulo, texto, item?, raridade?, qual? } (qualquer ordem). filtro: 'tudo' | 'drops' | 'alertas'.
function desenharFeed(eventos, ctx, { limite = 30, filtro = 'tudo' } = {}) {
  // o lendário já vira um evento próprio: o drop do mesmo item, no mesmo instante, não repete
  const lendarios = (eventos || []).filter((v) => v.tipo === 'lendario' && v.item);
  const repetido = (v) => v.tipo === 'drop' && lendarios.some((l) => l.item === v.item && Math.abs(l.ts - v.ts) < 10e3);
  const lista = [...(eventos || [])]
    .filter((v) => !repetido(v))
    .filter((v) => filtro === 'tudo' || (filtro === 'drops' ? TIPOS_DROP.includes(v.tipo) : !TIPOS_INFO.includes(v.tipo)))
    .sort((a, b) => b.ts - a.ts).slice(0, limite);
  if (!lista.length) return vazio(filtro === 'drops' ? 'Nenhum drop registrado ainda.' : filtro === 'alertas' ? 'Nenhum alerta registrado ainda.' : 'Nenhum evento registrado ainda.');
  return h('ul', { class: 'feed' }, lista.map((v) => h('li', { class: 'feed-item ' + (v.tipo || '') },
    v.item ? imagem(v.item, ctx, { tam: 32, raridade: v.raridade }) : h('span', { class: 'feed-ico' }, icone(ICONE_EVENTO[v.tipo] || 'info', 20)),
    h('span', { class: 'feed-texto' },
      h('span', { class: 'feed-titulo' }, v.titulo || v.tipo),
      v.texto ? h('span', { class: 'feed-sub' }, v.texto) : null),
    h('span', { class: 'feed-hora num fraco' }, hora(v.ts)))));
}
