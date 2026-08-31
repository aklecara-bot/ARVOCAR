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
// INICIALIZAÇÃO SEGURA
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
        userDisplay.innerText = `${usuarioLogado.nome || usuarioLogado.email || 'Condutor'}`;
      }
    }
  } catch (err) {
    console.warn("Aviso na leitura da sessão:", err);
  }

  // Preenche datas padrão (Hoje)
  const hojeStr = new Date().toISOString().split('T')[0];
  const inputDtIni = document.getElementById('res-data-inicio');
  const inputDtFim = document.getElementById('res-data-fim');
  if (inputDtIni) inputDtIni.value = hojeStr;
  if (inputDtFim) inputDtFim.value = hojeStr;

  await carregarVeiculosReservas();
  await carregarHistoricoReservas();
  initCalendario();
  sincronizarFilaReservas();
}

// =========================================================================
// CONTROLE DE NAVEGAÇÃO DE ABAS SUPERIORES (NOVO / CALENDÁRIO)
// =========================================================================
function trocarAba(aba) {
  const viewNovo = document.getElementById('view-novo');
  const viewCal = document.getElementById('view-calendario');
  const btnNovo = document.getElementById('tab-btn-novo');
  const btnCal = document.getElementById('tab-btn-calendario');

  if (aba === 'novo') {
    if (viewNovo) viewNovo.classList.remove('hidden');
    if (viewCal) viewCal.classList.add('hidden');

    if (btnNovo) {
      btnNovo.className = "flex-1 py-2.5 text-center font-bold text-emerald-400 border-b-2 border-emerald-400 flex items-center justify-center gap-1.5 transition";
    }
    if (btnCal) {
      btnCal.className = "flex-1 py-2.5 text-center font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
    }
  } else {
    if (viewNovo) viewNovo.classList.add('hidden');
    if (viewCal) viewCal.classList.remove('hidden');

    if (btnCal) {
      btnCal.className = "flex-1 py-2.5 text-center font-bold text-emerald-400 border-b-2 border-emerald-400 flex items-center justify-center gap-1.5 transition";
    }
    if (btnNovo) {
      btnNovo.className = "flex-1 py-2.5 text-center font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
    }

    // Recalcula tamanho do FullCalendar ao ficar visível
    setTimeout(() => {
      if (calendar) {
        calendar.updateSize();
        calendar.refetchEvents();
      }
    }, 100);

    carregarHistoricoReservas();
  }
}

// =========================================================================
// CARREGAMENTO DE VEÍCULOS (CACHE FIRST)
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
      console.warn("Offline: Usando veículos em cache.");
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
// FULLCALENDAR MOBILE
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
      alert(`🚗 Reserva: ${p.veiculo}\n👤 Condutor: ${p.responsavel}\n🎯 Finalidade: ${p.finalidade}\n📅 Início: ${new Date(info.event.start).toLocaleString('pt-BR')}\n📅 Fim: ${new Date(info.event.end).toLocaleString('pt-BR')}`);
    }
  });

  calendar.render();
}

// =========================================================================
// GRAVAÇÃO DE RESERVAS (ONLINE & OFFLINE)
// =========================================================================
async function salvarReservaMobile(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const btn = document.getElementById('btn-submit') || document.getElementById('btn-salvar-reserva');

  const selVeiculo = document.getElementById('res-veiculo') || document.getElementById('m-res-veiculo');
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
  const data_inicio = document.getElementById('res-data-inicio')?.value;
  const data_fim = document.getElementById('res-data-fim')?.value;

  if (!data_inicio || !data_fim) {
    alert("Informe o período do agendamento.");
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
    data_inicio: new Date(data_inicio).toISOString(),
    data_fim: new Date(data_fim).toISOString(),
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
    console.warn("Offline fallback ao salvar agendamento:", err);
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
// CARREGAR HISTÓRICO & PRÓXIMOS AGENDAMENTOS
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
      console.warn("Offline: Usando histórico cacheado.");
    }
  }
}

function renderHistoricoCards() {
  const container = document.getElementById('lista-reservas');
  const badge = document.getElementById('badge-total-reservas');
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
    const dataIni = new Date(r.data_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const dataFim = new Date(r.data_fim).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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

// =========================================================================
// EXPOSIÇÃO GLOBAL DE FUNÇÕES (VINCULAÇÃO COM O HTML)
// =========================================================================
window.trocarAba = trocarAba;
window.salvarReservaMobile = salvarReservaMobile;
window.cancelarReservaMobile = cancelarReservaMobile;
window.handleMobileLogout = handleMobileLogout;

document.addEventListener('DOMContentLoaded', initReservasMobile);