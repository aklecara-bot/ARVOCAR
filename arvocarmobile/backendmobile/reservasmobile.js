// =========================================================================
// MÓDULO: RESERVAS & AGENDAMENTOS MOBILE - ARVO (INTEGRAL COM CALENDÁRIO)
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";
const ADMIN_EMAIL = "admin@arvo.tec.br";

const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

let usuarioLogado = null;
let veiculosReserva = [];
let listaReservas = [];
let usuarios = [];
let calendar = null;

// =========================================================================
// FUNÇÕES AUXILIARES DE FORMATAÇÃO E NOMES
// =========================================================================
function parseDataLocal(dataStr, horaStr = '00:00:00') {
  if (!dataStr) return new Date();
  const [ano, mes, dia] = dataStr.split('T')[0].split('-').map(Number);
  const [hora, min, sec] = horaStr.split(':').map(n => Number(n) || 0);
  return new Date(ano, mes - 1, dia, hora, min, sec);
}

function formatarDataHora(dataIso) {
  if (!dataIso) return '-';
  const data = new Date(dataIso);
  if (isNaN(data.getTime())) return dataIso;
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

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

  if (usuarioLogado && (usuarioLogado.email || '').toLowerCase().trim() === idLimpo) {
    if (usuarioLogado.nome && !usuarioLogado.nome.includes('@')) return usuarioLogado.nome;
  }

  const base = idLimpo.includes('@') ? idLimpo.split('@')[0] : idLimpo;
  return base
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

// =========================================================================
// 1. INICIALIZAÇÃO
// =========================================================================
async function initReservasMobile() {
  try {
    const sessaoStr = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
    if (sessaoStr) {
      try {
        usuarioLogado = JSON.parse(sessaoStr);
      } catch (e) {
        usuarioLogado = { email: sessaoStr, nome: sessaoStr };
      }

      const userDisplay = document.getElementById('user-display') || document.getElementById('m-top-username');
      if (userDisplay && usuarioLogado) {
        userDisplay.innerText = `${obterNomeMotoristaFormatado(usuarioLogado.email)}`;
      }
    }
  } catch (err) {
    console.warn("Aviso sessão:", err);
  }

  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  const inputDtIni = document.getElementById('res-data-inicio') || document.getElementById('m-res-data-inicio');
  const inputDtFim = document.getElementById('res-data-fim') || document.getElementById('m-res-data-fim');
  if (inputDtIni) inputDtIni.value = hojeStr;
  if (inputDtFim) inputDtFim.value = hojeStr;

  if (inputDtIni) {
    inputDtIni.addEventListener('change', () => {
      const tipoSel = document.getElementById('res-tipo') || document.getElementById('m-res-tipo');
      if (tipoSel) ajustarCamposModalidade(tipoSel.value);
    });
  }

  const tipoIni = document.getElementById('res-tipo') || document.getElementById('m-res-tipo');
  if (tipoIni) ajustarCamposModalidade(tipoIni.value);

  await carregarVeiculosReservas();
  await carregarUsuarios();
  await carregarHistoricoReservas();
  sincronizarFilaReservas();
}

async function carregarUsuarios() {
  try {
    const cache = localStorage.getItem('arvo_cache_usuarios');
    if (cache) usuarios = JSON.parse(cache);
    if (navigator.onLine) {
      const { data } = await db.from('usuarios').select('id, nome, email');
      if (data) {
        usuarios = data;
        localStorage.setItem('arvo_cache_usuarios', JSON.stringify(data));
      }
    }
  } catch (e) { }
}

// =========================================================================
// 2. CONTROLE DE ABAS (CORREÇÃO DE RENDERIZAÇÃO DO FULLCALENDAR)
// =========================================================================
function trocarAba(aba) {
  const viewNovo = document.getElementById('view-novo');
  const viewCal = document.getElementById('view-calendario');
  const btnNovo = document.getElementById('tab-btn-novo');
  const btnCal = document.getElementById('tab-btn-calendario');

  if (aba === 'novo') {
    if (viewNovo) viewNovo.classList.remove('hidden');
    if (viewCal) viewCal.classList.add('hidden');

    if (btnNovo) btnNovo.className = "flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[#8fb855] border-b-2 border-[#8fb855] transition";
    if (btnCal) btnCal.className = "flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[#b0b9ab] hover:text-[#f4f1e5] border-b-2 border-transparent transition";
  } else {
    if (viewNovo) viewNovo.classList.add('hidden');
    if (viewCal) viewCal.classList.remove('hidden');

    if (btnCal) btnCal.className = "flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[#8fb855] border-b-2 border-[#8fb855] transition";
    if (btnNovo) btnNovo.className = "flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[#b0b9ab] hover:text-[#f4f1e5] border-b-2 border-transparent transition";

    // Garante inicialização e recálculo do tamanho quando o elemento se torna visível
    setTimeout(() => {
      if (!calendar) {
        initCalendario();
      } else {
        calendar.updateSize();
        calendar.refetchEvents();
      }
    }, 100);

    carregarHistoricoReservas();
  }
}

// =========================================================================
// 3. VEÍCULOS (CACHE & FILTRAGEM)
// =========================================================================
async function carregarVeiculosReservas() {
  const sel = document.getElementById('res-veiculo') || document.getElementById('m-res-veiculo');
  if (!sel) return;

  const localV = localStorage.getItem('arvo_cache_veiculos');
  if (localV) {
    try {
      veiculosReserva = JSON.parse(localV);
      renderSelectVeiculos(sel);
    } catch (e) { }
  }

  if (navigator.onLine) {
    try {
      const { data, error } = await db
        .from('veiculos')
        .select('*')
        .neq('status', 'Fora de Uso')
        .order('nome_frota');

      if (!error && data) {
        veiculosReserva = data;
        localStorage.setItem('arvo_cache_veiculos', JSON.stringify(data));
        renderSelectVeiculos(sel);
      }
    } catch (err) {
      console.warn("Offline: Mantendo cache de veículos.");
    }
  }
}

function renderSelectVeiculos(sel) {
  sel.innerHTML = '<option value="">Selecione o veículo...</option>';
  const emailUser = (usuarioLogado?.email || '').toLowerCase().trim();
  const isAdmin = emailUser === ADMIN_EMAIL.toLowerCase().trim();

  veiculosReserva
    .filter(v => {
      const isExterno = (v.tipo_frota || '').toUpperCase() === 'EXTERNO' || (v.proprietario || '').toUpperCase() === 'EXTERNO';
      const condutorExclusivo = (v.motorista_autorizado || '').toLowerCase().trim();
      if (isExterno && condutorExclusivo !== emailUser && !isAdmin) return false;
      return true;
    })
    .forEach(v => {
      const nome = v.nome_frota || v.id;
      sel.innerHTML += `<option value="${nome}" data-uuid="${v.uuid_veiculos || ''}" data-placa="${v.placa || ''}">${nome} - ${v.marca || ''} [${v.placa || 'S/ Placa'}]</option>`;
    });
}

// =========================================================================
// 4. MODALIDADES DE RESERVA
// =========================================================================
function ajustarCamposModalidade(tipo) {
  const boxHoras = document.getElementById('box-horas');
  const boxTurno = document.getElementById('box-turno');
  const boxDataFim = document.getElementById('box-data-fim');
  const inputDtIni = document.getElementById('res-data-inicio');
  const inputDtFim = document.getElementById('res-data-fim');

  if (boxHoras) boxHoras.classList.add('hidden');
  if (boxTurno) boxTurno.classList.add('hidden');
  if (boxDataFim) boxDataFim.classList.remove('hidden');
  if (inputDtFim) inputDtFim.readOnly = false;

  const dtBase = inputDtIni && inputDtIni.value ? parseDataLocal(inputDtIni.value) : new Date();

  switch (tipo) {
    case 'HORAS':
    case 'TURNO':
      if (tipo === 'HORAS' && boxHoras) boxHoras.classList.remove('hidden');
      if (tipo === 'TURNO' && boxTurno) boxTurno.classList.remove('hidden');
      if (boxDataFim) boxDataFim.classList.add('hidden');
      if (inputDtFim && inputDtIni) inputDtFim.value = inputDtIni.value;
      break;

    case 'SEMANAS':
      if (inputDtIni && inputDtFim && inputDtIni.value) {
        const dFim = new Date(dtBase);
        dFim.setDate(dFim.getDate() + 6);
        const a = dFim.getFullYear();
        const m = String(dFim.getMonth() + 1).padStart(2, '0');
        const d = String(dFim.getDate()).padStart(2, '0');
        inputDtFim.value = `${a}-${m}-${d}`;
        inputDtFim.readOnly = true;
      }
      break;

    case 'MES':
      if (inputDtIni && inputDtFim && inputDtIni.value) {
        const ano = dtBase.getFullYear();
        const mesIndex = dtBase.getMonth();
        const primDia = new Date(ano, mesIndex, 1);
        const ultDia = new Date(ano, mesIndex + 1, 0);

        inputDtIni.value = `${primDia.getFullYear()}-${String(primDia.getMonth() + 1).padStart(2, '0')}-${String(primDia.getDate()).padStart(2, '0')}`;
        inputDtFim.value = `${ultDia.getFullYear()}-${String(ultDia.getMonth() + 1).padStart(2, '0')}-${String(ultDia.getDate()).padStart(2, '0')}`;
        inputDtFim.readOnly = true;
      }
      break;

    case 'DIAS':
    default:
      if (inputDtFim) inputDtFim.readOnly = false;
      break;
  }
}

// =========================================================================
// 5. GRAVAÇÃO & FILA OFFLINE
// =========================================================================
async function salvarReservaMobile(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const btn = document.getElementById('btn-submit');
  const selVeiculo = document.getElementById('res-veiculo');
  const opt = selVeiculo ? selVeiculo.options[selVeiculo.selectedIndex] : null;
  const veiculo_id = selVeiculo ? selVeiculo.value : '';

  if (!veiculo_id) {
    alert("Por favor, selecione um veículo disponível.");
    return;
  }

  const uuid_veiculos = opt?.dataset?.uuid || null;
  const placa = opt?.dataset?.placa || null;
  const finalidade = (document.getElementById('res-finalidade')?.value || 'DEMANDAS INTERNAS').trim();
  const tipo_reserva = document.getElementById('res-tipo')?.value || 'DIAS';
  const dtInicioStr = document.getElementById('res-data-inicio')?.value;
  let dtFimStr = document.getElementById('res-data-fim')?.value || dtInicioStr;

  if (!dtInicioStr) {
    alert("Informe a data de início do agendamento.");
    return;
  }

  let dInicio, dFim;

  if (tipo_reserva === 'HORAS') {
    const hIni = document.getElementById('res-hora-inicio')?.value || '08:00';
    const hFim = document.getElementById('res-hora-fim')?.value || '12:00';
    dInicio = parseDataLocal(dtInicioStr, `${hIni}:00`);
    dFim = parseDataLocal(dtInicioStr, `${hFim}:00`);
  } else if (tipo_reserva === 'TURNO') {
    const turno = document.getElementById('res-turno-sel')?.value || 'MANHA';
    if (turno === 'MANHA') {
      dInicio = parseDataLocal(dtInicioStr, '07:00:00');
      dFim = parseDataLocal(dtInicioStr, '12:00:00');
    } else if (turno === 'TARDE') {
      dInicio = parseDataLocal(dtInicioStr, '13:00:00');
      dFim = parseDataLocal(dtInicioStr, '18:00:00');
    } else {
      dInicio = parseDataLocal(dtInicioStr, '18:00:00');
      const dSeg = parseDataLocal(dtInicioStr);
      dSeg.setDate(dSeg.getDate() + 1);
      dFim = parseDataLocal(`${dSeg.getFullYear()}-${String(dSeg.getMonth() + 1).padStart(2, '0')}-${String(dSeg.getDate()).padStart(2, '0')}`, '06:00:00');
    }
  } else if (tipo_reserva === 'SEMANAS') {
    dInicio = parseDataLocal(dtInicioStr, '00:00:00');
    const dFimSem = parseDataLocal(dtInicioStr);
    dFimSem.setDate(dFimSem.getDate() + 6);
    dFim = parseDataLocal(`${dFimSem.getFullYear()}-${String(dFimSem.getMonth() + 1).padStart(2, '0')}-${String(dFimSem.getDate()).padStart(2, '0')}`, '23:59:59');
  } else if (tipo_reserva === 'MES') {
    const base = parseDataLocal(dtInicioStr);
    const primDia = new Date(base.getFullYear(), base.getMonth(), 1);
    const ultDia = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    dInicio = parseDataLocal(`${primDia.getFullYear()}-${String(primDia.getMonth() + 1).padStart(2, '0')}-${String(primDia.getDate()).padStart(2, '0')}`, '00:00:00');
    dFim = parseDataLocal(`${ultDia.getFullYear()}-${String(ultDia.getMonth() + 1).padStart(2, '0')}-${String(ultDia.getDate()).padStart(2, '0')}`, '23:59:59');
  } else {
    dInicio = parseDataLocal(dtInicioStr, '00:00:00');
    dFim = parseDataLocal(dtFimStr, '23:59:59');
  }

  if (dFim <= dInicio) {
    alert("A data e hora de término deve ser posterior ao início da reserva.");
    return;
  }

  // Checagem de sobreposição
  const conflito = listaReservas.some(r => {
    if (r.status === 'CANCELADA') return false;
    if (String(r.veiculo_id) !== String(veiculo_id) && String(r.placa) !== String(placa)) return false;
    const rIni = new Date(r.data_inicio).getTime();
    const rFim = new Date(r.data_fim).getTime();
    return (dInicio.getTime() < rFim && dFim.getTime() > rIni);
  });

  if (conflito) {
    alert(`❌ O veículo ${veiculo_id} já possui um agendamento conflitante neste período.`);
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;
  }

  const tempId = `temp_res_${Date.now()}`;
  const payload = {
    id: tempId,
    veiculo_id,
    uuid_veiculos,
    placa,
    responsavel: (usuarioLogado && usuarioLogado.email) ? usuarioLogado.email : 'admin@arvo.tec.br',
    finalidade,
    tipo_reserva,
    data_inicio: dInicio.toISOString(),
    data_fim: dFim.toISOString(),
    observacao: (document.getElementById('res-obs')?.value || '').trim(),
    status: 'CONFIRMADA'
  };

  if (!navigator.onLine) {
    salvarFilaReserva(payload);
    listaReservas.unshift(payload);
    localStorage.setItem('arvo_cache_reservas', JSON.stringify(listaReservas));
    alert('📶 Agendamento gravado Offline! Será sincronizado ao reconectar.');
    limparFormularioReserva();
    trocarAba('calendario');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-calendar-plus text-base"></i> Confirmar Agendamento`;
    }
    return;
  }

  try {
    delete payload.id;
    const { error: insErr } = await db.from('reservas').insert([payload]);
    if (insErr) throw insErr;

    alert('✅ Reserva agendada com sucesso!');
    limparFormularioReserva();
    await carregarHistoricoReservas();
    trocarAba('calendario');
  } catch (err) {
    payload.id = tempId;
    salvarFilaReserva(payload);
    listaReservas.unshift(payload);
    localStorage.setItem('arvo_cache_reservas', JSON.stringify(listaReservas));
    alert('📶 Gravado localmente devido a oscilações no sinal.');
    limparFormularioReserva();
    trocarAba('calendario');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-calendar-plus text-base"></i> Confirmar Agendamento`;
    }
  }
}

function limparFormularioReserva() {
  const form = document.getElementById('form-reserva');
  if (form) form.reset();
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const inputDtIni = document.getElementById('res-data-inicio');
  const inputDtFim = document.getElementById('res-data-fim');
  if (inputDtIni) inputDtIni.value = hojeStr;
  if (inputDtFim) inputDtFim.value = hojeStr;
  ajustarCamposModalidade('DIAS');
}

function salvarFilaReserva(item) {
  const fila = JSON.parse(localStorage.getItem('arvo_sync_reservas_queue') || '[]');
  fila.push(item);
  localStorage.setItem('arvo_sync_reservas_queue', JSON.stringify(fila));
}

async function sincronizarFilaReservas() {
  if (!navigator.onLine) return;
  const fila = JSON.parse(localStorage.getItem('arvo_sync_reservas_queue') || '[]');
  if (fila.length === 0) return;

  const restantes = [];
  for (const item of fila) {
    try {
      const payloadEnvio = { ...item };
      delete payloadEnvio.id;
      await db.from('reservas').insert([payloadEnvio]);
    } catch (e) {
      restantes.push(item);
    }
  }

  localStorage.setItem('arvo_sync_reservas_queue', JSON.stringify(restantes));
  if (restantes.length === 0) {
    await carregarHistoricoReservas();
  }
}

window.addEventListener('online', sincronizarFilaReservas);

// =========================================================================
// 6. HISTÓRICO & FULLCALENDAR COM CORES ESPECÍFICAS
// =========================================================================
async function carregarHistoricoReservas() {
  const localRes = localStorage.getItem('arvo_cache_reservas');
  if (localRes) {
    try {
      listaReservas = JSON.parse(localRes);
      renderHistoricoCards();
    } catch (e) { }
  }

  if (navigator.onLine) {
    try {
      // Carrega TODAS as reservas (confirmadas, concluidas e canceladas) para o calendário
      const { data, error } = await db
        .from('reservas')
        .select('*')
        .order('data_inicio', { ascending: false });

      if (!error && data) {
        listaReservas = data;
        localStorage.setItem('arvo_cache_reservas', JSON.stringify(data));
        renderHistoricoCards();
        if (calendar) {
          calendar.refetchEvents();
        }
      }
    } catch (err) {
      console.warn("Offline: Mantendo histórico cacheado.");
    }
  }
}

function renderHistoricoCards() {
  const container = document.getElementById('lista-reservas');
  const badge = document.getElementById('badge-total-reservas');
  if (!container) return;

  const agora = new Date().getTime();
  const ativasEFuturas = [];
  const passadas = [];

  (listaReservas || []).forEach(r => {
    const tFim = new Date(r.data_fim).getTime();
    if (tFim >= agora && r.status !== 'CANCELADA') {
      ativasEFuturas.push(r);
    } else {
      passadas.push(r);
    }
  });

  ativasEFuturas.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));
  passadas.sort((a, b) => new Date(b.data_fim) - new Date(a.data_fim));

  const reservasExibicao = [...ativasEFuturas, ...passadas].slice(0, 10);
  if (badge) badge.innerText = `${reservasExibicao.length} reservas`;

  if (reservasExibicao.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">Nenhum agendamento ativo no momento.</div>`;
    return;
  }

  const ehAdmin = (usuarioLogado?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
  container.innerHTML = '';

  reservasExibicao.forEach(r => {
    const ehDono = (usuarioLogado?.email || '').toLowerCase() === (r.responsavel || '').toLowerCase();
    const dataIni = formatarDataHora(r.data_inicio);
    const dataFim = formatarDataHora(r.data_fim);

    const veic = (veiculosReserva || []).find(v =>
      String(v.id) === String(r.veiculo_id) ||
      String(v.placa) === String(r.veiculo_id) ||
      String(v.nome_frota) === String(r.veiculo_id) ||
      String(v.uuid_veiculos) === String(r.uuid_veiculos || r.veiculo_id)
    );

    const nomeExibicao = veic?.nome_frota || r.nome_frota || r.veiculo_id || 'Veículo';
    const placaExibicao = veic?.placa ? `(${veic.placa})` : (r.placa ? `(${r.placa})` : '');
    const condutorNome = obterNomeMotoristaFormatado(r.responsavel);
    const isPendenteOffline = String(r.id).startsWith('temp_');

    const card = document.createElement('div');
    card.className = "bg-[#1E293B] border border-slate-700/70 rounded-2xl p-3 flex items-center justify-between shadow-xs transition hover:border-slate-600";

    card.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <i class="ph-bold ph-car text-lg"></i>
        </div>
        <div>
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-extrabold text-xs text-white">${nomeExibicao}</span>
            <span class="text-[10px] text-slate-400 font-mono">${placaExibicao}</span>
            ${isPendenteOffline ? '<span class="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded font-mono">📶 Pendente</span>' : ''}
          </div>
          <p class="text-[11px] text-slate-300">Condutor: <b class="text-emerald-400">${condutorNome}</b></p>
        </div>
      </div>

      <div class="text-right shrink-0">
        <span class="text-[10px] font-mono font-bold text-slate-300 block" title="${dataIni} até ${dataFim}">
          ${dataIni.split(',')[0]} → ${dataFim.split(',')[0]}
        </span>
        <span class="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-semibold border border-slate-700 inline-block mt-0.5 max-w-[120px] truncate" title="${r.finalidade || 'Demandas'}">
          ${r.finalidade || 'Demandas'}
        </span>
        ${(ehAdmin || ehDono) && r.status !== 'CANCELADA' ? `
          <button onclick="cancelarReservaMobile('${r.id}', '${r.responsavel}')" class="block text-rose-400 hover:text-rose-300 text-[10px] font-bold mt-1 ml-auto">
            Cancelar
          </button>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

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
    events: function (fetchInfo, successCallback, failureCallback) {
      const agora = new Date().getTime();

      const eventos = (listaReservas || []).map(r => {
        const veic = (veiculosReserva || []).find(v =>
          String(v.placa) === String(r.veiculo_id) ||
          String(v.id) === String(r.veiculo_id) ||
          String(v.uuid_veiculos) === String(r.uuid_veiculos || r.veiculo_id) ||
          String(v.nome_frota) === String(r.veiculo_id)
        );

        const nomeFrotaExibicao = veic?.nome_frota || r.nome_frota || r.veiculo_id || 'ARVO';
        const condutorFormatado = obterNomeMotoristaFormatado(r.responsavel);
        const statusUpper = String(r.status || '').toUpperCase().trim();
        const dtInicio = new Date(r.data_inicio).getTime();

        // CORES RIGOROSAS CONFORME SOLICITADO
        let corFundo = '#65a30d'; // Verde-limão não fluorescente
        let corBorda = '#4d7c0f';
        let corTexto = '#ffffff';

        if (statusUpper === 'CONCLUIDA' || statusUpper === 'FINALIZADA') {
          corFundo = 'rgba(20, 83, 45, 0.70)'; // Verde escuro 70% transparente
          corBorda = 'rgba(22, 101, 52, 0.85)';
        } else if (statusUpper === 'CANCELADA') {
          corFundo = 'rgba(220, 38, 38, 0.70)'; // Vermelho 70% transparente
          corBorda = 'rgba(185, 28, 28, 0.85)';
        } else if (agora < dtInicio) {
          corFundo = '#65a30d'; // Verde-limão sóbrio (agendada/futura)
          corBorda = '#4d7c0f';
        } else {
          // Em andamento
          corFundo = 'rgba(2, 132, 199, 0.75)';
          corBorda = '#0369a1';
        }

        return {
          id: String(r.id),
          title: `${nomeFrotaExibicao} - ${condutorFormatado}`,
          start: r.data_inicio,
          end: r.data_fim,
          backgroundColor: corFundo,
          borderColor: corBorda,
          textColor: corTexto,
          extendedProps: {
            responsavel: condutorFormatado,
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
      alert(`🚗 Veículo: ${p.veiculo}\n👤 Condutor: ${p.responsavel}\n🎯 Finalidade: ${p.finalidade}\nStatus: ${p.status || 'Agendada'}\n📅 Início: ${formatarDataHora(info.event.start)}\n📅 Fim: ${formatarDataHora(info.event.end)}`);
    }
  });

  calendar.render();
}

// =========================================================================
// 7. CANCELAMENTO DE RESERVA
// =========================================================================
async function cancelarReservaMobile(reservaId, responsavel) {
  const ehAdmin = (usuarioLogado?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const ehDono = (usuarioLogado?.email || '').toLowerCase() === (responsavel || '').toLowerCase();

  if (!ehAdmin && !ehDono) {
    alert("Você só pode cancelar reservas feitas pelo seu próprio usuário.");
    return;
  }

  if (!confirm("Deseja realmente cancelar esta reserva?")) return;

  const emailUsuarioAtual = (usuarioLogado?.email || 'mobile_user').toLowerCase().trim();

  try {
    const { error } = await db
      .from('reservas')
      .update({
        status: 'CANCELADA',
        updated_at: new Date().toISOString(),
        updated_by: emailUsuarioAtual
      })
      .eq('id', reservaId);

    if (error) throw error;

    alert("Reserva cancelada com sucesso!");
    await carregarHistoricoReservas();
  } catch (err) {
    alert("Erro ao cancelar reserva: " + err.message);
  }
}

function handleMobileLogout() {
  if (confirm("Deseja realmente sair da sua conta?")) {
    localStorage.removeItem('arvo_mobile_user');
    localStorage.removeItem('arvo_usuario_logado');
    window.location.href = "mobile.html";
  }
}

// Exportações Globais
window.trocarAba = trocarAba;
window.ajustarCamposModalidade = ajustarCamposModalidade;
window.salvarReservaMobile = salvarReservaMobile;
window.cancelarReservaMobile = cancelarReservaMobile;
window.handleMobileLogout = handleMobileLogout;
window.formatarDataHora = formatarDataHora;

document.addEventListener('DOMContentLoaded', initReservasMobile);