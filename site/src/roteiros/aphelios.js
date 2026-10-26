(function () {
  var HABS = {
    W: { nome: "Fase", libera: 1 },
    G: { nome: "Devoção a Alune", libera: 8 },
    D: { nome: "Lição dos Lunari", libera: 18, nota: "passiva" },
    B: { nome: "Eclipse Duplo", libera: 33 },
    Q: { nome: "Habilidades da arma", libera: 1 },
    E: { nome: "Arma de Alune", libera: 1 }
  };
  var ORDEM_LISTA = ["W", "G", "D", "B", "Q", "E"];
  var PRIORIDADE = ["W", "G", "D", "B", "Q", "E"];

  // limite de ranks do jogo: Q, W e E até a metade do nível; as outras, 1 ao liberar e +1 a cada 2 níveis
  function limite(k, n) {
    if (n < HABS[k].libera) return 0;
    if (k === "Q" || k === "W" || k === "E") return Math.min(10, Math.ceil(n / 2));
    return Math.min(10, 1 + Math.floor((n - HABS[k].libera) / 2));
  }
  function ranks(n) {
    n = Math.min(n, 50);      // do 50 em diante não há pontos novos: os ranks ficam como no 50
    var r = { W: 0, G: 0, D: 0, B: 0, Q: 0, E: 0 }, pts = n;
    ["Q", "W", "E"].forEach(function (k) { if (pts > 0 && limite(k, n) > 0) { r[k] = 1; pts--; } });
    while (pts > 0) {
      var k = PRIORIDADE.find(function (x) { return r[x] < limite(x, n); });
      if (!k) break;
      r[k]++; pts--;
    }
    return r;
  }
  function barra(n) {
    if (n >= 33) return ["Q", "W", "G", "B"];
    if (n >= 8) return ["Q", "W", "E", "G"];
    return ["Q", "W", "E", null];
  }

  var el = {
    nivel: document.getElementById("nivel"), txt: document.getElementById("nivelTxt"),
    habs: document.getElementById("habs"), barra: document.getElementById("barra"),
    atrib: document.getElementById("atrib"), proximo: document.getElementById("proximo")
  };

  function render(n) {
    var r = ranks(n);
    el.txt.textContent = n;
    el.nivel.value = n;

    el.habs.innerHTML = "";
    ORDEM_LISTA.forEach(function (k) {
      var h = HABS[k], li = document.createElement("li"), aberta = n >= h.libera;
      li.className = "hab" + (aberta ? "" : " fechada");
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
      else { d.className = "tecla vazia"; d.textContent = "Devoção a Alune libera no 8"; }
      el.barra.appendChild(d);
    });

    el.atrib.textContent = 3 * (n - 1) + " em Força";

    if (n >= 50) {
      el.proximo.textContent = "Do nível 50 em diante não há pontos novos de habilidade. Os de atributo continuam indo em Força.";
    } else {
      var r2 = ranks(n + 1), sobe = PRIORIDADE.find(function (k) { return r2[k] > r[k]; });
      var extra = n + 1 === 33 ? " A partir dele, o Eclipse Duplo entra na barra no lugar da Arma de Alune." : n + 1 === 8 ? " Coloque a Devoção a Alune no 4º espaço da barra." : "";
      el.proximo.innerHTML = "<b>No nível " + (n + 1) + ":</b> o ponto novo vai em " + HABS[sobe].nome + " (" + sobe + ")." + extra;
    }
  }

  var CHAVE = "guia-aphelios-nivel", inicial = 28;
  try { var s = parseInt(localStorage.getItem(CHAVE), 10); if (s >= 1 && s <= 100) inicial = s; } catch (e) {}
  function definir(n) {
    n = Math.max(1, Math.min(100, n));
    render(n);
    try { localStorage.setItem(CHAVE, String(n)); } catch (e) {}
  }
  el.nivel.addEventListener("input", function () { definir(parseInt(el.nivel.value, 10)); });
  document.getElementById("menos").addEventListener("click", function () { definir(parseInt(el.nivel.value, 10) - 1); });
  document.getElementById("mais").addEventListener("click", function () { definir(parseInt(el.nivel.value, 10) + 1); });
  render(inicial);
})();
