// Lupa Online · gerar-tabelas: baixa os arquivos PÚBLICOS do jogo (https://lolidle.com/js/...), lê só os NÚMEROS das tabelas
// (XP por nível, zonas, monstros, preços de item, chances de refino...) e grava src/dados-jogo.js com constantes e funções
// pequenas escritas à mão aqui. O motor do jogo NÃO é copiado: o que vai para o site são tabelas e fórmulas curtas.
//
// Como lê: baixa /jogar, acha o <script> do jogo (jogo.js), segue os imports do motor.js e guarda tudo numa pasta temporária.
// O motor roda num processo filho do Node com o modelo de permissões (--permission): só pode LER aquela pasta, sem gravar
// arquivo e sem abrir processo. ATENÇÃO: no Node 24 esse modelo NÃO corta a rede, então o filho roda sem nenhuma variável
// de ambiente (não há token nem chave para vazar). É código público do próprio jogo, mas não é uma caixa de areia de
// verdade: rode só de vez em quando, à mão. Depois o script confere as funções reescritas contra as do motor e só então
// grava o src/dados-jogo.js (e a mesma cópia em ../lupa/dados-jogo.js, que o painel da Lupa usa para o valorVenda).
// Além das tabelas, o gerador extrai os números da ficha final (campeões, itens, cartas, atributos), reescreve fichaDaBuild e a confere contra
// o motor em milhares de builds aleatórias; e calibra o modelo de farm do comparador de builds contra o combate do motor (alguns minutos de
// simulação, em vários processos isolados), medindo o erro num conjunto de builds que o ajuste nunca viu. O erro vai para meta.erroComparador.
// Uso: node gerar-tabelas.mjs              (rode de vez em quando; o site avisa quando as tabelas ficam velhas; leva uns minutos)
//      node gerar-tabelas.mjs --sem-farm   (só as tabelas e a conferência; reaproveita a calibração do farm que já está no arquivo)
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { dirname, join, resolve, sep, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const aqui = dirname(fileURLToPath(import.meta.url));
const SAIDA = join(aqui, 'src', 'dados-jogo.js');
const SAIDA_LUPA = join(aqui, '..', 'lupa', 'dados-jogo.js');      // o painel da Lupa usa o mesmo arquivo (valorVenda)
const BASE = 'https://lolidle.com';
const baixar = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': 'LupaOnline-gerar-tabelas (uso pessoal)' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
};
// processo filho sem o ambiente do pai (no Windows, SystemRoot é o mínimo para o Node subir)
const ENV_FILHO = process.env.SYSTEMROOT ? { SYSTEMROOT: process.env.SYSTEMROOT } : {};
const importsDe =(src) => [...src.matchAll(/(?:^|\n)\s*import\s+(?:[^'"]*?from\s*)?['"](\.[^'"]+)['"]/g)].map((m) => m[1]);

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
    // ficha: só números dos campeões (stats, ad base, papel, passiva de crítico, arrays por rank) e dos itens
    const STATS_ITEM = ['ad', 'ap', 'mana', 'vida', 'armadura', 'rm', 'va', 'rv', 'critico', 'regen', 'cdr', 'adPct', 'apPct', 'vidaPct', 'armPct', 'rmPct', 'esquiva', 'penMag', 'penArm', 'critDano'];
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const STATS_CAMP = ['hp', 'hpperlevel', 'mp', 'mpperlevel', 'armor', 'armorperlevel', 'spellblock', 'hpregen', 'hpregenperlevel', 'mpregen', 'mpregenperlevel', 'attackspeed', 'attackspeedperlevel'];
    const CAMPEOES = Object.fromEntries(Object.entries(M.KITS).map(([id, k]) => [id, {
      nome: k.dados.campeao.nome, stats: Object.fromEntries(STATS_CAMP.map((s) => [s, num(k.stats[s])])), adBase: k.adBase, adNivel: k.adNivel,
      papel: { dano: k.papel.dano }, kite: k.kite ? { recarga: k.kite.recarga, recuo: k.kite.recuo, gasto: k.kite.gasto, recupera: k.kite.recupera, pausa: k.kite.pausa } : null, distancia: !!k.distancia, magia: !!k.magia, semMana: !!k.semMana, fluxo: !!k.fluxo,
      critMult: k.hab.P?.critMult || 1, critDano: k.hab.P?.critDano || 1, critMonstro: k.hab.P?.critMonstro || 1, vaNivel: k.hab.P?.vaNivel || 0,
      critBase: Array.from({ length: M.NIVEL_MAX }, (_, i) => (k.hab.P?.critBase ? +k.hab.P.critBase(i + 1).toFixed(9) : 0)),
      penE: k.hab.E?.pen || null, armPassiva: k.hab.W?.armPassiva || null, maestria: k.hab.P?.maestria || null,
    }]));
    // habilidades dos campeões que o modelo de farm calibra: só os números por rank (recarga, dano base e escala, bônus de velocidade...)
    const HABS = Object.fromEntries(['yasuo', 'aphelios'].map((id) => [id, Object.fromEntries(Object.entries(M.KITS[id].hab).filter(([t]) => t !== 'P').map(([t, h]) => [t, Object.fromEntries(Object.entries(h)
      .filter(([, v]) => (typeof v === 'number' && Number.isFinite(v)) || (Array.isArray(v) && v.length && v.every((x) => typeof x === 'number' && Number.isFinite(x))))
      .map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => +x.toFixed(6)) : v]))]))]));
    const CARTA_VALOR = Object.fromEntries(Object.entries(M.CARTAS).map(([id, c]) => [id, c.valor]));
    const CARTA_TIRAR = Object.fromEntries(Object.entries(M.CARTA_NIVEIS).map(([n, c]) => [n, c.tirar]));
    // as habilidades de cada campeão (o que a ficha mostra e as regras de rank): nome, nível em que libera, rank máximo, passiva
    const KIT_HABS = Object.fromEntries(Object.entries(M.KITS).map(([id, k]) => [id, Object.fromEntries(M.ORDEM_HAB.filter((t) => k.hab[t])
      .map((t) => [t, { nome: k.hab[t].nome, nivel: k.hab[t].nivel, max: k.hab[t].max, passiva: !!k.hab[t].passiva }]))]));
    console.log(JSON.stringify({
      CAMPEOES, HABS, CARTA_VALOR, CARTA_TIRAR, RESET_OURO: M.RESET_OURO, CARTA_TIPOS: M.ORDEM_TIPOS_CARTA,
      KIT_HABS, BARRA: M.BARRA, PONTOS_POR_NIVEL: M.PONTOS_POR_NIVEL, NIVEL_PONTOS_HAB: M.NIVEL_PONTOS_HAB, NIVEL_MIN_R: M.nivelMinimoR, VEL_ATAQUE_MAX: M.VEL_ATAQUE_MAX, NIVEL_DIF: M.NIVEL_DIF, TETO_VIDA_ITEM: M.TETO_VIDA_ITEM, RM_MONSTRO: M.RM_MONSTRO,
      FOCO_DANO_HAB: M.FOCO_DANO_HAB, FOCO_FLUXO: M.FOCO_FLUXO, FLUXO_MAX: M.FLUXO_MAX,
      NIVEL_MAX: M.NIVEL_MAX, REFINO_MAX: M.REFINO_MAX, BONUS_REFINO: M.BONUS_REFINO, BONUS_REFINO_EXTRA: M.BONUS_REFINO_EXTRA || {},
      CHANCE_REFINO: M.CHANCE_REFINO, REGRESSAO_REFINO: M.REGRESSAO_REFINO, PERSISTENCIA_FORJA: M.PERSISTENCIA.forja,
      PERSISTENCIA_PASSO: M.PERSISTENCIA_PASSO, PERSISTENCIA_TETO: M.PERSISTENCIA_TETO, PRECO_REFINO_ALTO: M.PRECO_REFINO_ALTO, PRECO_REFINO_TOPO: M.PRECO_REFINO_TOPO,
      VIP: M.VIP, DROP_CHEFE: M.DROP_CHEFE, ABATES_MIN_ZONA: M.ABATES_MIN_ZONA, TAREFA_TIPOS: M.TAREFA_TIPOS, RITMO_REAL: M.RITMO_REAL,
      QUALIDADES: Object.fromEntries(M.ORDEM_QUAL.map((q) => [q, { peso: M.QUALIDADES[q].peso, mult: M.QUALIDADES[q].mult, venda: M.QUALIDADES[q].venda }])),
      XP_NIVEL: Array.from({ length: M.NIVEL_MAX }, (_, i) => M.xpParaNivel(i + 1)),
      BALANCO: B.BALANCO.map((f) => ({ de: f.de, ate: f.ate, xp: f.xp, ouro: f.ouro, vida: f.vida })),
      MONSTROS: Object.fromEntries([...monstros].map((n) => [n, { hp: M.MONSTROS[n].hp, ar: M.MONSTROS[n].armadura, xp: M.MONSTROS[n].xp, ouro: M.MONSTROS[n].ouro }])),
      ZONAS: zonas.map((l) => ({ id: l.id, nome: l.nome, faixa: l.faixa, nm: l.nm, tier: l.tier, nivel: l.nivel || null, mundo: l.mundo || 'rift', monstros: l.monstros,
        chefe: l.chefe || null, drop: Object.fromEntries(Object.entries(M.chancesDrop(l)).map(([k, v]) => [k, +v.toPrecision(5)])) })),
      ITENS: Object.values(M.ITENS).map((i) => ({ id: i.id, nome: i.nome, preco: i.preco, raridade: M.raridade(i), espaco: i.espaco || null,
        e: Object.fromEntries(STATS_ITEM.map((x) => [x, num(i[x])]).filter(([, v]) => v)) })),
      ESPOLIOS: Object.fromEntries(Object.entries(M.ESPOLIOS).map(([id, e]) => [id, { nome: e.nome, valor: e.valor }])),
      dataDragon: D.DADOS.versao,
    }));
  `;
  const filho = spawnSync(process.execPath, ['--permission', `--allow-fs-read=${pasta}`, '--input-type=module', '-e', leitor],
    { encoding: 'utf8', maxBuffer: 64e6, cwd: pasta, env: ENV_FILHO });
  if (filho.status !== 0) throw new Error('o motor não carregou no processo isolado:\n' + (filho.stderr || filho.stdout).slice(0, 2000));
  const T = JSON.parse(filho.stdout.trim().split('\n').pop());
  // o formato antes de escrever qualquer coisa (os valores vêm de arquivos baixados)
  const numeros = (v, n, nome) => { if (!Array.isArray(v) || v.length !== n || !v.every((x) => typeof x === 'number' && Number.isFinite(x))) throw new Error(`${nome}: esperava ${n} números`); };
  numeros(T.XP_NIVEL, T.NIVEL_MAX, 'XP_NIVEL');
  numeros(T.CHANCE_REFINO, T.REFINO_MAX, 'CHANCE_REFINO');
  numeros(T.REGRESSAO_REFINO, T.REFINO_MAX, 'REGRESSAO_REFINO');
  for (const [nome, arr] of [['ZONAS', T.ZONAS], ['ITENS', T.ITENS]]) {
    if (!Array.isArray(arr) || !arr.length || !arr.every((x) => /^[\w-]+$/.test(String(x.id)))) throw new Error(`${nome}: ids fora do formato`);
  }
  if (![1, 2, 3].every((n) => Number.isFinite(T.CARTA_TIRAR?.[n]) && T.CARTA_TIRAR[n] >= 0)) throw new Error('CARTA_TIRAR: esperava o preço das 3 raridades');
  for (const [id, k] of Object.entries(T.KIT_HABS || {})) for (const [t, h] of Object.entries(k)) {
    if (!/^[a-z]+$/.test(id) || !/^[A-Z]$/.test(t) || typeof h.nome !== 'string' || !Number.isInteger(h.nivel) || !Number.isInteger(h.max)) throw new Error(`KIT_HABS: ${id}.${t} fora do formato`);
  }
  numeros(T.NIVEL_MIN_R, 5, 'NIVEL_MIN_R');
  const esp = Object.entries(T.ESPOLIOS || {});
  if (!esp.length || !esp.every(([id, e]) => /^[\w-]+$/.test(id) && typeof e.nome === 'string' && e.nome && Number.isFinite(e.valor) && e.valor >= 0)) throw new Error('ESPOLIOS: fora do formato');

  // 3) grava dados-jogo.js
  const j = (v) => JSON.stringify(v);
  // número que entra solto no código gerado: tem de ser um número de verdade (o valor vem de um arquivo baixado)
  const num = (v, nome) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${nome} não é um número: ${j(v)}`); return j(v); };
  const linhas = (arr) => '[\n' + arr.map((x) => '  ' + j(x)).join(',\n') + '\n]';
  const metaBase = { geradoEm: new Date().toISOString(), versaoJogo, motorSha256: sha, dataDragon: T.dataDragon, fonte: BASE + '/js/motor.js' };
  const gerarFonte = (FARM, erroComparador) => { const meta = { ...metaBase, erroComparador }; return `// Lupa Online · tabelas PÚBLICAS do jogo (lolidle.com), em números. GERADO por gerar-tabelas.mjs: não edite à mão.
// Só constantes e funções pequenas reescritas aqui; o motor do jogo não é copiado. Tudo o que sai destas contas é ESTIMATIVA.
// Funciona no navegador (const global JOGO, script clássico) e no Node (module.exports), para o teste e o gerador.
'use strict';

const JOGO = (() => {
  const meta = ${j(meta)};
  const NIVEL_MAX = ${num(T.NIVEL_MAX, 'NIVEL_MAX')};
  const REFINO_MAX = ${num(T.REFINO_MAX, 'REFINO_MAX')}, BONUS_REFINO = ${num(T.BONUS_REFINO, 'BONUS_REFINO')}, RITMO_REAL = ${num(T.RITMO_REAL, 'RITMO_REAL')};
  const BONUS_REFINO_EXTRA = ${j(T.BONUS_REFINO_EXTRA)};      // o refino que ganha um pouco mais (28/10/2026: o +7 vale ×2,00 em vez de ×1,84)
  const multRefino = (ref) => 1 + BONUS_REFINO * ref + (BONUS_REFINO_EXTRA[ref] || 0);      // o multRefino do motor
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
  // espólios (partes de monstro, só para vender): valor é o que o Lojista paga por unidade
  const ESPOLIOS = ${j(T.ESPOLIOS)};

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
  // o item ou o espólio pelo nome que o jogo escreve (chat, mochila); null se não for nenhum dos dois (runa, gema...)
  const itemPorNome = (nome) => ITENS.find((i) => i.nome === nome) || null;
  const espolioPorNome = (nome) => { const k = Object.keys(ESPOLIOS).find((id) => ESPOLIOS[id].nome === nome); return k ? { id: k, ...ESPOLIOS[k] } : null; };
  // quanto o Lojista paga por qtd unidades de um espólio (pelo id)
  const valorEspolio = (id, qtd = 1) => (ESPOLIOS[id] ? ESPOLIOS[id].valor * qtd : null);
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

  // quantos ranks o nível permite na habilidade t (Q, W e E a cada 2 níveis; R e N em níveis fixos; as outras a cada 2 depois de liberar)
  function rankMaximo(campeao, t, nivel) {
    const h = KIT_HABS[campeao]?.[t];
    if (!h || nivel < h.nivel) return 0;
    if (t === 'R') return NIVEL_MIN_R.filter((n) => nivel >= n).length;
    if (t === 'N') return NIVEL_MIN_N.filter((n) => nivel >= n).length;
    if (t === 'Q' || t === 'W' || t === 'E') return Math.min(h.max, Math.ceil(nivel / 2));
    return Math.min(h.max, 1 + Math.floor((nivel - h.nivel) / 2));
  }
  // o campeão pelo nome das habilidades que a ficha mostra ({ Q: 'Tempestade de Aço', ... }); null se nenhum bater
  function campeaoPelasHabs(habs) {
    const pares = Object.entries(habs || {});
    return Object.keys(KIT_HABS).find((id) => pares.some(([t]) => KIT_HABS[id][t]) && pares.every(([t, nome]) => !KIT_HABS[id][t] || KIT_HABS[id][t].nome === nome)) || null;
  }

  // ---------- ficha final da build (campeão, nível, atributos, itens com refino, qualidade e carta) ----------
  // Reescrita curta da conta do motor (atributos): o gerador confere cada número contra o motor em milhares de builds aleatórias.
  const CAMPEOES = ${j(T.CAMPEOES)};
  const HABS = ${j(T.HABS)};                         // habilidades por rank dos campeões calibrados no farm (recarga, base, ratio, va, duração...)
  const CARTA_VALOR = ${j(T.CARTA_VALOR)};              // "ataque2" (Carta de Ataque Rara): 0,05; crítico e roubo de vida somam em pontos
  const CARTA_TIRAR = ${j(T.CARTA_TIRAR)};              // ouro para tirar uma carta de um item, por raridade (1 básica, 2 rara, 3 lendária); ela volta para a bolsa
  const RESET_OURO = ${num(T.RESET_OURO, 'RESET_OURO')};                    // reset de atributos no Mestre da Legião: isto × nível
  // as habilidades de cada campeão: nome (o mesmo da ficha), nível em que libera, rank máximo e se é passiva (passiva não vai na barra)
  const KIT_HABS = ${j(T.KIT_HABS)};
  const BARRA = ${num(T.BARRA, 'BARRA')}, PONTOS_POR_NIVEL = ${num(T.PONTOS_POR_NIVEL, 'PONTOS_POR_NIVEL')}, NIVEL_PONTOS_HAB = ${num(T.NIVEL_PONTOS_HAB, 'NIVEL_PONTOS_HAB')};      // por nível: 1 ponto de habilidade (até o NIVEL_PONTOS_HAB) e PONTOS_POR_NIVEL de atributo
  // os níveis em que o R e o N ganham rank (o do N não é exportado pelo motor: a conferência compara rankMaximo com o rankMaximoNoNivel dele)
  const NIVEL_MIN_R = ${j(T.NIVEL_MIN_R)}, NIVEL_MIN_N = [45, 46, 47, 48, 50];
  const NIVEL_DIF = ${j(T.NIVEL_DIF)};                  // monstro mais de "livre" níveis acima do jogador aguenta mais (danoJogador por nível, piso minDanoJogador)
  const TETO_VIDA_ITEM = ${num(T.TETO_VIDA_ITEM, 'TETO_VIDA_ITEM')}, RM_MONSTRO = ${num(T.RM_MONSTRO, 'RM_MONSTRO')}, VEL_ATAQUE_MAX = ${num(T.VEL_ATAQUE_MAX, 'VEL_ATAQUE_MAX')}, FOCO_DANO_HAB = ${num(T.FOCO_DANO_HAB, 'FOCO_DANO_HAB')}, FOCO_FLUXO = ${num(T.FOCO_FLUXO, 'FOCO_FLUXO')}, FLUXO_MAX = ${num(T.FLUXO_MAX, 'FLUXO_MAX')};
  const DT = 0.05;                                  // o combate do jogo roda em passos fixos de 0,05 s
  const ARMADURA_MONSTRO = (n) => 5 + 1.5 * n;      // armadura-base do monstro de nível n (vezes o "ar" de cada monstro)
  const PCT_ITEM = ['adPct', 'apPct', 'vidaPct', 'armPct', 'rmPct', 'esquiva', 'penMag', 'penArm', 'critDano'];      // % do total: não mudam com refino nem qualidade
  const crescimento = (n) => { const m = Math.min(n, 18); return (m - 1) * (0.7025 + 0.0175 * (m - 1)) + Math.max(0, n - 18); };
  const CARTA_TIPOS = ${j(T.CARTA_TIPOS)};
  const CARTA_TIPO = (id) => id.replace(/[1-3]$/, '');
  const refinoDe = (x) => +((/\\+(\\d+)/.exec(String(x)) || [])[1] || 0);
  const qualDe = (x) => (/~(SS|S|A|B|C|\\?)$/.exec(String(x)) || [])[1] || 'B';      // sem marca vale B
  const cartaDe = (x) => { const m = /#([a-z]+[1-3])/.exec(String(x)); return m && Object.hasOwn(CARTA_VALOR, m[1]) ? m[1] : null; };
  // o texto do item como o jogo escreve: "3031+4#ataque2~B"
  const chaveItem = (it) => (typeof it === 'string' ? it : String(it.id) + (it.refino > 0 ? '+' + it.refino : '') + (it.carta ? '#' + it.carta : '') + (it.qual ? '~' + it.qual : ''));
  // quantos passos de 0,05 s o relógio do ataque leva até zerar. O relógio reinicia em 1 / velocidade SEM guardar a sobra, então a
  // velocidade rende em DEGRAUS (período = nº de passos x 0,05 s). mult = aceleração por fora do teto (soma de bônus + 1).
  function periodoAtaque(velAtaque, mult) {
    let x = 1 / velAtaque, n = 0;
    while (x > 0 && n < 10000) { x -= DT * (mult || 1); n++; }
    return +(n * DT).toFixed(6);
  }
  // aceleração do relógio que não passa pela ficha e vale o tempo todo lutando (mesma ordem de soma do motor): passiva do Aphelios,
  // Fago (+8%) e Dançarina Fantasma (+6% por acúmulo, até 5)
  const aceleracaoFixa = (C, nivel, tem) => 1 + (tem('3044') ? 0.08 : 0) + 0 + 0.06 * (tem('3046') ? 5 : 0) + C.vaNivel * nivel;
  // build = { campeao, nivel, atrib: { forca, vitalidade, resistencia, agilidade, foco }, itens: ["3031+4#ataque2~B" ou { id, refino, qual, carta }],
  //           ranks: { E, W } (só o Darius e o Taric usam), bonus: { ad, vida, armadura, rm } (conquistas e mascote, em fração) }
  function fichaDaBuild(build) {
    const C = CAMPEOES[build.campeao] || CAMPEOES.darius, b = C.stats, nivel = build.nivel, g = crescimento(nivel);
    const at = { forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: 0, ...build.atrib }, ranks = build.ranks || {}, bc = { ad: 0, vida: 0, armadura: 0, rm: 0, ...build.bonus };
    const chaves = (build.itens || []).map(chaveItem), itensOk = chaves.filter((x) => item(x));
    let ad = C.adBase + C.adNivel * g, vida = b.hp + b.hpperlevel * g, armadura = b.armor + b.armorperlevel * g, rm = b.spellblock + 3.5 * g, va = 0, rv = 0;
    const baseAd = ad, baseVida = vida, baseArmadura = armadura;
    let critico = 0, danoCritico = 1.75, regenItens = 0, cdrItens = 0, ap = 0, manaItens = 0;
    const pct = Object.fromEntries(PCT_ITEM.map((p) => [p, 0]));
    if (C.magia) ap += 2 * at.forca; else ad += 1.2 * at.forca;
    vida += 20 * at.vitalidade; armadura += 1.5 * at.resistencia; rm += 1 * at.resistencia; va += 0.008 * at.agilidade;
    const cv = Object.fromEntries(CARTA_TIPOS.map((t) => [t, 0]));
    for (const x of itensOk) {
      const e = item(x).e, m = multRefino(refinoDe(x)) * (QUALIDADES[qualDe(x)]?.mult || 1), v = (k) => (e[k] || 0) * m;
      ad += v('ad'); ap += v('ap'); manaItens += v('mana'); vida += v('vida'); armadura += v('armadura'); rm += v('rm'); va += v('va'); rv += v('rv'); critico += v('critico');
      regenItens += v('regen'); cdrItens += v('cdr');
      for (const p of PCT_ITEM) pct[p] += e[p] || 0;
      const cc = cartaDe(x); if (cc) cv[CARTA_TIPO(cc)] += CARTA_VALOR[cc];
    }
    vida *= 1 + pct.vidaPct + cv.vida;
    const wArm = C.armPassiva && ranks.W ? C.armPassiva[ranks.W - 1] : 0;
    const tem = (id) => itensOk.some((x) => baseId(x) === id);
    if (tem('2501')) ad += 0.02 * (vida - baseVida);
    if (tem('3031')) danoCritico += 0.4;
    danoCritico += pct.critDano;
    const penE = C.penE && ranks.E ? C.penE[ranks.E - 1] : 0;
    let manaMax = C.fluxo ? FLUXO_MAX : C.semMana ? 0 : b.mp + b.mpperlevel * g + 8 * at.foco + manaItens;
    if (C.maestria) {
      const extra = manaMax * Math.min(C.maestria.manaMax, C.maestria.manaPor100 * ap / 100);
      manaMax += extra;
      ap += C.maestria.poder * (8 * at.foco + manaItens + extra);
    }
    if (tem('3003')) ap += 0.03 * manaMax;
    if (tem('3089')) ap *= 1.35;
    ad *= 1 + pct.adPct + cv.ataque; ap *= 1 + pct.apPct + cv.poder; armadura *= 1 + pct.armPct + wArm + cv.armadura; rm *= 1 + pct.rmPct + cv.rm;
    ad *= 1 + bc.ad; ap *= 1 + bc.ad; vida *= 1 + bc.vida; armadura *= 1 + bc.armadura; rm *= 1 + bc.rm;
    const velAtaque = Math.min(VEL_ATAQUE_MAX, b.attackspeed * (1 + (b.attackspeedperlevel / 100) * g + va) * (1 + cv.velocidade));
    const acel = aceleracaoFixa(C, nivel, tem), periodo = periodoAtaque(velAtaque, acel);
    return {
      ad, baseAd, bonusAd: ad - baseAd, vida, bonusVida: vida - baseVida, armadura, bonusArmadura: armadura - baseArmadura, rm, ap,
      penMagica: Math.min(0.6, (tem('3135') ? 0.4 : 0) + pct.penMag), mana: manaMax,
      danoHab: C.semMana ? FOCO_DANO_HAB * at.foco : 0, fluxoMult: C.fluxo ? 1 + FOCO_FLUXO * at.foco : 1,
      regenMana: C.fluxo || C.semMana ? 0 : ((b.mpregen + b.mpregenperlevel * g) / 5) * 3 + 0.06 * at.foco,
      velAtaque, aceleracao: acel, periodoAtaque: periodo, velEfetiva: 1 / periodo,
      regen: (b.hpregen + b.hpregenperlevel * g) / 5 + 0.1 * at.vitalidade + regenItens,
      esquiva: Math.min(0.25, 0.0025 * at.agilidade + pct.esquiva),
      reducaoRecarga: Math.min(0.4, Math.min(0.3, 0.004 * at.foco) + cdrItens + (cv.recarga || 0)),
      rouboVida: rv + cv.roubo, vampirismo: cv.vampirismo || 0,
      penArmadura: 1 - (1 - penE) * (tem('3036') ? 0.7 : 1) * (1 - pct.penArm),
      criticoBruto: (critico + cv.critico + (C.critBase[nivel - 1] || 0)) * C.critMult,      // antes do teto de 100%
      critico: Math.min(1, (critico + cv.critico + (C.critBase[nivel - 1] || 0)) * C.critMult), danoCritico: danoCritico * C.critDano,
      tem,
    };
  }
  // o dano do jogador cai contra monstro mais de "livre" níveis acima dele
  const fatorDanoJogador = (nivel, nivelMonstro) => { const d = Math.max(0, nivelMonstro - nivel - NIVEL_DIF.livre); return d ? Math.max(NIVEL_DIF.minDanoJogador, 1 - NIVEL_DIF.danoJogador * d) : 1; };
  const FARM = ${j(FARM)};      // parâmetros do modelo de farm (calculos.js: estimarFarm), calibrados pelo gerador contra a simulação do motor

  return { meta, NIVEL_MAX, REFINO_MAX, BONUS_REFINO, BONUS_REFINO_EXTRA, multRefino, RITMO_REAL, CHANCE_REFINO, REGRESSAO_REFINO, PERSISTENCIA, VIP, DROP_CHEFE, ABATES_MIN_ZONA, TAREFA_TIPOS, QUALIDADES, ORDEM_QUAL,
    XP_NIVEL, BALANCO, MONSTROS, ZONAS, ITENS, ESPOLIOS, ZONA, CURVA, CAMPEOES, HABS, CARTA_VALOR, CARTA_TIRAR, RESET_OURO, CARTA_TIPOS,
    KIT_HABS, BARRA, PONTOS_POR_NIVEL, NIVEL_PONTOS_HAB, rankMaximo, campeaoPelasHabs, NIVEL_DIF, TETO_VIDA_ITEM, RM_MONSTRO, VEL_ATAQUE_MAX, DT, FARM, fichaDaBuild, periodoAtaque, chaveItem, refinoDe, qualDe, cartaDe, fatorDanoJogador, ARMADURA_MONSTRO, xpParaNivel, xpEntre, fatorXp, porAbateZona, zonaIdeal, item, valorVenda, itemPorNome, espolioPorNome, valorEspolio, precoRefino, chanceRefino, chanceForja, recompensaTarefa };
})();
if (typeof module !== 'undefined') module.exports = JOGO;
`; };
  const provisorio = join(pasta, 'dados-jogo.js');      // conferido antes de ir para o src/
  writeFileSync(provisorio, gerarFonte({ kHab: {}, vaHab: {} }, null));

  // 4) confere as funções reescritas contra o motor (no mesmo processo isolado)
  const conferir = `
    const M = await import(${JSON.stringify(pathToFileURL(join(pasta, 'motor.js')).href)});
    const { createRequire } = await import('node:module');
    const J = createRequire(${JSON.stringify(pathToFileURL(join(pasta, 'x.js')).href)})(${JSON.stringify(provisorio)});
    const erros = [], igual = (nome, a, b, tol = 1e-6) => { if (!(a === b || (typeof a === 'number' && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))))) erros.push(nome + ': ' + a + ' != ' + b); };
    for (let n = 1; n <= 100; n++) igual('xpParaNivel ' + n, J.xpParaNivel(n), M.xpParaNivel(n));
    for (let a = 1; a <= 100; a += 3) for (let b = 1; b <= 100; b += 4) igual('fatorXp ' + a + ',' + b, J.fatorXp(a, b), M.fatorXp(a, b));
    for (const z of J.ZONAS) {
      const l = M.LOCAL[z.id], p = M.porAbateZona(l);
      igual('xp/abate ' + z.id, J.porAbateZona(z).xp, p.xp); igual('ouro/abate ' + z.id, J.porAbateZona(z).ouro, p.ouro);
    }
    for (let n = 1; n <= 100; n++) igual('zonaIdeal ' + n, J.zonaIdeal(n).id, M.zonaIdeal(n).id);
    for (const id of Object.keys(M.KITS)) for (const t of M.ORDEM_HAB) for (let n = 1; n <= 100; n++) igual('rankMaximo ' + id + ' ' + t + ' ' + n, J.rankMaximo(id, t, n), M.rankMaximoNoNivel({ campeao: id, nivel: n }, t));
    for (const id of Object.keys(M.KITS)) igual('campeaoPelasHabs ' + id, J.campeaoPelasHabs(Object.fromEntries(M.ORDEM_HAB.filter((t) => M.KITS[id].hab[t]).map((t) => [t, M.KITS[id].hab[t].nome]))), id);
    for (const it of J.ITENS) for (let r = 0; r < 7; r++) { igual('precoRefino ' + it.id + '+' + r, J.precoRefino(it.id, r), M.precoRefino(it.id + '+' + r)); for (const q of J.ORDEM_QUAL) igual('valorVenda ' + it.id + r + q, J.valorVenda(it.id, r, q), M.valorVenda(it.id + '+' + r + '~' + q)); }
    // espólios: o mesmo valor do motor e o total de uma mochila inteira igual ao valorEspolios dele
    for (const id of Object.keys(M.ESPOLIOS)) igual('valorEspolio ' + id, J.valorEspolio(id, 37), M.ESPOLIOS[id].valor * 37);
    const bolsa = Object.fromEntries(Object.keys(M.ESPOLIOS).map((id, k) => [id, 1 + k * 13]));
    igual('valorEspolios', Object.entries(bolsa).reduce((s, [id, q]) => s + J.valorEspolio(id, q), 0), M.valorEspolios({ espolios: bolsa }));
    for (const it of J.ITENS) igual('itemPorNome ' + it.id, J.itemPorNome(M.ITENS[it.id].nome)?.id, it.id);
    for (let r = 0; r < 7; r++) for (const f of [0, 1, 50, 79, 80, 100, 119, 299, 799, 3499, 7999, 8000, 11999, 12000]) for (const vip of [false, true])
      igual('chanceForja ' + r + ',' + f + ',' + vip, J.chanceForja(r, f, vip), M.chanceForjaAgora({ vipAte: vip ? Date.now() + 1e9 : 0, persistencia: { forja: { [(r + 1) + ':basico']: f } } }, r, '1001'));
    console.log(JSON.stringify(erros.slice(0, 10)), erros.length);
  `;
  const v = spawnSync(process.execPath, ['--permission', `--allow-fs-read=${pasta}`, '--input-type=module', '-e', conferir], { encoding: 'utf8', maxBuffer: 64e6, cwd: pasta, env: ENV_FILHO });
  if (v.status !== 0) throw new Error('a conferência falhou:\n' + (v.stderr || v.stdout).slice(0, 2000));
  const [lista, total] = [v.stdout.trim().split('\n').pop().replace(/ \d+$/, ''), +v.stdout.trim().split(' ').pop()];
  if (total) throw new Error(`as funções reescritas divergem do motor em ${total} conta(s): ${lista}`);
  // 4b) a ficha: fichaDaBuild contra atributos() do motor em milhares de builds aleatórias (todos os campeões, níveis 1 a 100, itens com
  // refino, qualidade e carta, atributos, conquistas e mascote), mais o relógio do ataque (degrau do DT) medido no combate do motor.
  // Escrita como função de verdade (o Node confere a sintaxe) e mandada ao filho como texto.
  const conferirFichaFilho = async (motorUrl, provisorio, base, N) => {
    const M = await import(motorUrl);
    const { createRequire } = await import('node:module');
    const J = createRequire(base)(provisorio);
    let sem = 20261026;
    const rnd = () => { sem = (sem + 0x6D2B79F5) | 0; let t = Math.imul(sem ^ (sem >>> 15), 1 | sem); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const int = (n) => Math.floor(rnd() * n), pick = (l) => l[int(l.length)];
    const erros = [];
    let contas = 0;
    const igual = (nome, a, b, tol = 1e-9) => { contas++; if (!(a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))))) erros.push(nome + ': ' + a + ' != ' + b); };
    const camps = Object.keys(M.KITS), ids = J.ITENS.map((i) => i.id), cartas = Object.keys(M.CARTAS), quals = ['C', 'B', 'A', 'S', 'SS', null];
    const comBonus = M.CONQUISTAS.filter((c) => c.bonus);
    for (let k = 0; k < N; k++) {
      const campeao = camps[k % camps.length], nivel = 1 + int(100), total = 3 * (nivel - 1);
      const atrib = { forca: int(total + 1), vitalidade: int(total / 2 + 1), resistencia: int(total / 3 + 1), agilidade: int(total / 2 + 1), foco: int(total / 2 + 1) };
      const itens = Array.from({ length: int(7) }, () => { const id = pick(ids), q = pick(quals); return M.comItem(rnd() < 0.15 ? id + '!' : id, int(8), q, rnd() < 0.4 ? pick(cartas) : null); });
      const ranks = { Q: 1, W: int(11), E: int(11) };
      const conquistas = comBonus.filter(() => rnd() < 0.4).map((c) => c.id), mascote = pick(['krug', 'poro', 'dragao', null]), nivelM = int(21);
      const estado = { campeao, nivel, atrib, itens, ranks, conquistas, mascote, mascotes: mascote ? { [mascote]: { nivel: nivelM } } : {} };
      const bc = M.bonusMascote(estado), bonus = { ad: 0, vida: 0, armadura: bc.armadura, rm: bc.rm };
      for (const c of comBonus) if (conquistas.includes(c.id)) for (const [q, v] of Object.entries(c.bonus)) if (q in bonus) bonus[q] += v;
      const a = M.atributos(estado), f = J.fichaDaBuild({ campeao, nivel, atrib, itens, ranks, bonus }), rot = campeao + ' nv' + nivel + ' ' + itens.join(',');
      for (const c of ['ad', 'baseAd', 'bonusAd', 'ap', 'vida', 'bonusVida', 'armadura', 'bonusArmadura', 'rm', 'penMagica', 'mana', 'danoHab', 'fluxoMult', 'regenMana', 'velAtaque', 'regen', 'esquiva',
        'reducaoRecarga', 'rouboVida', 'vampirismo', 'penArmadura', 'critico', 'danoCritico']) igual(c + ' [' + rot + ']', f[c], a[c]);
      for (const id of ids) if (f.tem(id) !== a.tem(id)) { erros.push('tem ' + id + ' [' + rot + ']'); break; }
      contas++;
    }
    // as constantes das contas de monstro
    for (let n = 1; n <= 100; n++) {
      igual('armadura do monstro ' + n, J.ARMADURA_MONSTRO(n), M.CURVA.armadura(n));
      for (let m = 1; m <= 100; m += 3) igual('fatorDanoJogador ' + n + ',' + m, J.fatorDanoJogador(n, m), M.fatorDanoJogador({ nivel: n }, { nivel: m }));
    }
    for (const [nome, m] of Object.entries(J.MONSTROS)) igual('armadura de ' + nome, m.ar, M.MONSTROS[nome].armadura);
    // o relógio do ataque: a mediana do intervalo entre ataques básicos no combate do motor (alvo parado e sem morrer) tem de ser o período calculado
    const dt = J.DT;
    for (let k = 0; k < 90; k++) {
      const campeao = camps[k % camps.length], nivel = 10 + ((k * 7) % 90);
      const itens = Array.from({ length: 1 + int(5) }, () => M.comItem(pick(['3172', '3046', '3044', '3085', '3031', '3153', '3074', '6631', '3078']), int(6), pick(['C', 'B', 'A']), rnd() < 0.5 ? pick(['velocidade1', 'velocidade2', 'velocidade3']) : null));
      const estado = M.novoEstado(campeao);
      Object.assign(estado, { nivel, relogio: 43200, local: 'dragao', itens, barra: [], pontos: 0, pontosAtrib: 0, atrib: { forca: 20, vitalidade: 0, resistencia: 0, agilidade: int(60), foco: 0 }, pocoes: { vida: 0, vidaF: 0, vidaS: 0, mana: 0, manaF: 0 } });
      const a = M.atributos(estado), f = J.fichaDaBuild({ campeao, nivel, atrib: estado.atrib, itens }), c = M.criarCombate();
      const alvo = M.criarMonstro('Tropa Corpo a Corpo', 30, { chegada: 0 });
      alvo.hpMax = alvo.hp = 1e18; alvo.ad = 0; alvo.as = 0.001; c.inimigos = [alvo]; estado.vida = a.vida; estado.mana = a.mana;
      const ts = [];
      for (let t = 0; t < 40; t += dt) { M.passo(estado, c, dt); for (const ev of c.eventos) if (ev.tipo === 'dano' && ev.fonte === 'ataque') ts.push(ev.t); c.eventos.length = 0; estado.vida = a.vida; }
      const iv = ts.slice(2).map((x, i) => +(x - ts[i + 1]).toFixed(3)).sort((x, y) => x - y);
      igual('período do ataque ' + campeao + ' nv' + nivel + ' ' + itens.join(','), iv[iv.length >> 1], f.periodoAtaque, 1e-6);
    }
    return { erros: erros.slice(0, 10), total: erros.length, contas };
  };
  console.log('conferido: xpParaNivel, fatorXp, porAbateZona, zonaIdeal, rankMaximo, o campeão pelas habilidades, precoRefino, valorVenda, os espólios e a chance da forja batem com o motor.');
  const rodarFilho = (corpo) => {
    const r = spawnSync(process.execPath, ['--permission', `--allow-fs-read=${pasta}`, '--input-type=module', '-e', corpo], { encoding: 'utf8', maxBuffer: 64e6, cwd: pasta, env: ENV_FILHO, timeout: 30 * 60e3 });
    if (r.status !== 0) throw new Error('o processo isolado falhou:\n' + (r.stderr || r.stdout).slice(0, 2000));
    return JSON.parse(r.stdout.trim().split('\n').pop());
  };
  const motorUrl = pathToFileURL(join(pasta, 'motor.js')).href, baseUrl = pathToFileURL(join(pasta, 'x.js')).href;
  const cf = rodarFilho(`console.log(JSON.stringify(await (${conferirFichaFilho})(${j(motorUrl)}, ${j(provisorio)}, ${j(baseUrl)}, 4000)));`);
  if (cf.total) throw new Error(`fichaDaBuild diverge do motor em ${cf.total} conta(s): ${cf.erros.join(' | ')}`);
  console.log(`conferido: fichaDaBuild bate com o motor em ${cf.contas} contas (4000 builds aleatórias de 9 campeões, o período do ataque e as constantes dos monstros).`);
  // 5) o modelo de farm: calibra e MEDE o erro contra o combate do próprio motor (no processo isolado, sem chefes e sem monstro furioso: o
  // modelo também não os conta). Várias builds aleatórias de Yasuo e Aphelios, em zonas e níveis variados, cada uma com trocas comuns
  // (item, carta, atributos, refino, barra). Um conjunto de builds ajusta os parâmetros do modelo; OUTRO conjunto, que ele nunca viu, mede o erro.
  // O erro é a diferença entre a mudança relativa de abates/h que o modelo prevê e a que o motor dá, em pontos percentuais.
  const CAMP_FARM = {
    yasuo: { barras: [['Q', 'E', 'R', 'G'], ['Q', 'R', 'F', 'G'], ['Q', 'W', 'E', 'G'], ['Q', 'E', 'G', 'A']] },
    aphelios: { barras: [['Q', 'W', 'E', 'G'], ['W', 'G', 'Q', 'E'], ['Q', 'W', 'G', 'R'], ['Q', 'E', 'G', 'R']] },
  };
  const FARM_BASES = { treino: 40, teste: 30 }, FARM_SIM = { minutos: 10, sementes: 2 };
  const LIMITE_FARM = { mediana: 3.5, p90: 8 };      // o farm só aparece para o campeão que fica abaixo disto no conjunto de teste
  const mulberryG = (sem) => () => { sem = (sem + 0x6D2B79F5) | 0; let t = Math.imul(sem ^ (sem >>> 15), 1 | sem); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  // roda alguns combates do motor (um processo filho por lote, em paralelo). jobs: [{ id, campeao, nivel, zona, atrib, ranks, barra, itens, minutos, sementes }]
  const simularFilho = async (motorUrl, arquivo) => {
    const { readFileSync } = await import('node:fs');
    const M = await import(motorUrl);
    const jobs = JSON.parse(readFileSync(arquivo, 'utf8'));
    for (const l of M.LOCAIS) if (l.chefe) l.chefe = null;      // sem chefes
    M.FURIOSO.chance = 0;                                       // e sem monstro furioso
    const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const sim = (j, semente) => {
      Math.random = mulberry(semente);
      const e = M.novoEstado(j.campeao);
      Object.assign(e, { nivel: j.nivel, xp: 0, relogio: 12 * 3600, pontos: 0, pontosAtrib: 0, itens: j.itens, barra: j.barra, local: j.zona, pocoes: { vida: 0, vidaF: 0, vidaS: 0, mana: 0, manaF: 0 } });
      e.atrib = { forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: 0, ...j.atrib };
      e.ranks = { ...e.ranks, ...j.ranks };
      const a0 = M.atributos(e); e.vida = a0.vida; e.mana = a0.mana;
      const c = M.criarCombate(), dt = 0.05;
      let mortes = 0;
      for (let t = 0; t < j.minutos * 60; t += dt) {
        const n0 = e.nivel;
        M.passo(e, c, dt);
        e.nivel = n0; e.xp = 0; e.ouro = 0;
        c.eventos.length = 0;
        if (e.local !== j.zona) { mortes++; e.local = j.zona; const a = M.atributos(e); e.vida = a.vida; e.mana = a.mana; c.darius.morto = 0; c.inimigos = []; }
      }
      return { abates: e.totais.abates, mortes };
    };
    const saida = {};
    for (const j of jobs) {
      let ab = 0, mortes = 0;
      for (let s = 0; s < j.sementes; s++) { const r = sim(j, 100 + s); ab += r.abates; mortes += r.mortes; }
      saida[j.id] = { abatesH: (ab / j.sementes) * (60 / j.minutos), mortes };
    }
    return saida;
  };
  // uma build aleatória plausível (itens de ataque, cartas, atributos, ranks e barra) e as trocas comuns a partir dela
  const POOL_FARM = { botas: ['3172', '3006', '3008', '3168'], armas: ['3031', '3036', '3044', '3046', '3071', '3072', '3074', '3078', '3085', '3153', '3748', '6610', '6631', '3051', '3035', '3077', '3133', '1053'],
    outros: ['3026', '3156', '3086', '3057', '6670', '6673', '3068', '2501', '3742', '663056', '2019'],
    cartas: ['ataque1', 'ataque2', 'ataque3', 'velocidade1', 'velocidade2', 'velocidade3', 'critico1', 'critico2', 'vida2', 'vampirismo2', 'roubo2', 'recarga2'] };
  const rankMax = (H, t, nivel) => {
    const h = H[t];
    if (!h || nivel < h.nivel) return 0;
    if (t === 'R') return [6, 11, 16, 25, 35].filter((n) => nivel >= n).length;
    if (t === 'N') return [45, 46, 47, 48, 50].filter((n) => nivel >= n).length;
    if (t === 'Q' || t === 'W' || t === 'E') return Math.min(h.max, Math.ceil(nivel / 2));
    return Math.min(h.max, 1 + Math.floor((nivel - h.nivel) / 2));
  };
  function baseFarm(J, campeao, rnd) {
    const pick = (l) => l[Math.floor(rnd() * l.length)], H = J.HABS[campeao];
    const nivel = 24 + Math.floor(rnd() * 22);
    const zona = pick(J.ZONAS.filter((z) => z.mundo === 'rift' && z.tier >= 3 && z.tier <= 7 && z.nm[0] <= nivel + 1 && z.nm[0] >= nivel - 12)).id;
    const ids = [pick(POOL_FARM.botas)], pool = [...POOL_FARM.armas], po = [...POOL_FARM.outros];
    for (let i = 0, nA = 2 + Math.floor(rnd() * 3); i < nA; i++) ids.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    while (ids.length < 5) ids.push(po.splice(Math.floor(rnd() * po.length), 1)[0]);
    const its = ids.map((id) => ({ id, refino: Math.floor(rnd() * 6), qual: pick(['C', 'B', 'B', 'A', 'A', 'S']), carta: rnd() < 0.6 ? pick(POOL_FARM.cartas) : '' }));
    const total = 3 * (nivel - 1), forca = Math.round(total * (0.4 + 0.6 * rnd())), agi = Math.round((total - forca) * rnd()), vit = Math.round((total - forca - agi) * 0.7);
    const barra = pick(CAMP_FARM[campeao].barras).filter((t) => rankMax(H, t, nivel) > 0), ranks = { Q: 1 };
    const extras = Object.keys(H).filter((t) => H[t].recarga && !barra.includes(t) && rankMax(H, t, nivel) > 0).sort(() => rnd() - 0.5).slice(0, 2);      // habilidades aprendidas fora da barra (para a troca de barra)
    const alvos = [...new Set([...barra, 'D', ...extras])].filter((t) => rankMax(H, t, nivel) > 0);
    for (let pts = Math.min(50, nivel) - 1; pts > 0 && alvos.some((t) => (ranks[t] || 0) < rankMax(H, t, nivel)); ) { const t = pick(alvos); if ((ranks[t] || 0) < rankMax(H, t, nivel)) { ranks[t] = (ranks[t] || 0) + 1; pts--; } }
    return { campeao, nivel, zona, atrib: { forca, agilidade: agi, vitalidade: vit, resistencia: total - forca - agi - vit }, ranks, barra, its };
  }
  function variantesFarm(J, b, rnd) {
    const pick = (l) => l[Math.floor(rnd() * l.length)], H = J.HABS[b.campeao];
    const troca = (k, id) => ({ ...b, its: b.its.map((x, i) => (i === k ? { ...x, id } : x)) });
    const k = 1 + Math.floor(rnd() * (b.its.length - 1)), k2 = Math.floor(rnd() * b.its.length), mv = Math.round(b.atrib.forca * 0.25);
    const outras = Object.keys(H).filter((t) => H[t].recarga && (b.ranks[t] || 0) > 0 && !b.barra.includes(t));
    const v = [
      { tipo: 'item', b: troca(k, pick([...POOL_FARM.armas, ...POOL_FARM.outros].filter((x) => !b.its.some((y) => y.id === x)))) },
      { tipo: 'carta', b: { ...b, its: b.its.map((x, i) => (i === k2 ? { ...x, carta: pick(POOL_FARM.cartas.filter((c) => c !== x.carta)) } : x)) } },
      { tipo: 'atributos', b: { ...b, atrib: { ...b.atrib, forca: b.atrib.forca - mv, agilidade: b.atrib.agilidade + mv } } },
      { tipo: 'refino', b: { ...b, its: b.its.map((x, i) => (i === k2 ? { ...x, refino: Math.min(7, x.refino + 2) } : x)) } },
    ];
    if (outras.length && b.barra.length) v.push({ tipo: 'barra', b: { ...b, barra: b.barra.map((t, i) => (i === b.barra.length - 1 ? pick(outras) : t)) } });
    return v;
  }
  const chaveFarm = (J, i) => J.chaveItem({ id: i.id, refino: i.refino, qual: i.qual, carta: i.carta });
  const quantil = (v, p) => { const o = [...v].sort((x, y) => x - y); return o.length ? o[Math.min(o.length - 1, Math.floor(o.length * p))] : null; };
  // ajusta os parâmetros por busca em grade, uma coordenada de cada vez (4 voltas); a perda soma o erro das trocas e um pouco do erro do nível
  function ajustarFarm(CALC, J, campeao, pts) {
    const ativos = campeao === 'yasuo' ? ['k', 'aoe', 'uG', 'castEf'] : ['k', 'aoe', 'uG', 'uW', 'kite', 'castEf'];
    const GR = { k: [0, 4, 0.1], aoe: [0, 2, 0.1], uG: [0, 1.5, 0.1], uW: [0, 1.5, 0.1], kite: [0, 8, 0.25], castEf: [0, 1.5, 0.1] };
    const mk = (P) => ({ kHab: { [campeao]: P.k }, aoe: { [campeao]: P.aoe }, upt: { [campeao]: { G: P.uG, W: P.uW } }, kiteGrupo: { [campeao]: P.kite }, castEf: { [campeao]: P.castEf }, vaHab: {} });
    const modelo = (p, P) => CALC.estimarFarm(p.ficha, campeao, p.job.zona, p.job.nivel, { hab: p.hab, farm: mk(P) }).abatesH;
    const grupos = {};
    for (const p of pts) (grupos[p.job.grupo] ||= []).push(p);
    const perda = (P) => {
      let sp = 0, np = 0;
      const lv = pts.map((p) => Math.log(modelo(p, P) / p.abatesH)), m = lv.reduce((a, b) => a + b, 0) / lv.length;
      for (const g of Object.values(grupos)) {
        const base = g.find((x) => x.job.tipo === 'base');
        if (!base) continue;
        const mb = modelo(base, P);
        for (const v of g) if (v !== base && v.job.tipo !== 'barra') { sp += (Math.log(modelo(v, P) / mb) - Math.log(v.abatesH / base.abatesH)) ** 2; np++; }
      }
      return sp / Math.max(1, np) + 0.2 * (lv.reduce((a, b) => a + (b - m) ** 2, 0) / lv.length);
    };
    let P = { k: 1, aoe: 0.25, uG: 1, uW: 1, kite: 1.75, castEf: 1 }, melhor = perda(P);
    for (let volta = 0; volta < 4; volta++) for (const nome of ativos) {
      const [a, b, c] = GR[nome];
      for (let x = a; x <= b + 1e-9; x += c) { const Q = { ...P, [nome]: +x.toFixed(4) }, l = perda(Q); if (l < melhor - 1e-12) { melhor = l; P = Q; } }
    }
    return { P, farm: mk(P), modelo };
  }

  // --simular <builds.json>: só roda o combate do motor para essas builds (para conferir uma previsão do comparador contra o jogo) e
  // sai, sem gravar nada. Cada build: { id, campeao, nivel, zona, atrib, ranks, barra, itens: [chaves], minutos, sementes }
  const iSim = process.argv.indexOf('--simular');
  if (iSim > 0) {
    const copia = join(pasta, 'jobs-avulsos.json');
    writeFileSync(copia, JSON.stringify(JSON.parse(readFileSync(process.argv[iSim + 1], 'utf8'))));
    console.log(JSON.stringify(rodarFilho(`console.log(JSON.stringify(await (${simularFilho})(${j(motorUrl)}, ${j(copia)})));`)));
    rmSync(pasta, { recursive: true, force: true });
    process.exit(0);
  }
  // 5b) roda a calibração (ou, com --sem-farm, reaproveita a anterior: o erro guarda o sha do motor com que foi medido)
  let FARM = { kHab: {}, vaHab: {}, liberado: {} }, erroComparador = null;
  const anterior = (() => { try { const A = createRequire(import.meta.url)(SAIDA); return A.FARM?.kHab && A.meta?.erroComparador ? A : null; } catch { return null; } })();
  if (process.argv.includes('--sem-farm') && anterior) {
    // a calibração vale para o motor com que foi medida: com o jogo mudado, reaproveitá-la publicaria um erro que não é mais o real
    if (anterior.meta.erroComparador.motorSha256 !== sha) throw new Error('o motor do jogo mudou desde a última calibração do farm: rode sem --sem-farm para recalibrar');
    FARM = anterior.FARM; erroComparador = anterior.meta.erroComparador;
    console.log(`farm: calibração anterior reaproveitada (medida com o motor ${String(erroComparador.motorSha256 || '?').slice(0, 12)}).`);
  } else {
    const req = createRequire(import.meta.url);
    const JP = req(provisorio);
    globalThis.JOGO = JP;
    const CALC = req(join(aqui, 'src', 'calculos.js'));
    const jobs = [], rndTreino = mulberryG(20261026), rndTeste = mulberryG(20261027);
    for (const campeao of Object.keys(CAMP_FARM)) for (const [conjunto, rnd] of [['treino', rndTreino], ['teste', rndTeste]]) for (let i = 0; i < FARM_BASES[conjunto]; i++) {
      const b = baseFarm(JP, campeao, rnd), grupo = `${campeao}-${conjunto}-${i}`;
      for (const [tipo, bb] of [['base', b], ...variantesFarm(JP, b, rnd).map((v) => [v.tipo, v.b])])
        jobs.push({ id: grupo + ':' + tipo, grupo, conjunto, tipo, campeao, nivel: bb.nivel, zona: bb.zona, atrib: bb.atrib, ranks: bb.ranks, barra: bb.barra, itens: bb.its.map((x) => chaveFarm(JP, x)), ...FARM_SIM });
    }
    const lotes = Math.max(1, Math.min(10, cpus().length - 1)), partes = Array.from({ length: lotes }, () => []);
    jobs.forEach((jb, k) => partes[k % lotes].push(jb));
    console.log(`farm: simulando ${jobs.length} builds (${FARM_SIM.sementes} sementes x ${FARM_SIM.minutos} min cada) em ${lotes} processos isolados...`);
    const inicio = Date.now();
    // cada lote num processo isolado, com tempo-limite; se um falhar, os outros são encerrados (senão seguiriam rodando
    // com a pasta temporária aberta e o rmSync do fim falharia, escondendo o erro de verdade)
    const filhos = new Set(), LIMITE_LOTE = 20 * 60e3;
    const rodarAsync = (corpo) => new Promise((ok, falha) => {
      const p = spawn(process.execPath, ['--permission', `--allow-fs-read=${pasta}`, '--input-type=module', '-e', corpo], { cwd: pasta, env: ENV_FILHO });
      filhos.add(p);
      const relogio = setTimeout(() => { p.kill(); falha(new Error('a simulação passou do tempo-limite')); }, LIMITE_LOTE);
      let out = '', err = '';
      p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
      p.on('error', (e) => { clearTimeout(relogio); filhos.delete(p); falha(e); });
      p.on('close', (cod) => {
        clearTimeout(relogio); filhos.delete(p);
        if (cod !== 0) return falha(new Error('a simulação falhou:\n' + (err || out).slice(0, 2000)));
        try { ok(JSON.parse(out.trim().split('\n').pop())); } catch (e) { falha(e); }
      });
    });
    const parciais = await Promise.all(partes.map((lista, k) => {
      const arq = join(pasta, `jobs-${k}.json`);
      writeFileSync(arq, JSON.stringify(lista));
      return rodarAsync(`console.log(JSON.stringify(await (${simularFilho})(${j(motorUrl)}, ${j(arq)})));`);
    })).catch((e) => { for (const p of filhos) p.kill(); throw e; });
    const res = Object.assign({}, ...parciais);
    console.log(`farm: simulações prontas em ${Math.round((Date.now() - inicio) / 1000)} s.`);
    const pontos = (campeao, conjunto) => jobs.filter((jb) => jb.campeao === campeao && jb.conjunto === conjunto && res[jb.id] && res[jb.id].mortes === 0).map((jb) => {
      const ficha = JP.fichaDaBuild({ campeao, nivel: jb.nivel, atrib: jb.atrib, itens: jb.itens, ranks: jb.ranks });
      return { job: jb, ficha, hab: CALC.habilidades(ficha, campeao, { ranks: jb.ranks, barra: jb.barra }), abatesH: res[jb.id].abatesH };
    });
    const porCampeao = {}, todos = [], todosBarra = [];
    FARM = { kHab: {}, aoe: {}, upt: {}, kiteGrupo: {}, castEf: {}, vaHab: {}, liberado: {} };
    for (const campeao of Object.keys(CAMP_FARM)) {
      const aj = ajustarFarm(CALC, JP, campeao, pontos(campeao, 'treino'));
      for (const k of ['kHab', 'aoe', 'upt', 'kiteGrupo', 'castEf']) FARM[k][campeao] = aj.farm[k][campeao];
      // o erro, medido nas builds de teste: mudança relativa de abates/h no modelo contra a mesma mudança no motor
      const teste = pontos(campeao, 'teste'), grupos = {};
      for (const p of teste) (grupos[p.job.grupo] ||= []).push(p);
      const erros = [], errosBarra = [], piores = [];
      for (const g of Object.values(grupos)) {
        const base = g.find((x) => x.job.tipo === 'base');
        if (!base) continue;
        for (const v of g) if (v !== base) {
          const e = Math.abs((aj.modelo(v, aj.P) / aj.modelo(base, aj.P) - 1) - (v.abatesH / base.abatesH - 1)) * 100;
          (v.job.tipo === 'barra' ? errosBarra : erros).push(e);
          if (process.env.LUPA_DEBUG_FARM) piores.push({ e, tipo: v.job.tipo, campeao, base: base.job, variante: v.job, sim: (v.abatesH / base.abatesH - 1) * 100, modelo: (aj.modelo(v, aj.P) / aj.modelo(base, aj.P) - 1) * 100 });
        }
      }
      const resumo = (v) => ({ n: v.length, mediana: +quantil(v, 0.5).toFixed(2), p90: +quantil(v, 0.9).toFixed(2), max: +Math.max(...v).toFixed(2) });
      // a faixa em que o erro foi medido (níveis e zonas das builds simuladas): fora dela a tela avisa que pode errar mais
      const doCamp = jobs.filter((jb) => jb.campeao === campeao), niveis = doCamp.map((jb) => jb.nivel);
      const faixa = { niveis: [Math.min(...niveis), Math.max(...niveis)], zonas: [...new Set(doCamp.map((jb) => jb.zona))].sort() };
      porCampeao[campeao] = { ...resumo(erros), barra: errosBarra.length ? resumo(errosBarra) : null, faixa, parametros: aj.P };
      FARM.liberado[campeao] = porCampeao[campeao].mediana <= LIMITE_FARM.mediana && porCampeao[campeao].p90 <= LIMITE_FARM.p90;
      if (process.env.LUPA_DEBUG_FARM) for (const p of piores.sort((x, y) => y.e - x.e).slice(0, 8)) console.log('  pior', p.campeao, p.tipo, 'erro', p.e.toFixed(1), 'motor', p.sim.toFixed(1), 'modelo', p.modelo.toFixed(1), JSON.stringify({ nivel: p.base.nivel, zona: p.base.zona, barra: p.base.barra, ranks: p.base.ranks, itens: p.base.itens, itens2: p.variante.itens, atrib: p.variante.atrib, barra2: p.variante.barra }));
      todos.push(...erros); todosBarra.push(...errosBarra);
      console.log(`farm: ${campeao}: erro nas trocas comuns (item, carta, atributos, refino) mediana ${porCampeao[campeao].mediana}, p90 ${porCampeao[campeao].p90}, máx ${porCampeao[campeao].max} pontos (${erros.length} trocas de teste); troca de barra: ${errosBarra.length ? 'mediana ' + porCampeao[campeao].barra.mediana + ', máx ' + porCampeao[campeao].barra.max : 'sem dados'}; ${FARM.liberado[campeao] ? 'liberado' : 'NÃO liberado (erro acima do limite)'}.`);
    }
    erroComparador = { ...(() => { const r = { n: todos.length, mediana: +quantil(todos, 0.5).toFixed(2), p90: +quantil(todos, 0.9).toFixed(2), max: +Math.max(...todos).toFixed(2) }; return r; })(),
      barra: todosBarra.length ? { n: todosBarra.length, mediana: +quantil(todosBarra, 0.5).toFixed(2), p90: +quantil(todosBarra, 0.9).toFixed(2), max: +Math.max(...todosBarra).toFixed(2) } : null,
      unidade: 'pontos percentuais de abates/h (diferença entre a mudança relativa no modelo e no motor)', porCampeao, limite: LIMITE_FARM,
      simulacao: { ...FARM_SIM, basesTreino: FARM_BASES.treino, basesTeste: FARM_BASES.teste, semChefes: true, semFurioso: true, motorSha256: sha }, motorSha256: sha };
    console.log(`farm: erro geral nas trocas comuns: mediana ${erroComparador.mediana}, p90 ${erroComparador.p90}, máx ${erroComparador.max} pontos.`);
  }
  const fonteFinal = gerarFonte(FARM, erroComparador);
  const finalArq = join(pasta, 'final.js');
  writeFileSync(finalArq, fonteFinal);
  const F = createRequire(import.meta.url)(finalArq);      // o arquivo final carrega e traz o farm
  if (!F.FARM?.kHab || !F.meta?.erroComparador || typeof F.fichaDaBuild !== 'function') throw new Error('o dados-jogo.js final não carregou direito');
  writeFileSync(SAIDA, fonteFinal);
  console.log('gravado', SAIDA);
  writeFileSync(SAIDA_LUPA, fonteFinal);      // o painel da Lupa usa o mesmo arquivo (valorVenda)
  console.log('gravado', SAIDA_LUPA);
} finally {
  rmSync(pasta, { recursive: true, force: true });
}
