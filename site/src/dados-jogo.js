// Lupa Online · tabelas PÚBLICAS do jogo (lolidle.com), em números. GERADO por gerar-tabelas.mjs: não edite à mão.
// Só constantes e funções pequenas reescritas aqui; o motor do jogo não é copiado. Tudo o que sai destas contas é ESTIMATIVA.
// Funciona no navegador (const global JOGO, script clássico) e no Node (module.exports), para o teste e o gerador.
'use strict';

const JOGO = (() => {
  const meta = {"geradoEm":"2026-10-27T01:31:11.695Z","versaoJogo":"2026-10-26a","motorSha256":"339c9188eb75d9315f86b06a9de60ab26f3442181df1e897995043dcceba8ae7","dataDragon":"16.19.1","fonte":"https://lolidle.com/js/motor.js"};
  const NIVEL_MAX = 100;
  const REFINO_MAX = 7, BONUS_REFINO = 0.12, RITMO_REAL = 1.5;
  const CHANCE_REFINO = [0.3,0.12,0.02,0.008,0.003,0.0005,0.00006];            // chance de subir do refino i para i+1, sem VIP
  const REGRESSAO_REFINO = [0,0,0.04,0.015,0.006,0.0005,0.0001];      // chance de, ao falhar na tentativa de i para i+1, voltar para i-1
  const PERSISTENCIA = {"1":{},"2":{},"3":{"subir":80,"max":120},"4":{"subir":200,"max":300},"5":{"subir":530,"max":800},"6":{"subir":2300,"max":3500},"7":{"subir":8000,"max":12000}};        // por alvo (+1..+7): a partir de "subir" falhas a chance cresce até 100% na tentativa "max"
  const PERSISTENCIA_PASSO = 0.01, PERSISTENCIA_TETO = 0.5;
  const PRECO_REFINO_ALTO = 2, PRECO_REFINO_TOPO = {"5":3,"6":4.5};
  const VIP = {"boasVindas":2,"xp":1.2,"drop":1.2,"refino":1.2,"refinoMax":0.5,"preco":200,"dias":30,"salvarConvidado":1};
  const DROP_CHEFE = {"lendario":0.001,"epico":0.05,"basico":0.4};
  const ABATES_MIN_ZONA = {"rota-inf":18,"rota-sup":13,"lobos":11,"azul":6.5,"vermelho":7,"rio":7.5,"dragao":7,"barao":7.5,"anciao":7,"base":7,"nexus":7,"fj-tundra":7,"fj-floresta":7,"fj-lago":7,"fj-picos":7,"fj-trono":7};         // abates por minuto medidos pelo dono do jogo, por zona
  const TAREFA_TIPOS = {"rapida":{"min":7,"xp":0.42,"ouro":0.55},"normal":{"min":15,"xp":0.43,"ouro":0.55},"desafio":{"min":15,"xp":0.44,"ouro":0.5},"longa":{"min":25,"xp":0.42,"ouro":0.55},"especie":{"min":12,"xp":0.42,"ouro":0.55},"furioso":{"min":16,"xp":0.42,"ouro":0.55},"expedicao":{"min":60,"xp":0.462,"ouro":0.605,"lendMax":0.015},"grande":{"min":180,"xp":0.462,"ouro":0.605,"lendMax":0.03}};
  const QUALIDADES = {"C":{"peso":49.9495,"mult":0.9,"venda":0.8},"B":{"peso":35,"mult":1,"venda":1},"A":{"peso":15,"mult":1.15,"venda":1.5},"S":{"peso":0.05,"mult":1.35,"venda":3},"SS":{"peso":0.0005,"mult":1.7,"venda":8}};
  const ORDEM_QUAL = ['C', 'B', 'A', 'S', 'SS'];
  // XP para passar do nível n para o n+1 (XP_NIVEL[n - 1])
  const XP_NIVEL = [762,984,1570,2000,4050,5100,12000,15000,37200,46200,95200,118000,174000,213000,305000,374000,523000,638000,875000,1070000,1440000,1750000,2120000,2570000,3120000,3780000,4570000,5520000,6660000,8040000,9690000,11700000,14100000,16900000,20400000,24500000,29400000,35400000,42500000,51000000,61100000,73300000,87900000,105000000,126000000,151000000,181000000,216000000,259000000,279000000,286000000,292000000,299000000,306000000,313000000,320000000,327000000,335000000,342000000,349000000,356000000,364000000,371000000,379000000,386000000,394000000,402000000,410000000,417000000,425000000,433000000,441000000,449000000,457000000,465000000,474000000,482000000,490000000,499000000,507000000,516000000,524000000,533000000,542000000,550000000,559000000,568000000,577000000,586000000,595000000,604000000,613000000,623000000,632000000,641000000,651000000,660000000,670000000,679000000,689000000];
  // multiplicadores de XP, ouro e vida dos monstros por faixa de nível
  const BALANCO = [
  {"de":1,"ate":2,"xp":1,"ouro":1.5,"vida":0.7},
  {"de":3,"ate":4,"xp":1,"ouro":1.45,"vida":0.72},
  {"de":5,"ate":6,"xp":1,"ouro":1.4,"vida":0.75},
  {"de":7,"ate":8,"xp":1,"ouro":1.35,"vida":0.79},
  {"de":9,"ate":10,"xp":1,"ouro":1.3,"vida":0.83},
  {"de":11,"ate":12,"xp":1,"ouro":1.25,"vida":0.86},
  {"de":13,"ate":14,"xp":1,"ouro":1.2,"vida":0.89},
  {"de":15,"ate":16,"xp":1,"ouro":1.15,"vida":0.92},
  {"de":17,"ate":18,"xp":1,"ouro":1.1,"vida":0.95},
  {"de":19,"ate":20,"xp":1,"ouro":1.05,"vida":0.98},
  {"de":21,"ate":50,"xp":1,"ouro":1,"vida":1},
  {"de":51,"ate":55,"xp":1,"ouro":1,"vida":0.58},
  {"de":56,"ate":60,"xp":1,"ouro":1,"vida":0.52},
  {"de":61,"ate":65,"xp":1,"ouro":1,"vida":0.45},
  {"de":66,"ate":70,"xp":1,"ouro":1,"vida":0.4},
  {"de":71,"ate":75,"xp":1,"ouro":1,"vida":0.33},
  {"de":76,"ate":80,"xp":1,"ouro":1,"vida":0.3},
  {"de":81,"ate":85,"xp":1,"ouro":1,"vida":0.27},
  {"de":86,"ate":90,"xp":1,"ouro":1,"vida":0.25},
  {"de":91,"ate":95,"xp":1,"ouro":1,"vida":0.23},
  {"de":96,"ate":100,"xp":1,"ouro":1,"vida":0.22}
];
  const MONSTROS = {"Tropa Corpo a Corpo":{"hp":1,"xp":1,"ouro":1},"Tropa Mago":{"hp":0.7,"xp":0.9,"ouro":0.9},"Tropa de Cerco":{"hp":1.8,"xp":1.6,"ouro":1.8},"Lobo Gigante":{"hp":1.1,"xp":1.1,"ouro":1},"Krug Anciã":{"hp":1.5,"xp":1.2,"ouro":1.2},"Sentinela Azul":{"hp":2.2,"xp":2,"ouro":2.2},"Brambleback Vermelho":{"hp":2.2,"xp":2,"ouro":2.2},"Arraia do Rio":{"hp":1.5,"xp":1.2,"ouro":1.1},"Larva do Vazio":{"hp":1.1,"xp":1.1,"ouro":1},"Dragão Ancião (filhote)":{"hp":1.6,"xp":1.5,"ouro":1.4},"Criatura do Vazio":{"hp":1.3,"xp":1.4,"ouro":1.3},"Drake das Nuvens":{"hp":1.3,"xp":1.4,"ouro":1.3},"Drake da Montanha":{"hp":2.2,"xp":1.6,"ouro":1.5},"Drake Oceânico":{"hp":1.3,"xp":1.4,"ouro":1.3},"Drake Infernal":{"hp":1.6,"xp":1.6,"ouro":1.5},"Super Tropa":{"hp":2.6,"xp":1.7,"ouro":1.6},"Tropa Mago Vermelha":{"hp":1,"xp":1.3,"ouro":1.2},"Tropa de Cerco Vermelha":{"hp":2,"xp":1.8,"ouro":2},"Sentinela do Inibidor":{"hp":2.4,"xp":2,"ouro":2.1},"Torre Inimiga":{"hp":3.4,"xp":2.4,"ouro":2.4},"Defensor do Nexus":{"hp":2.6,"xp":2,"ouro":2.1},"Lobo do Gelo":{"hp":1,"xp":1,"ouro":1},"Poro Bravo":{"hp":1.4,"xp":1.3,"ouro":1.3},"Xamã do Gelo":{"hp":0.8,"xp":1,"ouro":1},"Javali das Neves":{"hp":1.6,"xp":1.5,"ouro":1.4},"Troll do Gelo":{"hp":1.8,"xp":1.6,"ouro":1.6},"Arraia Glacial":{"hp":1.5,"xp":1.4,"ouro":1.3},"Sentinela de Gelo":{"hp":2.2,"xp":2,"ouro":2.1},"Boneco de Neve":{"hp":2,"xp":1.8,"ouro":1.8},"Drake de Gelo":{"hp":1.5,"xp":1.6,"ouro":1.5},"Avarosano Renegado":{"hp":2.4,"xp":1.7,"ouro":1.6},"Saqueador da Garra":{"hp":1.6,"xp":1.6,"ouro":1.6},"Vigia Gélido":{"hp":2.4,"xp":2,"ouro":2.1}};
  // zonas de caça. faixa: níveis recomendados; nm: níveis dos monstros; nivel: nível mínimo para entrar; drop: chance por abate
  const ZONAS = [
  {"id":"rota-inf","nome":"Rota Inferior","faixa":[1,10],"nm":[1,6],"tier":0,"nivel":null,"mundo":"rift","monstros":[["Tropa Corpo a Corpo",3],["Tropa Mago",2]],"chefe":null,"drop":{"mitico":0,"lendario":0.000104,"epico":0.0012999,"basico":0.031156}},
  {"id":"rota-sup","nome":"Rota Superior","faixa":[5,15],"nm":[5,13],"tier":1,"nivel":null,"mundo":"rift","monstros":[["Tropa Corpo a Corpo",3],["Tropa Mago",2],["Tropa de Cerco",1]],"chefe":null,"drop":{"mitico":0,"lendario":0.00010727,"epico":0.0014298,"basico":0.025261}},
  {"id":"lobos","nome":"Toca dos Lobos","faixa":[10,20],"nm":[10,18],"tier":2,"nivel":null,"mundo":"rift","monstros":[["Lobo Gigante",1]],"chefe":null,"drop":{"mitico":0,"lendario":0.00013315,"epico":0.0012798,"basico":0.017575}},
  {"id":"azul","nome":"Campo Azul","faixa":[15,25],"nm":[15,23],"tier":3,"nivel":null,"mundo":"rift","monstros":[["Krug Anciã",2],["Sentinela Azul",1]],"chefe":null,"drop":{"mitico":0,"lendario":0.00023476,"epico":0.0011397,"basico":0.012583}},
  {"id":"vermelho","nome":"Campo Vermelho","faixa":[20,30],"nm":[20,28],"tier":4,"nivel":null,"mundo":"rift","monstros":[["Brambleback Vermelho",1],["Lobo Gigante",1],["Krug Anciã",1]],"chefe":null,"drop":{"mitico":0,"lendario":0.00024732,"epico":0.0010997,"basico":0.0099865}},
  {"id":"rio","nome":"Rio","faixa":[25,35],"nm":[25,33],"tier":5,"nivel":null,"mundo":"rift","monstros":[["Arraia do Rio",2],["Larva do Vazio",2]],"chefe":["Arauto do Vale",0.015],"drop":{"mitico":0,"lendario":0.00026918,"epico":0.0012497,"basico":0.0094856}},
  {"id":"dragao","nome":"Fosso do Dragão","faixa":[30,40],"nm":[30,38],"tier":6,"nivel":null,"mundo":"rift","monstros":[["Dragão Ancião (filhote)",2],["Larva do Vazio",1]],"chefe":["Dragão Infernal",0.015],"drop":{"mitico":0,"lendario":0.00032813,"epico":0.0013995,"basico":0.0089845}},
  {"id":"barao","nome":"Covil do Barão","faixa":[40,50],"nm":[40,48],"tier":7,"nivel":null,"mundo":"rift","monstros":[["Criatura do Vazio",2],["Dragão Ancião (filhote)",1]],"chefe":["Barão Nashor",0.015],"drop":{"mitico":0,"lendario":0.000368,"epico":0.0015494,"basico":0.0084837}},
  {"id":"anciao","nome":"Covil do Dragão Ancião","faixa":[50,75],"nm":[50,73],"tier":8,"nivel":50,"mundo":"rift","monstros":[["Drake das Nuvens",2],["Drake da Montanha",1],["Drake Oceânico",1],["Drake Infernal",1]],"chefe":["Dragão Ancião",0.015],"drop":{"mitico":0.000037536,"lendario":0.00037535,"epico":0.0016993,"basico":0.0079831}},
  {"id":"base","nome":"Base Inimiga","faixa":[75,85],"nm":[75,83],"tier":9,"nivel":75,"mundo":"rift","monstros":[["Super Tropa",2],["Tropa Mago Vermelha",2],["Tropa de Cerco Vermelha",1],["Sentinela do Inibidor",1],["Torre Inimiga",1]],"chefe":["Guardião do Inibidor",0.015],"drop":{"mitico":0.000038272,"lendario":0.00038271,"epico":0.0018492,"basico":0.007483}},
  {"id":"nexus","nome":"Nexus Inimigo","faixa":[85,100],"nm":[85,98],"tier":9,"nivel":85,"mundo":"rift","monstros":[["Super Tropa",2],["Defensor do Nexus",2],["Tropa de Cerco Vermelha",1],["Sentinela do Inibidor",1],["Torre Inimiga",1]],"chefe":["Nexus",0.015],"drop":{"mitico":0.000039008,"lendario":0.00039006,"epico":0.0018492,"basico":0.0074829}},
  {"id":"fj-tundra","nome":"Tundra Uivante","faixa":[50,60],"nm":[50,58],"tier":8,"nivel":null,"mundo":"freljord","monstros":[["Lobo do Gelo",2],["Poro Bravo",2],["Xamã do Gelo",1],["Javali das Neves",1]],"chefe":["Poro Rei",0.015],"drop":{"mitico":0.000037536,"lendario":0.00037535,"epico":0.0016993,"basico":0.0079831}},
  {"id":"fj-floresta","nome":"Floresta dos Pinheiros Brancos","faixa":[60,70],"nm":[60,68],"tier":8,"nivel":null,"mundo":"freljord","monstros":[["Troll do Gelo",2],["Lobo do Gelo",1],["Javali das Neves",1],["Poro Bravo",1]],"chefe":null,"drop":{"mitico":0.000037536,"lendario":0.00037535,"epico":0.0016993,"basico":0.0079831}},
  {"id":"fj-lago","nome":"Lago Congelado","faixa":[70,80],"nm":[70,78],"tier":9,"nivel":null,"mundo":"freljord","monstros":[["Arraia Glacial",2],["Sentinela de Gelo",1],["Boneco de Neve",1],["Xamã do Gelo",1]],"chefe":["Serpente Glacial",0.015],"drop":{"mitico":0.000037536,"lendario":0.00037535,"epico":0.0018492,"basico":0.007483}},
  {"id":"fj-picos","nome":"Picos da Garra do Inverno","faixa":[80,90],"nm":[80,88],"tier":9,"nivel":null,"mundo":"freljord","monstros":[["Drake de Gelo",2],["Avarosano Renegado",1],["Saqueador da Garra",1],["Boneco de Neve",1]],"chefe":["Yeti Ancestral",0.015],"drop":{"mitico":0.000038272,"lendario":0.00038271,"epico":0.0018492,"basico":0.007483}},
  {"id":"fj-trono","nome":"Trono de Gelo","faixa":[90,100],"nm":[90,98],"tier":9,"nivel":null,"mundo":"freljord","monstros":[["Vigia Gélido",2],["Drake de Gelo",1],["Saqueador da Garra",1]],"chefe":["Colosso de Gelo",0.015],"drop":{"mitico":0.000039008,"lendario":0.00039006,"epico":0.0018492,"basico":0.0074829}}
];
  // itens: preco é o preço-base no Lojista
  const ITENS = [
  {"id":"1001","nome":"Botas","preco":300,"raridade":"basico","espaco":"botas"},
  {"id":"1006","nome":"Pérola do Rejuvenescimento","preco":300,"raridade":"basico","espaco":"acessorio"},
  {"id":"1011","nome":"Cinto do Gigante","preco":900,"raridade":"epico","espaco":"armadura"},
  {"id":"1018","nome":"Capa da Agilidade","preco":600,"raridade":"basico","espaco":"armadura"},
  {"id":"1026","nome":"Varinha Explosiva","preco":850,"raridade":"basico","espaco":"arma"},
  {"id":"1027","nome":"Cristal de Safira","preco":300,"raridade":"basico","espaco":"acessorio"},
  {"id":"1028","nome":"Cristal de Rubi","preco":400,"raridade":"basico","espaco":"acessorio"},
  {"id":"1029","nome":"Couraça de Pano","preco":300,"raridade":"basico","espaco":"armadura"},
  {"id":"1031","nome":"Cota de Malha","preco":800,"raridade":"epico","espaco":"armadura"},
  {"id":"1033","nome":"Manto Anula-Magia","preco":400,"raridade":"basico","espaco":"armadura"},
  {"id":"1036","nome":"Espada Longa","preco":350,"raridade":"basico","espaco":"arma"},
  {"id":"1037","nome":"Picareta","preco":875,"raridade":"basico","espaco":"arma"},
  {"id":"1038","nome":"Espada G. p. C.","preco":1300,"raridade":"basico","espaco":"arma"},
  {"id":"1042","nome":"Adaga","preco":250,"raridade":"basico","espaco":"mao"},
  {"id":"1043","nome":"Arco Recurvo","preco":700,"raridade":"epico","espaco":"arma"},
  {"id":"1052","nome":"Tomo Amplificador","preco":400,"raridade":"basico","espaco":"mao"},
  {"id":"1053","nome":"Cetro Vampírico","preco":900,"raridade":"epico","espaco":"arma"},
  {"id":"1054","nome":"Escudo de Doran","preco":450,"raridade":"basico","espaco":"mao"},
  {"id":"1056","nome":"Anel de Doran","preco":400,"raridade":"basico","espaco":"acessorio"},
  {"id":"1058","nome":"Bastão Desnecessariamente Grande","preco":1200,"raridade":"basico","espaco":"arma"},
  {"id":"1120","nome":"Elmo de Doran","preco":450,"raridade":"basico","espaco":"cabeca"},
  {"id":"2019","nome":"Sigilo de Aço","preco":1100,"raridade":"epico","espaco":"mao"},
  {"id":"2021","nome":"Tunelizador","preco":1150,"raridade":"epico","espaco":"arma"},
  {"id":"2022","nome":"Partícula Brilhante","preco":250,"raridade":"basico","espaco":"acessorio"},
  {"id":"2420","nome":"Armaguarda da Caçadora","preco":1600,"raridade":"epico","espaco":"armadura"},
  {"id":"2501","nome":"Armadura Sangrenta do Suserano","preco":3300,"raridade":"lendario","espaco":"armadura"},
  {"id":"2508","nome":"Cinzas do Destino","preco":900,"raridade":"epico","espaco":"arma"},
  {"id":"3003","nome":"Cajado do Arcanjo","preco":2900,"raridade":"lendario","espaco":"arma"},
  {"id":"3004","nome":"Manamune","preco":5500,"raridade":"mitico","espaco":"arma"},
  {"id":"3006","nome":"Grevas do Berserker","preco":1100,"raridade":"epico","espaco":"botas"},
  {"id":"3008","nome":"Grevas Vorazes","preco":1000,"raridade":"epico","espaco":"botas"},
  {"id":"3009","nome":"Botas da Rapidez","preco":1000,"raridade":"epico","espaco":"botas"},
  {"id":"3020","nome":"Sapatos do Feiticeiro","preco":1100,"raridade":"epico","espaco":"botas"},
  {"id":"3024","nome":"Broquel Glacial","preco":900,"raridade":"epico","espaco":"mao"},
  {"id":"3026","nome":"Anjo Guardião","preco":3200,"raridade":"lendario","espaco":"acessorio"},
  {"id":"3031","nome":"Gume do Infinito","preco":3500,"raridade":"lendario","espaco":"arma"},
  {"id":"3035","nome":"Último Sussurro","preco":1450,"raridade":"epico","espaco":"arma"},
  {"id":"3036","nome":"Lembranças do Lorde Dominik","preco":3300,"raridade":"lendario","espaco":"arma"},
  {"id":"3044","nome":"Fago","preco":1100,"raridade":"epico","espaco":"arma"},
  {"id":"3046","nome":"Dançarina Fantasma","preco":2650,"raridade":"lendario","espaco":"arma"},
  {"id":"3047","nome":"Botas Galvanizadas de Aço","preco":1200,"raridade":"epico","espaco":"botas"},
  {"id":"3051","nome":"Machado Termestre","preco":1200,"raridade":"epico","espaco":"arma"},
  {"id":"3053","nome":"Sinal de Sterak","preco":3200,"raridade":"lendario","espaco":"mao"},
  {"id":"3057","nome":"Fulgor","preco":900,"raridade":"epico","espaco":"acessorio"},
  {"id":"3065","nome":"Semblante Espiritual","preco":2700,"raridade":"lendario","espaco":"cabeca"},
  {"id":"3066","nome":"Couraça Lunar Alada","preco":800,"raridade":"epico","espaco":"armadura"},
  {"id":"3067","nome":"Gema Ardente","preco":800,"raridade":"epico","espaco":"acessorio"},
  {"id":"3068","nome":"Égide de Fogo Solar","preco":2900,"raridade":"lendario","espaco":"mao"},
  {"id":"3070","nome":"Lágrima da Deusa","preco":400,"raridade":"basico","espaco":"acessorio"},
  {"id":"3071","nome":"Cutelo Negro","preco":3000,"raridade":"lendario","espaco":"arma"},
  {"id":"3072","nome":"Sedenta por Sangue","preco":3400,"raridade":"lendario","espaco":"arma"},
  {"id":"3074","nome":"Hidra Raivosa","preco":3300,"raridade":"lendario","espaco":"arma"},
  {"id":"3075","nome":"Armadura de Espinhos","preco":2450,"raridade":"lendario","espaco":"armadura"},
  {"id":"3076","nome":"Colete Espinhoso","preco":800,"raridade":"epico","espaco":"armadura"},
  {"id":"3077","nome":"Tiamat","preco":1200,"raridade":"epico","espaco":"arma"},
  {"id":"3078","nome":"Força da Trindade","preco":3333,"raridade":"lendario","espaco":"arma"},
  {"id":"3083","nome":"Armadura de Warmog","preco":3100,"raridade":"lendario","espaco":"armadura"},
  {"id":"3084","nome":"Coração de Aço","preco":5500,"raridade":"mitico","espaco":"armadura"},
  {"id":"3085","nome":"Furacão de Runaan","preco":2650,"raridade":"lendario","espaco":"arma"},
  {"id":"3086","nome":"Zelo","preco":1200,"raridade":"epico","espaco":"acessorio"},
  {"id":"3089","nome":"Capuz da Morte de Rabadon","preco":3500,"raridade":"lendario","espaco":"cabeca"},
  {"id":"3100","nome":"Perdição de Lich","preco":2900,"raridade":"lendario","espaco":"arma"},
  {"id":"3102","nome":"Véu da Banshee","preco":3000,"raridade":"lendario","espaco":"mao"},
  {"id":"3105","nome":"Égide da Legião","preco":1100,"raridade":"epico","espaco":"mao"},
  {"id":"3108","nome":"Códex Demoníaco","preco":850,"raridade":"epico","espaco":"mao"},
  {"id":"3111","nome":"Passos de Mercúrio","preco":1250,"raridade":"epico","espaco":"botas"},
  {"id":"3113","nome":"Cintilação Etérea","preco":900,"raridade":"epico","espaco":"acessorio"},
  {"id":"3116","nome":"Cetro de Cristal de Rylai","preco":2600,"raridade":"lendario","espaco":"arma"},
  {"id":"3133","nome":"Martelo de Guerra de Caulfield","preco":1050,"raridade":"epico","espaco":"arma"},
  {"id":"3135","nome":"Cajado do Vazio","preco":3000,"raridade":"lendario","espaco":"arma"},
  {"id":"3140","nome":"Bandana de Mercúrio","preco":1300,"raridade":"epico","espaco":"cabeca"},
  {"id":"3143","nome":"Presságio de Randuin","preco":2900,"raridade":"lendario","espaco":"armadura"},
  {"id":"3144","nome":"Estilingue do Patrulheiro","preco":600,"raridade":"epico","espaco":"arma"},
  {"id":"3145","nome":"Alternador Hextec","preco":1100,"raridade":"epico","espaco":"arma"},
  {"id":"3147","nome":"Máscara Assustadora","preco":1300,"raridade":"epico","espaco":"cabeca"},
  {"id":"3152","nome":"Explocinturão Hextec","preco":2900,"raridade":"lendario","espaco":"armadura"},
  {"id":"3153","nome":"Espada do Rei Destruído","preco":3200,"raridade":"lendario","espaco":"arma"},
  {"id":"3156","nome":"Mandíbula de Malmortius","preco":3100,"raridade":"lendario","espaco":"acessorio"},
  {"id":"3157","nome":"Ampulheta de Zhonya","preco":3250,"raridade":"lendario","espaco":"acessorio"},
  {"id":"3158","nome":"Botas Ionianas da Lucidez","preco":900,"raridade":"epico","espaco":"botas"},
  {"id":"3165","nome":"Morellonomicon","preco":2850,"raridade":"lendario","espaco":"mao"},
  {"id":"3168","nome":"Caminho Imortal","preco":2900,"raridade":"lendario","espaco":"botas"},
  {"id":"3170","nome":"Marcha Célere","preco":2800,"raridade":"lendario","espaco":"botas"},
  {"id":"3171","nome":"Lucidez Escarlate","preco":2800,"raridade":"lendario","espaco":"botas"},
  {"id":"3172","nome":"Grevas Bélicas","preco":3000,"raridade":"lendario","espaco":"botas"},
  {"id":"3173","nome":"Esmagadores Acorrentados","preco":2800,"raridade":"lendario","espaco":"botas"},
  {"id":"3174","nome":"Mobilização Blindada","preco":2800,"raridade":"lendario","espaco":"botas"},
  {"id":"3175","nome":"Sapatos Enfeitiçados","preco":2900,"raridade":"lendario","espaco":"botas"},
  {"id":"3190","nome":"Medalhão dos Solari de Ferro","preco":2900,"raridade":"lendario","espaco":"acessorio"},
  {"id":"3211","nome":"Capuz do Espectro","preco":1250,"raridade":"epico","espaco":"cabeca"},
  {"id":"3742","nome":"Couraça do Defunto","preco":2900,"raridade":"lendario","espaco":"armadura"},
  {"id":"3748","nome":"Hidra Titânica","preco":3300,"raridade":"lendario","espaco":"arma"},
  {"id":"3801","nome":"Braçadeira Cristalina","preco":800,"raridade":"epico","espaco":"acessorio"},
  {"id":"3802","nome":"Capítulo Perdido","preco":1200,"raridade":"epico","espaco":"mao"},
  {"id":"3916","nome":"Orbe do Oblívio","preco":800,"raridade":"epico","espaco":"mao"},
  {"id":"4629","nome":"Ímpeto Cósmico","preco":3000,"raridade":"lendario","espaco":"acessorio"},
  {"id":"4630","nome":"Joia da Ruína","preco":1100,"raridade":"epico","espaco":"acessorio"},
  {"id":"4632","nome":"Barreira Verdejante","preco":1600,"raridade":"epico","espaco":"mao"},
  {"id":"4633","nome":"Criafendas","preco":3100,"raridade":"lendario","espaco":"armadura"},
  {"id":"4645","nome":"Chama Sombria","preco":3200,"raridade":"lendario","espaco":"arma"},
  {"id":"4646","nome":"Tempestade de Luden","preco":5500,"raridade":"mitico","espaco":"acessorio"},
  {"id":"6333","nome":"Dança da Morte","preco":3300,"raridade":"lendario","espaco":"arma"},
  {"id":"6610","nome":"Céu Dividido","preco":3100,"raridade":"lendario","espaco":"arma"},
  {"id":"6631","nome":"Quebrapassos","preco":3300,"raridade":"lendario","espaco":"arma"},
  {"id":"6653","nome":"Tormento de Liandry","preco":3000,"raridade":"lendario","espaco":"cabeca"},
  {"id":"6655","nome":"Eco de Luden","preco":2750,"raridade":"lendario","espaco":"arma"},
  {"id":"6670","nome":"Aljava Vespertina","preco":1300,"raridade":"epico","espaco":"mao"},
  {"id":"6673","nome":"Arco-escudo Imortal","preco":3100,"raridade":"lendario","espaco":"mao"},
  {"id":"8020","nome":"Máscara Abissal","preco":2900,"raridade":"lendario","espaco":"cabeca"},
  {"id":"663056","nome":"Coroa do Rei Demoníaco","preco":3100,"raridade":"lendario","espaco":"cabeca"},
  {"id":"664644","nome":"Coroa da Rainha Despedaçada","preco":3100,"raridade":"lendario","espaco":"cabeca"}
];

  const ajuste = (n) => BALANCO.find((f) => n >= f.de && n <= f.ate) || BALANCO[BALANCO.length - 1];
  const CURVA = {
    hp: (n) => (150 + 100 * n + n * n) * ajuste(n).vida,
    xp: (n) => (30 + 7 * n) * ajuste(n).xp,
    ouro: (n) => (8 + 3.5 * n) * ajuste(n).ouro,
  };
  const xpParaNivel = (n) => XP_NIVEL[Math.min(NIVEL_MAX, Math.max(1, Math.floor(n))) - 1];
  // XP total para ir do nível "de" até o nível "ate" (soma de xpParaNivel(de) até xpParaNivel(ate - 1))
  const xpEntre = (de, ate) => { let t = 0; for (let n = de; n < ate; n++) t += xpParaNivel(n); return t; };
  // monstro mais de 5 níveis abaixo do seu dá menos XP: -10% por nível, mínimo 10%
  const fatorXp = (nivel, nivelMonstro) => { const dif = nivel - nivelMonstro; return dif > 5 ? Math.max(0.1, 1 - 0.1 * (dif - 5)) : 1; };

  const ZONA = Object.fromEntries(ZONAS.map((z) => [z.id, z]));
  const nivelMeio = (z) => (z.nm[0] + z.nm[1]) / 2;
  const peso = (z) => z.monstros.reduce((s, [, f]) => s + f, 0);
  // médias de um abate comum na zona, no nível do meio dela (sem bônus nenhum)
  function porAbateZona(z) {
    const nm = nivelMeio(z), tot = peso(z);
    let xp = 0, ouro = 0, hp = 0;
    for (const [m, f] of z.monstros) { const k = f / tot; xp += k * CURVA.xp(nm) * MONSTROS[m].xp; ouro += k * CURVA.ouro(nm) * MONSTROS[m].ouro; hp += k * CURVA.hp(nm) * MONSTROS[m].hp; }
    return { xp, ouro, hp };
  }
  const zonaIdeal = (n) => [...ZONAS].reverse().find((z) => z.mundo === 'rift' && n >= z.faixa[0]) || ZONAS[0];

  const baseId = (x) => String(x).split(/[!+~#]/)[0];
  const item = (id) => ITENS.find((i) => i.id === baseId(id)) || null;
  const valorVenda = (id, refino, qual) => { const i = item(id); return i ? Math.floor(i.preco * 0.5 * (1 + 0.5 * refino) * (QUALIDADES[qual]?.venda || 1)) : null; };
  // preço de UMA tentativa de forja a partir do refino atual (refino -> refino + 1)
  const precoRefino = (id, refino) => { const i = item(id); return i ? Math.round(i.preco * (0.5 + 0.5 * refino) * (PRECO_REFINO_TOPO[refino] || (refino >= 2 ? PRECO_REFINO_ALTO : 1))) : null; };
  const chanceRefino = (refino, vip) => (vip ? Math.min(VIP.refinoMax, CHANCE_REFINO[refino] * VIP.refino) : CHANCE_REFINO[refino]);
  const bonusFalhas = (falhas) => Math.min(PERSISTENCIA_TETO, PERSISTENCIA_PASSO * (falhas || 0));
  // chance da próxima tentativa de forja, com a persistência do Ornn (falhas = falhas seguidas neste alvo)
  function chanceForja(refino, falhas, vip) {
    const base = chanceRefino(refino, vip), regra = PERSISTENCIA[refino + 1];
    if (!regra) return base;
    const b = Math.min(1, base * (1 + bonusFalhas(falhas)));
    if (!regra.subir || falhas < regra.subir) return b;
    return Math.min(1, b + ((1 - b) * (falhas - regra.subir + 1)) / (regra.max - regra.subir));
  }
  // XP e ouro de uma tarefa por zona (máximo que o Capitão paga); t = { tipo, local, qtd }
  function recompensaTarefa(t) {
    const T = TAREFA_TIPOS[t.tipo], z = ZONA[t.local];
    if (!T || !z) return null;
    const a = porAbateZona(z);
    return { xp: Math.round(t.qtd * a.xp * T.xp), ouro: Math.round(t.qtd * a.ouro * T.ouro) };
  }

  return { meta, NIVEL_MAX, REFINO_MAX, BONUS_REFINO, RITMO_REAL, CHANCE_REFINO, REGRESSAO_REFINO, PERSISTENCIA, VIP, DROP_CHEFE, ABATES_MIN_ZONA, TAREFA_TIPOS, QUALIDADES, ORDEM_QUAL,
    XP_NIVEL, BALANCO, MONSTROS, ZONAS, ITENS, ZONA, CURVA, xpParaNivel, xpEntre, fatorXp, porAbateZona, zonaIdeal, item, valorVenda, precoRefino, chanceRefino, chanceForja, recompensaTarefa };
})();
if (typeof module !== 'undefined') module.exports = JOGO;
