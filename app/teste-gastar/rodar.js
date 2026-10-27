// Lupa (app) · teste do Onde gastar o ouro com o Electron de verdade: baixa o motor público do jogo (uma pasta temporária),
// roda o simulador na página escondida com a ficha de teste (estado-yasuo.json) e confere o resultado e o isolamento da página
// (sem rede). Não abre o jogo nem toca nas contas. Uso: npm run teste:gastar   (sai com código 1 se algo falhar)
'use strict';

const { app } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Simulador = require('../simulador');
const Gastar = require('../gastar');

Simulador.registrarEsquema();
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'lupa-teste-gastar-'));
app.setPath('userData', path.join(pasta, 'dados'));
const pastaJogo = path.join(pasta, 'motor'), pastaSim = path.join(__dirname, '..', 'sim');
const falhas = [];
const conferir = (ok, msg) => { if (!ok) falhas.push(msg); console.log((ok ? 'ok   ' : 'FALHA') + ' ' + msg); };

app.whenReady().then(async () => {
  try {
    const t0 = Date.now();
    const motor = await Simulador.motorPronto(pastaJogo);
    conferir(/^[0-9a-f]{64}$/.test(motor.sha) && motor.arquivos > 3, `motor baixado: ${motor.arquivos} arquivos, sha ${motor.sha.slice(0, 12)} (${Date.now() - t0} ms)`);

    // a página do simulador não tem rede: um fetch para fora tem de falhar
    const r0 = await Simulador.rodarCombates({ pastaSim, pastaJogo, jobs: [] });
    conferir(r0 && Object.keys(r0).length === 0, 'rodada vazia devolve {}');
    const { BrowserWindow } = require('electron');
    const ses = require('electron').session.fromPartition('lupa-simulador');
    const jan = new BrowserWindow({ show: false, webPreferences: { session: ses, sandbox: true, contextIsolation: true } });
    await jan.loadURL('lupasim://app/sim.html');
    const rede = await jan.webContents.executeJavaScript("fetch('https://lolidle.com/js/motor.js').then(() => 'abriu', (e) => 'bloqueou: ' + e.message)");
    conferir(/^bloqueou/.test(rede), 'a página do simulador não acessa a internet (' + rede + ')');
    const fora = await jan.webContents.executeJavaScript("fetch('lupasim://app/jogo/../../main.js').then((r) => r.status, () => 'erro')");
    conferir(fora === 404 || fora === 'erro', 'não sai da pasta do motor pelo lupasim:// (' + fora + ')');
    await new Promise((ok) => { jan.once('closed', ok); jan.close(); });

    // a conta inteira com a ficha de teste e alguns preços de Mercado inventados
    const estado = JSON.parse(fs.readFileSync(path.join(__dirname, 'estado-yasuo.json'), 'utf8'));
    const agora = Date.now();
    const menores = { '3074+5~A': { ouro: 3e6, em: agora }, '3085+5~A': { ouro: 2e6, em: agora }, 'gema:ataque3': { ouro: 8e6, em: agora } };
    const etapas = [];
    const t1 = Date.now();
    const g = await Gastar.calcular({ estado, menores, agora, motor: { sha: motor.sha.slice(0, 12) },
      rodar: (jobs, etapa) => { etapas.push(`${etapa}: ${jobs.length}`); return Simulador.rodarCombates({ pastaSim, pastaJogo, jobs, aoAndar: () => {} }); } });
    const seg = Math.round((Date.now() - t1) / 1000);
    conferir(g.estado === 'pronto' && g.campeao === 'yasuo', `conta pronta em ${seg} s (${etapas.join(', ')}), campeão ${g.campeao}`);
    conferir(g.base.abatesH > 500, `build atual: ${g.base.abatesH} abates/h simulados no ${g.zona.nome}`);
    conferir(g.conferidas >= 5 && g.opcoes.length + g.semGanho.length === g.conferidas, `${g.testadas} opções na triagem, ${g.conferidas} conferidas`);
    // o Yasuo está no teto de crítico e de velocidade: refinar a Runaan (crítico e velocidade) não muda nada
    const runaan = [...g.opcoes, ...g.semGanho].find((l) => /Forjar Furacão de Runaan/.test(l.titulo));
    conferir(runaan && Math.abs(runaan.ganho) < 0.002, `forjar a Runaan não rende (teto): ${runaan ? (runaan.ganho * 100).toFixed(2) + '%' : 'não conferida'}`);
    for (const l of g.opcoes) console.log(`  rende  ${(l.ganho * 100).toFixed(2).padStart(6)}% ±${(l.erro * 100).toFixed(2)} custo ${String(l.custo).padStart(10)} paga em ${l.horas ?? '—'} h · ${l.titulo}`);
    for (const l of g.semGanho) console.log(`  nada   ${(l.ganho * 100).toFixed(2).padStart(6)}% ±${(l.erro * 100).toFixed(2)} custo ${String(l.custo).padStart(10)} · ${l.titulo}`);
    fs.mkdirSync(path.join(__dirname, 'saida'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'saida', 'resultado.json'), JSON.stringify(g, null, 1));
  } catch (e) {
    conferir(false, 'erro: ' + (e?.stack || e));
  } finally {
    try { fs.rmSync(pasta, { recursive: true, force: true }); } catch {}      // o Windows às vezes segura a pasta por um instante
    console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\nok');
    app.exit(falhas.length ? 1 : 0);
  }
});
