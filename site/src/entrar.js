// Lupa Online · entrar, ou criar uma conta com um código de convite (o banco confere o código e o gasta: um por conta)
'use strict';
(async () => {
  const SB = supabase.createClient(LUPA_CONFIG.url, LUPA_CONFIG.chave);
  const form = document.getElementById('form'), msg = document.getElementById('msg');
  if ((await SB.auth.getSession()).data.session) { location.replace('agora.html'); return; }

  const dados = () => { const d = new FormData(form); return { email: String(d.get('email') || '').trim(), password: String(d.get('senha') || '') }; };
  const travar = (sim) => { for (const b of form.querySelectorAll('button')) b.disabled = sim; };

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = dados();
    if (!d.email || !d.password) { msg.textContent = 'Preencha o e-mail e a senha.'; return; }
    travar(true); msg.textContent = 'Entrando…';
    const { error } = await SB.auth.signInWithPassword(d);
    travar(false);
    if (error) { msg.textContent = /Invalid login/i.test(error.message) ? 'E-mail ou senha errados.' : /not confirmed/i.test(error.message) ? 'Confirme o e-mail pelo link que chegou e tente de novo.' : error.message; return; }
    location.replace('agora.html');
  });

  document.getElementById('criar').addEventListener('click', async () => {
    const d = dados(), convite = String(new FormData(form).get('convite') || '').trim().toUpperCase();
    if (!d.email || d.password.length < 8) { msg.textContent = 'Para criar a conta: e-mail e uma senha com 8 caracteres ou mais, nos campos de cima.'; return; }
    if (!convite) { msg.textContent = 'Digite o código do convite.'; return; }
    travar(true); msg.textContent = 'Criando…';
    const { data, error } = await SB.auth.signUp({ ...d, options: { emailRedirectTo: location.origin + location.pathname, data: { convite } } });
    travar(false);
    // o banco recusa sem dizer o motivo ao navegador ("Database error saving new user")
    if (error) { msg.textContent = /Database error/i.test(error.message) ? 'Convite inválido ou já usado. Confira o código com quem te convidou.' : /already registered/i.test(error.message) ? 'Este e-mail já tem conta: use Entrar.' : error.message; return; }
    if (data.session) { location.replace('agora.html'); return; }
    msg.textContent = 'Conta criada. Confirme pelo link que chegou no seu e-mail e depois entre aqui.';
  });
})();
