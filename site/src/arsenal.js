// Lupa Online · Arsenal: o Arsenal das Lendas do jogo (a Guardiã do Arsenal, na praça da Fonte). O que da mochila vale registrar, quanto
// falta para o próximo patamar de cada coleção, quanto custa cada estrela e um simulador. As estrelas de cada item vêm da janela da
// Guardiã, que a Lupa lê quando ela está aberta; a mochila e o Mercado, das leituras de sempre. As regras estão em dados-jogo.js
// (conferidas contra o jogo) e as contas em calculos.js. Tudo aqui é ESTIMATIVA: o site só calcula, não mexe no jogo.
'use strict';

const { progressoCodex, leituraCodex, registrarCopias, patamares, planoMochila, tabelaEstrelas } = CALC;

const NOME_PG = { lendario: 'Lendários', epico: 'Épicos' }, UM_PG = { lendario: 'lendário', epico: 'épico' };
const NOME_COL = Object.fromEntries(JOGO.CODEX.colecoes.map((c) => [c.id, c.nome]));
const NOME_BONUS = { dano: 'dano', defesa: 'vida e defesa', va: 'velocidade de ataque' };
const nBR = (v, casas) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
// bônus em fração -> "0,04%"; a parte de uma estrela (bem pequena) com dois algarismos
const pctB = (v) => {
  const p = v * 100;
  return (Math.abs(p) >= 0.01 || p === 0 ? (Math.round(p * 1000) / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) : p.toLocaleString('pt-BR', { maximumSignificantDigits: 2 })) + '%';
};
const somaBonus = (b) => ['dano', 'defesa', 'va'].filter((k) => Math.abs(b[k]) > 1e-9).map((k) => `+${pctB(b[k])} de ${NOME_BONUS[k]}`).join(' · ');
const difBonus = (a, b) => ({ dano: b.dano - a.dano, defesa: b.defesa - a.defesa, va: b.va - a.va });
// rende: % de bônus por milhão de ouro
const rendeTxt = (r) => (r >= 10 ? nBR(r, 0) : r >= 1 ? nBR(r, 1) : r >= 0.1 ? nBR(r, 2) : nBR(r, 3));
const FAIXAS = [[0.1, 'vale', 'Vale'], [0.02, 'caro', 'Caro'], [-Infinity, 'muito-caro', 'Muito caro']];
const faixa = (r) => FAIXAS.find(([min]) => r >= min);
const nomeItem = (id) => JOGO.item(id)?.nome || id;
const baseIdDe = (x) => String(x).split(/[!+~#]/)[0];
const pontosTxt = (v) => `${nBR(v, Number.isInteger(v) ? 0 : v * 10 === Math.round(v * 10) ? 1 : 2)} pt${v === 1 ? '' : 's'}`;
// "B +4 · comprado" a partir de "3031!+4~B"
const versao = (chave) => { const m = String(chave).match(RE_CHAVE); return m ? `${m[5]}${m[3] ? ' +' + m[3] : ''}${m[2] ? ' · comprado' : ''}` : chave; };
// S, SS e refinados +3 ou mais: o jogo os deixa fora do "Registrar tudo" (o refino se perde com o item)
const topo = (chave) => /~(S|SS)$/.test(chave) || JOGO.refinoDe(chave) >= 3;
const outraMarca = (chave) => (/^\d+!/.test(chave) ? chave.replace('!', '') : chave.replace(/^(\d+)/, '$1!'));
const camposNum = (props) => h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', ...props });
const lerNum = (t) => { const x = String(t ?? '').trim().replace(',', '.'); if (!x) return null; const n = Number(x); return Number.isFinite(n) ? n : null; };

(async () => {
  await exigirLogin();
  montarNav();
  const raiz = $id('pagina');
  let estados, icones, mercado;
  try { [estados, icones, mercado] = await Promise.all([Nuvem.estados(), Nuvem.icones(), Nuvem.mercadoUltimos(), Nuvem.planos()]); }      // planos: nomeCurto usa o campeão
  catch (e) { erroNaPagina(raiz, e); return; }
  const ctx = { icones };
  const nomes = Object.keys(estados).sort();
  let quem = lerPref('arsenal-quem', '');
  if (!nomes.includes(quem)) quem = nomes.find((n) => estados[n].codex) || nomes[0] || '';

  // Mercado (últimos 7 dias): o menor anúncio de cada versão e, por item do Arsenal, as ofertas sem carta, da mais barata por ponto.
  // Comprado no Mercado, o item ganha a marca "!" e vale metade dos pontos.
  const porChave = new Map(mercado.map((g) => [g.chave, g])), ofertas = new Map();
  for (const g of mercado) {
    const m = String(g.chave).match(RE_CHAVE);
    if (!m || m[4] || g.ouro == null || !JOGO.paginaCodex(m[1])) continue;
    const pts = JOGO.pontosCopia(m[1] + '!' + g.chave.slice(m[1].length + m[2].length));
    (ofertas.get(m[1]) ?? ofertas.set(m[1], []).get(m[1])).push({ chave: g.chave, ouro: g.ouro, pts, porPonto: g.ouro / pts, n: g.n });
  }
  for (const l of ofertas.values()) l.sort((a, b) => a.porPonto - b.porPonto);
  const precoMercado = (chave) => porChave.get(chave)?.ouro ?? porChave.get(outraMarca(chave))?.ouro ?? null;
  const vendaLojista = (chave) => { const m = String(chave).match(RE_CHAVE); return m ? JOGO.valorVenda(m[1], +(m[3] || 0), m[5]) || 0 : 0; };
  const icoItem = (id, tam = 28) => imagem(nomeItem(id), ctx, { tam, raridade: JOGO.paginaCodex(id) || undefined });
  const geradoEm = Date.parse(JOGO.meta.geradoEm);

  // ---------- leitura ----------
  function avisos(e, cx, leit, prog) {
    const out = [];
    const alerta = (texto) => h('div', { class: 'alerta fora', role: 'status' }, icone('alerta', 20), h('span', null, texto));
    if (!cx) {
      out.push(alerta('Ainda não li o Arsenal deste personagem. No jogo, fale com a Guardiã do Arsenal (no meio da praça da Fonte) com a Lupa ligada e passe pelas abas Lendários e Épicos com o filtro Todos. Até lá, as contas abaixo supõem o Arsenal vazio.'));
      return out;
    }
    const faltando = Object.entries(leit).filter(([, l]) => !l.ok);
    for (const [pg, l] of faltando) {
      out.push(alerta(l.total == null
        ? `Ainda não li a aba ${NOME_PG[pg]} da Guardiã: abra essa aba uma vez com o filtro Todos. Até lá, os ${NOME_PG[pg].toLowerCase()} contam como vazios.`
        : `A leitura dos ${NOME_PG[pg].toLowerCase()} está incompleta (${l.lidas} de ${l.total} estrelas): abra a aba ${NOME_PG[pg]} da Guardiã com o filtro Todos.`));
    }
    // a conta das estrelas lidas contra o que as medalhas do jogo mostram
    if (cx.bonus && !faltando.length) {
      const c = JOGO.bonusCodex(prog), dif = ['dano', 'defesa', 'va'].filter((k) => Math.abs(c[k] - (cx.bonus[k] || 0)) > 0.000015);
      if (dif.length) out.push(alerta(`A conta das estrelas lidas não bate com a medalha do jogo em ${dif.map((k) => `${NOME_BONUS[k]} (conta ${pctB(c[k])}, jogo ${pctB(cx.bonus[k] || 0)})`).join(' e ')}. As regras podem ter mudado: rode gerar-tabelas.mjs.`));
    }
    if (cx.visto && Date.now() - cx.visto > DIA) out.push(nota(`A janela da Guardiã foi lida pela última vez em ${dataHora(cx.visto)}. Se registrou algo depois, abra a Guardiã de novo para atualizar.`));
    return out;
  }

  // ---------- 1) o bônus da conta ----------
  function cartaoBonus(e, cx, prog, leit) {
    const b = cx?.bonus || JOGO.bonusCodex(prog), max = JOGO.BONUS_MAX_CODEX;
    const t = (k, rot) => tile(rot, '+' + pctB(b[k] || 0), [cx?.ganho?.[k], `de ${pctB(max[k])} possíveis`].filter(Boolean).join(' · '));
    const est = (pg) => { const l = leit[pg]; return tile(`Estrelas · ${NOME_PG[pg].toLowerCase()}`, l.total != null ? `${l.total}` : `${l.lidas}`, `de ${Object.values(JOGO.CODEX.itens[pg]).flat().length * 10}`); };
    const ouro = lerPreco(e?.ficha?.stats?.ouro || '');
    return cartao('Bônus da conta',
      h('div', { class: 'grade-tiles' }, t('dano', 'Dano'), t('defesa', 'Vida, armadura e resistência'), t('va', 'Velocidade de ataque'), est('lendario'), est('epico'),
        ouro != null ? tile('Seu ouro', precoTxt(ouro), e?.ts ? `lido às ${hora(e.ts)}` : '') : null),
      nota(`O Arsenal é da conta: vale para todos os personagens dela, para sempre. O dano soma no ataque e no poder de habilidade, então itens de magia também servem para quem bate com ataque. ${cx?.em ? `Mudou pela última vez em ${dataHora(cx.em)}.` : ''}`));
  }

  // ---------- 2) a mochila: o que registrar ----------
  function cartaoMochila(e, prog) {
    const mochila = (e?.ficha?.mochila || []).filter((i) => i.raridade === 'lendario' || i.raridade === 'epico');
    const chaves = mochila.map((i) => String(i.id || '')).filter((x) => JOGO.paginaCodex(x));
    const fora = { carta: chaves.filter((x) => JOGO.cartaDe(x)).length, pendente: chaves.filter((x) => /~\?$/.test(x)).length };
    // o plano: só as cópias que valem (o mesmo item, da cópia que vale menos para a que vale mais, pulando a que não compensa)
    const { linhas, depois, taxa } = planoMochila(prog, chaves, { venda: vendaLojista, limiar: FAIXAS[0][0] });
    const corpo = [];
    if (!linhas.length) {
      corpo.push(vazio(e?.ficha ? 'Nenhum lendário ou épico registrável na mochila agora.' : 'Ainda não tenho a mochila deste personagem: a Lupa precisa ler o jogo e enviar.'));
    } else {
      const vale = linhas.filter((l) => l.recomendada);
      const ganho = difBonus(JOGO.bonusCodex(prog), JOGO.bonusCodex(depois)), ouro = lerPreco(e?.ficha?.stats?.ouro || '');
      corpo.push(vale.length
        ? h('div', { class: 'destaque' },
          h('div', null, h('span', { class: 'rotulo' }, `Registrar as ${vale.length} cópia${vale.length > 1 ? 's' : ''} que valem`), h('span', { class: 'grande' }, somaBonus(ganho) || '+0%')),
          h('div', null, h('span', { class: 'rotulo' }, 'Taxa da Guardiã'), h('span', { class: 'grande' }, precoTxt(taxa)), ouro != null && ouro < taxa ? h('span', { class: 'st-sub' }, `você tem ${precoTxt(ouro)}: comece pelas de cima`) : null))
        : nota('Nada na mochila rende o bastante agora: as cópias abaixo cairiam em estrelas caras.'));
      const colunas = [{ t: 'Item' }, { t: 'Cópia' }, { t: 'Estrelas' }, { t: 'Bônus' }, { t: 'Taxa', num: true, ordena: true }, { t: 'Lojista', num: true }, { t: 'Mercado', num: true }, { t: 'Rende', num: true, ordena: true }, { t: 'Vale?' }];
      const lin = linhas.map((l) => {
        const [, cls, rot] = faixa(l.rende), merc = precoMercado(l.chave);
        const veredito = l.pulada ? h('span', { class: 'etiqueta muito-caro' }, 'Item completo: venda')
          : h('span', { class: 'etiqueta-pilha' }, h('span', { class: 'etiqueta ' + cls }, rot), topo(l.chave) ? h('span', { class: 'fraco' }, 'S, SS ou +3: compare com o Mercado') : null);
        return {
          classe: l.recomendada ? null : 'fraca',
          celulas: [
            h('div', { class: 'item' }, icoItem(l.id), h('div', { class: 'item-texto' }, h('span', { class: 'item-nome' }, nomeItem(l.id)), h('span', { class: 'fraco' }, `${NOME_COL[l.colecao]} · ${UM_PG[l.pg]}`))),
            h('span', null, versao(l.chave), h('small', { class: 'fraco bloco' }, pontosTxt(l.pts))),
            h('span', null, l.pulada ? '★10' : l.kPara > l.kDe ? `★${l.kDe} → ★${l.kPara}` : `★${l.kDe}`, l.recomendada && l.deN > 1 ? h('small', { class: 'fraco bloco' }, `${l.passo}ª de ${l.deN} deste item`) : null,
              l.perdidos > 0 && !l.pulada ? h('small', { class: 'fraco bloco' }, `${pontosTxt(l.perdidos)} passam do máximo`) : null),
            h('span', null, '+' + pctB(l.bonusItem), l.bonusPatamar > 0 ? h('small', { class: 'fraco bloco' }, `+${pctB(l.bonusPatamar)} do patamar`) : null, h('small', { class: 'fraco bloco' }, NOME_BONUS[l.tipo])),
            precoTxt(l.taxa), precoTxt(l.venda), merc != null ? precoTxt(merc) : '—', rendeTxt(l.rende), veredito],
          v: [null, null, null, null, l.taxa, l.venda, merc, l.rende, null]
        };
      });
      corpo.push(tabela(colunas, lin, 'Cópias da mochila que podem entrar no Arsenal'));
      corpo.push(nota('Rende: quanto bônus a cópia acrescenta por milhão de ouro (a taxa da Guardiã mais o que o Lojista pagaria por ela). A cópia que não fecha estrela conta a fração dela, e a que leva um item atrasado até a estrela do próximo patamar ganha a parte dela no bônus do patamar. No mesmo item, a cópia que não compensa fica de fora e a seguinte é avaliada sem ela na frente. Vale: 0,1% por milhão ou mais (a 1ª estrela de um lendário rende uns 2%); caro: de 0,02% a 0,1%. O Mercado é o menor anúncio da mesma versão e é só referência.'));
    }
    if (fora.carta || fora.pendente) corpo.push(nota([fora.carta ? `${fora.carta} com carta (tire a carta no jogo antes de registrar)` : '', fora.pendente ? `${fora.pendente} ainda sem qualidade avaliada` : ''].filter(Boolean).join(' e ') + ' ficaram de fora.'));
    return cartao('Da mochila: o que registrar', ...corpo);
  }

  // ---------- 3) os patamares das coleções ----------
  function cartaoPatamares(e, prog) {
    const naMochila = new Map();
    for (const i of e?.ficha?.mochila || []) { const x = String(i.id || ''); if (!JOGO.motivoCodex(x)) naMochila.set(baseIdDe(x), (naMochila.get(baseIdDe(x)) || 0) + 1); }
    const pats = patamares(prog);
    const blocos = pats.map((p) => {
      const cab = h('div', { class: 'cx-col-cab' }, h('b', null, `${NOME_COL[p.colecao]}`), h('span', { class: 'fraco' }, `${UM_PG[p.pg]}s · ${NOME_BONUS[p.bonus]}`));
      const ganhos = p.ganho > 0 ? `patamares já ganhos: +${pctB(p.ganho)}` : 'nenhum patamar ainda';
      if (!p.prox) return h('div', { class: 'cx-col' }, cab, h('p', { class: 'cx-col-txt' }, `Coleção completa: todos os patamares ganhos (+${pctB(p.ganho)}).`));
      const rende = p.taxaC > 0 ? ((p.bonusItens + p.prox.bonus) * 100) / (p.taxaC / 1e6) : 0;
      const chipsItens = p.faltam.slice().sort((a, b) => (naMochila.get(b.id) || 0) - (naMochila.get(a.id) || 0) || a.p - b.p).map((x) => {
        const n = naMochila.get(x.id) || 0, o = ofertas.get(x.id)?.[0];
        const k = JOGO.estrelasCodex(p.pg, x.p);
        return h('li', { class: 'cx-falta' + (n ? ' tem' : '') }, icoItem(x.id, 22),
          h('span', null, nomeItem(x.id), h('small', { class: 'fraco' }, ` ★${k} · falta${x.falta === 1 ? '' : 'm'} ${pontosTxt(x.falta)}`)),
          n ? h('small', { class: 'cx-onde' }, `na mochila: ${n}`) : o ? h('small', { class: 'cx-onde fraco' }, `Mercado: ${precoTxt(o.ouro)} (${versao(o.chave)}, ${pontosTxt(o.pts)})`) : null);
      });
      return h('div', { class: 'cx-col' }, cab,
        h('p', { class: 'cx-col-txt' }, h('b', null, `Todos com ★${p.prox.k}: +${pctB(p.prox.bonus)}`), ` · faltam ${p.prox.faltam} de ${p.prox.total} itens (${pontosTxt(p.faltamPts)}) · ${ganhos}`),
        h('p', { class: 'cx-col-txt fraco' }, `Fechando com cópias C: ${precoTxt(p.taxaC)} de taxa por +${pctB(p.bonusItens + p.prox.bonus)} (estrelas e patamar), rende ${rendeTxt(rende)} por milhão.`),
        h('ul', { class: 'cx-faltas' }, chipsItens));
    });
    const por = (pg) => blocos.filter((_, i) => pats[i].pg === pg);
    return cartao('Patamares das coleções',
      nota('Quando todos os itens de uma coleção chegam a 1, 3, 5 e 10 estrelas, a coleção ganha um bônus a mais. Aqui, o próximo de cada uma e o que falta (o que já está na mochila primeiro). Item comprado no Mercado vale metade dos pontos.'),
      ...Object.keys(JOGO.CODEX.paginas).flatMap((pg) => [h('h3', { class: 'sub-cab' }, NOME_PG[pg]), h('div', { class: 'cx-cols' }, por(pg))]));
  }

  // ---------- 4) quanto custa cada estrela ----------
  const TE = { pg: lerPref('arsenal-te-pg', 'lendario'), q: lerPref('arsenal-te-q', 'C'), r: Number(lerPref('arsenal-te-r', '0')) || 0, c: lerPref('arsenal-te-c', '') === '1' };
  function cartaoEstrelas() {
    const corpo = h('div', { class: 'calc-corpo' });
    const pintar = () => {
      const id = JOGO.CODEX.itens[TE.pg].ataque[0], copia = `${id}${TE.c ? '!' : ''}${TE.r ? '+' + TE.r : ''}~${TE.q}`, pts = JOGO.pontosCopia(copia);
      const linhas = tabelaEstrelas(TE.pg, copia);
      let antes = { copias: 0, taxa: 0 };
      const lin = linhas.map((l) => {
        const dT = l.taxa - antes.taxa, dC = l.copias - antes.copias, junto = dC === 0;
        antes = l;
        return { celulas: [`★${l.k}`, inteiro(l.pontos), junto ? 'na mesma' : `${inteiro(dC)} (total ${inteiro(l.copias)})`, junto ? '—' : precoTxt(dT), precoTxt(l.taxa), '+' + pctB(l.bonusEstrela), '+' + pctB(l.bonus),
          junto ? 'junto' : rendeTxt((l.bonusEstrela * 100) / (dT / 1e6))] };
      });
      const sets = (k, v) => { TE[k] = v; gravarPref('arsenal-te-' + k, k === 'c' ? (v ? '1' : '') : String(v)); pintar(); };
      corpo.replaceChildren(
        h('div', { class: 'chips-linha' },
          chips('Página', Object.keys(JOGO.CODEX.paginas).map((pg) => [pg, NOME_PG[pg]]), TE.pg, (v) => sets('pg', v)),
          chips('Qualidade da cópia', JOGO.ORDEM_QUAL.map((q) => [q, q]), TE.q, (v) => sets('q', v)),
          chips('Refino da cópia', [0, 3, 4, 5, 6, 7].map((r) => [r, r ? '+' + r : 'sem refino']), TE.r, (v) => sets('r', v)),
          chave(TE.c, 'comprada (vale metade)', () => sets('c', !TE.c))),
        nota(`Cada cópia ${versao(copia)} vale ${pontosTxt(pts)}. A taxa de cada registro vai pela estrela em que o item está. Só a taxa: o que a cópia valeria vendida fica de fora.`),
        tabela([{ t: 'Estrela' }, { t: 'Pontos', num: true }, { t: 'Cópias', num: true }, { t: 'Taxa da estrela', num: true }, { t: 'Taxa até aqui', num: true }, { t: 'Bônus da estrela', num: true }, { t: 'Bônus até aqui', num: true }, { t: 'Rende', num: true }], lin, 'Custo de cada estrela'));
    };
    pintar();
    return cartao('Quanto custa cada estrela', corpo,
      nota('Rende: % de bônus da estrela por milhão de ouro de taxa. "Junto": a mesma cópia fechou mais de uma estrela. Com cópia C, depois da 3ª estrela fica caro rápido; SS e refinados altos mudam a conta.'));
  }

  // ---------- 5) simulador ----------
  const SIM = { id: '', pts: '', copias: [{ n: '1', q: 'C', r: 0, c: false }] };
  function cartaoSimular(prog) {
    const caixa = h('div', { class: 'calc-corpo' });
    const ids = Object.keys(JOGO.CODEX.paginas).flatMap((pg) => JOGO.CODEX.colecoes.flatMap((c) => JOGO.CODEX.itens[pg][c.id]));
    if (!ids.includes(SIM.id)) SIM.id = ids[0];
    const resultado = h('div', { class: 'calc-corpo' });
    const p0 = () => { const v = lerNum(SIM.pts); return v != null ? Math.max(0, Math.min(JOGO.maxPontosCodex(JOGO.paginaCodex(SIM.id)), v)) : prog[SIM.id] || 0; };
    function calcular() {
      const id = SIM.id, pg = JOGO.paginaCodex(id), ini = p0();
      const chaves = SIM.copias.flatMap((c) => Array(Math.min(400, Math.max(0, Math.floor(lerNum(c.n) || 0)))).fill(`${id}${c.c ? '!' : ''}${c.r ? '+' + c.r : ''}~${c.q}`));
      if (!chaves.length) { resultado.replaceChildren(nota('Ponha ao menos uma cópia.')); return; }
      const r = registrarCopias(id, ini, chaves), antes = { ...prog, [id]: ini }, depois = { ...prog, [id]: r.p };
      const ganho = difBonus(JOGO.bonusCodex(antes), JOGO.bonusCodex(depois)), total = ganho.dano + ganho.defesa + ganho.va;
      const perdidos = r.passos.reduce((s, x) => s + x.perdidos, 0), puladas = r.passos.filter((x) => x.pulada).length;
      const kA = JOGO.estrelasCodex(pg, ini), kD = JOGO.estrelasCodex(pg, r.p);
      resultado.replaceChildren(...[
        h('div', { class: 'grade-tiles' },
          tile('Estrelas', kD > kA ? `★${kA} → ★${kD}` : `★${kA}`, `${pontosTxt(ini)} → ${pontosTxt(r.p)}`),
          tile('Taxa da Guardiã', precoTxt(r.taxa), `${r.passos.length - puladas} registro${r.passos.length - puladas === 1 ? '' : 's'}${puladas ? ` · ${puladas} pulado${puladas > 1 ? 's' : ''} (item cheio)` : ''}`),
          tile('Bônus da conta', somaBonus(ganho) || '+0%', 'com os patamares que fecharem'),
          tile('Rende', r.taxa > 0 ? rendeTxt((total * 100) / (r.taxa / 1e6)) : '—', '% por milhão de taxa')),
        perdidos > 0 ? nota(`${pontosTxt(perdidos)} passam do máximo do item e se perdem.`) : null,
        r.passos.length <= 24 ? tabela([{ t: 'Registro' }, { t: 'Cópia' }, { t: 'Estrelas' }, { t: 'Taxa', num: true }],
          r.passos.map((x, i) => ({ celulas: [`${i + 1}º`, `${versao(x.chave)} · ${pontosTxt(x.pts)}`, x.pulada ? 'pulado (cheio)' : x.kPara > x.kDe ? `★${x.kDe} → ★${x.kPara}` : `★${x.kDe}`, precoTxt(x.taxa)] })), 'Registros, na ordem mais barata') : null,
        nota('A ordem é a mais barata: da cópia que vale menos para a que vale mais (o botão Registrar 1 do jogo faz assim; o Registrar todos segue a ordem da mochila e deixa S, SS e +3 de fora).')].filter(Boolean));
    }
    const selItem = h('select', { id: 'sim-item', onchange: () => { SIM.id = selItem.value; SIM.pts = ''; montar(); } },
      Object.keys(JOGO.CODEX.paginas).flatMap((pg) => JOGO.CODEX.colecoes.map((c) => h('optgroup', { label: `${NOME_COL[c.id]} · ${UM_PG[pg]}s` },
        JOGO.CODEX.itens[pg][c.id].map((id) => h('option', { value: id }, `${nomeItem(id)} (★${JOGO.estrelasCodex(pg, prog[id] || 0)})`))))));
    function linhaCopia(c, i) {
      const n = camposNum({ value: c.n, 'aria-label': 'Quantas cópias', class: 'sim-n' });
      n.addEventListener('change', () => { c.n = n.value; calcular(); });
      const q = h('select', { 'aria-label': 'Qualidade', onchange: () => { c.q = q.value; calcular(); } }, JOGO.ORDEM_QUAL.map((x) => h('option', { value: x }, x)));
      q.value = c.q;
      const r = h('select', { 'aria-label': 'Refino', onchange: () => { c.r = +r.value; calcular(); } }, [0, 1, 2, 3, 4, 5, 6, 7].map((x) => h('option', { value: x }, x ? '+' + x : 'sem refino')));
      r.value = String(c.r);
      const cb = h('input', { type: 'checkbox', onchange: () => { c.c = cb.checked; calcular(); } });
      cb.checked = c.c;
      return h('div', { class: 'sim-copia' }, n, h('span', { class: 'fraco' }, 'cópia(s)'), q, r, h('label', { class: 'sim-c' }, cb, 'comprada'),
        SIM.copias.length > 1 ? h('button', { type: 'button', class: 'botao', 'aria-label': 'Tirar esta linha', onclick: () => { SIM.copias.splice(i, 1); montar(); } }, '×') : null);
    }
    function montar() {
      selItem.value = SIM.id;
      const pg = JOGO.paginaCodex(SIM.id), atual = prog[SIM.id] || 0;
      const inPts = camposNum({ id: 'sim-pts', value: SIM.pts, placeholder: nBR(atual, Number.isInteger(atual) ? 0 : 2), 'aria-label': 'Pontos do item agora' });
      inPts.addEventListener('change', () => { SIM.pts = inPts.value; calcular(); });
      caixa.replaceChildren(
        h('div', { class: 'chips-linha' }, h('label', { class: 'filtro' }, 'Item', selItem), h('label', { class: 'filtro' }, `Pontos agora (lido: ★${JOGO.estrelasCodex(pg, atual)}, ${pontosTxt(atual)})`, inPts)),
        h('div', { class: 'sim-copias' }, SIM.copias.map(linhaCopia),
          SIM.copias.length < 6 ? h('button', { type: 'button', class: 'botao', onclick: () => { SIM.copias.push({ n: '1', q: 'C', r: 0, c: false }); montar(); } }, '+ outra cópia') : null),
        resultado);
      calcular();
    }
    montar();
    return cartao('Simular', nota('Escolha um item e as cópias que você teria: a conta mostra as estrelas, a taxa e o bônus, com os patamares que fecharem. Deixe os pontos em branco para usar o que a Lupa leu.'), caixa);
  }

  // ---------- página ----------
  function desenhar() {
    const e = estados[quem], cx = e?.codex || null, { prog, aprox } = progressoCodex(cx), leit = leituraCodex(cx);
    const cab = h('div', { class: 'pagina-cab' },
      h('h1', null, 'Arsenal das Lendas', h('small', null, 'O que registrar na Guardiã do Arsenal e quanto rende cada estrela. Estimativa: o site só calcula, não mexe no jogo.')),
      nomes.length > 1 ? chips('Personagem', nomes.map((n) => [n, nomeCurto(n)]), quem, (v) => { quem = v; gravarPref('arsenal-quem', v); desenhar(); }) : null);
    raiz.replaceChildren(cab, ...avisos(e, cx, leit, prog),
      cartaoBonus(e, cx, prog, leit), cartaoMochila(e, prog), cartaoPatamares(e, prog), cartaoEstrelas(), cartaoSimular(prog),
      nota(`${aprox.size ? `Os pontos dentro da estrela de ${aprox.size} ite${aprox.size > 1 ? 'ns' : 'm'} vêm da barra do jogo (arredondada): a conta pode errar por uma fração de ponto. ` : ''}Regras do Arsenal da versão ${JOGO.meta.versaoJogo || '?'} do jogo (tabelas de ${new Date(geradoEm).toLocaleDateString('pt-BR')}).`));
    raiz.removeAttribute('aria-busy');
  }
  desenhar();
})();
