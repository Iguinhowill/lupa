// Lupa Online · Relatório: XP, ouro, níveis, drops e mortes no período, e as horas em que o jogo ficou sem caçar.
'use strict';

const NOME_RAR = { mitico: 'Mítico', lendario: 'Lendário', epico: 'Épico', basico: 'Básico', '': 'Outros' };
const rarTag = (r) => h('span', { class: 'rar', style: `--cor:${COR_RARIDADE[r] || '#5a6170'}` }, NOME_RAR[r] ?? r);
// "?" enquanto o jogo não avalia o item (ou se a Lupa não viu a linha "foi avaliado"); vazia nos drops de antes da
// Lupa 0.4.1, que só traziam o B provisório da linha de loot
const qualTag = (e) => (e.qual === '?' ? h('span', { class: 'fraco' }, Date.now() - e.ts < 10 * 60e3 ? 'avaliando…' : '?') : e.qual || '—');

// índice nome|qualidade|refino|carta → preço, para os drops (que só trazem nome e qualidade)
function indicePorNome(precos) {
  const m = new Map();
  for (const g of precos.porChave.values()) m.set([g.nome, g.qual, g.refino ?? 0, g.carta || ''].join('|'), g);
  return m;
}

(async () => {
  await exigirLogin();
  montarNav();
  const raiz = $id('pagina');
  const HORAS = { '24h': 24, '7d': 168, '30d': 720 };
  let periodo = lerPref('rel-periodo', '24h'), quem = lerPref('rel-quem', 'todos');
  const rarOff = new Set();
  let d;
  try {
    const agora = Date.now(), desde = agora - 30 * DIA;
    const [estados, cac, evs, pul, primeiro, merc, icones] = await Promise.all([
      Nuvem.estados(), Nuvem.cacadas(desde), Nuvem.eventos(desde, ['drop', 'nivel', 'morte', 'chao']),
      Nuvem.pulsos(agora - DIA), Nuvem.primeiroPulso(), Nuvem.mercado(20), Nuvem.icones(), Nuvem.planos()
    ]);
    const precos = indicePrecos(merc);
    d = { estados, cac, evs, pul, primeiro, precos, porNome: indicePorNome(precos), icones };
  } catch (e) { erroNaPagina(raiz, e); return; }
  const ctx = { icones: d.icones };
  const nomes = [...new Set([...Object.keys(d.estados), ...Object.keys(d.cac), ...d.evs.map((e) => e.personagem)])].sort();

  function totais(ini, agora, doQuem) {
    const t = { xp: 0, ouro: 0, abates: 0, seg: 0 };
    for (const [p, c] of Object.entries(d.cac)) if (doQuem(p)) for (const x of c.sessoes) {
      const a = Math.max(x.ini, ini), b = Math.min(x.fim, agora);
      if (b <= a) continue;
      const f = x.fim > x.ini ? (b - a) / (x.fim - x.ini) : 1;      // sessão cortada pelo período: proporcional ao tempo
      t.xp += x.xp * f; t.ouro += x.ouro * f; t.abates += x.abates * f; t.seg += x.seg * f;
    }
    return t;
  }

  // uma célula por hora nas últimas 24 h, pelos pulsos de 5 min que a Lupa manda
  function atividade(p, agora) {
    const pul = d.pul.filter((x) => x.personagem === p), h0 = Math.floor(agora / HORA) * HORA - 23 * HORA;
    const celulas = Array.from({ length: 24 }, (_, i) => {
      const ini = h0 + i * HORA, fim = Math.min(ini + HORA, agora), rot = `${hora(ini)}–${hora(ini + HORA)}`;
      if (!d.primeiro || fim <= d.primeiro) return h('span', { class: 'semdados', title: `${rot} · sem dados (antes do Lupa Online)` });
      const esperado = Math.max(1, (fim - Math.max(ini, d.primeiro)) / (5 * 60e3));
      const cacando = pul.filter((x) => x.ts >= ini && x.ts < ini + HORA && x.cacando).length, r = cacando / esperado;
      const classe = r >= 0.75 ? 'cacando' : r >= 0.2 ? 'parcial' : 'parado';
      return h('span', { class: classe, title: `${rot} · ${classe === 'parado' ? 'sem caçar' : `caçando uns ${Math.min(60, Math.round(cacando * 5))} min`}` });
    });
    const buracos = [];
    for (let i = 1; i <= pul.length; i++) {
      const a = pul[i - 1].ts, b = i < pul.length ? pul[i].ts : agora;
      if (b - a > 12 * 60e3) buracos.push({ de: a, ate: i < pul.length ? b : null });
    }
    return { celulas, buracos };
  }

  function desenhar() {
    const agora = Date.now(), ini = agora - HORAS[periodo] * HORA, doQuem = (p) => quem === 'todos' || p === quem;
    const evs = d.evs.filter((e) => e.ts >= ini && doQuem(e.personagem));
    const t = totais(ini, agora, doQuem);
    const niveis = evs.filter((e) => e.tipo === 'nivel').map((e) => ({ ...e, nivel: parseInt((e.texto || '').replace(/\D+/g, ''), 10) || null }));
    const drops = evs.filter((e) => e.tipo === 'drop').map((e) => ({ ...e, preco: d.porNome.get([e.item || e.titulo, e.qual, 0, ''].join('|')) || null }));
    const lend = drops.filter((e) => /^(lendario|mitico)$/.test(e.raridade || ''));
    const mortes = evs.filter((e) => e.tipo === 'morte').length, chao = evs.filter((e) => e.tipo === 'chao').length;
    const valor = drops.reduce((s0, e) => s0 + (e.preco?.ouro || 0), 0);
    const subiu = nomes.filter(doQuem).map((p) => { const l = niveis.filter((x) => x.personagem === p && x.nivel); return l.length ? `${nomeCurto(p).split(' · ').pop()} ${l[0].nivel - 1} → ${l.at(-1).nivel}` : null; }).filter(Boolean);

    const filtros = h('div', { class: 'pagina-cab' },
      h('h1', null, 'Relatório', h('small', null, 'O que aconteceu enquanto a Lupa lia no PC de casa.')),
      chips('Período', [['24h', 'Últimas 24 h'], ['7d', '7 dias'], ['30d', '30 dias']], periodo, (v) => { periodo = v; gravarPref('rel-periodo', v); desenhar(); }),
      chips('Personagem', [['todos', 'Os dois'], ...nomes.map((n) => [n, nomeCurto(n)])], quem, (v) => { quem = v; gravarPref('rel-quem', v); desenhar(); }));

    const tiles = h('div', { class: 'grade-tiles' },
      tile('XP ganho', curto(t.xp), 'só dos abates'),
      tile('Níveis', niveis.length ? '+' + niveis.length : '0', subiu.join(' · ') || 'nenhum no período'),
      tile('Ouro', curto(t.ouro), 'só dos abates'),
      tile('Abates', inteiro(t.abates), t.seg >= 60 ? `${inteiro(t.abates / (t.seg / 3600))} por hora caçando` : ''),
      tile('Lendários', String(lend.length), drops.length ? `de ${drops.length} drops` : 'nenhum drop'),
      tile('Valor dos drops', valor ? '≈ ' + precoTxt(valor) : '—', valor ? 'pelo menor preço no Mercado' : 'sem preço lido ainda'),
      tile('Mortes', String(mortes), chao ? `${chao} ${chao > 1 ? 'itens ficaram' : 'item ficou'} no chão` : ''));

    const ativ = nomes.filter(doQuem).map((p) => ({ p, ...atividade(p, agora) }));
    const buracos = ativ.flatMap((a) => a.buracos.map((b) => ({ ...b, p: a.p }))).sort((a, b) => b.de - a.de).slice(0, 5);
    const eixo = Array.from({ length: 7 }, (_, i) => hora(Math.floor(agora / HORA) * HORA - 23 * HORA + i * 4 * HORA));
    const secAtiv = cartao('Atividade nas últimas 24 h',
      h('div', { class: 'legenda' },
        h('span', null, h('i', { style: 'background:#5cc8b8' }), 'Caçando'),
        h('span', null, h('i', { style: 'background:linear-gradient(to top,#5cc8b8 50%,#1d212c 50%);border:1px solid #5cc8b8' }), 'Parte da hora'),
        h('span', null, h('i', { style: 'border:1.5px solid #f5a66b' }), 'Sem caçar ou sem leitura'),
        h('span', null, h('i', { style: 'background:#252a36' }), 'Antes do Lupa Online')),
      ativ.map((a) => h('div', { class: 'ativ' }, h('span', null, nomeCurto(a.p)), h('div', { class: 'ativ-horas' }, a.celulas))),
      h('div', { class: 'ativ' }, h('span'), h('div', { class: 'ativ-eixo' }, eixo.map((x) => h('span', null, x)))),
      buracos.map((b) => h('div', { class: 'alerta fora' }, icone('alerta', 18),
        h('span', null, `${nomeCurto(b.p)}: ${b.ate ? `sem leitura das ${hora(b.de)} às ${hora(b.ate)} (${duracao((b.ate - b.de) / 1000)})` : `sem leitura desde ${dataHora(b.de)}: o jogo ou o PC de casa pode ter parado`}`))));

    const linhasNiv = niveis.slice().reverse().map((n) => {
      const ant = d.evs.filter((x) => x.tipo === 'nivel' && x.personagem === n.personagem && x.ts < n.ts).at(-1);
      return { celulas: [nomeCurto(n.personagem), h('b', { class: 'acao-ouro' }, String(n.nivel ?? '?')), dataHora(n.ts), ant ? duracao((n.ts - ant.ts) / 1000) : '—', n.zona || '—'] };
    });
    const secNiv = cartao('Níveis upados', linhasNiv.length
      ? tabela([{ t: 'Personagem' }, { t: 'Nível', num: true }, { t: 'Quando' }, { t: 'Tempo no nível anterior', num: true }, { t: 'Zona' }], linhasNiv, 'Níveis upados')
      : vazio('Nenhum nível no período.'));

    const rars = [...new Set(drops.map((e) => e.raridade || ''))].sort((a, b) => Object.keys(NOME_RAR).indexOf(a) - Object.keys(NOME_RAR).indexOf(b));
    const vis = drops.filter((e) => !rarOff.has(e.raridade || '')).reverse();
    const equip = (p) => d.estados[p]?.ficha?.equip || [];
    const linhasDrop = vis.slice(0, 300).map((e) => {
      const nome = e.item || e.titulo, usa = equip(e.personagem).find((i) => i.nome === nome);
      return { celulas: [
        dataHora(e.ts), nomeCurto(e.personagem),
        h('div', { class: 'item' }, imagem(nome, ctx, { tam: 28, raridade: e.raridade }), h('span', { class: 'item-nome' }, nome)),
        qualTag(e), rarTag(e.raridade || ''),
        e.preco ? h('span', null, precoTxt(e.preco.ouro), h('span', { class: 'fraco' }, ` (${e.preco.n})`)) : h('span', { class: 'fraco' }, 'sem leitura'),
        usa ? h('span', { class: 'acao-ouro' }, `você usa a ${[usa.qual, usa.refino].filter(Boolean).join(' ')}`) : '—'
      ] };
    });
    const secDrops = cartao('Itens dropados',
      rars.length > 1 ? h('div', { class: 'chips', role: 'group', 'aria-label': 'Raridade' }, rars.map((r) => h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(!rarOff.has(r)), onclick: () => { if (rarOff.has(r)) rarOff.delete(r); else rarOff.add(r); desenhar(); }
      }, NOME_RAR[r] ?? r))) : null,
      linhasDrop.length
        ? tabela([{ t: 'Quando' }, { t: 'Personagem' }, { t: 'Item' }, { t: 'Qual.' }, { t: 'Raridade' }, { t: 'Menor no Mercado', num: true }, { t: 'Na sua build' }], linhasDrop, 'Itens dropados')
        : vazio('Nenhum drop no período.'),
      nota(`Preço: a mesma versão (+0, sem carta) na última leitura do Mercado${d.precos.ultima ? `, de ${dataHora(d.precos.ultima.lidoEm)}` : ''}. Entre parênteses, quantos estavam à venda. Drop que o jogo deixa no chão pelos filtros não chega à mochila e não entra aqui.`),
      vis.length > 300 ? nota(`Mostrando os 300 mais recentes de ${vis.length}.`) : null);

    raiz.replaceChildren(filtros, tiles, secAtiv, secNiv, secDrops);
    raiz.removeAttribute('aria-busy');
  }
  desenhar();
})();
