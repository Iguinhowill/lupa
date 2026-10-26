// Lupa (app) · casos das regras de navegação (npm test). Cada linha: destino, de onde (página ou salto atual), se segue.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { permitido, DA_CONTA, DO_GOOGLE } = require('./regras');

const JOGO = 'https://lolidle.com';
const casos = [
  // o jogo
  ['https://lolidle.com/jogar#x', 'https://accounts.youtube.com/x', true, 'login → volta ao jogo'],
  ['https://lolidle.com.evil.com/', 'https://lolidle.com/jogar', false, 'domínio parecido'],
  ['https://lolidle.comevil.com/', 'https://lolidle.com/jogar', false, 'domínio colado'],
  ['https://evil.com/', 'https://lolidle.com/jogar', false, 'jogo → fora'],
  ['javascript:alert(1)', 'https://lolidle.com/jogar', false, 'javascript:'],
  // Google
  ['https://accounts.google.com/o/oauth2/v2/auth', 'https://lolidle.com/api/google/entrar', true, 'jogo → Google'],
  ['https://gds.google.com/web/recoveryoptions', 'https://accounts.google.com/x', true, 'Google → proteja sua conta'],
  ['https://accounts.youtube.com/accounts/SetSID', 'https://accounts.google.com/x', true, 'Google → SetSID'],
  ['https://lolidle.com/jogar#google=x', 'https://accounts.youtube.com/accounts/SetSID', true, 'SetSID → jogo'],
  ['https://accounts.youtube.com/accounts/SetSID', 'https://lolidle.com/api/google/volta', false, 'jogo → youtube direto'],
  ['https://www.google.com/url?q=https://evil.com/', 'https://lolidle.com/jogar', false, 'redirecionamento aberto do Google'],
  ['https://evil.com/', 'https://www.google.com/url?q=https://evil.com/', false, 'google.com/url → fora'],
  ['https://evil.com/', 'https://accounts.google.com/x', false, 'login Google → fora'],
  ['https://appengine.google.com/_ah/logout', 'https://accounts.google.com/Logout', false, 'Google → appengine'],
  ['https://sites.google.com/view/x', 'https://lolidle.com/jogar', false, 'jogo → sites.google.com'],
  ['https://script.google.com/macros/s/x', 'https://lolidle.com/jogar', false, 'jogo → script.google.com'],
  ['https://www.youtube.com/watch?v=1', 'https://accounts.google.com/v3/signin', false, 'Google → vídeo do youtube'],
  ['https://lh3.googleusercontent.com/x', 'https://accounts.google.com/v3/signin', false, 'Google → googleusercontent'],
  ['https://sso.empresa.com/saml', 'https://accounts.google.com/samlredirect', false, 'Google → SSO de empresa (limitação aceita)'],
  // Twitch
  ['https://www.twitch.tv/login?x=1', 'https://id.twitch.tv/oauth2/authorize', true, 'Twitch → /login'],
  ['https://passport.twitch.tv/login', 'https://www.twitch.tv/login', true, 'login Twitch → passport'],
  ['https://www.twitch.tv/passport-callback#x', 'https://passport.twitch.tv/x', true, 'Twitch → passport-callback'],
  ['https://lolidle.com/api/twitch/volta?code=x', 'https://id.twitch.tv/oauth2/authorize', true, 'Twitch → volta ao jogo'],
  ['https://www.twitch.tv/loginfulano', 'https://id.twitch.tv/oauth2/authorize', false, 'Twitch → canal "loginfulano"'],
  ['https://www.twitch.tv/algum_canal', 'https://id.twitch.tv/oauth2/authorize', false, 'Twitch → canal'],
  ['https://clips.twitch.tv/x', 'https://id.twitch.tv/oauth2/authorize', false, 'Twitch → clips'],
  // Discord
  ['https://discord.com/oauth2/authorize?x', 'https://lolidle.com/jogar', true, 'jogo → OAuth Discord'],
  ['https://discord.com/login?redirect_to=x', 'https://discord.com/oauth2/authorize', true, 'Discord → login'],
  ['https://lolidle.com/api/discord/volta?code=x', 'https://discord.com/oauth2/authorize', true, 'Discord → volta ao jogo'],
  ['https://discord.com/invite/abc', 'https://lolidle.com/jogar', false, 'jogo → convite Discord']
];

for (const [url, atual, esperado, nome] of casos) {
  test(`${esperado ? 'segue' : 'barra'}: ${nome}`, () => assert.equal(permitido(url, atual, JOGO), esperado));
}

test('a origem do jogo vem de fora (LUPA_JOGO): vale a que o main.js passar', () => {
  assert.equal(permitido('http://localhost:5173/jogar', '', 'http://localhost:5173'), true);
  assert.equal(permitido('http://localhost:5173/jogar', '', JOGO), false);
});

test('janela de login: só as entradas dos logins e do jogo', () => {
  assert.ok(DA_CONTA.test('https://accounts.google.com/o/oauth2/v2/auth'));
  assert.ok(DA_CONTA.test('https://discord.com/api/oauth2/authorize'));
  assert.ok(!DA_CONTA.test('https://discord.com/invite/abc'));
  assert.ok(!DA_CONTA.test('https://www.youtube.com/'));
});

test('Firefox só nas páginas do Google', () => {
  assert.ok(DO_GOOGLE.test('https://accounts.google.com/x'));
  assert.ok(DO_GOOGLE.test('https://accounts.youtube.com/x'));
  assert.ok(!DO_GOOGLE.test('https://lolidle.com/jogar'));
  assert.ok(!DO_GOOGLE.test('https://google.com.evil.com/'));
});
