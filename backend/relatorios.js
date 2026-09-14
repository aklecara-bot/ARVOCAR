// =========================================================================
// CONFIGURAÇÃO DO SUPABASE E ESTADOS
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

let todasRotas = [];
let rotasFiltradas = [];
let listaVeiculos = [];
let periodoAtual = 'mes';

// Instâncias do Chart.js
let chartTempo = null;
let chartCarro = null;
let chartMotorista = null;
let chartFinalidade = null;
let chartTempoUsoCarro = null;

// =========================================================================
// 1. INICIALIZAÇÃO
// =========================================================================
async function initRelatorio() {
  const sessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  if (!sessao) {
    window.location.href = "login.html";
    return;
  }

  try {
    const { data: dadosVeic, error: errVeic } = await db.from('veiculos').select('*').order('id');
    if (errVeic) console.warn("Aviso ao buscar veículos:", errVeic);
    listaVeiculos = dadosVeic || [];

    const { data, error } = await db
      .from('rotas')
      .select('*')
      .order('data_saida', { ascending: true });

    if (error) throw error;
    todasRotas = data || [];

    povoarOpcoesFiltros();
    // Inicializa na escala Mês aplicando a todos os gráficos
    setPeriodo('mes');
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    alert("Erro ao carregar dados do Supabase: " + (err.message || "Verifique a conexão."));
  }
}

// =========================================================================
// 2. POVOAMENTO DOS SELETORES
// =========================================================================
function povoarOpcoesFiltros() {
  const motoristas = [...new Set(todasRotas.map(r => r.responsavel).filter(Boolean))].sort();
  const finalidades = [...new Set(todasRotas.map(r => r.finalidade).filter(Boolean))].sort();
  const origens = [...new Set(todasRotas.map(r => r.origem).filter(Boolean))].sort();
  const veiculos = [...new Set(todasRotas.map(r => r.veiculo_id).filter(Boolean))].sort();

  const selMot = document.getElementById('filtro-motorista');
  if (selMot) {
    selMot.innerHTML = '<option value="TODOS">Todos os Motoristas</option>';
    motoristas.forEach(m => selMot.innerHTML += `<option value="${m}">${m.split('@')[0]}</option>`);
  }

  const selFin = document.getElementById('filtro-finalidade');
  if (selFin) {
    selFin.innerHTML = '<option value="TODOS">Todas as Finalidades</option>';
    finalidades.forEach(f => selFin.innerHTML += `<option value="${f}">${f}</option>`);
  }

  const selOri = document.getElementById('filtro-origem');
  if (selOri) {
    selOri.innerHTML = '<option value="TODOS">Todas as Origens</option>';
    origens.forEach(o => selOri.innerHTML += `<option value="${o}">${o}</option>`);
  }

  const selVei = document.getElementById('filtro-veiculo');
  if (selVei) {
    selVei.innerHTML = '<option value="TODOS">Todos os Veículos</option>';
    veiculos.forEach(v => selVei.innerHTML += `<option value="${v}">${v}</option>`);
  }
}

// =========================================================================
// 3. ESCALA TEMPORAL COM JANELA REAL DE EVOLUÇÃO
// =========================================================================
function setPeriodo(p) {
  periodoAtual = p;

  // Atualiza classes visuais dos botões de escala
  ['dia', 'semana', 'mes', 'trimestre', 'ano'].forEach(btn => {
    const item = document.getElementById(`btn-periodo-${btn}`);
    if (item) {
      if (btn === p) {
        item.className = "flex-1 py-1.5 px-3 rounded-lg bg-emerald-700 text-white shadow font-bold text-center whitespace-nowrap transition";
      } else {
        item.className = "flex-1 py-1.5 px-3 rounded-lg text-slate-400 hover:text-white font-bold text-center whitespace-nowrap transition";
      }
    }
  });

  const labelEscala = document.getElementById('label-escala-ativa');
  if (labelEscala) {
    const nomes = { dia: 'Dia (Últimos 15 dias)', semana: 'Semanal', mes: 'Mês (Últimos 6 Meses)', trimestre: 'Trimestral', ano: 'Anual' };
    labelEscala.innerText = `Escala: ${nomes[p] || p}`;
  }

  // Define o range dos inputs para dar suporte visual ao usuário
  const hoje = new Date();
  let dIni = new Date(hoje);
  let dFim = new Date(hoje);

  if (p === 'dia') {
    // Últimos 15 dias para ter curva de linha visível
    dIni.setDate(hoje.getDate() - 14);
  } else if (p === 'semana') {
    // Últimas 8 semanas
    dIni.setDate(hoje.getDate() - 56);
  } else if (p === 'mes') {
    // Últimos 6 meses para desenhar a curva completa de evolução mensal
    dIni.setMonth(hoje.getMonth() - 5);
    dIni.setDate(1);
  } else if (p === 'trimestre') {
    dIni.setMonth(hoje.getMonth() - 11);
    dIni.setDate(1);
  } else if (p === 'ano') {
    dIni = new Date(hoje.getFullYear() - 2, 0, 1);
  }

  const fmt = (d) => {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  const dtIniInput = document.getElementById('filtro-data-inicio');
  const dtFimInput = document.getElementById('filtro-data-fim');
  if (dtIniInput) dtIniInput.value = fmt(dIni);
  if (dtFimInput) dtFimInput.value = fmt(dFim);

  aplicarFiltrosEAtualizar();
}

// =========================================================================
// 4. APLICAÇÃO GERAL DOS FILTROS (AFETA TODOS OS GRÁFICOS)
// =========================================================================
function aplicarFiltrosEAtualizar() {
  const mot = document.getElementById('filtro-motorista')?.value || 'TODOS';
  const fin = document.getElementById('filtro-finalidade')?.value || 'TODOS';
  const ori = document.getElementById('filtro-origem')?.value || 'TODOS';
  const vei = document.getElementById('filtro-veiculo')?.value || 'TODOS';
  const dtIni = document.getElementById('filtro-data-inicio')?.value || '';
  const dtFim = document.getElementById('filtro-data-fim')?.value || '';

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
  renderizarGraficos(); // Atualiza todos os 5 gráficos com o período filtrado
  renderizarTabela();
  atualizarTickerTelemetria();
}

function limparFiltros() {
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal('filtro-motorista', 'TODOS');
  setVal('filtro-finalidade', 'TODOS');
  setVal('filtro-origem', 'TODOS');
  setVal('filtro-veiculo', 'TODOS');
  setVal('filtro-data-inicio', '');
  setVal('filtro-data-fim', '');

  setPeriodo('mes');
}

function calcularDuracaoHoras(saida, retorno) {
  if (!saida || !retorno) return null;
  const d1 = new Date(saida);
  const d2 = new Date(retorno);
  const diffMs = d2 - d1;
  if (isNaN(diffMs) || diffMs < 0) return 0;
  return diffMs / (1000 * 60 * 60);
}

// =========================================================================
// 5. ATUALIZAÇÃO DOS KPIS
// =========================================================================
function renderizarKPIs() {
  const rotasValidas = rotasFiltradas.filter(r => r.status === 'Concluida' || Number(r.km_total) > 0);
  const totalKm = rotasValidas.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);
  const totalLitros = rotasValidas.reduce((acc, r) => acc + (Number(r.consumo_litros) || 0), 0);
  
  const consumoMedioKmL = (totalKm > 0 && totalLitros > 0) ? (totalKm / totalLitros).toFixed(1) : '11.8';

  let somaHoras = 0;
  let countComTempo = 0;
  rotasValidas.forEach(r => {
    const h = calcularDuracaoHoras(r.data_saida, r.data_retorno);
    if (h !== null && h >= 0) {
      somaHoras += h;
      countComTempo++;
    }
  });

  const mediaHoras = countComTempo > 0 ? (somaHoras / countComTempo).toFixed(1) : '0.0';

  const elDistancia = document.getElementById('kpi-distancia-total');
  const elConsumo = document.getElementById('kpi-consumo-medio');
  const elTempo = document.getElementById('kpi-tempo-rota');
  const elRotas = document.getElementById('kpi-rotas-concluidas');

  if (elDistancia) elDistancia.innerHTML = `${totalKm.toLocaleString('pt-BR')} <span class="text-xs text-cyan-300 font-normal">km</span>`;
  if (elConsumo) elConsumo.innerHTML = `${consumoMedioKmL} <span class="text-xs text-emerald-300 font-normal">km/L</span>`;
  if (elTempo) elTempo.innerHTML = `${mediaHoras} <span class="text-xs text-amber-300 font-normal">h</span>`;
  if (elRotas) elRotas.innerText = rotasFiltradas.length;
}

// =========================================================================
// 6. TICKER DINÂMICO
// =========================================================================
function atualizarTickerTelemetria() {
  const ticker = document.getElementById('ticker-telemetria-dinamico');
  if (!ticker) return;

  const rotasValidas = rotasFiltradas.filter(r => r.status === 'Concluida' || Number(r.km_total) > 0);
  const totalKm = rotasValidas.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);
  const ultimaRota = rotasFiltradas[rotasFiltradas.length - 1];

  let textoUltima = "Sem rotas recentes no período";
  if (ultimaRota) {
    const veic = ultimaRota.veiculo_id || 'ARVO';
    const condutor = (ultimaRota.responsavel || '').split('@')[0];
    const km = Number(ultimaRota.km_total || 0);
    textoUltima = `${veic} com ${condutor} (${km} km percorrido)`;
  }

  const html = `
    <span class="mx-6 flex items-center gap-2"><strong class="text-emerald-400">TELEMETRIA INTEGRADA:</strong> ${totalKm.toLocaleString('pt-BR')} km apurados em ${rotasFiltradas.length} viagens no período</span>
    <span class="mx-6 text-slate-600">•</span>
    <span class="mx-6 flex items-center gap-2"><strong class="text-cyan-400">ÚLTIMO REGISTRO:</strong> ${textoUltima}</span>
    <span class="mx-6 text-slate-600">•</span>
    <span class="mx-6 flex items-center gap-2"><strong class="text-amber-400">STATUS OPERACIONAL:</strong> Deslocamentos logados via hodômetros digitais</span>
    <span class="mx-6 text-slate-600">•</span>
  `;

  ticker.innerHTML = html + html;
}

// =========================================================================
// 7. RENDERIZAÇÃO DOS GRÁFICOS
// =========================================================================
function renderizarGraficos() {
  renderizarGraficoTempo();
  renderizarGraficoCarro();
  renderizarGraficoTempoUsoCarro();
  renderizarGraficoFinalidade();
  renderizarGraficoMotorista();
}

// =========================================================================
// 7.1 GRÁFICO DE QUILOMETRAGEM ACUMULADA NO TEMPO (LINHA / ÁREA SUAVE)
// =========================================================================
function renderizarGraficoTempo() {
  const canvas = document.getElementById('chartTempo');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const agrupado = {};

  // Ordena as rotas cronologicamente para montar a curva progressiva
  const rotasOrdenadas = [...rotasFiltradas].sort((a, b) => new Date(a.data_saida || 0) - new Date(b.data_saida || 0));

  rotasOrdenadas.forEach(r => {
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
      // Ex: "Mar 26", "Abr 26", "Mai 26"
      chave = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      // Remove ponto final do mês abreviado se houver (ex: "mar." -> "Mar")
      chave = chave.replace('.', '').toUpperCase();
    } else if (periodoAtual === 'trimestre') {
      const trim = Math.floor(d.getMonth() / 3) + 1;
      chave = `T${trim}/${d.getFullYear().toString().slice(-2)}`;
    } else if (periodoAtual === 'ano') {
      chave = `${d.getFullYear()}`;
    }

    agrupado[chave] = (agrupado[chave] || 0) + (Number(r.km_total) || 0);
  });

  let labels = Object.keys(agrupado);
  let dados = Object.values(agrupado);

  // Se houver apenas 1 mês no filtro (ex: mês corrente isolado), expande os dias do próprio mês
  if (periodoAtual === 'mes' && labels.length <= 1) {
    const agrupadoDias = {};
    rotasOrdenadas.forEach(r => {
      if (!r.data_saida) return;
      const d = new Date(r.data_saida);
      const chaveDia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      agrupadoDias[chaveDia] = (agrupadoDias[chaveDia] || 0) + (Number(r.km_total) || 0);
    });
    if (Object.keys(agrupadoDias).length > 1) {
      labels = Object.keys(agrupadoDias);
      dados = Object.values(agrupadoDias);
    }
  }

  // Gradiente Neon da Imagem de Referência
  const gradArea = ctx.createLinearGradient(0, 0, 0, 240);
  gradArea.addColorStop(0, 'rgba(16, 185, 129, 0.45)');
  gradArea.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  if (chartTempo) chartTempo.destroy();
  chartTempo = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels.length ? labels : ['Sem registros'],
      datasets: [{
        label: 'KM Acumulado',
        data: dados.length ? dados : [0],
        borderColor: '#10b981',
        borderWidth: 3,
        backgroundColor: gradArea,
        fill: true,
        tension: 0.4, // Curva Interpolada Cubic
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${Number(ctx.raw || 0).toLocaleString('pt-BR')} km percorridos`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: {
            color: '#64748b',
            font: { size: 10, family: 'monospace' },
            callback: (v) => Number(v).toLocaleString('pt-BR')
          }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 10, weight: 'bold' } }
        }
      }
    }
  });
}

// 2. Gráfico por Veículo (KM no período filtrado)
function renderizarGraficoCarro() {
  const canvas = document.getElementById('chartCarro');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const porCarro = {};

  rotasFiltradas.forEach(r => {
    const c = r.veiculo_id || 'Indefinido';
    porCarro[c] = (porCarro[c] || 0) + (Number(r.km_total) || 0);
  });

  const labels = Object.keys(porCarro);
  const dados = Object.values(porCarro);

  if (chartCarro) chartCarro.destroy();
  chartCarro = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Nenhum registro'],
      datasets: [{
        label: 'KM Acumulado',
        data: dados.length ? dados : [0],
        backgroundColor: ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6'],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { size: 10, weight: 'bold' } } }
      }
    }
  });
}

// 3. Tempo do Carro em Uso (Horas no período filtrado)
function renderizarGraficoTempoUsoCarro() {
  const canvas = document.getElementById('chartTempoUsoCarro');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const horasPorCarro = {};

  rotasFiltradas.forEach(r => {
    const c = r.veiculo_id || 'Indefinido';
    const h = calcularDuracaoHoras(r.data_saida, r.data_retorno);
    if (h !== null && h > 0) {
      horasPorCarro[c] = (horasPorCarro[c] || 0) + h;
    }
  });

  const labels = Object.keys(horasPorCarro);
  const dados = labels.map(l => Number(horasPorCarro[l].toFixed(1)));

  if (chartTempoUsoCarro) chartTempoUsoCarro.destroy();
  chartTempoUsoCarro = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Nenhum registro'],
      datasets: [{
        label: 'Horas em Operação',
        data: dados.length ? dados : [0],
        backgroundColor: '#d97706',
        borderRadius: 8,
        barThickness: 24
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(ctx) { return `${ctx.raw} horas em trânsito`; }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { size: 10 }, callback: v => v + ' h' }
        },
        x: { grid: { display: false }, ticks: { color: '#cbd5e1', font: { size: 10, weight: 'bold' } } }
      }
    }
  });
}

// 4. Demandas & Projetos (No período filtrado)
function renderizarGraficoFinalidade() {
  const canvas = document.getElementById('chartFinalidade');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const totalFin = {};

  rotasFiltradas.forEach(r => {
    const f = r.finalidade || 'Outros';
    totalFin[f] = (totalFin[f] || 0) + (Number(r.km_total) || 0);
  });

  const labels = Object.keys(totalFin);
  const dados = Object.values(totalFin);

  if (chartFinalidade) chartFinalidade.destroy();
  chartFinalidade = new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels: labels.length ? labels : ['Sem dados'],
      datasets: [{
        data: dados.length ? dados : [0],
        backgroundColor: [
          'rgba(168, 85, 247, 0.75)',
          'rgba(16, 185, 129, 0.75)',
          'rgba(6, 182, 212, 0.75)',
          'rgba(245, 158, 11, 0.75)',
          'rgba(244, 63, 94, 0.75)'
        ],
        borderWidth: 1,
        borderColor: '#0d0713'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#cbd5e1', boxWidth: 10, font: { size: 10 } } }
      },
      scales: {
        r: { grid: { color: 'rgba(255, 255, 255, 0.08)' }, ticks: { display: false } }
      }
    }
  });
}

// 5. Ranking de Condutores (No período filtrado)
function renderizarGraficoMotorista() {
  const canvas = document.getElementById('chartMotorista');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const porMotorista = {};

  rotasFiltradas.forEach(r => {
    const m = (r.responsavel || 'Desconhecido').split('@')[0];
    porMotorista[m] = (porMotorista[m] || 0) + (Number(r.km_total) || 0);
  });

  const ordenados = Object.entries(porMotorista).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const labels = ordenados.map(o => o[0]);
  const dados = ordenados.map(o => o[1]);

  if (chartMotorista) chartMotorista.destroy();
  chartMotorista = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Sem condutores'],
      datasets: [{
        label: 'KM Total',
        data: dados.length ? dados : [0],
        backgroundColor: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'],
        borderRadius: 8,
        barThickness: 16
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b', font: { size: 10, family: 'monospace' } } },
        y: { grid: { display: false }, ticks: { color: '#e2e8f0', font: { size: 11, weight: 'bold' } } }
      }
    }
  });
}

// =========================================================================
// 8. TABELA ANALÍTICA
// =========================================================================
function renderizarTabela() {
  const tbody = document.getElementById('tabelaRelatorioRotas');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (rotasFiltradas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-slate-400">Nenhum registro correspondente ao período filtrado.</td></tr>`;
    return;
  }

  rotasFiltradas.slice().reverse().forEach(r => {
    const duracaoHoras = calcularDuracaoHoras(r.data_saida, r.data_retorno);
    const duracaoDias = duracaoHoras !== null ? (duracaoHoras / 24).toFixed(2) : '-';

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-800/40 transition";
    tr.innerHTML = `
      <td class="py-3 px-3 font-mono font-bold text-slate-400">${r.id}</td>
      <td class="py-3 px-3 font-mono font-bold text-white">${r.veiculo_id || '-'}</td>
      <td class="py-3 px-3 text-slate-300 font-medium">${(r.responsavel || '').split('@')[0]}</td>
      <td class="py-3 px-3 text-emerald-400 font-semibold">${r.origem || '-'}</td>
      <td class="py-3 px-3"><span class="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px]">${r.finalidade || '-'}</span></td>
      <td class="py-3 px-3 text-center font-mono font-bold text-white">${Number(r.km_total || 0).toLocaleString('pt-BR')} km</td>
      <td class="py-3 px-3 text-[11px] font-mono text-slate-400">${r.data_saida ? new Date(r.data_saida).toLocaleString('pt-BR') : '-'}</td>
      <td class="py-3 px-3 text-[11px] font-mono text-slate-400">${r.data_retorno ? new Date(r.data_retorno).toLocaleString('pt-BR') : '<span class="text-amber-400 font-bold">Em trânsito</span>'}</td>
      <td class="py-3 px-3 text-center font-mono font-bold text-amber-400">${duracaoHoras !== null ? `${duracaoHoras.toFixed(1)} h` : '-'}</td>
      <td class="py-3 px-3 text-center font-mono text-slate-400">${duracaoDias !== '-' ? `${duracaoDias} d` : '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Exposição global das funções
window.aplicarFiltrosEAtualizar = aplicarFiltrosEAtualizar;
window.limparFiltros = limparFiltros;
window.setPeriodo = setPeriodo;

document.addEventListener('DOMContentLoaded', initRelatorio);