// Lupa Online · monta o site em dist/: os arquivos do site (src), a biblioteca do Supabase (vendor, do pacote do npm)
// e as peças compartilhadas da Lupa (ui.js, plano.js, central.js e o CSS), copiadas da pasta da extensão para o site e
// a Lupa nunca ficarem com duas versões. Uso: node montar.mjs
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const dist = join(aqui, 'dist'), lupa = join(aqui, '..', 'lupa');
// limpa o dist, menos o .vercel (o vínculo com o projeto lupa-online na Vercel)
mkdirSync(dist, { recursive: true });
for (const f of readdirSync(dist)) if (f !== '.vercel') rmSync(join(dist, f), { recursive: true, force: true });
cpSync(join(aqui, 'src'), dist, { recursive: true });
for (const f of ['supabase.js', '591.supabase.js']) cpSync(join(aqui, 'vendor', f), join(dist, f));
for (const f of ['ui.js', 'plano.js', 'central.js', 'painel.css', 'central.css']) cpSync(join(lupa, f), join(dist, f));
// a fonte da paleta nova (painel.css a pede em fontes/, ao lado dele)
cpSync(join(lupa, 'fontes'), join(dist, 'fontes'), { recursive: true });

// as páginas simples têm o mesmo esqueleto: muda o título, o script e se usa o plano.js
const PAGINAS = [['relatorio', 'Relatório', ['dados-jogo.js']], ['guia', 'Guia', ['plano.js']], ['farm', 'Farm', ['dados-jogo.js']], ['loja', 'Loja', []], ['calcular', 'Calcular', ['dados-jogo.js', 'calculos.js']], ['arsenal', 'Arsenal', ['dados-jogo.js', 'calculos.js']]];
for (const [nome, titulo, extras] of PAGINAS) {
  const scripts = ['supabase.js', 'config.js', ...extras, 'ui.js', 'nuvem.js', nome + '.js'].map((s) => `<script src="${s}"></script>`).join('\n');
  writeFileSync(join(dist, nome + '.html'), `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lupa Online · ${titulo}</title>
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#0e0e0f">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" href="/icone-192.png">
<link rel="stylesheet" href="painel.css">
<link rel="stylesheet" href="central.css">
<link rel="stylesheet" href="site.css">
</head>
<body>
<main id="pagina" class="site-pagina" aria-busy="true"><p class="carregando">Lendo o banco…</p></main>
${scripts}
</body>
</html>
`);
}
console.log('site montado em', dist);
