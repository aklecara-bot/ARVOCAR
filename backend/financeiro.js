// =========================================================================
// MÓDULO FINANCEIRO INTEGRADO - ARVOCAR (COM GRÁFICOS 100% REATIVOS, MODAL DE CUPOM E TIPO DE FROTA REAL)
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

let dadosBrutosAbastecimentos = [];
let dadosBrutosRotas = [];
let dadosBrutosVeiculos = [];
let dadosBrutosManutencoes = [];
let dadosBrutosContratosAluguel = [];
let cacheListaVeiculos = [];
let periodoAtual = 'mes';

// Instâncias Globais do Chart.js
let chartBarras = null;
let chartDonut = null;
let chartEvolucao = null;
let chartCustoKm = null;
let chartComposicao = null;

document.addEventListener('DOMContentLoaded', async () => {
  const sessaoStr = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  if (!sessaoStr) {
    window.location.href = 'login.html';
    return;
  }
  await carregarMetricasFinanceiras();
});

function logout() {
  localStorage.removeItem('arvo_usuario_logado');
  localStorage.removeItem('arvo_mobile_user');
  window.location.href = 'login.html';
}

// =========================================================================
// 1. CARREGAMENTO CENTRALIZADO DO BANCO
// =========================================================================
async function carregarMetricasFinanceiras() {
  try {
    const [resAbast, resRotas, resVeiculos, resManut, resContratos] = await Promise.all([
      db.from('abastecimentos').select('*').order('data_hora', { ascending: false }),
      db.from('rotas').select('*').eq('status', 'Concluida').order('data_retorno', { ascending: false }),
      db.from('veiculos').select('*'),
      db.from('manutencoes_preventivas').select('*').order('data_ultima_troca', { ascending: false }),
      db.from('contratos_aluguel').select('*')
    ]);

    if (resAbast.error) throw resAbast.error;
    if (resRotas.error) throw resRotas.error;
    if (resVeiculos.error) throw resVeiculos.error;
    if (resManut.error) throw resManut.error;

    dadosBrutosAbastecimentos = resAbast.data || [];
    dadosBrutosRotas = resRotas.data || [];
    dadosBrutosVeiculos = resVeiculos.data || [];
    dadosBrutosManutencoes = resManut.data || [];
    dadosBrutosContratosAluguel = resContratos.data || [];
    cacheListaVeiculos = dadosBrutosVeiculos;

    povoarOpcoesFiltrosDinamicos();
    popularSelectsFormulariosFinanceiros(cacheListaVeiculos);
    setPeriodoFinanceiro('mes');
  } catch (err) {
    console.error("Erro ao carregar dados financeiros:", err);
    alert("Falha ao carregar dados: " + (err.message || 'Verifique sua conexão.'));
  }
}

// =========================================================================
// 2. POVOAMENTO DOS SELETORES
// =========================================================================
function povoarOpcoesFiltrosDinamicos() {
  const motoristasSet = new Set();
  dadosBrutosRotas.forEach(r => { if (r.responsavel) motoristasSet.add(r.responsavel.trim().toLowerCase()); });
  dadosBrutosAbastecimentos.forEach(a => { if (a.responsavel) motoristasSet.add(a.responsavel.trim().toLowerCase()); });

  const motoristas = [...motoristasSet].sort();
  const selMot = document.getElementById('filtro-motorista');
  if (selMot) {
    selMot.innerHTML = '<option value="TODOS">Todos os Motoristas</option>';
    motoristas.forEach(m => {
      const rotulo = m.includes('@') ? m.split('@')[0] : m;
      selMot.innerHTML += `<option value="${m}">${rotulo}</option>`;
    });
  }

  const finalidadesSet = new Set();
  dadosBrutosRotas.forEach(r => { if (r.finalidade) finalidadesSet.add(r.finalidade.trim().toUpperCase()); });
  ['DEMANDAS INTERNAS', 'RELAÇÕES INSTITUCIONAIS', 'REMINERALIZADOR', 'PSA GESTÁGUA', 'PPC'].forEach(f => finalidadesSet.add(f));

  const finalidades = [...finalidadesSet].sort();
  const selFin = document.getElementById('filtro-finalidade');
  if (selFin) {
    selFin.innerHTML = '<option value="TODOS">Todas as Finalidades</option>';
    finalidades.forEach(f => {
      selFin.innerHTML += `<option value="${f}">${f}</option>`;
    });
  }
}

// =========================================================================
// 3. CONTROLE DE PERÍODO E DATAS
// =========================================================================
function setPeriodoFinanceiro(p) {
  periodoAtual = p;
  ['dia', 'semana', 'mes', 'trimestre', 'ano', 'todos'].forEach(btn => {
    const item = document.getElementById(`btn-periodo-${btn}`);
    if (item) {
      item.className = (btn === p)
        ? "flex-1 py-1.5 px-3 rounded-lg bg-[#395237] text-[#f4f1e5] shadow transition text-center whitespace-nowrap border border-[#556b2f]/50"
        : "flex-1 py-1.5 px-3 rounded-lg text-[#b0b9ab] hover:text-[#f4f1e5] transition text-center whitespace-nowrap";
    }
  });

  const hoje = new Date();
  const dtIniInput = document.getElementById('filtro-data-inicio');
  const dtFimInput = document.getElementById('filtro-data-fim');

  if (p === 'todos') {
    if (dtIniInput) dtIniInput.value = '';
    if (dtFimInput) dtFimInput.value = '';
    aplicarFiltrosEAtualizarFinanceiro();
    return;
  }

  let dIni = new Date(hoje);
  let dFim = new Date(hoje);

  if (p === 'dia') {
    // Hoje
  } else if (p === 'semana') {
    dIni.setDate(hoje.getDate() - hoje.getDay());
  } else if (p === 'mes') {
    dIni = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  } else if (p === 'trimestre') {
    const mIni = Math.floor(hoje.getMonth() / 3) * 3;
    dIni = new Date(hoje.getFullYear(), mIni, 1);
  } else if (p === 'ano') {
    dIni = new Date(hoje.getFullYear(), 0, 1);
  }

  const fmt = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (dtIniInput) dtIniInput.value = fmt(dIni);
  if (dtFimInput) dtFimInput.value = fmt(dFim);

  aplicarFiltrosEAtualizarFinanceiro();
}

function aplicarFiltroPersonalizadoDatas() {
  ['dia', 'semana', 'mes', 'trimestre', 'ano', 'todos'].forEach(btn => {
    const item = document.getElementById(`btn-periodo-${btn}`);
    if (item) item.className = "flex-1 py-1.5 px-3 rounded-lg text-[#b0b9ab] hover:text-[#f4f1e5] transition text-center whitespace-nowrap";
  });
  periodoAtual = 'custom';
  aplicarFiltrosEAtualizarFinanceiro();
}

function limparFiltrosFinanceiro() {
  const dtIni = document.getElementById('filtro-data-inicio');
  const dtFim = document.getElementById('filtro-data-fim');
  const tipoC = document.getElementById('filtro-tipo-custo');
  const selMot = document.getElementById('filtro-motorista');
  const selFin = document.getElementById('filtro-finalidade');
  const selStatus = document.getElementById('filtro-status-carro');

  if (dtIni) dtIni.value = '';
  if (dtFim) dtFim.value = '';
  if (tipoC) tipoC.value = 'TODOS';
  if (selMot) selMot.value = 'TODOS';
  if (selFin) selFin.value = 'TODOS';
  if (selStatus) selStatus.value = 'ATIVOS';

  setPeriodoFinanceiro('mes');
}

function obterDiasDoIntervalo(dIni, dFim) {
  if (!dIni || !dFim) return 30;
  const ms = dFim.getTime() - dIni.getTime();
  const dias = Math.ceil(ms / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, dias);
}

function limparPlaca(p) {
  return String(p || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().trim();
}

// =========================================================================
// 4. APLICAÇÃO GERAL DOS FILTROS E VÍNCULOS
// =========================================================================
function aplicarFiltrosEAtualizarFinanceiro() {
  const dtIni = document.getElementById('filtro-data-inicio')?.value;
  const dtFim = document.getElementById('filtro-data-fim')?.value;
  const tipoCusto = document.getElementById('filtro-tipo-custo')?.value || 'TODOS';
  const filtroMotorista = (document.getElementById('filtro-motorista')?.value || 'TODOS').toLowerCase().trim();
  const filtroFinalidade = (document.getElementById('filtro-finalidade')?.value || 'TODOS').toUpperCase().trim();
  const filtroStatusCarro = document.getElementById('filtro-status-carro')?.value || 'ATIVOS';

  const dFiltroIni = dtIni ? new Date(`${dtIni}T00:00:00`) : null;
  const dFiltroFim = dtFim ? new Date(`${dtFim}T23:59:59`) : null;
  const diasFiltro = obterDiasDoIntervalo(dFiltroIni, dFiltroFim);

  // 1. Veículos filtrados por Status Operacional
  const veiculosFiltrados = dadosBrutosVeiculos.filter(v => {
    const status = (v.status || '').toUpperCase().trim();
    const isForaUso = status === 'FORA DE USO' || status.includes('INATIVO');

    if (filtroStatusCarro === 'ATIVOS') return !isForaUso;
    if (filtroStatusCarro === 'INATIVOS') return isForaUso;
    return true;
  });

  const idsPermitidos = new Set();
  veiculosFiltrados.forEach(v => {
    if (v.id) idsPermitidos.add(String(v.id).toUpperCase());
    if (v.nome_frota) idsPermitidos.add(String(v.nome_frota).toUpperCase());
    if (v.placa) idsPermitidos.add(limparPlaca(v.placa));
    if (v.uuid_veiculos) idsPermitidos.add(String(v.uuid_veiculos).toUpperCase());
  });

  const pertenceAoFiltro = (item) => {
    const vId = (item.veiculo_id ? String(item.veiculo_id) : '').toUpperCase();
    const vPlaca = limparPlaca(item.placa);
    const vUuid = (item.uuid_veiculos ? String(item.uuid_veiculos) : '').toUpperCase();
    return idsPermitidos.has(vId) || idsPermitidos.has(vPlaca) || idsPermitidos.has(vUuid);
  };

  // 2. Rotas Concluídas (motorista, finalidade, data, veículo)
  const rotasFiltradas = dadosBrutosRotas.filter(r => {
    if (!pertenceAoFiltro(r)) return false;
    if (filtroMotorista !== 'todos') {
      const resp = (r.responsavel || '').toLowerCase().trim();
      if (!resp.includes(filtroMotorista) && !filtroMotorista.includes(resp)) return false;
    }
    if (filtroFinalidade !== 'TODOS') {
      const fin = (r.finalidade || '').toUpperCase().trim();
      if (fin !== filtroFinalidade) return false;
    }
    const refData = r.data_retorno || r.data_saida;
    if (!refData) return true;
    const d = new Date(refData);
    if (dFiltroIni && d < dFiltroIni) return false;
    if (dFiltroFim && d > dFiltroFim) return false;
    return true;
  });

  // Identifica veículos com rotas atendendo ao filtro
  const veiculosComRotasDaFinalidade = new Set();
  if (filtroFinalidade !== 'TODOS') {
    rotasFiltradas.forEach(r => {
      if (r.veiculo_id) veiculosComRotasDaFinalidade.add(String(r.veiculo_id).toUpperCase());
      if (r.placa) veiculosComRotasDaFinalidade.add(limparPlaca(r.placa));
    });
  }

  // 3. Abastecimentos
  let abastsFiltrados = (tipoCusto === 'MANUTENCAO' || tipoCusto === 'ALUGUEL') ? [] : dadosBrutosAbastecimentos.filter(a => {
    if (!pertenceAoFiltro(a)) return false;
    
    if (filtroMotorista !== 'todos') {
      const resp = (a.responsavel || '').toLowerCase().trim();
      if (!resp.includes(filtroMotorista) && !filtroMotorista.includes(resp)) return false;
    }

    if (filtroFinalidade !== 'TODOS') {
      const aId = (a.veiculo_id ? String(a.veiculo_id) : '').toUpperCase();
      const aPlaca = limparPlaca(a.placa);
      if (!veiculosComRotasDaFinalidade.has(aId) && !veiculosComRotasDaFinalidade.has(aPlaca)) return false;
    }

    if (!a.data_hora) return true;
    const d = new Date(a.data_hora);
    if (dFiltroIni && d < dFiltroIni) return false;
    if (dFiltroFim && d > dFiltroFim) return false;
    return true;
  });

  // 4. Manutenções
  let manutsFiltradas = (tipoCusto === 'COMBUSTIVEL' || tipoCusto === 'ALUGUEL' || filtroFinalidade !== 'TODOS') ? [] : dadosBrutosManutencoes.filter(m => {
    if (!pertenceAoFiltro(m)) return false;
    if (filtroMotorista !== 'todos' && m.responsavel) {
      const resp = (m.responsavel || '').toLowerCase().trim();
      if (!resp.includes(filtroMotorista) && !filtroMotorista.includes(resp)) return false;
    }
    const dataRef = m.data_ultima_troca || m.created_at;
    if (!dataRef) return true;
    const d = new Date(dataRef);
    if (dFiltroIni && d < dFiltroIni) return false;
    if (dFiltroFim && d > dFiltroFim) return false;
    return true;
  });

  // 5. Aluguel Contratual
  const incluirAluguel = (tipoCusto === 'TODOS' || tipoCusto === 'ALUGUEL') && (filtroFinalidade === 'TODOS') && (filtroMotorista === 'todos');

  processarTotaisGerais(abastsFiltrados, manutsFiltradas, rotasFiltradas, veiculosFiltrados, diasFiltro, incluirAluguel, tipoCusto);
  processarAnalisePorVeiculo(veiculosFiltrados, abastsFiltrados, manutsFiltradas, rotasFiltradas, diasFiltro, incluirAluguel, tipoCusto);
  processarTabelaDepreciacao(veiculosFiltrados, rotasFiltradas, tipoCusto);
  renderizarAuditoriaCupons(abastsFiltrados, veiculosFiltrados);

  atualizarTodosOsGraficosFinanceiros(veiculosFiltrados, abastsFiltrados, manutsFiltradas, rotasFiltradas, diasFiltro, incluirAluguel, tipoCusto);
}

// =========================================================================
// 5. KPIS DE TOPO E TOTALIZADORES
// =========================================================================
function processarTotaisGerais(abastecimentos, manutenções, rotas, veiculos, diasFiltro, incluirAluguel, tipoCusto) {
  const gastoComb = (tipoCusto === 'MANUTENCAO' || tipoCusto === 'ALUGUEL') ? 0 : abastecimentos.reduce((acc, a) => acc + (Number(a.valor_total) || 0), 0);
  const gastoManut = (tipoCusto === 'COMBUSTIVEL' || tipoCusto === 'ALUGUEL') ? 0 : manutenções.reduce((acc, m) => acc + (Number(m.valor_total) || 0), 0);

  let gastoAluguel = 0;
  if (incluirAluguel) {
    veiculos.forEach(v => {
      const contrato = dadosBrutosContratosAluguel.find(c =>
        String(c.veiculo_id) === String(v.id) ||
        String(c.placa) === String(v.placa) ||
        String(c.veiculo_id) === String(v.nome_frota)
      );
      if (contrato) {
        const mensal = Number(contrato.tarifa_mensal || contrato.valor_mensal || 0);
        gastoAluguel += (mensal / 30) * diasFiltro;
      }
    });
  }

  const gastoTotal = gastoComb + gastoManut + gastoAluguel;
  const kmTotal = rotas.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);

  const custoKmRodagem = kmTotal > 0 ? ((gastoComb + gastoManut) / kmTotal) : 0;
  const custoKmFull = kmTotal > 0 ? (gastoTotal / kmTotal) : 0;

  let depreciacaoTotal = 0;
  if (tipoCusto !== 'ALUGUEL') {
    veiculos.forEach(v => {
      const isAlugado = dadosBrutosContratosAluguel.some(c =>
        String(c.veiculo_id) === String(v.id) || String(c.placa) === String(v.placa)
      );
      if (!isAlugado) {
        const rotasCarro = rotas.filter(r =>
          String(r.placa) === String(v.placa) || String(r.veiculo_id) === String(v.nome_frota)
        );
        const kmCarro = rotasCarro.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);
        depreciacaoTotal += kmCarro * 0.30;
      }
    });
  }

  const elCustoRodagem = document.getElementById('kpi-custo-km-rodagem');
  const elCustoFull = document.getElementById('kpi-custo-km-full');
  const elGastoTotal = document.getElementById('kpi-gasto-total');
  const elDespesaDetalhe = document.getElementById('kpi-despesa-detalhe');
  const elKmTotal = document.getElementById('kpi-km-total');
  const elTotalRotas = document.getElementById('kpi-total-rotas');
  const elDepreciacao = document.getElementById('kpi-depreciacao-total');

  if (elCustoRodagem) elCustoRodagem.innerText = custoKmRodagem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/km';
  if (elCustoFull) elCustoFull.innerText = custoKmFull.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/km';
  if (elGastoTotal) elGastoTotal.innerText = gastoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  
  if (elDespesaDetalhe) {
    if (tipoCusto === 'ALUGUEL') {
      elDespesaDetalhe.innerText = `Locação / Contratos: ${gastoAluguel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    } else if (tipoCusto === 'COMBUSTIVEL') {
      elDespesaDetalhe.innerText = `Combustível: ${gastoComb.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    } else if (tipoCusto === 'MANUTENCAO') {
      elDespesaDetalhe.innerText = `Manutenção: ${gastoManut.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
    } else {
      elDespesaDetalhe.innerText = `Comb: ${gastoComb.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Manut: ${gastoManut.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${gastoAluguel > 0 ? ` | Aluguel: ${gastoAluguel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}`;
    }
  }

  if (elKmTotal) elKmTotal.innerText = `${kmTotal.toLocaleString('pt-BR')} km`;
  if (elTotalRotas) elTotalRotas.innerText = `${rotas.length} rotas concluídas`;
  if (elDepreciacao) elDepreciacao.innerText = depreciacaoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Ticker Tape Dinâmico
  const ticker = document.getElementById('ticker-financeiro-dinamico');
  if (ticker) {
    const totalDespesaFmt = gastoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const rodagemFmt = custoKmRodagem > 0 ? custoKmRodagem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/km' : 'R$ 0,00/km';
    const fullFmt = custoKmFull > 0 ? custoKmFull.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/km' : 'R$ 0,00/km';

    const blocoTicker = `
      <span class="mx-6 flex items-center gap-2"><strong class="text-[#8fb855]">DESPESA TOTAL:</strong> ${totalDespesaFmt} acumulados</span>
      <span class="mx-6 text-[#556b2f]">•</span>
      <span class="mx-6 flex items-center gap-2"><strong class="text-[#f4f1e5]">CUSTO RODAGEM:</strong> ${rodagemFmt}</span>
      <span class="mx-6 text-[#556b2f]">•</span>
      <span class="mx-6 flex items-center gap-2"><strong class="text-[#d88c5a]">CUSTO FULL:</strong> ${fullFmt}</span>
      <span class="mx-6 text-[#556b2f]">•</span>
      <span class="mx-6 flex items-center gap-2"><strong class="text-[#b5cf82]">ROTAS:</strong> ${kmTotal.toLocaleString('pt-BR')} km em ${rotas.length} viagens</span>
      <span class="mx-6 text-[#556b2f]">•</span>
    `;
    ticker.innerHTML = blocoTicker + blocoTicker;
  }
}

// =========================================================================
// 6. ATUALIZAÇÃO REATIVA DOS 5 GRÁFICOS (CHART.JS)
// =========================================================================
function atualizarTodosOsGraficosFinanceiros(veiculos, abastecimentos, manutenções, rotas, diasFiltro, incluirAluguel, tipoCusto) {
  const custoPorCarro = {};
  const litrosPorCarro = {};
  const kmPorCarro = {};
  const aluguelPorCarro = {};

  if (tipoCusto === 'TODOS' || tipoCusto === 'COMBUSTIVEL') {
    abastecimentos.forEach(a => {
      const v = veiculos.find(ve =>
        String(ve.id) === String(a.veiculo_id) ||
        String(ve.uuid_veiculos) === String(a.uuid_veiculos || a.veiculo_id) ||
        String(ve.placa) === String(a.placa || a.veiculo_id) ||
        String(ve.nome_frota) === String(a.veiculo_id)
      );
      const nome = a.nome_frota || v?.nome_frota || a.veiculo_id || 'Outro';
      custoPorCarro[nome] = (custoPorCarro[nome] || 0) + (Number(a.valor_total) || 0);
      litrosPorCarro[nome] = (litrosPorCarro[nome] || 0) + (Number(a.quantidade_litros) || 0);
    });
  }

  if (tipoCusto === 'TODOS' || tipoCusto === 'MANUTENCAO') {
    manutenções.forEach(m => {
      const v = veiculos.find(ve =>
        String(ve.id) === String(m.veiculo_id) ||
        String(ve.placa) === String(m.placa) ||
        String(ve.nome_frota) === String(m.veiculo_id)
      );
      const nome = v?.nome_frota || m.veiculo_id || 'Outro';
      custoPorCarro[nome] = (custoPorCarro[nome] || 0) + (Number(m.valor_total) || 0);
    });
  }

  rotas.forEach(r => {
    const v = veiculos.find(ve =>
      String(ve.id) === String(r.veiculo_id) ||
      String(ve.nome_frota) === String(r.veiculo_id) ||
      String(ve.placa) === String(r.placa)
    );
    const nome = v?.nome_frota || r.veiculo_id || 'Outro';
    kmPorCarro[nome] = (kmPorCarro[nome] || 0) + (Number(r.km_total) || 0);
  });

  if (incluirAluguel) {
    veiculos.forEach(v => {
      const contrato = dadosBrutosContratosAluguel.find(c =>
        String(c.veiculo_id) === String(v.id) ||
        String(c.placa) === String(v.placa) ||
        String(c.veiculo_id) === String(v.nome_frota)
      );
      if (contrato) {
        const mensal = Number(contrato.tarifa_mensal || contrato.valor_mensal || 0);
        const valorProporcional = (mensal / 30) * diasFiltro;
        const nome = v.nome_frota || v.id;
        aluguelPorCarro[nome] = valorProporcional;
        custoPorCarro[nome] = (custoPorCarro[nome] || 0) + valorProporcional;
      }
    });
  }

  const carrosComGasto = Object.keys(custoPorCarro).filter(k => custoPorCarro[k] > 0);
  const labelsCarros = carrosComGasto;
  const valoresCusto = labelsCarros.map(k => Number(custoPorCarro[k].toFixed(2)));

  const carrosComLitros = Object.keys(litrosPorCarro).filter(k => litrosPorCarro[k] > 0);
  const labelsDonutLitros = (tipoCusto === 'MANUTENCAO' || tipoCusto === 'ALUGUEL') ? [] : carrosComLitros;
  const valoresLitros = labelsDonutLitros.map(k => Number(litrosPorCarro[k].toFixed(1)));

  const paletaHarmonica = ['#556b2f', '#7a4522', '#395237', '#8fb855', '#d88c5a', '#a1824a', '#2e432c'];

  // Gráfico 1: Despesa Total por Ativo
  const ctxBarras = document.getElementById('chartFinanceiroCarros')?.getContext('2d');
  if (ctxBarras) {
    if (chartBarras) chartBarras.destroy();
    chartBarras = new Chart(ctxBarras, {
      type: 'bar',
      data: {
        labels: labelsCarros.length ? labelsCarros : ['Sem registros para o filtro'],
        datasets: [{
          label: 'Total Gasto (R$)',
          data: valoresCusto.length ? valoresCusto : [0],
          backgroundColor: paletaHarmonica,
          borderRadius: 8,
          barThickness: 26
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: c => `Total: R$ ${Number(c.raw || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(85, 107, 47, 0.15)' },
            ticks: { color: '#b0b9ab', font: { size: 10, family: 'monospace' }, callback: v => 'R$ ' + v }
          },
          x: { grid: { display: false }, ticks: { color: '#f4f1e5', font: { size: 11, weight: 'bold' } } }
        }
      }
    });
  }

  // Gráfico 2: Volume Faturado em Litros
  const ctxDonut = document.getElementById('chartRoscaCombustivel')?.getContext('2d');
  const labelDonutTotal = document.getElementById('label-total-litros-donut');
  const totalLitrosPeriodo = valoresLitros.reduce((a, b) => a + b, 0);

  if (labelDonutTotal) {
    if (tipoCusto === 'MANUTENCAO' || tipoCusto === 'ALUGUEL') {
      labelDonutTotal.innerText = 'Não aplicável para este tipo de custo';
    } else {
      labelDonutTotal.innerText = `Total apurado: ${totalLitrosPeriodo.toFixed(1)} L`;
    }
  }

  if (ctxDonut) {
    if (chartDonut) chartDonut.destroy();
    chartDonut = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: labelsDonutLitros.length ? labelsDonutLitros : ['Sem dados no período'],
        datasets: [{
          data: valoresLitros.length ? valoresLitros : [0],
          backgroundColor: paletaHarmonica,
          borderWidth: 2,
          borderColor: '#121b13'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#b0b9ab', boxWidth: 10, font: { size: 10 } } }
        },
        cutout: '70%'
      }
    });
  }

  // Gráfico 3: Evolução dos Custos
  const ctxEvolucao = document.getElementById('chartEvolucaoCustos')?.getContext('2d');
  if (ctxEvolucao) {
    const mapaDiasComb = {};
    const mapaDiasManut = {};

    if (tipoCusto === 'TODOS' || tipoCusto === 'COMBUSTIVEL') {
      abastecimentos.forEach(a => {
        if (!a.data_hora) return;
        const chave = new Date(a.data_hora).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        mapaDiasComb[chave] = (mapaDiasComb[chave] || 0) + (Number(a.valor_total) || 0);
      });
    }

    if (tipoCusto === 'TODOS' || tipoCusto === 'MANUTENCAO') {
      manutenções.forEach(m => {
        const dataM = m.data_ultima_troca || m.created_at;
        if (!dataM) return;
        const chave = new Date(dataM).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        mapaDiasManut[chave] = (mapaDiasManut[chave] || 0) + (Number(m.valor_total) || 0);
      });
    }

    const labelsTimeline = [...new Set([...Object.keys(mapaDiasComb), ...Object.keys(mapaDiasManut)])].sort();
    const dadosCombLinha = labelsTimeline.map(d => Number((mapaDiasComb[d] || 0).toFixed(2)));
    const dadosManutLinha = labelsTimeline.map(d => Number((mapaDiasManut[d] || 0).toFixed(2)));

    const gradComb = ctxEvolucao.createLinearGradient(0, 0, 0, 240);
    gradComb.addColorStop(0, 'rgba(85, 107, 47, 0.45)');
    gradComb.addColorStop(1, 'rgba(85, 107, 47, 0.0)');

    if (chartEvolucao) chartEvolucao.destroy();
    chartEvolucao = new Chart(ctxEvolucao, {
      type: 'line',
      data: {
        labels: labelsTimeline.length ? labelsTimeline : ['Sem registros no critério'],
        datasets: [
          {
            label: 'Combustível (R$)',
            data: dadosCombLinha.length ? dadosCombLinha : [0],
            borderColor: '#8fb855',
            backgroundColor: gradComb,
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 3
          },
          {
            label: 'Manutenção (R$)',
            data: dadosManutLinha.length ? dadosManutLinha : [0],
            borderColor: '#7a4522',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: '#b0b9ab', font: { size: 10 } } }
        },
        scales: {
          y: {
            grid: { color: 'rgba(85, 107, 47, 0.15)' },
            ticks: { color: '#b0b9ab', callback: v => 'R$ ' + v }
          },
          x: { grid: { display: false }, ticks: { color: '#b0b9ab', font: { size: 10 } } }
        }
      }
    });
  }

  // Gráfico 4: Custo Real por KM
  const ctxCustoKm = document.getElementById('chartCustoKmPorCarro')?.getContext('2d');
  if (ctxCustoKm) {
    const carrosKmLabels = labelsCarros.filter(c => (kmPorCarro[c] || 0) > 0);
    const custoRodagemArray = carrosKmLabels.map(c => {
      const gastoRodagem = (custoPorCarro[c] || 0) - (aluguelPorCarro[c] || 0);
      const km = kmPorCarro[c] || 0;
      return km > 0 ? Number((gastoRodagem / km).toFixed(2)) : 0;
    });

    const custoFullArray = carrosKmLabels.map(c => {
      const gastoTotal = custoPorCarro[c] || 0;
      const km = kmPorCarro[c] || 0;
      return km > 0 ? Number((gastoTotal / km).toFixed(2)) : 0;
    });

    if (chartCustoKm) chartCustoKm.destroy();
    chartCustoKm = new Chart(ctxCustoKm, {
      type: 'bar',
      data: {
        labels: carrosKmLabels.length ? carrosKmLabels : ['Sem dados de KM no filtro'],
        datasets: [
          {
            label: 'Rodagem (R$/km)',
            data: custoRodagemArray.length ? custoRodagemArray : [0],
            backgroundColor: '#556b2f',
            borderRadius: 6,
            barThickness: 12
          },
          {
            label: 'Full com Aluguel (R$/km)',
            data: custoFullArray.length ? custoFullArray : [0],
            backgroundColor: '#7a4522',
            borderRadius: 6,
            barThickness: 12
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: '#b0b9ab', font: { size: 10 } } }
        },
        scales: {
          x: {
            grid: { color: 'rgba(85, 107, 47, 0.15)' },
            ticks: { color: '#b0b9ab', callback: v => 'R$ ' + v }
          },
          y: { grid: { display: false }, ticks: { color: '#f4f1e5', font: { size: 10, weight: 'bold' } } }
        }
      }
    });
  }

  // Gráfico 5: Composição Percentual de Custos
  const ctxComposicao = document.getElementById('chartComposicaoCustos')?.getContext('2d');
  if (ctxComposicao) {
    const totalComb = (tipoCusto === 'MANUTENCAO' || tipoCusto === 'ALUGUEL') ? 0 : abastecimentos.reduce((acc, a) => acc + (Number(a.valor_total) || 0), 0);
    const totalManut = (tipoCusto === 'COMBUSTIVEL' || tipoCusto === 'ALUGUEL') ? 0 : manutenções.reduce((acc, m) => acc + (Number(m.valor_total) || 0), 0);
    
    let totalAluguel = 0;
    if (incluirAluguel) {
      Object.values(aluguelPorCarro).forEach(val => totalAluguel += val);
    }

    let totalDeprec = 0;
    if (tipoCusto !== 'ALUGUEL') {
      veiculos.forEach(v => {
        const isAlugado = dadosBrutosContratosAluguel.some(c => String(c.veiculo_id) === String(v.id) || String(c.placa) === String(v.placa));
        if (!isAlugado) {
          const km = kmPorCarro[v.nome_frota || v.id] || 0;
          totalDeprec += km * 0.30;
        }
      });
    }

    const temGastos = (totalComb + totalManut + totalAluguel + totalDeprec) > 0;

    if (chartComposicao) chartComposicao.destroy();
    chartComposicao = new Chart(ctxComposicao, {
      type: 'doughnut',
      data: {
        labels: ['Combustível', 'Manutenção', 'Locação', 'Depreciação'],
        datasets: [{
          data: temGastos ? [totalComb.toFixed(2), totalManut.toFixed(2), totalAluguel.toFixed(2), totalDeprec.toFixed(2)] : [0, 0, 0, 0],
          backgroundColor: ['#8fb855', '#7a4522', '#d88c5a', '#556b2f'],
          borderWidth: 2,
          borderColor: '#121b13'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#b0b9ab', boxWidth: 10, font: { size: 10 } } }
        },
        cutout: '65%'
      }
    });
  }
}

// =========================================================================
// 7. TABELAS DE DADOS (COM RESGATE REAL DE TIPO_FROTA DO BANCO)
// =========================================================================
function processarAnalisePorVeiculo(veiculos, abastecimentos, manutenções, rotas, diasFiltro, incluirAluguel, tipoCusto) {
  const grid = document.getElementById('grid-financeiro-veiculos');
  if (!grid) return;
  grid.innerHTML = '';

  if (!veiculos || veiculos.length === 0) {
    grid.innerHTML = '<tr><td colspan="10" class="text-center py-6 text-[#b0b9ab]">Nenhum veículo encontrado para os filtros selecionados.</td></tr>';
    return;
  }

  veiculos.forEach(v => {
    const vPlaca = (v.placa || '').trim().toUpperCase();
    const vPlacaPura = limparPlaca(vPlaca);
    const vNome = (v.nome_frota || v.id || '').trim().toUpperCase();
    const vUuid = v.uuid_veiculos ? String(v.uuid_veiculos) : null;

    const rotasCarro = rotas.filter(r => {
      const rPlacaPura = limparPlaca(r.placa);
      const rVeicId = (r.veiculo_id ? String(r.veiculo_id) : '').trim().toUpperCase();
      const rVeicPuro = limparPlaca(rVeicId);

      return (vPlacaPura && (rPlacaPura === vPlacaPura || rVeicPuro === vPlacaPura)) ||
        (vNome && rVeicId === vNome) ||
        (vUuid && String(r.uuid_veiculos) === vUuid);
    });

    const abastsCarro = abastecimentos.filter(a => {
      const aPlacaPura = limparPlaca(a.placa);
      const aVeicId = (a.veiculo_id ? String(a.veiculo_id) : '').trim().toUpperCase();
      const aVeicPuro = limparPlaca(aVeicId);

      return (vPlacaPura && (aPlacaPura === vPlacaPura || aVeicPuro === vPlacaPura)) ||
        (vNome && aVeicId === vNome) ||
        (vUuid && String(a.uuid_veiculos) === vUuid);
    });

    const manutsCarro = manutenções.filter(m => {
      const mPlacaPura = limparPlaca(m.placa);
      return (vPlacaPura && mPlacaPura === vPlacaPura) || (vNome && (m.veiculo_id ? String(m.veiculo_id).toUpperCase() === vNome : false));
    });

    const contrato = dadosBrutosContratosAluguel.find(c =>
      String(c.veiculo_id) === String(v.id) ||
      String(c.placa) === String(v.placa) ||
      String(c.veiculo_id) === String(v.nome_frota)
    );

    const isAlugado = !!contrato;
    let aluguelRateado = 0;
    if (isAlugado && incluirAluguel) {
      const mensal = Number(contrato.tarifa_mensal || contrato.valor_mensal || 0);
      aluguelRateado = (mensal / 30) * diasFiltro;
    }

    const tipoFrotaBD = (v.tipo_frota || '').trim().toUpperCase();
    let badgeTipoFrota = '';
    if (isAlugado) {
      badgeTipoFrota = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#7a4522]/30 text-[#d88c5a] border border-[#7a4522]/50">ALUGADO</span>`;
    } else if (tipoFrotaBD === 'EXTERNO') {
      badgeTipoFrota = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-950/50 text-indigo-300 border border-indigo-500/40">EXTERNO</span>`;
    } else if (tipoFrotaBD === 'PROPRIO' || tipoFrotaBD === 'PRÓPRIO') {
      badgeTipoFrota = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[#395237]/40 text-[#8fb855] border border-[#556b2f]/50">FROTA (PRÓPRIO)</span>`;
    } else {
      badgeTipoFrota = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-[#b0b9ab] border border-slate-700">${v.tipo_frota || 'REGULAR'}</span>`;
    }

    const kmRotas = rotasCarro.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);
    let kmAbast = 0;
    const odometros = abastsCarro.map(a => Number(a.km_atual)).filter(km => km && !isNaN(km) && km > 0).sort((a, b) => a - b);
    if (odometros.length >= 2) kmAbast = odometros[odometros.length - 1] - odometros[0];
    const kmRodado = kmRotas > 0 ? kmRotas : kmAbast;

    const gastoCombustivel = (tipoCusto === 'MANUTENCAO' || tipoCusto === 'ALUGUEL') ? 0 : abastsCarro.reduce((acc, a) => acc + (Number(a.valor_total) || 0), 0);
    const gastoManutencao = (tipoCusto === 'COMBUSTIVEL' || tipoCusto === 'ALUGUEL') ? 0 : manutsCarro.reduce((acc, m) => acc + (Number(m.valor_total) || 0), 0);
    const gastoRodagem = gastoCombustivel + gastoManutencao;
    const gastoTotal = gastoRodagem + aluguelRateado;

    const custoKmRodagem = kmRodado > 0 ? (gastoRodagem / kmRodado) : 0;
    const custoKmFull = kmRodado > 0 ? (gastoTotal / kmRodado) : 0;

    const tr = document.createElement('tr');
    tr.className = "hover:bg-[#18271a]/50 transition";
    tr.innerHTML = `
      <td class="py-3 px-3">
        <div class="font-bold text-[#f4f1e5] text-xs">${v.nome_frota || v.id}</div>
        <span class="text-[10px] font-mono text-[#b0b9ab]">${v.placa || 'Sem placa'}</span>
      </td>
      <td class="py-3 px-3">${badgeTipoFrota}</td>
      <td class="py-3 px-3 font-mono text-[#f4f1e5] font-bold">${kmRodado.toLocaleString('pt-BR')} km</td>
      <td class="py-3 px-3 font-mono text-[#8fb855] font-bold">${gastoCombustivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-3 px-3 font-mono text-[#b0b9ab]">${gastoManutencao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-3 px-3 font-mono text-[#d88c5a] font-bold">${aluguelRateado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-3 px-3 font-mono text-[#f4f1e5] font-black">${gastoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-3 px-3 font-mono font-bold ${custoKmRodagem > 1.8 ? 'text-rose-400' : 'text-[#8fb855]'}">
        ${custoKmRodagem > 0 ? custoKmRodagem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/km' : 'R$ 0,00'}
      </td>
      <td class="py-3 px-3 font-mono font-black ${custoKmFull > 3.0 ? 'text-[#d88c5a]' : 'text-[#b5cf82]'}">
        ${custoKmFull > 0 ? custoKmFull.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/km' : 'R$ 0,00'}
      </td>
      <td class="py-3 px-3 text-center whitespace-nowrap">
        <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${v.status === 'Em Uso' ? 'bg-[#7a4522]/30 text-[#d88c5a] border border-[#7a4522]/50' : (v.status === 'Disponivel' ? 'bg-[#395237]/40 text-[#8fb855] border border-[#556b2f]/50' : 'bg-rose-950/40 text-rose-300 border border-rose-800/40')}">
          ${v.status || 'Ativo'}
        </span>
      </td>
    `;
    grid.appendChild(tr);
  });
}

function processarTabelaDepreciacao(veiculos, rotas, tipoCusto) {
  const grid = document.getElementById('grid-depreciacao-veiculos');
  if (!grid) return;
  grid.innerHTML = '';

  veiculos.forEach(v => {
    const vPlacaPura = limparPlaca(v.placa);
    const vNome = (v.nome_frota || v.id || '').trim().toUpperCase();

    const rotasCarro = rotas.filter(r => {
      const rPlacaPura = limparPlaca(r.placa);
      const rVeicId = (r.veiculo_id ? String(r.veiculo_id) : '').trim().toUpperCase();
      return (vPlacaPura && (rPlacaPura === vPlacaPura || limparPlaca(rVeicId) === vPlacaPura)) || (vNome && rVeicId === vNome);
    });

    const deltaKm = rotasCarro.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);

    const isAlugado = dadosBrutosContratosAluguel.some(c =>
      String(c.veiculo_id) === String(v.id) || String(c.placa) === String(v.placa)
    );

    const tipoFrotaBD = (v.tipo_frota || '').trim().toUpperCase();
    const isExterno = tipoFrotaBD === 'EXTERNO';

    const taxaPecas = (tipoCusto === 'ALUGUEL' || isExterno) ? 0 : 0.12;
    const taxaVeiculo = (isAlugado || tipoCusto === 'ALUGUEL' || isExterno) ? 0.00 : 0.18;
    const depPecas = deltaKm * taxaPecas;
    const depVeiculo = deltaKm * taxaVeiculo;
    const depTotal = depPecas + depVeiculo;

    let regimeTexto = 'Próprio';
    if (isAlugado) regimeTexto = 'Alugado';
    else if (isExterno) regimeTexto = 'Externo';

    const tr = document.createElement('tr');
    tr.className = "hover:bg-[#18271a]/50 transition";
    tr.innerHTML = `
      <td class="py-3 px-3 font-bold text-[#f4f1e5]">${v.nome_frota || v.id} <span class="text-[11px] text-[#b0b9ab] font-normal">- ${v.placa || ''}</span></td>
      <td class="py-3 px-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isAlugado ? 'bg-[#7a4522]/30 text-[#d88c5a]' : (isExterno ? 'bg-indigo-950 text-indigo-300' : 'bg-[#395237]/40 text-[#8fb855]')}">
          ${regimeTexto}
        </span>
      </td>
      <td class="py-3 px-3 font-mono font-bold text-[#f4f1e5]">${deltaKm.toLocaleString('pt-BR')} km</td>
      <td class="py-3 px-3 font-mono text-[#b5cf82]">R$ ${(taxaPecas + taxaVeiculo).toFixed(2)}/km</td>
      <td class="py-3 px-3 font-mono text-[#b0b9ab]">${depPecas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-3 px-3 font-mono ${isAlugado ? 'text-[#b0b9ab] italic' : 'text-[#8fb855]'}">
        ${isAlugado ? 'R$ 0,00 (Locadora)' : (isExterno ? 'R$ 0,00 (Terceiro)' : depVeiculo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))}
      </td>
      <td class="py-3 px-3 font-mono font-black text-[#d88c5a]">${depTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
    `;
    grid.appendChild(tr);
  });
}

// =========================================================================
// 8. AUDITORIA COM POP-UP MODAL PARA VISUALIZAR COMPROVANTES
// =========================================================================
function renderizarAuditoriaCupons(abastecimentos, veiculos) {
  const tbody = document.getElementById('grid-auditoria-cupons');
  if (!tbody) return;

  if (abastecimentos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-6 text-[#b0b9ab]">Nenhum cupom de combustível encontrado para os filtros selecionados.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  abastecimentos.slice(0, 50).forEach(a => {
    const veic = veiculos.find(v =>
      String(v.id) === String(a.veiculo_id) ||
      String(v.nome_frota) === String(a.veiculo_id) ||
      String(v.placa) === String(a.veiculo_id)
    );

    const nomeExibicao = a.nome_frota || veic?.nome_frota || a.veiculo_id || 'ARVO';
    const tr = document.createElement('tr');
    tr.className = "hover:bg-[#18271a]/50 transition";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-[11px] text-[#b0b9ab]">${a.data_hora ? new Date(a.data_hora).toLocaleDateString('pt-BR') : '-'}</td>
      <td class="py-2.5 px-3 font-bold text-[#f4f1e5]">${nomeExibicao}</td>
      <td class="py-2.5 px-3 text-[#b0b9ab]">${a.local_posto || '-'}</td>
      <td class="py-2.5 px-3 text-[#b0b9ab]">${a.tipo_combustivel || 'Gasolina Comum'}</td>
      <td class="py-2.5 px-3 font-mono font-bold text-[#f4f1e5]">${Number(a.quantidade_litros || 0).toFixed(2)} L</td>
      <td class="py-2.5 px-3 font-mono text-[#b0b9ab]">R$ ${Number(a.preco_litro || 0).toFixed(2)}</td>
      <td class="py-2.5 px-3 font-mono font-black text-[#8fb855]">${Number(a.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-2.5 px-3 text-[11px] text-[#b0b9ab]">${(a.responsavel || '').split('@')[0]}</td>
      <td class="py-2.5 px-3 text-center">
        ${a.url_comprovante ? `
          <button type="button" onclick="abrirModalComprovante('${a.url_comprovante}')" class="text-[#d88c5a] hover:text-[#f4f1e5] font-bold inline-flex items-center gap-1 bg-[#1c2a1e] hover:bg-[#253828] border border-[#556b2f]/30 px-2 py-0.5 rounded-lg transition text-xs shadow-xs">
            <i class="ph-bold ph-eye"></i> Ver
          </button>
        ` : '<span class="text-[#556b2f]">-</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function abrirModalComprovante(url) {
  if (!url) return;
  const modal = document.getElementById('modal-visualizar-comprovante');
  const img = document.getElementById('img-modal-comprovante');
  const btnDown = document.getElementById('btn-download-comprovante');

  if (img) img.src = url;
  if (btnDown) btnDown.href = url;
  if (modal) modal.classList.remove('hidden');
}

function fecharModalComprovante() {
  const modal = document.getElementById('modal-visualizar-comprovante');
  const img = document.getElementById('img-modal-comprovante');
  if (modal) modal.classList.add('hidden');
  if (img) img.src = '';
}

// =========================================================================
// 9. MODAIS E CADASTRO REAL DE CONTRATOS DE ALUGUEL
// =========================================================================
function popularSelectsFormulariosFinanceiros(veiculos) {
  const sAluguel = document.getElementById('aluguel-veiculo-id');
  const sSeguro = document.getElementById('seguro-veiculo-id');

  const html = '<option value="">Selecione o carro...</option>' +
    (veiculos || []).map(v => `<option value="${v.id}">${v.nome_frota || v.id} [${v.placa || 'S/ Placa'}]</option>`).join('');

  if (sAluguel) sAluguel.innerHTML = html;
  if (sSeguro) sSeguro.innerHTML = html;
}

function abrirModalParametrosCarros() {
  document.getElementById('modal-parametros-carros')?.classList.remove('hidden');
}
function fecharModalParametrosCarros() {
  document.getElementById('modal-parametros-carros')?.classList.add('hidden');
}
function alternarAbaCarros(aba) {
  const fAluguel = document.getElementById('form-contrato-aluguel');
  const fSeguro = document.getElementById('form-custos-seguros');
  const tAluguel = document.getElementById('tab-carro-aluguel');
  const tSeguro = document.getElementById('tab-carro-seguro');

  if (aba === 'aluguel') {
    fAluguel?.classList.remove('hidden');
    fSeguro?.classList.add('hidden');
    tAluguel?.classList.add('bg-[#7a4522]', 'text-[#f4f1e5]');
    tAluguel?.classList.remove('text-[#b0b9ab]');
    tSeguro?.classList.remove('bg-[#7a4522]', 'text-[#f4f1e5]');
    tSeguro?.classList.add('text-[#b0b9ab]');
  } else {
    fAluguel?.classList.add('hidden');
    fSeguro?.classList.remove('hidden');
    tSeguro?.classList.add('bg-[#7a4522]', 'text-[#f4f1e5]');
    tSeguro?.classList.remove('text-[#b0b9ab]');
    tAluguel?.classList.remove('bg-[#7a4522]', 'text-[#f4f1e5]');
    tAluguel?.classList.add('text-[#b0b9ab]');
  }
}

function abrirModalEquipamentos() {
  document.getElementById('modal-equipamentos')?.classList.remove('hidden');
}
function fecharModalEquipamentos() {
  document.getElementById('modal-equipamentos')?.classList.add('hidden');
}
function abrirModalViagens() {
  document.getElementById('modal-viagens')?.classList.remove('hidden');
}
function fecharModalViagens() {
  document.getElementById('modal-viagens')?.classList.add('hidden');
}

// -------------------------------------------------------------
// GRAVAÇÃO COMPATIBILIZADA DE CONTRATO DE ALUGUEL
// -------------------------------------------------------------
async function salvarContratoAluguel(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-salvar-contrato');
  const veiculoId = document.getElementById('aluguel-veiculo-id')?.value;
  const locadora = (document.getElementById('aluguel-locadora')?.value || '').trim();
  const numContrato = (document.getElementById('aluguel-num-contrato')?.value || '').trim();
  const tarifaMensal = parseFloat(document.getElementById('aluguel-valor-mensal')?.value) || 0;
  const kmExcedente = parseFloat(document.getElementById('aluguel-km-excedente')?.value) || 0;
  const franquiaKm = parseInt(document.getElementById('aluguel-franquia')?.value, 10) || 0;

  if (!veiculoId || tarifaMensal <= 0) {
    alert("Informe o veículo e o valor mensal da tarifa.");
    return;
  }

  // Resgata o usuário logado para preencher 'responsavel'
  let emailResponsavel = 'financeiro@arvo.tec.br';
  try {
    const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
    if (rawSessao) {
      const parsed = JSON.parse(rawSessao);
      emailResponsavel = parsed.email || parsed.nome || emailResponsavel;
    }
  } catch (err) {
    console.warn("Não foi possível obter email da sessão:", err);
  }
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Salvando...`;
  }

  try {
    // Objeto contendo APENAS colunas confirmadas no Supabase
    const payload = {
      veiculo_id: String(veiculoId),
      locadora: locadora,
      codigo_aluguel: numContrato,
      tarifa_mensal: tarifaMensal,
      valor_km_excedente: kmExcedente,
      franquia_km_mes: franquiaKm,
      data_inicio: new Date().toISOString().split('T')[0], // Envia YYYY-MM-DD para satisfazer colunas do tipo date
      updated_at: new Date().toISOString()
    };

    // Verifica se já existe um contrato cadastrado para este carro
    const contratoExistente = dadosBrutosContratosAluguel.find(c => String(c.veiculo_id) === String(veiculoId));

    let erroGravacao = null;
    if (contratoExistente && contratoExistente.id) {
      const { error } = await db.from('contratos_aluguel').update(payload).eq('id', contratoExistente.id);
      erroGravacao = error;
    } else {
      const { error } = await db.from('contratos_aluguel').insert([payload]);
      erroGravacao = error;
    }

    if (erroGravacao) throw erroGravacao;

    // Atualiza status do veículo para ALUGADO
    try {
      await db.from('veiculos').update({ tipo_frota: 'ALUGADO' }).eq('id', veiculoId);
    } catch (veicErr) {
      console.warn("Aviso ao definir frota como ALUGADO:", veicErr);
    }

    alert("✅ Contrato de aluguel registrado com sucesso!");
    fecharModalParametrosCarros();
    await carregarMetricasFinanceiras();
  } catch (err) {
    console.error("Erro ao salvar contrato de aluguel:", err);
    alert("Erro ao gravar contrato: " + (err.message || 'Erro inesperado.'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `Salvar Contrato de Aluguel`;
    }
  }
}

async function salvarCustosSeguros(e) {
  e.preventDefault();
  alert("✅ Custos de seguro registrados com sucesso!");
  fecharModalParametrosCarros();
}

// =========================================================================
// 10. EXPOSIÇÃO GLOBAL
// =========================================================================
window.setPeriodoFinanceiro = setPeriodoFinanceiro;
window.aplicarFiltroPersonalizadoDatas = aplicarFiltroPersonalizadoDatas;
window.limparFiltrosFinanceiro = limparFiltrosFinanceiro;
window.aplicarFiltrosEAtualizarFinanceiro = aplicarFiltrosEAtualizarFinanceiro;
window.abrirModalParametrosCarros = abrirModalParametrosCarros;
window.fecharModalParametrosCarros = fecharModalParametrosCarros;
window.alternarAbaCarros = alternarAbaCarros;
window.abrirModalEquipamentos = abrirModalEquipamentos;
window.fecharModalEquipamentos = fecharModalEquipamentos;
window.abrirModalViagens = abrirModalViagens;
window.fecharModalViagens = fecharModalViagens;
window.salvarContratoAluguel = salvarContratoAluguel;
window.salvarCustosSeguros = salvarCustosSeguros;
window.abrirModalComprovante = abrirModalComprovante;
window.fecharModalComprovante = fecharModalComprovante;
window.logout = logout;