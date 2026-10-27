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
  let config = mesclarConfig(), estados = {}, cacadas = {}, eventos = {}, icones = {}, escolhido = null, semBonus = false;
  let filtro = 'tudo';
  let modo = null;         // 'todos' (lado a lado) | 'um' | null = automático (lado a lado com 2+ personagens lendo)
  let pip = null;          // janela de documentPictureInPicture, se aberta
  let semPip = false;      // true quando a mini caiu no popup comum (não fica sempre por cima)

  function guardar(k, v) {
    if (k === 'config') config = mesclarConfig(v);
    else if (k === 'icones') icones = v || {};
    else if (k.startsWith('estado:')) { if (v) estados[k.slice(7)] = v; else delete estados[k.slice(7)]; }
    else if (k.startsWith('cacada:')) { if (v) cacadas[k.slice(7)] = v; else delete cacadas[k.slice(7)]; }
    else if (k.startsWith('eventos:')) { if (v) eventos[k.slice(8)] = v; else delete eventos[k.slice(8)]; }
  }
  const salvarConfig = (mud) => chrome.storage.local.set({ config: { ...config, ...mud, recolhidos: { ...config.recolhidos, ...(mud.recolhidos || {}) }, avisos: { ...config.avisos, ...(mud.avisos || {}) } } });
  const alternarAviso = (k) => salvarConfig({ avisos: { [k]: !config.avisos[k] } });

  const ctx = {
    get config() { return config; },
    get cacadas() { return cacadas; },
    get eventos() { return eventos; },
    get icones() { return icones; },
    get semBonus() { return semBonus; },
    setSemBonus(v) { semBonus = !!v; desenhar(); },
    salvarConfig, alternarAviso,
    redesenhar() { desenhar(); }
  };

  function atual() {
    if (escolhido && estados[escolhido]) return estados[escolhido];
    return Object.values(estados).sort((a, b) => b.ts - a.ts)[0] || null;
  }
  // personagens com leitura nos últimos 10 min (cada um numa janela: normal e anônima do mesmo Chrome)
  const recentes = () => Object.values(estados).filter((x) => Date.now() - x.ts < 10 * 60e3).sort((a, b) => a.nome.localeCompare(b.nome));
  const ladoALado = () => recentes().length >= 2 && (modo ?? 'todos') === 'todos';
  const nomeComCampeao = (e) => [e.nome, LUPA_PLANOS?.[e.nome]?.campeao].filter(Boolean).join(' · ');

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

  // ---------- visão mini ----------
  function desenharMini(e, ctx2) {
    const raiz = h('div', { class: 'pilha mini' });
    const st = infoStatus(e);
    raiz.append(h('div', { class: 'mini-topo' },
      h('div', { class: 'quem' },
        h('strong', null, e ? [e.nome, e.nivel && `nv ${e.nivel}`].filter(Boolean).join(' · ') : 'Lupa'),
        h('span', { class: 'status ' + st.classe }, st.curto)),
      h('button', { type: 'button', class: 'botao mini-voltar', title: 'Voltar para a Central', onclick: voltarCentral }, 'Central')));
    if (semPip && !SO_MINI) raiz.append(nota('Esta janela não fica sempre por cima.'));
    if (!e) { raiz.append(vazio(TEXTO_VAZIO)); return raiz; }
    raiz.append(...resumo(e, ctx2));
    return raiz;
  }

  // a mini com vários personagens: um cartão compacto para cada, empilhados
  function desenharMiniTodos(lista, ctx2) {
    const raiz = h('div', { class: 'pilha mini' });
    raiz.append(h('div', { class: 'mini-topo' },
      h('div', { class: 'quem' }, h('strong', null, `Lupa · ${lista.length} personagens`)),
      h('button', { type: 'button', class: 'botao mini-voltar', title: 'Voltar para a Central', onclick: voltarCentral }, 'Central')));
    if (semPip && !SO_MINI) raiz.append(nota('Esta janela não fica sempre por cima.'));
    for (const e of lista) {
      const st = infoStatus(e);
      raiz.append(h('section', { class: 'cartao mini-pers' },
        h('div', { class: 'linha-topo' },
          h('strong', null, [nomeComCampeao(e), e.nivel && `nv ${e.nivel}`].filter(Boolean).join(' · ')),
          h('span', { class: 'status ' + st.classe }, st.curto)),
        ...resumo(e, ctx2, { compacto: true, drops: 2 })));
    }
    return raiz;
  }

  // o miolo da mini (e de cada coluna do lado a lado): XP, tarefa, taxas da sessão, alertas e últimos drops
  function resumo(e, ctx2, { compacto = false, drops = 4 } = {}) {
    const partes = [];
    const xp = compacto ? null : barraXp(e, ctx2);
    if (xp) partes.push(xp);

    const t = e.tarefa;
    if (t) {
      const pct = t.qtd ? Math.min(100, (100 * t.feitos) / t.qtd) : t.pronta ? 100 : 0;
      partes.push(h('div', { class: 'cartao mini-tarefa' },
        h('span', { class: 'rotulo' }, 'Tarefa'),
        h('span', { class: 'titulo-tarefa' }, t.titulo),
        t.qtd ? h('div', { class: 'progresso' + (t.naZona ? '' : ' parada'), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.floor(pct)) }, h('i', { style: `width:${pct}%` })) : null,
        h('div', { class: 'linha-topo' },
          h('span', { class: 'num' }, t.qtd ? `${inteiro(t.feitos)}/${inteiro(t.qtd)} abates` : (t.pronta ? 'pronta' : '')),
          t.eta != null && !t.pronta ? h('span', { class: 'num fraco' }, `~${Math.max(1, Math.round(t.eta))} min`) : null)));
    }

    const x = ctx2.cacadas[e.nome]?.sessoes?.at(-1);
    if (x) {
      const campo = ctx2.semBonus ? 'xpBase' : 'xp';
      partes.push(h('div', { class: 'grade-3' },
        stat('Abates/h', ouTraco(porHora(x.abates, x.seg), inteiro)),
        stat('XP/h', ouTraco(porHora(x[campo], x.seg)), 'destaque'),
        stat('Ouro/h', ouTraco(porHora(x.ouro, x.seg)))));
    }

    const chips = [];
    const m = e.mochila;
    if (m?.total && m.usados / m.total >= 0.9) chips.push(['alerta', `Mochila ${m.usados}/${m.total}`, '']);
    const pts = (e.pontos?.habilidade || 0) + (e.pontos?.atributo || 0);
    if (pts > 0) chips.push(['info', `${pts} ${pts === 1 ? 'ponto livre' : 'pontos livres'}`, '']);
    if (t?.cacandoFora) chips.push(['alerta', 'Caçando fora da zona da tarefa', '']);
    if (t?.pronta) chips.push(['estrela', 'Tarefa pronta', 'pronta']);
    if (chips.length) partes.push(h('div', { class: 'mini-chips', role: 'status' }, chips.map(([ic, tx, cl]) => h('span', { class: 'mini-chip ' + cl }, icone(ic, 14), tx))));

    if (drops) partes.push(secao('Últimos drops', desenharFeed(ctx2.eventos[e.nome], ctx2, { limite: drops, filtro: 'drops' })));
    return partes;
  }

  // uma coluna por personagem na Central (lado a lado)
  function colunaPersonagem(e) {
    const st = infoStatus(e);
    return h('section', { class: 'c-col c-pers', 'aria-label': e.nome },
      h('div', { class: 'c-pers-topo' },
        h('div', { class: 'quem' },
          h('strong', null, nomeComCampeao(e)),
          h('span', null, [e.nivel && `nível ${e.nivel}`, e.zona].filter(Boolean).join(' · '))),
        h('span', { class: 'status ' + st.classe }, st.curto)),
      ...resumo(e, ctx, { drops: 0 }),
      cartaoHoje(e),
      desenharPlano(e, ctx, { compacto: true }),
      secao('Ao vivo', desenharFeed(eventos[e.nome], ctx, { limite: 20, filtro })));
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

  const miniDe = (e) => (ladoALado() ? desenharMiniTodos(recentes(), ctx) : desenharMini(e, ctx));

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
    grade.classList.toggle('c-lado', ladoALado());
    grade.style.setProperty('--colunas', String(Math.min(3, recentes().length || 1)));
    if (!e) grade.replaceChildren(vazio(TEXTO_VAZIO));
    else if (ladoALado()) grade.replaceChildren(h('div', { class: 'c-faixa' }, filtros()), ...recentes().map(colunaPersonagem));
    else {
      grade.replaceChildren(
        coluna('Ao vivo', filtros(), desenharFeed(eventos[e.nome], ctx, { limite: 40, filtro })),
        coluna('Caçada e tarefa', cartaoHoje(e), desenharCacada(e, ctx), desenharTarefa(e, ctx, { semHoje: true }), desenharTimers(e, ctx)),
        coluna('Plano e ficha', desenharPlano(e, ctx, { compacto: false }), desenharFicha(e, ctx, { semPlano: true })));
    }
    desenharPip(e);
  }

  function desenharTopo(e) {
    const lista = recentes(), todos = ladoALado();
    DOC.getElementById('quem').textContent = todos ? lista.map(nomeComCampeao).join(' e ')
      : e ? [nomeComCampeao(e), e.nivel && `nv ${e.nivel}`, e.zona].filter(Boolean).join(' · ') : 'aguardando o jogo';
    // lado a lado, o status de cima é o do personagem com a leitura mais velha (o de cada um fica na coluna)
    const st = DOC.getElementById('status'), info = infoStatus(todos ? [...lista].sort((a, b) => a.ts - b.ts)[0] : e);
    st.className = 'status ' + info.classe;
    st.textContent = info.texto;
    const box = DOC.getElementById('personagens');
    box.hidden = lista.length < 2;
    if (!box.hidden) box.replaceChildren(
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(todos), onclick: () => { modo = 'todos'; desenhar(); } }, 'Lado a lado'),
      ...lista.map((x) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(!todos && x.nome === e?.nome), onclick: () => { modo = 'um'; escolhido = x.nome; desenhar(); } }, nomeComCampeao(x))));
    const xp = DOC.getElementById('xp-topo'), barra = e && !todos ? barraXp(e, ctx) : null;
    xp.hidden = !barra;
    xp.replaceChildren(...(barra ? [barra] : []));
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

  async function abrirMini() {
    if (pip) { pip.focus?.(); return; }
    if (!('documentPictureInPicture' in window)) {
      semPip = true;
      try { await chrome.windows.create({ url: chrome.runtime.getURL('central.html#mini'), type: 'popup', width: 380, height: ladoALado() ? 820 : 620 }); } catch {}
      return;
    }
    try {
      const w = await documentPictureInPicture.requestWindow({ width: 360, height: ladoALado() ? 760 : 560 });
      // copia as regras já carregadas na Central (o jeito padrão do Picture-in-Picture; não depende de baixar o CSS de novo)
      const estilo = w.document.createElement('style');
      estilo.textContent = [...document.styleSheets].map((f) => { try { return [...f.cssRules].map((r) => r.cssText).join('\n'); } catch { return ''; } }).join('\n');
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
      try { await chrome.windows.create({ url: chrome.runtime.getURL('central.html#mini'), type: 'popup', width: 380, height: 620 }); } catch {}
    }
  }

  // ---------- início ----------
  if (globalThis.lupaApp) { const r = DOC.querySelector('.rodape span'); if (r) r.textContent = 'Só leitura: não clica e não aperta teclas.'; }
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
