// Lupa (app) · ações no jogo, só no app. Liberadas pelo Brunox em 27/10/2026, que pediu também que passassem pela proteção
// contra bots do jogo. Rodam SÓ quando o jogador pede: o botão "Entregar e seguir" do painel ou o Alt+L. O main autoriza a
// aba por pouco tempo e cada clique ou tecla é uma entrada de verdade (sendInputEvent), no mesmo lugar em que a pessoa
// clicaria, pelos botões do próprio jogo. Nada aqui roda sozinho nem em laço.
// Entra no preload do jogo depois do content.js (copiar-lupa.mjs): usa o ipcRenderer e o `chrome` do shim-jogo.js e o
// OFERTA do oferta.js.
(() => {
  'use strict';

  const $ = (s, raiz = document) => raiz.querySelector(s);
  const $$ = (s, raiz = document) => [...raiz.querySelectorAll(s)];
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const mesma = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  const curto = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' mi' : n >= 1e3 ? Math.round(n / 1e3) + ' mil' : String(Math.round(n)));
  // à mostra de verdade: sem [hidden] no caminho, com tamanho e dentro da janela
  function visivel(el) {
    if (!el || el.closest('[hidden]')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  }

  class Parou extends Error {}
  let parar = false, rodando = false;
  // espera cond() devolver algo, até `ms`; o Parar do painel interrompe no meio
  async function esperar(cond, ms, passo = 150) {
    const fim = Date.now() + ms;
    for (;;) {
      if (parar) throw new Parou();
      let v = null;
      try { v = cond(); } catch {}
      if (v) return v;
      if (Date.now() >= fim) return null;
      await pausa(passo);
    }
  }
  // Com a janela do app coberta por outra, o Chromium marca a página como escondida e descarta o apertar do mouse (só o
  // mover chega). Antes de cada entrada, espera a página voltar à vista (até 1 min), avisando no painel.
  let avisar = () => null;      // o "Entregar e seguir" troca por um que escreve no painel e devolve como desfazer o aviso
  async function aVista() {
    if (document.visibilityState === 'visible') return;
    const volta = avisar('Deixe a janela da Lupa à vista: com ela coberta por outra, os cliques não chegam ao jogo.');
    if (!(await esperar(() => document.visibilityState === 'visible', 60e3))) throw new Error('A janela da Lupa ficou coberta por outra, e assim os cliques não chegam ao jogo. Deixe-a à vista e aperte de novo.');
    await pausa(300);
    volta?.();
  }
  // clique de verdade no meio do elemento; ele precisa ser o que está por cima nesse ponto (senão o clique pegaria outra coisa)
  async function clicar(el) {
    if (parar) throw new Parou();
    await aVista();
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const topo = document.elementFromPoint(x, y);
    if (!topo || !(topo === el || el.contains(topo))) throw new Error('Tem alguma janela por cima do botão do jogo. Feche e aperte de novo.');
    if (!(await ipcRenderer.invoke('acao:clicar', { x, y }))) {
      if (parar) throw new Parou();      // o Parar apaga a autorização no main: o clique que estava a caminho volta recusado
      throw new Error('O app não deixou clicar (a aba saiu da tela ou o tempo da ação acabou).');
    }
  }
  // tecla de atalho do próprio jogo (B volta para a Fonte, M abre o mapa), para quando a coluna da direita está escondida.
  // A tecla depende da janela do app em foco no Windows: por isso o botão, quando está à vista, vem primeiro
  async function tecla(k) {
    if (parar) throw new Parou();
    await aVista();
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) a.blur();      // no chat a tecla viraria texto
    if (!(await ipcRenderer.invoke('acao:tecla', { tecla: k }))) {
      if (parar) throw new Parou();
      throw new Error('O app não deixou apertar a tecla.');
    }
  }

  // clica (ou aperta a tecla) e espera a tela mudar (cond) até `total` ms. Se em `cedo` ms nada mudou e o botão continua
  // ali, a entrada pode ter se perdido: repete uma vez. Seguro em cada passo da entrega: "entregar", "tarefa" e a oferta
  // somem da tela no instante em que o clique pega (então só repete se ele se perdeu); voltar já voltando não faz nada;
  // falar de novo com o Capitão recomeça a mesma conversa; a zona é só escolhida de novo; a viagem repetida é ignorada.
  // O que abre e fecha repete mais tarde (o mapa, 2,5 s) ou não repete (a aba Missões)
  async function clicarAte(el, cond, total, cedo = 1500) {
    await clicar(el);
    const v = await esperar(cond, cedo);
    if (v) return v;
    if (el.isConnected && visivel(el)) await clicar(el);
    return esperar(cond, Math.max(0, total - cedo));
  }
  // as teclas da entrega (B e M) respondem na hora. Por padrão repetem depois de 2,5 s sem mudança, por causa do M, que abre
  // e fecha o mapa (o botão Mapa é chamado com o mesmo prazo); a volta à Fonte (botão ou B) é chamada com 5 s
  async function teclaAte(k, cond, total, cedo = 2500) {
    await tecla(k);
    const v = await esperar(cond, cedo);
    if (v) return v;
    await tecla(k);
    return esperar(cond, Math.max(0, total - cedo));
  }
  // o botão do jogo, se está à vista; senão a tecla de atalho dele (com a coluna da direita escondida)
  const botaoOuTecla = (sel, k, cond, total, cedo) => (visivel($(sel)) ? clicarAte($(sel), cond, total, cedo) : teclaAte(k, cond, total, cedo));

  const nome = () => txt($('#st-nome'));
  const zona = () => txt($('#hud-local'));
  const palavra = (w) => { const b = $(`#npc-palavras [data-palavra="${w}"]`); return visivel(b) ? b : null; };
  const ultimaFala = () => txt($$('#npc-conversa p.ele').at(-1));
  const status = (quem, x) => chrome.storage.local.set({ ['acao:' + quem]: { ...x, em: Date.now() } }).catch(() => {});
  const rastreioTarefa = () => { const b = $('#rastreio-tarefa'); return visivel(b) ? b : null; };

  // ---------- Entregar e seguir ----------
  // Fonte (o botão Voltar ou a tecla B, 4 s) → rastreio da tarefa (o personagem anda até o Capitão) → "entregar" → "tarefa"
  // → a oferta que mais rende no seu ritmo → mapa (o botão ou a tecla M) → a zona da tarefa → "Ir" (3 s). Cada passo confere a
  // tela antes do seguinte.
  async function entregarESeguir(quem) {
    let atual = '';
    const passo = (texto) => { atual = texto; status(quem, { tipo: 'tarefa', estado: 'rodando', texto }); };
    avisar = (texto) => { status(quem, { tipo: 'tarefa', estado: 'rodando', texto }); return () => passo(atual); };
    // confere na tela agora, não na última leitura da Lupa (que demora até 5 s): apertar de novo logo depois de entregar
    // mandaria o personagem de volta para a Fonte à toa
    const t = $('#rastreio-tarefa');
    if (!t || t.hidden) throw new Error('Sem tarefa: pegue a primeira com o Capitão da Legião; daí em diante o botão entrega e pega as próximas.');
    if (!t.classList.contains('pronta')) {
      const p = txt($('small', t)).match(/^(\d+)\/(\d+)/);
      throw new Error(`A tarefa ainda não terminou${p ? ` (${p[1]}/${p[2]})` : ''}.`);
    }

    if (!mesma(zona(), 'Fonte')) {
      passo('Voltando para a Fonte…');
      // a volta leva 4 s (2 s com o Barão): repetir só se depois de 5 s ainda não chegou
      if (!(await botaoOuTecla('#voltar-base', 'b', () => mesma(zona(), 'Fonte'), 15e3, 5e3))) throw new Error('Não chegou à Fonte (em combate ou morto?). Tente de novo daqui a pouco.');
      await pausa(700);
    }

    passo('Indo até o Capitão da Legião…');
    let rt = await esperar(rastreioTarefa, 4e3);
    if (!rt && visivel($('#rastreio-topo'))) {      // o quadro de missões recolhido: abre pela aba Missões (abre e fecha: sem repetir)
      await clicar($('#rastreio-topo'));
      rt = await esperar(rastreioTarefa, 3e3);
    }
    if (!rt) throw new Error('Não achei a tarefa no quadro de missões do jogo.');
    // o personagem anda até o Capitão: o segundo clique, se precisar, só vem depois de 3 s
    const entregar = await clicarAte(rt, () => palavra('entregar'), 20e3, 3e3);
    if (!entregar) throw new Error('A conversa com o Capitão não abriu.');
    await pausa(300);

    passo('Entregando a tarefa…');
    const resp = await clicarAte(entregar, () => palavra('tarefa') || (/mochila está cheia/i.test(ultimaFala()) && 'cheia'), 8e3);
    if (resp === 'cheia') throw new Error('Mochila cheia: o Capitão não tem onde pôr o item. Venda ou guarde algo e aperte de novo.');
    if (!resp) throw new Error('O Capitão não respondeu à entrega.');
    await pausa(300);

    passo('Escolhendo a próxima tarefa…');
    const linhas = await clicarAte(resp, () => { const l = $$('#npc-troca .troca-linha').filter((x) => $('[data-tarefa]', x)); return l.length ? l : null; }, 6e3);
    if (!linhas) throw new Error('As ofertas do Capitão não apareceram.');
    const ofertas = linhas.map((l) => {
      const b = $('.info b', l)?.cloneNode(true);
      b?.querySelectorAll('.selo-tarefa').forEach((s) => s.remove());
      return { ...OFERTA.lerOferta(txt(b), txt($('.info small', l))), botao: $('[data-tarefa]', l), titulo: txt(b), tipo: txt($('.selo-tarefa', l)) };
    });
    // o seu ritmo em cada zona, pelas caçadas que a Lupa mediu: a escolha é pelo XP por hora caçando com a tarefa
    const ritmos = OFERTA.ritmosDe((await chrome.storage.local.get('cacada:' + quem))['cacada:' + quem]?.sessoes);
    const k = OFERTA.escolher(ofertas, ritmos);
    if (k < 0) throw new Error('Não consegui ler as ofertas do Capitão (o jogo mudou o texto?). Escolha uma e vá caçar.');
    const o = ofertas[k], seu = OFERTA.noSeuRitmo(o, ofertas, ritmos);
    await pausa(300);
    // aceita: o jogo fecha a conversa em 0,6 s (dizer('tchau')) e o rastreio volta com a tarefa nova ("0/120 · <zona>")
    const aceitou = () => { const r = $('#rastreio-tarefa'); return $('#janela-npc')?.hidden || (r && !r.hidden && !r.classList.contains('pronta') && mesma(txt($('small', r)).split(' · ').at(-1), o.zona)); };
    if (!(await clicarAte(o.botao, aceitou, 4e3))) throw new Error('O Capitão não aceitou a tarefa.');
    const nova = `${o.titulo}${o.tipo ? ` (${o.tipo})` : ''}, ` + (seu
      ? `~${Math.max(1, Math.round(seu.min))} min no seu ritmo, ${curto(seu.xpHora)} de XP/h com o prêmio`
      : `~${Math.round(o.min)} min pelo jogo (a Lupa ainda não mediu você nessas zonas)`);
    // a conversa fecha 0,6 s depois do aceite: o mapa não pode abrir por baixo dela
    if (!(await esperar(() => $('#janela-npc')?.hidden, 2e3))) throw new Error(`Tarefa nova: ${nova}. A conversa com o Capitão não fechou: a viagem fica com você.`);

    passo(`Indo para ${o.zona}…`);
    const mapaAberto = () => $('#janela-mapa') && !$('#janela-mapa').hidden;
    if (!mapaAberto() && !(await botaoOuTecla('#abrir-mapa', 'm', mapaAberto, 5e3, 2500))) throw new Error(`Tarefa nova: ${nova}. O mapa não abriu: a viagem fica com você.`);
    const mk = await esperar(() => { const m = $$('#marcadores .marcador').find((b) => mesma(b.getAttribute('aria-label'), o.zona)); return visivel(m) ? m : null; }, 3e3);
    if (!mk) throw new Error(`Tarefa nova: ${nova}. Não achei ${o.zona} no mapa do Rift: a viagem fica com você.`);
    const ir = await clicarAte(mk, () => { const b = $(`#mapa-info [data-ir="${mk.dataset.local}"]`); return b && !b.disabled && visivel(b) ? b : null; }, 3e3);
    if (!ir) throw new Error(`Tarefa nova: ${nova}. O mapa não deixou viajar para ${o.zona}.`);
    if (!(await clicarAte(ir, () => mesma(zona(), o.zona), 12e3))) throw new Error(`Tarefa nova: ${nova}. A viagem para ${o.zona} não terminou (foi cancelada?).`);
    return `Tarefa nova: ${nova}. Caçando em ${o.zona}.`;
  }

  // ---------- Alt+L: a setinha do jogo que esconde e mostra a coluna da direita ----------
  async function alternarColuna() {
    const b = $('#bt-esconder-coluna');
    if (visivel(b)) await clicar(b);
  }

  ipcRenderer.on('acao:iniciar', async (_e, { tipo } = {}) => {
    if (rodando) return;
    rodando = true; parar = false;
    const quem = nome();
    try {
      if (tipo === 'coluna') await alternarColuna();
      else if (tipo === 'tarefa' && quem) {
        status(quem, { tipo, estado: 'rodando', texto: 'Começando…' });
        status(quem, { tipo, estado: 'ok', texto: await entregarESeguir(quem) });
      }
    } catch (e) {
      if (tipo === 'tarefa' && quem) status(quem, e instanceof Parou ? { tipo, estado: 'parado', texto: 'Parado por você.' } : { tipo, estado: 'erro', texto: String(e?.message || e) });
    } finally {
      rodando = false; parar = false; avisar = () => null;
      ipcRenderer.invoke('acao:fim').catch(() => {});
    }
  });
  ipcRenderer.on('acao:parar', () => { if (rodando) parar = true; });
})();
