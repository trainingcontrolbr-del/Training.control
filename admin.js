const CONFIG = {
  MASTER_API_URL: 'https://script.google.com/macros/s/AKfycbwZ30x1F9NtmoE2BN5Hcnc63h7hayzaqfeRbesAkmipmxekpZkCgiS98eWFOzDISg/exec',
  GOOGLE_CLIENT_ID: '177704275179-tqv4pbiq6miujosnrt5orqnq8d97tkbq.apps.googleusercontent.com'
};

let googleIdToken = null;
let clientesCache = [];

/* ---------------------- LOGIN (SUPER ADMIN) ---------------------- */

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
    { theme: 'outline', size: 'large', text: 'signin_with', width: 260 }
  );
}

async function handleCredentialResponse(response) {
  googleIdToken = response.credential;
  const status = document.getElementById('status-login-admin');
  status.textContent = 'Verificando permissão...';
  status.className = '';

  try {
    const res = await fetch(`${CONFIG.MASTER_API_URL}?action=listarClientesAdmin&googleIdToken=${encodeURIComponent(googleIdToken)}`);
    const resultado = await res.json();

    if (resultado.error) {
      status.textContent = '⚠️ ' + resultado.error;
      status.className = 'erro';
      googleIdToken = null;
      return;
    }

    clientesCache = resultado;
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('app-shell').style.display = 'flex';
    renderizarTabelaClientes_();
  } catch (err) {
    status.textContent = '⚠️ Falha ao verificar: ' + err.message;
    status.className = 'erro';
  }
}

/* ---------------------- NAVEGAÇÃO DO MENU LATERAL ---------------------- */

document.querySelectorAll('.sidebar-link[data-painel]').forEach(botao => {
  botao.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('ativo'));
    document.querySelectorAll('.painel').forEach(p => p.style.display = 'none');
    botao.classList.add('ativo');
    document.getElementById(botao.dataset.painel).style.display = 'block';
  });
});

/* ---------------------- CADASTRAR CLIENTE NOVO ---------------------- */

document.getElementById('form-cliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Criando...';

  const payload = {
    action: 'criarClienteAdmin',
    googleIdToken,
    nomeEmpresa: document.getElementById('c-nome').value,
    cnpj: document.getElementById('c-cnpj').value,
    plano: document.getElementById('c-plano').value || 'Padrão',
    emailAdmin: document.getElementById('c-email').value
  };

  try {
    const res = await fetch(CONFIG.MASTER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const resultado = await res.json();

    if (resultado.success) {
      document.getElementById('resultado-cliente').innerHTML = `
        ✅ Cliente criado com sucesso!<br>
        <a href="${resultado.spreadsheetUrl}" target="_blank">Ver planilha</a> ·
        <a href="${resultado.driveFolderUrl}" target="_blank">Ver pasta</a>
      `;
      e.target.reset();
      document.getElementById('c-plano').value = 'Padrão';
      await recarregarClientes_();
    } else {
      alert('Erro: ' + resultado.error);
    }
  } catch (err) {
    alert('Falha ao criar cliente: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Criar cliente';
  }
});

/* ---------------------- LISTAGEM E GESTÃO DE CLIENTES ---------------------- */

async function recarregarClientes_() {
  const res = await fetch(`${CONFIG.MASTER_API_URL}?action=listarClientesAdmin&googleIdToken=${encodeURIComponent(googleIdToken)}`);
  clientesCache = await res.json();
  renderizarTabelaClientes_();
}

function renderizarTabelaClientes_() {
  const corpo = document.getElementById('corpo-tabela-clientes');
  if (!clientesCache.length) {
    corpo.innerHTML = '<tr><td colspan="5">Nenhum cliente cadastrado ainda.</td></tr>';
    return;
  }

  corpo.innerHTML = clientesCache.map(c => `
    <tr>
      <td>${c.nomeEmpresa}</td>
      <td>${c.emailAdmin}</td>
      <td>${c.plano || '-'}</td>
      <td><span class="badge ${c.status === 'Ativo' ? 'ativo' : 'inativo'}">${c.status}</span></td>
      <td>
        <button type="button" class="botao secundario botao-pequeno" onclick="alternarStatus_('${c.id}', '${c.status}')">
          ${c.status === 'Ativo' ? 'Desativar' : 'Ativar'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function alternarStatus_(clienteId, statusAtual) {
  const novoStatus = statusAtual === 'Ativo' ? 'Inativo' : 'Ativo';
  if (!confirm(`Confirma alterar o status para "${novoStatus}"?`)) return;

  try {
    const res = await fetch(CONFIG.MASTER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'editarClienteAdmin', googleIdToken, id: clienteId, status: novoStatus })
    });
    const resultado = await res.json();
    if (resultado.success) {
      await recarregarClientes_();
    } else {
      alert('Erro: ' + resultado.error);
    }
  } catch (err) {
    alert('Falha ao atualizar: ' + err.message);
  }
}

initGoogleSignIn();
