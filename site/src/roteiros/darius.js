(function () {
  var HABS = {
    Q: { nome: "Dizimar", libera: 1, max: 10 },
    R: { nome: "Guilhotina de Noxus", libera: 6, max: 5 },
    G: { nome: "Grito de Guerra", libera: 8, max: 10 },
    E: { nome: "Apreender", libera: 1, max: 10, nota: "passiva fora da barra" },
    F: { nome: "Banho de Sangue", libera: 23, max: 10 },
    N: { nome: "Domínio de Noxus", libera: 45, max: 5 },
    W: { nome: "Ataque Mutilador", libera: 1, max: 10 }
  };
  var ORDEM_LISTA = ["Q", "R", "G", "E", "F", "N"];

  // limite de ranks do jogo: Q, W e E até a metade do nível; R nos níveis 6/11/16/25/35; N no 45/46/47/48/50; as outras, 1 ao liberar e +1 a cada 2 níveis
  function limite(k, n) {
    var h = HABS[k];
    if (n < h.libera) return 0;
    if (k === "R") return [6, 11, 16, 25, 35].filter(function (x) { return n >= x; }).length;
    if (k === "N") return [45, 46, 47, 48, 50].filter(function (x) { return n >= x; }).length;
    if (k === "Q" || k === "W" || k === "E") return Math.min(10, Math.ceil(n / 2));
    return Math.min(10, 1 + Math.floor((n - h.libera) / 2));
  }
  // um ponto por nível, nunca tirando de onde já está: Q no 1; 1 ponto em E (2), G (8) e F (23) para a barra;
  // depois R quando libera, Q até o limite, G e E se revezando, F e N
  function pontoDoNivel(r, nv) {
    function cabe(k) { return r[k] < limite(k, nv); }
    if (nv === 1) return "Q";
    if (!r.E && cabe("E")) return "E";
    if (!r.G && cabe("G")) return "G";
    if (!r.F && cabe("F")) return "F";
    if (cabe("R")) return "R";
    if (cabe("Q")) return "Q";
    if (cabe("G") || cabe("E")) return !cabe("E") || (cabe("G") && r.G <= r.E) ? "G" : "E";
    return ["F", "N", "W"].find(cabe) || null;
  }
  function ranks(n) {
    var r = { Q: 0, R: 0, G: 0, E: 0, F: 0, N: 0, W: 0 };
    for (var nv = 1; nv <= Math.min(n, 50); nv++) { var k = pontoDoNivel(r, nv); if (k) r[k]++; }
    return r;
  }
  function barra(n, r) {
    var b = [];
    if (r.Q) b.push("Q");
    if (n < 23 && r.E) b.push("E");
    if (r.R) b.push("R");
    if (r.G) b.push("G");
    if (n >= 23) b.push(r.N ? "N" : "F");
    return b;
  }
  function zona(n, itens) {
    if (n <= 11) return ["Rota Inferior", n >= 5 && n <= 9 ? "A Rota Superior empata até o 9." : "Rende mais que a Rota Superior e a Toca dos Lobos."];
    if (n <= 17) return ["Rota Superior", "A Toca dos Lobos empata, mas mata mais."];
    if (n >= 85) return ["Nexus Inimigo", "Libera no 85: rende de 4% a 7% mais que a Base Inimiga."];
    if (n >= 75) return ["Base Inimiga", "Libera no 75: rende de 4% a 8% mais que o Ancião."];
    if (n >= 50) return ["Covil do Dragão Ancião", n < 55 ? "Libera no 50. No começo empata com o Barão; no 55 já rende 48% mais." : "Com a build, ele não morreu lá nos testes."];
    if (itens === "epicos") {
      if (n <= 25) return ["Toca dos Lobos", "Só com épicos, o Campo Vermelho ainda mata."];
      if (n <= 29) return ["Campo Azul", "O Rio mata quem não tem lendários."];
      return ["Campo Vermelho", "Até chegarem os lendários: com eles, o Fosso e o Barão rendem muito mais."];
    }
    if (itens === "meia") {
      if (n <= 27) return ["Campo Vermelho", "Com a Espada do Rei Destruído, o Fosso passa a valer do 28."];
      if (n <= 35) return ["Fosso do Dragão", n >= 34 ? "Com 2 a 4 lendários, o Barão ainda só empata. Espere o 36." : "Com 2 a 4 lendários, o Barão mata antes do 34."];
      return ["Covil do Barão", "Do 36, mesmo sem a build completa, rende mais que o Fosso."];
    }
    if (n <= 23) return ["Campo Vermelho", "Rende de 2% a 6% mais que o Campo Azul e de 8% a 22% mais que o Rio."];
    if (n <= 33) return ["Fosso do Dragão", n <= 25 ? "No 24 empata com o Campo Vermelho; do 26 rende de 2% a 10% mais." : "Rende de 2% a 10% mais que o Campo Vermelho."];
    return ["Covil do Barão", n <= 35 ? "Monstros 6 níveis acima, mas com a build ele não morreu: de 8% a 11% mais que o Fosso no 34." : "De 14% a 30% mais que o Fosso do Dragão."];
  }

  var el = {
    nivel: document.getElementById("nivel"), txt: document.getElementById("nivelTxt"),
    habs: document.getElementById("habs"), barra: document.getElementById("barra"),
    atrib: document.getElementById("atrib"), zona: document.getElementById("zona"), zonaObs: document.getElementById("zonaObs"),
    proximo: document.getElementById("proximo")
  };
  var radios = Array.prototype.slice.call(document.querySelectorAll("input[name=itens]"));
  function itensSel() { var r = radios.find(function (x) { return x.checked; }); return r ? r.value : "completa"; }
  var nivelAtual = 36;

  function render(n) {
    var r = ranks(n), itens = itensSel();
    nivelAtual = n;
    el.txt.textContent = n;
    el.nivel.value = n;

    el.habs.innerHTML = "";
    ORDEM_LISTA.forEach(function (k) {
      var h = HABS[k], li = document.createElement("li"), aberta = n >= h.libera;
      li.className = "hab" + (aberta ? "" : " fechada") + (k === "Q" ? " chave" : "");
      var trilho = "";
      for (var i = 0; i < h.max; i++) trilho += "<i" + (i < r[k] ? " class=\"on\"" : "") + "></i>";
      li.innerHTML = "<kbd>" + k + "</kbd>" +
        "<span class=\"nome\">" + h.nome + (h.nota && n >= 23 ? " <small>(" + h.nota + ")</small>" : "") + "</span>" +
        "<span class=\"rk\">" + (aberta ? r[k] + "/" + h.max : "libera no " + h.libera) + "</span>" +
        "<span class=\"trilho" + (h.max === 5 ? " cinco" : "") + "\" aria-hidden=\"true\">" + trilho + "</span>";
      el.habs.appendChild(li);
    });

    el.barra.innerHTML = "";
    var b = barra(n, r);
    var falta = [];
    if (!r.E) falta.push("Apreender: 1 ponto no nível 2");
    if (n < 6) falta.push("Guilhotina libera no 6");
    if (n < 8) falta.push("Grito de Guerra libera no 8");
    for (var s = 0; s < 4; s++) {
      var k = b[s], d = document.createElement("div");
      if (k) { d.className = "tecla"; d.innerHTML = "<kbd>" + k + "</kbd><span>" + HABS[k].nome + "</span>"; }
      else { d.className = "tecla vazia"; d.textContent = falta.shift() || ""; }
      el.barra.appendChild(d);
    }

    var z = zona(n, itens);
    el.zona.textContent = z[0];
    el.zonaObs.textContent = z[1];

    var pts = 3 * (n - 1);
    el.atrib.textContent = pts ? "Força " + pts : "Ainda sem pontos";

    el.proximo.className = "proximo";
    if (n >= 50) {
      el.proximo.textContent = "Do nível 50 em diante não há pontos novos de habilidade. Os 3 pontos de atributo de cada nível vão em Força.";
    } else {
      var r2 = ranks(n + 1), sobe = ["Q", "R", "G", "E", "F", "N", "W"].find(function (x) { return r2[x] > r[x]; });
      var extra = "", m = n + 1;
      if (m === 2) extra = " Coloque o Apreender na barra.";
      if (m === 6) extra = " Coloque a Guilhotina na barra.";
      if (m === 8) extra = " Coloque o Grito de Guerra no 4º espaço da barra.";
      if (m === 23) { extra = " Tire o Apreender da barra e coloque o Banho de Sangue no lugar: a penetração de armadura do E continua valendo."; el.proximo.className = "proximo marco"; }
      if (m === 46) { extra = " Troque o Banho de Sangue pelo Domínio de Noxus na barra."; el.proximo.className = "proximo marco"; }
      if (m === 34 && itens === "completa") { extra += " E é a hora de ir para o Covil do Barão."; el.proximo.className = "proximo marco"; }
      if (m === 36 && itens === "meia") { extra += " E é a hora de ir para o Covil do Barão."; el.proximo.className = "proximo marco"; }
      el.proximo.innerHTML = "<b>No nível " + m + ":</b> o ponto novo vai em " + HABS[sobe].nome + " (" + sobe + ")." + extra;
    }
  }

  var CHAVE = "guia-darius-nivel", CHAVE_IT = "guia-darius-itens", inicial = 36;
  try { var s = parseInt(localStorage.getItem(CHAVE), 10); if (s >= 1 && s <= 100) inicial = s; } catch (e) {}
  try { var it = localStorage.getItem(CHAVE_IT); radios.forEach(function (x) { if (x.value === it) x.checked = true; }); } catch (e) {}

  function definir(n) {
    n = Math.max(1, Math.min(100, n));
    render(n);
    try { localStorage.setItem(CHAVE, String(n)); } catch (e) {}
  }
  el.nivel.addEventListener("input", function () { definir(parseInt(el.nivel.value, 10)); });
  document.getElementById("menos").addEventListener("click", function () { definir(parseInt(el.nivel.value, 10) - 1); });
  document.getElementById("mais").addEventListener("click", function () { definir(parseInt(el.nivel.value, 10) + 1); });
  radios.forEach(function (x) {
    x.addEventListener("change", function () {
      try { localStorage.setItem(CHAVE_IT, itensSel()); } catch (e) {}
      render(nivelAtual);
    });
  });
  render(inicial);
})();
