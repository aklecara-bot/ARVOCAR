// =========================================================================
// MÓDULO: RESERVAS & AGENDAMENTOS WEB - ARVO (CORES POR STATUS E CONDUTORES)
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";
const ADMIN_EMAIL = "admin@arvo.tec.br";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioLogado = null;
let veiculos = [];
let reservas = [];
let usuarios = [];
let rotas = [];
let calendar = null;

function obterNomeMotoristaFormatado(identificador) {
  if (!identificador) return 'Condutor';
  const idLimpo = String(identificador).toLowerCase().trim();

  if (Array.isArray(usuarios) && usuarios.length > 0) {
    const u = usuarios.find(user =>
      (user.email || '').toLowerCase().trim() === idLimpo ||
      String(user.id).trim() === idLimpo
    );
    if (u && u.nome && u.nome.trim() !== '') return u.nome.trim();
  }

  const base = idLimpo.includes('@') ? idLimpo.split('@')[0] : idLimpo;
  return base
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

async function init() {
  const sessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  if (!sessao) {
    window.location.href = "login.html";
    return;
  }
  try {
    usuarioLogado = JSON.parse(sessao);
  } catch (e) {
    usuarioLogado = { email: sessao, nome: sessao };
  }

  const hojeStr = new Date().toISOString().split('T')[0];
  const dtIniInput = document.getElementById('res-data-inicio');
  const dtFimInput = document.getElementById('res-data-fim');
  if (dtIniInput) dtIniInput.value = hojeStr;
  if (dtFimInput) dtFimInput.value = hojeStr;

  await carregarUsuarios();
  await carregarVeiculos();
  await carregarReservas();
  initCalendario();
}

async function carregarUsuarios() {
  try {
    const { data } = await db.from('usuarios').select('id, nome, email');
    if (data) usuarios = data;
  } catch (e) { }
}

async function carregarVeiculos() {
  const sel = document.getElementById('res-veiculo');
  if (!sel) return;

  sel.innerHTML = '<option value="">Carregando veículos...</option>';

  try {
    const { data, error } = await db
      .from('veiculos')
      .select('*')
      .neq('status', 'Fora de Uso')
      .order('nome_frota');

    if (error) throw error;
    veiculos = data || [];

    if (veiculos.length === 0) {
      sel.innerHTML = '<option value="">Nenhum carro cadastrado</option>';
      return;
    }

    sel.innerHTML = '<option value="">Selecione um carro...</option>';
    veiculos.forEach(v => {
      const nomeFrota = v.nome_frota || v.id;
      sel.innerHTML += `<option value="${nomeFrota}" data-placa="${v.placa || ''}">${nomeFrota} - ${v.marca || ''} [${v.placa || 'S/ Placa'}]</option>`;
    });

  } catch (err) {
    console.error("Erro ao carregar veículos:", err);
    sel.innerHTML = '<option value="">Erro ao carregar veículos</option>';
  }
}

async function carregarReservas() {
  // Carrega todas as reservas para pintar o calendário com o status real
  const { data, error } = await db
    .from('reservas')
    .select('*')
    .order('data_inicio', { ascending: false });

  reservas = data || [];

  renderizarTabelaReservas();
  if (calendar) {
    calendar.refetchEvents();
  }
}

function initCalendario() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl || typeof FullCalendar === 'undefined') return;

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'pt-br',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,listMonth'
    },
    buttonText: {
      today: 'Hoje',
      month: 'Mês',
      week: 'Semana',
      list: 'Lista'
    },
    events: function (fetchInfo, successCallback, failureCallback) {
      const agora = new Date().getTime();

      const eventos = (reservas || []).map(r => {
        const veic = (veiculos || []).find(v =>
          String(v.placa) === String(r.veiculo_id) ||
          String(v.id) === String(r.veiculo_id) ||
          String(v.uuid_veiculos) === String(r.veiculo_id) ||
          String(v.nome_frota) === String(r.veiculo_id)
        );

        const nomeFrotaExibicao = veic?.nome_frota || r.veiculo_id || 'ARVO';
        const condutorNome = obterNomeMotoristaFormatado(r.responsavel);
        const statusUpper = String(r.status || '').toUpperCase().trim();
        const dtInicio = new Date(r.data_inicio).getTime();

        // APLICAÇÃO EXATA DAS CORES SOLICITADAS
        let corFundo = '#65a30d'; // Verde-limão suave (agendadas/futuras)
        let corBorda = '#4d7c0f';
        let corTexto = '#ffffff';

        if (statusUpper === 'CONCLUIDA' || statusUpper === 'FINALIZADA') {
          corFundo = 'rgba(20, 83, 45, 0.70)'; // Verde escuro 70% transparente
          corBorda = 'rgba(22, 101, 52, 0.85)';
        } else if (statusUpper === 'CANCELADA') {
          corFundo = 'rgba(220, 38, 38, 0.70)'; // Vermelho 70% transparente
          corBorda = 'rgba(185, 28, 28, 0.85)';
        } else if (agora < dtInicio) {
          corFundo = '#65a30d'; // Verde-limão não fluorescente
          corBorda = '#4d7c0f';
        } else {
          // Em andamento
          corFundo = 'rgba(2, 132, 199, 0.75)';
          corBorda = '#0369a1';
        }

        return {
          id: r.id.toString(),
          title: `${nomeFrotaExibicao} - ${condutorNome}`,
          start: r.data_inicio,
          end: r.data_fim,
          backgroundColor: corFundo,
          borderColor: corBorda,
          textColor: corTexto,
          extendedProps: {
            responsavel: condutorNome,
            finalidade: r.finalidade,
            veiculo: nomeFrotaExibicao,
            status: r.status
          }
        };
      });

      successCallback(eventos);
    },
    eventClick: function (info) {
      const p = info.event.extendedProps;
      alert(`🚗 Veículo: ${p.veiculo}\n👤 Condutor: ${p.responsavel}\n🎯 Finalidade: ${p.finalidade}\nStatus: ${p.status || 'Agendada'}\n📅 Início: ${new Date(info.event.start).toLocaleString('pt-BR')}\n📅 Término: ${new Date(info.event.end).toLocaleString('pt-BR')}`);
    }
  });

  calendar.render();
}

function ajustarCamposModalidade(tipo) {
  const boxHoras = document.getElementById('box-horas');
  const boxTurno = document.getElementById('box-turno');
  const boxDataFim = document.getElementById('box-data-fim');

  if (boxHoras) boxHoras.classList.add('hidden');
  if (boxTurno) boxTurno.classList.add('hidden');
  if (boxDataFim) boxDataFim.classList.remove('hidden');

  if (tipo === 'HORAS' && boxHoras) {
    boxHoras.classList.remove('hidden');
  } else if (tipo === 'TURNO' && boxTurno) {
    boxTurno.classList.remove('hidden');
  }
}

async function handleSalvarReserva(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const btn = document.getElementById('btn-salvar-reserva');
  const selVeiculo = document.getElementById('res-veiculo');
  const veiculoId = selVeiculo ? selVeiculo.value : '';
  const tipo = document.getElementById('res-tipo')?.value || 'DIAS';
  const dtInicioStr = document.getElementById('res-data-inicio')?.value;
  let dtFimStr = document.getElementById('res-data-fim')?.value || dtInicioStr;

  if (!veiculoId) {
    alert("⚠️ Por favor, selecione um veículo disponível.");
    return;
  }

  if (!dtInicioStr) {
    alert("⚠️ Por favor, informe a data de início.");
    return;
  }

  const veiculoObj = (veiculos || []).find(v =>
    String(v.nome_frota) === String(veiculoId) ||
    String(v.placa) === String(veiculoId) ||
    String(v.id) === String(veiculoId) ||
    String(v.uuid_veiculos) === String(veiculoId)
  );

  const nomeFrota = veiculoObj?.nome_frota || veiculoId;
  const placaVeiculo = veiculoObj?.placa || null;
  const uuidVeiculo = veiculoObj?.uuid_veiculos || null;

  let dInicio, dFim;

  if (tipo === 'HORAS') {
    const hIni = document.getElementById('res-hora-inicio')?.value || '08:00';
    const hFim = document.getElementById('res-hora-fim')?.value || '12:00';
    dInicio = new Date(`${dtInicioStr}T${hIni}:00`);
    dFim = new Date(`${dtInicioStr}T${hFim}:00`);
  } else if (tipo === 'TURNO') {
    const turno = document.getElementById('res-turno-sel')?.value || 'MANHA';
    if (turno === 'MANHA') {
      dInicio = new Date(`${dtInicioStr}T07:00:00`);
      dFim = new Date(`${dtInicioStr}T12:00:00`);
    } else if (turno === 'TARDE') {
      dInicio = new Date(`${dtInicioStr}T13:00:00`);
      dFim = new Date(`${dtInicioStr}T18:00:00`);
    } else {
      dInicio = new Date(`${dtInicioStr}T18:00:00`);
      const dProx = new Date(`${dtInicioStr}T06:00:00`);
      dProx.setDate(dProx.getDate() + 1);
      dFim = dProx;
    }
  } else if (tipo === 'SEMANAS') {
    dInicio = new Date(`${dtInicioStr}T00:00:00`);
    const dFimSem = new Date(`${dtInicioStr}T23:59:59`);
    dFimSem.setDate(dFimSem.getDate() + 6);
    dFim = dFimSem;
  } else if (tipo === 'MES') {
    const base = new Date(`${dtInicioStr}T00:00:00`);
    const primDia = new Date(base.getFullYear(), base.getMonth(), 1);
    const ultDia = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59);
    dInicio = primDia;
    dFim = ultDia;
  } else {
    dInicio = new Date(`${dtInicioStr}T00:00:00`);
    dFim = new Date(`${dtFimStr}T23:59:59`);
  }

  if (dFim <= dInicio) {
    alert("⚠️ A data/hora de término deve ser posterior ao início da reserva.");
    return;
  }

  const novoInicioTs = dInicio.getTime();
  const novoFimTs = dFim.getTime();

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Verificando agenda...`;
  }

  try {
    const { data: reservasAtivas, error: errCheck } = await db
      .from('reservas')
      .select('*')
      .eq('status', 'CONFIRMADA');

    if (errCheck) throw errCheck;

    const reservaConflitante = (reservasAtivas || []).find(r => {
      const mesmoCarro =
        (placaVeiculo && String(r.placa) === String(placaVeiculo)) ||
        (placaVeiculo && String(r.veiculo_id) === String(placaVeiculo)) ||
        String(r.veiculo_id) === String(nomeFrota) ||
        (uuidVeiculo && String(r.uuid_veiculos) === String(uuidVeiculo));

      if (!mesmoCarro) return false;
      const rIni = new Date(r.data_inicio).getTime();
      const rFim = new Date(r.data_fim).getTime();
      return (novoInicioTs < rFim && novoFimTs > rIni);
    });

    if (reservaConflitante) {
      alert(`⛔ CONFLITO DE AGENDAMENTO!\nO veículo já está reservado neste período por: ${obterNomeMotoristaFormatado(reservaConflitante.responsavel)}`);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="ph-bold ph-check text-base"></i> Confirmar Agendamento`;
      }
      return;
    }

    const emailUser = usuarioLogado?.email || ADMIN_EMAIL;
    const novaReserva = {
      veiculo_id: nomeFrota,
      placa: placaVeiculo,
      uuid_veiculos: uuidVeiculo,
      responsavel: emailUser.toLowerCase().trim(),
      tipo_reserva: tipo,
      data_inicio: dInicio.toISOString(),
      data_fim: dFim.toISOString(),
      finalidade: document.getElementById('res-finalidade')?.value || 'DEMANDAS INTERNAS',
      observacao: (document.getElementById('res-obs')?.value || '').trim(),
      status: 'CONFIRMADA'
    };

    const { error: insErr } = await db.from('reservas').insert([novaReserva]);
    if (insErr) throw insErr;

    alert(`✅ Veículo reservado com sucesso!`);
    e.target.reset();
    ajustarCamposModalidade('DIAS');
    await carregarReservas();

  } catch (err) {
    alert("Erro ao validar ou gravar reserva: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-base"></i> Confirmar Agendamento`;
    }
  }
}

async function cancelarReserva(reservaId, responsavel) {
  const ehAdmin = (usuarioLogado?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const ehDono = (usuarioLogado?.email || '').toLowerCase() === String(responsavel || '').toLowerCase();

  if (!ehAdmin && !ehDono) {
    alert("Você só pode cancelar reservas feitas por você mesmo.");
    return;
  }

  if (!confirm("Deseja realmente cancelar este agendamento?")) return;

  try {
    const { error } = await db
      .from('reservas')
      .update({
        status: 'CANCELADA',
        updated_at: new Date().toISOString(),
        updated_by: usuarioLogado?.email || ADMIN_EMAIL
      })
      .eq('id', reservaId);

    if (error) throw error;

    alert("Reserva cancelada com sucesso!");
    await carregarReservas();
  } catch (err) {
    alert("Erro ao cancelar reserva: " + err.message);
  }
}

function renderizarTabelaReservas() {
  const tbody = document.getElementById('tabelaListaReservas');
  if (!tbody) return;
  tbody.innerHTML = '';

  const ehAdmin = (usuarioLogado?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();

  reservas.forEach(r => {
    const ehDono = (usuarioLogado?.email || '').toLowerCase() === (r.responsavel || '').toLowerCase();
    const condutorNome = obterNomeMotoristaFormatado(r.responsavel);

    const veic = (veiculos || []).find(v =>
      String(v.placa) === String(r.veiculo_id) ||
      String(v.id) === String(r.veiculo_id) ||
      String(v.uuid_veiculos) === String(r.veiculo_id) ||
      String(v.nome_frota) === String(r.veiculo_id)
    );

    const nomeFrotaExibicao = veic?.nome_frota || r.veiculo_id || 'Veículo';
    const statusUpper = String(r.status || '').toUpperCase();

    let badgeStatus = `<span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-lime-100 text-lime-900 border border-lime-300">Agendada</span>`;
    if (statusUpper === 'CONCLUIDA' || statusUpper === 'FINALIZADA') {
      badgeStatus = `<span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-900/70 text-emerald-100 border border-emerald-700">Concluída</span>`;
    } else if (statusUpper === 'CANCELADA') {
      badgeStatus = `<span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-900/70 text-rose-100 border border-rose-700">Cancelada</span>`;
    }

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50";
    tr.innerHTML = `
      <td class="py-3 px-3 font-extrabold text-slate-800">${nomeFrotaExibicao}</td>
      <td class="py-3 px-3 text-slate-700 font-semibold">${condutorNome}</td>
      <td class="py-3 px-3 font-mono text-[11px] text-slate-500">
        ${new Date(r.data_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} até 
        ${new Date(r.data_fim).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
      </td>
      <td class="py-3 px-3">
        <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">${r.finalidade}</span>
      </td>
      <td class="py-3 px-3 text-center">
        <div class="flex items-center justify-center gap-2">
          ${badgeStatus}
          ${(ehAdmin || ehDono) && statusUpper !== 'CANCELADA' && statusUpper !== 'CONCLUIDA' ? `
            <button onclick="cancelarReserva(${r.id}, '${r.responsavel}')" class="px-2 py-0.5 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 text-[10px] font-bold border border-rose-200 transition">
              Cancelar
            </button>
          ` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const badge = document.getElementById('badge-total-reservas');
  if (badge) badge.innerText = `${reservas.length} reservas`;
}

window.onload = init;