// Lupa (app) · textos puros do app: os alertas de uma conta (ponto na aba) e as notas da versão (sem Electron)
'use strict';

const MIN_SEM_LEITURA = 3 * 60e3;      // o jogo escreve o estado quase todo segundo: 3 min calado é sem leitura
const MOCHILA_CHEIA = 0.9;

const n = (x) => (Number.isFinite(x) ? x : 0);

// `est` é o último `estado:<nome>` da conta (ou undefined); campos novos podem faltar nos antigos. `desde` é quando o
// app abriu: antes de passar 3 min dele, um estado velho do disco não conta como "sem leitura". Devolve [{ tipo, texto }]
function alertasDe(est, agora, desde = 0) {
  if (!est || typeof est !== 'object') return [];
  const lista = [];
  if (est.tarefa && est.tarefa.pronta) lista.push({ tipo: 'tarefa', texto: 'Tarefa pronta para entregar' });
  const m = est.mochila;
  if (m && n(m.total) > 0 && n(m.usados) / m.total >= MOCHILA_CHEIA) {
    lista.push({ tipo: 'mochila', texto: `Mochila ${Math.round((100 * m.usados) / m.total)}% cheia (${m.usados}/${m.total})` });
  }
  const p = est.pontos;
  if (p && (n(p.habilidade) > 0 || n(p.atributo) > 0)) {
    const partes = [];
    if (n(p.habilidade) > 0) partes.push(`${p.habilidade} de habilidade`);
    if (n(p.atributo) > 0) partes.push(`${p.atributo} de atributo`);
    lista.push({ tipo: 'pontos', texto: `Pontos livres: ${partes.join(' e ')}` });
  }
  if (est.rastreio && est.rastreio.login) lista.push({ tipo: 'premio', texto: 'Prêmio diário ainda não pego' });
  if (Number.isFinite(est.ts)) {
    const parado = agora - Math.max(est.ts, desde);
    if (parado > MIN_SEM_LEITURA) lista.push({ tipo: 'sem-leitura', texto: `Sem leitura há ${Math.floor(parado / 60e3)} min` });
  }
  return lista;
}

// releaseNotes do electron-updater: HTML solto ou lista [{ version, note }]. Vira texto puro de até `max` caracteres
function notasEmTexto(notas, max = 300) {
  const bruto = Array.isArray(notas) ? notas.map((x) => (x && x.note) || '').join('\n') : String(notas || '');
  const t = bruto
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\s*(br|\/p|\/h\d|\/div|\/ul|\/ol)[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{2,}/g, '\n').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

module.exports = { alertasDe, notasEmTexto, MIN_SEM_LEITURA };
