// =========================================================================
// 1. CONFIGURAÇÃO DO SUPABASE
// =========================================================================
const SUPABASE_URL = "https://SEU_PROJETO.supabase.co"; // Substitua pela sua URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";        // Substitua pela sua Anon Key

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estados em memória sincronizados exclusivamente com o Supabase
let usuarios = [];
let veiculos = [];
let rotas = [];
let currentUserIndex = 0;

// =========================================================================
// 2. FUNÇÕES DE BUSCA (SELECT) NO SUPABASE
// =========================================================================

async function carregarTodosDadosDoBanco() {
  try {
    // 1. Buscar Veículos
    const { data: dadosVeiculos, error: errV } = await db
      .from('veiculos')
      .select('*')
      .order('id');
    if (errV) throw errV;
    veiculos = dadosVeiculos || [];

    // 2. Buscar Usuários
    const { data: dadosUsuarios, error: errU } = await db
      .from('usuarios')
      .select('*')
      .order('nome');
    if (errU) throw errU;
    usuarios = dadosUsuarios || [];

    // 3. Buscar Rotas (as mais recentes primeiro)
    const { data: dadosRotas, error: errR } = await db
      .from('rotas')
      .select('*')
      .order('created_at', { ascending: false });
    if (errR) throw errR;
    rotas = dadosRotas || [];

    // Atualizar Interface com os dados do banco
    atualizarUsuarioNoCabecalho();
    renderAll();
  } catch (error) {
    console.error("Erro ao carregar dados do Supabase:", error);
    alert("Erro de conexão com o Supabase. Verifique suas chaves e conexão.");
  }
}

// =========================================================================
// 3. OPERAÇÃO DE ROTAS (INSERT E UPDATE)
// =========================================================================

// Iniciar Rota (Check-out)
async function handleInicioRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-inicio');
  const veiculoId = document.getElementById('form-inicio-veiculo').value;
  const veiculo = veiculos.find(v => v.id === veiculoId);
  const user = usuarios[currentUserIndex];

  if (!veiculo || !user) {
    alert("Selecione um veículo e condutor válidos.");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;

  const novaRota = {
    id: `ROTA-2026-${String(rotas.length + 261).padStart(4, '0')}`,
    veiculo_id: veiculoId,
    responsavel: user.email,
    origem: document.getElementById('form-inicio-origem').value,
    destino: null,
    finalidade: document.getElementById('form-inicio-finalidade').value,
    km_saida: Number(veiculo.km_atual),
    km_retorno: null,
    km_total: 0,
    consumo_litros: null,
    anomalia: '',
    status: 'Em Uso'
  };

  try {
    // 1. Insere nova rota
    const { error: erroRota } = await db.from('rotas').insert([novaRota]);
    if (erroRota) throw erroRota;

    // 2. Atualiza status do veículo para 'Em Uso'
    const { error: erroVeiculo } = await db
      .from('veiculos')
      .update({ status: 'Em Uso' })
      .eq('id', veiculoId);
    if (erroVeiculo) throw erroVeiculo;

    e.target.reset();
    alert(`Rota ${novaRota.id} iniciada com sucesso para o veículo ${veiculoId}!`);
    await carregarTodosDadosDoBanco();
    setSubTab('operacao', 'minhas-rotas');
  } catch (err) {
    console.error("Erro ao iniciar rota:", err);
    alert("Erro ao gravar no Supabase: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph-bold ph-check-circle text-lg"></i> Confirmar Saída no Supabase`;
  }
}

// Finalizar Rota (Check-in)
async function handleFimRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-fim');
  const rotaId = document.getElementById('form-fim-rota-select').value;
  const kmFinal = parseFloat(document.getElementById('form-fim-km').value);
  const destino = document.getElementById('form-fim-destino').value;
  
  const rota = rotas.find(r => r.id === rotaId);
  const veiculo = veiculos.find(v => v.id === rota.veiculo_id);

  if (kmFinal < rota.km_saida) {
    alert("Erro: O KM Final não pode ser inferior ao KM de Saída!");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;

  const situacao = document.querySelector('input[name="situacao_carro"]:checked').value;
  let anomaliaTexto = situacao === 'COM' ? document.getElementById('form-fim-anomalia').value.trim() : '';

  const deltaKm = kmFinal - rota.km_saida;
  const medConsumo = (Number(veiculo.consumo_min) + Number(veiculo.consumo_max)) / 2;
  const litrosEst = Number((deltaKm / medConsumo).toFixed(2));

  try {
    // 1. Atualiza a rota no banco
    const { error: erroRota } = await db
      .from('rotas')
      .update({
        km_retorno: kmFinal,
        km_total: deltaKm,
        consumo_litros: litrosEst,
        destino: destino,
        status: 'Concluida',
        anomalia: anomaliaTexto,
        data_retorno: new Date().toISOString()
      })
      .eq('id', rotaId);
    if (erroRota) throw erroRota;

    // 2. Atualiza o hodômetro e disponibilidade do carro
    const { error: erroVeiculo } = await db
      .from('veiculos')
      .update({
        km_atual: kmFinal,
        status: 'Disponivel',
        anomalias: anomaliaTexto || veiculo.anomalias
      })
      .eq('id', veiculo.id);
    if (erroVeiculo) throw erroVeiculo;

    e.target.reset();
    document.getElementById('fim-detalhes-viagem').classList.add('hidden');
    toggleAnomaliaInput(false);

    alert(`Rota ${rotaId} encerrada! KM Rodado: ${deltaKm} km (Consumo est.: ~${litrosEst} L).`);
    await carregarTodosDadosDoBanco();
    setSubTab('operacao', 'minhas-rotas');
  } catch (err) {
    console.error("Erro ao encerrar rota:", err);
    alert("Erro ao gravar no Supabase: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph-bold ph-check text-lg"></i> Finalizar Rota e Gravar no Supabase`;
  }
}

// =========================================================================
// 4. CADASTROS (GESTÃO)
// =========================================================================

// Cadastrar Veículo
async function handleCadVeiculo(e) {
  e.preventDefault();
  const novoCarro = {
    id: document.getElementById('cad-v-id').value.toUpperCase().trim(),
    placa: document.getElementById('cad-v-placa').value.toUpperCase().trim(),
    marca: document.getElementById('cad-v-marca').value.trim(),
    tanque: parseFloat(document.getElementById('cad-v-tanque').value),
    consumo_min: parseFloat(document.getElementById('cad-v-consumomin').value),
    consumo_max: parseFloat(document.getElementById('cad-v-consumomax').value),
    km_atual: parseFloat(document.getElementById('cad-v-kminicial').value),
    status: 'Disponivel',
    anomalias: ''
  };

  try {
    const { error } = await db.from('veiculos').insert([novoCarro]);
    if (error) throw error;

    e.target.reset();
    alert(`Veículo ${novoCarro.id} salvo no Supabase com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    console.error("Erro ao cadastrar veículo:", err);
    alert("Erro ao cadastrar: " + err.message);
  }
}

// Cadastrar Usuário
async function handleCadUsuario(e) {
  e.preventDefault();
  const novoUsuario = {
    nome: document.getElementById('cad-u-nome').value.trim(),
    email: document.getElementById('cad-u-email').value.trim().toLowerCase(),
    cnh: document.getElementById('cad-u-cnh').value.trim(),
    status: 'Ativo'
  };

  try {
    const { error } = await db.from('usuarios').insert([novoUsuario]);
    if (error) throw error;

    e.target.reset();
    alert(`Usuário ${novoUsuario.nome} registrado no Supabase!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    console.error("Erro ao cadastrar usuário:", err);
    alert("Erro ao cadastrar usuário: " + err.message);
  }
}

// =========================================================================
// 5. RENDERIZAÇÃO E INTERFACE (DOM)
// =========================================================================

function renderAll() {
  renderFleetGrid();
  renderDashboardKPIs();
  renderSelectVeiculosInicio();
  renderSelectRotasFim();
  renderHistorico();
  renderTabelaVeiculosCad();
  renderTabelaUsuariosCad();
}

function renderDashboardKPIs() {
  document.getElementById('kpi-total-veiculos').innerText = veiculos.length;
  document.getElementById('kpi-em-rota').innerText = veiculos.filter(v => v.status === 'Em Uso').length;
  document.getElementById('kpi-disponiveis').innerText = veiculos.filter(v => v.status === 'Disponivel').length;
  document.getElementById('kpi-anomalias').innerText = veiculos.filter(v => v.anomalias && v.anomalias.trim() !== '').length;
}

function renderFleetGrid() {
  const container = document.getElementById('fleetGrid');
  container.innerHTML = '';

  veiculos.forEach(v => {
    const isEmUso = v.status === 'Em Uso';
    const card = document.createElement('div');
    card.className = "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition";
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-base font-extrabold text-slate-900">${v.id}</span>
          <span class="text-[11px] px-2.5 py-0.5 rounded-full font-bold ${isEmUso ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">
            ${isEmUso ? '• Em Rota' : '• Disponível'}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs text-slate-500 mb-3">
          <span>${v.marca}</span>
          <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-700">${v.placa}</span>
        </div>

        <div class="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-3 space-y-1">
          <div class="flex justify-between items-baseline">
            <span class="text-[10px] uppercase font-bold text-slate-400">Hodômetro</span>
            <span class="text-lg font-bold font-mono text-slate-800">${Number(v.km_atual).toLocaleString('pt-BR')} km</span>
          </div>
          <div class="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
            <span>Tanque: <b>${v.tanque} L</b></span>
            <span>Méd: <b>${((Number(v.consumo_min) + Number(v.consumo_max))/2).toFixed(1)} km/L</b></span>
          </div>
        </div>

        ${v.anomalias ? `
          <div class="bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-xs text-rose-700 flex items-start gap-2">
            <i class="ph-bold ph-warning text-sm shrink-0 mt-0.5"></i>
            <span class="line-clamp-2">${v.anomalias}</span>
          </div>
        ` : '<div class="text-xs text-slate-400 italic">Sem anomalias registradas</div>'}
      </div>

      <div class="mt-4 pt-3 border-t border-slate-100 flex justify-end">
        ${isEmUso ? 
          `<button onclick="abrirFinalizacaoDireta('${v.id}')" class="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1">Encerrar Rota &rarr;</button>` : 
          `<button onclick="abrirInicioDireto('${v.id}')" class="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">Iniciar Rota &rarr;</button>`
        }
      </div>
    `;
    container.appendChild(card);
  });
}

function renderSelectVeiculosInicio() {
  const select = document.getElementById('form-inicio-veiculo');
  select.innerHTML = '<option value="">Selecione um carro da frota...</option>';
  veiculos.filter(v => v.status === 'Disponivel').forEach(v => {
    select.innerHTML += `<option value="${v.id}">${v.id} - ${v.marca} [${v.placa}] (${Number(v.km_atual).toLocaleString('pt-BR')} km)</option>`;
  });
}

function atualizarKmInicialPreenchido() {
  const vId = document.getElementById('form-inicio-veiculo').value;
  const v = veiculos.find(item => item.id === vId);
  document.getElementById('form-inicio-km').value = v ? v.km_atual : '';
}

function abrirInicioDireto(vId) {
  setModule('operacao');
  setSubTab('operacao', 'saida');
  document.getElementById('form-inicio-veiculo').value = vId;
  atualizarKmInicialPreenchido();
}

function renderSelectRotasFim() {
  const select = document.getElementById('form-fim-rota-select');
  select.innerHTML = '<option value="">Selecione uma viagem em trânsito...</option>';
  rotas.filter(r => r.status === 'Em Uso').forEach(r => {
    select.innerHTML += `<option value="${r.id}">${r.id} | ${r.veiculo_id} (${r.responsavel})</option>`;
  });
}

function selecionarRotaFim() {
  const rotaId = document.getElementById('form-fim-rota-select').value;
  const rota = rotas.find(r => r.id === rotaId);
  const detalhes = document.getElementById('fim-detalhes-viagem');
  if (rota) {
    const v = veiculos.find(item => item.id === rota.veiculo_id);
    const medConsumo = ((Number(v.consumo_min) + Number(v.consumo_max))/2).toFixed(1);
    document.getElementById('fim-info-veiculo').innerText = `${rota.veiculo_id} (${v.marca})`;
    document.getElementById('fim-info-condutor').innerText = rota.responsavel;
    document.getElementById('fim-info-kmsaida').innerText = `${Number(rota.km_saida).toLocaleString('pt-BR')} km`;
    document.getElementById('fim-info-consumo-est').innerText = `Média de ${medConsumo} km/L`;
    detalhes.classList.remove('hidden');

    document.getElementById('form-fim-km').min = rota.km_saida;
    document.getElementById('form-fim-km').value = rota.km_saida;
    calcularKmPercorrido();
  } else {
    detalhes.classList.add('hidden');
  }
}

function abrirFinalizacaoDireta(vId) {
  const rota = rotas.find(r => r.veiculo_id === vId && r.status === 'Em Uso');
  if (rota) {
    setModule('operacao');
    setSubTab('operacao', 'retorno');
    document.getElementById('form-fim-rota-select').value = rota.id;
    selecionarRotaFim();
  }
}

function calcularKmPercorrido() {
  const rotaId = document.getElementById('form-fim-rota-select').value;
  const rota = rotas.find(r => r.id === rotaId);
  const kmFinal = parseFloat(document.getElementById('form-fim-km').value);
  const feedback = document.getElementById('km-calc-feedback');

  if (!rota || isNaN(kmFinal)) {
    feedback.innerText = "Insira o KM do painel.";
    feedback.className = "text-[11px] text-slate-500 mt-1 block";
    return;
  }

  if (kmFinal < rota.km_saida) {
    feedback.innerText = `Erro: KM Final (${kmFinal}) menor que Saída (${rota.km_saida})!`;
    feedback.className = "text-[11px] text-rose-600 font-bold mt-1 block";
  } else {
    const delta = kmFinal - rota.km_saida;
    const v = veiculos.find(item => item.id === rota.veiculo_id);
    const medConsumo = (Number(v.consumo_min) + Number(v.consumo_max))/2;
    const litrosEst = (delta / medConsumo).toFixed(1);
    feedback.innerText = `Distância: ${delta} km (Consumo est.: ~${litrosEst} Litros)`;
    feedback.className = "text-[11px] text-brand-700 font-bold mt-1 block";
  }
}

function toggleAnomaliaInput(show) {
  const box = document.getElementById('box-anomalia');
  if (show) box.classList.remove('hidden');
  else box.classList.add('hidden');
}

function renderHistorico() {
  const tbody = document.getElementById('tabelaHistorico');
  tbody.innerHTML = '';
  rotas.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold text-slate-800">${r.id}</td>
      <td class="py-3 px-4 font-extrabold text-slate-700">${r.veiculo_id}</td>
      <td class="py-3 px-4 text-slate-600">${r.responsavel}</td>
      <td class="py-3 px-4 font-medium">${r.origem} &rarr; ${r.destino || 'Em Trânsito'}</td>
      <td class="py-3 px-4 font-mono">${Number(r.km_saida).toLocaleString('pt-BR')}</td>
      <td class="py-3 px-4 font-mono">${r.km_retorno ? Number(r.km_retorno).toLocaleString('pt-BR') : '-'}</td>
      <td class="py-3 px-4 text-center font-mono font-bold ${r.km_total > 0 ? 'text-brand-700' : 'text-slate-400'}">
        ${r.status === 'Concluida' ? `${r.km_total} km` : '-'}
      </td>
      <td class="py-3 px-4 text-center font-mono text-slate-600">${r.consumo_litros ? `${r.consumo_litros} L` : '-'}</td>
      <td class="py-3 px-4 max-w-xs">
        ${r.anomalia ? `<span class="text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded text-[11px] font-medium">${r.anomalia}</span>` : '<span class="text-slate-400">-</span>'}
      </td>
      <td class="py-3 px-4 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'Concluida' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'}">
          ${r.status}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTabelaVeiculosCad() {
  const tbody = document.getElementById('tabelaVeiculosCadastrados');
  tbody.innerHTML = '';
  veiculos.forEach(v => {
    const isEmUso = v.status === 'Em Uso';
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50";
    tr.innerHTML = `
      <td class="py-3 px-3 font-extrabold text-slate-900">${v.id}</td>
      <td class="py-3 px-3 font-mono font-bold text-slate-700">${v.placa}</td>
      <td class="py-3 px-3">${v.marca}</td>
      <td class="py-3 px-3 text-center font-mono">${v.tanque} L</td>
      <td class="py-3 px-3 text-center font-mono">${v.consumo_min} ~ ${v.consumo_max}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-brand-700">${Number(v.km_atual).toLocaleString('pt-BR')} km</td>
      <td class="py-3 px-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isEmUso ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
          ${v.status}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('badge-total-carros').innerText = `${veiculos.length} carros`;
}

function renderTabelaUsuariosCad() {
  const tbody = document.getElementById('tabelaUsuariosCadastrados');
  tbody.innerHTML = '';
  usuarios.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50";
    tr.innerHTML = `
      <td class="py-3 px-4 font-bold text-slate-800">${u.nome}</td>
      <td class="py-3 px-4 text-slate-600">${u.email}</td>
      <td class="py-3 px-4 font-mono font-semibold text-brand-700">${u.cnh}</td>
      <td class="py-3 px-4 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">${u.status || 'Ativo'}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('badge-total-users').innerText = `${usuarios.length} condutores`;
}

function atualizarUsuarioNoCabecalho() {
  if (usuarios.length === 0) return;
  const u = usuarios[currentUserIndex];
  document.getElementById('topUserDisplay').innerText = `${u.nome} (${u.email})`;
  document.getElementById('topUserCnh').innerText = `CNH: ${u.cnh}`;
  document.getElementById('form-inicio-condutor').value = `${u.nome} <${u.email}>`;
}

function alternarUsuarioLogado() {
  if (usuarios.length === 0) return;
  currentUserIndex = (currentUserIndex + 1) % usuarios.length;
  atualizarUsuarioNoCabecalho();
}

function filtrarHistorico() {
  const q = document.getElementById('filtro-rotas').value.toLowerCase();
  document.querySelectorAll('#tabelaHistorico tr').forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
  });
}

// Navegação
function setModule(mod) {
  if (mod === 'operacao') {
    document.getElementById('module-operacao').classList.remove('hidden');
    document.getElementById('module-gestao').classList.add('hidden');
    document.getElementById('subnav-operacao').classList.remove('hidden');
    document.getElementById('subnav-gestao').classList.add('hidden');
    
    document.getElementById('btn-mod-operacao').className = "module-nav-active px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    document.getElementById('btn-mod-gestao').className = "text-brand-300 hover:text-white px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    setSubTab('operacao', 'saida');
  } else {
    document.getElementById('module-operacao').classList.add('hidden');
    document.getElementById('module-gestao').classList.remove('hidden');
    document.getElementById('subnav-operacao').classList.add('hidden');
    document.getElementById('subnav-gestao').classList.remove('hidden');
    
    document.getElementById('btn-mod-gestao').className = "module-nav-active px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    document.getElementById('btn-mod-operacao').className = "text-brand-300 hover:text-white px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    setSubTab('gestao', 'dashboard');
  }
}

function setSubTab(moduleName, tab) {
  if (moduleName === 'operacao') {
    ['saida', 'retorno', 'minhas-rotas'].forEach(t => {
      document.getElementById(`view-${t}`).classList.add('hidden');
      const btn = document.getElementById(`subtab-${t}`);
      btn.classList.remove('border-brand-600', 'text-brand-600', 'font-bold');
      btn.classList.add('border-transparent', 'text-slate-500');
    });
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    const active = document.getElementById(`subtab-${tab}`);
    active.classList.remove('border-transparent', 'text-slate-500');
    active.classList.add('border-brand-600', 'text-brand-600', 'font-bold');
  } else {
    ['dashboard', 'cad-veiculos', 'cad-usuarios'].forEach(t => {
      document.getElementById(`view-${t}`).classList.add('hidden');
      const btn = document.getElementById(`subtab-${t}`);
      btn.classList.remove('border-brand-600', 'text-brand-600', 'font-bold');
      btn.classList.add('border-transparent', 'text-slate-500');
    });
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    const active = document.getElementById(`subtab-${tab}`);
    active.classList.remove('border-transparent', 'text-slate-500');
    active.classList.add('border-brand-600', 'text-brand-600', 'font-bold');
  }
}

// Inicialização
window.onload = carregarTodosDadosDoBanco;