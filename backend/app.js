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
    window.location.href = "login.html";
    return null;
  }
  try {
    return JSON.parse(sessao);
  } catch(e) {
    return { email: sessao };
  }
}

function fazerLogout() {
  const confirmacao = confirm("Tem certeza que deseja encerrar a sessão?");
  if (confirmacao) {
    localStorage.removeItem('arvo_usuario_logado');
    localStorage.removeItem('arvo_mobile_user');
    window.location.href = "login.html";
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
  const btnModOperacao = document.getElementById('btn-mod-operacao');
  const btnModGestao = document.getElementById('btn-mod-gestao');

  if (mod === 'operacao') {
    if (modOperacao) modOperacao.classList.remove('hidden');
    if (modGestao) modGestao.classList.add('hidden');
    
    if (btnModOperacao) {
      btnModOperacao.classList.remove('module-nav-inactive');
      btnModOperacao.classList.add('module-nav-active');
    }
    if (btnModGestao) {
      btnModGestao.classList.remove('module-nav-active');
      btnModGestao.classList.add('module-nav-inactive');
    }
    setSubTab('operacao', 'saida');
  } else {
    if (modOperacao) modOperacao.classList.add('hidden');
    if (modGestao) modGestao.classList.remove('hidden');
    
    if (btnModGestao) {
      btnModGestao.classList.remove('module-nav-inactive');
      btnModGestao.classList.add('module-nav-active');
    }
    if (btnModOperacao) {
      btnModOperacao.classList.remove('module-nav-active');
      btnModOperacao.classList.add('module-nav-inactive');
    }
    setSubTab('gestao', 'dashboard');
  }
}

function setSubTab(moduleName, tab) {
  if (moduleName === 'operacao') {
    const abasOperacao = ['saida', 'retorno', 'minhas-rotas'];
    
    abasOperacao.forEach(t => {
      const view = document.getElementById(`view-${t}`);
      const btn = document.getElementById(`subtab-${t}`);
      if (view) view.classList.add('hidden');
      if (btn) {
        btn.classList.remove('subtab-active');
      }
    });

    const activeView = document.getElementById(`view-${tab}`);
    const activeBtn = document.getElementById(`subtab-${tab}`);

    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.classList.add('subtab-active');

    if (tab === 'minhas-rotas') {
      renderHistorico();
    } else if (tab === 'retorno') {
      renderSelectRotasFim();
    } else if (tab === 'saida') {
      renderSelectVeiculosInicio();
    }

  } else {
    const abasGestao = ['dashboard', 'cad-veiculos', 'cad-usuarios'];
    
    abasGestao.forEach(t => {
      const view = document.getElementById(`view-${t}`);
      const btn = document.getElementById(`subtab-${t}`);
      if (view) view.classList.add('hidden');
      if (btn) {
        btn.classList.remove('subtab-active');
      }
    });

    const activeView = document.getElementById(`view-${tab}`);
    const activeBtn = document.getElementById(`subtab-${tab}`);

    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.classList.add('subtab-active');

    if (tab === 'dashboard') {
      renderDashboardKPIs();
      renderFleetGrid();
    } else if (tab === 'cad-veiculos') {
      renderTabelaVeiculosCad();
    } else if (tab === 'cad-usuarios') {
      renderTabelaUsuariosCad();
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
    const { data: dadosVeiculos, error: errV } = await db.from('veiculos').select('*').order('nome_frota');
    if (errV) throw errV;
    veiculos = dadosVeiculos || [];

    const { data: dadosUsuarios, error: errU } = await db.from('usuarios').select('*').order('nome');
    if (errU) throw errU;
    usuarios = dadosUsuarios || [];

    const { data: dadosRotas, error: errR } = await db.from('rotas').select('*').order('created_at', { ascending: false });
    if (errR) throw errR;
    rotas = dadosRotas || [];

    const userIndex = usuarios.findIndex(u => (u.email || '').toLowerCase() === (usuarioSessao.email || '').toLowerCase());
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
        if (emailDono !== emailAtual && emailAtual !== ADMIN_EMAIL.toLowerCase()) {
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

  const isExterno = (veiculo.tipo_frota || '').toUpperCase() === 'EXTERNO';
  const kmInformadoInput = parseFloat(document.getElementById('form-inicio-km')?.value);
  const kmBanco = Number(veiculo.km_atual || 0);

  let kmSaidaFinal = (isExterno && !isNaN(kmInformadoInput) && kmInformadoInput > 0) ? kmInformadoInput : kmBanco;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;
  }

  const dataHoraSaidaAtual = new Date().toISOString();

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

    const payloadUpdateVeiculo = { status: 'Em Uso' };
    if (isExterno && kmSaidaFinal > kmBanco) {
      payloadUpdateVeiculo.km_atual = kmSaidaFinal;
    }

    await db.from('veiculos').update(payloadUpdateVeiculo).eq('placa', placaCarro);

    e.target.reset();
    toggleOutroOrigem('');
    alert(`Rota iniciada com sucesso!`);
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

function obterMediaConsumoEsperada(veiculo, tipoCombustivel, listaAbastecimentos = []) {
  const placa = veiculo?.placa;
  const vId = veiculo?.id;
  const uuid = veiculo?.uuid_veiculos;
  const nomeFrota = veiculo?.nome_frota;

  const abastsCarro = (listaAbastecimentos || [])
    .filter(a => {
      const bateuVeiculo = (placa && String(a.placa) === String(placa)) ||
                           (vId && String(a.veiculo_id) === String(vId)) ||
                           (uuid && String(a.uuid_veiculos) === String(uuid)) ||
                           (nomeFrota && String(a.veiculo_id) === String(nomeFrota));
      return bateuVeiculo && Number(a.km_atual) > 0 && Number(a.quantidade_litros) > 0;
    })
    .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));

  const combAtual = tipoCombustivel || abastsCarro[0]?.tipo_combustivel || 'Gasolina Comum';

  const abastsTipo = abastsCarro.filter(a => 
    (a.tipo_combustivel || '').toUpperCase() === combAtual.toUpperCase()
  );

  if (abastsTipo.length >= 2) {
    const deltaKm = Number(abastsTipo[0].km_atual) - Number(abastsTipo[1].km_atual);
    const litros = Number(abastsTipo[0].quantidade_litros);

    if (deltaKm > 0 && litros > 0) {
      const mediaCalculada = deltaKm / litros;
      if (mediaCalculada >= 3 && mediaCalculada <= 35) {
        return Number(mediaCalculada.toFixed(2));
      }
    }
  }

  const cMin = Number(veiculo?.consumo_min || 10);
  const cMax = Number(veiculo?.consumo_max || 14);
  let mediaFabricante = (cMin + cMax) / 2;

  if (combAtual.toUpperCase().includes('ETANOL') || combAtual.toUpperCase().includes('ÁLCOOL')) {
    mediaFabricante = mediaFabricante * 0.7;
  }

  return Number(mediaFabricante.toFixed(2));
}

async function handleFimRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-fim');
  const rotaId = document.getElementById('form-fim-rota-select')?.value;
  const kmFinal = parseFloat(document.getElementById('form-fim-km')?.value);
  
  const selectDestino = document.getElementById('form-fim-destino')?.value;
  const textoDestino = document.getElementById('form-fim-destino-texto')?.value?.trim().toUpperCase() || '';
  const destinoFinal = selectDestino === 'OUTRO' ? textoDestino : selectDestino;

  if (!destinoFinal) {
    alert("Por favor, digite o local de devolução.");
    return;
  }

  const rota = (rotas || []).find(r => String(r.id) === String(rotaId));
  if (!rota) {
    alert("Erro: Rota não encontrada na lista.");
    return;
  }

  const veiculo = (veiculos || []).find(v => 
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
  const anomaliaTexto = situacao === 'COM' ? (document.getElementById('form-fim-anomalia')?.value?.trim() || '') : '';
  const deltaKm = kmFinal - rota.km_saida;

  const medConsumo = obterMediaConsumoEsperada(veiculo, null, []);
  const litrosEst = Number((deltaKm / medConsumo).toFixed(2));
  
  const capTanque = Number(veiculo.tanque || 45);
  const tanqueAnterior = (veiculo.tanque_virtual !== null && veiculo.tanque_virtual !== undefined)
    ? Number(veiculo.tanque_virtual)
    : capTanque;
  
  const novoTanqueVirtual = Number(Math.max(0, tanqueAnterior - litrosEst).toFixed(2));
  const dataHoraRetornoAtual = new Date().toISOString();

  try {
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

    const payloadVeiculo = {
      km_atual: kmFinal,
      status: 'Disponivel',
      tanque_virtual: novoTanqueVirtual
    };
    if (anomaliaTexto || veiculo.anomalias) {
      payloadVeiculo.anomalias = anomaliaTexto || veiculo.anomalias;
    }

    if (veiculo.placa) {
      await db.from('veiculos').update(payloadVeiculo).eq('placa', veiculo.placa);
    }

    try {
      await db.from('reservas').update({ status: 'CONCLUIDA' })
        .eq('veiculo_id', rota.veiculo_id)
        .eq('responsavel', rota.responsavel)
        .eq('status', 'CONFIRMADA');
    } catch (resErr) {
      console.warn("Aviso reservas:", resErr);
    }

    e.target.reset();
    toggleOutroDestino('');
    document.getElementById('fim-detalhes-viagem')?.classList.add('hidden');
    toggleAnomaliaInput(false);

    alert(`Rota encerrada com sucesso!`);
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
  const tipoFrota = document.getElementById('cad-v-tipofrota')?.value || 'PROPRIO';
  const motoristaAutorizado = tipoFrota === 'EXTERNO' ? document.getElementById('cad-v-motorista')?.value?.trim().toLowerCase() 
    : null;
  
    if (tipoFrota === 'EXTERNO' && !motoristaAutorizado) {
    alert("Por favor, selecione o motorista autorizado para este carro temporário/externo.");
    return;
  }

  const novoCarro = {
    nome_frota: idInformado || placa,
    placa: placa,
    marca: document.getElementById('cad-v-marca').value.trim(),
    tanque: parseFloat(document.getElementById('cad-v-tanque').value) || 0,
    consumo_min: parseFloat(document.getElementById('cad-v-consumomin').value) || 0,
    consumo_max: parseFloat(document.getElementById('cad-v-consumomax').value) || 0,
    km_atual: parseFloat(document.getElementById('cad-v-kminicial').value) || 0,
    tipo_frota: tipoFrota,
    motorista_autorizado: motoristaAutorizado || null,
    status: 'Disponivel',
    anomalias: ''
  };

  try {
    const { error } = await db.from('veiculos').insert([novoCarro]);
    if (error) throw error;

    e.target.reset();
    toggleMotoristaExterno('cad');
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
  
  const selectTipo = document.getElementById('edit-v-tipofrota');
  if (selectTipo) {
    selectTipo.value = (v.tipo_frota || 'PROPRIO').toUpperCase();
    toggleMotoristaExterno('edit');
    if (v.tipo_frota === 'EXTERNO') {
      popularSelectMotoristas('edit-v-motorista', v.motorista_autorizado || '');
    }
  }

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
  const motoristaVal = tipoFrotaVal === 'EXTERNO' ? document.getElementById('edit-v-motorista')?.value?.trim().toLowerCase() : null;

  if (tipoFrotaVal === 'EXTERNO' && !motoristaVal) {
    alert("Selecione o motorista autorizado para o carro externo.");
    return;
  }

  const dadosAtualizados = {
    placa: placaVal,
    marca: document.getElementById('edit-v-marca').value.trim(),
    tanque: parseFloat(document.getElementById('edit-v-tanque').value) || 0,
    consumo_min: parseFloat(document.getElementById('edit-v-consumomin').value) || 0,
    consumo_max: parseFloat(document.getElementById('edit-v-consumomax').value) || 0,
    km_atual: parseFloat(document.getElementById('edit-v-kmatual').value) || 0,
    status: document.getElementById('edit-v-status').value,
    tipo_frota: tipoFrotaVal,
    motorista_autorizado: motoristaVal || null,
    anomalias: document.getElementById('edit-v-anomalias').value.trim()
  };

  try {
    let { error } = await db.from('veiculos').update(dadosAtualizados).eq('id', idChave);
    if (error) {
      const { error: errUuid } = await db.from('veiculos').update(dadosAtualizados).eq('uuid_veiculos', idChave);
      if (errUuid) throw errUuid;
    }

  try {
    const { error } = await db
      .from('veiculos')
      .update(dadosAtualizados)
      .eq('placa', placaVal);

    if (error) throw error;

    fecharModalEditVeiculo();
    alert(`✅ Veículo ${dadosAtualizados.placa} atualizado com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    console.error("Erro ao atualizar veículo:", err);
    alert("Erro ao atualizar veículo: " + err.message);
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
      await db.from('veiculos').update({ status: 'Fora de Uso' }).eq('placa', veic.placa);
      alert(`✅ Veículo ${identificadorVisual} desativado com sucesso!`);
    } else {
      if (!confirm(`⚠️ Deseja realmente APAGAR permanentemente o veículo ${identificadorVisual}?`)) return;
      await db.from('veiculos').delete().eq('placa', veic.placa);
      alert(`✅ Veículo ${identificadorVisual} excluído com sucesso!`);
    }

    await carregarTodosDadosDoBanco();
  } catch (err) {
    console.error("Erro na operação de veículo:", err);
    alert("Erro na operação: " + err.message);
  }
}

function toggleMotoristaExterno(prefixo) {
  const tipo = document.getElementById(`${prefixo}-v-tipofrota`)?.value;
  const box = document.getElementById(`box-${prefixo}-motorista-externo`);
  if (!box) return;
  
  if (tipo === 'EXTERNO') {
    box.classList.remove('hidden');
    popularSelectMotoristas(`${prefixo}-v-motorista`);
  } else {
    box.classList.add('hidden');
    const select = document.getElementById(`${prefixo}-v-motorista`);
    if (select) select.value = '';
  }
}

function popularSelectMotoristas(selectId, valorSelecionado = '') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione o condutor autorizado...</option>';
  
  (usuarios || []).forEach(u => {
    const opt = document.createElement('option');
    opt.value = (u.email || '').toLowerCase();
    opt.textContent = `${u.nome || u.email} (${u.email})`;
    if (valorSelecionado && opt.value === valorSelecionado.toLowerCase()) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  });
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
    alert(`Usuário cadastrado com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    alert("Erro ao cadastrar usuário: " + err.message);
  }
}

function abrirModalEditUsuario(usuarioId) {
  const u = usuarios.find(item => String(item.id) === String(usuarioId));
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
  if (!confirm(`Deseja realmente APAGAR o usuário "${nome}"?`)) return;

  try {
    const { error } = await db.from('usuarios').delete().eq('id', usuarioId);
    if (error) throw error;

    alert(`Usuário removido com sucesso!`);
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
    const nomeVeiculo = v.nome_frota || v.placa || v.id || 'Veículo';
    const idAcao = v.placa || v.id;

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
    const nomeCarroArvo = v.nome_frota || v.placa || '-';
    const isEmUso = v.status === 'Em Uso';
    const isForaUso = v.status === 'Fora de Uso';
    const identificador = v.placa || v.id;

    let statusClass = 'bg-emerald-100 text-emerald-800';
    if (isEmUso) statusClass = 'bg-amber-100 text-amber-800';
    else if (isForaUso) statusClass = 'bg-rose-100 text-rose-800';

    const tr = document.createElement('tr');
    tr.className = `hover:bg-slate-50 transition ${isForaUso ? 'opacity-60 bg-slate-50' : ''}`;
    
    tr.innerHTML = `
      <td class="py-3 px-3 font-extrabold text-slate-900">${nomeCarroArvo}</td>
      <td class="py-3 px-3">${v.marca || '-'}</td>
      <td class="py-3 px-3 font-mono font-bold text-slate-700">${v.placa || '-'}</td>      
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

  (veiculos || []).filter(v => v.status === 'Disponivel').forEach(v => {
    const nomeAmigavel = v.nome_frota || v.placa || v.id;
    select.innerHTML += `<option value="${v.placa}">${v.placa} - ${nomeAmigavel} (${Number(v.km_atual || 0).toLocaleString('pt-BR')} km)</option>`;
  });
}

function atualizarKmInicialPreenchido() {
  const vId = document.getElementById('form-inicio-veiculo')?.value;
  const v = (veiculos || []).find(item =>
    String(item.placa) === String(vId) ||
    String(item.id) === String(vId) ||
    String(item.nome_frota) === String(vId)
  );

  const inputKm = document.getElementById('form-inicio-km');
  if (!inputKm) return;

  if (v) {
    inputKm.value = Number(v.km_atual || 0);
    const isExterno = (v.tipo_frota || '').toUpperCase() === 'EXTERNO';
    inputKm.readOnly = !isExterno;
    if (isExterno) {
      inputKm.classList.remove('form-control-readonly');
    } else {
      inputKm.classList.add('form-control-readonly');
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
    select.innerHTML += `<option value="${r.id}">#${r.id} | ${r.veiculo_id} (${r.responsavel})</option>`;
  });
}

function selecionarRotaFim() {
  const rotaId = document.getElementById('form-fim-rota-select')?.value;
  const rota = rotas.find(r => String(r.id) === String(rotaId));
  const detalhes = document.getElementById('fim-detalhes-viagem');

  if (rota) {
    const v = veiculos.find(item => String(item.placa) === String(rota.placa) || String(item.nome_frota) === String(rota.veiculo_id)) || {};

    const infoCar = document.getElementById('fim-info-veiculo');
    if (infoCar) infoCar.innerText = `${rota.veiculo_id} [${rota.placa || v.placa || '-'}]`;

    const infoUser = document.getElementById('fim-info-Usuario') || document.getElementById('fim-info-condutor');
    if (infoUser) infoUser.innerText = rota.responsavel;

    const infoKm = document.getElementById('fim-info-kmsaida');
    if (infoKm) infoKm.innerText = `${Number(rota.km_saida).toLocaleString('pt-BR')} km`;

    const infoConsumo = document.getElementById('fim-info-consumo-est');
    if (infoConsumo) infoConsumo.innerText = `Estimado`;
    
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
    (String(r.veiculo_id) === String(vId) || String(r.placa) === String(vId)) && 
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
  const rota = rotas.find(r => String(r.id) === String(rotaId));
  const kmFinal = parseFloat(document.getElementById('form-fim-km')?.value);
  const feedback = document.getElementById('km-calc-feedback');

  if (!rota || isNaN(kmFinal) || !feedback) return;

  if (kmFinal < rota.km_saida) {
    feedback.innerText = `Erro: KM Final (${kmFinal}) menor que Saída (${rota.km_saida})!`;
    feedback.className = "text-[11px] text-rose-600 font-bold mt-1 block";
  } else {
    const delta = kmFinal - rota.km_saida;
    feedback.innerText = `Distância: ${delta} km rodados`;
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

function renderHistorico() {
  const tbody = document.getElementById('tabelaHistorico');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (rotas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-slate-400 font-medium">Nenhuma rota registrada.</td></tr>`;
    return;
  }

  rotas.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="py-3 px-3 font-mono font-bold text-slate-800">${r.id}</td>
      <td class="py-3 px-3 font-extrabold text-slate-900 text-sm">${r.veiculo_id || '-'}</td>
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
// 9. EXPOSIÇÃO GLOBAL (WINDOW)
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

// Inicialização automática
document.addEventListener('DOMContentLoaded', async () => {
  await carregarTodosDadosDoBanco();
});