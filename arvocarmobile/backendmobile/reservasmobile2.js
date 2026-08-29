// =========================================================================
// MÓDULO: RESERVAS MOBILE - SINCRONIZADO E BLINDADO
// =========================================================================

const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";
const ADMIN_EMAIL = "admin@arvo.tec.br";

let db = null;
let usuarioLogado = null;
let veiculos = [];
let reservas = [];

// =========================================================================
// 1. INICIALIZAÇÃO SEGURA DO CLIENTE
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
  const sessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  if (!sessao) {
    window.location.href = "login.html";
    return;
  }
  usuarioLogado = JSON.parse(sessao);

  const userLabel = document.getElementById('m-user-label');
  if (userLabel) {
    userLabel.innerText = `${usuarioLogado.nome || usuarioLogado.email.split('@')[0]} (${usuarioLogado.email})`;
  }

  // Define as datas padrão
  const hojeStr = new Date().toISOString().split('T')[0];
  const dtIni = document.getElementById('res-data-inicio');
  const dtFim = document.getElementById('res-data-fim');
  if (dtIni) dtIni.value = hojeStr;
  if (dtFim) dtFim.value = hojeStr;

  await carregarVeiculosMobile();
  await carregarReservasMobile();
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
      window.location.href = "login.html";
    }
  }
}

// =========================================================================
// 2. CARREGAMENTO DOS VEÍCULOS NO SELECT
// =========================================================================
async function carregarVeiculosMobile() {
  const sel = document.getElementById('res-veiculo');
  if (!sel) return;

  sel.innerHTML = '<option value="">Carregando veículos...</option>';

  try {
    const { data, error } = await db.from('veiculos').select('*');
    if (error) throw error;
    
    veiculos = data || [];

    if (veiculos.length === 0) {
      sel.innerHTML = '<option value="">Nenhum veículo cadastrado</option>';
      return;
    }

    sel.innerHTML = '<option value="">Selecione o veículo...</option>';
    veiculos.forEach(v => {
      const vId = v.id || v.identificador;
      const vDesc = v.marca ? `${v.marca} [${v.placa || 'S/ Placa'}]` : (v.placa || `Veículo ${vId}`);
      sel.innerHTML += `<option value="${vId}">${vId} - ${vDesc}</option>`;
    });
  } catch (err) {
    console.error("Erro ao carregar veículos no mobile:", err);
    sel.innerHTML = '<option value="">Erro ao buscar veículos</option>';
  }
}

// =========================================================================
// 3. CARREGAMENTO E EXIBIÇÃO DAS RESERVAS ATIVAS
// =========================================================================
async function carregarReservasMobile() {
  const container = document.getElementById('lista-reservas-mobile');
  const badge = document.getElementById('badge-total-reservas');

  if (container) {
    container.innerHTML = `<div class="p-4 bg-white rounded-2xl text-center text-xs text-slate-400"><i class="ph-bold ph-spinner animate-spin text-base"></i> Carregando reservas...</div>`;
  }

  try {
    const { data, error } = await db
      .from('reservas')
      .select('*')
      .eq('status', 'CONFIRMADA')
      .order('data_inicio', { ascending: true });

    if (error) throw error;

    reservas = data || [];
    if (badge) badge.innerText = `${reservas.length} reservas`;

    renderizarCardsReservasMobile();
  } catch (err) {
    console.error("Erro ao carregar reservas:", err);
    if (container) {
      container.innerHTML = `<div class="p-4 bg-white rounded-2xl text-center text-xs text-rose-500">Erro ao carregar reservas.</div>`;
    }
  }
}

function renderizarCardsReservasMobile() {
  const container = document.getElementById('lista-reservas-mobile');
  if (!container) return;

  if (reservas.length === 0) {
    container.innerHTML = `<div class="p-4 bg-white rounded-2xl text-center text-xs text-slate-400">Nenhum agendamento ativo no momento.</div>`;
    return;
  }

  const ehAdmin = (usuarioLogado.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();

  container.innerHTML = '';
  reservas.forEach(r => {
    const ehDono = (usuarioLogado.email || '').toLowerCase() === (r.responsavel || '').toLowerCase();
    const dataIni = new Date(r.data_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const dataFim = new Date(r.data_fim).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    const card = document.createElement('div');
    card.className = "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-extrabold text-sm text-slate-900">${r.veiculo_id}</span>
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

      <div class="text-[11px] font-mono text-slate-500 pt-1.5 border-t border-slate-100 flex items-center justify-between">
        <span>📅 ${dataIni} até ${dataFim}</span>
      </div>

      ${(ehAdmin || ehDono) ? `
        <div class="pt-2 border-t border-slate-100 flex justify-end">
          <button onclick="cancelarReservaMobile(${r.id}, '${r.responsavel}')" class="text-rose-600 text-xs font-bold flex items-center gap-1 hover:underline">
            <i class="ph-bold ph-x-circle text-sm"></i> Cancelar Agendamento
          </button>
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

// =========================================================================
// 4. MODALIDADES (HORAS, TURNO, DIAS)
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
// 5. SALVAR E CANCELAR AGENDAMENTO
// =========================================================================
async function handleSalvarReserva(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-salvar-reserva');
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
    alert("A data e hora final deve ser posterior ao início.");
    return;
  }

  const conflito = reservas.some(r => {
    if (r.veiculo_id !== veiculoId) return false;
    const rIni = new Date(r.data_inicio).getTime();
    const rFim = new Date(r.data_fim).getTime();
    return (dInicio.getTime() < rFim && dFim.getTime() > rIni);
  });

  if (conflito) {
    alert(`❌ O veículo ${veiculoId} já possui agendamento confirmado neste período.`);
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;
  }

  const novaReserva = {
    veiculo_id: veiculoId,
    responsavel: usuarioLogado.email,
    tipo_reserva: tipo,
    data_inicio: dInicio.toISOString(),
    data_fim: dFim.toISOString(),
    finalidade: document.getElementById('res-finalidade').value,
    observacao: document.getElementById('res-obs')?.value.trim() || '',
    status: 'CONFIRMADA'
  };

  try {
    const { error } = await db.from('reservas').insert([novaReserva]);
    if (error) throw error;

    alert(`✅ Veículo ${veiculoId} reservado com sucesso!`);
    e.target.reset();
    ajustarCamposModalidade('DIAS');

    const hojeStr = new Date().toISOString().split('T')[0];
    document.getElementById('res-data-inicio').value = hojeStr;
    document.getElementById('res-data-fim').value = hojeStr;

    await carregarReservasMobile();
  } catch (err) {
    alert("Erro ao salvar reserva: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check"></i> Confirmar Agendamento`;
    }
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

      alert("Reserva cancelada com sucesso!");
      await carregarReservasMobile();
    } catch (err) {
      alert("Erro ao cancelar reserva: " + err.message);
    }
  }
}

// =========================================================================
// 6. INICIALIZAÇÃO
// =========================================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', aguardarSupabaseEIniciar);
} else {
  aguardarSupabaseEIniciar();
}