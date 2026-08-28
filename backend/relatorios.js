
    const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

    const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let todasRotas = [];
    let rotasFiltradas = [];
    let periodoAtual = 'mes';

    let chartTempo = null;
    let chartCarro = null;
    let chartMotorista = null;
    let chartFinalidade = null;
    let chartDuracao = null;

    async function initRelatorio() {
      const sessao = localStorage.getItem('arvo_usuario_logado');
      if (!sessao) {
        window.location.href = "login.html";
        return;
      }

      try {
        const { data, error } = await db
          .from('rotas')
          .select('*')
          .order('data_saida', { ascending: true });

        if (error) throw error;
        todasRotas = data || [];

        povoarOpcoesFiltros();
        aplicarFiltrosEAtualizar();
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        alert("Erro ao carregar dados do Supabase.");
      }
    }

    // Povoa os selects dinamicamente com dados existentes no banco
    function povoarOpcoesFiltros() {
      const motoristas = [...new Set(todasRotas.map(r => r.responsavel).filter(Boolean))].sort();
      const finalidades = [...new Set(todasRotas.map(r => r.finalidade).filter(Boolean))].sort();
      const origens = [...new Set(todasRotas.map(r => r.origem).filter(Boolean))].sort();
      const veiculos = [...new Set(todasRotas.map(r => r.veiculo_id).filter(Boolean))].sort();

      const selMot = document.getElementById('filtro-motorista');
      motoristas.forEach(m => selMot.innerHTML += `<option value="${m}">${m}</option>`);

      const selFin = document.getElementById('filtro-finalidade');
      finalidades.forEach(f => selFin.innerHTML += `<option value="${f}">${f}</option>`);

      const selOri = document.getElementById('filtro-origem');
      origens.forEach(o => selOri.innerHTML += `<option value="${o}">${o}</option>`);

      const selVei = document.getElementById('filtro-veiculo');
      veiculos.forEach(v => selVei.innerHTML += `<option value="${v}">${v}</option>`);
    }

    // Aplicação simultânea de todos os filtros
    function aplicarFiltrosEAtualizar() {
      const mot = document.getElementById('filtro-motorista').value;
      const fin = document.getElementById('filtro-finalidade').value;
      const ori = document.getElementById('filtro-origem').value;
      const vei = document.getElementById('filtro-veiculo').value;
      const dtIni = document.getElementById('filtro-data-inicio').value;
      const dtFim = document.getElementById('filtro-data-fim').value;

      rotasFiltradas = todasRotas.filter(r => {
        if (mot !== 'TODOS' && r.responsavel !== mot) return false;
        if (fin !== 'TODOS' && r.finalidade !== fin) return false;
        if (ori !== 'TODOS' && r.origem !== ori) return false;
        if (vei !== 'TODOS' && r.veiculo_id !== vei) return false;

        if (dtIni && r.data_saida) {
          const dSaida = new Date(r.data_saida);
          const dFiltroIni = new Date(`${dtIni}T00:00:00`);
          if (dSaida < dFiltroIni) return false;
        }

        if (dtFim && r.data_saida) {
          const dSaida = new Date(r.data_saida);
          const dFiltroFim = new Date(`${dtFim}T23:59:59`);
          if (dSaida > dFiltroFim) return false;
        }

        return true;
      });

      renderizarKPIs();
      renderizarGraficos();
      renderizarTabela();
    }

    function limparFiltros() {
      document.getElementById('filtro-motorista').value = 'TODOS';
      document.getElementById('filtro-finalidade').value = 'TODOS';
      document.getElementById('filtro-origem').value = 'TODOS';
      document.getElementById('filtro-veiculo').value = 'TODOS';
      document.getElementById('filtro-data-inicio').value = '';
      document.getElementById('filtro-data-fim').value = '';
      setPeriodo('mes');
      aplicarFiltrosEAtualizar();
    }

    function setPeriodo(p) {
      periodoAtual = p;
      ['dia', 'semana', 'mes', 'trimestre', 'ano'].forEach(btn => {
        const item = document.getElementById(`btn-periodo-${btn}`);
        if (item) {
          if (btn === p) {
            item.className = "flex-1 py-1.5 rounded-lg bg-brand-700 text-white shadow transition text-center";
          } else {
            item.className = "flex-1 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition text-center";
          }
        }
      });
      renderizarGraficoEvolucao();
    }

    function calcularDuracaoHoras(saida, retorno) {
      if (!saida || !retorno) return null;
      const d1 = new Date(saida);
      const d2 = new Date(retorno);
      const diffMs = d2 - d1;
      if (isNaN(diffMs) || diffMs < 0) return 0;
      return diffMs / (1000 * 60 * 60);
    }

    function renderizarKPIs() {
      const rotasValidas = rotasFiltradas.filter(r => r.status === 'Concluida' || Number(r.km_total) > 0);
      const totalKm = rotasValidas.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);
      const mediaKm = rotasValidas.length > 0 ? (totalKm / rotasValidas.length).toFixed(1) : 0;

      let somaHoras = 0;
      let countComTempo = 0;
      rotasValidas.forEach(r => {
        const h = calcularDuracaoHoras(r.data_saida, r.data_retorno);
        if (h !== null && h >= 0) {
          somaHoras += h;
          countComTempo++;
        }
      });

      const mediaHoras = countComTempo > 0 ? (somaHoras / countComTempo).toFixed(1) : 0;
      const mediaDias = (mediaHoras / 24).toFixed(2);

      document.getElementById('kpi-km-total').innerText = `${totalKm.toLocaleString('pt-BR')} km`;
      document.getElementById('kpi-km-medio').innerText = `${mediaKm} km`;
      document.getElementById('kpi-tempo-medio').innerText = `${mediaHoras}h`;
      document.getElementById('kpi-tempo-dias').innerText = `~${mediaDias} dias por rota`;
      document.getElementById('kpi-qtd-rotas').innerText = rotasFiltradas.length;
      document.getElementById('badge-total-filtradas').innerText = `${rotasFiltradas.length} rotas`;
    }

    function renderizarGraficos() {
      renderizarGraficoEvolucao();
      renderizarGraficoCarro();
      renderizarGraficoMotorista();
      renderizarGraficoFinalidade();
      renderizarGraficoDuracao();
    }

    // 1. Gráfico de Evolução (Dia / Semana / Mês / Trimestre / Ano)
    function renderizarGraficoEvolucao() {
      const ctx = document.getElementById('chartEvolucaoKm').getContext('2d');
      const agrupado = {};

      rotasFiltradas.forEach(r => {
        if (!r.data_saida) return;
        const d = new Date(r.data_saida);
        let chave = '';

        if (periodoAtual === 'dia') {
          chave = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        } else if (periodoAtual === 'semana') {
          const primeiroDia = new Date(d.getTime());
           primeiroDia.setDate(primeiroDia.getDate() - primeiroDia.getDay());
           chave = `Sem ${primeiroDia.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
        } else if (periodoAtual === 'mes') {
          chave = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        } else if (periodoAtual === 'trimestre') {
          const trim = Math.floor((d.getMonth() + 3) / 3);
          chave = `T${trim}/${d.getFullYear().toString().slice(-2)}`;
        } else if (periodoAtual === 'ano') {
          chave = `${d.getFullYear()}`;
        }

        agrupado[chave] = (agrupado[chave] || 0) + (Number(r.km_total) || 0);
      });

      if (chartTempo) chartTempo.destroy();
      chartTempo = new Chart(ctx, {
        type: 'line',
        data: {
          labels: Object.keys(agrupado),
          datasets: [{
            label: 'KM Percorrido',
            data: Object.values(agrupado),
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22, 163, 74, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#15803d'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 2. Gráfico por Veículo
    function renderizarGraficoCarro() {
      const ctx = document.getElementById('chartKmPorCarro').getContext('2d');
      const porCarro = {};

      rotasFiltradas.forEach(r => {
        const c = r.veiculo_id || 'Indefinido';
        porCarro[c] = (porCarro[c] || 0) + (Number(r.km_total) || 0);
      });

      if (chartCarro) chartCarro.destroy();
      chartCarro = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(porCarro),
          datasets: [{
            label: 'KM Acumulado',
            data: Object.values(porCarro),
            backgroundColor: '#0284c7',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // 3. Gráfico por Motorista
    function renderizarGraficoMotorista() {
      const ctx = document.getElementById('chartKmPorMotorista').getContext('2d');
      const porMotorista = {};

      rotasFiltradas.forEach(r => {
        const m = (r.responsavel || 'Desconhecido').split('@')[0];
        porMotorista[m] = (porMotorista[m] || 0) + (Number(r.km_total) || 0);
      });

      if (chartMotorista) chartMotorista.destroy();
      chartMotorista = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(porMotorista),
          datasets: [{
            label: 'KM Total',
            data: Object.values(porMotorista),
            backgroundColor: '#8b5cf6',
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, grid: { color: '#f1f5f9' } },
            y: { grid: { display: false } }
          }
        }
      });
    }

    // 4. Média de KM por Finalidade
    function renderizarGraficoFinalidade() {
      const ctx = document.getElementById('chartMediaPorFinalidade').getContext('2d');
      const totalFin = {};
      const countFin = {};

      rotasFiltradas.forEach(r => {
        const f = r.finalidade || 'Outros';
        const km = Number(r.km_total) || 0;
        totalFin[f] = (totalFin[f] || 0) + km;
        countFin[f] = (countFin[f] || 0) + 1;
      });

      const labels = Object.keys(totalFin);
      const medias = labels.map(f => (totalFin[f] / countFin[f]).toFixed(1));

      if (chartFinalidade) chartFinalidade.destroy();
      chartFinalidade = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: medias,
            backgroundColor: ['#16a34a', '#0284c7', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
          }
        }
      });
    }

    // 5. Duração das Rotas (Horas)
    function renderizarGraficoDuracao() {
      const ctx = document.getElementById('chartDuracaoRotas').getContext('2d');
      const ultimas = rotasFiltradas.slice(-15);
      const labels = [];
      const horas = [];

      ultimas.forEach(r => {
        const h = calcularDuracaoHoras(r.data_saida, r.data_retorno);
        labels.push(`${r.id} (${r.veiculo_id})`);
        horas.push(h !== null ? Number(h.toFixed(1)) : 0);
      });

      if (chartDuracao) chartDuracao.destroy();
      chartDuracao = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Duração em Horas',
            data: horas,
            backgroundColor: '#f59e0b',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Horas' }, grid: { color: '#f1f5f9' } },
            x: { grid: { display: false } }
          }
        }
      });
    }

    // Tabela Analítica
    function renderizarTabela() {
      const tbody = document.getElementById('tabelaRelatorioRotas');
      tbody.innerHTML = '';

      rotasFiltradas.slice().reverse().forEach(r => {
        const duracaoHoras = calcularDuracaoHoras(r.data_saida, r.data_retorno);
        const duracaoDias = duracaoHoras !== null ? (duracaoHoras / 24).toFixed(2) : '-';

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50";
        tr.innerHTML = `
          <td class="py-3 px-4 font-mono font-bold text-slate-800">${r.id}</td>
          <td class="py-3 px-4 font-extrabold text-slate-700">${r.veiculo_id}</td>
          <td class="py-3 px-4 text-slate-600">${r.responsavel}</td>
          <td class="py-3 px-4 font-medium text-slate-700">${r.origem || '-'}</td>
          <td class="py-3 px-4 font-medium text-slate-800">${r.finalidade || '-'}</td>
          <td class="py-3 px-4 text-center font-mono font-bold text-brand-700">${Number(r.km_total || 0).toLocaleString('pt-BR')} km</td>
          <td class="py-3 px-4 text-[11px] font-mono text-slate-500">${r.data_saida ? new Date(r.data_saida).toLocaleString('pt-BR') : '-'}</td>
          <td class="py-3 px-4 text-[11px] font-mono text-slate-500">${r.data_retorno ? new Date(r.data_retorno).toLocaleString('pt-BR') : '<span class="text-amber-600 font-bold">Em trânsito</span>'}</td>
          <td class="py-3 px-4 text-center font-mono font-bold text-amber-600">${duracaoHoras !== null ? `${duracaoHoras.toFixed(1)} h` : '-'}</td>
          <td class="py-3 px-4 text-center font-mono text-slate-500">${duracaoDias !== '-' ? `${duracaoDias} d` : '-'}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    window.onload = initRelatorio;