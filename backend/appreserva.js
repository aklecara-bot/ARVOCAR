 const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";
    const ADMIN_EMAIL = "admin@arvo.tec.br";

    const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let usuarioLogado = null;
    let veiculos = [];
    let reservas = [];
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
      document.getElementById('res-data-inicio').value = hojeStr;
      document.getElementById('res-data-fim').value = hojeStr;

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

    async function carregarReservas() {
      const { data } = await db.from('reservas').select('*').eq('status', 'CONFIRMADA').order('data_inicio', { ascending: true });
      reservas = data || [];
      renderizarTabelaReservas();
      if (calendar) {
        calendar.refetchEvents();
      }
    }

    function initCalendario() {
  const calendarEl = document.getElementById('calendar');
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

      boxHoras.classList.add('hidden');
      boxTurno.classList.add('hidden');
      boxDataFim.classList.remove('hidden');

      if (tipo === 'HORAS') {
        boxHoras.classList.remove('hidden');
      } else if (tipo === 'TURNO') {
        boxTurno.classList.remove('hidden');
      }
    }

    async function handleSalvarReserva(e) {
      e.preventDefault();
      const btn = document.getElementById('btn-salvar-reserva');
      const veiculoId = document.getElementById('res-veiculo').value;
      const tipo = document.getElementById('res-tipo').value;
      const dtInicioStr = document.getElementById('res-data-inicio').value;
      let dtFimStr = document.getElementById('res-data-fim').value;

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
        alert("Erro: A data/hora final deve ser posterior ao início.");
        return;
      }

      // Verificação de conflito de agenda no banco
      const conflito = reservas.some(r => {
        if (r.veiculo_id !== veiculoId) return false;
        const rIni = new Date(r.data_inicio);
        const rFim = new Date(r.data_fim);
        return (dInicio < rFim && dFim > rIni);
      });

      if (conflito) {
        alert(`❌ Conflito: O veículo ${veiculoId} já possui agendamento confirmado neste período! Escolha outro horário ou outro carro.`);
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;

      const novaReserva = {
        veiculo_id: veiculoId,
        responsavel: usuarioLogado.email,
        tipo_reserva: tipo,
        data_inicio: dInicio.toISOString(),
        data_fim: dFim.toISOString(),
        finalidade: document.getElementById('res-finalidade').value,
        observacao: document.getElementById('res-obs').value.trim(),
        status: 'CONFIRMADA'
      };

      try {
        const { error } = await db.from('reservas').insert([novaReserva]);
        if (error) throw error;

        alert(`✅ Veículo ${veiculoId} reservado com sucesso!`);
        e.target.reset();
        ajustarCamposModalidade('DIAS');
        await carregarReservas();
      } catch (err) {
        alert("Erro ao gravar reserva: " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="ph-bold ph-check"></i> Confirmar Agendamento`;
      }
    }

    async function cancelarReserva(reservaId, responsavel) {
      const ehAdmin = usuarioLogado.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const ehDono = usuarioLogado.email.toLowerCase() === responsavel.toLowerCase();

      if (!ehAdmin && !ehDono) {
        alert("Você só pode cancelar reservas feitas por você mesmo.");
        return;
      }

      if (confirm(`Deseja cancelar esta reserva do veículo?`)) {
        const { error } = await db.from('reservas').update({ status: 'CANCELADA' }).eq('id', reservaId);
        if (error) {
          alert("Erro ao cancelar: " + error.message);
        } else {
          alert("Reserva cancelada com sucesso!");
          await carregarReservas();
        }
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
        ${(ehAdmin || ehDono) ? `
          <button onclick="cancelarReserva(${r.id}, '${r.responsavel}')" class="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto" title="Cancelar Agendamento">
            <i class="ph-bold ph-x-circle text-sm"></i> Cancelar
          </button>
        ` : '<span class="text-slate-300">-</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });

  const badge = document.getElementById('badge-total-reservas');
  if (badge) badge.innerText = `${reservas.length} reservas`;
}

    window.onload = init;
