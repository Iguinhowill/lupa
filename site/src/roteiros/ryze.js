(function () {
  var HABS = {
    Q: { nome: "Sobrecarregar", libera: 1 },
    E: { nome: "Fluxo de Feitiço", libera: 1 },
    G: { nome: "Fluxo Arcano", libera: 8 },
    D: { nome: "Eco Rúnico", libera: 18, nota: "passiva" },
    W: { nome: "Prisão de Runa", libera: 1 }
  };
  var ORDEM_LISTA = ["Q", "E", "G", "D", "W"];
  var PRIORIDADE = ["Q", "E", "G", "D", "W"];

  // limite de ranks do jogo: Q, W e E até a metade do nível; as outras, 1 ao liberar e +1 a cada 2 níveis
  function limite(k, n) {
    if (n < HABS[k].libera) return 0;
    if (k === "Q" || k === "W" || k === "E") return Math.min(10, Math.ceil(n / 2));
    return Math.min(10, 1 + Math.floor((n - HABS[k].libera) / 2));
  }
  // 1 ponto em Q, W e E, na Fluxo Arcano (barra, no 8) e no Eco Rúnico (no 18); o resto pela prioridade
  function ranks(n) {
    n = Math.min(n, 50);      // do 50 em diante não há pontos novos: os ranks ficam como no 50
    var r = { Q: 0, E: 0, G: 0, D: 0, W: 0 }, pts = n;
    ["Q", "W", "E", "G", "D"].forEach(function (k) { if (pts > 0 && limite(k, n) > 0) { r[k] = 1; pts--; } });
    while (pts > 0) {
      var k = PRIORIDADE.find(function (x) { return r[x] < limite(x, n); });
      if (!k) break;
      r[k]++; pts--;
    }
    return r;
  }
  function barra(n) { return n >= 8 ? ["Q", "W", "E", "G"] : ["Q", "W", "E", null]; }

  // recarga da Lucidez Escarlate: 15% × (1 + 12% por refino) × qualidade; o Foco dá 0,4% por ponto, até 30% (75 pontos)
  var QUAL = { C: 0.9, B: 1, A: 1.15, S: 1.35, SS: 1.7 };
  function focoNecessario(sel) {
    if (sel === "sem") return 75;
    var p = sel.split("|"), cdr = 0.15 * (1 + 0.12 * Number(p[0])) * QUAL[p[1]];
    return Math.min(75, Math.max(0, Math.ceil((0.40 - cdr) / 0.004 - 1e-9)));
  }

  var el = {
    nivel: document.getElementById("nivel"), txt: document.getElementById("nivelTxt"),
    habs: document.getElementById("habs"), barra: document.getElementById("barra"),
    atrib: document.getElementById("atrib"), atribObs: document.getElementById("atribObs"),
    luc: document.getElementById("luc"), proximo: document.getElementById("proximo")
  };

  var opcoes = [["sem", "Ainda sem a Lucidez"]];
  ["C", "B", "A", "S"].forEach(function (q) {
    for (var r = 0; r <= 7; r++) opcoes.push([r + "|" + q, "+" + r + " qualidade " + q]);
  });
  opcoes.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; el.luc.appendChild(op); });

  var nivelAtual = 30;

  function render(n) {
    var r = ranks(n);
    nivelAtual = n;
    el.txt.textContent = n;
    el.nivel.value = n;

    el.habs.innerHTML = "";
    ORDEM_LISTA.forEach(function (k) {
      var h = HABS[k], li = document.createElement("li"), aberta = n >= h.libera;
      li.className = "hab" + (aberta ? "" : " fechada") + (k === "D" ? " chave" : "");
      var trilho = "";
      for (var i = 0; i < 10; i++) trilho += "<i" + (i < r[k] ? " class=\"on\"" : "") + "></i>";
      li.innerHTML = "<kbd>" + k + "</kbd>" +
        "<span class=\"nome\">" + h.nome + (h.nota ? " <small>(" + h.nota + ")</small>" : "") + "</span>" +
        "<span class=\"rk\">" + (aberta ? r[k] + "/10" : "libera no " + h.libera) + "</span>" +
        "<span class=\"trilho\" aria-hidden=\"true\">" + trilho + "</span>";
      el.habs.appendChild(li);
    });

    el.barra.innerHTML = "";
    barra(n).forEach(function (k) {
      var d = document.createElement("div");
      if (k) { d.className = "tecla"; d.innerHTML = "<kbd>" + k + "</kbd><span>" + HABS[k].nome + "</span>"; }
      else { d.className = "tecla vazia"; d.textContent = "Fluxo Arcano libera no 8"; }
      el.barra.appendChild(d);
    });

    var pts = 3 * (n - 1), sel = el.luc.value, foco = focoNecessario(sel);
    if (pts === 0) {
      el.atrib.textContent = "Ainda sem pontos";
    } else if (pts <= foco) {
      el.atrib.textContent = pts + " em Foco";
    } else {
      el.atrib.textContent = "Foco " + foco + " · Força " + (pts - foco);
    }
    el.atribObs.textContent = sel === "sem"
      ? "Sem a Lucidez, o Foco leva a recarga só até −30% (75 pontos). Quando ela chegar, sobra Foco: os próximos pontos vão em Força. Nada em Vitalidade, Resistência ou Agilidade."
      : "Foco até a aba Atributos mostrar Recarga −40%; o resto em Força. Nada em Vitalidade, Resistência ou Agilidade.";

    el.proximo.className = "proximo";
    if (n >= 50) {
      el.proximo.textContent = "Do nível 50 em diante não há pontos novos de habilidade. Os de atributo vão em Força (ou em Foco, se a recarga ainda não chegou a −40%).";
    } else {
      var r2 = ranks(n + 1), sobe = PRIORIDADE.concat(["W"]).find(function (k) { return r2[k] > r[k]; }) || "W";
      var extra = "";
      if (n + 1 === 8) extra = " Coloque a Fluxo Arcano no 4º espaço da barra.";
      if (n + 1 === 18) { extra = " É o ponto mais importante do Ryze: com ele, a mana para de acabar."; el.proximo.className = "proximo d18"; }
      el.proximo.innerHTML = "<b>No nível " + (n + 1) + ":</b> o ponto novo vai em " + HABS[sobe].nome + " (" + sobe + ")." + extra;
    }
  }

  var CHAVE = "guia-ryze-nivel", CHAVE_LUC = "guia-ryze-lucidez", inicial = 30;
  try { var s = parseInt(localStorage.getItem(CHAVE), 10); if (s >= 1 && s <= 100) inicial = s; } catch (e) {}
  el.luc.value = "0|B";
  try { var l = localStorage.getItem(CHAVE_LUC); if (l && opcoes.some(function (o) { return o[0] === l; })) el.luc.value = l; } catch (e) {}

  function definir(n) {
    n = Math.max(1, Math.min(100, n));
    render(n);
    try { localStorage.setItem(CHAVE, String(n)); } catch (e) {}
  }
  el.nivel.addEventListener("input", function () { definir(parseInt(el.nivel.value, 10)); });
  document.getElementById("menos").addEventListener("click", function () { definir(parseInt(el.nivel.value, 10) - 1); });
  document.getElementById("mais").addEventListener("click", function () { definir(parseInt(el.nivel.value, 10) + 1); });
  el.luc.addEventListener("change", function () {
    try { localStorage.setItem(CHAVE_LUC, el.luc.value); } catch (e) {}
    render(nivelAtual);
  });
  render(inicial);
})();
