// 1. DATA INITIALIZATION
let usuarios = [
  { nome: 'Ronald Oliveira', email: 'ronald@arvo.tec.br', cnh: '05498231201', status: 'Ativo' },
  { nome: 'Pedro Garcia Paiva', email: 'pedro.garcia@arvo.tec.br', cnh: '07831298410', status: 'Ativo' },
  { nome: 'Bárbara Massariol', email: 'barbara.massariol@arvo.tec.br', cnh: '04128956322', status: 'Ativo' },
  { nome: 'Ricardo Arvo', email: 'ricardo@arvo.tec.br', cnh: '01982736455', status: 'Ativo' },
  { nome: 'Angélica Andrade', email: 'angelica.andrade@arvo.tec.br', cnh: '06712398411', status: 'Ativo' },
  { nome: 'Dayane Frota', email: 'dayane@arvo.tec.br', cnh: '08345612988', status: 'Ativo' }
];

let veiculos = [
  { id: 'ARVO 10', placa: 'RQE-1A10', marca: 'Fiat Mobi Like', tanque: 47, consumo_min: 10.5, consumo_max: 14.8, km_atual: 77075, status: 'Disponivel', anomalias: 'Luz da injeção eletrônica acesa' },
  { id: 'ARVO 11', placa: 'RQE-2B11', marca: 'Fiat Mobi Like', tanque: 47, consumo_min: 11.0, consumo_max: 15.2, km_atual: 11285, status: 'Disponivel', anomalias: 'Ruído na direção ao esterçar' },
  { id: 'ARVO 12', placa: 'RQE-3C12', marca: 'Fiat Mobi Like', tanque: 47, consumo_min: 10.8, consumo_max: 14.9, km_atual: 29553, status: 'Disponivel', anomalias: '' },
  { id: 'ARVO 13', placa: 'RQE-4D13', marca: 'Fiat Mobi Trekking', tanque: 47, consumo_min: 10.2, consumo_max: 14.5, km_atual: 91573, status: 'Disponivel', anomalias: '' },
  { id: 'ARVO 15', placa: 'RQE-6F15', marca: 'Toyota Corolla XEi', tanque: 50, consumo_min: 9.0, consumo_max: 13.5, km_atual: 151330, status: 'Disponivel', anomalias: 'Passou do km de alinhar pneus' }
];

let rotas = [
  {
    id: 'ROTA-2026-0258',
    veiculo_id: 'ARVO 10',
    responsavel: 'pedro.garcia@arvo.tec.br',
    origem: 'ALEGRE',
    destino: 'ALEGRE',
    finalidade: 'PROJETO TÉCNICO E MONITORAMENTO',
    km_saida: 77074,
    km_retorno: 77075,
    km_total: 1,
    consumo_litros: '0.1 L',
    anomalia: '',
    status: 'Concluida'
  },
  {
    id: 'ROTA-2026-0259',
    veiculo_id: 'ARVO 11',
    responsavel: 'ronald@arvo.tec.br',
    origem: 'GUAÇUÍ',
    destino: 'GUAÇUÍ',
    finalidade: 'REFLORESTAR',
    km_saida: 11235,
    km_retorno: 11285,
    km_total: 50,
    consumo_litros: '3.8 L',
    anomalia: 'Ruído ao virar a direção',
    status: 'Concluida'
  }
];

let currentUserIndex = 0;

function init() {
  atualizarUsuarioNoCabecalho();
  renderAll();
}

function renderAll() {
  renderFleetGrid();
  renderDashboardKPIs();
  renderSelectVeiculosInicio();
  renderSelectRotasFim();
  renderHistorico();
  renderTabelaVeiculosCad();
  renderTabelaUsuariosCad();
}

function setModule(mod) {
  if (mod === 'operacao') {
    document.getElementById('module-operacao').classList.remove('hidden');
    document.getElementById('module-gestao').classList.add('hidden');
    document.getElementById('subnav-operacao').classList.remove('hidden');
    document.getElementById('subnav-gestao').classList.add('hidden');
    
    document.getElementById('btn-mod-operacao').className = "module-nav-active px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    document.getElementById('btn-mod-gestao').className = "text-brand-300 hover:text-white px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    setSubTab('operacao', 'saida');
  } else {
    document.getElementById('module-operacao').classList.add('hidden');
    document.getElementById('module-gestao').classList.remove('hidden');
    document.getElementById('subnav-operacao').classList.add('hidden');
    document.getElementById('subnav-gestao').classList.remove('hidden');
    
    document.getElementById('btn-mod-gestao').className = "module-nav-active px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    document.getElementById('btn-mod-operacao').className = "text-brand-300 hover:text-white px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5";
    setSubTab('gestao', 'dashboard');
  }
}

function setSubTab(moduleName, tab) {
  if (moduleName === 'operacao') {
    ['saida', 'retorno', 'minhas-rotas'].forEach(t => {
      document.getElementById(`view-${t}`).classList.add('hidden');
      const btn = document.getElementById(`subtab-${t}`);
      btn.classList.remove('border-brand-600', 'text-brand-600', 'font-bold');
      btn.classList.add('border-transparent', 'text-slate-500');
    });
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    const active = document.getElementById(`subtab-${tab}`);
    active.classList.remove('border-transparent', 'text-slate-500');
    active.classList.add('border-brand-600', 'text-brand-600', 'font-bold');
  } else {
    ['dashboard', 'cad-veiculos', 'cad-usuarios'].forEach(t => {
      document.getElementById(`view-${t}`).classList.add('hidden');
      const btn = document.getElementById(`subtab-${t}`);
      btn.classList.remove('border-brand-600', 'text-brand-600', 'font-bold');
      btn.classList.add('border-transparent', 'text-slate-500');
    });
    document.getElementById(`view-${tab}`).classList.remove('hidden');
    const active = document.getElementById(`subtab-${tab}`);
    active.classList.remove('border-transparent', 'text-slate-500');
    active.classList.add('border-brand-600', 'text-brand-600', 'font-bold');
  }
}

function atualizarUsuarioNoCabecalho() {
  const u = usuarios[currentUserIndex];
  document.getElementById('topUserDisplay').innerText = `${u.nome} (${u.email})`;
  document.getElementById('topUserCnh').innerText = `CNH: ${u.cnh}`;
  document.getElementById('form-inicio-condutor').value = `${u.nome} <${u.email}>`;
}

function alternarUsuarioLogado() {
  currentUserIndex = (currentUserIndex + 1) % usuarios.length;
  atualizarUsuarioNoCabecalho();
}

function handleCadUsuario(e) {
  e.preventDefault();
  const novoU = {
    nome: document.getElementById('cad-u-nome').value,
    email: document.getElementById('cad-u-email').value,
    cnh: document.getElementById('cad-u-cnh').value,
    status: 'Ativo'
  };

  if (usuarios.some(u => u.email.toLowerCase() === novoU.email.toLowerCase())) {
    alert("Erro: Este e-mail corporativo já está cadastrado.");
    return;
  }

  usuarios.push(novoU);
  e.target.reset();
  renderTabelaUsuariosCad();
  alert(`Usuário ${novoU.nome} cadastrado com sucesso!`);
}

function renderTabelaUsuariosCad() {
  const tbody = document.getElementById('tabelaUsuariosCadastrados');
  tbody.innerHTML = '';
  usuarios.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50";
    tr.innerHTML = `
      <td class="py-3 px-4 font-bold text-slate-800">${u.nome}</td>
      <td class="py-3 px-4 text-slate-600">${u.email}</td>
      <td class="py-3 px-4 font-mono font-semibold text-brand-700">${u.cnh}</td>
      <td class="py-3 px-4 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">${u.status}</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('badge-total-users').innerText = `${usuarios.length} condutores`;
}

function handleCadVeiculo(e) {
  e.preventDefault();
  const id = document.getElementById('cad-v-id').value.toUpperCase().trim();
  const placa = document.getElementById('cad-v-placa').value.toUpperCase().trim();
  const marca = document.getElementById('cad-v-marca').value.trim();
  const tanque = parseFloat(document.getElementById('cad-v-tanque').value);
  const minC = parseFloat(document.getElementById('cad-v-consumomin').value);
  const maxC = parseFloat(document.getElementById('cad-v-consumomax').value);
  const kmIni = parseFloat(document.getElementById('cad-v-kminicial').value);

  if (veiculos.some(v => v.id === id || v.placa === placa)) {
    alert("Erro: Veículo ou Placa já existente na frota.");
    return;
  }

  const novoCarro = {
    id,
    placa,
    marca,
    tanque,
    consumo_min: minC,
    consumo_max: maxC,
    km_atual: kmIni,
    status: 'Disponivel',
    anomalias: ''
  };

  veiculos.push(novoCarro);
  e.target.reset();
  renderAll();
  alert(`Veículo ${novoCarro.id} (${novoCarro.marca}) cadastrado com sucesso!`);
}

function renderTabelaVeiculosCad() {
  const tbody = document.getElementById('tabelaVeiculosCadastrados');
  tbody.innerHTML = '';
  veiculos.forEach(v => {
    const isEmUso = v.status === 'Em Uso';
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50";
    tr.innerHTML = `
      <td class="py-3 px-3 font-extrabold text-slate-900">${v.id}</td>
      <td class="py-3 px-3 font-mono font-bold text-slate-700">${v.placa}</td>
      <td class="py-3 px-3">${v.marca}</td>
      <td class="py-3 px-3 text-center font-mono">${v.tanque} L</td>
      <td class="py-3 px-3 text-center font-mono">${v.consumo_min} ~ ${v.consumo_max}</td>
      <td class="py-3 px-3 text-right font-mono font-bold text-brand-700">${v.km_atual.toLocaleString('pt-BR')} km</td>
      <td class="py-3 px-3 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isEmUso ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
          ${v.status}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('badge-total-carros').innerText = `${veiculos.length} carros`;
}

function renderDashboardKPIs() {
  document.getElementById('kpi-total-veiculos').innerText = veiculos.length;
  document.getElementById('kpi-em-rota').innerText = veiculos.filter(v => v.status === 'Em Uso').length;
  document.getElementById('kpi-disponiveis').innerText = veiculos.filter(v => v.status === 'Disponivel').length;
  document.getElementById('kpi-anomalias').innerText = veiculos.filter(v => v.anomalias && v.anomalias.trim() !== '').length;
}

function renderFleetGrid() {
  const container = document.getElementById('fleetGrid');
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
            <span class="text-lg font-bold font-mono text-slate-800">${v.km_atual.toLocaleString('pt-BR')} km</span>
          </div>
          <div class="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
            <span>Tanque: <b>${v.tanque} L</b></span>
            <span>Méd: <b>${((v.consumo_min + v.consumo_max)/2).toFixed(1)} km/L</b></span>
          </div>
        </div>

        ${v.anomalias ? `
          <div class="bg-rose-50 border border-rose-100 rounded-lg p-2.5 text-xs text-rose-700 flex items-start gap-2">
            <i class="ph-bold ph-warning text-sm shrink-0 mt-0.5"></i>
            <span class="line-clamp-2">${v.anomalias}</span>
          </div>
        ` : '<div class="text-xs text-slate-400 italic">Sem anomalias mecânicas relatadas</div>'}
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

function renderSelectVeiculosInicio() {
  const select = document.getElementById('form-inicio-veiculo');
  select.innerHTML = '<option value="">Selecione um carro da frota...</option>';
  veiculos.filter(v => v.status === 'Disponivel').forEach(v => {
    select.innerHTML += `<option value="${v.id}">${v.id} - ${v.marca} [${v.placa}] (${v.km_atual.toLocaleString('pt-BR')} km)</option>`;
  });
}

function atualizarKmInicialPreenchido() {
  const vId = document.getElementById('form-inicio-veiculo').value;
  const v = veiculos.find(item => item.id === vId);
  document.getElementById('form-inicio-km').value = v ? v.km_atual : '';
}

function abrirInicioDireto(vId) {
  setModule('operacao');
  setSubTab('operacao', 'saida');
  document.getElementById('form-inicio-veiculo').value = vId;
  atualizarKmInicialPreenchido();
}

function handleInicioRota(e) {
  e.preventDefault();
  const veiculoId = document.getElementById('form-inicio-veiculo').value;
  const veiculo = veiculos.find(v => v.id === veiculoId);
  if (!veiculo) return;

  const user = usuarios[currentUserIndex];
  const novaRota = {
    id: `ROTA-2026-${String(rotas.length + 261).padStart(4, '0')}`,
    veiculo_id: veiculoId,
    responsavel: user.email,
    origem: document.getElementById('form-inicio-origem').value,
    destino: '',
    finalidade: document.getElementById('form-inicio-finalidade').value,
    km_saida: veiculo.km_atual,
    km_retorno: null,
    km_total: 0,
    consumo_litros: '-',
    anomalia: '',
    status: 'Em Uso'
  };

  veiculo.status = 'Em Uso';
  rotas.unshift(novaRota);

  e.target.reset();
  atualizarUsuarioNoCabecalho();
  renderAll();
  setSubTab('operacao', 'minhas-rotas');
  alert(`Rota ${novaRota.id} iniciada para o veículo ${veiculoId}!`);
}

function renderSelectRotasFim() {
  const select = document.getElementById('form-fim-rota-select');
  select.innerHTML = '<option value="">Selecione uma viagem em trânsito...</option>';
  rotas.filter(r => r.status === 'Em Uso').forEach(r => {
    select.innerHTML += `<option value="${r.id}">${r.id} | ${r.veiculo_id} (${r.responsavel})</option>`;
  });
}

function selecionarRotaFim() {
  const rotaId = document.getElementById('form-fim-rota-select').value;
  const rota = rotas.find(r => r.id === rotaId);
  const detalhes = document.getElementById('fim-detalhes-viagem');
  if (rota) {
    const v = veiculos.find(item => item.id === rota.veiculo_id);
    const medConsumo = ((v.consumo_min + v.consumo_max)/2).toFixed(1);
    document.getElementById('fim-info-veiculo').innerText = `${rota.veiculo_id} (${v.marca})`;
    document.getElementById('fim-info-condutor').innerText = rota.responsavel;
    document.getElementById('fim-info-kmsaida').innerText = `${rota.km_saida.toLocaleString('pt-BR')} km`;
    document.getElementById('fim-info-consumo-est').innerText = `Média de ${medConsumo} km/L`;
    detalhes.classList.remove('hidden');

    document.getElementById('form-fim-km').min = rota.km_saida;
    document.getElementById('form-fim-km').value = rota.km_saida;
    calcularKmPercorrido();
  } else {
    detalhes.classList.add('hidden');
  }
}

function abrirFinalizacaoDireta(vId) {
  const rota = rotas.find(r => r.veiculo_id === vId && r.status === 'Em Uso');
  if (rota) {
    setModule('operacao');
    setSubTab('operacao', 'retorno');
    document.getElementById('form-fim-rota-select').value = rota.id;
    selecionarRotaFim();
  }
}

function calcularKmPercorrido() {
  const rotaId = document.getElementById('form-fim-rota-select').value;
  const rota = rotas.find(r => r.id === rotaId);
  const kmFinal = parseFloat(document.getElementById('form-fim-km').value);
  const feedback = document.getElementById('km-calc-feedback');

  if (!rota || isNaN(kmFinal)) {
    feedback.innerText = "Insira o KM do painel.";
    feedback.className = "text-[11px] text-slate-500 mt-1 block";
    return;
  }

  if (kmFinal < rota.km_saida) {
    feedback.innerText = `Erro: KM Final (${kmFinal}) menor que Saída (${rota.km_saida})!`;
    feedback.className = "text-[11px] text-rose-600 font-bold mt-1 block";
  } else {
    const delta = kmFinal - rota.km_saida;
    const v = veiculos.find(item => item.id === rota.veiculo_id);
    const medConsumo = (v.consumo_min + v.consumo_max)/2;
    const litrosEst = (delta / medConsumo).toFixed(1);
    feedback.innerText = `Distância: ${delta} km (Consumo est.: ~${litrosEst} Litros)`;
    feedback.className = "text-[11px] text-brand-700 font-bold mt-1 block";
  }
}

function toggleAnomaliaInput(show) {
  const box = document.getElementById('box-anomalia');
  if (show) box.classList.remove('hidden');
  else box.classList.add('hidden');
}

function handleFimRota(e) {
  e.preventDefault();
  const rotaId = document.getElementById('form-fim-rota-select').value;
  const kmFinal = parseFloat(document.getElementById('form-fim-km').value);
  const destino = document.getElementById('form-fim-destino').value;
  const rota = rotas.find(r => r.id === rotaId);
  const veiculo = veiculos.find(v => v.id === rota.veiculo_id);

  if (kmFinal < rota.km_saida) {
    alert("Erro: O KM Final não pode ser inferior ao KM de Saída!");
    return;
  }

  const situacao = document.querySelector('input[name="situacao_carro"]:checked').value;
  let anomaliaTexto = '';
  if (situacao === 'COM') {
    anomaliaTexto = document.getElementById('form-fim-anomalia').value.trim();
    veiculo.anomalias = anomaliaTexto;
  }

  const delta = kmFinal - rota.km_saida;
  const medConsumo = (veiculo.consumo_min + veiculo.consumo_max)/2;
  const litrosEst = (delta / medConsumo).toFixed(1);

  rota.km_retorno = kmFinal;
  rota.km_total = delta;
  rota.consumo_litros = `${litrosEst} L`;
  rota.destino = destino;
  rota.status = 'Concluida';
  rota.anomalia = anomaliaTexto;

  veiculo.km_atual = kmFinal;
  veiculo.status = 'Disponivel';

  e.target.reset();
  document.getElementById('fim-detalhes-viagem').classList.add('hidden');
  toggleAnomaliaInput(false);

  renderAll();
  setSubTab('operacao', 'minhas-rotas');
  alert(`Rota ${rota.id} concluída com sucesso! Total percorrido: ${rota.km_total} km.`);
}

function renderHistorico() {
  const tbody = document.getElementById('tabelaHistorico');
  tbody.innerHTML = '';
  rotas.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-slate-50 transition";
    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold text-slate-800">${r.id}</td>
      <td class="py-3 px-4 font-extrabold text-slate-700">${r.veiculo_id}</td>
      <td class="py-3 px-4 text-slate-600">${r.responsavel}</td>
      <td class="py-3 px-4 font-medium">${r.origem} &rarr; ${r.destino || 'Em Trânsito'}</td>
      <td class="py-3 px-4 font-mono">${r.km_saida.toLocaleString('pt-BR')}</td>
      <td class="py-3 px-4 font-mono">${r.km_retorno ? r.km_retorno.toLocaleString('pt-BR') : '-'}</td>
      <td class="py-3 px-4 text-center font-mono font-bold ${r.km_total > 0 ? 'text-brand-700' : 'text-slate-400'}">
        ${r.status === 'Concluida' ? `${r.km_total} km` : '-'}
      </td>
      <td class="py-3 px-4 text-center font-mono text-slate-600">${r.consumo_litros}</td>
      <td class="py-3 px-4 max-w-xs">
        ${r.anomalia ? `<span class="text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded text-[11px] font-medium">${r.anomalia}</span>` : '<span class="text-slate-400">-</span>'}
      </td>
      <td class="py-3 px-4 text-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${r.status === 'Concluida' ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-800'}">
          ${r.status}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filtrarHistorico() {
  const q = document.getElementById('filtro-rotas').value.toLowerCase();
  document.querySelectorAll('#tabelaHistorico tr').forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
  });
}

window.onload = init;