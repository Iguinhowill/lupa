// Lupa · Central e mini janela
// Página larga que lê o storage e desenha com as peças de ui.js. Só leitura: não fala com o jogo nem com a rede.
'use strict';

(() => {
  // no Lupa Online (site) o storage vem do banco: o site entrega um substituto em LUPA_API
  const chrome = globalThis.LUPA_API || globalThis.chrome;
  const LIMITE_VELHO = globalThis.LUPA_LIMITE_VELHO || 60e3;
  const TEXTO_VAZIO = globalThis.LUPA_TEXTO_VAZIO || 'Abra o lolidle.com e entre no seu personagem. A Lupa começa a ler sozinha.';
  const SO_MINI = location.hash === '#mini';
  const DOC = document;

  // ---------- estado ----------
  let config = mesclarConfig(), estados = {}, cacadas = {}, eventos = {}, icones = {}, menores = {}, escolhido = null, semBonus = false;
  let gastos = {};         // "gastar:<nome>" (no app); no site a conta vem dentro do estado que o app mandou (estado.gastar)
  let treinos = {};        // "treino:<nome>" (no app); no site, estado.treino
  let filtro = 'tudo';
  let modo = null;         // 'todos' (visão geral) | 'um' | null = automático (visão geral com 2+ personagens)
  let pip = null;          // janela de documentPictureInPicture, se aberta
  let semPip = false;      // true quando a mini caiu no popup comum (não fica sempre por cima)

  function guardar(k, v) {
    if (k === 'config') config = mesclarConfig(v);
    else if (k === 'icones') icones = v || {};
    else if (k === 'mercado:menores') menores = v || {};
    else if (k.startsWith('estado:')) { if (v) estados[k.slice(7)] = v; else delete estados[k.slice(7)]; }
    else if (k.startsWith('cacada:')) { if (v) cacadas[k.slice(7)] = v; else delete cacadas[k.slice(7)]; }
    else if (k.startsWith('eventos:')) { if (v) eventos[k.slice(8)] = v; else delete eventos[k.slice(8)]; }
    else if (k.startsWith('gastar:')) { if (v) gastos[k.slice(7)] = v; else delete gastos[k.slice(7)]; }
    else if (k.startsWith('treino:')) { if (v) treinos[k.slice(7)] = v; else delete treinos[k.slice(7)]; }
  }
  // o botão Calcular do Onde gastar o ouro (só no app): o app recusou → o motivo aparece no cartão
  async function pedirGasto(nome) {
    const r = await globalThis.lupaApp.gastar(nome).catch((e) => ({ erro: String(e?.message || e) }));
    if (r?.erro) { gastos[nome] = { ...(gastos[nome] || {}), estado: 'erro', erro: r.erro }; desenhar(); }
  }
  const salvarConfig = (mud) => chrome.storage.local.set({ config: { ...config, ...mud, avisos: { ...config.avisos, ...(mud.avisos || {}) } } });
  const alternarAviso = (k) => salvarConfig({ avisos: { [k]: !config.avisos[k] } });

  const ctx = {
    get config() { return config; },
    get cacadas() { return cacadas; },
    get eventos() { return eventos; },
    get icones() { return icones; },
    get menores() { return menores; },
    get gastos() { return Object.fromEntries(Object.entries(estados).map(([n, e]) => [n, gastos[n] || e?.gastar]).filter(([, g]) => g)); },
    get treinos() { return Object.fromEntries(Object.entries(estados).map(([n, e]) => [n, treinos[n] || e?.treino]).filter(([, g]) => g)); },
    calcularGasto: typeof globalThis.lupaApp?.gastar === 'function' ? pedirGasto : null,
    get semBonus() { return semBonus; },
    setSemBonus(v) { semBonus = !!v; desenhar(); },
    salvarConfig, alternarAviso,
    redesenhar() { desenhar(); }
  };

  function atual() {
    if (escolhido && estados[escolhido]) return estados[escolhido];
    return Object.values(estados).sort((a, b) => b.ts - a.ts)[0] || null;
  }
  // quem leu nas últimas 6 h entra na visão geral; o que parou de ler aparece com o aviso, em vez de sumir
  const JANELA_GERAL = 6 * 3600e3;
  const naTabela = () => Object.values(estados).filter((x) => Date.now() - x.ts < JANELA_GERAL).sort((a, b) => a.nome.localeCompare(b.nome));
  const ladoALado = () => naTabela().length >= 2 && (modo ?? 'todos') === 'todos';
  // o campeão: o do plano; sem plano, o que as habilidades da ficha dizem (tabelas do jogo em dados-jogo.js)
  function campeaoDe(e) {
    const doPlano = globalThis.LUPA_PLANOS?.[e.nome]?.campeao;
    if (doPlano) return doPlano;
    if (typeof JOGO === 'undefined' || !e.ficha?.habs?.length) return null;
    const id = JOGO.campeaoPelasHabs(Object.fromEntries(e.ficha.habs.map((x) => [x.t, x.nome])));
    return JOGO.CAMPEOES[id]?.nome || null;
  }
  const nomeComCampeao = (e) => [e.nome, campeaoDe(e)].filter(Boolean).join(' · ');
  const chamar = (e) => campeaoDe(e) || e.nome;
  // a cor de cada personagem segue o nome, na ordem dos nomes que esta Central conhece: não muda quando um para de ler
  function corDe(nome) {
    const i = Object.keys(estados).sort((a, b) => a.localeCompare(b)).indexOf(nome);
    return `var(--p${(Math.max(0, i) % 4) + 1})`;
  }

  // ---------- status ----------
  const segundos = (ms) => Math.max(0, Math.round(ms / 1000));
  function infoStatus(e) {
    if (!e) return { classe: '', texto: 'sem leitura', curto: 'sem leitura' };
    const idade = Date.now() - e.ts;
    if (idade > LIMITE_VELHO) {
      const min = Math.max(1, Math.floor(idade / 60e3));
      return { classe: 'velho', texto: `sem leitura há ${min} min`, curto: `sem leitura há ${min} min` };
    }
    const fundo = e.visivel === 'hidden', s0 = segundos(idade);
    return { classe: 'ok', texto: `${fundo ? 'jogo rodando em segundo plano' : 'jogo na tela'} · atualizado há ${s0} s`, curto: `${fundo ? 'em segundo plano' : 'na tela'} · há ${s0} s` };
  }
  // a situação de um personagem numa palavra (caçando, parado, sem leitura) e o detalhe embaixo
  function situacao(e) {
    const idade = Date.now() - e.ts;
    if (idade > LIMITE_VELHO) return { tom: 'aviso', texto: 'Sem leitura', sub: `desde ${hora(e.ts)} · há ${duracao(idade / 1000)}` };
    const x = cacadas[e.nome]?.sessoes?.at(-1);
    const cacando = !!x && Date.now() - (x.ultimoAbate || 0) < 3 * 60e3;
    return { tom: cacando ? 'ok' : 'neutro', texto: cacando ? 'Caçando' : 'Parado', sub: `${e.visivel === 'hidden' ? 'aba escondida' : 'na tela'} · leitura há ${segundos(idade)} s` };
  }
  const sessaoAtiva = (e) => {
    const x = cacadas[e.nome]?.sessoes?.at(-1);
    return x && Date.now() - e.ts <= LIMITE_VELHO && Date.now() - (x.ultimoAbate || x.fim) < PAUSA ? x : null;
  };
  // XP de hoje (desde 00:00 de Brasília): a soma dos baldes de 5 min de todas as sessões, sem contar duas vezes o mesmo
  function xpHoje(e, campo) {
    const ms = msAteViradaDia();
    const ini = ms == null ? Date.now() - 86400e3 : Date.now() + ms - 86400e3, vistos = new Set();
    let soma = 0;
    for (const s0 of cacadas[e.nome]?.sessoes || []) for (const b of s0.baldes || []) {
      if (b.t >= ini && !vistos.has(b.t)) { vistos.add(b.t); soma += b[campo] || 0; }
    }
    return soma;
  }

  // ---------- peças pequenas ----------
  const pctTexto = (p) => `${p.toFixed(1).replace('.', ',')}%`;
  const traco = () => h('span', { class: 'vg-traco' }, '—');
  const sub = (txt) => (txt ? h('span', { class: 'vg-sub' }, txt) : null);
  // "2,30 M" → 2,30 com o M menor e em cinza
  function valor(n, f = curto) {
    if (n == null) return traco();
    const [num, un] = f(n).split(' ');
    return h('span', { class: 'num vg-v' }, num, un ? h('span', { class: 'vg-un' }, un) : null);
  }
  function pilula(tom, texto) {
    return h('span', { class: 'vg-pilula ' + tom },
      tom === 'aviso' ? icone('alerta', 14) : tom === 'ok' ? h('span', { class: 'vg-pulso', 'aria-hidden': 'true' }) : null, texto);
  }
  const barra = (pct, cor, rotulo, extra = '') => h('span', { class: 'vg-barra' + extra, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.floor(pct)), 'aria-label': rotulo },
    h('i', { style: `width:${pct}%${cor ? `;background:${cor}` : ''}` }));
  const ponto = (cor, pequeno) => h('span', { class: 'vg-ponto' + (pequeno ? ' pequeno' : ''), style: `background:${cor}`, 'aria-hidden': 'true' });
  const cabCartao = (id, titulo, meta, ...extra) => h('div', { class: 'vg-cab' }, h('h2', { id }, titulo), meta ? h('span', { class: 'vg-meta' }, meta) : null, ...extra);
  const abrirPersonagem = (nome) => { modo = 'um'; escolhido = nome; desenhar(); scrollTo?.(0, 0); };

  // ---------- visão geral: a tabela dos personagens ----------
  function tabelaPersonagens(lista) {
    const cab = [['Personagem'], ['Situação'], ['Nível'], ['Sobe'], ['XP/h', 1], ['Ouro/h', 1], ['XP hoje', 1], ['Tarefa'], ['Mochila', 1], ['Bônus de XP', 1]];
    return h('div', { class: 'vg-rolagem' }, h('table', { class: 'vg-tabela' },
      h('thead', null, h('tr', null, cab.map(([c, dir]) => h('th', { scope: 'col', class: dir ? 'dir' : null }, c)))),
      h('tbody', null, lista.map(linhaPersonagem))));
  }

  function linhaPersonagem(e) {
    const st = situacao(e), p = previsaoNivel(e, ctx), cor = corDe(e.nome), camp = campeaoDe(e), x = sessaoAtiva(e);
    const campo = semBonus ? 'xpBase' : 'xp', m = e.mochila, hoje = xpHoje(e, campo), nivel = parseInt(e.nivel, 10);
    const cel = (cls, rot, ...f) => h('td', { class: 'vg-' + cls, 'data-rot': rot }, ...f);
    return h('tr', null,
      h('th', { scope: 'row', class: 'vg-quem' }, h('span', { class: 'vg-quem-caixa' }, ponto(cor),
        h('span', null,
          h('button', { type: 'button', class: 'vg-nome', title: 'Ver tudo deste personagem', onclick: () => abrirPersonagem(e.nome) }, camp || e.nome),
          sub([camp ? e.nome : null, e.zona].filter(Boolean).join(' · '))))),
      cel('sit', 'Situação', pilula(st.tom, st.texto), sub(st.sub)),
      cel('nivel', 'Nível', h('span', { class: 'vg-niv' }, h('b', { class: 'num' }, isNaN(nivel) ? '—' : String(nivel)),
        p ? barra(p.pct, cor, `Nível ${nivel}: ${pctTexto(p.pct)}`) : null,
        p ? h('span', { class: 'num fraco' }, pctTexto(p.pct)) : null)),
      cel('sobe', 'Sobe', ...(p?.ate ? [h('b', { class: 'num vg-v' }, hora(p.ate)), sub(`em ${prazoTexto(p.min)}`)]
        : [h('span', { class: 'fraco' }, x ? 'medindo…' : 'parado'), sub(p ? `faltam ${curto(p.falta)}` : '')])),
      cel('xph dir', 'XP/h', x ? valor(ritmoRecente(x, campo)) : traco()),
      cel('ouro dir', 'Ouro/h', x ? valor(porHora(x.ouro, x.seg)) : traco()),
      cel('hoje dir', 'XP hoje', hoje ? valor(hoje) : traco()),
      cel('tarefa', 'Tarefa', ...celulaTarefa(e.tarefa, st)),
      cel('mochila dir', 'Mochila', m?.total ? h('span', { class: 'num vg-v' + (m.usados / m.total >= 0.9 ? ' vg-aviso' : '') }, String(m.usados), h('span', { class: 'vg-un' }, `/${m.total}`)) : traco()),
      cel('bonus dir', 'Bônus de XP', e.bonus?.xp ? h('span', { class: 'num' }, mult(e.bonus.xp)) : traco()));
  }

  function celulaTarefa(t, st) {
    if (!t) return [st.tom === 'aviso' ? h('span', { class: 'fraco' }, 'nenhuma') : pilula('aviso', 'Nenhuma ativa')];
    if (t.pronta) return [pilula('ok', 'Pronta para entregar')];
    if (t.cacandoFora) return [pilula('aviso', 'Fora da zona'), sub(`a tarefa é em ${t.local}`)];
    if (t.qtd) return [h('span', { class: 'num' }, `${inteiro(t.feitos)}/${inteiro(t.qtd)}`),
      sub([t.local, t.eta != null ? `~${prazoTexto(Math.max(1, Math.round(t.eta)))}` : null].filter(Boolean).join(' · '))];
    return [h('span', null, t.titulo || '—')];
  }

  // ---------- visão geral: o que pede ação no jogo ----------
  function pendencias(lista) {
    const itens = [], votoLivre = [];
    for (const e of lista) {
      const nome = chamar(e), cor = corDe(e.nome), idade = Date.now() - e.ts, t = e.tarefa, m = e.mochila;
      if (idade > LIMITE_VELHO) itens.push({ tom: 'aviso', ic: 'alerta', cores: [cor], texto: `${nome} está sem leitura desde ${hora(e.ts)}`,
        sub: globalThis.LUPA_API ? 'O jogo ou a Lupa parou no PC de casa.' : 'A aba do jogo fechou ou parou de ler.', quando: `há ${duracao(idade / 1000)}` });
      if (t?.pronta) itens.push({ tom: 'ok', ic: 'ok', cores: [cor], texto: `Tarefa do ${nome} pronta para entregar`, sub: t.dica || 'Na Fonte, fale com o Capitão da Legião.' });
      else if (t?.cacandoFora) itens.push({ tom: 'aviso', ic: 'alerta', cores: [cor], texto: `${nome} caça fora da zona da tarefa`, sub: `A tarefa é em ${t.local}; ${nome} está em ${t.zona}.` });
      else if (!t && idade <= LIMITE_VELHO && e.zona && e.zona !== 'Fonte') itens.push({ tom: 'aviso', ic: 'relogio', cores: [cor], texto: `${nome} caça sem tarefa do Capitão`, sub: 'Pegue uma na Fonte: ela paga XP e ouro a mais em cima da caçada.' });
      if (m?.total && m.usados / m.total >= 0.9) itens.push({ tom: 'aviso', ic: 'alerta', cores: [cor], texto: `Mochila do ${nome} em ${m.usados}/${m.total}`, sub: 'Venda ou desmanche antes que os itens fiquem no chão.' });
      const pts = (e.pontos?.habilidade || 0) + (e.pontos?.atributo || 0);
      if (pts > 0) itens.push({ tom: 'info', ic: 'proximo', cores: [cor], texto: `${nome} tem ${pts} ${pts === 1 ? 'ponto livre' : 'pontos livres'}`, sub: proximoDoPlano(e) });
      for (const i of itensHoje(e)) if (i.tom === 'ouro') itens.push({ tom: 'info', ic: i.ic, cores: [cor], texto: `${nome}: ${i.texto}`, sub: i.sub });
      if (e.timers?.voto?.estado === 'pode') votoLivre.push(e);
    }
    if (votoLivre.length) itens.push({ tom: 'info', ic: 'info', cores: votoLivre.map((e) => corDe(e.nome)),
      texto: `Voto no TopIdle liberado para ${juntar(votoLivre.map(chamar))}`, sub: votoLivre[0].timers.voto.texto ? `Rende ${votoLivre[0].timers.voto.texto}.` : '' });
    const ordem = { aviso: 0, ok: 1, info: 2 };
    return itens.sort((a, b) => ordem[a.tom] - ordem[b.tom]);
  }
  const juntar = (l) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l.at(-1)}`);
  function proximoDoPlano(e) {
    const plano = globalThis.LUPA_PLANOS?.[e.nome];
    if (!plano || typeof avaliarPlano !== 'function') return '';
    return avaliarPlano(e, plano).find((l) => l.estado === 'proximo')?.texto || '';
  }

  function cartaoPendencias(lista) {
    const itens = pendencias(lista);
    return h('section', { class: 'vg-cartao', 'aria-labelledby': 'vg-t-acoes' },
      cabCartao('vg-t-acoes', 'Precisa de você', itens.length ? `${itens.length} ${itens.length === 1 ? 'coisa' : 'coisas'} para fazer no jogo` : ''),
      itens.length ? itens.map((i) => h('div', { class: 'vg-acao ' + i.tom },
        h('span', { class: 'vg-acao-ico' }, icone(i.ic, 18)),
        h('span', { class: 'vg-acao-txt' }, h('span', { class: 'vg-acao-tit' }, (i.cores || []).map((c) => ponto(c, true)), h('span', null, i.texto)), sub(i.sub)),
        i.quando ? h('span', { class: 'vg-meta' }, i.quando) : h('span')))
        : h('p', { class: 'vg-nada' }, icone('ok', 16), 'Nada pendente agora.'));
  }

  // ---------- visão geral: bônus de XP lado a lado ----------
  function textoBonus(txt) {
    const [a, ...b] = String(txt).split('·').map((s0) => s0.trim());
    return h('span', null, h('span', { class: 'num' }, a), b.length ? h('span', { class: 'vg-meta' }, ` · ${b.join(' · ')}`) : null);
  }
  function cartaoBonus(lista) {
    const ev = lista.map((e) => e.timers?.evento).find(Boolean);
    const linhas = [
      ['Total', (t, e) => (e.bonus?.xp ? h('span', { class: 'num' }, mult(e.bonus.xp)) : traco()), 'total'],
      ['Kick', (t) => (t.kick?.ativo ? textoBonus(t.kick.texto) : traco())],
      ['Twitch', (t) => (t.twitch?.ativo ? textoBonus(t.twitch.texto) : traco())],
      ['Voto', (t) => (t.voto?.estado === 'pode' ? pilula('aviso', 'liberado') : t.voto?.estado === 'ativo' ? textoBonus(t.voto.bonus || 'ativo')
        : t.voto?.texto ? h('span', { class: 'vg-meta' }, `de novo em ${t.voto.texto}`) : traco())],
      ['Guilda', (t) => (t.guilda ? h('span', { class: 'num' }, t.guilda) : traco())],
      ['VIP', (t) => (t.vip?.texto ? h('span', { class: 'num' }, t.vip.texto.replace(/^VIP\s*/, '').replace(/^(\d+)d$/, (_, n) => `${n} ${n === '1' ? 'dia' : 'dias'}`)) : traco())]
    ];
    if (lista.some((e) => e.timers?.lojaXp)) linhas.push(['Loja', (t) => (t.lojaXp ? textoBonus(t.lojaXp) : traco())]);
    return h('section', { class: 'vg-cartao', 'aria-labelledby': 'vg-t-bonus' },
      cabCartao('vg-t-bonus', 'Bônus de XP', ev ? `evento: ${ev}` : 'evento de XP: nenhum agora'),
      h('div', { class: 'vg-rolagem' }, h('table', { class: 'vg-mtz' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, h('span', { class: 'so-leitor' }, 'Bônus')),
          lista.map((e) => h('th', { scope: 'col' }, h('span', { class: 'vg-mtz-quem' }, ponto(corDe(e.nome), true), chamar(e)))))),
        h('tbody', null, linhas.map(([rot, f, cls]) => h('tr', { class: cls || null }, h('th', { scope: 'row' }, rot),
          lista.map((e) => h('td', null, e.timers ? f(e.timers, e) : traco()))))))));
  }

  // ---------- visão geral: ao vivo, dos personagens juntos ----------
  const ROTULO_TIPO = { chefe: 'Chefes', nivel: 'Nível', pontos: 'Pontos', tarefa: 'Tarefa', morte: 'Morte', chao: 'No chão', bonus: 'Bônus' };
  function feedGeral(lista) {
    const todos = [];
    for (const e of lista) {
      const evs = eventos[e.nome] || [];
      const lend = evs.filter((v) => v.tipo === 'lendario' && v.item);
      // os chefes das últimas 2 h viram uma linha só ("32 chefes abatidos desde 08:07"), em vez de um por linha
      const chefes = evs.filter((v) => v.tipo === 'chefe' && Date.now() - v.ts < 2 * 3600e3);
      for (const v of evs) {
        if (v.tipo === 'chefe') continue;
        if (v.tipo === 'drop' && lend.some((l) => l.item === v.item && Math.abs(l.ts - v.ts) < 10e3)) continue;
        todos.push({ ...v, quem: e });
      }
      if (chefes.length) {
        const ts = chefes.map((c) => c.ts);
        todos.push({ ts: Math.max(...ts), tipo: 'chefe', titulo: `${chefes.length} ${chefes.length === 1 ? 'chefe abatido' : 'chefes abatidos'}`, texto: `desde ${hora(Math.min(...ts))}`, quem: e });
      }
    }
    return todos
      .filter((v) => filtro === 'tudo' || (filtro === 'drops' ? TIPOS_DROP.includes(v.tipo) : !TIPOS_INFO.includes(v.tipo)))
      .sort((a, b) => b.ts - a.ts).slice(0, 14);
  }
  function linhaFeed(v) {
    const e = v.quem;
    const tipo = v.item ? (ROTULO_RARIDADE[v.raridade] || (v.tipo === 'lendario' ? 'Lendário' : 'Drop')) : (ROTULO_TIPO[v.tipo] || 'Evento');
    const qual = v.item && v.qual ? (v.qual === '?' ? ' · sendo avaliado' : ` · ${v.qual}`) : '';
    return h('li', { class: 'vg-ev ' + (v.tipo || '') },
      h('span', { class: 'vg-ev-hora num' }, hora(v.ts)),
      h('span', { class: 'vg-ev-quem' }, ponto(corDe(e.nome), true), chamar(e)),
      h('span', { class: 'vg-ev-tipo' }, v.item ? h('span', { class: 'raridade-ponto', style: `background:${COR_RARIDADE[v.raridade] || COR_RARIDADE.lendario}`, 'aria-hidden': 'true' }) : null, tipo),
      h('span', { class: 'vg-ev-txt' },
        v.item ? imagem(v.item, ctx, { tam: 24, raridade: v.raridade }) : null,
        h('span', { class: 'vg-ev-nome' }, v.item ? [v.item, h('span', { class: 'vg-meta' }, qual)] : (v.titulo || v.tipo)),
        (v.item ? origemDrop(v) : v.texto) ? h('span', { class: 'vg-meta vg-ev-sub' }, v.item ? origemDrop(v) : v.texto) : null));
  }
  function cartaoFeed(lista) {
    const itens = feedGeral(lista);
    const vazioTxt = filtro === 'drops' ? 'Nenhum drop registrado ainda.' : filtro === 'alertas' ? 'Nenhum alerta registrado ainda.' : 'Nenhum evento registrado ainda.';
    return h('section', { class: 'vg-cartao', 'aria-labelledby': 'vg-t-feed' },
      cabCartao('vg-t-feed', 'Ao vivo', '', h('div', { class: 'vg-seg', role: 'group', 'aria-label': 'Filtrar o que aparece' },
        [['tudo', 'Tudo'], ['drops', 'Drops'], ['alertas', 'Alertas']].map(([id, nome]) => h('button', { type: 'button', 'aria-pressed': String(filtro === id), onclick: () => { filtro = id; desenhar(); } }, nome)))),
      itens.length ? h('ul', { class: 'vg-feed' }, itens.map(linhaFeed)) : h('p', { class: 'vg-nada sem-ico' }, vazioTxt));
  }

  // ---------- visão geral: lendários de hoje ----------
  const QUALS = ['SS', 'S', 'A', 'B', 'C', '?'];
  const OPAC_QUAL = { SS: 1, S: 1, A: 1, B: 0.6, C: 0.34, '?': 0.18 };
  function cartaoLendarios(lista) {
    const ms = msAteViradaDia(), ini = ms == null ? Date.now() - 86400e3 : Date.now() + ms - 86400e3;
    const linhas = lista.map((e) => {
      const por = {};
      for (const v of eventos[e.nome] || []) if (v.tipo === 'lendario' && v.ts >= ini) { const q = QUALS.includes(v.qual) ? v.qual : '?'; por[q] = (por[q] || 0) + 1; }
      return { e, por, n: Object.values(por).reduce((t, x) => t + x, 0) };
    }).sort((a, b) => b.n - a.n);
    const total = linhas.reduce((t, l) => t + l.n, 0), max = Math.max(1, ...linhas.map((l) => l.n));
    const textoQual = (por) => juntar(QUALS.filter((q) => por[q]).map((q) => `${por[q]} ${q === '?' ? 'sendo avaliados' : q}`));
    return h('section', { class: 'vg-cartao', 'aria-labelledby': 'vg-t-lend' },
      cabCartao('vg-t-lend', 'Lendários de hoje', 'desde 00:00'),
      h('div', { class: 'vg-lend' },
        h('div', { class: 'vg-lend-total' }, h('b', { class: 'num' }, String(total)), h('span', { class: 'fraco' }, total === 1 ? 'lendário hoje' : 'lendários hoje')),
        linhas.map(({ e, por, n }) => {
          const cor = corDe(e.nome);
          return h('div', { class: 'vg-lend-linha' },
            h('span', { class: 'vg-lend-quem' }, ponto(cor, true), chamar(e)),
            n ? h('span', { class: 'vg-lend-barra', role: 'img', 'aria-label': `${chamar(e)}: ${n} lendários, ${textoQual(por)}` },
              QUALS.filter((q) => por[q]).map((q) => h('span', { style: `flex:${por[q]} 0 0;background:${cor};opacity:${OPAC_QUAL[q]}` })),
              h('span', { style: `flex:${max - n} 0 0` }))
              : h('span', { class: 'vg-lend-zero', 'aria-hidden': 'true' }),
            h('span', { class: 'num vg-lend-n' + (n ? '' : ' fraco') }, String(n)));
        }),
        total ? h('p', { class: 'vg-meta', style: 'margin:0' }, 'Cada barra vai da qualidade mais alta, mais forte, para a mais baixa, mais clara. ',
          linhas.filter((l) => l.n).map((l) => `${chamar(l.e)}: ${textoQual(l.por)}.`).join(' ')) : null));
  }

  function visaoGeral(lista) {
    return [
      h('section', { class: 'vg-cartao', 'aria-labelledby': 'vg-t-pers' },
        cabCartao('vg-t-pers', 'Personagens', 'XP/h da última hora · ouro/h da sessão · clique no nome para ver tudo'),
        tabelaPersonagens(lista)),
      h('div', { class: 'vg-duas' }, cartaoPendencias(lista), cartaoBonus(lista)),
      h('div', { class: 'vg-duas' }, cartaoFeed(lista), cartaoLendarios(lista))
    ];
  }
  // a frase de cima: quem sobe e a que horas, e quem parou de ler
  function achado(lista) {
    const partes = [];
    const sobem = lista.map((e) => ({ e, p: previsaoNivel(e, ctx) })).filter((x) => x.p?.ate && sessaoAtiva(x.e)).sort((a, b) => a.p.ate - b.p.ate).slice(0, 2);
    if (sobem.length) partes.push(sobem.map(({ e, p }) => `${chamar(e)} sobe para o ${parseInt(e.nivel, 10) + 1} às ${hora(p.ate)}`).join(' e ') + '.');
    const parados = lista.filter((e) => Date.now() - e.ts > LIMITE_VELHO);
    if (parados.length) partes.push(parados.map((e) => `${chamar(e)} está sem leitura desde ${hora(e.ts)}`).join('; ') + '.');
    return partes.join(' ') || 'Ninguém caçando agora.';
  }

  // ---------- mini janela ----------
  function cabMini(titulo) {
    return h('div', { class: 'mini-topo' },
      h('div', { class: 'quem' }, h('strong', null, titulo)),
      h('button', { type: 'button', class: 'botao mini-voltar', title: 'Voltar para a Central', onclick: voltarCentral }, 'Central'));
  }
  function desenharMini(e) {
    const raiz = h('div', { class: 'pilha mini' }, cabMini('Lupa'));
    if (semPip && !SO_MINI) raiz.append(nota('Esta janela não fica sempre por cima.'));
    raiz.append(e ? cartaoMini(e, { drops: 4 }) : vazio(TEXTO_VAZIO));
    return raiz;
  }
  // a mini com vários personagens: um cartão compacto para cada, empilhados
  function desenharMiniTodos(lista) {
    const raiz = h('div', { class: 'pilha mini' }, cabMini(`Lupa · ${lista.length} personagens`));
    if (semPip && !SO_MINI) raiz.append(nota('Esta janela não fica sempre por cima.'));
    for (const e of lista) raiz.append(cartaoMini(e, { drops: 2 }));
    return raiz;
  }
  const taxaMini = (rot, v, f = curto) => h('div', { class: 'mini-taxa' }, h('span', { class: 'rot' }, rot), h('span', { class: 'val num' }, ouTraco(v, f)));
  function tarefaMini(t) {
    const pct = t.qtd ? Math.min(100, (100 * t.feitos) / t.qtd) : t.pronta ? 100 : 0;
    const resto = t.qtd && !t.pronta ? `${inteiro(t.feitos)}/${inteiro(t.qtd)}${t.eta != null ? ` · ~${prazoTexto(Math.max(1, Math.round(t.eta)))}` : ''}` : '';
    return h('div', { class: 'mini-tar' + (t.pronta ? ' pronta' : '') },
      h('div', { class: 'mini-tar-l1' }, h('span', null, t.pronta ? 'Tarefa pronta para entregar' : t.local ? `Tarefa · ${t.local}` : t.titulo), resto ? h('span', { class: 'num fraco' }, resto) : null),
      t.qtd && !t.pronta ? barra(pct, null, `Tarefa: ${Math.floor(pct)}%`, ' fina' + (t.naZona ? '' : ' parada')) : null);
  }
  function chipsDe(e) {
    const chips = [], m = e.mochila, t = e.tarefa;
    if (m?.total && m.usados / m.total >= 0.9) chips.push(['alerta', `Mochila ${m.usados}/${m.total}`]);
    const pts = (e.pontos?.habilidade || 0) + (e.pontos?.atributo || 0);
    if (pts > 0) chips.push(['info', `${pts} ${pts === 1 ? 'ponto livre' : 'pontos livres'}`]);
    if (t?.cacandoFora) chips.push(['alerta', 'Caçando fora da zona da tarefa']);
    return chips.map(([ic, tx]) => h('span', { class: 'mini-chip' }, icone(ic, 14), tx));
  }
  // o cartão de um personagem na mini: nível com a barra de XP, a que horas sobe, as taxas, a tarefa e os últimos drops
  function cartaoMini(e, { drops = 2 } = {}) {
    const st = situacao(e), p = previsaoNivel(e, ctx), cor = corDe(e.nome), x = sessaoAtiva(e), nivel = parseInt(e.nivel, 10);
    const campo = semBonus ? 'xpBase' : 'xp', chips = chipsDe(e);
    return h('section', { class: 'cartao mini-pers', 'aria-label': chamar(e) },
      h('div', { class: 'mini-l1' }, ponto(cor), h('strong', null, chamar(e)), isNaN(nivel) ? null : h('span', { class: 'fraco num' }, `nv ${nivel}`), pilula(st.tom, st.texto)),
      p ? h('div', { class: 'mini-xp' }, barra(p.pct, cor, `Nível ${nivel}: ${pctTexto(p.pct)}`), h('span', { class: 'num fraco' }, pctTexto(p.pct))) : null,
      h('div', { class: 'mini-l3' }, p?.ate
        ? [h('span', null, h('span', { class: 'fraco' }, `Sobe para o ${nivel + 1} às `), h('b', { class: 'num' }, hora(p.ate))), h('span', { class: 'fraco num' }, `em ${prazoTexto(p.min)}`)]
        : h('span', { class: 'fraco' }, st.tom === 'aviso' ? `Parado ${st.sub}` : p ? `Faltam ${curto(p.falta)} XP` : st.sub)),
      x ? h('div', { class: 'mini-taxas' }, taxaMini('XP/h', ritmoRecente(x, campo)), taxaMini('Abates/h', ritmoRecente(x, 'abates'), inteiro), taxaMini('Ouro/h', porHora(x.ouro, x.seg))) : null,
      e.tarefa ? tarefaMini(e.tarefa) : null,
      chips.length ? h('div', { class: 'mini-chips', role: 'status' }, chips) : null,
      drops ? [h('h3', { class: 'mini-rot' }, 'Últimos drops'), desenharFeed(eventos[e.nome], ctx, { limite: drops, filtro: 'drops' })] : null);
  }

  // a Central guarda a própria aba (tabs.getCurrent não pede permissão) para a mini em popup voltar para ela
  if (!SO_MINI) chrome.tabs?.getCurrent?.()?.then((t) => { if (t) chrome.storage.local.set({ centralAba: { id: t.id, janela: t.windowId } }); }).catch(() => {});
  async function voltarCentral() {
    if (!SO_MINI) { try { window.focus(); } catch {} return; }
    try {
      const { centralAba: a } = await chrome.storage.local.get('centralAba');
      await chrome.tabs.update(a.id, { active: true });
      await chrome.windows.update(a.janela, { focused: true });
    } catch { chrome.tabs.create({ url: chrome.runtime.getURL('central.html') }); }
  }

  // ---------- desenho ----------
  const apertado = { central: false, pip: false };
  let pendente = false;
  const ligarPonteiro = (doc, chaveApertado) => {
    doc.addEventListener('pointerdown', () => (apertado[chaveApertado] = true), true);
    const soltar = () => { apertado[chaveApertado] = false; if (pendente) agendar(); };
    doc.addEventListener('pointerup', soltar, true);
    doc.addEventListener('pointercancel', soltar, true);
  };
  ligarPonteiro(DOC, 'central');

  function agendar() {
    pendente = true;
    if (apertado.central || apertado.pip) return;   // não troca o botão debaixo do dedo no meio do clique
    requestAnimationFrame(() => { if (pendente) { pendente = false; desenhar(); } });
  }

  function coluna(titulo, ...filhos) {
    return h('section', { class: 'c-col' }, h('h2', { class: 'c-titulo' }, titulo), ...filhos.filter(Boolean));
  }

  const miniDe = (e) => (ladoALado() ? desenharMiniTodos(naTabela()) : desenharMini(e));

  function desenhar() {
    const e = atual();
    if (SO_MINI) {
      DOC.body.classList.add('so-mini');
      const caixa = DOC.getElementById('c-mini');
      caixa.hidden = false;
      caixa.replaceChildren(miniDe(e));
      return;
    }
    desenharTopo(e);
    const grade = DOC.getElementById('c-grade');
    const filtros = () => h('div', { class: 'c-filtros', role: 'group', 'aria-label': 'Filtro do feed' },
      [['tudo', 'Tudo'], ['drops', 'Drops'], ['alertas', 'Alertas']].map(([id, nome]) => h('button', { type: 'button', 'aria-pressed': String(filtro === id), onclick: () => { filtro = id; desenhar(); } }, nome)));
    const geral = !!e && ladoALado();
    grade.classList.remove('c-lado');
    grade.classList.toggle('c-geral', geral);
    if (!e) grade.replaceChildren(vazio(TEXTO_VAZIO));
    else if (geral) grade.replaceChildren(...visaoGeral(naTabela()));
    else {
      grade.replaceChildren(
        coluna('Ao vivo', filtros(), desenharFeed(eventos[e.nome], ctx, { limite: 40, filtro })),
        coluna('Caçada e tarefa', cartaoHoje(e), desenharCacada(e, ctx), desenharTarefa(e, ctx, { semHoje: true }), desenharTimers(e, ctx)),
        coluna('Plano e ficha', desenharPlano(e, ctx, { compacto: false }), desenharFicha(e, ctx, { semPlano: true })));
    }
    desenharPip(e);
  }

  function desenharTopo(e) {
    const lista = naTabela(), todos = ladoALado();
    DOC.getElementById('quem').textContent = todos ? achado(lista)
      : e ? [nomeComCampeao(e), e.nivel && `nv ${e.nivel}`, e.zona].filter(Boolean).join(' · ') : 'aguardando o jogo';
    // na visão geral, o status de cima é a leitura mais nova (quem parou de ler aparece na tabela e no Precisa de você)
    const st = DOC.getElementById('status'), maisNovo = todos ? [...lista].sort((a, b) => b.ts - a.ts)[0] : e, info = infoStatus(maisNovo);
    st.className = 'status ' + info.classe;
    st.textContent = todos && info.classe === 'ok' ? `última leitura há ${segundos(Date.now() - maisNovo.ts)} s` : info.texto;
    const box = DOC.getElementById('personagens');
    box.hidden = lista.length < 2;
    if (!box.hidden) box.replaceChildren(
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(todos), onclick: () => { modo = 'todos'; desenhar(); } }, 'Visão geral'),
      ...lista.map((x) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!todos && x.nome === e?.nome), onclick: () => { modo = 'um'; escolhido = x.nome; desenhar(); } }, chamar(x))));
    const xp = DOC.getElementById('xp-topo'), barraTopo = e && !todos ? barraXp(e, ctx) : null;
    xp.hidden = !barraTopo;
    xp.replaceChildren(...(barraTopo ? [barraTopo] : []));
    // ações: só recria se mudou o estado da chave ou da mini (evita trocar o botão no meio do clique)
    const ac = DOC.getElementById('c-acoes'), kAc = `${config.manterAcordado}|${!!pip}`;
    if (ac.dataset.k !== kAc) {
      ac.dataset.k = kAc;
      ac.replaceChildren(...[
        // no site, "PC acordado" mexeria só neste navegador, não no PC de casa
        globalThis.LUPA_API ? null : chave(config.manterAcordado, 'PC acordado', () => salvarConfig({ manterAcordado: !config.manterAcordado })),
        h('button', { type: 'button', class: 'botao', onclick: pip ? () => pip.close() : abrirMini, title: 'Abre uma janela pequena que fica sempre por cima' }, pip ? 'Fechar mini janela' : 'Soltar mini janela')].filter(Boolean));
    }
  }

  // ---------- mini janela ----------
  function desenharPip(e) {
    if (!pip) return;
    if (apertado.pip) return;
    const raiz = pip.document.getElementById('lupa-mini');
    if (raiz) raiz.replaceChildren(miniDe(e));
  }

  // altura da mini: uns 280 px por personagem, até 900
  const alturaMini = () => Math.min(900, 120 + (ladoALado() ? naTabela().length : 1) * 280);
  // as regras de CSS copiadas para a mini, com os endereços (a fonte) já absolutos: a mini não tem endereço próprio
  const cssDaPagina = () => [...document.styleSheets].map((f) => {
    try {
      const base = f.href || document.baseURI;
      return [...f.cssRules].map((r) => r.cssText.replace(/url\("?(?!data:|blob:|https?:)([^")]+)"?\)/g, (_, u) => `url("${new URL(u, base).href}")`)).join('\n');
    } catch { return ''; }
  }).join('\n');

  async function abrirMini() {
    if (pip) { pip.focus?.(); return; }
    if (!('documentPictureInPicture' in window)) {
      semPip = true;
      try { await chrome.windows.create({ url: chrome.runtime.getURL('central.html#mini'), type: 'popup', width: 380, height: alturaMini() + 40 }); } catch {}
      return;
    }
    try {
      const w = await documentPictureInPicture.requestWindow({ width: 360, height: alturaMini() });
      // copia as regras já carregadas na Central (o jeito padrão do Picture-in-Picture; não depende de baixar o CSS de novo)
      const estilo = w.document.createElement('style');
      estilo.textContent = cssDaPagina();
      w.document.head.append(estilo);
      w.document.title = 'Lupa · mini';
      w.document.body.classList.add('mini-pip');
      const raiz = w.document.createElement('main');
      raiz.id = 'lupa-mini'; raiz.className = 'c-mini';
      w.document.body.append(raiz);
      ligarPonteiro(w.document, 'pip');
      pip = w;
      w.addEventListener('pagehide', () => { if (pip === w) { pip = null; apertado.pip = false; desenhar(); } });
      desenhar();
    } catch {
      pip = null;
      semPip = true;
      try { await chrome.windows.create({ url: chrome.runtime.getURL('central.html#mini'), type: 'popup', width: 380, height: alturaMini() + 40 }); } catch {}
    }
  }

  // ---------- início ----------
  if (globalThis.lupaApp) { const r = DOC.querySelector('.rodape span'); if (r) r.textContent = 'Lê a tela; só clica no jogo quando você aperta Entregar e seguir ou o Alt+L.'; }
  chrome.storage.local.get(null).then((tudo) => { for (const [k, v] of Object.entries(tudo)) guardar(k, v); desenhar(); });
  chrome.storage.onChanged.addListener((mud, area) => {
    if (area !== 'local') return;
    for (const [k, { newValue }] of Object.entries(mud)) guardar(k, newValue);
    agendar();
  });
  setInterval(() => {
    if (SO_MINI) { if (!apertado.central) desenhar(); return; }
    desenharTopo(atual());
    desenharPip(atual());
  }, 5000);
  desenhar();
})();
