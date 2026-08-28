// =========================================================================
// MÓDULO: RESERVAS & AGENDAMENTOS MOBILE - ARVOCAR 2026
// =========================================================================

const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";
const ADMIN_EMAIL = "admin@arvo.tec.br";

// Garante o reuso da instância Supabase
const db = window.db || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioLogado = null;
let veiculosReserva = [];
let listaReservas = [];

// =========================================================================
// INICIALIZAÇÃO E SESSÃO
// =========================================================================
async function initReservasMobile() {
  const sessaoStr = localStorage.getItem('arvo_mobile_user') || localStorage.getItem('arvo_usuario_logado');
  if (!sessaoStr) {
    window.location.href = "login.html";
    return;
  }
  usuarioLogado = JSON.parse(sessaoStr);

  // Define a data inicial padrão como hoje
  const hojeStr = new Date().toISOString().split('T')[0];
  const inputDtIni = document.getElementById('res-data-inicio') || document.getElementById('m-res-data-inicio');
  const inputDtFim = document.getElementById('res-data-fim') || document.getElementById('m-res-data-fim');
  
  if (inputDtIni) inputDtIni.value = hojeStr;
  if (inputDtFim) inputDtFim.value = hojeStr;

  await carregarVeiculosParaReserva();
  await carregarListaReservas();
}

// =========================================================================
// CARREGAMENTO DE VEÍCULOS
// =========================================================================
async function carregarVeiculosParaReserva() {
  const sel = document.getElementById('res-veiculo') || document.getElementById('m-res-veiculo');
  if (!sel) return;

  try {
    const { data, error } = await db.from('veiculos').select('*').order('id');
    if (error) throw error;
    
    veiculosReserva = data || [];
    sel.innerHTML = '<option value="">Selecione um carro...</option>';

    veiculosReserva.forEach(v => {
      sel.innerHTML += `<option value="${v.id}">${v.id} - ${v.marca} [${v.placa}]</option>`;
    });
  } catch (err) {
    console.error("Erro ao carregar veículos:", err);
    sel.innerHTML = '<option value="">Erro ao carregar veículos</option>';
  }
}

// =========================================================================
// ALTERNÂNCIA DE MODALIDADES (HORAS / TURNO / DIAS)
// =========================================================================
function ajustarModalidadeReserva(tipo) {
  const boxHoras = document.getElementById('box-horas') || document.getElementById('m-box-horas');
  const boxTurno = document.getElementById('box-turno') || document.getElementById('m-box-turno');
  const boxDataFim = document.getElementById('box-data-fim') || document.getElementById('m-box-data-fim');

  if (boxHoras) boxHoras.classList.add('hidden');
  if (boxTurno) boxTurno.classList.add('hidden');
  if (boxDataFim) boxDataFim.classList.remove('hidden');

  if (tipo === 'HORAS' && boxHoras) {
    boxHoras.classList.remove('hidden');
  } else if (tipo === 'TURNO' && boxTurno) {
    boxTurno.classList.remove('hidden');
  }
}

// =========================================================================
// CRIAÇÃO E VALIDAÇÃO DE RESERVA
// =========================================================================
async function handleSalvarReservaMobile(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-salvar-res');
  const veiculoId = document.getElementById('m-res-veiculo')?.value;[cite: 11]
  const tipo = document.getElementById('m-res-tipo')?.value || 'DIAS';[cite: 11]
  const dtInicioStr = document.getElementById('m-res-data-inicio')?.value;[cite: 11]
  const dtFimStr = document.getElementById('m-res-data-fim')?.value;[cite: 11]

  if (!veiculoId || !dtInicioStr) {
    mostrarPopup('aviso', 'Campos Obrigatórios', 'Por favor, selecione um veículo e informe as datas.');
    return;
  }

  let dInicio, dFim;
  if (tipo === 'HORAS') {
    const hIni = document.getElementById('m-res-hora-inicio').value;[cite: 11]
    const hFim = document.getElementById('m-res-hora-fim').value;[cite: 11]
    dInicio = new Date(`${dtInicioStr}T${hIni}:00`);[cite: 11]
    dFim = new Date(`${dtInicioStr}T${hFim}:00`);[cite: 11]
  } else if (tipo === 'TURNO') {
    const turno = document.getElementById('m-res-turno-sel').value;[cite: 11]
    if (turno === 'MANHA') {
      dInicio = new Date(`${dtInicioStr}T07:00:00`);[cite: 11]
      dFim = new Date(`${dtInicioStr}T12:00:00`);[cite: 11]
    } else if (turno === 'TARDE') {
      dInicio = new Date(`${dtInicioStr}T13:00:00`);[cite: 11]
      dFim = new Date(`${dtInicioStr}T18:00:00`);[cite: 11]
    } else {
      dInicio = new Date(`${dtInicioStr}T18:00:00`);[cite: 11]
      const dSeguinte = new Date(dtInicioStr);[cite: 11]
      dSeguinte.setDate(dSeguinte.getDate() + 1);[cite: 11]
      dFim = new Date(`${dSeguinte.toISOString().split('T')[0]}T06:00:00`);[cite: 11]
    }
  } else {
    dInicio = new Date(`${dtInicioStr}T00:00:00`);[cite: 11]
    dFim = new Date(`${dtFimStr}T23:59:59`);[cite: 11]
  }

  if (dFim <= dInicio) {
    mostrarPopup('erro', 'Período Inválido', 'A data e hora de término deve ser posterior ao início da reserva.');
    return;
  }

  // Verificação de conflito
  const conflito = listaReservas.some(r => {
    if (r.veiculo_id !== veiculoId) return false;
    const rIni = new Date(r.data_inicio);
    const rFim = new Date(r.data_fim);
    return (dInicio < rFim && dFim > rIni);
  });

  if (conflito) {
    mostrarPopup('erro', 'Veículo Conflitante', `O veículo <b>${veiculoId}</b> já está reservado neste período por outro condutor.`);
    return;
  }

  if (btn) {
    btn.disabled = true;[cite: 11]
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;[cite: 11]
  }

  const novaReserva = {
    veiculo_id: veiculoId,[cite: 11]
    responsavel: usuarioLogado.email,[cite: 11]
    tipo_reserva: tipo,[cite: 11]
    data_inicio: dInicio.toISOString(),[cite: 11]
    data_fim: dFim.toISOString(),[cite: 11]
    finalidade: document.getElementById('m-res-finalidade').value,[cite: 11]
    observacao: document.getElementById('m-res-obs')?.value.trim() || '',[cite: 11]
    status: 'CONFIRMADA'[cite: 11]
  };

  try {
    const { error } = await db.from('reservas').insert([novaReserva]);[cite: 11]
    if (error) throw error;[cite: 11]

    mostrarPopup('sucesso', 'Reserva Confirmada!', `O veículo <b>${veiculoId}</b> foi reservado com sucesso para a sua atividade.`);
    e.target.reset();[cite: 11]
    ajustarModalidadeReserva('DIAS');
    await carregarListaReservas();
  } catch (err) {
    mostrarPopup('erro', 'Erro ao Reservar', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;[cite: 11]
      btn.innerHTML = `<i class="ph-bold ph-check"></i> Confirmar Agendamento`;[cite: 11]
    }
  }
}

function cancelarReservaMobile(reservaId, responsavel) {
  const ehAdmin = usuarioLogado.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();[cite: 11]
  const ehDono = usuarioLogado.email.toLowerCase() === responsavel.toLowerCase();[cite: 11]

  if (!ehAdmin && !ehDono) {
    mostrarPopup('erro', 'Acesso Negado', 'Você só pode cancelar reservas feitas pelo seu próprio usuário.');
    return;
  }

  mostrarConfirmacao(
    'Cancelar Reserva',
    'Tem certeza de que deseja liberar este agendamento?',
    async () => {
      try {
        const { error } = await db.from('reservas').update({ status: 'CANCELADA' }).eq('id', reservaId);[cite: 11]
        if (error) throw error;[cite: 11]
        mostrarPopup('sucesso', 'Agendamento Cancelado', 'O veículo foi liberado na base de dados.');
        await carregarListaReservas();
      } catch (err) {
        mostrarPopup('erro', 'Falha ao Cancelar', err.message);
      }
    },
    'Sim, Cancelar'
  );
}