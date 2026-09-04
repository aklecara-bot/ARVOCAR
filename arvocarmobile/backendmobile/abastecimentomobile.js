// =========================================================================
// MÓDULO: ABASTECIMENTO MOBILE - SUPORTE OFFLINE ARVO
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

let usuarioLogado = null;
let veiculosAbast = [];
let listaAbastecimentosCache = [];
let urlComprovanteAtual = null;

// =========================================================================
// INICIALIZAÇÃO
// =========================================================================
async function initAbastecimentoMobile() {
  const sessaoStr = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  if (sessaoStr) {
    try {
      usuarioLogado = JSON.parse(sessaoStr);
    } catch (e) {
      usuarioLogado = { email: sessaoStr, nome: sessaoStr };
    }
    const userDisplay = document.getElementById('user-display');
    if (userDisplay) userDisplay.innerText = `${usuarioLogado.nome || usuarioLogado.email || 'Condutor'}`;
  }

  await carregarVeiculosAbastecimento();
  await carregarHistoricoAbastecimento();
  sincronizarFilaAbastecimentos();
}

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

async function carregarVeiculosAbastecimento() {
  const sel = document.getElementById('abs-veiculo');
  if (!sel) return;

  // Carrega do cache primeiro
  const localV = localStorage.getItem('arvo_cache_veiculos');
  if (localV) {
    veiculosAbast = JSON.parse(localV);
    renderSelectVeiculos(sel);
  }

  if (navigator.onLine) {
    try {
      const { data, error } = await db.from('veiculos').select('*').order('id');
      if (!error && data) {
        veiculosAbast = data;
        localStorage.setItem('arvo_cache_veiculos', JSON.stringify(data));
        renderSelectVeiculos(sel);
      }
    } catch (e) {
      console.warn("Offline: Usando veículos em cache.");
    }
  }
}

function renderSelectVeiculos(sel) {
  sel.innerHTML = '<option value="">Selecione o veículo...</option>';
  veiculosAbast.forEach(v => {
    sel.innerHTML += `<option value="${v.nome_frota || v.id}" data-uuid="${v.uuid_veiculos || ''}" data-placa="${v.placa || ''}">${v.nome_frota || v.id} - ${v.marca || ''} [${v.placa || ''}]</option>`;
  });
}

function calcularTotal() {
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
// SALVAR ABASTECIMENTO (ONLINE & OFFLINE)
// =========================================================================
async function salvarAbastecimento(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const btn = document.getElementById('btn-submit');

  const selVeiculo = document.getElementById('abs-veiculo');
  const opt = selVeiculo ? selVeiculo.options[selVeiculo.selectedIndex] : null;
  const veiculo_id = selVeiculo ? selVeiculo.value : '';

  if (!veiculo_id) {
    alert("Por favor, selecione um veículo.");
    return;
  }

  const uuid_veiculos = opt?.dataset?.uuid || null;
  const placa = opt?.dataset?.placa || null;
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

  const payload = {
    veiculo_id,
    uuid_veiculos,
    placa,
    responsavel: (usuarioLogado && usuarioLogado.email) ? usuarioLogado.email : 'admin@arvo.tec.br',
    local_posto,
    tipo_combustivel,
    quantidade_litros,
    preco_litro,
    valor_total,
    km_atual,
    data_hora: new Date().toISOString()
  };

  // Se offline, salva imagem em Base64 e enfileira
  if (!navigator.onLine) {
    if (fotoInput && fotoInput.files && fotoInput.files[0]) {
      payload.foto_base64 = await fileToBase64(fotoInput.files[0]);
      payload.foto_nome = fotoInput.files[0].name;
    }
    salvarFilaAbastecimento(payload);
    salvarHistoricoLocal(payload);
    alert('📶 Abastecimento gravado em Modo Offline! Será enviado ao conectar.');
    limparFormularioAposSalvar();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-base"></i><span>Registrar Abastecimento</span>`;
    }
    return;
  }

  // Se online, faz upload da imagem e salva no banco
  try {
    let url_comprovante = null;

    if (fotoInput && fotoInput.files && fotoInput.files[0]) {
      const file = fotoInput.files[0];
      const extensao = file.name.split('.').pop();
      const fileName = `abast_${Date.now()}_${Math.random().toString(36).substring(7)}.${extensao}`;

      // Upload do arquivo para o bucket 'comprovantes'
      const { error: upErr } = await db.storage
        .from('comprovantes')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (upErr) {
        console.error("Falha no upload da foto para o Storage:", upErr);
        throw new Error(`Erro ao enviar foto do comprovante: ${upErr.message}`);
      }

      // Resgata o link público da imagem
      const { data: publicUrlData } = db.storage
        .from('comprovantes')
        .getPublicUrl(fileName);

      url_comprovante = publicUrlData?.publicUrl || null;
    }

    payload.url_comprovante = url_comprovante;

    // Inserção no Supabase
    const { error: insErr } = await db.from('abastecimentos').insert([payload]);
    if (insErr) throw insErr;

    // Atualização opcional do KM na tabela veiculos (protegida contra erros de RLS)
    if (km_atual && !isNaN(km_atual)) {
      try {
        let query = db.from('veiculos').update({ km_atual: km_atual });
        if (uuid_veiculos) {
          query = query.eq('uuid_veiculos', uuid_veiculos);
        } else {
          query = query.eq('id', veiculo_id);
        }
        await query.lt('km_atual', km_atual);
      } catch (vErr) {
        console.warn("Aviso ao atualizar KM do veículo:", vErr);
      }
    }

    alert('✅ Abastecimento registrado com sucesso!');
    limparFormularioAposSalvar();
    await carregarHistoricoAbastecimento();
    if (typeof trocarAba === 'function') {
      trocarAba('historico');
    }
  } catch (err) {
    console.error("Erro no fluxo online:", err);
    alert('Erro ao salvar: ' + (err.message || 'Verifique sua conexão.'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-base"></i><span>Registrar Abastecimento</span>`;
    }
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function salvarFilaAbastecimento(item) {
  const fila = JSON.parse(localStorage.getItem('arvo_sync_abast_queue') || '[]');
  fila.push(item);
  localStorage.setItem('arvo_sync_abast_queue', JSON.stringify(fila));
}

function salvarHistoricoLocal(item) {
  listaAbastecimentosCache.unshift(item);
  localStorage.setItem('arvo_cache_abastecimentos', JSON.stringify(listaAbastecimentosCache));
}

async function sincronizarFilaAbastecimentos() {
  if (!navigator.onLine) return;
  const fila = JSON.parse(localStorage.getItem('arvo_sync_abast_queue') || '[]');
  if (fila.length === 0) return;

  console.log(`-> Sincronizando ${fila.length} abastecimentos pendentes...`);
  const restantes = [];

  for (const item of fila) {
    try {
      const { foto_base64, foto_nome, ...payloadEnvio } = item;
      await db.from('abastecimentos').insert([payloadEnvio]);
    } catch (e) {
      restantes.push(item);
    }
  }

  localStorage.setItem('arvo_sync_abast_queue', JSON.stringify(restantes));
  if (restantes.length === 0) {
    await carregarHistoricoAbastecimento();
  }
}

window.addEventListener('online', sincronizarFilaAbastecimentos);

function limparFormularioAposSalvar() {
  const form = document.getElementById('form-abastecimento');
  if (form) form.reset();
  const labelFoto = document.getElementById('comprovante-nome');
  if (labelFoto) labelFoto.innerText = 'Tirar foto ou anexar comprovante';
  calcularTotal();
}

// =========================================================================
// CARREGAR E RENDERIZAR HISTÓRICO
// =========================================================================
async function carregarHistoricoAbastecimento() {
  const container = document.getElementById('lista-abastecimentos');
  if (!container) return;

  const localAbast = localStorage.getItem('arvo_cache_abastecimentos');
  if (localAbast) {
    listaAbastecimentosCache = JSON.parse(localAbast);
    renderCardsHistorico(container);
  }

  if (navigator.onLine) {
    try {
      const { data, error } = await db
        .from('abastecimentos')
        .select('*')
        .order('data_hora', { ascending: false })
        .limit(30);

      if (!error && data) {
        listaAbastecimentosCache = data;
        localStorage.setItem('arvo_cache_abastecimentos', JSON.stringify(data));
        renderCardsHistorico(container);
      }
    } catch (e) {
      console.warn("Offline: Mantendo histórico cacheado.");
    }
  }
}

function renderCardsHistorico(container) {
  if (!listaAbastecimentosCache || listaAbastecimentosCache.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">Nenhum abastecimento encontrado.</div>`;
    return;
  }

  container.innerHTML = '';
  listaAbastecimentosCache.forEach((a, index) => {
    const veic = (typeof veiculosAbast !== 'undefined' ? veiculosAbast : []).find(v =>
      String(v.id) === String(a.veiculo_id) ||
      String(v.uuid_veiculos) === String(a.uuid_veiculos || a.veiculo_id) ||
      String(v.placa) === String(a.placa || a.veiculo_id) ||
      String(v.nome_frota) === String(a.veiculo_id)
    );

    let nomeExibicao = a.nome_frota || veic?.nome_frota;
    if (!nomeExibicao) {
      nomeExibicao = a.veiculo_id && !a.veiculo_id.includes('-') ? a.veiculo_id : (veic?.id || 'ARVO');
    }

    const placaReal = a.placa || veic?.placa || (a.veiculo_id && a.veiculo_id.match(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/) ? a.veiculo_id : null);
    const badgePlaca = placaReal ? ` [${placaReal}]` : '';

    const combustivelFormatado = (a.tipo_combustivel && a.tipo_combustivel !== 'null') ? a.tipo_combustivel : 'Gasolina Comum';
    const postoFormatado = (a.local_posto && a.local_posto !== 'null') ? a.local_posto : 'Posto de Combustível';
    const valorFormatado = Number(a.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const card = document.createElement('div');
    card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 transition hover:border-slate-300";

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-slate-800 font-mono flex items-center gap-1.5">
          <i class="ph-bold ph-gas-pump text-amber-500"></i> ${nomeExibicao}${badgePlaca}
        </span>
        <span class="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
          ${valorFormatado}
        </span>
      </div>
      <div class="text-xs text-slate-600 font-medium">
        ${postoFormatado} • <span class="text-slate-500">${combustivelFormatado}</span>
      </div>
      <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono border-t pt-1.5 border-slate-100">
        <span>${a.quantidade_litros || 0} L (R$ ${Number(a.preco_litro || 0).toFixed(2)}/L)</span>
        <span>${new Date(a.data_hora).toLocaleDateString('pt-BR')}</span>
      </div>
      <div class="pt-1 flex items-center justify-between border-t border-slate-100">
        <span class="text-[10px] text-slate-400 truncate max-w-[150px]">
          <i class="ph-bold ph-user"></i> ${(a.responsavel || '').split('@')[0]}
        </span>
        <button type="button" onclick="window.abrirModalAbastecimento(${index})" class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 transition">
          <i class="ph-bold ph-eye"></i> Ver Detalhes
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

// =========================================================================
// CONTROLE DO MODAL DE DETALHES E DOWNLOAD
// =========================================================================
function abrirModalAbastecimento(index) {
  const item = listaAbastecimentosCache[index];
  if (!item) return;

  urlComprovanteAtual = item.url_comprovante || (item.foto_base64 || null);

  const veic = (typeof veiculosAbast !== 'undefined' ? veiculosAbast : []).find(v =>
    String(v.id) === String(item.veiculo_id) ||
    String(v.uuid_veiculos) === String(item.uuid_veiculos || item.veiculo_id) ||
    String(v.placa) === String(item.placa || item.veiculo_id) ||
    String(v.nome_frota) === String(item.veiculo_id)
  );

  const nomeExibicaoModal = veic?.nome_frota || item.nome_frota || item.veiculo_id || 'Veículo';
  const placaModal = item.placa ? ` [${item.placa}]` : (veic?.placa ? ` [${veic.placa}]` : '');

  const elVeiculo = document.getElementById('modal-abast-veiculo');
  const elPosto = document.getElementById('modal-abast-posto');
  const elTipo = document.getElementById('modal-abast-tipo');
  const elResp = document.getElementById('modal-abast-resp');
  const elKm = document.getElementById('modal-abast-km');
  const elLitrosPreco = document.getElementById('modal-abast-litros-preco');
  const elTotal = document.getElementById('modal-abast-total');
  const elData = document.getElementById('modal-abast-data');

  if (elVeiculo) elVeiculo.innerText = `${nomeExibicaoModal}${placaModal}`;
  if (elPosto) elPosto.innerText = item.local_posto || '-';
  if (elTipo) elTipo.innerText = item.tipo_combustivel || 'Não informado';
  if (elResp) elResp.innerText = item.responsavel || '-';
  if (elKm) elKm.innerText = item.km_atual ? `${Number(item.km_atual).toLocaleString('pt-BR')} km` : 'Não registrado';
  if (elLitrosPreco) elLitrosPreco.innerText = `${item.quantidade_litros || 0} L • R$ ${Number(item.preco_litro || 0).toFixed(2)}/L`;
  if (elTotal) elTotal.innerText = Number(item.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (elData) elData.innerText = new Date(item.data_hora).toLocaleString('pt-BR');

  const boxComprovante = document.getElementById('modal-box-comprovante');
  const semComprovante = document.getElementById('modal-sem-comprovante');
  const imgPreview = document.getElementById('modal-img-preview');
  const btnVer = document.getElementById('btn-ver-imagem');

  if (urlComprovanteAtual) {
    if (imgPreview) imgPreview.src = urlComprovanteAtual;
    if (btnVer) btnVer.href = urlComprovanteAtual;
    if (boxComprovante) boxComprovante.classList.remove('hidden');
    if (semComprovante) semComprovante.classList.add('hidden');
  } else {
    if (boxComprovante) boxComprovante.classList.add('hidden');
    if (semComprovante) semComprovante.classList.remove('hidden');
  }

  const modal = document.getElementById('modal-detalhes-abast');
  if (modal) modal.classList.remove('hidden');
}

function fecharModalAbastecimento() {
  const modal = document.getElementById('modal-detalhes-abast');
  if (modal) modal.classList.add('hidden');
}

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
    window.open(urlComprovanteAtual, '_blank');
  }
}

function handleMobileLogout() {
  if (confirm("Deseja realmente sair da sua conta?")) {
    localStorage.removeItem('arvo_mobile_user');
    localStorage.removeItem('arvo_usuario_logado');
    window.location.href = "mobile.html";
  }
}

// =========================================================================
// EXPOSIÇÃO GLOBAL DE FUNÇÕES (WINDOW)
// =========================================================================
window.trocarAba = trocarAba;
window.calcularTotal = calcularTotal;
window.atualizarNomeArquivo = atualizarNomeArquivo;
window.salvarAbastecimento = salvarAbastecimento;
window.carregarHistorico = carregarHistoricoAbastecimento;
window.carregarHistoricoAbastecimento = carregarHistoricoAbastecimento;
window.abrirModalAbastecimento = abrirModalAbastecimento;
window.fecharModalAbastecimento = fecharModalAbastecimento;
window.baixarImagemComprovante = baixarImagemComprovante;
window.handleMobileLogout = handleMobileLogout;

document.addEventListener('DOMContentLoaded', initAbastecimentoMobile);