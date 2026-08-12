const CONFIG = {
  MASTER_API_URL: 'https://script.google.com/macros/s/AKfycbwZ30x1F9NtmoE2BN5Hcnc63h7hayzaqfeRbesAkmipmxekpZkCgiS98eWFOzDISg/exec',
  GOOGLE_CLIENT_ID: '177704275179-tqv4pbiq6miujosnrt5orqnq8d97tkbq.apps.googleusercontent.com'
};

const TEXTO_TERMO = [
  'Declaro que assumo total responsabilidade pela guarda e conservação do Equipamento Individual de Proteção e/ ou uniforme, abaixo descrito, e que recebi orientação sobre o seu uso correto, tomando os seguintes conhecimentos:',
  'Obrigação de usá-lo adequadamente durante o exercício de minhas atividades na empresa. Responsabilidade pela guarda e conservação. Obrigação de comunicar ao superior imediato qualquer alteração que torne impróprio para o uso ou seu extravio. Processo para substituição do EPI. Finalidade do EPI. Obrigação da empresa em substituí-lo imediatamente, quando danificado ou extraviado.',
  'Constitui ato faltoso a recusa, injustificada do empregado de usar EPI ora fornecido pela empresa sujeitando-se às penalidades previstas em lei (NR – 01 subitem 1.8.1).',
  'Conhecimento quanto ao procedimento de EPI. Conhecimento quanto às penalidades cabíveis quanto ao uso inadequado de EPI\u2019s.',
  'CLT – Art. 462 § 1° Em caso de dano causado pelo empregado, o desconto será lícito, desde que a possibilidade tenha sido acordada, ou na ocorrência de dolo do empregado.'
];

const params = new URLSearchParams(window.location.search);
const fichaId = params.get('id');
const clienteId = params.get('cliente');

let ficha = null;
let googleIdToken = null;
let emailLogado = null;
let biometriaVerificada = false;
let aceiteTermo = false;
let tracoPontos = [];
let desenhando = false;
let geolocalizacao = null;

/* ---------------------- CARREGAR A FICHA ---------------------- */

async function carregarFicha() {
  if (!fichaId || !clienteId) {
    document.getElementById('carregando').textContent = '⚠️ Link inválido: faltam dados na URL.';
    return;
  }
  try {
    const res = await fetch(`${CONFIG.MASTER_API_URL}?action=fichaPublica&clienteId=${encodeURIComponent(clienteId)}&fichaId=${encodeURIComponent(fichaId)}`);
    ficha = await res.json();

    if (!ficha) {
      document.getElementById('carregando').textContent = '⚠️ Ficha não encontrada. Peça um novo link.';
      return;
    }
    if (ficha.status === 'Assinada') {
      document.getElementById('carregando').textContent = '✅ Este documento já foi assinado anteriormente.';
      return;
    }
    if (ficha.status === 'Cancelada') {
      document.getElementById('carregando').textContent = '⚠️ Esta ficha foi cancelada.';
      return;
    }

    document.getElementById('subtitulo-ficha').textContent = `Olá, ${ficha.funcionarioNome}!`;

    if (ficha.tipo === 'Termo') {
      document.getElementById('titulo-pagina').textContent = '📄 Termo de Responsabilidade';
      document.getElementById('secao-termo').style.display = 'block';
      document.getElementById('texto-termo').innerHTML =
        TEXTO_TERMO.map(p => `<p>${p}</p>`).join('') +
        '<div id="fim-termo" style="height:1px;"></div>';
      document.getElementById('etapa-login').classList.remove('ativa');
      configurarAceiteTermo_();
    } else {
      document.getElementById('titulo-pagina').textContent = '📋 Ficha de Entrega de EPI';
      document.getElementById('secao-itens').style.display = 'block';
      const itens = JSON.parse(ficha.itens || '[]');
      document.getElementById('lista-itens-ficha').innerHTML = itens.map(i => `<li>${i.nome} (CA ${i.ca || 'N/A'})</li>`).join('');
      aceiteTermo = true;
    }

    document.getElementById('carregando').style.display = 'none';
    document.getElementById('conteudo-ficha').style.display = 'block';
    initGoogleSignIn();
  } catch (err) {
    document.getElementById('carregando').textContent = '⚠️ Erro ao carregar a ficha: ' + err.message;
  }
}

/* ---------------------- ACEITE DO TERMO (rolagem obrigatória) ---------------------- */

function configurarAceiteTermo_() {
  const textoBox = document.getElementById('texto-termo');
  const checkbox = document.getElementById('check-aceite');
  const label = document.getElementById('texto-aceite');
  const sentinela = document.getElementById('fim-termo');

  function liberarCheckbox_() {
    checkbox.disabled = false;
    label.textContent = 'Li, e concordo com o termo';
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          liberarCheckbox_();
          observer.disconnect();
        }
      });
    }, { root: textoBox, threshold: 0 });
    observer.observe(sentinela);
  }

  if (textoBox.scrollHeight <= textoBox.clientHeight + 10) {
    liberarCheckbox_();
  }

  checkbox.addEventListener('change', () => {
    aceiteTermo = checkbox.checked;
    if (aceiteTermo) {
      document.getElementById('etapa-login').classList.add('ativa');
    } else {
      document.getElementById('etapa-login').classList.remove('ativa');
    }
  });
}

/* ---------------------- ETAPA 1: LOGIN COM GOOGLE ---------------------- */

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

function decodeJwt_(token) {
  const payload = token.split('.')[1];
  const normalizado = payload.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(normalizado));
}

function handleCredentialResponse(response) {
  if (!aceiteTermo) {
    document.getElementById('status-login').textContent = '⚠️ Aceite o termo antes de continuar.';
    return;
  }
  googleIdToken = response.credential;
  const dados = decodeJwt_(googleIdToken);
  emailLogado = dados.email;

  document.getElementById('status-login').textContent = `✅ Logado como ${emailLogado}`;
  document.getElementById('etapa-login').classList.add('concluida');
  document.getElementById('etapa-login').classList.remove('ativa');
  document.getElementById('etapa-biometria').classList.add('ativa');
}

/* ---------------------- ETAPA 2: BIOMETRIA DO APARELHO ---------------------- */

document.getElementById('btn-biometria').addEventListener('click', async () => {
  const status = document.getElementById('status-biometria');
  if (!googleIdToken) {
    status.textContent = '⚠️ Faça login com o Google primeiro.';
    return;
  }
  if (!window.PublicKeyCredential) {
    status.textContent = '⚠️ Este navegador não suporta biometria do aparelho.';
    liberarEtapaAssinatura_();
    return;
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const userId = new Uint8Array(16);
    crypto.getRandomValues(userId);

    await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: { name: 'FichaEPI' },
        user: { id: userId, name: emailLogado, displayName: ficha.funcionarioNome },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000
      }
    });

    biometriaVerificada = true;
    status.textContent = '✅ Biometria confirmada';
    document.getElementById('etapa-biometria').classList.add('concluida');
    liberarEtapaAssinatura_();
  } catch (err) {
    status.textContent = '⚠️ Não foi possível confirmar (' + err.message + ').';
  }
});

function liberarEtapaAssinatura_() {
  document.getElementById('etapa-biometria').classList.remove('ativa');
  document.getElementById('etapa-assinatura').classList.add('ativa');
  document.getElementById('btn-enviar').disabled = false;
}

/* ---------------------- ETAPA 3: ASSINATURA ---------------------- */

const canvas = document.getElementById('signature-pad');
const ctx = canvas.getContext('2d');

function ajustarCanvas() {
  const proporcao = window.devicePixelRatio || 1;
  const largura = canvas.offsetWidth;
  const altura = canvas.offsetHeight;
  canvas.width = largura * proporcao;
  canvas.height = altura * proporcao;
  ctx.scale(proporcao, proporcao);
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0F1B3D';
}
window.addEventListener('resize', ajustarCanvas);
ajustarCanvas();

function posicaoRelativa(evento) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: +(evento.clientX - rect.left).toFixed(2),
    y: +(evento.clientY - rect.top).toFixed(2),
    p: evento.pressure && evento.pressure > 0 ? evento.pressure : 0.5,
    t: Date.now()
  };
}

canvas.addEventListener('pointerdown', (e) => {
  desenhando = true;
  const pos = posicaoRelativa(e);
  tracoPontos.push({ ...pos, tipo: 'start' });
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
});

canvas.addEventListener('pointermove', (e) => {
  if (!desenhando) return;
  const pos = posicaoRelativa(e);
  tracoPontos.push({ ...pos, tipo: 'move' });
  ctx.lineWidth = 1.5 + pos.p * 2.5;
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
});

['pointerup', 'pointerleave', 'pointercancel'].forEach(evt =>
  canvas.addEventListener(evt, () => { desenhando = false; })
);

document.getElementById('btn-limpar').addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  tracoPontos = [];
});

document.getElementById('btn-geo').addEventListener('click', () => {
  if (!navigator.geolocation) return alert('Geolocalização não suportada neste dispositivo');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      geolocalizacao = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      document.getElementById('status-geo').textContent = '📍 Localização capturada';
    },
    () => { document.getElementById('status-geo').textContent = '⚠️ Localização não autorizada'; }
  );
});

/* ---------------------- ENVIO FINAL ---------------------- */

document.getElementById('btn-enviar').addEventListener('click', async () => {
  const btn = document.getElementById('btn-enviar');

  if (!googleIdToken) return alert('Faça login com o Google primeiro');
  if (tracoPontos.length < 5) return alert('Assine no campo indicado antes de concluir');

  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const payload = {
    action: 'assinarFichaTenant',
    clienteId: clienteId,
    fichaId: fichaId,
    googleIdToken,
    webauthnVerificado: biometriaVerificada,
    assinaturaPng: canvas.toDataURL('image/png'),
    traco: tracoPontos,
    geo: geolocalizacao,
    dispositivo: {
      userAgent: navigator.userAgent,
      tela: `${screen.width}x${screen.height}`
    }
  };

  try {
    const res = await fetch(CONFIG.MASTER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const resultado = await res.json();

    if (resultado.success) {
      document.getElementById('resultado').innerHTML = `
        ✅ Documento assinado com sucesso!<br>
        Hash de integridade: <code>${resultado.hash}</code><br>
        ${resultado.pdfUrl ? `<a href="${resultado.pdfUrl}" target="_blank">Ver PDF</a>` : ''}
      `;
      document.getElementById('etapa-assinatura').classList.remove('ativa');
      btn.style.display = 'none';
    } else {
      alert('Erro: ' + resultado.error);
      btn.disabled = false;
      btn.textContent = 'Concluir e Assinar';
    }
  } catch (err) {
    alert('Falha ao enviar: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Concluir e Assinar';
  }
});

carregarFicha();
