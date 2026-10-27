// Lupa Online · gerar-tabelas: baixa os arquivos PÚBLICOS do jogo (https://lolidle.com/js/...), lê só os NÚMEROS das tabelas
// (XP por nível, zonas, monstros, preços de item, chances de refino...) e grava src/dados-jogo.js com constantes e funções
// pequenas escritas à mão aqui. O motor do jogo NÃO é copiado: o que vai para o site são tabelas e fórmulas curtas.
//
// Como lê: baixa /jogar, acha o <script> do jogo (jogo.js), segue os imports do motor.js e guarda tudo numa pasta temporária.
// O motor roda num processo filho do Node com o modelo de permissões (--permission): só pode LER aquela pasta, sem rede,
// sem gravar arquivo e sem abrir processo. Depois o próprio script confere as funções reescritas contra as do motor.
// Uso: node gerar-tabelas.mjs        (rode de vez em quando; o site avisa quando as tabelas ficam velhas)
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const aqui = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(aqui, 'src', 'dados-jogo.js');
const BASE = 'https://lolidle.com';
const baixar = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': 'LupaOnline-gerar-tabelas (uso pessoal)' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
};
const importsDe = (src) => [...src.matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?from\s*)?['"](\.[^'"]+)['"]/g)].map((m) => m[1]);

const pasta = mkdtempSync(join(tmpdir(), 'lolidle-js-'));
try {
  // 1) o <script> do jogo e a cadeia de imports do motor
  const pagina = await baixar(BASE + '/jogar');
  const scripts = [...pagina.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)].map((m) => new URL(m[1], BASE + '/jogar').href);
  if (!scripts.length) throw new Error('nenhum <script> em /jogar');
  let achou = false;
  for (const url of scripts) if ((await baixar(url)).includes("./motor.js")) achou = true;
  if (!achou) throw new Error('o script de /jogar não importa ./motor.js: a estrutura do jogo mudou');

  const feitos = new Map();
  // os nomes vêm dos imports de arquivos baixados: só caminhos simples dentro de js/, nunca subindo de pasta
  const NOME_OK = /^[\w-]+(\/[\w-]+)*\.js$/;
  const seguir = async (nome) => {
    if (!NOME_OK.test(nome)) throw new Error('import com caminho fora do padrão (recusado): ' + nome);
    if (feitos.has(nome)) return;
    const arq = resolve(pasta, nome);
    if (!arq.startsWith(resolve(pasta) + sep)) throw new Error('import fora da pasta temporária (recusado): ' + nome);
    const src = await baixar(`${BASE}/js/${nome}`);
    feitos.set(nome, src);
    mkdirSync(dirname(arq), { recursive: true });
    writeFileSync(arq, src);
    for (const imp of importsDe(src)) await seguir(posix.normalize(posix.join(posix.dirname(nome), imp)));
  };
  await seguir('motor.js');
  await seguir('novidades.js');
  const motorSrc = feitos.get('motor.js');
  const sha = createHash('sha256').update(motorSrc).digest('hex');
  // "versão" do jogo: o id da novidade mais recente (ex.: 2026-10-26a); o motor não traz número de versão
  const versaoJogo = (feitos.get('novidades.js').match(/id:\s*['"]([^'"]+)['"]/) || [])[1] || null;
  console.log(`baixados ${feitos.size} arquivos; motor.js ${motorSrc.length} bytes, sha256 ${sha.slice(0, 12)}; versão do jogo ${versaoJogo}`);

  // 2) o motor roda num processo filho só de leitura e devolve as tabelas em JSON
  const leitor = `
    const M = await import(${JSON.stringify(pathToFileURL(join(pasta, 'motor.js')).href)});
    const D = await import(${JSON.stringify(pathToFileURL(join(pasta, 'dados.js')).href)});
    const B = await import(${JSON.stringify(pathToFileURL(join(pasta, 'balanco.js')).href)});
    const zonas = [...M.LOCAIS, ...M.LOCAIS_FRELJORD].filter((l) => l.faixa && l.nm && l.monstros && !l.arena);
    const monstros = new Set(zonas.flatMap((l) => l.monstros.map((m) => m[0])));
    const r = (v) => +(+v).toFixed(6);
    console.log(JSON.stringify({
      NIVEL_MAX: M.NIVEL_MAX, REFINO_MAX: M.REFINO_MAX, BONUS_REFINO: M.BONUS_REFINO,
      CHANCE_REFINO: M.CHANCE_REFINO, REGRESSAO_REFINO: M.REGRESSAO_REFINO, PERSISTENCIA_FORJA: M.PERSISTENCIA.forja,
      PERSISTENCIA_PASSO: M.PERSISTENCIA_PASSO, PERSISTENCIA_TETO: M.PERSISTENCIA_TETO, PRECO_REFINO_ALTO: M.PRECO_REFINO_ALTO, PRECO_REFINO_TOPO: M.PRECO_REFINO_TOPO,
      VIP: M.VIP, DROP_CHEFE: M.DROP_CHEFE, ABATES_MIN_ZONA: M.ABATES_MIN_ZONA, TAREFA_TIPOS: M.TAREFA_TIPOS, RITMO_REAL: M.RITMO_REAL,
      QUALIDADES: Object.fromEntries(M.ORDEM_QUAL.map((q) => [q, { peso: M.QUALIDADES[q].peso, mult: M.QUALIDADES[q].mult, venda: M.QUALIDADES[q].venda }])),
      XP_NIVEL: Array.from({ length: M.NIVEL_MAX }, (_, i) => M.xpParaNivel(i + 1)),
      BALANCO: B.BALANCO.map((f) => ({ de: f.de, ate: f.ate, xp: f.xp, ouro: f.ouro, vida: f.vida })),
      MONSTROS: Object.fromEntries([...monstros].map((n) => [n, { hp: M.MONSTROS[n].hp, xp: M.MONSTROS[n].xp, ouro: M.MONSTROS[n].ouro }])),
      ZONAS: zonas.map((l) => ({ id: l.id, nome: l.nome, faixa: l.faixa, nm: l.nm, tier: l.tier, nivel: l.nivel || null, mundo: l.mundo || 'rift', monstros: l.monstros,
        chefe: l.chefe || null, drop: Object.fromEntries(Object.entries(M.chancesDrop(l)).map(([k, v]) => [k, +v.toPrecision(5)])) })),
      ITENS: Object.values(M.ITENS).map((i) => ({ id: i.id, nome: i.nome, preco: i.preco, raridade: M.raridade(i), espaco: i.espaco || null })),
      dataDragon: D.DADOS.versao,
    }));
  `;
  const filho = spawnSync(process.execPath, ['--permission', `--allow-fs-read=${pasta}`, '--input-type=module', '-e', leitor],
    { encoding: 'utf8', maxBuffer: 64e6, cwd: pasta });
  if (filho.status !== 0) throw new Error('o motor não carregou no processo isolado:\n' + (filho.stderr || filho.stdout).slice(0, 2000));
  const T = JSON.parse(filho.stdout.trim().split('\n').pop());

  // 3) grava dados-jogo.js
  const j = (v) => JSON.stringify(v);
  // número que entra solto no código gerado: tem de ser um número de verdade (o valor vem de um arquivo baixado)
  const num = (v, nome) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${nome} não é um número: ${j(v)}`); return j(v); };
  const linhas = (arr) => '[\n' + arr.map((x) => '  ' + j(x)).join(',\n') + '\n]';
  const meta = { geradoEm: new Date().toISOString(), versaoJogo, motorSha256: sha, dataDragon: T.dataDragon, fonte: BASE + '/js/motor.js' };
  const fonte = `// Lupa Online · tabelas PÚBLICAS do jogo (lolidle.com), em números. GERADO por gerar-tabelas.mjs: não edite à mão.
// Só constantes e funções pequenas reescritas aqui; o motor do jogo não é copiado. Tudo o que sai destas contas é ESTIMATIVA.
// Funciona no navegador (const global JOGO, script clássico) e no Node (module.exports), para o teste e o gerador.
'use strict';

const JOGO = (() => {
  const meta = ${j(meta)};
  const NIVEL_MAX = ${num(T.NIVEL_MAX, 'NIVEL_MAX')};
  const REFINO_MAX = ${num(T.REFINO_MAX, 'REFINO_MAX')}, BONUS_REFINO = ${num(T.BONUS_REFINO, 'BONUS_REFINO')}, RITMO_REAL = ${num(T.RITMO_REAL, 'RITMO_REAL')};
  const CHANCE_REFINO = ${j(T.CHANCE_REFINO)};            // chance de subir do refino i para i+1, sem VIP
  const REGRESSAO_REFINO = ${j(T.REGRESSAO_REFINO)};      // chance de, ao falhar na tentativa de i para i+1, voltar para i-1
  const PERSISTENCIA = ${j(T.PERSISTENCIA_FORJA)};        // por alvo (+1..+7): a partir de "subir" falhas a chance cresce até 100% na tentativa "max"
  const PERSISTENCIA_PASSO = ${num(T.PERSISTENCIA_PASSO, 'PERSISTENCIA_PASSO')}, PERSISTENCIA_TETO = ${num(T.PERSISTENCIA_TETO, 'PERSISTENCIA_TETO')};
  const PRECO_REFINO_ALTO = ${num(T.PRECO_REFINO_ALTO, 'PRECO_REFINO_ALTO')}, PRECO_REFINO_TOPO = ${j(T.PRECO_REFINO_TOPO)};
  const VIP = ${j(T.VIP)};
  const DROP_CHEFE = ${j(T.DROP_CHEFE)};
  const ABATES_MIN_ZONA = ${j(T.ABATES_MIN_ZONA)};         // abates por minuto medidos pelo dono do jogo, por zona
  const TAREFA_TIPOS = ${j(T.TAREFA_TIPOS)};
  const QUALIDADES = ${j(T.QUALIDADES)};
  const ORDEM_QUAL = ['C', 'B', 'A', 'S', 'SS'];
  // XP para passar do nível n para o n+1 (XP_NIVEL[n - 1])
  const XP_NIVEL = ${j(T.XP_NIVEL)};
  // multiplicadores de XP, ouro e vida dos monstros por faixa de nível
  const BALANCO = ${linhas(T.BALANCO)};
  const MONSTROS = ${j(T.MONSTROS)};
  // zonas de caça. faixa: níveis recomendados; nm: níveis dos monstros; nivel: nível mínimo para entrar; drop: chance por abate
  const ZONAS = ${linhas(T.ZONAS)};
  // itens: preco é o preço-base no Lojista
  const ITENS = ${linhas(T.ITENS)};

  const ajuste = (n) => BALANCO.find((f) => n >= f.de && n <= f.ate) || BALANCO[BALANCO.length - 1];
  const CURVA = {
    hp: (n) => (150 + 100 * n + n * n) * ajuste(n).vida,
    xp: (n) => (30 + 7 * n) * ajuste(n).xp,
    ouro: (n) => (8 + 3.5 * n) * ajuste(n).ouro,
  };
  const xpParaNivel = (n) => XP_NIVEL[Math.min(NIVEL_MAX, Math.max(1, Math.floor(n))) - 1];
  // XP total para ir do nível "de" até o nível "ate" (soma de xpParaNivel(de) até xpParaNivel(ate - 1))
  const xpEntre = (de, ate) => { let t = 0; for (let n = de; n < ate; n++) t += xpParaNivel(n); return t; };
  // monstro mais de 5 níveis abaixo do seu dá menos XP: -10% por nível, mínimo 10%
  const fatorXp = (nivel, nivelMonstro) => { const dif = nivel - nivelMonstro; return dif > 5 ? Math.max(0.1, 1 - 0.1 * (dif - 5)) : 1; };

  const ZONA = Object.fromEntries(ZONAS.map((z) => [z.id, z]));
  const nivelMeio = (z) => (z.nm[0] + z.nm[1]) / 2;
  const peso = (z) => z.monstros.reduce((s, [, f]) => s + f, 0);
  // médias de um abate comum na zona, no nível do meio dela (sem bônus nenhum)
  function porAbateZona(z) {
    const nm = nivelMeio(z), tot = peso(z);
    let xp = 0, ouro = 0, hp = 0;
    for (const [m, f] of z.monstros) { const k = f / tot; xp += k * CURVA.xp(nm) * MONSTROS[m].xp; ouro += k * CURVA.ouro(nm) * MONSTROS[m].ouro; hp += k * CURVA.hp(nm) * MONSTROS[m].hp; }
    return { xp, ouro, hp };
  }
  const zonaIdeal = (n) => [...ZONAS].reverse().find((z) => z.mundo === 'rift' && n >= z.faixa[0]) || ZONAS[0];

  const baseId = (x) => String(x).split(/[!+~#]/)[0];
  const item = (id) => ITENS.find((i) => i.id === baseId(id)) || null;
  const valorVenda = (id, refino, qual) => { const i = item(id); return i ? Math.floor(i.preco * 0.5 * (1 + 0.5 * refino) * (QUALIDADES[qual]?.venda || 1)) : null; };
  // preço de UMA tentativa de forja a partir do refino atual (refino -> refino + 1)
  const precoRefino = (id, refino) => { const i = item(id); return i ? Math.round(i.preco * (0.5 + 0.5 * refino) * (PRECO_REFINO_TOPO[refino] || (refino >= 2 ? PRECO_REFINO_ALTO : 1))) : null; };
  const chanceRefino = (refino, vip) => (vip ? Math.min(VIP.refinoMax, CHANCE_REFINO[refino] * VIP.refino) : CHANCE_REFINO[refino]);
  const bonusFalhas = (falhas) => Math.min(PERSISTENCIA_TETO, PERSISTENCIA_PASSO * (falhas || 0));
  // chance da próxima tentativa de forja, com a persistência do Ornn (falhas = falhas seguidas neste alvo)
  function chanceForja(refino, falhas, vip) {
    const base = chanceRefino(refino, vip), regra = PERSISTENCIA[refino + 1];
    if (!regra) return base;
    const b = Math.min(1, base * (1 + bonusFalhas(falhas)));
    if (!regra.subir || falhas < regra.subir) return b;
    return Math.min(1, b + ((1 - b) * (falhas - regra.subir + 1)) / (regra.max - regra.subir));
  }
  // XP e ouro de uma tarefa por zona (máximo que o Capitão paga); t = { tipo, local, qtd }
  function recompensaTarefa(t) {
    const T = TAREFA_TIPOS[t.tipo], z = ZONA[t.local];
    if (!T || !z) return null;
    const a = porAbateZona(z);
    return { xp: Math.round(t.qtd * a.xp * T.xp), ouro: Math.round(t.qtd * a.ouro * T.ouro) };
  }

  return { meta, NIVEL_MAX, REFINO_MAX, BONUS_REFINO, RITMO_REAL, CHANCE_REFINO, REGRESSAO_REFINO, PERSISTENCIA, VIP, DROP_CHEFE, ABATES_MIN_ZONA, TAREFA_TIPOS, QUALIDADES, ORDEM_QUAL,
    XP_NIVEL, BALANCO, MONSTROS, ZONAS, ITENS, ZONA, CURVA, xpParaNivel, xpEntre, fatorXp, porAbateZona, zonaIdeal, item, valorVenda, precoRefino, chanceRefino, chanceForja, recompensaTarefa };
})();
if (typeof module !== 'undefined') module.exports = JOGO;
`;
  writeFileSync(SAIDA, fonte);
  console.log('gravado', SAIDA);

  // 4) confere as funções reescritas contra o motor (no mesmo processo isolado)
  const conferir = `
    const M = await import(${JSON.stringify(pathToFileURL(join(pasta, 'motor.js')).href)});
    const { createRequire } = await import('node:module');
    const J = createRequire(${JSON.stringify(pathToFileURL(join(aqui, 'x.js')).href)})(${JSON.stringify(SAIDA)});
    const erros = [], igual = (nome, a, b, tol = 1e-6) => { if (!(a === b || (typeof a === 'number' && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))))) erros.push(nome + ': ' + a + ' != ' + b); };
    for (let n = 1; n <= 100; n++) igual('xpParaNivel ' + n, J.xpParaNivel(n), M.xpParaNivel(n));
    for (let a = 1; a <= 100; a += 3) for (let b = 1; b <= 100; b += 4) igual('fatorXp ' + a + ',' + b, J.fatorXp(a, b), M.fatorXp(a, b));
    for (const z of J.ZONAS) {
      const l = M.LOCAL[z.id], p = M.porAbateZona(l);
      igual('xp/abate ' + z.id, J.porAbateZona(z).xp, p.xp); igual('ouro/abate ' + z.id, J.porAbateZona(z).ouro, p.ouro);
    }
    for (let n = 1; n <= 100; n++) igual('zonaIdeal ' + n, J.zonaIdeal(n).id, M.zonaIdeal(n).id);
    for (const it of J.ITENS) for (let r = 0; r < 7; r++) { igual('precoRefino ' + it.id + '+' + r, J.precoRefino(it.id, r), M.precoRefino(it.id + '+' + r)); for (const q of J.ORDEM_QUAL) igual('valorVenda ' + it.id + r + q, J.valorVenda(it.id, r, q), M.valorVenda(it.id + '+' + r + '~' + q)); }
    for (let r = 0; r < 7; r++) for (const f of [0, 1, 50, 79, 80, 100, 119, 299, 799, 3499, 7999, 8000, 11999, 12000]) for (const vip of [false, true])
      igual('chanceForja ' + r + ',' + f + ',' + vip, J.chanceForja(r, f, vip), M.chanceForjaAgora({ vipAte: vip ? Date.now() + 1e9 : 0, persistencia: { forja: { [(r + 1) + ':basico']: f } } }, r, '1001'));
    console.log(JSON.stringify(erros.slice(0, 10)), erros.length);
  `;
  const v = spawnSync(process.execPath, ['--permission', `--allow-fs-read=${pasta}`, `--allow-fs-read=${aqui}`, '--input-type=module', '-e', conferir], { encoding: 'utf8', maxBuffer: 64e6, cwd: pasta });
  if (v.status !== 0) throw new Error('a conferência falhou:\n' + (v.stderr || v.stdout).slice(0, 2000));
  const [lista, total] = [v.stdout.trim().split('\n').pop().replace(/ \d+$/, ''), +v.stdout.trim().split(' ').pop()];
  if (total) throw new Error(`as funções reescritas divergem do motor em ${total} conta(s): ${lista}`);
  console.log('conferido: xpParaNivel, fatorXp, porAbateZona, zonaIdeal, precoRefino, valorVenda e a chance da forja batem com o motor.');
} finally {
  rmSync(pasta, { recursive: true, force: true });
}
