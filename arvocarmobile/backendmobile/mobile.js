// =========================================================================
// MÓDULO: OPERAÇÃO MOBILE DE ROTAS - ARVO (COM SUPORTE OFFLINE E CONSUMO)
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

// Instanciação segura do cliente Supabase
const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

let usuarioLogado = null;
let veiculos = [];
let rotas = [];
let listaModelosReferencia = [];

// =========================================================================
// SESSÃO, PERMISSÕES E LOGIN
// =========================================================================
function obterSessaoAtiva() {
  const sessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  try {
    return sessao ? JSON.parse(sessao) : null;
  } catch (e) {
    return sessao ? { email: sessao, nome: sessao } : null;
  }
}

function salvarSessaoUnificada(usuario) {
  const dados = JSON.stringify(usuario);
  localStorage.setItem('arvo_mobile_user', dados);
  localStorage.setItem('arvo_usuario_logado', dados);
}

function toggleSenhaMobile() {
  const input = document.getElementById('m-senha');
  const icone = document.getElementById('m-icone-senha');
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    if (icone) icone.className = 'ph-bold ph-eye-slash text-base';
  } else {
    input.type = 'password';
    if (icone) icone.className = 'ph-bold ph-eye text-base';
  }
}

async function handleMobileLogin(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const emailInput = document.getElementById('m-email');
  const senhaInput = document.getElementById('m-senha');
  const btn = document.getElementById('btn-m-login');
  const erroBox = document.getElementById('m-login-erro') || document.getElementById('erro-login-box');
  const erroMsg = document.getElementById('m-login-erro-msg') || document.getElementById('erro-login-msg');

  if (erroBox) erroBox.classList.add('hidden');

  const email = (emailInput?.value || '').trim().toLowerCase();
  const senha = (senhaInput?.value || '').trim();

  if (!email || !senha) {
    if (erroMsg) erroMsg.innerText = "Informe o e-mail e a senha.";
    if (erroBox) erroBox.classList.remove('hidden');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Entrando...`;
  }

  try {
    if (!navigator.onLine) {
      const sessaoLocal = obterSessaoAtiva();
      if (sessaoLocal && sessaoLocal.email === email) {
        usuarioLogado = sessaoLocal;
        iniciarAppMobile();
        return;
      }
      throw new Error("Sem conexão para validar novo login.");
    }

    const { data, error } = await db
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error("Usuário não cadastrado.");
    if (String(data.senha).trim() !== senha) throw new Error("Senha incorreta.");
    if (data.status && data.status.toLowerCase() === 'inativo') {
      throw new Error("Usuário inativo no sistema.");
    }

    usuarioLogado = {
      id: data.id,
      nome: data.nome || email.split('@')[0],
      email: data.email,
      cnh: data.cnh || '',
      cargo: data.cargo || 'Condutor'
    };

    salvarSessaoUnificada(usuarioLogado);
    iniciarAppMobile();
  } catch (err) {
    console.error("Erro no login mobile:", err);
    if (erroMsg) erroMsg.innerText = err.message || "E-mail ou senha inválidos.";
    if (erroBox) erroBox.classList.remove('hidden');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Entrar no Sistema</span> <i class="ph-bold ph-arrow-right text-base"></i>`;
    }
  }
}

function handleMobileLogout() {
  if (confirm("Deseja realmente sair da sua conta no aplicativo?")) {
    localStorage.removeItem('arvo_mobile_user');
    localStorage.removeItem('arvo_usuario_logado');
    usuarioLogado = null;

    const screenApp = document.getElementById('screen-app');
    const screenLogin = document.getElementById('screen-login');

    if (screenApp && screenLogin) {
      screenApp.classList.add('hidden');
      screenLogin.classList.remove('hidden');
    } else {
      window.location.href = "login.html";
    }
  }
}

function iniciarAppMobile() {
  const screenLogin = document.getElementById('screen-login');
  const screenApp = document.getElementById('screen-app');
  const topUsername = document.getElementById('m-top-username');

  if (screenLogin) screenLogin.classList.add('hidden');
  if (screenApp) screenApp.classList.remove('hidden');
  if (topUsername && usuarioLogado) {
    topUsername.innerText = `${usuarioLogado.nome} (${usuarioLogado.email})`;
  }

  solicitarPermissaoNotificacao();
  switchMobileTab('iniciar');
  carregarDadosMobile();
  sincronizarFilaRotas();

  // Monitoramento contínuo de rotas > 12h
  if (window._intervaloRotasMobile) clearInterval(window._intervaloRotasMobile);
  window._intervaloRotasMobile = setInterval(verificarRotasExcedidas12h, 300000);
}

function switchMobileTab(tab) {
  const abas = ['iniciar', 'finalizar', 'historico'];

  abas.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`nav-btn-${t}`);
    if (el) el.classList.add('hidden');
    if (btn) {
      btn.classList.remove('text-brand-700', 'font-bold');
      btn.classList.add('text-slate-400', 'font-semibold');
    }
  });

  const activeView = document.getElementById(`tab-${tab}`);
  const activeBtn = document.getElementById(`nav-btn-${tab}`);
  if (activeView) activeView.classList.remove('hidden');
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-400', 'font-semibold');
    activeBtn.classList.add('text-brand-700', 'font-bold');
  }

  if (tab === 'historico') {
    renderizarHistoricoMobile();
  }
}

// =========================================================================
// CARREGAMENTO DE DADOS COM CACHE LOCAL
// =========================================================================
async function carregarDadosMobile() {
  const veiculosCache = localStorage.getItem('arvo_cache_veiculos');
  const rotasCache = localStorage.getItem('arvo_cache_rotas');

  if (veiculosCache) veiculos = JSON.parse(veiculosCache);
  if (rotasCache) rotas = JSON.parse(rotasCache);

  renderizarOpcoesVeiculos();
  renderizarOpcoesRotasAtivas();
  renderizarHistoricoMobile();

  if (navigator.onLine) {
    try {
      const { data: dadosV } = await db
        .from('veiculos')
        .select('*')
        .neq('status', 'Fora de Uso')
        .order('nome_frota');

      if (dadosV) {
        veiculos = dadosV;
        localStorage.setItem('arvo_cache_veiculos', JSON.stringify(dadosV));
        renderizarOpcoesVeiculos();
      }

      const { data: dadosR } = await db
        .from('rotas')
        .select('*')
        .order('data_saida', { ascending: false });

      if (dadosR) {
        rotas = dadosR;
        localStorage.setItem('arvo_cache_rotas', JSON.stringify(dadosR));
        renderizarOpcoesRotasAtivas();
        renderizarHistoricoMobile();
      }

      const { data: dadosRef } = await db.from('modelos_referencia').select('*');
      if (dadosRef) listaModelosReferencia = dadosRef;

      verificarRotasExcedidas12h();
    } catch (err) {
      console.warn("Modo offline: operando com caches locais.");
    }
  }
}

// =========================================================================
// CÁLCULO DE CONSUMO DE COMBUSTÍVEL
// =========================================================================
function obterMediaConsumoEsperada(veiculo, tipoCombustivel, listaAbastecimentos = []) {
  const placa = (veiculo?.placa || '').trim().toUpperCase();
  const vId = veiculo?.id ? String(veiculo.id).trim().toUpperCase() : null;
  const uuid = veiculo?.uuid_veiculos ? String(veiculo.uuid_veiculos).trim() : null;
  const nomeFrota = (veiculo?.nome_frota || '').trim().toUpperCase();

  let abastsCarro = (listaAbastecimentos || [])
    .filter(a => {
      const aPlaca = (a.placa || '').trim().toUpperCase();
      const aVeicId = (a.veiculo_id ? String(a.veiculo_id) : '').trim().toUpperCase();
      const bateu = (placa && (aPlaca === placa || aVeicId === placa)) ||
                    (vId && aVeicId === vId) ||
                    (uuid && String(a.uuid_veiculos) === uuid) ||
                    (nomeFrota && aVeicId === nomeFrota);
      return bateu && Number(a.km_atual) > 0 && Number(a.quantidade_litros) > 0;
    })
    .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));

  const combAtual = (tipoCombustivel || abastsCarro[0]?.tipo_combustivel || 'Gasolina Comum').trim().toUpperCase();
  const ehEtanol = combAtual.includes('ETANOL') || combAtual.includes('ÁLCOOL');

  // 1. Apuração sequencial por histórico real
  if (abastsCarro.length >= 2) {
    const deltaKm = Number(abastsCarro[0].km_atual) - Number(abastsCarro[1].km_atual);
    const litros = Number(abastsCarro[0].quantidade_litros);
    if (deltaKm > 0 && litros > 0) {
      const med = deltaKm / litros;
      if (med >= 3 && med <= 35) return Number(med.toFixed(2));
    }
  }

  // 2. Média técnica cadastrada no próprio veículo
  const cUrb = Number(ehEtanol ? veiculo?.consumo_etanol_urbano : veiculo?.consumo_gasolina_urbano) || 0;
  const cRod = Number(ehEtanol ? veiculo?.consumo_etanol_rodoviario : veiculo?.consumo_gasolina_rodoviario) || 0;
  if (cUrb > 0 && cRod > 0) {
    return Number(((cUrb + cRod) / 2).toFixed(2));
  }

  // 3. Consulta na tabela modelos_referencia
  if (veiculo?.modelo_referencia_id && listaModelosReferencia.length > 0) {
    const ref = listaModelosReferencia.find(m => Number(m.id) === Number(veiculo.modelo_referencia_id));
    if (ref) {
      const rUrb = Number(ehEtanol ? ref.consumo_etanol_urbano : ref.consumo_gasolina_urbano) || 0;
      const rRod = Number(ehEtanol ? ref.consumo_etanol_rodoviario : ref.consumo_gasolina_rodoviario) || 0;
      if (rUrb > 0 && rRod > 0) {
        return Number(((rUrb + rRod) / 2).toFixed(2));
      }
    }
  }

  // 4. Fallback nominal dos limites cadastrados
  const cMin = Number(veiculo?.consumo_min) || 10;
  const cMax = Number(veiculo?.consumo_max) || 14;
  let fallback = (cMin + cMax) / 2;
  if (ehEtanol) fallback *= 0.7;

  return Number(Math.max(3, fallback).toFixed(2));
}

// =========================================================================
// OPERAÇÃO DE ROTAS (INÍCIO / FIM)
// =========================================================================
function renderizarOpcoesVeiculos() {
  const select = document.getElementById('m-inicio-veiculo');
  if (!select || !usuarioLogado) return;

  const emailUser = (usuarioLogado.email || '').toLowerCase().trim();
  const isAdmin = emailUser === 'admin@arvo.tec.br';

  select.innerHTML = '<option value="">Selecione o veículo...</option>';

  veiculos
    .filter(v => {
      if (v.status !== 'Disponivel') return false;
      // Trava de veículo externo exclusivo
      const isExterno = (v.tipo_frota || '').toUpperCase() === 'EXTERNO' || (v.proprietario || '').toUpperCase() === 'EXTERNO';
      const condutorExclusivo = (v.motorista_autorizado || '').toLowerCase().trim();
      if (isExterno && condutorExclusivo && condutorExclusivo !== emailUser && !isAdmin) {
        return false;
      }
      return true;
    })
    .forEach(v => {
      const nomeFrota = v.nome_frota || v.id;
      select.innerHTML += `
        <option value="${nomeFrota}" data-uuid="${v.uuid_veiculos || ''}" data-placa="${v.placa || ''}">
          ${nomeFrota} - ${v.marca || ''} [${v.placa || 'S/ Placa'}] (${Number(v.km_atual || 0).toLocaleString('pt-BR')} km)
        </option>
      `;
    });
}

function atualizarKmVeiculoMobile() {
  const select = document.getElementById('m-inicio-veiculo');
  const vId = select?.value;
  const opt = select?.options[select.selectedIndex];
  const uuid = opt?.dataset?.uuid;

  const v = veiculos.find(item => (uuid && item.uuid_veiculos === uuid) || (item.nome_frota === vId || item.id === vId));
  const inputKm = document.getElementById('m-inicio-km');
  if (inputKm) inputKm.value = v ? v.km_atual : '';
}

function toggleOutroOrigemMobile(valor) {
  const input = document.getElementById('m-inicio-origem-outro');
  if (input) {
    if (valor === 'OUTRO') {
      input.classList.remove('hidden');
      input.required = true;
      input.focus();
    } else {
      input.classList.add('hidden');
      input.required = false;
      input.value = '';
    }
  }
}

function toggleOutroDestinoMobile(valor) {
  const input = document.getElementById('m-fim-destino-outro');
  if (input) {
    if (valor === 'OUTRO') {
      input.classList.remove('hidden');
      input.required = true;
      input.focus();
    } else {
      input.classList.add('hidden');
      input.required = false;
      input.value = '';
    }
  }
}

function toggleAnomaliaMobile(show) {
  const txt = document.getElementById('m-fim-anomalia');
  if (txt) {
    if (show) txt.classList.remove('hidden');
    else {
      txt.classList.add('hidden');
      txt.value = '';
    }
  }
}

async function handleMobileInicioRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-confirmar-inicio');
  const selectElem = document.getElementById('m-inicio-veiculo');
  const veiculoId = selectElem?.value;
  const optSelecionada = selectElem ? selectElem.options[selectElem.selectedIndex] : null;

  const uuidVeiculo = optSelecionada?.dataset?.uuid || null;
  const placaVeiculo = optSelecionada?.dataset?.placa || null;

  const veiculo = veiculos.find(v => (uuidVeiculo && v.uuid_veiculos === uuidVeiculo) || (v.nome_frota === veiculoId || v.id === veiculoId));

  if (!veiculo || !usuarioLogado) {
    alert("Selecione um veículo disponível.");
    return;
  }

  // Trava de exclusividade externa
  const emailUser = (usuarioLogado.email || '').toLowerCase().trim();
  const isAdmin = emailUser === 'admin@arvo.tec.br';
  const isExterno = (veiculo.tipo_frota || '').toUpperCase() === 'EXTERNO' || (veiculo.proprietario || '').toUpperCase() === 'EXTERNO';
  const condutorExclusivo = (veiculo.motorista_autorizado || '').toLowerCase().trim();

  if (isExterno && condutorExclusivo && condutorExclusivo !== emailUser && !isAdmin) {
    alert("⚠️ Este veículo é de uso exclusivo de outro condutor.");
    return;
  }

  const selectOrigem = document.getElementById('m-inicio-origem')?.value;
  const outroOrigem = document.getElementById('m-inicio-origem-outro')?.value?.trim();
  const origemFinal = selectOrigem === 'OUTRO' ? outroOrigem : selectOrigem;
  const finalidade = document.getElementById('m-inicio-finalidade')?.value;
  const kmSaida = Number(document.getElementById('m-inicio-km')?.value || veiculo.km_atual || 0);

  if (!origemFinal) {
    alert("Por favor, informe a origem da rota.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;
  }

  const tempId = `temp_${Date.now()}`;
  const payloadRota = {
    id: tempId,
    veiculo_id: veiculoId,
    uuid_veiculos: uuidVeiculo || veiculo.uuid_veiculos,
    placa: placaVeiculo || veiculo.placa,
    responsavel: usuarioLogado.email,
    origem: origemFinal,
    finalidade: finalidade,
    km_saida: kmSaida,
    data_saida: new Date().toISOString(),
    status: 'Em Uso',
    offline_sync: !navigator.onLine
  };

  if (!navigator.onLine) {
    salvarNaFilaRotas({ tipo: 'INICIO', payload: payloadRota });
    rotas.unshift(payloadRota);
    veiculo.status = 'Em Uso';
    salvarCachesLocais();
    alert(`📶 Rota iniciada em Modo Offline! Será sincronizada assim que a internet voltar.`);
    e.target.reset();
    renderizarOpcoesVeiculos();
    renderizarOpcoesRotasAtivas();
    renderizarHistoricoMobile();
    switchMobileTab('finalizar');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-key text-base"></i> Iniciar Rota`;
    }
    return;
  }

  try {
    delete payloadRota.id;
    delete payloadRota.offline_sync;

    const { error: insertErr } = await db.from('rotas').insert([payloadRota]);
    if (insertErr) throw insertErr;

    // Atualiza status do veículo
    let qVeic = db.from('veiculos').update({ status: 'Em Uso' });
    if (uuidVeiculo) {
      qVeic = qVeic.eq('uuid_veiculos', uuidVeiculo);
    } else if (veiculo.nome_frota) {
      qVeic = qVeic.eq('nome_frota', veiculoId);
    } else {
      qVeic = qVeic.eq('id', veiculoId);
    }
    await qVeic;

    alert(`✅ Rota iniciada com sucesso com o veículo ${veiculoId}!`);
    e.target.reset();
    toggleOutroOrigemMobile('');
    await carregarDadosMobile();
    switchMobileTab('finalizar');
  } catch (err) {
    console.warn("Falha de conexão, enviando para fila local:", err);
    payloadRota.id = tempId;
    salvarNaFilaRotas({ tipo: 'INICIO', payload: payloadRota });
    rotas.unshift(payloadRota);
    veiculo.status = 'Em Uso';
    salvarCachesLocais();
    alert(`📶 Rota salva localmente! Sincronização automática agendada.`);
    e.target.reset();
    renderizarOpcoesVeiculos();
    renderizarOpcoesRotasAtivas();
    renderizarHistoricoMobile();
    switchMobileTab('finalizar');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-key text-base"></i> Iniciar Rota`;
    }
  }
}

function renderizarOpcoesRotasAtivas() {
  const select = document.getElementById('m-fim-rota-select');
  if (!select || !usuarioLogado) return;

  select.innerHTML = '<option value="">Selecione sua rota ativa...</option>';

  rotas
    .filter(r => r.status === 'Em Uso' && (r.responsavel === usuarioLogado.email || usuarioLogado.email === 'admin@arvo.tec.br'))
    .forEach(r => {
      select.innerHTML += `<option value="${r.id}">Cód. ${r.id} (${r.veiculo_id}) [${r.placa || 'S/ Placa'}] - Saída: ${Number(r.km_saida).toLocaleString('pt-BR')} km</option>`;
    });
}

function selecionarRotaFimMobile() {
  const rotaId = document.getElementById('m-fim-rota-select')?.value;
  const rota = rotas.find(r => String(r.id) === String(rotaId));
  const card = document.getElementById('m-detalhes-viagem');
  const inputKm = document.getElementById('m-fim-km');

  if (rota) {
    document.getElementById('m-info-veiculo').innerText = `${rota.veiculo_id} (${rota.placa || '-'})`;
    document.getElementById('m-info-kmsaida').innerText = `${Number(rota.km_saida).toLocaleString('pt-BR')} km`;
    if (inputKm) {
      inputKm.min = rota.km_saida;
      inputKm.value = rota.km_saida;
    }
    if (card) card.classList.remove('hidden');
    calcularKmPercorridoMobile();
  } else {
    if (card) card.classList.add('hidden');
  }
}

function calcularKmPercorridoMobile() {
  const rotaId = document.getElementById('m-fim-rota-select')?.value;
  const rota = rotas.find(r => String(r.id) === String(rotaId));
  const inputKm = document.getElementById('m-fim-km');
  const txtPercorrido = document.getElementById('m-info-percorrido');

  if (rota && inputKm && txtPercorrido) {
    const kmFim = Number(inputKm.value) || 0;
    const delta = kmFim - Number(rota.km_saida);
    txtPercorrido.innerText = delta >= 0 ? `${delta.toLocaleString('pt-BR')} km` : '0 km';
  }
}

// 3. FINALIZAÇÃO DA ROTA COM CÁLCULO E PERSISTÊNCIA DE CONSUMO_LITROS E TANQUE_VIRTUAL
async function handleMobileFimRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-confirmar-fim');
  const rotaId = document.getElementById('m-fim-rota-select')?.value;
  const rota = rotas.find(r => String(r.id) === String(rotaId));

  if (!rota) {
    alert("Selecione uma rota ativa.");
    return;
  }

  const selectDestino = document.getElementById('m-fim-destino')?.value;
  const outroDestino = document.getElementById('m-fim-destino-outro')?.value?.trim();
  const destinoFinal = selectDestino === 'OUTRO' ? outroDestino : selectDestino;

  const kmRetorno = Number(document.getElementById('m-fim-km')?.value || 0);
  const anomaliaMarcada = document.getElementById('m-fim-check-anomalia')?.checked;
  const relatorioAnomalia = document.getElementById('m-fim-anomalia')?.value?.trim() || null;

  if (kmRetorno < Number(rota.km_saida)) {
    alert(`O KM final (${kmRetorno}) não pode ser menor que o KM inicial (${rota.km_saida}).`);
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Finalizando...`;
  }

  const kmTotal = kmRetorno - Number(rota.km_saida);

  // Localiza o veículo em memória
  const veiculoAlvo = veiculos.find(v =>
    (rota.uuid_veiculos && v.uuid_veiculos === rota.uuid_veiculos) ||
    String(v.id) === String(rota.veiculo_id) ||
    String(v.nome_frota) === String(rota.veiculo_id) ||
    (rota.placa && String(v.placa) === String(rota.placa))
  ) || {};

  // Recupera histórico de abastecimentos em cache
  let histAbast = [];
  try {
    histAbast = JSON.parse(localStorage.getItem('arvo_cache_abastecimentos') || '[]');
  } catch (err) {
    histAbast = [];
  }

  // Cálculo da média e litros consumidos
  const medConsumo = obterMediaConsumoEsperada(veiculoAlvo, null, histAbast);
  const litrosConsumidos = kmTotal > 0 && medConsumo > 0
    ? Number((kmTotal / medConsumo).toFixed(2))
    : 0;

  // Débito no tanque virtual
  const capTanque = Number(veiculoAlvo.tanque || 47);
  const tanqueAtual = (veiculoAlvo.tanque_virtual !== null && veiculoAlvo.tanque_virtual !== undefined)
    ? Number(veiculoAlvo.tanque_virtual)
    : capTanque;
  const novoTanqueVirtual = Number(Math.max(0, tanqueAtual - litrosConsumidos).toFixed(2));
  const dataRetornoIso = new Date().toISOString();

  // Payload completo com consumo_litros
  const payloadFim = {
    rota_id: rota.id,
    destino: destinoFinal,
    km_retorno: kmRetorno,
    km_total: kmTotal,
    consumo_litros: litrosConsumidos,
    data_retorno: dataRetornoIso,
    status: 'Concluida',
    anomalia: anomaliaMarcada ? (relatorioAnomalia || 'Anomalia sem detalhes') : null
  };

  // Tratamento Offline
  if (!navigator.onLine || String(rota.id).startsWith('temp_')) {
    salvarNaFilaRotas({
      tipo: 'FIM',
      payload: payloadFim,
      veiculo_id: rota.veiculo_id,
      uuid_veiculos: rota.uuid_veiculos,
      tanque_virtual: novoTanqueVirtual,
      anomalia: payloadFim.anomalia
    });

    rota.status = 'Concluida';
    rota.km_total = kmTotal;
    rota.consumo_litros = litrosConsumidos;
    rota.data_retorno = payloadFim.data_retorno;
    rota.destino = destinoFinal;

    if (veiculoAlvo) {
      veiculoAlvo.km_atual = kmRetorno;
      veiculoAlvo.status = 'Disponivel';
      veiculoAlvo.tanque_virtual = novoTanqueVirtual;
      if (payloadFim.anomalia) veiculoAlvo.anomalias = payloadFim.anomalia;
    }

    salvarCachesLocais();
    alert(`📶 Rota encerrada Offline!\nConsumo: ~${litrosConsumidos} L (Média: ${medConsumo} km/L)\nSerá sincronizada quando houver sinal.`);
    e.target.reset();
    renderizarHistoricoMobile();
    renderizarOpcoesRotasAtivas();
    renderizarOpcoesVeiculos();
    switchMobileTab('historico');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-base"></i> Finalizar Rota`;
    }
    return;
  }

  // Fluxo Online
  try {
    // 1. Atualiza a tabela rotas gravando consumo_litros
    const { error: errRota } = await db.from('rotas').update({
      destino: destinoFinal,
      km_retorno: kmRetorno,
      km_total: kmTotal,
      consumo_litros: litrosConsumidos,
      data_retorno: payloadFim.data_retorno,
      status: 'Concluida',
      anomalia: payloadFim.anomalia
    }).eq('id', rota.id);

    if (errRota) throw errRota;

    // 2. Atualiza tabela veiculos com odômetro, disponibilidade e tanque virtual
    const payloadVeiculo = {
      km_atual: kmRetorno,
      status: 'Disponivel',
      tanque_virtual: novoTanqueVirtual
    };
    if (payloadFim.anomalia || veiculoAlvo.anomalias) {
      payloadVeiculo.anomalias = payloadFim.anomalia || veiculoAlvo.anomalias;
    }

    const condicoesVeiculo = [];
    if (rota.uuid_veiculos) condicoesVeiculo.push(`uuid_veiculos.eq.${rota.uuid_veiculos}`);
    if (veiculoAlvo.uuid_veiculos) condicoesVeiculo.push(`uuid_veiculos.eq.${veiculoAlvo.uuid_veiculos}`);
    if (veiculoAlvo.id) condicoesVeiculo.push(`id.eq.${veiculoAlvo.id}`);
    if (rota.veiculo_id) condicoesVeiculo.push(`nome_frota.eq.${rota.veiculo_id}`);
    if (rota.placa) condicoesVeiculo.push(`placa.eq.${rota.placa}`);

    if (condicoesVeiculo.length > 0) {
      await db.from('veiculos').update(payloadVeiculo).or(condicoesVeiculo.join(','));
    }

    // 3. Encerra reserva vinculada se houver
    try {
      await db.from('reservas').update({ status: 'CONCLUIDA' })
        .eq('veiculo_id', rota.veiculo_id)
        .eq('responsavel', rota.responsavel)
        .eq('status', 'CONFIRMADA');
    } catch (resErr) {
      console.warn("Aviso ao atualizar reservas pendentes:", resErr);
    }

    alert(`✅ Rota concluída!\nConsumo estimado: ~${litrosConsumidos} L (Média: ${medConsumo} km/L)\nTanque restante: ~${novoTanqueVirtual} L`);
    e.target.reset();
    toggleOutroDestinoMobile('');
    toggleAnomaliaMobile(false);
    document.getElementById('m-detalhes-viagem')?.classList.add('hidden');
    await carregarDadosMobile();
    switchMobileTab('historico');
  } catch (err) {
    console.warn("Salvando encerramento na fila offline devido a erro:", err);
    salvarNaFilaRotas({
      tipo: 'FIM',
      payload: payloadFim,
      veiculo_id: rota.veiculo_id,
      uuid_veiculos: rota.uuid_veiculos,
      tanque_virtual: novoTanqueVirtual,
      anomalia: payloadFim.anomalia
    });
    rota.status = 'Concluida';
    rota.km_total = kmTotal;
    rota.consumo_litros = litrosConsumidos;
    salvarCachesLocais();
    alert(`📶 Finalização salva localmente.`);
    switchMobileTab('historico');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-base"></i> Finalizar Rota`;
    }
  }
}

// =========================================================================
// FILA OFFLINE E SINCRONIZAÇÃO EM SEGUNDO PLANO
// =========================================================================
function salvarNaFilaRotas(item) {
  const fila = JSON.parse(localStorage.getItem('arvo_sync_rotas_queue') || '[]');
  fila.push(item);
  localStorage.setItem('arvo_sync_rotas_queue', JSON.stringify(fila));
}

function salvarCachesLocais() {
  localStorage.setItem('arvo_cache_veiculos', JSON.stringify(veiculos));
  localStorage.setItem('arvo_cache_rotas', JSON.stringify(rotas));
}

async function sincronizarFilaRotas() {
  if (!navigator.onLine) return;
  const fila = JSON.parse(localStorage.getItem('arvo_sync_rotas_queue') || '[]');
  if (fila.length === 0) return;

  console.log(`-> Sincronizando ${fila.length} itens de rotas pendentes...`);
  const itensRestantes = [];

  for (const item of fila) {
    try {
      if (item.tipo === 'INICIO') {
        const payload = { ...item.payload };
        delete payload.id;
        delete payload.offline_sync;
        await db.from('rotas').insert([payload]);
        await db.from('veiculos').update({ status: 'Em Uso' }).eq('nome_frota', payload.veiculo_id);
      } else if (item.tipo === 'FIM') {
        const { rota_id, ...dadosFim } = item.payload;
        if (!String(rota_id).startsWith('temp_')) {
          await db.from('rotas').update(dadosFim).eq('id', rota_id);

          const payloadV = {
            km_atual: dadosFim.km_retorno,
            status: 'Disponivel',
            tanque_virtual: item.tanque_virtual
          };
          if (item.anomalia) payloadV.anomalias = item.anomalia;

          if (item.uuid_veiculos) {
            await db.from('veiculos').update(payloadV).eq('uuid_veiculos', item.uuid_veiculos);
          } else {
            await db.from('veiculos').update(payloadV).eq('nome_frota', item.veiculo_id);
          }
        }
      }
    } catch (e) {
      console.error("Falha ao sincronizar item da fila:", item, e);
      itensRestantes.push(item);
    }
  }

  localStorage.setItem('arvo_sync_rotas_queue', JSON.stringify(itensRestantes));
  if (itensRestantes.length === 0) {
    console.log("-> Sincronização concluída com sucesso!");
    await carregarDadosMobile();
  }
}

window.addEventListener('online', sincronizarFilaRotas);

// =========================================================================
// HISTÓRICO DE ROTAS
// =========================================================================
function renderizarHistoricoMobile() {
  const container = document.getElementById('m-lista-historico');
  const badge = document.getElementById('m-total-rotas-badge');
  if (!container || !usuarioLogado) return;

  const minhasRotas = rotas.filter(r => r.responsavel === usuarioLogado.email || usuarioLogado.email === 'admin@arvo.tec.br');
  if (badge) badge.innerText = `${minhasRotas.length} rotas`;
  container.innerHTML = '';

  if (minhasRotas.length === 0) {
    container.innerHTML = `<div class="p-6 bg-white rounded-2xl text-center text-xs text-slate-400">Nenhuma rota registrada até o momento.</div>`;
    return;
  }

  minhasRotas.forEach(r => {
    const card = document.createElement('div');
    card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 transition";

    const isEmUso = r.status === 'Em Uso';
    const dtSaidaFmt = new Date(r.data_saida).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const dtRetornoFmt = r.data_retorno ? new Date(r.data_retorno).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

    const consumoTxt = r.consumo_litros ? `${Number(r.consumo_litros).toFixed(2)} L` : '-';

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
          <i class="ph-bold ph-car text-brand-600"></i> ${r.veiculo_id}
          <span class="text-[10px] text-slate-500 font-mono">(${r.placa || 'Sem placa'})</span>
        </span>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isEmUso ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">
          ${r.status} ${String(r.id).startsWith('temp_') ? '(Pendente 📶)' : ''}
        </span>
      </div>

      <div class="text-xs text-slate-700 font-medium flex items-center gap-1">
        <span>${r.origem}</span> &rarr; <span>${r.destino || '<em class="text-amber-600">Em trânsito</em>'}</span>
      </div>

      <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1.5 border-t border-slate-100">
        <span>Saída: ${dtSaidaFmt}</span>
        <span>${r.km_total ? `${r.km_total} km rodados` : `KM Inicial: ${r.km_saida}`}</span>
      </div>

      ${!isEmUso ? `
        <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>Retorno: ${dtRetornoFmt}</span>
          <span class="text-brand-700 font-bold">Consumo: ${consumoTxt}</span>
        </div>
      ` : ''}

      ${isEmUso ? `
        <div class="pt-1">
          <button onclick="abrirFinalizacaoDiretaMobile('${r.id}')" class="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1">
            <i class="ph-bold ph-flag-checkered"></i> Encerrar Esta Rota
          </button>
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });
}

function abrirFinalizacaoDiretaMobile(rotaId) {
  switchMobileTab('finalizar');
  const select = document.getElementById('m-fim-rota-select');
  if (select) {
    select.value = rotaId;
    selecionarRotaFimMobile();
  }
}

// =========================================================================
// NOTIFICAÇÕES NATIVAS E MODAL VISUAL (> 12H)
// =========================================================================
function solicitarPermissaoNotificacao() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function dispararNotificacaoNativa(titulo, corpo) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(titulo, {
        body: corpo,
        icon: '/imagens/logo3d192.png',
        badge: '/imagens/logo3d192.png',
        vibrate: [200, 100, 200]
      });
    });
  } else {
    try {
      new Notification(titulo, { body: corpo, icon: '/imagens/logo3d192.png' });
    } catch (e) {}
  }
}

async function verificarRotasExcedidas12h() {
  const sessao = obterSessaoAtiva();
  if (!sessao) return;

  const agora = new Date();

  rotas
    .filter(r => r.status === 'Em Uso')
    .forEach(rota => {
      if (!rota.data_saida) return;
      const diferencaHoras = (agora - new Date(rota.data_saida)) / (1000 * 60 * 60);

      if (diferencaHoras >= 12) {
        exibirPopUpAlerta(rota, diferencaHoras, sessao);
      }
    });
}

function exibirPopUpAlerta(rota, horasAbertas, sessao) {
  const modalId = `modal-alerta-${rota.id}`;
  if (document.getElementById(modalId)) return;

  const emailAtual = (sessao.email || '').toLowerCase().trim();
  const condutorRota = (rota.responsavel || '').toLowerCase().trim();
  const podeEncerrar = emailAtual === condutorRota || emailAtual === 'admin@arvo.tec.br';

  dispararNotificacaoNativa(
    "⚠️ Alerta: Rota em Aberto Excedida",
    `O veículo ${rota.veiculo_id} está com rota em aberto há mais de ${Math.floor(horasAbertas)} horas.`
  );

  const popUp = document.createElement('div');
  popUp.id = modalId;
  popUp.className = "fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4";
  popUp.innerHTML = `
    <div class="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-rose-100 text-center space-y-4">
      <div class="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
        <i class="ph-bold ph-warning-circle"></i>
      </div>
      <div>
        <h3 class="text-base font-black text-slate-800">Rota Aberta Excedida!</h3>
        <p class="text-xs text-slate-500 mt-1">
          O veículo <b>${rota.veiculo_id}</b> (${rota.placa || '-'}) sob responsabilidade de <b>${rota.responsavel}</b> está em rota há mais de <b>${Math.floor(horasAbertas)} horas</b>.
        </p>
      </div>

      <div class="flex gap-2 pt-2">
        <button onclick="document.getElementById('${modalId}').remove()" class="flex-1 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl">
          Fechar
        </button>
        ${podeEncerrar ? `
          <button onclick="document.getElementById('${modalId}').remove(); abrirFinalizacaoDiretaMobile('${rota.id}');" class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md">
            Finalizar Agora
          </button>
        ` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(popUp);
}

// =========================================================================
// INICIALIZAÇÃO NO DOM E EXPORTAÇÃO GLOBAL
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const sessao = obterSessaoAtiva();
  if (sessao) {
    usuarioLogado = sessao;
    iniciarAppMobile();

    // Lê a aba vinda da URL (?tab=...) ou do localStorage
    const params = new URLSearchParams(window.location.search);
    const abaParam = params.get('tab') || localStorage.getItem('arvo_mobile_active_tab');
    if (abaParam) {
      switchMobileTab(abaParam);
      localStorage.removeItem('arvo_mobile_active_tab');
    }
  }
});

// Bindings globais no escopo window
window.toggleSenhaMobile = toggleSenhaMobile;
window.handleMobileLogin = handleMobileLogin;
window.handleMobileLogout = handleMobileLogout;
window.switchMobileTab = switchMobileTab;
window.atualizarKmVeiculoMobile = atualizarKmVeiculoMobile;
window.toggleOutroOrigemMobile = toggleOutroOrigemMobile;
window.toggleOutroDestinoMobile = toggleOutroDestinoMobile;
window.toggleAnomaliaMobile = toggleAnomaliaMobile;
window.handleMobileInicioRota = handleMobileInicioRota;
window.selecionarRotaFimMobile = selecionarRotaFimMobile;
window.calcularKmPercorridoMobile = calcularKmPercorridoMobile;
window.handleMobileFimRota = handleMobileFimRota;
window.abrirFinalizacaoDiretaMobile = abrirFinalizacaoDiretaMobile;
window.obterMediaConsumoEsperada = obterMediaConsumoEsperada;