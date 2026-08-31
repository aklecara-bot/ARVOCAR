// =========================================================================
// MÓDULO: ABASTECIMENTO MOBILE - ARVO
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

// Instanciação segura do cliente Supabase
const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

let usuarioLogado = null;
let veiculosAbast = [];

// =========================================================================
// INICIALIZAÇÃO E SESSÃO SEGURA
// =========================================================================
async function initAbastecimentoMobile() {
  try {
    const sessaoStr = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
    if (sessaoStr) {
      try {
        usuarioLogado = JSON.parse(sessaoStr);
      } catch (e) {
        usuarioLogado = { email: sessaoStr, nome: sessaoStr };
      }

      const userDisplay = document.getElementById('user-display') || document.getElementById('m-top-username');
      if (userDisplay && usuarioLogado) {
        userDisplay.innerText = `${usuarioLogado.nome || usuarioLogado.email || 'Condutor'}`;
      }
    }
  } catch (err) {
    console.warn("Aviso na leitura da sessão:", err);
  }

  // Executa o carregamento diretamente, sem depender da sessão
  await carregarVeiculosAbastecimento();
  await carregarHistoricoAbastecimento();
}

// =========================================================================
// CARREGAMENTO DE VEÍCULOS
// =========================================================================
async function carregarVeiculosAbastecimento() {
  const sel = document.getElementById('abs-veiculo');
  if (!sel) {
    console.warn("Elemento 'abs-veiculo' não foi encontrado no HTML.");
    return;
  }

  sel.innerHTML = '<option value="">Carregando veículos...</option>';

  try {
    const { data, error } = await db
      .from('veiculos')
      .select('*')
      .neq('status', 'Fora de Uso')
      .order('placa');

    if (error) {
      console.error("Erro retornado pelo Supabase:", error);
      throw error;
    }

    veiculosAbast = data || [];

    if (veiculosAbast.length === 0) {
      sel.innerHTML = '<option value="">Nenhum veículo cadastrado</option>';
      return;
    }

   sel.innerHTML = '<option value="">Selecione o veículo...</option>';
    veiculosAbast.forEach(v => {
      sel.innerHTML += `<option value="${v.placa}" data-uuid="${v.nome_frota || ''}" data-placa="${v.placa}">${v.placa} - ${v.nome_frota}</option>`;
    });

  } catch (err) {
    console.error("Falha ao carregar lista de veículos:", err);
    sel.innerHTML = '<option value="">Erro ao carregar veículos</option>';
  }
}

// =========================================================================
// CONTROLE DE NAVEGAÇÃO DE ABAS
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

function switchMobileTab(tab) {
  const abas = ['iniciar', 'finalizar', 'historico'];

  abas.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`nav-btn-${t}`);
    if (el) el.classList.add('hidden');
    if (btn) btn.className = "flex flex-col items-center gap-1 text-slate-400 font-semibold transition";
  });

  const activeView = document.getElementById(`tab-${tab}`);
  const activeBtn = document.getElementById(`nav-btn-${tab}`);
  if (activeView) activeView.classList.remove('hidden');
  if (activeBtn) activeBtn.className = "flex flex-col items-center gap-1 text-brand-700 font-bold transition";
}

// =========================================================================
// CÁLCULOS E PREVIEWS
// =========================================================================
function calcularTotalAbastecimentoMobile() {
  const inputLitros = document.getElementById('abs-litros');
  const inputPreco = document.getElementById('abs-preco-litro');
  const displayTotal = document.getElementById('display-total');

  const litros = parseFloat(inputLitros?.value) || 0;
  const preco = parseFloat(inputPreco?.value) || 0;
  const total = litros * preco;

  if (displayTotal) {
    displayTotal.innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}

function atualizarNomeArquivo(input) {
  const label = document.getElementById('comprovante-nome');
  if (!label) return;

  if (input.files && input.files[0]) {
    label.innerText = `Anexado: ${input.files[0].name.substring(0, 20)}...`;
  } else {
    label.innerText = 'Tirar foto ou anexar comprovante';
  }
}

// =========================================================================
// SALVAMENTO DE REGISTRO COM UPLOAD (COMPLETO E INTEGRADO)
// =========================================================================
async function salvarAbastecimento(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  const btn = document.getElementById('btn-submit');

  try {
    const selVeiculo = document.getElementById('abs-veiculo');
    const optSelecionada = selVeiculo ? selVeiculo.options[selVeiculo.selectedIndex] : null;
    const veiculo_id = selVeiculo ? selVeiculo.value : '';

    if (!veiculo_id) {
      alert("Por favor, selecione um veículo.");
      return;
    }

    // 1. Captura do UUID e da Placa vinculados ao select
    const uuid_veiculos = optSelecionada?.dataset?.uuid || null;
    const placa = optSelecionada?.dataset?.placa || null;

    const local_posto = (document.getElementById('abs-posto')?.value || '').trim().toUpperCase();
    const tipo_combustivel = document.getElementById('abs-tipo')?.value || 'Gasolina Comum';
    const km_input = document.getElementById('abs-km')?.value;
    const km_atual = km_input ? parseInt(km_input, 10) : null;
    const quantidade_litros = parseFloat(document.getElementById('abs-litros')?.value) || 0;
    const preco_litro = parseFloat(document.getElementById('abs-preco-litro')?.value) || 0;
    const valor_total = Number((quantidade_litros * preco_litro).toFixed(2));
    const fotoInput = document.getElementById('abs-foto');

    if (quantidade_litros <= 0 || preco_litro <= 0) {
      alert("Informe valores válidos para litros e preço unitário.");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;
    }

    let url_comprovante = null;

    // 2. Upload do comprovante para o Bucket 'comprovantes' no Storage
    if (fotoInput && fotoInput.files && fotoInput.files[0]) {
      try {
        const file = fotoInput.files[0];
        const extensao = file.name.split('.').pop();
        const fileName = `abast_${Date.now()}_${Math.random().toString(36).substring(7)}.${extensao}`;

        const { error: uploadErr } = await db.storage
          .from('comprovantes')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadErr) {
          console.warn("Aviso no upload do comprovante:", uploadErr.message);
        } else {
          const { data: publicUrlData } = db.storage
            .from('comprovantes')
            .getPublicUrl(fileName);
          url_comprovante = publicUrlData?.publicUrl || null;
        }
      } catch (uploadCatch) {
        console.warn("Erro ao processar upload do arquivo:", uploadCatch);
      }
    }

    // 3. Montagem do payload alinhado às colunas da tabela 'abastecimentos'
    const emailResp = (usuarioLogado && usuarioLogado.email) ? usuarioLogado.email : 'admin@arvo.tec.br';

    const payload = {
      veiculo_id: veiculo_id,                 // Rótulo de frota (ex: "ARVO 11")
      uuid_veiculos: uuid_veiculos,           // Chave UUID única vinculada ao banco
      placa: placa,                           // Placa congelada do momento
      responsavel: emailResp,
      local_posto: local_posto,
      tipo_combustivel: tipo_combustivel,
      quantidade_litros: quantidade_litros,
      preco_litro: preco_litro,
      valor_total: valor_total,
      url_comprovante: url_comprovante,
      data_hora: new Date().toISOString()
    };

    if (km_atual && !isNaN(km_atual)) {
      payload.km_atual = km_atual;
    }

    // 4. Inserção do registro no Supabase
    const { error: insertErr } = await db
      .from('abastecimentos')
      .insert([payload]);

    if (insertErr) {
      console.error("Erro Supabase Insert:", insertErr);
      throw insertErr;
    }

    // 5. Atualização do KM na tabela 'veiculos' (filtrando por uuid_veiculos ou nome_frota)
    if (km_atual && !isNaN(km_atual)) {
      try {
        let query = db.from('veiculos').update({ km_atual: km_atual });
        
        if (uuid_veiculos) {
          query = query.eq('uuid_veiculos', uuid_veiculos);
        } else {
          query = query.eq('nome_frota', veiculo_id);
        }

        await query.lt('km_atual', km_atual);
      } catch (vErr) {
        console.warn("Aviso ao atualizar KM do veículo:", vErr);
      }
    }

    alert('✅ Abastecimento registrado com sucesso!');

    // 6. Limpeza do formulário e atualização de interface
    const form = document.getElementById('form-abastecimento');
    if (form) form.reset();

    const labelFoto = document.getElementById('comprovante-nome');
    if (labelFoto) labelFoto.innerText = 'Tirar foto ou anexar arquivo';

    if (typeof calcularTotal === 'function') {
      calcularTotal();
    } else if (typeof calcularTotalAbastecimentoMobile === 'function') {
      calcularTotalAbastecimentoMobile();
    }

    await carregarHistoricoAbastecimento();
    
    if (typeof trocarAba === 'function') {
      trocarAba('historico');
    }

  } catch (err) {
    console.error("Falha ao salvar:", err);
    alert('Erro ao salvar abastecimento: ' + (err.message || 'Verifique sua conexão ou permissões no Supabase.'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-base"></i><span>Registrar Abastecimento</span>`;
    }
  }
}
let listaAbastecimentosCache = [];
let urlComprovanteAtual = null;

// =========================================================================
// CARREGAR HISTÓRICO COM BOTÃO DE DETALHES
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
      .limit(30);

    if (error) throw error;

    listaAbastecimentosCache = data || [];

    if (listaAbastecimentosCache.length === 0) {
      container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">Nenhum abastecimento encontrado.</div>`;
      return;
    }

    container.innerHTML = '';
    listaAbastecimentosCache.forEach((a, index) => {
      const card = document.createElement('div');
      card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 transition hover:border-slate-300";
      const valorFormatado = Number(a.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      card.innerHTML = `
      <div class="flex items-center justify-between">
      <span class="text-xs font-black text-slate-800 flex items-center gap-1.5 font-mono">
      <i class="ph-bold ph-gas-pump text-amber-500"></i> ${a.placa || 'Sem Placa'}
      </span>
      <span class="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
        ${valorFormatado}
      </span>
      </div>
      <div class="text-xs text-slate-600 font-medium">
      <i class="ph-bold ph-map-pin text-slate-400"></i> ${a.local_posto || '-'} • <span class="text-slate-500 font-normal">${a.tipo_combustivel || 'Combustível'}</span>
      </div>
      <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1.5 border-t border-slate-100">
      <span>${a.quantidade_litros} L (R$ ${Number(a.preco_litro).toFixed(2)}/L)</span>
      <span>${new Date(a.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="pt-1 flex items-center justify-between border-t border-slate-100">
      <span class="text-[10px] text-slate-400 truncate max-w-[150px]">
      <i class="ph-bold ph-user"></i> ${(a.responsavel || '').split('@')[0]}
      </span>
      <button onclick="abrirModalAbastecimento(${index})" class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 transition">
      <i class="ph-bold ph-eye"></i> Ver Detalhes
      </button>
      </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error("Erro ao carregar abastecimentos:", err);
    container.innerHTML = `<div class="text-center py-6 text-rose-500 text-xs">Erro ao carregar histórico: ${err.message}</div>`;
  }
}

// =========================================================================
// MODAL DE DETALHES E DOWNLOAD DO COMPROVANTE
// =========================================================================
function abrirModalAbastecimento(index) {
  const item = listaAbastecimentosCache[index];
  if (!item) return;

  urlComprovanteAtual = item.url_comprovante;

  document.getElementById('modal-abast-veiculo').innerText = `${item.veiculo_id}`;
  document.getElementById('modal-abast-posto').innerText = item.local_posto || '-';
  document.getElementById('modal-abast-tipo').innerText = item.tipo_combustivel || 'Não informado';
  document.getElementById('modal-abast-resp').innerText = item.responsavel || '-';
  document.getElementById('modal-abast-km').innerText = item.km_atual ? `${Number(item.km_atual).toLocaleString('pt-BR')} km` : 'Não registrado';
  document.getElementById('modal-abast-litros-preco').innerText = `${item.quantidade_litros} L • R$ ${Number(item.preco_litro).toFixed(2)}/L`;
  document.getElementById('modal-abast-total').innerText = Number(item.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  document.getElementById('modal-abast-data').innerText = new Date(item.data_hora).toLocaleString('pt-BR');

  const boxComprovante = document.getElementById('modal-box-comprovante');
  const semComprovante = document.getElementById('modal-sem-comprovante');
  const imgPreview = document.getElementById('modal-img-preview');
  const btnVer = document.getElementById('btn-ver-imagem');

  if (item.url_comprovante) {
    imgPreview.src = item.url_comprovante;
    btnVer.href = item.url_comprovante;
    boxComprovante.classList.remove('hidden');
    semComprovante.classList.add('hidden');
  } else {
    boxComprovante.classList.add('hidden');
    semComprovante.classList.remove('hidden');
  }

  document.getElementById('modal-detalhes-abast').classList.remove('hidden');
}

function fecharModalAbastecimento() {
  document.getElementById('modal-detalhes-abast').classList.add('hidden');
}

// Baixa o comprovante diretamente para a galeria / downloads do aparelho
async function baixarImagemComprovante() {
  if (!urlComprovanteAtual) return;
  try {
    const resposta = await fetch(urlComprovanteAtual);
    const blob = await resposta.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comprovante_abastecimento_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (err) {
    // Fallback caso ocorra bloqueio de CORS
    window.open(urlComprovanteAtual, '_blank');
  }
}

// =========================================================================
// EXPOSIÇÃO GLOBAL DE FUNÇÕES
// =========================================================================
window.abrirModalAbastecimento = abrirModalAbastecimento;
window.fecharModalAbastecimento = fecharModalAbastecimento;
window.baixarImagemComprovante = baixarImagemComprovante;
// =========================================================================
// LOGOUT MOBILE
// =========================================================================
function handleMobileLogout() {
  if (confirm("Deseja realmente sair da sua conta?")) {
    localStorage.removeItem('arvo_mobile_user');
    localStorage.removeItem('arvo_usuario_logado');
    window.location.href = "mobile.html";
  }
}

// =========================================================================
// VÍNCULOS GLOBAIS (WINDOW)
// =========================================================================
window.trocarAba = trocarAba;
window.calcularTotalAbastecimentoMobile = calcularTotalAbastecimentoMobile;
window.atualizarNomeArquivo = atualizarNomeArquivo;
window.salvarAbastecimento = salvarAbastecimento;
window.carregarHistorico = carregarHistoricoAbastecimento;
window.carregarHistoricoAbastecimento = carregarHistoricoAbastecimento;
window.handleMobileLogout = handleMobileLogout;

// Inicializa automaticamente
document.addEventListener('DOMContentLoaded', initAbastecimentoMobile);