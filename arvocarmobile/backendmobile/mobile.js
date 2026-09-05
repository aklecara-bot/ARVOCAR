// =========================================================================
// MÓDULO: OPERAÇÃO MOBILE DE ROTAS - SUPORTE OFFLINE ARVO 2026
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";
const ADMIN_EMAIL = "admin@arvo.tec.br";

const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }));

let usuarioLogado = null;
let veiculos = [];
let rotas = [];

// =========================================================================
// CONTROLE DE SESSÃO E LOGIN (ONLINE E OFFLINE)
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

// Salva as credenciais do usuário quando logar online com sucesso
function salvarCredenciaisOffline(email, senha, dadosUsuario) {
  const creds = JSON.parse(localStorage.getItem('arvo_creds_cache') || '{}');
  creds[email.toLowerCase()] = {
    senha: String(senha).trim(),
    usuario: dadosUsuario
  };
  localStorage.setItem('arvo_creds_cache', JSON.stringify(creds));
}

// Valida credenciais salvas no aparelho em caso de falta de sinal
function validarCredenciaisOffline(email, senha) {
  const creds = JSON.parse(localStorage.getItem('arvo_creds_cache') || '{}');
  const conta = creds[email.toLowerCase()];
  if (conta && conta.senha === String(senha).trim()) {
    return conta.usuario;
  }
  return null;
}

async function handleMobileLogin(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const emailInput = document.getElementById('m-email');
  const senhaInput = document.getElementById('m-senha');
  const btn = document.getElementById('btn-m-login');
  const erroBox = document.getElementById('erro-login-box');
  const erroMsg = document.getElementById('erro-login-msg');

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
    // 1. FLUXO OFFLINE: Se não há internet, valida pelo cache local do aparelho
    if (!navigator.onLine) {
      const usuarioOffline = validarCredenciaisOffline(email, senha);
      if (usuarioOffline) {
        usuarioLogado = usuarioOffline;
        salvarSessaoUnificada(usuarioLogado);
        iniciarAppMobile();
        return;
      } else {
        throw new Error("Sem internet. Conecte-se pelo menos uma vez para autenticar este usuário no aparelho.");
      }
    }

    // 2. FLUXO ONLINE: Valida diretamente no Supabase
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
      cnh: data.cnh || ''
    };

    // Salva a sessão ativa e o cache de credenciais para uso offline futuro
    salvarSessaoUnificada(usuarioLogado);
    salvarCredenciaisOffline(email, senha, usuarioLogado);

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

  switchMobileTab('iniciar');
  carregarDadosMobile();
  sincronizarFilaRotas();
}

function switchMobileTab(tab) {
  const abas = ['iniciar', 'finalizar', 'historico'];
  abas.forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`nav-btn-${t}`);
    if (el) el.classList.add('hidden');
    if (btn) btn.className = "flex flex-col items-center gap-1 text-slate-400 font-semibold transition";
  });

  const activeView = document.getElementById(`tab-${tab}`);
  const activeBtn = document.getElementById(`nav-btn-${tab}`);
  if (activeView) activeView.classList.remove('hidden');
  if (activeBtn) activeBtn.className = "flex flex-col items-center gap-1 text-brand-700 font-bold transition";
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
      const { data: dadosV } = await db.from('veiculos').select('*').neq('status', 'Fora de Uso').order('nome_frota');
      if (dadosV) {
        veiculos = dadosV;
        localStorage.setItem('arvo_cache_veiculos', JSON.stringify(dadosV));
        renderizarOpcoesVeiculos();
      }

      const { data: dadosR } = await db.from('rotas').select('*').order('data_saida', { ascending: false });
      if (dadosR) {
        // Mantém rotas offline pendentes não sincronizadas no topo
        const pendentes = rotas.filter(r => String(r.id).startsWith('temp_'));
        rotas = [...pendentes, ...dadosR.filter(r => !pendentes.some(p => p.id === r.id))];
        localStorage.setItem('arvo_cache_rotas', JSON.stringify(rotas));
        renderizarOpcoesRotasAtivas();
        renderizarHistoricoMobile();
      }
    } catch (err) {
      console.warn("Sem conexão: utilizando dados de veículos e rotas salvos localmente.");
    }
  }
}

// =========================================================================
// OPERAÇÃO DE ROTAS (INÍCIO / FIM) COM SUPORTE OFFLINE
// =========================================================================
function renderizarOpcoesVeiculos() {
  const select = document.getElementById('m-inicio-veiculo');
  if (!select) return;

  select.innerHTML = '<option value="">Selecione o veículo...</option>';
  veiculos
    .filter(v => v.status === 'Disponivel')
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

  // 1. Identifica o veículo no array carregado
  const veiculo = veiculos.find(v => 
    (uuidVeiculo && String(v.uuid_veiculos) === String(uuidVeiculo)) || 
    (placaVeiculo && String(v.placa) === String(placaVeiculo)) ||
    String(v.nome_frota) === String(veiculoId) || 
    String(v.id) === String(veiculoId)
  );

  if (!veiculo || !usuarioLogado) {
    alert("Selecione um veículo disponível.");
    return;
  }

  const placaFinal = veiculo.placa || placaVeiculo;
  const nomeFrotaFinal = veiculo.nome_frota || veiculoId;
  const emailAtual = (usuarioLogado.email || '').toLowerCase().trim();
  const agoraTs = new Date().getTime();

  // 2. BLOQUEIO DE AGENDAMENTO / RESERVA ATIVA
  if (navigator.onLine) {
    try {
      const { data: reservasCarro, error: errRes } = await db
        .from('reservas')
        .select('*')
        .eq('status', 'CONFIRMADA');

      if (!errRes && reservasCarro && reservasCarro.length > 0) {
        // Localiza se há agendamento para este carro no horário atual
        const reservaAtiva = reservasCarro.find(r => {
          const bateuCarro = (placaFinal && String(r.placa) === String(placaFinal)) ||
                             String(r.veiculo_id) === String(nomeFrotaFinal) ||
                             String(r.veiculo_id) === String(veiculo.id) ||
                             (placaFinal && String(r.veiculo_id) === String(placaFinal));

          const ini = new Date(r.data_inicio).getTime();
          const fim = new Date(r.data_fim).getTime();
          return bateuCarro && agoraTs >= ini && agoraTs <= fim;
        });

        if (reservaAtiva) {
          const donoReserva = (reservaAtiva.responsavel || '').toLowerCase().trim();

          // Se o condutor que está tentando abrir não for o dono da reserva, barra a rota
          if (donoReserva !== emailAtual) {
            const dataFimFmt = new Date(reservaAtiva.data_fim).toLocaleString('pt-BR', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
            });

            alert(
              `⛔ VEÍCULO BLOQUEADO POR RESERVA!\n\n` +
              `O veículo ${nomeFrotaFinal} [${placaFinal || '-'}] está agendado para:\n` +
              `👤 Titular: ${reservaAtiva.responsavel}\n` +
              `🎯 Finalidade: ${reservaAtiva.finalidade}\n` +
              `📅 Período até: ${dataFimFmt}\n\n` +
              `Apenas o titular pode retirar este carro.`
            );
            return;
          }
        }
      }
    } catch (errReserva) {
      console.warn("Aviso ao validar reservas no mobile:", errReserva);
    }
  }

  // 3. Validação dos campos do formulário
  const selectOrigem = document.getElementById('m-inicio-origem')?.value;
  const outroOrigem = document.getElementById('m-inicio-origem-outro')?.value?.trim();
  const origemFinal = selectOrigem === 'OUTRO' ? outroOrigem : selectOrigem;
  const finalidade = document.getElementById('res-finalidade')?.value || document.getElementById('m-inicio-finalidade')?.value || 'MONITORAMENTO';
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
  const dataSaidaAtual = new Date().toISOString();

  const payloadRota = {
    veiculo_id: nomeFrotaFinal,
    uuid_veiculos: veiculo.uuid_veiculos || uuidVeiculo || null,
    placa: placaFinal,
    responsavel: usuarioLogado.email,
    origem: origemFinal,
    finalidade: finalidade,
    km_saida: kmSaida,
    data_saida: dataSaidaAtual,
    status: 'Em Uso'
  };

  // 4. Fluxo Offline
  if (!navigator.onLine) {
    const payloadOffline = { ...payloadRota, id: tempId, offline_sync: true };
    salvarNaFilaRotas({ tipo: 'INICIO', payload: payloadOffline });
    rotas.unshift(payloadOffline);
    veiculo.status = 'Em Uso';
    salvarCachesLocais();

    alert(`📶 Rota iniciada Offline! Será sincronizada quando o sinal voltar.`);
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

  // 5. Fluxo Online no Supabase
  try {
    const { data: inserido, error: insertErr } = await db
      .from('rotas')
      .insert([payloadRota])
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Atualiza status do veículo para 'Em Uso' pela Placa
    let queryVeic = db.from('veiculos').update({ status: 'Em Uso' });
    if (placaFinal) {
      queryVeic = queryVeic.eq('placa', placaFinal);
    } else {
      queryVeic = queryVeic.eq('id', veiculo.id);
    }
    await queryVeic;

    alert(`✅ Rota iniciada com sucesso!`);
    e.target.reset();
    toggleOutroOrigemMobile('');
    await carregarDadosMobile();
    switchMobileTab('finalizar');
  } catch (err) {
    console.warn("Falha de rede, salvando na fila offline:", err);
    const payloadOffline = { ...payloadRota, id: tempId, offline_sync: true };
    salvarNaFilaRotas({ tipo: 'INICIO', payload: payloadOffline });
    rotas.unshift(payloadOffline);
    veiculo.status = 'Em Uso';
    salvarCachesLocais();

    alert(`📶 Salvo localmente! Será sincronizado ao reconectar.`);
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
    .filter(r => r.status === 'Em Uso' && r.responsavel === usuarioLogado.email)
    .forEach(r => {
      select.innerHTML += `<option value="${r.id}">${r.veiculo_id} [${r.placa || 'S/ Placa'}] - Saída: ${Number(r.km_saida).toLocaleString('pt-BR')} km</option>`;
    });
}

function selecionarRotaFimMobile() {
  const rotaId = document.getElementById('m-fim-rota-select')?.value;
  const rota = rotas.find(r => String(r.id) === String(rotaId));
  const card = document.getElementById('m-detalhes-viagem');
  const inputKm = document.getElementById('m-fim-km');

  if (rota) {
    const elVeiculo = document.getElementById('m-info-veiculo');
    const elKm = document.getElementById('m-info-kmsaida');
    if (elVeiculo) elVeiculo.innerText = `${rota.veiculo_id} (${rota.placa || '-'})`;
    if (elKm) elKm.innerText = `${Number(rota.km_saida).toLocaleString('pt-BR')} km`;
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
  const txtPercorrido = document.getElementById('m-info-percorrido') || document.getElementById('m-km-feedback');

  if (rota && inputKm && txtPercorrido) {
    const kmFim = Number(inputKm.value) || 0;
    const delta = kmFim - Number(rota.km_saida);
    txtPercorrido.innerText = delta >= 0 ? `${delta.toLocaleString('pt-BR')} km` : '0 km';
  }
}

/**
 * Determina a média de km/L esperada para um veículo específico e combustível atual.
 * @param {Object} veiculo - Objeto do veículo (com consumo_min, consumo_max, etc.)
 * @param {string} tipoCombustivel - Ex: 'Gasolina Comum', 'Etanol', 'Diesel'
 * @param {Array} listaAbastecimentos - Array global ou cache de abastecimentos
 * @returns {number} Média de consumo apurada em km/L
 */
function obterMediaConsumoEsperada(veiculo, tipoCombustivel, listaAbastecimentos = []) {
  const placa = veiculo?.placa;
  const vId = veiculo?.id;
  const uuid = veiculo?.uuid_veiculos;
  const nomeFrota = veiculo?.nome_frota;

  // 1. Filtra registros válidos deste veículo ordenados do mais recente para o mais antigo
  const abastsCarro = (listaAbastecimentos || [])
    .filter(a => {
      const bateuVeiculo = (placa && String(a.placa) === String(placa)) ||
                           (vId && String(a.veiculo_id) === String(vId)) ||
                           (uuid && String(a.uuid_veiculos) === String(uuid)) ||
                           (nomeFrota && String(a.veiculo_id) === String(nomeFrota));
      return bateuVeiculo && Number(a.km_atual) > 0 && Number(a.quantidade_litros) > 0;
    })
    .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));

  // Identifica o combustível corrente se não for informado diretamente
  const combAtual = tipoCombustivel || abastsCarro[0]?.tipo_combustivel || 'Gasolina Comum';

  // Filtra pelo combustível corrente
  const abastsTipo = abastsCarro.filter(a => 
    (a.tipo_combustivel || '').toUpperCase() === combAtual.toUpperCase()
  );

  // 2. Apuração por Histórico Real (requer ao menos 2 abastecimentos sequenciais com KM)
  if (abastsTipo.length >= 2) {
    const kmRecente = Number(abastsTipo[0].km_atual);
    const kmAnterior = Number(abastsTipo[1].km_atual);
    const litros = Number(abastsTipo[0].quantidade_litros);
    const deltaKm = kmRecente - kmAnterior;

    if (deltaKm > 0 && litros > 0) {
      const mediaCalculada = deltaKm / litros;
      // Trava de sanidade para evitar distorções operacionais (ex: esquecimento de anotar)
      if (mediaCalculada >= 3 && mediaCalculada <= 35) {
        return Number(mediaCalculada.toFixed(2));
      }
    }
  }

  // 3. Fallback: Dados nominais do fabricante
  const cMin = Number(veiculo?.consumo_min || 10);
  const cMax = Number(veiculo?.consumo_max || 14);
  let mediaFabricante = (cMin + cMax) / 2;

  // Fator de paridade: Etanol entrega em média 70% da eficiência da gasolina
  if (combAtual.toUpperCase().includes('ETANOL')) {
    mediaFabricante = mediaFabricante * 0.7;
  }

  return Number(mediaFabricante.toFixed(2));
}

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

  // Localiza o veículo associado no array local
  const veiculoAlvo = veiculos.find(v =>
    String(v.id) === String(rota.veiculo_id) ||
    String(v.uuid_veiculos) === String(rota.veiculo_id) ||
    String(v.nome_frota) === String(rota.veiculo_id) ||
    String(v.placa) === String(rota.veiculo_id) ||
    (rota.placa && String(v.placa) === String(rota.placa))
  ) || {};

  // --- CÁLCULO DINÂMICO DE CONSUMO E TANQUE VIRTUAL ---
  let histCache = [];
  try {
    histCache = JSON.parse(localStorage.getItem('arvo_cache_abastecimentos') || '[]');
  } catch (e) {
    histCache = [];
  }

  let medConsumo;
  if (typeof obterMediaConsumoEsperada === 'function') {
    medConsumo = obterMediaConsumoEsperada(veiculoAlvo, null, histCache);
  } else {
    medConsumo = (Number(veiculoAlvo.consumo_min) + Number(veiculoAlvo.consumo_max)) / 2 || 12;
  }

  const litrosEst = Number((kmTotal / medConsumo).toFixed(2));
  const capTanque = Number(veiculoAlvo.tanque || 45);
  const tanqueAnterior = (veiculoAlvo.tanque_virtual !== null && veiculoAlvo.tanque_virtual !== undefined)
    ? Number(veiculoAlvo.tanque_virtual)
    : capTanque;

  const novoTanqueVirtual = Number(Math.max(0, tanqueAnterior - litrosEst).toFixed(2));

  const payloadFim = {
    rota_id: rota.id,
    destino: destinoFinal,
    km_retorno: kmRetorno,
    km_total: kmTotal,
    consumo_litros: litrosEst,
    tanque_virtual: novoTanqueVirtual,
    data_retorno: new Date().toISOString(),
    status: 'Concluida',
    anomalia: anomaliaMarcada ? (relatorioAnomalia || 'Anomalia sem detalhes') : null
  };

  // Se estiver offline ou a rota for um ID temporário
  if (!navigator.onLine || String(rota.id).startsWith('temp_')) {
    salvarNaFilaRotas({ tipo: 'FIM', payload: payloadFim });
    rota.status = 'Concluida';
    rota.km_total = kmTotal;
    rota.consumo_litros = litrosEst;
    rota.data_retorno = payloadFim.data_retorno;
    rota.destino = destinoFinal;

    const v = veiculos.find(ve => 
      ve.nome_frota === rota.veiculo_id || 
      ve.id === rota.veiculo_id ||
      (veiculoAlvo.id && ve.id === veiculoAlvo.id)
    );
    if (v) {
      v.km_atual = kmRetorno;
      v.status = 'Disponivel';
      v.tanque_virtual = novoTanqueVirtual;
    }
    salvarCachesLocais();
    alert(`📶 Rota encerrada Offline! Consumo: ~${litrosEst} L. Será sincronizada quando houver conexão.`);
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

  try {
    // 1. Atualiza a rota com odômetro, trajeto e litros consumidos
    const { error: errRota } = await db.from('rotas').update({
      destino: destinoFinal,
      km_retorno: kmRetorno,
      km_total: kmTotal,
      consumo_litros: litrosEst,
      data_retorno: payloadFim.data_retorno,
      status: 'Concluida',
      anomalia: payloadFim.anomalia
    }).eq('id', rota.id);
    
    if (errRota) throw errRota;

    const idFiltro = veiculoAlvo?.uuid_veiculos || veiculoAlvo?.id || rota.veiculo_id;

    // 2. Atualiza o veículo com KM, status 'Disponivel' e saldo do tanque virtual
    const payloadUpdateVeic = {
      km_atual: kmRetorno,
      status: 'Disponivel',
      tanque_virtual: novoTanqueVirtual
    };

    let queryVeic = db.from('veiculos').update(payloadUpdateVeic);
    if (veiculoAlvo?.placa) {
      queryVeic = queryVeic.or(`placa.eq.${veiculoAlvo.placa},uuid_veiculos.eq.${idFiltro},id.eq.${idFiltro},nome_frota.eq.${idFiltro}`);
    } else {
      queryVeic = queryVeic.or(`uuid_veiculos.eq.${idFiltro},id.eq.${idFiltro},nome_frota.eq.${idFiltro}`);
    }
    await queryVeic;

    // 3. Encerra eventual reserva confirmada vinculada ao veículo e motorista
    try {
      await db.from('reservas').update({ status: 'CONCLUIDA' })
        .eq('veiculo_id', rota.veiculo_id)
        .eq('responsavel', rota.responsavel)
        .eq('status', 'CONFIRMADA');
    } catch (errRes) {
      console.warn("Aviso ao atualizar reservas pendentes no mobile:", errRes);
    }

    alert(`✅ Rota concluída com sucesso!\nDistância: ${kmTotal} km | Consumo est.: ~${litrosEst} L\nTanque virtual: ~${novoTanqueVirtual} L restantes`);
    e.target.reset();
    toggleOutroDestinoMobile('');
    toggleAnomaliaMobile(false);
    await carregarDadosMobile();
    switchMobileTab('historico');
  } catch (err) {
    console.warn("Salvando encerramento na fila offline:", err);
    salvarNaFilaRotas({ tipo: 'FIM', payload: payloadFim });
    rota.status = 'Concluida';
    rota.consumo_litros = litrosEst;
    if (veiculoAlvo) {
      veiculoAlvo.tanque_virtual = novoTanqueVirtual;
    }
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
// FILA DE PERSISTÊNCIA OFFLINE E SINCRONIZAÇÃO EM SEGUNDO PLANO
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

  const itensRestantes = [];

  for (const item of fila) {
    try {
      if (item.tipo === 'INICIO') {
        const payload = { ...item.payload };
        const tempId = payload.id;
        delete payload.id;
        delete payload.offline_sync;

        const { data: rotaCriada, error: errInsert } = await db.from('rotas').insert([payload]).select().single();
        if (errInsert) throw errInsert;

        await db.from('veiculos').update({ status: 'Em Uso' }).eq('id', payload.veiculo_id);

        // Atualiza referências de 'temp_' para o ID oficial gerado no Supabase
        fila.forEach(outroItem => {
          if (outroItem.tipo === 'FIM' && outroItem.payload.rota_id === tempId) {
            outroItem.payload.rota_id = rotaCriada.id;
          }
        });
      } else if (item.tipo === 'FIM') {
        const { rota_id, ...dadosFim } = item.payload;
        if (!String(rota_id).startsWith('temp_')) {
          await db.from('rotas').update(dadosFim).eq('id', rota_id);
          if (dadosFim.km_retorno) {
            const rota = rotas.find(r => r.id === rota_id);
            if (rota) {
              await db.from('veiculos').update({ km_atual: dadosFim.km_retorno, status: 'Disponivel' }).eq('id', rota.veiculo_id);
            }
          }
        } else {
          itensRestantes.push(item);
        }
      }
    } catch (e) {
      console.error("Falha ao sincronizar item:", item, e);
      itensRestantes.push(item);
    }
  }

  localStorage.setItem('arvo_sync_rotas_queue', JSON.stringify(itensRestantes));
  if (itensRestantes.length === 0) {
    console.log("-> Sincronização offline concluída com sucesso!");
    await carregarDadosMobile();
  }
}

// Escuta retorno de rede
window.addEventListener('online', sincronizarFilaRotas);

function renderizarHistoricoMobile() {
  const container = document.getElementById('m-lista-historico');
  const badge = document.getElementById('m-total-rotas-badge');
  if (!container || !usuarioLogado) return;

  const minhasRotas = rotas.filter(r => r.responsavel === usuarioLogado.email);
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
    `;
    container.appendChild(card);
  });
}

// Inicialização automática
document.addEventListener('DOMContentLoaded', () => {
  const sessao = obterSessaoAtiva();
  if (sessao) {
    usuarioLogado = sessao;
    iniciarAppMobile();
  }
});




// Exportações Globais
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