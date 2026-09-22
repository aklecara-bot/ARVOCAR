// =========================================================================
// MÓDULO: ABASTECIMENTO WEB / DESKTOP - ARVOCAR
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

let usuarioLogado = null;
let veiculos = [];
let abastecimentos = [];
let urlComprovanteAtual = null;

async function init() {
  const sessao = localStorage.getItem('arvo_mobile_user') || localStorage.getItem('arvo_usuario_logado');
  if (!sessao) {
    window.location.href = "login.html";
    return;
  }
  try {
    usuarioLogado = JSON.parse(sessao);
  } catch (e) {
    usuarioLogado = { email: sessao, nome: sessao };
  }

  const linkVoltar = document.getElementById('link-voltar');
  if (linkVoltar && localStorage.getItem('arvo_mobile_user')) {
    linkVoltar.href = 'paginainicial.html';
  }

  await carregarVeiculos();
  await carregarAbastecimentos();
}

/**
 * Popup Universal Centralizado (Web & Mobile)
 */
function mostrarPopupCustom(tipo, titulo, mensagem, onClose = null) {
  const modalId = `app-popup-${Date.now()}`;

  const temas = {
    sucesso: { icon: 'ph-check-circle', bg: '#dcfce7', text: '#15803d', btn: '#15803d' },
    erro: { icon: 'ph-x-circle', bg: '#ffe4e6', text: '#e11d48', btn: '#e11d48' },
    aviso: { icon: 'ph-warning', bg: '#fef3c7', text: '#d97706', btn: '#d97706' },
    info: { icon: 'ph-info', bg: '#e0f2fe', text: '#0284c7', btn: '#0284c7' }
  };

  const config = temas[tipo] || temas.aviso;

  const backdrop = document.createElement('div');
  backdrop.id = modalId;
  backdrop.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background-color: rgba(15, 23, 42, 0.75) !important;
    backdrop-filter: blur(4px) !important;
    -webkit-backdrop-filter: blur(4px) !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 1rem !important;
    box-sizing: border-box !important;
  `;

  backdrop.innerHTML = `
    <div style="
      background-color: #ffffff !important;
      border-radius: 1.5rem !important;
      width: 100% !important;
      max-width: 24rem !important;
      padding: 1.5rem !important;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35) !important;
      border: 1px solid #f1f5f9 !important;
      text-align: center !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 1rem !important;
      box-sizing: border-box !important;
      font-family: inherit !important;
    ">
      <div style="
        width: 3.5rem !important;
        height: 3.5rem !important;
        border-radius: 1rem !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 1.75rem !important;
        background-color: ${config.bg} !important;
        color: ${config.text} !important;
      ">
        <i class="ph-bold ${config.icon}"></i>
      </div>

      <div style="width: 100% !important;">
        <h3 style="font-size: 1.05rem !important; font-weight: 900 !important; color: #0f172a !important; margin: 0 0 0.5rem 0 !important;">
          ${titulo}
        </h3>
        <p style="font-size: 0.8125rem !important; color: #475569 !important; margin: 0 !important; line-height: 1.45 !important; word-break: break-word !important;">
          ${mensagem}
        </p>
      </div>

      <button type="button" id="${modalId}-btn" style="
        width: 100% !important;
        padding: 0.75rem 1rem !important;
        border-radius: 0.75rem !important;
        font-weight: 700 !important;
        font-size: 0.8125rem !important;
        border: none !important;
        cursor: pointer !important;
        color: #ffffff !important;
        background-color: ${config.btn} !important;
      ">
        Entendido
      </button>
    </div>
  `;

  document.body.appendChild(backdrop);

  const fechar = () => {
    backdrop.remove();
    if (typeof onClose === 'function') onClose();
  };

  document.getElementById(`${modalId}-btn`).onclick = fechar;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) fechar();
  };
}

// Converte chamadas automáticas de alert()
window.alert = function (msg) {
  const texto = String(msg || '');
  let tipo = 'aviso';
  let titulo = 'Atenção';

  const t = texto.toLowerCase();
  if (t.includes('sucesso') || t.includes('salvo') || t.includes('confirmad')) {
    tipo = 'sucesso';
    titulo = 'Sucesso!';
  } else if (t.includes('erro') || t.includes('falha') || t.includes('inválid')) {
    tipo = 'erro';
    titulo = 'Erro!';
  }

  mostrarPopupCustom(tipo, titulo, texto);
};

async function carregarVeiculos() {
  const sel = document.getElementById('abast-veiculo') || document.getElementById('abs-veiculo');
  if (!sel) return;

  sel.innerHTML = '<option value="">Carregando veículos...</option>';

  try {
    const { data, error } = await db
      .from('veiculos')
      .select('*')
      .neq('status', 'Fora de Uso')
      .order('nome_frota');

    if (error) throw error;
    veiculos = data || [];

    const veiculosAtivos = veiculos.filter(v => {
      const status = (v.status || '').toUpperCase().trim();
      return status !== 'FORA DE USO';
    });

    if (veiculosAtivos.length === 0) {
      sel.innerHTML = '<option value="">Nenhum carro ativo disponível</option>';
      return;
    }

    sel.innerHTML = '<option value="">Selecione o carro...</option>';
    veiculosAtivos.forEach(v => {
      const nomeFrota = v.nome_frota || v.id || 'Veículo';
      const placa = v.placa ? ` [${v.placa}]` : '';
      // Salva nome_frota no value, e propaga UUID e Placa via dataset
      sel.innerHTML += `<option value="${nomeFrota}" data-uuid="${v.uuid_veiculos || ''}" data-placa="${v.placa || ''}" data-id="${v.id}">${nomeFrota}${placa}</option>`;
    });

  } catch (err) {
    console.error("Erro ao carregar veículos:", err);
    sel.innerHTML = '<option value="">Erro ao carregar veículos</option>';
  }
}

async function carregarAbastecimentos() {
  try {
    const { data, error } = await db.from('abastecimentos').select('*').order('data_hora', { ascending: false }).limit(30);
    if (!error && data) {
      abastecimentos = data;
      renderizarHistorico();
    }
  } catch (e) {
    console.warn("Erro ao carregar histórico de abastecimentos:", e);
  }
}

// Cálculo automático de Total
function calcularTotalAbastecimento() {
  const litros = parseFloat(document.getElementById('abast-litros')?.value) || 0;
  const preco = parseFloat(document.getElementById('abast-preco-litro')?.value) || 0;
  const total = litros * preco;

  const display = document.getElementById('display-valor-total');
  if (display) {
    display.innerText = total.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  }
  const displayHidden = document.getElementById('abast-total-calc');
  if (displayHidden) {
    displayHidden.innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}

// Pré-visualização da imagem anexada
function previewImagemCupom(e) {
  const file = e.target.files[0];
  const preview = document.getElementById('img-preview');
  const placeholder = document.getElementById('box-preview-placeholder');

  if (file) {
    const reader = new FileReader();
    reader.onload = function (evt) {
      if (preview) {
        preview.src = evt.target.result;
        preview.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }
}

// Salvar abastecimento com Upload de Imagem e Atualização de Tanque Virtual
async function handleSalvarAbastecimento(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-salvar-abastecimento');
  const selVeiculo = document.getElementById('abast-veiculo');
  const opt = selVeiculo ? selVeiculo.options[selVeiculo.selectedIndex] : null;

  const veiculoId = selVeiculo ? selVeiculo.value : '';
  const uuid_veiculos = opt?.dataset?.uuid || null;
  const placa = opt?.dataset?.placa || null;
  const idNumerico = opt?.dataset?.id || null;

  const localPosto = (document.getElementById('abast-local')?.value || '').trim().toUpperCase();
  const litros = parseFloat(document.getElementById('abast-litros')?.value);
  const precoLitro = parseFloat(document.getElementById('abast-preco-litro')?.value);
  const tipo_combustivel = document.getElementById('abast-tipo')?.value || 'Gasolina Comum';
  const kmInput = document.getElementById('abast-km')?.value;
  const km_atual = kmInput ? parseInt(kmInput, 10) : null;
  const valorTotal = Number((litros * precoLitro).toFixed(2));
  const fileInput = document.getElementById('abast-foto');
  const arquivoFoto = fileInput?.files?.[0];

  if (!veiculoId || isNaN(litros) || isNaN(precoLitro) || litros <= 0 || precoLitro <= 0) {
    alert("Preencha todos os campos obrigatórios corretamente.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando Abastecimento...`;
  }

  let urlComprovanteFinal = null;

  try {
    // 1. Upload do Cupom Fiscal para o Storage do Supabase (se anexado)
    if (arquivoFoto) {
      try {
        const fileExt = arquivoFoto.name.split('.').pop();
        const fileName = `abast_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await db.storage
          .from('comprovantes')
          .upload(fileName, arquivoFoto, { cacheControl: '3600', upsert: false });

        if (!uploadError) {
          const { data: publicUrlData } = db.storage
            .from('comprovantes')
            .getPublicUrl(fileName);
          urlComprovanteFinal = publicUrlData?.publicUrl || null;
        } else {
          console.warn("Aviso no upload do comprovante:", uploadError.message);
        }
      } catch (imgErr) {
        console.warn("Aviso ao processar imagem:", imgErr);
      }
    }

    // 2. Gravação completa no banco de dados
    const novoAbastecimento = {
      veiculo_id: veiculoId,
      placa: placa,
      uuid_veiculos: uuid_veiculos,
      responsavel: (usuarioLogado && usuarioLogado.email) ? usuarioLogado.email : 'admin@arvo.tec.br',
      local_posto: localPosto,
      tipo_combustivel: tipo_combustivel,
      quantidade_litros: litros,
      preco_litro: precoLitro,
      valor_total: valorTotal,
      data_hora: new Date().toISOString(),
      url_comprovante: urlComprovanteFinal
    };

    if (km_atual && !isNaN(km_atual)) {
      novoAbastecimento.km_atual = km_atual;
    }

    const { error: insertError } = await db.from('abastecimentos').insert([novoAbastecimento]);
    if (insertError) throw insertError;

    // 3. Atualização de Odômetro e Tanque Virtual no veículo
    try {
      let q = db.from('veiculos').select('id, tanque, tanque_virtual, km_atual');
      if (uuid_veiculos) {
        q = q.eq('uuid_veiculos', uuid_veiculos);
      } else if (idNumerico) {
        q = q.eq('id', idNumerico);
      } else if (placa) {
        q = q.eq('placa', placa);
      } else {
        q = q.eq('nome_frota', veiculoId);
      }

      const { data: vAtual } = await q.maybeSingle();

      if (vAtual) {
        const capMax = Number(vAtual.tanque || 50);
        const saldoAtual = (vAtual.tanque_virtual !== null && vAtual.tanque_virtual !== undefined)
          ? Number(vAtual.tanque_virtual)
          : 0;

        const novoSaldo = Math.min(capMax, Number((saldoAtual + litros).toFixed(2)));
        const updateDados = { tanque_virtual: novoSaldo };

        if (km_atual && (!vAtual.km_atual || km_atual > Number(vAtual.km_atual))) {
          updateDados.km_atual = km_atual;
        }

        await db.from('veiculos').update(updateDados).eq('id', vAtual.id);
      }
    } catch (veicErr) {
      console.warn("Aviso ao atualizar veículo:", veicErr);
    }

    alert(`✅ Abastecimento registrado com sucesso!`);

    e.target.reset();
    const preview = document.getElementById('img-preview');
    const placeholder = document.getElementById('box-preview-placeholder');
    if (preview) preview.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');

    calcularTotalAbastecimento();
    await carregarAbastecimentos();

  } catch (err) {
    alert("Erro ao registrar abastecimento: " + (err.message || 'Verifique sua conexão.'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-base"></i> <span>Registrar Abastecimento</span>`;
    }
  }
}

function renderizarHistorico() {
  const container = document.getElementById('lista-abastecimentos');
  const badge = document.getElementById('badge-total-abast');
  if (badge) badge.innerText = `${abastecimentos.length} registros`;
  if (!container) return;
  container.innerHTML = '';

  if (abastecimentos.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Nenhum abastecimento registrado.</div>`;
    return;
  }

  abastecimentos.forEach((a, index) => {
    // Cruzamento seguro com veículos
    const veic = (typeof veiculos !== 'undefined' ? veiculos : []).find(v =>
      String(v.id) === String(a.veiculo_id) ||
      String(v.uuid_veiculos) === String(a.uuid_veiculos || a.veiculo_id) ||
      String(v.placa) === String(a.placa || a.veiculo_id) ||
      String(v.nome_frota) === String(a.veiculo_id)
    );

    const nomeExibicao = a.nome_frota || veic?.nome_frota || a.veiculo_id || 'Veículo';
    const placaReal = a.placa || veic?.placa || '';
    const placaExibicao = placaReal ? ` [${placaReal}]` : '';

    const card = document.createElement('div');
    card.className = "p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs hover:border-slate-300 transition";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-extrabold text-slate-900 text-sm">${nomeExibicao}${placaExibicao}</span>
        <span class="font-mono font-bold text-emerald-700 text-sm">
          ${Number(a.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </div>
      <div class="text-slate-600 font-medium">
        <i class="ph-bold ph-map-pin text-slate-400 mr-1"></i>${a.local_posto || '-'} • <span class="text-slate-500 font-normal">${a.tipo_combustivel || 'Combustível'}</span>
      </div>
      <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1.5 border-t border-slate-200">
        <span>${a.quantidade_litros || 0} L (R$ ${Number(a.preco_litro || 0).toFixed(2)}/L)</span>
        <span>${a.data_hora ? new Date(a.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
      </div>
      <div class="pt-2 flex items-center justify-between border-t border-slate-200/60">
        <span class="text-[10px] text-slate-400 truncate max-w-[200px]">
          <i class="ph-bold ph-user mr-1"></i>${(a.responsavel || '').split('@')[0]}
        </span>
        <button type="button" onclick="abrirModalAbastecimento(${index})" class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl border border-amber-200/60 transition shadow-sm">
          <i class="ph-bold ph-eye"></i> Ver Detalhes
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function abrirModalAbastecimento(index) {
  const item = abastecimentos[index];
  if (!item) return;

  urlComprovanteAtual = item.url_comprovante || null;

  const veic = (typeof veiculos !== 'undefined' ? veiculos : []).find(v =>
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
  if (elData) elData.innerText = item.data_hora ? new Date(item.data_hora).toLocaleString('pt-BR') : '-';

  const boxComprovante = document.getElementById('modal-box-comprovante');
  const semComprovante = document.getElementById('modal-sem-comprovante');
  const imgPreview = document.getElementById('modal-img-preview');
  const btnVer = document.getElementById('btn-ver-imagem');

  if (item.url_comprovante) {
    if (imgPreview) imgPreview.src = item.url_comprovante;
    if (btnVer) btnVer.href = item.url_comprovante;
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

// Exposição global
window.init = init;
window.carregarVeiculos = carregarVeiculos;
window.carregarAbastecimentos = carregarAbastecimentos;
window.calcularTotalAbastecimento = calcularTotalAbastecimento;
window.previewImagemCupom = previewImagemCupom;
window.handleSalvarAbastecimento = handleSalvarAbastecimento;
window.renderizarHistorico = renderizarHistorico;
window.abrirModalAbastecimento = abrirModalAbastecimento;
window.fecharModalAbastecimento = fecharModalAbastecimento;
window.baixarImagemComprovante = baixarImagemComprovante;

window.onload = init;