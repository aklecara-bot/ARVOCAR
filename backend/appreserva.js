const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";
const ADMIN_EMAIL = "admin@arvo.tec.br";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioLogado = null;
let veiculos = [];
let reservas = [];
let rotas = []; // Lista de rotas para checagem de uso e cálculo de km
let calendar = null;

// Cores por carro para visualização no calendário
const coresCarros = {
  'ARVO 10': '#0284c7', // Azul
  'ARVO 11': '#16a34a', // Verde
  'ARVO 12': '#f59e0b', // Laranja
  'ARVO 15': '#8b5cf6', // Roxo
  'ARVO 16': '#ec4899', // Rosa
  'DEFAULT': '#64748b'
};

async function init() {
  const sessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  if (!sessao) {
    window.location.href = "login.html";
    return;
  }
  usuarioLogado = JSON.parse(sessao);

  // Data inicial padrão: hoje
  const hojeStr = new Date().toISOString().split('T')[0];
  const dtIniInput = document.getElementById('res-data-inicio');
  const dtFimInput = document.getElementById('res-data-fim');
  if (dtIniInput) dtIniInput.value = hojeStr;
  if (dtFimInput) dtFimInput.value = hojeStr;

  await carregarVeiculos();
  await carregarReservas();
  initCalendario();
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
      // Salvamos o nome_frota no value para que a reserva seja criada com esse nome
      sel.innerHTML += `<option value="${nomeFrota}" data-placa="${v.placa || ''}">${nomeFrota} - ${v.marca || ''} [${v.placa || ''}]</option>`;
    });

  } catch (err) {
    console.error("Erro ao carregar veículos:", err);
    sel.innerHTML = '<option value="">Erro ao carregar veículos</option>';
  }
}

/**
 * Popup Universal Centralizado (Web & Mobile)
 */
function mostrarPopupCustom(tipo, titulo, mensagem, onClose = null) {
  const modalId = `app-popup-${Date.now()}`;

  const temas = {
    sucesso: { icon: 'ph-check-circle', bg: '#dcfce7', text: '#15803d', btn: '#15803d' },
    erro:    { icon: 'ph-x-circle',     bg: '#ffe4e6', text: '#e11d48', btn: '#e11d48' },
    aviso:   { icon: 'ph-warning',      bg: '#fef3c7', text: '#d97706', btn: '#d97706' },
    info:    { icon: 'ph-info',         bg: '#e0f2fe', text: '#0284c7', btn: '#0284c7' }
  };

  const config = temas[tipo] || temas.aviso;

  const backdrop = document.createElement('div');
  backdrop.id = modalId;
  backdrop.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background-color: rgba(15, 23, 42, 0.75) !important;
    backdrop-filter: blur(4px) !important;
    -webkit-backdrop-filter: blur(4px) !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 1rem !important;
    box-sizing: border-box !important;
  `;

  backdrop.innerHTML = `
    <div style="
      background-color: #ffffff !important;
      border-radius: 1.5rem !important;
      width: 100% !important;
      max-width: 24rem !important;
      padding: 1.5rem !important;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35) !important;
      border: 1px solid #f1f5f9 !important;
      text-align: center !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 1rem !important;
      box-sizing: border-box !important;
      font-family: inherit !important;
    ">
      <div style="
        width: 3.5rem !important;
        height: 3.5rem !important;
        border-radius: 1rem !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 1.75rem !important;
        background-color: ${config.bg} !important;
        color: ${config.text} !important;
      ">
        <i class="ph-bold ${config.icon}"></i>
      </div>

      <div style="width: 100% !important;">
        <h3 style="font-size: 1.05rem !important; font-weight: 900 !important; color: #0f172a !important; margin: 0 0 0.5rem 0 !important;">
          ${titulo}
        </h3>
        <p style="font-size: 0.8125rem !important; color: #475569 !important; margin: 0 !important; line-height: 1.45 !important; word-break: break-word !important;">
          ${mensagem}
        </p>
      </div>

      <button type="button" id="${modalId}-btn" style="
        width: 100% !important;
        padding: 0.75rem 1rem !important;
        border-radius: 0.75rem !important;
        font-weight: 700 !important;
        font-size: 0.8125rem !important;
        border: none !important;
        cursor: pointer !important;
        color: #ffffff !important;
        background-color: ${config.btn} !important;
      ">
        Entendido
      </button>
    </div>
  `;

  document.body.appendChild(backdrop);

  const fechar = () => {
    backdrop.remove();
    if (typeof onClose === 'function') onClose();
  };

  document.getElementById(`${modalId}-btn`).onclick = fechar;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) fechar();
  };
}

// Converte chamadas automáticas de alert()
window.alert = function (msg) {
  const texto = String(msg || '');
  let tipo = 'aviso';
  let titulo = 'Atenção';

  const t = texto.toLowerCase();
  if (t.includes('sucesso') || t.includes('salvo') || t.includes('confirmad')) {
    tipo = 'sucesso';
    titulo = 'Sucesso!';
  } else if (t.includes('erro') || t.includes('falha') || t.includes('inválid')) {
    tipo = 'erro';
    titulo = 'Erro!';
  }

  mostrarPopupCustom(tipo, titulo, texto);
};

async function carregarReservas() {
  const { data, error } = await db
    .from('reservas')
    .select('*')
    .eq('status', 'CONFIRMADA')
    .order('data_inicio', { ascending: true });

  const rawReservas = data || [];
  const agora = new Date().getTime();

  // 1. Divide em Ativas/Futuras vs Passadas/Encerradas
  const presentesEFuturas = [];
  const passadas = [];

  rawReservas.forEach(r => {
    const tFim = new Date(r.data_fim).getTime();
    // Considera ativa/futura se o término for maior ou igual ao momento atual
    if (tFim >= agora && r.status !== 'CONCLUIDA' && r.status !== 'CANCELADA') {
      presentesEFuturas.push(r);
    } else {
      passadas.push(r);
    }
  });

  // Presentes/Futuras: ordenadas das mais próximas para as mais distantes
  presentesEFuturas.sort((a, b) => new Date(a.data_inicio) - new Date(b.data_inicio));
  // Encerradas: ordenadas das mais recentemente concluídas para as mais antigas
  passadas.sort((a, b) => new Date(b.data_fim) - new Date(a.data_fim));

  // Junta colocando presentes e futuras no topo
  reservas = [...presentesEFuturas, ...passadas];

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
    events: function(fetchInfo, successCallback, failureCallback) {
      const eventos = reservas.map(r => {
        // Cruza a reserva com os veículos para localizar o nome_frota (ex: ARVO 11)
        const veic = (veiculos || []).find(v => 
          String(v.placa) === String(r.veiculo_id) || 
          String(v.id) === String(r.veiculo_id) || 
          String(v.uuid_veiculos) === String(r.veiculo_id) ||
          String(v.nome_frota) === String(r.veiculo_id)
        );

        const nomeFrotaExibicao = veic?.nome_frota || r.veiculo_id || 'ARVO';

        return {
          id: r.id.toString(),
          title: `${nomeFrotaExibicao} - ${(r.responsavel || '').split('@')[0]}`,
          start: r.data_inicio,
          end: r.data_fim,
          backgroundColor: coresCarros[nomeFrotaExibicao] || coresCarros[r.veiculo_id] || coresCarros.DEFAULT,
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
      alert(`🚗 Veículo: ${p.veiculo}\n👤 Condutor: ${p.responsavel}\n🎯 Finalidade: ${p.finalidade}\n📅 Início: ${new Date(info.event.start).toLocaleString('pt-BR')}\n📅 Término: ${new Date(info.event.end).toLocaleString('pt-BR')}`);
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

  // Identifica o veículo no array global para cruzar placa, UUID e nome_frota
  const veiculoObj = (typeof veiculos !== 'undefined' ? veiculos : []).find(v =>
    String(v.nome_frota) === String(veiculoId) ||
    String(v.placa) === String(veiculoId) ||
    String(v.id) === String(veiculoId) ||
    String(v.uuid_veiculos) === String(veiculoId)
  );

  const nomeFrota = veiculoObj?.nome_frota || veiculoId;
  const placaVeiculo = veiculoObj?.placa || null;
  const uuidVeiculo = veiculoObj?.uuid_veiculos || null;

  // 1. Montagem das datas de início e fim no fuso local
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
    // DIAS
    dInicio = new Date(`${dtInicioStr}T00:00:00`);
    dFim = new Date(`${dtFimStr}T23:59:59`);
  }

  if (dFim <= dInicio) {
    alert("⚠️ A data/hora de término deve ser posterior ao início da reserva.");
    return;
  }

  const novoInicioTs = dInicio.getTime();
  const novoFimTs = dFim.getTime();

  // 2. Trava anti-sobreposição: consulta direto no Supabase em tempo real
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

    // Localiza se existe conflito cruzando Placa, Nome de Frota ou ID do Carro
    const reservaConflitante = (reservasAtivas || []).find(r => {
      // Ignora agendamentos cancelados ou concluídos
      if (r.status === 'CANCELADA' || r.status === 'CONCLUIDA') return false;

      // Confere se a reserva é do mesmo veículo
      const mesmoCarro = 
        (placaVeiculo && String(r.placa) === String(placaVeiculo)) ||
        (placaVeiculo && String(r.veiculo_id) === String(placaVeiculo)) ||
        String(r.veiculo_id) === String(nomeFrota) ||
        (uuidVeiculo && String(r.uuid_veiculos) === String(uuidVeiculo));

      if (!mesmoCarro) return false;

      // Verifica intersecção de período
      const rIni = new Date(r.data_inicio).getTime();
      const rFim = new Date(r.data_fim).getTime();

      return (novoInicioTs < rFim && novoFimTs > rIni);
    });

    if (reservaConflitante) {
      const dataIniFmt = new Date(reservaConflitante.data_inicio).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      const dataFimFmt = new Date(reservaConflitante.data_fim).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      alert(
        `⛔ CONFLITO DE AGENDAMENTO!\n\n` +
        `O veículo ${nomeFrota} já está reservado neste período.\n\n` +
        `👤 Reservado por: ${reservaConflitante.responsavel}\n` +
        `🎯 Finalidade: ${reservaConflitante.finalidade}\n` +
        `📅 Período: ${dataIniFmt} até ${dataFimFmt}\n\n` +
        `Por favor, escolha outro horário ou selecione outro veículo.`
      );

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="ph-bold ph-check text-base"></i> Confirmar Agendamento`;
      }
      return;
    }

    // 3. Gravação da nova reserva caso não haja choque de datas
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;

    const sessaoStr = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
    let emailUser = 'admin@arvo.tec.br';
    if (sessaoStr) {
      try { emailUser = JSON.parse(sessaoStr)?.email || sessaoStr; } catch { emailUser = sessaoStr; }
    }

    const novaReserva = {
      veiculo_id: nomeFrota,
      placa: placaVeiculo,
      uuid_veiculos: uuidVeiculo,
      responsavel: (usuarioLogado?.email || emailUser).toLowerCase().trim(),
      tipo_reserva: tipo,
      data_inicio: dInicio.toISOString(),
      data_fim: dFim.toISOString(),
      finalidade: document.getElementById('res-finalidade')?.value || 'DEMANDAS INTERNAS',
      observacao: (document.getElementById('res-obs')?.value || '').trim(),
      status: 'CONFIRMADA'
    };

    const { error: insErr } = await db.from('reservas').insert([novaReserva]);
    if (insErr) throw insErr;

    alert(`✅ Veículo ${nomeFrota} reservado com sucesso!`);
    e.target.reset();
    ajustarCamposModalidade('DIAS');
    await carregarReservas();

  } catch (err) {
    console.error("Erro ao processar reserva:", err);
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
  const ehDono = (usuarioLogado?.email || '').toLowerCase() === responsavel.toLowerCase();

  if (!ehAdmin && !ehDono) {
    alert("Você só pode cancelar reservas feitas por você mesmo.");
    return;
  }

  if (!confirm("Deseja realmente cancelar este agendamento?")) return;

  const emailUsuarioAtual = (usuarioLogado?.email || ADMIN_EMAIL).toLowerCase().trim();

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
    await carregarReservas();
  } catch (err) {
    alert("Erro ao cancelar reserva: " + err.message);
  }
}


// LÓGICA DINÂMICA COM CORES GARANTIDAS (CSS INLINE)
function obterStatusEAcaoReserva(r, veic, ehAdmin, ehDono) {
  const agora = new Date().getTime();
  const dtInicio = new Date(r.data_inicio).getTime();
  const dtFim = new Date(r.data_fim).getTime();

  const condutorReserva = (r.responsavel || '').toLowerCase().trim();
  const veicNome = String(veic?.nome_frota || r.veiculo_id || '').toUpperCase().trim();
  const veicPlaca = String(veic?.placa || r.placa || '').toUpperCase().trim();

  // Filtra rotas associadas a este veículo
  const rotasDoVeiculo = (typeof rotas !== 'undefined' ? rotas : []).filter(rt => {
    const vRota = String(rt.veiculo_id || '').toUpperCase().trim();
    const pRota = String(rt.placa || '').toUpperCase().trim();
    return (veicNome && (vRota === veicNome || pRota === veicNome)) ||
           (veicPlaca && (vRota === veicPlaca || pRota === veicPlaca));
  });

  // Botão Cancelar inspirado na pílula vermelha da referência
  const botaoCancelar = (ehAdmin || ehDono) ? `
    <button onclick="cancelarReserva(${r.id}, '${r.responsavel}')" 
      style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: #881337; color: #ffffff; border: 2px solid #fda4af; outline: 1px solid #4c0519; border-radius: 9999px; padding: 4px 10px; font-weight: 900; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.15); transition: all 0.2s;"
      onmouseover="this.style.background='#9f1239'; this.style.borderColor='#ffffff';"
      onmouseout="this.style.background='#881337'; this.style.borderColor='#fda4af';"
      title="Cancelar Agendamento">
      <i class="ph-bold ph-prohibit" style="font-size: 12px;"></i>
      <span>Cancelar</span>
    </button>
  ` : '';

  // 1. AGENDAMENTO FUTURO -> Âmbar / Dourado Refinado
  if (agora < dtInicio && r.status !== 'CONCLUIDA') {
    return `
      <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: nowrap;">
        <span style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: #b45309; color: #ffffff; border: 2px solid #fde68a; outline: 1px solid #78350f; border-radius: 9999px; padding: 4px 11px; font-weight: 900; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
          <i class="ph-bold ph-clock" style="font-size: 12px; color: #fef3c7;"></i>
          <span>Agendado</span>
        </span>
        ${botaoCancelar}
      </div>
    `;
  }

  // 2. DIA DA RESERVA / EM ANDAMENTO
  if (agora >= dtInicio && agora <= dtFim && r.status !== 'CONCLUIDA') {
    const rotaAberta = rotasDoVeiculo.find(rt => 
      rt.status === 'Em Uso' && 
      (rt.responsavel || '').toLowerCase().trim() === condutorReserva
    );

    if (rotaAberta) {
      // Em Rota -> Azul Elétrico / Safira
      return `
        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: nowrap;">
          <span style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: #1d4ed8; color: #ffffff; border: 2px solid #93c5fd; outline: 1px solid #1e3a8a; border-radius: 9999px; padding: 4px 11px; font-weight: 900; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
            <i class="ph-bold ph-steering-wheel" style="font-size: 12px; color: #bfdbfe;"></i>
            <span>Em Rota</span>
          </span>
          ${botaoCancelar}
        </div>
      `;
    } else {
      // Em Utilização (Dia da reserva) -> Verde Institucional
      return `
        <div style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: nowrap;">
          <span style="display: inline-flex; align-items: center; justify-content: center; gap: 5px; background: #065f46; color: #ffffff; border: 2px solid #6ee7b7; outline: 1px solid #064e3b; border-radius: 9999px; padding: 4px 11px; font-weight: 900; font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
            <i class="ph-bold ph-check" style="font-size: 12px; color: #a7f3d0;"></i>
            <span>Em Utilização</span>
          </span>
          ${botaoCancelar}
        </div>
      `;
    }
  }

  // 3. APÓS O PERÍODO -> KM rodados em texto limpo
  const rotasConcluidasNoPrazo = rotasDoVeiculo.filter(rt => {
    if (rt.status !== 'Concluida') return false;
    const tSaida = new Date(rt.data_saida || rt.created_at).getTime();
    return tSaida >= dtInicio && tSaida <= (dtFim + (4 * 60 * 60 * 1000));
  });

  const kmTotal = rotasConcluidasNoPrazo.reduce((acc, rt) => acc + (Number(rt.km_total) || 0), 0);

  if (kmTotal > 0) {
    return `<span style="font-family: monospace; font-size: 12px; font-weight: 700; color: #334155;">${kmTotal.toLocaleString('pt-BR')} km rodados</span>`;
  } else {
    return `<span style="font-family: monospace; font-size: 12px; color: #94a3b8;">0 km rodados</span>`;
  }
}

function renderizarTabelaReservas() {
  const tbody = document.getElementById('tabelaListaReservas');
  if (!tbody) return;
  tbody.innerHTML = '';

  const ehAdmin = (usuarioLogado?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();

  reservas.forEach(r => {
    const ehDono = (usuarioLogado?.email || '').toLowerCase() === (r.responsavel || '').toLowerCase();

    // Localiza o objeto veículo correspondente
    const veic = (veiculos || []).find(v => 
      String(v.placa) === String(r.veiculo_id) || 
      String(v.id) === String(r.veiculo_id) || 
      String(v.uuid_veiculos) === String(r.veiculo_id) ||
      String(v.nome_frota) === String(r.veiculo_id)
    );

    const nomeFrotaExibicao = veic?.nome_frota || r.veiculo_id || 'Veículo';
    const acoesRenderizadas = obterStatusEAcaoReserva(r, veic, ehAdmin, ehDono);

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50";
    tr.innerHTML = `
      <td class="py-3 px-3 font-extrabold text-slate-800">${nomeFrotaExibicao}</td>
      <td class="py-3 px-3 text-slate-600">${r.responsavel}</td>
      <td class="py-3 px-3 font-mono text-[11px] text-slate-500">
        ${new Date(r.data_inicio).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })} até 
        ${new Date(r.data_fim).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
      </td>
      <td class="py-3 px-3">
        <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">${r.finalidade}</span>
      </td>
      <td class="py-3 px-3 text-center">
        ${acoesRenderizadas}
      </td>
    `;
    tbody.appendChild(tr);
  });

  const badge = document.getElementById('badge-total-reservas');
  if (badge) badge.innerText = `${reservas.length} reservas`;
}

window.onload = init;