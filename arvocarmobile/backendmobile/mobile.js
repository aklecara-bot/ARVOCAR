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

// Dicionário com coordenadas padrão das bases e municípios de operação
const COORDENADAS_BASES = {
  "BASE CENTRAL ALEGRE": { lat: -20.761921, lng: -41.533884 },
  "ALEGRE": { lat: -20.761921, lng: -41.533884 },
  "GUAÇUÍ": { lat: -20.770687, lng: -41.674244 },
  "CASTELO": { lat: -20.606867, lng: -41.204096 },
  "CELINA": { lat: -20.806500, lng: -41.558300 },
  "MUNIZ FREIRE": { lat: -20.463385, lng: -41.413571 },
  "LOCADORA CACHOEIRO": { lat: -20.858238, lng: -41.120567 },
  "CACHOEIRO": { lat: -20.848900, lng: -41.112800 },
  "LOCADORA CASTELO": { lat: -20.602361, lng: -41.212152 }
};

// Função para obter as coordenadas de partida (GPS instantâneo ou Base Fixa)
async function obterCoordenadasPartida(origemTexto) {
  if (navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 3000
        });
      });
      return {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        tipo: 'GPS_REAL'
      };
    } catch (e) {
      console.warn("GPS do aparelho indisponível no momento, recorrendo à base fixa:", e.message);
    }
  }

  const chave = (origemTexto || '').trim().toUpperCase();
  if (COORDENADAS_BASES[chave]) {
    return { ...COORDENADAS_BASES[chave], tipo: 'BASE_FIXA' };
  }

  return null;
}

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

  // --- AO ABRIR A ABA FINALIZAR ---
  if (tab === 'finalizar') {
    renderizarOpcoesRotasAtivas();

    const emailAtual = (usuarioLogado?.email || '').toLowerCase().trim();
    const ehAdmin = emailAtual === 'admin@arvo.tec.br' || emailAtual === 'admfin@arvo.tec.br';

    // Localiza a rota ativa (compatível com temp_ e offline)
    const rotaAberta = (rotas || []).find(r => 
      r.status === 'Em Uso' && 
      (ehAdmin || (r.responsavel && r.responsavel.toLowerCase().trim() === emailAtual))
    );

    if (rotaAberta) {
      const selectRota = document.getElementById('m-fim-rota-select');
      if (selectRota) {
        selectRota.value = rotaAberta.id;
        selecionarRotaFimMobile();
      }
      iniciarRastreamentoTempoRealMobile(rotaAberta);
    } else {
      const blocoMapa = document.getElementById('m-bloco-mapa-rota');
      const blocoForm = document.getElementById('m-bloco-formulario-fim');
      if (blocoMapa) blocoMapa.classList.add('hidden');
      if (blocoForm) blocoForm.classList.remove('hidden');
    }
  }

  if (tab === 'historico') {
    renderizarHistoricoMobile();
  }
}

function mostrarPopupCustom(tipo, titulo, mensagem, onClose = null) {
  const modalId = `app-modal-${Date.now()}`;

  const temas = {
    sucesso: { icon: 'ph-check-circle', bg: '#dcfce7', text: '#15803d', btn: '#15803d' },
    erro:    { icon: 'ph-x-circle',     bg: '#ffe4e6', text: '#e11d48', btn: '#e11d48' },
    aviso:   { icon: 'ph-warning',      bg: '#fef3c7', text: '#d97706', btn: '#d97706' },
    info:    { icon: 'ph-info',         bg: '#e0f2fe', text: '#0284c7', btn: '#0284c7' }
  };

  const config = temas[tipo] || temas.aviso;

  const backdrop = document.createElement('div');
  backdrop.id = modalId;
  backdrop.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background-color: rgba(15, 23, 42, 0.75) !important;
    backdrop-filter: blur(4px) !important;
    -webkit-backdrop-filter: blur(4px) !important;
    z-index: 999999 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 1rem !important;
    box-sizing: border-box !important;
  `;

  backdrop.innerHTML = `
    <div style="
      background-color: #ffffff !important;
      border-radius: 1.5rem !important;
      width: 100% !important;
      max-width: 24rem !important;
      padding: 1.5rem !important;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35) !important;
      border: 1px solid #f1f5f9 !important;
      text-align: center !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      gap: 1rem !important;
      box-sizing: border-box !important;
      font-family: inherit !important;
    ">
      <div style="
        width: 3.5rem !important;
        height: 3.5rem !important;
        border-radius: 1rem !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 1.75rem !important;
        background-color: ${config.bg} !important;
        color: ${config.text} !important;
      ">
        <i class="ph-bold ${config.icon}"></i>
      </div>

      <div style="width: 100% !important;">
        <h3 style="font-size: 1.05rem !important; font-weight: 900 !important; color: #0f172a !important; margin: 0 0 0.5rem 0 !important; line-height: 1.2 !important;">
          ${titulo}
        </h3>
        <p style="font-size: 0.8125rem !important; color: #475569 !important; margin: 0 !important; line-height: 1.45 !important; word-break: break-word !important;">
          ${mensagem}
        </p>
      </div>

      <button type="button" id="${modalId}-btn" style="
        width: 100% !important;
        padding: 0.75rem 1rem !important;
        border-radius: 0.75rem !important;
        font-weight: 700 !important;
        font-size: 0.8125rem !important;
        border: none !important;
        cursor: pointer !important;
        color: #ffffff !important;
        background-color: ${config.btn} !important;
        transition: opacity 0.2s ease !important;
      ">
        Entendido
      </button>
    </div>
  `;

  document.body.appendChild(backdrop);

  const fechar = () => {
    backdrop.remove();
    if (typeof onClose === 'function') onClose();
  };

  document.getElementById(`${modalId}-btn`).onclick = fechar;
  backdrop.onclick = (e) => {
    if (e.target === backdrop) fechar();
  };
}

window.alert = function (mensagem) {
  const texto = String(mensagem || '');
  let tipo = 'aviso';
  let titulo = 'Atenção';

  const t = texto.toLowerCase();
  if (t.includes('sucesso') || t.includes('confirmad') || t.includes('salvo')) {
    tipo = 'sucesso';
    titulo = 'Sucesso!';
  } else if (t.includes('erro') || t.includes('falha') || t.includes('inválid') || t.includes('restr')) {
    tipo = 'erro';
    titulo = 'Atenção!';
  }

  mostrarPopupCustom(tipo, titulo, texto);
};

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

  if (abastsCarro.length >= 2) {
    const deltaKm = Number(abastsCarro[0].km_atual) - Number(abastsCarro[1].km_atual);
    const litros = Number(abastsCarro[0].quantidade_litros);
    if (deltaKm > 0 && litros > 0) {
      const med = deltaKm / litros;
      if (med >= 3 && med <= 35) return Number(med.toFixed(2));
    }
  }

  const cUrb = Number(ehEtanol ? veiculo?.consumo_etanol_urbano : veiculo?.consumo_gasolina_urbano) || 0;
  const cRod = Number(ehEtanol ? veiculo?.consumo_etanol_rodoviario : veiculo?.consumo_gasolina_rodoviario) || 0;
  if (cUrb > 0 && cRod > 0) {
    return Number(((cUrb + cRod) / 2).toFixed(2));
  }

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

  const cMin = Number(veiculo?.consumo_min) || 10;
  const cMax = Number(veiculo?.consumo_max) || 14;
  let fallback = (cMin + cMax) / 2;
  if (ehEtanol) fallback *= 0.7;

  return Number(Math.max(3, fallback).toFixed(2));
}

// =========================================================================
// GOOGLE MAPS EM TEMPO REAL NO MOBILE
// =========================================================================
let gMapMobile = null;
let gPolylineMobile = null;
let gMarkerPosAtual = null;
let watchIdMobileGPS = null;
let coordenadasEmTempoReal = [];

function iniciarRastreamentoTempoRealMobile(rotaAtiva) {
  if (!rotaAtiva) return;

  const blocoMapa = document.getElementById('m-bloco-mapa-rota');
  const blocoForm = document.getElementById('m-bloco-formulario-fim');
  const containerMapa = document.getElementById('mapa-mobile-tempo-real');

  if (!blocoMapa || !containerMapa) return;

  // Mostra o card com o mapa e esconde o formulário
  blocoMapa.classList.remove('hidden');
  if (blocoForm) blocoForm.classList.add('hidden');

  const lblOrigem = document.getElementById('m-mapa-origem-txt');
  if (lblOrigem) lblOrigem.innerText = rotaAtiva.origem || 'Origem';

  // Recupera coordenadas salvas em cache para esta rota
  const chaveCache = `arvo_gps_rota_${rotaAtiva.id}`;
  try {
    const salvas = JSON.parse(localStorage.getItem(chaveCache) || '[]');
    coordenadasEmTempoReal = Array.isArray(salvas) ? salvas : [];
  } catch (e) {
    coordenadasEmTempoReal = [];
  }

  // Ponto inicial de centralização
  let pontoInicial = { lat: -20.761921, lng: -41.533884 }; // Alegre
  if (coordenadasEmTempoReal.length > 0) {
    pontoInicial = coordenadasEmTempoReal[coordenadasEmTempoReal.length - 1];
  } else if (rotaAtiva.coords_origem) {
    pontoInicial = rotaAtiva.coords_origem;
  } else if (COORDENADAS_BASES[(rotaAtiva.origem || '').toUpperCase()]) {
    pontoInicial = COORDENADAS_BASES[(rotaAtiva.origem || '').toUpperCase()];
  }

  // Renderiza a instância do Google Maps
  setTimeout(() => {
    if (typeof google !== 'undefined' && google.maps) {
      if (!gMapMobile) {
        gMapMobile = new google.maps.Map(containerMapa, {
          center: pontoInicial,
          zoom: 16,
          mapTypeId: 'roadmap',
          disableDefaultUI: true,
          zoomControl: true
        });

        gPolylineMobile = new google.maps.Polyline({
          path: coordenadasEmTempoReal,
          geodesic: true,
          strokeColor: '#D97706',
          strokeOpacity: 0.9,
          strokeWeight: 5,
          map: gMapMobile
        });

        gMarkerPosAtual = new google.maps.Marker({
          position: pontoInicial,
          map: gMapMobile,
          title: 'Posição Atual',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: '#1E5E3A',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          }
        });
      } else {
        google.maps.event.trigger(gMapMobile, 'resize');
        gMapMobile.setCenter(pontoInicial);
        if (gPolylineMobile) gPolylineMobile.setPath(coordenadasEmTempoReal);
        if (gMarkerPosAtual) gMarkerPosAtual.setPosition(pontoInicial);
      }
    }
  }, 100);

  // Monitoramento do GPS do aparelho
  if (navigator.geolocation && watchIdMobileGPS === null) {
    watchIdMobileGPS = navigator.geolocation.watchPosition(
      (pos) => {
        const novaCoord = {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          timestamp: new Date().toISOString()
        };

        coordenadasEmTempoReal.push(novaCoord);
        localStorage.setItem(chaveCache, JSON.stringify(coordenadasEmTempoReal));

        const ptsTxt = document.getElementById('m-mapa-pontos-txt');
        if (ptsTxt) ptsTxt.innerText = `${coordenadasEmTempoReal.length} pts registrados`;

        if (gPolylineMobile && gMapMobile) {
          const path = gPolylineMobile.getPath();
          const latLng = new google.maps.LatLng(novaCoord.lat, novaCoord.lng);
          path.push(latLng);
          if (gMarkerPosAtual) gMarkerPosAtual.setPosition(latLng);
          gMapMobile.panTo(latLng);
        }
      },
      (err) => console.warn("GPS em deslocamento:", err.message),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 }
    );
  }
}

function exibirFormularioDevolucaoMobile() {
  const blocoMapa = document.getElementById('m-bloco-mapa-rota');
  const blocoForm = document.getElementById('m-bloco-formulario-fim');
  if (blocoMapa) blocoMapa.classList.add('hidden');
  if (blocoForm) blocoForm.classList.remove('hidden');
}

function destruirMapaMobile(rotaId) {
  if (watchIdMobileGPS !== null) {
    navigator.geolocation.clearWatch(watchIdMobileGPS);
    watchIdMobileGPS = null;
  }
  const pontosFinais = [...coordenadasEmTempoReal];
  if (rotaId) localStorage.removeItem(`arvo_gps_rota_${rotaId}`);
  coordenadasEmTempoReal = [];
  gMapMobile = null;
  gPolylineMobile = null;
  gMarkerPosAtual = null;

  const blocoMapa = document.getElementById('m-bloco-mapa-rota');
  if (blocoMapa) blocoMapa.classList.add('hidden');

  return pontosFinais;
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
  const finalidade = document.getElementById('m-inicio-finalidade')?.value || 'DEMANDAS INTERNAS';
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
  const coordsPartida = await obterCoordenadasPartida(origemFinal);

  const payloadRota = {
    id: tempId,
    veiculo_id: veiculo.nome_frota || veiculoId,
    uuid_veiculos: uuidVeiculo || veiculo.uuid_veiculos || null,
    placa: placaVeiculo || veiculo.placa || null,
    responsavel: usuarioLogado.email,
    origem: origemFinal,
    finalidade: finalidade,
    km_saida: kmSaida,
    data_saida: dataSaidaAtual,
    status: 'Em Uso',
    offline_sync: !navigator.onLine,
    coords_origem: coordsPartida,
    coordenadas: coordsPartida ? [{ lat: coordsPartida.lat, lng: coordsPartida.lng, timestamp: dataSaidaAtual }] : []
  };

  // Inicia captura contínua de GPS
  iniciarRastreamentoGPS();

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
    } else if (veiculo.placa) {
      qVeic = qVeic.eq('placa', veiculo.placa);
    } else {
      qVeic = qVeic.eq('id', veiculo.id);
    }
    await qVeic;

    alert(`✅ Rota iniciada com sucesso com o veículo ${veiculo.nome_frota || veiculoId}!`);
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

function exibirFormularioDevolucaoMobile() {
  const blocoMapa = document.getElementById('m-bloco-mapa-rota');
  const blocoForm = document.getElementById('m-bloco-formulario-fim');
  if (blocoMapa) blocoMapa.classList.add('hidden');
  if (blocoForm) blocoForm.classList.remove('hidden');
}

// 3. FINALIZAÇÃO DA ROTA
async function handleMobileFimRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-confirmar-fim');
  const rotaId = document.getElementById('m-fim-rota-select')?.value;
  const rota = rotas.find(r => String(r.id) === String(rotaId));

  if (!rota) {
    alert("Selecione uma rota ativa.");
    return;
  }

  if (typeof destruirMapaMobile === 'function') {
    destruirMapaMobile(rota.id);
  }

  const pontosColetados = destruirMapaMobile();
  pararRastreamentoGPS();

  const coordenadasFinais = pontosColetados.length > 0 ? pontosColetados : (rota.coordenadas || []);

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

  const veiculoAlvo = veiculos.find(v =>
    (rota.uuid_veiculos && v.uuid_veiculos === rota.uuid_veiculos) ||
    String(v.id) === String(rota.veiculo_id) ||
    String(v.nome_frota) === String(rota.veiculo_id) ||
    (rota.placa && String(v.placa) === String(rota.placa))
  ) || {};

  let histAbast = [];
  try {
    histAbast = JSON.parse(localStorage.getItem('arvo_cache_abastecimentos') || '[]');
  } catch (err) {
    histAbast = [];
  }

  const medConsumo = obterMediaConsumoEsperada(veiculoAlvo, null, histAbast);
  const litrosConsumidos = kmTotal > 0 && medConsumo > 0
    ? Number((kmTotal / medConsumo).toFixed(2))
    : 0;

  const capTanque = Number(veiculoAlvo.tanque || 47);
  const tanqueAtual = (veiculoAlvo.tanque_virtual !== null && veiculoAlvo.tanque_virtual !== undefined)
    ? Number(veiculoAlvo.tanque_virtual)
    : capTanque;
  const novoTanqueVirtual = Number(Math.max(0, tanqueAtual - litrosConsumidos).toFixed(2));
  const dataRetornoIso = new Date().toISOString();

  const payloadFim = {
    rota_id: rota.id,
    destino: destinoFinal,
    km_retorno: kmRetorno,
    km_total: kmTotal,
    coordenadas: pontosColetados,
    consumo_litros: litrosConsumidos,
    data_retorno: dataRetornoIso,
    status: 'Concluida',
    anomalia: anomaliaMarcada ? (relatorioAnomalia || 'Anomalia sem detalhes') : null
  };

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

  try {
    const { error: errRota } = await db.from('rotas').update({
      destino: destinoFinal,
      km_retorno: kmRetorno,
      km_total: kmTotal,
      coordenadas: pontosColetados,
      consumo_litros: litrosConsumidos,
      data_retorno: payloadFim.data_retorno,
      status: 'Concluida',
      anomalia: payloadFim.anomalia
    }).eq('id', rota.id);

    if (errRota) throw errRota;

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

  for (let i = 0; i < fila.length; i++) {
    const item = fila[i];
    try {
      if (item.tipo === 'INICIO') {
        const payload = { ...item.payload };
        const tempId = payload.id;
        delete payload.id;
        delete payload.offline_sync;

        const { data: inserido, error: errInsert } = await db
          .from('rotas')
          .insert([payload])
          .select('id');

        if (errInsert) throw errInsert;

        const idRealCriado = (inserido && inserido[0]) ? inserido[0].id : null;

        const identificador = payload.placa || payload.veiculo_id;
        let qVeic = db.from('veiculos').update({ status: 'Em Uso' });
        if (payload.placa) {
          qVeic = qVeic.eq('placa', payload.placa);
        } else {
          qVeic = qVeic.or(`nome_frota.eq.${payload.veiculo_id},id.eq.${payload.veiculo_id}`);
        }
        await qVeic;

        if (idRealCriado && tempId) {
          fila.forEach(outroItem => {
            if (outroItem.tipo === 'FIM' && String(outroItem.payload?.rota_id) === String(tempId)) {
              outroItem.payload.rota_id = idRealCriado;
            }
          });
        }

      } else if (item.tipo === 'FIM') {
        const { rota_id, ...dadosFim } = item.payload;

        if (String(rota_id).startsWith('temp_')) {
          itensRestantes.push(item);
          continue;
        }

        const { error: errFim } = await db
          .from('rotas')
          .update(dadosFim)
          .eq('id', rota_id);

        if (errFim) throw errFim;

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

  localStorage.setItem('arvo_sync_rotas_queue', JSON.stringify(itensRestantes));

  if (itensRestantes.length === 0) {
    console.log("-> Sincronização offline concluída com sucesso!");
    await carregarDadosMobile();
  }
}

window.addEventListener('online', sincronizarFilaRotas);

function aoMudarVeiculoMobile(valor) {
  atualizarKmVeiculoMobile();
  renderPreviewCardCarroMobile(valor);
}

function renderPreviewCardCarroMobile(veiculoId) {
  const container = document.getElementById('m-preview-card-carro');
  if (!container) return;

  const selectElem = document.getElementById('m-inicio-veiculo');
  const optSelecionada = selectElem ? selectElem.options[selectElem.selectedIndex] : null;
  const uuidVeiculo = optSelecionada?.dataset?.uuid || null;
  const placaVeiculo = optSelecionada?.dataset?.placa || null;

  const veiculo = (veiculos || []).find(v =>
    (uuidVeiculo && String(v.uuid_veiculos) === String(uuidVeiculo)) ||
    (placaVeiculo && String(v.placa) === String(placaVeiculo)) ||
    String(v.nome_frota) === String(veiculoId) ||
    String(v.id) === String(veiculoId)
  );

  if (!veiculo) {
    container.innerHTML = `
      <div class="border-2 border-dashed border-slate-700/60 rounded-3xl p-5 text-center text-slate-400 text-xs font-medium bg-[#111827]/40">
        Selecione um veículo acima para visualizar telemetria, tanque e status operacional.
      </div>
    `;
    return;
  }

  const isEmUso = veiculo.status === 'Em Uso';
  const isExterno = (veiculo.tipo_frota || '').toUpperCase() === 'EXTERNO';
  const nomeVeiculo = veiculo.nome_frota || veiculo.id || 'Veículo';
  const capTanque = Number(veiculo.tanque || 47);
  const litrosAtuais = Number(veiculo.tanque_virtual !== null && veiculo.tanque_virtual !== undefined ? veiculo.tanque_virtual : capTanque);

  let segmentosHTML = '';
  if (!isExterno) {
    const totalSegmentos = 16;
    const proporcao = Math.max(0, Math.min(1, capTanque > 0 ? (litrosAtuais / capTanque) : 1));
    const segmentosCheios = Math.round(proporcao * totalSegmentos);

    for (let i = totalSegmentos; i >= 1; i--) {
      const estaCheio = i <= segmentosCheios;
      let cor = 'bg-slate-800';
      if (estaCheio) {
        if (i <= 2) cor = 'bg-rose-600 shadow-sm';
        else if (i <= 6) cor = 'bg-amber-500';
        else cor = 'bg-emerald-400';
      }
      segmentosHTML += `<div class="h-1 rounded-xs ${cor}"></div>`;
    }
  }

  const estiloCardMobile = isEmUso
    ? "background: rgba(234, 88, 12, 0.70); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1.5px solid rgba(254, 215, 170, 0.6); box-shadow: 0 10px 25px rgba(234, 88, 12, 0.35);"
    : "background: linear-gradient(180deg, #182230 0%, #0f172a 100%); border: 1px solid rgba(255,255,255,0.1);";

  const ref = `${veiculo.nome_frota || ''} ${veiculo.marca || ''}`.toUpperCase();
  let imgUrl = '/imagens/mobi.png';
  if (ref.includes('COMPASS') || ref.includes('JEEP')) imgUrl = '/imagens/jeepcomp.png';
  else if (ref.includes('GOL')) imgUrl = '/imagens/gol.png';
  else if (ref.includes('COROLLA')) imgUrl = '/imagens/corolla.png';

  container.innerHTML = `
    <div class="relative rounded-3xl p-5 shadow-2xl text-white overflow-hidden w-full transition-all duration-300"
         style="${estiloCardMobile}">
      
      <div class="flex justify-between items-start mb-2">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              isEmUso 
                ? 'bg-amber-900/60 text-amber-200 border border-amber-300/50 animate-pulse' 
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
            }">
              ● ${isEmUso ? 'Em Rota' : 'Disponível'}
            </span>
            <span class="text-[10px] font-bold ${isExterno ? 'bg-indigo-600 text-white' : 'bg-slate-900/80 text-slate-300 border border-white/10'} px-1.5 py-0.5 rounded">
              ${isExterno ? 'EXTERNO' : 'FROTA'}
            </span>
          </div>
          <h3 class="text-lg font-black text-white leading-tight">${nomeVeiculo}</h3>
          <p class="text-[11px] text-slate-200">${veiculo.marca || '-'}</p>
          <span class="inline-block font-mono text-xs bg-black/40 border border-white/20 px-2 py-0.5 rounded font-bold text-slate-100">
            ${veiculo.placa || 'S/ PLACA'}
          </span>
        </div>

        <div class="w-20 h-14 flex items-center justify-end">
          <img src="${imgUrl}" alt="${nomeVeiculo}" class="max-h-12 max-w-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]" onerror="this.src='/imagens/mobi.png';" />
        </div>
      </div>

      <div class="bg-[#141211]/80 backdrop-blur-md rounded-2xl p-3.5 border border-white/10 my-2">
        <div class="flex justify-between items-baseline">
          <span class="text-[10px] text-slate-300 uppercase font-bold tracking-wider">Hodômetro Registrado:</span>
          <span class="font-mono font-black text-white text-base">${Number(veiculo.km_atual || 0).toLocaleString('pt-BR')} km</span>
        </div>
        <div class="flex justify-between items-baseline mt-1 pt-1 border-t border-white/10 text-xs text-slate-300">
          <span>Nível do Tanque:</span>
          <span class="font-mono font-bold ${isEmUso ? 'text-amber-200' : 'text-emerald-400'}">${Math.round(litrosAtuais)}/${capTanque} L</span>
        </div>
      </div>
    </div>
  `;
}

// =========================================================================
// HISTÓRICO DE ROTAS
// =========================================================================
let categoriaFiltroMobile = 'todas';

function setFiltroCategoriaMobile(categoria) {
  categoriaFiltroMobile = categoria;

  const botoes = {
    'todas': document.getElementById('btn-cat-todas'),
    'avarias': document.getElementById('btn-cat-avarias'),
    'concluidas': document.getElementById('btn-cat-concluidas')
  };

  Object.keys(botoes).forEach(k => {
    if (botoes[k]) {
      if (k === categoria) {
        botoes[k].className = "bg-[#1E5E3A] text-white font-bold px-3 py-1.5 rounded-xl whitespace-nowrap shadow-xs";
      } else {
        botoes[k].className = "bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap";
      }
    }
  });

  renderizarHistoricoMobile();
}

function filtrarHistoricoMobile() {
  renderizarHistoricoMobile();
}

function renderizarHistoricoMobile() {
  const container = document.getElementById('m-lista-historico');
  if (!container) return;

  const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  let emailUsuario = '';
  try {
    emailUsuario = (JSON.parse(rawSessao)?.email || rawSessao || '').toLowerCase().trim();
  } catch (e) {
    emailUsuario = String(rawSessao || '').toLowerCase().trim();
  }

  const ehAdmin = emailUsuario === 'admin@arvo.tec.br' || emailUsuario === 'admfin@arvo.tec.br';
  const todasRotas = Array.isArray(rotas) ? rotas : [];

  const rotasPermitidas = todasRotas.filter(r => {
    if (ehAdmin) return true;
    return (r.responsavel || '').toLowerCase().trim() === emailUsuario;
  });

  const totalRotas = rotasPermitidas.length;
  const totalComAvarias = rotasPermitidas.filter(r => r.anomalia && r.anomalia.trim() !== '').length;

  const countTodasEl = document.getElementById('m-count-todas');
  const countAvariasEl = document.getElementById('m-count-avarias');
  if (countTodasEl) countTodasEl.innerText = totalRotas;
  if (countAvariasEl) countAvariasEl.innerText = totalComAvarias;

  const termoBusca = (document.getElementById('filtro-busca-historico')?.value || '').toLowerCase().trim();

  const rotasFiltradas = rotasPermitidas.filter(r => {
    const isConcluida = r.status !== 'Em Uso' && (r.status === 'Concluida' || r.status === 'CONCLUIDA' || r.data_retorno);
    const temAvaria = Boolean(r.anomalia && r.anomalia.trim() !== '');

    if (typeof categoriaFiltroMobile !== 'undefined') {
      if (categoriaFiltroMobile === 'avarias' && !temAvaria) return false;
      if (categoriaFiltroMobile === 'concluidas' && !isConcluida) return false;
    }

    if (termoBusca) {
      const textoParaBusca = `${r.veiculo_id || ''} ${r.nome_frota || ''} ${r.placa || ''} ${r.responsavel || ''} ${r.origem || ''} ${r.destino || ''} ${r.finalidade || ''}`.toLowerCase();
      if (!textoParaBusca.includes(termoBusca)) return false;
    }

    return true;
  });

  if (rotasFiltradas.length === 0) {
    container.innerHTML = `
      <div class="bg-[#FAF7F2] rounded-3xl p-6 text-center text-slate-500 text-xs font-semibold border border-[#EFE9DF]">
        Nenhuma rota encontrada para os filtros selecionados.
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  rotasFiltradas.forEach(r => {
    const isEmUso = r.status === 'Em Uso';
    const temAvaria = Boolean(r.anomalia && r.anomalia.trim() !== '');
    
    let condutorNome = r.responsavel || 'Condutor';
    if (typeof usuarios !== 'undefined' && Array.isArray(usuarios)) {
      const u = usuarios.find(user => (user.email || '').toLowerCase().trim() === (r.responsavel || '').toLowerCase().trim());
      if (u?.nome) condutorNome = u.nome;
    }

    const kmTotalNum = Number(r.km_total || 0);
    const kmPartes = kmTotalNum.toFixed(1).split('.');
    const tripMain = kmPartes[0];
    const tripDec = '.' + kmPartes[1];

    let tempoFormatado = '--h --m';
    if (r.data_saida && r.data_retorno) {
      const diffMs = Math.max(0, new Date(r.data_retorno).getTime() - new Date(r.data_saida).getTime());
      const horas = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      tempoFormatado = `${String(horas).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
    } else if (r.data_saida) {
      const diffMs = Math.max(0, new Date().getTime() - new Date(r.data_saida).getTime());
      const horas = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      tempoFormatado = `${String(horas).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m`;
    }

    const formatarDiaMes = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const dInicio = formatarDiaMes(r.data_saida);
    const dFim = formatarDiaMes(r.data_retorno);
    const periodoDatas = dFim ? `${dInicio} - ${dFim}` : `${dInicio} (Em trânsito)`;

    const estiloCard = isEmUso 
      ? 'background: rgba(234, 88, 12, 0.70); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1.5px solid rgba(254, 215, 170, 0.6); box-shadow: 0 10px 25px rgba(234, 88, 12, 0.35);'
      : '';
    const classeCard = isEmUso
      ? 'card-item rounded-3xl p-4 shadow-xl text-white space-y-3'
      : 'card-item bg-[#FAF7F2] rounded-3xl p-4 shadow-xl border border-[#EFE9DF] text-slate-800 space-y-3';

    const card = document.createElement('div');
    card.className = classeCard;
    if (estiloCard) card.setAttribute('style', estiloCard);

    card.innerHTML = `
      <div class="flex items-start justify-between pb-2 border-b ${isEmUso ? 'border-white/20' : 'border-[#EAE3D6]'}">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl ${isEmUso ? 'bg-black/30 border border-white/30 text-white' : 'bg-emerald-50 border border-emerald-200/80 text-[#1E5E3A]'} flex items-center justify-center shadow-inner font-bold">
            <i class="ph-bold ph-car-profile text-lg"></i>
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="font-black text-sm ${isEmUso ? 'text-white' : 'text-slate-900'} leading-tight">${r.nome_frota || r.veiculo_id || 'ARVO'}</span>
              <span class="text-[10px] font-mono font-bold ${isEmUso ? 'bg-black/40 text-amber-200 border border-white/10' : 'bg-[#EDE7DC] text-slate-500'} px-1.5 py-0.5 rounded">#${r.id}</span>
            </div>
            <span class="text-[11px] ${isEmUso ? 'text-orange-100' : 'text-slate-500'} font-medium block leading-tight">${condutorNome}</span>
          </div>
        </div>

        <div class="flex flex-col items-end gap-1">
          <div class="placa-mercosul-sm">
            <div class="placa-mercosul-sm-header"></div>
            <span class="placa-mercosul-sm-txt">${r.placa || 'ARVO-CAR'}</span>
          </div>
          <span class="text-[9px] font-bold uppercase tracking-wider font-mono ${isEmUso ? 'text-amber-200 animate-pulse' : 'text-emerald-800'}">
            ● ${isEmUso ? 'EM USO' : 'CONCLUÍDA'}
          </span>
        </div>
      </div>

      <div class="${isEmUso ? 'bg-black/30 border-white/20' : 'bg-white/90 border-[#E5DFD3]'} rounded-2xl p-3 border shadow-xs space-y-2.5">
        <div class="flex items-center justify-between gap-3">
          
          <div class="flex items-center gap-2.5 flex-1 min-w-0">
            <div class="flex flex-col items-center shrink-0">
              <span class="w-2.5 h-2.5 rounded-full border-2 ${isEmUso ? 'border-amber-300 bg-black/40' : 'border-[#1E5E3A] bg-white'}"></span>
              <span class="w-0.5 h-3 ${isEmUso ? 'bg-white/40' : 'bg-slate-300'}"></span>
              <span class="w-2.5 h-2.5 rounded-full ${isEmUso ? 'bg-amber-300' : 'bg-[#1E5E3A]'}"></span>
            </div>
            
            <div class="flex flex-col text-xs leading-tight font-semibold ${isEmUso ? 'text-white' : 'text-slate-800'} truncate">
              <span class="truncate">${r.origem || 'Base'}</span>
              <span class="text-[9px] ${isEmUso ? 'text-orange-200' : 'text-slate-400'} font-normal">Destino</span>
              <span class="font-bold ${isEmUso ? 'text-white' : 'text-slate-900'} truncate">${r.destino || 'Em trânsito...'}</span>
            </div>
          </div>

          <div class="trip-computer" title="Distância Percorrida">
            <div class="trip-header">
              <span class="trip-tag">VIAGEM</span>
              <i class="ph-bold ph-gauge text-[9px] text-slate-400"></i>
            </div>
            <div class="trip-digits">
              <span class="trip-main">${tripMain}</span>
              <span class="trip-dec">${tripDec}</span>
              <span class="trip-unit">km</span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between pt-2 border-t ${isEmUso ? 'border-white/15' : 'border-slate-100'} text-[11px] gap-2">
          <span class="${isEmUso ? 'bg-black/40 text-orange-100 border border-white/10' : 'bg-[#F1ECE1] text-slate-700'} font-semibold px-2 py-0.5 rounded-md truncate max-w-[130px]">
            ${r.finalidade || 'Demandas Internas'}
          </span>

          <div class="flex flex-col items-end shrink-0">
            <div class="visor-digital" title="Duração da Rota">
              <i class="ph-bold ph-timer text-emerald-400 text-xs"></i>
              <span class="visor-digital-txt">${tempoFormatado}</span>
            </div>
            <span class="font-mono ${isEmUso ? 'text-orange-200' : 'text-slate-500'} font-medium text-[10px] mt-1">
              ${periodoDatas}
            </span>
          </div>
        </div>
      </div>

      ${temAvaria ? `
        <div class="${isEmUso ? 'bg-rose-950/70 border-rose-400/50 text-rose-100' : 'bg-rose-50 border-rose-200 text-xs'} border rounded-xl p-2.5 flex items-start gap-2">
          <i class="ph-bold ph-warning-circle ${isEmUso ? 'text-rose-300' : 'text-rose-600'} text-base shrink-0 mt-0.5"></i>
          <div>
            <span class="font-bold ${isEmUso ? 'text-rose-200' : 'text-rose-800'} block text-[11px]">Anomalia Registrada:</span>
            <p class="${isEmUso ? 'text-rose-100' : 'text-rose-700'} font-medium text-[11px] leading-tight mt-0.5">${r.anomalia}</p>
          </div>
        </div>
      ` : `
        <div class="flex items-center gap-1.5 text-[11px] ${isEmUso ? 'text-emerald-300' : 'text-emerald-700'} font-bold px-1">
          <i class="ph-bold ph-check-circle ${isEmUso ? 'text-emerald-300' : 'text-emerald-600'}"></i>
          <span>Sem anomalias registradas</span>
        </div>
      `}
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
        exibirPopUpAlerta(rota, diferencaHoras);
      }
    });
}

function exibirPopUpAlerta(rota, horasAbertas) {
  if (!rota || !rota.id) return;
  const modalId = `modal-alerta-${rota.id}`;

  const modalAntigo = document.getElementById(modalId);
  if (modalAntigo) modalAntigo.remove();

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
// GEOLOCALIZAÇÃO
// =========================================================================
let watchIdGps = null;
let pontosRotaAtual = [];

function iniciarRastreamentoGPS() {
  pontosRotaAtual = [];
  if (!navigator.geolocation) {
    console.warn("Geolocalização não suportada no aparelho.");
    return;
  }

  watchIdGps = navigator.geolocation.watchPosition(
    (pos) => {
      const ponto = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        timestamp: new Date().toISOString()
      };
      pontosRotaAtual.push(ponto);
      localStorage.setItem('arvo_gps_temp', JSON.stringify(pontosRotaAtual));
    },
    (err) => console.warn("Erro ao capturar GPS:", err.message),
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000
    }
  );
}

function pararRastreamentoGPS() {
  if (watchIdGps !== null) {
    navigator.geolocation.clearWatch(watchIdGps);
    watchIdGps = null;
  }
  const rotaGravada = [...pontosRotaAtual];
  localStorage.removeItem('arvo_gps_temp');
  pontosRotaAtual = [];
  return rotaGravada;
}

// =========================================================================
// INICIALIZAÇÃO NO DOM E EXPORTAÇÃO GLOBAL
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
  const sessao = obterSessaoAtiva();
  if (sessao) {
    usuarioLogado = sessao;
    iniciarAppMobile();

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
window.aoMudarVeiculoMobile = aoMudarVeiculoMobile;
window.setFiltroCategoriaMobile = setFiltroCategoriaMobile;
window.filtrarHistoricoMobile = filtrarHistoricoMobile;
window.exibirFormularioDevolucaoMobile = exibirFormularioDevolucaoMobile;