// =========================================================================
// 1. CONFIGURAÇÃO DO SUPABASE E ESTADOS GLOBAIS
// =========================================================================
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = (window.supabase && typeof window.supabase.createClient === 'function')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAIL = "admin@arvo.tec.br";
const FIN_ADMIN_EMAIL = "admfin@arvo.tec.br";

const validarNumeroCNH = (cnh) => {
  if (!cnh) return false;
  const limpo = String(cnh).replace(/\D/g, '');
  return /^\d{11}$/.test(limpo) && !/^(\d)\1{10}$/.test(limpo);
};

let usuarios = [];
let veiculos = [];
let rotas = [];
let abastecimentos = [];
let listaModelosReferencia = [];
let currentUserIndex = 0;

// =========================================================================
// 2. CONTROLE DE SESSÃO, PERMISSÕES E LOGOUT
// =========================================================================
function verificarSessaoUsuario() {
  const sessaoRaw = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  if (!sessaoRaw) {
    window.location.href = "login.html";
    return null;
  }
  try {
    return JSON.parse(sessaoRaw);
  } catch (e) {
    return { email: sessaoRaw };
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

function ehAdminMaster() {
  const sessao = verificarSessaoUsuario();
  return (sessao?.email || '').toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
}

function ehGestorOuAdmin() {
  const sessao = verificarSessaoUsuario();
  const email = (sessao?.email || '').toLowerCase().trim();
  return email === ADMIN_EMAIL.toLowerCase().trim() || email === FIN_ADMIN_EMAIL.toLowerCase().trim();
}

function aplicarPermissoesUsuario() {
  const sessao = verificarSessaoUsuario();
  if (!sessao) return;

  const btnGestao = document.getElementById('btn-mod-gestao');
  const podeVerGestao = ehGestorOuAdmin();
  const podeEditarCadastros = ehAdminMaster();

  if (btnGestao) {
    if (podeVerGestao) {
      btnGestao.classList.remove('hidden');
    } else {
      btnGestao.classList.add('hidden');
      const modGestao = document.getElementById('module-gestao');
      if (modGestao && !modGestao.classList.contains('hidden')) {
        setModule('operacao');
      }
    }
  }

  const subtabCadVeiculos = document.getElementById('subtab-cad-veiculos');
  const subtabCadUsuarios = document.getElementById('subtab-cad-usuarios');
  const viewCadVeiculos = document.getElementById('view-cad-veiculos');
  const viewCadUsuarios = document.getElementById('view-cad-usuarios');

  if (!podeEditarCadastros) {
    if (subtabCadVeiculos) subtabCadVeiculos.classList.add('hidden');
    if (subtabCadUsuarios) subtabCadUsuarios.classList.add('hidden');

    if (viewCadVeiculos && !viewCadVeiculos.classList.contains('hidden')) setSubTab('gestao', 'dashboard');
    if (viewCadUsuarios && !viewCadUsuarios.classList.contains('hidden')) setSubTab('gestao', 'dashboard');

    document.querySelectorAll('.btn-admin-only').forEach(btn => {
      btn.style.display = 'none';
    });
  } else {
    if (subtabCadVeiculos) subtabCadVeiculos.classList.remove('hidden');
    if (subtabCadUsuarios) subtabCadUsuarios.classList.remove('hidden');
    document.querySelectorAll('.btn-admin-only').forEach(btn => {
      btn.style.display = '';
    });
  }
}

function atualizarUsuarioNoCabecalho() {
  if (usuarios.length === 0) return;
  const u = usuarios[currentUserIndex] || usuarios[0];
  if (!u) return;
  
  const display = document.getElementById('topUserDisplay') || document.getElementById('header-user-nome');
  const cnh = document.getElementById('topUserCnh') || document.getElementById('header-user-cnh');
  const inputUsuario = document.getElementById('form-inicio-Usuario');

  if (display) display.innerText = `${u.nome} (${u.email})`;
  if (cnh) cnh.innerText = `CNH: ${u.cnh || 'Pendente'}`;
  if (inputUsuario) inputUsuario.value = `${u.nome} <${u.email}>`;
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
// 2.1 COORDENADAS BASE DE LOCALIZAÇÃO ESCRITÓRIOS
// =========================================================================
const COORDENADAS_BASES = {
  "BASE CENTRAL ALEGRE": { lat: -20.761921434859808, lng: -41.533884461049986 },
  "ALEGRE": { lat: -20.761921434859808, lng: -41.533884461049986 },
  "GUAÇUÍ": { lat: -20.770687031454834, lng: -41.674244082674676 },
  "CASTELO": { lat: -20.60686706579922, lng: -41.20409608718904 },
  "MUNIZ FREIRE": { lat: -20.463385075249683, lng: -41.41357126008319 },
  "LOCADORA CACHOEIRO": { lat: -20.858238836550413, lng: -41.12056777598245 },
  "LOCADORA CASTELO": { lat: -20.602361586924207, lng: -41.21215241943304 }
};

async function obterCoordenadasPartida(origemTexto) {
  if (navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 4000
        });
      });
      return {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        tipo: 'GPS_REAL'
      };
    } catch (e) {
      console.warn("GPS do aparelho indisponível, recorrendo à base fixa:", e.message);
    }
  }

  const chave = (origemTexto || '').trim().toUpperCase();
  if (COORDENADAS_BASES[chave]) {
    return { ...COORDENADAS_BASES[chave], tipo: 'BASE_FIXA' };
  }

  return null;
}

// =========================================================================
// 3. NAVEGAÇÃO ENTRE MÓDULOS E SUB-ABAS
// =========================================================================
function setModule(mod) {
  if (mod === 'gestao' && !ehGestorOuAdmin()) {
    alert("Acesso restrito: Apenas a administração tem permissão para acessar o Painel de Gestão.");
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
      if (view) {
        view.classList.add('hidden');
        view.style.display = 'none';
      }
    });

    const activeView = document.getElementById(`view-${tab}`) || document.getElementById(`tab-${tab}`);
    if (activeView) {
      activeView.classList.remove('hidden');
      activeView.style.display = 'block';
    }

    const btnSaida = document.getElementById('subtab-saida');
    const btnRetorno = document.getElementById('subtab-retorno');
    const btnRotas = document.getElementById('subtab-minhas-rotas');

    if (btnSaida) {
      btnSaida.className = "flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 whitespace-nowrap " +
        (tab === 'saida' ? "bg-[#1E5E3A] text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50");
    }
    if (btnRetorno) {
      btnRetorno.className = "flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 whitespace-nowrap " +
        (tab === 'retorno' ? "bg-[#FFFBEB] border-2 border-[#FDE68A] text-[#B45309] shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50");
    }
    if (btnRotas) {
      btnRotas.className = "flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-xs sm:text-sm transition-all active:scale-95 whitespace-nowrap " +
        (tab === 'minhas-rotas' ? "bg-[#1E5E3A] text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50");
    }

    if (tab === 'minhas-rotas' && typeof renderHistorico === 'function') renderHistorico();
    if (tab === 'retorno') {
      if (typeof renderSelectRotasFim === 'function') renderSelectRotasFim();
      if (typeof renderPreviewCardRetorno === 'function') renderPreviewCardRetorno();
    }
    if (tab === 'saida') {
      if (typeof renderSelectVeiculosInicio === 'function') renderSelectVeiculosInicio();
      if (typeof renderPreviewCardSaida === 'function') renderPreviewCardSaida();
    }

  } else {
    if ((tab === 'cad-veiculos' || tab === 'cad-usuarios') && typeof ehAdminMaster === 'function' && !ehAdminMaster()) {
      alert("Acesso restrito: Usuário sem permissão para cadastrar ou editar veículos e condutores.");
      tab = 'dashboard';
    }

    const abasGestao = ['dashboard', 'cad-veiculos', 'cad-usuarios', 'manutencao'];
    const classeInativo = "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all active:scale-95 cursor-pointer whitespace-nowrap";
    const classeAtivo   = "flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm bg-[#1E5E3A] text-white shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap";

    abasGestao.forEach(t => {
      const view = document.getElementById(`view-${t}`);
      const btn = document.getElementById(`subtab-${t}`);
      if (view) {
        view.classList.add('hidden');
        view.style.display = 'none';
      }
      if (btn) {
        btn.className = classeInativo;
        const icon = btn.querySelector('i');
        if (icon) {
          icon.classList.remove('text-yellow-300');
          icon.classList.add('text-[#1E5E3A]');
        }
      }
    });

    const activeView = document.getElementById(`view-${tab}`);
    const activeBtn = document.getElementById(`subtab-${tab}`);

    if (activeView) {
      activeView.classList.remove('hidden');
      activeView.style.display = 'block';
    }
    if (activeBtn) {
      activeBtn.className = classeAtivo;
      const icon = activeBtn.querySelector('i');
      if (icon) {
        icon.classList.remove('text-[#1E5E3A]');
        icon.classList.add('text-yellow-300');
      }
    }

    if (tab === 'manutencao') {
      if (typeof popularSelectManutencaoAba === 'function') popularSelectManutencaoAba();
      if (typeof carregarHistoricoManutencoes === 'function') carregarHistoricoManutencoes();
    } else if (tab === 'dashboard') {
      if (typeof renderFleetGrid === 'function') renderFleetGrid();
      if (typeof renderDashboardKPIs === 'function') renderDashboardKPIs();
    } else if (tab === 'cad-veiculos') {
      if (typeof renderTabelaVeiculosCad === 'function') renderTabelaVeiculosCad();
    } else if (tab === 'cad-usuarios') {
      if (typeof renderTabelaUsuariosCad === 'function') renderTabelaUsuariosCad();
    }
  }
}

function popularSelectManutencaoAba() {
  const sel = document.getElementById('manut-aba-veiculo');
  if (!sel) return;

  sel.innerHTML = '<option value="">Selecione o veículo...</option>';
  const veiculosAtivos = (veiculos || []).filter(v => (v.status || '').trim() !== 'Fora de Uso');

  if (veiculosAtivos.length === 0) {
    sel.innerHTML = '<option value="">Nenhum veículo ativo encontrado</option>';
    return;
  }

  veiculosAtivos.forEach(v => {
    const identificador = v.placa || v.nome_frota || v.id;
    const nome = v.nome_frota || v.identificador || v.id;
    const placa = v.placa ? `[${v.placa}]` : '';
    const marca = v.marca ? `- ${v.marca}` : '';
    const statusTag = v.status ? `(${v.status})` : '';

    sel.innerHTML += `<option value="${identificador}">${nome} ${marca} ${placa} ${statusTag}</option>`;
  });
}

function atualizarKmManutencaoAba() {
  const selValor = document.getElementById('manut-aba-veiculo')?.value;
  const inputKm = document.getElementById('manut-aba-km');
  if (!inputKm || !selValor) return;

  const v = (veiculos || []).find(item => 
    String(item.placa) === String(selValor) || 
    String(item.nome_frota) === String(selValor) || 
    String(item.uuid_veiculos) === String(selValor) ||
    String(item.id) === String(selValor)
  );

  if (v) {
    inputKm.value = v.km_atual || 0;
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

    const { data: dadosAbast } = await db.from('abastecimentos').select('*').order('data_hora', { ascending: false });
    if (dadosAbast) abastecimentos = dadosAbast;

    try {
      const { data: dadosRef } = await db.from('modelos_referencia').select('*');
      if (dadosRef) listaModelosReferencia = dadosRef;
    } catch (e) {}

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

  const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
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

  // Verificação de Reserva Ativa
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
        if (emailDono !== emailAtual && !ehGestorOuAdmin()) {
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
  const condutorAutorizado = (veiculo.motorista_autorizado || '').toLowerCase().trim();
  const condutorLogado = (user?.email || '').toLowerCase().trim();
  const ehAdmin = condutorLogado === ADMIN_EMAIL.toLowerCase().trim();

  if (isExterno) {
    if (!condutorAutorizado) {
      alert("⚠️ Este veículo externo não possui condutor autorizado configurado. Contate o Administrador.");
      return;
    }

    if (condutorLogado !== condutorAutorizado && !ehAdmin) {
      alert(
        `⛔ ACESSO RESTRITO!\n\n` +
        `Este veículo externo é de uso exclusivo do condutor:\n` +
        `👤 ${veiculo.motorista_autorizado}\n\n` +
        `Por favor, utilize um veículo da frota regular.`
      );
      return;
    }
  }

  let kmSaidaFinal = (isExterno && !isNaN(kmInformadoInput) && kmInformadoInput > 0) ? kmInformadoInput : kmBanco;

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;
  }

  const dataHoraSaidaAtual = new Date().toISOString();
  const coordsPartida = await obterCoordenadasPartida(origemFinal);

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
    status: 'Em Uso',
    coords_origem: coordsPartida,
    coordenadas: coordsPartida ? [{ lat: coordsPartida.lat, lng: coordsPartida.lng, timestamp: dataHoraSaidaAtual }] : []
  };

  try {
    const { data: inserido, error: erroRota } = await db
      .from('rotas')
      .insert([novaRota])
      .select('id');

    if (erroRota) throw erroRota;

    const rotaIdCriada = (inserido && inserido[0]) ? inserido[0].id : '';

    const payloadUpdateVeiculo = { status: 'Em Uso' };
    if (isExterno && kmSaidaFinal > kmBanco) {
      payloadUpdateVeiculo.km_atual = kmSaidaFinal;
    }

    let qVeic = db.from('veiculos').update(payloadUpdateVeiculo);
    if (placaCarro) {
      qVeic = qVeic.eq('placa', placaCarro);
    } else {
      qVeic = qVeic.eq('id', veiculo.id);
    }
    await qVeic;

    e.target.reset();
    if (typeof toggleOutroOrigem === 'function') toggleOutroOrigem('');
    
    alert(`✅ Rota ${rotaIdCriada ? '#' + rotaIdCriada : ''} iniciada com sucesso!`);
    await carregarTodosDadosDoBanco();
    setSubTab('operacao', 'retorno');
  } catch (err) {
    console.error("Erro ao iniciar rota no banco:", err);
    alert("Erro ao gravar rota no Supabase: " + (err.message || JSON.stringify(err)));
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

  const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  let sessao;
  try { sessao = JSON.parse(rawSessao); } catch { sessao = { email: rawSessao }; }
  const emailLogado = (sessao?.email || '').toLowerCase().trim();
  const responsavelRota = (rota.responsavel || '').toLowerCase().trim();
  const podeFinalizar = ehGestorOuAdmin() || (emailLogado === responsavelRota);

  if (!podeFinalizar) {
    alert(`⛔ Permissão Negada: Apenas o condutor responsável (${rota.responsavel}) ou os administradores podem encerrar esta rota.`);
    return;
  }

  const veiculo = (veiculos || []).find(v => 
    String(v.id) === String(rota?.veiculo_id) || 
    String(v.uuid_veiculos) === String(rota?.veiculo_id) || 
    String(v.nome_frota) === String(rota?.veiculo_id) || 
    String(v.placa) === String(rota?.veiculo_id)
  ) || {};

  if (kmFinal < Number(rota.km_saida)) {
    alert("Erro: O KM Final não pode ser inferior ao KM de Saída!");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;
  }

  const situacao = document.querySelector('input[name="situacao_carro"]:checked')?.value || 'SEM';
  let anomaliaTexto = situacao === 'COM' ? (document.getElementById('form-fim-anomalia')?.value?.trim() || '') : '';

  const deltaKm = kmFinal - Number(rota.km_saida);

  let histAbast = [];
  if (typeof abastecimentos !== 'undefined' && Array.isArray(abastecimentos) && abastecimentos.length > 0) {
    histAbast = abastecimentos;
  } else {
    const localCache = localStorage.getItem('arvo_cache_abastecimentos');
    if (localCache) {
      try { histAbast = JSON.parse(localCache); } catch (e) { histAbast = []; }
    }
  }

  let medConsumo = 12.3;
  if (typeof obterMediaConsumoEsperada === 'function') {
    try {
      medConsumo = obterMediaConsumoEsperada(veiculo, null, histAbast);
    } catch (e) {
      medConsumo = 12.3;
    }
    if (!medConsumo || isNaN(medConsumo) || medConsumo <= 0) medConsumo = 12.3;
  } else {
    medConsumo = (Number(veiculo.consumo_min || 10) + Number(veiculo.consumo_max || 14)) / 2;
  }

  const litrosEst = Number((deltaKm / medConsumo).toFixed(2));
  const capTanque = Number(veiculo.tanque || 45);
  const tanqueAnterior = (veiculo.tanque_virtual !== null && veiculo.tanque_virtual !== undefined)
    ? Number(veiculo.tanque_virtual)
    : capTanque;
  
  const novoTanqueVirtual = Number(Math.max(0, tanqueAnterior - litrosEst).toFixed(2));
  const dataHoraRetornoAtual = new Date().toISOString();
  const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str));

  try {
    const { error: erroRota } = await db.from('rotas').update({
      km_retorno: kmFinal,
      km_total: deltaKm,
      consumo_litros: litrosEst,
      destino: destinoFinal,
      status: 'Concluida',
      anomalia: anomaliaTexto,
      data_retorno: dataHoraRetornoAtual
    }).eq('id', rota.id);

    if (erroRota) throw erroRota;

    const condicoesVeiculo = [];
    if (veiculo.uuid_veiculos && isUUID(veiculo.uuid_veiculos)) condicoesVeiculo.push(`uuid_veiculos.eq.${veiculo.uuid_veiculos}`);
    if (veiculo.id && isUUID(veiculo.id)) condicoesVeiculo.push(`id.eq.${veiculo.id}`);
    if (veiculo.nome_frota) condicoesVeiculo.push(`nome_frota.eq.${veiculo.nome_frota}`);
    if (veiculo.placa) condicoesVeiculo.push(`placa.eq.${veiculo.placa}`);
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
      await db.from('veiculos')
        .update(payloadVeiculo)
        .or(condicoesVeiculo.join(','));
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
    if (typeof toggleOutroDestino === 'function') toggleOutroDestino('');
    document.getElementById('fim-detalhes-viagem')?.classList.add('hidden');
    if (typeof toggleAnomaliaInput === 'function') toggleAnomaliaInput(false);

    alert(`Rota #${rota.id} encerrada com sucesso!\nConsumo estimado: ~${litrosEst} L (Média: ${medConsumo} km/L)\nTanque virtual: ~${novoTanqueVirtual} L restantes`);
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
// GOOGLE MAPS: VISUALIZAÇÃO DE TRAJETO NA ABA MINHAS ROTAS
// =========================================================================
let gMapHistorico = null;
let marcadoresHistorico = [];
let polylineHistorico = null;
let rotaLinhaSelecionada = null;

function initGoogleMapsHistorico() {
  const container = document.getElementById('mapa-historico-rotas');
  if (!container || gMapHistorico || typeof google === 'undefined') return;

  const defaultCenter = { lat: -20.7633, lng: -41.5331 };

  gMapHistorico = new google.maps.Map(container, {
    center: defaultCenter,
    zoom: 11,
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    zoomControl: true,
    streetViewControl: false,
    fullscreenControl: false
  });
}

function limparElementosMapa() {
  if (marcadoresHistorico && marcadoresHistorico.length > 0) {
    marcadoresHistorico.forEach(m => m.setMap(null));
    marcadoresHistorico = [];
  }
  if (polylineHistorico) {
    polylineHistorico.setMap(null);
    polylineHistorico = null;
  }
}

async function plotarRotaNoMapa(rotaId) {
  initGoogleMapsHistorico();
  if (!gMapHistorico) return;

  const rota = (rotas || []).find(r => String(r.id) === String(rotaId));
  if (!rota) return;

  const lblStatus = document.getElementById('mapa-status-rota');
  const lblTipo = document.getElementById('mapa-tipo-tracado');
  if (lblStatus) {
    lblStatus.innerText = `Rota #${rota.id} (${rota.placa || rota.veiculo_id || ''})`.trim();
    lblStatus.classList.remove('text-slate-400');
    lblStatus.classList.add('text-slate-800', 'font-extrabold');
  }

  // Destaca a linha clicada na tabela
  document.querySelectorAll('#tabelaHistorico tr').forEach(tr => tr.classList.remove('bg-emerald-50/80'));
  const trAtual = document.getElementById(`tr-rota-${rota.id}`);
  if (trAtual) trAtual.classList.add('bg-emerald-50/80');

  limparElementosMapa();

  const buscarLatLng = (endereco) => {
    return new Promise((resolve) => {
      if (!endereco || typeof google === 'undefined') return resolve(null);
      const chaveBase = (endereco || '').trim().toUpperCase();
      if (typeof COORDENADAS_BASES !== 'undefined' && COORDENADAS_BASES[chaveBase]) {
        return resolve(new google.maps.LatLng(COORDENADAS_BASES[chaveBase].lat, COORDENADAS_BASES[chaveBase].lng));
      }
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: endereco + ', ES, Brasil' }, (results, status) => {
        if (status === 'OK' && results && results[0]) resolve(results[0].geometry.location);
        else resolve(null);
      });
    });
  };

  const bounds = new google.maps.LatLngBounds();

  // 1. Trata os pontos de GPS salvos no banco
  let coords = rota.coordenadas;
  if (typeof coords === 'string') {
    try { coords = JSON.parse(coords); } catch (e) { coords = []; }
  }

  // Se houver rastro real do GPS (2 ou mais pontos válidos)
  if (Array.isArray(coords) && coords.length >= 2) {
    if (lblTipo) lblTipo.innerText = 'Trajeto Real (Ajustado a Rodovias)';

    const pInicio = new google.maps.LatLng(Number(coords[0].lat), Number(coords[0].lng));
    const pFim = new google.maps.LatLng(Number(coords[coords.length - 1].lat), Number(coords[coords.length - 1].lng));

    const mInicio = new google.maps.Marker({
      position: pInicio,
      map: gMapHistorico,
      title: `Início: ${rota.origem || 'Origem'}`,
      label: 'A'
    });

    const mFim = new google.maps.Marker({
      position: pFim,
      map: gMapHistorico,
      title: `Fim: ${rota.destino || 'Em trânsito'}`,
      label: 'B'
    });

    marcadoresHistorico.push(mInicio, mFim);

    // Amostragem de waypoints intermediários para não ultrapassar a cota da Directions API (máx. 20 a 23 pontos)
    const intermediarios = coords.slice(1, -1);
    const waypoints = (intermediarios.length > 20
      ? intermediarios.filter((_, idx) => idx % Math.ceil(intermediarios.length / 20) === 0)
      : intermediarios
    ).map(p => ({
      location: new google.maps.LatLng(Number(p.lat), Number(p.lng)),
      stopover: false
    }));

    const directionsService = new google.maps.DirectionsService();

    directionsService.route({
      origin: pInicio,
      destination: pFim,
      waypoints: waypoints,
      optimizeWaypoints: false,
      travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
      if (status === 'OK' && result) {
        polylineHistorico = new google.maps.Polyline({
          path: result.routes[0].overview_path,
          geodesic: true,
          strokeColor: '#1E5E3A',
          strokeOpacity: 0.9,
          strokeWeight: 4,
          map: gMapHistorico
        });
        result.routes[0].overview_path.forEach(pt => bounds.extend(pt));
      } else {
        // Fallback: se a API de trânsito falhar, une os pontos geográficos brutos do GPS
        const fallbackPath = coords.map(p => new google.maps.LatLng(Number(p.lat), Number(p.lng)));
        polylineHistorico = new google.maps.Polyline({
          path: fallbackPath,
          geodesic: true,
          strokeColor: '#1E5E3A',
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map: gMapHistorico
        });
        fallbackPath.forEach(pt => bounds.extend(pt));
      }

      gMapHistorico.fitBounds(bounds);

      // Trava de segurança para evitar zoom microscópico em paradas
      google.maps.event.addListenerOnce(gMapHistorico, 'idle', () => {
        if (gMapHistorico.getZoom() > 16) {
          gMapHistorico.setZoom(16);
        }
      });
    });

    return;
  }

  // 2. Se não houver pontos suficientes (ou 1 único ponto gravado), calcula rota entre Origem e Destino
  const ptOrigem = await buscarLatLng(rota.origem || 'Alegre');
  const ptDestino = rota.destino ? await buscarLatLng(rota.destino) : null;

  if (ptOrigem) {
    const mOrigem = new google.maps.Marker({ position: ptOrigem, map: gMapHistorico, title: `Origem: ${rota.origem}`, label: 'A' });
    marcadoresHistorico.push(mOrigem);
    bounds.extend(ptOrigem);
  }

  if (ptDestino) {
    const mDestino = new google.maps.Marker({ position: ptDestino, map: gMapHistorico, title: `Destino: ${rota.destino}`, label: 'B' });
    marcadoresHistorico.push(mDestino);
    bounds.extend(ptDestino);
  }

  if (ptOrigem && ptDestino) {
    if (lblTipo) lblTipo.innerText = 'Traçado por Rodovia (Estimado)';
    const directionsService = new google.maps.DirectionsService();
    directionsService.route({
      origin: ptOrigem,
      destination: ptDestino,
      travelMode: google.maps.TravelMode.DRIVING
    }, (response, status) => {
      if (status === 'OK' && response) {
        polylineHistorico = new google.maps.Polyline({
          path: response.routes[0].overview_path,
          geodesic: true,
          strokeColor: '#1E5E3A',
          strokeOpacity: 0.85,
          strokeWeight: 4,
          map: gMapHistorico
        });
        gMapHistorico.fitBounds(bounds);
      } else {
        polylineHistorico = new google.maps.Polyline({
          path: [ptOrigem, ptDestino],
          geodesic: true,
          strokeColor: '#94a3b8',
          strokeOpacity: 0.7,
          strokeWeight: 2,
          map: gMapHistorico
        });
        gMapHistorico.fitBounds(bounds);
      }
    });
  } else if (ptOrigem) {
    if (lblTipo) lblTipo.innerText = 'Origem na Base';
    gMapHistorico.setCenter(ptOrigem);
    gMapHistorico.setZoom(14);
  }
}

// =========================================================================
// HELPER: FORMATAÇÃO DE CRONÔMETRO
// =========================================================================
function formatarTempoDecorrido(dataIso) {
  if (!dataIso) return "00h 00m 00s";
  const inicio = new Date(dataIso).getTime();
  const agora = new Date().getTime();
  const deltaMs = Math.max(0, agora - inicio);

  const totalSegundos = Math.floor(deltaMs / 1000);
  const horas = Math.floor(totalSegundos / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(horas)}h ${pad(minutos)}m ${pad(segundos)}s`;
}

// =========================================================================
// OBTÉM O CAMINHO DA IMAGEM DO CARRO
// =========================================================================
function mapearImagemCarro(carro) {
  if (carro?.foto_url && carro.foto_url.trim() !== '') return carro.foto_url;
  if (carro?.icone_url && carro.icone_url.trim() !== '') return carro.icone_url;

  const ref = `${carro?.nome_frota || ''} ${carro?.marca || ''} ${carro?.identificador || ''}`.toUpperCase();

  if (ref.includes('MOBI')) return '/imagens/mobi.png';
  if (ref.includes('COMPASS') || ref.includes('JEEP')) return '/imagens/jeepcomp.png';
  if (ref.includes('GOL')) return '/imagens/gol.png';
  if (ref.includes('COROLLA')) return '/imagens/corolla.png';
  if (ref.includes('STRADA')) return '/imagens/strada.png';
  if (ref.includes('ARGO')) return '/imagens/argo.png';
  if (ref.includes('HB20')) return '/imagens/hb20.png';
  if (ref.includes('POLO')) return '/imagens/polo.png';

  return '/imagens/mobi.png';
}

function obterImagemVeiculo(v) {
  return mapearImagemCarro(v);
}

// =========================================================================
// GERADOR MODULAR DE CARD VISUAL
// =========================================================================
function montarCardVeiculoHTML(veiculo, options = {}) {
  const {
    rotaAtiva = null,
    acaoBotao = null,
    exibirTimer = false
  } = options;

  const vPlaca = (veiculo.placa || '').trim().toUpperCase();
  const vNome = (veiculo.nome_frota || veiculo.id || '').trim().toUpperCase();
  const nomeVeiculo = veiculo.nome_frota || veiculo.identificador || veiculo.placa || veiculo.id || 'Veículo';
  const isExterno = (veiculo.tipo_frota || '').toUpperCase() === 'EXTERNO';
  const isEmUso = (rotaAtiva != null) || veiculo.status === 'Em Uso';

  const imagemCarroFinal = mapearImagemCarro(veiculo);

  const rotasCarro = (typeof rotas !== 'undefined' ? rotas : []).filter(r => {
    const rPlaca = (r.placa || '').trim().toUpperCase();
    const rVeic = (r.veiculo_id ? String(r.veiculo_id) : '').trim().toUpperCase();
    return ((vPlaca && (rPlaca === vPlaca || rVeic === vPlaca)) || (vNome && rVeic === vNome)) &&
           r.status === 'Concluida' && Number(r.km_total) > 0 && Number(r.consumo_litros) > 0;
  });

  let mediaCalculada = 0;
  if (rotasCarro.length > 0) {
    const kmTot = rotasCarro.reduce((a, b) => a + Number(b.km_total || 0), 0);
    const litTot = rotasCarro.reduce((a, b) => a + Number(b.consumo_litros || 0), 0);
    if (kmTot > 0 && litTot > 0) mediaCalculada = kmTot / litTot;
  }
  if (mediaCalculada <= 3 || mediaCalculada >= 35) {
    mediaCalculada = ((Number(veiculo.consumo_min || 10) + Number(veiculo.consumo_max || 14)) / 2);
  }

  const capTanque = Number(veiculo.tanque || 47);
  let litrosAtuais = capTanque;

  if (!isExterno) {
    const ultimosAbasts = (typeof abastecimentos !== 'undefined' ? abastecimentos : [])
      .filter(a => {
        const aPlaca = (a.placa || '').trim().toUpperCase();
        const aVeic = (a.veiculo_id ? String(a.veiculo_id) : '').trim().toUpperCase();
        return (vPlaca && (aPlaca === vPlaca || aVeic === vPlaca)) || (vNome && aVeic === vNome);
      })
      .sort((a, b) => new Date(b.data_hora) - new Date(a.data_hora));

    const dataUltimoAbast = ultimosAbasts[0]?.data_hora ? new Date(ultimosAbasts[0].data_hora).getTime() : 0;

    const rotasPosAbast = (typeof rotas !== 'undefined' ? rotas : []).filter(r => {
      const rPlaca = (r.placa || '').trim().toUpperCase();
      const rVeic = (r.veiculo_id ? String(r.veiculo_id) : '').trim().toUpperCase();
      const bateuCarro = (vPlaca && (rPlaca === vPlaca || rVeic === vPlaca)) || (vNome && rVeic === vNome);
      const dataRota = new Date(r.data_saida || r.data_retorno || 0).getTime();
      return bateuCarro && r.status === 'Concluida' && dataRota >= dataUltimoAbast;
    });

    const litrosConsumidosPosAbast = rotasPosAbast.reduce((acc, r) => {
      let l = Number(r.consumo_litros || 0);
      if ((!l || isNaN(l) || l <= 0) && Number(r.km_total) > 0) {
        l = Number(r.km_total) / (mediaCalculada > 0 ? mediaCalculada : 12.3);
      }
      return acc + l;
    }, 0);

    if (litrosConsumidosPosAbast > 0) {
      litrosAtuais = Math.max(0, capTanque - litrosConsumidosPosAbast);
    } else if (veiculo.tanque_virtual !== null && veiculo.tanque_virtual !== undefined) {
      litrosAtuais = Number(veiculo.tanque_virtual);
    }

    litrosAtuais = Number(litrosAtuais.toFixed(1));
  }

  let segmentosHTML = '';
  if (!isExterno) {
    const totalSegmentos = 16;
    const proporcao = Math.max(0, Math.min(1, capTanque > 0 ? (litrosAtuais / capTanque) : 1));
    const segmentosCheios = Math.round(proporcao * totalSegmentos);

    for (let i = totalSegmentos; i >= 1; i--) {
      const estaCheio = i <= segmentosCheios;
      let corSegmento = 'bg-slate-800';
      if (estaCheio) {
        if (i === 1) corSegmento = 'bg-rose-600 shadow-sm';
        else if (i === 2) corSegmento = 'bg-amber-500';
        else if (isEmUso) corSegmento = i <= 6 ? 'bg-amber-600' : 'bg-amber-400';
        else corSegmento = i <= 6 ? 'bg-emerald-600' : 'bg-emerald-400';
      }
      segmentosHTML += `<div class="h-1 rounded-xs ${corSegmento}"></div>`;
    }
  }

  let condutorNome = '';
  if (isEmUso && rotaAtiva) {
    const emailDono = (rotaAtiva.responsavel || '').toLowerCase().trim();
    const uObj = (typeof usuarios !== 'undefined' ? usuarios : []).find(u => (u.email || '').toLowerCase().trim() === emailDono);
    condutorNome = uObj?.nome || emailDono.split('@')[0];
  } else if (isExterno && veiculo.motorista_autorizado) {
    const emailDono = veiculo.motorista_autorizado.toLowerCase().trim();
    const uObj = (typeof usuarios !== 'undefined' ? usuarios : []).find(u => (u.email || '').toLowerCase().trim() === emailDono);
    condutorNome = uObj?.nome || veiculo.motorista_autorizado;
  }

  let timerHTML = '';
  if (exibirTimer && rotaAtiva?.data_saida) {
    const tempoInicial = formatarTempoDecorrido(rotaAtiva.data_saida);
    timerHTML = `
      <div class="bg-black/60 border border-amber-500/40 rounded-xl px-3.5 py-2 mb-3 flex items-center justify-between text-xs shadow-inner">
        <div class="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
          <i class="ph-bold ph-timer text-sm animate-pulse"></i>
          <span>Tempo de Rota</span>
        </div>
        <span class="font-mono font-black text-amber-300 text-sm" data-timer-start="${rotaAtiva.data_saida}">
          ${tempoInicial}
        </span>
      </div>
    `;
  }

  let mioloHTML = '';
  if (isExterno) {
    mioloHTML = `
      <div class="space-y-3">
        <div class="flex justify-between items-baseline border-b border-white/5 pb-2">
          <span class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Hodômetro Registrado</span>
          <span class="font-mono font-black text-white text-xl tracking-tight">${Number(veiculo.km_atual || 0).toLocaleString('pt-BR')} km</span>
        </div>
        <div class="bg-black/40 p-3 rounded-xl border border-white/5 space-y-1 text-xs">
          <div class="flex justify-between items-baseline">
            <span class="text-slate-300 text-[11px]">Consumo Médio:</span>
            <span class="font-mono font-bold text-cyan-300">${Number(mediaCalculada).toFixed(1)} km/L</span>
          </div>
          <span class="text-[10px] text-slate-400 block font-medium">Veículo Terceirizado</span>
        </div>
      </div>
    `;
  } else {
    mioloHTML = `
      <div class="grid grid-cols-12 gap-3 items-center">
        <div class="col-span-4 flex flex-col items-center border-r border-white/10 pr-2">
          <span class="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tanque</span>
          <div class="w-5 flex flex-col gap-[2px] bg-black/80 p-1 rounded-md border border-slate-700/80">
            ${segmentosHTML}
          </div>
          <span class="text-[10px] font-mono ${isEmUso ? 'text-amber-300' : 'text-emerald-400'} font-extrabold mt-2 text-center">
            ${Math.round(litrosAtuais)}/${capTanque} L
          </span>
        </div>

        <div class="col-span-8 pl-1 space-y-2.5">
          <div>
            <span class="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
              ${rotaAtiva ? 'Hodômetro de Retorno' : 'Hodômetro Registrado'}
            </span>
            <span class="font-mono font-black text-white text-lg tracking-tight">
              ${Number(veiculo.km_atual || 0).toLocaleString('pt-BR')} km
            </span>
          </div>
          <div class="bg-black/40 p-2.5 rounded-xl border border-white/5 space-y-0.5 text-xs">
            ${rotaAtiva ? `
              <div class="flex justify-between items-baseline">
                <span class="text-slate-300 text-[11px]">Origem:</span>
                <span class="font-medium text-amber-200 truncate max-w-[120px]">${rotaAtiva.origem || 'Base'}</span>
              </div>
              <span class="text-[10px] text-slate-400 block">Saída: ${Number(rotaAtiva.km_saida).toLocaleString('pt-BR')} km</span>
            ` : `
              <div class="flex justify-between items-baseline">
                <span class="text-slate-300 text-[11px]">Consumo Médio:</span>
                <span class="font-mono font-bold text-emerald-300">${Number(mediaCalculada).toFixed(1)} km/L</span>
              </div>
              <span class="text-[10px] text-slate-400 block">Capacidade total: ${capTanque} L</span>
            `}
          </div>
        </div>
      </div>
    `;
  }

  const estiloBg = isEmUso
    ? "background: linear-gradient(180deg, #2b221b 0%, #1e1713 100%); border: 1px solid rgba(217,119,6,0.35);"
    : (isExterno 
        ? "background: linear-gradient(180deg, #182230 0%, #0f172a 100%); border: 1px solid rgba(255,255,255,0.1);"
        : "background: linear-gradient(180deg, #211f1d 0%, #171514 100%); border: 1px solid rgba(255,255,255,0.08);");

  return `
    <div class="relative rounded-3xl p-5 shadow-2xl flex flex-col justify-between text-white overflow-hidden min-h-[420px] w-full transition" style="${estiloBg}">
      <div>
        <div class="flex justify-between items-start mb-2">
          <div class="space-y-1.5">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold uppercase tracking-wider ${isEmUso ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40 animate-pulse' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'} px-2 py-0.5 rounded-full backdrop-blur">
                ● ${isEmUso ? 'Em Rota' : 'Disponível'}
              </span>
              <span class="text-[10px] font-bold ${isExterno ? 'bg-indigo-600/80 text-white' : 'bg-slate-900/80 text-slate-300 border border-white/10'} px-1.5 py-0.5 rounded">
                ${isExterno ? 'EXTERNO' : 'FROTA'}
              </span>
            </div>

            <h3 class="text-xl font-black text-white leading-tight tracking-wide">${nomeVeiculo}</h3>
            <p class="text-xs text-slate-300">${veiculo.marca || '-'}</p>

            <div class="placa-mercosul mt-1">
              <div class="placa-mercosul-header">
                <span class="text-[4px] text-white font-black tracking-tighter">BRASIL</span>
                <span class="w-1.5 h-1 bg-yellow-400 rounded-xs"></span>
              </div>
              <span class="placa-mercosul-txt text-xs">${veiculo.placa || 'SEM-PLACA'}</span>
            </div>
          </div>

          <div class="w-24 h-16 flex items-center justify-end">
            <img src="${imagemCarroFinal}" 
                 alt="${nomeVeiculo}" 
                 class="max-h-14 max-w-full object-contain filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.7)]" 
                 onerror="this.onerror=null; this.src='/imagens/mobi.png';" />
          </div>
        </div>

        <div class="relative z-10 bg-[#141211]/80 backdrop-blur-md rounded-2xl p-4 border border-white/10 my-3 shadow-inner">
          ${timerHTML}
          ${mioloHTML}
          <p class="text-[10px] text-slate-400 italic mt-2.5 truncate border-t border-white/5 pt-2">
            ${condutorNome ? `Condutor: <b class="text-white">${condutorNome}</b>` : (veiculo.anomalias || 'Sem anomalias registradas')}
          </p>
        </div>
      </div>

      ${acaoBotao ? `
        <div class="mt-2">
          <button type="button" onclick="${acaoBotao.onclick}" class="w-full ${acaoBotao.cor} text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-1.5">
            ${acaoBotao.texto}
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderPreviewCardSaida() {
  const container = document.getElementById('preview-card-saida');
  if (!container) return;

  const vId = document.getElementById('form-inicio-veiculo')?.value;
  const veiculo = (veiculos || []).find(v =>
    String(v.id) === String(vId) ||
    String(v.uuid_veiculos) === String(vId) ||
    String(v.placa) === String(vId) ||
    String(v.nome_frota) === String(vId)
  );

  if (veiculo) {
    container.innerHTML = montarCardVeiculoHTML(veiculo, {
      exibirTimer: false,
      acaoBotao: {
        texto: 'Iniciar Rota &rarr;',
        cor: 'bg-[#15803d] hover:bg-[#166534]',
        onclick: "document.getElementById('btn-submit-inicio').click()"
      }
    });
  } else {
    container.innerHTML = `
      <div class="min-h-[420px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-6 text-slate-400 text-xs font-semibold text-center w-full">
        Selecione um veículo ao lado para visualizar a telemetria e o status.
      </div>`;
  }
}

function renderPreviewCardRetorno() {
  const container = document.getElementById('preview-card-retorno');
  if (!container) return;

  const rotaId = document.getElementById('form-fim-rota-select')?.value;
  const rota = (rotas || []).find(r => String(r.id) === String(rotaId));

  if (rota) {
    const veiculo = (veiculos || []).find(v => 
      String(v.id) === String(rota.veiculo_id) || 
      String(v.uuid_veiculos) === String(rota.veiculo_id) || 
      String(v.nome_frota) === String(rota.veiculo_id) || 
      String(v.placa) === String(rota.veiculo_id)
    ) || { nome_frota: rota.veiculo_id, placa: rota.placa, km_atual: rota.km_saida, tanque: 47 };

    container.innerHTML = montarCardVeiculoHTML(veiculo, {
      rotaAtiva: rota,
      exibirTimer: true,
      acaoBotao: {
        texto: 'Encerrar Rota &rarr;',
        cor: 'bg-[#d97706] hover:bg-[#b45309]',
        onclick: "document.getElementById('btn-submit-fim').click()"
      }
    });
  } else {
    container.innerHTML = `
      <div class="min-h-[420px] flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-6 text-slate-400 text-xs font-semibold text-center w-full">
        Selecione uma rota ativa ao lado para conferir os dados da viagem e o tempo de percurso.
      </div>`;
  }
}

function aoMudarVeiculoInicio() {
  atualizarKmInicialPreenchido();
  renderPreviewCardSaida();
}

function aoMudarRotaFim() {
  selecionarRotaFim();
  renderPreviewCardRetorno();
}

// =========================================================================
// 6. GESTÃO DE VEÍCULOS (EXCLUSIVO ADMIN MASTER)
// =========================================================================
function veiculoVisivelParaUsuario(v, user) {
  const tipo = (v?.tipo_frota || '').toUpperCase().trim();
  const isExterno = tipo.includes('EXTERN') || tipo.includes('ESPORADIC');

  if (!isExterno) return true;

  const emailUsuario = (user?.email || '').toLowerCase().trim();
  const adminPadrao = ADMIN_EMAIL.toLowerCase().trim();
  const ehAdmin = emailUsuario === adminPadrao;

  if (ehAdmin) return true;

  const motoristaAutorizado = (v?.motorista_autorizado || '').toLowerCase().trim();
  if (!motoristaAutorizado) return false;

  if (emailUsuario === motoristaAutorizado) return true;
  if (user?.nome && user.nome.toLowerCase().trim() === motoristaAutorizado) return true;
  if (user?.id && String(user.id).trim() === motoristaAutorizado) return true;

  return false;
}

async function handleCadVeiculo(e) {
  e.preventDefault();
  if (!ehAdminMaster()) {
    alert("Permissão negada: Apenas o administrador geral pode cadastrar veículos.");
    return;
  }
  
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
    tipo_frota: document.getElementById('cad-v-tipofrota')?.value || 'PROPRIO',
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
  if (typeof ehAdminMaster === 'function' && !ehAdminMaster()) {
    alert("Permissão negada: Apenas o administrador geral pode editar veículos.");
    return;
  }

  const v = (typeof veiculos !== 'undefined' ? veiculos : []).find(item =>
    String(item.id) === String(veiculoId) ||
    String(item.uuid_veiculos) === String(veiculoId) ||
    String(item.placa) === String(veiculoId)
  );

  if (!v) {
    console.error("Veículo não encontrado para edição:", veiculoId);
    return;
  }

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = (val !== undefined && val !== null) ? val : '';
  };

  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt || '';
  };

  setVal('edit-v-id', v.uuid_veiculos || v.id);
  setText('modal-edit-v-title', v.placa || v.nome_frota || v.id);
  setVal('edit-v-placa', v.placa || '');
  setVal('edit-v-marca', v.marca || '');
  setVal('edit-v-tanque', v.tanque || 0);
  setVal('edit-v-consumomin', v.consumo_min || 0);
  setVal('edit-v-consumomax', v.consumo_max || 0);
  setVal('edit-v-kmatual', v.km_atual || 0);
  setVal('edit-v-status', v.status || 'Disponivel');
  setVal('edit-v-anomalias', v.anomalias || '');
  
  const selectTipo = document.getElementById('edit-v-tipofrota');
  if (selectTipo) {
    selectTipo.value = (v.tipo_frota || 'PROPRIO').toUpperCase();
  }
  setVal('edit-v-referencia', v.modelo_referencia_id || '');

  const modal = document.getElementById('modal-edit-veiculo');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function fecharModalEditVeiculo() {
  document.getElementById('modal-edit-veiculo').classList.add('hidden');
}

async function handleSalvarEditVeiculo(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  if (typeof ehAdminMaster === 'function' && !ehAdminMaster()) {
    alert("Permissão negada: Apenas o administrador geral pode alterar veículos.");
    return;
  }

  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const getNum = (id, fallback = 0) => {
    const el = document.getElementById(id);
    if (!el || !el.value) return fallback;
    const limpo = String(el.value).replace(',', '.');
    const n = parseFloat(limpo);
    return isNaN(n) ? fallback : n;
  };

  const idChave = getVal('edit-v-id');
  const placaVal = getVal('edit-v-placa').toUpperCase();
  const tipoFrotaVal = getVal('edit-v-tipofrota') || 'PROPRIO';

  if (!idChave && !placaVal) {
    alert("Erro: Identificador do veículo não encontrado no formulário.");
    return;
  }

  const dadosAtualizados = {
    placa: placaVal,
    marca: getVal('edit-v-marca'),
    tanque: getNum('edit-v-tanque', 0),
    consumo_min: getNum('edit-v-consumomin', 0),
    consumo_max: getNum('edit-v-consumomax', 0),
    km_atual: getNum('edit-v-kmatual', 0),
    status: getVal('edit-v-status') || 'Disponivel',
    tipo_frota: tipoFrotaVal,
    anomalias: getVal('edit-v-anomalias')
  };

  const btnSalvar = document.querySelector('#modal-edit-veiculo button[type="submit"]') || 
                    document.querySelector('#formEditVeiculo button[type="submit"]');
  if (btnSalvar) {
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = `<i class="ph-bold ph-spinner animate-spin"></i> Salvando...`;
  }

  try {
    let atualizado = false;

    if (idChave) {
      const { data: dataUuid, error: errUuid } = await db
        .from('veiculos')
        .update(dadosAtualizados)
        .or(`uuid_veiculos.eq.${idChave},id.eq.${idChave}`)
        .select();

      if (!errUuid && dataUuid && dataUuid.length > 0) {
        atualizado = true;
      }
    }

    if (!atualizado && placaVal) {
      const { data: dataPlaca, error: errPlaca } = await db
        .from('veiculos')
        .update(dadosAtualizados)
        .eq('placa', placaVal)
        .select();

      if (errPlaca) throw errPlaca;
      if (dataPlaca && dataPlaca.length > 0) {
        atualizado = true;
      }
    }

    if (!atualizado) {
      throw new Error("Nenhum registro correspondente foi localizado para atualização.");
    }

    fecharModalEditVeiculo();
    alert(`✅ Veículo [${dadosAtualizados.placa}] atualizado com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    console.error("Erro ao atualizar veículo:", err);
    alert("Erro ao atualizar veículo: " + (err.message || 'Verifique sua conexão.'));
  } finally {
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = `<i class="ph-bold ph-check"></i> Salvar Alterações`;
    }
  }
}

async function handleApagarVeiculo(veiculoId) {
  if (!ehAdminMaster()) {
    alert("Permissão negada: Apenas o administrador geral pode excluir veículos.");
    return;
  }

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
    alert("Erro na operação: " + err.message);
  }
}

// =========================================================================
// 7. GESTÃO DE USUÁRIOS (EXCLUSIVO ADMIN MASTER)
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
  if (!ehAdminMaster()) {
    alert("Permissão negada: Apenas o administrador geral pode cadastrar usuários.");
    return;
  }

  const cnhInput = (document.getElementById('cad-u-cnh')?.value || '').trim();
  const cnhValida = validarNumeroCNH(cnhInput);
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
      alert(`⚠️ Usuário ${novoUsuario.nome} cadastrado como INATIVO (CNH pendente ou incompleta).`);
    }

    await carregarTodosDadosDoBanco();
  } catch (err) {
    alert("Erro ao cadastrar usuário: " + err.message);
  }
}

function abrirModalEditUsuario(usuarioId) {
  if (!ehAdminMaster()) {
    alert("Permissão negada: Apenas o administrador geral pode editar usuários.");
    return;
  }

  const u = usuarios.find(item => String(item.id) === String(usuarioId));
  if (!u) return;

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
  if (!ehAdminMaster()) {
    alert("Permissão negada: Apenas o administrador geral pode salvar alterações em usuários.");
    return;
  }

  const id = document.getElementById('edit-u-id').value;
  const cnhInput = (document.getElementById('edit-u-cnh')?.value || '').trim();

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
    const { error } = await db.from('usuarios').update(dadosAtualizados).eq('id', id);
    if (error) throw error;

    fecharModalEditUsuario();
    alert("Condutor atualizado e ATIVADO com sucesso!");
    await carregarTodosDadosDoBanco();
  } catch (err) {
    alert("Erro ao atualizar usuário: " + err.message);
  }
}

async function handleApagarUsuario(usuarioId, nome) {
  if (!ehAdminMaster()) {
    alert("Permissão negada: Apenas o administrador geral pode excluir usuários.");
    return;
  }

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
  popularSelectManutencaoAba();
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

  const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  let user = (typeof usuarios !== 'undefined' && usuarios && typeof currentUserIndex !== 'undefined' && usuarios[currentUserIndex]) 
    ? usuarios[currentUserIndex] 
    : null;
    
  if (!user && rawSessao) {
    try { user = JSON.parse(rawSessao); } catch (e) { user = { email: rawSessao }; }
  }

  (veiculos || []).filter(v => {
    if (v.status === 'Fora de Uso') return false;
    return veiculoVisivelParaUsuario(v, user);
  }).forEach(v => {
    const isEmUso = v.status === 'Em Uso';
    const isManutencao = v.status === 'Em Manutenção';
    const idAcao = v.id || v.uuid_veiculos || v.placa;

    const rotaAtiva = isEmUso ? (rotas || []).find(r => {
      const rPlaca = (r.placa || '').trim().toUpperCase();
      const rVeic = (r.veiculo_id ? String(r.veiculo_id) : '').trim().toUpperCase();
      const vPlaca = (v.placa || '').trim().toUpperCase();
      const vNome = (v.nome_frota || v.id || '').trim().toUpperCase();
      return ((vPlaca && (rPlaca === vPlaca || rVeic === vPlaca)) || (vNome && rVeic === vNome)) && r.status === 'Em Uso';
    }) : null;

    const cardWrapper = document.createElement('div');
    cardWrapper.innerHTML = montarCardVeiculoHTML(v, {
      rotaAtiva: rotaAtiva,
      exibirTimer: isEmUso,
      acaoBotao: isEmUso ? {
        texto: 'Encerrar Rota &rarr;',
        cor: 'bg-[#d97706] hover:bg-[#b45309]',
        onclick: `abrirFinalizacaoDireta('${idAcao}')`
      } : (isManutencao ? null : {
        texto: 'Iniciar Rota &rarr;',
        cor: (v.tipo_frota || '').toUpperCase() === 'EXTERNO' ? 'bg-white hover:bg-slate-100 text-slate-900' : 'bg-[#15803d] hover:bg-[#166534]',
        onclick: `abrirInicioDireto('${idAcao}')`
      })
    });

    container.appendChild(cardWrapper.firstElementChild);
  });
}

if (!window.timerGlobalRotasIniciado) {
  window.timerGlobalRotasIniciado = true;
  setInterval(() => {
    document.querySelectorAll('[data-timer-start]').forEach(el => {
      const dataInicio = el.getAttribute('data-timer-start');
      if (dataInicio) {
        el.innerText = formatarTempoDecorrido(dataInicio);
      }
    });
  }, 1000);
}

function renderTabelaVeiculosCad() {
  const tbody = document.getElementById('tabelaVeiculosCadastrados');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const podeAcoes = ehAdminMaster();

  const veiculosOrdenados = [...veiculos].sort((a, b) => {
    const aFora = a.status === 'Fora de Uso' ? 1 : 0;
    const bFora = b.status === 'Fora de Uso' ? 1 : 0;
    if (aFora !== bFora) return aFora - bFora;
    
    const nomeA = (a.nome_frota || a.identificador || a.placa || a.id || '').toUpperCase();
    const nomeB = (b.nome_frota || b.identificador || b.placa || b.id || '').toUpperCase();
    return nomeA.localeCompare(nomeB);
  });

  veiculosOrdenados.forEach(v => {
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
        ${podeAcoes ? `
          <div class="flex items-center justify-center gap-2">
            <button onclick="abrirModalEditVeiculo('${identificador}')" title="Editar Veículo" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition">
              <i class="ph-bold ph-pencil-simple text-sm"></i>
            </button>
            <button onclick="handleApagarVeiculo('${identificador}')" title="Apagar Veículo" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition">
              <i class="ph-bold ph-trash text-sm"></i>
            </button>
          </div>
        ` : `<span class="text-xs text-slate-400">Somente Leitura</span>`}
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

  const podeAcoes = ehAdminMaster();

  usuarios.forEach(u => {
    const ehAdmin = (u.email || '').toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
    const cnhValida = ehAdmin || validarNumeroCNH(u.cnh);

    let badgeStatus;
    if (!cnhValida) {
      badgeStatus = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">CNH Inválida</span>`;
    } else if (u.status === 'Inativo') {
      badgeStatus = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">Inativo</span>`;
    } else {
      badgeStatus = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Ativo</span>`;
    }

    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="py-3 px-4 font-bold text-slate-800">${u.nome}</td>
      <td class="py-3 px-4 text-slate-600">${u.email}</td>
      <td class="py-3 px-4 font-mono font-semibold ${cnhValida ? 'text-brand-700' : 'text-rose-600 font-bold'}">${u.cnh || '-'}</td>
      <td class="py-3 px-4 text-center">${badgeStatus}</td>
      <td class="py-3 px-4 text-center">
        ${podeAcoes ? `
          <div class="flex items-center justify-center gap-2">
            <button onclick="abrirModalEditUsuario('${u.id}')" title="Editar Usuário" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition">
              <i class="ph-bold ph-pencil-simple text-sm"></i>
            </button>
            <button onclick="handleApagarUsuario('${u.id}', '${u.nome}')" title="Apagar Usuário" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition">
              <i class="ph-bold ph-trash text-sm"></i>
            </button>
          </div>
        ` : `<span class="text-xs text-slate-400">Somente Leitura</span>`}
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
    let kmSincronizado = (ultimaRota && Number(ultimaRota.km_retorno) > 0) ? Number(ultimaRota.km_retorno) : Number(v.km_atual || 0);

    inputKm.value = kmSincronizado;
    
    const isExterno = (v.tipo_frota || '').toUpperCase() === 'EXTERNO';
    if (isExterno) {
      inputKm.readOnly = false;
      inputKm.classList.remove('bg-slate-100');
      inputKm.classList.add('bg-white', 'border-indigo-300', 'focus:ring-2', 'focus:ring-indigo-500');
    } else {
      inputKm.readOnly = true;
      inputKm.classList.remove('bg-white', 'border-indigo-300', 'focus:ring-2', 'focus:ring-indigo-500');
      inputKm.classList.add('bg-slate-100');
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
  if (select) {
    select.value = vId;
    atualizarKmInicialPreenchido();
    renderPreviewCardSaida();
  }
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

function abrirFinalizacaoDireta(identificador) {
  const rota = rotas.find(r => 
    (String(r.id) === String(identificador) ||
     String(r.veiculo_id) === String(identificador) || 
     String(r.nome_frota) === String(identificador)) && 
    r.status === 'Em Uso'
  );

  if (rota) {
    setModule('operacao');
    setSubTab('operacao', 'retorno');
    const select = document.getElementById('form-fim-rota-select');
    if (select) {
      select.value = rota.id;
      selecionarRotaFim();
      renderPreviewCardRetorno();
    }
  }
}

function calcularKmPercorrido() {
  const rotaId = document.getElementById('form-fim-rota-select')?.value;
  const rota = rotas.find(r => String(r.id) === String(rotaId));
  const kmFinal = parseFloat(document.getElementById('form-fim-km')?.value);
  const feedback = document.getElementById('km-calc-feedback');

  if (!rota || isNaN(kmFinal) || !feedback) return;

  if (kmFinal < Number(rota.km_saida)) {
    feedback.innerText = `Erro: KM Final (${kmFinal}) menor que Saída (${rota.km_saida})!`;
    feedback.className = "text-[11px] text-rose-600 font-bold mt-1 block";
  } else {
    const delta = kmFinal - Number(rota.km_saida);
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

function renderHistorico() {
  const tbody = document.getElementById('tabelaHistorico');
  if (!tbody) return;
  tbody.innerHTML = '';

  const listaRotas = Array.isArray(rotas) ? rotas : [];

  const rotaEstaAberta = (r) => {
    const s = String(r.status || '').toUpperCase().trim();
    return s === 'EM USO' || s.includes('USO') || s.includes('ROTA') || !r.data_retorno;
  };

  const rotasAbertas = listaRotas
    .filter(rotaEstaAberta)
    .sort((a, b) => new Date(b.data_saida || b.created_at) - new Date(a.data_saida || a.created_at));

  const ultimas10Concluidas = listaRotas
    .filter(r => !rotaEstaAberta(r))
    .sort((a, b) => new Date(b.data_retorno || b.data_saida || b.created_at) - new Date(a.data_retorno || a.data_saida || a.created_at))
    .slice(0, 10);

  const rotasExibicao = [...rotasAbertas, ...ultimas10Concluidas];

  if (rotasExibicao.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="py-8 text-center text-slate-400 font-medium">Nenhuma rota registrada no momento.</td>
      </tr>
    `;
    return;
  }

  rotasExibicao.forEach(r => {
    const isEmUso = rotaEstaAberta(r);
    const tr = document.createElement('tr');
    tr.id = `tr-rota-${r.id}`;
    tr.className = `hover:bg-slate-50 transition cursor-pointer ${isEmUso ? 'bg-amber-50/50 font-semibold' : ''}`;
    tr.onclick = () => plotarRotaNoMapa(r.id);
    tr.innerHTML = `
      <td class="py-3 px-3 font-mono font-bold text-slate-800">${r.id}</td>
      <td class="py-3 px-3 font-extrabold text-slate-900 text-sm">
        ${r.nome_frota || r.veiculo_id || '-'}
      </td>
      <td class="py-3 px-3 text-slate-600">${r.responsavel}</td>
      <td class="py-3 px-3 font-medium">${r.origem} &rarr; ${r.destino || '<span class="text-amber-600 font-bold">Em trânsito</span>'}</td>
      <td class="py-3 px-3 font-semibold text-slate-800">
        <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200">${r.finalidade || '-'}</span>
      </td>
      <td class="py-3 px-3 font-mono text-[11px] text-slate-600">${formatarDataHora(r.data_saida)}</td>
      <td class="py-3 px-3 font-mono text-[11px] text-slate-600">${r.data_retorno ? formatarDataHora(r.data_retorno) : '<span class="text-amber-600 font-bold">Em trânsito</span>'}</td>
      <td class="py-3 px-3 text-center font-mono font-bold">${r.km_total ? `${r.km_total} km` : (isEmUso ? `<span class="text-slate-400 text-xs font-normal">Saída: ${r.km_saida}</span>` : '-')}</td>
      <td class="py-3 px-3 text-center font-mono text-slate-600 text-[11px]">${r.consumo_litros ? `${r.consumo_litros} L` : '-'}</td>
      <td class="py-3 px-3 max-w-xs">${r.anomalia ? `<span class="text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded text-[11px] font-medium">${r.anomalia}</span>` : '<span class="text-slate-400">-</span>'}</td>
      <td class="py-3 px-3 text-center">
        <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isEmUso ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-700'}">
          ${isEmUso ? 'Em Uso' : (r.status || 'Concluída')}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (rotasExibicao.length > 0) {
    plotarRotaNoMapa(rotasExibicao[0].id);
  }
}

function filtrarHistorico() {
  const q = document.getElementById('filtro-rotas')?.value.toLowerCase() || '';
  document.querySelectorAll('#tabelaHistorico tr').forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
  });
}

// =========================================================================
// 9. ALERTAS DE ROTAS (> 12H)
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
    } catch (e) {}
  }
}

function exibirPopUpAlerta(rota, horasAbertas) {
  const modalId = `modal-alerta-${rota.id}`;
  if (document.getElementById(modalId)) return;

  const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
  let emailUsuario = '';
  let nomeUsuario = '';

  if (rawSessao) {
    try {
      const parsed = JSON.parse(rawSessao);
      emailUsuario = (parsed.email || '').toLowerCase().trim();
      nomeUsuario = (parsed.nome || '').toLowerCase().trim();
    } catch (e) {
      emailUsuario = String(rawSessao).toLowerCase().trim();
    }
  }

  const responsavelRota = String(rota.responsavel || '').toLowerCase().trim();
  const podeFinalizar = ehGestorOuAdmin() || (emailUsuario === responsavelRota) || (nomeUsuario && responsavelRota.includes(nomeUsuario));

  const veic = (typeof veiculos !== 'undefined' ? veiculos : []).find(v => 
    String(v.id) === String(rota.veiculo_id) || 
    String(v.uuid_veiculos) === String(rota.veiculo_id) || 
    String(v.nome_frota) === String(rota.veiculo_id) || 
    String(v.placa) === String(rota.veiculo_id)
  );
  
  const nomeCarro = rota.nome_frota || (veic ? (veic.nome_frota || veic.id) : rota.veiculo_id) || 'Veículo';
  const placaCarro = (veic && veic.placa) ? ` [${veic.placa}]` : (rota.placa ? ` [${rota.placa}]` : '');

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
          A rota <b class="text-slate-800">#${rota.id}</b> com o veículo <b class="text-slate-800">${nomeCarro}${placaCarro}</b> (Condutor: <b>${rota.responsavel}</b>) está aberta há mais de <span class="text-rose-600 font-bold">${Math.floor(horasAbertas)} horas</span>.
        </p>
      </div>
      <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium text-left">
        ${podeFinalizar 
          ? "Por favor, finalize o check-in e registre o KM final para evitar inconsistências no fechamento." 
          : "Esta rota está aberta há mais de 12 horas. Apenas o condutor responsável ou a administração podem encerrá-la."}
      </div>
      <div class="modal-alerta-actions">
        ${podeFinalizar ? `
          <button onclick="document.getElementById('${modalId}').remove()" class="btn-alerta-lembrar">
            Lembrar Depois
          </button>
          <button onclick="document.getElementById('${modalId}').remove(); abrirFinalizacaoDireta('${rota.id || rota.veiculo_id}');" class="btn-alerta-finalizar">
            Finalizar Agora
          </button>
        ` : `
          <button onclick="document.getElementById('${modalId}').remove()" class="btn-alerta-fechar">
            Fechar
          </button>
        `}
      </div>
    </div>
  `;
  document.body.appendChild(popUp);
}

async function verificarRotasExcedidas12h() {
  try {
    const rawSessao = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
    if (!rawSessao) return;

    const { data: rotasAtivas, error } = await db.from('rotas').select('*').eq('status', 'Em Uso');
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
          `A rota #${rota.id} (${rota.veiculo_id}) está aberta há ${Math.floor(diferencaHoras)}h por ${rota.responsavel || 'condutor'}.`
        );
      }
    });
  } catch (err) {}
}

// =========================================================================
// AUTO-PREENCHIMENTO DE DADOS TÉCNICOS VIA MODELO DE REFERÊNCIA
// =========================================================================
async function carregarModelosReferencia() {
  try {
    const { data, error } = await db
      .from('modelos_referencia')
      .select('*')
      .order('marca', { ascending: true })
      .order('modelo', { ascending: true });

    if (error) throw error;
    listaModelosReferencia = data || [];

    const popularSelect = (selectId) => {
      const el = document.getElementById(selectId);
      if (!el) return;
      el.innerHTML = '<option value="">-- Selecione o Modelo Base --</option>';
      listaModelosReferencia.forEach(m => {
        el.innerHTML += `<option value="${m.id}">${m.marca} ${m.modelo} (${m.ano_modelo || '2024'})</option>`;
      });
    };

    popularSelect('cad-v-referencia');
    popularSelect('edit-v-referencia');
  } catch (err) {
    console.error("Erro ao carregar modelos_referencia:", err);
  }
}

function aoSelecionarModeloReferencia(origem = 'cad') {
  const refSelect = document.getElementById(`${origem}-v-referencia`);
  const refId = refSelect?.value;

  if (!refId) return;

  const modeloEncontrado = (typeof listaModelosReferencia !== 'undefined' ? listaModelosReferencia : [])
    .find(m => String(m.id) === String(refId));

  if (!modeloEncontrado) return;

  const preencherCampo = (sufixo, valor) => {
    const input = document.getElementById(`${origem}-v-${sufixo}`);
    if (input) {
      input.value = (valor !== null && valor !== undefined) ? valor : '';
    }
  };

  preencherCampo('marca', `${modeloEncontrado.marca || ''} ${modeloEncontrado.modelo || ''}`.trim());
  preencherCampo('ano', modeloEncontrado.ano_modelo || 2024);
  preencherCampo('tanque', modeloEncontrado.tanque_litros || 47);

  preencherCampo('gas-urb', modeloEncontrado.consumo_gasolina_urbano || '');
  preencherCampo('gas-rod', modeloEncontrado.consumo_gasolina_rodoviario || '');
  preencherCampo('eta-urb', modeloEncontrado.consumo_etanol_urbano || '');
  preencherCampo('eta-rod', modeloEncontrado.consumo_etanol_rodoviario || '');

  const piorConsumo = modeloEncontrado.consumo_etanol_urbano || modeloEncontrado.consumo_gasolina_urbano || 10;
  const melhorConsumo = modeloEncontrado.consumo_gasolina_rodoviario || 14;
  preencherCampo('consumomin', piorConsumo);
  preencherCampo('consumomax', melhorConsumo);
}

// =========================================================================
// 10. EXPOSIÇÃO GLOBAL (WINDOW)
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
window.ehAdminMaster = ehAdminMaster;
window.ehGestorOuAdmin = ehGestorOuAdmin;
window.carregarModelosReferencia = carregarModelosReferencia;
window.aoSelecionarModeloReferencia = aoSelecionarModeloReferencia;
window.popularSelectManutencaoAba = popularSelectManutencaoAba;
window.atualizarKmManutencaoAba = atualizarKmManutencaoAba;
window.renderPreviewCardSaida = renderPreviewCardSaida;
window.renderPreviewCardRetorno = renderPreviewCardRetorno;
window.aoMudarVeiculoInicio = aoMudarVeiculoInicio;
window.aoMudarRotaFim = aoMudarRotaFim;
window.obterImagemVeiculo = obterImagemVeiculo;
window.mapearImagemCarro = mapearImagemCarro;
window.plotarRotaNoMapa = plotarRotaNoMapa;

// =========================================================================
// INICIALIZAÇÃO
// =========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  await carregarTodosDadosDoBanco();
  await carregarModelosReferencia();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('modulo') === 'gestao') {
    if (typeof setModule === 'function') {
      setModule('gestao');
    }
    if (typeof setSubTab === 'function') {
      setSubTab('gestao', 'dashboard');
    }
  }

  solicitarPermissaoNotificacoes();
  verificarRotasExcedidas12h();
  setInterval(verificarRotasExcedidas12h, 5 * 60 * 1000);
});