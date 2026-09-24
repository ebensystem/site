const form = document.getElementById('login-form');
const message = document.getElementById('login-status');
const button = form.querySelector('button');
const toggle = document.getElementById('show-login');
function openLogin() {
  form.style.display = 'flex';
  toggle.setAttribute('aria-expanded', 'true');
}
toggle.addEventListener('click', event => {
  event.preventDefault();
  openLogin();
  form.elements.email.focus();
});
if (location.hash === '#login' || new URLSearchParams(location.search).has('login')) openLogin();
if (new URLSearchParams(location.search).get('login') === 'denied') {
  message.textContent = 'Acesso permitido somente a administradores autorizados.';
}
// O bloqueio de submit é instalado antes de baixar o SDK.
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = 'Entrando...';
  message.textContent = '';
  try {
    const [{ auth, authReady, isAdmin }, { signInWithEmailAndPassword, signOut }] = await Promise.all([
      import('./firebase.js'),
      import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    ]);
    await authReady;
    const { user } = await signInWithEmailAndPassword(auth, form.elements.email.value.trim(), form.elements.senha.value);
    form.elements.senha.value = '';
    let authorized = false;
    try { authorized = await isAdmin(user); }
    catch (error) { await signOut(auth); throw error; }
    if (!authorized) {
      await signOut(auth);
      message.textContent = 'Sua conta não possui permissão para acessar o painel administrativo.';
      return;
    }
    location.replace(new URL('../base/index.html', location.href));
  } catch (error) {
    const messages = {
      'auth/invalid-credential': 'E-mail ou senha inválidos.',
      'auth/wrong-password': 'E-mail ou senha inválidos.',
      'auth/user-not-found': 'E-mail ou senha inválidos.',
      'auth/invalid-email': 'Informe um e-mail válido.',
      'auth/user-disabled': 'Esta conta está desativada. Entre em contato com a equipe.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
      'auth/network-request-failed': 'Verifique sua conexão e tente novamente.',
    };
    message.textContent = messages[error.code] || 'Login indisponível no momento. Tente novamente mais tarde ou contate a equipe.';
  } finally {
    form.elements.senha.value = '';
    button.disabled = false;
    button.textContent = 'Logar';
  }
});
