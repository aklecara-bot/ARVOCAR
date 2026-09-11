// =========================================================================
// MÓDULO FINANCEIRO INTEGRADO - ARVOCAR
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
let cacheListaVeiculos = [];
let periodoAtual = 'mes';

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
// CARREGAMENTO CENTRALIZADO DO BANCO DE DADOS
// =========================================================================
async function carregarMetricasFinanceiras() {
  try {
    const [resAbast, resRotas, resVeiculos, resManut] = await Promise.all([
      db.from('abastecimentos').select('*').order('data_hora', { ascending: false }),
      db.from('rotas').select('*').eq('status', 'Concluida').order('data_retorno', { ascending: false }),
      db.from('veiculos').select('*'),
      db.from('manutencoes_preventivas').select('*').order('data_ultima_troca', { ascending: false })
    ]);

    if (resAbast.error) throw resAbast.error;
    if (resRotas.error) throw resRotas.error;
    if (resVeiculos.error) throw resVeiculos.error;
    if (resManut.error) throw resManut.error;

    dadosBrutosAbastecimentos = resAbast.data || [];
    dadosBrutosRotas = resRotas.data || [];
    dadosBrutosVeiculos = resVeiculos.data || [];
    dadosBrutosManutencoes = resManut.data || [];
    cacheListaVeiculos = dadosBrutosVeiculos;

    popularSelectsFormulariosFinanceiros(cacheListaVeiculos);
    setPeriodoFinanceiro('mes');
  } catch (err) {
    console.error("Erro ao carregar dados financeiros:", err);
    alert("Falha ao carregar dados: " + err.message);
  }
}

// =========================================================================
// FILTRAGEM TEMPORAL E POR CATEGORIA DE CUSTO
// =========================================================================
function setPeriodoFinanceiro(p) {
  periodoAtual = p;
  ['dia', 'semana', 'mes', 'trimestre', 'ano', 'todos'].forEach(btn => {
    const item = document.getElementById(`btn-periodo-${btn}`);
    if (item) {
      item.className = (btn === p)
        ? "flex-1 py-1.5 px-3 rounded-lg bg-emerald-800 text-white shadow transition text-center whitespace-nowrap"
        : "flex-1 py-1.5 px-3 rounded-lg text-slate-600 hover:text-slate-900 transition text-center whitespace-nowrap";
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
    if (item) item.className = "flex-1 py-1.5 px-3 rounded-lg text-slate-600 hover:text-slate-900 transition text-center whitespace-nowrap";
  });
  periodoAtual = 'custom';
}

function limparFiltrosFinanceiro() {
  document.getElementById('filtro-data-inicio').value = '';
  document.getElementById('filtro-data-fim').value = '';
  document.getElementById('filtro-tipo-custo').value = 'TODOS';
  setPeriodoFinanceiro('mes');
}

function aplicarFiltrosEAtualizarFinanceiro() {
  const dtIni = document.getElementById('filtro-data-inicio')?.value;
  const dtFim = document.getElementById('filtro-data-fim')?.value;
  const tipoCusto = document.getElementById('filtro-tipo-custo')?.value || 'TODOS';

  const dFiltroIni = dtIni ? new Date(`${dtIni}T00:00:00`) : null;
  const dFiltroFim = dtFim ? new Date(`${dtFim}T23:59:59`) : null;

  // Filtra Abastecimentos
  let abastsFiltrados = (tipoCusto === 'MANUTENCAO') ? [] : dadosBrutosAbastecimentos.filter(a => {
    if (!a.data_hora) return true;
    const d = new Date(a.data_hora);
    if (dFiltroIni && d < dFiltroIni) return false;
    if (dFiltroFim && d > dFiltroFim) return false;
    return true;
  });

  // Filtra Manutenções Preventivas
  let manutsFiltradas = (tipoCusto === 'COMBUSTIVEL') ? [] : dadosBrutosManutencoes.filter(m => {
    const dataRef = m.data_ultima_troca || m.created_at;
    if (!dataRef) return true;
    const d = new Date(dataRef);
    if (dFiltroIni && d < dFiltroIni) return false;
    if (dFiltroFim && d > dFiltroFim) return false;
    return true;
  });

  // Filtra Rotas Concluídas
  const rotasFiltradas = dadosBrutosRotas.filter(r => {
    const refData = r.data_retorno || r.data_saida;
    if (!refData) return true;
    const d = new Date(refData);
    if (dFiltroIni && d < dFiltroIni) return false;
    if (dFiltroFim && d > dFiltroFim) return false;
    return true;
  });

  // Atualiza painéis e tabelas
  processarTotaisGerais(abastsFiltrados, manutsFiltradas, rotasFiltradas);
  processarAnalisePorVeiculo(dadosBrutosVeiculos, abastsFiltrados, manutsFiltradas, rotasFiltradas);
  processarTabelaDepreciacao(dadosBrutosVeiculos, rotasFiltradas);
  renderizarAuditoriaCupons(abastsFiltrados, dadosBrutosVeiculos);
  renderizarAuditoriaManutencoes(manutsFiltradas, dadosBrutosVeiculos);
}

// =========================================================================
// CÁLCULOS TOTAIS E KPIS
// =========================================================================
function processarTotaisGerais(abastecimentos, manutenções, rotas) {
  const gastoComb = abastecimentos.reduce((acc, a) => acc + (Number(a.valor_total) || 0), 0);
  const gastoManut = manutenções.reduce((acc, m) => acc + (Number(m.valor_total) || 0), 0);
  const gastoTotal = gastoComb + gastoManut;

  const kmTotal = rotas.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);
  const custoPorKm = kmTotal > 0 ? (gastoTotal / kmTotal) : 0;
  const depreciacaoTotal = kmTotal * 0.30; // R$ 0,12 peças + R$ 0,18 desvalorização contábil por km

  document.getElementById('kpi-custo-km').innerText = custoPorKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/km';
  document.getElementById('kpi-gasto-total').innerText = gastoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  document.getElementById('kpi-despesa-detalhe').innerText = `Combustível: ${gastoComb.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Manut: ${gastoManut.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
  document.getElementById('kpi-km-total').innerText = `${kmTotal.toLocaleString('pt-BR')} km`;
  document.getElementById('kpi-total-rotas').innerText = `${rotas.length} rotas concluídas`;
  document.getElementById('kpi-depreciacao-total').innerText = depreciacaoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// =========================================================================
// TABELA 1: DESEMPENHO POR VEÍCULO
// =========================================================================
function processarAnalisePorVeiculo(veiculos, abastecimentos, manutenções, rotas) {
  const grid = document.getElementById('grid-financeiro-veiculos');
  if (!grid) return;

  if (!veiculos || veiculos.length === 0) {
    grid.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">Nenhum veículo cadastrado.</td></tr>';
    return;
  }

  grid.innerHTML = '';

  // Função auxiliar para padronizar placas (remove traços, espaços e sufixos)
  const limparPlaca = (p) => (p || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();

  veiculos.forEach(v => {
    const vPlacaRaw = (v.placa || '').trim().toUpperCase();
    const vPlacaPura = limparPlaca(vPlacaRaw);
    const vNome = (v.nome_frota || v.id || '').trim().toUpperCase();
    const vUuid = String(v.uuid_veiculos || '');

    // 1. Filtro de Rotas do Carro
    const rotasCarro = (rotas || []).filter(r => {
      const rPlaca = (r.placa || '').trim().toUpperCase();
      const rPlacaPura = limparPlaca(rPlaca);
      const rVeicId = (r.veiculo_id ? String(r.veiculo_id) : '').trim().toUpperCase();
      const rVeicPuro = limparPlaca(rVeicId);

      return (vPlacaPura && (rPlacaPura === vPlacaPura || rVeicPuro === vPlacaPura)) ||
             (vNome && rVeicId === vNome) ||
             (vUuid && String(r.uuid_veiculos) === vUuid);
    });

    // 2. Filtro de Abastecimentos do Carro
    const abastsCarro = (abastecimentos || []).filter(a => {
      const aPlaca = (a.placa || '').trim().toUpperCase();
      const aPlacaPura = limparPlaca(aPlaca);
      const aVeicId = (a.veiculo_id ? String(a.veiculo_id) : '').trim().toUpperCase();
      const aVeicPuro = limparPlaca(aVeicId);

      return (vPlacaPura && (aPlacaPura === vPlacaPura || aVeicPuro === vPlacaPura)) ||
             (vNome && aVeicId === vNome) ||
             (vUuid && String(a.uuid_veiculos) === vUuid);
    });

    // 3. Filtro de Manutenções do Carro
    const manutsCarro = (manutenções || []).filter(m => {
      const mPlaca = (m.placa || '').trim().toUpperCase();
      const mPlacaPura = limparPlaca(mPlaca);
      return (vPlacaPura && mPlacaPura === vPlacaPura) || (vNome && mPlaca === vNome);
    });

    // 4. Apuração de Quilometragem (Rotas ou Amplitude de Abastecimentos)
    const kmRotas = rotasCarro.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);

    let kmAbast = 0;
    const odometros = abastsCarro
      .map(a => Number(a.km_atual))
      .filter(km => km && !isNaN(km) && km > 0)
      .sort((a, b) => a - b);

    if (odometros.length >= 2) {
      kmAbast = odometros[odometros.length - 1] - odometros[0];
    }

    // Se tiver rotas no sistema, prioriza rotas; caso contrário, usa a amplitude das notas
    const kmRodado = kmRotas > 0 ? kmRotas : kmAbast;

    // 5. Cálculos Financeiros
    const gastoCombustivel = abastsCarro.reduce((acc, a) => acc + (Number(a.valor_total) || 0), 0);
    const gastoManutencao = manutsCarro.reduce((acc, m) => acc + (Number(m.valor_total) || 0), 0);
    const gastoTotal = gastoCombustivel + gastoManutencao;
    const custoPorKm = kmRodado > 0 ? (gastoTotal / kmRodado) : 0;

    // 6. Montagem da Linha da Tabela
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="py-3 px-3 font-bold text-slate-800">
        <div class="flex items-center gap-2">
          <span class="font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-xs text-slate-900 font-black">${v.placa || 'Sem Placa'}</span>
          <span class="text-xs text-slate-500">(${v.nome_frota || v.id})</span>
        </div>
      </td>
      <td class="py-3 px-3 font-mono font-bold">${kmRodado.toLocaleString('pt-BR')} km</td>
      <td class="py-3 px-3 font-mono text-slate-700">${gastoCombustivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-3 px-3 font-mono text-amber-700 font-semibold">${gastoManutencao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-3 px-3 font-mono font-bold text-slate-900">${gastoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-3 px-3 font-mono font-black ${custoPorKm > 2.0 ? 'text-rose-600' : 'text-emerald-700'}">
        ${custoPorKm > 0 ? custoPorKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + '/km' : 'R$ 0,00'}
      </td>
      <td class="py-3 px-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
          v.status === 'Disponivel' 
            ? 'bg-emerald-100 text-emerald-800' 
            : (v.status === 'Fora de Uso' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')
        }">
          ${v.status || 'Ativo'}
        </span>
      </td>
    `;
    grid.appendChild(tr);
  });
}

// =========================================================================
// TABELA 2: DEPRECIAÇÃO SOB NOSSA JURISDIÇÃO (POR PLACA)
// =========================================================================
function processarTabelaDepreciacao(veiculos, rotas) {
  const grid = document.getElementById('grid-depreciacao-veiculos');
  if (!grid) return;

  grid.innerHTML = '';

  veiculos.forEach(v => {
    const vPlaca = (v.placa || '').trim().toUpperCase();
    const vNome = (v.nome_frota || v.id || '').trim().toUpperCase();
    const vUuid = String(v.uuid_veiculos || '');

    const rotasCarro = rotas.filter(r => {
      const rPlaca = (r.placa || '').trim().toUpperCase();
      const rVeicId = (r.veiculo_id ? String(r.veiculo_id) : '').trim().toUpperCase();
      return (vPlaca && (rPlaca === vPlaca || rVeicId === vPlaca)) ||
        (vNome && rVeicId === vNome) ||
        (vUuid && String(r.uuid_veiculos) === vUuid);
    });

    const deltaKm = rotasCarro.reduce((acc, r) => acc + (Number(r.km_total) || 0), 0);
    const taxaPecas = 0.12;
    const taxaVeiculo = 0.18;
    const depPecas = deltaKm * taxaPecas;
    const depVeiculo = deltaKm * taxaVeiculo;
    const depTotal = depPecas + depVeiculo;

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="py-3 px-3 font-mono font-black text-slate-900 text-xs">${v.placa || 'Sem Placa'}</td>
      <td class="py-3 px-3 font-semibold text-slate-700">${v.nome_frota || v.id} <span class="text-[11px] text-slate-400 font-normal">- ${v.marca || ''}</span></td>
      <td class="py-3 px-3 font-mono font-bold text-slate-800">${deltaKm.toLocaleString('pt-BR')} km</td>
      <td class="py-3 px-3 font-mono text-slate-500">R$ ${(taxaPecas + taxaVeiculo).toFixed(2)}/km</td>
      <td class="py-3 px-3 font-mono text-amber-800">${depPecas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-3 px-3 font-mono text-slate-700">${depVeiculo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
      <td class="py-3 px-3 font-mono font-black text-rose-700">${depTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
    `;
    grid.appendChild(tr);
  });
}

// =========================================================================
// AUDITORIA: NOTAS DE COMBUSTÍVEL
// =========================================================================
function renderizarAuditoriaCupons(abastecimentos, veiculos) {
  const tbody = document.getElementById('grid-auditoria-cupons');
  if (!tbody) return;

  if (abastecimentos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-6 text-slate-400">Nenhum cupom de combustível registrado no período.</td></tr>';
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
        ` : '<span class="text-slate-300 text-[11px]">Sem cupom</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// =========================================================================
// AUDITORIA: NOTAS DE MANUTENÇÃO
// =========================================================================
function renderizarAuditoriaManutencoes(manutenções, veiculos) {
  const tbody = document.getElementById('grid-auditoria-manutencoes');
  if (!tbody) return;

  if (manutenções.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">Nenhum registro de manutenção ou nota fiscal encontrado no período.</td></tr>';
    return;
  }

  tbody.innerHTML = '';
  manutenções.slice(0, 50).forEach(m => {
    const dataFmt = m.data_ultima_troca ? new Date(m.data_ultima_troca).toLocaleDateString('pt-BR') : '-';
    const valorFmt = m.valor_total ? Number(m.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-';

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition text-slate-700";
    tr.innerHTML = `
      <td class="py-2.5 px-3 font-mono text-[11px] text-slate-500">${dataFmt}</td>
      <td class="py-2.5 px-3 font-mono font-bold text-slate-900">${m.placa || '-'}</td>
      <td class="py-2.5 px-3 font-semibold">${m.item || '-'}</td>
      <td class="py-2.5 px-3 font-mono">${Number(m.km_ultima_troca || 0).toLocaleString('pt-BR')} km</td>
      <td class="py-2.5 px-3 font-mono font-bold text-emerald-700">${valorFmt}</td>
      <td class="py-2.5 px-3 uppercase text-[11px] text-slate-600">${m.oficina || '-'}</td>
      <td class="py-2.5 px-3 text-center">
        ${m.url_comprovante ? `
          <a href="${m.url_comprovante}" target="_blank" rel="noopener noreferrer" 
             class="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200 transition font-bold text-[10px]">
            <i class="ph-bold ph-receipt text-xs"></i> Ver Nota
          </a>
        ` : '<span class="text-slate-300 text-[10px]">Sem nota</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// =========================================================================
// GERENCIAMENTO DOS POPUPS (CARROS, EQUIPAMENTOS, VIAGENS)
// =========================================================================

// 1. Popup de Carros (Concentra Contrato e Seguro)
function abrirModalParametrosCarros() {
  if (cacheListaVeiculos.length > 0) popularSelectsFormulariosFinanceiros(cacheListaVeiculos);
  alternarAbaCarros('contrato');
  document.getElementById('modal-parametros-carros')?.classList.remove('hidden');
}

function fecharModalParametrosCarros() {
  document.getElementById('modal-parametros-carros')?.classList.add('hidden');
  document.getElementById('formContratoAluguel')?.reset();
  document.getElementById('formCustosSeguros')?.reset();
}

function alternarAbaCarros(subaba) {
  const viewContrato = document.getElementById('subview-car-contrato');
  const viewSeguro = document.getElementById('subview-car-seguro');
  const btnContrato = document.getElementById('tab-btn-car-contrato');
  const btnSeguro = document.getElementById('tab-btn-car-seguro');

  if (subaba === 'contrato') {
    viewContrato?.classList.remove('hidden');
    viewSeguro?.classList.add('hidden');
    if (btnContrato) btnContrato.className = "flex-1 py-2 rounded-lg bg-amber-600 text-white shadow transition text-center flex items-center justify-center gap-1.5";
    if (btnSeguro) btnSeguro.className = "flex-1 py-2 rounded-lg text-slate-600 hover:text-slate-900 transition text-center flex items-center justify-center gap-1.5";
  } else {
    viewContrato?.classList.add('hidden');
    viewSeguro?.classList.remove('hidden');
    if (btnSeguro) btnSeguro.className = "flex-1 py-2 rounded-lg bg-emerald-700 text-white shadow transition text-center flex items-center justify-center gap-1.5";
    if (btnContrato) btnContrato.className = "flex-1 py-2 rounded-lg text-slate-600 hover:text-slate-900 transition text-center flex items-center justify-center gap-1.5";
  }
}

// 2. Popup de Equipamentos (Em branco)
function abrirModalEquipamentos() {
  document.getElementById('modal-equipamentos')?.classList.remove('hidden');
}

function fecharModalEquipamentos() {
  document.getElementById('modal-equipamentos')?.classList.add('hidden');
}

// 3. Popup de Viagens (Em branco)
function abrirModalViagens() {
  document.getElementById('modal-viagens')?.classList.remove('hidden');
}

function fecharModalViagens() {
  document.getElementById('modal-viagens')?.classList.add('hidden');
}

// Povoa os selects nos modais com os carros ativos do banco
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
// SALVAR NO BANCO: CONTRATO DE ALUGUEL & CUSTOS/SEGUROS
// =========================================================================
async function salvarContratoAluguel(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-salvar-contrato');

  const payload = {
    veiculo_id: document.getElementById('aluguel-veiculo')?.value,
    data_inicio: document.getElementById('aluguel-inicio')?.value,
    data_termino: document.getElementById('aluguel-termino')?.value,
    responsavel: document.getElementById('aluguel-responsavel')?.value.trim(),
    codigo_reserva: document.getElementById('aluguel-cod-reserva')?.value.trim() || null,
    codigo_aluguel: document.getElementById('aluguel-cod-aluguel')?.value.trim() || null,
    tarifa_mensal: parseFloat(document.getElementById('aluguel-tarifa')?.value) || 0,
    valor_km_excedente: parseFloat(document.getElementById('aluguel-km-excedente')?.value) || 0,
    franquia_km_dia: parseFloat(document.getElementById('aluguel-franquia')?.value) || 0
  };

  if (!payload.veiculo_id) {
    alert("Selecione um veículo.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Salvando...`;
  }

  try {
    const { error } = await db.from('contratos_aluguel').insert([payload]);
    if (error) throw error;

    alert("✅ Contrato de aluguel cadastrado com sucesso!");
    document.getElementById('formContratoAluguel')?.reset();
    fecharModalParametrosCarros();
  } catch (err) {
    console.error("Erro ao salvar contrato:", err);
    alert("Erro ao cadastrar contrato: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check"></i> Cadastrar Contrato`;
    }
  }
}

async function salvarCustosSeguros(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-salvar-custos');

  const payload = {
    veiculo_id: document.getElementById('seguro-veiculo')?.value,
    limite_reparos: parseFloat(document.getElementById('seguro-limite-reparos')?.value) || 0,
    danos_terceiros: parseFloat(document.getElementById('seguro-danos-terceiros')?.value) || 0,
    cobertura_pt_roubo: parseFloat(document.getElementById('seguro-cobertura-pt')?.value) || 0,
    inicio_vigencia: document.getElementById('seguro-inicio')?.value,
    fim_vigencia: document.getElementById('seguro-fim')?.value,
    km_aluguel: parseFloat(document.getElementById('seguro-km-aluguel')?.value) || 0
  };

  if (!payload.veiculo_id) {
    alert("Selecione um veículo.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Salvando...`;
  }

  try {
    const { error } = await db.from('custos_seguros').insert([payload]);
    if (error) throw error;

    alert("✅ Custos e seguros do veículo cadastrados!");
    document.getElementById('formCustosSeguros')?.reset();
    fecharModalParametrosCarros();
  } catch (err) {
    console.error("Erro ao salvar custos/seguros:", err);
    alert("Erro ao cadastrar: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check"></i> Cadastrar Custos`;
    }
  }
}

// =========================================================================
// EXPOSIÇÃO GLOBAL
// =========================================================================
window.logout = logout;
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
window.popularSelectsFormulariosFinanceiros = popularSelectsFormulariosFinanceiros;