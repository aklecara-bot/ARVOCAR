// =========================================================================
// 1. CONFIGURAÇÃO DO SUPABASE E ESTADOS GLOBAIS
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAIL = "admin@arvo.tec.br";

// Validação de CNH por formato (11 dígitos e sem repetições banais)
const validarNumeroCNH = (cnh) => /^\d{11}$/.test(String(cnh || '').replace(/\D/g, '')) && !/^(\d)\1{10}$/.test(String(cnh || '').replace(/\D/g, ''));

let usuarios = [];
let veiculos = [];
let rotas = [];
let listaModelosReferencia = [];
let currentUserIndex = 0;

// =========================================================================
// 2. CONTROLE DE SESSÃO, PERMISSÕES E LOGOUT
// =========================================================================

function verificarSessaoUsuario() {
  const sessaoRaw = localStorage.getItem('arvo_usuario_logado');
  if (!sessaoRaw) {
    window.location.href = "login.html";
    return null;
  }

  let sessao;
  try {
    sessao = JSON.parse(sessaoRaw);
  } catch (e) {
    sessao = { email: sessaoRaw };
  }

  const ehAdmin = (sessao.email || '').toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

  // Bloqueio contínuo: revoga o acesso caso o condutor não possua CNH válida
  if (!ehAdmin && !validarNumeroCNH(sessao.cnh)) {
    alert("⛔ Acesso revogado: Seu cadastro possui uma CNH inválida ou pendente. Procure o Administrador.");
    localStorage.removeItem('arvo_usuario_logado');
    localStorage.removeItem('arvo_mobile_user');
    window.location.href = "login.html";
    return null;
  }

  return sessao;
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
  if (cnh) cnh.innerText = `CNH: ${u.cnh || 'Pendente'}`;
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
    const abasOperacao = ['saida', 'retorno', 'minhas-rotas'];

    abasOperacao.forEach(t => {
      const view = document.getElementById(`view-${t}`) || document.getElementById(`tab-${t}`);
      const btn = document.getElementById(`subtab-${t}`) || document.getElementById(`nav-btn-${t}`);

      if (view) {
        view.classList.add('hidden');
        view.style.display = 'none';
      }
      if (btn) {
        btn.classList.remove('subtab-active', 'border-brand-600', 'text-brand-600');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
    });

    const activeView = document.getElementById(`view-${tab}`) || document.getElementById(`tab-${tab}`);
    const activeBtn = document.getElementById(`subtab-${tab}`) || document.getElementById(`nav-btn-${tab}`);

    if (activeView) {
      activeView.classList.remove('hidden');
      activeView.style.display = 'block';
    }
    if (activeBtn) {
      activeBtn.classList.remove('border-transparent', 'text-slate-500');
      activeBtn.classList.add('subtab-active', 'border-brand-600', 'text-brand-600');
    }

    if (tab === 'minhas-rotas') {
      if (typeof renderHistorico === 'function') renderHistorico();
    } else if (tab === 'retorno') {
      if (typeof renderSelectRotasFim === 'function') renderSelectRotasFim();
    } else if (tab === 'saida') {
      if (typeof renderSelectVeiculosInicio === 'function') renderSelectVeiculosInicio();
    }

  } else {
    const abasGestao = ['dashboard', 'cad-veiculos', 'cad-usuarios'];

    abasGestao.forEach(t => {
      const view = document.getElementById(`view-${t}`);
      const btn = document.getElementById(`subtab-${t}`);
      if (view) {
        view.classList.add('hidden');
        view.style.display = 'none';
      }
      if (btn) {
        btn.classList.remove('subtab-active', 'border-brand-600', 'text-brand-600');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
    });

    const activeView = document.getElementById(`view-${tab}`);
    const activeBtn = document.getElementById(`subtab-${tab}`);

    if (activeView) {
      activeView.classList.remove('hidden');
      activeView.style.display = 'block';
    }
    if (activeBtn) {
      activeBtn.classList.remove('border-transparent', 'text-slate-500');
      activeBtn.classList.add('subtab-active', 'border-brand-600', 'text-brand-600');
    }

    if (tab === 'dashboard') {
      renderDashboardKPIs();
      renderFleetGrid();
    } else if (tab === 'cad-veiculos') {
      renderTabelaVeiculosCad();
      popularSelectsModelosReferencia();
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
    // 1. Carrega o catálogo de modelos de referência para cruzamento e preenchimento
    await carregarModelosReferencia();

    const { data: dadosVeiculos, error: errV } = await db.from('veiculos').select('*');
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

function obterMediaConsumoEsperada(veiculo, tipoCombustivel, listaAbastecimentos = []) {
  const placa = (veiculo?.placa || '').trim().toUpperCase();
  const vId = veiculo?.id ? String(veiculo.id).trim() : null;
  const uuid = veiculo?.uuid_veiculos ? String(veiculo.uuid_veiculos).trim() : null;
  const nomeFrota = (veiculo?.nome_frota || '').trim().toUpperCase();

  // 1. Filtra histórico de abastecimento do veículo
  const abastsCarro = (listaAbastecimentos || [])
    .filter(a => {
      const aPlaca = (a.placa || '').trim().toUpperCase();
      const aVeicId = (a.veiculo_id ? String(a.veiculo_id) : '').trim().toUpperCase();
      const aUuid = a.uuid_veiculos ? String(a.uuid_veiculos).trim() : '';

      const bateuVeiculo = (placa && (aPlaca === placa || aVeicId === placa)) ||
                           (vId && aVeicId === vId.toUpperCase()) ||
                           (uuid && aUuid === uuid) ||
                           (nomeFrota && (aVeicId === nomeFrota || aPlaca === nomeFrota));

      return bateuVeiculo && Number(a.km_atual) > 0 && Number(a.quantidade_litros) > 0;
    })
    .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));

  // 2. Normalização flexível de combustível
  const combAtual = (tipoCombustivel || abastsCarro[0]?.tipo_combustivel || 'Gasolina Comum').trim().toUpperCase();
  const ehEtanol = combAtual.includes('ETANOL') || combAtual.includes('ÁLCOOL');

  const ehMesmoCombustivel = (combReg, combRef) => {
    if (!combReg) return combRef.includes('GASOLINA');
    const c = String(combReg).toUpperCase();
    if (combRef.includes('ETANOL') || combRef.includes('ÁLCOOL')) return c.includes('ETANOL') || c.includes('ÁLCOOL');
    if (combRef.includes('DIESEL')) return c.includes('DIESEL');
    if (combRef.includes('GNV')) return c.includes('GNV');
    return c.includes('GASOLINA');
  };

  const abastsTipo = abastsCarro.filter(a => ehMesmoCombustivel(a.tipo_combustivel, combAtual));

  // 3. Média calculada real por dois abastecimentos consecutivos
  if (abastsTipo.length >= 2) {
    const kmRecente = Number(abastsTipo[0].km_atual);
    const kmAnterior = Number(abastsTipo[1].km_atual);
    const litros = Number(abastsTipo[0].quantidade_litros);
    const deltaKm = kmRecente - kmAnterior;

    if (deltaKm > 0 && litros > 0) {
      const mediaCalculada = deltaKm / litros;
      if (mediaCalculada >= 3 && mediaCalculada <= 35) {
        return Number(mediaCalculada.toFixed(2));
      }
    }
  }

  // 4. Média pelos dados técnicos gravados no cadastro do próprio veículo
  let gasUrb = Number(veiculo?.consumo_gasolina_urbano || 0);
  let gasRod = Number(veiculo?.consumo_gasolina_rodoviario || 0);
  let etaUrb = Number(veiculo?.consumo_etanol_urbano || 0);
  let etaRod = Number(veiculo?.consumo_etanol_rodoviario || 0);

  // Se não estiverem no veículo, busca do catálogo de referência homologado
  if ((!gasUrb || !gasRod) && veiculo?.modelo_referencia_id && Array.isArray(listaModelosReferencia)) {
    const modeloHomologado = listaModelosReferencia.find(m => String(m.id) === String(veiculo.modelo_referencia_id));
    if (modeloHomologado) {
      gasUrb = Number(modeloHomologado.consumo_gasolina_urbano || 0);
      gasRod = Number(modeloHomologado.consumo_gasolina_rodoviario || 0);
      etaUrb = Number(modeloHomologado.consumo_etanol_urbano || 0);
      etaRod = Number(modeloHomologado.consumo_etanol_rodoviario || 0);
    }
  }

  // Se possuir dados detalhados (urbano e rodoviário), calcula a média mista
  if (ehEtanol && etaUrb > 0 && etaRod > 0) {
    const mediaEtanol = (etaUrb + etaRod) / 2;
    if (mediaEtanol >= 3 && mediaEtanol <= 35) return Number(mediaEtanol.toFixed(2));
  } else if (gasUrb > 0 && gasRod > 0) {
    const mediaGasolina = (gasUrb + gasRod) / 2;
    if (mediaGasolina >= 3 && mediaGasolina <= 35) return Number(mediaGasolina.toFixed(2));
  }

  // 5. Fallback dos limites cadastrados (consumo_min / consumo_max)
  let cMin = Number(veiculo?.consumo_min);
  let cMax = Number(veiculo?.consumo_max);

  cMin = (!cMin || cMin <= 0 || isNaN(cMin)) ? 10 : cMin;
  cMax = (!cMax || cMax <= 0 || isNaN(cMax)) ? 14 : cMax;

  let mediaFabricante = (cMin + cMax) / 2;
  if (ehEtanol) mediaFabricante = mediaFabricante * 0.7;

  return Number(Math.max(3, mediaFabricante).toFixed(2));
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

  // 1. Busca a rota correspondente (deve vir ANTES do cálculo de deltaKm)
  const rota = (rotas || []).find(r => String(r.id) === String(rotaId));
  if (!rota) {
    alert("Erro: Rota não encontrada na lista.");
    return;
  }

  // 2. Permissão estrita: criador da rota ou Admin
  const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  let sessao;
  try { sessao = JSON.parse(rawSessao); } catch { sessao = { email: rawSessao }; }
  const emailLogado = (sessao?.email || '').toLowerCase().trim();
  const responsavelRota = (rota.responsavel || '').toLowerCase().trim();
  const isAdmin = emailLogado === ADMIN_EMAIL.toLowerCase();

  if (emailLogado !== responsavelRota && !isAdmin) {
    alert(`⛔ Permissão Negada: Apenas o condutor responsável (${rota.responsavel}) ou o Administrador podem encerrar esta rota.`);
    return;
  }

  // 3. Localização do veículo correspondente
  const veiculo = (veiculos || []).find(v =>
    (rota.placa && String(v.placa) === String(rota.placa)) ||
    String(v.id) === String(rota?.veiculo_id) ||
    String(v.uuid_veiculos) === String(rota?.veiculo_id) ||
    String(v.nome_frota) === String(rota?.veiculo_id) ||
    String(v.placa) === String(rota?.veiculo_id)
  ) || {};

  const placaAlvo = rota.placa || veiculo.placa || null;

  if (isNaN(kmFinal) || kmFinal < Number(rota.km_saida)) {
    alert("Erro: O KM Final não pode ser inferior ao KM de Saída!");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;
  }

  const situacao = document.querySelector('input[name="situacao_carro"]:checked')?.value || 'SEM';
  let anomaliaTexto = situacao === 'COM' ? (document.getElementById('form-fim-anomalia')?.value?.trim() || '') : '';
  
  // Agora sim deltaKm pode ser calculado com segurança
  const deltaKm = kmFinal - Number(rota.km_saida);

  // 4. Recupera histórico de abastecimento de forma segura
  let histAbast = [];
  if (typeof abastecimentos !== 'undefined' && Array.isArray(abastecimentos) && abastecimentos.length > 0) {
    histAbast = abastecimentos;
  } else if (typeof listaAbastecimentosCache !== 'undefined' && Array.isArray(listaAbastecimentosCache) && listaAbastecimentosCache.length > 0) {
    histAbast = listaAbastecimentosCache;
  } else {
    const localCache = localStorage.getItem('arvo_cache_abastecimentos');
    if (localCache) {
      try { histAbast = JSON.parse(localCache); } catch (e) { histAbast = []; }
    }
  }

  if ((!histAbast || histAbast.length === 0) && navigator.onLine) {
    try {
      const idCarro = veiculo.id || rota.veiculo_id;
      const placaCarro = placaAlvo;
      const nomeFrota = veiculo.nome_frota;

      const condicoesBusca = [];
      if (idCarro) condicoesBusca.push(`veiculo_id.eq.${idCarro}`);
      if (placaCarro) condicoesBusca.push(`placa.eq.${placaCarro}`);
      if (nomeFrota) condicoesBusca.push(`veiculo_id.eq.${nomeFrota}`);

      if (condicoesBusca.length > 0) {
        const { data: dbAbasts } = await db
          .from('abastecimentos')
          .select('*')
          .or(condicoesBusca.join(','))
          .order('data_hora', { ascending: false })
          .limit(10);

        if (dbAbasts && dbAbasts.length > 0) {
          histAbast = dbAbasts;
        }
      }
    } catch (errDb) {
      console.warn("Aviso ao resgatar abastecimentos sob demanda:", errDb);
    }
  }

  // 5. Apuração do consumo e débito virtual
  let medConsumo;
  if (typeof obterMediaConsumoEsperada === 'function') {
    medConsumo = obterMediaConsumoEsperada(veiculo, null, histAbast);
  } else {
    medConsumo = (Number(veiculo.consumo_min) + Number(veiculo.consumo_max)) / 2 || 12;
  }

  // Proteção contra divisão por zero / NaN
  medConsumo = (!medConsumo || isNaN(medConsumo) || medConsumo <= 0) ? 12 : medConsumo;
  const litrosEst = deltaKm > 0 ? Number((deltaKm / medConsumo).toFixed(2)) : 0;
  
  const capTanque = Number(veiculo.tanque || 47);
  const tanqueAnterior = (veiculo.tanque_virtual !== null && veiculo.tanque_virtual !== undefined)
    ? Number(veiculo.tanque_virtual)
    : capTanque;

  const novoTanqueVirtual = Number(Math.max(0, tanqueAnterior - litrosEst).toFixed(2));
  const dataHoraRetornoAtual = new Date().toISOString();
  const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str));

  try {
    // 6. Atualiza a rota com os dados calculados
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

    // 7. Atualiza o veículo
    const condicoesVeiculo = [];
    if (placaAlvo) condicoesVeiculo.push(`placa.eq.${placaAlvo}`);
    if (veiculo.uuid_veiculos && isUUID(veiculo.uuid_veiculos)) condicoesVeiculo.push(`uuid_veiculos.eq.${veiculo.uuid_veiculos}`);
    if (veiculo.id && isUUID(veiculo.id)) condicoesVeiculo.push(`id.eq.${veiculo.id}`);
    if (veiculo.nome_frota) condicoesVeiculo.push(`nome_frota.eq.${veiculo.nome_frota}`);
    if (rota.veiculo_id) {
      if (isUUID(rota.veiculo_id)) condicoesVeiculo.push(`id.eq.${rota.veiculo_id}`);
      else condicoesVeiculo.push(`nome_frota.eq.${rota.veiculo_id}`);
    }

    const payloadVeiculo = {
      km_atual: kmFinal,
      status: 'Disponivel',
      tanque_virtual: novoTanqueVirtual
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

    // 8. Atualiza reservas pendentes
    try {
      const condicoesReserva = [`veiculo_id.eq.${rota.veiculo_id}`];
      if (placaAlvo) condicoesReserva.push(`veiculo_id.eq.${placaAlvo}`);
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

    // 9. Reset do formulário e interface
    e.target.reset();
    if (typeof toggleOutroDestino === 'function') toggleOutroDestino('');
    document.getElementById('fim-detalhes-viagem')?.classList.add('hidden');
    if (typeof toggleAnomaliaInput === 'function') toggleAnomaliaInput(false);

    alert(`Rota #${rotaId} encerrada com sucesso!\nConsumo estimado: ~${litrosEst} L (Média: ${medConsumo} km/L)\nTanque virtual: ~${novoTanqueVirtual} L restantes`);
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
// 6. GESTÃO DE VEÍCULOS & CATÁLOGO DE MODELOS DE REFERÊNCIA
// =========================================================================

async function carregarModelosReferencia() {
  console.log("🔍 Iniciando busca em modelos_referencia...");
  try {
    const { data, error } = await db
      .from('modelos_referencia')
      .select('*')
      .order('marca', { ascending: true })
      .order('modelo', { ascending: true });

    if (error) {
      console.error("❌ Erro retornado pelo Supabase em modelos_referencia:", error);
      throw error;
    }

    console.log(`✅ Modelos carregados com sucesso (${data?.length || 0} registros):`, data);
    listaModelosReferencia = data || [];
    popularSelectsModelosReferencia();
  } catch (err) {
    console.error("❌ Falha na requisição de modelos_referencia:", err);
  }
}

function popularSelectsModelosReferencia() {
  const preencherSelect = (selectId) => {
    const el = document.getElementById(selectId);
    if (!el) return;
    const valorAtual = el.value;
    el.innerHTML = '<option value="">-- Selecione o Modelo Base --</option>';
    listaModelosReferencia.forEach(m => {
      el.innerHTML += `<option value="${m.id}">${m.marca} ${m.modelo} (${m.ano_modelo || '2024'})</option>`;
    });
    if (valorAtual) el.value = valorAtual;
  };

  preencherSelect('cad-v-referencia');
  preencherSelect('edit-v-referencia');
}

function aoSelecionarModeloReferencia(origem = 'cad') {
  const refId = document.getElementById(`${origem}-v-referencia`)?.value;
  const mod = listaModelosReferencia.find(m => String(m.id) === String(refId));
  if (!mod) return;

  const setInput = (campoId, val) => {
    const el = document.getElementById(`${origem}-v-${campoId}`);
    if (el) el.value = val;
  };

  setInput('marca', `${mod.marca} ${mod.modelo}`);
  setInput('tanque', mod.tanque_litros || 45);
  setInput('consumomin', mod.consumo_etanol_urbano || mod.consumo_gasolina_urbano || 10);
  setInput('consumomax', mod.consumo_gasolina_rodoviario || 14);
}

async function handleCadVeiculo(e) {
  e.preventDefault();

  const placa = document.getElementById('cad-v-placa')?.value.toUpperCase().trim();
  const idInformado = document.getElementById('cad-v-id')?.value?.toUpperCase().trim();

  const refId = document.getElementById('cad-v-referencia')?.value || null;
  const modeloSelecionado = listaModelosReferencia.find(m => String(m.id) === String(refId));
  const tipoFrota = document.getElementById('cad-v-tipofrota')?.value || 'PROPRIO';

  const marcaTexto = modeloSelecionado 
    ? `${modeloSelecionado.marca} ${modeloSelecionado.modelo}`.trim() 
    : (document.getElementById('cad-v-marca')?.value?.trim() || 'Não Identificado');

  const motoristaAutorizado = tipoFrota === 'EXTERNO'
    ? document.getElementById('cad-v-motorista')?.value?.trim().toLowerCase()
    : null;

  if (tipoFrota === 'EXTERNO' && !motoristaAutorizado) {
    alert("⚠️ Selecione o motorista exclusivo para este veículo externo.");
    return;
  }

  const gasUrb = parseFloat(document.getElementById('cad-v-gas-urb')?.value) || 0;
  const gasRod = parseFloat(document.getElementById('cad-v-gas-rod')?.value) || 0;
  const etaUrb = parseFloat(document.getElementById('cad-v-eta-urb')?.value) || 0;
  const etaRod = parseFloat(document.getElementById('cad-v-eta-rod')?.value) || 0;

  const novoCarro = {
    nome_frota: idInformado || placa,
    placa: placa,
    marca: marcaTexto,
    modelo_referencia_id: refId ? Number(refId) : null,
    ano_modelo: parseInt(document.getElementById('cad-v-ano')?.value) || null,
    tanque: parseFloat(document.getElementById('cad-v-tanque')?.value) || 0,
    km_atual: parseFloat(document.getElementById('cad-v-kminicial')?.value) || 0,
    consumo_gasolina_urbano: gasUrb,
    consumo_gasolina_rodoviario: gasRod,
    consumo_etanol_urbano: etaUrb,
    consumo_etanol_rodoviario: etaRod,
    consumo_min: etaUrb || gasUrb || 10,
    consumo_max: gasRod || 14,    
    tipo_frota: dtipoFrota,
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

function popularSelectMotoristas(selectId, valorSelecionado = '') {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione o condutor autorizado...</option>';

  (usuarios || []).forEach(u => {
    const opt = document.createElement('option');
    opt.value = (u.email || '').toLowerCase().trim();
    opt.textContent = `${u.nome || u.email} (${u.email})`;
    if (valorSelecionado && opt.value === valorSelecionado.toLowerCase().trim()) {
      opt.selected = true;
    }
    sel.appendChild(opt);
  });
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
    const sel = document.getElementById(`${prefixo}-v-motorista`);
    if (sel) sel.value = '';
  }
}

function abrirModalEditVeiculo(veiculoId) {
  // 1. Localização flexível do veículo
  const v = (veiculos || []).find(item =>
    String(item.id) === String(veiculoId) ||
    String(item.uuid_veiculos) === String(veiculoId) ||
    String(item.placa) === String(veiculoId)
  );

  if (!v) {
    console.error("Veículo não localizado para edição:", veiculoId);
    return;
  }

  // Funções seguras de atribuição
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = (val !== undefined && val !== null) ? val : '';
  };

  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt || '';
  };

  // 2. Preenchimento seguro dos identificadores e dados básicos
  setVal('edit-v-id', v.uuid_veiculos || v.id);
  setText('modal-edit-v-title', v.placa || v.nome_frota || v.id);
  setVal('edit-v-placa', v.placa);
  setVal('edit-v-marca', v.marca);
  setVal('edit-v-ano', v.ano_modelo || '');
  setVal('edit-v-tanque', v.tanque || 0);
  setVal('edit-v-kmatual', v.km_atual || 0);
  setVal('edit-v-status', v.status || 'Disponivel');
  setVal('edit-v-anomalias', v.anomalias || '');

  // 3. Preenchimento de modelos homologados e consumos técnicos
  setVal('edit-v-referencia', v.modelo_referencia_id || '');
  setVal('edit-v-consumomin', v.consumo_min || 0);
  setVal('edit-v-consumomax', v.consumo_max || 0);
  setVal('edit-v-gas-urb', v.consumo_gasolina_urbano || '');
  setVal('edit-v-gas-rod', v.consumo_gasolina_rodoviario || '');
  setVal('edit-v-eta-urb', v.consumo_etanol_urbano || '');
  setVal('edit-v-eta-rod', v.consumo_etanol_rodoviario || '');

  // 4. Tratamento do tipo de frota e condutor externo
  const selectTipo = document.getElementById('edit-v-tipofrota');
  if (selectTipo) {
    const tipo = (v.tipo_frota || 'PROPRIO').toUpperCase();
    selectTipo.value = tipo;
    if (typeof toggleMotoristaExterno === 'function') {
      toggleMotoristaExterno('edit');
    }
    if (tipo === 'EXTERNO' && typeof popularSelectMotoristas === 'function') {
      popularSelectMotoristas('edit-v-motorista', v.motorista_autorizado || '');
    }
  }

  // 5. Abertura da janela modal
  const modal = document.getElementById('modal-edit-veiculo');
  if (modal) {
    modal.classList.remove('hidden');
  } else {
    console.error("Elemento 'modal-edit-veiculo' não encontrado no DOM.");
  }
}

function fecharModalEditVeiculo() {
  const modal = document.getElementById('modal-edit-veiculo');
  if (modal) modal.classList.add('hidden');
}

// Garante disponibilidade global no escopo da janela



function fecharModalEditVeiculo() {
  const modal = document.getElementById('modal-edit-veiculo');
  if (modal) modal.classList.add('hidden');
}

async function handleSalvarEditVeiculo(e) {
  e.preventDefault();
  const idChave = document.getElementById('edit-v-id')?.value;
  const placaVal = document.getElementById('edit-v-placa')?.value.toUpperCase().trim();
  const refId = document.getElementById('edit-v-referencia')?.value || null;
  const tipoFrotaVal = document.getElementById('edit-v-tipofrota')?.value || 'PROPRIO';

  // 1. Validação de condutor exclusivo se o carro for de frota externa
  const motoristaVal = tipoFrotaVal === 'EXTERNO'
    ? document.getElementById('edit-v-motorista')?.value?.trim().toLowerCase()
    : null;

  if (tipoFrotaVal === 'EXTERNO' && !motoristaVal) {
    alert("⚠️ Selecione o motorista autorizado para o veículo externo.");
    return;
  }

  // 2. Localização do modelo base no catálogo para montar a descrição da marca/modelo
  const modeloSelecionado = (typeof listaModelosReferencia !== 'undefined' && Array.isArray(listaModelosReferencia))
    ? listaModelosReferencia.find(m => String(m.id) === String(refId))
    : null;

  const marcaTexto = modeloSelecionado 
    ? `${modeloSelecionado.marca} ${modeloSelecionado.modelo}`.trim() 
    : (document.getElementById('edit-v-marca')?.value?.trim() || undefined);

  // 3. Captura dos consumos técnicos detalhados (com fallback para os inputs legados de min/max)
  const inputGasUrb = document.getElementById('edit-v-gas-urb');
  const inputGasRod = document.getElementById('edit-v-gas-rod');
  const inputEtaUrb = document.getElementById('edit-v-eta-urb');
  const inputEtaRod = document.getElementById('edit-v-eta-rod');

  const gasUrb = inputGasUrb ? parseFloat(inputGasUrb.value) || 0 : 0;
  const gasRod = inputGasRod ? parseFloat(inputGasRod.value) || 0 : 0;
  const etaUrb = inputEtaUrb ? parseFloat(inputEtaUrb.value) || 0 : 0;
  const etaRod = inputEtaRod ? parseFloat(inputEtaRod.value) || 0 : 0;

  const consumoMinLegado = parseFloat(document.getElementById('edit-v-consumomin')?.value) || 0;
  const consumoMaxLegado = parseFloat(document.getElementById('edit-v-consumomax')?.value) || 0;

  const dadosAtualizados = {
    placa: placaVal,
    marca: marcaTexto,
    modelo_referencia_id: refId ? Number(refId) : null,
    ano_modelo: parseInt(document.getElementById('edit-v-ano')?.value) || null,
    tanque: parseFloat(document.getElementById('edit-v-tanque')?.value) || 0,
    km_atual: parseFloat(document.getElementById('edit-v-kmatual')?.value) || 0,
    status: document.getElementById('edit-v-status')?.value || 'Disponivel',
    tipo_frota: tipoFrotaVal,
    motorista_autorizado: motoristaVal || null,
    anomalias: document.getElementById('edit-v-anomalias')?.value.trim() || '',
    // Novos campos da tabela modelos_referencia
    consumo_gasolina_urbano: gasUrb || (modeloSelecionado?.consumo_gasolina_urbano ?? null),
    consumo_gasolina_rodoviario: gasRod || (modeloSelecionado?.consumo_gasolina_rodoviario ?? null),
    consumo_etanol_urbano: etaUrb || (modeloSelecionado?.consumo_etanol_urbano ?? null),
    consumo_etanol_rodoviario: etaRod || (modeloSelecionado?.consumo_etanol_rodoviario ?? null),
    // Retrocompatibilidade garantida para telas antigas
    consumo_min: consumoMinLegado || etaUrb || gasUrb || 10,
    consumo_max: consumoMaxLegado || gasRod || 14
  };

  try {
    const { error } = await db
      .from('veiculos')
      .update(dadosAtualizados)
      .or(`uuid_veiculos.eq.${idChave},id.eq.${idChave},placa.eq.${idChave}`);

    if (error) {
      const { error: errPlaca } = await db
        .from('veiculos')
        .update(dadosAtualizados)
        .eq('placa', placaVal);

      if (errPlaca) throw errPlaca;
    }

    fecharModalEditVeiculo();
    alert(`✅ Veículo [${dadosAtualizados.placa}] atualizado com sucesso!`);
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
  if (!input) return;
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

  const cnhInput = (document.getElementById('cad-u-cnh')?.value || '').trim();
  const cnhValida = typeof validarNumeroCNH === 'function' ? validarNumeroCNH(cnhInput) : false;

  const statusInicial = cnhValida ? 'Ativo' : 'Inativo';
  const cnhFinal = cnhValida ? cnhInput.replace(/\D/g, '') : (cnhInput || '');

  const novoUsuario = {
    nome: document.getElementById('cad-u-nome').value.trim(),
    email: document.getElementById('cad-u-email').value.trim().toLowerCase(),
    senha: document.getElementById('cad-u-senha').value.trim(),
    cnh: cnhFinal,
    status: statusInicial
  };

  try {
    const { error } = await db.from('usuarios').insert([novoUsuario]);
    if (error) throw error;

    e.target.reset();

    if (statusInicial === 'Ativo') {
      alert(`✅ Usuário ${novoUsuario.nome} cadastrado e ATIVO com sucesso!`);
    } else {
      alert(`⚠️ Usuário ${novoUsuario.nome} cadastrado como INATIVO (CNH pendente ou incompleta). Ficará ativo assim que uma CNH válida for salva.`);
    }

    await carregarTodosDadosDoBanco();
  } catch (err) {
    alert("Erro ao cadastrar usuário: " + err.message);
  }
}

function abrirModalEditUsuario(usuarioId) {
  const u = usuarios.find(item => String(item.id) === String(usuarioId));
  if (!u) {
    console.error("Usuário não encontrado para edição:", usuarioId);
    return;
  }

  const elId = document.getElementById('edit-u-id');
  const elNome = document.getElementById('edit-u-nome');
  const elEmail = document.getElementById('edit-u-email');
  const elSenha = document.getElementById('edit-u-senha');
  const elCnh = document.getElementById('edit-u-cnh');
  const elStatus = document.getElementById('edit-u-status');

  if (elId) elId.value = u.id;
  if (elNome) elNome.value = u.nome || '';
  if (elEmail) elEmail.value = u.email || '';

  if (elSenha) {
    elSenha.type = 'text';
    elSenha.value = u.senha || '';
  }

  if (elCnh) elCnh.value = u.cnh || '';

  if (elStatus) {
    elStatus.value = validarNumeroCNH(u.cnh) ? 'Ativo' : (u.status || 'Inativo');
  }

  const modal = document.getElementById('modal-edit-usuario');
  if (modal) modal.classList.remove('hidden');
}

function fecharModalEditUsuario() {
  const modal = document.getElementById('modal-edit-usuario');
  if (modal) modal.classList.add('hidden');
}

async function handleSalvarEditUsuario(e) {
  e.preventDefault();
  const id = document.getElementById('edit-u-id')?.value;
  const cnhInput = (document.getElementById('edit-u-cnh')?.value || '').trim();

  if (!id) {
    alert("Erro: ID do condutor não identificado.");
    return;
  }

  if (!validarNumeroCNH(cnhInput)) {
    alert("⚠️ CNH inválida! Digite exatamente 11 dígitos numéricos válidos.");
    document.getElementById('edit-u-cnh')?.focus();
    return;
  }

  const dadosAtualizados = {
    nome: document.getElementById('edit-u-nome').value.trim(),
    email: document.getElementById('edit-u-email').value.trim().toLowerCase(),
    senha: document.getElementById('edit-u-senha').value.trim(),
    cnh: cnhInput.replace(/\D/g, ''),
    status: 'Ativo'
  };

  try {
    const { error } = await db
      .from('usuarios')
      .update(dadosAtualizados)
      .eq('id', id);

    if (error) throw error;

    fecharModalEditUsuario();
    alert("Condutor atualizado e ativado com sucesso!");
    await carregarTodosDadosDoBanco();
  } catch (err) {
    console.error("Erro ao atualizar usuário:", err);
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

    const isExterno = (v.tipo_frota || '').toUpperCase() === 'EXTERNO';
    const badgeTipo = isExterno
      ? `<span class="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200">EXTERNO</span>`
      : `<span class="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">FROTA</span>`;

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
          <div class="flex items-center">
            <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-700">${v.placa || '-'}</span>
            ${badgeTipo}
          </div>
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

    const ehAdmin = (u.email || '').toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
    const cnhValida = ehAdmin || validarNumeroCNH(u.cnh);

    let badgeStatus;
    if (!cnhValida) {
      badgeStatus = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700" title="CNH não possui 11 dígitos numéricos válidos">CNH Inválida</span>`;
    } else if (u.status === 'Inativo') {
      badgeStatus = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Inativo</span>`;
    } else {
      badgeStatus = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Ativo</span>`;
    }

    tr.innerHTML = `
      <td class="py-3 px-4 font-bold text-slate-800">${u.nome}</td>
      <td class="py-3 px-4 text-slate-600">${u.email}</td>
      <td class="py-3 px-4 font-mono font-semibold text-brand-700">${u.cnh || '-'}</td>
      <td class="py-3 px-4 text-center">
        ${badgeStatus}
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
    const nomeAmigavel = v.nome_frota || v.identificador || v.id;

    const ultimasRotas = (typeof rotas !== 'undefined' && Array.isArray(rotas) ? rotas : [])
      .filter(r => {
        const bateuCarro = (v.placa && String(r.placa) === String(v.placa)) ||
          String(r.veiculo_id) === String(v.id) ||
          String(r.veiculo_id) === String(v.nome_frota) ||
          String(r.uuid_veiculos) === String(v.uuid_veiculos);
        return bateuCarro && r.status === 'Concluida' && r.km_retorno;
      })
      .sort((a, b) => new Date(b.data_retorno || b.data_saida) - new Date(a.data_retorno || a.data_saida));

    const kmExibicao = (ultimasRotas.length > 0 && Number(ultimasRotas[0].km_retorno) > 0)
      ? Number(ultimasRotas[0].km_retorno)
      : Number(v.km_atual || 0);

    select.innerHTML += `<option value="${v.id}">${v.placa} - ${nomeAmigavel} (${kmExibicao.toLocaleString('pt-BR')} km)</option>`;
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
    const ultimasRotasCarro = (typeof rotas !== 'undefined' && Array.isArray(rotas) ? rotas : [])
      .filter(r => {
        const bateuCarro = (v.placa && String(r.placa) === String(v.placa)) ||
          String(r.veiculo_id) === String(v.id) ||
          String(r.veiculo_id) === String(v.nome_frota) ||
          String(r.uuid_veiculos) === String(v.uuid_veiculos);
        return bateuCarro && r.status === 'Concluida' && r.km_retorno;
      })
      .sort((a, b) => new Date(b.data_retorno || b.data_saida) - new Date(a.data_retorno || a.data_saida));

    const ultimaRota = ultimasRotasCarro[0];

    let kmSincronizado = 0;
    if (ultimaRota && Number(ultimaRota.km_retorno) > 0) {
      kmSincronizado = Number(ultimaRota.km_retorno);
    } else {
      kmSincronizado = Number(v.km_atual || 0);
    }

    inputKm.value = kmSincronizado;

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
  const rota = rotas.find(r => String(r.id) === String(rotaId));
  const detalhes = document.getElementById('fim-detalhes-viagem');

  if (rota) {
    const v = veiculos.find(item =>
      String(item.id) === String(rota.veiculo_id) ||
      String(item.uuid_veiculos) === String(rota.veiculo_id) ||
      String(item.nome_frota) === String(rota.veiculo_id)
    ) || {};

    const nomeExibicao = rota.nome_frota || v.nome_frota || v.identificador || rota.veiculo_id;
    const medConsumo = obterMediaConsumoEsperada(v, null, []);

    const infoCar = document.getElementById('fim-info-veiculo');
    if (infoCar) infoCar.innerText = `${nomeExibicao} [${v.placa || 'Sem Placa'}]`;

    const infoUser = document.getElementById('fim-info-Usuario') || document.getElementById('fim-info-condutor');
    if (infoUser) infoUser.innerText = rota.responsavel;

    const infoKm = document.getElementById('fim-info-kmsaida');
    if (infoKm) infoKm.innerText = `${Number(rota.km_saida).toLocaleString('pt-BR')} km`;

    const infoConsumo = document.getElementById('fim-info-consumo-est');
    if (infoConsumo) infoConsumo.innerText = `Média esperada: ${medConsumo} km/L`;

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

function abrirFinalizacaoDireto(vId) {
  const rota = rotas.find(r =>
    (String(r.veiculo_id) === String(vId) || String(r.nome_frota) === String(vId) || String(r.id) === String(vId)) &&
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
    const v = veiculos.find(item =>
      String(item.id) === String(rota.veiculo_id) ||
      String(item.uuid_veiculos) === String(rota.veiculo_id) ||
      String(item.nome_frota) === String(rota.veiculo_id)
    ) || {};
    const medConsumo = obterMediaConsumoEsperada(v, null, []);
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
// RENDER HISTÓRICO
// =========================================================================

function renderHistorico() {
  const tbody = document.getElementById('tabelaHistorico');
  if (!tbody) return;
  tbody.innerHTML = '';

  rotas.forEach(r => {
    const veic = veiculos.find(v =>
      String(v.id) === String(r.veiculo_id) ||
      String(v.uuid_veiculos) === String(r.veiculo_id) ||
      String(v.placa) === String(r.veiculo_id) ||
      String(v.nome_frota) === String(r.veiculo_id)
    );

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

  const veic = (typeof veiculos !== 'undefined' ? veiculos : []).find(v =>
    String(v.id) === String(rota.veiculo_id) ||
    String(v.uuid_veiculos) === String(rota.veiculo_id) ||
    String(v.nome_frota) === String(rota.veiculo_id) ||
    String(v.placa) === String(rota.veiculo_id)
  );

  const nomeCarro = rota.nome_frota || (veic ? (veic.nome_frota || veic.id) : rota.veiculo_id);
  const placaCarro = (veic && veic.placa) ? ` [${veic.placa}]` : (rota.placa ? ` [${rota.placa}]` : '');

  const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  let sessao;
  try { sessao = JSON.parse(rawSessao); } catch { sessao = { email: rawSessao }; }
  const emailUsuario = (sessao?.email || '').toLowerCase().trim();
  const responsavelRota = (rota.responsavel || '').toLowerCase().trim();
  const isAdmin = emailUsuario === ADMIN_EMAIL.toLowerCase();
  const podeFinalizar = isAdmin || (emailUsuario === responsavelRota);

  const popUp = document.createElement('div');
  popUp.id = modalId;
  popUp.className = "modal-alerta-backdrop";
  popUp.innerHTML = `
    <div class="modal-alerta-card">
      <div class="modal-alerta-icon-box">
        <i class="ph-bold ph-warning-circle"></i>
      </div>
      <div>
        <h3 class="text-base font-black text-slate-900">Atenção: Rota Pendente!</h3>
        <p class="text-xs text-slate-500 mt-1">
          A rota <b class="text-slate-800">#${rota.id}</b> com o veículo <b class="text-slate-800">${nomeCarro}${placaCarro}</b> (Condutor: <b>${rota.responsavel}</b>) está aberta há mais de <span class="text-rose-600 font-bold">${Math.floor(horasAbertas)} horas</span>.
        </p>
      </div>
      <div class="modal-alerta-box-aviso">
        ${podeFinalizar
      ? "Por favor, finalize o check-in e registre o KM final para evitar inconsistências no fechamento."
      : "Esta rota está aberta em trânsito há mais de 12 horas. Apenas o condutor responsável ou o administrador podem efetuar o encerramento."}
      </div>
      <div class="modal-alerta-actions">
        <button onclick="document.getElementById('${modalId}').remove()" class="btn-alerta-lembrar">
          ${podeFinalizar ? "Lembrar Depois" : "Fechar Alerta"}
        </button>
        ${podeFinalizar ? `
          <button onclick="document.getElementById('${modalId}').remove(); abrirFinalizacaoDireto('${rota.veiculo_id}');" class="btn-alerta-finalizar">
            Finalizar Agora
          </button>
        ` : ''}
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
        exibirPopUpAlerta(rota, diferencaHoras);
        dispararNotificacaoNativa(
          "⚠️ ARVO - Rota Excedida",
          `A rota #${rota.id} (${rota.veiculo_id}) está aberta há ${Math.floor(diferencaHoras)}h por ${rota.responsavel || 'outro usuário'}.`
        );
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
window.carregarModelosReferencia = carregarModelosReferencia;
window.aoSelecionarModeloReferencia = aoSelecionarModeloReferencia;
window.popularSelectsModelosReferencia = popularSelectsModelosReferencia;
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
window.abrirFinalizacaoDireta = abrirFinalizacaoDireto;

// =========================================================================
// INICIALIZAÇÃO
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  await carregarTodosDadosDoBanco();
  solicitarPermissaoNotificacoes();
  verificarRotasExcedidas12h();
  setInterval(verificarRotasExcedidas12h, 5 * 60 * 1000);
});


// Fabrício Rocha Teixeira Desenvolvedor 