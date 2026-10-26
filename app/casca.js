'use strict';
// Faixa do topo: desenha a partir do estado que o processo principal manda.
(function () {
  const $ = (id) => document.getElementById(id);
  const elAbas = $('abas');
  const elPainel = $('painel');
  const elRecarregar = $('recarregar');
  const elWindows = $('windows');
  const elAtualizacao = $('atualizacao');
  let estado = null;

  function criar(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto != null) el.textContent = texto;
    return el;
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
      b.title = aba.rotulo;
      b.appendChild(criar('span', null, aba.rotulo));
      b.addEventListener('click', () => { if (aba.id !== estado.ativa) window.lupaCasca.ativar(aba.id); });
      elAbas.appendChild(b);
      if (focado === aba.id) b.focus();
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
        el.title = 'Baixar a nova versão';
        el.addEventListener('click', () => window.lupaCasca.atualizar());
        break;
      case 'baixando':
        el = criar('span', 'texto num', 'baixando ' + Math.round(a.pct || 0) + '%');
        break;
      case 'pronta':
        el = criar('button', 'botao principal', 'Reiniciar e instalar');
        el.type = 'button';
        el.title = 'Fechar o app, instalar a nova versão e abrir de novo';
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

  function desenhar(novo) {
    if (!novo || !Array.isArray(novo.abas)) return;
    estado = novo;
    desenharAbas();
    const ativa = estado.abas.find((a) => a.id === estado.ativa);
    const jogo = !!ativa && ativa.tipo === 'jogo';
    elPainel.setAttribute('aria-pressed', String(!!estado.painelAberto));
    elPainel.disabled = !jogo;
    elPainel.title = jogo ? 'Mostrar ou esconder o painel da Lupa' : 'O painel só aparece numa aba de jogo';
    elRecarregar.disabled = !jogo;
    elWindows.setAttribute('aria-pressed', String(!!estado.iniciarComWindows));
    // na versão de desenvolvimento (npm start) quem roda é o electron.exe da pasta: não dá para registrar no Windows
    const instalado = !!estado.instalado;
    elWindows.disabled = !instalado;
    elWindows.title = instalado ? 'Abrir a Lupa minimizada quando o Windows iniciar' : 'Só funciona no app instalado (esta é a versão de desenvolvimento)';
    desenharAtualizacao();
  }

  elPainel.addEventListener('click', () => window.lupaCasca.alternarPainel());
  elRecarregar.addEventListener('click', () => window.lupaCasca.recarregar());
  elWindows.addEventListener('click', () => window.lupaCasca.iniciarComWindows(!(estado && estado.iniciarComWindows)));

  window.lupaCasca.aoMudar(desenhar);
  window.lupaCasca.estado().then(desenhar);
})();
