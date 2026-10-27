// Lupa · content script do lolidle.com
// Lê o que o jogo já mostra na tela e guarda um resumo para o painel lateral. Só leitura: não clica, não aperta
// tecla e não chama o servidor do jogo. Na página, só mexe na aparência: liga as classes do tema.css (cores da
// lateral, esconder bônus ou a faixa de redes) e esconde as linhas de loot do chat, conforme o jogador escolhe no painel.
(() => {
  'use strict';

  const $ = (s, raiz = document) => raiz.querySelector(s);
  const $$ = (s, raiz = document) => [...raiz.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const oculto = (el) => !el || !!el.closest('[hidden]');
  // o jogo põe as dicas em "title", e o dicas.js dele passa algumas para data-dica
  const dica = (el) => (el ? el.getAttribute('title') || el.dataset.dica || '' : '');
  const tenta = (f, padrao = null) => { try { return f(); } catch { return padrao; } };
  const vivo = () => tenta(() => !!chrome.runtime?.id, false);      // falso depois que a extensão é recarregada

  // números como o jogo escreve: "670", "12.3k", "1.2M" (fmt) ou "5.697.935" (inteiro)
  function numero(s) {
    const m = String(s ?? '').trim().match(/^([\d.,]+)\s*([kM])?/);
    if (!m) return 0;
    const mult = m[2] === 'M' ? 1e6 : m[2] === 'k' ? 1e3 : 1;
    const n = mult > 1 ? m[1].replace(',', '.') : m[1].replace(/[.,](?=\d{3}(?!\d))/g, '').replace(',', '.');
    return (parseFloat(n) || 0) * mult;
  }
  const porcento = (el) => {
    if (oculto(el)) return 0;
    const m = txt(el).match(/\+(\d+(?:[.,]\d+)?)%/);
    return m ? parseFloat(m[1].replace(',', '.')) / 100 : 0;
  };
  const mesmaZona = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  const zonaAtual = () => txt($('#hud-local'));
  const bonusLive = () => porcento($('#buff-kick-t')) + porcento($('#buff-twitch-t'));

  // ---------- configuração (escrita pelo painel) ----------
  const PADRAO = { esconderLoot: false, tema: true, semBonusLateral: false, semRedes: false, novaSessao: 0, novaSessaoPor: {}, manterAcordado: false, lateralFechada: false, recolhidos: {},
    avisos: { kick: true, twitch: true, voto: true, tarefa: true, evento: true, convites: false, mochila: true, chao: true, morte: true, pontos: true, nivel: true,
      premio: true, diaria: true, guerra: true, vilemaw: true, covil: true, reinicio: true, lendario: true } };
  let config = structuredClone(PADRAO);
  function aplicarConfig(c) {
    config = { ...PADRAO, ...c, avisos: { ...PADRAO.avisos, ...(c?.avisos || {}) }, recolhidos: { ...(c?.recolhidos || {}) } };
    const html = document.documentElement.classList;
    html.toggle('lupa-sem-loot', !!config.esconderLoot);
    html.toggle('lupa-tema', !!config.tema);
    html.toggle('lupa-sem-bonus', !!config.semBonusLateral);
    html.toggle('lupa-sem-redes', !!config.semRedes);
    tenta(() => controles(ultEstado));
  }

  // ---------- lateral recolhível (só classes, controles próprios e CSS; nunca clica no jogo) ----------
  let ultEstado = null, ultFechada = null;
  const CARDS = {
    status: { host: '#painel-status > header', raiz: '#painel-status', nome: 'Cartão do jogador' },
    local: { host: '#painel-local > header', raiz: '#painel-local', nome: 'Local' },
    abas: { host: '#direita > nav.abas', raiz: '#direita', nome: 'Abas' }
  };
  const ICONE_LADO = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICONE_CARD = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const salvarConfig = (mud) => tenta(() => chrome.storage.local.set({ config: { ...config, ...mud } }));
  const alternarLateral = () => salvarConfig({ lateralFechada: !config.lateralFechada });
  const alternarCard = (k) => salvarConfig({ recolhidos: { ...config.recolhidos, [k]: !config.recolhidos[k] } });
  const escreve = (el, t) => { if (el.textContent !== t) el.textContent = t; };      // só escreve se mudou (evita laço com o observador)
  const alertas = (e) => !e ? 0 : (e.tarefa?.pronta ? 1 : 0) + (e.tarefa?.cacandoFora ? 1 : 0)
    + (e.mochila?.total > 0 && e.mochila.usados / e.mochila.total >= 0.9 ? 1 : 0) + ((e.pontos?.habilidade || 0) + (e.pontos?.atributo || 0) > 0 ? 1 : 0);

  function criarControles() {
    if (!$('#lateral') || !document.body) return;
    let aba = $('#lupa-aba-lateral');
    if (!aba) {
      aba = document.createElement('button');
      aba.id = 'lupa-aba-lateral'; aba.type = 'button';
      aba.innerHTML = ICONE_LADO + '<span class="lupa-aba-txt">LUPA</span><span class="lupa-selo" hidden></span>';
      aba.addEventListener('click', (ev) => { ev.stopPropagation(); alternarLateral(); });
      document.body.append(aba);
    }
    for (const [k, c] of Object.entries(CARDS)) {
      const host = $(c.host);
      if (!host || $(':scope > .lupa-recolher', host)) continue;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lupa-recolher'; b.dataset.lupaCard = k;
      b.setAttribute('aria-label', 'Recolher ou abrir: ' + c.nome); b.title = 'Recolher ou abrir: ' + c.nome;
      b.innerHTML = ICONE_CARD;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); alternarCard(k); });
      if (k !== 'abas') { const r = document.createElement('span'); r.className = 'lupa-resumo'; host.append(r); }
      host.append(b);
    }
  }

  function posicionarAba() {
    const aba = $('#lupa-aba-lateral'), lat = $('#lateral');
    if (!aba) return;
    // fechada, desce para o meio da altura: no topo ficava em cima do "Nível ideal" e do minimapa do jogo
    let dir = 0, topo = Math.round(window.innerHeight * 0.42);
    if (!config.lateralFechada && lat) {
      const r = lat.getBoundingClientRect();
      if (r.width) { dir = Math.max(0, window.innerWidth - r.left); topo = Math.max(0, r.top) + 16; }
    }
    aba.style.right = dir + 'px'; aba.style.top = topo + 'px';
  }

  // classes, aria, resumos, selo e posição; chamado ao mudar a config e a cada leitura
  function controles(e) {
    if (e !== undefined) ultEstado = e;
    const html = document.documentElement.classList, fechada = !!config.lateralFechada;
    html.toggle('lupa-lateral-fechada', fechada);
    criarControles();
    for (const [k, c] of Object.entries(CARDS)) {
      const rec = !!config.recolhidos[k], raiz = $(c.raiz), host = $(c.host);
      raiz?.classList.toggle('lupa-recolhido', rec);
      const b = host && $(':scope > .lupa-recolher', host);
      if (b) b.setAttribute('aria-expanded', String(!rec));
      const r = host && $(':scope > .lupa-resumo', host);
      if (r) escreve(r, !rec ? '' : k === 'status' ? `${txt($('#st-ouro'))} de ouro · Poder ${txt($('#st-poder'))}` : txt($('#local-nome')));
    }
    const aba = $('#lupa-aba-lateral');
    if (aba) {
      const rot = (fechada ? 'Abrir' : 'Fechar') + ' a lateral (Alt+L)', n = alertas(ultEstado);
      if (aba.title !== rot) { aba.title = rot; aba.setAttribute('aria-label', rot); }
      aba.setAttribute('aria-expanded', String(!fechada));
      const selo = $('.lupa-selo', aba);
      escreve(selo, n ? String(n) : ''); selo.hidden = !n;
    }
    posicionarAba();
    if (ultFechada === null ? fechada : ultFechada !== fechada) setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
    ultFechada = fechada;
  }
  window.addEventListener('resize', () => tenta(posicionarAba));
  window.addEventListener('keydown', (ev) => {
    if (!ev.altKey || ev.ctrlKey || ev.metaKey || ev.code !== 'KeyL') return;
    const a = ev.target instanceof Element ? ev.target : document.activeElement;
    if (a && (a.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') || a.isContentEditable)) return;
    ev.preventDefault(); alternarLateral();
  });
  const estilo = document.createElement('style');
  estilo.textContent = 'html.lupa-sem-loot #log > p[data-lupa-loot]{display:none!important}';
  document.head.append(estilo);

  // ---------- leitura da tela ----------
  const RARIDADES = ['mitico', 'lendario', 'epico', 'basico'];
  function lerItem(slot) {
    const id = slot.dataset.id || '';
    if (!id || id.startsWith('esp:') || id.startsWith('tranca:')) return null;
    const d = dica(slot), l1 = d.split('\n')[0] || '';
    const m = l1.match(/^(.*) \(([^()]*)\)$/);      // "Gume do Infinito (Lendário, refinado +4)"
    const ref = (m?.[2].match(/refinado \+(\d+)/) || [])[1];
    return {
      id,      // o código que a tela traz no espaço (ex.: 3031+4#velocidade2~B): casa o item com o Mercado
      nome: (m ? m[1] : l1).replace(/\s\+\d+$/, '') || '',
      raridade: RARIDADES.find((r) => slot.classList.contains(r)) || '',
      refino: ref ? '+' + ref : txt($('.ref', slot)),
      qual: txt($('.qual', slot)) || (d.match(/^Qualidade (\S+):/m) || [])[1] || '',
      carta: (d.match(/^Carta: (.+?) \(/m) || [])[1] || dica($('.carta-selo', slot)).split(' · ')[0] || ''
    };
  }

  // espólios (partes de monstro, só para vender): cada pilha traz "esp:<id>:<qtd>" e a dica diz quanto o Lojista paga
  // por unidade ("o Lojista compra por 76 de ouro cada"; de 10 mil para cima o jogo arredonda, "75.0k"). Pilhas do mesmo
  // espólio viram uma linha só.
  function lerEspolios() {
    const por = new Map();
    for (const s of $$('#mochila .espolio-slot')) {
      const [, id, q] = (s.dataset.id || '').split(':'), d = dica(s), l1 = d.split('\n')[0];
      const nome = l1.replace(/\s*×.*$/, '').trim(), qtd = numero(q) || numero((l1.match(/×\s*([\d.,]+)/) || [])[1]);
      if (!id || !nome || !qtd) continue;
      const x = por.get(id) || { id, nome, qtd: 0, cada: numero((d.match(/por ([\d.,]+[kM]?) de ouro cada/) || [])[1]) || null };
      x.qtd += qtd;
      por.set(id, x);
    }
    return [...por.values()];
  }

  const nomeHab = (el) => dica(el).split(' — ')[0].replace(/ \(passiva\)$/, '') || el.dataset.t;

  function lerFicha() {
    const teclas = $$('#hud-habs > *').map((el) => txt($(':scope > span', el)));
    return {
      equip: $$('#equip .slot').map(lerItem).filter(Boolean),
      mochila: $$('#mochila .slot').map(lerItem).filter(Boolean),
      espolios: lerEspolios(),
      barra: $$('#barra > *').map((el, k) => (el.dataset.t ? { t: el.dataset.t, nome: nomeHab(el), tecla: txt($('.tecla-hab', el)) || teclas[k] || '' } : null)),
      habs: $$('#habilidades .hab[data-t]').filter((el) => el.dataset.t !== 'P').map((el) => ({
        t: el.dataset.t, nome: nomeHab(el), rank: txt($('.rank span', el)),
        passiva: el.classList.contains('passiva'), naBarra: el.classList.contains('na-barra')
      })),
      atributos: $$('#atributos .atrib').map((el) => ({ nome: txt($('.atrib-nome', el)), valor: txt($('[data-valor]', el)) })),
      stats: {
        dano: txt($('#st-ad')), poderHab: oculto($('#st-ap')) ? '' : txt($('#st-ap')), velAtaque: txt($('#st-va')),
        critico: txt($('#st-crit')), danoCritico: txt($('#st-critx')), recarga: txt($('#st-cdr')),
        armadura: txt($('#st-arm')), resMagica: txt($('#st-rm')), esquiva: txt($('#st-esq')),
        poder: txt($('#st-poder')), ouro: txt($('#st-ouro')), mortes: txt($('#st-mortes'))
      },
      cartas: $$('#cartas-bolsa .carta-b').map((el) => ({ nome: txt($('span', el)), qtd: numero(txt($('b', el))) })),
      cartasMisteriosas: numero(txt($('#cartas-bolsa .carta-misteriosa b')))
    };
  }

  function lerTarefa() {
    const bt = $('#rastreio-tarefa');
    if (!bt || bt.hidden) return null;
    const pronta = bt.classList.contains('pronta'), s = txt($('small', bt));
    const m = s.match(/^(\d+)\/(\d+) · (.+)$/);
    return { titulo: txt($('b', bt)), pronta, feitos: m ? +m[1] : null, qtd: m ? +m[2] : null, local: m ? m[3] : '', dica: pronta ? s : '' };
  }

  function lerDiarias() {
    return ['#rastreio-diaria', '#rastreio-diaria-rift'].map((sel) => $(sel)).filter((el) => el && !el.hidden)
      .map((el) => ({ nome: txt($('b', el)), texto: txt($('small', el)), fora: el.classList.contains('fora'), pronta: el.classList.contains('pronta') }));
  }

  function lerTimers() {
    const voto = $('#abrir-voto');
    const conv = $('#convites-dg .cv-texto');
    return {
      kick: { ativo: !oculto($('#buff-kick')), texto: txt($('#buff-kick-t')), oferta: oculto($('#abrir-kick')) ? '' : txt($('#abrir-kick em')) },
      twitch: { ativo: !oculto($('#buff-twitch')), texto: txt($('#buff-twitch-t')), oferta: oculto($('#abrir-twitch')) ? '' : txt($('#abrir-twitch em')) },
      voto: !voto || voto.hidden ? null : {
        estado: voto.classList.contains('ativo') ? 'ativo' : voto.classList.contains('espera') ? 'espera' : voto.classList.contains('pode') ? 'pode' : '',
        texto: txt($('em', voto)), bonus: oculto($('#buff-voto')) ? '' : txt($('#buff-voto-t'))
      },
      guilda: oculto($('#buff-guilda')) ? '' : txt($('#buff-guilda-t')),
      barao: oculto($('#buff-barao')) ? '' : txt($('#buff-barao-t')),
      guerra: oculto($('#buff-guerra')) ? '' : txt($('#buff-guerra-t')),
      lojaXp: oculto($('#buff-loja-xp')) ? '' : txt($('#buff-loja-xp-t')),
      lojaOuro: oculto($('#buff-loja-ouro')) ? '' : txt($('#buff-loja-ouro-t')),
      disciplina: oculto($('#buff-disciplina')) ? '' : txt($('#buff-disciplina-t')),
      vip: { texto: txt($('#abrir-vip span')), dica: dica($('#abrir-vip')) },
      evento: oculto($('#evento-xp')) ? '' : txt($('#evento-xp')),
      convites: conv ? { titulo: txt($('b', conv)), detalhe: txt($('small', conv)) } : null
    };
  }

  // multiplicador somado dos buffs que mostram "+N%" (1 = sem bônus); o ouro só vem da Loja
  function lerBonus() {
    const xp = porcento($('#buff-kick-t')) + porcento($('#buff-twitch-t')) + porcento($('#buff-voto-t')) + porcento($('#buff-guilda-t')) + porcento($('#buff-loja-xp'));
    return { xp: Math.round((1 + xp) * 1000) / 1000, ouro: Math.round((1 + porcento($('#buff-loja-ouro'))) * 1000) / 1000 };
  }

  // quadro de missões (#rastreador) e aviso de reinício: cada bloco é null quando não existe ou está escondido
  const bloco = (sel) => { const el = $(sel); return oculto(el) ? null : el; };
  const sub = (el, s) => txt($(s, el));
  const junta = (el) => [...el.children].map(txt).filter(Boolean).join(' · ') || txt(el);      // o <b> e o <small> grudados viram "título · detalhe"
  function lerRastreio() {
    const login = bloco('#rastreio-login'), guerra = bloco('#rastreio-guerra'), vm = bloco('#rastreio-vilemaw'), covil = bloco('#rastreio-covil');
    const sorteio = bloco('#rastreio-sorteio'), caveira = bloco('#rastreio-caveira'), reinicio = bloco('#aviso-reinicio'), chaves = bloco('#rastreio-chaves');
    const gt = guerra ? sub(guerra, 'b') : '', gs = guerra ? sub(guerra, 'small') : '';      // pt ou en, como o jogo escreve
    return {
      login: login && { dia: +(sub(login, 'b').match(/(\d+)\s*$/) || [])[1] || null, texto: junta(login) },
      guerra: guerra && {
        fase: /acontecendo|in progress/i.test(gt) ? 'acontecendo' : /aberta|is open/i.test(gt) ? 'aberta' : 'agendada',
        texto: junta(guerra), pronto: /você está pronto|you are ready/i.test(gs) ? true : /dar pronto|get ready/i.test(gs) ? false : null
      },
      vilemaw: vm && { ativa: vm.classList.contains('ativa'), texto: junta(vm) },
      covil: covil && { livre: covil.classList.contains('livre'), texto: junta(covil) },
      chaves: chaves ? $$('.rastreio-chave', chaves).map((el) => ({
        nome: ($('span', el)?.firstChild?.textContent || '').trim(), resta: sub(el, 'b'), acabando: el.classList.contains('acabando')
      })) : [],
      sorteio: sorteio && { participando: sorteio.classList.contains('participando'), texto: junta(sorteio) },
      caveira: caveira && { texto: junta(caveira), vermelha: caveira.classList.contains('vermelha') },
      reinicio: reinicio && { texto: junta(reinicio), urgente: reinicio.classList.contains('urgente') }
    };
  }

  function lerMochila() {
    const m = txt($('#mochila-qtd')).match(/(\d+)\s*\/\s*(\d+)/);
    return { usados: m ? +m[1] : 0, total: m ? +m[2] : 0 };
  }
  function lerXpNivel() {
    const m = txt($('#hud-xpb-txt')).match(/([\d.,]+)\s*\/\s*([\d.,]+)/);
    return { atual: m ? numero(m[1]) : 0, total: m ? numero(m[2]) : 0 };
  }

  // ---------- ícones sem rede (chrome.storage.local, chave "icones" = { chave: dataURL }) ----------
  // Copia a imagem que o jogo já carregou (nada de pedir ao servidor). Só grava chave nova; guarda no máximo 400.
  let icones = null, ultIcones = 0;
  const iconesFalhos = new Set();
  function dataUrl(img) {
    const src = img.currentSrc || img.src || '';
    if (src.startsWith('data:')) return src.length < 40000 ? src : '';
    if (!img.complete || !img.naturalWidth) return '';
    const k = Math.min(1, 64 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }
  function capturarIcones() {
    if (!icones || Date.now() - ultIcones < 5000) return;
    ultIcones = Date.now();
    const achados = {};
    const add = (chave, el) => {
      const img = el && (el.tagName === 'IMG' ? el : $('img', el));
      if (!chave || !img || chave in icones || chave in achados || iconesFalhos.has(chave)) return;
      try { const u = dataUrl(img); if (u) achados[chave] = u; } catch { iconesFalhos.add(chave); }
    };
    for (const slot of $$('#equip .slot, #mochila .slot')) {
      if (slot.classList.contains('espolio-slot')) {
        const n = dica(slot).split('\n')[0].replace(/\s*×.*$/, '').trim();
        if (n) { espolios.add(n); add(n, slot); }
      } else add(tenta(() => lerItem(slot))?.nome, slot);
    }
    for (const el of $$('#barra .hab[data-t], #habilidades .hab[data-t]')) add('hab:' + el.dataset.t, el);
    for (const el of $$('#cartas-bolsa .carta-b')) add(txt($('span', el)), el);
    for (const el of $$('#gemas .gema-bolsa')) { const n = txt($('span', el)); if (n) { gemas.add(n); add(n, el); } }
    if (!Object.keys(achados).length) return;
    Object.assign(icones, achados);
    const todas = Object.keys(icones);
    for (const k of todas.slice(0, Math.max(0, todas.length - 400))) delete icones[k];
    tenta(() => chrome.storage.local.set({ icones }));
  }

  function lerChat() {
    return $$('#log > p').slice(-80).filter((p) => !p.dataset.lupaLoot).slice(-30).map((p) => {
      const hora = txt($('.hora', p));
      return { hora, texto: txt(p).slice(hora.length).trim(), tipo: p.className };
    });
  }

  // ---------- medidor da caçada ----------
  // Conta pelas linhas "Loot de ..." do chat do servidor (uma por abate). O tempo só corre enquanto há abate no
  // último minuto, então os números são por hora caçando. Fica salvo por personagem e não zera ao recarregar.
  const RE_LOOT = /^Loot de (.+?): ([\d.,]+[kM]?) de ouro(.*)\. \+([\d.,]+[kM]?) de experiência\.?$/;
  const BALDE = 5 * 60e3, PAUSA = 15 * 60e3, JANELA = 15 * 60e3, ATIVO = 60e3;
  const novoPend = () => ({ abates: 0, xp: 0, xpBase: 0, ouro: 0, drops: {} });
  let nome = '', cacada = null, pend = novoPend(), recentes = [], ultimoTick = Date.now(), ultimoAbate = 0, mortesAntes = null;

  function lerLinha(p) {
    const hora = txt($('.hora', p)), corpo = txt(p).slice(hora.length).trim(), m = corpo.match(RE_LOOT);
    if (!m) { tenta(() => lerOutra(p, corpo)); return; }
    p.dataset.lupaLoot = '1';
    const xp = numero(m[4]), ouro = numero(m[2]), drops = m[3].split(',').map((s) => s.trim()).filter(Boolean);
    pend.abates++; pend.xp += xp; pend.xpBase += xp / (1 + bonusLive()); pend.ouro += ouro;
    for (const d of drops) pend.drops[d] = (pend.drops[d] || 0) + 1;
    ultimoAbate = Date.now();
    recentes.push({ ts: ultimoAbate, zona: zonaAtual(), xp, ouro, drops });
    tenta(() => eventosLoot(m[1], drops));
  }

  // ---------- feed de eventos (lista circular em chrome.storage.local, chave "eventos:<nome>") ----------
  let base = false, evFila = [], evCadeia = Promise.resolve(), nomesRaridade = new Map();
  const espolios = new Set(), gemas = new Set();
  const registrar = (tipo, titulo, texto, extra = {}) => { if (base) evFila.push({ ts: Date.now(), tipo, titulo, texto, ...extra }); };
  const RE_QUAL = /\s\[([A-Z+]+)\]$/;
  // o "[Q]" da linha de loot não é a qualidade: o servidor ainda vai sortear, e o jogo escreve B enquanto isso. O drop
  // fica "?" até o log dizer "<item> foi avaliado: qualidade X." (avaliado, abaixo).
  // espólio e runa não viram evento; item com a qualidade ainda sendo sorteada vem sem o "[Q]", então não dá para
  // exigir o sufixo: vale tudo que não é espólio nem runa conhecidos (conferido de novo na hora de gravar)
  const ehEspolioOuRuna = (item) => /^Runa\b/.test(item) || espolios.has(item) || gemas.has(item);
  function atualizarConjuntos() {
    for (const s of $$('#mochila .espolio-slot')) { const n = dica(s).split('\n')[0].replace(/\s*×.*$/, '').trim(); if (n) espolios.add(n); }
    for (const el of $$('#gemas .gema-bolsa span')) { const n = txt(el); if (n) gemas.add(n); }
  }
  function eventosLoot(monstro, drops) {
    for (const d of drops) {
      const q = d.match(RE_QUAL);
      const item = d.replace(RE_QUAL, '').replace(/\s\+\d+$/, '').trim();
      if (!item || ehEspolioOuRuna(item)) continue;
      registrar('drop', item, `Loot de ${monstro}`, q ? { item, qual: '?' } : { item });
    }
  }
  // a qualidade sorteada vai para o drop "?" mais antigo desse item (e para o aviso de lendário dele); o envio corrige o
  // que já subiu para o banco pelo "avaliadoEm"
  function avaliado(item, q) {
    const pendente = (lista) => lista.find((ev) => ev.tipo === 'drop' && ev.item === item && ev.qual === '?');
    const naFila = pendente(evFila);
    if (naFila) { naFila.qual = q; return; }
    if (!nome) return;
    const chave = 'eventos:' + nome;
    evCadeia = evCadeia.then(async () => {
      const lista = (await chrome.storage.local.get(chave))[chave] || [], drop = pendente(lista);
      if (!drop) return;
      const em = Date.now();
      for (const ev of lista) {
        if (ev === drop || (ev.tipo === 'lendario' && ev.ts === drop.ts && ev.item === item && ev.qual === '?')) { ev.qual = q; ev.avaliadoEm = em; }
      }
      await chrome.storage.local.set({ [chave]: lista });
    }).catch(() => {});
  }
  // desde 26/10 os lendários e míticos são sorteados no servidor: não vêm mais na linha "Loot de", e sim numa linha
  // própria que já traz a qualidade (aplicarLendarios no jogo.js)
  const RE_LENDARIO = /^(?:Caiu|(A tarefa também rendeu)) (.+) \(qualidade (C|B|A|S|SS)\)!$/;
  const ESPERA_RARIDADE = 3000, ESPERA_RARIDADE_SERVIDOR = 15e3;      // o do servidor espera mais: mítico não pode virar lendário
  let avisouLendCheia = 0;
  function lerOutra(p, corpo) {
    if (!base) return;
    const tipo = p.className || '';
    let m;
    if ((m = corpo.match(RE_LENDARIO))) {
      const item = m[2].replace(/\s\+\d+$/, '').trim();
      registrar('drop', item, m[1] ? 'Prêmio da tarefa' : 'Caiu na caçada', { item, qual: m[3], servidor: true });
      // o que caiu na caçada entra nos drops da sessão como os da linha de loot ("Item [Q]"), já com a qualidade sorteada
      if (!m[1]) { const k = `${m[2].trim()} [${m[3]}]`; pend.drops[k] = (pend.drops[k] || 0) + 1; }
    } else if (/^Caiu um lendário, mas a mochila está cheia/.test(corpo)) {
      // o jogo repete a linha a cada minuto enquanto o lendário espera: um aviso a cada 10 min basta
      if (config.avisos.mochila && Date.now() - avisouLendCheia > 10 * 60e3) {
        avisouLendCheia = Date.now();
        avisar('mochila', 'Mochila cheia', 'Caiu um lendário: ele espera até você abrir um espaço.');
      }
    } else if ((m = corpo.match(/^O servidor descartou (.+?): lendários seguidos demais/))) {
      registrar('descarte', 'Lendário descartado', corpo);
      if (config.avisos.chao) avisar('descarte', 'Lendário descartado', `O servidor descartou ${m[1]}.`);
    } else if ((m = corpo.match(/^(.+) foi avaliado: qualidade (C|B|A|S|SS)\.?$/))) avaliado(m[1].replace(/\s\+\d+$/, '').trim(), m[2]);
    else if ((m = corpo.match(/^Sua mochila está cheia! (.+?) ficou no chão\.?$/))) {
      registrar('chao', 'Item ficou no chão', corpo, { item: m[1].replace(RE_QUAL, '').replace(/\s\+\d+$/, '').trim() });
      if (config.avisos.chao) avisar('chao', 'Mochila cheia', corpo, (n) => `Mais ${n} ${n > 1 ? 'itens ficaram' : 'item ficou'} no chão`);
    } else if (/(^|\s)chefe(\s|$)/.test(tipo) && /foi derrotado!$/.test(corpo)) registrar('chefe', 'Chefe derrotado', corpo);
    else if (/(^|\s)raro(\s|$)/.test(tipo) && /^(Lendário|Mítico)/i.test(corpo)) registrar('lendario', 'Lendário!', corpo);
  }
  function gravarEventos() {
    if (!evFila.length || !nome) return;
    const agora = Date.now();
    atualizarConjuntos();
    evFila = evFila.filter((ev) => ev.tipo !== 'drop' || !ehEspolioOuRuna(ev.item));
    // o sorteado no servidor é lendário ou mítico: se a mochila não disser qual em 15 s, fica lendário
    const espera = (ev) => (ev.servidor ? ESPERA_RARIDADE_SERVIDOR : ESPERA_RARIDADE);
    for (const ev of evFila) if (ev.tipo === 'drop' && !ev.raridade) ev.raridade = nomesRaridade.get(ev.item) || (ev.servidor && agora - ev.ts > espera(ev) ? 'lendario' : '');
    // drop sem raridade conhecida espera um pouco: o item pode ainda não ter chegado na mochila lida
    const prontos = evFila.filter((ev) => ev.tipo !== 'drop' || ev.raridade || agora - ev.ts > espera(ev));
    if (!prontos.length) { setTimeout(publicarL, 3100); return; }
    evFila = evFila.filter((ev) => !prontos.includes(ev));
    if (evFila.length) setTimeout(publicarL, 3100);
    // sem "[Q]" e sem raridade achada em 3 s é espólio que a mochila ainda não mostrou (ou item largado no chão)
    for (let k = prontos.length - 1; k >= 0; k--) if (prontos[k].tipo === 'drop' && !prontos[k].qual && !prontos[k].raridade) prontos.splice(k, 1);
    if (!prontos.length) return;
    const extras = prontos.filter((ev) => ev.tipo === 'drop' && /^(lendario|mitico)$/.test(ev.raridade))
      .map((ev) => ({ ts: ev.ts, tipo: 'lendario', titulo: ev.raridade === 'mitico' ? 'Mítico!' : 'Lendário!', texto: ev.item, item: ev.item, raridade: ev.raridade, qual: ev.qual }));
    if (config.avisos.lendario) for (const x of extras) avisar('lendario', x.titulo, `${x.item}${x.qual && x.qual !== '?' ? ' (qualidade ' + x.qual + ')' : ''}`, (n) => `Mais ${n} ${n > 1 ? 'lendários ou míticos caíram' : 'lendário ou mítico caiu'}`);
    for (const ev of prontos) { if (!ev.raridade) delete ev.raridade; delete ev.servidor; }
    const todos = [...prontos, ...extras].sort((a, b) => a.ts - b.ts), chave = 'eventos:' + nome;
    evCadeia = evCadeia.then(async () => {
      const r = await chrome.storage.local.get(chave);
      await chrome.storage.local.set({ [chave]: [...(r[chave] || []), ...todos].slice(-80) });
    }).catch(() => {});
  }

  let observador = null, publicarL = () => {}, tickL = () => {};
  function observarLog() {
    const log = $('#log');
    if (!log || observador) return;
    for (const p of $$(':scope > p', log)) if (RE_LOOT.test(txt(p).slice(txt($('.hora', p)).length).trim())) p.dataset.lupaLoot = '1';      // as que já estavam: só marca
    observador = new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeName === 'P') lerLinha(n); publicarL(); tickL(); });
    observador.observe(log, { childList: true });
  }

  const novaSessao = (agora, nivelIni = null) => ({ ini: agora, fim: agora, nivelIni, ultimoAbate: 0, seg: 0, abates: 0, xp: 0, xpBase: 0, ouro: 0, mortes: 0, zonas: {}, baldes: [], drops: {} });
  const somar = (alvo, seg, p) => { alvo.seg += seg; alvo.abates += p.abates; alvo.xp += p.xp; alvo.xpBase += p.xpBase; alvo.ouro += p.ouro; };

  async function carregarCacada(n) {
    const chave = 'cacada:' + n, r = await chrome.storage.local.get(chave);
    cacada = r[chave] || { sessoes: [] };
  }

  function tick() {
    const agora = Date.now(), dt = agora - ultimoTick;
    ultimoTick = agora;
    recentes = recentes.filter((r) => agora - r.ts < JANELA);
    const mortes = numero(txt($('#st-mortes')));
    const dm = mortesAntes != null && mortes >= mortesAntes && mortes - mortesAntes < 10 ? mortes - mortesAntes : 0;
    if ($('#st-mortes')) mortesAntes = mortes;
    if (!cacada) return;
    const cacando = agora - ultimoAbate < ATIVO;
    const seg = cacando && dt < 90e3 ? dt / 1000 : 0;      // aba dormindo (dt grande) não conta tempo
    let s = cacada.sessoes.at(-1);
    if (pend.abates || seg) {
      if (!s || agora - (s.ultimoAbate || s.fim) > PAUSA || Math.max(config.novaSessao || 0, config.novaSessaoPor?.[nome] || 0) > s.ini) {
        s = novaSessao(agora, numero(txt($('#st-nivel')) || txt($('#hud-nivel'))) || null); cacada.sessoes.push(s);
        if (cacada.sessoes.length > 30) cacada.sessoes.splice(0, cacada.sessoes.length - 30);
      }
      const zona = zonaAtual() || '?';
      somar(s, seg, pend);
      s.mortes += dm; s.fim = agora;
      if (pend.abates) s.ultimoAbate = ultimoAbate;
      somar(s.zonas[zona] ||= { seg: 0, abates: 0, xp: 0, xpBase: 0, ouro: 0 }, seg, pend);
      const t = Math.floor(agora / BALDE) * BALDE;
      let b = s.baldes.at(-1);
      if (!b || b.t !== t) { b = { t, xp: 0, xpBase: 0, abates: 0, zona }; s.baldes.push(b); if (s.baldes.length > 288) s.baldes.shift(); }      // 288 baldes de 5 min = 24 h
      b.xp += pend.xp; b.xpBase += pend.xpBase; b.abates += pend.abates; b.zona = zona;
      for (const [d, q] of Object.entries(pend.drops)) s.drops[d] = (s.drops[d] || 0) + q;
      pend = novoPend();
      tenta(() => chrome.storage.local.set({ ['cacada:' + nome]: cacada }));
    } else if (s && (dm || Object.keys(pend.drops).length)) {
      // sem abate agora: a morte e o lendário que o servidor manda depois (o que esperava espaço na mochila) vão para a última sessão
      s.mortes += dm;
      for (const [d, q] of Object.entries(pend.drops)) s.drops[d] = (s.drops[d] || 0) + q;
      pend.drops = {};
      tenta(() => chrome.storage.local.set({ ['cacada:' + nome]: cacada }));
    }
  }

  // o ritmo de abates na zona da tarefa (últimos 10 min) e se está caçando fora dela
  function extraTarefa(tarefa, zona) {
    if (!tarefa) return tarefa;
    const agora = Date.now(), ult = recentes.filter((r) => agora - r.ts < 10 * 60e3);
    const naZona = ult.filter((r) => mesmaZona(r.zona, tarefa.local));
    const minutos = naZona.length ? Math.min(10, Math.max(1, (agora - naZona[0].ts) / 60e3)) : 0;
    const ritmo = minutos ? naZona.length / minutos : 0;
    const faltam = tarefa.qtd != null ? Math.max(0, tarefa.qtd - tarefa.feitos) : null;
    return {
      ...tarefa, zona, faltam, ritmo,
      eta: ritmo && faltam != null ? faltam / ritmo : null,
      naZona: mesmaZona(zona, tarefa.local),
      cacandoFora: !tarefa.pronta && !!tarefa.local && !mesmaZona(zona, tarefa.local) && agora - ultimoAbate < ATIVO
    };
  }

  function resumoRecentes() {
    const r = { minutos: JANELA / 60e3, abates: recentes.length, xp: 0, ouro: 0, drops: {}, desde: recentes[0]?.ts || 0 };
    for (const x of recentes) { r.xp += x.xp; r.ouro += x.ouro; for (const d of x.drops) r.drops[d] = (r.drops[d] || 0) + 1; }
    r.drops = Object.entries(r.drops).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return r;
  }

  // ---------- avisos (notificações do navegador; não fazem nada no jogo) ----------
  let antes = null, avisouEta = '', avisouFora = false;
  // no máximo 1 aviso por id a cada 60 s: os que chegam dentro da janela se juntam num só, enviado quando ela fecha
  // ("plural(n)" escreve o texto do grupo; sem ele vai o último texto com a conta)
  const JANELA_AVISO = 60e3, janelas = new Map();
  const enviarAviso = (id, titulo, texto) => tenta(() => chrome.runtime.sendMessage({ tipo: 'aviso', id, titulo, texto }));
  function fecharJanela(id) {
    const j = janelas.get(id);
    if (!j) return;
    janelas.delete(id);
    if (j.n < 2) return;
    janelas.set(id, { ini: Date.now(), n: 1, t: 0 });      // o aviso do grupo abre uma janela nova
    const mais = j.n - 1;      // o 1º da janela já saiu na hora: o resumo fala só dos retidos depois dele
    enviarAviso(id, j.titulo, j.plural ? j.plural(mais) : `${j.texto} (e mais ${mais} no último minuto)`);
  }
  function avisar(id, titulo, texto, plural) {
    const agora = Date.now(), j = janelas.get(id);
    if (j && agora - j.ini < JANELA_AVISO) {
      j.n++; j.titulo = titulo; j.texto = texto; j.plural = plural;
      if (!j.t) j.t = setTimeout(() => fecharJanela(id), j.ini + JANELA_AVISO - agora);
      return;
    }
    janelas.set(id, { ini: agora, n: 1, t: 0 });
    enviarAviso(id, titulo, texto);
  }
  const nConvites = (e) => numero((e.timers.convites?.titulo || '').match(/^\d+/)?.[0]);
  // eventos e avisos que dependem de comparar dois ciclos (p vem vazio no primeiro: só registra a linha de base)
  let avisouMochila = false;
  const primeiro = (s) => numero((String(s || '').match(/\d[\d.,]*/) || [''])[0]);
  function conferirEstado(e, p) {
    const a = config.avisos, f = e.ficha?.stats, mochilaCheia = e.mochila.total > 0 && e.mochila.usados / e.mochila.total >= 0.9;
    if (!p) { avisouMochila = mochilaCheia; return; }
    if (mochilaCheia && !avisouMochila && a.mochila) avisar('mochila', 'Mochila quase cheia', `${e.mochila.usados}/${e.mochila.total} espaços usados.`);
    avisouMochila = mochilaCheia;
    const mortes = primeiro(f?.mortes), mortesP = primeiro(p.ficha?.stats?.mortes);
    if (f && mortes > mortesP && mortes - mortesP < 10) {
      registrar('morte', 'Você morreu', `Mortes: ${mortes}`);
      if (a.morte) avisar('morte', 'Você morreu', `Mortes: ${mortes}. Zona: ${e.zona}.`);
    }
    const niv = primeiro(e.nivel), nivP = primeiro(p.nivel);
    if (niv > nivP && nivP > 0) {
      registrar('nivel', 'Subiu de nível', `Nível ${niv}`);
      if (a.nivel) avisar('nivel', 'Subiu de nível', `Agora no nível ${niv}.`);
    }
    const pts = e.pontos.habilidade + e.pontos.atributo, ptsP = p.pontos.habilidade + p.pontos.atributo;
    if (pts > 0 && ptsP === 0) {
      const txtPts = [e.pontos.habilidade && `${e.pontos.habilidade} de habilidade`, e.pontos.atributo && `${e.pontos.atributo} de atributo`].filter(Boolean).join(' e ');
      registrar('pontos', 'Pontos livres', txtPts);
      if (a.pontos) avisar('pontos', 'Pontos livres', `Você tem ${txtPts} para gastar.`);
    }
    if (e.tarefa?.pronta && p.tarefa && !p.tarefa.pronta) registrar('tarefa', 'Tarefa pronta', e.tarefa.titulo);
    if (p.timers?.kick.ativo && !e.timers?.kick.ativo) registrar('bonus', 'Bônus da Kick acabou', '');
    if (p.timers?.twitch.ativo && !e.timers?.twitch.ativo) registrar('bonus', 'Bônus da Twitch acabou', '');
  }

  // o quadro de missões e o aviso de reinício: avisa na virada de "não" para "sim"
  let diaPremio = '';
  function conferirRastreio(e, p) {
    const a = config.avisos, r = e.rastreio, q = p.rastreio;
    if (!r || !q) return;
    const dia = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });      // o dia do jogo vira à meia-noite de Brasília
    if (a.premio && r.login && !q.login && diaPremio !== dia) { diaPremio = dia; avisar('premio', 'Prêmio diário', 'O prêmio diário de login está esperando você.'); }
    const prontas = (x) => (x.diarias || []).filter((d) => d.pronta).length;
    if (a.diaria && prontas(e) > prontas(p)) avisar('diaria', 'Diária pronta', 'Uma missão diária ficou pronta: dá para receber o prêmio.');
    if (a.guerra && r.guerra) {
      const g = r.guerra, fp = q.guerra?.fase;
      if (g.fase === 'aberta' && (!q.guerra || fp === 'agendada')) avisar('guerra-abre', 'Guerra de Guildas aberta', g.pronto === false ? 'A sala abriu e falta você dar pronto.' : 'A sala da Guerra de Guildas abriu.');
      else if (g.fase === 'acontecendo' && fp === 'aberta') avisar('guerra-comeca', 'Guerra de Guildas começou', 'A Guerra de Guildas está acontecendo agora.');
    }
    if (a.vilemaw && r.vilemaw?.ativa && q.vilemaw && !q.vilemaw.ativa) avisar('vilemaw', 'A Vilemaw acordou', 'A Vilemaw está acordada agora.');
    if (a.covil && r.covil?.livre && q.covil && !q.covil.livre) avisar('covil', 'Covil liberado', 'A entrada do Covil do Rei do Rio está liberada.');
    if (a.reinicio && r.reinicio && !q.reinicio) avisar('reinicio', 'Reinício do servidor', r.reinicio.texto);
  }

  function conferirAvisos(e) {
    const p = antes, a = config.avisos;
    antes = e;
    tenta(() => conferirEstado(e, p));
    if (!p) return;
    tenta(() => conferirRastreio(e, p));
    const ti = e.timers, tp = p.timers;
    if (a.kick && tp.kick.ativo && !ti.kick.ativo) avisar('kick', 'Bônus da Kick acabou', 'O bônus de XP da Kick terminou.');
    if (a.twitch && tp.twitch.ativo && !ti.twitch.ativo) avisar('twitch', 'Bônus da Twitch acabou', 'O bônus de XP da Twitch terminou.');
    if (a.voto && tp.voto?.estado !== 'pode' && ti.voto?.estado === 'pode') avisar('voto', 'Voto liberado', 'Já dá para votar no TopIdle de novo.');
    if (a.evento && !tp.evento && ti.evento) avisar('evento', 'Evento de XP começou', ti.evento);
    if (a.convites && nConvites(e) > nConvites(p)) avisar('convites', 'Convite da Dungeon', ti.convites.titulo);
    const t = e.tarefa, tt = p.tarefa;
    if (!a.tarefa || !t) { avisouFora = false; return; }
    if (t.pronta && tt && !tt.pronta) avisar('tarefa', 'Tarefa pronta', 'Volte à Fonte e fale com o Capitão da Legião.');
    const chave = `${t.titulo}|${t.qtd}`;
    if (!t.pronta && t.eta != null && t.eta <= 5 && avisouEta !== chave) { avisouEta = chave; avisar('tarefa-eta', 'Tarefa quase pronta', `Faltam ${t.faltam} abates (uns ${Math.max(1, Math.round(t.eta))} min).`); }
    if (t.cacandoFora && !avisouFora) avisar('tarefa-fora', 'Fora da zona da tarefa', `Zona da tarefa: ${t.local}. Você está caçando em: ${t.zona}. Esses abates não contam.`);
    avisouFora = !!t.cacandoFora;
  }

  // ---------- publicação para o painel ----------
  function ler() {
    // antes do login a tela de entrada está à mostra e o #st-nome ainda tem o texto fixo "Status"
    const entrada = $('#tela-entrada');
    if (entrada && !entrada.hidden && entrada.getClientRects().length) return null;
    const n = txt($('#st-nome')), zona = zonaAtual();
    if (!n || !zona) return null;
    return {
      nome: n,
      nivel: txt($('#st-nivel')) || txt($('#hud-nivel')),
      zona,
      xp: txt($('#hud-xpb-txt')),
      xpPct: txt($('#st-xp-pct')),
      ficha: tenta(lerFicha),
      tarefa: tenta(() => extraTarefa(lerTarefa(), zona)),
      diarias: tenta(lerDiarias, []),
      timers: tenta(lerTimers),
      rastreio: tenta(lerRastreio),
      bonus: tenta(lerBonus),
      chat: tenta(lerChat, []),
      recentes: resumoRecentes(),
      pontos: { habilidade: numero(txt($('#badge-hab'))), atributo: numero(txt($('#badge-atrib'))) },
      mochila: lerMochila(),
      xpNivel: lerXpNivel(),
      mercado: tenta(estadoMercado, null),
      visivel: document.visibilityState
    };
  }

  // ---------- Mercado dos jogadores (janela do Mercador, aba Comprar) ----------
  // Só com a janela do Mercado aberta: lê as fichas que o jogo desenhou (código do item, nome, quantos à venda e o
  // menor preço). Aberta, o próprio jogo atualiza a lista a cada 30 s; a Lupa não pede nada ao servidor. Os alertas de
  // preço (envio.js) dependem disso: o estado diz se a janela está aberta, em que aba e com filtro.
  const RE_CHAVE = /^(\d+)(!?)(?:\+(\d+))?(?:#([a-z]+\d))?~([A-Z]+)$/;
  function estadoMercado() {
    const jan = $('#janela-mercado');
    if (!jan || jan.hidden) return null;
    const filtro = !!($('#mercado-busca')?.value.trim() || $('[data-cat].ativa', jan)?.dataset.cat || $('#mercado-classe')?.value || $('#mercado-moeda')?.value || $('#mercado-qual')?.value);
    return { aba: $('.mj-corpo', jan)?.dataset.aba || '', filtro };
  }
  const preco = (el) => { const m = txt(el).match(/[\d.,]+\s*[kM]?/); return m ? numero(m[0]) || null : null; };
  let assinaturaMercado = '';
  function lerCardMercado(c) {
    const chave = c.dataset.grupo, m = chave.match(RE_CHAVE), b = $('b', c);
    return {
      chave, nome: txt(b), raridade: (b?.className.match(/cor-(\w+)/) || [])[1] || '',
      base: m ? `${m[1]}${m[2]}${m[3] ? '+' + m[3] : ''}~${m[5]}` : chave,      // a mesma versão sem a carta
      qual: m ? m[5] : null, refino: m ? +(m[3] || 0) : null, carta: m?.[4] || null,
      n: numero(txt($('small', c))), ouro: preco($('.mj-precos em.ouro', c)), gemas: preco($('.mj-precos em.gem', c))
    };
  }
  function lerMercado() {
    const jan = $('#janela-mercado'), lista = $('#mercado-lista');
    if (!jan || jan.hidden || !lista || $('.mj-corpo', jan)?.dataset.aba !== 'comprar') return;
    const cards = $$('.mj-card[data-grupo]', lista);
    if (!cards.length) return;
    const assin = cards.map((c) => c.dataset.grupo + '=' + txt($('small', c)) + txt($('.mj-precos', c))).join(';');
    if (assin === assinaturaMercado) return;
    assinaturaMercado = assin;
    const filtros = {
      busca: $('#mercado-busca')?.value.trim() || '', categoria: $('[data-cat].ativa', jan)?.dataset.cat || '',
      classe: $('#mercado-classe')?.value || '', moeda: $('#mercado-moeda')?.value || '', qual: $('#mercado-qual')?.value || ''
    };
    const grupos = cards.map(lerCardMercado), agora = Date.now();
    chrome.storage.local.set({ 'mercado:ultimo': { lidoEm: agora, personagem: nome, filtros, completa: !Object.values(filtros).some(Boolean), grupos } });
    tenta(() => acumularMenores(grupos, agora));
  }
  // Acumulado do menor preço visto por versão: { [chave]: { ouro, gemas, n, em } }. O card do Mercado já é o menor anúncio do grupo;
  // vale o da leitura mais recente. Some o que passou de 7 dias e guarda no máximo 400 chaves (as mais recentes). Só lê e guarda.
  const VALIDADE_MENORES = 7 * 24 * 3600e3, MAX_MENORES = 400;
  async function acumularMenores(grupos, agora) {
    const { 'mercado:menores': antigo } = await chrome.storage.local.get('mercado:menores');
    const mapa = {};
    for (const [k, v] of Object.entries(antigo || {})) if (v && agora - v.em < VALIDADE_MENORES) mapa[k] = v;
    for (const g of grupos) {
      // só a versão sem carta: é a que a Ficha consulta, e as com carta ocupariam o limite à toa
      if (!g.chave || g.carta || (g.ouro == null && g.gemas == null)) continue;
      mapa[g.chave] = { ouro: g.ouro ?? null, gemas: g.gemas ?? null, n: g.n ?? null, em: agora };
    }
    const manter = Object.entries(mapa).sort((a, b) => b[1].em - a[1].em).slice(0, MAX_MENORES);
    chrome.storage.local.set({ 'mercado:menores': Object.fromEntries(manter) });
  }

  let ultimoJson = '', ultimaEscrita = 0;
  function publicar() {
    if (!vivo()) { clearInterval(relogioLeitura); clearInterval(relogioCacada); clearInterval(relogioOla); observador?.disconnect(); obsLateral?.disconnect(); return; }
    observarLog(); observarLateral();
    const e = ler();
    tenta(() => controles(e));
    if (!e) return;
    if (e.nome !== nome) {
      nome = e.nome; cacada = null;
      carregarCacada(nome).catch(() => (cacada = { sessoes: [] }));
    }
    nomesRaridade = new Map([...(e.ficha?.equip || []), ...(e.ficha?.mochila || [])].filter((i) => i.nome && i.raridade).map((i) => [i.nome, i.raridade]));
    tenta(capturarIcones);
    if (e.timers) tenta(() => conferirAvisos(e));
    tenta(gravarEventos);
    tenta(lerMercado);
    base = true;
    const json = JSON.stringify(e);
    if (json === ultimoJson && Date.now() - ultimaEscrita < 15e3) return;
    ultimoJson = json; ultimaEscrita = Date.now();
    tenta(() => chrome.storage.local.set({ ['estado:' + e.nome]: { ...e, ts: ultimaEscrita } }));
  }

  chrome.storage.local.get('config').then((r) => aplicarConfig(r.config)).catch(() => aplicarConfig(null));
  chrome.storage.onChanged.addListener((mud, area) => { if (area === 'local' && mud.config) aplicarConfig(mud.config.newValue); });

  // ---------- agendamento ----------
  // Com a aba escondida o Chrome estica os timers, mas o MutationObserver continua disparando quando o jogo mexe
  // na tela. Então a leitura nasce das mudanças (com trava de tempo e uma chamada atrasada para não perder a última)
  // e os setInterval ficam só de reserva. O script só põe atributos no #log (ignorados aqui), então não há laço.
  function limitada(f, intervalo) {
    let ult = 0, t = 0;
    return () => {
      const espera = ult + intervalo - Date.now();
      if (espera <= 0) { clearTimeout(t); t = 0; ult = Date.now(); f(); }
      else if (!t) t = setTimeout(() => { t = 0; ult = Date.now(); f(); }, espera);
    };
  }
  publicarL = limitada(publicar, 1000);
  tickL = limitada(tick, 5000);
  let obsLateral = null;
  function observarLateral() {
    const lat = $('#lateral');
    if (!lat || obsLateral) return;
    obsLateral = new MutationObserver(() => { publicarL(); tickL(); });
    obsLateral.observe(lat, { subtree: true, childList: true, characterData: true });
  }

  const ola = () => tenta(() => chrome.runtime.sendMessage({ tipo: 'ola' })?.catch(() => {}));
  tenta(() => chrome.storage.local.get('icones').then((r) => { icones = r.icones || {}; }).catch(() => { icones = {}; }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { ola(); publicarL(); } });
  const relogioLeitura = setInterval(publicar, 5000);
  const relogioCacada = setInterval(tick, 15000);
  const relogioOla = setInterval(ola, 60000);
  ola();
  publicar();
})();
