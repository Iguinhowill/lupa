# Lupa (app de PC) · arquitetura

App Electron 44.7.0 que mostra o LoL Idle (lolidle.com) com duas contas (em abas ou lado a lado) e o painel da Lupa ao lado. Mesma
regra da extensão: **lê a tela**, nunca compra, vende ou faz pedido ao servidor do jogo por fora. Liberado pelo dono do
jogo (Brunox) em 26/10/2026: não dá vantagem, só otimiza a jogabilidade. A única exceção são as duas **ações que o
jogador pede** (seção abaixo): o botão "Entregar e seguir" e o Alt+L, liberados por ele em 27/10/2026, inclusive
passando pela proteção contra bots do jogo, e as **missões automáticas** (a mesma entrega, pedida pelo app quando a
tarefa fica pronta, se o jogador ligar a opção; teste pedido pelo Brunox em 29/10/2026). O **Onde gastar o ouro** (seção própria) baixa os arquivos públicos do motor do
jogo (os mesmos `lolidle.com/js/*.js` que a página carrega) para simular compras numa página isolada; não manda nada da conta
e não fala com a API do jogo (o simulador do comparador de builds foi aprovado pelo Brunox em 27/10/2026).

O código da Lupa (pasta `../lupa`, que continua sendo também a extensão do Chrome) é reaproveitado sem cópia manual:
`copiar-lupa.mjs` copia para `app/lupa/` e gera `app/gerado/preload-jogo.js`. As duas pastas são geradas (fora do git).

## Arquivos

| Arquivo | Onde roda | O que faz |
|---|---|---|
| `main.js` | processo principal | janela, modos (WebContentsView), armazém, envio.js num `vm`, avisos, bandeja, alertas das abas, atalhos, memória da janela, PC acordado, atualização |
| `layout.js` | processo principal | contas puras: retângulos de cada view por modo, zoom automático por metade, zoom guardado, janela ainda visível num monitor; casos em `layout.test.js` |
| `alertas.js` | processo principal | puro: alertas de uma conta a partir do `estado:<nome>` (tarefa, mochila, pontos, prêmio, sem leitura) e notas da versão em texto puro; casos em `alertas.test.js` |
| `atalhos.js` | processo principal | puro: quais teclas são do app (`atalhoDe`) e a lista mostrada no menu; casos em `alertas.test.js` |
| `acoes.js` | processo principal | puro: as regras das ações que o jogador pede (tempo e número de entradas por pedido), o ponto do clique com o zoom, as entradas de clique e tecla e quando as missões automáticas podem tentar (`autoMotivo`, `autoDepois`); casos em `acoes.test.js` |
| `oferta.js` | preload das abas do jogo | puro: lê o texto das ofertas do Capitão (quantidade, tempo, XP, ouro, zona), o ritmo do jogador por zona (as sessões `cacada:<nome>`) e escolhe a de mais XP por hora caçando com ela; casos em `acoes.test.js` |
| `gastar.js` | processo principal | puro: o Onde gastar o ouro. Lê a build da ficha, monta as compras (forja +1, carta, item do Mercado, item da mochila, reset de atributos), pede os combates ao simulador em duas etapas e resume quanto cada uma rende e em quantas horas se paga; casos em `gastar.test.js` |
| `treino.js` | processo principal | puro: os Pontos e barra. Para onde vão os pontos dos próximos 5 níveis (todos numa habilidade ou num atributo) e qual combinação de 4 habilidades aprendidas rende mais na barra, no mesmo simulador; casos em `treino.test.js` |
| `simulador.js` | processo principal | baixa o motor público do jogo para `userData/motor-jogo/` (de 6 em 6 h, se pedir) e roda os combates dele numa janela escondida e isolada (`lupasim://`, sessão em memória, sandbox, sem rede) |
| `sim/sim.html`, `sim/sim.js`, `sim/sim-trabalho.js` | janela escondida do simulador | distribui os combates entre alguns Web Workers, que importam o motor e rodam a caçada (sem chefes nem monstro furioso, como o `gerar-tabelas.mjs` do site) |
| `acao-jogo.js` | preload das abas do jogo | a sequência do "Entregar e seguir" (do botão ou das missões automáticas) e a setinha do Alt+L: confere a tela, pede cada clique ou tecla ao main e grava o andamento em `acao:<nome>` |
| `armazem.js` | processo principal | o `chrome.storage.local` do app: um JSON em `userData/lupa-dados.json`, gravado 1,5 s depois da última mudança e no máximo 10 s depois da primeira; a versão anterior fica em `.bak`, lida se o principal estiver estragado; casos em `armazem.test.js` |
| `regras.js` | processo principal | regras de navegação da aba do jogo e das janelas de login (`DA_CONTA`, `DO_JOGO`, `NO_LOGIN`, `DO_GOOGLE`, `permitido`); casos em `regras.test.js`, rodar com `npm test` |
| `shim-jogo.js` | preload das abas do jogo | o objeto `chrome` que o `content.js` usa (só no mundo isolado, nunca exposto à página) |
| `gerado/preload-jogo.js` | preload das abas do jogo | `shim-jogo.js` + `../lupa/content.js` + `oferta.js` + `acao-jogo.js`, rodando no DOMContentLoaded só em lolidle.com |
| `preload-lupa.js` | painel e Central | expõe `window.lupaChrome` (o mesmo `chrome` da extensão) e `window.lupaApp` |
| `preload-casca.js` | barra de abas | expõe `window.lupaCasca` |
| `casca.html/.css/.js` | barra de abas | abas com ponto de alerta, etiquetas do lado a lado, botão Painel, recarregar, atualizar, menu de ajustes (⚙) |
| `copiar-lupa.mjs` | build (`npm run preparar`) | copia `../lupa` para `app/lupa`, injeta `app-chrome.js` nas páginas e gera o preload do jogo |

Todos os webPreferences: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Preload em sandbox só
pode dar `require('electron')` (ipcRenderer, contextBridge).

## Janela

`BaseWindow` com `WebContentsView`s:

- **casca**: faixa no topo, 44 px de altura (66 px no lado a lado: ganha uma fileira de 22 px com as etiquetas), largura toda
  (`casca.html`). Fundo transparente: com o menu de ajustes aberto (`casca:menu`) a casca cobre a janela toda e sobe para o
  topo, e a "cortina" transparente fecha o menu ao clicar fora (a view da casca é a única que pode ficar sobre um jogo).
- **jogo** (uma por conta, `conta1` e `conta2`): partição `persist:conta1`/`persist:conta2` (login separado), carrega
  `https://lolidle.com/jogar`. Ocupa a área abaixo da casca, menos o painel. Com "Usar só a Conta 1" a view da Conta 2 nem
  é criada (e é destruída se já existia). A economia de segundo plano do Chromium
  fica ligada: o jogo caça escondido pelo relógio próprio dele, e o Mercado aberto atualiza ~1 vez por minuto.
  A aba só navega na origem exata do jogo e nos logins; o resto abre no navegador do sistema. Todo link
  (`will-navigate`) e todo redirecionamento (`will-redirect`) é conferido, contra o endereço atual da cadeia: a aba
  não tem barra de endereço, e um redirecionamento aberto levaria qualquer página para dentro dela. Entre páginas de
  login (`NO_LOGIN` no `regras.js`: contas do Google, accounts.youtube.com, o login da Twitch, o OAuth e o login do
  Discord) o salto segue. As mesmas regras (`proteger`) valem para cada janela de login que o jogo abre
  (`target=_blank` que bate com `DA_CONTA`, na mesma partição); uma janela de login não abre outra, e a que nem chega a
  mostrar nada fecha sozinha.
  Limitações aceitas: login corporativo com provedor de fora (SSO de empresa no Google) abre no navegador; a partir do
  `/login` da Twitch, o site dela troca de página por `pushState`, que não passa pelo filtro.
- **login do Google**: o Google recusa login em Chromium embutido. Nas páginas do Google (e youtube.com, que entra
  na cadeia do login) o app é um Firefox: o `main.js` troca o User-Agent e tira os cabeçalhos `sec-ch-ua*`, e o
  `shim-jogo.js` faz o JavaScript da página ver o mesmo Firefox (sem `userAgentData` nem `window.chrome`), de forma
  síncrona antes do primeiro script da página (`contextBridge.executeInMainWorld`, UA pelo canal `lupa:uaFirefox`).
  Não chamar `setUserAgent` no `did-redirect-navigation`: no Electron 44 isso trava o processo principal. Limitação
  conhecida: o disfarce vale só no frame principal; iframes e workers da página ainda veem o Chromium. Se o Google
  voltar a recusar o login, a próxima pista é essa.
- **painel**: `lupa/painel.html`, à direita (320, 380 ou 520 px, `larguraPainel`), aparece nos modos de jogo e no lado a lado.
  Cada um tem a sua chave: `painelAberto` (uma conta sozinha, começa aberto) e `painelLado` (começa escondido).
- **central**: `lupa/central.html`, área toda abaixo da casca, só na aba Central.
- **mini janela**: `BrowserWindow` 380×620 sempre por cima, `lupa/central.html#mini` (preload-lupa).

Modos (as abas da casca): `conta1 | conta2 | lado | central` (`pref.ativa`). Sem a Conta 2 (`soConta1`) ficam `conta1 | central`.
O rótulo de um jogo começa "Conta 1"/"Conta 2" e vira o nome do personagem quando a Lupa lê a ficha (a gravação de
`estado:<nome>` vinda daquela aba diz quem é; fica em `pref.nomes`).

### Lado a lado

As duas contas na mesma tela, metade e metade, com 1 px de filete entre elas (o fundo da janela). Cada metade tem uma
etiqueta (nome + ponto de alerta, a da metade em foco em ouro) desenhada **na casca**, nunca dentro do jogo. O jogo troca
para o layout compacto abaixo de 1001 px CSS, então cada jogo ganha `setZoomFactor(min(1, largura / 1010) × ajuste)`.
O ajuste (Ctrl +/−/0) fica em `pref.zoom` por grupo de modo: `solo` (Conta 1 ou 2), `lado` (multiplica o automático) e
`central`; sair do lado a lado devolve o zoom de `solo`. O painel começa escondido; Ctrl+B o mostra à direita, estreitando
as metades, com o personagem da metade que teve o último foco (evento `focus` do webContents → `lupa:escolher`).
Todas as contas de retângulo e zoom ficam no `layout.js` (puro, testado).

### Bandeja

Ícone `icone.png`; menu: Mostrar, Conta 1, Conta 2 (com os nomes), Lado a lado, Central, Sair; duplo clique mostra a
janela. Por padrão o X da janela **esconde na bandeja** (a primeira vez, um aviso diz "A Lupa continua rodando na
bandeja"); a opção `fecharParaBandeja` do menu de ajustes desliga isso. Fecham de verdade: "Sair", a instalação de
atualização (`saindo = true` antes do `quitAndInstall`), o fim da sessão do Windows e `app.quit()`. O `before-quit` grava
a janela, o `pref` e o armazém.

### Alertas e avisos

`alertas.js` calcula, do último `estado:<nome>` de cada conta, a lista `[{ tipo, texto }]`: `tarefa` (tarefa pronta),
`mochila` (≥ 90%), `pontos` (livres de habilidade ou atributo), `premio` (`rastreio.login` pendente) e `sem-leitura`
(`ts` há mais de 3 min, contados desde a abertura do app). Recalculado a cada estado novo e a cada 30 s. A casca mostra um
ponto com tooltip na aba e na etiqueta; a soma vira o selo da barra de tarefas (`setOverlayIcon`, um ponto BGRA desenhado
no código) e some quando zera. Campos que faltam em estados antigos são ignorados.
Avisos (`lupa:mensagem` tipo `aviso`): título com o nome do personagem da aba; sem aviso quando a janela está em foco e a
conta está à vista (aba ativa ou lado a lado); sem foco, `flashFrame(true)` até a janela ganhar foco.
`lupaAvisar(id, titulo, texto)` está no contexto do `vm` do `envio.js` (alerta de preço novo): aviso sem aba, o clique só
mostra a janela.

### Atalhos

`before-input-event` em todas as views (casca, jogos, painel, Central), com `preventDefault` **só** nas teclas abaixo; o
resto chega ao jogo normalmente. Fora das ações que o jogador pede e das missões automáticas (abaixo), o app não envia
tecla, clique ou comando ao jogo.

| Tecla | Ação |
|---|---|
| Ctrl+1 / Ctrl+2 | Conta 1 / Conta 2 |
| Ctrl+3 | Lado a lado |
| Ctrl+4 | Central |
| Ctrl+Tab (Ctrl+Shift+Tab) | próxima (anterior) aba |
| Ctrl+B | mostrar/esconder o painel do modo atual |
| Alt+L | aperta a setinha do próprio jogo que esconde ou mostra a coluna da direita (na aba ativa; no lado a lado, a metade em foco) |
| F5 | recarregar o jogo da aba (no lado a lado, o da metade em foco) |
| Ctrl + / Ctrl − / Ctrl 0 | zoom do modo atual (passo de 10%, 0 volta ao padrão) |

### Memória da janela e dados de teste

`pref` (`app:pref` no armazém) guarda: `ativa`, `painelAberto`, `painelLado`, `larguraPainel`, `fecharParaBandeja`, `avisouBandeja`,
`soConta1`, `zoom`, `nomes` e `janela` (`{ x, y, width, height, maximizada }`, gravada 0,6 s depois da última mudança; na
volta só vale se couber em algum monitor). Para rodar o app sem tocar nas contas de verdade: `LUPA_DADOS=<pasta>` troca o
`userData` (login, sessão do Lupa Online, armazém), só fora do pacote (`!app.isPackaged`).

## Ações que o jogador pede

Duas, e só quando o jogador pede (liberadas pelo Brunox em 27/10/2026, que pediu que passassem pela proteção contra bots
do jogo, a "p751": clique, change e input com `isTrusted` falso são ignorados e contados como "clique-falso" no servidor).
Por isso cada clique ou tecla é uma entrada de verdade, `webContents.sendInputEvent`, no ponto do botão do próprio jogo.

- **Entregar e seguir** (botão da aba Tarefa do painel, `lupa:acao` tipo `tarefa`): o main troca para a aba do personagem
  (se não estiver à vista), autoriza aquela aba (`acoes.js`: 4 min e até 24 entradas: até 9 passos, cada um podendo repetir a entrada uma vez) e manda `acao:iniciar`. O
  `acao-jogo.js` confere na tela que a tarefa está pronta (classe `pronta` do `#rastreio-tarefa`; a leitura da Lupa pode
  estar até 5 s atrasada), volta à Fonte (o botão Voltar, ou a tecla B com a coluna escondida) e espera chegar, clica no
  rastreio (o personagem anda até o Capitão), em "entregar", em "tarefa", na oferta que mais rende no ritmo do jogador
  (`oferta.js`: XP por hora caçando com ela, abates mais prêmio, com 1 min de custo por entrega, pelo ritmo medido em cada
  zona nas sessões dos últimos 7 dias, XP sem live; zona sem medição só entra se nenhuma tiver; empate até 1% fica com a
  mais curta; o tempo que o jogo mostra supõe o mesmo ritmo em toda zona),
  abre o mapa (o botão ou a tecla M), clica na zona e no "Ir", e espera chegar. Cada passo espera a tela mudar (com prazo);
  se nada mudou no prazo e o botão continua ali, repete a entrada uma vez. Prazos: 1,5 s em "entregar", "tarefa", na
  oferta, na zona e no "Ir"; 2,5 s no mapa (botão ou M, que abrem e fecham); 3 s no rastreio (o personagem anda); 5 s na
  volta à Fonte (botão ou B). Repetir é seguro: "entregar", "tarefa" e a oferta somem no instante em que o clique pega (só repetem
  se ele se perdeu), voltar já voltando, falar de novo com o Capitão, escolher a zona de novo e a viagem repetida não mudam
  nada no jogo. A aba Missões (abre e fecha) não repete. O primeiro passo que falha para tudo e vira o erro no painel. O andamento vai para `acao:<nome>` no armazém
  (`{ tipo, estado: 'rodando' | 'ok' | 'erro' | 'parado' | 'espera', texto, auto, em }`; `espera` e `auto` são das missões
  automáticas, abaixo). O Parar (`lupa:acao` tipo `parar`) interrompe.
- **Alt+L**: autoriza a aba ativa por 5 s e 1 entrada; o `acao-jogo.js` clica no `#bt-esconder-coluna` do jogo.

Uma ação por vez entre as contas (`acaoAtual` no main): no lado a lado, duas juntas disputariam o foco entre o apertar e o
soltar do mouse. Um pedido com outra em andamento é recusado ("Já tem uma ação em andamento…"; o Alt+L é ignorado), sem
trocar nem renovar a autorização da primeira. A autorização some no `acao:fim`, no Parar, ao fechar a Conta 2 e se a
página do jogo recarregar ou cair no meio (aí o `acao:<nome>` vira erro com o motivo, gravado só depois que a página velha
saiu, e o painel não fica parado em "rodando"). Durante a ação o teclado fica no jogo dela (as teclas precisam do foco, e o
painel avisa); no fim, se ele ainda está lá, volta para quem o tinha antes da última entrada (o painel do botão, ou a outra
metade do lado a lado se a pessoa foi digitar lá no meio).

### Missões automáticas

Opção da aba Ajustes do painel (só no app), desligada por padrão: "Entregar e seguir sozinho quando a tarefa ficar pronta
(teste)", `config.autoTarefa`. Pedida pelo Brunox em 29/10/2026 para testar a automação. O main (`vigiarAuto`, a cada estado
novo, a cada 15 s, ao mudar a opção e 2 s depois de cada entrega) faz o mesmo pedido do botão (`pedirAcao(a, 'tarefa', true)`),
com a mesma autorização, as mesmas entradas de verdade e a mesma regra de uma ação por vez. Regras (`acoes.js`, `AUTO`):

- Só com a tarefa pronta numa leitura de até 30 s, na conta que está na tela (aba ativa ou lado a lado) e com a janela aberta
  e não minimizada. O app não troca de aba nem traz a janela para a frente: para as duas contas, o Lado a lado.
- Espera 10 s sem a pessoa digitar ou clicar no app (evento `input-event` de todas as views, inclusive a da ação, e os
  atalhos do app; as entradas que o próprio app manda, marcadas em volta de cada `sendInputEvent`, não contam): o foco vai
  para o jogo da ação, um B ou M digitado no chat no meio viraria atalho do jogo, e o personagem sairia do que ela está
  fazendo. Não tenta com a mochila cheia (o Capitão recusa a entrega): o painel diz que espera espaço. Não pede com a
  página principal carregando ou caída (o preload ainda não ouve o pedido). Fora do pacote, `globalThis.lupaTeste.ultimoUso()`
  deixa o `teste:acao` conferir isso.
- O `acao-jogo.js` confere a tela antes da primeira entrada e, se não dá, nem começa (`Espera`, resultado `espera`, nova
  olhada em 30 s, sem contar como falha): a tarefa ainda não aparece pronta na tela (a leitura estava atrasada), a página está
  escondida (janela coberta) ou a coluna do jogo está escondida com a janela sem foco no Windows (as teclas B e M só chegam
  com foco). O texto da espera vai pelo `acao:fim` para o main, que o grava no painel só quando muda.
- Depois de uma entrega, a próxima tentativa espera 1 min (a leitura ainda mostra a tarefa entregue por uns segundos). Erro
  (inclusive página recarregada ou caída no meio): espera 5 min; com 3 erros na mesma tarefa, para. O Parar também para.
  Com a opção ligada, a entrega do botão conta do mesmo jeito (sem isso, o Parar ou um erro dela seriam seguidos por uma
  entrega automática da mesma tarefa 2 s depois).
  Parado, só volta quando a leitura mostra uma tarefa em andamento (a próxima), quando a pessoa aperta o botão ou quando a
  opção é desligada e ligada de novo. Desligar no meio de uma entrega automática a interrompe.
- No painel, o cartão ganha a pílula "automático", e o andamento de uma entrega automática vem com "Automático · " na frente.
  O rodapé do painel e da Central diz que as missões automáticas estão ligadas.

Todo pedido (do botão, do Alt+L ou automático) espera a página confirmar que o recebeu (`acao:comecou`); sem isso em 5 s
(página principal carregando, caída), a autorização some: senão ficaria presa os 4 min, recusando o botão das duas contas.

O main só manda a entrada se a aba que pede está autorizada, ainda no prazo e com entradas, e à vista (janela aberta, não
minimizada, a view no layout). O clique vem em px CSS e vira px da view pelo zoom do jogo; ponto fora da view é recusado.
Antes de clicar ou apertar, o main dá `focus()` à view do jogo (com o foco no painel, onde fica o botão, o Chromium
descartava o apertar e o soltar) e manda entrar, mover, apertar e soltar com 40 ms entre eles. Teclas: só `b` e `m`.
Com a janela coberta por outra (ou a tela travada), o Chromium marca a página como escondida e descarta o apertar do mouse:
o `acao-jogo.js` espera a página voltar à vista (até 1 min, avisando no painel) antes de cada entrada. Teste ponta a ponta: `npm run teste:acao` roda o app de verdade
contra o jogo falso de `teste-acao/jogo-falso.html` (com a mesma proteção e o mesmo caminho: rastreio, Capitão, ofertas,
mapa), com zoom 1,2, um pedido duplo e o Alt+L no meio, apertar de novo logo depois, a coluna escondida (teclas), o Alt+L,
a página recarregando no meio, o Parar e as missões automáticas (ligadas pela chave de Ajustes: a entrega sozinha, que não
recomeça depois, e o Parar no meio de uma, que não recomeça com a mesma tarefa ainda pronta); fotos e resultado em `teste-acao/saida/`. Não cobre duas contas ao mesmo tempo. Se o jogo mudar os
botões, atualizar o jogo falso junto.

## Onde gastar o ouro

O cartão da aba Ficha (e da Central; no site, Calcular → Onde gastar o ouro) responde "onde o ouro rende mais caça". A conta
é a simulação do **próprio motor do jogo**, não o modelo do comparador de builds (que erra 2 a 5 pontos, o tamanho dos
ganhos que importam aqui).

- **O que entra** (`gastar.js`, `candidatos`): forja +1 em cada item equipado (custo = média de 2.000 forjas simuladas
  do `calculos.js` do site, com a volta de nível ao falhar e a garantia do Ornn; sem VIP e sem falhas acumuladas); cartas
  do tipo de dano do personagem (ataque, velocidade e crítico; ou poder e recarga), da bolsa (de graça) ou pelo menor
  preço do Mercado, trocando uma carta que já está num item (o preço de tirar ela entra); itens da mochila e do Mercado
  (lendários e míticos com stat de dano do tipo dele; de cada item, a versão mais forte que o ouro paga e a mais barata;
  a carta do item que sai vai junto, com o preço de tirá-la) em cada lugar em que cabem, inclusive num espaço vazio (uma
  bota e 4 outros, cada lendário uma vez, mítico só do 50); e o reset de atributos (25 mil × nível) para tudo em Força
  ou parte em Agilidade/Foco. Preço do Mercado: o menor anúncio visto nos últimos 7 dias (`mercado:menores`).
- **Duas etapas no simulador**: a triagem roda tudo em 2 caçadas de 20 min; a conferência roda as forjas, as de graça
  que ganharam e as 8 melhores por ouro (de cada item, os 2 melhores lugares da triagem) em 8 caçadas de 1 h. Cada opção usa as mesmas sementes da build atual, e o ganho
  é a média da diferença semente a semente (com 2 erros-padrão). Rende quando passa de 0,3% e do próprio erro; do
  mesmo item em lugares diferentes fica só o melhor lugar. Se paga em: custo ÷ (ganho × ouro/h medido na zona nas
  caçadas dos últimos 7 dias; sem medição, o de tabela).
- **Quando roda**: no botão Calcular (`lupa:gastar`) e sozinha quando a build (itens, atributos, ranks, barra, nível ou
  zona) fica 2 min parada diferente da última conta, ou quando a conta passa de 6 h. Um personagem por vez; depois de
  um erro, a mesma build espera 30 min (uma build nova tenta já). Com um item equipado que a conta não reconhece (sendo
  avaliado, "~?", ou mais novo que as tabelas) ela não roda: simular sem a peça daria ganhos errados. Leva cerca de 1 min;
  cada rodada do simulador tem prazo (10 min, ou mais num PC com poucos núcleos) e para se a página cair; cada arquivo
  do motor tem 30 s para baixar. Enquanto um item espera avaliação, o cartão diz que a conta espera (`esperandoFicha`). O resultado vai para `gastar:<nome>` no armazém
  (`{ estado: 'pronto' | 'rodando' | 'na-fila' | 'erro', em, assinatura, nivel, zona, campeao, ouro, equip, base, motor,
  sim, testadas, conferidas, opcoes: [linha], semGanho: [linha] }`, linha = `{ tipo, titulo, detalhe, custo, custoP90,
  ganho, erro, xpH, ouroH, horas, mortesH }`); enquanto recalcula, a conta anterior continua lá. O envio.js sobe a
  última conta pronta dentro do `estados.dados.gastar` do Lupa Online, só com os campos que o cartão desenha (sem o
  texto de erro).
- **Isolamento** (`simulador.js`): o motor e o que ele importa são baixados de `https://lolidle.com/js/` (só caminhos
  simples dentro de `js/`) e servidos pelo `lupasim://app/jogo/`. A janela é escondida, sem preload, com sandbox, numa
  sessão em memória (`lupa-simulador`) que cancela qualquer pedido que não seja `lupasim:` e nega permissões; o CSP de
  toda resposta só deixa script e trabalhador do próprio `lupasim:`. O processo roda com prioridade abaixo do normal e
  usa um terço dos núcleos (1 a 4 trabalhadores). A janela fecha de verdade (`close` e o `closed`) antes da próxima:
  com `destroy()`, a segunda etapa pegava o processo morrendo e o `lupasim://` falhava. O download recusa mais de
  400 arquivos ou um arquivo de mais de 5 MB, e a cópia nova só substitui a antiga depois de baixada inteira (a antiga
  sai de lado e volta se a troca falhar).
- **Teste**: `npm run teste:gastar` baixa o motor numa pasta temporária, confere que a página não acessa a internet nem
  sai da pasta do motor e roda a conta inteira com `teste-gastar/estado-yasuo.json` (resultado em `teste-gastar/saida/`).
  `npm run teste:gastar-app` abre o app de verdade (abas numa página em branco local, dados numa pasta temporária) e
  confere a conta automática, os Pontos e barra na mesma rodada e o botão Calcular do painel. Fora do pacote,
  `LUPA_GASTO_ESPERA` (ms) encurta a espera.

## Pontos e barra

Na mesma rodada do Onde gastar o ouro (logo depois dele, com a mesma cópia do motor), `treino.js` responde para onde vão os
pontos e qual barra usar. Grava `treino:<nome>` (`{ estado, em, assinatura, nivel, zona, campeao, livres, barraAtual,
habilidade: { nivel, pontos, testadas, opcoes }, atributo: { nivel, pontos, testadas, opcoes }, barra: { testadas, opcoes },
base, sim }`, linha = `{ parte, titulo, nivel, ganho, erro, rende, xpH, ouroH, mortesH }`), que o cartão Pontos e barra da
Ficha (e da Central; no site, Calcular → Pontos e barra) desenha. O envio.js sobe a última conta dentro de `estados.dados.treino`.

- **Pontos**: um ponto sozinho mexe uns 0,2 a 0,4%, menos que a margem da simulação. Por isso a conta olha 5 níveis à frente:
  os pontos livres mais os que vêm (1 de habilidade por nível até o 50, 3 de atributo por nível), todos numa habilidade (até o
  rank que o nível de chegada deixa) ou todos num atributo, comparados no nível de chegada contra uma base nesse nível com os
  pontos guardados. Habilidade fora da barra (o jogo não a usa) entra na barra no lugar de cada uma, e fica o melhor lugar: a
  nova é comparada com a barra atual (aprender e pôr na barra é uma coisa só); a aprendida, com uma base que já tem a mesma
  barra, para o ganho ser só o dos pontos (a troca de barra sozinha aparece na parte Barra). As regras de rank
  (`rankMaximo`, `KIT_HABS`, `BARRA`, `PONTOS_POR_NIVEL`, `NIVEL_PONTOS_HAB`) vêm do `dados-jogo.js`, conferidas pelo gerador
  contra o `rankMaximoNoNivel` do motor em todos os campeões e níveis; o campeão sai do nome das habilidades da ficha
  (`campeaoPelasHabs`).
- **Barra**: as combinações de 4 das habilidades aprendidas que não são passivas (a ordem não importa: o jogo usa as da barra
  pela prioridade do campeão). Triagem de todas e conferência das 4 melhores.
- **Conferência**: as 4 melhores habilidades, os 5 atributos e as 4 melhores barras, em 8 caçadas de 1 h. No cartão,
  as que ficam dentro da margem da melhor aparecem como empate.
- Em 27/10 (simulação): Yasuo, os próximos 5 pontos em Lâmina Fantasma (F) +2,8%, Respiração do Vento +1,1%; 15 pontos
  em Foco ou em Força empatam (+1,5%); a barra Q R F G é a melhor das 35. Aphelios: Eclipse Duplo +1%, Foco e Força
  empatam (+1,3%), a barra Q W B G é a melhor das 5.

## IPC (canais)

Armazém (todas as páginas com preload da Lupa e o shim do jogo):

| Canal | Tipo | Entrada → saída |
|---|---|---|
| `armazem:get` | invoke | `chaves`: `null` (tudo), `string`, `string[]` ou objeto `{ chave: padrão }` → objeto |
| `armazem:set` | invoke | objeto `{ chave: valor }` → `undefined` |
| `armazem:remove` | invoke | `string` ou `string[]` → `undefined` |
| `armazem:mudou` | main → página | `{ [chave]: { oldValue, newValue } }` (área sempre `local`) |

Chave privada: `nuvem:sessao` (os tokens do Lupa Online) só existe no processo principal, para o envio.js. O
`armazem:get` não a devolve, o `armazem:set`/`remove` a ignoram e o `armazem:mudou` não a manda para nenhuma página.

Lupa:

| Canal | Tipo | Entrada → saída |
|---|---|---|
| `lupa:mensagem` | invoke | o mesmo `msg` do `chrome.runtime.sendMessage` (`ola`, `aviso`, `nuvem-entrar`, `nuvem-sair`, `nuvem-enviar`) → a resposta do ouvinte |
| `lupa:abrir` | invoke | `url`: termina em `central.html` → vai para a aba Central; `central.html#mini` → mini janela; `http(s)` de fora → navegador do sistema |
| `lupa:escolher` | main → painel | `nome` do personagem da aba ativa, ou da metade em foco no lado a lado (o painel passa a mostrar esse) |
| `lupa:uaFirefox` | sendSync | → o User-Agent de Firefox (só o preload das páginas do Google usa) |
| `lupa:acao` | invoke | só do painel: `{ tipo: 'tarefa' \| 'parar', nome }` → `{ ok }` ou `{ erro }` |
| `lupa:gastar` | invoke | do painel ou da Central: `{ nome }` → `{ ok }` (a rodada grava `gastar:<nome>` e `treino:<nome>`) ou `{ erro }` |
| `acao:iniciar` | main → jogo | `{ tipo: 'tarefa' \| 'coluna', auto, foco }`: começa a ação na aba autorizada (`auto`: pedida pelas missões automáticas; `foco`: a janela do app em foco no Windows) |
| `acao:parar` | main → jogo | interrompe o "Entregar e seguir" no próximo passo |
| `acao:clicar` | invoke | do jogo: `{ x, y }` em px CSS → `true` se mandou o clique |
| `acao:tecla` | invoke | do jogo: `{ tecla: 'b' \| 'm' }` → `true` se mandou |
| `acao:comecou` | invoke | do jogo: recebeu o `acao:iniciar` (sem isso em 5 s, o main desiste do pedido) |
| `acao:fim` | invoke | do jogo: `{ estado: 'ok' \| 'erro' \| 'parado' \| 'espera', texto }`: a ação acabou; a autorização da aba some (o resultado e o texto da espera contam para as missões automáticas) |

Casca:

| Canal | Tipo | Entrada → saída |
|---|---|---|
| `casca:estado` | invoke | → `Estado` (abaixo) |
| `casca:ativar` | invoke | `id` do modo (`conta1`, `conta2`, `lado`, `central`) |
| `casca:painel` | invoke | alterna o painel da Lupa do modo atual |
| `casca:recarregar` | invoke | recarrega o jogo da aba ativa (no lado a lado, o da metade em foco) |
| `casca:menu` | invoke | `boolean`: menu de ajustes aberto; a casca passa a cobrir a janela toda e sobe para o topo |
| `casca:opcao` | invoke | `{ chave, valor }`: `fecharParaBandeja` (boolean), `larguraPainel` (320, 380 ou 520), `soConta1` (boolean) |
| `casca:procurar` | invoke | procura atualização agora |
| `casca:atualizar` | invoke | `disponivel` → baixa; `pronta` → fecha, instala e abre de novo |
| `casca:iniciarComWindows` | invoke | `boolean`: registra no Windows com o argumento `--ao-iniciar`, que faz o app abrir minimizado. Só no app instalado (`instalado`); na versão de desenvolvimento a chave fica desabilitada. Na partida, uma entrada antiga sem o argumento (da 0.6.0) é regravada com ele |
| `casca:mudou` | main → casca | `Estado` |

```
Estado = {
  abas: [{ id, rotulo, tipo: 'jogo' | 'lado' | 'central', alertas: [{ tipo, texto }] }],   // alertas só nas abas de conta
  ativa: id,                   // o modo: conta1 | conta2 | lado | central
  modo: 'conta' | 'lado' | 'central',
  painelAberto: boolean,       // do modo atual (no lado a lado, o `painelLado`)
  menuAberto: boolean,
  versao: '0.12.0',
  atualizacao: { tipo: 'dev' | 'procurando' | 'em-dia' | 'disponivel' | 'baixando' | 'pronta' | 'erro', versao?, pct?, msg?, notas? },
                               // notas: releaseNotes em texto puro (~300 caracteres), no tooltip do botão Atualizar
  instalado: boolean,          // app.isPackaged: false no npm start
  iniciarComWindows: boolean,
  fecharParaBandeja: boolean,
  larguraPainel: 320 | 380 | 520,
  soConta1: boolean,
  etiquetas: [{ id, x, largura, rotulo, alertas, foco }],   // só no lado a lado ([] nos outros): posição em px da janela
  atalhos: [[tecla, descrição]]
}
```

## APIs expostas às páginas

`window.lupaChrome` (preload-lupa; `app-chrome.js`, injetado antes dos outros scripts, faz `chrome` apontar para ele):

```
storage.local.get(chaves) / set(obj) / remove(chaves)      → Promise (como no Chrome)
storage.onChanged.addListener(fn(mud, 'local')) / removeListener(fn)
runtime.id = 'lupa-app'
runtime.sendMessage(msg)                                  → Promise da resposta
runtime.getURL(caminho)                                   → URL absoluta ao lado da página
tabs.create({ url }) / windows.create({ url })            → lupa:abrir
tabs.getCurrent()                                         → Promise<null>
tabs.update() / windows.update()                          → Promise rejeitada (a Central cai no tabs.create)
```

`window.lupaApp.aoEscolher(fn(nome))`: o painel troca de personagem quando a aba ativa muda.
`window.lupaApp.acao(tipo, nome)`: o botão "Entregar e seguir" (`tarefa`) e o Parar (`parar`) → `lupa:acao`.
`window.lupaApp.gastar(nome)`: o botão Calcular do Onde gastar o ouro → `lupa:gastar`.

`window.lupaCasca`: `estado()`, `ativar(id)`, `alternarPainel()`, `recarregar()`, `procurar()`, `atualizar()`,
`iniciarComWindows(bool)`, `menu(bool)`, `opcao(chave, valor)`, `aoMudar(fn(estado))`.

## Atualização

electron-updater 6.8.10 lendo os Releases do repositório público `Iguinhowill/lupa` (instalador NSIS por usuário,
sem pedir administrador). `autoDownload: false`: o app procura ao abrir e a cada 6 h; a casca mostra o botão
**Atualizar para X**; baixado, o botão vira **Reiniciar e instalar**. Fora do pacote (`npm start`), `tipo: 'dev'`. No `update-available` o `releaseNotes` vira texto puro (sem HTML, até 300
caracteres, `notasEmTexto` do `alertas.js`) em `atualizacao.notas`, mostrado no tooltip do botão.

Publicar uma versão: subir `version` no `package.json`, `npm run dist`, e `node publicar.mjs` (cria a tag e o Release
com o instalador, o `latest.yml` e o `.blockmap`).
