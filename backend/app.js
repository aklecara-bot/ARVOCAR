// =========================================================================
// 1. CONFIGURAÇÃO DO SUPABASE E ESTADOS GLOBAIS
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAIL = "admin@arvo.tec.br";

let usuarios = [];
let veiculos = [];
let rotas = [];
let currentUserIndex = 0;

// =========================================================================
// 2. CONTROLE DE SESSÃO, PERMISSÕES E LOGOUT
// =========================================================================

function verificarSessaoUsuario() {
  const sessao = localStorage.getItem('arvo_usuario_logado');
  if (!sessao) {
    window.location.href = "../frontend/login.html";
    return null;
  }
  return JSON.parse(sessao);
}

function fazerLogout() {
  const confirmacao = confirm("Tem certeza que deseja encerrar a sessão?");
  if (confirmacao) {
    localStorage.removeItem('arvo_usuario_logado');
    window.location.href = "../frontend/login.html";
  }
}

function aplicarPermissoesUsuario() {
  const sessao = verificarSessaoUsuario();
  if (!sessao) return;

  const btnGestao = document.getElementById('btn-mod-gestao');
  const ehAdmin = (sessao.email || '').toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

  if (btnGestao) {
    if (ehAdmin) {
      btnGestao.classList.remove('hidden');
    } else {
      btnGestao.classList.add('hidden');
      const modGestao = document.getElementById('module-gestao');
      if (modGestao && !modGestao.classList.contains('hidden')) {
        setModule('operacao');
      }
    }
  }
}

function atualizarUsuarioNoCabecalho() {
  if (usuarios.length === 0) return;
  const u = usuarios[currentUserIndex];
  
  const display = document.getElementById('topUserDisplay');
  const cnh = document.getElementById('topUserCnh');
  const inputUsuario = document.getElementById('form-inicio-Usuario');

  if (display) display.innerText = `${u.nome} (${u.email})`;
  if (cnh) cnh.innerText = `CNH: ${u.cnh}`;
  if (inputUsuario) inputUsuario.value = `${u.nome} <${u.email}>`;
}

// =========================================================================
// 3. NAVEGAÇÃO ENTRE MÓDULOS E SUB-ABAS
// =========================================================================

function setModule(mod) {
  const sessao = verificarSessaoUsuario();
  const ehAdmin = sessao && (sessao.email || '').toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

  if (mod === 'gestao' && !ehAdmin) {
    alert("Acesso restrito: Apenas o administrador (admin@arvo.tec.br) pode acessar o Painel de Gestão.");
    return;
  }

  const modOperacao = document.getElementById('module-operacao');
  const modGestao = document.getElementById('module-gestao');
  const subnavOperacao = document.getElementById('subnav-operacao');
  const subnavGestao = document.getElementById('subnav-gestao');
  const btnModOperacao = document.getElementById('btn-mod-operacao');
  const btnModGestao = document.getElementById('btn-mod-gestao');

  if (mod === 'operacao') {
    if (modOperacao) modOperacao.classList.remove('hidden');
    if (modGestao) modGestao.classList.add('hidden');
    if (subnavOperacao) subnavOperacao.classList.remove('hidden');
    if (subnavGestao) subnavGestao.classList.add('hidden');
    
    if (btnModOperacao) btnModOperacao.className = "module-nav-active px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    if (btnModGestao) btnModGestao.className = "text-brand-300 hover:text-white px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    setSubTab('operacao', 'saida');
  } else {
    if (modOperacao) modOperacao.classList.add('hidden');
    if (modGestao) modGestao.classList.remove('hidden');
    if (subnavOperacao) subnavOperacao.classList.add('hidden');
    if (subnavGestao) subnavGestao.classList.remove('hidden');
    
    if (btnModGestao) btnModGestao.className = "module-nav-active px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    if (btnModOperacao) btnModOperacao.className = "text-brand-300 hover:text-white px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    setSubTab('gestao', 'dashboard');
  }
}

function setSubTab(moduleName, tab) {
  if (moduleName === 'operacao') {
    ['saida', 'retorno', 'minhas-rotas'].forEach(t => {
      const el = document.getElementById(`view-${t}`);
      const btn = document.getElementById(`subtab-${t}`);
      if (el) el.classList.add('hidden');
      if (btn) {
        btn.classList.remove('subtab-active', 'border-brand-600', 'text-brand-600');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
    });
    const activeView = document.getElementById(`view-${tab}`);
    const activeBtn = document.getElementById(`subtab-${tab}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) {
      activeBtn.classList.remove('border-transparent', 'text-slate-500');
      activeBtn.classList.add('subtab-active', 'border-brand-600', 'text-brand-600');
    }
  } else {
    ['dashboard', 'cad-veiculos', 'cad-usuarios'].forEach(t => {
      const el = document.getElementById(`view-${t}`);
      const btn = document.getElementById(`subtab-${t}`);
      if (el) el.classList.add('hidden');
      if (btn) {
        btn.classList.remove('subtab-active', 'border-brand-600', 'text-brand-600');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
    });
    const activeView = document.getElementById(`view-${tab}`);
    const activeBtn = document.getElementById(`subtab-${tab}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) {
      activeBtn.classList.remove('border-transparent', 'text-slate-500');
      activeBtn.classList.add('subtab-active', 'border-brand-600', 'text-brand-600');
    }
  }
}

// =========================================================================
// 4. CARREGAMENTO GERAL DE DADOS (SUPABASE)
// =========================================================================

async function carregarTodosDadosDoBanco() {
  const usuarioSessao = verificarSessaoUsuario();
  if (!usuarioSessao) return;

  try {
    const { data: dadosVeiculos, error: errV } = await db.from('veiculos').select('*');
    if (errV) throw errV;
    veiculos = dadosVeiculos || [];

    const { data: dadosUsuarios, error: errU } = await db.from('usuarios').select('*').order('nome');
    if (errU) throw errU;
    usuarios = dadosUsuarios || [];

    const { data: dadosRotas, error: errR } = await db.from('rotas').select('*').order('created_at', { ascending: false });
    if (errR) throw errR;
    rotas = dadosRotas || [];

    const userIndex = usuarios.findIndex(u => u.email.toLowerCase() === usuarioSessao.email.toLowerCase());
    if (userIndex !== -1) {
      currentUserIndex = userIndex;
    }

    atualizarUsuarioNoCabecalho();
    aplicarPermissoesUsuario();
    renderAll();
  } catch (error) {
    console.error("Erro ao carregar dados do Supabase:", error);
  }
}

// =========================================================================
// 5. OPERAÇÕES DE ROTAS (CHECK-OUT E CHECK-IN)
// =========================================================================

function toggleOutroOrigem(valor) {
  const inputTexto = document.getElementById('form-inicio-origem-texto');
  if (inputTexto) {
    if (valor === 'OUTRO') {
      inputTexto.classList.remove('hidden');
      inputTexto.required = true;
      inputTexto.focus();
    } else {
      inputTexto.classList.add('hidden');
      inputTexto.required = false;
      inputTexto.value = '';
    }
  }
}

function toggleOutroDestino(valor) {
  const inputTexto = document.getElementById('form-fim-destino-texto');
  if (inputTexto) {
    if (valor === 'OUTRO') {
      inputTexto.classList.remove('hidden');
      inputTexto.required = true;
      inputTexto.focus();
    } else {
      inputTexto.classList.add('hidden');
      inputTexto.required = false;
      inputTexto.value = '';
    }
  }
}

async function handleInicioRota(e) {
  e.preventDefault();

  const btn = document.getElementById('btn-submit-inicio');
  const veiculoId = document.getElementById('form-inicio-veiculo')?.value;

  const veiculo = (veiculos || []).find(v =>
    String(v.id) === String(veiculoId) ||
    String(v.uuid_veiculos) === String(veiculoId) ||
    String(v.placa) === String(veiculoId) ||
    String(v.nome_frota) === String(veiculoId)
  );

  const rawSessao = localStorage.getItem('arvo_usuario_logado');
  let user = (usuarios && usuarios[currentUserIndex]) ? usuarios[currentUserIndex] : null;
  if (!user && rawSessao) {
    try { user = JSON.parse(rawSessao); } catch { user = { email: rawSessao }; }
  }

  if (!veiculo) {
    alert("Por favor, selecione um veículo válido.");
    return;
  }

  if (!user?.email) {
    alert("Condutor não identificado. Faça login novamente.");
    return;
  }

  // --- VALIDAÇÃO DE AGENDAMENTO (RESERVAS) ---
  const agoraTimestamp = new Date().getTime();
  const emailAtual = user.email.toLowerCase().trim();
  const nomeCarro = veiculo.nome_frota || veiculo.id;
  const placaCarro = veiculo.placa;

  try {
    const { data: reservasCarro, error: errRes } = await db
      .from('reservas')
      .select('*')
      .eq('status', 'CONFIRMADA');

    if (!errRes && reservasCarro) {
      const reservaAtiva = reservasCarro.find(r => {
        const bateuCarro = String(r.veiculo_id) === String(nomeCarro) ||
                           String(r.veiculo_id) === String(veiculo.id) ||
                           String(r.veiculo_id) === String(placaCarro) ||
                           String(r.placa) === String(placaCarro);

        const ini = new Date(r.data_inicio).getTime();
        const fim = new Date(r.data_fim).getTime();
        return bateuCarro && agoraTimestamp >= ini && agoraTimestamp <= fim;
      });

      if (reservaAtiva) {
        const emailDono = (reservaAtiva.responsavel || '').toLowerCase().trim();
        
        // Bloqueia se o condutor logado não for o dono da reserva
        if (emailDono !== emailAtual) {
          const dataFimFmt = new Date(reservaAtiva.data_fim).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
          });

          alert(
            `⛔ VEÍCULO BLOQUEADO POR RESERVA!\n\n` +
            `O veículo ${nomeCarro} [${placaCarro}] está reservado para:\n` +
            `👤 Condutor: ${reservaAtiva.responsavel}\n` +
            `🎯 Finalidade: ${reservaAtiva.finalidade}\n` +
            `📅 Reservado até: ${dataFimFmt}`
          );
          return;
        }
      }
    }
  } catch (err) {
    console.warn("Aviso na verificação de reserva:", err);
  }

  const selectOrigem = document.getElementById('form-inicio-origem')?.value;
  const textoOrigem = document.getElementById('form-inicio-origem-texto')?.value?.trim().toUpperCase() || '';
  const origemFinal = selectOrigem === 'OUTRO' ? textoOrigem : selectOrigem;

  if (!origemFinal) {
    alert("Por favor, selecione ou digite a origem da saída.");
    return;
  }

  // --- REGRA DE ODÔMETRO (PROPRIO vs EXTERNO) ---
  const isExterno = (veiculo.tipo_frota || '').toUpperCase() === 'EXTERNO';
  const kmInformadoInput = parseFloat(document.getElementById('form-inicio-km')?.value);
  const kmBanco = Number(veiculo.km_atual || 0);

  let kmSaidaFinal = kmBanco;

  if (isExterno) {
    if (!isNaN(kmInformadoInput) && kmInformadoInput > 0) {
      kmSaidaFinal = kmInformadoInput;
    }
  } else {
    // Frota normal: força a manutenção do último KM registrado
    kmSaidaFinal = kmBanco;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;
  }

  const dataHoraSaidaAtual = new Date().toISOString();

  // Objeto sem a chave 'id' para deixar o Supabase gerar automaticamente
  const novaRota = {
    veiculo_id: nomeCarro,
    placa: placaCarro,
    uuid_veiculos: veiculo.uuid_veiculos || null,
    responsavel: user.email,
    origem: origemFinal,
    destino: null,
    finalidade: document.getElementById('form-inicio-finalidade')?.value || 'DEMANDAS INTERNAS',
    data_saida: dataHoraSaidaAtual,
    data_retorno: null,
    km_saida: kmSaidaFinal,
    km_retorno: null,
    km_total: 0,
    consumo_litros: null,
    anomalia: '',
    status: 'Em Uso'
  };

  try {
    const { data: rotaCriada, error: erroRota } = await db
      .from('rotas')
      .insert([novaRota])
      .select()
      .single();

    if (erroRota) throw erroRota;

    // Atualiza o status do veículo (e atualiza o odômetro inicial caso o carro externo tenha entrado com KM superior)
    const payloadUpdateVeiculo = { status: 'Em Uso' };
    if (isExterno && kmSaidaFinal > kmBanco) {
      payloadUpdateVeiculo.km_atual = kmSaidaFinal;
    }

    await db.from('veiculos')
      .update(payloadUpdateVeiculo)
      .eq('placa', placaCarro);

    e.target.reset();
    if (typeof toggleOutroOrigem === 'function') toggleOutroOrigem('');
    alert(`Rota #${rotaCriada.id} iniciada com sucesso!`);
    await carregarTodosDadosDoBanco();
    setSubTab('operacao', 'minhas-rotas');
  } catch (err) {
    console.error("Erro ao iniciar rota:", err);
    alert("Erro ao gravar rota: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check-circle text-lg"></i> Iniciar Rota`;
    }
  }
}


async function handleFimRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-fim');
  const rotaId = document.getElementById('form-fim-rota-select').value;
  const kmFinal = parseFloat(document.getElementById('form-fim-km').value);
  
  const selectDestino = document.getElementById('form-fim-destino').value;
  const textoDestino = document.getElementById('form-fim-destino-texto')?.value.trim().toUpperCase() || '';
  const destinoFinal = selectDestino === 'OUTRO' ? textoDestino : selectDestino;

  if (!destinoFinal) {
    alert("Por favor, digite o local de devolução.");
    return;
  }

  const rota = rotas.find(r => String(r.id) === String(rotaId));
  if (!rota) {
    alert("Erro: Rota não encontrada na lista.");
    return;
  }

  // Localiza o veículo no cache local
  const veiculo = veiculos.find(v => 
    String(v.id) === String(rota?.veiculo_id) || 
    String(v.uuid_veiculos) === String(rota?.veiculo_id) ||
    String(v.nome_frota) === String(rota?.veiculo_id) ||
    String(v.placa) === String(rota?.veiculo_id)
  ) || {};

  if (kmFinal < rota.km_saida) {
    alert("Erro: O KM Final não pode ser inferior ao KM de Saída!");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;
  }

  const situacao = document.querySelector('input[name="situacao_carro"]:checked')?.value || 'SEM';
  let anomaliaTexto = situacao === 'COM' ? document.getElementById('form-fim-anomalia').value.trim() : '';

  const deltaKm = kmFinal - rota.km_saida;
  const medConsumo = (Number(veiculo.consumo_min) + Number(veiculo.consumo_max)) / 2 || 12;
  const litrosEst = Number((deltaKm / medConsumo).toFixed(2));
  const dataHoraRetornoAtual = new Date().toISOString();

  // Helper para testar se uma string é um UUID válido
  const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str));

  try {
    // 1. Atualiza a rota para 'Concluida'
    const { error: erroRota } = await db.from('rotas').update({
      km_retorno: kmFinal,
      km_total: deltaKm,
      consumo_litros: litrosEst,
      destino: destinoFinal,
      status: 'Concluida',
      anomalia: anomaliaTexto,
      data_retorno: dataHoraRetornoAtual
    }).eq('id', rotaId);

    if (erroRota) throw erroRota;

    // 2. Monta as condições seguras para atualizar a tabela 'veiculos'
    const condicoesVeiculo = [];
    if (veiculo.uuid_veiculos && isUUID(veiculo.uuid_veiculos)) {
      condicoesVeiculo.push(`uuid_veiculos.eq.${veiculo.uuid_veiculos}`);
    }
    if (veiculo.id && isUUID(veiculo.id)) {
      condicoesVeiculo.push(`id.eq.${veiculo.id}`);
    }
    if (veiculo.nome_frota) {
      condicoesVeiculo.push(`nome_frota.eq.${veiculo.nome_frota}`);
    }
    if (veiculo.placa) {
      condicoesVeiculo.push(`placa.eq.${veiculo.placa}`);
    }
    // Se rota.veiculo_id for nome textual (ex: "ARVO 11"), busca pela coluna nome_frota
    if (rota.veiculo_id) {
      if (isUUID(rota.veiculo_id)) {
        condicoesVeiculo.push(`id.eq.${rota.veiculo_id}`);
      } else {
        condicoesVeiculo.push(`nome_frota.eq.${rota.veiculo_id}`);
      }
    }

    const payloadVeiculo = {
      km_atual: kmFinal,
      status: 'Disponivel'
    };
    if (anomaliaTexto || veiculo.anomalias) {
      payloadVeiculo.anomalias = anomaliaTexto || veiculo.anomalias;
    }

    if (condicoesVeiculo.length > 0) {
      const { error: erroVeiculo } = await db.from('veiculos')
        .update(payloadVeiculo)
        .or(condicoesVeiculo.join(','));

      if (erroVeiculo) console.warn("Aviso ao atualizar veículo:", erroVeiculo.message);
    }

    // 3. Atualiza reservas pendentes de forma segura
    try {
      const condicoesReserva = [`veiculo_id.eq.${rota.veiculo_id}`];
      if (veiculo.uuid_veiculos && isUUID(veiculo.uuid_veiculos)) {
        condicoesReserva.push(`uuid_veiculos.eq.${veiculo.uuid_veiculos}`);
      }
      await db.from('reservas').update({ status: 'CONCLUIDA' })
        .or(condicoesReserva.join(','))
        .eq('responsavel', rota.responsavel)
        .eq('status', 'CONFIRMADA');
    } catch (resErr) {
      console.warn("Aviso ao concluir reservas:", resErr);
    }

    // 4. Limpeza da interface e recarregamento dos dados
    e.target.reset();
    toggleOutroDestino('');
    document.getElementById('fim-detalhes-viagem')?.classList.add('hidden');
    toggleAnomaliaInput(false);

    alert(`Rota #${rotaId} encerrada com sucesso!`);
    await carregarTodosDadosDoBanco();
    setSubTab('operacao', 'minhas-rotas');
  } catch (err) {
    console.error("Erro ao encerrar rota:", err);
    alert("Erro ao gravar retorno: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-lg"></i> Finalizar Rota`;
    }
  }
}

function formatarDataHora(dataIso) {
  if (!dataIso) return '-';
  const data = new Date(dataIso);
  if (isNaN(data.getTime())) return dataIso;
  
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// =========================================================================
// 6. GESTÃO DE VEÍCULOS (CADASTRO, EDIÇÃO E EXCLUSÃO)
// =========================================================================

async function handleCadVeiculo(e) {
  e.preventDefault();
  
  const placa = document.getElementById('cad-v-placa').value.toUpperCase().trim();
  const idInformado = document.getElementById('cad-v-id')?.value?.toUpperCase().trim();

  const novoCarro = {
    nome_frota: idInformado || placa,
    placa: placa,
    marca: document.getElementById('cad-v-marca').value.trim(),
    tanque: parseFloat(document.getElementById('cad-v-tanque').value) || 0,
    consumo_min: parseFloat(document.getElementById('cad-v-consumomin').value) || 0,
    consumo_max: parseFloat(document.getElementById('cad-v-consumomax').value) || 0,
    km_atual: parseFloat(document.getElementById('cad-v-kminicial').value) || 0,
    tipo_frota: document.getElementById('cad-v-tipofrota')?.value || 'Frota Regular',
    status: 'Disponivel',
    anomalias: ''
  };


  try {
    const { error } = await db.from('veiculos').insert([novoCarro]);
    if (error) throw error;

    e.target.reset();
    alert(`✅ Veículo [${novoCarro.placa}] cadastrado com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    console.error("Erro ao cadastrar veículo:", err);
    alert("Erro ao cadastrar veículo: " + err.message);
  }
}

function abrirModalEditVeiculo(veiculoId) {
  const v = veiculos.find(item => 
    String(item.id) === String(veiculoId) || 
    String(item.uuid_veiculos) === String(veiculoId) || 
    String(item.placa) === String(veiculoId)
  );

  if (!v) return;

  document.getElementById('edit-v-id').value = v.uuid_veiculos || v.id;
  document.getElementById('modal-edit-v-title').innerText = v.placa || v.nome_frota || v.id;
  document.getElementById('edit-v-placa').value = v.placa || '';
  document.getElementById('edit-v-marca').value = v.marca || '';
  document.getElementById('edit-v-tanque').value = v.tanque || 0;
  document.getElementById('edit-v-consumomin').value = v.consumo_min || 0;
  document.getElementById('edit-v-consumomax').value = v.consumo_max || 0;
  document.getElementById('edit-v-kmatual').value = v.km_atual || 0;
  document.getElementById('edit-v-status').value = v.status || 'Disponivel';
  document.getElementById('edit-v-anomalias').value = v.anomalias || '';

  document.getElementById('modal-edit-veiculo').classList.remove('hidden');
}

function fecharModalEditVeiculo() {
  document.getElementById('modal-edit-veiculo').classList.add('hidden');
}

async function handleSalvarEditVeiculo(e) {
  e.preventDefault();
  const idChave = document.getElementById('edit-v-id').value;
  const placaVal = document.getElementById('edit-v-placa').value.toUpperCase().trim();
  const tipoFrotaVal = document.getElementById('edit-v-tipofrota')?.value || 'PROPRIO';

  const dadosAtualizados = {
    placa: placaVal,
    marca: document.getElementById('edit-v-marca').value.trim(),
    tanque: parseFloat(document.getElementById('edit-v-tanque').value),
    consumo_min: parseFloat(document.getElementById('edit-v-consumomin').value),
    consumo_max: parseFloat(document.getElementById('edit-v-consumomax').value),
    km_atual: parseFloat(document.getElementById('edit-v-kmatual').value),
    tipo_frota: document.getElementById('cad-v-tipofrota')?.value || 'Frota Regular',
    status: document.getElementById('edit-v-status').value,
    tipo_frota: tipoFrotaVal, // Captura 'EXTERNO' ou 'PROPRIO',
    anomalias: document.getElementById('edit-v-anomalias').value.trim()
  };

  try {
    const { error } = await db
      .from('veiculos')
      .update(dadosAtualizados)
      .or(`uuid_veiculos.eq.${idChave},id.eq.${idChave},placa.eq.${idChave}`);

    if (error) {
      // Fallback caso o identificador passado seja a placa
      const { error: errPlaca } = await db
        .from('veiculos')
        .update(dadosAtualizados)
        .eq('placa', placaVal);

      if (errPlaca) throw errPlaca;
    }

    fecharModalEditVeiculo();
    alert(`✅ Veículo ${dadosAtualizados.placa} atualizado com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    console.error("Erro ao atualizar veículo:", err);
    alert("Erro ao atualizar veículo: " + (err.message || 'Verifique sua conexão.'));
  }
}

async function handleApagarVeiculo(veiculoId) {
  const veic = veiculos.find(v => 
    String(v.id) === String(veiculoId) || 
    String(v.uuid_veiculos) === String(veiculoId) || 
    String(v.placa) === String(veiculoId)
  );

  const identificadorVisual = veic ? `${veic.nome_frota || veic.id} [${veic.placa || 'Sem Placa'}]` : veiculoId;

  const querDesativar = confirm(
    `Gerenciamento de Veículo:\n\n` +
    `Deseja DESATIVAR o veículo ${identificadorVisual} (marcar como 'Fora de Uso')?\n\n` +
    `• [OK] para DESATIVAR (mantém histórico).\n` +
    `• [Cancelar] para EXCLUIR DEFINITIVAMENTE.`
  );

  try {
    if (querDesativar) {
      const { error } = await db
        .from('veiculos')
        .update({ status: 'Fora de Uso' })
        .or(`uuid_veiculos.eq.${veiculoId},id.eq.${veiculoId},placa.eq.${veiculoId}`);

      if (error) throw error;
      alert(`✅ Veículo ${identificadorVisual} desativado com sucesso!`);
    } else {
      const confirmaExclusao = confirm(`⚠️ Deseja realmente APAGAR permanentemente o veículo ${identificadorVisual}?`);
      if (!confirmaExclusao) return;

      const { error } = await db
        .from('veiculos')
        .delete()
        .or(`uuid_veiculos.eq.${veiculoId},id.eq.${veiculoId},placa.eq.${veiculoId}`);

      if (error) throw error;
      alert(`✅ Veículo ${identificadorVisual} excluído com sucesso!`);
    }

    await carregarTodosDadosDoBanco();
  } catch (err) {
    console.error("Erro na operação de veículo:", err);
    alert("Erro na operação: " + err.message);
  }
}

// =========================================================================
// 7. GESTÃO DE USUÁRIOS
// =========================================================================

function toggleVerSenhaEdicao() {
  const input = document.getElementById('edit-u-senha');
  const icone = document.getElementById('icone-senha-edit');
  if (input.type === 'text') {
    input.type = 'password';
    if (icone) {
      icone.classList.remove('ph-eye');
      icone.classList.add('ph-eye-slash');
    }
  } else {
    input.type = 'text';
    if (icone) {
      icone.classList.remove('ph-eye-slash');
      icone.classList.add('ph-eye');
    }
  }
}

async function handleCadUsuario(e) {
  e.preventDefault();
  const novoUsuario = {
    nome: document.getElementById('cad-u-nome').value.trim(),
    email: document.getElementById('cad-u-email').value.trim().toLowerCase(),
    senha: document.getElementById('cad-u-senha').value.trim(),
    cnh: document.getElementById('cad-u-cnh').value.trim(),
    status: 'Ativo'
  };

  try {
    const { error } = await db.from('usuarios').insert([novoUsuario]);
    if (error) throw error;

    e.target.reset();
    alert(`Usuário ${novoUsuario.nome} cadastrado com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    alert("Erro ao cadastrar usuário: " + err.message);
  }
}

function abrirModalEditUsuario(usuarioId) {
  const u = usuarios.find(item => item.id === usuarioId);
  if (!u) return;

  document.getElementById('edit-u-id').value = u.id;
  document.getElementById('edit-u-nome').value = u.nome;
  document.getElementById('edit-u-email').value = u.email;
  
  const inputSenha = document.getElementById('edit-u-senha');
  if (inputSenha) {
    inputSenha.type = 'text';
    inputSenha.value = u.senha || '';
  }

  document.getElementById('edit-u-cnh').value = u.cnh;
  document.getElementById('edit-u-status').value = u.status || 'Ativo';

  document.getElementById('modal-edit-usuario').classList.remove('hidden');
}

function fecharModalEditUsuario() {
  document.getElementById('modal-edit-usuario').classList.add('hidden');
}

async function handleSalvarEditUsuario(e) {
  e.preventDefault();
  const id = document.getElementById('edit-u-id').value;

  const dadosAtualizados = {
    nome: document.getElementById('edit-u-nome').value.trim(),
    email: document.getElementById('edit-u-email').value.trim().toLowerCase(),
    senha: document.getElementById('edit-u-senha').value.trim(),
    cnh: document.getElementById('edit-u-cnh').value.trim(),
    status: document.getElementById('edit-u-status').value
  };

  try {
    const { error } = await db.from('usuarios').update(dadosAtualizados).eq('id', id);
    if (error) throw error;

    fecharModalEditUsuario();
    alert("Condutor atualizado com sucesso!");
    await carregarTodosDadosDoBanco();
  } catch (err) {
    alert("Erro ao atualizar usuário: " + err.message);
  }
}

async function handleApagarUsuario(usuarioId, nome) {
  const confirmacao = confirm(`Deseja realmente APAGAR o usuário "${nome}"?`);
  if (!confirmacao) return;

  try {
    const { error } = await db.from('usuarios').delete().eq('id', usuarioId);
    if (error) throw error;

    alert(`Usuário ${nome} removido com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    alert("Erro ao excluir usuário: " + err.message);
  }
}

// =========================================================================
// 8. RENDERIZAÇÃO DE TABELAS E COMPONENTES
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
  const elTotal = document.getElementById('kpi-total-veiculos');
  const elEmRota = document.getElementById('kpi-em-rota');
  const elDisp = document.getElementById('kpi-disponiveis');
  const elAnom = document.getElementById('kpi-anomalias');

  if (elTotal) elTotal.innerText = veiculos.length;
  if (elEmRota) elEmRota.innerText = veiculos.filter(v => v.status === 'Em Uso').length;
  if (elDisp) elDisp.innerText = veiculos.filter(v => v.status === 'Disponivel').length;
  if (elAnom) elAnom.innerText = veiculos.filter(v => v.anomalias && v.anomalias.trim() !== '').length;
}

function renderFleetGrid() {
  const container = document.getElementById('fleetGrid');
  if (!container) return;
  container.innerHTML = '';

  veiculos.forEach(v => {
    const isEmUso = v.status === 'Em Uso';
    const isForaUso = v.status === 'Fora de Uso';
    const isManutencao = v.status === 'Em Manutenção';
    const nomeVeiculo = v.nome_frota || v.identificador || v.placa || v.id || 'Veículo';
    const idAcao = v.id || v.uuid_veiculos || v.placa;

    // Definição das cores e rótulo do status
    let statusBg = 'bg-emerald-100 text-emerald-700';
    let statusTexto = '• Disponível';

    if (isEmUso) {
      statusBg = 'bg-amber-100 text-amber-700';
      statusTexto = '• Em Rota';
    } else if (isForaUso) {
      statusBg = 'bg-rose-100 text-rose-700';
      statusTexto = '• Fora de Uso';
    } else if (isManutencao) {
      statusBg = 'bg-purple-100 text-purple-700 border border-purple-200';
      statusTexto = '• Em Manutenção';
    }

    const card = document.createElement('div');
    card.className = `bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition ${isForaUso || isManutencao ? 'opacity-75 bg-slate-50' : ''}`;
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-base font-extrabold text-slate-900">${nomeVeiculo}</span>
          <span class="text-[11px] px-2.5 py-0.5 rounded-full font-bold ${statusBg}">
            ${statusTexto}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs text-slate-500 mb-3">
          <span>${v.marca || '-'}</span>
          <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-700">${v.placa || '-'}</span>
        </div>

        <div class="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-3 space-y-1">
          <div class="flex justify-between items-baseline">
            <span class="text-[10px] uppercase font-bold text-slate-400">Hodômetro</span>
            <span class="text-lg font-bold font-mono text-slate-800">${Number(v.km_atual || 0).toLocaleString('pt-BR')} km</span>
          </div>
          <div class="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
            <span>Tanque: <b>${v.tanque || 0} L</b></span>
            <span>Méd: <b>${(((Number(v.consumo_min || 0) + Number(v.consumo_max || 0)) / 2) || 0).toFixed(1)} km/L</b></span>
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
          `<button onclick="abrirFinalizacaoDireta('${idAcao}')" class="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1">Encerrar Rota &rarr;</button>` : 
          (isForaUso || isManutencao ? 
            `<span class="text-xs font-bold text-slate-400 cursor-not-allowed">Indisponível</span>` : 
            `<button onclick="abrirInicioDireto('${idAcao}')" class="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">Iniciar Rota &rarr;</button>`
          )
        }
      </div>
    `;
    container.appendChild(card);
  });
}

function renderTabelaVeiculosCad() {
  const tbody = document.getElementById('tabelaVeiculosCadastrados');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  veiculos.forEach(v => {
    const nomeCarroArvo = v.nome_frota || v.identificador || v.placa || v.id || '-';
    const isEmUso = v.status === 'Em Uso';
    const isForaUso = v.status === 'Fora de Uso';
    const isManutencao = v.status === 'Em Manutenção';
    const identificador = v.uuid_veiculos || v.id;

    // Diferenciação de tipo de frota (Externo vs Frota Própria)
    const isExterno = (v.tipo_frota || '').toUpperCase() === 'EXTERNO';
    const badgeTipo = isExterno
      ? `<span class="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200" title="Veículo de uso esporádico / terceirizado">EXTERNO</span>`
      : `<span class="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">FROTA</span>`;

    let statusClass = 'bg-emerald-100 text-emerald-800';
    if (isEmUso) {
      statusClass = 'bg-amber-100 text-amber-800';
    } else if (isForaUso) {
      statusClass = 'bg-rose-100 text-rose-800';
    } else if (isManutencao) {
      statusClass = 'bg-purple-100 text-purple-800 border border-purple-200';
    }

    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-50 transition ${isForaUso ? 'opacity-60 bg-slate-50' : ''}`;
    
    tr.innerHTML = `
      <td class="py-3 px-3 font-extrabold text-slate-900">${nomeCarroArvo}</td>
      <td class="py-3 px-3">${v.marca || '-'}</td>
      <td class="py-3 px-3 font-mono font-bold text-slate-700">
        ${v.placa || '-'} ${badgeTipo}
      </td>      
      <td class="py-3 px-3 text-center font-mono">${v.tanque || 0} L</td>
      <td class="py-3 px-3 text-center font-mono">${v.consumo_min || 0} ~ ${v.consumo_max || 0}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-brand-700">${Number(v.km_atual || 0).toLocaleString('pt-BR')} km</td>
      <td class="py-3 px-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}">
          ${v.status || 'Disponivel'}
        </span>
      </td>
      <td class="py-3 px-3 text-center">
        <div class="flex items-center justify-center gap-2">
          <button onclick="abrirModalEditVeiculo('${identificador}')" title="Editar Veículo" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition">
            <i class="ph-bold ph-pencil-simple text-sm"></i>
          </button>
          <button onclick="handleApagarVeiculo('${identificador}')" title="Apagar Veículo" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition">
            <i class="ph-bold ph-trash text-sm"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  const b = document.getElementById('badge-total-carros');
  if (b) b.innerText = `${veiculos.length} carros`;
}


function renderTabelaUsuariosCad() {
  const tbody = document.getElementById('tabelaUsuariosCadastrados');
  if (!tbody) return;
  tbody.innerHTML = '';
  usuarios.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="py-3 px-4 font-bold text-slate-800">${u.nome}</td>
      <td class="py-3 px-4 text-slate-600">${u.email}</td>
      <td class="py-3 px-4 font-mono font-semibold text-brand-700">${u.cnh}</td>
      <td class="py-3 px-4 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${u.status === 'Inativo' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'}">
          ${u.status || 'Ativo'}
        </span>
      </td>
      <td class="py-3 px-4 text-center">
        <div class="flex items-center justify-center gap-2">
          <button onclick="abrirModalEditUsuario('${u.id}')" title="Editar Usuário" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition">
            <i class="ph-bold ph-pencil-simple text-sm"></i>
          </button>
          <button onclick="handleApagarUsuario('${u.id}', '${u.nome}')" title="Apagar Usuário" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition">
            <i class="ph-bold ph-trash text-sm"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  const b = document.getElementById('badge-total-users');
  if (b) b.innerText = `${usuarios.length} condutores`;
}

function renderSelectVeiculosInicio() {
  const select = document.getElementById('form-inicio-veiculo');
  if (!select) return;
  select.innerHTML = '<option value="">Selecione um veículo...</option>';
  veiculos.filter(v => v.status === 'Disponivel').forEach(v => {
    const nomeAmigavel = v.nome_frota || v.identificador || v.id;
    select.innerHTML += `<option value="${v.id}">${v.placa} - ${nomeAmigavel} (${Number(v.km_atual || 0).toLocaleString('pt-BR')} km)</option>`;
  });
}

function atualizarKmInicialPreenchido() {
  const vId = document.getElementById('form-inicio-veiculo')?.value;
  const v = (veiculos || []).find(item =>
    String(item.id) === String(vId) ||
    String(item.uuid_veiculos) === String(vId) ||
    String(item.placa) === String(vId) ||
    String(item.nome_frota) === String(vId)
  );

  const inputKm = document.getElementById('form-inicio-km') || document.getElementById('m-inicio-km');
  if (!inputKm) return;

  if (v) {
    inputKm.value = v.km_atual || 0;
    
    // Regra do Carro Externo vs Frota Própria
    const isExterno = (v.tipo_frota || '').toUpperCase() === 'EXTERNO';
    if (isExterno) {
      inputKm.readOnly = false;
      inputKm.classList.remove('bg-slate-100');
      inputKm.classList.add('bg-white', 'border-indigo-300', 'focus:ring-2', 'focus:ring-indigo-500');
      inputKm.title = "Carro Externo: Confirme ou ajuste o KM atual visualizado no painel.";
    } else {
      inputKm.readOnly = true;
      inputKm.classList.remove('bg-white', 'border-indigo-300', 'focus:ring-2', 'focus:ring-indigo-500');
      inputKm.classList.add('bg-slate-100');
      inputKm.title = "KM sincronizado com o último registro.";
    }
  } else {
    inputKm.value = '';
    inputKm.readOnly = true;
  }
}

function abrirInicioDireto(vId) {
  setModule('operacao');
  setSubTab('operacao', 'saida');
  const select = document.getElementById('form-inicio-veiculo');
  if (select) select.value = vId;
  atualizarKmInicialPreenchido();
}

function renderSelectRotasFim() {
  const select = document.getElementById('form-fim-rota-select');
  if (!select) return;
  select.innerHTML = '<option value="">Selecione uma viagem em trânsito...</option>';
  rotas.filter(r => r.status === 'Em Uso').forEach(r => {
    const veic = veiculos.find(v => 
      String(v.id) === String(r.veiculo_id) || 
      String(v.uuid_veiculos) === String(r.veiculo_id) ||
      String(v.nome_frota) === String(r.veiculo_id)
    );
    const nomeExibicao = r.nome_frota || (veic ? (veic.nome_frota || veic.identificador || veic.id) : r.veiculo_id);
    select.innerHTML += `<option value="${r.id}">${r.id} | ${nomeExibicao} (${r.responsavel})</option>`;
  });
}

function selecionarRotaFim() {
  const rotaId = document.getElementById('form-fim-rota-select')?.value;
  const rota = rotas.find(r => r.id === rotaId);
  const detalhes = document.getElementById('fim-detalhes-viagem');

  if (rota) {
    const v = veiculos.find(item => 
      String(item.id) === String(rota.veiculo_id) || 
      String(item.uuid_veiculos) === String(rota.veiculo_id) ||
      String(item.nome_frota) === String(rota.veiculo_id)
    ) || {};

    const nomeExibicao = rota.nome_frota || v.nome_frota || v.identificador || rota.veiculo_id;
    const consMin = Number(v.consumo_min) || 10;
    const consMax = Number(v.consumo_max) || 14;
    const medConsumo = ((consMin + consMax) / 2).toFixed(1);

    const infoCar = document.getElementById('fim-info-veiculo');
    if (infoCar) infoCar.innerText = `${nomeExibicao} [${v.placa || 'Sem Placa'}]`;

    const infoUser = document.getElementById('fim-info-Usuario') || document.getElementById('fim-info-condutor');
    if (infoUser) infoUser.innerText = rota.responsavel;

    const infoKm = document.getElementById('fim-info-kmsaida');
    if (infoKm) infoKm.innerText = `${Number(rota.km_saida).toLocaleString('pt-BR')} km`;

    const infoConsumo = document.getElementById('fim-info-consumo-est');
    if (infoConsumo) infoConsumo.innerText = `Média de ${medConsumo} km/L`;
    
    if (detalhes) detalhes.classList.remove('hidden');

    const inputKm = document.getElementById('form-fim-km');
    if (inputKm) {
      inputKm.min = rota.km_saida;
      inputKm.value = rota.km_saida;
    }
    calcularKmPercorrido();
  } else {
    if (detalhes) detalhes.classList.add('hidden');
  }
}

function abrirFinalizacaoDireta(vId) {
  const rota = rotas.find(r => 
    (String(r.veiculo_id) === String(vId) || String(r.nome_frota) === String(vId)) && 
    r.status === 'Em Uso'
  );
  if (rota) {
    setModule('operacao');
    setSubTab('operacao', 'retorno');
    const select = document.getElementById('form-fim-rota-select');
    if (select) select.value = rota.id;
    selecionarRotaFim();
  }
}

function calcularKmPercorrido() {
  const rotaId = document.getElementById('form-fim-rota-select')?.value;
  const rota = rotas.find(r => r.id === rotaId);
  const kmFinal = parseFloat(document.getElementById('form-fim-km')?.value);
  const feedback = document.getElementById('km-calc-feedback');

  if (!rota || isNaN(kmFinal) || !feedback) return;

  if (kmFinal < rota.km_saida) {
    feedback.innerText = `Erro: KM Final (${kmFinal}) menor que Saída (${rota.km_saida})!`;
    feedback.className = "text-[11px] text-rose-600 font-bold mt-1 block";
  } else {
    const delta = kmFinal - rota.km_saida;
    const v = veiculos.find(item => 
      String(item.id) === String(rota.veiculo_id) || 
      String(item.uuid_veiculos) === String(rota.veiculo_id) ||
      String(item.nome_frota) === String(rota.veiculo_id)
    ) || {};
    const medConsumo = ((Number(v.consumo_min || 10) + Number(v.consumo_max || 14)) / 2);
    const litrosEst = (delta / medConsumo).toFixed(1);
    feedback.innerText = `Distância: ${delta} km (Consumo est.: ~${litrosEst} Litros)`;
    feedback.className = "text-[11px] text-brand-700 font-bold mt-1 block";
  }
}

function toggleAnomaliaInput(show) {
  const box = document.getElementById('box-anomalia');
  if (box) {
    if (show) box.classList.remove('hidden');
    else box.classList.add('hidden');
  }
}

// =========================================================================
// RENDER HISTÓRICO COM RESOLUÇÃO DE IDENTIFICADOR AMIGÁVEL
// =========================================================================
function renderHistorico() {
  const tbody = document.getElementById('tabelaHistorico');
  if (!tbody) return;
  tbody.innerHTML = '';

  rotas.forEach(r => {
    // Procura o veículo correspondente na lista pelo UUID, id ou placa
    const veic = veiculos.find(v => 
      String(v.id) === String(r.veiculo_id) || 
      String(v.uuid_veiculos) === String(r.veiculo_id) || 
      String(v.placa) === String(r.veiculo_id) || 
      String(v.nome_frota) === String(r.veiculo_id)
    );

    // Se o veiculo_id for um UUID longo, substitui pelo identificador amigável
    let nomeExibicao = r.nome_frota;
    if (!nomeExibicao && veic) {
      nomeExibicao = veic.nome_frota || veic.identificador || veic.id;
    }
    if (!nomeExibicao) {
      nomeExibicao = (r.veiculo_id && r.veiculo_id.length > 20) ? 'ARVO' : (r.veiculo_id || '-');
    }

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="py-3 px-3 font-mono font-bold text-slate-800">${r.id}</td>
      <td class="py-3 px-3 font-extrabold text-slate-900 text-sm">
        ${nomeExibicao}
      </td>
      <td class="py-3 px-3 text-slate-600">${r.responsavel}</td>
      <td class="py-3 px-3 font-medium">${r.origem} &rarr; ${r.destino || 'Em Trânsito'}</td>
      <td class="py-3 px-3 font-semibold text-slate-800">
        <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200">${r.finalidade || '-'}</span>
      </td>
      <td class="py-3 px-3 font-mono text-[11px] text-slate-600">${formatarDataHora(r.data_saida)}</td>
      <td class="py-3 px-3 font-mono text-[11px] text-slate-600">${r.data_retorno ? formatarDataHora(r.data_retorno) : '<span class="text-amber-600 font-bold">Em trânsito</span>'}</td>
      <td class="py-3 px-3 text-center font-mono font-bold">${r.km_total ? `${r.km_total} km` : '-'}</td>
      <td class="py-3 px-3 text-center font-mono text-slate-600 text-[11px]">${r.consumo_litros ? `${r.consumo_litros} L` : '-'}</td>
      <td class="py-3 px-3 max-w-xs">${r.anomalia ? `<span class="text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded text-[11px] font-medium">${r.anomalia}</span>` : '<span class="text-slate-400">-</span>'}</td>
      <td class="py-3 px-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'Concluida' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'}">
          ${r.status}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarHistorico() {
  const q = document.getElementById('filtro-rotas')?.value.toLowerCase() || '';
  document.querySelectorAll('#tabelaHistorico tr').forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
  });
}

// =========================================================================
// 9. SISTEMA DE ALERTAS & NOTIFICAÇÕES (ROTAS > 12 HORAS)
// =========================================================================

async function solicitarPermissaoNotificacoes() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function dispararNotificacaoNativa(titulo, corpo) {
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(titulo, {
        body: corpo,
        icon: "/imagens/logo3d192.png",
        badge: "/imagens/logo3d192.png"
      });
    } catch (e) {
      console.warn("Falha ao emitir notificação nativa:", e);
    }
  }
}

function exibirPopUpAlerta(rota, horasAbertas) {
  const modalId = `modal-alerta-${rota.id}`;
  if (document.getElementById(modalId)) return;

  const veic = veiculos.find(v => String(v.id) === String(rota.veiculo_id) || String(v.uuid_veiculos) === String(rota.veiculo_id));
  const nomeCarro = rota.nome_frota || (veic ? (veic.nome_frota || veic.id) : rota.veiculo_id);
  const placaCarro = (veic && veic.placa) ? ` [${veic.placa}]` : '';

  const popUp = document.createElement('div');
  popUp.id = modalId;
  popUp.className = "fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in";
  popUp.innerHTML = `
    <div class="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 text-center space-y-4">
      <div class="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
        <i class="ph-bold ph-warning-circle"></i>
      </div>
      <div>
        <h3 class="text-base font-black text-slate-900">Atenção: Rota Pendente!</h3>
        <p class="text-xs text-slate-500 mt-1">
          A rota <b class="text-slate-800">#${rota.id}</b> com o veículo <b class="text-slate-800">${nomeCarro}${placaCarro}</b> está aberta há mais de <span class="text-rose-600 font-bold">${Math.floor(horasAbertas)} horas</span>.
        </p>
      </div>
      <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium text-left">
        Por favor, finalize o check-in e registre o KM final para evitar inconsistências no fechamento.
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="document.getElementById('${modalId}').remove()" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">
          Lembrar Depois
        </button>
        <button onclick="document.getElementById('${modalId}').remove(); abrirFinalizacaoDireta('${rota.veiculo_id}');" class="flex-1 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs shadow-md transition">
          Finalizar Agora
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(popUp);
}

async function verificarRotasExcedidas12h() {
  try {
    const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
    if (!rawSessao) return;

    let sessao;
    try {
      sessao = JSON.parse(rawSessao);
    } catch {
      sessao = { email: rawSessao };
    }

    const emailUsuario = (sessao?.email || '').toLowerCase().trim();
    if (!emailUsuario) return;

    const { data: rotasAtivas, error } = await db
      .from('rotas')
      .select('*')
      .eq('status', 'Em Uso');

    if (error || !rotasAtivas) return;

    const agora = new Date().getTime();

    rotasAtivas.forEach(rota => {
      const dataRef = rota.data_saida || rota.created_at;
      if (!dataRef) return;

      const dataSaida = new Date(dataRef).getTime();
      if (isNaN(dataSaida)) return;

      const diferencaHoras = (agora - dataSaida) / (1000 * 60 * 60);

      if (diferencaHoras >= 12) {
        const responsavelRota = (rota.responsavel || '').toLowerCase().trim();
        const isAdmin = emailUsuario === ADMIN_EMAIL.toLowerCase();

        if (responsavelRota === emailUsuario || isAdmin) {
          exibirPopUpAlerta(rota, diferencaHoras);
          dispararNotificacaoNativa(
            "⚠️ ARVO - Rota Excedida",
            `A rota #${rota.id} (${rota.veiculo_id}) está aberta há ${Math.floor(diferencaHoras)}h. Realize o encerramento.`
          );
        }
      }
    });
  } catch (err) {
    console.error("Falha ao verificar rotas excedidas:", err);
  }
}

// =========================================================================
// 10. EXPOSIÇÃO GLOBAL (WINDOW) PARA O HTML
// =========================================================================
window.setModule = setModule;
window.setSubTab = setSubTab;
window.fazerLogout = fazerLogout;
window.toggleOutroOrigem = toggleOutroOrigem;
window.toggleOutroDestino = toggleOutroDestino;
window.handleInicioRota = handleInicioRota;
window.handleFimRota = handleFimRota;
window.handleCadVeiculo = handleCadVeiculo;
window.abrirModalEditVeiculo = abrirModalEditVeiculo;
window.fecharModalEditVeiculo = fecharModalEditVeiculo;
window.handleSalvarEditVeiculo = handleSalvarEditVeiculo;
window.handleApagarVeiculo = handleApagarVeiculo;
window.toggleVerSenhaEdicao = toggleVerSenhaEdicao;
window.handleCadUsuario = handleCadUsuario;
window.abrirModalEditUsuario = abrirModalEditUsuario;
window.fecharModalEditUsuario = fecharModalEditUsuario;
window.handleSalvarEditUsuario = handleSalvarEditUsuario;
window.handleApagarUsuario = handleApagarUsuario;
window.atualizarKmInicialPreenchido = atualizarKmInicialPreenchido;
window.selecionarRotaFim = selecionarRotaFim;
window.calcularKmPercorrido = calcularKmPercorrido;
window.toggleAnomaliaInput = toggleAnomaliaInput;
window.filtrarHistorico = filtrarHistorico;
window.abrirInicioDireto = abrirInicioDireto;
window.abrirFinalizacaoDireta = abrirFinalizacaoDireta;

// =========================================================================
// INICIALIZAÇÃO
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  await carregarTodosDadosDoBanco();
  solicitarPermissaoNotificacoes();
  verificarRotasExcedidas12h();
  setInterval(verificarRotasExcedidas12h, 5 * 60 * 1000);
});