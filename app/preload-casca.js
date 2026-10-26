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
  // Escuta o estado novo enviado pelo processo principal; devolve uma função que cancela a escuta.
  aoMudar: (fn) => {
    const ouvinte = (_evento, estado) => fn(estado);
    ipcRenderer.on('casca:mudou', ouvinte);
    return () => ipcRenderer.removeListener('casca:mudou', ouvinte);
  },
});
