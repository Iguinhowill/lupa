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

const COR_LINHA = ['#5cc8b8', '#e0b05a', '#c88aff', '#f5a66b'];
const BALDE_MS = 5 * 60e3;

// XP/h por faixa do dia (30 min ou 1 h): cada faixa soma os baldes de 5 min que caem nela. A faixa em andamento
// divide só pelo tempo que já passou. Um eixo só (XP/h), grade discreta, uma linha por personagem.
const tickXp = (v) => (v >= 1e6 ? `${+(v / 1e6).toFixed(2)}`.replace('.', ',') + ' M' : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}`.replace('.', ',') + ' k' : String(v));
function graficoXp(series, ini, agora, passo, larg) {
  const alt = larg < 520 ? 190 : 210, M = { l: 54, r: 14, t: 12, b: 24 };
  const n = Math.max(Math.ceil((agora - ini) / passo), Math.round(6 * HORA / passo));
  const dados = series.map((sr) => {
    const v = Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      const a = ini + i * passo;
      if (a > agora) break;
      const dur = Math.max(BALDE_MS, Math.min(passo, agora - a));
      v[i] = sr.baldes.filter((b) => b.t >= a && b.t < a + passo).reduce((t, b) => t + (b.xp || 0), 0) / (dur / HORA);
    }
    return { ...sr, v };
  });
  const max = Math.max(1, ...dados.flatMap((x) => x.v.filter((y) => y != null)));
  const bruto = max / 4, pot = 10 ** Math.floor(Math.log10(bruto)), passoY = [1, 2, 2.5, 5, 10].find((m) => m * pot >= bruto) * pot, topo = passoY * 4;
  const W = larg - M.l - M.r, H = alt - M.t - M.b, X = (i) => M.l + ((i + 0.5) / n) * W, Y = (v) => M.t + H - (v / topo) * H;
  const grade = [0, 1, 2, 3, 4].flatMap((k) => [
    s('line', { x1: M.l, x2: larg - M.r, y1: Y(k * passoY), y2: Y(k * passoY), class: k ? 'graf-grade' : 'graf-base' }),
    s('text', { x: M.l - 6, y: Y(k * passoY) + 4, 'text-anchor': 'end' }, k ? tickXp(k * passoY) : '0')]);
  // de 4 a 8 horas marcadas no eixo, num passo redondo (1, 2, 3, 4, 6 ou 12 h); a primeira e a última ficam dentro do gráfico
  const totalHoras = (n * passo) / HORA, maxRotulos = larg < 520 ? 4 : 8;
  const horasPasso = [1, 2, 3, 4, 6, 12, 24].find((p) => totalHoras / p <= maxRotulos) || 24, eixo = [];
  for (let k = 0; k * HORA < n * passo; k += horasPasso) {
    const x = M.l + ((k * HORA) / (n * passo)) * W;
    eixo.push(s('text', { x, y: alt - 6, 'text-anchor': k ? (x > larg - M.r - 24 ? 'end' : 'middle') : 'start' }, hora(ini + k * HORA)));
  }
  // linhas retas, sem marcador em cada ponto; quem é quem está na legenda acima
  const linhas = dados.map((sr) => {
    const pts = sr.v.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
    return s('polyline', { points: pts.map((p) => p.map((x) => x.toFixed(1)).join(',')).join(' '), fill: 'none', stroke: sr.cor, 'stroke-width': 2, 'stroke-linejoin': 'round' });
  });
  const rotulos = [];
  const dica = Array.from({ length: n }, (_, i) => {
    const a = ini + i * passo;
    if (a > agora) return null;
    return s('rect', { x: M.l + (i / n) * W, y: M.t, width: W / n, height: H, class: 'graf-faixa' },
      s('title', null, `${hora(a)}–${hora(a + passo)}\n` + dados.map((sr) => `${sr.rotulo}: ${inteiro(sr.v[i])} XP/h`).join('\n')));
  });
  return h('div', { class: 'graf' },
    h('div', { class: 'legenda' }, dados.map((sr) => h('span', null, h('i', { style: `background:${sr.cor}` }), sr.rotulo))),
    s('svg', { viewBox: `0 0 ${larg} ${alt}`, width: larg, height: alt, role: 'img', 'aria-label': 'XP por hora ao longo do dia, por personagem' }, ...grade, ...eixo, ...linhas, ...rotulos, ...dica));
}

(async () => {
  await exigirLogin();
  montarNav();
  const raiz = $id('pagina');
  const HORAS = { '24h': 24, '7d': 168, '30d': 720 };
  let periodo = lerPref('rel-periodo', '24h'), quem = lerPref('rel-quem', 'todos'), faixa = Number(lerPref('rel-faixa', '60'));
  const rarOff = new Set(), ordDrops = { col: -1, dir: 1 }, ordMat = { col: -1, dir: 1 }, ordNiv = { col: -1, dir: 1 };
  let fZona = '', fItem = '';
  let d;
  try {
    const agora = Date.now(), desde = agora - 30 * DIA;
    const [estados, cac, evs, pul, primeiro, merc, icones] = await Promise.all([
      Nuvem.estados(), Nuvem.cacadas(desde), Nuvem.eventos(desde, ['drop', 'nivel', 'chao']),
      Nuvem.pulsos(agora - DIA), Nuvem.primeiroPulso(), Nuvem.mercado(20), Nuvem.icones(), Nuvem.planos()
    ]);
    const precos = indicePrecos(merc);
    d = { estados, cac, evs, pul, primeiro, precos, porNome: indicePorNome(precos), icones };
  } catch (e) { erroNaPagina(raiz, e); return; }
  const ctx = { icones: d.icones };
  const nomes = [...new Set([...Object.keys(d.estados), ...Object.keys(d.cac), ...d.evs.map((e) => e.personagem)])].sort();

  function totais(ini, agora, doQuem) {
    const t = { xp: 0, ouro: 0, abates: 0, seg: 0, mortes: 0, materiais: {} };
    for (const [p, c] of Object.entries(d.cac)) if (doQuem(p)) for (const x of c.sessoes) {
      const a = Math.max(x.ini, ini), b = Math.min(x.fim, agora);
      if (b <= a) continue;
      const f = x.fim > x.ini ? (b - a) / (x.fim - x.ini) : 1;      // sessão cortada pelo período: proporcional ao tempo
      t.xp += x.xp * f; t.ouro += x.ouro * f; t.abates += x.abates * f; t.seg += x.seg * f; t.mortes += (x.mortes || 0) * f;
      for (const [m, q] of Object.entries(x.drops || {})) t.materiais[m] = (t.materiais[m] || 0) + q * f;
    }
    return t;
  }

  // "Hoje" de um personagem: desde a meia-noite de Brasília, pelos baldes de 5 min das caçadas
  function hoje(p, ini, agora) {
    const baldes = (d.cac[p]?.sessoes || []).flatMap((x) => x.baldes).filter((b) => b.t >= ini);
    const xp = baldes.reduce((s0, b) => s0 + (b.xp || 0), 0);
    const niveis = d.evs.filter((e) => e.tipo === 'nivel' && e.personagem === p && e.ts >= ini).map((e) => parseInt((e.texto || '').replace(/\D+/g, ''), 10) || null);
    const xph = baldes.filter((b) => b.t >= agora - HORA).reduce((s0, b) => s0 + (b.xp || 0), 0);      // XP da última hora
    const x = d.estados[p]?.xpNivel, nivel = parseInt(d.estados[p]?.nivel, 10);
    const falta = x?.total ? Math.max(0, x.total - x.atual) : null;
    return { p, baldes, xp, niveis, xph, falta, nivel, previsao: falta != null && xph > 0 ? agora + (falta / xph) * HORA : null };
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
    const mortes = Math.round(t.mortes), chao = evs.filter((e) => e.tipo === 'chao').length;
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
    const secAtiv = cartao(periodo === '24h' ? 'Atividade nas últimas 24 h' : `Atividade nas últimas 24 h (os pulsos são só de 24 h, mesmo com ${periodo === '7d' ? '7 dias' : '30 dias'} escolhidos)`,
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
      return { celulas: [nomeCurto(n.personagem), h('b', { class: 'acao-ouro' }, String(n.nivel ?? '?')), dataHora(n.ts), ant ? duracao((n.ts - ant.ts) / 1000) : '—', n.zona || '—'],
        v: [n.personagem, n.nivel, n.ts, ant ? n.ts - ant.ts : null, n.zona] };
    });
    const secNiv = cartao('Níveis upados', linhasNiv.length
      ? tabela([{ t: 'Personagem', ordena: true }, { t: 'Nível', num: true, ordena: true }, { t: 'Quando', ordena: true }, { t: 'Tempo no nível anterior', num: true, ordena: true }, { t: 'Zona', ordena: true }], linhasNiv, 'Níveis upados', ordNiv)
      : vazio('Nenhum nível no período.'));

    const rars = [...new Set(drops.map((e) => e.raridade || ''))].sort((a, b) => Object.keys(NOME_RAR).indexOf(a) - Object.keys(NOME_RAR).indexOf(b));
    const zonas = [...new Set(drops.map((e) => e.zona).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (fZona && !zonas.includes(fZona)) fZona = '';
    const equip = (p) => d.estados[p]?.ficha?.equip || [];
    // filtros de zona e de item mexem só na tabela (o campo de texto não perde o foco enquanto se digita)
    const tabDrops = h('div'), contDrops = h('div');
    function tabelaDrops() {
      const q = fItem.trim().toLowerCase();
      const vis = drops.filter((e) => !rarOff.has(e.raridade || '') && (!fZona || e.zona === fZona) && (!q || (e.item || e.titulo || '').toLowerCase().includes(q))).reverse();
      const linhasDrop = vis.slice(0, 300).map((e) => {
        const nome = e.item || e.titulo, usa = equip(e.personagem).find((i) => i.nome === nome);
        return { celulas: [
          dataHora(e.ts), nomeCurto(e.personagem),
          h('div', { class: 'item' }, imagem(nome, ctx, { tam: 28, raridade: e.raridade }), h('span', { class: 'item-nome' }, nome)),
          qualTag(e), rarTag(e.raridade || ''),
          e.preco ? h('span', null, precoTxt(e.preco.ouro), h('span', { class: 'fraco' }, ` (${e.preco.n})`)) : h('span', { class: 'fraco' }, 'sem leitura'),
          usa ? h('span', { class: 'acao-ouro' }, `você usa a ${[usa.qual, usa.refino].filter(Boolean).join(' ')}`) : '—'
        ], v: [e.ts, e.personagem, nome, e.qual === '?' ? '' : e.qual || '', NOME_RAR[e.raridade || ''] ?? e.raridade, e.preco ? e.preco.ouro : null, usa ? 1 : 0] };
      });
      tabDrops.replaceChildren(
        linhasDrop.length
          ? tabela([{ t: 'Quando', ordena: true }, { t: 'Personagem', ordena: true }, { t: 'Item', ordena: true }, { t: 'Qual.', ordena: true }, { t: 'Raridade', ordena: true }, { t: 'Menor no Mercado', num: true, ordena: true }, { t: 'Na sua build' }], linhasDrop, 'Itens dropados', ordDrops)
          : vazio(drops.length ? 'Nenhum drop com esses filtros.' : 'Nenhum drop no período.'),
        ...(vis.length > 300 ? [nota(`Mostrando os 300 mais recentes de ${vis.length}; a ordenação vale só entre eles.`)] : []));
    }
    tabelaDrops();
    const secDrops = cartao('Itens dropados',
      h('div', { class: 'filtros-drops' },
        rars.length > 1 ? h('div', { class: 'chips', role: 'group', 'aria-label': 'Raridade' }, rars.map((r) => h('button', {
          type: 'button', class: 'chip', 'aria-pressed': String(!rarOff.has(r)), onclick: () => { if (rarOff.has(r)) rarOff.delete(r); else rarOff.add(r); desenhar(); }
        }, NOME_RAR[r] ?? r))) : null,
        zonas.length > 1 ? h('label', { class: 'filtro' }, 'Zona', h('select', { onchange: (ev) => { fZona = ev.target.value; tabelaDrops(); } },
          h('option', { value: '' }, 'Todas'), zonas.map((z) => h('option', { value: z, selected: z === fZona ? '' : null }, z)))) : null,
        h('label', { class: 'filtro' }, 'Item', h('input', { type: 'search', value: fItem, placeholder: 'Parte do nome', autocomplete: 'off', oninput: (ev) => { fItem = ev.target.value; tabelaDrops(); } }))),
      tabDrops,
      nota(`Preço: a mesma versão (+0, sem carta) na última leitura do Mercado${d.precos.ultima ? `, de ${dataHora(d.precos.ultima.lidoEm)}` : ''}. Entre parênteses, quantos estavam à venda. Drop que o jogo deixa no chão pelos filtros não chega à mochila e não entra aqui.`));

    // materiais: a soma de cacadas.drops no período (sessões cortadas pelo período entram proporcionais ao tempo)
    const mats = Object.entries(t.materiais).map(([m, q]) => ({ m, q: Math.round(q) })).filter((x) => x.q > 0).sort((a, b) => b.q - a.q);
    const secMat = cartao('Materiais',
      mats.length ? tabela([{ t: 'Material', ordena: true }, { t: 'Quantidade', num: true, ordena: true }, { t: 'Por hora caçando', num: true, ordena: true }],
        mats.map((x) => ({ celulas: [h('div', { class: 'item' }, imagem(x.m, ctx, { tam: 24 }), h('span', { class: 'item-nome' }, x.m)), inteiro(x.q), t.seg >= 60 ? inteiro(x.q / (t.seg / 3600)) : '—'],
          v: [x.m, x.q, t.seg >= 60 ? x.q / (t.seg / 3600) : null] })), 'Materiais', ordMat)
        : vazio('Nenhum material no período.'),
      nota('Soma do que cada caçada guardou (cacadas.drops). Não inclui o que o jogo deixa no chão pelos filtros.'));

    // Hoje: desde a meia-noite de Brasília, por personagem
    const ini0 = inicioDoDia(agora), cor = (p) => COR_LINHA[nomes.indexOf(p) % COR_LINHA.length];
    const hj = nomes.filter(doQuem).map((p) => hoje(p, ini0, agora));
    const tileProx = (x) => {
      const rot = x.nivel ? `Sobe para o nível ${x.nivel + 1}` : 'Próximo nível';
      if (x.falta == null) return tile(rot, '—', 'sem a barra de XP lida');
      if (!(x.xph > 0)) return tile(rot, 'Parado', `sem caça na última hora · faltam ${curto(x.falta)} de XP`);
      const em = x.previsao - agora;
      return tile(rot, em > 12 * HORA ? dataHora(x.previsao) : hora(x.previsao), `às ${hora(x.previsao)} · em ${duracao(em / 1000)} · faltam ${curto(x.falta)}`);
    };
    const larg = Math.round(Math.min(1340, Math.max(300, (raiz.clientWidth || 360) - 34)));
    const secHoje = cartao('Hoje (desde 00:00, horário de Brasília)',
      hj.length ? h('div', { class: 'hoje-grade' }, hj.map((x) => h('div', { class: 'hoje-pers' },
        h('h3', { class: 'hoje-nome' }, h('i', { style: `background:${cor(x.p)}` }), nomeCurto(x.p)),
        h('div', { class: 'grade-tiles' },
          tile('XP hoje', curto(x.xp), x.xph > 0 ? `${curto(x.xph)} por hora na última hora` : 'parado na última hora'),
          tile('Níveis hoje', x.niveis.length ? '+' + x.niveis.length : '0', x.niveis.filter(Boolean).length ? `até o nível ${Math.max(...x.niveis.filter(Boolean))}` : 'nenhum ainda'),
          tileProx(x))))) : vazio('Nenhum personagem lido ainda.'),
      hj.length ? h('div', null,
        h('div', { class: 'pagina-cab' }, h('h3', { class: 'sub-cab' }, 'XP por hora ao longo do dia'),
          chips('Faixa do gráfico', [['30', '30 min'], ['60', '1 hora']], String(faixa), (v) => { faixa = Number(v); gravarPref('rel-faixa', v); desenhar(); })),
        graficoXp(hj.map((x) => ({ rotulo: nomeCurto(x.p), cor: cor(x.p), baldes: x.baldes })), ini0, agora, faixa * 60e3, larg),
        nota('Soma dos baldes de 5 min de cada faixa, em XP por hora; a faixa atual conta só o tempo que já passou.')) : null);

    raiz.replaceChildren(filtros, secHoje, tiles, secAtiv, secNiv, secDrops, secMat);
    raiz.removeAttribute('aria-busy');
  }
  desenhar();
  // girar o celular muda a largura do gráfico
  let larg0 = raiz.clientWidth;
  addEventListener('resize', () => { if (Math.abs(raiz.clientWidth - larg0) > 30) { larg0 = raiz.clientWidth; desenhar(); } });
})();
