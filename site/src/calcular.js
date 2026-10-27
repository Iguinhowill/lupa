// Lupa Online · Calcular: três calculadoras com as tabelas PÚBLICAS do jogo (dados-jogo.js): tempo até o nível, forja do Ornn
// e valor de venda. Tudo aqui é ESTIMATIVA: o site só calcula, não interage com o jogo.
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
    for (const it of [...(f?.equip || []), ...(f?.mochila || [])]) {
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

  // ================= página =================
  const ABAS = [['nivel', 'Tempo até o nível'], ['forja', 'Forja do Ornn'], ['venda', 'Valor de venda']];
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
    raiz.replaceChildren(cab, aba === 'forja' ? abaForja() : aba === 'venda' ? abaVenda() : abaNivel(), rodape());
    raiz.removeAttribute('aria-busy');
    devolverFoco(ativo);
  }
  desenharJa();
  let tam = raiz.clientWidth;
  window.addEventListener('resize', () => { if (Math.abs(raiz.clientWidth - tam) > 40) { tam = raiz.clientWidth; if (aba === 'nivel') desenhar(); } });
})();
