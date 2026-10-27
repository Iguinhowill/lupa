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

  // o que o Supabase responde em inglês, em palavras daqui (o banco recusa o convite sem dizer o motivo: "Database error")
  const erroCadastro = (m) => /Database error/i.test(m) ? 'Convite inválido ou já usado. Confira o código com quem te convidou.'
    : /already registered/i.test(m) ? 'Este e-mail já tem conta: use Entrar.'
    : /Password should|weak/i.test(m) ? 'Senha fraca: use 8 caracteres ou mais, misturando letras e números.'
    : /rate limit|too many/i.test(m) ? 'Muitas tentativas seguidas: espere alguns minutos e tente de novo.'
    : /invalid.*email|email.*invalid/i.test(m) ? 'Esse e-mail não parece válido.'
    : m;
  async function criar() {
    const d = dados(), convite = String(new FormData(form).get('convite') || '').trim().toUpperCase();
    if (!d.email || d.password.length < 8) { msg.textContent = 'Para criar a conta: e-mail e uma senha com 8 caracteres ou mais, nos campos de cima.'; return; }
    if (!convite) { msg.textContent = 'Digite o código do convite.'; return; }
    travar(true); msg.textContent = 'Criando…';
    try {
      const { data, error } = await SB.auth.signUp({ ...d, options: { emailRedirectTo: location.origin + location.pathname, data: { convite } } });
      if (error) { msg.textContent = erroCadastro(error.message); return; }
      // e-mail que já tem conta: com confirmação por e-mail ligada, o Supabase devolve um usuário "vazio", sem erro e sem e-mail
      if (data.user && Array.isArray(data.user.identities) && !data.user.identities.length) { msg.textContent = 'Este e-mail já tem conta: use Entrar (o convite não foi gasto).'; return; }
      if (data.session) { location.replace('agora.html'); return; }
      msg.textContent = 'Conta criada. Confirme pelo link que chegou no seu e-mail e depois entre aqui.';
    } catch (e) {
      msg.textContent = 'Não deu para falar com o servidor agora. Confira a internet e tente de novo.';
    } finally { travar(false); }
  }
  document.getElementById('criar').addEventListener('click', criar);
  // Enter no campo do convite cria a conta (senão o formulário faria "Entrar")
  form.elements.convite?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); criar(); } });
})();
