# Lupa (app de PC) · arquitetura

App Electron 44.7.0 que mostra o LoL Idle (lolidle.com) com duas contas em abas e o painel da Lupa ao lado. Mesma
regra da extensão: **só lê a tela**. Nunca clica, aperta tecla, compra, vende ou faz pedido ao servidor do jogo por
fora. Liberado pelo dono do jogo (Brunox) em 26/10/2026: não dá vantagem, só otimiza a jogabilidade.

O código da Lupa (pasta `../lupa`, que continua sendo também a extensão do Chrome) é reaproveitado sem cópia manual:
`copiar-lupa.mjs` copia para `app/lupa/` e gera `app/gerado/preload-jogo.js`. As duas pastas são geradas (fora do git).

## Arquivos

| Arquivo | Onde roda | O que faz |
|---|---|---|
| `main.js` | processo principal | janela, abas (WebContentsView), armazém, envio.js num `vm`, avisos, PC acordado, atualização |
| `armazem.js` | processo principal | o `chrome.storage.local` do app: um JSON em `userData/lupa-dados.json` |
| `regras.js` | processo principal | regras de navegação da aba do jogo e das janelas de login (`DA_CONTA`, `DO_JOGO`, `NO_LOGIN`, `DO_GOOGLE`, `permitido`); casos em `regras.test.js`, rodar com `npm test` |
| `shim-jogo.js` | preload das abas do jogo | o objeto `chrome` que o `content.js` usa (só no mundo isolado, nunca exposto à página) |
| `gerado/preload-jogo.js` | preload das abas do jogo | `shim-jogo.js` + `../lupa/content.js`, rodando no DOMContentLoaded só em lolidle.com |
| `preload-lupa.js` | painel e Central | expõe `window.lupaChrome` (o mesmo `chrome` da extensão) e `window.lupaApp` |
| `preload-casca.js` | barra de abas | expõe `window.lupaCasca` |
| `casca.html/.css/.js` | barra de abas | abas, botão da Lupa, recarregar, atualizar, iniciar com o Windows |
| `copiar-lupa.mjs` | build (`npm run preparar`) | copia `../lupa` para `app/lupa`, injeta `app-chrome.js` nas páginas e gera o preload do jogo |

Todos os webPreferences: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Preload em sandbox só
pode dar `require('electron')` (ipcRenderer, contextBridge).

## Janela

`BaseWindow` com `WebContentsView`s:

- **casca**: faixa no topo, 44 px de altura, largura toda (`casca.html`).
- **jogo** (uma por conta, `conta1` e `conta2`): partição `persist:conta1`/`persist:conta2` (login separado), carrega
  `https://lolidle.com/jogar`. Ocupa a área abaixo da casca, menos o painel. A economia de segundo plano do Chromium
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
- **painel**: `lupa/painel.html`, 380 px à direita, aparece só na aba de um jogo e se `painelAberto`.
- **central**: `lupa/central.html`, área toda abaixo da casca, só na aba Central.
- **mini janela**: `BrowserWindow` 380×620 sempre por cima, `lupa/central.html#mini` (preload-lupa).

Abas: `[{ id: 'conta1', tipo: 'jogo' }, { id: 'conta2', tipo: 'jogo' }, { id: 'central', tipo: 'central' }]`. O rótulo
de um jogo começa "Conta 1"/"Conta 2" e vira o nome do personagem quando a Lupa lê a ficha (a gravação de
`estado:<nome>` vinda daquela aba diz quem é).

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
| `lupa:escolher` | main → painel | `nome` do personagem da aba ativa (o painel passa a mostrar esse) |
| `lupa:uaFirefox` | sendSync | → o User-Agent de Firefox (só o preload das páginas do Google usa) |

Casca:

| Canal | Tipo | Entrada → saída |
|---|---|---|
| `casca:estado` | invoke | → `Estado` (abaixo) |
| `casca:ativar` | invoke | `id` da aba |
| `casca:painel` | invoke | alterna o painel da Lupa |
| `casca:recarregar` | invoke | recarrega o jogo da aba ativa |
| `casca:procurar` | invoke | procura atualização agora |
| `casca:atualizar` | invoke | `disponivel` → baixa; `pronta` → fecha, instala e abre de novo |
| `casca:iniciarComWindows` | invoke | `boolean`: registra no Windows com o argumento `--ao-iniciar`, que faz o app abrir minimizado. Só no app instalado (`instalado`); na versão de desenvolvimento a chave fica desabilitada. Na partida, uma entrada antiga sem o argumento (da 0.6.0) é regravada com ele |
| `casca:mudou` | main → casca | `Estado` |

```
Estado = {
  abas: [{ id, rotulo, tipo: 'jogo' | 'central' }],
  ativa: id,
  painelAberto: boolean,
  versao: '0.6.0',
  atualizacao: { tipo: 'dev' | 'procurando' | 'em-dia' | 'disponivel' | 'baixando' | 'pronta' | 'erro', versao?, pct?, msg? },
  instalado: boolean,          // app.isPackaged: false no npm start
  iniciarComWindows: boolean
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
`iniciarComWindows(bool)`, `aoMudar(fn(estado))`.

## Atualização

electron-updater 6.8.10 lendo os Releases do repositório público `Iguinhowill/lupa` (instalador NSIS por usuário,
sem pedir administrador). `autoDownload: false`: o app procura ao abrir e a cada 6 h; a casca mostra o botão
**Atualizar para X**; baixado, o botão vira **Reiniciar e instalar**. Fora do pacote (`npm start`), `tipo: 'dev'`.

Publicar uma versão: subir `version` no `package.json`, `npm run dist`, e `node publicar.mjs` (cria a tag e o Release
com o instalador, o `latest.yml` e o `.blockmap`).
