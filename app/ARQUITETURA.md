# Lupa (app de PC) · arquitetura

App Electron 44.7.0 que mostra o LoL Idle (lolidle.com) com duas contas (em abas ou lado a lado) e o painel da Lupa ao lado. Mesma
regra da extensão: **só lê a tela**. Nunca clica, aperta tecla, compra, vende ou faz pedido ao servidor do jogo por
fora. Liberado pelo dono do jogo (Brunox) em 26/10/2026: não dá vantagem, só otimiza a jogabilidade.

O código da Lupa (pasta `../lupa`, que continua sendo também a extensão do Chrome) é reaproveitado sem cópia manual:
`copiar-lupa.mjs` copia para `app/lupa/` e gera `app/gerado/preload-jogo.js`. As duas pastas são geradas (fora do git).

## Arquivos

| Arquivo | Onde roda | O que faz |
|---|---|---|
| `main.js` | processo principal | janela, modos (WebContentsView), armazém, envio.js num `vm`, avisos, bandeja, alertas das abas, atalhos, memória da janela, PC acordado, atualização |
| `layout.js` | processo principal | contas puras: retângulos de cada view por modo, zoom automático por metade, zoom guardado, janela ainda visível num monitor; casos em `layout.test.js` |
| `alertas.js` | processo principal | puro: alertas de uma conta a partir do `estado:<nome>` (tarefa, mochila, pontos, prêmio, sem leitura) e notas da versão em texto puro; casos em `alertas.test.js` |
| `atalhos.js` | processo principal | puro: quais teclas são do app (`atalhoDe`) e a lista mostrada no menu; casos em `alertas.test.js` |
| `armazem.js` | processo principal | o `chrome.storage.local` do app: um JSON em `userData/lupa-dados.json`, gravado 1,5 s depois da última mudança e no máximo 10 s depois da primeira; a versão anterior fica em `.bak`, lida se o principal estiver estragado; casos em `armazem.test.js` |
| `regras.js` | processo principal | regras de navegação da aba do jogo e das janelas de login (`DA_CONTA`, `DO_JOGO`, `NO_LOGIN`, `DO_GOOGLE`, `permitido`); casos em `regras.test.js`, rodar com `npm test` |
| `shim-jogo.js` | preload das abas do jogo | o objeto `chrome` que o `content.js` usa (só no mundo isolado, nunca exposto à página) |
| `gerado/preload-jogo.js` | preload das abas do jogo | `shim-jogo.js` + `../lupa/content.js`, rodando no DOMContentLoaded só em lolidle.com |
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
resto chega ao jogo normalmente. O app nunca envia tecla, clique ou comando ao jogo.

| Tecla | Ação |
|---|---|
| Ctrl+1 / Ctrl+2 | Conta 1 / Conta 2 |
| Ctrl+3 | Lado a lado |
| Ctrl+4 | Central |
| Ctrl+Tab (Ctrl+Shift+Tab) | próxima (anterior) aba |
| Ctrl+B | mostrar/esconder o painel do modo atual |
| F5 | recarregar o jogo da aba (no lado a lado, o da metade em foco) |
| Ctrl + / Ctrl − / Ctrl 0 | zoom do modo atual (passo de 10%, 0 volta ao padrão) |

### Memória da janela e dados de teste

`pref` (`app:pref` no armazém) guarda: `ativa`, `painelAberto`, `painelLado`, `larguraPainel`, `fecharParaBandeja`, `avisouBandeja`,
`soConta1`, `zoom`, `nomes` e `janela` (`{ x, y, width, height, maximizada }`, gravada 0,6 s depois da última mudança; na
volta só vale se couber em algum monitor). Para rodar o app sem tocar nas contas de verdade: `LUPA_DADOS=<pasta>` troca o
`userData` (login, sessão do Lupa Online, armazém), só fora do pacote (`!app.isPackaged`).

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
  versao: '0.9.0',
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

`window.lupaCasca`: `estado()`, `ativar(id)`, `alternarPainel()`, `recarregar()`, `procurar()`, `atualizar()`,
`iniciarComWindows(bool)`, `menu(bool)`, `opcao(chave, valor)`, `aoMudar(fn(estado))`.

## Atualização

electron-updater 6.8.10 lendo os Releases do repositório público `Iguinhowill/lupa` (instalador NSIS por usuário,
sem pedir administrador). `autoDownload: false`: o app procura ao abrir e a cada 6 h; a casca mostra o botão
**Atualizar para X**; baixado, o botão vira **Reiniciar e instalar**. Fora do pacote (`npm start`), `tipo: 'dev'`. No `update-available` o `releaseNotes` vira texto puro (sem HTML, até 300
caracteres, `notasEmTexto` do `alertas.js`) em `atualizacao.notas`, mostrado no tooltip do botão.

Publicar uma versão: subir `version` no `package.json`, `npm run dist`, e `node publicar.mjs` (cria a tag e o Release
com o instalador, o `latest.yml` e o `.blockmap`).
