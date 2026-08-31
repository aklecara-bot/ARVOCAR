// =========================================================================
// MÓDULO: OPERAÇÃO MOBILE DE ROTAS - ARVO
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

// =========================================================================
// SESSÃO E LOGIN
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
  const erroBox = document.getElementById('m-login-erro');
  const erroMsg = document.getElementById('m-login-erro-msg');

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
      window.location.href = "../../frontend/login.html";
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
// CARREGAMENTO DE DADOS
// =========================================================================
async function carregarDadosMobile() {
  try {
    const { data: dadosV, error: errV } = await db
      .from('veiculos')
      .select('*')
      .neq('status', 'Fora de Uso')
      .order('nome_frota');

    if (errV) throw errV;
    veiculos = dadosV || [];

    const { data: dadosR, error: errR } = await db
      .from('rotas')
      .select('*')
      .order('data_saida', { ascending: false });

    if (errR) throw errR;
    rotas = dadosR || [];

    renderizarOpcoesVeiculos();
    renderizarOpcoesRotasAtivas();
    renderizarHistoricoMobile();
    verificarRotasExcedidas12h();
  } catch (err) {
    console.error("Erro ao sincronizar dados:", err);
  }
}

// =========================================================================
// OPERAÇÃO DE ROTAS (INÍCIO / FIM)
// =========================================================================

// 1. RENDERIZAÇÃO DE VEÍCULOS DISPONÍVEIS COM SUPORTE A UUID E PLACA
function renderizarOpcoesVeiculos() {
  const select = document.getElementById('m-inicio-veiculo');
  if (!select) return;

  select.innerHTML = '<option value="">Selecione o veículo...</option>';

  veiculos
    .filter(v => v.status === 'Disponivel')
    .forEach(v => {
      select.innerHTML += `
        <option value="${v.placa}" data-uuid="${v.uuid_veiculos || ''}" data-placa="${v.placa}">
          ${v.placa} - ${v.nome_frota || ''} (${Number(v.km_atual || 0).toLocaleString('pt-BR')} km)
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

// 2. REGISTRO DE INÍCIO DE ROTA COM GRAVAÇÃO DA PLACA E UUID
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
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Iniciando...`;
  }

  // Validação segura de Reservas ativas
  const agoraTimestamp = new Date().getTime();
  const emailAtual = (usuarioLogado.email || '').toLowerCase().trim();

  try {
    let queryRes = db.from('reservas').select('*').eq('status', 'CONFIRMADA');
    if (uuidVeiculo) {
      queryRes = queryRes.eq('uuid_veiculos', uuidVeiculo);
    } else {
      queryRes = queryRes.eq('veiculo_id', veiculoId);
    }

    const { data: reservasCarro } = await queryRes;

    if (reservasCarro && reservasCarro.length > 0) {
      const temConflitoOutro = reservasCarro.some(res => {
        const dIni = new Date(res.data_inicio).getTime();
        const dFim = new Date(res.data_fim).getTime();
        const condutorReserva = (res.responsavel || '').toLowerCase().trim();
        return (agoraTimestamp >= dIni && agoraTimestamp <= dFim) && (condutorReserva !== emailAtual);
      });

      if (temConflitoOutro) {
        alert("⚠️ Este veículo está agendado e reservado para outro colaborador neste horário.");
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="ph-bold ph-key text-base"></i> Iniciar Rota`;
        }
        return;
      }
    }

    // Monta o payload incluindo uuid_veiculos e a placa física do momento
    const payloadRota = {
      veiculo_id: veiculoId,
      uuid_veiculos: uuidVeiculo || veiculo.uuid_veiculos,
      placa: placaVeiculo || veiculo.placa,
      responsavel: usuarioLogado.email,
      origem: origemFinal,
      finalidade: finalidade,
      km_saida: kmSaida,
      data_saida: new Date().toISOString(),
      status: 'Em Uso'
    };

    const { error: insertErr } = await db.from('rotas').insert([payloadRota]);
    if (insertErr) throw insertErr;

    // Atualiza status do veículo para 'Em Uso'
    let updateQuery = db.from('veiculos').update({ status: 'Em Uso' });
    if (uuidVeiculo) {
      updateQuery = updateQuery.eq('uuid_veiculos', uuidVeiculo);
    } else if (veiculo.nome_frota) {
      updateQuery = updateQuery.eq('nome_frota', veiculoId);
    } else {
      updateQuery = updateQuery.eq('id', veiculoId);
    }

    await updateQuery;

    alert(`✅ Rota iniciada com sucesso com o veículo ${veiculoId}!`);
    e.target.reset();
    toggleOutroOrigemMobile('');
    await carregarDadosMobile();
    switchMobileTab('finalizar');

  } catch (err) {
    console.error("Erro ao iniciar rota:", err);
    alert("Erro ao iniciar rota: " + (err.message || 'Verifique sua conexão.'));
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
      select.innerHTML += `<option value="${r.id}">${r.placa || 'Sem Placa'} - Saída: ${Number(r.km_saida).toLocaleString('pt-BR')} km</option>`;
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

  try {
    const payloadFim = {
      destino: destinoFinal,
      km_retorno: kmRetorno,
      km_total: kmTotal,
      data_retorno: new Date().toISOString(),
      status: 'Concluida',
      anomalia: anomaliaMarcada ? (relatorioAnomalia || 'Anomalia informada sem detalhes') : null
    };

    const { error: errRota } = await db
      .from('rotas')
      .update(payloadFim)
      .eq('id', rota.id);

    if (errRota) throw errRota;

    // Atualiza odômetro e libera o veículo
    let updateVeic = db.from('veiculos').update({
      km_atual: kmRetorno,
      status: 'Disponivel',
      anomalias: anomaliaMarcada ? relatorioAnomalia : null
    });

    if (rota.uuid_veiculos) {
      updateVeic = updateVeic.eq('uuid_veiculos', rota.uuid_veiculos);
    } else {
      updateVeic = updateVeic.eq('nome_frota', rota.veiculo_id);
    }

    await updateVeic;

    alert(`✅ Rota concluída com sucesso! Distância: ${kmTotal} km.`);
    e.target.reset();
    toggleOutroDestinoMobile('');
    toggleAnomaliaMobile(false);
    document.getElementById('m-detalhes-viagem')?.classList.add('hidden');
    await carregarDadosMobile();
    switchMobileTab('historico');

  } catch (err) {
    console.error("Erro ao finalizar rota:", err);
    alert("Erro ao finalizar rota: " + (err.message || 'Verifique sua conexão.'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-base"></i> Finalizar Rota`;
    }
  }
}

// =========================================================================
// HISTÓRICO E ALERTAS
// =========================================================================
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
    const dtRetornoFmt = r.data_retorno ? new Date(r.data_retorno).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

    card.innerHTML = `
  <div class="flex items-center justify-between">
    <span class="text-xs font-black text-slate-800 flex items-center gap-1.5 font-mono">
      <i class="ph-bold ph-car text-brand-600"></i> ${r.veiculo_id || 'Sem Placa'}
    </span>
    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isEmUso ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}">
      ${r.status}
    </span>
  </div>

  <div class="text-xs text-slate-700 font-medium flex items-center gap-1">
    <span>${r.origem}</span> &rarr; <span>${r.destino || '<em class="text-amber-600">Em trânsito</em>'}</span>
  </div>

  <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1.5 border-t border-slate-100">
    <span>Saída: ${dtSaidaFmt}</span>
    <span>${r.km_total ? `${r.km_total} km rodados` : `KM Inicial: ${r.km_saida}`}</span>
  </div>

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

// Verificador de rotas excedidas (> 12h)
async function verificarRotasExcedidas12h() {
  const sessao = obterSessaoAtiva();
  if (!sessao) return;

  const agora = new Date();

  rotas
    .filter(r => r.status === 'Em Uso' && (r.responsavel === sessao.email || sessao.email === "admin@arvo.tec.br"))
    .forEach(rota => {
      if (!rota.data_saida) return;
      const dataSaida = new Date(rota.data_saida);
      const diferencaHoras = (agora - dataSaida) / (1000 * 60 * 60);

      if (diferencaHoras >= 12) {
        exibirPopUpAlerta(rota, diferencaHoras);
      }
    });
}

function exibirPopUpAlerta(rota, horasAbertas) {
  const modalId = `modal-alerta-${rota.id}`;
  if (document.getElementById(modalId)) return;

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
        <p class="text-xs text-slate-500 mt-1">O veículo <b>${rota.veiculo_id}</b> (${rota.placa || '-'}) está com a rota aberta há mais de <b>${Math.floor(horasAbertas)} horas</b>.</p>
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="document.getElementById('${modalId}').remove()" class="flex-1 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl">Ignorar</button>
        <button onclick="document.getElementById('${modalId}').remove(); abrirFinalizacaoDiretaMobile('${rota.id}');" class="flex-1 py-2.5 bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md">Finalizar</button>
      </div>
    </div>
  `;
  document.body.appendChild(popUp);
}

// =========================================================================
// INICIALIZAÇÃO NO CARREGAMENTO DA PÁGINA
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const sessao = obterSessaoAtiva();
  if (sessao) {
    usuarioLogado = sessao;
    iniciarAppMobile();
  }
});

// Vínculos globais no window
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