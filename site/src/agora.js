// Lupa Online · Agora: roda o central.js da Lupa com um storage que vem do banco.
// O central.js usa LUPA_API no lugar do chrome; aqui ele lê as mesmas chaves (estado:, cacada:, eventos:, icones)
// montadas a partir das tabelas, relidas a cada 30 s. A config (modo, filtros) fica no localStorage deste navegador.
'use strict';

globalThis.LUPA_LIMITE_VELHO = 4 * 60e3;      // a Lupa envia a cada minuto: só fica "sem leitura" depois de 4 min
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

  // Estados (leve) a cada 30 s; caçadas, eventos, planos e ícones (pesados) a cada 2 min. Os eventos `chefe` (centenas
  // por dia) ficam de fora da consulta, salvo os mais recentes, para não soterrar os drops no feed.
  let ultimoPesado = 0;
  async function ler(pesado) {
    const agora = Date.now();
    const [estados, cacadas, eventos, icones] = await Promise.all([
      Nuvem.estados(),
      pesado ? Nuvem.cacadas(agora - 3 * DIA) : null,
      pesado ? Nuvem.eventosFeed(agora - 2 * DIA) : null,
      pesado && !comIcones ? Nuvem.icones() : null,
      pesado ? Nuvem.planos() : null
    ]);
    const novo = {};
    for (const [n, e] of Object.entries(estados)) novo['estado:' + n] = e;
    if (cacadas) for (const [n, c] of Object.entries(cacadas)) novo['cacada:' + n] = c;
    if (eventos) {
      const porNome = {};
      for (const ev of eventos) (porNome[ev.personagem] ||= []).push({ ts: ev.ts, tipo: ev.tipo, titulo: ev.titulo, texto: ev.texto, item: ev.item, qual: ev.qual, raridade: ev.raridade });
      for (const [n, l] of Object.entries(porNome)) novo['eventos:' + n] = l.slice(-80);
    }
    if (icones) { novo.icones = icones; comIcones = true; }
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
  // aba escondida: nenhuma consulta; ao voltar, relê na hora (e o pesado só se já passaram 2 min)
  const reler = () => { if (!document.hidden) ler(Date.now() - ultimoPesado >= 115e3).catch(() => {}); };
  setInterval(reler, 30e3);
  document.addEventListener('visibilitychange', reler);
  setInterval(() => { comIcones = false; }, 10 * 60e3);      // ícones novos entram a cada 10 min
})();
