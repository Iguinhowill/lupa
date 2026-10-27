// Lupa (app) · Onde gastar o ouro. A partir da ficha que a Lupa leu, monta o que o ouro compra e pode render mais caça (forja
// +1 nos itens equipados, carta, item do Mercado, item da mochila, reset de atributos), pede ao simulador os combates (o motor
// do próprio jogo, ver simulador.js) e resume quanto cada opção rende e em quantas horas de caça ela se paga. Duas etapas: uma
// triagem curta de tudo e uma conferência longa (8 caçadas de 1 h, com as mesmas sementes da build atual) das que passaram.
// Puro (sem Electron): o simulador entra como a função `rodar` (gastar.test.js). Só calcula: nunca compra, forja nem troca nada.
'use strict';

const JOGO = require('./lupa/dados-jogo.js');
const CALC = require('./lupa/calculos.js');

const RE_CHAVE = /^(\d+)(!?)(?:\+(\d+))?(?:#([a-z]+\d))?~([A-Z]+)$/;
const DIA = 864e5;
const VALIDADE_PRECO = 7 * DIA;      // o menor preço visto no Mercado vale por 7 dias (o mesmo da Ficha)
const SIM = {
  triagem: { minutos: 20, sementes: [101, 102] },
  conferir: { minutos: 60, sementes: [201, 202, 203, 204, 205, 206, 207, 208] },
};
const MAX_TRIAGEM = 300, MAX_CONFERIR = 30, MELHORES_TRIAGEM = 8, LUGARES_CONFERIDOS = 2;
const ESPACOS_ITENS = 4;      // o equipamento: 1 bota + 4 outros (ESPACOS_ITENS do motor)
// abaixo disto (ou dentro do erro da medida) o ganho não se separa do zero: a opção vai para "não muda nada"
const SIGNIFICATIVO = 0.003;
const ATRIBUTOS = [['forca', 'Força'], ['vitalidade', 'Vitalidade'], ['resistencia', 'Resistência'], ['agilidade', 'Agilidade'], ['foco', 'Foco']];
const CARTA_NOME = { ataque: 'Ataque', poder: 'Poder de Habilidade', vida: 'Vida', armadura: 'Armadura', rm: 'Resistência Mágica', velocidade: 'Velocidade de Ataque', critico: 'Crítico', roubo: 'Roubo de Vida', vampirismo: 'Vampirismo Universal', recarga: 'Redução de Recarga' };
const CARTA_RARIDADE = { 1: 'Básica', 2: 'Rara', 3: 'Lendária' };
// as cartas que valem testar: as de dano para quem bate com ataque, as de poder para quem bate com habilidade
const CARTAS_TESTE = { ad: ['ataque', 'velocidade', 'critico'], ap: ['poder', 'recarga'] };
const STATS_AD = ['ad', 'va', 'critico', 'adPct', 'critDano', 'penArm', 'rv'], STATS_AP = ['ap', 'apPct', 'penMag', 'mana', 'cdr'];

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const nomeCarta = (id) => `Carta de ${CARTA_NOME[id.replace(/\d$/, '')] || id} ${CARTA_RARIDADE[id.slice(-1)] || ''}`.trim();
const cartaPorNome = (nome) => Object.keys(JOGO.CARTA_VALOR).find((id) => nomeCarta(id) === nome) || null;
const nivelCarta = (id) => +String(id).slice(-1);
const tirarCarta = (id) => (id ? JOGO.CARTA_TIRAR[nivelCarta(id)] : 0);
// número como a ficha escreve: "11.4M", "950.2k", "1.234.567", "9800"
function numero(t) {
  const x = String(t ?? '').trim().replace(/\s/g, ''), m = /^([\d.,]+)([kKmM])?$/.exec(x);
  if (!m) return null;
  const v = m[2] ? Number(m[1].replace(',', '.')) * (/m/i.test(m[2]) ? 1e6 : 1e3) : Number(m[1].replace(/[.,]/g, ''));
  return Number.isFinite(v) ? v : null;
}
function lerItem(x) {
  const m = RE_CHAVE.exec(String(x || ''));
  return m && JOGO.item(m[1]) ? { id: m[1] + m[2], base: m[1], refino: +(m[3] || 0), carta: m[4] || '', qual: m[5] } : null;
}
const chaveDe = (o) => JOGO.chaveItem({ id: o.id, refino: o.refino, carta: o.carta, qual: o.qual });
const nomeItem = (o) => `${JOGO.item(o.base).nome} +${o.refino} ${o.qual}`;
const forca = (o) => (1 + JOGO.BONUS_REFINO * o.refino) * (JOGO.QUALIDADES[o.qual]?.mult || 1);
const ehBota = (o) => JOGO.item(o.base)?.espaco === 'botas';
const raridade = (o) => JOGO.item(o.base)?.raridade;

// a zona da caça: a que o jogo mostra; fora de zona de caça (Fonte, cidade), a mais caçada na última sessão; senão a do nível
function zonaDe(nomeZona, sessoes, nivel) {
  let z = JOGO.ZONAS.find((x) => x.nome === nomeZona);
  if (!z) {
    const ult = (sessoes || []).at(-1), nome = Object.entries(ult?.zonas || {}).sort((a, b) => b[1].seg - a[1].seg)[0]?.[0];
    z = JOGO.ZONAS.find((x) => x.nome === nome) || JOGO.zonaIdeal(nivel);
  }
  return { id: z.id, nome: z.nome };
}

// a build que a ficha mostra; null sem ficha, nível ou item equipado. faltam: itens equipados que a conta não reconhece (item mais
// novo que as tabelas, ou qualidade ainda sendo avaliada, "~?"): com eles a build simulada não seria a sua
function buildDoEstado(e, sessoes = []) {
  const f = e?.ficha, nivel = parseInt(e?.nivel, 10) || 0;
  if (!f || !nivel) return null;
  const equip = (f.equip || []).map((i) => lerItem(i.id)).filter(Boolean);
  if (!equip.length) return null;
  const atrib = {};
  for (const [k, nome] of ATRIBUTOS) atrib[k] = Math.max(0, Math.floor(numero((f.atributos || []).find((a) => semAcento(a.nome) === semAcento(nome))?.valor) || 0));
  const ranks = {}, habs = {};
  for (const x of f.habs || []) {
    const m = /^(\d+)/.exec(String(x.rank || ''));
    if (m) ranks[x.t] = +m[1];
    if (x.t && x.nome) habs[x.t] = x.nome;
  }
  const cartas = {};
  for (const c of f.cartas || []) { const id = cartaPorNome(c.nome); if (id) cartas[id] = (cartas[id] || 0) + (Number(c.qtd) || 0); }
  const vistos = new Set(equip.map(chaveDe)), mochila = [];
  for (const i of f.mochila || []) { const o = lerItem(i.id); if (o && raridade(o) !== 'basico' && !vistos.has(chaveDe(o))) { vistos.add(chaveDe(o)); mochila.push(o); } }
  // ataque ou habilidade: pelos itens equipados (a ficha não diz o campeão; o simulador acha pelo nome das habilidades)
  const pontos = (lista) => equip.filter((o) => lista.some((s) => JOGO.item(o.base).e[s])).length;
  return { nome: e.nome, nivel, zona: zonaDe(e.zona, sessoes, nivel), atrib, ranks, habs, barra: (f.barra || []).map((b) => b?.t).filter(Boolean),
    equip, faltam: (f.equip || []).length - equip.length, mochila, cartas, ouro: numero(f.stats?.ouro), perfil: pontos(STATS_AP) > pontos(STATS_AD) ? 'ap' : 'ad' };
}
// muda quando muda o que o simulador usa: aí o resultado guardado fica velho
const assinatura = (b) => JSON.stringify([b.nivel, b.zona.id, b.equip.map(chaveDe), b.atrib, b.ranks, b.barra]);

// cabe no lugar do equipado k, ou num espaço vazio (k = -1)? (uma bota e 4 outros, cada lendário uma vez, um mítico só do nível 50)
function cabe(b, k, o) {
  const outros = b.equip.filter((_, j) => j !== k);
  if (k < 0 ? (ehBota(o) ? b.equip.some(ehBota) : b.equip.filter((x) => !ehBota(x)).length >= ESPACOS_ITENS) : ehBota(o) !== ehBota(b.equip[k])) return false;
  const r = raridade(o);
  if ((r === 'lendario' || r === 'mitico') && outros.some((x) => x.base === o.base)) return false;
  if (r === 'mitico' && (b.nivel < 50 || outros.some((x) => raridade(x) === 'mitico'))) return false;
  return true;
}
const comItem = (b, k, o) => (k < 0 ? [...b.equip, o] : b.equip.map((x, j) => (j === k ? o : x)));
// onde um item pode entrar: no lugar de cada equipado e, se sobrar espaço, num vazio (-1)
const lugaresDe = (b) => [...b.equip.keys(), -1];
const noLugar = (b, k) => (k < 0 ? 'num espaço vazio' : `no lugar de ${nomeItem(b.equip[k])}`);
// o menor preço do Mercado ainda válido: { ouro, em } ou null
function precoMercado(menores, chave, agora) {
  const v = menores?.[chave];
  return v && v.ouro > 0 && agora - v.em < VALIDADE_PRECO ? { ouro: v.ouro, em: v.em } : null;
}

// as opções: { id, grupo?, tipo, titulo, detalhe, custo, custoP90?, equip?, atrib? } (o que não vem fica como na build atual). O grupo junta
// as alternativas do mesmo item (o mesmo item da mochila ou do Mercado em lugares diferentes): no resumo fica só a melhor de cada
function candidatos(b, { menores = {}, agora = Date.now() } = {}) {
  const lista = [];
  // 1) forja +1 em cada equipado: o custo é a média de 2.000 forjas simuladas (com a volta de nível ao falhar e a garantia do Ornn)
  b.equip.forEach((o, k) => {
    if (o.refino >= JOGO.REFINO_MAX) return;
    const f = CALC.simularForja({ id: o.base, de: o.refino, ate: o.refino + 1, vip: false, falhas0: 0 });
    lista.push({ id: 'forja:' + k, tipo: 'forja', titulo: `Forjar ${JOGO.item(o.base).nome} do +${o.refino} para o +${o.refino + 1}`,
      detalhe: `média de ${Math.round(f.tent.media)} tentativas; em 90% das vezes sai por até ${Math.round(f.custo.p90).toLocaleString('pt-BR')} de ouro`,
      custo: Math.round(f.custo.media), custoP90: Math.round(f.custo.p90), equip: comItem(b, k, { ...o, refino: o.refino + 1 }) });
  });
  // 2) cartas: a da bolsa sai de graça; a que falta, pelo menor preço do Mercado. A posição não importa (o jogo soma as cartas),
  // então cada troca é "tirar a carta X de um item e pôr a Y", com o preço de tirar a X
  for (const t of CARTAS_TESTE[b.perfil]) for (const n of [2, 3]) {
    const nova = t + n, daBolsa = (b.cartas[nova] || 0) > 0, merc = daBolsa ? null : precoMercado(menores, 'gema:' + nova, agora);
    if (!daBolsa && !merc) continue;
    const preco = daBolsa ? 0 : merc.ouro, origem = daBolsa ? 'da sua bolsa' : 'pelo menor preço visto no Mercado';
    const vaga = b.equip.findIndex((o) => !o.carta);
    if (vaga >= 0) lista.push({ id: `carta:+${nova}`, tipo: 'carta', titulo: `Encaixar ${nomeCarta(nova)} em ${JOGO.item(b.equip[vaga].base).nome}`, detalhe: `carta ${origem}`, custo: preco,
      equip: comItem(b, vaga, { ...b.equip[vaga], carta: nova }) });
    for (const velha of [...new Set(b.equip.map((o) => o.carta).filter(Boolean))]) {
      if (velha === nova || (velha.replace(/\d$/, '') === t && nivelCarta(velha) >= n)) continue;
      const k = b.equip.findIndex((o) => o.carta === velha);
      lista.push({ id: `carta:${velha}>${nova}`, tipo: 'carta', titulo: `Trocar a ${nomeCarta(velha)} de ${JOGO.item(b.equip[k].base).nome} pela ${nomeCarta(nova)}`,
        detalhe: `${(tirarCarta(velha)).toLocaleString('pt-BR')} para tirar a carta (ela volta para a bolsa) + carta ${origem}`, custo: tirarCarta(velha) + preco,
        equip: comItem(b, k, { ...b.equip[k], carta: nova }) });
    }
  }
  // 3) itens da mochila com stat de dano do seu tipo no lugar de um equipado (de graça; levar a carta do que sai custa tirá-la). A versão
  // mais fraca de um item que já está equipado não entra
  const stats = b.perfil === 'ap' ? STATS_AP : STATS_AD, temStat = (o) => stats.some((s) => JOGO.item(o.base).e[s]);
  for (const o of b.mochila.filter(temStat)) for (const k of lugaresDe(b)) {
    const velho = b.equip[k];
    if (!cabe(b, k, o) || (velho && velho.base === o.base && forca(o) <= forca(velho))) continue;
    lista.push({ id: `mochila:${chaveDe(o)}@${k}`, grupo: 'mochila:' + chaveDe(o), tipo: 'mochila', titulo: `Equipar ${nomeItem(o)} da mochila ${noLugar(b, k)}`, detalhe: o.carta ? `já tem ${nomeCarta(o.carta)}` : 'sem carta', custo: 0, equip: comItem(b, k, o) });
    if (!o.carta && velho?.carta) lista.push({ id: `mochila:${chaveDe(o)}@${k}+carta`, grupo: 'mochila+carta:' + chaveDe(o), tipo: 'mochila', titulo: `Equipar ${nomeItem(o)} da mochila ${noLugar(b, k)}, levando a carta`,
      detalhe: `${tirarCarta(velho.carta).toLocaleString('pt-BR')} para tirar a ${nomeCarta(velho.carta)} e passar para o novo`, custo: tirarCarta(velho.carta), equip: comItem(b, k, { ...o, carta: velho.carta }) });
  }
  // 4) itens do Mercado (lendários e míticos com stat de dano do seu tipo): de cada item, a versão mais forte que o seu ouro paga e a
  // mais barata; a carta do item que sai vai junto (o custo de tirá-la entra na conta)
  const porItem = new Map();
  for (const ch of Object.keys(menores || {})) {
    const o = lerItem(ch), p = o && precoMercado(menores, ch, agora);
    if (!p || o.carta || !['lendario', 'mitico'].includes(raridade(o)) || !temStat(o)) continue;
    (porItem.get(o.base) || porItem.set(o.base, []).get(o.base)).push({ o, ...p });
  }
  for (const versoes of porItem.values()) {
    const cabeOuro = versoes.filter((v) => b.ouro == null || v.ouro <= b.ouro).sort((x, y) => forca(y.o) - forca(x.o) || x.ouro - y.ouro);
    const barata = [...versoes].sort((x, y) => x.ouro - y.ouro)[0];
    for (const v of [...new Set([cabeOuro[0], barata].filter(Boolean))]) for (const k of lugaresDe(b)) {
      const velho = b.equip[k];
      if (!cabe(b, k, v.o) || (velho && velho.base === v.o.base && forca(v.o) <= forca(velho))) continue;
      const novo = { ...v.o, carta: velho?.carta || '' }, tirar = tirarCarta(velho?.carta);
      lista.push({ id: `mercado:${chaveDe(v.o)}@${k}`, grupo: 'mercado:' + chaveDe(v.o), tipo: 'mercado', titulo: `Comprar ${nomeItem(v.o)} no Mercado e pôr ${noLugar(b, k)}`,
        detalhe: `menor anúncio visto: ${v.ouro.toLocaleString('pt-BR')}${tirar ? ` + ${tirar.toLocaleString('pt-BR')} para tirar a ${nomeCarta(velho.carta)} e passar para o novo` : ''}`,
        custo: v.ouro + tirar, precoEm: v.em, equip: comItem(b, k, novo) });
    }
  }
  // 5) reset de atributos (Mestre da Legião): tudo no atributo de dano, ou parte dele em Agilidade (ataque) / Foco (habilidade)
  const total = Object.values(b.atrib).reduce((s, v) => s + v, 0), outro = b.perfil === 'ap' ? 'foco' : 'agilidade';
  if (total > 0) {
    const vazio = Object.fromEntries(ATRIBUTOS.map(([k]) => [k, 0])), nomes = Object.fromEntries(ATRIBUTOS);
    const variantes = [{ ...vazio, forca: total }, ...[0.15, 0.3].map((p) => ({ ...vazio, forca: total - Math.round(p * total), [outro]: Math.round(p * total) }))];
    for (const a of variantes) {
      if (ATRIBUTOS.every(([k]) => a[k] === b.atrib[k])) continue;
      const txt = ATRIBUTOS.filter(([k]) => a[k]).map(([k]) => `${nomes[k]} ${a[k]}`).join(', ');
      lista.push({ id: 'atributos:' + txt, tipo: 'atributos', titulo: a.forca === total ? 'Resetar os atributos e pôr tudo em Força' : `Resetar os atributos para ${txt}`,
        detalhe: `reset no Mestre da Legião (${JOGO.RESET_OURO.toLocaleString('pt-BR')} × nível)`, custo: JOGO.RESET_OURO * b.nivel, atrib: a });
    }
  }
  return lista;
}

// os combates de uma etapa: a build atual ("base") e cada opção, com as mesmas sementes
const jobsDe = (b, opcoes, sim) => [{ id: 'base' }, ...opcoes].map((c) => ({
  id: c.id, habs: b.habs, nivel: b.nivel, zona: b.zona.id, atrib: c.atrib || b.atrib, ranks: b.ranks, barra: b.barra,
  itens: (c.equip || b.equip).map(chaveDe), minutos: sim.minutos, sementes: sim.sementes,
}));
// ganho da opção contra a base, semente a semente (as duas caçadas com a mesma semente começam iguais): { ganho, erro } em fração;
// erro = 2 erros-padrão da média
function ganhoPareado(base, opcao) {
  // semente em que a build atual não matou nada (morre sem parar na zona) não dá comparação: fica de fora
  const d = opcao.abatesH.map((x, i) => (base.abatesH[i] > 0 ? x / base.abatesH[i] - 1 : null)).filter((v) => v != null), n = d.length;
  if (!n) return { ganho: 0, erro: 1 };      // sem medida: erro de 100% (finito, para o JSON do armazém)
  const media = d.reduce((s, v) => s + v, 0) / n;
  const dp = n > 1 ? Math.sqrt(d.reduce((s, v) => s + (v - media) ** 2, 0) / (n - 1)) : 0;
  return { ganho: media, erro: n > 1 ? (2 * dp) / Math.sqrt(n) : 1 };
}
// da triagem para a conferência: todas as forjas (a pergunta mais comum), as de graça que ganharam e as melhores por ouro gasto. A
// vaga é por item: do mesmo item em lugares diferentes vão os 2 melhores lugares da triagem, e a conferência (mais precisa) decide
function escolherParaConferir(opcoes, triagem) {
  const base = triagem.base, nota = (c) => ({ c, g: ganhoPareado(base, triagem[c.id]).ganho });
  const grupos = new Map();
  for (const x of opcoes.filter((c) => triagem[c.id]).map(nota)) {
    const k = x.c.grupo || x.c.id;
    (grupos.get(k) || grupos.set(k, []).get(k)).push(x);
  }
  const lista = [...grupos.values()].map((l) => l.sort((x, y) => y.g - x.g).slice(0, LUGARES_CONFERIDOS));      // cada grupo: os melhores lugares
  const forjas = lista.filter((l) => l[0].c.tipo === 'forja');
  const gratis = lista.filter((l) => l[0].c.tipo !== 'forja' && l[0].c.custo === 0 && l[0].g > 0).sort((x, y) => y[0].g - x[0].g);
  const pagas = lista.filter((l) => l[0].c.tipo !== 'forja' && l[0].c.custo > 0 && l[0].g > 0).sort((x, y) => y[0].g / y[0].c.custo - x[0].g / x[0].c.custo);
  return [...forjas, ...gratis.slice(0, MELHORES_TRIAGEM), ...pagas.slice(0, MELHORES_TRIAGEM)].flat().filter((x) => x.g > 0 || x.c.tipo === 'forja')
    .slice(0, MAX_CONFERIR).map((x) => x.c);
}

// XP e ouro por hora na zona, medidos pela Lupa nas caçadas dos últimos 7 dias (10 min ou mais nela, XP sem bônus de live)
function economiaMedida(sessoes, zonaNome, agora = Date.now(), dias = 7) {
  let seg = 0, abates = 0, xp = 0, ouro = 0;
  for (const s of sessoes || []) {
    const z = s?.zonas?.[zonaNome];
    if (!z || !(s.ini >= agora - dias * DIA)) continue;
    seg += z.seg || 0; abates += z.abates || 0; xp += z.xpBase ?? z.xp ?? 0; ouro += z.ouro || 0;
  }
  return seg >= 600 && abates > 0 ? { abatesH: (abates / seg) * 3600, xpH: (xp / seg) * 3600, ouroH: (ouro / seg) * 3600, horas: seg / 3600, medido: true } : null;
}
// sem medição: pelos abates da simulação e o XP e ouro de tabela da zona (sem bônus nenhum)
function economiaSimulada(b, abatesH) {
  const z = JOGO.ZONA[b.zona.id], a = JOGO.porAbateZona(z), nm = (z.nm[0] + z.nm[1]) / 2;
  return { abatesH, xpH: abatesH * a.xp * JOGO.fatorXp(b.nivel, nm), ouroH: abatesH * a.ouro, medido: false };
}
const media = (v) => v.reduce((s, x) => s + x, 0) / v.length;

// o resultado guardado em "gastar:<nome>" (o painel e o site só desenham isto)
function resumir({ b, opcoes, conferir, sessoes, agora, motor, testadas }) {
  const base = conferir.base, abatesBase = media(base.abatesH);
  const econ = economiaMedida(sessoes, b.zona.nome, agora) || economiaSimulada(b, abatesBase);
  const todas = opcoes.filter((c) => conferir[c.id]).map((c) => {
    const r = conferir[c.id], g = ganhoPareado(base, r), dOuro = g.ganho * econ.ouroH;
    return { grupo: c.grupo || c.id, tipo: c.tipo, titulo: c.titulo, detalhe: c.detalhe, custo: c.custo, custoP90: c.custoP90 ?? null, precoEm: c.precoEm ?? null,
      ganho: +g.ganho.toFixed(5), erro: +g.erro.toFixed(5), xpH: Math.round(g.ganho * econ.xpH), ouroH: Math.round(dOuro),
      horas: c.custo > 0 && dOuro > 0 ? Math.round(c.custo / dOuro) : c.custo === 0 ? 0 : null, mortesH: +media(r.mortes).toFixed(2) };
  });
  // do mesmo item em lugares diferentes, só o melhor lugar: o que passa no teste antes, depois o de mais ganho
  const rende = (l) => l.ganho > Math.max(SIGNIFICATIVO, l.erro);
  const melhor = new Map();
  for (const l of todas) {
    const m = melhor.get(l.grupo);
    if (!m || rende(l) > rende(m) || (rende(l) === rende(m) && l.ganho > m.ganho)) melhor.set(l.grupo, l);
  }
  const linhas = [...melhor.values()].map(({ grupo, ...l }) => l);
  const opcoesBoas = linhas.filter(rende).sort((x, y) => (x.custo > 0) - (y.custo > 0) || (x.custo === 0 ? y.ganho - x.ganho : x.horas - y.horas));
  const semGanho = linhas.filter((l) => !rende(l)).sort((x, y) => y.ganho - x.ganho);
  return { v: 1, estado: 'pronto', em: agora, assinatura: assinatura(b), nivel: b.nivel, zona: b.zona, campeao: base.campeao || null, ouro: b.ouro,
    equip: b.equip.map(chaveDe), base: { abatesH: Math.round(abatesBase), mortesH: +media(base.mortes).toFixed(2), economia: { ...econ, abatesH: Math.round(econ.abatesH), xpH: Math.round(econ.xpH), ouroH: Math.round(econ.ouroH) } },
    motor, sim: { conferir: { minutos: SIM.conferir.minutos, cacadas: SIM.conferir.sementes.length }, triagem: { minutos: SIM.triagem.minutos, cacadas: SIM.triagem.sementes.length } },
    testadas, conferidas: linhas.length, opcoes: opcoesBoas, semGanho };
}

// tudo: monta as opções, roda a triagem e a conferência no simulador e resume. rodar(jobs, etapa) → { [id]: { abatesH, mortes, campeao } }
async function calcular({ estado, sessoes = [], menores = {}, agora = Date.now(), rodar, motor = null }) {
  const b = buildDoEstado(estado, sessoes);
  if (!b) throw new Error('A ficha ainda não tem itens equipados e nível: abra o personagem no jogo.');
  if (b.faltam > 0) throw new Error('Um item equipado ainda está sendo avaliado ou é novo demais para as tabelas da Lupa: a conta espera a ficha ficar completa.');
  const opcoes = candidatos(b, { menores, agora }).slice(0, MAX_TRIAGEM);
  const triagem = await rodar(jobsDe(b, opcoes, SIM.triagem), 'triagem');
  const escolhidas = escolherParaConferir(opcoes, triagem);
  const conferir = await rodar(jobsDe(b, escolhidas, SIM.conferir), 'conferir');
  return resumir({ b, opcoes: escolhidas, conferir, sessoes, agora, motor, testadas: opcoes.length });
}

module.exports = { calcular, buildDoEstado, assinatura, candidatos, jobsDe, ganhoPareado, escolherParaConferir, economiaMedida, resumir, numero, lerItem, nomeCarta, cartaPorNome, SIM, SIGNIFICATIVO };
