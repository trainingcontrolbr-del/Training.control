const CONFIG = {
  MASTER_API_URL: 'https://script.google.com/macros/s/AKfycbwZ30x1F9NtmoE2BN5Hcnc63h7hayzaqfeRbesAkmipmxekpZkCgiS98eWFOzDISg/exec',
  GOOGLE_CLIENT_ID: '177704275179-tqv4pbiq6miujosnrt5orqnq8d97tkbq.apps.googleusercontent.com'
};
function initGoogleSignIn() {
  if (!window.google || !google.accounts) {
    setTimeout(initGoogleSignIn, 300);
    return;
  }
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(
    document.getElementById('g_id_signin'),
    { theme: 'outline', size: 'large', text: 'signin_with', width: 280 }
  );
}
function setStatus_(mensagem, classe) {
  const status = document.getElementById('status');
  status.textContent = mensagem;
  status.className = classe || '';
}
async function handleCredentialResponse(response) {
  const googleIdToken = response.credential;
  setStatus_('Verificando sua conta...', 'carregando');
  try {
    const res = await fetch(CONFIG.MASTER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'autenticar', googleIdToken })
    });
    const resultado = await res.json();
    if (resultado.success) {
      setStatus_(`✅ Bem-vindo(a), ${resultado.nomeEmpresa}! Entrando...`, 'sucesso');
      sessionStorage.setItem('fichaepi_cliente', JSON.stringify(resultado));
      sessionStorage.setItem('fichaepi_token', googleIdToken);
      setTimeout(() => { window.location.href = 'painel.html'; }, 700);
    } else {
      setStatus_('⚠️ ' + resultado.error, 'erro');
    }
  } catch (err) {
    setStatus_('⚠️ Falha ao verificar login: ' + err.message, 'erro');
  }
}
// Se já estiver logado (sessão ainda válida), vai direto pro painel
if (sessionStorage.getItem('fichaepi_cliente') && sessionStorage.getItem('fichaepi_token')) {
  window.location.href = 'painel.html';
} else {
  initGoogleSignIn();
}
