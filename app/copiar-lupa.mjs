// Lupa (app) · `npm run preparar`: copia ../lupa para app/lupa e gera app/gerado/preload-jogo.js.
// As duas saídas são geradas (fora do git): não edite à mão, mexa em ../lupa, shim-jogo.js ou app-chrome.js.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const origem = path.resolve(aqui, '..', 'lupa');
const destino = path.join(aqui, 'lupa');
const gerado = path.join(aqui, 'gerado');
// o manifest, o background e o LEIAME são só da extensão; o app tem os dele no processo principal
const fora = new Set(['manifest.json', 'background.js', 'LEIAME.md']);

if (!existsSync(origem)) throw new Error('Pasta da Lupa não encontrada: ' + origem);

rmSync(destino, { recursive: true, force: true });
cpSync(origem, destino, {
  recursive: true,
  filter: (src) => !(path.dirname(src) === origem && fora.has(path.basename(src))),
});

// o Monte Carlo da forja do site (calculos.js) vai junto das tabelas: o Onde gastar o ouro (gastar.js) usa o mesmo
cpSync(path.resolve(aqui, '..', 'site', 'src', 'calculos.js'), path.join(destino, 'calculos.js'));

// app-chrome.js vai para dentro de lupa/ e entra como primeiro <script>, antes de qualquer código da Lupa
cpSync(path.join(aqui, 'app-chrome.js'), path.join(destino, 'app-chrome.js'));
for (const pagina of ['painel.html', 'central.html']) {
  const arq = path.join(destino, pagina);
  const html = readFileSync(arq, 'utf8');
  if (!html.includes('<script src="planos.js"></script>')) throw new Error(pagina + ': não achei o script planos.js');
  writeFileSync(arq, html.replace('<script src="planos.js"></script>', '<script src="app-chrome.js"></script>\n<script src="planos.js"></script>'));
}

// preload do jogo = shim do chrome + content.js (IIFE que usa o `chrome` do escopo) + as ações que o jogador pede
// (oferta.js e acao-jogo.js, que usam o ipcRenderer do shim), só no lolidle.com
const shim = readFileSync(path.join(aqui, 'shim-jogo.js'), 'utf8');
const content = readFileSync(path.join(origem, 'content.js'), 'utf8');
const acoes = ['oferta.js', 'acao-jogo.js'].map((f) => readFileSync(path.join(aqui, f), 'utf8')).join('\n');
const saida = `// GERADO por copiar-lupa.mjs (npm run preparar). Não edite: vem de shim-jogo.js + ../lupa/content.js + oferta.js e acao-jogo.js.
${shim}
// ---------- content.js da Lupa ----------
// só nas páginas do jogo (e no servidor local de teste); em qualquer outra o preload não faz nada
if (['lolidle.com', 'www.lolidle.com', '127.0.0.1', 'localhost'].includes(location.hostname)) {
  const iniciar = () => {
${content}
// ---------- ações que o jogador pede (só no app): oferta.js + acao-jogo.js ----------
${acoes}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
  else iniciar();
}
`;
mkdirSync(gerado, { recursive: true });
writeFileSync(path.join(gerado, 'preload-jogo.js'), saida);
console.log('Lupa copiada para', destino, 'e preload gerado em', path.join(gerado, 'preload-jogo.js'));
