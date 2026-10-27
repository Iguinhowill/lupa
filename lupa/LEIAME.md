# Lupa para LoL Idle

Painel de qualidade de vida para o [LoL Idle](https://lolidle.com). Ele reorganiza o que o jogo já mostra na tela,
sem dar vantagem a ninguém.

## Dois jeitos de usar

- **App de PC (recomendado):** abre o jogo numa janela própria, com as abas **Conta 1**, **Conta 2**, **Lado a lado** e
  **Central**. A Lupa vem embutida (o painel fica ao lado do jogo) e se atualiza pelo botão de atualização do app.
  Não precisa de janela anônima nem de carregar extensão.
- **Extensão do Chrome/Edge (alternativa):** a mesma Lupa, instalada como abaixo em "Como instalar".

No app o painel esconde o botão **Central** e a escolha de personagem (quem escolhe é a aba do app) e usa um rodapé
de uma linha. Na extensão, tudo continua como descrito aqui.

## O que ela faz

**Painel lateral** (clique no ícone da lupa):

- **Ficha:** o seu plano no topo, os itens equipados com a imagem, refino, qualidade e carta; a barra de combate com
  o ícone e a habilidade de cada tecla (a tecla R pode ser o G, por exemplo); ranks, atributos, mochila e cartas.
- **Caçada:** abates, XP e ouro por hora caçando, por sessão e por zona (a melhor zona por XP/h ganha uma estrela), com o multiplicador de bônus ("XP ×1,45 · ouro ×1,20")
  e o gráfico de 5 em 5 min que alterna entre XP e Abates. "Nova sessão" vale só para o personagem aberto. Fica salvo por personagem e não zera ao
  recarregar a página. Também mostra uma estimativa sem os bônus da Kick e da Twitch e exporta em CSV.
- **Tarefa:** o cartão **Hoje ainda falta** (prêmio diário não pego, diárias prontas ou pendentes, Covil liberado,
  Vilemaw acordada, Guerra de hoje, e quanto falta para virar o dia em Brasília; sem pendência: "Nada pendente
  hoje"), progresso, quanto falta, previsão de término e um alerta quando você caça fora da zona da tarefa.
- **Timers:** bônus da Kick, da Twitch, voto no TopIdle, evento de XP, convites da Dungeon, guilda e VIP, mais os
  buffs do Barão, da Guerra (×2), da Loja (XP e ouro) e da Disciplina quando ativos. O sino liga uma notificação do
  navegador. Abaixo, "No jogo agora": Guerra de Guildas, Vilemaw, Covil, chaves de fortaleza, sorteio e caveira/frags.
  O aviso de reinício do servidor aparece em destaque no topo.
- **Chat:** resumo do loot dos últimos 15 minutos e as mensagens do servidor sem as linhas de loot.
- **Ajustes:** tema da lateral do jogo, fechar a lateral, recolher cards, esconder a lista de bônus e as linhas de
  loot, manter o PC acordado e os avisos (mochila quase cheia, item no chão, morte, pontos livres, nível e, novos: lendário,
  prêmio diário não pego, diária pronta, Guerra de Guildas, Vilemaw acordada, Covil liberado e reinício do servidor).
- No topo, a barra de XP com a previsão do próximo nível e o botão **Central**.

**Central** (botão Central do painel): tudo numa página só, para uma aba ou outro monitor: o feed ao vivo (drops com
imagem, lendários, chefes, mortes, mochila, tarefa), caçada, tarefa, timers, plano e ficha. O botão **Soltar mini
janela** abre uma janelinha que fica sempre por cima, com a tarefa, as taxas, os alertas e os últimos drops.

**Na página do jogo:**

- Tema escuro na lateral (pode desligar em Ajustes).
- A aba **LUPA** na borda fecha a lateral inteira e o jogo usa a largura toda. Atalho: **Alt+L**.
- Chevrons no cartão do jogador, no Local e nas abas para recolher cada um (fica só o título com um resumo).
- O jogo já tem em ⚙ Configurações → Coluna da direita: esconder o Local, a faixa de redes e a guilda, mudar a ordem
  dos blocos e a altura do chat. O botão ▾ do chat minimiza o chat. A Lupa não repete essas opções.

**Seu plano:** em `planos.js` ficam as anotações por personagem (habilidades, barra, atributos, itens, cartas e
zona). A Lupa só compara com a tela e mostra o próximo passo; não calcula nem simula nada.

## Lupa Online (ver de outro computador)

Em **Ajustes → Lupa Online**, entre com a sua conta do site. A partir daí a Lupa envia para o seu banco (Supabase,
projeto `lupa-online`) o que ela já lê: a ficha de cada personagem, os drops, níveis, mortes e chefes, as sessões de
caçada, um sinal a cada 5 min (para saber quando o jogo parou) e o Mercado quando você abre a janela dele no jogo.
Os ícones dos itens sobem aos poucos. Sem internet, ela guarda e envia quando voltar (confere a cada minuto).

O site (Agora, Relatório, Guia, Farm e Loja) fica na pasta `site` ao lado desta: `node montar.mjs` monta em
`site/dist`, copiando daqui o `ui.js`, o `plano.js`, o `central.js` e o CSS. A aba Agora é esta mesma Central, lendo
do banco. A seção **Roteiros** (`/roteiros/`) é aberta, sem login e sem banco: os guias por campeão, para mandar o
link a quem quiser. Um guia novo entra com `node importar-roteiro.mjs <página.html> <nome>` e um card em
`site/src/roteiros/index.html`.

**Mercado:** o jogo só carrega a lista com a janela do Mercado aberta (tecla J); aberta, ele mesmo atualiza a cada
30 s. Use a aba Comprar, sem filtro, para uma leitura completa. A Lupa só lê as fichas que a tela mostra; não pede nada
ao servidor. Com a janela aberta, a leitura sobe para o banco no máximo a cada 10 min (o banco guarda 30 dias).

**Valor dos itens na Ficha:** cada item do equipamento e da mochila mostra a Loja do jogo (`dados-jogo.js`, copiado do `site/src`) e o
menor preço visto no Mercado para a mesma versão (item, qualidade e refino, sem carta), com há quanto tempo. O acumulado fica em
`mercado:menores` (`{ chave: { ouro, gemas, n, em } }`, 7 dias, até 400 chaves). A Lupa só mostra: não vende nada.

**Alertas de preço** (liberados pelo Brunox em 26/10/2026: só avisar, nunca comprar): a lista "Quero comprar" fica na
Loja do site (item, qualidade e refino mínimos, só sem carta, preço máximo em ouro ou 💠). Deixe o Mercado aberto em
casa na aba Comprar, sem filtro: a cada atualização do jogo a Lupa confere a lista e grava um aviso quando a oferta
mais barata que atende fica abaixo do preço (de novo só se baixar mais, ou se for vendida e aparecer outra). O site
mostra a notificação do navegador em qualquer página aberta, mesmo em segundo plano. Comprar é sempre você.

## Dois personagens ao mesmo tempo (duas contas)

No app de PC, use as abas **Conta 1** e **Conta 2** (ou **Lado a lado**): não há o que configurar.

Só na **extensão**: cada perfil do Chrome tem a sua própria Lupa, e uma não enxerga a outra. Para ver os dois numa tela
só, use o mesmo Chrome com duas janelas (o truque da janela anônima vale apenas para a extensão):

1. Em `chrome://extensions`, abra **Detalhes** da Lupa e ligue **Permitir no modo anônimo**.
2. Janela normal: entre no jogo com uma conta.
3. Janela anônima (Ctrl+Shift+N): entre no jogo com a outra conta. Ela tem login separado.
4. Abra a **Central**: com os dois lendo, ela mostra **lado a lado** (uma coluna por personagem, com tarefa, taxas,
   alertas, plano e o feed de cada um). A mini janela também mostra os dois. Os botões no topo trocam para um só.

Cuidados:

- A janela anônima esquece o login quando todas as janelas anônimas fecham: é preciso entrar de novo.
- O servidor do jogo tem um limite de contas jogando ao mesmo tempo na mesma rede. Se aparecer "Muitas contas nesta
  rede", é o jogo recusando, e a Lupa não tem como mudar isso.
- Os Termos permitem ter várias contas, mas proíbem usar uma para juntar recompensas, presentes ou itens na outra.
  Não passe item, ouro ou carta entre as duas contas.

## O jogo em segundo plano

O LoL Idle continua caçando com a aba escondida ou minimizada (o jogo tem um relógio próprio para isso). Ele só para
se a aba fechar, se o navegador descartar a aba para economizar memória ou se o computador suspender.

- A Lupa marca a aba do jogo para o navegador não descartar.
- Em Ajustes, "Manter o PC acordado" impede a suspensão enquanto o jogo estiver aberto (a tela pode apagar).
- Para gastar menos o computador deixando rodando, use o Modo economia do próprio jogo (⚙ Configurações).

## O que ela nunca faz

- Não clica, não aperta teclas e não joga por você.
- Não chama o servidor do jogo. Tudo fica no `chrome.storage` do seu navegador, inclusive as imagens dos itens, que
  são copiadas da sua própria tela. A única saída é o Lupa Online, e só depois que você entra em Ajustes: aí ela
  envia para o seu banco, e para nenhum outro lugar.
- Não lê dados escondidos: só o texto e as dicas que aparecem na tela.
- Na página, só muda a aparência (tema, lateral fechada, cards recolhidos e o que você escolher esconder). Os botões
  continuam sendo os do jogo, e desligar tudo volta ao visual original.

## Como instalar (Chrome ou Edge)

1. Abra `chrome://extensions` (ou `edge://extensions`).
2. Ligue o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha esta pasta (`lupa`).
4. Fixe o ícone da lupa na barra e clique nele com o jogo aberto: o painel abre ao lado.

Depois de editar algum arquivo, clique em **Recarregar** no cartão da extensão e recarregue a aba do jogo.

## Limites conhecidos

- Lê o jogo em português. Em inglês, a ficha funciona, mas a Caçada, o feed e o resumo do loot ficam vazios.
- Depende da marcação atual do jogo: se uma atualização mudar a tela, algum bloco pode ficar vazio.
- O "sem bônus de live" é uma estimativa: divide o XP de cada abate pelo bônus da Kick e da Twitch ativo na hora.
- Imagens só aparecem depois que o item passou pela sua tela (equipamento, mochila, cartas, espólios).
- Drop que não chega na mochila (básicos e épicos que o jogo deixa no chão pelos filtros) não aparece no feed.
- A qualidade de um drop só existe depois que o servidor avalia o item: a Lupa espera a linha "… foi avaliado:
  qualidade X." no log, e até lá o drop fica "?". O "[B]" da linha de loot não vale (o jogo escreve B enquanto não
  avalia); a 0.4.0 gravava esse B, e os drops dessa época ficaram sem qualidade no Lupa Online.
