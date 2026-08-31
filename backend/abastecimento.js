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

    async function carregarVeiculos() {
      const { data } = await db.from('veiculos').select('*').order('id');
      veiculos = data || [];
      const sel = document.getElementById('abast-veiculo');
      sel.innerHTML = '<option value="">Selecione o carro...</option>';
      veiculos.forEach(v => {
      sel.innerHTML += `<option value="${v.placa}" data-uuid="${v.nome_frota || ''}" data-placa="${v.placa}">${v.placa} - ${v.nome_frota}</option>`;
    });
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