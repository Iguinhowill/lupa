'use strict';
// Preload da casca (faixa de abas). Em sandbox só dá para usar require('electron').
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lupaCasca', {
  estado: () => ipcRenderer.invoke('casca:estado'),
  ativar: (id) => ipcRenderer.invoke('casca:ativar', id),
  alternarPainel: () => ipcRenderer.invoke('casca:painel'),
  recarregar: () => ipcRenderer.invoke('casca:recarregar'),
  procurar: () => ipcRenderer.invoke('casca:procurar'),
  atualizar: () => ipcRenderer.invoke('casca:atualizar'),
  iniciarComWindows: (ligado) => ipcRenderer.invoke('casca:iniciarComWindows', !!ligado),
  // menu de ajustes: aberto, a casca passa a cobrir a janela toda (o menu abre sobre o jogo)
  menu: (aberto) => ipcRenderer.invoke('casca:menu', !!aberto),
  // opção do menu: 'fecharParaBandeja' (boolean), 'larguraPainel' (320, 380 ou 520), 'soConta1' (boolean)
  opcao: (chave, valor) => ipcRenderer.invoke('casca:opcao', { chave, valor }),
  // Escuta o estado novo enviado pelo processo principal; devolve uma função que cancela a escuta.
  aoMudar: (fn) => {
    const ouvinte = (_evento, estado) => fn(estado);
    ipcRenderer.on('casca:mudou', ouvinte);
    return () => ipcRenderer.removeListener('casca:mudou', ouvinte);
  },
});
