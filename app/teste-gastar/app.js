// Lupa (app) · teste do Onde gastar o ouro dentro do app de verdade (main.js), sem tocar no jogo: as abas abrem uma página
// em branco local (127.0.0.1:8771) e os dados ficam numa pasta temporária. Confere a conta automática (a build "muda" e,
// com a espera encurtada, a conta roda sozinha) e o botão Calcular do painel, até o cartão aparecer com as opções.
// Uso, na pasta app: `npm run teste:gastar-app`. Sai com código 1 se algo falhar; foto do painel em teste-gastar/saida/.
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');

const SAIDA = path.join(__dirname, 'saida');
const DADOS = fs.mkdtempSync(path.join(os.tmpdir(), 'lupa-teste-gastar-app-'));
fs.mkdirSync(SAIDA, { recursive: true });
const estado = { ...JSON.parse(fs.readFileSync(path.join(__dirname, 'estado-yasuo.json'), 'utf8')), ts: Date.now() };
fs.writeFileSync(path.join(DADOS, 'lupa-dados.json'), JSON.stringify({
  'app:pref': { soConta1: true, ativa: 'conta1', painelAberto: true },
  'estado:Teste': estado,
  'mercado:menores': { '3074+5~A': { ouro: 3e6, em: Date.now() } },
}));
process.env.LUPA_JOGO = 'http://127.0.0.1:8771/jogar';
process.env.LUPA_DADOS = DADOS;
process.env.LUPA_GASTO_ESPERA = '3000';

const servidor = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>em branco</title>'); }).listen(8771, '127.0.0.1');
servidor.on('error', (e) => { console.error(`FALHOU: a página em branco não subiu na porta 8771 (${e.code}).`); process.exit(1); });

const { app, webContents } = require('electron');
app.disableHardwareAcceleration();
require(path.join(__dirname, '..', 'main.js'));

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));
const achar = (re) => webContents.getAllWebContents().find((w) => re.test(w.getURL()));
const gastoDe = (painel) => painel.executeJavaScript(`chrome.storage.local.get('gastar:Teste').then((r) => r['gastar:Teste'] || null)`);
async function esperarPronto(painel, desde, limite = 240e3) {
  const t = Date.now(), visto = new Set();
  let g = null;
  while (Date.now() - t < limite) {
    await espera(1000);
    g = await gastoDe(painel);
    if (g?.estado) visto.add(g.estado + (g.etapa ? ':' + g.etapa : ''));
    if (g && ['pronto', 'erro'].includes(g.estado) && (g.em || g.erroEm || 0) > desde) break;
  }
  return { g, visto: [...visto] };
}

app.whenReady().then(async () => {
  const falhas = [];
  const conferir = (ok, msg) => { if (!ok) falhas.push(msg); console.log((ok ? 'ok   ' : 'FALHA') + ' ' + msg); };
  try {
    for (let k = 0; k < 60 && !achar(/painel\.html/); k++) await espera(250);
    const painel = achar(/painel\.html/);
    if (!painel) throw new Error('o painel não abriu em 15 s');
    await espera(2000);
    // 1) a build "muda" (um estado novo com outro refino): a conta roda sozinha depois da espera
    const t1 = Date.now();
    const novo = JSON.parse(JSON.stringify(estado)); novo.ts = Date.now(); novo.ficha.equip[3].id = '3046+5#ataque2~B';
    await painel.executeJavaScript(`chrome.storage.local.set(${JSON.stringify({ 'estado:Teste': novo })})`);
    const r1 = await esperarPronto(painel, t1);
    conferir(r1.g?.estado === 'pronto' && r1.g.motivo === 'build nova', `conta automática: ${r1.g?.estado} (${r1.g?.motivo || r1.g?.erro}) em ${Math.round((Date.now() - t1) / 1000)} s; estados vistos: ${r1.visto.join(', ')}`);
    conferir(r1.g?.equip?.[3] === '3046+5#ataque2~B', 'a conta usou a build nova');
    conferir(fs.existsSync(path.join(DADOS, 'motor-jogo', 'atual', 'motor.js')), 'o motor ficou na pasta do app (motor-jogo/atual)');
    // 2) o botão Calcular do painel (na aba Ficha)
    await painel.executeJavaScript(`(() => { const b = [...document.querySelectorAll('#abas button, nav button, button')].find((x) => x.textContent.trim() === 'Ficha'); b?.click(); desenhar(true); })()`);
    await espera(500);
    const temBotao = await painel.executeJavaScript(`!!document.querySelector('.gastar .botao')`);
    conferir(temBotao, 'o cartão Onde gastar o ouro tem o botão no painel');
    const t2 = Date.now();
    await painel.executeJavaScript(`document.querySelector('.gastar .botao').click()`);
    const r2 = await esperarPronto(painel, t2);
    conferir(r2.g?.estado === 'pronto' && r2.g.motivo === 'botão', `botão Calcular: ${r2.g?.estado} (${r2.g?.motivo || r2.g?.erro}) em ${Math.round((Date.now() - t2) / 1000)} s`);
    await painel.executeJavaScript('desenhar(true)');
    const texto = await painel.executeJavaScript(`document.querySelector('.gastar')?.innerText || ''`);
    conferir(/Onde gastar o ouro/.test(texto) && /Conta de/.test(texto) && /se paga em|Nada do que o ouro compra/.test(texto), 'o cartão mostra a conta');
    // 3) um item equipado ainda sendo avaliado ("~?"): a conta não roda e o cartão diz que espera
    const avaliando = JSON.parse(JSON.stringify(novo)); avaliando.ts = Date.now(); avaliando.ficha.equip[1].id = '3031+5#ataque2~?';
    await painel.executeJavaScript(`chrome.storage.local.set(${JSON.stringify({ 'estado:Teste': avaliando })})`);
    await espera(5000);
    const g3 = await gastoDe(painel);
    conferir(g3?.esperandoFicha === true && g3.estado === 'pronto' && g3.em === r2.g.em, 'item sendo avaliado: não recalcula e marca que espera a ficha');
    await painel.executeJavaScript('desenhar(true)');
    conferir(/sendo avaliado/.test(await painel.executeJavaScript(`document.querySelector('.gastar')?.innerText || ''`)), 'o cartão diz que a conta espera o item ser avaliado');
    // 4) pedido inválido (personagem sem ficha) é recusado
    const recusa = await painel.executeJavaScript(`lupaApp.gastar('Ninguém')`);
    conferir(!!recusa?.erro, 'personagem sem ficha: recusado (' + (recusa?.erro || '?') + ')');
    try { fs.writeFileSync(path.join(SAIDA, 'painel.png'), (await painel.capturePage()).toPNG()); } catch {}
  } catch (e) {
    conferir(false, 'erro: ' + (e?.stack || e));
  } finally {
    servidor.close();
    console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nok');
    setTimeout(() => { try { fs.rmSync(DADOS, { recursive: true, force: true }); } catch {} app.exit(falhas.length ? 1 : 0); }, 500);
  }
});
