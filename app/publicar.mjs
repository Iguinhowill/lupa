// Publica o instalador no GitHub Releases (Iguinhowill/lupa) com o gh.
// Uso: node publicar.mjs [--conferir] [--notas "texto"] [--notas-arquivo arquivo.md]
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const pasta = dirname(fileURLToPath(import.meta.url));
const REPO = 'Iguinhowill/lupa';
const args = process.argv.slice(2);
const pegar = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
};
const falhar = (msg) => {
  console.error(`Erro: ${msg}`);
  process.exit(1);
};

const versao = JSON.parse(readFileSync(join(pasta, 'package.json'), 'utf8')).version;
const exe = join(pasta, 'dist', `Lupa-Setup-${versao}.exe`);
const arquivos = [exe, `${exe}.blockmap`, join(pasta, 'dist', 'latest.yml')];

const faltando = arquivos.filter((a) => !existsSync(a));
if (faltando.length) {
  falhar(`faltam arquivos para a versão ${versao}:\n  ${faltando.join('\n  ')}\nRode "npm run dist" antes.`);
}
const yml = readFileSync(arquivos[2], 'utf8');
// comparação por linha (numa RegExp montada com template string, o "\s" e o "\." perdiam a barra)
if (!yml.split(/\r?\n/).some((l) => l.replace(/['"\s]/g, '') === `version:${versao}`)) {
  falhar(`o latest.yml não cita a versão ${versao}. Rode "npm run dist" de novo.`);
}
console.log(`Conferido: versão ${versao}, instalador, blockmap e latest.yml presentes.`);
if (args.includes('--conferir')) process.exit(0);

let arquivoNotas = pegar('--notas-arquivo');
if (arquivoNotas) {
  if (!existsSync(arquivoNotas)) falhar(`arquivo de notas não encontrado: ${arquivoNotas}`);
} else {
  const texto = pegar('--notas') || `Lupa ${versao}`;
  arquivoNotas = join(mkdtempSync(join(tmpdir(), 'lupa-notas-')), 'notas.md');
  writeFileSync(arquivoNotas, texto + '\n', 'utf8');
}

const gh = ['release', 'create', `v${versao}`, ...arquivos, '--repo', REPO, '--title', `Lupa ${versao}`, '--notes-file', arquivoNotas];
console.log(`\n> gh ${gh.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}\n`);
const r = spawnSync('gh', gh, { stdio: 'inherit', shell: false });
if (r.error) falhar(`não consegui rodar o gh (${r.error.message}). Instale o GitHub CLI e faça "gh auth login".`);
process.exit(r.status ?? 1);
