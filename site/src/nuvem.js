// Lupa Online · base do site: login, barra de abas e leitura do banco (Supabase).
// Os dados chegam da Lupa no PC de casa (envio.js). O site só lê; a única coisa que ele grava é o plano (aba Guia).
// Script clássico, funções globais, junto com o ui.js da Lupa (h, s, icone, curto, inteiro, hora, dataHora...).
'use strict';

var LUPA_PLANOS = {};        // o mesmo formato do planos.js, lido da tabela planos
var LUPA_NOTAS = {};         // notas do guia por personagem
const SB = supabase.createClient(LUPA_CONFIG.url, LUPA_CONFIG.chave);
const PAGINAS = [['agora.html', 'Agora'], ['relatorio.html', 'Relatório'], ['guia.html', 'Guia'], ['farm.html', 'Farm'], ['loja.html', 'Loja'], ['roteiros/', 'Roteiros']];
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
      h('button', { type: 'button', class: 'botao', onclick: sair }, 'Sair'))));
  vigiarAvisos();
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
  setInterval(() => conferir().catch(() => {}), 30e3);
  document.addEventListener('visibilitychange', marcarVistos);
}

// ---------- peças das páginas ----------
function chips(rotulo, opcoes, atual, escolher) {
  return h('div', { class: 'chips', role: 'group', 'aria-label': rotulo },
    opcoes.map(([v, nome]) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === atual), onclick: () => escolher(v) }, nome)));
}
// colunas: [{ t, num }]; linhas: [{ celulas: [...], classe }]
function tabela(colunas, linhas, rotulo) {
  return h('div', { class: 'st-box', role: 'region', 'aria-label': rotulo, tabindex: '0' },
    h('table', { class: 'st-tabela' },
      h('thead', null, h('tr', null, colunas.map((c) => h('th', { scope: 'col', class: c.num ? 'num' : null }, c.t)))),
      h('tbody', null, linhas.map((l) => h('tr', { class: l.classe || null }, l.celulas.map((v, i) => h('td', { class: colunas[i]?.num ? 'num' : null }, v)))))));
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
const sessaoDe = (r) => ({
  personagem: r.personagem, ini: Date.parse(r.inicio), fim: Date.parse(r.fim), ultimoAbate: r.ultimo_abate ? Date.parse(r.ultimo_abate) : 0,
  seg: Number(r.segundos) || 0, abates: r.abates, xp: Number(r.xp), xpBase: Number(r.xp_base), ouro: Number(r.ouro), mortes: r.mortes,
  nivel: r.nivel_fim, zonas: r.zonas || {}, baldes: r.baldes || [], drops: r.drops || {}
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
    const d = await todas(() => SB.from('cacadas').select('*').gte('fim', iso(desde)).order('inicio'));
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
  async pulsos(desde) {
    const d = await todas(() => SB.from('pulsos').select('personagem,em,nivel,zona,cacando').gte('em', iso(desde)).order('em'));
    return d.map((r) => ({ ...r, ts: Date.parse(r.em) }));
  },
  async primeiroPulso() {
    const { data } = await SB.from('pulsos').select('em').order('em').limit(1);
    return data?.[0] ? Date.parse(data[0].em) : null;
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
const precoMoeda = (v, moeda) => (moeda === 'orbs' ? `${inteiro(v)} 💠` : precoTxt(v));
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
  const historico = (chave) => leituras.map((l) => {
    const g = (l.grupos || []).find((x) => x.chave === chave);
    return g ? { lidoEm: l.lidoEm, ouro: g.ouro, n: g.n } : null;
  }).filter(Boolean).reverse();
  return { porChave, historico, ultima: leituras[0] || null, ultimaCompleta: leituras.find((l) => l.completa) || null };
}
const semZeros = (x) => x.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('.', ',');
const precoTxt = (v) => (v == null ? '—' : v >= 1e6 ? semZeros((v / 1e6).toFixed(v >= 1e7 ? 1 : 2)) + ' mi' : v >= 1e3 ? semZeros((v / 1e3).toFixed(1)) + ' mil' : inteiro(v));
