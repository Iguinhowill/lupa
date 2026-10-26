// Lupa (app) · regras de navegação da aba do jogo e das janelas de login. Separadas do main.js para ter teste
// (regras.test.js, `npm test`): mudaram muitas vezes, e um erro aqui ou quebra um login ou abre a aba para qualquer site.
'use strict';

// páginas que o jogo abre numa janela e que precisam da mesma partição (login do Google, Twitch e Discord); o resto
// vai para o navegador do sistema
const DA_CONTA = /^https:\/\/((www\.)?lolidle\.com\/|accounts\.google\.com\/|id\.twitch\.tv\/|discord\.com\/(api\/)?oauth2\/)/;
// por link direto: o jogo e as portas de entrada dos logins. Do Google, só os subdomínios de conta (sites., docs. e
// script.google.com hospedam páginas de terceiros); do Discord, só o OAuth e o login (não as páginas de convite)
const DO_JOGO = /^https:\/\/((www\.)?lolidle\.com\/|(accounts|myaccount|gds)\.google\.com\/|id\.twitch\.tv\/|discord\.com\/((api\/)?oauth2|login)([/?#]|$))/;
// onde o app se apresenta como Firefox (o Google recusa login em Chromium embutido)
const DO_GOOGLE = /^https:\/\/([a-z0-9-]+\.)*(google\.com(\.br)?|gstatic\.com|googleusercontent\.com|youtube\.com)\//;
// páginas de login entre as quais um login anda sozinho (o do Google passa pelo accounts.youtube.com; a Twitch manda
// para a página de login dela e volta pelo passport-callback); só as de conta, não o youtube.com, o googleusercontent.com
// ou a Twitch inteiros. Limitação aceita: a partir do /login, o site da Twitch troca de página por pushState, que não
// passa por aqui
const NO_LOGIN = /^https:\/\/((accounts|myaccount|gds)\.google\.com(\.br)?\/|accounts\.youtube\.com\/|(id|passport)\.twitch\.tv\/|www\.twitch\.tv\/(login|passport-callback)([/?#]|$)|discord\.com\/((api\/)?oauth2|login)([/?#]|$))/;

const origemDe = (url) => { try { return new URL(url).origin; } catch { return ''; } };

// a aba do jogo fica no jogo e nos logins; de uma página de login, pode seguir para outra página de login. `atual` é a
// página carregada (link) ou o salto atual da cadeia (redirecionamento)
function permitido(url, atual, origemJogo) {
  return DO_JOGO.test(url) || origemDe(url) === origemJogo || (NO_LOGIN.test(atual || '') && NO_LOGIN.test(url));
}

module.exports = { DA_CONTA, DO_JOGO, DO_GOOGLE, NO_LOGIN, origemDe, permitido };
