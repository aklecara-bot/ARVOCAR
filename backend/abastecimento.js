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
        sel.innerHTML += `<option value="${v.id}">${v.id} - ${v.marca} [${v.placa}]</option>`;
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

    function renderizarHistorico() {
      const container = document.getElementById('lista-abastecimentos');
      const badge = document.getElementById('badge-total-abast');
      badge.innerText = `${abastecimentos.length} registros`;
      container.innerHTML = '';

      if (abastecimentos.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">Nenhum abastecimento registrado.</div>`;
        return;
      }

      abastecimentos.forEach(a => {
        const card = document.createElement('div');
        card.className = "p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5 text-xs";
        card.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="font-extrabold text-slate-900">${a.veiculo_id}</span>
            <span class="font-mono font-bold text-emerald-700 text-sm">${Number(a.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          <div class="text-slate-600 font-medium">
            ${a.local_posto}
          </div>
          <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1 border-t border-slate-200">
            <span>${a.quantidade_litros} L (R$ ${Number(a.preco_litro).toFixed(2)}/L)</span>
            <span>${new Date(a.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          ${a.url_comprovante ? `
            <div class="pt-1">
              <a href="${a.url_comprovante}" target="_blank" class="inline-flex items-center gap-1 text-[11px] font-bold text-brand-700 hover:underline">
                <i class="ph-bold ph-image"></i> Ver Cupom Fiscal
              </a>
            </div>
          ` : ''}
        `;
        container.appendChild(card);
      });
    }

    window.onload = init;