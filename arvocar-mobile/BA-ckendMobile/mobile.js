// =========================================================================
// 1. CONFIGURAÇÃO DO SUPABASE E ESTADOS
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

let usuarioLogado = null;
let veiculos = [];
let rotas = [];

// =========================================================================
// 2. CONTROLE DE SESSÃO & LOGIN MOBILE
// =========================================================================

function toggleSenhaMobile() {
  const input = document.getElementById('m-senha');
  const icone = document.getElementById('m-icone-senha');
  if (input.type === 'password') {
    input.type = 'text';
    icone.classList.replace('ph-eye', 'ph-eye-slash');
  } else {
    input.type = 'password';
    icone.classList.replace('ph-eye-slash', 'ph-eye');
  }
}

async function handleMobileLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-login');
  const erroBox = document.getElementById('erro-login-box');
  const erroMsg = document.getElementById('erro-login-msg');

  const email = document.getElementById('m-email').value.trim().toLowerCase();
  const senha = document.getElementById('m-senha').value.trim();

  erroBox.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Autenticando...`;

  try {
    const { data, error } = await db
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !data) throw new Error("Usuário não cadastrado.");
    if (data.senha !== senha) throw new Error("Senha incorreta.");
    if (data.status === 'Inativo') throw new Error("Usuário inativo no sistema.");

    usuarioLogado = {
      id: data.id,
      nome: data.nome,
      email: data.email,
      cnh: data.cnh
    };

    localStorage.setItem('arvo_mobile_user', JSON.stringify(usuarioLogado));
    iniciarAppMobile();
  } catch (err) {
    erroMsg.innerText = err.message || "E-mail ou senha inválidos.";
    erroBox.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>Acessar Operação</span> <i class="ph-bold ph-arrow-right text-base"></i>`;
  }
}

function handleMobileLogout() {
  if (confirm("Deseja sair do aplicativo?")) {
    localStorage.removeItem('arvo_mobile_user');
    usuarioLogado = null;
    document.getElementById('screen-app').classList.add('hidden');
    document.getElementById('screen-login').classList.remove('hidden');
  }
}

// =========================================================================
// 3. CARREGAMENTO E NAVEGAÇÃO DE ABAS
// =========================================================================

async function carregarDadosMobile() {
  try {
    const { data: dadosV } = await db.from('veiculos').select('*').order('id');
    veiculos = dadosV || [];

    const { data: dadosR } = await db.from('rotas').select('*').order('data_saida', { ascending: false });
    rotas = dadosR || [];

    renderizarOpcoesVeiculos();
    renderizarOpcoesRotasAtivas();
    renderizarHistoricoMobile();
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
  }
}

function iniciarAppMobile() {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  document.getElementById('m-top-username').innerText = `${usuarioLogado.nome} (${usuarioLogado.email})`;
  
  switchMobileTab('iniciar');
  carregarDadosMobile();
}

function switchMobileTab(tab) {
  ['iniciar', 'finalizar', 'historico'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.add('hidden');
    const btn = document.getElementById(`nav-btn-${t}`);
    btn.className = "flex flex-col items-center gap-1 text-slate-400 font-semibold transition";
  });

  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  const activeBtn = document.getElementById(`nav-btn-${tab}`);
  activeBtn.className = "flex flex-col items-center gap-1 text-brand-700 font-bold transition";
}

// =========================================================================
// 4. OPERAÇÃO DE ROTAS (CHECK-OUT & CHECK-IN)
// =========================================================================

function renderizarOpcoesVeiculos() {
  const select = document.getElementById('m-inicio-veiculo');
  select.innerHTML = '<option value="">Selecione o veículo...</option>';
  veiculos.filter(v => v.status === 'Disponivel').forEach(v => {
    select.innerHTML += `<option value="${v.id}">${v.id} - ${v.marca} [${v.placa}] (${Number(v.km_atual).toLocaleString('pt-BR')} km)</option>`;
  });
}

function atualizarKmVeiculoMobile() {
  const vId = document.getElementById('m-inicio-veiculo').value;
  const v = veiculos.find(item => item.id === vId);
  document.getElementById('m-inicio-km').value = v ? v.km_atual : '';
}

function toggleOutroOrigemMobile(valor) {
  const input = document.getElementById('m-inicio-origem-outro');
  if (valor === 'OUTRO') {
    input.classList.remove('hidden');
    input.required = true;
    input.focus();
  } else {
    input.classList.add('hidden');
    input.required = false;
    input.value = '';
  }
}

function toggleOutroDestinoMobile(valor) {
  const input = document.getElementById('m-fim-destino-outro');
  if (valor === 'OUTRO') {
    input.classList.remove('hidden');
    input.required = true;
    input.focus();
  } else {
    input.classList.add('hidden');
    input.required = false;
    input.value = '';
  }
}

function toggleAnomaliaMobile(show) {
  const txt = document.getElementById('m-fim-anomalia');
  if (show) txt.classList.remove('hidden');
  else {
    txt.classList.add('hidden');
    txt.value = '';
  }
}

// Iniciar Rota
async function handleMobileInicioRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-confirmar-inicio');
  const veiculoId = document.getElementById('m-inicio-veiculo').value;
  const veiculo = veiculos.find(v => v.id === veiculoId);

  if (!veiculo) {
    alert("Selecione um veículo disponível.");
    return;
  }

  const selOrigem = document.getElementById('m-inicio-origem').value;
  const txtOrigem = document.getElementById('m-inicio-origem-outro')?.value.trim().toUpperCase() || '';
  const origemFinal = selOrigem === 'OUTRO' ? txtOrigem : selOrigem;

  if (!origemFinal) {
    alert("Informe o local de saída.");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;

  const novaRota = {
    id: `ROTA-2026-${String(rotas.length + 261).padStart(4, '0')}`,
    veiculo_id: veiculoId,
    responsavel: usuarioLogado.email,
    origem: origemFinal,
    destino: null,
    finalidade: document.getElementById('m-inicio-finalidade').value,
    data_saida: new Date().toISOString(),
    data_retorno: null,
    km_saida: Number(veiculo.km_atual),
    km_retorno: null,
    km_total: 0,
    consumo_litros: null,
    anomalia: '',
    status: 'Em Uso'
  };

  try {
    const { error: errR } = await db.from('rotas').insert([novaRota]);
    if (errR) throw errR;

    const { error: errV } = await db.from('veiculos').update({ status: 'Em Uso' }).eq('id', veiculoId);
    if (errV) throw errV;

    alert(`Rota iniciada com sucesso no ${veiculoId}!`);
    e.target.reset();
    toggleOutroOrigemMobile('');
    await carregarDadosMobile();
    switchMobileTab('historico');
  } catch (err) {
    alert("Erro ao iniciar rota: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph-bold ph-check-circle text-base"></i> Confirmar Saída`;
  }
}

// Finalizar Rota
function renderizarOpcoesRotasAtivas() {
  const select = document.getElementById('m-fim-rota-select');
  select.innerHTML = '<option value="">Selecione sua rota ativa...</option>';
  rotas.filter(r => r.status === 'Em Uso' && r.responsavel === usuarioLogado.email).forEach(r => {
    select.innerHTML += `<option value="${r.id}">${r.id} (${r.veiculo_id}) - KM Saída: ${r.km_saida}</option>`;
  });
}

function selecionarRotaFimMobile() {
  const rotaId = document.getElementById('m-fim-rota-select').value;
  const rota = rotas.find(r => r.id === rotaId);
  const card = document.getElementById('m-detalhes-viagem');
  const inputKm = document.getElementById('m-fim-km');

  if (rota) {
    document.getElementById('m-info-veiculo').innerText = rota.veiculo_id;
    document.getElementById('m-info-kmsaida').innerText = `${Number(rota.km_saida).toLocaleString('pt-BR')} km`;
    inputKm.min = rota.km_saida;
    inputKm.value = rota.km_saida;
    card.classList.remove('hidden');
    calcularKmPercorridoMobile();
  } else {
    card.classList.add('hidden');
  }
}

function calcularKmPercorridoMobile() {
  const rotaId = document.getElementById('m-fim-rota-select').value;
  const rota = rotas.find(r => r.id === rotaId);
  const kmFinal = parseFloat(document.getElementById('m-fim-km').value);
  const feedback = document.getElementById('m-km-feedback');

  if (!rota || isNaN(kmFinal)) {
    feedback.innerText = "";
    return;
  }

  if (kmFinal < rota.km_saida) {
    feedback.innerText = `Aviso: KM final não pode ser menor que a saída (${rota.km_saida} km)!`;
    feedback.className = "text-[11px] text-rose-600 font-bold";
  } else {
    const delta = kmFinal - rota.km_saida;
    feedback.innerText = `Distância percorrida: ${delta} km`;
    feedback.className = "text-[11px] text-brand-700 font-bold";
  }
}

async function handleMobileFimRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-confirmar-fim');
  const rotaId = document.getElementById('m-fim-rota-select').value;
  const kmFinal = parseFloat(document.getElementById('m-fim-km').value);

  const selDest = document.getElementById('m-fim-destino').value;
  const txtDest = document.getElementById('m-fim-destino-outro')?.value.trim().toUpperCase() || '';
  const destinoFinal = selDest === 'OUTRO' ? txtDest : selDest;

  const rota = rotas.find(r => r.id === rotaId);
  const veiculo = veiculos.find(v => v.id === rota.veiculo_id);

  if (kmFinal < rota.km_saida) {
    alert("O KM final não pode ser menor que o KM de saída.");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;

  const situacao = document.querySelector('input[name="m_situacao_carro"]:checked').value;
  const anomaliaTexto = situacao === 'COM' ? document.getElementById('m-fim-anomalia').value.trim() : '';

  const deltaKm = kmFinal - rota.km_saida;
  const medConsumo = (Number(veiculo.consumo_min) + Number(veiculo.consumo_max)) / 2;
  const litrosEst = Number((deltaKm / medConsumo).toFixed(2));

  try {
    const { error: errR } = await db.from('rotas').update({
      km_retorno: kmFinal,
      km_total: deltaKm,
      consumo_litros: litrosEst,
      destino: destinoFinal,
      status: 'Concluida',
      anomalia: anomaliaTexto,
      data_retorno: new Date().toISOString()
    }).eq('id', rotaId);
    if (errR) throw errR;

    const { error: errV } = await db.from('veiculos').update({
      km_atual: kmFinal,
      status: 'Disponivel',
      anomalias: anomaliaTexto || veiculo.anomalias
    }).eq('id', veiculo.id);
    if (errV) throw errV;

    alert(`Rota ${rotaId} finalizada! Distância: ${deltaKm} km.`);
    e.target.reset();
    toggleOutroDestinoMobile('');
    toggleAnomaliaMobile(false);
    document.getElementById('m-detalhes-viagem').classList.add('hidden');
    await carregarDadosMobile();
    switchMobileTab('historico');
  } catch (err) {
    alert("Erro ao finalizar rota: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph-bold ph-check text-base"></i> Finalizar Rota`;
  }
}

// Histórico
function renderizarHistoricoMobile() {
  const container = document.getElementById('m-lista-historico');
  const badge = document.getElementById('m-total-rotas-badge');
  const minhasRotas = rotas.filter(r => r.responsavel === usuarioLogado.email);
  
  badge.innerText = `${minhasRotas.length} rotas`;
  container.innerHTML = '';

  if (minhasRotas.length === 0) {
    container.innerHTML = `<div class="p-4 bg-white rounded-2xl text-center text-xs text-slate-400">Nenhuma rota registrada até o momento.</div>`;
    return;
  }

  minhasRotas.forEach(r => {
    const isEmUso = r.status === 'Em Uso';
    const card = document.createElement('div');
    card.className = "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-extrabold text-sm text-slate-900">${r.veiculo_id}</span>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isEmUso ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
          ${r.status}
        </span>
      </div>
      <div class="text-xs text-slate-600 font-medium">
        ${r.origem} &rarr; ${r.destino || 'Em trânsito'}
      </div>
      <div class="flex justify-between items-center text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100">
        <span>Distância: <b class="text-brand-700 font-bold">${r.km_total > 0 ? `${r.km_total} km` : '-'}</b></span>
        <span>Saída: ${new Date(r.data_saida).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })}</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// =========================================================================
// 5. INICIALIZAÇÃO
// =========================================================================
window.onload = () => {
  const sessao = localStorage.getItem('arvo_mobile_user');
  if (sessao) {
    usuarioLogado = JSON.parse(sessao);
    iniciarAppMobile();
  }
};