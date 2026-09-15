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
function veiculoVisivelParaUsuario(v, user) {
  const tipo = (v?.tipo_frota || '').toUpperCase().trim();
  const isExterno = tipo.includes('EXTERN') || tipo.includes('ESPORADIC');

  // Carros da frota regular continuam visíveis para todos
  if (!isExterno) return true;

  const emailUsuario = (user?.email || '').toLowerCase().trim();
  const adminPadrao = (typeof ADMIN_EMAIL !== 'undefined' ? ADMIN_EMAIL : 'admin@arvo.tec.br').toLowerCase().trim();
  const ehAdmin = emailUsuario === adminPadrao;

  // Admin sempre enxerga tudo
  if (ehAdmin) return true;

  const motoristaAutorizado = (v?.motorista_autorizado || '').toLowerCase().trim();

  // Se for externo e não tiver motorista atribuído, fica oculto para usuários comuns
  if (!motoristaAutorizado) return false;

  // Libera se o condutor logado bater com o motorista credenciado (por e-mail, nome ou ID)
  if (emailUsuario === motoristaAutorizado) return true;
  if (user?.nome && user.nome.toLowerCase().trim() === motoristaAutorizado) return true;
  if (user?.id && String(user.id).trim() === motoristaAutorizado) return true;

  return false;
}

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

// =========================================================================
// SINCRONIZAÇÃO EM SEGUNDO PLANO SEGURA (FILA OFFLINE -> SUPABASE)
// =========================================================================
async function sincronizarFilaRotas() {
  if (!navigator.onLine) return;
  const fila = JSON.parse(localStorage.getItem('arvo_sync_rotas_queue') || '[]');
  if (fila.length === 0) return;

  console.log(`-> Sincronizando ${fila.length} itens de rotas pendentes...`);
  const itensRestantes = [];

  for (let i = 0; i < fila.length; i++) {
    const item = fila[i];
    try {
      if (item.tipo === 'INICIO') {
        const payload = { ...item.payload };
        const tempId = payload.id;
        delete payload.id;
        delete payload.offline_sync;

        // 1. Inserção sem .single() para contornar bloqueios de RLS
        const { data: inserido, error: errInsert } = await db
          .from('rotas')
          .insert([payload])
          .select('id');

        if (errInsert) throw errInsert;

        const idRealCriado = (inserido && inserido[0]) ? inserido[0].id : null;

        // 2. Atualiza o status do veículo por Placa ou Nome de Frota
        const identificador = payload.placa || payload.veiculo_id;
        let qVeic = db.from('veiculos').update({ status: 'Em Uso' });
        if (payload.placa) {
          qVeic = qVeic.eq('placa', payload.placa);
        } else {
          qVeic = qVeic.or(`nome_frota.eq.${payload.veiculo_id},id.eq.${payload.veiculo_id}`);
        }
        await qVeic;

        // 3. Atualiza os itens seguintes da fila que dependiam do tempId
        if (idRealCriado && tempId) {
          fila.forEach(outroItem => {
            if (outroItem.tipo === 'FIM' && String(outroItem.payload?.rota_id) === String(tempId)) {
              outroItem.payload.rota_id = idRealCriado;
            }
          });
        }

      } else if (item.tipo === 'FIM') {
        const { rota_id, ...dadosFim } = item.payload;

        // Se ainda for um ID temporário não resolvido, aguarda próximo ciclo
        if (String(rota_id).startsWith('temp_')) {
          itensRestantes.push(item);
          continue;
        }

        // 1. Atualiza o fechamento da rota no banco
        const { error: errFim } = await db
          .from('rotas')
          .update(dadosFim)
          .eq('id', rota_id);

        if (errFim) throw errFim;

        // 2. Atualiza o veículo para 'Disponivel'
        const placaAlvo = item.placa || item.payload?.placa;
        const veicAlvo = item.veiculo_id || item.payload?.veiculo_id;
        const payloadUpdateVeic = {
          status: 'Disponivel'
        };
        if (dadosFim.km_retorno) payloadUpdateVeic.km_atual = dadosFim.km_retorno;
        if (item.tanque_virtual !== undefined) payloadUpdateVeic.tanque_virtual = item.tanque_virtual;

        let qVeicFim = db.from('veiculos').update(payloadUpdateVeic);
        if (placaAlvo) {
          qVeicFim = qVeicFim.eq('placa', placaAlvo);
        } else if (veicAlvo) {
          qVeicFim = qVeicFim.or(`nome_frota.eq.${veicAlvo},id.eq.${veicAlvo}`);
        }
        await qVeicFim;

        // 3. Conclui eventuais reservas vinculadas
        try {
          await db.from('reservas').update({ status: 'CONCLUIDA' })
            .eq('veiculo_id', veicAlvo)
            .eq('status', 'CONFIRMADA');
        } catch (resErr) {
          console.warn("Aviso ao liberar reserva sincronizada:", resErr);
        }
      }
    } catch (e) {
      console.error("Falha ao sincronizar item da fila:", item, e);
      itensRestantes.push(item);
    }
  }

  // Atualiza a fila apenas com o que realmente falhou
  localStorage.setItem('arvo_sync_rotas_queue', JSON.stringify(itensRestantes));

  if (itensRestantes.length === 0) {
    console.log("-> Sincronização offline concluída com sucesso!");
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

function exibirPopUpAlerta(rota, horasAbertas) {
  if (!rota || !rota.id) return;
  const modalId = `modal-alerta-${rota.id}`;

  // Se já existir na tela, remove para recriar atualizado
  const modalAntigo = document.getElementById(modalId);
  if (modalAntigo) modalAntigo.remove();

  // Leitura segura da sessão
  const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  let emailUsuario = '';
  let nomeUsuario = '';

  if (rawSessao) {
    try {
      const parsed = JSON.parse(rawSessao);
      emailUsuario = (parsed.email || '').toLowerCase().trim();
      nomeUsuario = (parsed.nome || '').toLowerCase().trim();
    } catch {
      emailUsuario = String(rawSessao).toLowerCase().trim();
    }
  }

  const responsavelRota = String(rota.responsavel || '').toLowerCase().trim();
  const isAdmin = emailUsuario === 'admin@arvo.tec.br';
  const isCondutor = (emailUsuario && responsavelRota.includes(emailUsuario)) || (nomeUsuario && responsavelRota.includes(nomeUsuario));
  const podeEncerrar = isAdmin || isCondutor;

  if (typeof dispararNotificacaoNativa === 'function') {
    dispararNotificacaoNativa(
      "⚠️ Alerta: Rota em Aberto Excedida",
      `O veículo ${rota.veiculo_id} está com rota em aberto há mais de ${Math.floor(horasAbertas)} horas.`
    );
  }

  const popUp = document.createElement('div');
  popUp.id = modalId;
  popUp.className = "modal-alerta-backdrop";
  // Estilo inline de contingência para garantir fixação e sobreposição
  popUp.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(15, 23, 42, 0.75) !important; z-index: 99999 !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 1rem !important; box-sizing: border-box !important;";

  popUp.innerHTML = `
    <div class="modal-alerta-card" style="background: #ffffff !important; border-radius: 1.5rem !important; max-width: 24rem !important; width: 100% !important; padding: 1.5rem !important; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3) !important; text-align: center !important; border: 1px solid #ffe4e6 !important;">
      
      <div class="modal-alerta-icon-box" style="width: 3.5rem; height: 3.5rem; background-color: #ffe4e6; color: #e11d48; border-radius: 1rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; font-size: 1.75rem;">
        <i class="ph-bold ph-warning-circle"></i>
      </div>

      <div>
        <h3 class="modal-alerta-titulo" style="font-size: 1rem; font-weight: 900; color: #0f172a; margin: 0;">Atenção: Rota Pendente!</h3>
        <p class="modal-alerta-texto" style="font-size: 0.75rem; color: #64748b; margin-top: 0.35rem; line-height: 1.3;">
          A rota <b style="color: #0f172a;">#${rota.id}</b> com o veículo <b style="color: #0f172a;">${rota.veiculo_id} [${rota.placa || '-'}]</b> (Condutor: <b>${rota.responsavel}</b>) está aberta há mais de <span class="modal-alerta-horas" style="color: #e11d48; font-weight: 700;">${Math.floor(horasAbertas)} horas</span>.
        </p>
      </div>

      <div class="modal-alerta-box-aviso" style="background-color: #fefce8; border: 1px solid #fef08a; color: #854d0e; font-size: 0.75rem; padding: 0.75rem; border-radius: 0.75rem; margin: 1rem 0; line-height: 1.35; text-align: left;">
        ${podeEncerrar 
          ? "Por favor, finalize o check-in e registre o KM final para evitar inconsistências no fechamento." 
          : "Esta rota está aberta há mais de 12 horas. Apenas o condutor responsável ou a administração podem encerrá-la."}
      </div>

      <div class="modal-alerta-actions" style="display: flex; gap: 0.5rem; width: 100%;">
        ${podeEncerrar ? `
          <button type="button" onclick="document.getElementById('${modalId}').remove()" class="btn-alerta-lembrar" style="flex: 1; padding: 0.625rem; background-color: #f1f5f9; color: #334155; font-weight: 700; font-size: 0.75rem; border-radius: 0.75rem; border: none; cursor: pointer;">
            Lembrar Depois
          </button>
          <button type="button" onclick="document.getElementById('${modalId}').remove(); abrirFinalizacaoDiretaMobile('${rota.id}');" class="btn-alerta-finalizar" style="flex: 1; padding: 0.625rem; background-color: #15803d; color: #ffffff; font-weight: 700; font-size: 0.75rem; border-radius: 0.75rem; border: none; cursor: pointer;">
            Finalizar Agora
          </button>
        ` : `
          <button type="button" onclick="document.getElementById('${modalId}').remove()" class="btn-alerta-fechar" style="width: 100%; padding: 0.625rem; background-color: #d97706; color: #ffffff; font-weight: 700; font-size: 0.75rem; border-radius: 0.75rem; border: none; cursor: pointer; display: block;">
            Fechar
          </button>
        `}
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
window.exibirPopUpAlerta = exibirPopUpAlerta;