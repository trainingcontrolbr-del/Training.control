const CONFIG = {
  MASTER_API_URL: 'https://script.google.com/macros/s/AKfycbwZ30x1F9NtmoE2BN5Hcnc63h7hayzaqfeRbesAkmipmxekpZkCgiS98eWFOzDISg/exec'
};

/* ---------------------- PROTEÇÃO DE ACESSO ---------------------- */

const clienteRaw = sessionStorage.getItem('fichaepi_cliente');
const googleIdToken = sessionStorage.getItem('fichaepi_token');

if (!clienteRaw || !googleIdToken) {
  window.location.href = 'index.html';
}

const cliente = JSON.parse(clienteRaw);
document.getElementById('nome-empresa-sidebar').textContent = cliente.nomeEmpresa;

document.getElementById('btn-sair').addEventListener('click', () => {
  sessionStorage.removeItem('fichaepi_cliente');
  sessionStorage.removeItem('fichaepi_token');
  window.location.href = 'index.html';
});

/* ---------------------- NAVEGAÇÃO DO MENU LATERAL ---------------------- */

document.querySelectorAll('.sidebar-item').forEach(botao => {
  botao.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('ativo'));
    document.querySelectorAll('.painel').forEach(p => p.style.display = 'none');
    botao.classList.add('ativo');
    document.getElementById(botao.dataset.painel).style.display = 'block';
  });
});

/* ---------------------- CADASTRO DE FUNCIONÁRIO ---------------------- */

let funcionariosCache = [];

document.getElementById('form-funcionario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Cadastrando...';

  const nome = document.getElementById('f-nome').value;
  const telefone = document.getElementById('f-telefone').value;

  const payload = {
    action: 'criarFuncionarioTenant',
    googleIdToken,
    nome,
    cargo: document.getElementById('f-cargo').value,
    setor: document.getElementById('f-setor').value,
    matricula: document.getElementById('f-matricula').value,
    telefone,
    cpf: document.getElementById('f-cpf').value,
    email: document.getElementById('f-email').value
  };

  try {
    const res = await fetch(CONFIG.MASTER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const resultado = await res.json();

    if (resultado.success) {
      document.getElementById('resultado-cadastro').innerHTML = '✅ Funcionário cadastrado com sucesso!';
      e.target.reset();
      mostrarLinkTermo_(resultado.termoId, nome, telefone);
      carregarFuncionarios();
    } else {
      alert('Erro: ' + resultado.error);
    }
  } catch (err) {
    alert('Falha ao cadastrar: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="save"></i> Cadastrar funcionário';
    lucide.createIcons();
  }
});

function mostrarLinkTermo_(termoId, nome, telefone) {
  if (!termoId) return;
  const link = `${window.location.origin}${window.location.pathname.replace('painel.html', '')}assinar.html?id=${termoId}&cliente=${cliente.clienteId}`;
  document.getElementById('input-link-termo').value = link;

  const mensagem = encodeURIComponent(
    `Olá ${nome}! Antes de receber qualquer EPI, acesse o link abaixo no seu celular e assine o Termo de Responsabilidade:\n${link}`
  );
  const telefoneLimpo = (telefone || '').replace(/\D/g, '');
  document.getElementById('btn-whatsapp-termo').href = telefoneLimpo
    ? `https://wa.me/55${telefoneLimpo}?text=${mensagem}`
    : `https://wa.me/?text=${mensagem}`;

  document.getElementById('resultado-termo').style.display = 'block';
}

document.getElementById('btn-copiar-termo').addEventListener('click', () => {
  const input = document.getElementById('input-link-termo');
  input.select();
  navigator.clipboard.writeText(input.value);
  const btn = document.getElementById('btn-copiar-termo');
  btn.textContent = 'Copiado!';
  setTimeout(() => { btn.textContent = 'Copiar'; }, 1500);
});

/* ---------------------- LISTAGEM DE FUNCIONÁRIOS ---------------------- */

async function carregarFuncionarios() {
  const res = await fetch(`${CONFIG.MASTER_API_URL}?action=funcionariosTenant&googleIdToken=${encodeURIComponent(googleIdToken)}`);
  funcionariosCache = await res.json();
  const corpo = document.getElementById('corpo-tabela-funcionarios');

  if (!funcionariosCache.length) {
    corpo.innerHTML = '<tr><td colspan="4">Nenhum funcionário cadastrado ainda.</td></tr>';
    return;
  }

  corpo.innerHTML = funcionariosCache.map(f => `
    <tr>
      <td><button type="button" class="link-nome" onclick="abrirEdicaoFuncionario('${f.id}')">${f.nome}</button></td>
      <td>${f.cargo || '-'}</td>
      <td><span class="badge ${f.status === 'Inativo' ? 'inativo' : 'ativo'}">${f.status || 'Ativo'}</span></td>
      <td><button type="button" class="link-nome" onclick="abrirHistoricoFuncionario('${f.id}', '${f.nome.replace(/'/g, "\\'")}')">📄 Histórico</button></td>
    </tr>
  `).join('');
}

/* ---------------------- HISTÓRICO DE ASSINATURAS DO FUNCIONÁRIO (MODAL) ---------------------- */

async function abrirHistoricoFuncionario(funcionarioId, nomeFuncionario) {
  document.getElementById('titulo-historico').textContent = `Histórico — ${nomeFuncionario}`;
  document.getElementById('corpo-historico').innerHTML = 'Carregando...';
  document.getElementById('modal-historico-funcionario').classList.add('aberto');

  try {
    const res = await fetch(`${CONFIG.MASTER_API_URL}?action=fichasTenant&googleIdToken=${encodeURIComponent(googleIdToken)}&funcionarioId=${encodeURIComponent(funcionarioId)}`);
    const fichas = await res.json();

    if (!fichas.length) {
      document.getElementById('corpo-historico').innerHTML = '<p class="ajuda">Nenhuma ficha ou termo registrado ainda para este funcionário.</p>';
      return;
    }

    // Mais recentes primeiro
    fichas.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));

    document.getElementById('corpo-historico').innerHTML = fichas.map(f => {
      const itens = f.tipo === 'Entrega' ? (JSON.parse(f.itens || '[]').map(i => i.nome).join(', ') || '-') : '-';
      const dataCriacao = f.criadoEm ? new Date(f.criadoEm).toLocaleString('pt-BR') : '-';
      const dataAssinatura = f.assinadoEm ? new Date(f.assinadoEm).toLocaleString('pt-BR') : '-';
      const statusClasse = f.status === 'Assinada' ? 'ativo' : (f.status === 'Cancelada' ? 'inativo' : '');
      return `
        <div class="cartao-historico">
          <div class="cartao-historico-topo">
            <strong>${f.tipo === 'Termo' ? '📄 Termo de Responsabilidade' : '🦺 Entrega de EPI'}</strong>
            <span class="badge ${statusClasse}">${f.status}</span>
          </div>
          ${f.tipo === 'Entrega' ? `<p class="ajuda">Itens: ${itens}</p>` : ''}
          <p class="ajuda">Criado em: ${dataCriacao}</p>
          <p class="ajuda">Assinado em: ${dataAssinatura}</p>
          ${f.pdfUrl ? `<a href="${f.pdfUrl}" target="_blank" class="link-nome">Ver PDF →</a>` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    document.getElementById('corpo-historico').innerHTML = '⚠️ Falha ao carregar histórico: ' + err.message;
  }
}

document.getElementById('btn-fechar-historico').addEventListener('click', () => {
  document.getElementById('modal-historico-funcionario').classList.remove('aberto');
});
document.getElementById('modal-historico-funcionario').addEventListener('click', (e) => {
  if (e.target.id === 'modal-historico-funcionario') {
    document.getElementById('modal-historico-funcionario').classList.remove('aberto');
  }
});

/* ---------------------- EDIÇÃO DE FUNCIONÁRIO (MODAL) ---------------------- */

function abrirEdicaoFuncionario(funcionarioId) {
  const f = funcionariosCache.find(x => x.id === funcionarioId);
  if (!f) return;

  document.getElementById('ed-id').value = f.id;
  document.getElementById('ed-nome').value = f.nome || '';
  document.getElementById('ed-cargo').value = f.cargo || '';
  document.getElementById('ed-setor').value = f.setor || '';
  document.getElementById('ed-matricula').value = f.matricula || '';
  document.getElementById('ed-telefone').value = f.telefone || '';
  document.getElementById('ed-cpf').value = f.cpf || '';
  document.getElementById('ed-email').value = f.email || '';
  document.getElementById('ed-status').value = f.status === 'Inativo' ? 'Inativo' : 'Ativo';
  document.getElementById('status-edicao').textContent = '';

  document.getElementById('modal-editar-funcionario').classList.add('aberto');
}

function fecharModalEdicao_() {
  document.getElementById('modal-editar-funcionario').classList.remove('aberto');
}

document.getElementById('btn-fechar-modal').addEventListener('click', fecharModalEdicao_);
document.getElementById('modal-editar-funcionario').addEventListener('click', (e) => {
  if (e.target.id === 'modal-editar-funcionario') fecharModalEdicao_();
});

document.getElementById('form-editar-funcionario').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const status = document.getElementById('status-edicao');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  const payload = {
    action: 'editarFuncionarioTenant',
    googleIdToken,
    id: document.getElementById('ed-id').value,
    nome: document.getElementById('ed-nome').value,
    cargo: document.getElementById('ed-cargo').value,
    setor: document.getElementById('ed-setor').value,
    matricula: document.getElementById('ed-matricula').value,
    telefone: document.getElementById('ed-telefone').value,
    cpf: document.getElementById('ed-cpf').value,
    email: document.getElementById('ed-email').value,
    status: document.getElementById('ed-status').value
  };

  try {
    const res = await fetch(CONFIG.MASTER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const resultado = await res.json();

    if (resultado.success) {
      status.textContent = '✅ Salvo com sucesso!';
      await carregarFuncionarios();
      setTimeout(fecharModalEdicao_, 700);
    } else {
      status.textContent = '⚠️ ' + resultado.error;
    }
  } catch (err) {
    status.textContent = '⚠️ Falha ao salvar: ' + err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar';
  }
});

carregarFuncionarios();
