// Lupa Online · Farm: a melhor zona pelo que você mediu de verdade (sessões da aba Caçada, por zona).
// A estimativa para zonas não testadas (simulação do motor) entra depois.
'use strict';

(async () => {
  await exigirLogin();
  montarNav();
  const raiz = $id('pagina');
  let quem = lerPref('farm-quem', ''), periodo = lerPref('farm-periodo', '30d'), ordem = lerPref('farm-ordem', 'xp'), poucas = false;
  const DIAS = { '7d': 7, '30d': 30, tudo: 365 };
  let estados, cac;
  try { [estados, cac] = await Promise.all([Nuvem.estados(), Nuvem.cacadas(Date.now() - 365 * DIA), Nuvem.planos()]); }
  catch (e) { erroNaPagina(raiz, e); return; }
  const nomes = [...new Set([...Object.keys(estados), ...Object.keys(cac)])].sort();
  if (!nomes.includes(quem)) quem = nomes[0] || '';

  // soma as zonas das sessões do período (sessão cortada pelo período entra proporcional ao tempo)
  function zonas(p, ini, agora) {
    const z = {};
    for (const x of cac[p]?.sessoes || []) {
      const a = Math.max(x.ini, ini), b = Math.min(x.fim, agora);
      if (b <= a) continue;
      const f = x.fim > x.ini ? (b - a) / (x.fim - x.ini) : 1;
      for (const [nome, v] of Object.entries(x.zonas || {})) {
        if (!nome || nome === '?') continue;
        const t = z[nome] ||= { zona: nome, seg: 0, abates: 0, xp: 0, xpBase: 0, ouro: 0, niveis: [] };
        t.seg += v.seg * f; t.abates += v.abates * f; t.xp += v.xp * f; t.xpBase += v.xpBase * f; t.ouro += v.ouro * f;
        if (x.nivel) t.niveis.push(x.nivel);
      }
    }
    return Object.values(z).map((t) => ({
      ...t, horas: t.seg / 3600, faixa: t.niveis.length ? [Math.min(...t.niveis), Math.max(...t.niveis)] : null,
      xpH: porHoraDe(t.xp, t.seg), ouroH: porHoraDe(t.ouro, t.seg), abH: porHoraDe(t.abates, t.seg), xpBaseH: porHoraDe(t.xpBase, t.seg)
    })).filter((t) => t.seg >= 60);
  }

  function desenhar() {
    const agora = Date.now(), ini = agora - DIAS[periodo] * DIA;
    const campo = { xp: 'xpH', ouro: 'ouroH', abates: 'abH' }[ordem], rotulo = { xp: 'XP/h', ouro: 'Ouro/h', abates: 'Abates/h' }[ordem];
    const fmt = ordem === 'abates' ? inteiro : curto;
    const todas = zonas(quem, ini, agora).sort((a, b) => (b[campo] || 0) - (a[campo] || 0));
    const boas = todas.filter((t) => t.horas >= 1), vis = poucas ? todas : boas;
    const [melhor, segunda] = boas;
    const e = estados[quem];

    const cab = h('div', { class: 'pagina-cab' },
      h('h1', null, 'Melhor área de farm', h('small', null, 'Pelo que você caçou de verdade, zona por zona.')),
      chips('Personagem', nomes.map((n) => [n, nomeCurto(n)]), quem, (v) => { quem = v; gravarPref('farm-quem', v); desenhar(); }),
      chips('Período', [['7d', '7 dias'], ['30d', '30 dias'], ['tudo', 'Tudo']], periodo, (v) => { periodo = v; gravarPref('farm-periodo', v); desenhar(); }),
      chips('Ordenar por', [['xp', 'XP/h'], ['ouro', 'Ouro/h'], ['abates', 'Abates/h']], ordem, (v) => { ordem = v; gravarPref('farm-ordem', v); desenhar(); }));

    const destaque = melhor ? h('section', { class: 'destaque', 'aria-label': 'Melhor zona' },
      h('div', { style: 'flex:1 1 320px' },
        h('span', { class: 'rotulo' }, `Melhor zona para ${nomeCurto(quem)}${e?.nivel ? ` · hoje no nível ${e.nivel}` : ''}`),
        h('span', { class: 'grande' }, melhor.zona),
        h('span', null, segunda ? `${Math.round(((melhor[campo] / segunda[campo]) - 1) * 100)}% mais ${rotulo} que ${segunda.zona}, a segunda que você mediu.` : 'A única zona com 1 h ou mais de caçada no período.')),
      h('div', { class: 'grade-tiles', style: 'flex:0 1 360px' }, tile(rotulo, fmt(melhor[campo])), tile('Medido em', duracao(melhor.seg)))) : null;

    const linhas = vis.map((t, i) => ({
      classe: t === melhor ? 'melhor' : null,
      celulas: [String(i + 1), h('b', null, t.zona), t.faixa ? (t.faixa[0] === t.faixa[1] ? String(t.faixa[0]) : `${t.faixa[0]} a ${t.faixa[1]}`) : '—',
        h('span', { class: t.horas < 1 ? 'fraco' : null }, t.horas.toFixed(1).replace('.', ',') + ' h'),
        inteiro(t.abH), curto(t.xpH), curto(t.ouroH), h('span', { class: 'fraco' }, curto(t.xpBaseH))]
    }));
    const secMedido = cartao('Medido nas suas sessões',
      linhas.length
        ? tabela([{ t: '#' }, { t: 'Zona' }, { t: 'Seus níveis lá' }, { t: 'Horas', num: true }, { t: 'Abates/h', num: true }, { t: 'XP/h', num: true }, { t: 'Ouro/h', num: true }, { t: 'XP/h sem live', num: true }], linhas, 'Zonas medidas')
        : vazio(todas.length ? 'Nenhuma zona com 1 h de caçada no período.' : 'Nenhuma caçada no período ainda.'),
      todas.length > boas.length ? h('button', { type: 'button', class: 'chave', 'aria-pressed': String(poucas), onclick: () => { poucas = !poucas; desenhar(); } }, h('span', { class: 'trilho', 'aria-hidden': 'true' }), h('span', null, `Mostrar as zonas com menos de 1 h (${todas.length - boas.length})`)) : null,
      nota('"Sem live" tira o bônus da Kick e da Twitch de cada abate, para comparar dias diferentes. Os números contam só os abates: tarefas e diárias rendem à parte. O nível é o da última leitura de cada sessão.'));

    const secEst = cartao('Zonas que você ainda não mediu',
      nota('A estimativa pela simulação do motor do jogo (com a sua build de agora, de dia e de noite, e avisando zona perigosa) é a próxima etapa do Lupa Online.'));

    raiz.replaceChildren(cab, destaque || vazio(nomes.length ? 'Ainda não há 1 h de caçada medida numa zona no período.' : 'Nenhum dado ainda: entre no Lupa Online pela Lupa no PC de casa.'), secMedido, secEst);
    raiz.removeAttribute('aria-busy');
  }
  desenhar();
})();
