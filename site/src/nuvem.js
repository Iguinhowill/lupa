// Lupa Online · base do site: login, barra de abas e leitura do banco (Supabase).
// Os dados chegam da Lupa no PC de casa (envio.js). O site só lê; a única coisa que ele grava é o plano (aba Guia).
// Script clássico, funções globais, junto com o ui.js da Lupa (h, s, icone, curto, inteiro, hora, dataHora...).
'use strict';

var LUPA_PLANOS = {};        // o mesmo formato do planos.js, lido da tabela planos
var LUPA_NOTAS = {};         // notas do guia por personagem
const SB = supabase.createClient(LUPA_CONFIG.url, LUPA_CONFIG.chave);
const PAGINAS = [['agora.html', 'Agora'], ['relatorio.html', 'Relatório'], ['guia.html', 'Guia'], ['farm.html', 'Farm'], ['loja.html', 'Loja'], ['calcular.html', 'Calcular'], ['roteiros/', 'Roteiros']];
const $id = (id) => document.getElementById(id);
const iso = (ts) => new Date(ts).toISOString();
const HORA = 3600e3, DIA = 24 * HORA;
// código do item como o jogo escreve (3031!+4#velocidade2~B): id, marca, refino, carta, qualidade
const RE_CHAVE = /^(\d+)(!?)(?:\+(\d+))?(?:#([a-z]+\d))?~([A-Z]+)$/;

// ---------- login ----------
let sessaoAtual = null;
async function exigirLogin() {
  const { data } = await SB.auth.getSession();
  if (!data.session) { location.replace('index.html'); return new Promise(() => {}); }
  sessaoAtual = data.session;
  return data.session;
}
async function sair() { await SB.auth.signOut(); location.replace('index.html'); }

// ---------- barra de abas ----------
function marcaLupa(tam = 26) {
  return s('svg', { viewBox: '0 0 24 24', width: tam, height: tam, class: 'ico marca', 'aria-hidden': 'true' },
    s('circle', { cx: '10.5', cy: '10.5', r: '6.5' }), s('path', { d: 'M15.5 15.5 21 21' }));
}
function montarNav() {
  const aqui = (location.pathname.split('/').pop() || 'agora.html').replace(/\.html$/, '') || 'agora';
  document.body.prepend(h('header', { class: 'site-topo' },
    h('div', { class: 'site-linha' },
      h('a', { class: 'site-marca', href: 'agora.html' }, marcaLupa(), h('span', null, 'Lupa ', h('b', null, 'Online'))),
      h('nav', { class: 'site-abas', 'aria-label': 'Abas do site' },
        PAGINAS.map(([href, nome]) => h('a', { href, 'aria-current': href.replace('.html', '') === aqui ? 'page' : null }, nome))),
      h('div', { class: 'site-selos', id: 'site-selos', role: 'status', 'aria-label': 'Situação dos personagens' }),
      h('button', { type: 'button', class: 'botao', onclick: sair }, 'Sair'))));
  // no celular as abas rolam de lado: deixa a ativa à vista
  document.querySelector('.site-abas [aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  vigiarSelos();
  vigiarAvisos();
}

// ---------- selo de status por personagem ----------
// "caçando": última leitura há menos de 4 min e o último pulso com cacando; "parado": leitura recente sem caçar;
// "sem leitura": a Lupa de casa não envia há mais de 4 min. Consulta leve (só lido_em e os últimos pulsos), a cada 60 s,
// e para quando a aba está escondida.
const LIMITE_LEITURA = 4 * 60e3;
async function lerSelos() {
  const [est, pul] = await Promise.all([
    SB.from('estados').select('personagem,lido_em').order('personagem'),
    SB.from('pulsos').select('personagem,em,cacando').gte('em', new Date(Date.now() - 3600e3).toISOString()).order('em', { ascending: false }).limit(200)
  ]);
  if (est.error) throw est.error;
  const ultimo = {};      // o último pulso da última hora de cada personagem (uns 60 por personagem)
  for (const p of pul.data || []) ultimo[p.personagem] ||= p;
  const agora = Date.now();
  return est.data.map((e) => {
    const lido = Date.parse(e.lido_em), p = ultimo[e.personagem], pulsoEm = p ? Date.parse(p.em) : 0;
    const fresco = agora - lido < LIMITE_LEITURA;
    const estado = !fresco ? 'sem leitura' : p && p.cacando && agora - pulsoEm < 10 * 60e3 ? 'caçando' : 'parado';
    return { nome: e.personagem, estado, lido };
  });
}
function desenharSelos(lista) {
  const el = $id('site-selos');
  if (!el) return;
  el.replaceChildren(...lista.map((x) => h('span', {
    class: 'status site-selo ' + (x.estado === 'caçando' ? 'ok' : x.estado === 'sem leitura' ? 'velho' : ''),
    title: `${x.nome}: último dado às ${dataHora(x.lido)} (${x.estado})`
  }, h('span', { class: 'site-selo-nome' }, x.nome), h('b', null, x.estado))));
}
function vigiarSelos() {
  const rodar = () => { if (!document.hidden) lerSelos().then(desenharSelos).catch(() => {}); };
  rodar();
  setInterval(rodar, 60e3);
  document.addEventListener('visibilitychange', rodar);
}

// ---------- avisos de preço ----------
// Em qualquer página aberta (mesmo em segundo plano): a cada 30 s procura avisos novos que a Lupa gravou e mostra a
// notificação do navegador (se liberada), um aviso no canto da página e o número no título da aba.
const TITULO = document.title;
let avisosNaoVistos = 0;
function marcarVistos() { if (document.visibilityState === 'visible') { avisosNaoVistos = 0; document.title = TITULO; } }
function mostrarAviso(a) {
  const titulo = `${a.nome} por ${precoMoeda(a.preco, a.moeda)}`, corpo = `Abaixo do seu alvo de ${precoMoeda(a.preco_max, a.moeda)}${a.n ? ` · ${a.n} à venda` : ''}. Compre pelo Mercado no jogo.`;
  if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(titulo, { body: corpo, tag: 'aviso-' + a.id });
    n.onclick = () => { window.focus(); if (!location.pathname.endsWith('loja.html')) location.href = 'loja.html'; n.close(); };
  }
  let caixa = $id('avisos-preco');
  if (!caixa) document.body.append(caixa = h('div', { id: 'avisos-preco', class: 'avisos-preco', role: 'status', 'aria-live': 'polite' }));
  const el = h('div', { class: 'aviso-preco' }, icone('sino', 20),
    h('div', null, h('b', null, titulo), h('span', null, corpo), h('a', { href: 'loja.html' }, 'Ver na Loja')),
    h('button', { type: 'button', class: 'fechar', 'aria-label': 'Fechar aviso', onclick: () => el.remove() }, '×'));
  caixa.prepend(el);
  while (caixa.children.length > 3) caixa.lastChild.remove();
  if (document.visibilityState !== 'visible') document.title = `(${++avisosNaoVistos}) ${TITULO}`;
}
async function vigiarAvisos() {
  let ultimo = Number(lerPref('aviso-id', '0'));
  const conferir = async () => {
    const { data, error } = await SB.from('avisos').select('*').gt('id', ultimo).order('id').limit(20);
    if (error || !data.length) return;
    // na primeira vez neste navegador só marca onde parou, sem soltar os avisos antigos
    if (ultimo) data.forEach(mostrarAviso);
    ultimo = data.at(-1).id;
    gravarPref('aviso-id', String(ultimo));
  };
  if (!ultimo) { const { data } = await SB.from('avisos').select('id').order('id', { ascending: false }).limit(1); ultimo = data?.[0]?.id || -1; gravarPref('aviso-id', String(ultimo)); }
  setInterval(() => conferir().catch(() => {}), 30e3);      // também em segundo plano: é para isso que o aviso existe
  document.addEventListener('visibilitychange', () => { marcarVistos(); if (!document.hidden) conferir().catch(() => {}); });
}

// ---------- peças das páginas ----------
function chips(rotulo, opcoes, atual, escolher) {
  return h('div', { class: 'chips', role: 'group', 'aria-label': rotulo },
    opcoes.map(([v, nome]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === atual), onclick: () => escolher(v) }, nome)));
}
// colunas: [{ t, num, ordena }]; linhas: [{ celulas: [...], v: [valores para ordenar], classe }]. Coluna com `ordena` vira
// botão no cabeçalho; a ordem vale por `ordem` ({ col, dir }), que quem chama pode guardar para sobreviver ao redesenho.
// Sem `v`, ordena pelo texto da célula (número em pt-BR como texto não serve: passe `v` com o número). Vazio vai para o fim.
function tabela(colunas, linhas, rotulo, ordem = { col: -1, dir: 1 }) {
  const corpo = h('tbody'), ths = [];
  const chave = (l, i) => { const x = l.v ? l.v[i] : l.celulas[i]; return x instanceof Node ? x.textContent : x; };
  const vazioV = (x) => x == null || x === '' || x === '—' || (typeof x === 'number' && isNaN(x));
  function pintar() {
    let ls = linhas;
    if (ordem.col >= 0) {
      ls = linhas.slice().sort((a, b) => {
        const x = chave(a, ordem.col), y = chave(b, ordem.col);
        if (vazioV(x) || vazioV(y)) return vazioV(x) === vazioV(y) ? 0 : vazioV(x) ? 1 : -1;
        const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true });
        return r * ordem.dir;
      });
    }
    corpo.replaceChildren(...ls.map((l) => h('tr', { class: l.classe || null }, l.celulas.map((v, i) => h('td', { class: colunas[i]?.num ? 'num' : null }, v)))));
    ths.forEach(([th, i]) => th.setAttribute('aria-sort', ordem.col === i ? (ordem.dir > 0 ? 'ascending' : 'descending') : 'none'));
  }
  const cab = colunas.map((c, i) => {
    if (!c.ordena) return h('th', { scope: 'col', class: c.num ? 'num' : null }, c.t);
    const th = h('th', { scope: 'col', class: c.num ? 'num' : null },
      h('button', { type: 'button', class: 'ordenar', title: `Ordenar por ${c.t.toLowerCase()}`, onclick: () => {
        if (ordem.col === i) { if (ordem.dir === (c.num ? 1 : -1)) ordem.col = -1; else ordem.dir = -ordem.dir; } else { ordem.col = i; ordem.dir = c.num ? -1 : 1; }
        pintar();
      } }, c.t, h('span', { class: 'seta', 'aria-hidden': 'true' })));
    ths.push([th, i]);
    return th;
  });
  pintar();
  return h('div', { class: 'st-box', role: 'region', 'aria-label': rotulo, tabindex: '0' },
    h('table', { class: 'st-tabela' }, h('thead', null, h('tr', null, cab)), corpo));
}
const cartao = (titulo, ...filhos) => h('section', { class: 'cartao' }, h('h2', { class: 'rotulo' }, titulo), ...filhos);
const tile = (rot, val, sub) => h('div', { class: 'stat grande' }, h('span', { class: 'rot' }, rot), h('span', { class: 'val' }, val), sub ? h('span', { class: 'st-sub' }, sub) : null);
const lerPref = (k, padrao) => { try { return localStorage.getItem('lo-' + k) || padrao; } catch { return padrao; } };
const gravarPref = (k, v) => { try { localStorage.setItem('lo-' + k, v); } catch {} };
const porHoraDe = (v, seg) => (seg >= 60 ? v / (seg / 3600) : null);
const nomeCurto = (n) => [n, LUPA_PLANOS[n]?.campeao].filter(Boolean).join(' · ');

function erroNaPagina(raiz, e) {
  raiz.replaceChildren(h('div', { class: 'alerta fora', role: 'alert' }, icone('alerta', 20),
    h('span', null, 'Não deu para ler o banco: ', String(e?.message || e), '. Recarregue a página em alguns segundos.')));
}

// ---------- leitura do banco ----------
// o Supabase entrega no máximo 1000 linhas por pedido: busca em páginas
async function todas(montar, tam = 1000) {
  const out = [];
  for (let de = 0; ; de += tam) {
    const { data, error } = await montar().range(de, de + tam - 1);
    if (error) throw error;
    out.push(...data);
    if (data.length < tam) return out;
  }
}
const COLS_CACADA = 'personagem,inicio,fim,segundos,abates,xp,xp_base,ouro,mortes,nivel_ini,nivel_fim,zonas,baldes,drops,ultimo_abate';
const sessaoDe = (r) => ({
  personagem: r.personagem, ini: Date.parse(r.inicio), fim: Date.parse(r.fim), ultimoAbate: r.ultimo_abate ? Date.parse(r.ultimo_abate) : 0,
  seg: Number(r.segundos) || 0, abates: r.abates, xp: Number(r.xp), xpBase: Number(r.xp_base), ouro: Number(r.ouro), mortes: r.mortes,
  nivel: r.nivel_fim, nivelIni: r.nivel_ini ?? null, zonas: r.zonas || {}, baldes: r.baldes || [], drops: r.drops || {}
});

const Nuvem = {
  async estados() {
    const { data, error } = await SB.from('estados').select('personagem,lido_em,dados');
    if (error) throw error;
    return Object.fromEntries(data.map((r) => [r.personagem, { ...r.dados, nome: r.personagem, ts: Date.parse(r.lido_em) }]));
  },
  async planos() {
    const { data, error } = await SB.from('planos').select('personagem,plano,notas,atualizado_em');
    if (error) throw error;
    for (const r of data) { LUPA_PLANOS[r.personagem] = r.plano; LUPA_NOTAS[r.personagem] = r.notas || []; }
    return data;
  },
  async icones() {
    const d = await todas(() => SB.from('icones').select('chave,url').order('chave'));
    return Object.fromEntries(d.map((r) => [r.chave, r.url]));
  },
  // { [personagem]: { sessoes: [...] } } no formato da Lupa
  async cacadas(desde) {
    const d = await todas(() => SB.from('cacadas').select(COLS_CACADA).gte('fim', iso(desde)).order('inicio'));
    const por = {};
    for (const r of d) (por[r.personagem] ||= { sessoes: [] }).sessoes.push(sessaoDe(r));
    return por;
  },
  async eventos(desde, tipos) {
    const d = await todas(() => {
      let q = SB.from('eventos').select('personagem,em,tipo,titulo,texto,item,qual,raridade,zona').gte('em', iso(desde)).order('em');
      if (tipos) q = q.in('tipo', tipos);
      return q;
    });
    return d.map((r) => ({ ...r, ts: Date.parse(r.em) }));
  },
  // o feed da Central: tudo menos `chefe` (são ~400 por dia) e só os 8 chefes mais recentes
  async eventosFeed(desde) {
    const cols = 'personagem,em,tipo,titulo,texto,item,qual,raridade,zona';
    const [d, ch] = await Promise.all([
      todas(() => SB.from('eventos').select(cols).gte('em', iso(desde)).neq('tipo', 'chefe').order('em')),
      SB.from('eventos').select(cols).eq('tipo', 'chefe').gte('em', iso(desde)).order('em', { ascending: false }).limit(8)
    ]);
    return [...d, ...(ch.data || [])].sort((a, b) => (a.em > b.em ? 1 : -1)).map((r) => ({ ...r, ts: Date.parse(r.em) }));
  },
  async pulsos(desde) {
    const d = await todas(() => SB.from('pulsos').select('personagem,em,nivel,zona,cacando').gte('em', iso(desde)).order('em'));
    return d.map((r) => ({ ...r, ts: Date.parse(r.em) }));
  },
  async primeiroPulso() {
    const { data } = await SB.from('pulsos').select('em').order('em').limit(1);
    return data?.[0] ? Date.parse(data[0].em) : null;
  },
  // preço mínimo de uma versão ao longo do tempo, direto da view mercado_precos (uma linha por leitura)
  async historicoPreco(chave, dias = 30) {
    // as 500 mais recentes (com mais leituras que isso, o corte cai nas antigas), devolvidas em ordem de tempo
    const { data, error } = await SB.from('mercado_precos').select('lido_em,ouro,gemas,n').eq('chave', chave).gte('lido_em', iso(Date.now() - dias * DIA)).order('lido_em', { ascending: false }).limit(500);
    if (error) throw error;
    return data.reverse().map((r) => ({ ts: Date.parse(r.lido_em), ouro: r.ouro, gemas: r.gemas, n: r.n }));
  },
  async mercado(limite = 40) {
    const { data, error } = await SB.from('mercado_leituras').select('lido_em,completa,filtros,grupos,personagem').order('lido_em', { ascending: false }).limit(limite);
    if (error) throw error;
    return data.map((r) => ({ ...r, lidoEm: Date.parse(r.lido_em) }));
  },
  async alertas() {
    const { data, error } = await SB.from('alertas').select('*').order('criado_em');
    if (error) throw error;
    return data;
  },
  async avisos(limite = 15) {
    const { data, error } = await SB.from('avisos').select('*').order('id', { ascending: false }).limit(limite);
    if (error) throw error;
    return data;
  }
};

// ---------- alertas de preço ----------
const QUALS = ['C', 'B', 'A', 'S', 'SS'];
// a mesma regra do envio.js da Lupa: o item (ou a carta/runa), a qualidade e o refino mínimos e, se pedido, sem carta
function atendeAlerta(a, g) {
  if (a.alvo.startsWith('gema:')) return g.chave === a.alvo;
  const x = String(g.chave).match(RE_CHAVE);
  return !!x && x[1] === a.alvo && QUALS.indexOf(x[5]) >= QUALS.indexOf(a.qual_min || 'C') && +(x[3] || 0) >= a.refino_min && !(a.so_sem_carta && x[4]);
}
const precoMoeda = (v, moeda) => (moeda === 'orbs' ? `${inteiro(v)} gemas` : precoTxt(v));
// "1,5 mi", "800 mil", "800k", "1.500.000" ou "1500000"
function lerPreco(txt) {
  const m = String(txt).toLowerCase().replace(/\s+/g, '').replace(/ouro$/, '').match(/^([\d.,]+)(mi|m|mil|k)?$/);
  if (!m) return null;
  let n = m[1];
  if (n.includes(',')) n = n.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(n)) n = n.replace(/\./g, '');
  const v = parseFloat(n) * (m[2] === 'mi' || m[2] === 'm' ? 1e6 : m[2] ? 1e3 : 1);
  return v > 0 ? Math.round(v) : null;
}

// ---------- preços do Mercado ----------
// Para cada versão (código do jogo), o preço da leitura mais recente que a mostrou. Se uma leitura completa (sem
// filtro) mais nova não mostrou a versão, o preço antigo fica marcado: provavelmente já foi vendida.
function indicePrecos(leituras) {
  const porChave = new Map();
  let fechou = null;
  for (const l of leituras) {      // da mais nova para a mais antiga
    for (const g of l.grupos || []) {
      if (!g?.chave || porChave.has(g.chave)) continue;
      porChave.set(g.chave, { ...g, lidoEm: l.lidoEm, sumiu: fechou != null, sumiuEm: fechou });
    }
    if (l.completa && fechou == null) fechou = l.lidoEm;
  }
  return { porChave, ultima: leituras[0] || null, ultimaCompleta: leituras.find((l) => l.completa) || null };
}
const semZeros = (x) => x.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('.', ',');
const precoTxt = (v) => (v == null ? '—' : v >= 1e6 ? semZeros((v / 1e6).toFixed(v >= 1e7 ? 1 : 2)) + ' mi' : v >= 1e3 ? semZeros((v / 1e3).toFixed(1)) + ' mil' : inteiro(v));

// ---------- gráficos pequenos (SVG à mão: a CSP não deixa biblioteca de fora) ----------
// início do dia em Brasília (o fuso vem do Intl); o jogo vira o dia lá
function inicioDoDia(agora = Date.now()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(agora).map((x) => [x.type, x.value]));
  return agora - ((+p.hour * 3600 + +p.minute * 60 + +p.second) * 1000 + (agora % 1000));
}
// pontos: [{ ts, v }]. Linha, área discreta, mínimo e máximo marcados, hover com o preço e a hora.
function sparkline(pontos, { larg = 320, alt = 64, fmt = precoTxt, rotulo = 'Histórico de preço' } = {}) {
  const pts = pontos.filter((p) => p.v != null);
  if (pts.length < 2) return nota('Só uma leitura deste item no período: o histórico começa a aparecer na 2ª.');
  const t0 = pts[0].ts, t1 = pts.at(-1).ts, vmin = Math.min(...pts.map((p) => p.v)), vmax = Math.max(...pts.map((p) => p.v));
  const X = (ts) => 4 + ((ts - t0) / (t1 - t0 || 1)) * (larg - 8), Y = (v) => 6 + (vmax === vmin ? 0.5 : 1 - (v - vmin) / (vmax - vmin)) * (alt - 12);
  const linha = pts.map((p) => `${X(p.ts).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
  const pMin = pts.find((p) => p.v === vmin), pMax = pts.find((p) => p.v === vmax);
  const ponto = (p, cor) => s('circle', { cx: X(p.ts).toFixed(1), cy: Y(p.v).toFixed(1), r: 3, fill: cor });
  const svg = s('svg', { viewBox: `0 0 ${larg} ${alt}`, class: 'sparkline', role: 'img', 'aria-label': `${rotulo}: de ${fmt(vmin)} a ${fmt(vmax)}, ${pts.length} leituras` },
    s('polygon', { points: `${X(t0)},${alt - 4} ${linha} ${X(t1)},${alt - 4}`, class: 'spark-area' }),
    s('polyline', { points: linha, class: 'spark-linha', fill: 'none' }),
    ponto(pMin, '#8fd9cc'), ponto(pMax, '#f5a66b'),
    ...pts.map((p) => s('circle', { cx: X(p.ts).toFixed(1), cy: Y(p.v).toFixed(1), r: 6, fill: 'transparent' }, s('title', null, `${dataHora(p.ts)} · ${fmt(p.v)}`))));
  return h('div', { class: 'spark' }, svg,
    h('div', { class: 'spark-legenda num' }, h('span', null, dataHora(t0)), h('span', null, `mín ${fmt(vmin)} · máx ${fmt(vmax)}`), h('span', null, dataHora(t1))));
}
