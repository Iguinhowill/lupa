// Lupa · envio para o Lupa Online (o seu banco no Supabase)
// Pega o que a Lupa já guardou no chrome.storage (estado, eventos, caçada, Mercado, ícones) e grava nas tabelas da
// sua conta, para consultar de outro computador. Só fala com o seu banco: nunca com o servidor do jogo.
// Sem estado em memória: as marcas do que já foi enviado ficam em "nuvem:marcas", então o service worker pode morrer
// a qualquer hora e o próximo envio continua de onde parou. O alarme de 1 min cobre a fila quando a internet cai.
'use strict';

const NUVEM = {
  url: 'https://ledowohvumzufzvvtnji.supabase.co',
  chave: 'sb_publishable_nD_ZBhD3crU-YzzYMv0y3g_T9jK7Y59',      // chave pública: quem protege os dados é o login + RLS
  site: 'https://lupa-online.vercel.app'
};
const PULSO = 5 * 60e3, FRESCO = 3 * 60e3, CACANDO = 2 * 60e3;

const iso = (ts) => new Date(ts).toISOString();
const inteiro = (n) => Math.round(Number(n) || 0);
const numeroDe = (s) => { const m = String(s ?? '').match(/\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; };

// ---------- status (o painel mostra) e sessão (nunca vai para a tela) ----------
async function lerChave(k) { try { return (await chrome.storage.local.get(k))[k]; } catch { return undefined; } }
async function nuvemStatus(mud) {
  const atual = (await lerChave('nuvem:status')) || {};
  await chrome.storage.local.set({ 'nuvem:status': { ...atual, ...mud } });
}

async function nuvemAuth(tipo, corpo) {
  const r = await fetch(`${NUVEM.url}/auth/v1/token?grant_type=${tipo}`, {
    method: 'POST', headers: { apikey: NUVEM.chave, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error_description || j.msg || j.message || `erro ${r.status}`); e.status = r.status; throw e; }
  return { access: j.access_token, refresh: j.refresh_token, expira: Date.now() + (j.expires_in || 3600) * 1000, uid: j.user?.id, email: j.user?.email };
}

async function nuvemEntrar(email, senha) {
  const s = await nuvemAuth('password', { email, password: senha });
  await chrome.storage.local.set({ 'nuvem:sessao': s });
  await nuvemStatus({ conectado: true, email: s.email, site: NUVEM.site, erro: '' });
  nuvemEnviar();
}

async function nuvemSair() {
  await chrome.storage.local.remove(['nuvem:sessao', 'nuvem:marcas']);
  await nuvemStatus({ conectado: false, erro: '', ultimoEnvio: 0 });
}

// devolve a sessão com o token válido (renova 5 min antes de vencer); só desconecta se o servidor recusar a renovação
async function nuvemSessao() {
  let s = await lerChave('nuvem:sessao');
  if (!s) return null;
  if (Date.now() < s.expira - 5 * 60e3) return s;
  try {
    s = { ...s, ...(await nuvemAuth('refresh_token', { refresh_token: s.refresh })) };
    await chrome.storage.local.set({ 'nuvem:sessao': s });
    return s;
  } catch (e) {
    if (e.status >= 400 && e.status < 500) {
      await chrome.storage.local.remove('nuvem:sessao');
      await nuvemStatus({ conectado: false, erro: 'O login venceu: entre de novo em Ajustes.' });
      return null;
    }
    throw e;
  }
}

// sem conflito: inserção simples
async function gravar(s, tabela, linhas, conflito, modo) {
  if (!linhas.length) return;
  const r = await fetch(`${NUVEM.url}/rest/v1/${tabela}${conflito ? '?on_conflict=' + conflito : ''}`, {
    method: 'POST',
    headers: { apikey: NUVEM.chave, Authorization: `Bearer ${s.access}`, 'Content-Type': 'application/json', Prefer: (modo ? `resolution=${modo},` : '') + 'return=minimal' },
    body: JSON.stringify(linhas)
  });
  if (!r.ok) throw new Error(`${tabela}: ${r.status} ${(await r.text()).slice(0, 160)}`);
}

async function lerTabela(s, caminho) {
  const r = await fetch(`${NUVEM.url}/rest/v1/${caminho}`, { headers: { apikey: NUVEM.chave, Authorization: `Bearer ${s.access}` } });
  if (!r.ok) throw new Error(`${caminho.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

// muda só as colunas dadas nas linhas que o filtro (PostgREST, ex.: "chave=eq.x") acha
async function corrigir(s, tabela, filtro, mud) {
  const r = await fetch(`${NUVEM.url}/rest/v1/${tabela}?${filtro}`, {
    method: 'PATCH',
    headers: { apikey: NUVEM.chave, Authorization: `Bearer ${s.access}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(mud)
  });
  if (!r.ok) throw new Error(`${tabela}: ${r.status} ${(await r.text()).slice(0, 160)}`);
}

// ---------- o envio ----------
// chave estável de um evento: o mesmo evento reenviado cai no "unique (dono, chave)" e é ignorado. A qualidade não
// entra: ela chega depois do drop (até a 0.4.0 entrava, e o banco converte as chaves antigas num gatilho)
function chavesEventos(nome, lista) {
  const vistos = new Map();
  return lista.map((ev) => {
    const base = [nome, ev.ts, ev.tipo, ev.titulo].join('|'), k = vistos.get(base) || 0;
    vistos.set(base, k + 1);
    return { ev, chave: base + '|' + k };
  });
}
function linhasEventos(s, nome, pares, desde, zona, agora) {
  return pares.filter(({ ev }) => ev.ts >= desde).map(({ ev, chave }) => ({
    dono: s.uid, personagem: nome, em: iso(ev.ts), tipo: ev.tipo, titulo: ev.titulo || null, texto: ev.texto || null,
    item: ev.item || null, qual: ev.qual || null, raridade: ev.raridade || null,
    zona: agora - ev.ts < CACANDO ? zona || null : null, chave
  }));
}

// ---------- alertas de preço ----------
// Liberados pelo Brunox (26/10/2026): só avisar; comprar é sempre na mão. A lista "Quero comprar" vem do site. Com o
// Mercado aberto em casa o jogo atualiza a janela a cada 30 s, a Lupa lê a tela, e aqui cada alerta é conferido com a
// leitura mais nova: avisa quando a oferta mais barata que atende fica abaixo do preço, e de novo só se ela cair mais
// ou se sumir e outra aparecer.
const RE_CHAVE = /^(\d+)(!?)(?:\+(\d+))?(?:#([a-z]+\d))?~([A-Z]+)$/;
const QUALS = ['C', 'B', 'A', 'S', 'SS'];
function atende(a, g) {
  if (a.alvo.startsWith('gema:')) return g.chave === a.alvo;
  const x = String(g.chave).match(RE_CHAVE);
  return !!x && x[1] === a.alvo && QUALS.indexOf(x[5]) >= QUALS.indexOf(a.qual_min || 'C') && +(x[3] || 0) >= a.refino_min && !(a.so_sem_carta && x[4]);
}

// "Gume do Infinito A+3 por 850k (alvo 900k)"
const abrevia = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? +(n / 1e3).toFixed(1) + 'k' : n.toLocaleString('pt-BR'));
function textoAlerta(v) {
  const x = String(v.chave).match(RE_CHAVE), versao = x ? ` ${x[5]}${x[3] ? '+' + x[3] : ''}` : '', un = v.moeda === 'orbs' ? ' orbs' : '';
  return `${v.nome}${versao} por ${abrevia(v.preco)}${un} (alvo ${abrevia(v.preco_max)}${un})`;
}

async function conferirAlertas(s, merc, m, agora) {
  const alertas = await lerTabela(s, 'alertas?ativo=eq.true&select=id,alvo,preco_max,moeda,qual_min,refino_min,so_sem_carta,menor,visto_em');
  const avisos = [], abaixo = {};
  for (const a of alertas) {
    const preco = (g) => (a.moeda === 'orbs' ? g.gemas : g.ouro);
    const melhor = merc.grupos.filter((g) => preco(g) != null && atende(a, g)).sort((x, y) => preco(x) - preco(y))[0];
    if (!melhor && !merc.completa) continue;      // com filtro na tela, não dá para dizer que não está à venda
    const p = melhor ? preco(melhor) : null, antes = m.alertas[a.id] ?? null;
    abaixo[a.id] = p != null && p <= a.preco_max ? p : null;
    if (abaixo[a.id] != null && (antes == null || p < antes)) {
      avisos.push({ dono: s.uid, alerta_id: a.id, em: iso(merc.lidoEm), nome: melhor.nome, chave: melhor.chave, preco: p, moeda: a.moeda, preco_max: a.preco_max, n: melhor.n });
    }
    const menor = melhor ? { chave: melhor.chave, nome: melhor.nome, preco: p, n: melhor.n, lidoEm: merc.lidoEm } : null;
    const mudou = [menor?.chave, menor?.preco, menor?.n].join('|') !== [a.menor?.chave, a.menor?.preco, a.menor?.n].join('|');
    if (mudou || agora - Date.parse(a.visto_em || 0) > 5 * 60e3) await corrigir(s, 'alertas', 'id=eq.' + a.id, { menor, visto_em: iso(agora) });
  }
  await gravar(s, 'avisos', avisos);
  for (const v of avisos) {      // o aviso nativo, só dos novos (o lupaAvisar vem do background ou do app)
    try { if (typeof lupaAvisar === 'function') lupaAvisar('preco:' + v.alerta_id, 'Alerta de preço', textoAlerta(v)); } catch {}
  }
  Object.assign(m.alertas, abaixo);      // só depois do aviso gravado: se falhar, avisa na próxima
}

function linhaCacada(s, nome, x, nivel) {
  return {
    dono: s.uid, personagem: nome, inicio: iso(x.ini), fim: iso(x.fim), ultimo_abate: x.ultimoAbate ? iso(x.ultimoAbate) : null,
    segundos: Math.round(x.seg || 0), abates: inteiro(x.abates), xp: inteiro(x.xp), xp_base: inteiro(x.xpBase), ouro: inteiro(x.ouro),
    mortes: inteiro(x.mortes), nivel_ini: x.nivelIni ?? null, nivel_fim: nivel, zonas: x.zonas || {}, baldes: x.baldes || [], drops: x.drops || {}
  };
}

// a última conta pronta do Onde gastar o ouro, só com o que o cartão desenha (sem o texto de erro, que pode ter caminhos do PC)
const CAMPOS_GASTO = ['v', 'em', 'nivel', 'zona', 'campeao', 'ouro', 'equip', 'sim', 'testadas', 'conferidas'];
const CAMPOS_LINHA = ['tipo', 'titulo', 'detalhe', 'custo', 'custoP90', 'ganho', 'erro', 'xpH', 'ouroH', 'horas', 'mortesH'];
const soCampos = (o, lista) => Object.fromEntries(lista.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
function gastoParaNuvem(g) {
  if (!Array.isArray(g?.opcoes)) return null;
  return { ...soCampos(g, CAMPOS_GASTO), estado: 'pronto', base: soCampos(g.base, ['abatesH', 'mortesH', 'economia']),
    opcoes: g.opcoes.map((l) => soCampos(l, CAMPOS_LINHA)), semGanho: (g.semGanho || []).map((l) => soCampos(l, CAMPOS_LINHA)) };
}

// a última conta pronta dos Pontos e barra, só com o que o cartão desenha
const CAMPOS_TREINO = ['v', 'em', 'nivel', 'zona', 'campeao', 'livres', 'barraAtual', 'sim'];
const CAMPOS_LINHA_TREINO = ['parte', 'titulo', 'nivel', 'ganho', 'erro', 'rende', 'xpH', 'ouroH', 'mortesH'];
function treinoParaNuvem(g) {
  if (!g?.assinatura || !(g.habilidade || g.atributo || g.barra)) return null;
  const parte = (p) => (p ? { ...soCampos(p, ['nivel', 'pontos', 'testadas']), opcoes: (p.opcoes || []).map((l) => soCampos(l, CAMPOS_LINHA_TREINO)) } : null);
  return { ...soCampos(g, CAMPOS_TREINO), estado: 'pronto', habilidade: parte(g.habilidade), atributo: parte(g.atributo), barra: parte(g.barra) };
}

async function enviarTudo() {
  const s = await nuvemSessao();
  if (!s) return;
  const tudo = await chrome.storage.local.get(null), agora = Date.now();
  const m = { estado: {}, eventos: {}, avaliados: {}, cacada: {}, pulso: {}, mercado: 0, mercadoEm: 0, alertas: {}, alertasEm: 0, icones: [], planos: false, ...(tudo['nuvem:marcas'] || {}) };
  const marcar = () => chrome.storage.local.set({ 'nuvem:marcas': m });
  const estados = Object.keys(tudo).filter((k) => k.startsWith('estado:')).map((k) => tudo[k]).filter((e) => e?.nome);
  try {
    // a última leitura de cada personagem, com a última conta do Onde gastar o ouro (só o app calcula: "gastar:<nome>") dentro
    m.gastar ||= {};
    const gastoDe = (e) => gastoParaNuvem(tudo['gastar:' + e.nome]), treinoDe = (e) => treinoParaNuvem(tudo['treino:' + e.nome]);
    const contaEm = (e) => Math.max(gastoDe(e)?.em || 0, treinoDe(e)?.em || 0);
    const novos = estados.filter((e) => e.ts > (m.estado[e.nome] || 0) || contaEm(e) > (m.gastar[e.nome] || 0));
    await gravar(s, 'estados', novos.map((e) => ({ dono: s.uid, personagem: e.nome, lido_em: iso(e.ts), nivel: numeroDe(e.nivel), zona: e.zona || null, dados: { ...e, gastar: gastoDe(e), treino: treinoDe(e) } })), 'dono,personagem', 'merge-duplicates');
    for (const e of novos) { m.estado[e.nome] = e.ts; m.gastar[e.nome] = contaEm(e); }

    // um pulso a cada 5 min de quem está lendo agora: o buraco entre pulsos é o tempo parado
    const pulsos = estados.filter((e) => agora - e.ts < FRESCO && agora - (m.pulso[e.nome] || 0) >= PULSO - 20e3).map((e) => {
      const ult = tudo['cacada:' + e.nome]?.sessoes?.at(-1);
      return { dono: s.uid, personagem: e.nome, em: iso(Math.floor(agora / PULSO) * PULSO), nivel: numeroDe(e.nivel), xp_pct: numeroDe(e.xpPct),
        zona: e.zona || null, cacando: !!ult && agora - (ult.ultimoAbate || 0) < CACANDO, visivel: e.visivel === 'visible' };
    });
    await gravar(s, 'pulsos', pulsos, 'dono,personagem,em', 'ignore-duplicates');
    for (const p of pulsos) m.pulso[p.personagem] = agora;

    // eventos (drops, níveis, mortes...) e sessões de caçada novas desde o último envio
    for (const e of estados) {
      const lista = tudo['eventos:' + e.nome] || [], desde = m.eventos[e.nome] || 0, pares = chavesEventos(e.nome, lista);
      if (lista.length && lista.at(-1).ts >= desde) {
        await gravar(s, 'eventos', linhasEventos(s, e.nome, pares, desde, e.zona, agora), 'dono,chave', 'ignore-duplicates');
        m.eventos[e.nome] = lista.at(-1).ts;
      }
      // qualidade avaliada depois que o drop já subiu: corrige só a coluna qual
      const avaliados = pares.filter(({ ev }) => (ev.avaliadoEm || 0) > (m.avaliados[e.nome] || 0));
      for (const { ev, chave } of avaliados) await corrigir(s, 'eventos', 'chave=eq.' + encodeURIComponent(chave), { qual: ev.qual });
      if (avaliados.length) m.avaliados[e.nome] = Math.max(...avaliados.map(({ ev }) => ev.avaliadoEm));
      const sessoes = (tudo['cacada:' + e.nome]?.sessoes || []).filter((x) => x.fim > (m.cacada[e.nome] || 0));
      if (sessoes.length) {
        await gravar(s, 'cacadas', sessoes.map((x) => linhaCacada(s, e.nome, x, numeroDe(e.nivel))), 'dono,personagem,inicio', 'merge-duplicates');
        m.cacada[e.nome] = Math.max(...sessoes.map((x) => x.fim));
      }
      await marcar();
    }

    // a última leitura do Mercado: com a janela aberta o jogo atualiza a cada 30 s, então sobe no máximo a cada 10 min
    const merc = tudo['mercado:ultimo'];
    if (merc && merc.lidoEm > m.mercado && agora - m.mercadoEm >= 10 * 60e3) {
      await gravar(s, 'mercado_leituras', [{ dono: s.uid, lido_em: iso(merc.lidoEm), personagem: merc.personagem || null, filtros: merc.filtros || {}, completa: !!merc.completa, grupos: merc.grupos || [] }], 'dono,lido_em', 'ignore-duplicates');
      m.mercado = merc.lidoEm; m.mercadoEm = agora;
    }

    // alertas de preço: só com o Mercado aberto agora na aba Comprar; a cada leitura nova e, parada, a cada 2 min
    // (pega um alerta recém-criado no site)
    const vigiando = estados.some((e) => agora - e.ts < FRESCO && e.mercado?.aba === 'comprar');
    if (merc?.grupos && vigiando && (merc.lidoEm > m.alertasEm || agora - m.alertasEm >= 2 * 60e3)) {
      await conferirAlertas(s, merc, m, agora);
      m.alertasEm = agora;
    }

    // ícones que ainda não subiram (aos poucos: cada um é uma imagem)
    const enviados = new Set(m.icones), faltam = Object.entries(tudo.icones || {}).filter(([k]) => !enviados.has(k)).slice(0, 40);
    await gravar(s, 'icones', faltam.map(([chave, url]) => ({ dono: s.uid, chave, url })), 'dono,chave', 'merge-duplicates');
    m.icones.push(...faltam.map(([k]) => k));

    // os planos do planos.js entram uma vez; depois quem manda é o site (não sobrescreve o que foi editado lá)
    if (!m.planos && typeof LUPA_PLANOS === 'object') {
      await gravar(s, 'planos', Object.entries(LUPA_PLANOS).map(([personagem, plano]) => ({ dono: s.uid, personagem, plano })), 'dono,personagem', 'ignore-duplicates');
      m.planos = true;
    }
    await marcar();
    await nuvemStatus({ conectado: true, email: s.email, site: NUVEM.site, ultimoEnvio: Date.now(), erro: '' });
  } catch (e) {
    await marcar();
    await nuvemStatus({ erro: /Failed to fetch|NetworkError/i.test(e.message) ? 'Sem internet: envia quando voltar.' : e.message });
  }
}

// um envio por vez (o alarme e as mudanças podem chegar juntos)
let filaNuvem = Promise.resolve();
function nuvemEnviar() { filaNuvem = filaNuvem.then(enviarTudo).catch(() => {}); return filaNuvem; }

// eventos e Mercado sobem em segundos; o resto espera o alarme de 1 min
let esperaNuvem = 0;
chrome.storage.onChanged.addListener((mud, area) => {
  if (area !== 'local' || !Object.keys(mud).some((k) => k.startsWith('eventos:') || k === 'mercado:ultimo')) return;
  clearTimeout(esperaNuvem);
  esperaNuvem = setTimeout(nuvemEnviar, 5000);
});

chrome.alarms.get('lupa-nuvem').then((a) => { if (!a) chrome.alarms.create('lupa-nuvem', { periodInMinutes: 1 }); }).catch(() => {});
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'lupa-nuvem') nuvemEnviar(); });

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  if (msg?.tipo === 'nuvem-entrar') {
    nuvemEntrar(String(msg.email || '').trim(), String(msg.senha || ''))
      .then(() => responder({ ok: true }))
      .catch((e) => responder({ ok: false, erro: /Invalid login/i.test(e.message) ? 'E-mail ou senha errados.' : e.message }));
    return true;
  }
  if (msg?.tipo === 'nuvem-sair') { nuvemSair().then(() => responder({ ok: true })); return true; }
  if (msg?.tipo === 'nuvem-enviar') { nuvemEnviar().then(() => responder({ ok: true })); return true; }
});
