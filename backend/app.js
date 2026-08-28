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
  return JSON.parse(sessao);
}

function fazerLogout() {
  const confirmacao = confirm("Tem certeza que deseja encerrar a sessão?");
  if (confirmacao) {
    localStorage.removeItem('arvo_usuario_logado');
    window.location.href = "login.html";
  }
}

function aplicarPermissoesUsuario() {
  const sessao = verificarSessaoUsuario();
  if (!sessao) return;

  const btnGestao = document.getElementById('btn-mod-gestao');
  const ehAdmin = sessao.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

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
  // Ajustado para o ID exato presente no HTML
  const inputUsuario = document.getElementById('form-inicio-Usuario');

  if (display) display.innerText = `${u.nome} (${u.email})`;
  if (cnh) cnh.innerText = `CNH: ${u.cnh}`;
  if (inputUsuario) inputUsuario.value = `${u.nome} <${u.email}>`;
}

function alternarUsuarioLogado() {
  if (usuarios.length === 0) return;
  currentUserIndex = (currentUserIndex + 1) % usuarios.length;
  atualizarUsuarioNoCabecalho();
}

// =========================================================================
// 3. NAVEGAÇÃO ENTRE MÓDULOS E SUB-ABAS
// =========================================================================

function setModule(mod) {
  const sessao = verificarSessaoUsuario();
  const ehAdmin = sessao && sessao.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();

  if (mod === 'gestao' && !ehAdmin) {
    alert("Acesso restrito: Apenas o administrador (admin@arvo.tec.br) pode acessar o Painel de Gestão.");
    return;
  }

  if (mod === 'operacao') {
    document.getElementById('module-operacao').classList.remove('hidden');
    document.getElementById('module-gestao').classList.add('hidden');
    document.getElementById('subnav-operacao').classList.remove('hidden');
    document.getElementById('subnav-gestao').classList.add('hidden');
    
    document.getElementById('btn-mod-operacao').className = "module-nav-active px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    const btnG = document.getElementById('btn-mod-gestao');
    if (btnG) btnG.className = "text-brand-300 hover:text-white px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    setSubTab('operacao', 'saida');
  } else {
    document.getElementById('module-operacao').classList.add('hidden');
    document.getElementById('module-gestao').classList.remove('hidden');
    document.getElementById('subnav-operacao').classList.add('hidden');
    document.getElementById('subnav-gestao').classList.remove('hidden');
    
    const btnG = document.getElementById('btn-mod-gestao');
    if (btnG) btnG.className = "module-nav-active px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    document.getElementById('btn-mod-operacao').className = "text-brand-300 hover:text-white px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    setSubTab('gestao', 'dashboard');
  }
}

function setSubTab(moduleName, tab) {
  if (moduleName === 'operacao') {
    ['saida', 'retorno', 'minhas-rotas'].forEach(t => {
      const el = document.getElementById(`view-${t}`);
      const btn = document.getElementById(`subtab-${t}`);
      if (el) el.classList.add('hidden');
      if (btn) {
        btn.classList.remove('border-brand-600', 'text-brand-600', 'font-bold');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
    });
    const activeView = document.getElementById(`view-${tab}`);
    const activeBtn = document.getElementById(`subtab-${tab}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) {
      activeBtn.classList.remove('border-transparent', 'text-slate-500');
      activeBtn.classList.add('border-brand-600', 'text-brand-600', 'font-bold');
    }
  } else {
    ['dashboard', 'cad-veiculos', 'cad-usuarios'].forEach(t => {
      const el = document.getElementById(`view-${t}`);
      const btn = document.getElementById(`subtab-${t}`);
      if (el) el.classList.add('hidden');
      if (btn) {
        btn.classList.remove('border-brand-600', 'text-brand-600', 'font-bold');
        btn.classList.add('border-transparent', 'text-slate-500');
      }
    });
    const activeView = document.getElementById(`view-${tab}`);
    const activeBtn = document.getElementById(`subtab-${tab}`);
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) {
      activeBtn.classList.remove('border-transparent', 'text-slate-500');
      activeBtn.classList.add('border-brand-600', 'text-brand-600', 'font-bold');
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
    const { data: dadosVeiculos, error: errV } = await db.from('veiculos').select('*').order('id');
    if (errV) throw errV;
    veiculos = dadosVeiculos || [];

    const { data: dadosUsuarios, error: errU } = await db.from('usuarios').select('*').order('nome');
    if (errU) throw errU;
    usuarios = dadosUsuarios || [];

    const { data: dadosRotas, error: errR } = await db.from('rotas').select('*').order('created_at', { ascending: false });
    if (errR) throw errR;
    rotas = dadosRotas || [];

    const userIndex = usuarios.findIndex(u => u.email.toLowerCase() === usuarioSessao.email.toLowerCase());
    if (userIndex !== -1) {
      currentUserIndex = userIndex;
    }

    atualizarUsuarioNoCabecalho();
    aplicarPermissoesUsuario();
    renderAll();
  } catch (error) {
    console.error("Erro ao carregar dados do Supabase:", error);
    alert("Erro de conexão com o Supabase. Verifique suas chaves e conexão.");
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
  const veiculo = veiculos.find(v => v.id === veiculoId);
  const user = usuarios[currentUserIndex] || JSON.parse(localStorage.getItem('arvo_usuario_logado'));

  if (!veiculoId || !veiculo) {
    alert("Por favor, selecione um veículo válido.");
    return;
  }

  if (!user || !user.email) {
    alert("Condutor não identificado. Faça login novamente.");
    return;
  }

  // =========================================================================
  // BLOQUEIO DE RESERVA (COMPARAÇÃO REAL DE TEMPO)
  // =========================================================================
  const agoraTimestamp = new Date().getTime();
  const emailAtual = user.email.toLowerCase().trim();
  const ADMIN_EMAIL = "admin@arvo.tec.br";

  try {
    const { data: reservasCarro, error: errRes } = await db
      .from('reservas')
      .select('*')
      .eq('veiculo_id', veiculoId)
      .eq('status', 'CONFIRMADA');

    if (errRes) throw errRes;

    if (reservasCarro && reservasCarro.length > 0) {
      // Verifica se o horário atual está dentro de alguma reserva do carro
      const reservaAtiva = reservasCarro.find(r => {
        const ini = new Date(r.data_inicio).getTime();
        const fim = new Date(r.data_fim).getTime();
        return agoraTimestamp >= ini && agoraTimestamp <= fim;
      });

      if (reservaAtiva) {
        const emailDono = (reservaAtiva.responsavel || '').toLowerCase().trim();
        const ehDono = emailDono === emailAtual;
        const ehAdmin = emailAtual === ADMIN_EMAIL.toLowerCase();

        if (!ehDono && !ehAdmin) {
          const dataFimFmt = new Date(reservaAtiva.data_fim).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
          });

          alert(
            `⛔ VEÍCULO BLOQUEADO POR RESERVA!\n\n` +
            `O veículo ${veiculoId} está reservado para:\n` +
            `👤 Condutor: ${reservaAtiva.responsavel}\n` +
            `🎯 Finalidade: ${reservaAtiva.finalidade}\n` +
            `📅 Reservado até: ${dataFimFmt}\n\n` +
            `Apenas ${reservaAtiva.responsavel} ou o Administrador podem utilizá-lo.`
          );
          return;
        }
      }
    }
  } catch (err) {
    console.warn("Aviso na verificação de reserva:", err.message);
  }

  // =========================================================================
  // CONTINUAÇÃO DO INÍCIO DE ROTA
  // =========================================================================
  const selectOrigem = document.getElementById('form-inicio-origem').value;
  const textoOrigem = document.getElementById('form-inicio-origem-texto')?.value.trim().toUpperCase() || '';
  const origemFinal = selectOrigem === 'OUTRO' ? textoOrigem : selectOrigem;

  if (!origemFinal) {
    alert("Por favor, informe a origem de saída.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;
  }

  const dataHoraSaidaAtual = new Date().toISOString();
  const novaRota = {
    id: `ROTA-2026-${String(rotas.length + 261).padStart(4, '0')}`,
    veiculo_id: veiculoId,
    responsavel: user.email,
    origem: origemFinal,
    destino: null,
    finalidade: document.getElementById('form-inicio-finalidade').value,
    data_saida: dataHoraSaidaAtual,
    data_retorno: null,
    km_saida: Number(veiculo.km_atual),
    km_retorno: null,
    km_total: 0,
    consumo_litros: null,
    anomalia: '',
    status: 'Em Uso'
  };

  try {
    const { error: erroRota } = await db.from('rotas').insert([novaRota]);
    if (erroRota) throw erroRota;

    const { error: erroVeiculo } = await db.from('veiculos').update({ status: 'Em Uso' }).eq('id', veiculoId);
    if (erroVeiculo) throw erroVeiculo;

    e.target.reset();
    toggleOutroOrigem('');
    alert(`Rota ${novaRota.id} iniciada com sucesso às ${formatarDataHora(dataHoraSaidaAtual)}!`);
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

async function handleFimRota(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-submit-fim');
  const rotaId = document.getElementById('form-fim-rota-select').value;
  const kmFinal = parseFloat(document.getElementById('form-fim-km').value);
  
  const selectDestino = document.getElementById('form-fim-destino').value;
  const textoDestino = document.getElementById('form-fim-destino-texto')?.value.trim().toUpperCase() || '';
  const destinoFinal = selectDestino === 'OUTRO' ? textoDestino : selectDestino;

  if (!destinoFinal) {
    alert("Por favor, digite o local de devolução.");
    return;
  }

  const rota = rotas.find(r => r.id === rotaId);
  const veiculo = veiculos.find(v => v.id === rota.veiculo_id);

  if (kmFinal < rota.km_saida) {
    alert("Erro: O KM Final não pode ser inferior ao KM de Saída!");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;
  }

  const situacao = document.querySelector('input[name="situacao_carro"]:checked').value;
  let anomaliaTexto = situacao === 'COM' ? document.getElementById('form-fim-anomalia').value.trim() : '';

  const deltaKm = kmFinal - rota.km_saida;
  const medConsumo = (Number(veiculo.consumo_min) + Number(veiculo.consumo_max)) / 2;
  const litrosEst = Number((deltaKm / medConsumo).toFixed(2));
  const dataHoraRetornoAtual = new Date().toISOString();

  try {
    // 1. Atualiza a rota para 'Concluida'
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

    // 2. Atualiza o status do veículo para 'Disponivel'
    const { error: erroVeiculo } = await db.from('veiculos').update({
      km_atual: kmFinal,
      status: 'Disponivel',
      anomalias: anomaliaTexto || veiculo.anomalias
    }).eq('id', veiculo.id);
    if (erroVeiculo) throw erroVeiculo;

    // 3. ENCERRA A RESERVA CORRESPONDENTE (Altera status para 'CONCLUIDA')
    const { error: erroReserva } = await db.from('reservas').update({
      status: 'CONCLUIDA'
    })
    .eq('veiculo_id', veiculo.id)
    .eq('responsavel', rota.responsavel)
    .eq('status', 'CONFIRMADA');

    if (erroReserva) {
      console.warn("Aviso ao encerrar reserva vinculada:", erroReserva.message);
    }

    e.target.reset();
    toggleOutroDestino('');
    document.getElementById('fim-detalhes-viagem')?.classList.add('hidden');
    toggleAnomaliaInput(false);

    alert(`Rota ${rotaId} encerrada e reserva finalizada com sucesso!`);
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

// =========================================================================
// FORMATADOR AUXILIAR DE DATA E HORA (PT-BR)
// =========================================================================
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
  const novoCarro = {
    id: document.getElementById('cad-v-id').value.toUpperCase().trim(),
    placa: document.getElementById('cad-v-placa').value.toUpperCase().trim(),
    marca: document.getElementById('cad-v-marca').value.trim(),
    tanque: parseFloat(document.getElementById('cad-v-tanque').value),
    consumo_min: parseFloat(document.getElementById('cad-v-consumomin').value),
    consumo_max: parseFloat(document.getElementById('cad-v-consumomax').value),
    km_atual: parseFloat(document.getElementById('cad-v-kminicial').value),
    status: 'Disponivel',
    anomalias: ''
  };

  try {
    const { error } = await db.from('veiculos').insert([novoCarro]);
    if (error) throw error;

    e.target.reset();
    alert(`Veículo ${novoCarro.id} cadastrado com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    alert("Erro ao cadastrar veículo: " + err.message);
  }
}

function abrirModalEditVeiculo(veiculoId) {
  const v = veiculos.find(item => item.id === veiculoId);
  if (!v) return;

  document.getElementById('edit-v-id').value = v.id;
  document.getElementById('modal-edit-v-title').innerText = v.id;
  document.getElementById('edit-v-placa').value = v.placa;
  document.getElementById('edit-v-marca').value = v.marca;
  document.getElementById('edit-v-tanque').value = v.tanque;
  document.getElementById('edit-v-consumomin').value = v.consumo_min;
  document.getElementById('edit-v-consumomax').value = v.consumo_max;
  document.getElementById('edit-v-kmatual').value = v.km_atual;
  document.getElementById('edit-v-status').value = v.status;
  document.getElementById('edit-v-anomalias').value = v.anomalias || '';

  document.getElementById('modal-edit-veiculo').classList.remove('hidden');
}

function fecharModalEditVeiculo() {
  document.getElementById('modal-edit-veiculo').classList.add('hidden');
}

async function handleSalvarEditVeiculo(e) {
  e.preventDefault();
  const id = document.getElementById('edit-v-id').value;

  const dadosAtualizados = {
    placa: document.getElementById('edit-v-placa').value.toUpperCase().trim(),
    marca: document.getElementById('edit-v-marca').value.trim(),
    tanque: parseFloat(document.getElementById('edit-v-tanque').value),
    consumo_min: parseFloat(document.getElementById('edit-v-consumomin').value),
    consumo_max: parseFloat(document.getElementById('edit-v-consumomax').value),
    km_atual: parseFloat(document.getElementById('edit-v-kmatual').value),
    status: document.getElementById('edit-v-status').value,
    anomalias: document.getElementById('edit-v-anomalias').value.trim()
  };

  try {
    const { error } = await db.from('veiculos').update(dadosAtualizados).eq('id', id);
    if (error) throw error;

    fecharModalEditVeiculo();
    alert(`Veículo ${id} atualizado com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    alert("Erro ao atualizar veículo: " + err.message);
  }
}

async function handleApagarVeiculo(veiculoId) {
  const confirmacao = confirm(`Tem certeza que deseja APAGAR o veículo ${veiculoId}? Esta ação não pode ser desfeita.`);
  if (!confirmacao) return;

  try {
    const { error } = await db.from('veiculos').delete().eq('id', veiculoId);
    if (error) throw error;

    alert(`Veículo ${veiculoId} removido com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    alert("Erro ao excluir veículo (verifique se há rotas associadas): " + err.message);
  }
}

// =========================================================================
// 7. GESTÃO DE USUÁRIOS (CADASTRO, EDIÇÃO COM SENHA VISÍVEL E EXCLUSÃO)
// =========================================================================

// Função de mostrar/ocultar senha
    function toggleVerSenha() {
      const input = document.getElementById('login-senha');
      const icone = document.getElementById('icone-senha');
      if (input.type === 'password') {
        input.type = 'text';
        icone.classList.remove('ph-eye');
        icone.classList.add('ph-eye-slash');
      } else {
        input.type = 'password';
        icone.classList.remove('ph-eye-slash');
        icone.classList.add('ph-eye');
      }
    }

    // Processamento do Login
    async function handleLogin(e) {
      e.preventDefault();
      const btn = document.getElementById('btn-login');
      const erroBox = document.getElementById('erro-login');
      const erroMsg = document.getElementById('erro-login-msg');
      
      const email = document.getElementById('login-email').value.trim().toLowerCase();
      const senha = document.getElementById('login-senha').value.trim();

      erroBox.classList.add('hidden');
      btn.disabled = true;
      btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Autenticando...`;

      try {
        const { data, error } = await db
          .from('usuarios')
          .select('*')
          .eq('email', email)
          .single();

        if (error || !data) {
          throw new Error("Usuário não cadastrado.");
        }

        if (data.senha !== senha) {
          throw new Error("Senha incorreta. Verifique suas credenciais.");
        }

        if (data.status === 'Inativo') {
          throw new Error("Este usuário está inativo no sistema.");
        }

        // Salva a sessão localmente
        localStorage.setItem('arvo_usuario_logado', JSON.stringify({
          id: data.id,
          nome: data.nome,
          email: data.email,
          cnh: data.cnh
        }));

        // Redireciona para o index.html (ou paginainicial.html)
        window.location.href = "index.html";

      } catch (err) {
        console.error("Falha no login:", err);
        erroMsg.innerText = err.message || "E-mail ou senha inválidos.";
        erroBox.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Entrar no Sistema</span> <i class="ph-bold ph-arrow-right text-base"></i>`;
      }
    }

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
    alert(`Usuário ${novoUsuario.nome} cadastrado com sucesso!`);
    await carregarTodosDadosDoBanco();
  } catch (err) {
    alert("Erro ao cadastrar usuário: " + err.message);
  }
}

function abrirModalEditUsuario(usuarioId) {
  const u = usuarios.find(item => item.id === usuarioId);
  if (!u) return;

  document.getElementById('edit-u-id').value = u.id;
  document.getElementById('edit-u-nome').value = u.nome;
  document.getElementById('edit-u-email').value = u.email;
  
  const inputSenha = document.getElementById('edit-u-senha');
  if (inputSenha) {
    inputSenha.type = 'text';
    inputSenha.value = u.senha || '';
  }
  
  const icone = document.getElementById('icone-senha-edit');
  if (icone) {
    icone.className = 'ph-bold ph-eye text-base';
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
    alert("Condutor e senha atualizados com sucesso!");
    await carregarTodosDadosDoBanco();
  } catch (err) {
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
    const card = document.createElement('div');
    card.className = "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition";
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-base font-extrabold text-slate-900">${v.id}</span>
          <span class="text-[11px] px-2.5 py-0.5 rounded-full font-bold ${isEmUso ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">
            ${isEmUso ? '• Em Rota' : '• Disponível'}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs text-slate-500 mb-3">
          <span>${v.marca}</span>
          <span class="font-mono bg-slate-100 px-1.5 py-0.5 rounded font-semibold text-slate-700">${v.placa}</span>
        </div>

        <div class="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-3 space-y-1">
          <div class="flex justify-between items-baseline">
            <span class="text-[10px] uppercase font-bold text-slate-400">Hodômetro</span>
            <span class="text-lg font-bold font-mono text-slate-800">${Number(v.km_atual).toLocaleString('pt-BR')} km</span>
          </div>
          <div class="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
            <span>Tanque: <b>${v.tanque} L</b></span>
            <span>Méd: <b>${((Number(v.consumo_min) + Number(v.consumo_max))/2).toFixed(1)} km/L</b></span>
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
          `<button onclick="abrirFinalizacaoDireta('${v.id}')" class="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1">Encerrar Rota &rarr;</button>` : 
          `<button onclick="abrirInicioDireto('${v.id}')" class="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1">Iniciar Rota &rarr;</button>`
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
    const isEmUso = v.status === 'Em Uso';
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="py-3 px-3 font-extrabold text-slate-900">${v.id}</td>
      <td class="py-3 px-3 font-mono font-bold text-slate-700">${v.placa}</td>
      <td class="py-3 px-3">${v.marca}</td>
      <td class="py-3 px-3 text-center font-mono">${v.tanque} L</td>
      <td class="py-3 px-3 text-center font-mono">${v.consumo_min} ~ ${v.consumo_max}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-brand-700">${Number(v.km_atual).toLocaleString('pt-BR')} km</td>
      <td class="py-3 px-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isEmUso ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
          ${v.status}
        </span>
      </td>
      <td class="py-3 px-3 text-center">
        <div class="flex items-center justify-center gap-2">
          <button onclick="abrirModalEditVeiculo('${v.id}')" title="Editar Veículo" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition">
            <i class="ph-bold ph-pencil-simple text-sm"></i>
          </button>
          <button onclick="handleApagarVeiculo('${v.id}')" title="Apagar Veículo" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition">
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
  select.innerHTML = '<option value="">Selecione um carro da frota...</option>';
  veiculos.filter(v => v.status === 'Disponivel').forEach(v => {
    select.innerHTML += `<option value="${v.id}">${v.id} - ${v.marca} [${v.placa}] (${Number(v.km_atual).toLocaleString('pt-BR')} km)</option>`;
  });
}

function atualizarKmInicialPreenchido() {
  const vId = document.getElementById('form-inicio-veiculo')?.value;
  const v = veiculos.find(item => item.id === vId);
  const inputKm = document.getElementById('form-inicio-km');
  if (inputKm) inputKm.value = v ? v.km_atual : '';
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
    select.innerHTML += `<option value="${r.id}">${r.id} | ${r.veiculo_id} (${r.responsavel})</option>`;
  });
}

function selecionarRotaFim() {
  const rotaId = document.getElementById('form-fim-rota-select')?.value;
  const rota = rotas.find(r => r.id === rotaId);
  const detalhes = document.getElementById('fim-detalhes-viagem');

  if (rota) {
    const v = veiculos.find(item => item.id === rota.veiculo_id) || {};
    const consMin = Number(v.consumo_min) || 10;
    const consMax = Number(v.consumo_max) || 14;
    const medConsumo = ((consMin + consMax) / 2).toFixed(1);

    document.getElementById('fim-info-veiculo').innerText = `${rota.veiculo_id} (${v.marca || 'N/D'})`;
    // Ajustado para fim-info-Usuario conforme index.html
    const infoUser = document.getElementById('fim-info-Usuario') || document.getElementById('fim-info-condutor');
    if (infoUser) infoUser.innerText = rota.responsavel;

    document.getElementById('fim-info-kmsaida').innerText = `${Number(rota.km_saida).toLocaleString('pt-BR')} km`;
    document.getElementById('fim-info-consumo-est').innerText = `Média de ${medConsumo} km/L`;
    
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
  const rota = rotas.find(r => r.veiculo_id === vId && r.status === 'Em Uso');
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
  const rota = rotas.find(r => r.id === rotaId);
  const kmFinal = parseFloat(document.getElementById('form-fim-km')?.value);
  const feedback = document.getElementById('km-calc-feedback');

  if (!rota || isNaN(kmFinal) || !feedback) return;

  if (kmFinal < rota.km_saida) {
    feedback.innerText = `Erro: KM Final (${kmFinal}) menor que Saída (${rota.km_saida})!`;
    feedback.className = "text-[11px] text-rose-600 font-bold mt-1 block";
  } else {
    const delta = kmFinal - rota.km_saida;
    const v = veiculos.find(item => item.id === rota.veiculo_id);
    const medConsumo = (Number(v.consumo_min) + Number(v.consumo_max))/2;
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
// RENDERIZAR TABELA DE HISTÓRICO COM DATA/HORA DE SAÍDA E RETORNO
// =========================================================================

function renderHistorico() {
  const tbody = document.getElementById('tabelaHistorico');
  if (!tbody) return;
  tbody.innerHTML = '';

  rotas.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="py-3 px-3 font-mono font-bold text-slate-800">${r.id}</td>
      <td class="py-3 px-3 font-extrabold text-slate-700">${r.veiculo_id}</td>
      <td class="py-3 px-3 text-slate-600">${r.responsavel}</td>
      <td class="py-3 px-3 font-medium">
        ${r.origem} &rarr; ${r.destino || 'Em Trânsito'}
      </td>
      <td class="py-3 px-3 font-semibold text-slate-800">
        <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200">
          ${r.finalidade || '-'}
        </span>
      </td>
      <td class="py-3 px-3 font-mono text-[11px] text-slate-600">
        <div>${formatarDataHora(r.data_saida)}</div>
        <div class="text-slate-400 font-semibold">${Number(r.km_saida).toLocaleString('pt-BR')} km</div>
      </td>
      <td class="py-3 px-3 font-mono text-[11px] text-slate-600">
        <div>${r.data_retorno ? formatarDataHora(r.data_retorno) : '<span class="text-amber-600 font-bold">Em trânsito</span>'}</div>
        <div class="text-slate-400 font-semibold">${r.km_retorno ? `${Number(r.km_retorno).toLocaleString('pt-BR')} km` : '-'}</div>
      </td>
      <td class="py-3 px-3 text-center font-mono font-bold ${r.km_total > 0 ? 'text-brand-700' : 'text-slate-400'}">
        ${r.status === 'Concluida' ? `${r.km_total} km` : '-'}
      </td>
      <td class="py-3 px-3 text-center font-mono text-slate-600 text-[11px]">
        ${r.consumo_litros ? `${r.consumo_litros} L` : '-'}
      </td>
      <td class="py-3 px-3 max-w-xs">
        ${r.anomalia ? `<span class="text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded text-[11px] font-medium">${r.anomalia}</span>` : '<span class="text-slate-400">-</span>'}
      </td>
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
// SISTEMA DE ALERTAS & NOTIFICAÇÕES (ROTAS > 12 HORAS)
// =========================================================================

// 1. Solicita permissão para notificações nativas do celular/navegador
function solicitarPermissaoNotificacao() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// 2. Dispara notificação nativa no aparelho
function dispararNotificacaoNativa(titulo, mensagem) {
  if ("Notification" in window && Notification.permission === "granted") {
    navigator.serviceWorker?.ready.then((registration) => {
      registration.showNotification(titulo, {
        body: mensagem,
        icon: "https://cdn-icons-png.flaticon.com/512/3202/3202926.png",
        vibrate: [200, 100, 200],
        tag: "alerta-rota-12h"
      });
    }) || new Notification(titulo, { body: mensagem });
  }
}

// 3. Exibe Pop-up na interface do usuário
function exibirPopUpAlerta(rota, horasAbertas) {
  const modalId = `modal-alerta-${rota.id}`;
  if (document.getElementById(modalId)) return; // Evita duplicar o mesmo pop-up

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
          A rota <b class="text-slate-800">${rota.id}</b> com o veículo <b class="text-slate-800">${rota.veiculo_id}</b> está aberta há mais de <span class="text-rose-600 font-bold">${horasAbertas.toFixed(1)} horas</span>.
        </p>
      </div>
      <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium">
        Por favor, finalize o check-in e registre o KM final para evitar inconsistências no fechamento.
      </div>
      <div class="flex gap-2 pt-2">
        <button onclick="document.getElementById('${modalId}').remove()" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">
          Lembrar Depois
        </button>
        <button onclick="document.getElementById('${modalId}').remove(); abrirFinalizacaoDireta('${rota.veiculo_id}');" class="flex-1 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs shadow-md transition">
          Finalizar Agora
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(popUp);
}

// 4. Verificador automático de rotas > 12h
async function verificarRotasExcedidas12h() {
  const sessao = JSON.parse(localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user'));
  if (!sessao) return;

  const agora = new Date();

  // Consulta rotas em uso
  const { data: rotasAtivas, error } = await db
    .from('rotas')
    .select('*')
    .eq('status', 'Em Uso');

  if (error || !rotasAtivas) return;

  rotasAtivas.forEach(rota => {
    if (!rota.data_saida) return;

    const dataSaida = new Date(rota.data_saida);
    const diferencaHoras = (agora - dataSaida) / (1000 * 60 * 60);

    // Se passou de 12 horas e pertence ao condutor ou se o usuário for o Admin
    if (diferencaHoras >= 12) {
      if (rota.responsavel === sessao.email || sessao.email === "admin@arvo.tec.br") {
        exibirPopUpAlerta(rota, diferencaHoras);
        dispararNotificacaoNativa(
          "⚠️ ARVO - Fechamento de Rota Pendente",
          `A rota ${rota.id} (${rota.veiculo_id}) está aberta há ${diferencaHoras.toFixed(0)}h. Realize a devolução.`
        );
      }
    }
  });
}

// Executa na inicialização e verifica a cada 10 minutos
solicitarPermissaoNotificacao();
setInterval(verificarRotasExcedidas12h, 10 * 60 * 1000);



// Inicialização automática ao carregar a página
window.onload = carregarTodosDadosDoBanco;