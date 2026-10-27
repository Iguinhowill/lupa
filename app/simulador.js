// Lupa (app) · simulador do "Onde gastar o ouro": roda o combate do motor PÚBLICO do jogo numa página escondida e isolada.
// O motor (lolidle.com/js/motor.js e o que ele importa: os mesmos arquivos que a página do jogo carrega) é baixado para a pasta
// do app e servido à página pelo protocolo lupasim://. A página fica numa sessão própria, em memória, com a sandbox do Chromium,
// sem preload e sem rede: o CSP só deixa carregar o próprio lupasim:// e a sessão cancela qualquer outro pedido. Não usa as
// sessões das contas e não fala com o servidor do jogo: só baixa os arquivos públicos, de tempos em tempos.
'use strict';

const { protocol, session, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const ESQUEMA = 'lupasim';
const BASE_JOGO = 'https://lolidle.com/js/';
const VALIDADE_MOTOR = 6 * 3600e3;      // baixa de novo depois disso (o jogo muda quase todo dia)
const MAX_ARQUIVOS = 400, MAX_BYTES = 5e6;      // um motor fora disso não é o do jogo: recusa antes de baixar o resto
// uma rodada que passa do prazo travou: no mínimo 10 min, ou 4 vezes o tempo esperado (uns 0,75 s por hora simulada por trabalhador)
const PRAZO_MIN = 10 * 60e3, MS_POR_MINUTO_SIMULADO = 12.5;
const PRAZO_BAIXAR = 30e3;                     // por arquivo do motor
// os nomes vêm dos imports de arquivos baixados: só caminhos simples dentro de js/, nunca subindo de pasta
const NOME_OK = /^[\w-]+(\/[\w-]+)*\.js$/;
const importsDe = (src) => [...src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)|import\s*['"](\.{1,2}\/[^'"]+)['"]/g)]
  .map((m) => (m[1] || m[2] || m[3]).replace(/\?.*$/, ''));
const CSP = "default-src 'none'; script-src lupasim:; worker-src lupasim:";
const TIPOS = { '.js': 'text/javascript; charset=utf-8', '.html': 'text/html; charset=utf-8' };

// antes do app ficar pronto (o Electron exige): o lupasim:// funciona como https para módulos e trabalhadores
function registrarEsquema() {
  protocol.registerSchemesAsPrivileged([{ scheme: ESQUEMA, privileges: { standard: true, secure: true } }]);
}

// o corpo da resposta como texto, parando (sem guardar o resto) se passar de max bytes
async function lerAte(r, max, nome) {
  if (Number(r.headers.get('content-length')) > max) throw new Error(`${nome}: grande demais`);
  const partes = [], leitor = r.body.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await leitor.cancel().catch(() => {}); throw new Error(`${nome}: grande demais`); }
    partes.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(partes));
}

// baixa motor.js e tudo que ele importa para pasta/<novo> e só então troca pela cópia em uso. Devolve { sha, em, arquivos }
async function baixarMotor(pasta, buscar = fetch) {
  const nova = path.join(pasta, 'novo'), atual = path.join(pasta, 'atual');
  fs.rmSync(nova, { recursive: true, force: true });
  fs.mkdirSync(nova, { recursive: true });
  const feitos = new Map();
  const seguir = async (nome) => {
    if (!NOME_OK.test(nome)) throw new Error('import com caminho fora do padrão (recusado): ' + nome);
    if (feitos.has(nome)) return;
    if (feitos.size >= MAX_ARQUIVOS) throw new Error('arquivos demais na cadeia do motor');
    const arq = path.resolve(nova, nome);
    if (!arq.startsWith(path.resolve(nova) + path.sep)) throw new Error('import fora da pasta (recusado): ' + nome);
    feitos.set(nome, '');
    const r = await buscar(BASE_JOGO + nome, { headers: { 'user-agent': 'Lupa (app, simulador de build)' }, signal: AbortSignal.timeout(PRAZO_BAIXAR) });
    if (!r.ok) throw new Error(`${nome}: HTTP ${r.status}`);
    const src = await lerAte(r, MAX_BYTES, nome);
    feitos.set(nome, src);
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    fs.writeFileSync(arq, src);
    for (const imp of importsDe(src)) await seguir(path.posix.normalize(path.posix.join(path.posix.dirname(nome), imp)));
  };
  await seguir('motor.js');
  const meta = { sha: crypto.createHash('sha256').update(feitos.get('motor.js')).digest('hex'), em: Date.now(), arquivos: feitos.size };
  fs.writeFileSync(path.join(nova, '.lupa-motor.json'), JSON.stringify(meta));
  // a cópia em uso sai de lado antes e só é apagada depois que a nova entrou (no Windows o antivírus às vezes segura a pasta)
  const velha = path.join(pasta, 'velha');
  const apagarVelha = () => { try { fs.rmSync(velha, { recursive: true, force: true }); } catch {} };      // a que sobrar não atrapalha
  apagarVelha();
  if (fs.existsSync(velha)) fs.renameSync(velha, path.join(pasta, 'velha-' + Date.now()));      // presa pelo antivírus: fica de lado
  if (fs.existsSync(atual)) fs.renameSync(atual, velha);
  try { fs.renameSync(nova, atual); } catch (e) { if (fs.existsSync(velha)) fs.renameSync(velha, atual); throw e; }
  apagarVelha();
  return meta;
}
const metaMotor = (pasta) => { try { return JSON.parse(fs.readFileSync(path.join(pasta, 'atual', '.lupa-motor.json'), 'utf8')); } catch { return null; } };

// a cópia do motor em uso: baixa se não tem ou se passou da validade; sem internet, segue com a que tem
async function motorPronto(pasta) {
  const m = metaMotor(pasta);
  if (m && Date.now() - m.em < VALIDADE_MOTOR) return m;
  try { return await baixarMotor(pasta); } catch (e) { if (m) return { ...m, velho: true }; throw new Error('não deu para baixar o motor do jogo: ' + (e.message || e)); }
}

let sessaoSim = null;
// a sessão do simulador: em memória, só o lupasim://, nenhuma permissão. pastaSim: app/sim; pastaJogo: a cópia do motor
function prepararSessao(pastaSim, pastaJogo) {
  if (sessaoSim) return sessaoSim;
  const ses = session.fromPartition('lupa-simulador');
  ses.protocol.handle(ESQUEMA, (req) => {
    const u = new URL(req.url);
    let arq = null;
    if (u.host === 'app') {
      const p = decodeURIComponent(u.pathname).replace(/^\/+/, '');
      if (p.startsWith('jogo/') && NOME_OK.test(p.slice(5))) arq = path.resolve(pastaJogo, 'atual', p.slice(5));
      else if (['sim.html', 'sim.js', 'sim-trabalho.js'].includes(p)) arq = path.join(pastaSim, p);
      if (arq && !arq.startsWith(path.resolve(p.startsWith('jogo/') ? path.join(pastaJogo, 'atual') : pastaSim) + path.sep)) arq = null;
    }
    if (!arq || !fs.existsSync(arq)) return new Response('não achei', { status: 404 });
    return new Response(fs.readFileSync(arq), { headers: { 'content-type': TIPOS[path.extname(arq)] || 'text/plain', 'content-security-policy': CSP, 'cache-control': 'no-store' } });
  });
  ses.webRequest.onBeforeRequest((d, cb) => cb({ cancel: !d.url.startsWith(ESQUEMA + ':') }));
  ses.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  sessaoSim = ses;
  return ses;
}

// quantos trabalhadores: um terço dos núcleos, de 1 a 4 (o jogo e o resto do PC seguem com folga)
const quantosTrabalhadores = () => Math.max(1, Math.min(4, Math.floor((os.availableParallelism?.() || os.cpus().length) / 3)));

// roda os combates numa janela escondida que nasce e morre aqui. aoAndar({ feito, total }) até uma vez por segundo (a página manda
// pelo console: um executeJavaScript no meio só voltava quando a rodada inteira acabava). Devolve { [id]: resultado }
async function rodarCombates({ pastaSim, pastaJogo, jobs, aoAndar }) {
  const ses = prepararSessao(pastaSim, pastaJogo);
  const jan = new BrowserWindow({ show: false, width: 200, height: 200, webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, spellcheck: false } });
  jan.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  jan.webContents.on('will-navigate', (ev) => ev.preventDefault());
  jan.webContents.on('console-message', (ev) => {
    const m = /^lupa-andamento:(.*)$/.exec(String(ev?.message ?? ''));
    if (m) try { const a = JSON.parse(m[1]); aoAndar?.({ feito: Number(a.feito) || 0, total: Number(a.total) || 0 }); } catch {}
  });
  // com prazo e atento à queda da página: sem isso, um laço no motor ou a página caindo deixaria a conta "rodando" para sempre
  let relogio = null;
  const n = quantosTrabalhadores(), minutos = jobs.reduce((s, j) => s + (j.sementes?.length || 1) * (j.minutos || 60), 0);
  const ms = Math.max(PRAZO_MIN, (4 * minutos * MS_POR_MINUTO_SIMULADO) / n);
  const prazo = new Promise((_ok, falha) => { relogio = setTimeout(() => falha(new Error(`a simulação passou de ${Math.round(ms / 60e3)} min e foi interrompida`)), ms); });
  const caiu = new Promise((_ok, falha) => jan.webContents.once('render-process-gone', (_e, d) => falha(new Error(`a página do simulador caiu (${d?.reason || '?'})`))));
  prazo.catch(() => {}); caiu.catch(() => {});
  try {
    await Promise.race([jan.loadURL(ESQUEMA + '://app/sim.html'), prazo, caiu]);
    // o simulador come CPU: prioridade abaixo do normal, para o jogo não sentir
    try { os.setPriority(jan.webContents.getOSProcessId(), os.constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
    return await Promise.race([jan.webContents.executeJavaScript(`rodar(${JSON.stringify(jobs)}, ${n})`), prazo, caiu]);
  } finally {
    clearTimeout(relogio);
    // fecha de verdade antes de devolver: com destroy() a próxima janela pegava o processo que estava morrendo e o lupasim://
    // falhava (ERR_FAILED) na segunda etapa
    await new Promise((ok) => {
      if (jan.isDestroyed()) return ok();
      const t = setTimeout(() => { if (!jan.isDestroyed()) jan.destroy(); ok(); }, 5000);
      jan.once('closed', () => { clearTimeout(t); ok(); });
      jan.close();
    });
  }
}

module.exports = { registrarEsquema, baixarMotor, motorPronto, metaMotor, rodarCombates, importsDe, NOME_OK };
