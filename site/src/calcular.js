// Lupa Online · Calcular: calculadoras com as tabelas PÚBLICAS do jogo (dados-jogo.js): tempo até o nível, forja do Ornn, valor de
// venda e comparar builds; e o Onde gastar o ouro, que o app de PC calcula em casa (simulando no motor do jogo) e manda pronto.
// Tudo aqui é ESTIMATIVA: o site só calcula e mostra, não interage com o jogo.
'use strict';

// as contas (Monte Carlo da forja, XP/h medido, horas até o nível) ficam em calculos.js, que o node --test confere
const { simularForja, xpHoraSessoes, xpHoraBaldes, horasAte } = CALC;

// ---------- formatação ----------
const horasTxt = (hs) => (hs == null || !isFinite(hs) ? '—' : hs < 1 ? `${Math.max(1, Math.round(hs * 60))} min` : hs < 100 ? `${hs.toFixed(1).replace('.', ',')} h` : `${inteiro(hs)} h`);
function prazoTxt(hs, hDia) {
  if (hs == null || !isFinite(hs)) return '—';
  const dias = hs / hDia, quando = new Date(Date.now() + dias * DIA).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const dur = dias < 1 ? 'hoje' : dias < 60 ? `${Math.ceil(dias)} dias` : dias < 730 ? `${(dias / 30.4).toFixed(1).replace('.', ',')} meses` : `${(dias / 365).toFixed(1).replace('.', ',')} anos`;
  return `${dur} · ${quando}`;
}
const nivelTxt = (n) => `nível ${n}`;
// XP grande: de M a bi (o curto() do ui.js pararia em M e escreveria 24869,30 M)
const xpTxt = (v) => (v >= 1e9 ? (v / 1e9).toFixed(2).replace('.', ',') + ' bi' : curto(v));
const tickCurva = (v) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}`.replace('.', ',') + ' M' : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}`.replace('.', ',') + ' k' : String(v));
const camposNum = (props) => h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', ...props });

// ---------- comparar builds: leitura da ficha e formatação das diferenças ----------
const CARTA_NOME = { ataque: 'Ataque', poder: 'Poder de Habilidade', vida: 'Vida', armadura: 'Armadura', rm: 'Resistência Mágica', velocidade: 'Velocidade de Ataque', critico: 'Crítico', roubo: 'Roubo de Vida', vampirismo: 'Vampirismo Universal', recarga: 'Redução de Recarga' };
const CARTA_RARIDADE = { 1: 'Básica', 2: 'Rara', 3: 'Lendária' };
const ATRIBUTOS = [['forca', 'Força'], ['vitalidade', 'Vitalidade'], ['resistencia', 'Resistência'], ['agilidade', 'Agilidade'], ['foco', 'Foco']];
const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
// número como a ficha do jogo escreve: "724", "2,98", "2.98", "83%", "1.234", "1,2 k"
function numeroDoTexto(t) {
  let x = String(t == null ? '' : t).replace(/\s/g, '').replace(/[×x%]/gi, '');
  if (!x) return null;
  let mult = 1;
  const suf = /([kKmM])$/.exec(x);
  if (suf) { mult = suf[1].toLowerCase() === 'k' ? 1e3 : 1e6; x = x.slice(0, -1); }
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(x)) x = x.replace(/\./g, '').replace(',', '.');      // 1.234 ou 1.234,5
  else x = x.replace(',', '.');
  const n = Number(x);
  return Number.isFinite(n) ? n * mult : null;
}
const pctTexto = (t) => { const n = numeroDoTexto(t); return n == null ? null : /%/.test(String(t)) ? n / 100 : n; };
// "3031!+4#ataque2~B" -> { id: "3031!", refino: 4, qual: "B", carta: "ataque2" }
function itemDaChave(x) {
  const m = RE_CHAVE.exec(String(x || ''));
  return m ? { id: m[1] + m[2], refino: +(m[3] || 0), qual: m[5], carta: m[4] || '' } : null;
}
const baseDe = (id) => String(id || '').replace(/!$/, '');
const nBR = (v, casas = 1) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const sinal = (p, casas = 1) => { const t = nBR(Math.abs(p), casas); return Math.abs(p) < 0.5 * 10 ** -casas ? t : (p > 0 ? '+' : '−') + t; };
// diferença B contra A: tipo "rel" (em %), "pp" (pontos percentuais). melhor: +1 se maior é melhor, -1 se menor é melhor. O sinal vai no texto; a cor só diz bom ou ruim.
function difTexto(a, b, tipo = 'rel', melhor = 1) {
  let p, txt;
  if (tipo === 'pp') { p = (b - a) * 100; txt = sinal(p) + ' pp'; }
  else if (!a) { p = b ? Infinity * Math.sign(b) : 0; txt = b ? 'novo' : '—'; }
  else { p = (b / a - 1) * 100; txt = sinal(p) + '%'; }
  const bom = Math.abs(p) < 0.05 ? '' : p * melhor > 0 ? 'dif-bom' : 'dif-ruim';
  return { p, txt, classe: bom };
}
const difSpan = (d) => h('span', { class: 'dif ' + d.classe }, d.txt);

// ---------- gráfico: XP para passar de cada nível, do 1 ao 100 ----------
function graficoCurva(larg, nivel, alvo) {
  const alt = larg < 520 ? 200 : 230, M = { l: 54, r: 14, t: 12, b: 26 }, W = larg - M.l - M.r, H = alt - M.t - M.b;
  const dados = Array.from({ length: 99 }, (_, i) => JOGO.xpParaNivel(i + 1)), max = Math.max(...dados);
  const bruto = max / 4, pot = 10 ** Math.floor(Math.log10(bruto)), passoY = [1, 2, 2.5, 5, 10].find((m) => m * pot >= bruto) * pot, topo = passoY * 4;
  const X = (n) => M.l + ((n - 1) / 98) * W, Y = (v) => M.t + H - (v / topo) * H;
  const grade = [0, 1, 2, 3, 4].flatMap((k) => [
    s('line', { x1: M.l, x2: larg - M.r, y1: Y(k * passoY), y2: Y(k * passoY), class: k ? 'graf-grade' : 'graf-base' }),
    s('text', { x: M.l - 6, y: Y(k * passoY) + 4, 'text-anchor': 'end' }, k ? tickCurva(k * passoY) : '0')]);
  const marcas = larg < 520 ? [1, 25, 50, 75, 99] : [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99].filter((_, i) => i % 2 === 0 || i === 10);
  const eixo = marcas.map((n) => s('text', { x: X(n), y: alt - 7, 'text-anchor': n === 1 ? 'start' : n === 99 ? 'end' : 'middle' }, String(n)));
  const ref = (n, rot, fila) => (n >= 1 && n <= 99 ? [s('line', { x1: X(n), x2: X(n), y1: M.t, y2: M.t + H, class: 'graf-marca' }), s('text', { x: X(n) + (n > 70 ? -4 : 4), y: M.t + 11 + fila * 15, 'text-anchor': n > 70 ? 'end' : 'start', class: 'graf-rotulo' }, rot)] : []);
  const linha = dados.map((v, i) => `${X(i + 1).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const faixas = dados.map((v, i) => s('rect', { x: X(i + 1) - W / 196, y: M.t, width: W / 98, height: H, class: 'graf-faixa' }, s('title', null, `Nível ${i + 1} → ${i + 2}: ${inteiro(v)} XP`)));
  return h('div', { class: 'graf' },
    h('div', { class: 'legenda' }, h('span', null, h('i', { style: 'background:var(--verde)' }), 'XP para passar do nível n para o n + 1')),
    s('svg', { viewBox: `0 0 ${larg} ${alt}`, width: larg, height: alt, role: 'img', 'aria-label': `Curva de XP por nível, do 1 ao 99. Você está no nível ${nivel}.` },
      ...grade, ...eixo, ...ref(nivel, `você (${nivel})`, 0), ...(alvo !== nivel ? ref(alvo, `alvo (${alvo})`, 1) : []),
      s('polyline', { points: linha, fill: 'none', stroke: 'var(--verde)', 'stroke-width': 2, 'stroke-linejoin': 'round' }), ...faixas));
}

(async () => {
  await exigirLogin();
  montarNav();
  const raiz = $id('pagina');
  let quem = lerPref('calc-quem', ''), aba = lerPref('calc-aba', 'nivel');
  let estados, cac;
  try { [estados, cac] = await Promise.all([Nuvem.estados(), Nuvem.cacadas(Date.now() - 8 * DIA), Nuvem.planos()]); }      // planos: nomeCurto usa o campeão
  catch (e) { erroNaPagina(raiz, e); return; }
  const nomes = Object.keys(estados).sort();
  if (!nomes.includes(quem)) quem = nomes[0] || '';
  const itens = [...JOGO.ITENS].sort((a, b) => ['lendario', 'epico', 'basico', 'mitico'].indexOf(a.raridade) - ['lendario', 'epico', 'basico', 'mitico'].indexOf(b.raridade) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const NOME_RAR = { lendario: 'Lendários', epico: 'Épicos', basico: 'Básicos', mitico: 'Míticos' };
  const geradoEm = Date.parse(JOGO.meta.geradoEm);
  const rodape = () => nota(`Tabelas do jogo de ${new Date(geradoEm).toLocaleDateString('pt-BR')}, versão ${JOGO.meta.versaoJogo || '?'}${Date.now() - geradoEm > 21 * DIA ? '. Estão velhas (mais de 21 dias): rode gerar-tabelas.mjs.' : '.'}`);

  const seletorItem = (valor, aoMudar) => {
    const sel = h('select', { id: 'sel-item', onchange: () => aoMudar(sel.value) },
      ['lendario', 'epico', 'basico', 'mitico'].map((r) => (itens.some((i) => i.raridade === r) ? h('optgroup', { label: NOME_RAR[r] }, itens.filter((i) => i.raridade === r).map((i) => h('option', { value: i.id }, i.nome))) : null)));
    sel.value = valor;
    return sel;
  };
  // os itens que o personagem usa ou carrega, para preencher o formulário com um clique
  function itensDoPersonagem() {
    const f = estados[quem]?.ficha, vistos = new Set(), out = [];
    // os básicos da mochila (a Lupa lê desde a 0.8) não entram: tirariam do limite de 10 os itens que valem comparar
    for (const it of [...(f?.equip || []), ...(f?.mochila || []).filter((i) => i.raridade !== 'basico')]) {
      const m = String(it.id || '').match(RE_CHAVE);
      if (!m || !JOGO.item(m[1]) || vistos.has(it.id)) continue;
      vistos.add(it.id);
      out.push({ id: m[1], refino: +(m[3] || 0), qual: m[5], nome: JOGO.item(m[1]).nome });
    }
    return out.slice(0, 10);
  }
  const chipsDosItens = (aoEscolher) => {
    const lista = itensDoPersonagem();
    return lista.length ? h('div', { class: 'chips', role: 'group', 'aria-label': 'Itens do personagem' }, h('span', { class: 'fraco rot-chips' }, 'Dos seus itens:'),
      lista.map((x) => h('button', { type: 'button', class: 'chip', onclick: () => aoEscolher(x) }, `${x.nome} +${x.refino} ${x.qual}`))) : null;
  };
  const campo = (rotulo, ...filhos) => h('label', { class: 'filtro' }, rotulo, ...filhos);

  // ================= 1) tempo até o nível =================
  const TN = { fonte: lerPref('calc-fonte', '24h'), hDia: lerPref('calc-hdia', '8'), alvo: null, xpHtxt: null, zona: null, quem: null };
  function abaNivel() {
    const e = estados[quem], nivel = Number(e?.nivel) || 0, caixa = h('div', { class: 'calc-corpo' });
    if (!nivel) return cartao('Tempo até o nível', vazio('Ainda não sei o nível deste personagem: a Lupa precisa enviar o personagem primeiro.'));
    if (TN.quem !== quem) { TN.quem = quem; TN.alvo = Math.min(100, nivel + 1); TN.xpHtxt = null; TN.zona = null; }
    const xp = e.xpNivel && e.xpNivel.total > 0 ? e.xpNivel : null;
    const sess = cac[quem]?.sessoes || [];
    const fontes = { '1h': xpHoraBaldes(sess), '24h': xpHoraSessoes(sess, DIA), '7d': xpHoraSessoes(sess, 7 * DIA) };
    if (TN.fonte !== 'manual' && fontes[TN.fonte] == null) TN.fonte = Object.keys(fontes).find((k) => fontes[k] != null) || 'manual';
    const zonaAtual = JOGO.ZONAS.find((z) => z.nome === e.zona) || JOGO.zonaIdeal(nivel);
    const zona = JOGO.ZONA[TN.zona] || zonaAtual;
    const xpH = TN.fonte === 'manual' ? (lerPreco(TN.xpHtxt || '') || null) : fontes[TN.fonte];
    const hDia = Math.min(24, Math.max(0.5, Number(String(TN.hDia).replace(',', '.')) || 8));
    const nm = (zona.nm[0] + zona.nm[1]) / 2;

    const inpXp = camposNum({ id: 'in-xph', value: xpH ? String(Math.round(xpH)) : (TN.xpHtxt || ''), 'aria-label': 'XP por hora' });
    inpXp.addEventListener('change', () => { TN.fonte = 'manual'; TN.xpHtxt = inpXp.value; gravarPref('calc-fonte', 'manual'); desenhar(); });
    const inpAlvo = camposNum({ id: 'in-alvo', value: String(TN.alvo), 'aria-label': 'Nível alvo' });
    inpAlvo.addEventListener('change', () => { TN.alvo = Math.min(100, Math.max(nivel, Math.round(Number(inpAlvo.value)) || nivel + 1)); desenhar(); });
    const inpHdia = camposNum({ id: 'in-hdia', value: String(TN.hDia), 'aria-label': 'Horas de caça por dia' });
    inpHdia.addEventListener('change', () => { TN.hDia = inpHdia.value; gravarPref('calc-hdia', inpHdia.value); desenhar(); });
    const selZona = h('select', { id: 'sel-zona', onchange: () => { TN.zona = selZona.value; desenhar(); }, 'aria-label': 'Zona de caça' },
      JOGO.ZONAS.map((z) => h('option', { value: z.id }, `${z.nome} (monstros ${z.nm[0]} a ${z.nm[1]})`)));
    selZona.value = zona.id;

    const form = h('div', { class: 'filtros-drops' },
      campo('XP por hora', inpXp), campo('Nível alvo', inpAlvo), campo('Horas de caça por dia', inpHdia), campo('Zona onde continua', selZona));
    const origem = h('div', { class: 'chips-linha' }, h('span', { class: 'fraco rot-chips' }, 'XP/h medido:'),
      chips('Fonte do XP/h', [['1h', `Última hora${fontes['1h'] ? ' · ' + curto(fontes['1h']) : ' · sem dado'}`], ['24h', `24 h${fontes['24h'] ? ' · ' + curto(fontes['24h']) : ' · sem dado'}`], ['7d', `7 dias${fontes['7d'] ? ' · ' + curto(fontes['7d']) : ' · sem dado'}`], ['manual', 'Digitado']],
        TN.fonte, (v) => { if (v !== 'manual' && fontes[v] == null) return; TN.fonte = v; gravarPref('calc-fonte', v); desenhar(); }));

    const falta = xp ? Math.max(0, xp.total - xp.atual) : JOGO.xpParaNivel(nivel);
    let corpo;
    if (nivel >= JOGO.NIVEL_MAX) corpo = vazio('Este personagem já está no nível 100.');
    else if (!xpH) corpo = vazio('Sem XP/h para projetar: cace um pouco (a Lupa mede) ou digite um valor no campo XP por hora.');
    else {
      const alvos = [...new Set([TN.alvo, nivel + 1, nivel + 5, nivel + 10, 100].map((n) => Math.min(100, n)))].filter((n) => n > nivel).sort((a, b) => a - b);
      const linhas = alvos.map((a) => {
        const faltaXp = falta + JOGO.xpEntre(nivel + 1, a), h0 = horasAte(nivel, a, falta, xpH, nm, false), h1 = horasAte(nivel, a, falta, xpH, nm, true);
        const sufixo = a === TN.alvo ? 'seu alvo' : `+${a - nivel}`;
        return { classe: a === TN.alvo ? 'melhor' : null, celulas: [h('div', null, h('b', null, `Nível ${a}`), h('span', { class: 'fraco aviso-zona' }, sufixo)), xpTxt(faltaXp), horasTxt(h0), prazoTxt(h0, hDia), horasTxt(h1), prazoTxt(h1, hDia)] };
      });
      const hProx = horasAte(nivel, nivel + 1, falta, xpH, nm, false);
      const perda = JOGO.fatorXp(nivel, nm) < 1 ? `Os monstros daqui (nível ${nm.toFixed(0)}) já dão só ${Math.round(JOGO.fatorXp(nivel, nm) * 100)}% do XP no seu nível.` : `Os monstros daqui (nível ${nm.toFixed(0)}) dão o XP inteiro até o seu nível chegar a ${Math.floor(nm + 5)}; depois perdem 10% por nível.`;
      corpo = h('div', { class: 'calc-corpo' },
        h('div', { class: 'grade-tiles' }, tile('Você está no', nivelTxt(nivel), xp ? `${curto(xp.atual)} de ${curto(xp.total)} XP` : 'XP do nível desconhecido'), tile('Falta para o nível ' + (nivel + 1), curto(falta) + ' XP', `${horasTxt(hProx)} de caça`),
          tile('XP/h usado', curto(xpH), TN.fonte === 'manual' ? 'digitado por você' : 'medido por você'), tile('Caça por dia', horasTxt(hDia), 'só para os prazos abaixo')),
        tabela([{ t: 'Alvo' }, { t: 'XP que falta', num: true }, { t: 'Caça, XP/h fixo', num: true }, { t: 'Prazo, XP/h fixo' }, { t: 'Caça, com fatorXp', num: true }, { t: 'Prazo, com fatorXp' }], linhas, 'Tempo até cada nível'),
        nota(`"Com fatorXp" supõe que você continua em ${zona.nome}. ${perda} Sem fatorXp o XP/h seria sempre o mesmo, o que só vale se você for subindo de zona.`));
    }
    caixa.replaceChildren(origem, form, corpo,
      h('div', { class: 'calc-corpo' }, h('h3', { class: 'sub-cab' }, 'Curva de XP até o nível 100'), graficoCurva(Math.max(300, Math.min(1100, Math.floor(raiz.clientWidth - 34))), nivel, TN.alvo)),
      nota('Estimativa: usa o XP/h que você mediu (ou digitou), a tabela de XP do jogo e a regra do fatorXp. Não conta mortes, tarefas, diárias, eventos nem mudança de build.'));
    return h('section', { class: 'cartao' }, h('h2', { class: 'rotulo' }, 'Tempo até o nível'), caixa);
  }

  // ================= 2) forja (Ornn) =================
  const FJ = { item: lerPref('calc-fj-item', itens.find((i) => i.id === '3031') ? '3031' : itens[0].id), de: Number(lerPref('calc-fj-de', '3')), ate: Number(lerPref('calc-fj-ate', '4')), vip: lerPref('calc-fj-vip', '0') === '1', falhas: '0' };
  function abaForja() {
    const corpo = h('div', { class: 'calc-corpo' }), saida = h('div', { class: 'calc-corpo' });
    const guardar = () => { gravarPref('calc-fj-item', FJ.item); gravarPref('calc-fj-de', String(FJ.de)); gravarPref('calc-fj-ate', String(FJ.ate)); gravarPref('calc-fj-vip', FJ.vip ? '1' : '0'); };
    FJ.de = Math.min(6, Math.max(0, FJ.de)); FJ.ate = Math.min(7, Math.max(FJ.de + 1, FJ.ate));
    const selDe = h('select', { id: 'sel-de', onchange: () => { FJ.de = +selDe.value; FJ.falhas = '0'; guardar(); desenhar(); } }, [0, 1, 2, 3, 4, 5, 6].map((r) => h('option', { value: r }, `+${r}`)));
    selDe.value = FJ.de;
    const selAte = h('select', { id: 'sel-ate', onchange: () => { FJ.ate = +selAte.value; FJ.falhas = '0'; guardar(); desenhar(); } }, [1, 2, 3, 4, 5, 6, 7].filter((r) => r > FJ.de).map((r) => h('option', { value: r }, `+${r}`)));
    selAte.value = FJ.ate;
    const inpFalhas = camposNum({ id: 'in-falhas', value: FJ.falhas, 'aria-label': 'Falhas acumuladas no próximo refino' });
    inpFalhas.addEventListener('change', () => { FJ.falhas = String(Math.max(0, Math.round(Number(inpFalhas.value) || 0))); calcular(); });
    const form = h('div', { class: 'filtros-drops' }, campo('Item', seletorItem(FJ.item, (v) => { FJ.item = v; FJ.falhas = '0'; guardar(); desenhar(); })), campo('Refino atual', selDe), campo('Refino alvo', selAte),
      campo(`Falhas já acumuladas no +${FJ.de + 1}`, inpFalhas),
      h('button', { type: 'button', id: 'bt-vip', class: 'chave', 'aria-pressed': String(FJ.vip), onclick: () => { FJ.vip = !FJ.vip; guardar(); desenhar(); } }, h('span', { class: 'trilho', 'aria-hidden': 'true' }), h('span', null, `VIP (chance ×${JOGO.VIP.refino}, até ${Math.round(JOGO.VIP.refinoMax * 100)}%)`)));

    function calcular() {
      const it = JOGO.item(FJ.item), falhas0 = Math.max(0, Math.round(Number(FJ.falhas) || 0));
      const r = simularForja({ id: FJ.item, de: FJ.de, ate: FJ.ate, vip: FJ.vip, falhas0 });
      const pct = (p) => (p >= 0.1 ? (p * 100).toFixed(1) : p >= 0.001 ? (p * 100).toFixed(2) : (p * 100).toFixed(3)).replace('.', ',') + '%';
      const passos = [];
      for (let ref = FJ.de; ref < FJ.ate; ref++) {
        const regra = JOGO.PERSISTENCIA[ref + 1], base = JOGO.chanceRefino(ref, FJ.vip), reg = JOGO.REGRESSAO_REFINO[ref];
        passos.push({ celulas: [h('b', { style: 'white-space:nowrap' }, `+${ref} → +${ref + 1}`), pct(base), precoTxt(JOGO.precoRefino(FJ.item, ref)), regra?.max ? `${inteiro(regra.max)}ª tentativa` : 'sem garantia', reg ? pct(reg) : 'nunca'] });
      }
      const regra1 = JOGO.PERSISTENCIA[FJ.de + 1], chance1 = JOGO.chanceForja(FJ.de, falhas0, FJ.vip);
      const faltamGar = regra1?.max ? Math.max(1, regra1.max - falhas0) : null;
      saida.replaceChildren(
        h('div', { class: 'grade-tiles' },
          tile(`Chance da próxima tentativa (+${FJ.de} → +${FJ.de + 1})`, pct(chance1), falhas0 ? `com ${inteiro(falhas0)} falhas acumuladas` : 'sem falhas acumuladas'),
          tile('Tentativas esperadas', inteiro(r.tent.media), `mediana ${inteiro(r.tent.p50)} · 90% termina em ${inteiro(r.tent.p90)}`),
          tile('Ouro esperado', precoTxt(r.custo.media), `mediana ${precoTxt(r.custo.p50)} · 90% termina em ${precoTxt(r.custo.p90)}`),
          tile('Garantia do Ornn no passo atual', faltamGar ? `em ${inteiro(faltamGar)} tentativas` : 'não há', faltamGar ? `chega a 100% na ${inteiro(regra1.max)}ª tentativa` : `o +${FJ.de + 1} é rápido e não tem garantia`)),
        tabela([{ t: 'Passo' }, { t: 'Chance base', num: true }, { t: 'Ouro por tentativa', num: true }, { t: 'Garantia na' }, { t: 'Chance de voltar um refino ao falhar', num: true }], passos, 'Passos da forja'),
        nota(`${it.nome} (preço-base ${inteiro(it.preco)}). A "chance base" é a da primeira tentativa; a cada falha ela sobe 1% da própria chance (até +50%) e, perto do limite, dispara até 100% na tentativa da garantia. As falhas contam por refino alvo e por raridade do item e só zeram quando aquele refino dá certo: voltar de nível ao falhar não zera.`),
        nota(`Estimativa: média, mediana e 90% vêm de ${inteiro(r.n)} simulações com semente fixa (o resultado não muda se você repetir a conta, mas é uma estimativa e não um valor exato). Não conta Gemas de Sorte nem de Proteção, e a qualidade do item não muda o preço da forja.`));
    }
    corpo.replaceChildren(chipsDosItens((x) => { FJ.item = x.id; FJ.de = Math.min(6, x.refino); FJ.ate = Math.min(7, Math.max(FJ.de + 1, FJ.ate)); FJ.falhas = '0'; guardar(); desenhar(); }), form, saida);
    calcular();
    return h('section', { class: 'cartao' }, h('h2', { class: 'rotulo' }, 'Forja do Ornn'), corpo);
  }

  // ================= 3) valor de venda =================
  const VD = { item: lerPref('calc-vd-item', itens.find((i) => i.id === '3031') ? '3031' : itens[0].id), qual: lerPref('calc-vd-qual', 'B'), ref: Number(lerPref('calc-vd-ref', '4')), taxa: lerPref('calc-vd-taxa', '0') };
  let vdTicket = 0;
  function abaVenda() {
    const corpo = h('div', { class: 'calc-corpo' }), saida = h('div', { class: 'calc-corpo' });
    const guardar = () => { gravarPref('calc-vd-item', VD.item); gravarPref('calc-vd-qual', VD.qual); gravarPref('calc-vd-ref', String(VD.ref)); gravarPref('calc-vd-taxa', VD.taxa); };
    const selRef = h('select', { id: 'sel-vref', onchange: () => { VD.ref = +selRef.value; guardar(); desenhar(); } }, [0, 1, 2, 3, 4, 5, 6, 7].map((r) => h('option', { value: r }, `+${r}`)));
    selRef.value = VD.ref;
    const inpTaxa = camposNum({ id: 'in-taxa', value: VD.taxa, 'aria-label': 'Taxa do Mercado em porcentagem' });
    inpTaxa.addEventListener('change', () => { VD.taxa = String(Math.min(50, Math.max(0, Number(inpTaxa.value.replace(',', '.')) || 0))); guardar(); desenhar(); });
    const form = h('div', { class: 'filtros-drops' }, campo('Item', seletorItem(VD.item, (v) => { VD.item = v; guardar(); desenhar(); })),
      h('div', { class: 'filtro' }, 'Qualidade', chips('Qualidade', JOGO.ORDEM_QUAL.map((q) => [q, q]), VD.qual, (v) => { VD.qual = v; guardar(); desenhar(); })), campo('Refino', selRef),
      campo('Taxa do Mercado (%)', inpTaxa));

    const chave = `${VD.item}${VD.ref ? '+' + VD.ref : ''}~${VD.qual}`, loja = JOGO.valorVenda(VD.item, VD.ref, VD.qual);
    const taxa = Number(VD.taxa) || 0, ticket = ++vdTicket;
    saida.replaceChildren(h('p', { class: 'carregando' }, 'Lendo o preço no Mercado…'));
    (async () => {
      let hist = [], erro = null;
      try { hist = await Nuvem.historicoPreco(chave, 30); if (!hist.length) hist = await Nuvem.historicoPreco(chave.replace(/^(\d+)/, '$1!'), 30); } catch (e) { erro = e; }
      if (ticket !== vdTicket) return;
      const vivos = hist.filter((p) => p.ouro != null), ultimo = vivos.at(-1), minimo = vivos.length ? Math.min(...vivos.map((p) => p.ouro)) : null;
      const liquido = ultimo ? Math.round(ultimo.ouro * (1 - taxa / 100)) : null;
      let veredito;
      if (erro) veredito = nota('Não deu para ler o Mercado agora: ' + (erro.message || erro));
      else if (!ultimo) veredito = nota('O Mercado lido pela Lupa não mostrou esta versão (mesmo item, qualidade e refino, sem carta) nos últimos 30 dias, então não há preço para comparar. A loja do jogo sempre paga o valor fixo.');
      else if (liquido > loja) veredito = h('p', { class: 'estimativa-resumo' }, h('b', null, 'Mercado. '), `Vale mais anunciar no Mercado: cerca de ${(liquido / loja).toFixed(1).replace('.', ',')} vezes o que a loja paga${taxa ? `, já descontando ${String(taxa).replace('.', ',')}% de taxa` : ''}.`);
      else veredito = h('p', { class: 'estimativa-resumo' }, h('b', null, 'Loja do jogo. '), 'O menor preço do Mercado, depois da taxa, não passa do que a loja paga: venda direto no Lojista.');
      saida.replaceChildren(
        h('div', { class: 'grade-tiles' },
          tile('Loja do jogo (Lojista)', loja == null ? '—' : precoTxt(loja), 'valor fixo, na hora'),
          tile('Menor preço no Mercado', ultimo ? precoTxt(ultimo.ouro) : '—', ultimo ? `lido em ${dataHora(ultimo.ts)}${ultimo.n ? ` · ${ultimo.n} à venda` : ''}` : 'sem leitura em 30 dias'),
          tile(taxa ? `No Mercado, após ${String(taxa).replace('.', ',')}% de taxa` : 'No Mercado, sem taxa', liquido == null ? '—' : precoTxt(liquido), ultimo ? 'se vender pelo menor preço' : ''),
          tile('Menor preço em 30 dias', minimo == null ? '—' : precoTxt(minimo), vivos.length ? `${vivos.length} leituras` : '')),
        veredito,
        vivos.length >= 2 ? h('div', { class: 'historico' }, h('span', { class: 'rotulo' }, 'Menor preço no Mercado · últimos 30 dias'), sparkline(vivos.map((p) => ({ ts: p.ts, v: p.ouro })), { fmt: precoTxt })) : null,
        nota('Estimativa: a loja paga valorVenda = preço-base × 0,5 × (1 + 0,5 × refino) × o fator da qualidade. O preço do Mercado é o menor anúncio que a Lupa viu (ou seja, o preço pedido, não o de uma venda feita) e pode já ter sido vendido. A taxa de ouro do Mercado vem do servidor do jogo e não consta nos arquivos públicos: digite a que aparece na aba Vender do Mercado.'));
    })();
    corpo.replaceChildren(chipsDosItens((x) => { VD.item = x.id; VD.qual = x.qual; VD.ref = x.refino; guardar(); desenhar(); }), form, saida);
    return h('section', { class: 'cartao' }, h('h2', { class: 'rotulo' }, 'Valor de venda'), corpo);
  }

  // ================= 4) comparar builds =================
  // A = a ficha que a Lupa leu; B = uma cópia editável (guardada no navegador, por personagem). Tudo é estimativa: as contas dos stats batem com
  // o motor do jogo (gerar-tabelas.mjs confere); o farm vem de um modelo calibrado contra a simulação do motor, com o erro medido à mostra.
  const CB = { zona: lerPref('calc-cb-zona', '') };
  const campeaoDe = (n) => {
    const nome = semAcento(LUPA_PLANOS[n]?.campeao || lerPref('comp-camp:' + n, ''));
    return Object.keys(JOGO.CAMPEOES).find((id) => id === nome || semAcento(JOGO.CAMPEOES[id].nome) === nome) || '';
  };
  // a ficha lida pela Lupa vira uma build: itens, atributos, ranks e barra
  function lerBuildA(n) {
    const e = estados[n], f = e?.ficha, nivel = parseInt(e?.nivel, 10) || 0;
    if (!f || !nivel || !(f.equip || []).length) return null;
    const itens = f.equip.map((i) => itemDaChave(i.id)).filter(Boolean);
    if (!itens.length) return null;
    const atrib = {};
    for (const [chave, nome] of ATRIBUTOS) { const x = (f.atributos || []).find((at) => semAcento(at.nome) === semAcento(nome)); atrib[chave] = Math.max(0, Math.floor(numeroDoTexto(x?.valor) || 0)); }
    const ranks = {};
    for (const hb of f.habs || []) { const m = /^(\d+)/.exec(String(hb.rank || '')); if (m) ranks[hb.t] = +m[1]; }
    const barra = (f.barra || []).map((b) => b?.t || '');
    return { nivel, itens, atrib, ranks, barra, habs: f.habs || [], stats: f.stats || {}, mochila: (f.mochila || []).map((i) => ({ ...i, obj: itemDaChave(i.id) })).filter((i) => i.obj), equip: f.equip };
  }
  const copiaBuild = (a) => ({ itens: a.itens.map((i) => ({ ...i })), atrib: { ...a.atrib }, barra: a.barra.slice() });
  function lerB(n, a) {
    try {
      const b = JSON.parse(lerPref('comp-b:' + n, 'null'));
      if (b && Array.isArray(b.itens) && b.atrib && Array.isArray(b.barra)) {
        const itens = b.itens.slice(0, 6).map((i) => ({ id: String(i.id || ''), refino: Math.min(7, Math.max(0, Math.floor(+i.refino || 0))), qual: JOGO.ORDEM_QUAL.includes(i.qual) ? i.qual : 'B', carta: Object.hasOwn(JOGO.CARTA_VALOR, i.carta) ? i.carta : '' }));
        const atrib = Object.fromEntries(ATRIBUTOS.map(([k]) => [k, Math.max(0, Math.floor(+b.atrib[k] || 0))]));
        return { itens, atrib, barra: b.barra.slice(0, 4).map((t) => String(t || '')) };
      }
    } catch {}
    return copiaBuild(a);
  }
  const nomeCarta = (c) => `${CARTA_NOME[c.replace(/[1-3]$/, '')] || c} ${CARTA_RARIDADE[c.slice(-1)] || ''}`.trim();
  const rotuloItem = (o) => `${JOGO.item(o.id)?.nome || o.id} +${o.refino} ${o.qual}${o.carta ? ' · ' + nomeCarta(o.carta) : ''}`;
  // o Arsenal das Lendas vale para a conta toda: entra igual nas duas builds (o último bônus que a Lupa leu na janela da Guardiã)
  const fichaDe = (camp, nivel, b, ranks, bonus) => JOGO.fichaDaBuild({ campeao: camp, nivel, atrib: b.atrib, itens: b.itens.filter((i) => i.id && JOGO.item(i.id)).map((i) => JOGO.chaveItem(i)), ranks, bonus, codex: estados[quem]?.codex?.bonus || undefined });
  // o que o jogo MOSTRA contra o que a conta dá. tol: diferença aceita (em unidades do próprio valor; a ficha arredonda o que mostra)
  function conferirComOJogo(f, st) {
    const lin = [], p = (rot, jogo, calc, tol, fmt) => { if (jogo != null && Number.isFinite(jogo)) lin.push({ rot, jogo, calc, fmt, dif: calc - jogo, ok: Math.abs(calc - jogo) <= tol }); };
    const dano = numeroDoTexto(st.dano), arm = numeroDoTexto(st.armadura), rm = numeroDoTexto(st.resMagica);
    p('Dano', dano, f.ad, Math.max(1, 0.004 * (dano || 0)), (v) => inteiro(v));
    p('Velocidade de ataque', numeroDoTexto(st.velAtaque), f.velAtaque, 0.011, (v) => nBR(v, 2));
    p('Crítico', pctTexto(st.critico), f.critico, 0.0101, (v) => nBR(v * 100, 0) + '%');
    p('Dano crítico', pctTexto(st.danoCritico), f.danoCritico, 0.0101, (v) => nBR(v * 100, 0) + '%');
    p('Armadura', arm, f.armadura, Math.max(1, 0.004 * (arm || 0)), (v) => inteiro(v));
    p('Resistência mágica', rm, f.rm, Math.max(1, 0.004 * (rm || 0)), (v) => inteiro(v));
    p('Redução de recarga', pctTexto(st.recarga), f.reducaoRecarga, 0.0101, (v) => nBR(v * 100, 0) + '%');
    p('Esquiva', pctTexto(st.esquiva), f.esquiva, 0.0101, (v) => nBR(v * 100, 0) + '%');
    return lin;
  }
  function abaComparar() {
    const caixa = h('div', { class: 'calc-corpo' });
    const cartaoBase = () => h('section', { class: 'cartao' }, h('h2', { class: 'rotulo' }, 'Comparar builds'), caixa);
    const a = lerBuildA(quem);
    if (!a) { caixa.replaceChildren(vazio('Ainda não tenho a ficha deste personagem (itens equipados e nível): a Lupa precisa ler o jogo e enviar.')); return cartaoBase(); }
    const camp = campeaoDe(quem);
    if (!camp) {
      const sel = h('select', { id: 'cb-camp', onchange: () => { gravarPref('comp-camp:' + quem, sel.value); desenhar(); } }, h('option', { value: '' }, 'Escolha o campeão'), Object.entries(JOGO.CAMPEOES).map(([id, c]) => h('option', { value: id }, c.nome)));
      caixa.replaceChildren(vazio('Não sei qual é o campeão deste personagem. Escolha para comparar:'), campo('Campeão', sel));
      return cartaoBase();
    }
    const C = JOGO.CAMPEOES[camp], nivel = a.nivel;
    const B = lerB(quem, a);
    while (B.itens.length < Math.max(5, a.itens.length)) B.itens.push({ id: '', refino: 0, qual: 'B', carta: '' });
    // zona: a escolhida, senão a do personagem, senão a ideal para o nível
    const zonaAtual = JOGO.ZONAS.find((z) => z.nome === estados[quem]?.zona) || JOGO.zonaIdeal(nivel);
    const zona = JOGO.ZONA[CB.zona] || zonaAtual;
    const calibrado = JOGO.FARM.kHab?.[camp] != null, liberado = calibrado && JOGO.FARM.liberado?.[camp] !== false, erro = JOGO.meta.erroComparador;
    const eCamp = erro?.porCampeao?.[camp] || null;
    // A pelo que o jogo mostra: se a ficha difere da conta por um bônus que ela não mostra (conquistas, mascote), vira bônus nas duas builds
    const bonus = {};
    let fA = fichaDe(camp, nivel, a, a.ranks, bonus), conf = conferirComOJogo(fA, a.stats);
    let inferido = false;
    for (const [k, rot] of [['ad', 'Dano'], ['armadura', 'Armadura'], ['rm', 'Resistência mágica']]) {
      const x = conf.find((l) => l.rot === rot), r = x && x.calc > 0 ? x.jogo / x.calc : 1;
      if (x && !x.ok && r > 1.004 && r < 1.2) { bonus[k] = +(r - 1).toFixed(4); inferido = true; }
    }
    if (inferido) { fA = fichaDe(camp, nivel, a, a.ranks, bonus); conf = conferirComOJogo(fA, a.stats); }
    const salvar = () => gravarPref('comp-b:' + quem, JSON.stringify(B));
    const fB = fichaDe(camp, nivel, B, a.ranks, bonus);
    const barraB = B.barra.filter(Boolean), barraA = a.barra.filter(Boolean);
    const farmA = liberado ? CALC.estimarFarm(fA, camp, zona, nivel, { build: { ranks: a.ranks, barra: barraA } }) : null;
    // troca de barra: conferido contra o motor (27/10, Yasuo nv 37), o modelo previu +23% de abates/h em trocas que no jogo dão de −2% a 0%.
    // Até o modelo das habilidades ser refeito, a tela não promete farm quando a barra muda (os stats continuam).
    const trocouBarra = barraA.slice().sort().join() !== barraB.slice().sort().join();
    const farmB = liberado && !trocouBarra ? CALC.estimarFarm(fB, camp, zona, nivel, { build: { ranks: a.ranks, barra: barraB } }) : null;

    // ---------- o editor da build B ----------
    const seus = [...a.equip.map((i) => ({ obj: itemDaChave(i.id) })), ...a.mochila].filter((i) => i.obj && JOGO.item(i.obj.id)).filter((i, k, l) => l.findIndex((o) => JOGO.chaveItem(o.obj) === JOGO.chaveItem(i.obj)) === k);
    const mudou = () => { salvar(); desenhar(); };
    const slot = (k) => {
      const it = B.itens[k];
      const selItem = h('select', { id: 'cb-item-' + k, 'aria-label': `Espaço ${k + 1}: item`, onchange: () => {
        const v = selItem.value;
        if (v.startsWith('m:')) { const o = itemDaChave(v.slice(2)); if (o) B.itens[k] = o; } else if (v.startsWith('t:')) it.id = v.slice(2); else it.id = '';
        mudou();
      } },
      h('option', { value: '' }, '(vazio)'),
      seus.length ? h('optgroup', { label: 'Seus itens (equipados e mochila)' }, seus.map((s) => h('option', { value: 'm:' + JOGO.chaveItem(s.obj) }, rotuloItem(s.obj)))) : null,
      ['lendario', 'mitico', 'epico', 'basico'].map((r) => (itens.some((i) => i.raridade === r) ? h('optgroup', { label: NOME_RAR[r] }, itens.filter((i) => i.raridade === r).map((i) => h('option', { value: 't:' + i.id }, i.nome))) : null)));
      selItem.value = it.id && JOGO.item(it.id) ? 't:' + baseDe(it.id) : '';
      const selRef = h('select', { id: 'cb-ref-' + k, 'aria-label': `Espaço ${k + 1}: refino`, onchange: () => { it.refino = +selRef.value; mudou(); } }, [0, 1, 2, 3, 4, 5, 6, 7].map((r) => h('option', { value: r }, `+${r}`)));
      selRef.value = it.refino;
      const selQual = h('select', { id: 'cb-qual-' + k, 'aria-label': `Espaço ${k + 1}: qualidade`, onchange: () => { it.qual = selQual.value; mudou(); } }, JOGO.ORDEM_QUAL.map((q) => h('option', { value: q }, q)));
      selQual.value = it.qual;
      const selCarta = h('select', { id: 'cb-carta-' + k, 'aria-label': `Espaço ${k + 1}: carta`, onchange: () => { it.carta = selCarta.value; mudou(); } }, h('option', { value: '' }, 'Sem carta'),
        JOGO.CARTA_TIPOS.map((t) => h('optgroup', { label: CARTA_NOME[t] || t }, [1, 2, 3].map((n) => h('option', { value: t + n }, `${CARTA_NOME[t] || t} ${CARTA_RARIDADE[n]}`)))));
      selCarta.value = it.carta;
      const dif = JOGO.chaveItem(it) !== JOGO.chaveItem(a.itens[k] || { id: '' });
      return h('div', { class: 'comp-slot' + (dif ? ' mudou' : '') }, campo(`Espaço ${k + 1}`, selItem), campo('Refino', selRef), campo('Qualidade', selQual), campo('Carta', selCarta));
    };
    const totalA = Object.values(a.atrib).reduce((s, v) => s + v, 0), totalB = Object.values(B.atrib).reduce((s, v) => s + v, 0);
    const inputsAtrib = ATRIBUTOS.map(([k, nome]) => {
      const inp = camposNum({ id: 'cb-at-' + k, value: String(B.atrib[k]), 'aria-label': `${nome} (A: ${a.atrib[k]})` });
      inp.addEventListener('change', () => { B.atrib[k] = Math.max(0, Math.floor(numeroDoTexto(inp.value) || 0)); mudou(); });
      return campo(`${nome} (A: ${a.atrib[k]})`, inp);
    });
    const aprendidas = a.habs.filter((x) => !x.passiva && /^[1-9]/.test(String(x.rank || '')));
    const selBarra = (k) => {
      const sel = h('select', { id: 'cb-barra-' + k, 'aria-label': `Espaço ${k + 1} da barra de habilidades`, onchange: () => { B.barra[k] = sel.value; mudou(); } }, h('option', { value: '' }, '(vazio)'),
        aprendidas.map((x) => h('option', { value: x.t }, `${x.t} · ${x.nome} ${String(x.rank).split('/')[0]}`)));
      sel.value = B.barra[k] || '';
      return campo(`Espaço ${k + 1}`, sel);
    };
    while (B.barra.length < 4) B.barra.push('');
    const selZona = h('select', { id: 'cb-zona', 'aria-label': 'Zona de caça', onchange: () => { CB.zona = selZona.value; gravarPref('calc-cb-zona', CB.zona); desenhar(); } }, JOGO.ZONAS.map((z) => h('option', { value: z.id }, `${z.nome} (monstros ${z.nm[0]} a ${z.nm[1]})`)));
    selZona.value = zona.id;
    const btnVoltar = h('button', { type: 'button', id: 'cb-voltar', class: 'botao', onclick: () => { gravarPref('comp-b:' + quem, ''); desenhar(); } }, 'Voltar para a build atual');

    // ---------- a conferência com o jogo ----------
    const ruins = conf.filter((l) => !l.ok);
    const NOME_BONUS = { ad: 'dano', armadura: 'armadura', rm: 'resistência mágica' };
    const confere = !conf.length ? nota('A ficha lida não trouxe os stats do jogo, então não dá para conferir a conta.')
      : ruins.length ? h('div', { class: 'comp-confere diverge' }, h('p', null, h('b', null, 'Difere do jogo. '), ruins.map((l) => `${l.rot}: o jogo mostra ${l.fmt(l.jogo)} e a conta dá ${l.fmt(l.calc)}.`).join(' ')),
        nota('Pode ser um bônus passageiro (Fúria, buff de guilda), um item ou carta lidos pela metade ou uma regra nova do jogo (rode gerar-tabelas.mjs). A comparação segue com a conta, que é a mesma nas duas builds.'))
        : inferido ? h('p', { class: 'comp-confere ok' }, h('b', null, 'Ajustado ao jogo. '), `A conta da build A bate com os ${conf.length - Object.keys(bonus).length} stats conferidos sem ajuste. Já ${Object.entries(bonus).map(([k, v]) => `${sinal(v * 100, 1)}% de ${NOME_BONUS[k]}`).join(' e ')} a conta não explica (pode ser conquista, mascote ou um bônus passageiro): esse bônus entrou igual nas duas builds, então a comparação não muda.`)
        : h('p', { class: 'comp-confere ok' }, h('b', null, 'Confere com o jogo. '), `A conta da build A bate com os ${conf.length} stats que o jogo mostra.`);

    // ---------- o resultado ----------
    const L = [
      ['Dano de ataque', 'ad', (v) => inteiro(v)],
      ['Poder de habilidade', 'ap', (v) => inteiro(v)],
      ['Velocidade de ataque (ficha)', 'velAtaque', (v) => nBR(v, 2)],
      ['Ataques por segundo (relógio do jogo)', 'velEfetiva', (v) => nBR(v, 2)],
      ['Crítico', 'critico', (v) => nBR(v * 100, 0) + '%', 'pp'],
      ['Dano crítico', 'danoCritico', (v) => '×' + nBR(v, 2)],
      ['Vida', 'vida', (v) => inteiro(v)],
      ['Armadura', 'armadura', (v) => inteiro(v)],
      ['Resistência mágica', 'rm', (v) => inteiro(v)],
      ['Roubo de vida', 'rouboVida', (v) => nBR(v * 100, 1) + '%', 'pp'],
      ['Vampirismo universal', 'vampirismo', (v) => nBR(v * 100, 1) + '%', 'pp'],
      ['Redução de recarga', 'reducaoRecarga', (v) => nBR(v * 100, 0) + '%', 'pp'],
      ['Esquiva', 'esquiva', (v) => nBR(v * 100, 0) + '%', 'pp'],
      ['Regeneração de vida por segundo', 'regen', (v) => nBR(v, 1)],
    ].filter(([, k]) => fA[k] || fB[k]);
    const linhas = L.map(([rot, k, fmt, tipo]) => ({ celulas: [rot, fmt(fA[k]), fmt(fB[k]), difSpan(difTexto(fA[k], fB[k], tipo || 'rel'))] }));
    const tabelaStats = tabela([{ t: 'Stat' }, { t: 'A (atual)', num: true }, { t: 'B (editada)', num: true }, { t: 'B contra A', num: true }], linhas, 'Stats das builds A e B');
    // avisos que explicam o que a conta fez (degrau do DT, teto do crítico)
    const avisos = [];
    if (Math.abs(fB.velAtaque - fA.velAtaque) > 0.004 && fB.periodoAtaque === fA.periodoAtaque) avisos.push(`A velocidade de ataque da ficha mudou (${nBR(fA.velAtaque, 2)} para ${nBR(fB.velAtaque, 2)}), mas o jogo anda em passos de 0,05 s e o ataque continua saindo a cada ${nBR(fA.periodoAtaque, 2)} s: nessa troca a velocidade não rende nada.`);
    else if (fB.periodoAtaque !== fA.periodoAtaque) avisos.push(`O ataque passa de um a cada ${nBR(fA.periodoAtaque, 2)} s para um a cada ${nBR(fB.periodoAtaque, 2)} s (o relógio do jogo anda em passos de 0,05 s, por isso a velocidade rende em degraus).`);
    if (fB.criticoBruto > 1.0001 && fB.critico >= 1 && Math.abs(fB.criticoBruto - fA.criticoBruto) > 1e-9) avisos.push(`O crítico da build B soma ${nBR(fB.criticoBruto * 100, 0)}%, mas o teto é 100%: o que passa disso não rende.`);
    const barraMudou = barraA.slice().sort().join() !== barraB.slice().sort().join();

    let resultado, frase = '', erroTxt = '';
    if (farmA && farmB) {
      const dAb = difTexto(farmA.abatesH, farmB.abatesH);
      const tl = (tit, vA, vB, fmt, melhor = 1) => h('div', { class: 'stat grande' }, h('span', { class: 'rot' }, tit), h('span', { class: 'val' }, fmt(vB)), h('span', { class: 'st-sub' }, `A: ${fmt(vA)} · `, difSpan(difTexto(vA, vB, 'rel', melhor))));
      const arred = Math.abs(dAb.p) >= 2 ? sinal(Math.round(dAb.p), 0) + '%' : dAb.txt;
      frase = Math.abs(dAb.p) < 0.5 ? `A build B rende praticamente o mesmo de abates/h que a A na zona ${zona.nome}.` : `A build B rende cerca de ${arred} de abates/h na zona ${zona.nome}.`;
      erroTxt = eCamp ? ` Estimativa: o comparador erra até ±${nBR(Math.max(1, Math.ceil(eCamp.p90)), 0)} pontos contra a simulação do jogo na maioria das trocas (mediana ±${nBR(eCamp.mediana, 1)}; no pior caso medido, ±${nBR(Math.ceil(eCamp.max), 0)}).` : ' Estimativa.';
      const fx = eCamp?.faixa, fora = fx && (nivel < fx.niveis[0] || nivel > fx.niveis[1] || (fx.zonas && !fx.zonas.includes(zona.id)));
      if (fora) erroTxt += ` Atenção: esse erro foi medido do nível ${fx.niveis[0]} ao ${fx.niveis[1]} e em outras zonas; aqui ele pode ser maior.`;
      const nTrocas = B.itens.filter((it, k) => JOGO.chaveItem(it) !== JOGO.chaveItem(a.itens[k] || { id: '' })).length
        + (JSON.stringify(B.atrib) !== JSON.stringify(a.atrib) ? 1 : 0) + (barraB.join() !== barraA.join() ? 1 : 0);
      if (nTrocas > 1) erroTxt += ' O erro foi medido com uma troca por vez; várias trocas juntas somam incerteza.';
      resultado = h('div', { class: 'calc-corpo' },
        h('div', { class: 'grade-tiles' },
          tl('Dano por segundo', farmA.dps, farmB.dps, curto),
          tl('Tempo por abate', farmA.tAbate, farmB.tAbate, (v) => nBR(v, 2) + ' s', -1),
          tl('Abates por hora', farmA.abatesH, farmB.abatesH, (v) => inteiro(v)),
          tl('XP por hora', farmA.xpH, farmB.xpH, curto),
          tl('Ouro por hora', farmA.ouroH, farmB.ouroH, curto)),
        barraMudou ? nota(`A barra de habilidades mudou: o modelo conta o dano e a velocidade das habilidades de forma aproximada${eCamp?.barra ? `; nesse tipo de troca ele errou até ±${nBR(eCamp.barra.max, 0)} pontos na medição` : ''}.`) : null);
    } else {
      resultado = h('div', { class: 'calc-corpo' }, nota(trocouBarra && liberado ? 'Com a barra trocada, o comparador ainda não estima o farm: conferido contra a simulação do jogo, ele errou feio nessas trocas (previu +23% onde o jogo dá entre −2% e 0%). Para comparar barras, teste no jogo: 20 a 30 min com cada uma, usando Nova sessão na aba Caçada da Lupa.' : !calibrado ? `Ainda não calibrei o modelo de farm para ${C.nome}: aqui só os stats.` : `O modelo de farm de ${C.nome} errou ${nBR(eCamp?.mediana ?? 0, 1)} pontos de mediana contra a simulação do jogo (mais do que aceito), então mostro só os stats e não prometo abates por hora.`));
    }

    caixa.replaceChildren(
      confere,
      h('div', { class: 'filtros-drops' }, campo('Zona de caça', selZona), h('div', { class: 'filtro' }, h('span', null, 'Build B'), btnVoltar)),
      frase ? h('p', { class: 'estimativa-resumo comp-resposta', role: 'status' }, h('b', null, 'Resposta. '), frase, h('span', { class: 'fraco' }, erroTxt)) : null,
      h('div', { class: 'comp-grade' },
        h('div', { class: 'calc-corpo comp-edit' },
          h('h3', { class: 'sub-cab' }, 'Edite a build B'),
          h('div', { class: 'comp-slots' }, B.itens.map((_, k) => slot(k))),
          h('div', { class: 'comp-atrib' }, inputsAtrib),
          nota(totalB === totalA ? `Pontos de atributo: ${totalB}, o mesmo total da build A.` : totalB > totalA ? `Pontos de atributo: ${totalB} de ${totalA}. A build B gastou ${totalB - totalA} a mais do que existem: tire de algum atributo.` : `Pontos de atributo: ${totalB} de ${totalA}. Sobram ${totalA - totalB} pontos livres na build B.`),
          liberado ? h('div', { class: 'calc-corpo' }, h('h3', { class: 'sub-cab' }, 'Habilidades da barra (B)'), h('div', { class: 'filtros-drops' }, [0, 1, 2, 3].map(selBarra))) : null),
        h('div', { class: 'calc-corpo comp-res' },
          h('h3', { class: 'sub-cab' }, 'Resultado'),
          resultado,
          tabelaStats,
          ...avisos.map((t) => nota(t)))),
      nota(`Estimativa. Os stats são as contas do próprio jogo, feitas com as tabelas públicas; a conferência acima mostra se bateram com a sua ficha. O farm é um modelo: conta o auto-ataque no relógio do jogo, o crítico contra monstros, a vida e a armadura dos monstros de ${zona.nome}, os itens que batem em área e as habilidades da barra de forma aproximada. Não conta mortes, poções, chefes, noite, monstro furioso nem mascote. XP e ouro são os da tabela, sem bônus de evento, live ou VIP.`));
    return cartaoBase();
  }

  // ================= 5) onde gastar o ouro =================
  // a conta é do app de PC (simula cada compra no motor do jogo, em casa) e chega dentro do estado que ele manda; aqui só desenha
  function abaGastar() {
    const e = estados[quem];
    if (!e) return cartao('Onde gastar o ouro', vazio('Ainda não tenho este personagem: a Lupa precisa enviar o personagem primeiro.'));
    return cartaoGastar(e, { gastos: e.gastar ? { [quem]: e.gastar } : {}, redesenhar: desenhar }, { completo: true });
  }
  // ================= 6) pontos e barra (também do app, na mesma rodada) =================
  function abaTreino() {
    const e = estados[quem];
    if (!e) return cartao('Pontos e barra', vazio('Ainda não tenho este personagem: a Lupa precisa enviar o personagem primeiro.'));
    return cartaoTreino(e, { treinos: e.treino ? { [quem]: e.treino } : {}, redesenhar: desenhar }, { completo: true });
  }

  // ================= página =================
  const ABAS = [['nivel', 'Tempo até o nível'], ['gastar', 'Onde gastar o ouro'], ['treino', 'Pontos e barra'], ['forja', 'Forja do Ornn'], ['venda', 'Valor de venda'], ['comparar', 'Comparar builds']];
  // quem estava com o foco: o id, ou o botão de um grupo de chips pelo texto (os chips não têm id)
  const chaveFoco = (el) => !el || el === document.body ? null : el.id ? { id: el.id } : el.closest('[role=group]') ? { grupo: el.closest('[role=group]').getAttribute('aria-label'), texto: el.textContent } : null;
  function devolverFoco(k) {
    if (!k) return;
    const el = k.id ? $id(k.id) : [...document.querySelectorAll(`[role=group][aria-label="${CSS.escape(k.grupo)}"] button`)].find((b) => b.textContent === k.texto);
    if (!el) return;
    el.focus();
    if (el.tagName === 'INPUT') try { el.setSelectionRange(el.value.length, el.value.length); } catch {}
  }
  let espera = 0;
  const desenhar = () => { clearTimeout(espera); espera = setTimeout(desenharJa, 0); };      // depois do evento: o Tab já moveu o foco
  function desenharJa() {
    const ativo = chaveFoco(document.activeElement);
    const cab = h('div', { class: 'pagina-cab' },
      h('h1', null, 'Calculadoras', h('small', null, 'Estimativas com as tabelas públicas do jogo. O site só calcula: não mexe no jogo.')),
      chips('Calculadora', ABAS, aba, (v) => { aba = v; gravarPref('calc-aba', v); desenhar(); }),
      nomes.length > 1 ? chips('Personagem', nomes.map((n) => [n, nomeCurto(n)]), quem, (v) => { quem = v; gravarPref('calc-quem', v); desenhar(); }) : null);
    raiz.replaceChildren(cab, aba === 'forja' ? abaForja() : aba === 'venda' ? abaVenda() : aba === 'comparar' ? abaComparar() : aba === 'gastar' ? abaGastar() : aba === 'treino' ? abaTreino() : abaNivel(), rodape());
    raiz.removeAttribute('aria-busy');
    devolverFoco(ativo);
  }
  desenharJa();
  let tam = raiz.clientWidth;
  window.addEventListener('resize', () => { if (Math.abs(raiz.clientWidth - tam) > 40) { tam = raiz.clientWidth; if (aba === 'nivel') desenhar(); } });
})();
