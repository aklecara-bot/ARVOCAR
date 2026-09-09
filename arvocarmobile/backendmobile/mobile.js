// =========================================================================
// MÓDULO: OPERAÇÃO MOBILE DE ROTAS - ARVO
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";
const ADMIN_EMAIL = "admin@arvo.tec.br";

const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }));

// Validação simplificada de CNH por formato (11 dígitos e sem repetições)
const validarNumeroCNH = (cnh) => {
  if (!cnh) return false;
  const limpo = String(cnh).replace(/\D/g, '');
  return /^\d{11}$/.test(limpo) && !/^(\d)\1{10}$/.test(limpo);
};

let usuarioLogado = null;
let veiculos = [];
let rotas = [];

// =========================================================================
// CONTROLE DE SESSÃO E LOGIN
// =========================================================================
function obterSessaoAtiva() {
  const sessao = localStorage.getItem('arvo_mobile_user') || localStorage.getItem('arvo_usuario_logado');
  try {
    return sessao ? JSON.parse(sessao) : null;
  } catch (e) {
    return sessao ? { email: sessao, nome: sessao } : null;
  }
}

function salvarSessaoUnificada(usuario) {
  const dados = JSON.stringify(usuario);
  localStorage.setItem('arvo_mobile_user', dados);
  localStorage.setItem('arvo_usuario_logado', dados);
}

function salvarCredenciaisOffline(email, senha, dadosUsuario) {
  const creds = JSON.parse(localStorage.getItem('arvo_creds_cache') || '{}');
  creds[email.toLowerCase()] = {
    senha: String(senha).trim(),
    usuario: dadosUsuario
  };
  localStorage.setItem('arvo_creds_cache', JSON.stringify(creds));
}

function validarCredenciaisOffline(email, senha) {
  const creds = JSON.parse(localStorage.getItem('arvo_creds_cache') || '{}');
  const conta = creds[email.toLowerCase()];
  if (conta && conta.senha === String(senha).trim()) {
    return conta.usuario;
  }
  return null;
}

function toggleSenhaMobile() {
  const input = document.getElementById('m-senha');
  const icone = document.getElementById('m-icone-senha');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icone) icone.className = 'ph-bold ph-eye-slash text-base';
  } else {
    input.type = 'password';
    if (icone) icone.className = 'ph-bold ph-eye text-base';
  }
}

async function handleMobileLogin(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const emailInput = document.getElementById('m-email');
  const senhaInput = document.getElementById('m-senha');
  const btn = document.getElementById('btn-m-login');
  const erroBox = document.getElementById('m-login-erro');
  const erroMsg = document.getElementById('m-login-erro-msg');

  if (erroBox) erroBox.classList.add('hidden');

  const email = (emailInput?.value || '').trim().toLowerCase();
  const senha = (senhaInput?.value || '').trim();

  if (!email || !senha) {
    if (erroMsg) erroMsg.innerText = "Informe o e-mail e a senha.";
    if (erroBox) erroBox.classList.remove('hidden');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Entrando...`;
  }

  try {
    if (!navigator.onLine) {
      const usuarioOffline = validarCredenciaisOffline(email, senha);
      if (usuarioOffline) {
        usuarioLogado = usuarioOffline;
        salvarSessaoUnificada(usuarioLogado);
        iniciarAppMobile();
        return;
      } else {
        throw new Error("Sem internet. Conecte-se online ao menos uma vez neste aparelho.");
      }
    }

    const { data, error } = await db
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new Error("Erro de conexão com o banco.");
    if (!data) throw new Error("Usuário não cadastrado.");
    if (String(data.senha).trim() !== senha) throw new Error("Senha incorreta.");
    if (data.status && data.status.toLowerCase() === 'inativo') {
      throw new Error("Usuário inativo no sistema.");
    }

    // Bloqueio por CNH inválida (exceto administrador)
    const ehAdmin = email === ADMIN_EMAIL.toLowerCase();
    if (!ehAdmin && !validarNumeroCNH(data.cnh)) {
      throw new Error("⛔ Acesso bloqueado: CNH não cadastrada ou número inválido (exige 11 dígitos numéricos).");
    }

    usuarioLogado = {
      id: data.id,
      nome: data.nome || email.split('@')[0],
      email: data.email,
      cnh: data.cnh || '',
      perfil: data.perfil || 'motorista'
    };

    salvarSessaoUnificada(usuarioLogado);
    salvarCredenciaisOffline(email, senha, usuarioLogado);

    iniciarAppMobile();

  } catch (err) {
    console.error("Erro no login mobile:", err);
    if (erroMsg) erroMsg.innerText = err.message || "E-mail ou senha inválidos.";
    if (erroBox) erroBox.classList.remove('hidden');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Entrar no Sistema</span> <i class="ph-bold ph-arrow-right text-base"></i>`;
    }
  }
}

function handleMobileLogout() {
  if (confirm("Deseja realmente sair da sua conta no aplicativo?")) {
    localStorage.removeItem('arvo_mobile_user');
    localStorage.removeItem('arvo_usuario_logado');
    usuarioLogado = null;
    const screenApp = document.getElementById('screen-app');
    const screenLogin = document.getElementById('screen-login');
    if (screenApp && screenLogin) {
      screenApp.classList.add('hidden');
      screenLogin.classList.remove('hidden');
    }
  }
}

function iniciarAppMobile() {
  const screenLogin = document.getElementById('screen-login');
  const screenApp = document.getElementById('screen-app');
  const topUsername = document.getElementById('m-top-username');

  if (screenLogin) screenLogin.classList.add('hidden');
  if (screenApp) screenApp.classList.remove('hidden');
  if (topUsername && usuarioLogado) {
    topUsername.innerText = `${usuarioLogado.nome} (${usuarioLogado.email})`;
  }

  switchMobileTab('iniciar');
  carregarDadosMobile();
  sincronizarFilaRotas();
}

function switchMobileTab(tab) {
  const abas = ['iniciar', 'finalizar', 'historico'];
  abas.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`nav-btn-${t}`);
    if (el) el.classList.add('hidden');
    if (btn) {
      btn.classList.remove('text-brand-700', 'font-bold');
      btn.classList.add('text-slate-400', 'font-semibold');
    }
  });

  const activeView = document.getElementById(`tab-${tab}`);
  const activeBtn = document.getElementById(`nav-btn-${tab}`);
  if (activeView) activeView.classList.remove('hidden');
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-400', 'font-semibold');
    activeBtn.classList.add('text-brand-700', 'font-bold');
  }
}

// =========================================================================
// CARREGAMENTO DE DADOS
// =========================================================================
async function carregarDadosMobile() {
  const veiculosCache = localStorage.getItem('arvo_cache_veiculos');
  const rotasCache = localStorage.getItem('arvo_cache_rotas');

  if (veiculosCache) {
    try { veiculos = JSON.parse(veiculosCache); } catch(e) {}
  }
  if (rotasCache) {
    try { rotas = JSON.parse(rotasCache); } catch(e) {}
  }

  renderizarOpcoesVeiculos();
  renderizarOpcoesRotasAtivas();
  renderizarHistoricoMobile();

  if (navigator.onLine) {
    try {
      const { data: dadosV } = await db.from('veiculos').select('*').neq('status', 'Fora de Uso').order('nome_frota');
      if (dadosV) {
        veiculos = dadosV;
        localStorage.setItem('arvo_cache_veiculos', JSON.stringify(dadosV));
        renderizarOpcoesVeiculos();
      }

      const { data: dadosR } = await db.from('rotas').select('*').order('data_saida', { ascending: false });
      if (dadosR) {
        const pendentes = rotas.filter(r => String(r.id).startsWith('temp_'));
        rotas = [...pendentes, ...dadosR.filter(r => !pendentes.some(p => p.id === r.id))];
        localStorage.setItem('arvo_cache_rotas', JSON.stringify(rotas));
        renderizarOpcoesRotasAtivas();
        renderizarHistoricoMobile();
      }

      verificarRotasExcedidas12hMobile();
    } catch (err) {
      console.warn("Offline: utilizando dados salvos localmente.");
    }
  }
}

function renderizarOpcoesVeiculos() {
  const select = document.getElementById('m-inicio-veiculo');
  if (!select) return;

  select.innerHTML = '<option value="">Selecione o veículo...</option>';
  (veiculos || [])
    .filter(v => v.status === 'Disponivel')
    .forEach(v => {
      const nomeFrota = v.nome_frota || v.id;
      select.innerHTML += `
        <option value="${nomeFrota}" data-uuid="${v.uuid_veiculos || ''}" data-placa="${v.placa || ''}">
          ${nomeFrota} - ${v.marca || ''} [${v.placa || 'S/ Placa'}] (${Number(v.km_atual || 0).toLocaleString('pt-BR')} km)
        </option>
      `;
    });
}

function atualizarKmVeiculoMobile() {
  const select = document.getElementById('m-inicio-veiculo');
  const vId = select?.value;
  const opt = select?.options[select.selectedIndex];
  const uuid = opt?.dataset?.uuid;

  const v = (veiculos || []).find(item => (uuid && item.uuid_veiculos === uuid) || (item.nome_frota === vId || item.id === vId));
  const inputKm = document.getElementById('m-inicio-km');
  if (inputKm) inputKm.value = v ? v.km_atual : '';
}

function toggleOutroOrigemMobile(valor) {
  const input = document.getElementById('m-inicio-origem-outro');
  if (input) {
    if (valor === 'OUTRO') {
      input.classList.remove('hidden');
      input.required = true;
      input.focus();
    } else {
      input.classList.add('hidden');
      input.required = false;
      input.value = '';
    }
  }
}

function toggleOutroDestinoMobile(valor) {
  const input = document.getElementById('m-fim-destino-outro');
  if (input) {
    if (valor === 'OUTRO') {
      input.classList.remove('hidden');
      input.required = true;
      input.focus();
    } else {
      input.classList.add('hidden');
      input.required = false;
      input.value = '';
    }
  }
}

function toggleAnomaliaMobile(show) {
  const txt = document.getElementById('m-fim-anomalia');
  if (txt) {
    if (show) {
      txt.classList.remove('hidden');
      txt.focus();
    } else {
      txt.classList.add('hidden');
      txt.value = '';
    }
  }
}

async function handleMobileInicioRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-confirmar-inicio');
  const selectElem = document.getElementById('m-inicio-veiculo');
  const veiculoId = selectElem?.value;
  const optSelecionada = selectElem ? selectElem.options[selectElem.selectedIndex] : null;

  const uuidVeiculo = optSelecionada?.dataset?.uuid || null;
  const placaVeiculo = optSelecionada?.dataset?.placa || null;

  const veiculo = (veiculos || []).find(v => 
    (uuidVeiculo && String(v.uuid_veiculos) === String(uuidVeiculo)) || 
    (placaVeiculo && String(v.placa) === String(placaVeiculo)) ||
    String(v.nome_frota) === String(veiculoId) || 
    String(v.id) === String(veiculoId)
  );

  if (!veiculo || !usuarioLogado) {
    alert("Selecione um veículo disponível.");
    return;
  }

  const placaFinal = veiculo.placa || placaVeiculo;
  const nomeFrotaFinal = veiculo.nome_frota || veiculoId;

  const selectOrigem = document.getElementById('m-inicio-origem')?.value;
  const outroOrigem = document.getElementById('m-inicio-origem-outro')?.value?.trim();
  const origemFinal = selectOrigem === 'OUTRO' ? outroOrigem : selectOrigem;
  const finalidade = document.getElementById('m-inicio-finalidade')?.value || 'DEMANDAS INTERNAS';
  const kmSaida = Number(document.getElementById('m-inicio-km')?.value || veiculo.km_atual || 0);

  if (!origemFinal) {
    alert("Informe a origem da rota.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;
  }

  const payloadRota = {
    veiculo_id: nomeFrotaFinal,
    uuid_veiculos: veiculo.uuid_veiculos || uuidVeiculo || null,
    placa: placaFinal,
    responsavel: usuarioLogado.email,
    origem: origemFinal,
    finalidade: finalidade,
    km_saida: kmSaida,
    data_saida: new Date().toISOString(),
    status: 'Em Uso'
  };

  try {
    const { error: insertErr } = await db.from('rotas').insert([payloadRota]);
    if (insertErr) throw insertErr;

    await db.from('veiculos').update({ status: 'Em Uso' }).eq('placa', placaFinal);

    alert(`✅ Rota iniciada com sucesso!`);
    e.target.reset();
    toggleOutroOrigemMobile('');
    await carregarDadosMobile();
    switchMobileTab('finalizar');
  } catch (err) {
    alert("Erro ao iniciar rota: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Confirmar Saída</span>`;
    }
  }
}

function renderizarOpcoesRotasAtivas() {
  const select = document.getElementById('m-fim-rota-select');
  if (!select || !usuarioLogado) return;

  const ehAdmin = (usuarioLogado.email || '').toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

  select.innerHTML = '<option value="">Selecione a rota ativa...</option>';

  // Admin visualiza todas as rotas ativas; condutor visualiza as suas
  (rotas || [])
    .filter(r => r.status === 'Em Uso' && (ehAdmin || r.responsavel === usuarioLogado.email))
    .forEach(r => {
      select.innerHTML += `<option value="${r.id}">${r.veiculo_id} [${r.placa || 'S/ Placa'}] (${r.responsavel}) - Saída: ${Number(r.km_saida).toLocaleString('pt-BR')} km</option>`;
    });
}

function selecionarRotaFimMobile() {
  const rotaId = document.getElementById('m-fim-rota-select')?.value;
  const rota = (rotas || []).find(r => String(r.id) === String(rotaId));
  const card = document.getElementById('m-detalhes-viagem');
  const inputKm = document.getElementById('m-fim-km');

  if (rota) {
    const elVeiculo = document.getElementById('m-info-veiculo');
    const elKm = document.getElementById('m-info-kmsaida');
    if (elVeiculo) elVeiculo.innerText = `${rota.veiculo_id} (${rota.placa || '-'}) [${rota.responsavel}]`;
    if (elKm) elKm.innerText = `${Number(rota.km_saida).toLocaleString('pt-BR')} km`;
    if (inputKm) {
      inputKm.min = rota.km_saida;
      inputKm.value = rota.km_saida;
    }
    if (card) card.classList.remove('hidden');
    calcularKmPercorridoMobile();
  } else {
    if (card) card.classList.add('hidden');
  }
}

function calcularKmPercorridoMobile() {
  const rotaId = document.getElementById('m-fim-rota-select')?.value;
  const rota = (rotas || []).find(r => String(r.id) === String(rotaId));
  const inputKm = document.getElementById('m-fim-km');
  const txtPercorrido = document.getElementById('m-info-percorrido') || document.getElementById('m-km-feedback');

  if (rota && inputKm && txtPercorrido) {
    const kmFim = Number(inputKm.value) || 0;
    const delta = kmFim - Number(rota.km_saida);
    txtPercorrido.innerText = delta >= 0 ? `${delta.toLocaleString('pt-BR')} km` : 'KM menor que saída';
  }
}

async function handleMobileFimRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-confirmar-fim');
  const rotaId = document.getElementById('m-fim-rota-select')?.value;
  const rota = (rotas || []).find(r => String(r.id) === String(rotaId));

  if (!rota) {
    alert("Selecione uma rota ativa.");
    return;
  }

  // Trava de permissão: somente criador ou Admin podem encerrar
  const emailAtual = (usuarioLogado?.email || '').toLowerCase().trim();
  const donoRota = (rota.responsavel || '').toLowerCase().trim();
  const ehAdmin = emailAtual === ADMIN_EMAIL.toLowerCase().trim();

  if (emailAtual !== donoRota && !ehAdmin) {
    alert(`⛔ Permissão Negada: Apenas o condutor responsável (${rota.responsavel}) ou o Administrador podem finalizar esta rota.`);
    return;
  }

  const selectDestino = document.getElementById('m-fim-destino')?.value;
  const outroDestino = document.getElementById('m-fim-destino-outro')?.value?.trim();
  const destinoFinal = selectDestino === 'OUTRO' ? outroDestino : selectDestino;
  const kmRetorno = Number(document.getElementById('m-fim-km')?.value || 0);
  const situacao = document.querySelector('input[name="m_situacao_carro"]:checked')?.value;
  const anomaliaTexto = situacao === 'COM' ? (document.getElementById('m-fim-anomalia')?.value?.trim() || '') : null;

  if (kmRetorno < Number(rota.km_saida)) {
    alert(`O KM final (${kmRetorno}) não pode ser menor que o inicial (${rota.km_saida}).`);
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Finalizando...`;
  }

  const kmTotal = kmRetorno - Number(rota.km_saida);

  try {
    const { error: errRota } = await db.from('rotas').update({
      destino: destinoFinal,
      km_retorno: kmRetorno,
      km_total: kmTotal,
      data_retorno: new Date().toISOString(),
      status: 'Concluida',
      anomalia: anomaliaTexto
    }).eq('id', rota.id);

    if (errRota) throw errRota;

    await db.from('veiculos').update({
      km_atual: kmRetorno,
      status: 'Disponivel'
    }).eq('placa', rota.placa);

    alert(`✅ Rota finalizada com sucesso!`);
    e.target.reset();
    document.getElementById('m-detalhes-viagem')?.classList.add('hidden');
    await carregarDadosMobile();
    switchMobileTab('historico');
  } catch (err) {
    alert("Erro ao finalizar rota: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Finalizar Rota</span>`;
    }
  }
}

function renderizarHistoricoMobile() {
  const container = document.getElementById('m-lista-historico');
  const badge = document.getElementById('m-total-rotas-badge');
  if (!container || !usuarioLogado) return;

  const minhasRotas = (rotas || []).filter(r => r.responsavel === usuarioLogado.email);
  if (badge) badge.innerText = `${minhasRotas.length} rotas`;
  container.innerHTML = '';

  if (minhasRotas.length === 0) {
    container.innerHTML = `<div class="p-6 bg-white rounded-2xl text-center text-xs text-slate-400">Nenhuma rota registrada até o momento.</div>`;
    return;
  }

  minhasRotas.forEach(r => {
    const card = document.createElement('div');
    card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 transition";
    const isEmUso = r.status === 'Em Uso';
    const dtSaidaFmt = new Date(r.data_saida).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
          <i class="ph-bold ph-car text-brand-600"></i> ${r.veiculo_id}
          <span class="text-[10px] text-slate-500 font-mono">(${r.placa || 'Sem placa'})</span>
        </span>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isEmUso ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">
          ${r.status}
        </span>
      </div>
      <div class="text-xs text-slate-700 font-medium flex items-center gap-1">
        <span>${r.origem}</span> &rarr; <span>${r.destino || '<em class="text-amber-600">Em trânsito</em>'}</span>
      </div>
      <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1.5 border-t border-slate-100">
        <span>Saída: ${dtSaidaFmt}</span>
        <span>${r.km_total ? `${r.km_total} km rodados` : `KM Inicial: ${r.km_saida}`}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function sincronizarFilaRotas() {}

// =========================================================================
// SISTEMA DE ALERTAS & POP-UP DE ROTAS EXCEDIDAS (> 12H)
// =========================================================================
function abrirFinalizacaoDiretaMobile(rotaId) {
  switchMobileTab('finalizar');
  const select = document.getElementById('m-fim-rota-select');
  if (select) {
    select.value = String(rotaId);
    selecionarRotaFimMobile();
  }
}

function exibirPopUpAlertaMobile(rota, horasAbertas) {
  const modalId = `modal-alerta-mobile-${rota.id}`;
  if (document.getElementById(modalId)) return;

  const emailUsuario = (usuarioLogado?.email || '').toLowerCase().trim();
  const responsavelRota = String(rota.responsavel || '').toLowerCase().trim();
  const isAdmin = emailUsuario === ADMIN_EMAIL.toLowerCase().trim();
  const podeFinalizar = isAdmin || (emailUsuario === responsavelRota);

  const popUp = document.createElement('div');
  popUp.id = modalId;
  popUp.className = "modal-alerta-backdrop";
  popUp.innerHTML = `
    <div class="modal-alerta-card">
      <div class="modal-alerta-icon-box">
        <i class="ph-bold ph-warning-circle"></i>
      </div>
      <div>
        <h3 style="font-size: 1rem; font-weight: 900; color: #0f172a; margin: 0;">Atenção: Rota Pendente!</h3>
        <p style="font-size: 0.75rem; color: #64748b; margin-top: 0.35rem; line-height: 1.3;">
          A rota <b style="color: #0f172a;">#${rota.id}</b> com o veículo <b style="color: #0f172a;">${rota.veiculo_id} [${rota.placa || 'Sem placa'}]</b> (Condutor: <b>${rota.responsavel}</b>) está aberta há mais de <span style="color: #e11d48; font-weight: 700;">${Math.floor(horasAbertas)} horas</span>.
        </p>
      </div>

      <div class="modal-alerta-box-aviso">
        ${podeFinalizar 
          ? "Por favor, finalize o check-in e registre o KM final para evitar inconsistências no fechamento." 
          : "Esta rota está aberta há mais de 12 horas. Apenas o condutor responsável deve encerrá-la."}
      </div>

      <div class="modal-alerta-actions">
        <button onclick="document.getElementById('${modalId}').remove()" class="btn-alerta-lembrar">
          ${podeFinalizar ? "Lembrar Depois" : "Fechar"}
        </button>
        ${podeFinalizar ? `
          <button onclick="document.getElementById('${modalId}').remove(); abrirFinalizacaoDiretaMobile('${rota.id}');" class="btn-alerta-finalizar">
            Finalizar Agora
          </button>
        ` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(popUp);
}

async function verificarRotasExcedidas12hMobile() {
  if (!usuarioLogado || !db) return;

  try {
    const { data: rotasAtivas, error } = await db
      .from('rotas')
      .select('*')
      .eq('status', 'Em Uso');

    if (error || !rotasAtivas) return;

    const agora = new Date().getTime();

    rotasAtivas.forEach(rota => {
      const dataRef = rota.data_saida || rota.created_at;
      if (!dataRef) return;

      const dataSaida = new Date(dataRef).getTime();
      if (isNaN(dataSaida)) return;

      const diferencaHoras = (agora - dataSaida) / (1000 * 60 * 60);

      // Notifica todos os usuários logados no aplicativo mobile
      if (diferencaHoras >= 12) {
        exibirPopUpAlertaMobile(rota, diferencaHoras);
      }
    });
  } catch (err) {
    console.warn("Falha ao checar rotas pendentes no mobile:", err);
  }
}

// =========================================================================
// INICIALIZAÇÃO E EXPORTAÇÃO GLOBAL
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const sessao = obterSessaoAtiva();
  if (sessao) {
    usuarioLogado = sessao;
    iniciarAppMobile();
  }

  setInterval(verificarRotasExcedidas12hMobile, 5 * 60 * 1000);
});

window.toggleSenhaMobile = toggleSenhaMobile;
window.handleMobileLogin = handleMobileLogin;
window.handleMobileLogout = handleMobileLogout;
window.switchMobileTab = switchMobileTab;
window.atualizarKmVeiculoMobile = atualizarKmVeiculoMobile;
window.toggleOutroOrigemMobile = toggleOutroOrigemMobile;
window.toggleOutroDestinoMobile = toggleOutroDestinoMobile;
window.toggleAnomaliaMobile = toggleAnomaliaMobile;
window.handleMobileInicioRota = handleMobileInicioRota;
window.selecionarRotaFimMobile = selecionarRotaFimMobile;
window.calcularKmPercorridoMobile = calcularKmPercorridoMobile;
window.handleMobileFimRota = handleMobileFimRota;
window.abrirFinalizacaoDiretaMobile = abrirFinalizacaoDiretaMobile;