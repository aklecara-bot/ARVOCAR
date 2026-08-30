// =========================================================================
// MÓDULO: OPERAÇÃO MOBILE & ROTAS - ARVOCAR 2026
// =========================================================================

window.SUPABASE_URL = window.SUPABASE_URL || "https://kadowettowccespuieyl.supabase.co";
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";
window.ADMIN_EMAIL = window.ADMIN_EMAIL || "admin@arvo.tec.br";

// Inicializa a instância apenas se ainda não existir no escopo global
if (!window.db && typeof supabase !== 'undefined') {
  window.db = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
}

var db = window.db;
var ADMIN_EMAIL = window.ADMIN_EMAIL;

var usuarioLogado = null;
var veiculos = [];
var rotas = [];

// =========================================================================
// SESSÃO E LOGIN
// =========================================================================
function obterSessaoAtiva() {
  const sessao = localStorage.getItem('arvo_mobile_user') || localStorage.getItem('arvo_usuario_logado');
  try {
    return sessao ? JSON.parse(sessao) : null;
  } catch (e) {
    return null;
  }
}

function salvarSessaoUnificada(usuario) {
  const dados = JSON.stringify(usuario);
  localStorage.setItem('arvo_mobile_user', dados);
  localStorage.setItem('arvo_usuario_logado', dados);
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
  e.preventDefault();
  const btn = document.getElementById('btn-m-login');
  const erroBox = document.getElementById('erro-login-box');
  const erroMsg = document.getElementById('erro-login-msg');

  const emailInput = document.getElementById('m-email');
  const senhaInput = document.getElementById('m-senha');

  if (!emailInput || !senhaInput) return;

  const email = emailInput.value.trim().toLowerCase();
  const senha = senhaInput.value.trim();

  if (erroBox) erroBox.classList.add('hidden');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Autenticando...`;
  }

  try {
    const { data, error } = await db
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw new Error("Erro de conexão com o banco de dados.");
    if (!data) throw new Error("Usuário não cadastrado.");
    if (String(data.senha).trim() !== senha) throw new Error("Senha incorreta.");
    if (data.status && data.status.toLowerCase() === 'inativo') {
      throw new Error("Usuário inativo no sistema.");
    }

    usuarioLogado = {
      id: data.id,
      nome: data.nome || email.split('@')[0],
      email: data.email,
      cnh: data.cnh || ''
    };

    salvarSessaoUnificada(usuarioLogado);
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
    } else {
      window.location.href = "../frontend/login.html";
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
}

function switchMobileTab(tab) {
  const abas = ['iniciar', 'finalizar', 'historico'];

  abas.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`nav-btn-${t}`);
    if (el) el.classList.add('hidden');
    if (btn) btn.className = "flex flex-col items-center gap-1 text-slate-400 font-semibold transition";
  });

  const activeView = document.getElementById(`tab-${tab}`);
  const activeBtn = document.getElementById(`nav-btn-${tab}`);
  if (activeView) activeView.classList.remove('hidden');
  if (activeBtn) activeBtn.className = "flex flex-col items-center gap-1 text-brand-700 font-bold transition";
}

// =========================================================================
// CARREGAMENTO DE DADOS
// =========================================================================
async function carregarDadosMobile() {
  try {
    const { data: dadosV, error: errV } = await db.from('veiculos').select('*').order('id');
    if (errV) throw errV;
    veiculos = dadosV || [];

    const { data: dadosR, error: errR } = await db.from('rotas').select('*').order('data_saida', { ascending: false });
    if (errR) throw errR;
    rotas = dadosR || [];

    renderizarOpcoesVeiculos();
    renderizarOpcoesRotasAtivas();
    renderizarHistoricoMobile();
    verificarRotasExcedidas12h();
  } catch (err) {
    console.error("Erro ao sincronizar dados:", err);
  }
}

// =========================================================================
// OPERAÇÃO DE ROTAS (INÍCIO / FIM)
// =========================================================================
function renderizarOpcoesVeiculos() {
  const select = document.getElementById('m-inicio-veiculo');
  if (!select) return;
  select.innerHTML = '<option value="">Selecione o veículo...</option>';
  veiculos.filter(v => v.status === 'Disponivel').forEach(v => {
    select.innerHTML += `<option value="${v.id}">${v.id} - ${v.marca || ''} [${v.placa || 'S/ Placa'}] (${Number(v.km_atual || 0).toLocaleString('pt-BR')} km)</option>`;
  });
}

function atualizarKmVeiculoMobile() {
  const vId = document.getElementById('m-inicio-veiculo')?.value;
  const v = veiculos.find(item => item.id === vId);
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
    if (show) txt.classList.remove('hidden');
    else {
      txt.classList.add('hidden');
      txt.value = '';
    }
  }
}

async function handleMobileInicioRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-confirmar-inicio');
  const veiculoId = document.getElementById('m-inicio-veiculo')?.value;
  const veiculo = veiculos.find(v => v.id === veiculoId);

  if (!veiculo || !usuarioLogado) {
    alert("Selecione um veículo disponível.");
    return;
  }

  // Validação segura de Reservas ativas
  const agoraTimestamp = new Date().getTime();
  const emailAtual = (usuarioLogado.email || '').toLowerCase().trim();

  try {
    const { data: reservasCarro } = await db
      .from('reservas')
      .select('*')
      .eq('veiculo_id', veiculoId)
      .eq('status', 'CONFIRMADA');

    if (reservasCarro && reservasCarro.length > 0) {
      const reservaAtiva = reservasCarro.find(r => {
        const ini = new Date(r.data_inicio).getTime();
        const fim = new Date(r.data_fim).getTime();
        return agoraTimestamp >= ini && agoraTimestamp <= fim;
      });

      if (reservaAtiva) {
        const emailDono = (reservaAtiva.responsavel || '').toLowerCase().trim();
        const ehDono = emailDono === emailAtual;
        const ehAdmin = emailAtual === ADMIN_EMAIL.toLowerCase();

        if (!ehDono && !ehAdmin) {
          const dataFimFmt = new Date(reservaAtiva.data_fim).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
          });

          alert(
            `⛔ CARRO RESERVADO!\n\n` +
            `Este veículo está em uso/reserva por:\n` +
            `👤 ${reservaAtiva.responsavel}\n` +
            `📅 Até: ${dataFimFmt}`
          );
          return;
        }
      }
    }
  } catch (errCheck) {
    console.error("Erro ao checar reservas:", errCheck);
  }

  const selOrigem = document.getElementById('m-inicio-origem')?.value;
  const txtOrigem = document.getElementById('m-inicio-origem-outro')?.value.trim().toUpperCase() || '';
  const origemFinal = selOrigem === 'OUTRO' ? txtOrigem : selOrigem;

  if (!origemFinal) {
    alert("Informe o local de saída.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;
  }

  const novaRota = {
    id: `ROTA-2026-${String(rotas.length + 261).padStart(4, '0')}`,
    veiculo_id: veiculoId,
    responsavel: usuarioLogado.email,
    origem: origemFinal,
    destino: null,
    finalidade: document.getElementById('m-inicio-finalidade')?.value,
    data_saida: new Date().toISOString(),
    data_retorno: null,
    km_saida: Number(veiculo.km_atual || 0),
    km_retorno: null,
    km_total: 0,
    consumo_litros: null,
    anomalia: '',
    status: 'Em Uso'
  };

  try {
    const { error: errR } = await db.from('rotas').insert([novaRota]);
    if (errR) throw errR;

    const { error: errV } = await db.from('veiculos').update({ status: 'Em Uso' }).eq('id', veiculoId);
    if (errV) throw errV;

    alert(`Rota iniciada com sucesso no veículo ${veiculoId}!`);
    e.target.reset();
    toggleOutroOrigemMobile('');
    await carregarDadosMobile();
    switchMobileTab('historico');
  } catch (err) {
    alert("Erro ao iniciar rota: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check-circle text-base"></i> Confirmar Saída`;
    }
  }
}

function renderizarOpcoesRotasAtivas() {
  const select = document.getElementById('m-fim-rota-select');
  if (!select) return;
  select.innerHTML = '<option value="">Selecione sua rota ativa...</option>';
  rotas.filter(r => r.status === 'Em Uso' && r.responsavel === usuarioLogado.email).forEach(r => {
    select.innerHTML += `<option value="${r.id}">${r.id} (${r.veiculo_id}) - KM Saída: ${r.km_saida}</option>`;
  });
}

function selecionarRotaFimMobile() {
  const rotaId = document.getElementById('m-fim-rota-select')?.value;
  const rota = rotas.find(r => r.id === rotaId);
  const card = document.getElementById('m-detalhes-viagem');
  const inputKm = document.getElementById('m-fim-km');

  if (rota) {
    document.getElementById('m-info-veiculo').innerText = rota.veiculo_id;
    document.getElementById('m-info-kmsaida').innerText = `${Number(rota.km_saida).toLocaleString('pt-BR')} km`;
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
  const rota = rotas.find(r => r.id === rotaId);
  const kmFinal = parseFloat(document.getElementById('m-fim-km')?.value);
  const feedback = document.getElementById('m-km-feedback');

  if (!rota || isNaN(kmFinal) || !feedback) return;

  if (kmFinal < rota.km_saida) {
    feedback.innerText = `Aviso: KM final não pode ser menor que a saída (${rota.km_saida} km)!`;
    feedback.className = "text-[11px] text-rose-600 font-bold";
  } else {
    const delta = kmFinal - rota.km_saida;
    feedback.innerText = `Distância percorrida: ${delta} km`;
    feedback.className = "text-[11px] text-brand-700 font-bold";
  }
}

async function handleMobileFimRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-confirmar-fim');
  const rotaId = document.getElementById('m-fim-rota-select')?.value;
  const kmFinal = parseFloat(document.getElementById('m-fim-km')?.value);

  const selDest = document.getElementById('m-fim-destino')?.value;
  const txtDest = document.getElementById('m-fim-destino-outro')?.value.trim().toUpperCase() || '';
  const destinoFinal = selDest === 'OUTRO' ? txtDest : selDest;

  const rota = rotas.find(r => r.id === rotaId);
  const veiculo = veiculos.find(v => v.id === rota?.veiculo_id);

  if (!rota || !veiculo) {
    alert("Selecione uma rota ativa válida.");
    return;
  }

  if (kmFinal < rota.km_saida) {
    alert("O KM final não pode ser menor que o KM de saída.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;
  }

  const situacao = document.querySelector('input[name="m_situacao_carro"]:checked')?.value;
  const anomaliaTexto = situacao === 'COM' ? document.getElementById('m-fim-anomalia')?.value.trim() : '';

  const deltaKm = kmFinal - rota.km_saida;
  const medConsumo = (Number(veiculo.consumo_min || 10) + Number(veiculo.consumo_max || 12)) / 2;
  const litrosEst = Number((deltaKm / medConsumo).toFixed(2));

  try {
    // 1. Conclui a rota
    const { error: errR } = await db.from('rotas').update({
      km_retorno: kmFinal,
      km_total: deltaKm,
      consumo_litros: litrosEst,
      destino: destinoFinal,
      status: 'Concluida',
      anomalia: anomaliaTexto,
      data_retorno: new Date().toISOString()
    }).eq('id', rotaId);
    if (errR) throw errR;

    // 2. Libera o veículo
    const { error: errV } = await db.from('veiculos').update({
      km_atual: kmFinal,
      status: 'Disponivel',
      anomalias: anomaliaTexto || veiculo.anomalias
    }).eq('id', veiculo.id);
    if (errV) throw errV;

    // 3. Encerra a reserva vinculada
    await db.from('reservas').update({
      status: 'CONCLUIDA'
    })
    .eq('veiculo_id', veiculo.id)
    .eq('responsavel', rota.responsavel)
    .eq('status', 'CONFIRMADA');

    alert(`Rota ${rotaId} finalizada! Distância: ${deltaKm} km.`);
    e.target.reset();
    toggleOutroDestinoMobile('');
    toggleAnomaliaMobile(false);
    document.getElementById('m-detalhes-viagem')?.classList.add('hidden');
    await carregarDadosMobile();
    switchMobileTab('historico');
  } catch (err) {
    alert("Erro ao finalizar rota: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-base"></i> Finalizar Rota`;
    }
  }
}

function renderizarHistoricoMobile() {
  const container = document.getElementById('m-lista-historico');
  const badge = document.getElementById('m-total-rotas-badge');
  if (!container || !usuarioLogado) return;

  const minhasRotas = rotas.filter(r => r.responsavel === usuarioLogado.email);
  if (badge) badge.innerText = `${minhasRotas.length} rotas`;
  container.innerHTML = '';

  if (minhasRotas.length === 0) {
    container.innerHTML = `<div class="p-4 bg-white rounded-2xl text-center text-xs text-slate-400">Nenhuma rota registrada até o momento.</div>`;
    return;
  }

  minhasRotas.forEach(r => {
    const isEmUso = r.status === 'Em Uso';
    const card = document.createElement('div');
    card.className = "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-extrabold text-sm text-slate-900">${r.veiculo_id}</span>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isEmUso ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
          ${r.status}
        </span>
      </div>
      <div class="text-xs text-slate-600 font-medium">
        ${r.origem} &rarr; ${r.destino || 'Em trânsito'}
      </div>
      <div class="flex justify-between items-center text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100">
        <span>Distância: <b class="text-brand-700 font-bold">${r.km_total > 0 ? `${r.km_total} km` : '-'}</b></span>
        <span>Saída: ${r.data_saida ? new Date(r.data_saida).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : '-'}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// =========================================================================
// ALERTAS OPERACIONAIS (> 12 HORAS)
// =========================================================================
function solicitarPermissaoNotificacao() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function dispararNotificacaoNativa(titulo, mensagem) {
  if ("Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker?.ready.then((registration) => {
      registration.showNotification(titulo, {
        body: mensagem,
        icon: "https://cdn-icons-png.flaticon.com/512/3202/3202926.png",
        vibrate: [200, 100, 200],
        tag: "alerta-rota-12h"
      });
    }) || new Notification(titulo, { body: mensagem });
  }
}

function abrirFinalizacaoDiretaMobile(rotaId) {
  switchMobileTab('finalizar');
  const select = document.getElementById('m-fim-rota-select');
  if (select) {
    select.value = rotaId;
    selecionarRotaFimMobile();
  }
}

function exibirPopUpAlerta(rota, horasAbertas) {
  const modalId = `modal-alerta-${rota.id}`;
  if (document.getElementById(modalId)) return;

  const popUp = document.createElement('div');
  popUp.id = modalId;
  popUp.className = "fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in";
  popUp.innerHTML = `
    <div class="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 text-center space-y-4">
      <div class="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
        <i class="ph-bold ph-warning-circle"></i>
      </div>
      <div>
        <h3 class="text-base font-black text-slate-900">Atenção: Rota Aberta!</h3>
        <p class="text-xs text-slate-500 mt-1">
          A rota <b class="text-slate-800">${rota.id}</b> com o veículo <b class="text-slate-800">${rota.veiculo_id}</b> está aberta há mais de <span class="text-rose-600 font-bold">${horasAbertas.toFixed(1)} horas</span>.
        </p>
      </div>
      <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium">
        Por favor, finalize o check-in inserindo o KM final do painel.
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="document.getElementById('${modalId}').remove()" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">
          Lembrar Depois
        </button>
        <button onclick="document.getElementById('${modalId}').remove(); abrirFinalizacaoDiretaMobile('${rota.id}');" class="flex-1 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs shadow-md transition">
          Finalizar Agora
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(popUp);
}

async function verificarRotasExcedidas12h() {
  if (!usuarioLogado) return;
  const agora = new Date();

  const { data: rotasAtivas } = await db
    .from('rotas')
    .select('*')
    .eq('status', 'Em Uso');

  if (!rotasAtivas) return;

  rotasAtivas.forEach(rota => {
    if (!rota.data_saida) return;
    const dataSaida = new Date(rota.data_saida);
    const diferencaHoras = (agora - dataSaida) / (1000 * 60 * 60);

    if (diferencaHoras >= 12) {
      if (rota.responsavel === usuarioLogado.email || usuarioLogado.email === ADMIN_EMAIL) {
        exibirPopUpAlerta(rota, diferencaHoras);
        dispararNotificacaoNativa(
          "⚠️ ARVO - Fechamento de Rota Pendente",
          `A rota ${rota.id} (${rota.veiculo_id}) está aberta há ${diferencaHoras.toFixed(0)}h. Realize a devolução.`
        );
      }
    }
  });
}

// =========================================================================
// INICIALIZAÇÃO
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  solicitarPermissaoNotificacao();
  setInterval(verificarRotasExcedidas12h, 10 * 60 * 1000);

  const sessao = obterSessaoAtiva();
  if (sessao) {
    usuarioLogado = sessao;
    iniciarAppMobile();
  }
});