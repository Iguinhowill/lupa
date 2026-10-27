// Lupa (app) · teste ponta a ponta das ações que o jogador pede ("Entregar e seguir" e Alt+L), sem tocar no jogo de verdade:
// o app de verdade (main.js) abre o jogo falso (jogo-falso.html, servido aqui em 127.0.0.1:8770) com dados numa pasta
// temporária. O jogo falso tem a mesma proteção contra bots do jogo (clique com isTrusted falso não vale e é contado) e o
// mesmo caminho: rastreio da tarefa → Capitão → entregar → tarefa → ofertas → mapa → Ir.
// Uso, na pasta app: `npm run teste:acao`. Sai com código 1 se algo falhar; fotos e resultado.json em teste-acao/saida/.
// As teclas (B e M com a coluna escondida, e o Alt+L) só chegam com a janela do teste em foco: sem foco, essas partes
// ficam marcadas como puladas (o Windows não deixa um programa de fundo roubar o foco).
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const SAIDA = path.join(__dirname, 'saida');
const DADOS = fs.mkdtempSync(path.join(os.tmpdir(), 'lupa-teste-acao-'));
fs.mkdirSync(SAIDA, { recursive: true });
fs.writeFileSync(path.join(DADOS, 'lupa-dados.json'), JSON.stringify({ 'app:pref': { soConta1: true, ativa: 'conta1', painelAberto: true } }));
process.env.LUPA_JOGO = 'http://127.0.0.1:8770/jogar';
process.env.LUPA_DADOS = DADOS;

const pagina = fs.readFileSync(path.join(__dirname, 'jogo-falso.html'));
const servidor = http.createServer((req, res) => {
  if (new URL(req.url, 'http://x').pathname !== '/jogar') { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(pagina);
}).listen(8770, '127.0.0.1');
// porta ocupada (outro teste aberto): sai na hora, senão o Electron fica parado numa caixa de erro
servidor.on('error', (e) => { console.error(`FALHOU: o jogo falso não subiu na porta 8770 (${e.code}). Feche o que estiver usando a porta.`); process.exit(1); });

const { app, webContents, BaseWindow } = require('electron');
app.disableHardwareAcceleration();      // o capturePage dá UnknownVizError com a GPU
// só neste teste: sem o detector de janela coberta do Chromium, a página não vira "escondida" quando o terminal cobre a janela
// ou a tela trava (aí o app espera a janela voltar à vista, e o teste mediria a tela, não o app). O app de verdade mantém
// o detector: é ele que deixa o jogo leve em segundo plano.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
require(path.join(__dirname, '..', 'main.js'));

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const achar = (re) => webContents.getAllWebContents().find((w) => re.test(w.getURL()));
// a foto é só para olhar depois: se o Chromium não deixar capturar (UnknownVizError às vezes), o teste segue
const foto = async (wc, nome) => { try { fs.writeFileSync(path.join(SAIDA, nome), (await wc.capturePage()).toPNG()); } catch {} };
// o andamento vem do armazém: o painel redesenha no quadro seguinte da tela, que o Windows pausa com a janela coberta.
// No fim o painel é redesenhado na hora, para a foto e para conferir o texto
const acaoDe = (painel) => painel.executeJavaScript(`chrome.storage.local.get('acao:Teste 1').then((r) => r['acao:Teste 1'] || null)`);
async function textoDoPainel(painel) {
  await painel.executeJavaScript('desenhar(true)');
  return painel.executeJavaScript(`(() => { const p = document.querySelector('.entregar-status'); return p ? [p.className, p.innerText] : ['', ''] })()`);
}
// aperta o botão do painel (ou, com `direto`, pede a ação como o botão pediria, mesmo com ele desligado) e espera a ação
// acabar; devolve o último andamento e as etapas vistas
async function entregar(painel, desde, direto = false) {
  await painel.executeJavaScript(direto ? `lupaApp.acao('tarefa', 'Teste 1')` : `desenhar(true); document.querySelector('.entregar .botao').click()`);
  const etapas = [];
  let a = null;
  for (let k = 0; k < 100; k++) {
    await espera(400);
    a = await acaoDe(painel);
    if (!a || a.em < desde) continue;
    if (etapas.at(-1) !== a.texto) etapas.push(a.texto);
    if (a.estado !== 'rodando') break;
  }
  return { a, etapas };
}

app.whenReady().then(async () => {
  const out = {}, falhas = [], pulados = [];
  const conferir = (ok, msg) => { if (!ok) falhas.push(msg); };
  const CAMINHO = (voltar, mapa) => [voltar, 'chegou:Fonte', 'rastreio', 'palavra:entregar', 'palavra:tarefa', 'aceitou:1', mapa, 'marcador:dragao', 'ir:dragao', 'chegou:Fosso do Dragão'].join(' → ');
  try {
    await espera(6000);
    const jogo = achar(/127\.0\.0\.1:8770/), painel = achar(/painel\.html/), janela = BaseWindow.getAllWindows()[0];
    janela.setAlwaysOnTop(true); janela.show(); janela.focus(); jogo.focus();
    // com a janela coberta por outra (o terminal), o Chromium marca a página como escondida e descarta os cliques: o teste
    // espera a janela ficar à vista de verdade antes de começar
    for (let k = 0; k < 50 && (await jogo.executeJavaScript('document.visibilityState')) !== 'visible'; k++) await espera(200);
    out.visivel = (await jogo.executeJavaScript('document.visibilityState')) === 'visible';
    out.focada = janela.isFocused();
    // zoom 1,2 (Ctrl+= pelo atalho do app): os cliques precisam cair no lugar certo com zoom
    for (let k = 0; k < 2; k++) {
      jogo.sendInputEvent({ type: 'keyDown', keyCode: '=', modifiers: ['control'] });
      jogo.sendInputEvent({ type: 'keyUp', keyCode: '=', modifiers: ['control'] });
      await espera(300);
    }
    out.zoom = jogo.getZoomFactor();
    await jogo.executeJavaScript('window.__cliqueFalso()');      // um clique como o de um bot: a proteção do jogo falso pega
    await painel.executeJavaScript(`[...document.querySelectorAll('#abas button')].find((b) => /Tarefa/.test(b.textContent)).click()`);
    await espera(1000);
    await foto(painel, 'painel-antes.png');

    // 1) coluna à vista: tudo por clique (não depende do foco)
    const focoAntes = { jogo: jogo.isFocused(), painel: painel.isFocused(), janela: janela.isFocused() };
    const p1 = entregar(painel, Date.now());
    // no meio da entrega, um segundo pedido e um Alt+L: os dois recusados, sem atrapalhar a primeira
    await espera(800);
    out.pedidoDuplo = await painel.executeJavaScript(`lupaApp.acao('tarefa', 'Teste 1')`);
    jogo.sendInputEvent({ type: 'keyDown', keyCode: 'l', modifiers: ['alt'] });
    jogo.sendInputEvent({ type: 'keyUp', keyCode: 'l', modifiers: ['alt'] });
    const r1 = await p1;
    out.colunaDepois1 = await jogo.executeJavaScript(`document.body.classList.contains('coluna-escondida')`);
    out.cenario1 = { ...r1, passos: (await jogo.executeJavaScript('window.__d')).passos.join(' → '), mouse: (await jogo.executeJavaScript('window.__d')).mouse.slice(0, 30), focoAntes, alvo: await jogo.executeJavaScript(`(() => { const r = document.querySelector('#voltar-base').getBoundingClientRect(); return [r.left, r.top, r.width, r.height, innerWidth, innerHeight, devicePixelRatio] })()`) };
    const fim = await textoDoPainel(painel);
    await foto(jogo, 'jogo-depois.png');
    await foto(painel, 'painel-depois.png');
    conferir(r1.a?.estado === 'ok', `1) o "Entregar e seguir" não terminou bem: ${r1.a?.texto}`);
    conferir(out.cenario1.passos === CAMINHO('botao:voltar', 'botao:mapa'), '1) o caminho no jogo foi outro: ' + out.cenario1.passos);
    conferir(/\bok\b/.test(fim[0]) && fim[1] === r1.a?.texto, `1) o painel não mostrou o resultado: ${fim[1]}`);
    conferir(/em andamento/.test(out.pedidoDuplo?.erro || ''), '1) um segundo pedido no meio não foi recusado: ' + JSON.stringify(out.pedidoDuplo));
    conferir(out.colunaDepois1 === false, '1) o Alt+L no meio da entrega mexeu na coluna');

    // 2) apertar de novo logo depois, nos ~5 s em que a leitura da Lupa ainda diz "pronta" (o botão continua ligado): a ação
    // confere na tela e tem de recusar sem mexer no jogo. O pedido vai direto porque aqui a Lupa já releu e desligou o botão
    out.botaoDesligado = await painel.executeJavaScript(`desenhar(true); !!document.querySelector('.entregar .botao')?.disabled`);
    const antes = (await jogo.executeJavaScript('window.__d')).passos.length;
    const r2 = await entregar(painel, Date.now(), true);
    out.cenario2 = { texto: r2.a?.texto, passosNovos: (await jogo.executeJavaScript('window.__d')).passos.slice(antes) };
    conferir(r2.a?.estado === 'erro' && /não terminou/.test(r2.a?.texto || ''), '2) apertar de novo não foi recusado: ' + r2.a?.texto);
    conferir(!out.cenario2.passosNovos.length, '2) apertar de novo mexeu no jogo: ' + out.cenario2.passosNovos.join(' → '));

    // 3) coluna escondida: os botões somem e vão as teclas B e M (precisam do foco)
    janela.focus(); jogo.focus();
    await espera(300);
    if (janela.isFocused()) {
      await jogo.executeJavaScript(`window.__preparar({ colunaEscondida: true })`);
      await espera(5500);      // a Lupa relê a tela (a tarefa volta a "pronta")
      const r3 = await entregar(painel, Date.now());
      out.cenario3 = { ...r3, passos: (await jogo.executeJavaScript('window.__d')).passos.join(' → ') };
      conferir(r3.a?.estado === 'ok', `3) com a coluna escondida não terminou bem: ${r3.a?.texto}`);
      conferir(out.cenario3.passos === CAMINHO('tecla:b', 'tecla:m'), '3) o caminho no jogo foi outro: ' + out.cenario3.passos);
      // 4) Alt+L: a setinha do jogo mostra a coluna de novo
      jogo.sendInputEvent({ type: 'keyDown', keyCode: 'l', modifiers: ['alt'] });
      jogo.sendInputEvent({ type: 'keyUp', keyCode: 'l', modifiers: ['alt'] });
      await espera(1500);
      out.colunaEscondidaDepoisDoAltL = await jogo.executeJavaScript(`document.body.classList.contains('coluna-escondida')`);
      conferir(out.colunaEscondidaDepoisDoAltL === false, '4) o Alt+L não mostrou a coluna');
      await foto(jogo, 'jogo-alt-l.png');
    } else pulados.push('3) coluna escondida (teclas B e M) e 4) Alt+L: a janela do teste não ganhou o foco');

    const d = await jogo.executeJavaScript('window.__d');
    conferir(d.cliquesFalsos === 1, `a proteção contou ${d.cliquesFalsos} cliques falsos (esperado: só o do teste)`);
    conferir(d.teclasFalsas === 0, 'alguma tecla chegou como falsa');
  } catch (e) { falhas.push(String(e?.stack || e)); }
  Object.assign(out, { falhas, pulados });
  fs.writeFileSync(path.join(SAIDA, 'resultado.json'), JSON.stringify(out, null, 2));
  console.log(falhas.length ? 'FALHOU:\n- ' + falhas.join('\n- ') : 'ok' + (pulados.length ? ' (pulado: ' + pulados.join('; ') + ')' : ''));
  servidor.close();
  try { fs.rmSync(DADOS, { recursive: true, force: true }); } catch {}
  app.exit(falhas.length ? 1 : 0);
});
