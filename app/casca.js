'use strict';
// Faixa do topo: desenha a partir do estado que o processo principal manda.
(function () {
  const $ = (id) => document.getElementById(id);
  const elAbas = $('abas');
  const elPainel = $('painel');
  const elRecarregar = $('recarregar');
  const elAjustes = $('ajustes');
  const elAtualizacao = $('atualizacao');
  const elEtiquetas = $('etiquetas');
  const elCortina = $('cortina');
  const elMenu = $('menu');
  let estado = null;
  let menuAberto = false;

  function criar(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto != null) el.textContent = texto;
    return el;
  }

  const textoAlertas = (lista) => (lista || []).map((a) => a.texto).join('\n');
  // o ponto de alerta, com a lista no tooltip
  function ponto(lista) {
    const p = criar('span', 'ponto');
    p.title = textoAlertas(lista);
    p.setAttribute('role', 'img');
    p.setAttribute('aria-label', (lista || []).length + ' alerta(s): ' + textoAlertas(lista).replace(/\n/g, '; '));
    return p;
  }

  function desenharAbas() {
    const focado = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.aba : null;
    elAbas.textContent = '';
    for (const aba of estado.abas) {
      const b = criar('button', 'aba');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(aba.id === estado.ativa));
      b.tabIndex = aba.id === estado.ativa ? 0 : -1;
      b.dataset.aba = aba.id;
      const alertas = aba.alertas || [];
      b.title = alertas.length ? aba.rotulo + '\n' + textoAlertas(alertas) : aba.rotulo;
      b.appendChild(criar('span', 'nome', aba.rotulo));
      if (alertas.length) b.appendChild(ponto(alertas));
      b.addEventListener('click', () => { if (aba.id !== estado.ativa) window.lupaCasca.ativar(aba.id); });
      elAbas.appendChild(b);
      if (focado === aba.id) b.focus();
    }
  }

  // Lado a lado: a etiqueta de cada metade (nome do personagem + ponto de alerta), na largura da metade.
  function desenharEtiquetas() {
    const lista = estado.etiquetas || [];
    elEtiquetas.hidden = !lista.length;
    elEtiquetas.textContent = '';
    for (const e of lista) {
      const d = criar('div', 'etiqueta' + (e.foco ? ' foco' : ''));
      d.style.left = e.x + 'px';
      d.style.width = e.largura + 'px';
      d.title = (e.alertas || []).length ? e.rotulo + '\n' + textoAlertas(e.alertas) : e.rotulo;
      d.appendChild(criar('span', 'nome', e.rotulo));
      if ((e.alertas || []).length) d.appendChild(ponto(e.alertas));
      elEtiquetas.appendChild(d);
    }
  }

  // Setas esquerda/direita trocam de aba (padrão de tablist).
  elAbas.addEventListener('keydown', (e) => {
    if (!estado || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const i = estado.abas.findIndex((a) => a.id === estado.ativa);
    const n = estado.abas.length;
    const prox = estado.abas[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n];
    e.preventDefault();
    window.lupaCasca.ativar(prox.id);
  });

  function desenharAtualizacao() {
    const a = estado.atualizacao || { tipo: 'dev' };
    const v = estado.versao || '';
    const foco = document.activeElement && elAtualizacao.contains(document.activeElement);
    const notas = a.notas ? '\n\nNovidades:\n' + a.notas : '';
    elAtualizacao.textContent = '';
    let el;
    switch (a.tipo) {
      case 'procurando':
        el = criar('span', 'texto', 'procurando atualização…');
        break;
      case 'em-dia':
        el = criar('button', 'texto', 'v' + v);
        el.type = 'button';
        el.title = 'Em dia. Clique para procurar de novo';
        el.addEventListener('click', () => window.lupaCasca.procurar());
        break;
      case 'disponivel':
        el = criar('button', 'botao principal', 'Atualizar para v' + String(a.versao || '').replace(/^v/, ''));
        el.type = 'button';
        el.title = 'Baixar a nova versão' + notas;
        el.addEventListener('click', () => window.lupaCasca.atualizar());
        break;
      case 'baixando':
        el = criar('span', 'texto num', 'baixando ' + Math.round(a.pct || 0) + '%');
        break;
      case 'pronta':
        el = criar('button', 'botao principal', 'Reiniciar e instalar');
        el.type = 'button';
        el.title = 'Fechar o app, instalar a nova versão e abrir de novo' + notas;
        el.addEventListener('click', () => window.lupaCasca.atualizar());
        break;
      case 'erro':
        el = criar('button', 'texto erro', 'erro ao atualizar');
        el.type = 'button';
        el.title = a.msg || 'Erro ao atualizar. Clique para procurar de novo';
        el.addEventListener('click', () => window.lupaCasca.procurar());
        break;
      default: // 'dev'
        el = criar('span', 'texto', 'v' + v + ' · dev');
    }
    if (el.tagName !== 'BUTTON') el.title = el.textContent;
    elAtualizacao.appendChild(el);
    if (foco && el.tagName === 'BUTTON') el.focus();
  }

  // ---------- menu de ajustes ----------
  function interruptor(texto, ligado, aoClicar, desabilitado, dica) {
    const b = criar('button', 'item');
    b.type = 'button';
    b.setAttribute('role', 'menuitemcheckbox');
    b.setAttribute('aria-checked', String(!!ligado));
    b.disabled = !!desabilitado;
    if (dica) b.title = dica;
    b.appendChild(criar('span', null, texto));
    b.appendChild(criar('span', 'trilho'));
    b.addEventListener('click', aoClicar);
    return b;
  }

  function desenharMenu() {
    const foco = document.activeElement && elMenu.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    elMenu.textContent = '';
    const c = window.lupaCasca;
    const instalado = !!estado.instalado;
    const iw = interruptor('Iniciar com o Windows', estado.iniciarComWindows, () => c.iniciarComWindows(!estado.iniciarComWindows), !instalado,
      instalado ? 'Abrir a Lupa minimizada quando o Windows iniciar' : 'Só funciona no app instalado (esta é a versão de desenvolvimento)');
    iw.dataset.id = 'windows';
    const fb = interruptor('Fechar para a bandeja', estado.fecharParaBandeja, () => c.opcao('fecharParaBandeja', !estado.fecharParaBandeja), false,
      'O X da janela esconde a Lupa na bandeja do Windows. Sair de verdade: menu do ícone da bandeja');
    fb.dataset.id = 'bandeja';
    const so = interruptor('Usar só a Conta 1', estado.soConta1, () => c.opcao('soConta1', !estado.soConta1), false,
      'Sem a Conta 2 a aba, o Lado a lado e a página do jogo dela não existem (economiza memória)');
    so.dataset.id = 'so1';
    elMenu.append(iw, fb, so, criar('hr'), criar('div', 'grupo', 'Largura do painel'));
    const larguras = criar('div', 'larguras');
    for (const w of [320, 380, 520]) {
      const b = criar('button', 'botao', String(w));
      b.type = 'button';
      b.dataset.id = 'l' + w;
      b.setAttribute('aria-pressed', String(estado.larguraPainel === w));
      b.addEventListener('click', () => c.opcao('larguraPainel', w));
      larguras.appendChild(b);
    }
    elMenu.append(larguras, criar('hr'), criar('div', 'grupo', 'Atalhos'));
    const dl = criar('dl', 'atalhos');
    for (const [tecla, descricao] of estado.atalhos || []) { dl.appendChild(criar('dt', null, tecla)); dl.appendChild(criar('dd', null, descricao)); }
    elMenu.appendChild(dl);
    if (foco) { const f = elMenu.querySelector('[data-id="' + foco + '"]'); if (f) f.focus(); }
  }

  async function abrirMenu() {
    await window.lupaCasca.menu(true);      // a casca cobre a janela toda antes de o menu aparecer
    menuAberto = true;
    elCortina.hidden = false;
    elMenu.hidden = false;
    elAjustes.setAttribute('aria-expanded', 'true');
    desenharMenu();
    const primeiro = elMenu.querySelector('button:not(:disabled)');
    if (primeiro) primeiro.focus();
  }
  function fecharMenu(avisar) {
    if (!menuAberto) return;
    menuAberto = false;
    elCortina.hidden = true;
    elMenu.hidden = true;
    elAjustes.setAttribute('aria-expanded', 'false');
    if (avisar) window.lupaCasca.menu(false);
  }
  elAjustes.addEventListener('click', () => { if (menuAberto) { fecharMenu(true); elAjustes.focus(); } else abrirMenu(); });
  elCortina.addEventListener('mousedown', () => fecharMenu(true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuAberto) { fecharMenu(true); elAjustes.focus(); } });

  function desenhar(novo) {
    if (!novo || !Array.isArray(novo.abas)) return;
    estado = novo;
    desenharAbas();
    desenharEtiquetas();
    const ativa = estado.abas.find((a) => a.id === estado.ativa);
    const comPainel = !!ativa && ativa.tipo !== 'central';
    const jogo = !!ativa && ativa.tipo === 'jogo' || (!!ativa && ativa.tipo === 'lado');
    elPainel.setAttribute('aria-pressed', String(!!estado.painelAberto));
    elPainel.disabled = !comPainel;
    elPainel.title = comPainel ? 'Mostrar ou esconder o painel da Lupa (Ctrl+B)' : 'O painel só aparece numa aba de jogo';
    elRecarregar.disabled = !jogo;
    elRecarregar.title = ativa && ativa.tipo === 'lado' ? 'Recarregar o jogo da metade em foco (F5)' : 'Recarregar o jogo desta aba (F5)';
    elAjustes.title = 'Ajustes e atalhos\n' + (estado.atalhos || []).map((a) => a[0] + '  ' + a[1]).join('\n');
    desenharAtualizacao();
    // o estado diz que o menu fechou por fora (a janela perdeu o foco)
    if (menuAberto && estado.menuAberto === false) fecharMenu(false);
    else if (menuAberto) desenharMenu();
  }

  elPainel.addEventListener('click', () => window.lupaCasca.alternarPainel());
  elRecarregar.addEventListener('click', () => window.lupaCasca.recarregar());

  window.lupaCasca.aoMudar(desenhar);
  window.lupaCasca.estado().then(desenhar);
})();
