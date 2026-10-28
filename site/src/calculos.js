// Lupa Online · contas das calculadoras (sem DOM, para testar no Node): Monte Carlo da forja do Ornn, XP/h medido e horas até um nível.
// Usa as tabelas de dados-jogo.js (global JOGO no navegador). Tudo o que sai daqui é ESTIMATIVA.
'use strict';

const CALC = (() => {
  const J = typeof JOGO !== 'undefined' ? JOGO : require('./dados-jogo.js');
  const HORA_MS = 3600e3;
  const mulberry32 = (a) => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const percentil = (ord, p) => ord[Math.min(ord.length - 1, Math.max(0, Math.ceil(p * ord.length) - 1))];      // posto mais próximo

  // chance da tentativa por (refino atual, falhas seguidas): uma tabela por refino, feita uma vez
  const tabChance = new Map();
  function chanceTab(ref, vip) {
    const k = ref + (vip ? 'v' : 'n');
    if (!tabChance.has(k)) {
      const regra = J.PERSISTENCIA[ref + 1], n = (regra?.max || 50) + 1;
      tabChance.set(k, Float64Array.from({ length: n }, (_, f) => J.chanceForja(ref, f, vip)));
    }
    return tabChance.get(k);
  }
  // Monte Carlo com semente fixa: forja do refino "de" até "ate". As falhas contam por refino alvo (+1..+7) e só zeram quando aquele
  // alvo dá certo (voltar de nível ao falhar não zera); falhas0 = falhas já acumuladas no primeiro alvo.
  // a mesma conta (semente fixa) dá sempre o mesmo resultado: guarda as últimas para não refazer a cada redesenho
  const memoForja = new Map();
  function simularForja(opts) {
    const k = JSON.stringify(opts);
    if (!memoForja.has(k)) { if (memoForja.size > 40) memoForja.delete(memoForja.keys().next().value); memoForja.set(k, simularForjaJa(opts)); }
    return memoForja.get(k);
  }
  function simularForjaJa({ id, de, ate, vip, falhas0 = 0, n = 2000, semente = 20261026 }) {
    const rnd = mulberry32(semente), preco = Array.from({ length: 8 }, (_, r) => (r < 7 ? J.precoRefino(id, r) : 0));
    const tab = Array.from({ length: 7 }, (_, r) => chanceTab(r, vip));
    const tent = new Float64Array(n), custo = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const falhas = new Int32Array(9);
      falhas[de + 1] = falhas0;
      let ref = de, t = 0, c = 0;
      while (ref < ate && t < 5e6) {
        const f = falhas[ref + 1], tb = tab[ref], p = tb[Math.min(f, tb.length - 1)];
        t++; c += preco[ref];
        if (rnd() < p) { ref++; falhas[ref] = 0; }
        else { falhas[ref + 1]++; if (rnd() < J.REGRESSAO_REFINO[ref]) ref--; }
      }
      tent[i] = t; custo[i] = c;
    }
    const media = (v) => v.reduce((a, b) => a + b, 0) / n, ot = Float64Array.from(tent).sort(), oc = Float64Array.from(custo).sort();
    return { n, tent: { media: media(tent), p50: percentil(ot, 0.5), p90: percentil(ot, 0.9) }, custo: { media: media(custo), p50: percentil(oc, 0.5), p90: percentil(oc, 0.9) } };
  }

  // XP/h medido pelas sessões (tempo caçando), numa janela em ms; a sessão cortada pela janela entra proporcional
  function xpHoraSessoes(sessoes, janela, agora = Date.now()) {
    let xp = 0, seg = 0;
    for (const x of sessoes || []) {
      const a = Math.max(x.ini, agora - janela), b = Math.min(x.fim, agora);
      if (b <= a) continue;
      const f = x.fim > x.ini ? (b - a) / (x.fim - x.ini) : 1;
      xp += x.xp * f; seg += x.seg * f;
    }
    return seg >= 60 ? (xp / seg) * 3600 : null;
  }
  // última hora: pelos baldes de 5 min (só existem enquanto caça)
  function xpHoraBaldes(sessoes, agora = Date.now()) {
    let xp = 0, n = 0;
    for (const x of sessoes || []) for (const b of x.baldes || []) if (b.t >= agora - HORA_MS && b.t <= agora) { xp += b.xp || 0; n++; }
    return n >= 3 ? xp / ((n * 300) / 3600) : null;
  }
  // horas de caça para sair do nível "de" (faltando "falta" de XP) até "ate"; com perda, o XP/h cai pelo fatorXp se ficar numa zona
  // de monstros de nível nm (xpH foi medido no nível "de")
  function horasAte(de, ate, falta, xpH, nm, comPerda) {
    const f0 = J.fatorXp(de, nm);
    let h = 0;
    for (let n = de; n < ate; n++) {
      const xp = n === de ? falta : J.xpParaNivel(n), ritmo = xpH * (comPerda ? J.fatorXp(n, nm) / f0 : 1);
      h += xp / ritmo;
    }
    return h;
  }
  // ---------- farm: modelo analítico (ESTIMATIVA) ----------
  // Um grupo de monstros (2 a 4, em média 3) leva: 1,5 s para nascer + a espera da chegada (corpo a corpo) + a luta, que é simulada ataque a
  // ataque com o dano ESPERADO de cada golpe: armadura, papel do campeão, crítico (x critMonstro), queda do dano contra monstro acima do seu nível
  // e os efeitos dos itens que batem em área, no período do relógio do ataque (degrau do DT, sem a sobra). As habilidades da barra entram como
  // dano por segundo (dano base + escala x dano, pela recarga) e como bônus de velocidade, multiplicados por fatores que o gerador calibra contra a
  // simulação do motor (FARM). Não conta: morte, poção, chefes, noite, monstro furioso e mascote.
  const RESPAWN = 1.5, CHEGADA = 1.2;
  // monstros nascem no nível do jogador de -2 a +1, presos na faixa da zona: médias de vida, armadura, XP e ouro
  function monstrosDaZona(z, nivel) {
    const niveis = [-2, -1, 0, 1].map((d) => Math.max(z.nm[0], Math.min(z.nm[1], nivel + d))), tot = z.monstros.reduce((s, [, p]) => s + p, 0);
    const m = { hp: 0, ar: 0, fdj: 0, nivel: 0, xp: 0, ouro: 0 };
    for (const [nome, p] of z.monstros) for (const L of niveis) {
      const w = p / tot / niveis.length, mo = J.MONSTROS[nome], f = J.fatorXp(nivel, L);
      m.hp += w * J.CURVA.hp(L) * mo.hp; m.ar += w * J.ARMADURA_MONSTRO(L) * mo.ar; m.fdj += w * J.fatorDanoJogador(nivel, L); m.nivel += w * L;
      m.xp += w * J.CURVA.xp(L) * mo.xp * f; m.ouro += w * J.CURVA.ouro(L) * mo.ouro * 0.75 * f;      // o ouro de cada abate é de 50% a 100% da tabela
    }
    return m;
  }
  // o que a barra de habilidades rende, com os ranks: dano bruto por segundo, lançamentos por segundo, bônus de velocidade de ataque e se há avanço
  // (a Espada Ágil e o Disparo trazem o monstro na hora). build = { ranks: { Q: 5, ... }, barra: ["Q", "E", ...] }
  function habilidades(ficha, campeao, build) {
    const H = J.HABS[campeao], C = J.CAMPEOES[campeao];
    if (!H || !build) return { dano: 0, casts: 0, buffs: [], dash: false };
    const ranks = build.ranks || {}, barra = (build.barra || []).filter(Boolean).map((t) => (typeof t === 'string' ? t : t.t)), rcd = ficha.reducaoRecarga;
    const r = { dano: 0, casts: 0, buffs: [], dash: false };
    for (const t of barra) {
      const h = H[t], rk = Math.floor(Number(ranks[t]) || 0);
      if (!h || rk < 1 || !h.recarga) continue;
      let cd = h.recarga[Math.min(rk, h.recarga.length) - 1] * (1 - rcd);
      if (campeao === 'yasuo' && t === 'Q') cd = Math.max(h.minima, h.recarga[rk - 1] / Math.max(1, ficha.velAtaque / C.stats.attackspeed));      // a Tempestade de Aço volta mais rápido com velocidade de ataque
      cd = Math.max(0.2, cd);
      if (h.base && h.ratio) r.dano += ((h.base[rk - 1] + h.ratio[rk - 1] * ficha.ad) * (h.golpes || 1) * (h.alvos || 1)) / cd;
      r.casts += 1 / cd;
      if (h.va) r.buffs.push({ t, va: h.va[rk - 1], U: Math.min(1, (h.duracao || h.dura || 0) / cd) });      // bônus de velocidade de ataque, durante U do tempo
      if (campeao === 'yasuo' && t === 'E') r.dash = true;
    }
    const rD = Math.floor(Number(ranks.D) || 0);
    if (campeao === 'yasuo' && rD && H.D?.inquieta) r.buffs.push({ t: 'D', va: H.D.acumMax * H.D.inquieta[rD - 1], U: Math.min(1, ficha.critico * 4) });      // Lâmina Inquieta: cada crítico dá velocidade, até 5 acúmulos
    return r;
  }
  const LAMINA = { 3078: 2, 3057: 1 };      // depois de uma habilidade, o próximo ataque causa +N x o dano de ataque base (Trindade 2, Fulgor 1)
  function estimarFarm(ficha, campeao, zona, nivel, opts = {}) {
    const C = J.CAMPEOES[campeao], z = typeof zona === 'string' ? J.ZONA[zona] : zona;
    if (!C || !z || !ficha) return null;
    const P = opts.farm || J.FARM, calibrado = P.kHab?.[campeao] != null, k = P.kHab?.[campeao] || 0;
    const hb = opts.hab || habilidades(ficha, campeao, opts.build);
    // o bônus de velocidade dura só uma parte do tempo (Respiração do Vento, Fase, Lâmina Inquieta): como o relógio anda em degraus, não dá para
    // somar a média; faz-se a média dos ataques por segundo de cada combinação de bônus ligados e desligados
    const buffs = hb.buffs.map((b) => ({ va: b.va, U: Math.min(1, b.U * (P.upt?.[campeao]?.[b.t] ?? 1)) }));
    let taxa = 0;
    for (let mask = 0; mask < 1 << buffs.length; mask++) {
      let p = 1, va = 0;
      buffs.forEach((b, i) => { if (mask >> i & 1) { p *= b.U; va += b.va; } else p *= 1 - b.U; });
      if (p > 0) taxa += p / J.periodoAtaque(ficha.velAtaque, ficha.aceleracao + va);
    }
    const per = 1 / taxa;
    const m = monstrosDaZona(z, nivel), tem = ficha.tem, longe = C.distancia, papel = C.papel.dano, kAuto = P.auto?.[campeao] ?? 1, aoe = P.aoe?.[campeao] ?? 0;
    const fcrit = 1 + Math.min(1, ficha.critico) * (ficha.danoCritico * C.critMonstro - 1), cap = J.TETO_VIDA_ITEM * J.CURVA.hp(m.nivel);
    const reduz = 1 - ficha.penArmadura, hab = k * hb.dano * fcrit * papel * m.fdj;      // dano de habilidade por segundo, num alvo sem armadura
    const lamina = Math.max(...Object.keys(LAMINA).map((id) => (tem(id) ? LAMINA[id] : 0))) * ficha.baseAd * Math.min(1, hb.casts * (P.castEf?.[campeao] ?? 1) * per);      // Lâmina Encantada
    // a luta de um grupo de n monstros iguais ao médio: quantos ataques até todos caírem
    const t3153 = tem('3153'), t3742 = tem('3742'), t6610 = tem('6610'), t3071 = tem('3071'), t3085 = tem('3085');
    const area = (tem('3074') ? 0.4 * ficha.ad : 0) + (tem('3748') ? 0.015 * ficha.vida : 0) + (tem('6631') ? 0.8 * ficha.ad * Math.min(1, per / 5) : 0);      // Hidra Raivosa, Hidra Titânica, Quebrapassos
    const golpeBase = ficha.ad + lamina + (t3742 ? 40 * Math.min(1, per / 4) : 0), dm = papel * m.fdj, critPrimeiro = ficha.danoCritico * C.critMonstro;
    const mit0 = 100 / (100 + m.ar * reduz), outroArea = (area * papel * m.fdj + hab * aoe * per) * mit0, runaan = t3085 ? (longe ? 0.15 : 0.55) * ficha.ad * (longe ? 1 : fcrit) * dm * mit0 : 0;
    const luta = (n) => {
      const hp = new Array(n).fill(m.hp), red = new Array(n).fill(0), tocado = new Array(n).fill(false);
      let ataques = 0, i = 0;
      while (ataques < 20000) {
        while (i < n && hp[i] <= 0) i++;
        if (i >= n) break;
        ataques++;
        let bruto = golpeBase;
        if (t3153) bruto += 0.05 * Math.min(hp[i], cap);      // Rei Destruído: 5% da vida atual
        const fc = t6610 && !tocado[i] ? critPrimeiro : fcrit;      // Céu Dividido: o 1º golpe em cada inimigo é crítico
        tocado[i] = true;
        hp[i] -= (bruto * fc * kAuto * dm + hab * per) * (t3071 ? 100 / (100 + m.ar * (1 - red[i]) * reduz) : mit0);
        if (t3071) red[i] = Math.min(0.3, red[i] + 0.06);      // Cutelo Negro: -6% de armadura por golpe, até 30%
        let outros = 0;
        for (let j = 0; j < n; j++) if (j !== i && hp[j] > 0) {
          hp[j] -= t3071 ? (area * dm + hab * aoe * per) * 100 / (100 + m.ar * (1 - red[j]) * reduz) : outroArea;
          if (t3085 && outros++ < 2) hp[j] -= runaan;      // Furacão de Runaan: 2 alvos
        }
      }
      return ataques;
    };
    const nMedio = 3, tLuta = [2, 3, 4].reduce((s, n) => s + (luta(n) - 1) * per, 0) / 3;
    const espera = longe ? 0 : hb.dash ? (P.dash?.[campeao] ?? 0.2) : CHEGADA;
    const kite = longe && C.kite ? (P.kiteGrupo?.[campeao] ?? 1.75) * C.kite.pausa : 0,      // quem ataca de longe recua ~1,75 vezes por grupo e perde a pausa do recuo
       tGrupo = RESPAWN + espera + kite + tLuta, abatesH = (3600 * nMedio) / tGrupo;
    return { calibrado, tAbate: tGrupo / nMedio, tLuta, periodoAtaque: per, velEfetiva: 1 / per, abatesH, xpH: abatesH * m.xp, ouroH: abatesH * m.ouro, dps: (nMedio * m.hp) / tLuta, vidaMonstro: m.hp, nivelMonstro: m.nivel, xpAbate: m.xp, ouroAbate: m.ouro, hab: hb };
  }
  // ---------- Arsenal das Lendas ----------
  // Regras em dados-jogo.js (conferidas contra o codex.js do jogo). O que a Lupa lê da janela da Guardiã (estado.codex): por item,
  // as estrelas (k), a barra até a próxima (pct, arredondada) e, do item que estava escolhido, os pontos exatos dentro da estrela (de).
  const rd2 = (v) => Math.round(v * 100) / 100;
  // progresso { id: pontos }: estrelas exatas; dentro da estrela, os pontos exatos ou a barra, sem nunca chegar à próxima estrela
  function progressoCodex(cx) {
    const prog = {}, aprox = new Set();
    for (const [id, x] of Object.entries(cx?.itens || {})) {
      const pg = J.paginaCodex(id), k = Number(x?.k);
      if (!pg || !Number.isInteger(k) || k < 0) continue;
      if (k >= 10) { prog[id] = J.maxPontosCodex(pg); continue; }
      // o exato só vale se o "de N" lido for o tamanho desta estrela (o detalhe pode ainda ser o do item anterior)
      const faixa = J.CODEX.paginas[pg].pontos[k], exato = Number.isFinite(x.de) && x.ate === faixa;
      const de = exato ? x.de : ((Number(x.pct) || 0) / 100) * faixa;
      if (!exato && x.pct > 0) aprox.add(id);
      prog[id] = rd2(J.pontosAteEstrela(pg, k) + Math.max(0, Math.min(faixa - 0.01, de)));
    }
    return { prog, aprox };
  }
  // a leitura de cada página está completa? soma das estrelas lidas contra o total que a aba do jogo mostra (★ n/max)
  function leituraCodex(cx) {
    const out = {};
    for (const pg of Object.keys(J.CODEX.paginas)) {
      const ids = Object.values(J.CODEX.itens[pg]).flat(), vistos = ids.filter((id) => cx?.itens?.[id]);
      const lidas = vistos.reduce((s, id) => s + Math.min(10, Number(cx.itens[id].k) || 0), 0), total = cx?.totais?.[pg]?.n;
      out[pg] = { itens: ids.length, vistos: vistos.length, lidas, total: Number.isFinite(total) ? total : null, ok: Number.isFinite(total) && lidas === total, em: cx?.paginas?.[pg]?.em || null };
    }
    return out;
  }
  // bônus "contínuo" de um item com p pontos: as estrelas cheias mais a fração da próxima (para comparar cópias que não fecham estrela)
  function bonusContinuo(pg, p) {
    const k = J.estrelasCodex(pg, p), b = J.bonusEstrelas(pg, k);
    if (k >= 10) return b;
    return b + ((p - J.pontosAteEstrela(pg, k)) / J.CODEX.paginas[pg].pontos[k]) * J.CODEX.paginas[pg].bonus[k];
  }
  // UM registro de uma cópia num item com p pontos. Igual ao servidor: item cheio pula a cópia; o que passa do máximo se perde; os
  // pontos ficam arredondados em 2 casas a cada registro (registrarCodex do jogo)
  function passoCodex(pg, p, chave) {
    const pts = J.pontosCopia(chave), max = J.maxPontosCodex(pg);
    if (p >= max - 1e-9) return { chave, pts, pulada: true, de: p, para: p, taxa: 0, kDe: 10, kPara: 10, perdidos: pts };
    const para = Math.min(max, rd2(p + pts));
    return { chave, pts, de: p, para, taxa: J.custoCodex(pg, p), kDe: J.estrelasCodex(pg, p), kPara: J.estrelasCodex(pg, para), perdidos: rd2(p + pts - para) };
  }
  const porPontos = (chaves) => [...chaves].sort((a, b) => J.pontosCopia(a) - J.pontosCopia(b));
  // registra as cópias (chaves do jogo) de UM item, da que vale menos para a que vale mais: a taxa vai pela estrela em que o item
  // está, então a cópia grande por último sai mais barato
  function registrarCopias(id, p0, chaves) {
    const pg = J.paginaCodex(id), passos = [];
    let p = p0 || 0, taxa = 0;
    for (const chave of porPontos(chaves)) { const s = passoCodex(pg, p, chave); passos.push(s); taxa += s.taxa; p = s.para; }
    return { passos, taxa, p };
  }
  // o próximo patamar de cada coleção, repartido pelos pontos que faltam para ele: cada ponto que leva um item atrasado até a estrela
  // do patamar "vale" bonus / pontos que faltam (o que passa da estrela do patamar não conta)
  function patamares(prog) {
    const out = [];
    for (const pg of Object.keys(J.CODEX.paginas)) for (const c of J.CODEX.colecoes) {
      const m = J.marcoColecao(pg, c.id, prog), lista = J.CODEX.itens[pg][c.id];
      if (!m.prox) { out.push({ pg, colecao: c.id, bonus: c.bonus, min: m.min, ganho: m.ganho, prox: null, faltam: [], faltamPts: 0, porPonto: 0 }); continue; }
      const alvo = J.pontosAteEstrela(pg, m.prox.k);
      const faltam = lista.map((id) => ({ id, p: prog[id] || 0, falta: rd2(Math.max(0, alvo - (prog[id] || 0))) })).filter((x) => x.falta > 0);
      const faltamPts = faltam.reduce((s, x) => s + x.falta, 0);
      // taxa para fechar o patamar só com cópias C (1 ponto cada), item por item
      const taxaC = faltam.reduce((s, x) => s + registrarCopias(x.id, x.p, Array(Math.ceil(x.falta - 1e-9)).fill(x.id + '~C')).taxa, 0);
      const bonusItens = faltam.reduce((s, x) => s + J.bonusEstrelas(pg, m.prox.k) - J.bonusEstrelas(pg, J.estrelasCodex(pg, x.p)), 0);
      out.push({ pg, colecao: c.id, bonus: c.bonus, min: m.min, ganho: m.ganho, prox: m.prox, alvo, faltam, faltamPts, porPonto: faltamPts ? m.prox.bonus / faltamPts : 0, taxaC, bonusItens });
    }
    return out;
  }
  // o plano da mochila: cada cópia registrável (motivoCodex nulo) com a taxa, o bônus que ela acrescenta (estrelas + a parte dela no
  // próximo patamar da coleção) e quanto rende por milhão de ouro (taxa + o que o Lojista pagaria por ela; opts.venda(chave)).
  // Dentro de cada item, da cópia que vale menos para a que vale mais: a que rende pelo menos opts.limiar entra no plano (recomendada)
  // e o item avança; a que não rende fica de fora sem avançar o item, então a cópia grande seguinte é avaliada sem ela na frente (o
  // rende só cai com as estrelas, e uma cópia pulada continuaria abaixo do limiar se viesse depois). depois = o progresso do plano.
  function planoMochila(prog, chaves, opts = {}) {
    const venda = opts.venda || (() => 0), limiar = opts.limiar ?? 0, pat = Object.fromEntries(patamares(prog).map((x) => [x.pg + '/' + x.colecao, x]));
    const porItem = new Map();
    for (const chave of chaves) if (!J.motivoCodex(chave)) { const id = String(chave).split(/[!+~#]/)[0]; (porItem.get(id) ?? porItem.set(id, []).get(id)).push(chave); }
    const linhas = [], depois = { ...prog };
    let taxa = 0;
    for (const [id, lista] of porItem) {
      const pg = J.paginaCodex(id), col = J.colecaoCodex(id), pm = pat[pg + '/' + col], doItem = [];
      let p = prog[id] || 0, ordem = Infinity;
      for (const chave of porPontos(lista)) {
        const s = passoCodex(pg, p, chave);
        const bonusItem = s.pulada ? 0 : bonusContinuo(pg, s.para) - bonusContinuo(pg, s.de);
        const rumo = pm?.prox ? Math.max(0, Math.min(s.para, pm.alvo) - Math.min(s.de, pm.alvo)) : 0;
        const bonusPatamar = rumo * (pm?.porPonto || 0), v = venda(s.chave) || 0, custo = s.taxa + v;
        const rende = custo > 0 ? ((bonusItem + bonusPatamar) * 100) / (custo / 1e6) : 0;      // % de bônus por milhão de ouro
        const recomendada = !s.pulada && rende >= limiar;
        // na lista, uma cópia do plano nunca vem antes das que o mesmo item registra antes dela (ela depende delas)
        if (recomendada) { ordem = Math.min(ordem, rende); p = s.para; taxa += s.taxa; }
        doItem.push({ ...s, id, pg, colecao: col, tipo: J.tipoBonusCodex(id), recomendada, bonusItem, bonusPatamar, venda: v, custo, rende, ordem: recomendada ? ordem : rende });
      }
      const plano = doItem.filter((l) => l.recomendada);
      plano.forEach((l, n) => Object.assign(l, { passo: n + 1, deN: plano.length }));
      linhas.push(...doItem);
      depois[id] = p;
    }
    linhas.sort((a, b) => b.recomendada - a.recomendada || b.ordem - a.ordem || (a.id === b.id ? a.pts - b.pts : a.id < b.id ? -1 : 1));
    return { linhas, depois, taxa };
  }
  // quanto custa cada estrela de uma página registrando sempre a mesma cópia (chave): por estrela, a cópia em que ela fecha, a taxa
  // e o bônus acumulados até ali
  function tabelaEstrelas(pg, chave) {
    const pts = J.pontosCopia(chave), max = J.maxPontosCodex(pg), linhas = [];
    let p = 0, copias = 0, taxa = 0;
    for (let k = 1; k <= 10; k++) {
      const alvo = J.pontosAteEstrela(pg, k);
      while (p < alvo - 1e-9 && p < max - 1e-9) { taxa += J.custoCodex(pg, p); p = Math.min(max, rd2(p + pts)); copias++; }
      linhas.push({ k, pontos: alvo, copias, taxa, bonus: J.bonusEstrelas(pg, k), bonusEstrela: J.CODEX.paginas[pg].bonus[k - 1] });
    }
    return linhas;
  }

  return { simularForja, xpHoraSessoes, xpHoraBaldes, horasAte, estimarFarm, habilidades,
    progressoCodex, leituraCodex, bonusContinuo, registrarCopias, patamares, planoMochila, tabelaEstrelas };
})();
if (typeof module !== 'undefined') module.exports = CALC;
