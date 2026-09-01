// =========================================================================
// MÓDULO: OPERAÇÃO MOBILE DE ROTAS - SUPORTE OFFLINE ARVO
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

let usuarioLogado = null;
let veiculos = [];
let rotas = [];

// =========================================================================
// SESSÃO E FILA LOCAL (OFFLINE QUEUE)
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
    // Se offline, tenta autenticar com a última sessão local
    if (!navigator.onLine) {
      const sessaoLocal = obterSessaoAtiva();
      if (sessaoLocal && sessaoLocal.email === email) {
        usuarioLogado = sessaoLocal;
        iniciarAppMobile();
        return;
      }
      throw new Error("Sem conexão com a internet para validar novo login.");
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
  // 1. Tenta carregar do Cache Local primeiro
  const veiculosCache = localStorage.getItem('arvo_cache_veiculos');
  const rotasCache = localStorage.getItem('arvo_cache_rotas');

  if (veiculosCache) veiculos = JSON.parse(veiculosCache);
  if (rotasCache) rotas = JSON.parse(rotasCache);

  renderizarOpcoesVeiculos();
  renderizarOpcoesRotasAtivas();
  renderizarHistoricoMobile();

  // 2. Se houver internet, atualiza os dados do Supabase
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
        rotas = dadosR;
        localStorage.setItem('arvo_cache_rotas', JSON.stringify(dadosR));
        renderizarOpcoesRotasAtivas();
        renderizarHistoricoMobile();
      }
    } catch (err) {
      console.warn("Modo offline ativo: usando dados em cache.");
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

  const veiculo = veiculos.find(v => (uuidVeiculo && v.uuid_veiculos === uuidVeiculo) || (v.nome_frota === veiculoId || v.id === veiculoId));

  if (!veiculo || !usuarioLogado) {
    alert("Selecione um veículo disponível.");
    return;
  }

  const selectOrigem = document.getElementById('m-inicio-origem')?.value;
  const outroOrigem = document.getElementById('m-inicio-origem-outro')?.value?.trim();
  const origemFinal = selectOrigem === 'OUTRO' ? outroOrigem : selectOrigem;
  const finalidade = document.getElementById('res-finalidade')?.value;
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

  // Se estiver sem internet, enfileira localmente
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

    const { data: inserido, error: insertErr } = await db.from('rotas').insert([payloadRota]).select().single();
    if (insertErr) throw insertErr;

    await db.from('veiculos').update({ status: 'Em Uso' }).eq('id', veiculo.id);

    alert(`✅ Rota iniciada com sucesso!`);
    e.target.reset();
    toggleOutroOrigemMobile('');
    await carregarDadosMobile();
    switchMobileTab('finalizar');
  } catch (err) {
    console.warn("Falha de envio, salvando na fila offline:", err);
    payloadRota.id = tempId;
    salvarNaFilaRotas({ tipo: 'INICIO', payload: payloadRota });
    rotas.unshift(payloadRota);
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
  const payloadFim = {
    rota_id: rota.id,
    destino: destinoFinal,
    km_retorno: kmRetorno,
    km_total: kmTotal,
    data_retorno: new Date().toISOString(),
    status: 'Concluida',
    anomalia: anomaliaMarcada ? (relatorioAnomalia || 'Anomalia sem detalhes') : null
  };

  // Modo offline para finalização
  if (!navigator.onLine || String(rota.id).startsWith('temp_')) {
    salvarNaFilaRotas({ tipo: 'FIM', payload: payloadFim });
    rota.status = 'Concluida';
    rota.km_total = kmTotal;
    rota.data_retorno = payloadFim.data_retorno;
    const v = veiculos.find(ve => ve.nome_frota === rota.veiculo_id || ve.id === rota.veiculo_id);
    if (v) {
      v.km_atual = kmRetorno;
      v.status = 'Disponivel';
    }
    salvarCachesLocais();
    alert(`📶 Rota encerrada Offline! Será sincronizada quando o sinal retornar.`);
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
    const { error: errRota } = await db.from('rotas').update(payloadFim).eq('id', rota.id);
    if (errRota) throw errRota;

    await db.from('veiculos').update({ km_atual: kmRetorno, status: 'Disponivel' }).eq('id', rota.veiculo_id);

    alert(`✅ Rota concluída com sucesso! Distância: ${kmTotal} km.`);
    e.target.reset();
    toggleOutroDestinoMobile('');
    toggleAnomaliaMobile(false);
    await carregarDadosMobile();
    switchMobileTab('historico');
  } catch (err) {
    console.warn("Salvando encerramento na fila offline:", err);
    salvarNaFilaRotas({ tipo: 'FIM', payload: payloadFim });
    rota.status = 'Concluida';
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

  console.log(`-> Sincronizando ${fila.length} itens pendentes de rotas...`);
  const itensRestantes = [];

  for (const item of fila) {
    try {
      if (item.tipo === 'INICIO') {
        const payload = { ...item.payload };
        delete payload.id;
        delete payload.offline_sync;
        await db.from('rotas').insert([payload]);
        await db.from('veiculos').update({ status: 'Em Uso' }).eq('id', payload.veiculo_id);
      } else if (item.tipo === 'FIM') {
        const { rota_id, ...dadosFim } = item.payload;
        if (!String(rota_id).startsWith('temp_')) {
          await db.from('rotas').update(dadosFim).eq('id', rota_id);
        }
      }
    } catch (e) {
      console.error("Falha ao sincronizar item:", item, e);
      itensRestantes.push(item);
    }
  }

  localStorage.setItem('arvo_sync_rotas_queue', JSON.stringify(itensRestantes));
  if (itensRestantes.length === 0) {
    console.log("-> Sincronização concluída com sucesso!");
    await carregarDadosMobile();
  }
}

// Monitora volta da conexão
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

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  const sessao = obterSessaoAtiva();
  if (sessao) {
    usuarioLogado = sessao;
    iniciarAppMobile();
  }
});

// Bindings Globais
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