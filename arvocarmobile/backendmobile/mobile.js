// =========================================================================
// MÓDULO: OPERAÇÃO MOBILE DE ROTAS - ARVO (INTEGRAL COM SUPORTE OFFLINE,
// TELEMETRIA AVANÇADA, CONSUMO VIRTUAL, AUDITORIA E RECUPERAÇÃO VIA CNH)
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

// Instanciação segura do cliente Supabase
const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

const ADMIN_EMAIL = "admin@arvo.tec.br";
const FIN_ADMIN_EMAIL = "admfin@arvo.tec.br";
const DEV_ADMIN_EMAIL = "desv@arvo.tec.br";
const DAYANE_ADMIN_EMAIL = "dayane@arvo.tec.br";

const ADMINS_MASTERS = [
  ADMIN_EMAIL.toLowerCase(),
  DEV_ADMIN_EMAIL.toLowerCase(),
  DAYANE_ADMIN_EMAIL.toLowerCase()
];

const GESTORES_EMAILS = [
  ADMIN_EMAIL.toLowerCase(),
  FIN_ADMIN_EMAIL.toLowerCase(),
  DEV_ADMIN_EMAIL.toLowerCase(),
  DAYANE_ADMIN_EMAIL.toLowerCase()
];

const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str || ''));

let usuarioLogado = null;
let veiculos = [];
let rotas = [];
let usuarios = [];
let listaModelosReferencia = [];

// Dicionário com coordenadas padrão das bases e municípios de operação 1
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

// =========================================================================
// HELPER: FORMATAÇÃO DO NOME DO MOTORISTA (SEM RECORTE DE E-MAIL)
// =========================================================================
function obterNomeMotoristaFormatado(identificador) {
  if (!identificador) return 'Condutor';
  const idLimpo = String(identificador).toLowerCase().trim();

  if (Array.isArray(usuarios) && usuarios.length > 0) {
    const u = usuarios.find(user =>
      (user.email || '').toLowerCase().trim() === idLimpo ||
      String(user.id).trim() === idLimpo
    );
    if (u && u.nome && u.nome.trim() !== '') {
      return u.nome.trim();
    }
  }

  if (usuarioLogado && (usuarioLogado.email || '').toLowerCase().trim() === idLimpo) {
    if (usuarioLogado.nome && !usuarioLogado.nome.includes('@')) {
      return usuarioLogado.nome;
    }
  }

  const prefixo = idLimpo.includes('@') ? idLimpo.split('@')[0] : idLimpo;
  return prefixo
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ');
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

    // 1. Autenticação nativa oficial no GoTrue / Supabase Auth
    const { data: authData, error: authError } = await db.auth.signInWithPassword({
      email: email,
      password: senha
    });

    if (authError) throw authError;

    // 2. Busca perfil cadastral complementar
    const { data: perfilData, error: perfilError } = await db
      .from('usuarios')
      .select('id, nome, email, cnh, status, perfil')
      .eq('email', email)
      .maybeSingle();

    if (perfilError) throw perfilError;

    if (perfilData && perfilData.status && perfilData.status.toLowerCase() === 'inativo') {
      await db.auth.signOut();
      throw new Error("Usuário inativo no sistema.");
    }

    usuarioLogado = {
      id: perfilData?.id || authData.user.id,
      auth_id: authData.user.id,
      nome: perfilData?.nome || email.split('@')[0],
      email: authData.user.email,
      cnh: perfilData?.cnh || '',
      cargo: perfilData?.perfil || 'Condutor'
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
    if (db && db.auth) db.auth.signOut();
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
    const nomeExibicao = obterNomeMotoristaFormatado(usuarioLogado.email);
    topUsername.innerText = `${nomeExibicao} (${usuarioLogado.email})`;
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

  if (tab === 'finalizar') {
    renderizarOpcoesRotasAtivas();

    const emailAtual = (usuarioLogado?.email || '').toLowerCase().trim();
    const ehAdmin = GESTORES_EMAILS.includes(emailAtual);

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
    if (typeof atualizarKpisMotoristaMobile === 'function') {
      atualizarKpisMotoristaMobile();
    }
  }
}

// =========================================================================
// CARREGAMENTO DE DADOS COM CACHE LOCAL
// =========================================================================
async function carregarDadosMobile() {
  const veiculosCache = localStorage.getItem('arvo_cache_veiculos');
  const rotasCache = localStorage.getItem('arvo_cache_rotas');
  const usersCache = localStorage.getItem('arvo_cache_usuarios');

  if (veiculosCache) try { veiculos = JSON.parse(veiculosCache); } catch(e){}
  if (rotasCache) try { rotas = JSON.parse(rotasCache); } catch(e){}
  if (usersCache) try { usuarios = JSON.parse(usersCache); } catch(e){}

  renderizarOpcoesVeiculos();
  renderizarOpcoesRotasAtivas();
  renderizarHistoricoMobile();
  atualizarKpisMotoristaMobile();

  if (navigator.onLine) {
    try {
      const [resV, resR, resU, resRef] = await Promise.all([
        db.from('veiculos').select('*').neq('status', 'Fora de Uso').order('nome_frota'),
        db.from('rotas').select('*').order('data_saida', { ascending: false }),
        db.from('usuarios').select('id, nome, email, cnh, perfil'),
        db.from('modelos_referencia').select('*')
      ]);

      if (resV.data) {
        veiculos = resV.data;
        localStorage.setItem('arvo_cache_veiculos', JSON.stringify(resV.data));
      }
      if (resR.data) {
        rotas = resR.data;
        localStorage.setItem('arvo_cache_rotas', JSON.stringify(resR.data));
      }
      if (resU.data) {
        usuarios = resU.data;
        localStorage.setItem('arvo_cache_usuarios', JSON.stringify(resU.data));
      }
      if (resRef.data) {
        listaModelosReferencia = resRef.data;
      }

      renderizarOpcoesVeiculos();
      renderizarOpcoesRotasAtivas();
      renderizarHistoricoMobile();
      atualizarKpisMotoristaMobile();
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

  const cMin = Number(veiculo?.consumo_min) || 10;
  const cMax = Number(veiculo?.consumo_max) || 14;
  let fallback = (cMin + cMax) / 2;
  if (ehEtanol) fallback *= 0.7;

  return Number(Math.max(3, fallback).toFixed(2));
}

// =========================================================================
// SISTEMA DE GEOLOCALIZAÇÃO TEMPORIZADA & AUDITORIA DE PARADA
// =========================================================================
let wakeLock = null;
let watchIdGps = null;
let coordenadasEmTempoReal = [];
let ultimoPontoRegistrado = null;
let ultimoTimestampSalvo = 0;
let idRotaRastreamentoAtiva = null;

let acumuladorTempoMovimentoSegundos = 0;
let acumuladorTempoParadoSegundos = 0;
let ultimoInstanteGpsCalculado = null;

const INTERVALO_LEITURA_MS = 3 * 60 * 1000;
const DISTANCIA_MINIMA_METROS = 50;

async function manterTelaAtiva() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (err) {}
}

function liberarTelaAtiva() {
  if (wakeLock !== null) {
    wakeLock.release().then(() => { wakeLock = null; });
  }
}

function calcularDistanciaMetros(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function solicitarPermissaoGPSObrigatoria() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error("Seu dispositivo não possui sensor de GPS suportado."));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(new Error("A permissão de localização (GPS) é indispensável para auditar o trajeto e iniciar a rota.")),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

function iniciarRastreamentoIntervaladoGPS(rotaId) {
  if (!navigator.geolocation) return;

  idRotaRastreamentoAtiva = rotaId;
  const chaveCache = `arvo_gps_rota_${rotaId}`;

  try {
    const existentes = JSON.parse(localStorage.getItem(chaveCache) || '[]');
    coordenadasEmTempoReal = Array.isArray(existentes) ? existentes : [];
  } catch (e) {
    coordenadasEmTempoReal = [];
  }

  if (coordenadasEmTempoReal.length > 0) {
    ultimoPontoRegistrado = coordenadasEmTempoReal[coordenadasEmTempoReal.length - 1];
    ultimoTimestampSalvo = new Date(ultimoPontoRegistrado.timestamp || Date.now()).getTime();
  } else {
    ultimoPontoRegistrado = null;
    ultimoTimestampSalvo = 0;
  }

  ultimoInstanteGpsCalculado = Date.now();

  if (watchIdGps !== null) {
    navigator.geolocation.clearWatch(watchIdGps);
    watchIdGps = null;
  }

  manterTelaAtiva();

  watchIdGps = navigator.geolocation.watchPosition(
    (pos) => {
      const agora = Date.now();
      const coords = pos.coords;
      const velocidadeKmh = coords.speed ? coords.speed * 3.6 : 0;

      if (ultimoInstanteGpsCalculado) {
        const deltaSeg = Math.floor((agora - ultimoInstanteGpsCalculado) / 1000);
        if (deltaSeg > 0 && deltaSeg < 600) {
          if (velocidadeKmh >= 3.0) {
            acumuladorTempoMovimentoSegundos += deltaSeg;
          } else {
            acumuladorTempoParadoSegundos += deltaSeg;
          }
        }
      }
      ultimoInstanteGpsCalculado = agora;

      let distanciaPercorrida = 0;
      if (ultimoPontoRegistrado) {
        distanciaPercorrida = calcularDistanciaMetros(
          ultimoPontoRegistrado.lat,
          ultimoPontoRegistrado.lng,
          coords.latitude,
          coords.longitude
        );
      }

      const estaParado = distanciaPercorrida < DISTANCIA_MINIMA_METROS && velocidadeKmh < 4;
      if (ultimoPontoRegistrado !== null && estaParado) return;

      const tempoDecorrido = (agora - ultimoTimestampSalvo) >= INTERVALO_LEITURA_MS;
      if (!tempoDecorrido && ultimoPontoRegistrado !== null) return;

      const novoPonto = {
        lat: Number(coords.latitude.toFixed(6)),
        lng: Number(coords.longitude.toFixed(6)),
        velocidade: Number(velocidadeKmh.toFixed(1)),
        timestamp: new Date().toISOString()
      };

      ultimoPontoRegistrado = novoPonto;
      ultimoTimestampSalvo = agora;

      coordenadasEmTempoReal.push(novoPonto);
      localStorage.setItem(chaveCache, JSON.stringify(coordenadasEmTempoReal));

      const ptsTxt = document.getElementById('m-mapa-pontos-txt');
      if (ptsTxt) ptsTxt.innerText = `${coordenadasEmTempoReal.length} pts registrados`;

      if (gPolylineMobile && gMapMobile) {
        const path = gPolylineMobile.getPath();
        const latLng = new google.maps.LatLng(novoPonto.lat, novoPonto.lng);
        path.push(latLng);
        if (gMarkerPosAtual) gMarkerPosAtual.setPosition(latLng);
        gMapMobile.panTo(latLng);
      }
    },
    (err) => console.warn("GPS Erro:", err.message),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
  );
}

function pararRastreamentoGPS() {
  if (watchIdGps !== null) {
    navigator.geolocation.clearWatch(watchIdGps);
    watchIdGps = null;
  }
  liberarTelaAtiva();

  const pontosFinais = [...coordenadasEmTempoReal];
  if (idRotaRastreamentoAtiva) {
    localStorage.removeItem(`arvo_gps_rota_${idRotaRastreamentoAtiva}`);
    idRotaRastreamentoAtiva = null;
  }
  return pontosFinais;
}

// =========================================================================
// GOOGLE MAPS EM TEMPO REAL NO MOBILE
// =========================================================================
let gMapMobile = null;
let gPolylineMobile = null;
let gMarkerPosAtual = null;

function iniciarRastreamentoTempoRealMobile(rotaAtiva) {
  if (!rotaAtiva) return;

  const blocoMapa = document.getElementById('m-bloco-mapa-rota');
  const blocoForm = document.getElementById('m-bloco-formulario-fim');
  const containerMapa = document.getElementById('mapa-mobile-tempo-real');

  if (!blocoMapa || !containerMapa) return;

  blocoMapa.classList.remove('hidden');
  if (blocoForm) blocoForm.classList.add('hidden');

  const lblOrigem = document.getElementById('m-mapa-origem-txt');
  if (lblOrigem) lblOrigem.innerText = rotaAtiva.origem || 'Origem';

  if (watchIdGps === null) {
    iniciarRastreamentoIntervaladoGPS(rotaAtiva.id);
  }

  const chaveCache = `arvo_gps_rota_${rotaAtiva.id}`;
  try {
    const salvas = JSON.parse(localStorage.getItem(chaveCache) || '[]');
    coordenadasEmTempoReal = Array.isArray(salvas) ? salvas : [];
  } catch (e) {
    coordenadasEmTempoReal = [];
  }

  let pontoInicial = { lat: -20.761921, lng: -41.533884 };
  if (coordenadasEmTempoReal.length > 0) {
    pontoInicial = coordenadasEmTempoReal[coordenadasEmTempoReal.length - 1];
  } else if (rotaAtiva.coords_origem) {
    pontoInicial = rotaAtiva.coords_origem;
  } else if (COORDENADAS_BASES[(rotaAtiva.origem || '').toUpperCase()]) {
    pontoInicial = COORDENADAS_BASES[(rotaAtiva.origem || '').toUpperCase()];
  }

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
}

function exibirFormularioDevolucaoMobile() {
  const blocoMapa = document.getElementById('m-bloco-mapa-rota');
  const blocoForm = document.getElementById('m-bloco-formulario-fim');
  if (blocoMapa) blocoMapa.classList.add('hidden');
  if (blocoForm) blocoForm.classList.remove('hidden');
}

function destruirMapaMobile(rotaId) {
  const pontosFinais = [...coordenadasEmTempoReal];
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
  const isAdmin = GESTORES_EMAILS.includes(emailUser);

  select.innerHTML = '<option value="">Selecione o veículo...</option>';

  veiculos
    .filter(v => {
      if (v.status !== 'Disponivel') return false;

      const isExterno = (v.tipo_frota || '').toUpperCase() === 'EXTERNO' || (v.proprietario || '').toUpperCase() === 'EXTERNO';
      const condutorExclusivo = (v.motorista_autorizado || '').toLowerCase().trim();

      if (isExterno && condutorExclusivo !== emailUser && !isAdmin) {
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

async function validarDisponibilidadeReservaCarroMobile(veiculo, emailCondutorLogado) {
  const agora = new Date();
  const agoraTs = agora.getTime();
  const emailAtual = (emailCondutorLogado || '').toLowerCase().trim();
  const nomeCarro = veiculo.nome_frota || veiculo.id;
  const placaCarro = veiculo.placa;

  try {
    const { data: reservasCarro, error } = await db
      .from('reservas')
      .select('*')
      .eq('status', 'CONFIRMADA');

    if (error || !reservasCarro) return { permitido: true };

    const reservaAtiva = reservasCarro.find(r => {
      const bateuCarro =
        String(r.veiculo_id).toUpperCase() === String(nomeCarro).toUpperCase() ||
        String(r.veiculo_id).toUpperCase() === String(veiculo.id).toUpperCase() ||
        (placaCarro && String(r.veiculo_id).toUpperCase() === String(placaCarro).toUpperCase()) ||
        (placaCarro && String(r.placa).toUpperCase() === String(placaCarro).toUpperCase());

      if (!bateuCarro) return false;

      const ini = new Date(r.data_inicio).getTime();
      const fim = new Date(r.data_fim).getTime();
      return (agoraTs >= ini && agoraTs <= fim);
    });

    if (!reservaAtiva) return { permitido: true };

    const emailDono = (reservaAtiva.responsavel || '').toLowerCase().trim();
    if (emailDono === emailAtual) return { permitido: true };

    if (reservaAtiva.liberado_ate) {
      const liberadoAteTs = new Date(reservaAtiva.liberado_ate).getTime();
      if (agoraTs <= liberadoAteTs) {
        return {
          permitido: true,
          aviso: `⚠️ Veículo em reserva de ${obterNomeMotoristaFormatado(reservaAtiva.responsavel)}, porém liberado para uso hoje.`
        };
      }
    }

    const dataFimFmt = new Date(reservaAtiva.data_fim).toLocaleString('pt-BR');
    return {
      permitido: false,
      mensagem: `⛔ VEÍCULO BLOQUEADO POR RESERVA!\n\n` +
        `O veículo ${nomeCarro} [${placaCarro || 'S/ Placa'}] está reservado para:\n` +
        `👤 Titular: ${obterNomeMotoristaFormatado(reservaAtiva.responsavel)}\n` +
        `🎯 Modalidade: ${reservaAtiva.tipo_reserva || 'Reserva'} (${reservaAtiva.finalidade})\n` +
        `📅 Vigência até: ${dataFimFmt}\n\n` +
        `O titular não realizou a liberação temporária deste veículo para hoje.`
    };
  } catch (e) {
    return { permitido: true };
  }
}

async function handleMobileInicioRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-m-confirmar-inicio') || document.getElementById('btn-submit-inicio');
  const selectElem = document.getElementById('m-inicio-veiculo');
  const veiculoId = selectElem?.value;
  const optSelecionada = selectElem ? selectElem.options[selectElem.selectedIndex] : null;

  const uuidVeiculo = optSelecionada?.dataset?.uuid || null;
  const placaVeiculo = optSelecionada?.dataset?.placa || null;

  const veiculo = veiculos.find(v => (uuidVeiculo && v.uuid_veiculos === uuidVeiculo) || (v.nome_frota === veiculoId || v.id === veiculoId));

  if (btn) {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Abrindo rota...`;
  }

  if (!veiculo || !usuarioLogado) {
    alert("Selecione um veículo disponível.");
    if (btn) btn.disabled = false;
    return;
  }

  const emailUser = (usuarioLogado.email || '').toLowerCase().trim();
  const isAdmin = GESTORES_EMAILS.includes(emailUser);
  const isExterno = (veiculo.tipo_frota || '').toUpperCase() === 'EXTERNO' || (veiculo.proprietario || '').toUpperCase() === 'EXTERNO';
  const condutorExclusivo = (veiculo.motorista_autorizado || '').toLowerCase().trim();

  if (isExterno && condutorExclusivo !== emailUser && !isAdmin) {
    alert("⚠️ Este veículo é de uso exclusivo de outro condutor.");
    if (btn) btn.disabled = false;
    return;
  }

  const rotaAbertaExistente = (rotas || []).find(r => 
    r.status === 'Em Uso' && (r.responsavel || '').toLowerCase().trim() === emailUser
  );

  if (rotaAbertaExistente) {
    alert(`⚠️ Você já possui a rota #${rotaAbertaExistente.id} em andamento (${rotaAbertaExistente.veiculo_id || 'Veículo'}). Finalize-a antes de iniciar uma nova.`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-key text-base"></i> Iniciar Rota`;
    }
    return;
  }

  const checagem = await validarDisponibilidadeReservaCarroMobile(veiculo, emailUser);
  if (!checagem.permitido) {
    alert(checagem.mensagem);
    if (btn) btn.disabled = false;
    return;
  }

  const selectOrigem = document.getElementById('m-inicio-origem')?.value;
  const outroOrigem = document.getElementById('m-inicio-origem-outro')?.value?.trim();
  const origemFinal = selectOrigem === 'OUTRO' ? outroOrigem : selectOrigem;
  const finalidade = document.getElementById('m-inicio-finalidade')?.value || 'DEMANDAS INTERNAS';
  const kmSaida = Number(document.getElementById('m-inicio-km')?.value || veiculo.km_atual || 0);

  if (!origemFinal) {
    alert("Por favor, informe a origem da rota.");
    if (btn) btn.disabled = false;
    return;
  }

  let posGps;
  try {
    posGps = await solicitarPermissaoGPSObrigatoria();
  } catch (errGps) {
    alert(errGps.message);
    if (btn) btn.disabled = false;
    return;
  }

  const tempId = `temp_${Date.now()}`;
  const dataSaidaAtual = new Date().toISOString();
  const coordsPartida = {
    lat: Number(posGps.coords.latitude.toFixed(6)),
    lng: Number(posGps.coords.longitude.toFixed(6)),
    tipo: 'GPS_REAL'
  };

  const pontoInicial = [{
    lat: coordsPartida.lat,
    lng: coordsPartida.lng,
    velocidade: 0,
    timestamp: dataSaidaAtual
  }];

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
    coordenadas: pontoInicial,
    tempo_movimento_segundos: 0,
    tempo_parado_segundos: 0
  };

  acumuladorTempoMovimentoSegundos = 0;
  acumuladorTempoParadoSegundos = 0;

  localStorage.setItem(`arvo_gps_rota_${tempId}`, JSON.stringify(pontoInicial));
  iniciarRastreamentoIntervaladoGPS(tempId);

  if (!navigator.onLine) {
    salvarNaFilaRotas({ tipo: 'INICIO', payload: payloadRota });
    rotas.unshift(payloadRota);
    veiculo.status = 'Em Uso';
    salvarCachesLocais();
    alert(`📶 Rota iniciada em Modo Offline com GPS! Sincronização pendente.`);
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

    const { data: rotaInserida, error: insertErr } = await db.from('rotas').insert([payloadRota]).select('id');
    if (insertErr) throw insertErr;

    const idReal = (rotaInserida && rotaInserida[0]) ? rotaInserida[0].id : null;
    if (idReal) {
      idRotaRastreamentoAtiva = idReal;
      localStorage.setItem(`arvo_gps_rota_${idReal}`, JSON.stringify(pontoInicial));
      localStorage.removeItem(`arvo_gps_rota_${tempId}`);
    }

    let veicOk = false;
    if (uuidVeiculo && isUUID(uuidVeiculo)) {
      const { error: errU } = await db.from('veiculos').update({ status: 'Em Uso' }).eq('uuid_veiculos', uuidVeiculo);
      if (!errU) veicOk = true;
    }
    if (!veicOk && (placaVeiculo || veiculo.placa)) {
      const p = placaVeiculo || veiculo.placa;
      const { error: errP } = await db.from('veiculos').update({ status: 'Em Uso' }).eq('placa', p);
      if (!errP) veicOk = true;
    }
    if (!veicOk && veiculo.id) {
      await db.from('veiculos').update({ status: 'Em Uso' }).eq('id', veiculo.id);
    }

    alert(`✅ Rota iniciada com sucesso com o veículo ${veiculo.nome_frota || veiculoId}!`);
    e.target.reset();
    toggleOutroOrigemMobile('');
    await carregarDadosMobile();
    switchMobileTab('finalizar');
  } catch (err) {
    console.warn("Falha de rede, salvando na fila offline:", err);
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

  const emailUser = (usuarioLogado.email || '').toLowerCase().trim();
  const isAdmin = GESTORES_EMAILS.includes(emailUser);

  select.innerHTML = '<option value="">Selecione sua rota ativa...</option>';

  rotas
    .filter(r => r.status === 'Em Uso' && (isAdmin || (r.responsavel || '').toLowerCase().trim() === emailUser))
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

async function handleMobileFimRota(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const btn = document.getElementById('btn-m-confirmar-fim');
  const rotaId = document.getElementById('m-fim-rota-select')?.value;
  const rota = (rotas || []).find(r => String(r.id) === String(rotaId));

  if (!rota) {
    alert("Selecione uma rota ativa.");
    return;
  }

  const pontosRastreamento = (typeof pararRastreamentoGPS === 'function' ? pararRastreamentoGPS() : []) || [];
  let pontosCache = [];
  try {
    pontosCache = JSON.parse(localStorage.getItem(`arvo_gps_rota_${rota.id}`) || '[]');
  } catch (err) {}

  let coordenadasFinais = [];
  if (pontosRastreamento.length >= 2) {
    coordenadasFinais = pontosRastreamento;
  } else if (pontosCache.length >= 2) {
    coordenadasFinais = pontosCache;
  } else if (Array.isArray(rota.coordenadas) && rota.coordenadas.length > 0) {
    coordenadasFinais = rota.coordenadas;
  }

  if (navigator.geolocation && coordenadasFinais.length <= 1) {
    try {
      const posFinal = await new Promise((res, rej) => {
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 2500 });
      });
      coordenadasFinais.push({
        lat: Number(posFinal.coords.latitude.toFixed(6)),
        lng: Number(posFinal.coords.longitude.toFixed(6)),
        velocidade: 0,
        timestamp: new Date().toISOString()
      });
    } catch (errGps) {}
  }

  if (typeof destruirMapaMobile === 'function') {
    destruirMapaMobile(rota.id);
  }

  const selectDestino = document.getElementById('m-fim-destino')?.value;
  const outroDestino = document.getElementById('m-fim-destino-outro')?.value?.trim();
  const destinoFinal = selectDestino === 'OUTRO' ? outroDestino : selectDestino;

  const kmRetornoInput = document.getElementById('m-fim-km')?.value;
  const kmRetorno = Number(kmRetornoInput || 0);
  const kmSaidaNum = Number(rota.km_saida || 0);

  const anomaliaMarcada = document.getElementById('m-fim-check-anomalia')?.checked;
  const relatorioAnomalia = document.getElementById('m-fim-anomalia')?.value?.trim() || null;

  if (isNaN(kmRetorno) || kmRetorno < kmSaidaNum) {
    alert(`O KM final (${kmRetorno}) não pode ser menor que o KM inicial (${kmSaidaNum}).`);
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Finalizando...`;
  }

  const kmTotal = Math.max(0, kmRetorno - kmSaidaNum);

  const veiculoAlvo = (veiculos || []).find(v =>
    (rota.uuid_veiculos && v.uuid_veiculos === rota.uuid_veiculos) ||
    String(v.id) === String(rota.veiculo_id) ||
    String(v.nome_frota) === String(rota.veiculo_id) ||
    (rota.placa && String(v.placa).toUpperCase() === String(rota.placa).toUpperCase())
  ) || {};

  const placaAlvo = rota.placa || veiculoAlvo.placa || null;

  let histCache = [];
  try {
    histCache = JSON.parse(localStorage.getItem('arvo_cache_abastecimentos') || '[]');
  } catch (err) {}

  const medConsumo = (typeof obterMediaConsumoEsperada === 'function')
    ? obterMediaConsumoEsperada(veiculoAlvo, null, histCache)
    : 12.3;

  const litrosConsumidos = (kmTotal > 0 && medConsumo > 0)
    ? Number((kmTotal / medConsumo).toFixed(2))
    : 0;

  const capTanque = Number(veiculoAlvo.tanque || 47);
  const tanqueAnterior = (veiculoAlvo.tanque_virtual !== null && veiculoAlvo.tanque_virtual !== undefined)
    ? Number(veiculoAlvo.tanque_virtual)
    : capTanque;

  const novoTanqueVirtual = Number(Math.max(0, tanqueAnterior - litrosConsumidos).toFixed(2));
  const dataRetornoIso = new Date().toISOString();

  const agoraData = new Date();
  const fimDoDiaHojeIso = new Date(
    agoraData.getFullYear(),
    agoraData.getMonth(),
    agoraData.getDate(),
    23, 59, 59, 999
  ).toISOString();
  const querLiberarRestoDoDia = document.getElementById('check-liberar-carro-hoje')?.checked || false;

  const payloadFim = {
    rota_id: rota.id,
    destino: destinoFinal,
    km_retorno: kmRetorno,
    km_total: kmTotal,
    coordenadas: coordenadasFinais,
    consumo_litros: litrosConsumidos,
    tanque_virtual: novoTanqueVirtual,
    data_retorno: dataRetornoIso,
    status: 'Concluida',
    anomalia: anomaliaMarcada ? (relatorioAnomalia || 'Anomalia sem detalhes') : null,
    tempo_movimento_segundos: acumuladorTempoMovimentoSegundos,
    tempo_parado_segundos: acumuladorTempoParadoSegundos
  };

  if (!navigator.onLine || String(rota.id).startsWith('temp_')) {
    salvarNaFilaRotas({
      tipo: 'FIM',
      payload: payloadFim,
      placa: placaAlvo,
      veiculo_id: rota.veiculo_id,
      uuid_veiculos: rota.uuid_veiculos,
      tanque_virtual: novoTanqueVirtual,
      anomalia: payloadFim.anomalia
    });

    rota.status = 'Concluida';
    rota.km_total = kmTotal;
    rota.km_retorno = kmRetorno;
    rota.consumo_litros = litrosConsumidos;
    rota.data_retorno = payloadFim.data_retorno;
    rota.destino = destinoFinal;
    rota.coordenadas = coordenadasFinais;
    rota.tempo_movimento_segundos = acumuladorTempoMovimentoSegundos;
    rota.tempo_parado_segundos = acumuladorTempoParadoSegundos;

    if (veiculoAlvo) {
      veiculoAlvo.km_atual = kmRetorno;
      veiculoAlvo.status = 'Disponivel';
      veiculoAlvo.tanque_virtual = novoTanqueVirtual;
      if (payloadFim.anomalia) veiculoAlvo.anomalias = payloadFim.anomalia;
    }

    salvarCachesLocais();
    alert(`📶 Rota encerrada Offline!\nConsumo: ~${litrosConsumidos} L (Média: ${medConsumo} km/L)\nTanque restante: ~${novoTanqueVirtual} L.`);

    e.target.reset();
    renderizarHistoricoMobile();
    renderizarOpcoesRotasAtivas();
    renderizarOpcoesVeiculos();
    if (typeof atualizarKpisMotoristaMobile === 'function') atualizarKpisMotoristaMobile();
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
      coordenadas: coordenadasFinais,
      consumo_litros: litrosConsumidos,
      data_retorno: payloadFim.data_retorno,
      status: 'Concluida',
      anomalia: payloadFim.anomalia,
      tempo_movimento_segundos: acumuladorTempoMovimentoSegundos,
      tempo_parado_segundos: acumuladorTempoParadoSegundos
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

    let veicAtualizado = false;
    if (veiculoAlvo.uuid_veiculos && isUUID(veiculoAlvo.uuid_veiculos)) {
      const { error: errU } = await db.from('veiculos').update(payloadVeiculo).eq('uuid_veiculos', veiculoAlvo.uuid_veiculos);
      if (!errU) veicAtualizado = true;
    }
    if (!veicAtualizado && placaAlvo) {
      const { error: errP } = await db.from('veiculos').update(payloadVeiculo).eq('placa', placaAlvo);
      if (!errP) veicAtualizado = true;
    }
    if (!veicAtualizado && (veiculoAlvo.nome_frota || rota.veiculo_id)) {
      const nomeIdent = veiculoAlvo.nome_frota || rota.veiculo_id;
      const { error: errN } = await db.from('veiculos').update(payloadVeiculo).eq('nome_frota', nomeIdent);
      if (!errN) veicAtualizado = true;
    }
    if (!veicAtualizado && veiculoAlvo.id) {
      await db.from('veiculos').update(payloadVeiculo).eq('id', veiculoAlvo.id);
    }

    try {
      const { data: reservasMotorista } = await db.from('reservas')
        .select('*')
        .eq('responsavel', rota.responsavel)
        .eq('status', 'CONFIRMADA')
        .lte('data_inicio', dataRetornoIso)
        .gt('data_fim', dataRetornoIso);

      if (reservasMotorista && reservasMotorista.length > 0) {
        for (const resv of reservasMotorista) {
          const isLongoPrazo = ['SEMANAL', 'MENSAL', 'DIAS'].includes((resv.tipo_reserva || '').toUpperCase());
          const fimReserva = new Date(resv.data_fim).getTime();
          const fimHojeTs = new Date(fimDoDiaHojeIso).getTime();

          if (isLongoPrazo && fimReserva > fimHojeTs) {
            if (querLiberarRestoDoDia) {
              await db.from('reservas').update({
                liberado_ate: fimDoDiaHojeIso,
                liberado_por: rota.responsavel,
                updated_at: dataRetornoIso
              }).eq('id', resv.id);
            }
          } else {
            await db.from('reservas').update({
              status: 'CONCLUIDA',
              updated_at: dataRetornoIso,
              updated_by: rota.responsavel
            }).eq('id', resv.id);
          }
        }
      }
    } catch (errRes) {}

    alert(`✅ Rota concluída!\nConsumo: ~${litrosConsumidos} L (Média: ${medConsumo} km/L)\nTanque restante: ~${novoTanqueVirtual} L.`);

    e.target.reset();
    await carregarDadosMobile();
    switchMobileTab('historico');
  } catch (err) {
    salvarNaFilaRotas({
      tipo: 'FIM',
      payload: payloadFim,
      placa: placaAlvo,
      veiculo_id: rota.veiculo_id,
      uuid_veiculos: rota.uuid_veiculos,
      tanque_virtual: novoTanqueVirtual,
      anomalia: payloadFim.anomalia
    });
    alert(`📶 Conexão instável. Finalização salva localmente.`);
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
  localStorage.setItem('arvo_cache_usuarios', JSON.stringify(usuarios));
}

async function sincronizarFilaRotas() {
  if (!navigator.onLine) return;
  const fila = JSON.parse(localStorage.getItem('arvo_sync_rotas_queue') || '[]');
  if (fila.length === 0) return;

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

        let okV = false;
        if (payload.uuid_veiculos && isUUID(payload.uuid_veiculos)) {
          const { error: errU } = await db.from('veiculos').update({ status: 'Em Uso' }).eq('uuid_veiculos', payload.uuid_veiculos);
          if (!errU) okV = true;
        }
        if (!okV && payload.placa) {
          const { error: errP } = await db.from('veiculos').update({ status: 'Em Uso' }).eq('placa', payload.placa);
          if (!errP) okV = true;
        }
        if (!okV && payload.veiculo_id) {
          await db.from('veiculos').update({ status: 'Em Uso' }).eq('nome_frota', payload.veiculo_id);
        }

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

        const { error: errFim } = await db.from('rotas').update(dadosFim).eq('id', rota_id);
        if (errFim) throw errFim;

        const placaAlvo = item.placa || item.payload?.placa;
        const veicAlvo = item.veiculo_id || item.payload?.veiculo_id;
        const uuidAlvo = item.uuid_veiculos || item.payload?.uuid_veiculos;

        const payloadUpdateVeic = { status: 'Disponivel' };
        if (dadosFim.km_retorno) payloadUpdateVeic.km_atual = dadosFim.km_retorno;
        if (item.tanque_virtual !== undefined) payloadUpdateVeic.tanque_virtual = item.tanque_virtual;

        let atualizouVeic = false;
        if (uuidAlvo && isUUID(uuidAlvo)) {
          const { error: errU } = await db.from('veiculos').update(payloadUpdateVeic).eq('uuid_veiculos', uuidAlvo);
          if (!errU) atualizouVeic = true;
        }
        if (!atualizouVeic && placaAlvo) {
          const { error: errP } = await db.from('veiculos').update(payloadUpdateVeic).eq('placa', placaAlvo);
          if (!errP) atualizouVeic = true;
        }
        if (!atualizouVeic && veicAlvo) {
          await db.from('veiculos').update(payloadUpdateVeic).eq('nome_frota', veicAlvo);
        }
      }
    } catch (e) {
      itensRestantes.push(item);
    }
  }

  localStorage.setItem('arvo_sync_rotas_queue', JSON.stringify(itensRestantes));
  if (itensRestantes.length === 0) {
    await carregarDadosMobile();
  }
}

window.addEventListener('online', sincronizarFilaRotas);

// =========================================================================
// PREVIEW DO VEÍCULO E CARTÃO VISUAL NO MOBILE
// =========================================================================
function aoMudarVeiculoMobile(valor) {
  atualizarKmVeiculoMobile();
  renderPreviewCardCarroMobile(valor);
}

function renderPreviewCardCarroMobile(veiculoId) {
  const container = document.getElementById('m-preview-card-carro');
  if (!container) return;

  const selectElem = document.getElementById('m-inicio-veiculo');
  const valFinal = veiculoId || selectElem?.value;
  const optSelecionada = selectElem ? selectElem.options[selectElem.selectedIndex] : null;
  const uuidVeiculo = optSelecionada?.dataset?.uuid || null;
  const placaVeiculo = optSelecionada?.dataset?.placa || null;

  if (!valFinal) {
    container.innerHTML = `
      <div class="border-2 border-dashed border-slate-700/60 rounded-3xl p-5 text-center text-slate-400 text-xs font-medium bg-[#111827]/40">
        Selecione um veículo acima para visualizar telemetria, tanque e status operacional.
      </div>
    `;
    return;
  }

  const veiculo = (veiculos || []).find(v =>
    (uuidVeiculo && String(v.uuid_veiculos) === String(uuidVeiculo)) ||
    (placaVeiculo && String(v.placa).toUpperCase().trim() === String(placaVeiculo).toUpperCase().trim()) ||
    String(v.nome_frota).toUpperCase().trim() === String(valFinal).toUpperCase().trim() ||
    String(v.id) === String(valFinal) ||
    String(v.placa).toUpperCase().trim() === String(valFinal).toUpperCase().trim()
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

  const estiloCardMobile = isEmUso
    ? "background: rgba(234, 88, 12, 0.70); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1.5px solid rgba(254, 215, 170, 0.6); box-shadow: 0 10px 25px rgba(234, 88, 12, 0.35);"
    : "background: linear-gradient(180deg, #182230 0%, #0f172a 100%); border: 1px solid rgba(255,255,255,0.1);";

  const ref = `${veiculo.nome_frota || ''} ${veiculo.marca || ''}`.toUpperCase();
  let imgUrl = '/imagens/mobi.png';
  if (ref.includes('COMPASS') || ref.includes('JEEP')) imgUrl = '/imagens/jeepcomp.png';
  else if (ref.includes('GOL')) imgUrl = '/imagens/gol.png';
  else if (ref.includes('COROLLA')) imgUrl = '/imagens/corolla.png';
  else if (ref.includes('STRADA')) imgUrl = '/imagens/strada.png';

  container.innerHTML = `
    <div class="relative rounded-3xl p-5 shadow-2xl text-white overflow-hidden w-full transition-all duration-300" style="${estiloCardMobile}">
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
// KPIS DO MOTORISTA NO MOBILE
// =========================================================================
function atualizarKpisMotoristaMobile() {
  const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  let emailUsuario = '';
  try {
    emailUsuario = (JSON.parse(rawSessao)?.email || rawSessao || '').toLowerCase().trim();
  } catch (e) {
    emailUsuario = String(rawSessao || '').toLowerCase().trim();
  }

  const ehAdmin = GESTORES_EMAILS.includes(emailUsuario);
  const inputIni = document.getElementById('filtro-m-data-inicio')?.value;
  const inputFim = document.getElementById('filtro-m-data-fim')?.value;

  const dIni = inputIni ? new Date(`${inputIni}T00:00:00`).getTime() : null;
  const dFim = inputFim ? new Date(`${inputFim}T23:59:59`).getTime() : null;

  const rotasDoMotorista = (rotas || []).filter(r => {
    const resp = (r.responsavel || '').toLowerCase().trim();
    if (!ehAdmin && resp !== emailUsuario) return false;

    const dataRef = new Date(r.data_retorno || r.data_saida || r.created_at).getTime();
    if (dIni && dataRef < dIni) return false;
    if (dFim && dataRef > dFim) return false;
    return true;
  });

  let distTotal = 0;
  let litrosTotal = 0;
  let tempoTotalHoras = 0;
  let rotasConcluidas = 0;

  rotasDoMotorista.forEach(r => {
    const km = Number(r.km_total || 0);
    const litros = Number(r.consumo_litros || 0);
    distTotal += km;
    litrosTotal += litros;

    if (r.status === 'Concluida' || r.data_retorno) {
      rotasConcluidas++;
    }

    if (r.tempo_movimento_segundos) {
      tempoTotalHoras += Number(r.tempo_movimento_segundos) / 3600;
    } else if (r.data_saida && r.data_retorno) {
      const diffMs = new Date(r.data_retorno) - new Date(r.data_saida);
      if (diffMs > 0) tempoTotalHoras += diffMs / (1000 * 60 * 60);
    }
  });

  const mediaConsumo = (distTotal > 0 && litrosTotal > 0)
    ? (distTotal / litrosTotal).toFixed(1)
    : (rotasDoMotorista.length > 0 ? "13.1" : "0.0");

  const elDist = document.getElementById('kpi-m-distancia');
  const elCons = document.getElementById('kpi-m-consumo');
  const elTempo = document.getElementById('kpi-m-tempo');
  const elQtd = document.getElementById('kpi-m-rotas-qtd');

  if (elDist) elDist.innerText = distTotal.toLocaleString('pt-BR');
  if (elCons) elCons.innerText = mediaConsumo;
  if (elTempo) elTempo.innerText = tempoTotalHoras.toFixed(1);
  if (elQtd) elQtd.innerText = rotasConcluidas;
}

function limparFiltrosDataMotorista() {
  const i1 = document.getElementById('filtro-m-data-inicio');
  const i2 = document.getElementById('filtro-m-data-fim');
  if (i1) i1.value = '';
  if (i2) i2.value = '';
  atualizarKpisMotoristaMobile();
}

// =========================================================================
// HISTÓRICO DE ROTAS
// =========================================================================
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

  const ehAdmin = GESTORES_EMAILS.includes(emailUsuario);
  const todasRotas = Array.isArray(rotas) ? rotas : [];

  const rotasPermitidas = todasRotas.filter(r => {
    if (ehAdmin) return true;
    return (r.responsavel || '').toLowerCase().trim() === emailUsuario;
  });

  const badgeTotal = document.getElementById('m-total-rotas-badge');
  if (badgeTotal) badgeTotal.innerText = `${rotasPermitidas.length} rotas`;

  if (rotasPermitidas.length === 0) {
    container.innerHTML = `
      <div class="bg-[#FAF7F2] rounded-3xl p-6 text-center text-slate-500 text-xs font-semibold border border-[#EFE9DF]">
        Nenhuma rota encontrada para o seu usuário.
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  rotasPermitidas.forEach(r => {
    const isEmUso = r.status === 'Em Uso';
    const temAvaria = Boolean(r.anomalia && r.anomalia.trim() !== '');
    const condutorNome = obterNomeMotoristaFormatado(r.responsavel);

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

    const card = document.createElement('div');
    card.className = isEmUso
      ? 'card-item rounded-3xl p-4 shadow-xl text-white space-y-3'
      : 'card-item bg-[#FAF7F2] rounded-3xl p-4 shadow-xl border border-[#EFE9DF] text-slate-800 space-y-3';

    if (isEmUso) {
      card.setAttribute('style', 'background: rgba(234, 88, 12, 0.70); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1.5px solid rgba(254, 215, 170, 0.6); box-shadow: 0 10px 25px rgba(234, 88, 12, 0.35);');
    }

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

          <div class="trip-computer">
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
          <div class="visor-digital">
            <i class="ph-bold ph-timer text-emerald-400 text-xs"></i>
            <span class="visor-digital-txt">${tempoFormatado}</span>
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

// =========================================================================
// ALERTAS E NOTIFICAÇÕES (> 12H)
// =========================================================================
function solicitarPermissaoNotificacao() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
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
  try {
    emailUsuario = (JSON.parse(rawSessao)?.email || rawSessao || '').toLowerCase().trim();
  } catch {
    emailUsuario = String(rawSessao).toLowerCase().trim();
  }

  const responsavelRota = String(rota.responsavel || '').toLowerCase().trim();
  const isAdmin = GESTORES_EMAILS.includes(emailUsuario);
  const isCondutor = emailUsuario === responsavelRota;
  const podeEncerrar = isAdmin || isCondutor;

  const popUp = document.createElement('div');
  popUp.id = modalId;
  popUp.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; background: rgba(15, 23, 42, 0.75) !important; z-index: 99999 !important; display: flex !important; align-items: center !important; justify-content: center !important; padding: 1rem !important; box-sizing: border-box !important;";

  popUp.innerHTML = `
    <div style="background: #ffffff !important; border-radius: 1.5rem !important; max-width: 24rem !important; width: 100% !important; padding: 1.5rem !important; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3) !important; text-align: center !important; border: 1px solid #ffe4e6 !important;">
      <div style="width: 3.5rem; height: 3.5rem; background-color: #ffe4e6; color: #e11d48; border-radius: 1rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; font-size: 1.75rem;">
        <i class="ph-bold ph-warning-circle"></i>
      </div>
      <div>
        <h3 style="font-size: 1rem; font-weight: 900; color: #0f172a; margin: 0;">Atenção: Rota Pendente!</h3>
        <p style="font-size: 0.75rem; color: #64748b; margin-top: 0.35rem; line-height: 1.3;">
          A rota <b style="color: #0f172a;">#${rota.id}</b> com o veículo <b style="color: #0f172a;">${rota.veiculo_id} [${rota.placa || '-'}]</b> (Condutor: <b>${obterNomeMotoristaFormatado(rota.responsavel)}</b>) está aberta há mais de <span style="color: #e11d48; font-weight: 700;">${Math.floor(horasAbertas)} horas</span>.
        </p>
      </div>
      <div style="display: flex; gap: 0.5rem; width: 100%; margin-top: 1rem;">
        ${podeEncerrar ? `
          <button type="button" onclick="document.getElementById('${modalId}').remove()" style="flex: 1; padding: 0.625rem; background-color: #f1f5f9; color: #334155; font-weight: 700; font-size: 0.75rem; border-radius: 0.75rem; border: none; cursor: pointer;">
            Lembrar Depois
          </button>
          <button type="button" onclick="document.getElementById('${modalId}').remove(); switchMobileTab('finalizar');" style="flex: 1; padding: 0.625rem; background-color: #15803d; color: #ffffff; font-weight: 700; font-size: 0.75rem; border-radius: 0.75rem; border: none; cursor: pointer;">
            Finalizar Agora
          </button>
        ` : `
          <button type="button" onclick="document.getElementById('${modalId}').remove()" style="width: 100%; padding: 0.625rem; background-color: #d97706; color: #ffffff; font-weight: 700; font-size: 0.75rem; border-radius: 0.75rem; border: none; cursor: pointer;">
            Fechar
          </button>
        `}
      </div>
    </div>
  `;
  document.body.appendChild(popUp);
}

// =========================================================================
// GESTÃO DE SENHA DO MOTORISTA LOGADO
// =========================================================================
function abrirModalTrocarSenha() {
  document.getElementById('modal-trocar-senha')?.classList.remove('hidden');
}

function fecharModalTrocarSenha() {
  document.getElementById('modal-trocar-senha')?.classList.add('hidden');
  const at = document.getElementById('senha-atual-usuario');
  const nv = document.getElementById('senha-nova-usuario');
  const cf = document.getElementById('senha-confirma-usuario');
  if (at) at.value = '';
  if (nv) nv.value = '';
  if (cf) cf.value = '';
}

async function handleAlterarMinhaSenha(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-salvar-senha');
  const sessao = obterSessaoAtiva();

  if (!sessao || !sessao.email) {
    alert("Sessão inválida. Faça login novamente.");
    window.location.href = "login.html";
    return;
  }

  const senhaNova = document.getElementById('senha-nova-usuario').value.trim();
  const senhaConfirma = document.getElementById('senha-confirma-usuario').value.trim();

  if (senhaNova.length < 4) {
    alert("A nova senha deve ter no mínimo 4 caracteres.");
    return;
  }

  if (senhaNova !== senhaConfirma) {
    alert("⚠️ A confirmação da nova senha não confere.");
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Salvando...`;

  try {
    const { error: erroAuth } = await db.auth.updateUser({ password: senhaNova });
    if (erroAuth) throw erroAuth;

    fecharModalTrocarSenha();
    alert("✅ Senha atualizada com sucesso no Supabase Authentication!");
  } catch (err) {
    alert("Erro ao alterar senha: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Salvar`;
  }
}

// =========================================================================
// GESTÃO DE RECUPERAÇÃO DE SENHA MOBILE (CNH + SUPABASE AUTH RPC)
// =========================================================================
function abrirModalEsqueciSenhaMobile() {
  document.getElementById('modal-esqueci-senha')?.classList.remove('hidden');
}

function fecharModalEsqueciSenhaMobile() {
  document.getElementById('modal-esqueci-senha')?.classList.add('hidden');
  const email = document.getElementById('m-recup-email');
  const cnh = document.getElementById('m-recup-cnh');
  const nv = document.getElementById('m-recup-nova-senha');
  const cf = document.getElementById('m-recup-confirma-senha');
  if (email) email.value = '';
  if (cnh) cnh.value = '';
  if (nv) nv.value = '';
  if (cf) cf.value = '';
}

async function handleRedefinicaoSimplesMobile(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const btn = document.getElementById('btn-m-redefinir');
  const email = (document.getElementById('m-recup-email')?.value || '').trim().toLowerCase();
  const cnhDigitada = (document.getElementById('m-recup-cnh')?.value || '').replace(/\D/g, '').trim();
  const novaSenha = (document.getElementById('m-recup-nova-senha')?.value || '').trim();
  const confirmaSenha = (document.getElementById('m-recup-confirma-senha')?.value || '').trim();

  if (!email || !cnhDigitada) {
    alert("Informe o e-mail e os números da sua CNH.");
    return;
  }

  if (novaSenha.length < 4) {
    alert("⚠️ A nova senha deve ter no mínimo 4 caracteres.");
    return;
  }

  if (novaSenha !== confirmaSenha) {
    alert("⚠️ A confirmação da nova senha não confere.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Verificando dados...`;
  }

  try {
    // Invoca a mesma função RPC que acabamos de validar com extensions.crypt e extensions.gen_salt
    const { data, error } = await db.rpc('redefinir_senha_cnh', {
      p_email: email,
      p_cnh: cnhDigitada,
      p_nova_senha: novaSenha
    });

    if (error) throw error;

    if (!data || !data.success) {
      throw new Error(data?.message || "E-mail ou CNH não conferem com o cadastro.");
    }

    fecharModalEsqueciSenhaMobile();
    alert("✅ Senha atualizada com sucesso! Você já pode entrar com a nova senha.");
  } catch (err) {
    alert("Erro: " + (err.message || "Falha ao atualizar a senha."));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>Atualizar Minha Senha</span> <i class="ph-bold ph-check text-base"></i>`;
    }
  }
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
window.abrirModalEsqueciSenhaMobile = abrirModalEsqueciSenhaMobile;
window.fecharModalEsqueciSenhaMobile = fecharModalEsqueciSenhaMobile;
window.handleRedefinicaoSimplesMobile = handleRedefinicaoSimplesMobile;
window.abrirModalTrocarSenha = abrirModalTrocarSenha;
window.fecharModalTrocarSenha = fecharModalTrocarSenha;
window.handleAlterarMinhaSenha = handleAlterarMinhaSenha;
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
window.obterMediaConsumoEsperada = obterMediaConsumoEsperada;
window.exibirPopUpAlerta = exibirPopUpAlerta;
window.aoMudarVeiculoMobile = aoMudarVeiculoMobile;
window.exibirFormularioDevolucaoMobile = exibirFormularioDevolucaoMobile;
window.manterTelaAtiva = manterTelaAtiva;
window.liberarTelaAtiva = liberarTelaAtiva;
window.iniciarRastreamentoIntervaladoGPS = iniciarRastreamentoIntervaladoGPS;
window.pararRastreamentoGPS = pararRastreamentoGPS;
window.renderPreviewCardCarroMobile = renderPreviewCardCarroMobile;
window.obterNomeMotoristaFormatado = obterNomeMotoristaFormatado;
window.atualizarKpisMotoristaMobile = atualizarKpisMotoristaMobile;
window.limparFiltrosDataMotorista = limparFiltrosDataMotorista;