// =========================================================================
// MÓDULO DE GESTÃO FINANCEIRA E TCO - ARVOCAR
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = window.db || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioLogado = null;

// =========================================================================
// INICIALIZAÇÃO
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  const sessaoStr = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  if (!sessaoStr) {
    window.location.href = 'login.html';
    return;
  }
  usuarioLogado = JSON.parse(sessaoStr);
  await carregarMetricasFinanceiras();
});

function logout() {
  localStorage.removeItem('arvo_usuario_logado');
  localStorage.removeItem('arvo_mobile_user');
  window.location.href = 'login.html';
}

// =========================================================================
// CARREGAMENTO E PROCESSAMENTO INTEGRADO DE DADOS
// =========================================================================
async function carregarMetricasFinanceiras() {
  const filtroDias = document.getElementById('filtro-periodo')?.value || '30';
  let dataCorte = null;

  if (filtroDias !== 'todos') {
    const dias = parseInt(filtroDias, 10);
    const d = new Date();
    d.setDate(d.getDate() - dias);
    dataCorte = d.toISOString();
  }

  try {
    // 1. Carrega Veículos, Abastecimentos e Rotas Concluídas em Paralelo
    let queryAbast = db.from('abastecimentos').select('*').order('data_hora', { ascending: false });
    let queryRotas = db.from('rotas').select('*').eq('status', 'Concluida').order('data_retorno', { ascending: false });
    let queryVeiculos = db.from('veiculos').select('*');

    if (dataCorte) {
      queryAbast = queryAbast.gte('data_hora', dataCorte);
      queryRotas = queryRotas.gte('data_retorno', dataCorte);
    }

    const [resAbast, resRotas, resVeiculos] = await Promise.all([
      queryAbast,
      queryRotas,
      queryVeiculos
    ]);

    if (resAbast.error) throw resAbast.error;
    if (resRotas.error) throw resRotas.error;
    if (resVeiculos.error) throw resVeiculos.error;

    const abastecimentos = resAbast.data || [];
    const rotas = resRotas.data || [];
    const veiculos = resVeiculos.data || [];
    popularSelectsFormulariosFinanceiros(veiculos);

    // 2. Cálculos Gerais Consolidados
    processarTotaisGerais(abastecimentos, rotas);

    // 3. Processamento Analítico por Ativo (Veículo)
    processarAnalisePorVeiculo(veiculos, abastecimentos, rotas);

    // 4. Renderização da Auditoria de Cupons
    renderizarAuditoriaCupons(abastecimentos, veiculos);

  } catch (err) {
    console.error("Erro ao processar dados financeiros:", err);
    alert("Falha ao carregar métricas financeiras: " + err.message);
  }
}

// =========================================================================
// CÁLCULO DOS INDICADORES GLOBAIS (CUSTO POR KM E VOLUMES)
// =========================================================================
function processarTotaisGerais(abastecimentos, rotas) {
  const gastoTotal = abastecimentos.reduce((acc, a) => acc + (Number(a.valor_total) || 0), 0);
  const litrosTotais = abastecimentos.reduce((acc, a) => acc + (Number(a.quantidade_litros) || 0), 0);
  const kmTotal = rotas.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);

  // Custo por KM = Gasto Total da Frota / KM Total Rodado (Artigo Anexado)
  const custoPorKm = kmTotal > 0 ? (gastoTotal / kmTotal) : 0;
  
  // Eficiência Real Operacional (km por litro apurado)
  const mediaKmL = litrosTotais > 0 ? (kmTotal / litrosTotais) : 0;

  // Preço Médio Ponderado do Litro
  const precoMedioLitro = litrosTotais > 0 ? (gastoTotal / litrosTotais) : 0;

  // Atualização dos Cards
  document.getElementById('kpi-custo-km').innerText = custoPorKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/km';
  document.getElementById('kpi-gasto-total').innerText = gastoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  document.getElementById('kpi-litros-totais').innerText = `${litrosTotais.toFixed(1)} L abastecidos`;
  document.getElementById('kpi-km-total').innerText = `${kmTotal.toLocaleString('pt-BR')} km`;
  document.getElementById('kpi-total-rotas').innerText = `${rotas.length} rotas concluídas`;
  document.getElementById('kpi-media-consumo').innerText = mediaKmL > 0 ? `${mediaKmL.toFixed(2)} km/L` : '---';
  document.getElementById('kpi-preco-medio-litro').innerText = `Preço médio: ${precoMedioLitro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/L`;
}

// =========================================================================
// PERFORMANCE POR VEÍCULO (CRUZAMENTO DE ROTAS E ABASTECIMENTOS)
// =========================================================================
function processarAnalisePorVeiculo(veiculos, abastecimentos, rotas) {
  const grid = document.getElementById('grid-financeiro-veiculos');
  if (!grid) return;

  if (veiculos.length === 0) {
    grid.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">Nenhum veículo cadastrado.</td></tr>';
    return;
  }

  grid.innerHTML = '';

  veiculos.forEach(v => {
    // Identificadores possíveis para suportar a resolução retroativa de chaves
    const vId = String(v.id);
    const vFrota = String(v.nome_frota || '');
    const vPlaca = String(v.placa || '');
    const vUuid = String(v.uuid_veiculos || '');

    // Filtra despesas com combustível deste veículo
    const abastsDoCarro = abastecimentos.filter(a => 
      String(a.veiculo_id) === vId || 
      String(a.veiculo_id) === vFrota || 
      String(a.veiculo_id) === vPlaca ||
      String(a.placa) === vPlaca ||
      (a.uuid_veiculos && String(a.uuid_veiculos) === vUuid)
    );

    // Filtra rotas finalizadas deste veículo
    const rotasDoCarro = rotas.filter(r => 
      String(r.veiculo_id) === vId || 
      String(r.veiculo_id) === vFrota || 
      String(r.veiculo_id) === vPlaca ||
      String(r.placa) === vPlaca ||
      (r.uuid_veiculos && String(r.uuid_veiculos) === vUuid)
    );

    const gastoCarro = abastsDoCarro.reduce((acc, a) => acc + (Number(a.valor_total) || 0), 0);
    const litrosCarro = abastsDoCarro.reduce((acc, a) => acc + (Number(a.quantidade_litros) || 0), 0);
    const kmRodadoCarro = rotasDoCarro.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);

    const custoKmCarro = kmRodadoCarro > 0 ? (gastoCarro / kmRodadoCarro) : 0;
    const mediaKmLCarro = litrosCarro > 0 && kmRodadoCarro > 0 ? (kmRodadoCarro / litrosCarro) : null;

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";

    tr.innerHTML = `
      <td class="py-3 px-3 font-bold text-slate-800">
        <div class="flex items-center gap-2">
          <span>${v.nome_frota || v.id}</span>
          <span class="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-mono text-slate-600">${v.placa || 'Sem Placa'}</span>
        </div>
      </td>
      <td class="py-3 px-3 font-mono">${kmRodadoCarro.toLocaleString('pt-BR')} km</td>
      <td class="py-3 px-3 font-mono font-bold text-slate-700">${gastoCarro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-3 px-3 font-mono">${litrosCarro.toFixed(1)} L</td>
      <td class="py-3 px-3 font-mono font-bold ${mediaKmLCarro && mediaKmLCarro < 9 ? 'text-amber-600' : 'text-slate-800'}">
        ${mediaKmLCarro ? mediaKmLCarro.toFixed(2) + ' km/L' : '<span class="text-slate-400 font-normal">Sem base</span>'}
      </td>
      <td class="py-3 px-3 font-mono font-black ${custoKmCarro > 1.8 ? 'text-rose-600' : 'text-emerald-700'}">
        ${custoKmCarro > 0 ? custoKmCarro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
      </td>
      <td class="py-3 px-3">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${v.status === 'Disponivel' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}">
          ${v.status || 'Ativo'}
        </span>
      </td>
    `;
    grid.appendChild(tr);
  });
}

// =========================================================================
// AUDITORIA FISCAL (CUPONS ANEXADOS NO SUPABASE STORAGE)
// =========================================================================
function renderizarAuditoriaCupons(abastecimentos, veiculos) {
  const tbody = document.getElementById('grid-auditoria-cupons');
  if (!tbody) return;

  if (abastecimentos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-6 text-slate-400">Nenhum cupom ou abastecimento registrado.</td></tr>';
    return;
  }

  tbody.innerHTML = '';

  abastecimentos.slice(0, 50).forEach(a => {
    const veic = veiculos.find(v => 
      String(v.id) === String(a.veiculo_id) || 
      String(v.nome_frota) === String(a.veiculo_id) || 
      String(v.placa) === String(a.veiculo_id)
    );

    const nomeExibicao = veic?.nome_frota || a.veiculo_id || 'ARVO';
    const placaExibicao = veic?.placa || a.placa || '';

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition text-slate-700";

    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-500">
        ${new Date(a.data_hora).toLocaleDateString('pt-BR')} ${new Date(a.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </td>
      <td class="py-2.5 px-3 font-bold">
        ${nomeExibicao} <span class="text-[10px] text-slate-400 font-normal">[${placaExibicao}]</span>
      </td>
      <td class="py-2.5 px-3 uppercase text-[11px]">${a.local_posto || '-'}</td>
      <td class="py-2.5 px-3 text-[11px]">${a.tipo_combustivel || 'Gasolina'}</td>
      <td class="py-2.5 px-3 font-mono">${Number(a.quantidade_litros || 0).toFixed(2)} L</td>
      <td class="py-2.5 px-3 font-mono">R$ ${Number(a.preco_litro || 0).toFixed(2)}</td>
      <td class="py-2.5 px-3 font-mono font-bold text-emerald-700">
        ${Number(a.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </td>
      <td class="py-2.5 px-3 text-[11px] text-slate-500 truncate max-w-[140px]" title="${a.responsavel}">
        ${a.responsavel ? a.responsavel.split('@')[0] : 'admin'}
      </td>
      <td class="py-2.5 px-3 text-center">
        ${a.url_comprovante ? `
          <a href="${a.url_comprovante}" target="_blank" rel="noopener noreferrer" 
             class="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded border border-emerald-200 transition">
            <i class="ph-bold ph-receipt text-sm"></i>
            <span class="text-[10px] font-bold">Ver Nota</span>
          </a>
        ` : `
          <span class="text-slate-300 text-[11px]">Sem cupom</span>
        `}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// =========================================================================
// CONTROLE DOS MODAIS POPUP E POVOAMENTO DOS CARROS
// =========================================================================

// Variável de cache para garantir que os selects sempre tenham os dados
let cacheListaVeiculos = [];

function abrirModalContratoAluguel() {
  if (cacheListaVeiculos.length > 0) popularSelectsFormulariosFinanceiros(cacheListaVeiculos);
  document.getElementById('modal-contrato-aluguel')?.classList.remove('hidden');
}

function fecharModalContratoAluguel() {
  document.getElementById('modal-contrato-aluguel')?.classList.add('hidden');
  document.getElementById('formContratoAluguel')?.reset();
}

function abrirModalCustosSeguros() {
  if (cacheListaVeiculos.length > 0) popularSelectsFormulariosFinanceiros(cacheListaVeiculos);
  document.getElementById('modal-custos-seguros')?.classList.remove('hidden');
}

function fecharModalCustosSeguros() {
  document.getElementById('modal-custos-seguros')?.classList.add('hidden');
  document.getElementById('formCustosSeguros')?.reset();
}

// Povoa os selects nos modais popup com os carros ativos do banco
function popularSelectsFormulariosFinanceiros(veiculos) {
  cacheListaVeiculos = veiculos || [];
  const selAluguel = document.getElementById('aluguel-veiculo');
  const selSeguro = document.getElementById('seguro-veiculo');

  if (!selAluguel && !selSeguro) return;

  if (cacheListaVeiculos.length === 0) {
    if (selAluguel) selAluguel.innerHTML = '<option value="">Nenhum veículo disponível</option>';
    if (selSeguro) selSeguro.innerHTML = '<option value="">Nenhum veículo disponível</option>';
    return;
  }

  let options = '<option value="">Selecione o veículo...</option>';
  cacheListaVeiculos.forEach(v => {
    const nome = v.nome_frota || v.id;
    const placa = v.placa ? `[${v.placa}]` : '';
    const marca = v.marca ? `- ${v.marca}` : '';
    const identificador = v.placa || v.id;
    options += `<option value="${identificador}">${nome} ${marca} ${placa}</option>`;
  });

  if (selAluguel) selAluguel.innerHTML = options;
  if (selSeguro) selSeguro.innerHTML = options;
}

// =========================================================================
// CONTROLE DE PERÍODOS E FILTROS DE DATA (PADRÃO RELATÓRIOS E GRÁFICOS)
// =========================================================================
let periodoAtual = 'mes';
let dadosBrutosAbastecimentos = [];
let dadosBrutosRotas = [];
let dadosBrutosVeiculos = [];

// Define as datas do input conforme o atalho clicado
function setPeriodoFinanceiro(p) {
  periodoAtual = p;

  // Atualiza a cor dos botões de atalho
  ['dia', 'semana', 'mes', 'trimestre', 'ano', 'todos'].forEach(btn => {
    const item = document.getElementById(`btn-periodo-${btn}`);
    if (item) {
      if (btn === p) {
        item.className = "flex-1 py-1.5 px-3 rounded-lg bg-emerald-800 text-white shadow transition text-center whitespace-nowrap";
      } else {
        item.className = "flex-1 py-1.5 px-3 rounded-lg text-slate-600 hover:text-slate-900 transition text-center whitespace-nowrap";
      }
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
    // Apenas a data de hoje
  } else if (p === 'semana') {
    // Início da semana (domingo) até hoje
    dIni.setDate(hoje.getDate() - hoje.getDay());
  } else if (p === 'mes') {
    // Primeiro dia do mês corrente
    dIni = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  } else if (p === 'trimestre') {
    // Início do trimestre corrente
    const mesInicioTrimestre = Math.floor(hoje.getMonth() / 3) * 3;
    dIni = new Date(hoje.getFullYear(), mesInicioTrimestre, 1);
  } else if (p === 'ano') {
    // Primeiro dia do ano corrente
    dIni = new Date(hoje.getFullYear(), 0, 1);
  }

  const fmt = (d) => {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };

  if (dtIniInput) dtIniInput.value = fmt(dIni);
  if (dtFimInput) dtFimInput.value = fmt(dFim);

  aplicarFiltrosEAtualizarFinanceiro();
}

function aplicarFiltroPersonalizadoDatas() {
  // Quando o usuário digita datas manualmente, desseleciona os botões rápidos
  ['dia', 'semana', 'mes', 'trimestre', 'ano', 'todos'].forEach(btn => {
    const item = document.getElementById(`btn-periodo-${btn}`);
    if (item) item.className = "flex-1 py-1.5 px-3 rounded-lg text-slate-600 hover:text-slate-900 transition text-center whitespace-nowrap";
  });
  periodoAtual = 'custom';
}

function limparFiltrosFinanceiro() {
  document.getElementById('filtro-data-inicio').value = '';
  document.getElementById('filtro-data-fim').value = '';
  setPeriodoFinanceiro('mes');
}

// Carrega os dados brutos uma única vez ou ao forçar atualização
async function carregarMetricasFinanceiras() {
  try {
    const [resAbast, resRotas, resVeiculos] = await Promise.all([
      db.from('abastecimentos').select('*').order('data_hora', { ascending: false }),
      db.from('rotas').select('*').eq('status', 'Concluida').order('data_retorno', { ascending: false }),
      db.from('veiculos').select('*')
    ]);

    if (resAbast.error) throw resAbast.error;
    if (resRotas.error) throw resRotas.error;
    if (resVeiculos.error) throw resVeiculos.error;

    dadosBrutosAbastecimentos = resAbast.data || [];
    dadosBrutosRotas = resRotas.data || [];
    dadosBrutosVeiculos = resVeiculos.data || [];

    if (typeof popularSelectsFormulariosFinanceiros === 'function') {
      popularSelectsFormulariosFinanceiros(dadosBrutosVeiculos);
    }

    // Inicializa no padrão "Mês"
    setPeriodoFinanceiro('mes');
  } catch (err) {
    console.error("Erro ao carregar dados financeiros:", err);
    alert("Falha ao carregar métricas: " + err.message);
  }
}

// Filtra as informações com base no intervalo de datas e recalcula as métricas
function aplicarFiltrosEAtualizarFinanceiro() {
  const dtIni = document.getElementById('filtro-data-inicio')?.value;
  const dtFim = document.getElementById('filtro-data-fim')?.value;

  const dFiltroIni = dtIni ? new Date(`${dtIni}T00:00:00`) : null;
  const dFiltroFim = dtFim ? new Date(`${dtFim}T23:59:59`) : null;

  // Filtra Abastecimentos
  const abastsFiltrados = dadosBrutosAbastecimentos.filter(a => {
    if (!a.data_hora) return true;
    const d = new Date(a.data_hora);
    if (dFiltroIni && d < dFiltroIni) return false;
    if (dFiltroFim && d > dFiltroFim) return false;
    return true;
  });

  // Filtra Rotas
  const rotasFiltradas = dadosBrutosRotas.filter(r => {
    const refData = r.data_retorno || r.data_saida;
    if (!refData) return true;
    const d = new Date(refData);
    if (dFiltroIni && d < dFiltroIni) return false;
    if (dFiltroFim && d > dFiltroFim) return false;
    return true;
  });

  // Atualiza os painéis com os dados refinados pelo período
  processarTotaisGerais(abastsFiltrados, rotasFiltradas);
  processarAnalisePorVeiculo(dadosBrutosVeiculos, abastsFiltrados, rotasFiltradas);
  renderizarAuditoriaCupons(abastsFiltrados, dadosBrutosVeiculos);
}

// Expõe para o escopo global
window.abrirModalContratoAluguel = abrirModalContratoAluguel;
window.fecharModalContratoAluguel = fecharModalContratoAluguel;
window.abrirModalCustosSeguros = abrirModalCustosSeguros;
window.fecharModalCustosSeguros = fecharModalCustosSeguros;
window.popularSelectsFormulariosFinanceiros = popularSelectsFormulariosFinanceiros;
window.setPeriodoFinanceiro = setPeriodoFinanceiro;
window.aplicarFiltroPersonalizadoDatas = aplicarFiltroPersonalizadoDatas;
window.aplicarFiltrosEAtualizarFinanceiro = aplicarFiltrosEAtualizarFinanceiro;
window.limparFiltrosFinanceiro = limparFiltrosFinanceiro;