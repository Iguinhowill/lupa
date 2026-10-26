// Lupa Online · traz um guia publicado como artifact do Claude para a seção pública Roteiros (src/roteiros/).
// A página do artifact tem o script inline e as fontes do Google; a CSP do site só aceita script e fonte do próprio
// site, então o script vira <nome>.js e as fontes passam para roteiros/fontes/fontes.css. Depois, acrescentar o card
// em src/roteiros/index.html e publicar. Uso: node importar-roteiro.mjs <página do artifact.html> <nome>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [arquivo, nome] = process.argv.slice(2);
if (!arquivo || !/^[a-z0-9-]+$/.test(nome || '')) throw new Error('uso: node importar-roteiro.mjs <página.html> <nome-em-minúsculas>');
const pasta = join(dirname(fileURLToPath(import.meta.url)), 'src', 'roteiros');
const html = readFileSync(arquivo, 'utf8');

const pegar = (re, oque) => { const m = html.match(re); if (!m) throw new Error('não achei ' + oque); return m[1]; };
const titulo = pegar(/<title>([^<]+)<\/title>/, 'o <title>');
// o primeiro <style> é o da moldura do artifact; o do guia vem depois do <body>
const corpo = html.slice(html.indexOf('<body>') + 6);
const css = pegar(/<body>[\s\S]*?<style>([\s\S]*?)<\/style>/, 'o <style> do guia');
const js = pegar(/<script>([\s\S]*?)<\/script>/, 'o <script>');
const marcacao = corpo.slice(corpo.indexOf('</style>') + 8, corpo.indexOf('<script>')).trim();
if (!marcacao.includes('<header class="topo">')) throw new Error('o guia não tem <header class="topo"> para o link de volta');
if (/https:\/\/fonts\.(googleapis|gstatic)/.test(marcacao)) throw new Error('fonte externa no corpo do guia');

writeFileSync(join(pasta, nome + '.js'), js.trim() + '\n');
writeFileSync(join(pasta, nome + '.html'), `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${titulo} · Roteiros</title>
<link rel="stylesheet" href="/roteiros/fontes/fontes.css">
<style>
:root { color-scheme: light; }
${css.trim()}
/* Roteiros: moldura do site (margem do body e o link de volta para a lista) */
body { margin: 0; }
.topo { padding-top: 12px; }
.voltar { justify-self: start; display: inline-flex; align-items: center; min-height: 44px; color: var(--muted); text-decoration: none; font-size: 0.92rem; }
.voltar:hover { color: var(--accent); }
</style>
</head>
<body>
${marcacao.replace('<header class="topo">', '<header class="topo">\n    <a class="voltar" href="/roteiros/">← Todos os roteiros</a>')}

<script src="/roteiros/${nome}.js"></script>
</body>
</html>
`);
console.log(`roteiro "${titulo}" em src/roteiros/${nome}.html (+ ${nome}.js)`);
