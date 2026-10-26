# Lupa

A Lupa é um painel para o LoL Idle que **só lê a tela**: nunca clica, nunca joga e não faz pedidos ao servidor do jogo por fora. Foi liberada pelo dono do jogo (Brunox), porque não dá vantagem, só ajuda a otimizar a jogabilidade.

## Pastas

- `lupa/`: a extensão do Chrome e o código compartilhado com o app.
- `site/`: o site estático "Lupa Online", publicado na Vercel (`site/dist` é gerado).
- `app/`: o app de PC (Electron) com as duas contas em abas e o painel da Lupa ao lado.

## Instalar o app

1. Baixe o `Lupa-Setup-x.y.z.exe` do [último Release](https://github.com/Iguinhowill/lupa/releases/latest).
2. Execute o instalador. Ele instala só para o seu usuário, sem pedir administrador.
3. O Windows pode avisar do SmartScreen porque o instalador não é assinado: clique em **Mais informações → Executar assim mesmo**.

## Atualizar

O app procura versão nova ao abrir e a cada 6 horas. Quando houver uma, aparece um botão na barra do app: clique para baixar e depois em **Reiniciar e instalar**.

## Desenvolver

```
cd app
npm install
npm start
```

Para publicar uma versão: suba a `version` no `app/package.json`, rode `npm run dist` e depois `node publicar.mjs` (use `--notas "texto"` ou `--notas-arquivo arquivo.md` para as notas; `--conferir` só faz as checagens).
