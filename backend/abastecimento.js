 const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

    const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let usuarioLogado = null;
    let veiculos = [];
    let abastecimentos = [];

    async function init() {
      // Ajuste de link de voltar se estiver no mobile
      const sessao = localStorage.getItem('arvo_mobile_user') || localStorage.getItem('arvo_usuario_logado');
      if (!sessao) {
        window.location.href = "login.html";
        return;
      }
      usuarioLogado = JSON.parse(sessao);

      if (localStorage.getItem('arvo_mobile_user')) {
        document.getElementById('link-voltar').href = 'paginainicial.html';
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
    erro:    { icon: 'ph-x-circle',     bg: '#ffe4e6', text: '#e11d48', btn: '#e11d48' },
    aviso:   { icon: 'ph-warning',      bg: '#fef3c7', text: '#d97706', btn: '#d97706' },
    info:    { icon: 'ph-info',         bg: '#e0f2fe', text: '#0284c7', btn: '#0284c7' }
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
    // 1. Filtra direto no Supabase excluindo 'Fora de Uso'
    const { data, error } = await db
      .from('veiculos')
      .select('*')
      .neq('status', 'Fora de Uso')
      .order('nome_frota');

    if (error) throw error;
    veiculos = data || [];

    // 2. Filtro de segurança local (garante apenas veículos ativos)
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
      sel.innerHTML += `<option value="${v.placa}" data-uuid="${v.uuid_veiculos || ''}" data-placa="${v.placa}">${nomeFrota}${placa}</option>`;
    });

  } catch (err) {
    console.error("Erro ao carregar veículos:", err);
    sel.innerHTML = '<option value="">Erro ao carregar veículos</option>';
  }
}

    async function carregarAbastecimentos() {
      const { data } = await db.from('abastecimentos').select('*').order('data_hora', { ascending: false }).limit(20);
      abastecimentos = data || [];
      renderizarHistorico();
    }

    // Cálculo automático de Total
    function calcularTotalAbastecimento() {
      const litros = parseFloat(document.getElementById('abast-litros').value) || 0;
      const preco = parseFloat(document.getElementById('abast-preco-litro').value) || 0;
      const total = litros * preco;

      document.getElementById('display-valor-total').innerText = total.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      });
    }

    // Pré-visualização da imagem anexada
    function previewImagemCupom(e) {
      const file = e.target.files[0];
      const preview = document.getElementById('img-preview');
      const placeholder = document.getElementById('box-preview-placeholder');

      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          preview.src = evt.target.result;
          preview.classList.remove('hidden');
          placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
      }
    }

    // Salvar abastecimento com Upload de Imagem
    async function handleSalvarAbastecimento(e) {
      e.preventDefault();
      const btn = document.getElementById('btn-salvar-abastecimento');
      const veiculoId = document.getElementById('abast-veiculo').value;
      const localPosto = document.getElementById('abast-local').value.trim();
      const litros = parseFloat(document.getElementById('abast-litros').value);
      const precoLitro = parseFloat(document.getElementById('abast-preco-litro').value);
      const tipo_combustivel = document.getElementById('abast-tipo')?.value || 'Gasolina Comum';
      const valorTotal = Number((litros * precoLitro).toFixed(2));
      const fileInput = document.getElementById('abast-foto');
      const arquivoFoto = fileInput.files[0];

      if (!veiculoId || isNaN(litros) || isNaN(precoLitro) || litros <= 0 || precoLitro <= 0) {
        alert("Preencha todos os campos corretamente.");
        return;
      }

      btn.disabled = true;
      btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando Abastecimento...`;

      let urlComprovanteFinal = null;

      try {
        // 1. Upload do Cupom Fiscal para o Storage do Supabase (se anexado)
        if (arquivoFoto) {
          const fileExt = arquivoFoto.name.split('.').pop();
          const fileName = `cupom_${veiculoId}_${Date.now()}.${fileExt}`;
          
          const { error: uploadError } = await db.storage
            .from('comprovantes')
            .upload(fileName, arquivoFoto);

          if (uploadError) {
            console.warn("Aviso no upload do comprovante:", uploadError.message);
          } else {
            const { data: publicUrlData } = db.storage
              .from('comprovantes')
              .getPublicUrl(fileName);
            urlComprovanteFinal = publicUrlData?.publicUrl || null;
          }
        }

        // 2. Gravação no banco de dados
        const novoAbastecimento = {
          veiculo_id: veiculoId,
          responsavel: usuarioLogado.email,
          local_posto: localPosto,
          quantidade_litros: litros,
          preco_litro: precoLitro,
          valor_total: valorTotal,
          data_hora: new Date().toISOString(), // Data e hora automática
          url_comprovante: urlComprovanteFinal
        };

        const { error: insertError } = await db.from('abastecimentos').insert([novoAbastecimento]);
        if (insertError) throw insertError;

        alert(`✅ Abastecimento de ${litros} L no ${veiculoId} gravado com sucesso!`);
        
        e.target.reset();
        document.getElementById('img-preview').classList.add('hidden');
        document.getElementById('box-preview-placeholder').classList.remove('hidden');
        calcularTotalAbastecimento();
        await carregarAbastecimentos();

      } catch (err) {
        alert("Erro ao registrar abastecimento: " + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="ph-bold ph-check text-base"></i> <span>Registrar Abastecimento</span>`;
      }
    }

    let urlComprovanteAtual = null;

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
    // Cruza os dados para buscar o nome_frota (ex: ARVO 10)
    const veic = (typeof veiculos !== 'undefined' ? veiculos : []).find(v => 
      String(v.id) === String(a.veiculo_id) || 
      String(v.uuid_veiculos) === String(a.veiculo_id) || 
      String(v.placa) === String(a.veiculo_id) ||
      String(v.nome_frota) === String(a.veiculo_id) ||
      String(v.placa) === String(a.placa)
    );

    const nomeExibicao = veic?.nome_frota || a.nome_frota || a.veiculo_id || 'Veículo';
    const placaExibicao = a.placa ? ` [${a.placa}]` : (veic?.placa ? ` [${veic.placa}]` : '');

    const card = document.createElement('div');
    card.className = "p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs hover:border-slate-300 transition";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-extrabold text-slate-900 text-sm">${nomeExibicao}${placaExibicao}</span>
        <span class="font-mono font-bold text-emerald-700 text-sm">
          ${Number(a.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </div>
      <div class="text-slate-600 font-medium">
        <i class="ph-bold ph-map-pin text-slate-400 mr-1"></i>${a.local_posto || '-'} • <span class="text-slate-500 font-normal">${a.tipo_combustivel || 'Combustível'}</span>
      </div>
      <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1.5 border-t border-slate-200">
        <span>${a.quantidade_litros} L (R$ ${Number(a.preco_litro).toFixed(2)}/L)</span>
        <span>${new Date(a.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
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

  urlComprovanteAtual = item.url_comprovante;

  const veic = (typeof veiculos !== 'undefined' ? veiculos : []).find(v => 
    String(v.id) === String(item.veiculo_id) || 
    String(v.uuid_veiculos) === String(item.veiculo_id) || 
    String(v.placa) === String(item.veiculo_id) ||
    String(v.nome_frota) === String(item.veiculo_id) ||
    String(v.placa) === String(item.placa)
  );

  const nomeExibicaoModal = veic?.nome_frota || item.nome_frota || item.veiculo_id || 'Veículo';
  const placaModal = item.placa ? ` [${item.placa}]` : (veic?.placa ? ` [${veic.placa}]` : '');

  document.getElementById('modal-abast-veiculo').innerText = `${nomeExibicaoModal}${placaModal}`;
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
window.abrirModalAbastecimento = abrirModalAbastecimento;
window.fecharModalAbastecimento = fecharModalAbastecimento;
window.baixarImagemComprovante = baixarImagemComprovante;
  

window.onload = init;