// =========================================================================
// MÓDULO: RESERVAS & AGENDAMENTOS MOBILE - ARVO (CORRIGIDO)
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";
const ADMIN_EMAIL = "admin@arvo.tec.br";

let db = null;
let usuarioLogado = null;
let veiculosReserva = [];
let listaReservas = [];
let calendar = null;

const coresCarros = {
  'ARVO 10': '#0284c7',
  'ARVO 11': '#16a34a',
  'ARVO 12': '#f59e0b',
  'ARVO 15': '#8b5cf6',
  'ARVO 16': '#ec4899',
  'DEFAULT': '#15803d'
};

// =========================================================================
// INICIALIZAÇÃO SEGURA (ESPERA O SUPABASE CARREGAR DA CDN)
// =========================================================================
function aguardarSupabaseEIniciar() {
  if (typeof supabase !== 'undefined') {
    db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    initReservasMobile();
  } else {
    setTimeout(aguardarSupabaseEIniciar, 100);
  }
}

async function initReservasMobile() {
  const sessaoStr = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  if (!sessaoStr) {
    window.location.href = 'login.html';
    return;
  }
  usuarioLogado = JSON.parse(sessaoStr);

  const userDisplay = document.getElementById('user-display') || document.getElementById('m-top-username');
  if (userDisplay) {
    userDisplay.innerText = `${usuarioLogado.nome || usuarioLogado.email}`;
  }

  // Preenche a data padrão de hoje nos inputs
  const hojeStr = new Date().toISOString().split('T')[0];
  const inputDtIni = document.getElementById('res-data-inicio');
  const inputDtFim = document.getElementById('res-data-fim');
  if (inputDtIni) inputDtIni.value = hojeStr;
  if (inputDtFim) inputDtFim.value = hojeStr;

  await carregarVeiculosReservas();
  await carregarHistoricoReservas();
  initCalendario();
}

// =========================================================================
// CONTROLE DE ABAS SUPERIORES
// =========================================================================
function trocarAba(aba) {
  const viewNovo = document.getElementById('view-novo');
  const viewCal = document.getElementById('view-calendario');
  const btnNovo = document.getElementById('tab-btn-novo');
  const btnCal = document.getElementById('tab-btn-calendario');

  if (aba === 'novo') {
    if (viewNovo) viewNovo.classList.remove('hidden');
    if (viewCal) viewCal.classList.add('hidden');
    if (btnNovo) btnNovo.className = "flex-1 py-2.5 text-center font-bold text-amber-400 border-b-2 border-amber-400 flex items-center justify-center gap-1.5 transition";
    if (btnCal) btnCal.className = "flex-1 py-2.5 text-center font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
  } else {
    if (viewNovo) viewNovo.classList.add('hidden');
    if (viewCal) viewCal.classList.remove('hidden');
    if (btnCal) btnCal.className = "flex-1 py-2.5 text-center font-bold text-amber-400 border-b-2 border-amber-400 flex items-center justify-center gap-1.5 transition";
    if (btnNovo) btnNovo.className = "flex-1 py-2.5 text-center font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
    
    if (calendar) {
      setTimeout(() => { calendar.render(); }, 80);
    }
  }
}

// =========================================================================
// CARREGAMENTO DE VEÍCULOS NO SELECT (ID: res-veiculo)
// =========================================================================
async function carregarVeiculosReservas() {
  const sel = document.getElementById('res-veiculo') || document.getElementById('m-res-veiculo');
  if (!sel) return;

  sel.innerHTML = '<option value="">Carregando veículos...</option>';

  try {
    const { data, error } = await db
      .from('veiculos')
      .select('*')
      .neq('status', 'Fora de Uso')
      .order('nome_frota');

    if (error) throw error;
    veiculosReserva = data || [];

    if (veiculosReserva.length === 0) {
      sel.innerHTML = '<option value="">Nenhum carro cadastrado</option>';
      return;
    }

    sel.innerHTML = '<option value="">Selecione o veículo...</option>';
    veiculosReserva.forEach(v => {
      const nome = v.nome_frota || v.id;
      sel.innerHTML += `<option value="${v.placa}" data-uuid="${v.nome_frota || ''}" data-placa="${v.placa}">${v.placa} - ${v.nome_frota}</option>`;;
    });

  } catch (err) {
    console.error("Falha ao carregar lista de veículos:", err);
    sel.innerHTML = '<option value="">Erro ao carregar veículos</option>';
  }
}

// =========================================================================
// CONTROLE DE MODALIDADES (HORAS, TURNO, DIAS)
// =========================================================================
function ajustarCamposModalidade(tipo) {
  const boxHoras = document.getElementById('box-horas');
  const boxTurno = document.getElementById('box-turno');
  const boxDataFim = document.getElementById('box-data-fim');

  if (boxHoras) boxHoras.classList.add('hidden');
  if (boxTurno) boxTurno.classList.add('hidden');
  if (boxDataFim) boxDataFim.classList.remove('hidden');

  if (tipo === 'HORAS' && boxHoras) {
    boxHoras.classList.remove('hidden');
    if (boxDataFim) boxDataFim.classList.add('hidden');
  } else if (tipo === 'TURNO' && boxTurno) {
    boxTurno.classList.remove('hidden');
    if (boxDataFim) boxDataFim.classList.add('hidden');
  }
}

// =========================================================================
// CALENDÁRIO FULLCALENDAR
// =========================================================================
function initCalendario() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl || typeof FullCalendar === 'undefined') return;

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'pt-br',
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listMonth'
    },
    buttonText: {
      today: 'Hoje',
      month: 'Mês',
      list: 'Lista'
    },
    events: function(fetchInfo, successCallback, failureCallback) {
      const eventos = listaReservas.map(r => ({
        id: r.id.toString(),
        title: `${r.veiculo_id} - ${(r.responsavel || '').split('@')[0]}`,
        start: r.data_inicio,
        end: r.data_fim,
        backgroundColor: coresCarros[r.veiculo_id] || coresCarros.DEFAULT,
        borderColor: coresCarros[r.veiculo_id] || coresCarros.DEFAULT,
        extendedProps: {
          responsavel: r.responsavel,
          finalidade: r.finalidade,
          veiculo: r.veiculo_id
        }
      }));
      successCallback(eventos);
    },
    eventClick: function(info) {
      const p = info.event.extendedProps;
      alert(`🚗 Reserva: ${p.veiculo}\n👤 Condutor: ${p.responsavel}\n🎯 Finalidade: ${p.finalidade}\n📅 Início: ${new Date(info.event.start).toLocaleString('pt-BR')}\n📅 Fim: ${new Date(info.event.end).toLocaleString('pt-BR')}`);
    }
  });

  calendar.render();
}

// =========================================================================
// SALVAMENTO DE AGENDAMENTO
// =========================================================================
async function salvarReservaMobile(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit');
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;
  }

  try {
    const veiculoId = document.getElementById('res-veiculo')?.value;
    const tipo = document.getElementById('res-tipo')?.value || 'DIAS';
    const dtInicioStr = document.getElementById('res-data-inicio')?.value;
    let dtFimStr = document.getElementById('res-data-fim')?.value || dtInicioStr;

    if (!veiculoId || !dtInicioStr) {
      alert("Por favor, selecione um veículo e informe as datas.");
      return;
    }

    let dInicio, dFim;
    if (tipo === 'HORAS') {
      const hIni = document.getElementById('res-hora-inicio').value;
      const hFim = document.getElementById('res-hora-fim').value;
      dInicio = new Date(`${dtInicioStr}T${hIni}:00`);
      dFim = new Date(`${dtInicioStr}T${hFim}:00`);
    } else if (tipo === 'TURNO') {
      const turno = document.getElementById('res-turno-sel').value;
      if (turno === 'MANHA') {
        dInicio = new Date(`${dtInicioStr}T07:00:00`);
        dFim = new Date(`${dtInicioStr}T12:00:00`);
      } else if (turno === 'TARDE') {
        dInicio = new Date(`${dtInicioStr}T13:00:00`);
        dFim = new Date(`${dtInicioStr}T18:00:00`);
      } else {
        dInicio = new Date(`${dtInicioStr}T18:00:00`);
        const dSeguinte = new Date(dtInicioStr);
        dSeguinte.setDate(dSeguinte.getDate() + 1);
        dFim = new Date(`${dSeguinte.toISOString().split('T')[0]}T06:00:00`);
      }
    } else {
      dInicio = new Date(`${dtInicioStr}T00:00:00`);
      dFim = new Date(`${dtFimStr}T23:59:59`);
    }

    if (dFim <= dInicio) {
      alert("A data/hora de término deve ser posterior ao início da reserva.");
      return;
    }

    // Verificação de conflito no banco
    const conflito = listaReservas.some(r => {
      if (r.veiculo_id !== veiculoId) return false;
      const rIni = new Date(r.data_inicio).getTime();
      const rFim = new Date(r.data_fim).getTime();
      return (dInicio.getTime() < rFim && dFim.getTime() > rIni);
    });

    if (conflito) {
      alert(`❌ Conflito: O veículo ${veiculoId} já possui agendamento confirmado neste período!`);
      return;
    }

    const payload = {
      veiculo_id: veiculoId,
      responsavel: usuarioLogado.email,
      tipo_reserva: tipo,
      data_inicio: dInicio.toISOString(),
      data_fim: dFim.toISOString(),
      finalidade: document.getElementById('res-finalidade').value,
      observacao: document.getElementById('res-obs')?.value.trim() || '',
      status: 'CONFIRMADA'
    };

    const { error: insertErr } = await db.from('reservas').insert([payload]);
    if (insertErr) throw insertErr;

    alert(`✅ Veículo ${veiculoId} agendado com sucesso!`);
    
    const form = document.getElementById('form-reserva');
    if (form) form.reset();
    ajustarCamposModalidade('DIAS');

    const hojeStr = new Date().toISOString().split('T')[0];
    document.getElementById('res-data-inicio').value = hojeStr;
    document.getElementById('res-data-fim').value = hojeStr;

    await carregarHistoricoReservas();
    trocarAba('calendario');

  } catch (err) {
    console.error("Erro ao salvar agendamento:", err);
    alert('Erro ao gravar reserva: ' + (err.message || 'Verifique sua conexão.'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check"></i><span>Confirmar Agendamento</span>`;
    }
  }
}

// =========================================================================
// CARREGAR HISTÓRICO DE AGENDAMENTOS
// =========================================================================
async function carregarHistoricoReservas() {
  const container = document.getElementById('lista-reservas');
  const badge = document.getElementById('badge-total-reservas');
  if (!container) return;

  container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs"><i class="ph-bold ph-spinner animate-spin text-lg"></i><br>Carregando agendamentos...</div>`;

  try {
    const { data, error } = await db
      .from('reservas')
      .select('*')
      .eq('status', 'CONFIRMADA')
      .order('data_inicio', { ascending: true });

    if (error) throw error;
    listaReservas = data || [];

    if (badge) badge.innerText = `${listaReservas.length} reservas`;

    if (listaReservas.length === 0) {
      container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">Nenhum agendamento ativo no momento.</div>`;
      if (calendar) calendar.refetchEvents();
      return;
    }

    const ehAdmin = (usuarioLogado.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
    container.innerHTML = '';

    listaReservas.forEach(r => {
      const ehDono = (usuarioLogado.email || '').toLowerCase() === (r.responsavel || '').toLowerCase();
      const dataIni = new Date(r.data_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const dataFim = new Date(r.data_fim).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

      const card = document.createElement('div');
      card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2";
      card.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <i class="ph-bold ph-car text-brand-600"></i> ${r.veiculo_id}
          </span>
          <span class="text-[10px] bg-brand-50 text-brand-700 font-bold px-2 py-0.5 rounded-full border border-brand-200">
            ${r.tipo_reserva || 'DIAS'}
          </span>
        </div>

        <div class="text-xs text-slate-600">
          Condutor: <b class="text-slate-800">${r.responsavel}</b>
        </div>

        <div class="text-[11px] text-slate-500">
          Finalidade: <span class="font-semibold text-slate-700">${r.finalidade}</span>
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1.5 border-t border-slate-100">
          <span>📅 ${dataIni} até ${dataFim}</span>
        </div>

        ${(ehAdmin || ehDono) ? `
          <div class="pt-1.5 border-t border-slate-100 flex justify-end">
            <button onclick="cancelarReservaMobile(${r.id}, '${r.responsavel}')" class="text-rose-600 text-xs font-bold flex items-center gap-1 hover:underline">
              <i class="ph-bold ph-x-circle text-sm"></i> Cancelar Agendamento
            </button>
          </div>
        ` : ''}
      `;
      container.appendChild(card);
    });

    if (calendar) {
      calendar.refetchEvents();
    }

  } catch (err) {
    console.error("Erro ao carregar reservas:", err);
    container.innerHTML = `<div class="text-center py-6 text-rose-500 text-xs">Erro ao carregar agendamentos.</div>`;
  }
}

async function cancelarReservaMobile(reservaId, responsavel) {
  const ehAdmin = (usuarioLogado.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const ehDono = (usuarioLogado.email || '').toLowerCase() === (responsavel || '').toLowerCase();

  if (!ehAdmin && !ehDono) {
    alert("Você só pode cancelar reservas feitas pelo seu próprio usuário.");
    return;
  }

  if (confirm("Tem certeza de que deseja liberar este agendamento?")) {
    try {
      const { error } = await db.from('reservas').update({ status: 'CANCELADA' }).eq('id', reservaId);
      if (error) throw error;

      alert("Agendamento cancelado com sucesso!");
      await carregarHistoricoReservas();
    } catch (err) {
      alert("Erro ao cancelar reserva: " + err.message);
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
      window.location.href = "../frontendmobile/mobile.html";
    }
  }
}

// Inicia com segurança aguardando a biblioteca externa
document.addEventListener('DOMContentLoaded', aguardarSupabaseEIniciar);