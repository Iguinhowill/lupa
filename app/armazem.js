// Lupa (app) · o chrome.storage.local do app: um JSON em userData. Lê uma vez ao abrir, guarda tudo em memória e grava
// no disco 1,5 s depois da última mudança, ou no máximo 10 s depois da primeira (caçando, o estado muda a cada segundo
// e a espera curta nunca venceria), e ao fechar. Troca o arquivo de uma vez para nunca ficar pela metade e deixa a
// versão anterior em ".bak", que é lida se o principal estiver estragado.
// Cada mudança sai no evento "mudou" no formato do chrome.storage.onChanged: { chave: { oldValue, newValue } }.
'use strict';

const fs = require('node:fs');
const { EventEmitter } = require('node:events');

// só um objeto conta como dados válidos (um JSON solto como 123 ou [] também é "estragado")
const lerJson = (arq) => {
  try { const v = JSON.parse(fs.readFileSync(arq, 'utf8')); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
};

class Armazem extends EventEmitter {
  constructor(arquivo, { espera = 1500, esperaMax = 10e3, retentar = 5000 } = {}) {
    super();
    this.arquivo = arquivo;
    this.tempos = { espera, esperaMax, retentar };
    this.espera = null;
    this.desde = 0;      // quando ficou a primeira mudança ainda não gravada
    const principal = lerJson(arquivo);
    this.principalBom = !!principal;      // estragado, ele não vira .bak (o .bak bom fica até a 1ª gravação dar certo)
    this.dados = principal || lerJson(arquivo + '.bak') || {};
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
    const agora = Date.now();
    if (!this.desde) this.desde = agora;
    clearTimeout(this.espera);
    this.espera = setTimeout(() => this.gravar(), Math.max(0, Math.min(this.tempos.espera, this.desde + this.tempos.esperaMax - agora)));
  }

  // o principal (sempre trocado inteiro, então bom) vira o .bak, e o novo entra no lugar dele. Um erro de disco
  // (antivírus segurando o arquivo, disco cheio) não derruba o app: tenta de novo em alguns segundos
  gravar() {
    clearTimeout(this.espera);
    this.espera = null;
    const tmp = this.arquivo + '.tmp';
    try {
      fs.writeFileSync(tmp, JSON.stringify(this.dados));
      if (this.principalBom) try { fs.renameSync(this.arquivo, this.arquivo + '.bak'); } catch {}
      fs.renameSync(tmp, this.arquivo);
      this.principalBom = true;
      this.desde = 0;
    } catch (e) {
      console.error('[Lupa] não gravou os dados:', e?.message || e);
      this.espera = setTimeout(() => this.gravar(), this.tempos.retentar);
      this.espera.unref?.();      // a nova tentativa não segura o processo aberto sozinha
    }
  }
}

module.exports = { Armazem };
