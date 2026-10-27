// Lupa Online · Farm: a melhor zona pelo que você mediu de verdade (sessões da aba Caçada, por zona).
// A estimativa para as zonas não medidas usa as tabelas públicas do jogo (dados-jogo.js) e a zona medida mais parecida.
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

  // ---------- estimativa das zonas que você não mediu ----------
  // Modelo simples: parte da zona MEDIDA com monstros de nível mais parecido e muda só o que as tabelas do jogo explicam.
  //   abates/h  = abates/h da base × (vida média dos monstros da base ÷ vida dos da zona)    (monstro mais gordo leva mais tempo)
  //   XP/abate  = XP/abate real da base × (XP tabelado da zona × fatorXp ÷ o mesmo da base)  (os seus bônus ficam)
  //   ouro/abate idem, com o ouro tabelado (o saque segue a mesma regra do fatorXp). Não conta caminhada nem a build.
  let verTodas = false;
  const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  const meioDe = (z) => (z.nm[0] + z.nm[1]) / 2;
  function estimar(medidas, nivel) {
    const porNome = new Map(medidas.map((t) => [t.zona, t]));
    const bases = medidas.map((t) => ({ t, z: JOGO.ZONAS.find((x) => x.nome === t.zona) })).filter((b) => b.z && b.t.abates > 0 && b.t.seg > 0);
    return JOGO.ZONAS.map((z) => {
      const nm = meioDe(z), fechada = z.nivel && nivel < z.nivel ? z.nivel : null, real = porNome.get(z.nome);
      const linha = { z, medida: !!real, faixa: z.nm[0] === z.nm[1] ? String(z.nm[0]) : `${z.nm[0]} a ${z.nm[1]}`, fechada, acima: z.faixa[0] > nivel, morrer: nm - nivel >= 5 };
      if (real) return { ...linha, abH: real.abH, xpH: real.xpH, ouroH: real.ouroH, base: real.zona };
      if (!bases.length || fechada) return { ...linha, semBase: !bases.length };
      const b = bases.reduce((m, x) => (Math.abs(meioDe(x.z) - nm) < Math.abs(meioDe(m.z) - nm) ? x : m));
      const pz = JOGO.porAbateZona(z), pb = JOGO.porAbateZona(b.z), nivB = media(b.t.niveis) || meioDe(b.z);
      const razVida = pb.hp / pz.hp, f = JOGO.fatorXp(nivel, nm), fB = JOGO.fatorXp(nivB, meioDe(b.z));
      const abH = b.t.abH * razVida;
      return { ...linha, abH, xpH: abH * (b.t.xp / b.t.abates) * ((pz.xp * f) / (pb.xp * fB)), ouroH: abH * (b.t.ouro / b.t.abates) * ((pz.ouro * f) / (pb.ouro * fB)),
        base: b.t.zona, morrer: linha.morrer || razVida < 1 / 3 };
    });
  }
  function secaoEstimativa(medidas, e, campo, rotulo, fmt) {
    const titulo = 'Estimativa para o seu nível', nivel = Number(e?.nivel);
    if (!nivel) return cartao(titulo, vazio('Ainda não sei o seu nível: a estimativa começa quando a Lupa enviar o personagem.'));
    const todasZ = estimar(medidas, nivel);
    if (todasZ.some((l) => l.semBase)) return cartao(titulo, vazio('Preciso de pelo menos uma zona medida (a partir de 0,1 h de caçada) para servir de base. Cace um pouco e volte.'));
    const dentro = todasZ.filter((l) => l.medida || (l.z.nm[1] >= nivel - 12 && l.z.nm[0] <= nivel + 15));
    const vis = [...(verTodas ? todasZ : dentro)].sort((a, b) => (b[campo] || 0) - (a[campo] || 0));
    const melhor = todasZ.filter((l) => !l.medida && !l.fechada && !l.morrer).sort((a, b) => b[campo] - a[campo])[0];
    const melhorMedida = todasZ.filter((l) => l.medida).sort((a, b) => (b[campo] || 0) - (a[campo] || 0))[0];
    const aviso = (l) => (l.fechada ? `fechada até o ${l.fechada}` : l.morrer ? 'pode morrer' : l.acima ? 'acima do nível' : '');
    const linhas = vis.map((l) => ({
      classe: l === melhor ? 'melhor' : null,
      celulas: [h('div', null, h('b', null, l.z.nome), aviso(l) ? h('span', { class: (l.morrer || l.fechada ? 'perigo' : 'fraco') + ' aviso-zona' }, aviso(l)) : null),
        l.fechada ? '—' : curto(l.xpH), l.fechada ? '—' : curto(l.ouroH), l.fechada ? '—' : inteiro(l.abH),
        h('span', { class: l.medida ? 'fonte-medida' : 'fonte-estimada', title: l.medida ? 'Medida nas suas sessões' : `Estimada a partir de ${l.base}` }, l.medida ? 'medida' : 'estimada'), l.faixa]
    }));
    const vs = melhor && melhorMedida?.[campo] ? ` (${Math.round(Math.abs(melhor[campo] / melhorMedida[campo] - 1) * 100)}% ${melhor[campo] >= melhorMedida[campo] ? 'a mais' : 'a menos'} que ${melhorMedida.z.nome}, a que você mediu)` : '';
    const resumo = melhor ? `Entre as que você não mediu, a melhor é ${melhor.z.nome}, com cerca de ${fmt(melhor[campo])} de ${rotulo}${vs}.` : 'Nenhuma zona não medida parece segura para o seu nível agora.';
    const geradoEm = Date.parse(JOGO.meta.geradoEm);
    return cartao(titulo,
      h('p', { class: 'estimativa-resumo' }, h('b', null, 'Estimativa. '), resumo),
      tabela([{ t: 'Zona' }, { t: 'XP/h', num: true }, { t: 'Ouro/h', num: true }, { t: 'Abates/h', num: true }, { t: 'Fonte' }, { t: 'Níveis dos monstros' }], linhas, 'Estimativa por zona'),
      todasZ.length > dentro.length ? h('button', { type: 'button', class: 'chave', 'aria-pressed': String(verTodas), onclick: () => { verTodas = !verTodas; desenhar(); } }, h('span', { class: 'trilho', 'aria-hidden': 'true' }), h('span', null, `Mostrar também as zonas longe do seu nível (${todasZ.length - dentro.length})`)) : null,
      nota('Como foi estimado: parte da zona que você mediu com monstros de nível parecido e escala o tempo de abate pela vida dos monstros da zona; o XP e o ouro por abate seguem as tabelas do jogo, com a perda do fatorXp (−10% por nível de diferença acima de 5) e os seus bônus de hoje. Não conta caminhada, morte nem a sua build. É só uma estimativa: confirme caçando.'),
      nota(`Tabelas do jogo de ${new Date(geradoEm).toLocaleDateString('pt-BR')}, versão ${JOGO.meta.versaoJogo || '?'}${Date.now() - geradoEm > 21 * DIA ? '. Estão velhas (mais de 21 dias): rode gerar-tabelas.mjs.' : '.'}`));
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

    const secEst = secaoEstimativa(boas.length ? boas : todas.filter((t) => t.horas >= 0.1), e, campo, rotulo, fmt);

    raiz.replaceChildren(cab, destaque || vazio(nomes.length ? 'Ainda não há 1 h de caçada medida numa zona no período.' : 'Nenhum dado ainda: entre no Lupa Online pela Lupa no PC de casa.'), secMedido, secEst);
    raiz.removeAttribute('aria-busy');
  }
  desenhar();
})();
