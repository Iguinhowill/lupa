// Lupa Online · tabelas PÚBLICAS do jogo (lolidle.com), em números. GERADO por gerar-tabelas.mjs: não edite à mão.
// Só constantes e funções pequenas reescritas aqui; o motor do jogo não é copiado. Tudo o que sai destas contas é ESTIMATIVA.
// Funciona no navegador (const global JOGO, script clássico) e no Node (module.exports), para o teste e o gerador.
'use strict';

const JOGO = (() => {
  const meta = {"geradoEm":"2026-10-27T13:01:22.332Z","versaoJogo":"2026-10-27a","motorSha256":"4ea6f0a888a4af296ab2354b6153caa0d38257bfee89440a8afb2240b7639e69","dataDragon":"16.19.1","fonte":"https://lolidle.com/js/motor.js","erroComparador":{"n":236,"mediana":1.89,"p90":4.69,"max":20.72,"barra":{"n":59,"mediana":3.37,"p90":7.72,"max":10.18},"unidade":"pontos percentuais de abates/h (diferença entre a mudança relativa no modelo e no motor)","porCampeao":{"yasuo":{"n":120,"mediana":1.92,"p90":4.61,"max":20.72,"barra":{"n":30,"mediana":2.66,"p90":7.2,"max":8.8},"faixa":{"niveis":[24,45],"zonas":["azul","barao","dragao","rio","vermelho"]},"parametros":{"k":0.9,"aoe":0.2,"uG":1,"uW":1,"kite":1.75,"castEf":0.8}},"aphelios":{"n":116,"mediana":1.86,"p90":4.72,"max":10.92,"barra":{"n":29,"mediana":3.46,"p90":8.2,"max":10.18},"faixa":{"niveis":[24,45],"zonas":["azul","barao","dragao","rio","vermelho"]},"parametros":{"k":0.7,"aoe":0.25,"uG":1.4,"uW":0.4,"kite":7,"castEf":0.4}}},"limite":{"mediana":3.5,"p90":8},"simulacao":{"minutos":10,"sementes":2,"basesTreino":40,"basesTeste":30,"semChefes":true,"semFurioso":true,"motorSha256":"4ea6f0a888a4af296ab2354b6153caa0d38257bfee89440a8afb2240b7639e69"},"motorSha256":"4ea6f0a888a4af296ab2354b6153caa0d38257bfee89440a8afb2240b7639e69"}};
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
  const MONSTROS = {"Tropa Corpo a Corpo":{"hp":1,"ar":0.6,"xp":1,"ouro":1},"Tropa Mago":{"hp":0.7,"ar":0.3,"xp":0.9,"ouro":0.9},"Tropa de Cerco":{"hp":1.8,"ar":1.2,"xp":1.6,"ouro":1.8},"Lobo Gigante":{"hp":1.1,"ar":0.8,"xp":1.1,"ouro":1},"Krug Anciã":{"hp":1.5,"ar":1.5,"xp":1.2,"ouro":1.2},"Sentinela Azul":{"hp":2.2,"ar":1.2,"xp":2,"ouro":2.2},"Brambleback Vermelho":{"hp":2.2,"ar":1.2,"xp":2,"ouro":2.2},"Arraia do Rio":{"hp":1.5,"ar":1.6,"xp":1.2,"ouro":1.1},"Larva do Vazio":{"hp":1.1,"ar":1,"xp":1.1,"ouro":1},"Dragão Ancião (filhote)":{"hp":1.6,"ar":1.2,"xp":1.5,"ouro":1.4},"Criatura do Vazio":{"hp":1.3,"ar":1,"xp":1.4,"ouro":1.3},"Drake das Nuvens":{"hp":1.3,"ar":1,"xp":1.4,"ouro":1.3},"Drake da Montanha":{"hp":2.2,"ar":2,"xp":1.6,"ouro":1.5},"Drake Oceânico":{"hp":1.3,"ar":1,"xp":1.4,"ouro":1.3},"Drake Infernal":{"hp":1.6,"ar":1.2,"xp":1.6,"ouro":1.5},"Super Tropa":{"hp":2.6,"ar":1.8,"xp":1.7,"ouro":1.6},"Tropa Mago Vermelha":{"hp":1,"ar":0.6,"xp":1.3,"ouro":1.2},"Tropa de Cerco Vermelha":{"hp":2,"ar":1.4,"xp":1.8,"ouro":2},"Sentinela do Inibidor":{"hp":2.4,"ar":1.6,"xp":2,"ouro":2.1},"Torre Inimiga":{"hp":3.4,"ar":2.4,"xp":2.4,"ouro":2.4},"Defensor do Nexus":{"hp":2.6,"ar":1.8,"xp":2,"ouro":2.1},"Lobo do Gelo":{"hp":1,"ar":0.8,"xp":1,"ouro":1},"Poro Bravo":{"hp":1.4,"ar":1,"xp":1.3,"ouro":1.3},"Xamã do Gelo":{"hp":0.8,"ar":0.5,"xp":1,"ouro":1},"Javali das Neves":{"hp":1.6,"ar":1.2,"xp":1.5,"ouro":1.4},"Troll do Gelo":{"hp":1.8,"ar":1.4,"xp":1.6,"ouro":1.6},"Arraia Glacial":{"hp":1.5,"ar":1.6,"xp":1.4,"ouro":1.3},"Sentinela de Gelo":{"hp":2.2,"ar":1.4,"xp":2,"ouro":2.1},"Boneco de Neve":{"hp":2,"ar":1.4,"xp":1.8,"ouro":1.8},"Drake de Gelo":{"hp":1.5,"ar":1.2,"xp":1.6,"ouro":1.5},"Avarosano Renegado":{"hp":2.4,"ar":1.8,"xp":1.7,"ouro":1.6},"Saqueador da Garra":{"hp":1.6,"ar":1.2,"xp":1.6,"ouro":1.6},"Vigia Gélido":{"hp":2.4,"ar":1.7,"xp":2,"ouro":2.1}};
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
  {"id":"1001","nome":"Botas","preco":300,"raridade":"basico","espaco":"botas","e":{"vida":80,"armadura":5}},
  {"id":"1006","nome":"Pérola do Rejuvenescimento","preco":300,"raridade":"basico","espaco":"acessorio","e":{"regen":3}},
  {"id":"1011","nome":"Cinto do Gigante","preco":900,"raridade":"epico","espaco":"armadura","e":{"vida":350}},
  {"id":"1018","nome":"Capa da Agilidade","preco":600,"raridade":"basico","espaco":"armadura","e":{"critico":0.15}},
  {"id":"1026","nome":"Varinha Explosiva","preco":850,"raridade":"basico","espaco":"arma","e":{"ap":45}},
  {"id":"1027","nome":"Cristal de Safira","preco":300,"raridade":"basico","espaco":"acessorio","e":{"mana":300}},
  {"id":"1028","nome":"Cristal de Rubi","preco":400,"raridade":"basico","espaco":"acessorio","e":{"vida":150}},
  {"id":"1029","nome":"Couraça de Pano","preco":300,"raridade":"basico","espaco":"armadura","e":{"armadura":15}},
  {"id":"1031","nome":"Cota de Malha","preco":800,"raridade":"epico","espaco":"armadura","e":{"armadura":40}},
  {"id":"1033","nome":"Manto Anula-Magia","preco":400,"raridade":"basico","espaco":"armadura","e":{"rm":20}},
  {"id":"1036","nome":"Espada Longa","preco":350,"raridade":"basico","espaco":"arma","e":{"ad":10}},
  {"id":"1037","nome":"Picareta","preco":875,"raridade":"basico","espaco":"arma","e":{"ad":25}},
  {"id":"1038","nome":"Espada G. p. C.","preco":1300,"raridade":"basico","espaco":"arma","e":{"ad":40}},
  {"id":"1042","nome":"Adaga","preco":250,"raridade":"basico","espaco":"mao","e":{"va":0.1}},
  {"id":"1043","nome":"Arco Recurvo","preco":700,"raridade":"epico","espaco":"arma","e":{"va":0.15}},
  {"id":"1052","nome":"Tomo Amplificador","preco":400,"raridade":"basico","espaco":"mao","e":{"ap":20}},
  {"id":"1053","nome":"Cetro Vampírico","preco":900,"raridade":"epico","espaco":"arma","e":{"ad":15,"rv":0.07}},
  {"id":"1054","nome":"Escudo de Doran","preco":450,"raridade":"basico","espaco":"mao","e":{"vida":110,"regen":1}},
  {"id":"1056","nome":"Anel de Doran","preco":400,"raridade":"basico","espaco":"acessorio","e":{"ap":18,"vida":90}},
  {"id":"1058","nome":"Bastão Desnecessariamente Grande","preco":1200,"raridade":"basico","espaco":"arma","e":{"ap":65}},
  {"id":"1120","nome":"Elmo de Doran","preco":450,"raridade":"basico","espaco":"cabeca","e":{"vida":150,"armadura":8,"rm":8}},
  {"id":"2019","nome":"Sigilo de Aço","preco":1100,"raridade":"epico","espaco":"mao","e":{"ad":15,"armadura":30}},
  {"id":"2021","nome":"Tunelizador","preco":1150,"raridade":"epico","espaco":"arma","e":{"ad":15,"vida":250}},
  {"id":"2022","nome":"Partícula Brilhante","preco":250,"raridade":"basico","espaco":"acessorio","e":{"cdr":0.05}},
  {"id":"2420","nome":"Armaguarda da Caçadora","preco":1600,"raridade":"epico","espaco":"armadura","e":{"ap":40,"armadura":25}},
  {"id":"2501","nome":"Armadura Sangrenta do Suserano","preco":3300,"raridade":"lendario","espaco":"armadura","e":{"ad":30,"vida":550}},
  {"id":"2508","nome":"Cinzas do Destino","preco":900,"raridade":"epico","espaco":"arma","e":{"ap":30}},
  {"id":"3003","nome":"Cajado do Arcanjo","preco":2900,"raridade":"lendario","espaco":"arma","e":{"ap":70,"mana":600}},
  {"id":"3004","nome":"Manamune","preco":5500,"raridade":"mitico","espaco":"arma","e":{"ad":79,"critico":0.26}},
  {"id":"3006","nome":"Grevas do Berserker","preco":1100,"raridade":"epico","espaco":"botas","e":{"ad":10,"va":0.3}},
  {"id":"3008","nome":"Grevas Vorazes","preco":1000,"raridade":"epico","espaco":"botas","e":{"ad":15,"rv":0.07}},
  {"id":"3009","nome":"Botas da Rapidez","preco":1000,"raridade":"epico","espaco":"botas","e":{"vida":200,"regen":2}},
  {"id":"3020","nome":"Sapatos do Feiticeiro","preco":1100,"raridade":"epico","espaco":"botas","e":{"ap":35,"penMag":0.08}},
  {"id":"3024","nome":"Broquel Glacial","preco":900,"raridade":"epico","espaco":"mao","e":{"mana":300,"armadura":25,"cdr":0.05}},
  {"id":"3026","nome":"Anjo Guardião","preco":3200,"raridade":"lendario","espaco":"acessorio","e":{"ad":55,"armadura":45}},
  {"id":"3031","nome":"Gume do Infinito","preco":3500,"raridade":"lendario","espaco":"arma","e":{"ad":75,"critico":0.25}},
  {"id":"3035","nome":"Último Sussurro","preco":1450,"raridade":"epico","espaco":"arma","e":{"ad":20}},
  {"id":"3036","nome":"Lembranças do Lorde Dominik","preco":3300,"raridade":"lendario","espaco":"arma","e":{"ad":35,"critico":0.25}},
  {"id":"3044","nome":"Fago","preco":1100,"raridade":"epico","espaco":"arma","e":{"ad":15,"vida":200}},
  {"id":"3046","nome":"Dançarina Fantasma","preco":2650,"raridade":"lendario","espaco":"arma","e":{"va":0.65,"critico":0.25}},
  {"id":"3047","nome":"Botas Galvanizadas de Aço","preco":1200,"raridade":"epico","espaco":"botas","e":{"vida":100,"armadura":30}},
  {"id":"3051","nome":"Machado Termestre","preco":1200,"raridade":"epico","espaco":"arma","e":{"ad":20,"va":0.2}},
  {"id":"3053","nome":"Sinal de Sterak","preco":3200,"raridade":"lendario","espaco":"mao","e":{"vida":400}},
  {"id":"3057","nome":"Fulgor","preco":900,"raridade":"epico","espaco":"acessorio","e":{}},
  {"id":"3065","nome":"Semblante Espiritual","preco":2700,"raridade":"lendario","espaco":"cabeca","e":{"vida":400,"rm":50}},
  {"id":"3066","nome":"Couraça Lunar Alada","preco":800,"raridade":"epico","espaco":"armadura","e":{"vida":200}},
  {"id":"3067","nome":"Gema Ardente","preco":800,"raridade":"epico","espaco":"acessorio","e":{"vida":200}},
  {"id":"3068","nome":"Égide de Fogo Solar","preco":2900,"raridade":"lendario","espaco":"mao","e":{"vida":450,"armadura":50,"armPct":0.1}},
  {"id":"3070","nome":"Lágrima da Deusa","preco":400,"raridade":"basico","espaco":"acessorio","e":{"mana":240}},
  {"id":"3071","nome":"Cutelo Negro","preco":3000,"raridade":"lendario","espaco":"arma","e":{"ad":45,"vida":400}},
  {"id":"3072","nome":"Sedenta por Sangue","preco":3400,"raridade":"lendario","espaco":"arma","e":{"ad":80,"rv":0.15}},
  {"id":"3074","nome":"Hidra Raivosa","preco":3300,"raridade":"lendario","espaco":"arma","e":{"ad":65,"rv":0.12}},
  {"id":"3075","nome":"Armadura de Espinhos","preco":2450,"raridade":"lendario","espaco":"armadura","e":{"vida":150,"armadura":75}},
  {"id":"3076","nome":"Colete Espinhoso","preco":800,"raridade":"epico","espaco":"armadura","e":{"armadura":30}},
  {"id":"3077","nome":"Tiamat","preco":1200,"raridade":"epico","espaco":"arma","e":{"ad":25}},
  {"id":"3078","nome":"Força da Trindade","preco":3333,"raridade":"lendario","espaco":"arma","e":{"ad":36,"vida":333,"va":0.3}},
  {"id":"3083","nome":"Armadura de Warmog","preco":3100,"raridade":"lendario","espaco":"armadura","e":{"vida":1000,"regen":15}},
  {"id":"3084","nome":"Coração de Aço","preco":5500,"raridade":"mitico","espaco":"armadura","e":{"vida":1050,"regen":16}},
  {"id":"3085","nome":"Furacão de Runaan","preco":2650,"raridade":"lendario","espaco":"arma","e":{"va":0.4,"critico":0.25}},
  {"id":"3086","nome":"Zelo","preco":1200,"raridade":"epico","espaco":"acessorio","e":{"va":0.15,"critico":0.15}},
  {"id":"3089","nome":"Capuz da Morte de Rabadon","preco":3500,"raridade":"lendario","espaco":"cabeca","e":{"ap":130}},
  {"id":"3100","nome":"Perdição de Lich","preco":2900,"raridade":"lendario","espaco":"arma","e":{"ap":100}},
  {"id":"3102","nome":"Véu da Banshee","preco":3000,"raridade":"lendario","espaco":"mao","e":{"ap":105,"rm":40}},
  {"id":"3105","nome":"Égide da Legião","preco":1100,"raridade":"epico","espaco":"mao","e":{"armadura":25,"rm":25}},
  {"id":"3108","nome":"Códex Demoníaco","preco":850,"raridade":"epico","espaco":"mao","e":{"ap":25,"cdr":0.05}},
  {"id":"3111","nome":"Passos de Mercúrio","preco":1250,"raridade":"epico","espaco":"botas","e":{"vida":100,"rm":30}},
  {"id":"3113","nome":"Cintilação Etérea","preco":900,"raridade":"epico","espaco":"acessorio","e":{"ap":30}},
  {"id":"3116","nome":"Cetro de Cristal de Rylai","preco":2600,"raridade":"lendario","espaco":"arma","e":{"ap":65,"vida":400}},
  {"id":"3133","nome":"Martelo de Guerra de Caulfield","preco":1050,"raridade":"epico","espaco":"arma","e":{"ad":20}},
  {"id":"3135","nome":"Cajado do Vazio","preco":3000,"raridade":"lendario","espaco":"arma","e":{"ap":95}},
  {"id":"3140","nome":"Bandana de Mercúrio","preco":1300,"raridade":"epico","espaco":"cabeca","e":{"vida":120,"rm":30}},
  {"id":"3143","nome":"Presságio de Randuin","preco":2900,"raridade":"lendario","espaco":"armadura","e":{"vida":350,"armadura":75,"armPct":0.1}},
  {"id":"3144","nome":"Estilingue do Patrulheiro","preco":600,"raridade":"epico","espaco":"arma","e":{"va":0.2}},
  {"id":"3145","nome":"Alternador Hextec","preco":1100,"raridade":"epico","espaco":"arma","e":{"ap":45}},
  {"id":"3147","nome":"Máscara Assustadora","preco":1300,"raridade":"epico","espaco":"cabeca","e":{"ap":30,"vida":200}},
  {"id":"3152","nome":"Explocinturão Hextec","preco":2900,"raridade":"lendario","espaco":"armadura","e":{"ap":70,"vida":350,"apPct":0.05}},
  {"id":"3153","nome":"Espada do Rei Destruído","preco":3200,"raridade":"lendario","espaco":"arma","e":{"ad":40,"va":0.25,"rv":0.1}},
  {"id":"3156","nome":"Mandíbula de Malmortius","preco":3100,"raridade":"lendario","espaco":"acessorio","e":{"ad":60,"rm":40,"adPct":0.05}},
  {"id":"3157","nome":"Ampulheta de Zhonya","preco":3250,"raridade":"lendario","espaco":"acessorio","e":{"ap":105,"armadura":50}},
  {"id":"3158","nome":"Botas Ionianas da Lucidez","preco":900,"raridade":"epico","espaco":"botas","e":{"mana":150,"cdr":0.08}},
  {"id":"3165","nome":"Morellonomicon","preco":2850,"raridade":"lendario","espaco":"mao","e":{"ap":75,"vida":350}},
  {"id":"3168","nome":"Caminho Imortal","preco":2900,"raridade":"lendario","espaco":"botas","e":{"ad":40,"vida":250,"rv":0.12,"vidaPct":0.05}},
  {"id":"3170","nome":"Marcha Célere","preco":2800,"raridade":"lendario","espaco":"botas","e":{"vida":350,"armadura":35,"rm":35,"esquiva":0.05}},
  {"id":"3171","nome":"Lucidez Escarlate","preco":2800,"raridade":"lendario","espaco":"botas","e":{"ap":60,"mana":400,"cdr":0.15}},
  {"id":"3172","nome":"Grevas Bélicas","preco":3000,"raridade":"lendario","espaco":"botas","e":{"ad":30,"va":0.45,"rv":0.06,"adPct":0.06}},
  {"id":"3173","nome":"Esmagadores Acorrentados","preco":2800,"raridade":"lendario","espaco":"botas","e":{"vida":350,"rm":60,"rmPct":0.15}},
  {"id":"3174","nome":"Mobilização Blindada","preco":2800,"raridade":"lendario","espaco":"botas","e":{"vida":350,"armadura":60,"armPct":0.15}},
  {"id":"3175","nome":"Sapatos Enfeitiçados","preco":2900,"raridade":"lendario","espaco":"botas","e":{"ap":70,"penMag":0.15}},
  {"id":"3190","nome":"Medalhão dos Solari de Ferro","preco":2900,"raridade":"lendario","espaco":"acessorio","e":{"vida":300,"armadura":35,"rm":35,"vidaPct":0.06}},
  {"id":"3211","nome":"Capuz do Espectro","preco":1250,"raridade":"epico","espaco":"cabeca","e":{"vida":200,"rm":35}},
  {"id":"3742","nome":"Couraça do Defunto","preco":2900,"raridade":"lendario","espaco":"armadura","e":{"vida":350,"armadura":55}},
  {"id":"3748","nome":"Hidra Titânica","preco":3300,"raridade":"lendario","espaco":"arma","e":{"ad":40,"vida":600}},
  {"id":"3801","nome":"Braçadeira Cristalina","preco":800,"raridade":"epico","espaco":"acessorio","e":{"vida":200,"regen":2}},
  {"id":"3802","nome":"Capítulo Perdido","preco":1200,"raridade":"epico","espaco":"mao","e":{"ap":40,"mana":300,"cdr":0.05}},
  {"id":"3916","nome":"Orbe do Oblívio","preco":800,"raridade":"epico","espaco":"mao","e":{"ap":25}},
  {"id":"4629","nome":"Ímpeto Cósmico","preco":3000,"raridade":"lendario","espaco":"acessorio","e":{"ap":70,"vida":350,"cdr":0.15}},
  {"id":"4630","nome":"Joia da Ruína","preco":1100,"raridade":"epico","espaco":"acessorio","e":{"ap":25}},
  {"id":"4632","nome":"Barreira Verdejante","preco":1600,"raridade":"epico","espaco":"mao","e":{"ap":40,"rm":25}},
  {"id":"4633","nome":"Criafendas","preco":3100,"raridade":"lendario","espaco":"armadura","e":{"ap":80,"vida":350,"apPct":0.05}},
  {"id":"4645","nome":"Chama Sombria","preco":3200,"raridade":"lendario","espaco":"arma","e":{"ap":110}},
  {"id":"4646","nome":"Tempestade de Luden","preco":5500,"raridade":"mitico","espaco":"acessorio","e":{"ap":137}},
  {"id":"6333","nome":"Dança da Morte","preco":3300,"raridade":"lendario","espaco":"arma","e":{"ad":60,"armadura":50}},
  {"id":"6610","nome":"Céu Dividido","preco":3100,"raridade":"lendario","espaco":"arma","e":{"ad":40,"vida":400}},
  {"id":"6631","nome":"Quebrapassos","preco":3300,"raridade":"lendario","espaco":"arma","e":{"ad":40,"vida":450,"va":0.25}},
  {"id":"6653","nome":"Tormento de Liandry","preco":3000,"raridade":"lendario","espaco":"cabeca","e":{"ap":60,"vida":300}},
  {"id":"6655","nome":"Eco de Luden","preco":2750,"raridade":"lendario","espaco":"arma","e":{"ap":100,"mana":600}},
  {"id":"6670","nome":"Aljava Vespertina","preco":1300,"raridade":"epico","espaco":"mao","e":{"ad":15,"critico":0.2}},
  {"id":"6673","nome":"Arco-escudo Imortal","preco":3100,"raridade":"lendario","espaco":"mao","e":{"ad":55,"critico":0.25,"vidaPct":0.06}},
  {"id":"8020","nome":"Máscara Abissal","preco":2900,"raridade":"lendario","espaco":"cabeca","e":{"vida":450,"rm":55,"vidaPct":0.08}},
  {"id":"663056","nome":"Coroa do Rei Demoníaco","preco":3100,"raridade":"lendario","espaco":"cabeca","e":{"ad":40,"vida":350,"armadura":25,"adPct":0.04}},
  {"id":"664644","nome":"Coroa da Rainha Despedaçada","preco":3100,"raridade":"lendario","espaco":"cabeca","e":{"ap":70,"mana":600,"vida":250,"apPct":0.06}}
];
  // espólios (partes de monstro, só para vender): valor é o que o Lojista paga por unidade
  const ESPOLIOS = {"escudo-quebrado":{"nome":"Escudo Quebrado","valor":21},"po-arcano":{"nome":"Pó Arcano","valor":21},"engrenagem":{"nome":"Engrenagem de Cerco","valor":31},"pele-lobo":{"nome":"Pele de Lobo","valor":41},"presa-lobo":{"nome":"Presa de Lobo","valor":123},"pedra-krug":{"nome":"Pedra de Krug","valor":47},"cristal-azul":{"nome":"Cristal Azul","valor":61},"espinho":{"nome":"Espinho de Brambleback","valor":72},"escama-arraia":{"nome":"Escama de Arraia","valor":66},"quitina":{"nome":"Quitina do Vazio","valor":66},"escama-dragao":{"nome":"Escama de Dragão","valor":76},"garra-dragao":{"nome":"Garra de Dragão","valor":229},"olho-vazio":{"nome":"Olho do Vazio","valor":97},"chifre-arauto":{"nome":"Chifre do Arauto","valor":1958},"coracao-dragao":{"nome":"Coração de Dragão","valor":2220},"presa-barao":{"nome":"Presa do Barão","valor":2745},"escama-drake":{"nome":"Escama de Drake","valor":135},"essencia-elemental":{"nome":"Essência Elemental","valor":405},"coracao-anciao":{"nome":"Coração do Dragão Ancião","valor":4057},"placa-tropa":{"nome":"Placa de Super Tropa","valor":188},"cristal-inibidor":{"nome":"Cristal do Inibidor","valor":563},"fragmento-nexus":{"nome":"Fragmento do Nexus","valor":5370},"nucleo-inibidor":{"nome":"Núcleo do Inibidor","valor":4425},"estilhaco-nexus":{"nome":"Estilhaço do Nexus","valor":257},"pelo-gelo":{"nome":"Pelagem Gélida","valor":120},"colmilho-gelo":{"nome":"Colmilho Gélido","valor":361},"runa-xama":{"nome":"Runa do Xamã","valor":170},"pedra-troll":{"nome":"Pedra de Troll","valor":141},"escama-glacial":{"nome":"Escama Glacial","valor":162},"cristal-eterno":{"nome":"Cristal de Gelo Eterno","valor":211},"escama-drake-gelo":{"nome":"Escama de Drake de Gelo","valor":183},"essencia-inverno":{"nome":"Essência do Inverno","valor":550},"emblema-avarosa":{"nome":"Emblema de Avarosa","valor":183},"insignia-garra":{"nome":"Insígnia da Garra do Inverno","valor":183},"nucleo-vigia":{"nome":"Núcleo do Vigia","valor":266},"coracao-serpente":{"nome":"Coração da Serpente Glacial","valor":4215},"pele-ancestral":{"nome":"Pele do Yeti Ancestral","valor":4740},"nucleo-colosso":{"nome":"Núcleo do Colosso","valor":5265},"biscoito-poro":{"nome":"Biscoito de Poro","valor":361},"carvao-boneco":{"nome":"Carvão de Boneco de Neve","valor":169},"coroa-poro":{"nome":"Coroa do Poro Rei","valor":3165},"seda-vilemaw":{"nome":"Seda de Vilemaw","valor":397},"presa-vilemaw":{"nome":"Presa de Vilemaw","valor":3294},"pele-yeti":{"nome":"Pele de Yeti","valor":2000},"presa-gelo":{"nome":"Presa do Lobo do Gelo","valor":2500},"bigode-braum":{"nome":"Mecha do Bigode do Braum","valor":75000},"escama-rio":{"nome":"Escama do Caranguejo do Rio","valor":2602},"dente-tahm":{"nome":"Dente do Tahm Kench","valor":2780},"chapeu-tahm":{"nome":"Chapéu do Rei do Rio","valor":75000}};

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
  // o item ou o espólio pelo nome que o jogo escreve (chat, mochila); null se não for nenhum dos dois (runa, gema...)
  const itemPorNome = (nome) => ITENS.find((i) => i.nome === nome) || null;
  const espolioPorNome = (nome) => { const k = Object.keys(ESPOLIOS).find((id) => ESPOLIOS[id].nome === nome); return k ? { id: k, ...ESPOLIOS[k] } : null; };
  // quanto o Lojista paga por qtd unidades de um espólio (pelo id)
  const valorEspolio = (id, qtd = 1) => (ESPOLIOS[id] ? ESPOLIOS[id].valor * qtd : null);
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

  // ---------- ficha final da build (campeão, nível, atributos, itens com refino, qualidade e carta) ----------
  // Reescrita curta da conta do motor (atributos): o gerador confere cada número contra o motor em milhares de builds aleatórias.
  const CAMPEOES = {"darius":{"nome":"Darius","stats":{"hp":652,"hpperlevel":114,"mp":263,"mpperlevel":58,"armor":37,"armorperlevel":5.2,"spellblock":32,"hpregen":10,"hpregenperlevel":0.95,"mpregen":6.6,"mpregenperlevel":0.35,"attackspeed":0.625,"attackspeedperlevel":1},"adBase":64,"adNivel":3.9,"papel":{"dano":1.19},"kite":null,"distancia":false,"magia":false,"semMana":false,"fluxo":false,"critMult":1,"critDano":1,"critMonstro":1,"vaNivel":0,"critBase":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"penE":[0.2,0.23,0.26,0.29,0.32,0.35,0.38,0.41,0.43,0.45],"armPassiva":null,"maestria":null},"ezreal":{"nome":"Ezreal","stats":{"hp":600,"hpperlevel":102,"mp":375,"mpperlevel":70,"armor":24,"armorperlevel":4.2,"spellblock":33,"hpregen":4,"hpregenperlevel":0.65,"mpregen":8.5,"mpregenperlevel":1,"attackspeed":0.625,"attackspeedperlevel":2.5},"adBase":66,"adNivel":4.2,"papel":{"dano":1.12},"kite":{"recarga":1.6,"recuo":0.6,"gasto":0.25,"recupera":0.15,"pausa":0.2},"distancia":true,"magia":false,"semMana":false,"fluxo":false,"critMult":1,"critDano":1,"critMonstro":1,"vaNivel":0,"critBase":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"penE":null,"armPassiva":null,"maestria":null},"lux":{"nome":"Lux","stats":{"hp":580,"hpperlevel":99,"mp":440,"mpperlevel":23.5,"armor":21,"armorperlevel":5.2,"spellblock":30,"hpregen":5.5,"hpregenperlevel":0.55,"mpregen":9,"mpregenperlevel":0.8,"attackspeed":0.669,"attackspeedperlevel":3},"adBase":54,"adNivel":3.3,"papel":{"dano":1.59},"kite":{"recarga":1.8,"recuo":0.55,"gasto":0.25,"recupera":0.15,"pausa":0.2},"distancia":true,"magia":true,"semMana":false,"fluxo":false,"critMult":1,"critDano":1,"critMonstro":1,"vaNivel":0,"critBase":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"penE":null,"armPassiva":null,"maestria":null},"yasuo":{"nome":"Yasuo","stats":{"hp":590,"hpperlevel":110,"mp":100,"mpperlevel":0,"armor":32,"armorperlevel":4.6,"spellblock":32,"hpregen":6.5,"hpregenperlevel":0.9,"mpregen":0,"mpregenperlevel":0,"attackspeed":0.697,"attackspeedperlevel":3.5},"adBase":60,"adNivel":3.9,"papel":{"dano":1.15},"kite":null,"distancia":false,"magia":false,"semMana":false,"fluxo":true,"critMult":2,"critDano":0.8,"critMonstro":1,"vaNivel":0,"critBase":[0.1018,0.1036,0.1054,0.1072,0.109,0.1108,0.1126,0.1144,0.1162,0.118,0.1198,0.1216,0.1234,0.1252,0.127,0.1288,0.1306,0.1324,0.1342,0.136,0.1378,0.1396,0.1414,0.1432,0.145,0.1468,0.1486,0.1504,0.1522,0.154,0.1558,0.1576,0.1594,0.1612,0.163,0.1648,0.1666,0.1684,0.1702,0.172,0.1738,0.1756,0.1774,0.1792,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18,0.18],"penE":null,"armPassiva":null,"maestria":null},"katarina":{"nome":"Katarina","stats":{"hp":672,"hpperlevel":108,"mp":0,"mpperlevel":0,"armor":32,"armorperlevel":4.7,"spellblock":32,"hpregen":7.5,"hpregenperlevel":0.7,"mpregen":0,"mpregenperlevel":0,"attackspeed":0.658,"attackspeedperlevel":2.74},"adBase":58,"adNivel":3.4,"papel":{"dano":1.26},"kite":null,"distancia":false,"magia":true,"semMana":true,"fluxo":false,"critMult":1,"critDano":1,"critMonstro":1,"vaNivel":0,"critBase":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"penE":null,"armPassiva":null,"maestria":null},"taric":{"nome":"Taric","stats":{"hp":645,"hpperlevel":99,"mp":300,"mpperlevel":60,"armor":40,"armorperlevel":4.3,"spellblock":28,"hpregen":6,"hpregenperlevel":0.5,"mpregen":8.5,"mpregenperlevel":0.8,"attackspeed":0.625,"attackspeedperlevel":2},"adBase":55,"adNivel":3.3,"papel":{"dano":0.9},"kite":null,"distancia":false,"magia":true,"semMana":false,"fluxo":false,"critMult":1,"critDano":1,"critMonstro":1,"vaNivel":0,"critBase":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"penE":null,"armPassiva":[0.06,0.068,0.076,0.084,0.092,0.1,0.108,0.116,0.124,0.132],"maestria":null},"zac":{"nome":"Zac","stats":{"hp":685,"hpperlevel":109,"mp":0,"mpperlevel":0,"armor":33,"armorperlevel":5.2,"spellblock":32,"hpregen":5,"hpregenperlevel":0.5,"mpregen":0,"mpregenperlevel":0,"attackspeed":0.736,"attackspeedperlevel":1.6},"adBase":60,"adNivel":3.3,"papel":{"dano":1.55},"kite":null,"distancia":false,"magia":true,"semMana":true,"fluxo":false,"critMult":1,"critDano":1,"critMonstro":1,"vaNivel":0,"critBase":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"penE":null,"armPassiva":null,"maestria":null},"ryze":{"nome":"Ryze","stats":{"hp":620,"hpperlevel":124,"mp":300,"mpperlevel":70,"armor":22,"armorperlevel":4.7,"spellblock":32,"hpregen":8,"hpregenperlevel":0.8,"mpregen":8,"mpregenperlevel":1,"attackspeed":0.658,"attackspeedperlevel":2.11},"adBase":55,"adNivel":3.3,"papel":{"dano":1.1},"kite":{"recarga":1.8,"recuo":0.55,"gasto":0.25,"recupera":0.15,"pausa":0.2},"distancia":true,"magia":true,"semMana":false,"fluxo":false,"critMult":1,"critDano":1,"critMonstro":1,"vaNivel":0,"critBase":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"penE":null,"armPassiva":null,"maestria":{"poder":0.06,"manaPor100":0.1,"manaMax":0.5}},"aphelios":{"nome":"Aphelios","stats":{"hp":600,"hpperlevel":102,"mp":348,"mpperlevel":42,"armor":26,"armorperlevel":4.2,"spellblock":33,"hpregen":3.25,"hpregenperlevel":0.55,"mpregen":6.5,"mpregenperlevel":0.4,"attackspeed":0.665,"attackspeedperlevel":2.1},"adBase":60,"adNivel":4,"papel":{"dano":1.15},"kite":{"recarga":1.6,"recuo":0.6,"gasto":0.25,"recupera":0.15,"pausa":0.2},"distancia":true,"magia":false,"semMana":false,"fluxo":false,"critMult":1,"critDano":1,"critMonstro":0.75,"vaNivel":0.008,"critBase":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"penE":null,"armPassiva":null,"maestria":null}};
  const HABS = {"yasuo":{"Q":{"nivel":1,"max":10,"recarga":[4,3.85,3.7,3.55,3.4,3.25,3.1,2.95,2.8,2.65],"custo":[0,0,0,0,0,0,0,0,0,0],"base":[40,60,80,100,120,140,160,180,200,220],"ratio":[0.55,0.55,0.55,0.55,0.55,0.55,0.55,0.55,0.55,0.55],"fila":2,"cargas":2,"levanta":1,"minima":1.5,"minimaG":1},"W":{"nivel":1,"max":10,"recarga":[24,23.2,22.4,21.6,20.8,20,19.2,18.4,17.6,16.8],"custo":[0,0,0,0,0,0,0,0,0,0],"duracao":4,"reducao":[0.3,0.32,0.34,0.36,0.38,0.4,0.42,0.44,0.46,0.48]},"E":{"nivel":1,"max":10,"recarga":[3.5,3.35,3.2,3.05,2.9,2.75,2.6,2.45,2.3,2.15],"custo":[0,0,0,0,0,0,0,0,0,0],"base":[50,68,86,104,122,140,158,176,194,212],"ratio":[0.2,0.21,0.22,0.23,0.24,0.25,0.26,0.27,0.28,0.29],"acumula":0.25,"acumMax":2,"mesmoAlvo":6},"R":{"nivel":6,"max":5,"recarga":[70,60,50,42,35],"custo":[0,0,0,0,0],"base":[200,310,420,530,640],"ratio":[1,1.08,1.16,1.24,1.32],"penSuspiro":0.3,"duracaoPen":15,"segura":1},"G":{"nivel":8,"max":10,"recarga":[25,24,23,22,21,20,19,18,17,16],"custo":[0,0,0,0,0,0,0,0,0,0],"duracao":8,"va":[0.25,0.28,0.31,0.34,0.37,0.4,0.43,0.46,0.49,0.52]},"A":{"nivel":13,"max":10,"recarga":[12,11.5,11,10.5,10,9.5,9,8.5,8,7.5],"custo":[0,0,0,0,0,0,0,0,0,0],"base":[60,90,120,150,180,210,240,270,300,330],"ratio":[0.8,0.85,0.9,0.95,1,1.05,1.1,1.15,1.2,1.25],"levanta":1},"D":{"nivel":18,"max":10,"inquieta":[0.03,0.034,0.038,0.042,0.046,0.05,0.054,0.058,0.062,0.066],"acumMax":5,"duracaoInquieta":4},"F":{"nivel":23,"max":10,"recarga":[20,19.4,18.8,18.2,17.6,17,16.4,15.8,15.2,14.6],"custo":[0,0,0,0,0,0,0,0,0,0],"duracao":6,"pctCorte":[0.4,0.43,0.46,0.49,0.52,0.55,0.58,0.61,0.64,0.67],"alvosCorte":2},"T":{"nivel":28,"max":10,"recarga":[11,10.6,10.2,9.8,9.4,9,8.6,8.2,7.8,7.4],"custo":[0,0,0,0,0,0,0,0,0,0],"base":[70,105,140,175,210,245,280,315,350,385],"ratio":[0.9,0.94,0.98,1.02,1.06,1.1,1.14,1.18,1.22,1.26],"levanta":0.75,"raioArena":2.6},"B":{"nivel":33,"max":10,"recarga":[28,27,26,25,24,23,22,21,20,19],"custo":[0,0,0,0,0,0,0,0,0,0],"escudoPct":[0.12,0.14,0.16,0.18,0.2,0.22,0.24,0.26,0.28,0.3]},"M":{"nivel":38,"max":10,"recarga":[13,12.6,12.2,11.8,11.4,11,10.6,10.2,9.8,9.4],"custo":[0,0,0,0,0,0,0,0,0,0],"base":[110,165,220,275,330,385,440,495,550,605],"ratio":[1,1.06,1.12,1.18,1.24,1.3,1.36,1.42,1.48,1.54],"levanta":0.75,"alvos":4},"N":{"nivel":45,"max":5,"recarga":[90,80,70,62,55],"custo":[0,0,0,0,0],"duracao":2.5,"golpes":10,"base":[60,90,120,150,180],"ratio":[0.5,0.56,0.62,0.68,0.74]}},"aphelios":{"Q":{"nivel":1,"max":10,"recarga":[6,5.8,5.6,5.4,5.2,5,4.8,4.6,4.4,4.2],"custo":[28,29.5,31,32.5,34,35.5,37,38.5,40,41.5],"base":[50,80,110,140,170,200,230,260,290,320],"ratio":[1,1.05,1.1,1.15,1.2,1.25,1.3,1.35,1.4,1.45]},"W":{"nivel":1,"max":10,"recarga":[1,1,1,1,1,1,1,1,1,1],"custo":[0,0,0,0,0,0,0,0,0,0],"va":[0.2,0.23,0.26,0.29,0.32,0.35,0.38,0.41,0.44,0.47],"dura":2},"E":{"nivel":1,"max":10,"recarga":[7,6.8,6.6,6.4,6.2,6,5.8,5.6,5.4,5.2],"custo":[28,29.5,31,32.5,34,35.5,37,38.5,40,41.5],"base":[45,70,95,120,145,170,195,220,245,270],"ratio":[0.8,0.84,0.88,0.92,0.96,1,1.04,1.08,1.12,1.16]},"R":{"nivel":6,"max":5,"recarga":[100,90,80,70,60],"custo":[100,100,100,100,100],"base":[200,300,400,500,600],"ratio":[0.9,1,1.1,1.2,1.3],"curaSev":[0.02,0.025,0.03,0.035,0.04],"lentoGrav":3.5,"infernum":0.5,"discos":3},"G":{"nivel":8,"max":10,"recarga":[24,23.2,22.4,21.6,20.8,20,19.2,18.4,17.6,16.8],"custo":[40,42,44,46,48,50,52,54,56,58],"duracao":8,"va":[0.2,0.225,0.25,0.275,0.3,0.325,0.35,0.375,0.4,0.425]},"A":{"nivel":13,"max":10,"recarga":[12,11.5,11,10.5,10,9.5,9,8.5,8,7.5],"custo":[35,37,39,41,43,45,47,49,51,53],"base":[60,90,120,150,180,210,240,270,300,330],"ratio":[0.8,0.85,0.9,0.95,1,1.05,1.1,1.15,1.2,1.25],"atordoa":1},"D":{"nivel":18,"max":10,"troca":[0.35,0.4,0.45,0.5,0.55,0.6,0.65,0.7,0.75,0.8]},"F":{"nivel":23,"max":10,"recarga":[24,23.2,22.4,21.6,20.8,20,19.2,18.4,17.6,16.8],"custo":[40,43,46,49,52,55,58,61,64,67],"escudoVida":[0.1,0.11,0.12,0.13,0.14,0.15,0.16,0.17,0.18,0.19],"escudoAd":0.6},"T":{"nivel":28,"max":10,"recarga":[12,11.6,11.2,10.8,10.4,10,9.6,9.2,8.8,8.4],"custo":[45,49,53,57,61,65,69,73,77,81],"base":[60,90,120,150,180,210,240,270,300,330],"ratio":[0.7,0.74,0.78,0.82,0.86,0.9,0.94,0.98,1.02,1.06],"lento":1.5},"B":{"nivel":33,"max":10,"recarga":[30,29,28,27,26,25,24,23,22,21],"custo":[60,62,64,66,68,70,72,74,76,78],"duracao":8,"parte":0.5,"manaSeg":0.02},"M":{"nivel":38,"max":10,"recarga":[14,13.5,13,12.5,12,11.5,11,10.5,10,9.5],"custo":[50,53,56,59,62,65,68,71,74,77],"base":[40,60,80,100,120,140,160,180,200,220],"ratio":[0.45,0.48,0.51,0.54,0.57,0.6,0.63,0.66,0.69,0.72],"intervalo":0.2},"N":{"nivel":45,"max":5,"recarga":[80,72,64,57,50],"custo":[100,100,100,100,100],"duracao":3,"cada":0.5,"base":[150,210,270,330,390],"ratio":[0.55,0.61,0.67,0.73,0.79]}}};                         // habilidades por rank dos campeões calibrados no farm (recarga, base, ratio, va, duração...)
  const CARTA_VALOR = {"ataque1":0.02,"ataque2":0.05,"ataque3":0.1,"poder1":0.02,"poder2":0.05,"poder3":0.1,"vida1":0.02,"vida2":0.05,"vida3":0.1,"armadura1":0.02,"armadura2":0.05,"armadura3":0.1,"rm1":0.02,"rm2":0.05,"rm3":0.1,"velocidade1":0.02,"velocidade2":0.05,"velocidade3":0.1,"critico1":0.02,"critico2":0.05,"critico3":0.1,"roubo1":0.02,"roubo2":0.05,"roubo3":0.1,"vampirismo1":0.015,"vampirismo2":0.035,"vampirismo3":0.07,"recarga1":0.01,"recarga2":0.025,"recarga3":0.05};              // "ataque2" (Carta de Ataque Rara): 0,05; crítico e roubo de vida somam em pontos
  const NIVEL_DIF = {"livre":4,"danoMonstro":0.35,"maxDanoMonstro":5,"danoJogador":0.12,"minDanoJogador":0.25};                  // monstro mais de "livre" níveis acima do jogador aguenta mais (danoJogador por nível, piso minDanoJogador)
  const TETO_VIDA_ITEM = 3, RM_MONSTRO = 0.6, VEL_ATAQUE_MAX = 3, FOCO_DANO_HAB = 0.002, FOCO_FLUXO = 0.01, FLUXO_MAX = 100;
  const DT = 0.05;                                  // o combate do jogo roda em passos fixos de 0,05 s
  const ARMADURA_MONSTRO = (n) => 5 + 1.5 * n;      // armadura-base do monstro de nível n (vezes o "ar" de cada monstro)
  const PCT_ITEM = ['adPct', 'apPct', 'vidaPct', 'armPct', 'rmPct', 'esquiva', 'penMag', 'penArm', 'critDano'];      // % do total: não mudam com refino nem qualidade
  const crescimento = (n) => { const m = Math.min(n, 18); return (m - 1) * (0.7025 + 0.0175 * (m - 1)) + Math.max(0, n - 18); };
  const CARTA_TIPOS = ["ataque","poder","vida","armadura","rm","velocidade","critico","roubo","vampirismo","recarga"];
  const CARTA_TIPO = (id) => id.replace(/[1-3]$/, '');
  const refinoDe = (x) => +((/\+(\d+)/.exec(String(x)) || [])[1] || 0);
  const qualDe = (x) => (/~(SS|S|A|B|C|\?)$/.exec(String(x)) || [])[1] || 'B';      // sem marca vale B
  const cartaDe = (x) => { const m = /#([a-z]+[1-3])/.exec(String(x)); return m && Object.hasOwn(CARTA_VALOR, m[1]) ? m[1] : null; };
  // o texto do item como o jogo escreve: "3031+4#ataque2~B"
  const chaveItem = (it) => (typeof it === 'string' ? it : String(it.id) + (it.refino > 0 ? '+' + it.refino : '') + (it.carta ? '#' + it.carta : '') + (it.qual ? '~' + it.qual : ''));
  // quantos passos de 0,05 s o relógio do ataque leva até zerar. O relógio reinicia em 1 / velocidade SEM guardar a sobra, então a
  // velocidade rende em DEGRAUS (período = nº de passos x 0,05 s). mult = aceleração por fora do teto (soma de bônus + 1).
  function periodoAtaque(velAtaque, mult) {
    let x = 1 / velAtaque, n = 0;
    while (x > 0 && n < 10000) { x -= DT * (mult || 1); n++; }
    return +(n * DT).toFixed(6);
  }
  // aceleração do relógio que não passa pela ficha e vale o tempo todo lutando (mesma ordem de soma do motor): passiva do Aphelios,
  // Fago (+8%) e Dançarina Fantasma (+6% por acúmulo, até 5)
  const aceleracaoFixa = (C, nivel, tem) => 1 + (tem('3044') ? 0.08 : 0) + 0 + 0.06 * (tem('3046') ? 5 : 0) + C.vaNivel * nivel;
  // build = { campeao, nivel, atrib: { forca, vitalidade, resistencia, agilidade, foco }, itens: ["3031+4#ataque2~B" ou { id, refino, qual, carta }],
  //           ranks: { E, W } (só o Darius e o Taric usam), bonus: { ad, vida, armadura, rm } (conquistas e mascote, em fração) }
  function fichaDaBuild(build) {
    const C = CAMPEOES[build.campeao] || CAMPEOES.darius, b = C.stats, nivel = build.nivel, g = crescimento(nivel);
    const at = { forca: 0, vitalidade: 0, resistencia: 0, agilidade: 0, foco: 0, ...build.atrib }, ranks = build.ranks || {}, bc = { ad: 0, vida: 0, armadura: 0, rm: 0, ...build.bonus };
    const chaves = (build.itens || []).map(chaveItem), itensOk = chaves.filter((x) => item(x));
    let ad = C.adBase + C.adNivel * g, vida = b.hp + b.hpperlevel * g, armadura = b.armor + b.armorperlevel * g, rm = b.spellblock + 3.5 * g, va = 0, rv = 0;
    const baseAd = ad, baseVida = vida, baseArmadura = armadura;
    let critico = 0, danoCritico = 1.75, regenItens = 0, cdrItens = 0, ap = 0, manaItens = 0;
    const pct = Object.fromEntries(PCT_ITEM.map((p) => [p, 0]));
    if (C.magia) ap += 2 * at.forca; else ad += 1.2 * at.forca;
    vida += 20 * at.vitalidade; armadura += 1.5 * at.resistencia; rm += 1 * at.resistencia; va += 0.008 * at.agilidade;
    const cv = Object.fromEntries(CARTA_TIPOS.map((t) => [t, 0]));
    for (const x of itensOk) {
      const e = item(x).e, m = (1 + BONUS_REFINO * refinoDe(x)) * (QUALIDADES[qualDe(x)]?.mult || 1), v = (k) => (e[k] || 0) * m;
      ad += v('ad'); ap += v('ap'); manaItens += v('mana'); vida += v('vida'); armadura += v('armadura'); rm += v('rm'); va += v('va'); rv += v('rv'); critico += v('critico');
      regenItens += v('regen'); cdrItens += v('cdr');
      for (const p of PCT_ITEM) pct[p] += e[p] || 0;
      const cc = cartaDe(x); if (cc) cv[CARTA_TIPO(cc)] += CARTA_VALOR[cc];
    }
    vida *= 1 + pct.vidaPct + cv.vida;
    const wArm = C.armPassiva && ranks.W ? C.armPassiva[ranks.W - 1] : 0;
    const tem = (id) => itensOk.some((x) => baseId(x) === id);
    if (tem('2501')) ad += 0.02 * (vida - baseVida);
    if (tem('3031')) danoCritico += 0.4;
    danoCritico += pct.critDano;
    const penE = C.penE && ranks.E ? C.penE[ranks.E - 1] : 0;
    let manaMax = C.fluxo ? FLUXO_MAX : C.semMana ? 0 : b.mp + b.mpperlevel * g + 8 * at.foco + manaItens;
    if (C.maestria) {
      const extra = manaMax * Math.min(C.maestria.manaMax, C.maestria.manaPor100 * ap / 100);
      manaMax += extra;
      ap += C.maestria.poder * (8 * at.foco + manaItens + extra);
    }
    if (tem('3003')) ap += 0.03 * manaMax;
    if (tem('3089')) ap *= 1.35;
    ad *= 1 + pct.adPct + cv.ataque; ap *= 1 + pct.apPct + cv.poder; armadura *= 1 + pct.armPct + wArm + cv.armadura; rm *= 1 + pct.rmPct + cv.rm;
    ad *= 1 + bc.ad; ap *= 1 + bc.ad; vida *= 1 + bc.vida; armadura *= 1 + bc.armadura; rm *= 1 + bc.rm;
    const velAtaque = Math.min(VEL_ATAQUE_MAX, b.attackspeed * (1 + (b.attackspeedperlevel / 100) * g + va) * (1 + cv.velocidade));
    const acel = aceleracaoFixa(C, nivel, tem), periodo = periodoAtaque(velAtaque, acel);
    return {
      ad, baseAd, bonusAd: ad - baseAd, vida, bonusVida: vida - baseVida, armadura, bonusArmadura: armadura - baseArmadura, rm, ap,
      penMagica: Math.min(0.6, (tem('3135') ? 0.4 : 0) + pct.penMag), mana: manaMax,
      danoHab: C.semMana ? FOCO_DANO_HAB * at.foco : 0, fluxoMult: C.fluxo ? 1 + FOCO_FLUXO * at.foco : 1,
      regenMana: C.fluxo || C.semMana ? 0 : ((b.mpregen + b.mpregenperlevel * g) / 5) * 3 + 0.06 * at.foco,
      velAtaque, aceleracao: acel, periodoAtaque: periodo, velEfetiva: 1 / periodo,
      regen: (b.hpregen + b.hpregenperlevel * g) / 5 + 0.1 * at.vitalidade + regenItens,
      esquiva: Math.min(0.25, 0.0025 * at.agilidade + pct.esquiva),
      reducaoRecarga: Math.min(0.4, Math.min(0.3, 0.004 * at.foco) + cdrItens + (cv.recarga || 0)),
      rouboVida: rv + cv.roubo, vampirismo: cv.vampirismo || 0,
      penArmadura: 1 - (1 - penE) * (tem('3036') ? 0.7 : 1) * (1 - pct.penArm),
      criticoBruto: (critico + cv.critico + (C.critBase[nivel - 1] || 0)) * C.critMult,      // antes do teto de 100%
      critico: Math.min(1, (critico + cv.critico + (C.critBase[nivel - 1] || 0)) * C.critMult), danoCritico: danoCritico * C.critDano,
      tem,
    };
  }
  // o dano do jogador cai contra monstro mais de "livre" níveis acima dele
  const fatorDanoJogador = (nivel, nivelMonstro) => { const d = Math.max(0, nivelMonstro - nivel - NIVEL_DIF.livre); return d ? Math.max(NIVEL_DIF.minDanoJogador, 1 - NIVEL_DIF.danoJogador * d) : 1; };
  const FARM = {"kHab":{"yasuo":0.9,"aphelios":0.7},"aoe":{"yasuo":0.2,"aphelios":0.25},"upt":{"yasuo":{"G":1,"W":1},"aphelios":{"G":1.4,"W":0.4}},"kiteGrupo":{"yasuo":1.75,"aphelios":7},"castEf":{"yasuo":0.8,"aphelios":0.4},"vaHab":{},"liberado":{"yasuo":true,"aphelios":true}};      // parâmetros do modelo de farm (calculos.js: estimarFarm), calibrados pelo gerador contra a simulação do motor

  return { meta, NIVEL_MAX, REFINO_MAX, BONUS_REFINO, RITMO_REAL, CHANCE_REFINO, REGRESSAO_REFINO, PERSISTENCIA, VIP, DROP_CHEFE, ABATES_MIN_ZONA, TAREFA_TIPOS, QUALIDADES, ORDEM_QUAL,
    XP_NIVEL, BALANCO, MONSTROS, ZONAS, ITENS, ESPOLIOS, ZONA, CURVA, CAMPEOES, HABS, CARTA_VALOR, CARTA_TIPOS, NIVEL_DIF, TETO_VIDA_ITEM, RM_MONSTRO, VEL_ATAQUE_MAX, DT, FARM, fichaDaBuild, periodoAtaque, chaveItem, refinoDe, qualDe, cartaDe, fatorDanoJogador, ARMADURA_MONSTRO, xpParaNivel, xpEntre, fatorXp, porAbateZona, zonaIdeal, item, valorVenda, itemPorNome, espolioPorNome, valorEspolio, precoRefino, chanceRefino, chanceForja, recompensaTarefa };
})();
if (typeof module !== 'undefined') module.exports = JOGO;
