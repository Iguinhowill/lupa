// Lupa Online · Agora: roda o central.js da Lupa com um storage que vem do banco.
// O central.js usa LUPA_API no lugar do chrome; aqui ele lê as mesmas chaves (estado:, cacada:, eventos:, icones, mercado:menores)
// montadas a partir das tabelas, relidas a cada 30 s. A config (modo, filtros) fica no localStorage deste navegador.
'use strict';

globalThis.LUPA_LIMITE_VELHO = 4 * 60e3;      // a Lupa envia a cada minuto: só fica "sem leitura" depois de 4 min
globalThis.LUPA_CAP_EVENTOS = 300;      // o banco tem 2 dias de eventos: guarda mais que os 80 da Lupa, para os lendários do dia
globalThis.LUPA_TEXTO_VAZIO = 'Nenhuma leitura ainda. No PC de casa, entre no Lupa Online em Lupa → Ajustes.';

(() => {
  const cache = {}, ouvintes = [], CONFIG = 'lo-config-central';
  try { const c = JSON.parse(localStorage.getItem(CONFIG) || 'null'); if (c) cache.config = c; } catch {}
  let comIcones = false;

  // grava no cache e avisa o central.js só do que mudou de verdade
  function trocar(novo) {
    const mud = {};
    for (const [k, v] of Object.entries(novo)) {
      if (JSON.stringify(cache[k]) === JSON.stringify(v)) continue;
      cache[k] = v; mud[k] = { newValue: v };
    }
    if (Object.keys(mud).length) for (const f of ouvintes) try { f(mud, 'local'); } catch {}
  }

  // a sessão que ainda corre (lida a cada 30 s) no lugar da mesma sessão (mesmo início) que veio na leitura de 3 dias
  function juntarSessoes(base, recentes) {
    const iniciosNovos = new Set(recentes.map((x) => x.ini));
    return { ...base, sessoes: [...(base?.sessoes || []).filter((x) => !iniciosNovos.has(x.ini)), ...recentes].sort((a, b) => a.ini - b.ini) };
  }

  // Estados e as sessões dos últimos 10 min (leves) a cada 30 s: o "Caçando" depende do último abate e anda junto com a
  // leitura. Caçadas de 3 dias, eventos, planos e ícones (pesados) a cada 2 min. Os eventos `chefe` (centenas por dia)
  // ficam de fora da consulta, salvo os mais recentes, para não soterrar os drops no feed.
  let ultimoPesado = 0;
  async function ler(pesado) {
    const agora = Date.now();
    const [estados, cacadas, recentes, eventos, icones] = await Promise.all([
      Nuvem.estados(),
      pesado ? Nuvem.cacadas(agora - 3 * DIA) : null,
      pesado ? null : Nuvem.cacadas(agora - 10 * 60e3),
      pesado ? Nuvem.eventosFeed(agora - 2 * DIA) : null,
      pesado && !comIcones ? Nuvem.icones() : null,
      pesado ? Nuvem.planos() : null
    ]);
    const novo = {};
    for (const [n, e] of Object.entries(estados)) novo['estado:' + n] = e;
    if (cacadas) for (const [n, c] of Object.entries(cacadas)) novo['cacada:' + n] = c;
    if (recentes) for (const [n, c] of Object.entries(recentes)) novo['cacada:' + n] = juntarSessoes(cache['cacada:' + n], c.sessoes);
    if (eventos) {
      const porNome = {};
      for (const ev of eventos) (porNome[ev.personagem] ||= []).push({ ts: ev.ts, tipo: ev.tipo, titulo: ev.titulo, texto: ev.texto, item: ev.item, qual: ev.qual, raridade: ev.raridade });
      for (const [n, l] of Object.entries(porNome)) novo['eventos:' + n] = l.slice(-LUPA_CAP_EVENTOS);
    }
    if (icones) { novo.icones = icones; comIcones = true; }
    // o Mercado da Ficha: o menor preço visto de cada item equipado ou na mochila (se a consulta falhar, a Ficha fica só com a Loja)
    if (pesado) {
      const chaves = [...new Set(Object.values(estados).flatMap((e) => [...(e.ficha?.equip || []), ...(e.ficha?.mochila || [])]).map((i) => chaveMercado(i.id)).filter(Boolean))];
      try { novo['mercado:menores'] = await Nuvem.menores(chaves); } catch {}
    }
    if (pesado) ultimoPesado = agora;
    trocar(novo);
  }

  globalThis.LUPA_API = {
    storage: {
      local: {
        get: async () => { await pronto; return { ...cache }; },
        set: async (obj) => {
          if ('config' in obj) try { localStorage.setItem(CONFIG, JSON.stringify(obj.config)); } catch {}
          trocar(obj);
        }
      },
      onChanged: { addListener: (f) => ouvintes.push(f) }
    },
    runtime: { getURL: (p) => p }
  };

  const pronto = exigirLogin().then(() => { montarNav(); return ler(true); })
    .catch((e) => { document.getElementById('quem').textContent = 'não deu para ler o banco: ' + (e?.message || e); });
  // aba escondida: nenhuma consulta, salvo com a mini janela aberta (ela fica por cima do jogo com a aba atrás, e a aba
  // atrás de outra janela também conta como escondida); ao voltar, relê na hora (e o pesado só se já passaram 2 min)
  const miniAberta = () => !!globalThis.documentPictureInPicture?.window;
  const reler = () => { if (!document.hidden || miniAberta()) ler(Date.now() - ultimoPesado >= 115e3).catch(() => {}); };
  setInterval(reler, 30e3);
  document.addEventListener('visibilitychange', reler);
  setInterval(() => { comIcones = false; }, 10 * 60e3);      // ícones novos entram a cada 10 min
})();
