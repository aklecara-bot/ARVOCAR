// =========================================================================
// MÓDULO: RESERVAS & AGENDAMENTOS MOBILE - ARVO
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
// FUNÇÕES AUXILIARES DE PARSE E FORMATAÇÃO (FUSO HORÁRIO SEGURO)
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

function formatarApenasData(dataStr) {
  if (!dataStr) return '-';
  const limpo = dataStr.split('T')[0];
  const partes = limpo.split('-');
  if (partes.length === 3) {
    const [ano, mes, dia] = partes;
    return `${dia}/${mes}/${ano}`;
  }
  return new Date(dataStr).toLocaleDateString('pt-BR');
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

      const userDisplay = document.getElementById('user-display') || document.getElementById('m-top-username') || document.getElementById('m-user-label');
      if (userDisplay && usuarioLogado) {
        userDisplay.innerText = `${usuarioLogado.nome || usuarioLogado.email || 'Condutor'}`;
      }
    }
  } catch (err) {
    console.warn("Aviso na leitura da sessão:", err);
  }

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  const hojeStr = `${ano}-${mes}-${dia}`;

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
  await carregarHistoricoReservas();
  initCalendario();
  sincronizarFilaReservas();
}

// =========================================================================
// 2. CONTROLE DE ABAS (NOVO / CALENDÁRIO)
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

    setTimeout(() => {
      if (calendar) {
        calendar.updateSize();
        calendar.refetchEvents();
      }
    }, 120);

    carregarHistoricoReservas();
  }
}

// =========================================================================
// 3. VEÍCULOS (CACHE & BACKEND)
// =========================================================================
async function carregarVeiculosReservas() {
  const sel = document.getElementById('res-veiculo') || document.getElementById('m-res-veiculo');
  if (!sel) return;

  const localV = localStorage.getItem('arvo_cache_veiculos');
  if (localV) {
    try {
      veiculosReserva = JSON.parse(localV);
      renderSelectVeiculos(sel);
    } catch (e) {}
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
  veiculosReserva.forEach(v => {
    const nome = v.nome_frota || v.id;
    sel.innerHTML += `<option value="${nome}" data-uuid="${v.uuid_veiculos || ''}" data-placa="${v.placa || ''}">${nome} - ${v.marca || ''} [${v.placa || 'S/ Placa'}]</option>`;
  });
}

// =========================================================================
// 4. MODALIDADES DE RESERVA
// =========================================================================
function ajustarCamposModalidade(tipo) {
  const boxHoras = document.getElementById('box-horas') || document.getElementById('box-horas-mobile');
  const boxTurno = document.getElementById('box-turno') || document.getElementById('box-turno-mobile');
  const boxDataFim = document.getElementById('box-data-fim') || document.getElementById('box-data-fim-mobile');
  const inputDtIni = document.getElementById('res-data-inicio') || document.getElementById('m-res-data-inicio');
  const inputDtFim = document.getElementById('res-data-fim') || document.getElementById('m-res-data-fim');

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

        const a1 = primDia.getFullYear();
        const m1 = String(primDia.getMonth() + 1).padStart(2, '0');
        const d1 = String(primDia.getDate()).padStart(2, '0');

        const a2 = ultDia.getFullYear();
        const m2 = String(ultDia.getMonth() + 1).padStart(2, '0');
        const d2 = String(ultDia.getDate()).padStart(2, '0');

        inputDtIni.value = `${a1}-${m1}-${d1}`;
        inputDtFim.value = `${a2}-${m2}-${d2}`;
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
  const btn = document.getElementById('btn-submit') || document.getElementById('btn-salvar-reserva') || document.getElementById('btn-m-salvar-res');

  const selVeiculo = document.getElementById('res-veiculo') || document.getElementById('m-res-veiculo');
  const opt = selVeiculo ? selVeiculo.options[selVeiculo.selectedIndex] : null;
  const veiculo_id = selVeiculo ? selVeiculo.value : '';

  if (!veiculo_id) {
    alert("Por favor, selecione um veículo disponível.");
    return;
  }

  const uuid_veiculos = opt?.dataset?.uuid || null;
  const placa = opt?.dataset?.placa || null;
  const finalidade = (document.getElementById('res-finalidade')?.value || document.getElementById('m-res-finalidade')?.value || 'DEMANDAS INTERNAS').trim();
  const tipo_reserva = document.getElementById('res-tipo')?.value || document.getElementById('m-res-tipo')?.value || 'DIAS';
  const dtInicioStr = document.getElementById('res-data-inicio')?.value || document.getElementById('m-res-data-inicio')?.value;
  let dtFimStr = document.getElementById('res-data-fim')?.value || document.getElementById('m-res-data-fim')?.value || dtInicioStr;

  if (!dtInicioStr) {
    alert("Informe a data de início do agendamento.");
    return;
  }

  let dInicio, dFim;

  if (tipo_reserva === 'HORAS') {
    const hIni = document.getElementById('res-hora-inicio')?.value || document.getElementById('m-res-hora-inicio')?.value || '08:00';
    const hFim = document.getElementById('res-hora-fim')?.value || document.getElementById('m-res-hora-fim')?.value || '12:00';
    dInicio = parseDataLocal(dtInicioStr, `${hIni}:00`);
    dFim = parseDataLocal(dtInicioStr, `${hFim}:00`);
  } else if (tipo_reserva === 'TURNO') {
    const turno = document.getElementById('res-turno-sel')?.value || document.getElementById('m-res-turno-sel')?.value || 'MANHA';
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
      const a = dSeg.getFullYear();
      const m = String(dSeg.getMonth() + 1).padStart(2, '0');
      const d = String(dSeg.getDate()).padStart(2, '0');
      dFim = parseDataLocal(`${a}-${m}-${d}`, '06:00:00');
    }
  } else if (tipo_reserva === 'SEMANAS') {
    dInicio = parseDataLocal(dtInicioStr, '00:00:00');
    const dFimSem = parseDataLocal(dtInicioStr);
    dFimSem.setDate(dFimSem.getDate() + 6);
    const a = dFimSem.getFullYear();
    const m = String(dFimSem.getMonth() + 1).padStart(2, '0');
    const d = String(dFimSem.getDate()).padStart(2, '0');
    dFim = parseDataLocal(`${a}-${m}-${d}`, '23:59:59');
  } else if (tipo_reserva === 'MES') {
    const base = parseDataLocal(dtInicioStr);
    const primDia = new Date(base.getFullYear(), base.getMonth(), 1);
    const ultDia = new Date(base.getFullYear(), base.getMonth() + 1, 0);

    const a1 = primDia.getFullYear();
    const m1 = String(primDia.getMonth() + 1).padStart(2, '0');
    const d1 = String(primDia.getDate()).padStart(2, '0');

    const a2 = ultDia.getFullYear();
    const m2 = String(ultDia.getMonth() + 1).padStart(2, '0');
    const d2 = String(ultDia.getDate()).padStart(2, '0');

    dInicio = parseDataLocal(`${a1}-${m1}-${d1}`, '00:00:00');
    dFim = parseDataLocal(`${a2}-${m2}-${d2}`, '23:59:59');
  } else {
    dInicio = parseDataLocal(dtInicioStr, '00:00:00');
    dFim = parseDataLocal(dtFimStr, '23:59:59');
  }

  if (dFim <= dInicio) {
    alert("A data e hora de término deve ser posterior ao início da reserva.");
    return;
  }

  // Prevenção de conflito de agenda no cache local
  const conflito = listaReservas.some(r => {
    if (r.status === 'CANCELADA') return false;
    if (String(r.veiculo_id) !== String(veiculo_id)) return false;
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
    observacao: (document.getElementById('res-obs')?.value || document.getElementById('m-res-obs')?.value || '').trim(),
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
    console.warn("Conexão instável, enfileirando offline:", err);
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
  const form = document.getElementById('form-reserva') || document.getElementById('formReservaMobile');
  if (form) form.reset();

  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  const inputDtIni = document.getElementById('res-data-inicio') || document.getElementById('m-res-data-inicio');
  const inputDtFim = document.getElementById('res-data-fim') || document.getElementById('m-res-data-fim');
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
// 6. HISTÓRICO & FULLCALENDAR
// =========================================================================
async function carregarHistoricoReservas() {
  const localRes = localStorage.getItem('arvo_cache_reservas');
  if (localRes) {
    try {
      listaReservas = JSON.parse(localRes);
      renderHistoricoCards();
    } catch (e) {}
  }

  if (navigator.onLine) {
    try {
      const { data, error } = await db
        .from('reservas')
        .select('*')
        .eq('status', 'CONFIRMADA')
        .order('data_inicio', { ascending: true });

      if (!error && data) {
        listaReservas = data;
        localStorage.setItem('arvo_cache_reservas', JSON.stringify(data));
        renderHistoricoCards();
      }
    } catch (err) {
      console.warn("Offline: Mantendo histórico cacheado.");
    }
  }
}

function renderHistoricoCards() {
  const container = document.getElementById('lista-reservas') || document.getElementById('lista-reservas-mobile') || document.getElementById('m-lista-reservas');
  const badge = document.getElementById('badge-total-reservas') || document.getElementById('m-badge-reservas');
  if (!container) return;

  if (badge) badge.innerText = `${listaReservas.length} reservas`;

  if (listaReservas.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">Nenhum agendamento ativo no momento.</div>`;
    if (calendar) calendar.refetchEvents();
    return;
  }

  const ehAdmin = (usuarioLogado?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
  container.innerHTML = '';

  listaReservas.forEach(r => {
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
    const placaExibicao = (veic?.placa && veic.placa !== nomeExibicao) ? ` [${veic.placa}]` : '';

    const card = document.createElement('div');
    card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <i class="ph-bold ph-car text-brand-600"></i> ${nomeExibicao}${placaExibicao}
        </span>
        <span class="text-[10px] bg-brand-50 text-brand-700 font-bold px-2 py-0.5 rounded-full border border-brand-200">
          ${r.tipo_reserva || 'DIAS'} ${String(r.id).startsWith('temp_') ? '(Pendente 📶)' : ''}
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
          <button onclick="cancelarReservaMobile('${r.id}', '${r.responsavel}')" class="text-rose-600 text-xs font-bold flex items-center gap-1 hover:underline">
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
    events: function(fetchInfo, successCallback, failureCallback) {
      const eventos = listaReservas.map(r => {
        const veic = (veiculosReserva || []).find(v =>
          String(v.placa) === String(r.veiculo_id) ||
          String(v.id) === String(r.veiculo_id) ||
          String(v.nome_frota) === String(r.veiculo_id) ||
          String(v.uuid_veiculos) === String(r.uuid_veiculos || r.veiculo_id)
        );

        const nomeFrotaExibicao = veic?.nome_frota || r.nome_frota || r.veiculo_id || 'ARVO';

        return {
          id: String(r.id),
          title: `${nomeFrotaExibicao} - ${(r.responsavel || '').split('@')[0]}`,
          start: r.data_inicio,
          end: r.data_fim,
          backgroundColor: coresCarros[nomeFrotaExibicao] || coresCarros[r.veiculo_id] || coresCarros.DEFAULT,
          borderColor: coresCarros[nomeFrotaExibicao] || coresCarros[r.veiculo_id] || coresCarros.DEFAULT,
          extendedProps: {
            responsavel: r.responsavel,
            finalidade: r.finalidade,
            veiculo: nomeFrotaExibicao
          }
        };
      });
      successCallback(eventos);
    },
    eventClick: function(info) {
      const p = info.event.extendedProps;
      alert(`🚗 Reserva: ${p.veiculo}\n👤 Condutor: ${p.responsavel}\n🎯 Finalidade: ${p.finalidade}\n📅 Início: ${formatarDataHora(info.event.start)}\n📅 Fim: ${formatarDataHora(info.event.end)}`);
    }
  });

  calendar.render();
}

// =========================================================================
// 7. CANCELAMENTO E SESSÃO
// =========================================================================
async function cancelarReservaMobile(reservaId, responsavel) {
  const ehAdmin = (usuarioLogado?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const ehDono = (usuarioLogado?.email || '').toLowerCase() === (responsavel || '').toLowerCase();

  if (!ehAdmin && !ehDono) {
    alert("Você só pode cancelar reservas feitas pelo seu próprio usuário.");
    return;
  }

  if (confirm("Tem certeza de que deseja liberar este agendamento?")) {
    if (!navigator.onLine || String(reservaId).startsWith('temp_')) {
      listaReservas = listaReservas.filter(r => String(r.id) !== String(reservaId));
      localStorage.setItem('arvo_cache_reservas', JSON.stringify(listaReservas));
      renderHistoricoCards();
      alert("Agendamento cancelado localmente!");
      return;
    }

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
  if (confirm("Deseja realmente sair da sua conta?")) {
    localStorage.removeItem('arvo_mobile_user');
    localStorage.removeItem('arvo_usuario_logado');
    window.location.href = "mobile.html";
  }
}

// Exportações Globais para acionamento via inline HTML
window.trocarAba = trocarAba;
window.ajustarCamposModalidade = ajustarCamposModalidade;
window.ajustarModalidadeReserva = ajustarCamposModalidade;
window.salvarReservaMobile = salvarReservaMobile;
window.handleSalvarReserva = salvarReservaMobile;
window.handleSalvarReservaMobile = salvarReservaMobile;
window.cancelarReservaMobile = cancelarReservaMobile;
window.handleMobileLogout = handleMobileLogout;
window.formatarDataHora = formatarDataHora;
window.formatarApenasData = formatarApenasData;

document.addEventListener('DOMContentLoaded', initReservasMobile);