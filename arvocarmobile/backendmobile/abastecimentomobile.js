// =========================================================================
// MÓDULO: ABASTECIMENTO MOBILE - ARVO
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
// NAVEGAÇÃO ENTRE TELAS E ABAS DO MOBILE
// =========================================================================
function switchMobileTab(tab) {
  // Se chamado para as abas locais de abastecimento
  if (tab === 'novo' || tab === 'historico_abast') {
    trocarAba(tab === 'novo' ? 'novo' : 'historico');
    return;
  }
  // Se for Iniciar, Finalizar ou Rotas: grava destino e redireciona para a tela de rotas
  localStorage.setItem('arvo_mobile_active_tab', tab);
  window.location.href = `mobile.html?tab=${tab}`;
}

// =========================================================================
// 1. INICIALIZAÇÃO SEGURA
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
      const userDisplay = document.getElementById('user-display');
      if (userDisplay && usuarioLogado) {
        userDisplay.innerText = `${usuarioLogado.nome || usuarioLogado.email || 'Condutor'}`;
      }
    }
  } catch (err) {
    console.warn("Aviso ao ler sessão:", err);
  }

  await carregarVeiculosAbastecimento();
  await carregarHistoricoAbastecimento();
}

// =========================================================================
// 2. CONTROLE DE SUB-ABAS (NOVO REGISTRO / HISTÓRICO LOCAL)
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
    if (btnNovo) {
      btnNovo.classList.remove('mobile-subtab-btn-inactive');
      btnNovo.classList.add('mobile-subtab-btn-active');
      btnNovo.style.cssText = "color: #fde047 !important; border-bottom-color: #fde047 !important;";
    }
    if (btnHist) {
      btnHist.classList.remove('mobile-subtab-btn-active');
      btnHist.classList.add('mobile-subtab-btn-inactive');
      btnHist.style.cssText = "color: rgba(255,255,255,0.6) !important; border-bottom-color: transparent !important;";
    }
  } else {
    viewNovo.classList.add('hidden');
    viewHist.classList.remove('hidden');
    if (btnHist) {
      btnHist.classList.remove('mobile-subtab-btn-inactive');
      btnHist.classList.add('mobile-subtab-btn-active');
      btnHist.style.cssText = "color: #fde047 !important; border-bottom-color: #fde047 !important;";
    }
    if (btnNovo) {
      btnNovo.classList.remove('mobile-subtab-btn-active');
      btnNovo.classList.add('mobile-subtab-btn-inactive');
      btnNovo.style.cssText = "color: rgba(255,255,255,0.6) !important; border-bottom-color: transparent !important;";
    }
    carregarHistoricoAbastecimento();
  }
}

// =========================================================================
// 3. CARREGAMENTO DE VEÍCULOS
// =========================================================================
async function carregarVeiculosAbastecimento() {
  const sel = document.getElementById('abs-veiculo');
  if (!sel) return;

  const localV = localStorage.getItem('arvo_cache_veiculos');
  if (localV) {
    try {
      veiculosAbast = JSON.parse(localV);
      renderSelectVeiculos(sel);
    } catch (e) {
      veiculosAbast = [];
    }
  }

  if (navigator.onLine) {
    try {
      const { data, error } = await db.from('veiculos').select('*').neq('status', 'Fora de Uso').order('nome_frota');
      if (!error && data) {
        veiculosAbast = data;
        localStorage.setItem('arvo_cache_veiculos', JSON.stringify(data));
        renderSelectVeiculos(sel);
      }
    } catch (e) {
      console.warn("Falha de conexão ao carregar veículos online:", e);
    }
  }
}

function renderSelectVeiculos(sel) {
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione o veículo...</option>';

  veiculosAbast.forEach(v => {
    const nomeFrota = v.nome_frota || v.id;
    const placaFmt = v.placa ? ` [${v.placa}]` : '';
    const marcaFmt = v.marca ? ` - ${v.marca}` : '';
    sel.innerHTML += `
      <option value="${nomeFrota}" data-uuid="${v.uuid_veiculos || ''}" data-placa="${v.placa || ''}" data-id="${v.id}">
        ${nomeFrota}${marcaFmt}${placaFmt}
      </option>
    `;
  });
}

// =========================================================================
// 4. CÁLCULOS E ANEXO
// =========================================================================
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
    label.innerText = 'Tirar foto ou anexar arquivo';
  }
}

// =========================================================================
// 5. REGISTRO DE ABASTECIMENTO
// =========================================================================
async function salvarAbastecimentoMobile(e) {
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
  const idNumerico = opt?.dataset?.id || null;
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

  try {
    let url_comprovante = null;

    if (fotoInput && fotoInput.files && fotoInput.files[0]) {
      try {
        const file = fotoInput.files[0];
        const extensao = file.name.split('.').pop();
        const fileName = `abast_${Date.now()}_${Math.random().toString(36).substring(7)}.${extensao}`;

        const { error: upErr } = await db.storage
          .from('comprovantes')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (!upErr) {
          const { data: publicUrlData } = db.storage.from('comprovantes').getPublicUrl(fileName);
          url_comprovante = publicUrlData?.publicUrl || null;
        }
      } catch (imgErr) {
        console.warn("Aviso no upload da imagem:", imgErr);
      }
    }

    const payload = {
      veiculo_id: veiculo_id,
      placa: placa,
      responsavel: (usuarioLogado && usuarioLogado.email) ? usuarioLogado.email : 'mobile@arvo.tec.br',
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

    const { error: insErr } = await db.from('abastecimentos').insert([payload]);
    if (insErr) throw insErr;

    // Atualização de Odômetro e Tanque Virtual
    try {
      let queryVeic = db.from('veiculos').select('id, tanque, tanque_virtual, km_atual');
      if (uuid_veiculos) {
        queryVeic = queryVeic.eq('uuid_veiculos', uuid_veiculos);
      } else if (idNumerico) {
        queryVeic = queryVeic.eq('id', idNumerico);
      } else {
        queryVeic = queryVeic.eq('nome_frota', veiculo_id);
      }

      const { data: vAtual } = await queryVeic.maybeSingle();

      if (vAtual) {
        const capMax = Number(vAtual.tanque || 50);
        const saldoAtual = (vAtual.tanque_virtual !== null && vAtual.tanque_virtual !== undefined)
          ? Number(vAtual.tanque_virtual)
          : 0;

        const novoSaldo = Math.min(capMax, Number((saldoAtual + quantidade_litros).toFixed(2)));
        const updateDados = { tanque_virtual: novoSaldo };

        if (km_atual && (!vAtual.km_atual || km_atual > Number(vAtual.km_atual))) {
          updateDados.km_atual = km_atual;
        }

        await db.from('veiculos').update(updateDados).eq('id', vAtual.id);
      }
    } catch (veicErr) {
      console.warn("Aviso ao atualizar veículo:", veicErr);
    }

    alert('✅ Abastecimento registrado com sucesso!');

    const form = document.getElementById('form-abastecimento');
    if (form) form.reset();

    const labelFoto = document.getElementById('comprovante-nome');
    if (labelFoto) labelFoto.innerText = 'Tirar foto ou anexar arquivo';

    calcularTotal();
    await carregarHistoricoAbastecimento();
    trocarAba('historico');

  } catch (err) {
    console.error("Erro ao salvar abastecimento:", err);
    alert('Erro ao salvar abastecimento: ' + (err.message || 'Verifique sua conexão.'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check"></i><span>Registrar Abastecimento</span>`;
    }
  }
}

// =========================================================================
// 6. HISTÓRICO DE ABASTECIMENTOS
// =========================================================================
async function carregarHistoricoAbastecimento() {
  const container = document.getElementById('lista-abastecimentos');
  if (!container) return;

  const localAbast = localStorage.getItem('arvo_cache_abastecimentos');
  if (localAbast) {
    try {
      listaAbastecimentosCache = JSON.parse(localAbast);
      renderCardsHistorico(container);
    } catch (e) {
      listaAbastecimentosCache = [];
    }
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
      console.warn("Offline: Usando histórico local.");
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
    const veic = (veiculosAbast || []).find(v =>
      String(v.id) === String(a.veiculo_id) ||
      String(v.uuid_veiculos) === String(a.uuid_veiculos || a.veiculo_id) ||
      String(v.placa) === String(a.placa || a.veiculo_id) ||
      String(v.nome_frota) === String(a.veiculo_id)
    );

    const nomeExibicao = a.nome_frota || veic?.nome_frota || a.veiculo_id || 'ARVO';
    const placaReal = a.placa || veic?.placa || '';
    const badgePlaca = placaReal ? ` [${placaReal}]` : '';

    const combustivelFormatado = a.tipo_combustivel || 'Gasolina Comum';
    const postoFormatado = a.local_posto || 'Posto de Combustível';
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
        <button type="button" onclick="abrirModalAbastecimento(${index})" class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 transition">
          <i class="ph-bold ph-eye"></i> Ver Detalhes
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

// =========================================================================
// 7. MODAL DE DETALHES E COMPROVANTE
// =========================================================================
function abrirModalAbastecimento(index) {
  const item = listaAbastecimentosCache[index];
  if (!item) return;

  urlComprovanteAtual = item.url_comprovante || null;

  const veic = (veiculosAbast || []).find(v =>
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
// 8. BINDING GLOBAL MANDATÓRIO
// =========================================================================
window.switchMobileTab = switchMobileTab;
window.trocarAba = trocarAba;
window.calcularTotal = calcularTotal;
window.atualizarNomeArquivo = atualizarNomeArquivo;
window.salvarAbastecimento = salvarAbastecimentoMobile;
window.salvarAbastecimentoMobile = salvarAbastecimentoMobile;
window.carregarHistoricoAbastecimento = carregarHistoricoAbastecimento;
window.abrirModalAbastecimento = abrirModalAbastecimento;
window.fecharModalAbastecimento = fecharModalAbastecimento;
window.baixarImagemComprovante = baixarImagemComprovante;
window.handleMobileLogout = handleMobileLogout;

document.addEventListener('DOMContentLoaded', initAbastecimentoMobile);