// =========================================================================
// MÓDULO: ABASTECIMENTO MOBILE - ARVO
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

// Instanciação segura do cliente Supabase
const db = window.db || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let usuarioLogado = null;
let veiculosAbast = [];

// =========================================================================
// INICIALIZAÇÃO E SESSÃO
// =========================================================================
async function initAbastecimentoMobile() {
  const sessaoStr = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  if (!sessaoStr) {
    window.location.href = 'login.html';
    return;
  }
  usuarioLogado = JSON.parse(sessaoStr);

  const userDisplay = document.getElementById('user-display') || document.getElementById('m-top-username');
  if (userDisplay) {
    userDisplay.innerText = `${usuarioLogado.nome || usuarioLogado.email}`;
  }

  await carregarVeiculosAbastecimento();
  await carregarHistoricoAbastecimento();
}

// =========================================================================
// CARREGAMENTO DE VEÍCULOS
// =========================================================================
async function carregarVeiculosAbastecimento() {
  const sel = document.getElementById('abs-veiculo') || document.getElementById('abast-veiculo') || document.getElementById('m-res-veiculo');
  if (!sel) return;

  try {
    const { data, error } = await db
      .from('veiculos')
      .select('*')
      .order('id');

    if (error) throw error;
    veiculosAbast = data || [];

    if (veiculosAbast.length === 0) {
      sel.innerHTML = '<option value="">Nenhum carro cadastrado</option>';
      return;
    }

    sel.innerHTML = '<option value="">Selecione o veículo...</option>';
    veiculosAbast.forEach(v => {
      sel.innerHTML += `<option value="${v.id}">${v.id} - ${v.marca} [${v.placa}]</option>`;
    });

  } catch (err) {
    console.error("Falha ao carregar lista de veículos:", err);
    sel.innerHTML = '<option value="">Erro ao carregar veículos</option>';
  }
}

// =========================================================================
// CÁLCULOS E PREVIEWS
// =========================================================================
function calcularTotalAbastecimentoMobile() {
  const inputLitros = document.getElementById('abs-litros') || document.getElementById('abast-litros');
  const inputPreco = document.getElementById('abs-preco-litro') || document.getElementById('abast-preco-litro');
  const displayTotal = document.getElementById('display-total') || document.getElementById('display-valor-total');

  const litros = parseFloat(inputLitros?.value) || 0;
  const preco = parseFloat(inputPreco?.value) || 0;
  const total = litros * preco;

  if (displayTotal) {
    displayTotal.innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}

function atualizarNomeArquivoMobile(input) {
  const label = document.getElementById('comprovante-nome');
  if (!label) return;

  if (input.files && input.files[0]) {
    label.innerText = `Anexado: ${input.files[0].name.substring(0, 22)}...`;
  } else {
    label.innerText = 'Tirar foto ou anexar comprovante';
  }
}

// =========================================================================
// SALVAMENTO DE REGISTRO COM UPLOAD
// =========================================================================
async function salvarAbastecimentoMobile(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit') || document.getElementById('btn-salvar-abastecimento');
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;
  }

  try {
    const selVeiculo = document.getElementById('abs-veiculo') || document.getElementById('abast-veiculo');
    const inputPosto = document.getElementById('abs-posto') || document.getElementById('abast-local');
    const inputTipo = document.getElementById('abs-tipo');
    const inputKm = document.getElementById('abs-km');
    const inputLitros = document.getElementById('abs-litros') || document.getElementById('abast-litros');
    const inputPreco = document.getElementById('abs-preco-litro') || document.getElementById('abast-preco-litro');
    const fotoInput = document.getElementById('abs-foto') || document.getElementById('abast-foto');

    const veiculo_id = selVeiculo.value; // Mantido em formato String (ex: "ARVO 16")
    const local_posto = inputPosto.value.trim().toUpperCase();
    const tipo_combustivel = inputTipo ? inputTipo.value : 'Gasolina Comum';
    const km_atual = inputKm ? parseInt(inputKm.value, 10) : null;
    const quantidade_litros = parseFloat(inputLitros.value);
    const preco_litro = parseFloat(inputPreco.value);
    const valor_total = quantidade_litros * preco_litro;

    let url_comprovante = null;

    // Upload seguro do arquivo/foto
    if (fotoInput && fotoInput.files && fotoInput.files[0]) {
      const file = fotoInput.files[0];
      const extensao = file.name.split('.').pop();
      const fileName = `abast_${Date.now()}_${Math.random().toString(36).substring(7)}.${extensao}`;
      
      const { error: uploadErr } = await db.storage
        .from('comprovantes')
        .upload(fileName, file);

      if (!uploadErr) {
        const { data: publicUrlData } = db.storage.from('comprovantes').getPublicUrl(fileName);
        url_comprovante = publicUrlData?.publicUrl || null;
      }
    }

    const payload = {
      veiculo_id: veiculo_id,
      motorista_id: usuarioLogado.id || null,
      motorista_nome: usuarioLogado.nome || usuarioLogado.email,
      local_posto,
      tipo_combustivel,
      quantidade_litros,
      preco_litro,
      valor_total,
      url_comprovante,
      data_hora: new Date().toISOString()
    };

    if (km_atual && !isNaN(km_atual)) {
      payload.km_atual = km_atual;
    }

    const { error: insertErr } = await db.from('abastecimentos').insert([payload]);
    if (insertErr) throw insertErr;

    // Atualiza o hodômetro do veículo caso o KM informado seja superior
    if (km_atual && !isNaN(km_atual)) {
      await db.from('veiculos')
        .update({ km_atual: km_atual })
        .eq('id', veiculo_id)
        .lt('km_atual', km_atual);
    }

    alert('✅ Abastecimento registrado com sucesso!');
    
    const form = document.getElementById('form-abastecimento') || document.getElementById('formAbastecimento');
    if (form) form.reset();
    
    calcularTotalAbastecimentoMobile();
    await carregarHistoricoAbastecimento();

    if (typeof trocarAba === 'function') {
      trocarAba('historico');
    }

  } catch (err) {
    console.error("Erro ao salvar abastecimento:", err);
    alert('Erro ao salvar abastecimento: ' + (err.message || 'Verifique sua conexão.'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-base"></i><span>Registrar Abastecimento</span>`;
    }
  }
}

// =========================================================================
// CONTROLE DE NAVEGAÇÃO DE ABAS (NOVO REGISTRO / HISTÓRICO)
// =========================================================================
function trocarAba(aba) {
  const viewNovo = document.getElementById('view-novo');
  const viewHist = document.getElementById('view-historico');
  const btnNovo = document.getElementById('tab-btn-novo');
  const btnHist = document.getElementById('tab-btn-historico');

  if (!viewNovo || !viewHist) return;

  if (aba === 'novo') {
    viewNovo.classList.remove('hidden');
    viewHist.classList.add('hidden');
    if (btnNovo) btnNovo.className = "flex-1 py-2.5 text-center font-bold text-amber-400 border-b-2 border-amber-400 flex items-center justify-center gap-1.5 transition";
    if (btnHist) btnHist.className = "flex-1 py-2.5 text-center font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
  } else {
    viewNovo.classList.add('hidden');
    viewHist.classList.remove('hidden');
    if (btnHist) btnHist.className = "flex-1 py-2.5 text-center font-bold text-amber-400 border-b-2 border-amber-400 flex items-center justify-center gap-1.5 transition";
    if (btnNovo) btnNovo.className = "flex-1 py-2.5 text-center font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
    carregarHistoricoAbastecimento();
  }
}

// =========================================================================
// CARREGAR HISTÓRICO RECENTE
// =========================================================================
async function carregarHistoricoAbastecimento() {
  const container = document.getElementById('lista-abastecimentos');
  if (!container) return;

  container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs"><i class="ph-bold ph-spinner animate-spin text-lg"></i><br>Carregando histórico...</div>`;

  try {
    const { data, error } = await db
      .from('abastecimentos')
      .select('*')
      .order('data_hora', { ascending: false })
      .limit(20);

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">Nenhum abastecimento encontrado.</div>`;
      return;
    }

    container.innerHTML = '';
    data.forEach(a => {
      const card = document.createElement('div');
      card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2";
      const valorFormatado = Number(a.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      card.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <i class="ph-bold ph-gas-pump text-amber-500"></i> ${a.veiculo_id}
          </span>
          <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
            ${valorFormatado}
          </span>
        </div>
        <div class="text-xs text-slate-600 font-medium">
          <i class="ph-bold ph-map-pin text-slate-400"></i> ${a.local_posto || '-'}
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1.5 border-t border-slate-100">
          <span>${a.quantidade_litros} L (R$ ${Number(a.preco_litro).toFixed(2)}/L)</span>
          <span>${new Date(a.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        ${a.url_comprovante ? `
          <div class="pt-1">
            <a href="${a.url_comprovante}" target="_blank" class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:underline">
              <i class="ph-bold ph-file-image"></i> Ver Cupom Fiscal
            </a>
          </div>
        ` : ''}
      `;
      container.appendChild(card);
    });

    const badge = document.getElementById('badge-total-abast');
    if (badge) badge.innerText = `${data.length} registros`;

  } catch (err) {
    console.error("Erro ao carregar abastecimentos:", err);
    container.innerHTML = `<div class="text-center py-6 text-rose-500 text-xs">Erro ao carregar histórico.</div>`;
  }
}

function handleMobileLogout() {
  if (confirm("Deseja realmente sair da sua conta no aplicativo?")) {
    localStorage.removeItem('arvo_mobile_user');
    localStorage.removeItem('arvo_usuario_logado');
    usuarioLogado = null;

    const screenApp = document.getElementById('screen-app');
    const screenLogin = document.getElementById('screen-login');

    if (screenApp && screenLogin) {
      screenApp.classList.add('hidden');
      screenLogin.classList.remove('hidden');
    } else {
      window.location.href = "login.html";
    }
  }
}

// Inicializa com segurança sem conflitar com outros scripts
document.addEventListener('DOMContentLoaded', initAbastecimentoMobile);