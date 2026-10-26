// Lupa (app) · o chrome.storage.local do app: um JSON em userData. Lê uma vez ao abrir, guarda tudo em memória e grava
// no disco 1,5 s depois da última mudança (e ao fechar), trocando o arquivo de uma vez para nunca ficar pela metade.
// Cada mudança sai no evento "mudou" no formato do chrome.storage.onChanged: { chave: { oldValue, newValue } }.
'use strict';

const fs = require('node:fs');
const { EventEmitter } = require('node:events');

class Armazem extends EventEmitter {
  constructor(arquivo) {
    super();
    this.arquivo = arquivo;
    this.dados = {};
    this.espera = null;
    try { this.dados = JSON.parse(fs.readFileSync(arquivo, 'utf8')) || {}; } catch { this.dados = {}; }
  }

  // como o chrome.storage.local.get: null (tudo), uma chave, uma lista ou { chave: padrão }
  get(chaves) {
    const copia = (k) => structuredClone(this.dados[k]);
    if (chaves == null) return structuredClone(this.dados);
    if (typeof chaves === 'string') chaves = [chaves];
    if (Array.isArray(chaves)) return Object.fromEntries(chaves.filter((k) => k in this.dados).map((k) => [k, copia(k)]));
    return Object.fromEntries(Object.entries(chaves).map(([k, padrao]) => [k, k in this.dados ? copia(k) : padrao]));
  }

  set(obj) {
    const mud = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (v === undefined) continue;
      mud[k] = { oldValue: this.dados[k], newValue: v };
      this.dados[k] = structuredClone(v);
    }
    this.avisar(mud);
  }

  remove(chaves) {
    const mud = {};
    for (const k of [].concat(chaves || [])) {
      if (!(k in this.dados)) continue;
      mud[k] = { oldValue: this.dados[k] };
      delete this.dados[k];
    }
    this.avisar(mud);
  }

  avisar(mud) {
    if (!Object.keys(mud).length) return;
    this.emit('mudou', mud);
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.gravar(), 1500);
  }

  gravar() {
    clearTimeout(this.espera);
    this.espera = null;
    const tmp = this.arquivo + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.dados));
    fs.renameSync(tmp, this.arquivo);
  }
}

module.exports = { Armazem };
