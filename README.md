
================================================================================
ARVOCAR - MANUAL TÉCNICO, OPERACIONAL E ARQUITETURA COMPLETA DO SISTEMA
================================================================================
Data de Compilação: Setembro de 2026
Projeto: ARVOCAR (Gestão de Rotas, Frotas, Reservas e Abastecimentos)
Ambiente: Web Desktop & Progressive Web App - PWA (Mobile / Tablet)
Backend / Nuvem: Supabase (PostgreSQL 15+ com RLS e Bucket de Storage)

--------------------------------------------------------------------------------
ÍNDICE GERAL
--------------------------------------------------------------------------------
1. VISÃO GERAL E ARQUITETURA DA APLICAÇÃO
2. ESTRUTURA COMPLETA DE DIRETÓRIOS E ARQUIVOS
3. MODELAGEM DO BANCO DE DADOS E SCRIPTS SQL (SUPABASE)
4. ARQUITETURA OFFLINE-FIRST E FILAS DE CONTINGÊNCIA LOCAL
5. PWA, CACHE E MANIFESTO (MANIFEST.JSON E SW.JS)
6. FLUXO E DETECÇÃO INTELIGENTE DE INSTALAÇÃO (INSTALAR.HTML)
7. REGRAS DE NEGÓCIO E VALIDAÇÕES DO SISTEMA
   7.1 Diferenciação de Frota: PROPRIO vs EXTERNO
   7.2 Vínculo Operacional e Chave por Placa Física
   7.3 Bloqueio e Encerramento Automático de Reservas
8. GUIA OPERACIONAL PASSO A PASSO
   8.1 Acesso e Autenticação (Online e Login Offline)
   8.2 Abertura e Saída de Rota
   8.3 Fechamento de Rota e Registro de Avarias
   8.4 Agendamento de Veículos e Calendário Interativo
   8.5 Registro e Consulta de Abastecimento com Comprovante Fiscal
9. CÓDIGOS-FONTE COMPLETOS DOS MÓDULOS JAVASCRIPT
   9.1 Service Worker: sw.js
   9.2 arvocarmobile/backendmobile/mobile.js
   9.3 arvocarmobile/backendmobile/abastecimentomobile.js
   9.4 arvocarmobile/backendmobile/reservasmobile.js
   9.5 Web Desktop: Funções em app.js (handleInicioRota & handleFimRota)
   9.6 Interface: arvocarmobile/frontendmobile/instalar.html
10. RESOLUÇÃO DE PROBLEMAS (TROUBLESHOOTING)

================================================================================
1. VISÃO GERAL E ARQUITETURA DA APLICAÇÃO
================================================================================
O ARVOCAR é uma solução unificada para o controle de deslocamentos, frotas 
corporativas, escalas de agendamentos e prestação de contas de combustível[cite: 2, 4].
Foi desenvolvido com foco em campo, garantindo que condutores trabalhem sem travamentos
mesmo em áreas rurais ou sem sinal de operadora[cite: 6].

Componentes Principais:
- Frontend Mobile: HTML5 semântico, Tailwind CSS, Phosphor Icons[cite: 3].
- Frontend Desktop: Dashboard gerencial, tabelas de controle e relatórios analíticos[cite: 1, 4].
- Calendário: FullCalendar para visualização de escalas e conflitos de horários[cite: 6].
- Persistência Local: LocalStorage para sessões e filas de sincronização (Sync Queues)[cite: 6].
- Service Worker: Cache de arquivos para navegação rápida e operação offline[cite: 2, 6].
- Backend em Nuvem: Supabase (PostgreSQL 15+) com Row Level Security (RLS)[cite: 1, 4].
- Storage de Comprovantes: Supabase Storage (Bucket público 'comprovantes')[cite: 4, 6].

================================================================================
2. ESTRUTURA COMPLETA DE DIRETÓRIOS E ARQUIVOS
================================================================================
A estrutura do projeto deve seguir rigorosamente a convenção abaixo (pastas em minúsculas
e sem hifens para evitar erros 404 e falhas de importação de scripts)[cite: 4]:

ARVOCAR/
├── index.html                           # Painel Principal Desktop / Administrativo
├── manifest.json                        # Manifesto PWA com escopo "/" e ícones maskable
├── sw.js                                # Service Worker e cache de contingência
├── .cpanel.yml                          # Script de deploy contínuo Git (HostGator)
├── backend/
│   ├── abastecimento.js                 # Lógica de abastecimentos Desktop
│   ├── app.js                           # Controle de rotas e frotas Web
│   ├── appreserva.js                    # Gestão de reservas Web
│   └── relatorios.js                    # Filtros e consolidação analítica
├── arvocarmobile/
│   ├── frontendmobile/
│   │   ├── abastecimentomobile.html     # Lançamento e histórico de combustível
│   │   ├── instalar.html                # Tela de instalação inteligente PWA
│   │   ├── mobile.html                  # Interface de abertura/fechamento de viagens
│   │   └── reservasmobile.html          # Agendamentos e calendário mobile
│   └── backendmobile/
│       ├── abastecimentomobile.js       # Tratamento de fotos, Base64 e fila offline
│       ├── mobile.js                    # Rotas, autenticação e sincronização
│       ├── modalui.js                   # Utilitários de interface e janelas modais
│       └── reservasmobile.js            # Regras de agendamento e FullCalendar offline
├── frontend/
│   ├── abastecimento.html               # Telas secundárias Desktop
│   ├── login.html                       # Autenticação Desktop
│   ├── paginainicial.html               # Painel inicial Web
│   ├── relatorios.html                  # Relatórios e exportações
│   └── reservas.html                    # Calendário geral Desktop
└── imagens/
    ├── arvocarblack.png
    ├── arvocarblack150.png
    ├── arvocarwhite.png
    ├── arvocarwhite30.png
    ├── arvocarwhite150.png
    ├── arvoMobi.png
    ├── arvoMobiwhite.png
    ├── logo3d192.png                    # Ícone PWA (192x192)
    └── logo3d512.png                    # Ícone PWA (512x512)

================================================================================
3. MODELAGEM DO BANCO DE DADOS E SCRIPTS SQL (SUPABASE)
================================================================================
Execute no SQL Editor do Supabase para configurar as tabelas, permissões e chaves[cite: 1, 4, 12]:

--------------------------------------------------------------------------------
-- 1. Criação e Ajuste de Colunas nas Tabelas Operacionais
--------------------------------------------------------------------------------
-- Tabela veiculos:
ALTER TABLE veiculos 
ADD COLUMN IF NOT EXISTS uuid_veiculos UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS tipo_frota TEXT DEFAULT 'PROPRIO',
ADD COLUMN IF NOT EXISTS anomalias TEXT;

-- Garantir coluna placa e uuid_veiculos nas tabelas dependentes:
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS placa TEXT;
ALTER TABLE rotas ADD COLUMN IF NOT EXISTS uuid_veiculos UUID;

ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS placa TEXT;
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS uuid_veiculos UUID;
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS tipo_combustivel TEXT;
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS km_atual NUMERIC;
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS url_comprovante TEXT;

ALTER TABLE reservas ADD COLUMN IF NOT EXISTS placa TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS uuid_veiculos UUID;

--------------------------------------------------------------------------------
-- 2. Migração Histórica (Congelamento da Placa nos Registros Anteriores)
--------------------------------------------------------------------------------
UPDATE rotas r
SET placa = v.placa
FROM veiculos v
WHERE r.uuid_veiculos = v.uuid_veiculos OR r.veiculo_id = v.nome_frota;

UPDATE abastecimentos a
SET placa = v.placa
FROM veiculos v
WHERE a.uuid_veiculos = v.uuid_veiculos OR a.veiculo_id = v.nome_frota;

UPDATE reservas res
SET placa = v.placa
FROM veiculos v
WHERE res.uuid_veiculos = v.uuid_veiculos OR res.veiculo_id = v.nome_frota;

--------------------------------------------------------------------------------
-- 3. Políticas de Segurança (Row Level Security - RLS)
--------------------------------------------------------------------------------
CREATE POLICY IF NOT EXISTS "Permitir SELECT veiculos" ON veiculos FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Permitir UPDATE veiculos" ON veiculos FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Permitir SELECT rotas" ON rotas FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Permitir INSERT rotas" ON rotas FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Permitir UPDATE rotas" ON rotas FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Permitir SELECT abastecimentos" ON abastecimentos FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Permitir INSERT abastecimentos" ON abastecimentos FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Permitir SELECT reservas" ON reservas FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Permitir INSERT reservas" ON reservas FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Permitir UPDATE reservas" ON reservas FOR UPDATE USING (true) WITH CHECK (true);

--------------------------------------------------------------------------------
-- 4. Armazenamento de Arquivos (Storage)
--------------------------------------------------------------------------------
- No painel do Supabase, acesse Storage e crie um novo bucket chamado: 'comprovantes'.
- Ative a opção 'Public Bucket' para liberar a visualização de fotos das notas fiscais.

================================================================================
4. ARQUITETURA OFFLINE-FIRST E FILAS DE CONTINGÊNCIA LOCAL
================================================================================
Quando o condutor está em trânsito e perde a conexão à internet ou sinal celular[cite: 6]:
1. Identificação Temporária:
   - Rotas recebem o prefixo: `temp_178775...`[cite: 6]
   - Reservas recebem o prefixo: `temp_res_178775...`[cite: 6]
2. Filas de Persistência no LocalStorage:
   - `arvo_sync_rotas_queue`: Acumula inícios e encerramentos de rotas[cite: 6].
   - `arvo_sync_abast_queue`: Armazena dados do posto e foto do cupom em Base64[cite: 6].
   - `arvo_sync_reservas_queue`: Guarda novos agendamentos[cite: 6].
3. Atualização Instantânea da UI:
   - O veículo tem seu status alterado para 'Em Uso' localmente e a rota é exibida
     com o selo informativo "(Pendente 📶)"[cite: 6].
4. Sincronização Automática ao Reconectar:
   - O ouvinte `window.addEventListener('online')` processa as filas em segundo plano,
     envia os dados em lote para o Supabase e atualiza as referências temporárias para
     os IDs oficiais do banco[cite: 6, 11].

AVISO OPERACIONAL: O usuário não deve limpar o histórico ou cache do navegador móvel
enquanto existirem lançamentos com o aviso "(Pendente 📶)"[cite: 6].

================================================================================
5. PWA, CACHE E MANIFESTO (MANIFEST.JSON E SW.JS)
================================================================================

--------------------------------------------------------------------------------
Arquivo: /manifest.json
--------------------------------------------------------------------------------
{
  "name": "ARVO - Controle de Rota",
  "short_name": "ARVO Rota",
  "description": "App de Operação de Rotas e Frotas ARVO",
  "start_url": "/arvocarmobile/frontendmobile/mobile.html",
  "scope": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#14532d",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/imagens/logo3d192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/imagens/logo3d512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}

--------------------------------------------------------------------------------
Arquivo: /sw.js
--------------------------------------------------------------------------------
const CACHE_NAME = 'arvo-mobile-v3';

const ASSETS_TO_CACHE = [
  '/arvocarmobile/frontendmobile/mobile.html',
  '/arvocarmobile/frontendmobile/instalar.html',
  '/arvocarmobile/frontendmobile/abastecimentomobile.html',
  '/arvocarmobile/frontendmobile/reservasmobile.html',
  '/arvocarmobile/backendmobile/mobile.js',
  '/arvocarmobile/backendmobile/abastecimentomobile.js',
  '/arvocarmobile/backendmobile/reservasmobile.js',
  '/manifest.json',
  '/imagens/logo3d192.png',
  '/imagens/logo3d512.png',
  '/imagens/arvocarblack150.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/@phosphor-icons/web',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignora chamadas de API do Supabase no cache comum
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => caches.match(event.request));
    })
  );
});

================================================================================
6. FLUXO E DETECÇÃO INTELIGENTE DE INSTALAÇÃO (INSTALAR.HTML)
================================================================================
A tela 'instalar.html' atua como um roteador de ambiente:
- Se o sistema já estiver rodando instalado em tela cheia (display-mode: standalone),
  ou se for acessado por um computador Desktop, redireciona de imediato para 'mobile.html'[cite: 10].
- No Android / Chrome: Captura o evento `beforeinstallprompt` e exibe o botão verde
  "Instalar Aplicativo"[cite: 3, 10].
- No iOS Safari: Exibe o tutorial específico de compartilhamento[cite: 1, 10].

--------------------------------------------------------------------------------
Arquivo: /arvocarmobile/frontendmobile/instalar.html
--------------------------------------------------------------------------------
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Instalar ARVOCAR</title>  
  <meta name="theme-color" content="#14532d" />
  <link rel="icon" type="image/png" sizes="192x192" href="/imagens/logo3d192.png" />
  <link rel="apple-touch-icon" sizes="192x192" href="/imagens/logo3d192.png" />
  <link rel="manifest" href="/manifest.json" />

  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('SW Ativo no Instalador:', reg.scope))
        .catch((err) => console.warn('Erro ao registrar SW:', err));
    }
  </script>

  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/@phosphor-icons/web"></script>

  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              50: '#f0fdf4',
              100: '#dcfce7',
              500: '#22c55e',
              600: '#16a34a',
              700: '#15803d',
              800: '#166534',
              900: '#14532d',
            }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-900 min-h-screen flex items-center justify-center p-4 antialiased text-slate-100">
  <div class="max-w-sm w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
    <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-brand-500 via-brand-600 to-emerald-400"></div>

    <div class="space-y-2">
      <div class="w-20 h-20 bg-brand-900/60 border border-brand-700/50 rounded-3xl flex items-center justify-center mx-auto shadow-inner text-brand-400">
        <i class="ph-bold ph-device-mobile-camera text-4xl"></i>
      </div>
      <h1 class="text-xl font-black text-white tracking-tight">Instalar Aplicativo</h1>
      <p class="text-xs text-slate-300">
        Instale o <span class="font-bold text-brand-400">ARVOCAR</span> no seu aparelho para melhor desempenho, acesso rápido e uso off-line.
      </p>
    </div>

    <div class="space-y-3 pt-2">
      <button id="btn-instalar" class="w-full bg-brand-700 hover:bg-brand-600 active:scale-95 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-brand-900/30 transition flex items-center justify-center gap-2 text-sm">
        <i class="ph-bold ph-download-simple text-lg"></i>
        <span id="btn-instalar-texto">Instalar Aplicativo</span>
      </button>

      <div id="box-ios" class="hidden p-4 bg-slate-700/50 border border-slate-600 rounded-2xl text-left text-xs text-slate-300 space-y-2">
        <p class="font-bold text-brand-300 flex items-center gap-1.5">
          <i class="ph-bold ph-apple-logo text-base"></i> No iPhone ou iPad:
        </p>
        <ol class="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
          <li>Toque no botão <b>Compartilhar</b> <i class="ph-bold ph-export inline text-xs"></i> no Safari.</li>
          <li>Role para baixo e selecione <b>Adicionar à Tela de Início</b> <i class="ph-bold ph-plus-square inline text-xs"></i>.</li>
        </ol>
      </div>

      <button onclick="continuarWeb()" class="w-full bg-transparent hover:bg-slate-700/40 text-slate-400 hover:text-slate-200 font-semibold py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5">
        <span>Acessar pelo navegador</span>
        <i class="ph-bold ph-arrow-right"></i>
      </button>
    </div>
  </div>

  <script>
    let deferredPrompt = null;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const isMobileDevice = /Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1);

    if (isStandalone) {
      window.location.replace("mobile.html");
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS && !isStandalone) {
      const boxIos = document.getElementById('box-ios');
      const btn = document.getElementById('btn-instalar');
      if (boxIos) boxIos.classList.remove('hidden');
      if (btn) {
        document.getElementById('btn-instalar-texto').innerText = "Toque em Compartilhar abaixo";
      }
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const btn = document.getElementById('btn-instalar');
      if (btn && !isIOS) {
        btn.classList.remove('hidden');
      }
    });

    document.getElementById('btn-instalar').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          window.location.replace("mobile.html");
        }
        deferredPrompt = null;
      } else if (isIOS) {
        alert("No iPhone/iPad: Toque no botão 'Compartilhar' do Safari e selecione 'Adicionar à Tela de Início'.");
      } else {
        alert("Para instalar no navegador do computador ou Android, clique nos três pontinhos do navegador e selecione 'Instalar aplicativo'.");
      }
    });

    window.addEventListener('appinstalled', () => {
      window.location.replace("mobile.html");
    });

    function continuarWeb() {
      window.location.href = "mobile.html";
    }
  </script>
</body>
</html>

================================================================================
7. REGRAS DE NEGÓCIO E VALIDAÇÕES DO SISTEMA
================================================================================

--------------------------------------------------------------------------------
7.1 Diferenciação de Frota: PROPRIO vs EXTERNO
--------------------------------------------------------------------------------
- PROPRIO: Veículos oficiais da empresa. O campo de KM de Saída permanece bloqueado
  (read-only) com o valor exato do último encerramento, garantindo sequência rígida[cite: 12].
- EXTERNO: Veículos de locação, parceiros ou uso esporádico. O campo de KM de Saída
  fica liberado para digitação, permitindo ao condutor confirmar ou corrigir o valor[cite: 12].
- Trava Unidirecional de Devolução (Hard Check): O KM de Retorno não pode ser menor
  que o KM de Saída sob nenhuma circunstância[cite: 6, 12].

--------------------------------------------------------------------------------
7.2 Vínculo Operacional e Chave por Placa Física
--------------------------------------------------------------------------------
- Rotas, abastecimentos e agendamentos gravam a placa do veículo[cite: 1].
- Quando um veículo precisa ser desativado, seu status é alterado para "Fora de Uso"[cite: 1].
- Um novo carro pode assumir o mesmo nome de frota (ex.: "ARVO 11"), mantendo o histórico
  físico congelado pela placa em cada lançamento prévio[cite: 1].
- As operações que alteram o status do veículo para 'Em Uso' ou 'Disponivel' utilizam
  prioritariamente a coluna `placa` como chave de busca[cite: 6].

--------------------------------------------------------------------------------
7.3 Bloqueio e Encerramento Automático de Reservas
--------------------------------------------------------------------------------
- Ao abrir uma rota, o sistema consulta a tabela `reservas`[cite: 2, 7].
- Se houver agendamento `CONFIRMADA` coincidindo com o horário corrente, condutores
  terceiros são impedidos de iniciar a viagem com o alerta: "⛔ VEÍCULO BLOQUEADO POR RESERVA!"[cite: 2, 7].
- Apenas o condutor titular da reserva ou o e-mail administrativo ('admin@arvo.tec.br')
  têm permissão para abrir o carro[cite: 2, 7].
- Ao encerrar a viagem iniciada pelo responsável pela reserva, o sistema encerra o
  agendamento automaticamente, alterando o status da reserva para `CONCLUIDA`[cite: 2].

================================================================================
8. GUIA OPERACIONAL PASSO A PASSO
================================================================================

8.1 Acesso e Autenticação (Online e Login Offline)
1. Preencha seu e-mail corporativo e senha cadastrados no banco[cite: 6].
2. Primeiro Acesso: Deve ser realizado conectado para salvar o perfil em cache[cite: 6].
3. Acessos Seguintes: O sistema autentica o condutor mesmo sem internet ativa[cite: 6].

8.2 Abertura e Saída de Rota
1. Na aba 'Iniciar', selecione o carro na lista[cite: 6].
2. Se o carro for da frota própria, o KM inicial já vem preenchido e travado[cite: 12].
   Se for externo, confira o painel e ajuste se necessário[cite: 12].
3. Selecione ou digite a Origem e informe a Finalidade da viagem[cite: 6].
4. Toque em 'Iniciar Rota'[cite: 6]. O carro passa imediatamente para 'Em Uso'[cite: 6].

8.3 Fechamento de Rota e Registro de Avarias
1. Na aba 'Finalizar', selecione a rota ativa[cite: 6].
2. Indique o local de devolução (Destino) e o KM de Retorno[cite: 6].
3. A distância total percorrida é calculada em tempo real[cite: 6].
4. Caso haja problemas mecânicos, marque 'Relatar Anomalia' e descreva a falha[cite: 6].
5. Clique em 'Finalizar Rota'[cite: 6]. O carro retorna ao status 'Disponivel'[cite: 6].

8.4 Agendamento de Veículos e Calendário Interativo
1. Abra 'reservasmobile.html'[cite: 6].
2. Escolha o veículo, período de início e término e a finalidade[cite: 6].
3. Clique em 'Agendar Veículo'[cite: 6].
4. A reserva é sinalizada no FullCalendar com cores exclusivas por carro[cite: 6, 8, 14].
5. O solicitante ou o administrador podem cancelar o agendamento a qualquer momento[cite: 6].

8.5 Registro e Consulta de Abastecimento com Comprovante Fiscal
1. Acesse 'abastecimentomobile.html'[cite: 6].
2. Selecione o veículo, preencha o posto, combustível, litros e preço unitário[cite: 6].
3. Informe o KM no momento da parada[cite: 6].
4. Toque em 'Tirar foto ou anexar comprovante' para capturar o cupom[cite: 6].
5. Toque em 'Registrar Abastecimento'[cite: 6].
6. Na aba 'Histórico', clique em 'Ver Detalhes' para inspecionar os dados ou baixar a imagem[cite: 4].

================================================================================
9. CÓDIGOS-FONTE COMPLETOS DOS MÓDULOS JAVASCRIPT
================================================================================

--------------------------------------------------------------------------------
9.1 arvocarmobile/backendmobile/mobile.js
--------------------------------------------------------------------------------
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

let usuarioLogado = null;
let veiculos = [];
let rotas = [];

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
  const placa = opt?.dataset?.placa;

  const v = veiculos.find(item => 
    (placa && item.placa === placa) ||
    (uuid && item.uuid_veiculos === uuid) || 
    (item.nome_frota === vId || item.id === vId)
  );

  const inputKm = document.getElementById('m-inicio-km');
  if (inputKm) {
    inputKm.value = v ? v.km_atual : '';
    if (v && (v.tipo_frota || '').toUpperCase() === 'EXTERNO') {
      inputKm.readOnly = false;
    } else {
      inputKm.readOnly = true;
    }
  }
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

  const veiculo = veiculos.find(v =>
    (placaVeiculo && String(v.placa) === String(placaVeiculo)) ||
    (uuidVeiculo && String(v.uuid_veiculos) === String(uuidVeiculo)) ||
    String(v.nome_frota) === String(veiculoId) ||
    String(v.id) === String(veiculoId)
  );

  if (!veiculo || !usuarioLogado) {
    alert("Selecione um veículo disponível.");
    return;
  }

  const placaFinal = veiculo.placa || placaVeiculo;
  if (!placaFinal) {
    alert("Erro: O veículo não possui placa vinculada.");
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
  const payloadRota = {
    id: tempId,
    veiculo_id: veiculo.nome_frota || veiculoId,
    uuid_veiculos: uuidVeiculo || veiculo.uuid_veiculos || null,
    placa: placaFinal,
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

  try {
    delete payloadRota.id;
    delete payloadRota.offline_sync;

    const { data: inserido, error: insertErr } = await db.from('rotas').insert([payloadRota]).select().single();
    if (insertErr) throw insertErr;

    const { error: errVeic } = await db.from('veiculos')
      .update({ status: 'Em Uso' })
      .eq('placa', placaFinal);

    if (errVeic) throw errVeic;

    alert(`✅ Rota com o veículo [${placaFinal}] iniciada com sucesso!`);
    e.target.reset();
    toggleOutroOrigemMobile('');
    await carregarDadosMobile();
    switchMobileTab('finalizar');
  } catch (err) {
    console.warn("Falha de rede ao iniciar, persistindo na fila local:", err);
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

  const veiculo = (veiculos || []).find(v =>
    (rota.placa && String(v.placa) === String(rota.placa)) ||
    String(v.id) === String(rota.veiculo_id) ||
    String(v.uuid_veiculos) === String(rota.uuid_veiculos) ||
    String(v.nome_frota) === String(rota.veiculo_id)
  ) || {};

  const placaAlvo = rota.placa || veiculo.placa;

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

  if (!navigator.onLine || String(rota.id).startsWith('temp_')) {
    salvarNaFilaRotas({ tipo: 'FIM', payload: payloadFim, placa: placaAlvo });
    rota.status = 'Concluida';
    rota.km_total = kmTotal;
    rota.data_retorno = payloadFim.data_retorno;
    rota.destino = destinoFinal;

    if (veiculo) {
      veiculo.km_atual = kmRetorno;
      veiculo.status = 'Disponivel';
    }
    salvarCachesLocais();
    alert(`📶 Rota encerrada Offline! Será sincronizada quando houver conexão.`);
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
      data_retorno: payloadFim.data_retorno,
      status: 'Concluida',
      anomalia: payloadFim.anomalia
    }).eq('id', rota.id);

    if (errRota) throw errRota;

    const payloadVeiculo = {
      km_atual: kmRetorno,
      status: 'Disponivel',
      anomalias: anomaliaMarcada ? relatorioAnomalia : (veiculo.anomalias || null)
    };

    if (placaAlvo) {
      const { error: errVeic } = await db.from('veiculos')
        .update(payloadVeiculo)
        .eq('placa', placaAlvo);

      if (errVeic) console.warn("Aviso ao atualizar status pela placa:", errVeic.message);
    } else {
      await db.from('veiculos').update(payloadVeiculo).eq('id', rota.veiculo_id);
    }

    alert(`✅ Rota concluída com sucesso! Distância: ${kmTotal} km.`);
    e.target.reset();
    toggleOutroDestinoMobile('');
    toggleAnomaliaMobile(false);
    document.getElementById('m-detalhes-viagem')?.classList.add('hidden');
    await carregarDadosMobile();
    switchMobileTab('historico');
  } catch (err) {
    console.warn("Salvando encerramento na fila offline:", err);
    salvarNaFilaRotas({ tipo: 'FIM', payload: payloadFim, placa: placaAlvo });
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
        if (payload.placa) {
          await db.from('veiculos').update({ status: 'Em Uso' }).eq('placa', payload.placa);
        } else {
          await db.from('veiculos').update({ status: 'Em Uso' }).eq('id', payload.veiculo_id);
        }
      } else if (item.tipo === 'FIM') {
        const { rota_id, ...dadosFim } = item.payload;
        if (!String(rota_id).startsWith('temp_')) {
          await db.from('rotas').update(dadosFim).eq('id', rota_id);
        }
        if (item.placa) {
          await db.from('veiculos').update({ km_atual: dadosFim.km_retorno, status: 'Disponivel' }).eq('placa', item.placa);
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

document.addEventListener('DOMContentLoaded', () => {
  const sessao = obterSessaoAtiva();
  if (sessao) {
    usuarioLogado = sessao;
    iniciarAppMobile();
  }
});

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

--------------------------------------------------------------------------------
9.2 arvocarmobile/backendmobile/abastecimentomobile.js
--------------------------------------------------------------------------------
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";

const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

let usuarioLogado = null;
let veiculosAbast = [];
let listaAbastecimentosCache = [];
let urlComprovanteAtual = null;

async function initAbastecimentoMobile() {
  try {
    const sessaoStr = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
    if (sessaoStr) {
      usuarioLogado = JSON.parse(sessaoStr);
      const userDisplay = document.getElementById('user-display') || document.getElementById('m-top-username');
      if (userDisplay) {
        userDisplay.innerText = `${usuarioLogado.nome || usuarioLogado.email || 'Condutor'}`;
      }
    }
  } catch (e) {
    console.warn("Aviso ao ler sessão:", e);
  }

  await carregarVeiculosAbastecimento();
  await carregarHistoricoAbastecimento();
  sincronizarFilaAbastecimentos();
}

function trocarAba(aba) {
  const viewNovo = document.getElementById('view-novo');
  const viewHist = document.getElementById('view-historico');
  const btnNovo = document.getElementById('tab-btn-novo');
  const btnHist = document.getElementById('tab-btn-historico');

  if (!viewNovo || !viewHist) return;

  if (aba === 'novo') {
    viewNovo.classList.remove('hidden');
    viewHist.classList.add('hidden');
    if (btnNovo) btnNovo.className = "flex-1 py-2.5 text-center font-bold text-amber-400 border-b-2 border-amber-400 flex items-center justify-center gap-1.5 transition";
    if (btnHist) btnHist.className = "flex-1 py-2.5 text-center font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
  } else {
    viewNovo.classList.add('hidden');
    viewHist.classList.remove('hidden');
    if (btnHist) btnHist.className = "flex-1 py-2.5 text-center font-bold text-amber-400 border-b-2 border-amber-400 flex items-center justify-center gap-1.5 transition";
    if (btnNovo) btnNovo.className = "flex-1 py-2.5 text-center font-medium text-slate-400 hover:text-slate-200 border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
    carregarHistoricoAbastecimento();
  }
}

async function carregarVeiculosAbastecimento() {
  const sel = document.getElementById('abs-veiculo');
  if (!sel) return;

  const localV = localStorage.getItem('arvo_cache_veiculos');
  if (localV) {
    veiculosAbast = JSON.parse(localV);
    renderSelectVeiculos(sel);
  }

  if (navigator.onLine) {
    try {
      const { data, error } = await db.from('veiculos').select('*').neq('status', 'Fora de Uso').order('nome_frota');
      if (!error && data) {
        veiculosAbast = data;
        localStorage.setItem('arvo_cache_veiculos', JSON.stringify(data));
        renderSelectVeiculos(sel);
      }
    } catch (e) {
      console.warn("Offline: Usando veículos em cache.");
    }
  }
}

function renderSelectVeiculos(sel) {
  sel.innerHTML = '<option value="">Selecione o veículo...</option>';
  veiculosAbast.forEach(v => {
    sel.innerHTML += `<option value="${v.nome_frota || v.id}" data-uuid="${v.uuid_veiculos || ''}" data-placa="${v.placa || ''}">${v.nome_frota || v.id} - ${v.marca || ''} [${v.placa || ''}]</option>`;
  });
}

function calcularTotal() {
  const inputLitros = document.getElementById('abs-litros');
  const inputPreco = document.getElementById('abs-preco-litro');
  const displayTotal = document.getElementById('display-total');

  const litros = parseFloat(inputLitros?.value) || 0;
  const preco = parseFloat(inputPreco?.value) || 0;
  const total = litros * preco;

  if (displayTotal) {
    displayTotal.innerText = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}

function atualizarNomeArquivo(input) {
  const label = document.getElementById('comprovante-nome');
  if (!label) return;
  if (input.files && input.files[0]) {
    label.innerText = `Anexado: ${input.files[0].name.substring(0, 20)}...`;
  } else {
    label.innerText = 'Tirar foto ou anexar comprovante';
  }
}

async function salvarAbastecimento(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const btn = document.getElementById('btn-submit');

  const selVeiculo = document.getElementById('abs-veiculo');
  const opt = selVeiculo ? selVeiculo.options[selVeiculo.selectedIndex] : null;
  const veiculo_id = selVeiculo ? selVeiculo.value : '';

  if (!veiculo_id) {
    alert("Por favor, selecione um veículo.");
    return;
  }

  const uuid_veiculos = opt?.dataset?.uuid || null;
  const placa = opt?.dataset?.placa || null;
  const local_posto = (document.getElementById('abs-posto')?.value || '').trim().toUpperCase();
  const tipo_combustivel = document.getElementById('abs-tipo')?.value || 'Gasolina Comum';
  const km_input = document.getElementById('abs-km')?.value;
  const km_atual = km_input ? parseInt(km_input, 10) : null;
  const quantidade_litros = parseFloat(document.getElementById('abs-litros')?.value) || 0;
  const preco_litro = parseFloat(document.getElementById('abs-preco-litro')?.value) || 0;
  const valor_total = Number((quantidade_litros * preco_litro).toFixed(2));
  const fotoInput = document.getElementById('abs-foto');

  if (quantidade_litros <= 0 || preco_litro <= 0) {
    alert("Informe valores válidos para litros e preço unitário.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;
  }

  const payload = {
    veiculo_id,
    uuid_veiculos,
    placa,
    responsavel: (usuarioLogado && usuarioLogado.email) ? usuarioLogado.email : 'admin@arvo.tec.br',
    local_posto,
    tipo_combustivel,
    quantidade_litros,
    preco_litro,
    valor_total,
    km_atual,
    data_hora: new Date().toISOString()
  };

  if (!navigator.onLine) {
    if (fotoInput && fotoInput.files && fotoInput.files[0]) {
      payload.foto_base64 = await fileToBase64(fotoInput.files[0]);
      payload.foto_nome = fotoInput.files[0].name;
    }
    salvarFilaAbastecimento(payload);
    salvarHistoricoLocal(payload);
    alert('📶 Abastecimento gravado em Modo Offline! Será enviado ao conectar.');
    limparFormularioAposSalvar();
    if (btn) btn.disabled = false;
    return;
  }

  try {
    let url_comprovante = null;
    if (fotoInput && fotoInput.files && fotoInput.files[0]) {
      const file = fotoInput.files[0];
      const fileName = `abast_${Date.now()}_${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
      const { error: upErr } = await db.storage.from('comprovantes').upload(fileName, file);
      if (!upErr) {
        url_comprovante = db.storage.from('comprovantes').getPublicUrl(fileName).data?.publicUrl;
      }
    }
    payload.url_comprovante = url_comprovante;

    const { error: insErr } = await db.from('abastecimentos').insert([payload]);
    if (insErr) throw insErr;

    alert('✅ Abastecimento registrado com sucesso!');
    limparFormularioAposSalvar();
    await carregarHistoricoAbastecimento();
    trocarAba('historico');
  } catch (err) {
    console.warn("Erro online, desviando para fila offline:", err);
    salvarFilaAbastecimento(payload);
    alert('📶 Gravado localmente devido a oscilação no sinal.');
    limparFormularioAposSalvar();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-base"></i><span>Registrar Abastecimento</span>`;
    }
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function salvarFilaAbastecimento(item) {
  const fila = JSON.parse(localStorage.getItem('arvo_sync_abast_queue') || '[]');
  fila.push(item);
  localStorage.setItem('arvo_sync_abast_queue', JSON.stringify(fila));
}

function salvarHistoricoLocal(item) {
  listaAbastecimentosCache.unshift(item);
  localStorage.setItem('arvo_cache_abastecimentos', JSON.stringify(listaAbastecimentosCache));
}

async function sincronizarFilaAbastecimentos() {
  if (!navigator.onLine) return;
  const fila = JSON.parse(localStorage.getItem('arvo_sync_abast_queue') || '[]');
  if (fila.length === 0) return;

  console.log(`-> Sincronizando ${fila.length} abastecimentos pendentes...`);
  const restantes = [];

  for (const item of fila) {
    try {
      const { foto_base64, foto_nome, ...payloadEnvio } = item;
      await db.from('abastecimentos').insert([payloadEnvio]);
    } catch (e) {
      restantes.push(item);
    }
  }

  localStorage.setItem('arvo_sync_abast_queue', JSON.stringify(restantes));
  if (restantes.length === 0) {
    await carregarHistoricoAbastecimento();
  }
}

window.addEventListener('online', sincronizarFilaAbastecimentos);

function limparFormularioAposSalvar() {
  const form = document.getElementById('form-abastecimento');
  if (form) form.reset();
  const labelFoto = document.getElementById('comprovante-nome');
  if (labelFoto) labelFoto.innerText = 'Tirar foto ou anexar comprovante';
  calcularTotal();
}

async function carregarHistoricoAbastecimento() {
  const container = document.getElementById('lista-abastecimentos');
  if (!container) return;

  const localAbast = localStorage.getItem('arvo_cache_abastecimentos');
  if (localAbast) {
    listaAbastecimentosCache = JSON.parse(localAbast);
    renderCardsHistorico(container);
  }

  if (navigator.onLine) {
    try {
      const { data, error } = await db.from('abastecimentos').select('*').order('data_hora', { ascending: false }).limit(30);
      if (!error && data) {
        listaAbastecimentosCache = data;
        localStorage.setItem('arvo_cache_abastecimentos', JSON.stringify(data));
        renderCardsHistorico(container);
      }
    } catch (e) {
      console.warn("Offline: Mantendo histórico cacheado.");
    }
  }
}

function renderCardsHistorico(container) {
  if (listaAbastecimentosCache.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">Nenhum abastecimento encontrado.</div>`;
    return;
  }
  container.innerHTML = '';
  listaAbastecimentosCache.forEach((a, index) => {
    const card = document.createElement('div');
    card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5 transition";
    const valorFormatado = Number(a.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-black text-slate-800 flex items-center gap-1.5">
          <i class="ph-bold ph-gas-pump text-amber-500"></i> ${a.veiculo_id} [${a.placa || ''}]
        </span>
        <span class="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
          ${valorFormatado}
        </span>
      </div>
      <div class="text-xs text-slate-600 font-medium">
        <i class="ph-bold ph-map-pin text-slate-400"></i> ${a.local_posto || '-'} • <span class="text-slate-500 font-normal">${a.tipo_combustivel || 'Combustível'}</span>
      </div>
      <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1.5 border-t border-slate-100">
        <span>${a.quantidade_litros} L (R$ ${Number(a.preco_litro).toFixed(2)}/L)</span>
        <span>${new Date(a.data_hora).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="pt-1 flex items-center justify-between border-t border-slate-100">
        <span class="text-[10px] text-slate-400 truncate max-w-[150px]">
          <i class="ph-bold ph-user"></i> ${(a.responsavel || '').split('@')[0]}
        </span>
        <button onclick="abrirModalAbastecimento(${index})" class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 transition">
          <i class="ph-bold ph-eye"></i> Ver Detalhes
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function abrirModalAbastecimento(index) {
  const item = listaAbastecimentosCache[index];
  if (!item) return;

  urlComprovanteAtual = item.url_comprovante;

  document.getElementById('modal-abast-veiculo').innerText = `${item.veiculo_id} [${item.placa || ''}]`;
  document.getElementById('modal-abast-posto').innerText = item.local_posto || '-';
  document.getElementById('modal-abast-tipo').innerText = item.tipo_combustivel || 'Não informado';
  document.getElementById('modal-abast-resp').innerText = item.responsavel || '-';
  document.getElementById('modal-abast-km').innerText = item.km_atual ? `${Number(item.km_atual).toLocaleString('pt-BR')} km` : 'Não registrado';
  document.getElementById('modal-abast-litros-preco').innerText = `${item.quantidade_litros} L • R$ ${Number(item.preco_litro).toFixed(2)}/L`;
  document.getElementById('modal-abast-total').innerText = Number(item.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  document.getElementById('modal-abast-data').innerText = new Date(item.data_hora).toLocaleString('pt-BR');

  const boxComprovante = document.getElementById('modal-box-comprovante');
  const semComprovante = document.getElementById('modal-sem-comprovante');
  const imgPreview = document.getElementById('modal-img-preview');
  const btnVer = document.getElementById('btn-ver-imagem');

  if (item.url_comprovante) {
    imgPreview.src = item.url_comprovante;
    btnVer.href = item.url_comprovante;
    boxComprovante.classList.remove('hidden');
    semComprovante.classList.add('hidden');
  } else {
    boxComprovante.classList.add('hidden');
    semComprovante.classList.remove('hidden');
  }

  document.getElementById('modal-detalhes-abast').classList.remove('hidden');
}

function fecharModalAbastecimento() {
  document.getElementById('modal-detalhes-abast').classList.add('hidden');
}

async function baixarImagemComprovante() {
  if (!urlComprovanteAtual) return;
  try {
    const resposta = await fetch(urlComprovanteAtual);
    const blob = await resposta.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `comprovante_abastecimento_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (err) {
    window.open(urlComprovanteAtual, '_blank');
  }
}

function handleMobileLogout() {
  if (confirm("Deseja realmente sair da sua conta?")) {
    localStorage.removeItem('arvo_mobile_user');
    localStorage.removeItem('arvo_usuario_logado');
    window.location.href = "mobile.html";
  }
}

window.trocarAba = trocarAba;
window.calcularTotal = calcularTotal;
window.atualizarNomeArquivo = atualizarNomeArquivo;
window.salvarAbastecimento = salvarAbastecimento;
window.carregarHistorico = carregarHistoricoAbastecimento;
window.abrirModalAbastecimento = abrirModalAbastecimento;
window.fecharModalAbastecimento = fecharModalAbastecimento;
window.baixarImagemComprovante = baixarImagemComprovante;
window.handleMobileLogout = handleMobileLogout;

document.addEventListener('DOMContentLoaded', initAbastecimentoMobile);

--------------------------------------------------------------------------------
9.3 arvocarmobile/backendmobile/reservasmobile.js
--------------------------------------------------------------------------------
const SUPABASE_URL = "https://kadowettowccespuieyl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthZG93ZXR0b3djY2VzcHVpZXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTc0NzYsImV4cCI6MjEwMzMzMzQ3Nn0.0gzxoaEZuorI1tZtUhJpyzWK48ENZP7LJZrqcXIlDQ0";
const ADMIN_EMAIL = "admin@arvo.tec.br";

const db = window.db || (window.supabase && typeof window.supabase.createClient === 'function'
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));

let usuarioLogado = null;
let veiculosReserva = [];
let listaReservas = [];
let calendar = null;

const coresCarros = {
  'ARVO 10': '#0284c7',
  'ARVO 11': '#16a34a',
  'ARVO 12': '#f59e0b',
  'ARVO 15': '#8b5cf6',
  'ARVO 16': '#ec4899',
  'DEFAULT': '#15803d'
};

async function initReservasMobile() {
  try {
    const sessaoStr = localStorage.getItem('arvo_usuario_logado') || localStorage.getItem('arvo_mobile_user');
    if (sessaoStr) {
      try {
        usuarioLogado = JSON.parse(sessaoStr);
      } catch (e) {
        usuarioLogado = { email: sessaoStr, nome: sessaoStr };
      }
      const userDisplay = document.getElementById('user-display') || document.getElementById('m-top-username');
      if (userDisplay && usuarioLogado) {
        userDisplay.innerText = `${usuarioLogado.nome || usuarioLogado.email || 'Condutor'}`;
      }
    }
  } catch (err) {
    console.warn("Aviso na leitura da sessão:", err);
  }

  const hojeStr = new Date().toISOString().split('T')[0];
  const inputDtIni = document.getElementById('res-data-inicio');
  const inputDtFim = document.getElementById('res-data-fim');
  if (inputDtIni) inputDtIni.value = hojeStr;
  if (inputDtFim) inputDtFim.value = hojeStr;

  await carregarVeiculosReservas();
  await carregarHistoricoReservas();
  initCalendario();
  sincronizarFilaReservas();
}

async function carregarVeiculosReservas() {
  const sel = document.getElementById('res-veiculo') || document.getElementById('m-res-veiculo');
  if (!sel) return;

  const localV = localStorage.getItem('arvo_cache_veiculos');
  if (localV) {
    veiculosReserva = JSON.parse(localV);
    renderSelectVeiculos(sel);
  }

  if (navigator.onLine) {
    try {
      const { data, error } = await db
        .from('veiculos')
        .select('*')
        .neq('status', 'Fora de Uso')
        .order('nome_frota');

      if (!error && data) {
        veiculosReserva = data;
        localStorage.setItem('arvo_cache_veiculos', JSON.stringify(data));
        renderSelectVeiculos(sel);
      }
    } catch (err) {
      console.warn("Offline: Usando veículos cacheados para reserva.");
    }
  }
}

function renderSelectVeiculos(sel) {
  sel.innerHTML = '<option value="">Selecione o veículo...</option>';
  veiculosReserva.forEach(v => {
    const nome = v.nome_frota || v.id;
    sel.innerHTML += `<option value="${nome}" data-uuid="${v.uuid_veiculos || ''}" data-placa="${v.placa || ''}">${nome} - ${v.marca || ''} [${v.placa || 'S/ Placa'}]</option>`;
  });
}

function initCalendario() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl || typeof FullCalendar === 'undefined') return;

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'pt-br',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listMonth'
    },
    buttonText: {
      today: 'Hoje',
      month: 'Mês',
      list: 'Lista'
    },
    events: function(fetchInfo, successCallback, failureCallback) {
      const eventos = listaReservas.map(r => {
        const veic = (veiculosReserva || []).find(v =>
          String(v.placa) === String(r.veiculo_id) ||
          String(v.id) === String(r.veiculo_id) ||
          String(v.nome_frota) === String(r.veiculo_id) ||
          String(v.uuid_veiculos) === String(r.uuid_veiculos || r.veiculo_id)
        );

        const nomeFrotaExibicao = veic?.nome_frota || r.nome_frota || r.veiculo_id || 'ARVO';

        return {
          id: String(r.id),
          title: `${nomeFrotaExibicao} - ${(r.responsavel || '').split('@')[0]}`,
          start: r.data_inicio,
          end: r.data_fim,
          backgroundColor: coresCarros[nomeFrotaExibicao] || coresCarros[r.veiculo_id] || coresCarros.DEFAULT,
          extendedProps: {
            responsavel: r.responsavel,
            finalidade: r.finalidade,
            veiculo: nomeFrotaExibicao
          }
        };
      });
      successCallback(eventos);
    },
    eventClick: function(info) {
      const p = info.event.extendedProps;
      alert(`🚗 Reserva: ${p.veiculo}\n👤 Condutor: ${p.responsavel}\n🎯 Finalidade: ${p.finalidade}\n📅 Início: ${new Date(info.event.start).toLocaleString('pt-BR')}\n📅 Fim: ${new Date(info.event.end).toLocaleString('pt-BR')}`);
    }
  });

  calendar.render();
}

async function salvarReservaMobile(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const btn = document.getElementById('btn-submit');

  const selVeiculo = document.getElementById('res-veiculo') || document.getElementById('m-res-veiculo');
  const opt = selVeiculo ? selVeiculo.options[selVeiculo.selectedIndex] : null;
  const veiculo_id = selVeiculo ? selVeiculo.value : '';

  if (!veiculo_id) {
    alert("Por favor, selecione um veículo disponível.");
    return;
  }

  const uuid_veiculos = opt?.dataset?.uuid || null;
  const placa = opt?.dataset?.placa || null;
  const finalidade = document.getElementById('res-finalidade')?.value || 'DEMANDAS INTERNAS';
  const tipo_reserva = document.getElementById('res-tipo')?.value || 'DIAS';
  const data_inicio = document.getElementById('res-data-inicio')?.value;
  const data_fim = document.getElementById('res-data-fim')?.value;

  if (!data_inicio || !data_fim) {
    alert("Informe o período do agendamento.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-base"></i> Gravando...`;
  }

  const tempId = `temp_res_${Date.now()}`;
  const payload = {
    id: tempId,
    veiculo_id,
    uuid_veiculos,
    placa,
    responsavel: (usuarioLogado && usuarioLogado.email) ? usuarioLogado.email : 'admin@arvo.tec.br',
    finalidade,
    tipo_reserva,
    data_inicio: new Date(data_inicio).toISOString(),
    data_fim: new Date(data_fim).toISOString(),
    status: 'CONFIRMADA'
  };

  if (!navigator.onLine) {
    salvarFilaReserva(payload);
    listaReservas.unshift(payload);
    localStorage.setItem('arvo_cache_reservas', JSON.stringify(listaReservas));
    alert('📶 Agendamento gravado Offline! Será sincronizado ao reconectar.');
    limparFormularioReserva();
    renderHistoricoCards();
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-calendar-plus text-base"></i> Agendar Veículo`;
    }
    return;
  }

  try {
    delete payload.id;
    const { error: insErr } = await db.from('reservas').insert([payload]);
    if (insErr) throw insErr;

    alert('✅ Reserva agendada com sucesso!');
    limparFormularioReserva();
    await carregarHistoricoReservas();
  } catch (err) {
    console.warn("Salvando agendamento na fila offline:", err);
    payload.id = tempId;
    salvarFilaReserva(payload);
    listaReservas.unshift(payload);
    localStorage.setItem('arvo_cache_reservas', JSON.stringify(listaReservas));
    alert('📶 Salvo localmente devido a oscilações no sinal.');
    limparFormularioReserva();
    renderHistoricoCards();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-calendar-plus text-base"></i> Agendar Veículo`;
    }
  }
}

function limparFormularioReserva() {
  const form = document.getElementById('form-reserva');
  if (form) form.reset();
}

function salvarFilaReserva(item) {
  const fila = JSON.parse(localStorage.getItem('arvo_sync_reservas_queue') || '[]');
  fila.push(item);
  localStorage.setItem('arvo_sync_reservas_queue', JSON.stringify(fila));
}

async function sincronizarFilaReservas() {
  if (!navigator.onLine) return;
  const fila = JSON.parse(localStorage.getItem('arvo_sync_reservas_queue') || '[]');
  if (fila.length === 0) return;

  console.log(`-> Sincronizando ${fila.length} agendamentos pendentes...`);
  const restantes = [];

  for (const item of fila) {
    try {
      const payloadEnvio = { ...item };
      delete payloadEnvio.id;
      await db.from('reservas').insert([payloadEnvio]);
    } catch (e) {
      restantes.push(item);
    }
  }

  localStorage.setItem('arvo_sync_reservas_queue', JSON.stringify(restantes));
  if (restantes.length === 0) {
    await carregarHistoricoReservas();
  }
}

window.addEventListener('online', sincronizarFilaReservas);

async function carregarHistoricoReservas() {
  const localRes = localStorage.getItem('arvo_cache_reservas');
  if (localRes) {
    listaReservas = JSON.parse(localRes);
    renderHistoricoCards();
  }

  if (navigator.onLine) {
    try {
      const { data, error } = await db
        .from('reservas')
        .select('*')
        .eq('status', 'CONFIRMADA')
        .order('data_inicio', { ascending: true });

      if (!error && data) {
        listaReservas = data;
        localStorage.setItem('arvo_cache_reservas', JSON.stringify(data));
        renderHistoricoCards();
      }
    } catch (err) {
      console.warn("Offline: Mantendo histórico cacheado de reservas.");
    }
  }
}

function renderHistoricoCards() {
  const container = document.getElementById('lista-reservas');
  const badge = document.getElementById('badge-total-reservas');
  if (!container) return;

  if (badge) badge.innerText = `${listaReservas.length} reservas`;

  if (listaReservas.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-slate-400 text-xs">Nenhum agendamento ativo no momento.</div>`;
    if (calendar) calendar.refetchEvents();
    return;
  }

  const ehAdmin = (usuarioLogado?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
  container.innerHTML = '';

  listaReservas.forEach(r => {
    const ehDono = (usuarioLogado?.email || '').toLowerCase() === (r.responsavel || '').toLowerCase();
    const dataIni = new Date(r.data_inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const dataFim = new Date(r.data_fim).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    const veic = (veiculosReserva || []).find(v =>
      String(v.id) === String(r.veiculo_id) ||
      String(v.placa) === String(r.veiculo_id) ||
      String(v.nome_frota) === String(r.veiculo_id) ||
      String(v.uuid_veiculos) === String(r.uuid_veiculos || r.veiculo_id)
    );

    const nomeExibicao = veic?.nome_frota || r.nome_frota || r.veiculo_id || 'Veículo';
    const placaExibicao = (veic?.placa && veic.placa !== nomeExibicao) ? ` [${veic.placa}]` : '';

    const card = document.createElement('div');
    card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <i class="ph-bold ph-car text-brand-600"></i> ${nomeExibicao}${placaExibicao}
        </span>
        <span class="text-[10px] bg-brand-50 text-brand-700 font-bold px-2 py-0.5 rounded-full border border-brand-200">
          ${r.tipo_reserva || 'DIAS'} ${String(r.id).startsWith('temp_') ? '(Pendente 📶)' : ''}
        </span>
      </div>
      <div class="text-xs text-slate-600">
        Condutor: <b class="text-slate-800">${r.responsavel}</b>
      </div>
      <div class="text-[11px] text-slate-500">
        Finalidade: <span class="font-semibold text-slate-700">${r.finalidade}</span>
      </div>
      <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono pt-1.5 border-t border-slate-100">
        <span>📅 ${dataIni} até ${dataFim}</span>
      </div>
      ${(ehAdmin || ehDono) ? `
        <div class="pt-1.5 border-t border-slate-100 flex justify-end">
          <button onclick="cancelarReservaMobile('${r.id}', '${r.responsavel}')" class="text-rose-600 text-xs font-bold flex items-center gap-1 hover:underline">
            <i class="ph-bold ph-x-circle text-sm"></i> Cancelar Agendamento
          </button>
        </div>
      ` : ''}
    `;
    container.appendChild(card);
  });

  if (calendar) {
    calendar.refetchEvents();
  }
}

async function cancelarReservaMobile(reservaId, responsavel) {
  const ehAdmin = (usuarioLogado?.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const ehDono = (usuarioLogado?.email || '').toLowerCase() === (responsavel || '').toLowerCase();

  if (!ehAdmin && !ehDono) {
    alert("Você só pode cancelar reservas feitas pelo seu próprio usuário.");
    return;
  }

  if (confirm("Tem certeza de que deseja liberar este agendamento?")) {
    if (!navigator.onLine || String(reservaId).startsWith('temp_')) {
      listaReservas = listaReservas.filter(r => String(r.id) !== String(reservaId));
      localStorage.setItem('arvo_cache_reservas', JSON.stringify(listaReservas));
      renderHistoricoCards();
      alert("Agendamento cancelado localmente!");
      return;
    }

    try {
      const { error } = await db.from('reservas').update({ status: 'CANCELADA' }).eq('id', reservaId);
      if (error) throw error;

      alert("Agendamento cancelado com sucesso!");
      await carregarHistoricoReservas();
    } catch (err) {
      alert("Erro ao cancelar reserva: " + err.message);
    }
  }
}

function handleMobileLogout() {
  if (confirm("Deseja realmente sair da sua conta?")) {
    localStorage.removeItem('arvo_mobile_user');
    localStorage.removeItem('arvo_usuario_logado');
    window.location.href = "mobile.html";
  }
}

window.salvarReservaMobile = salvarReservaMobile;
window.cancelarReservaMobile = cancelarReservaMobile;
window.handleMobileLogout = handleMobileLogout;

document.addEventListener('DOMContentLoaded', initReservasMobile);

--------------------------------------------------------------------------------
9.4 Web Desktop: Funções em app.js (handleInicioRota & handleFimRota)
--------------------------------------------------------------------------------
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

  if (!veiculo) {
    alert("Erro: Veículo selecionado não foi localizado.");
    return;
  }

  const placaCarro = veiculo.placa;
  if (!placaCarro) {
    alert("Erro: O veículo selecionado não possui placa cadastrada.");
    return;
  }

  const selectOrigem = document.getElementById('form-inicio-origem')?.value;
  const outroOrigem = document.getElementById('form-inicio-origem-outro')?.value?.trim().toUpperCase();
  const origemFinal = selectOrigem === 'OUTRO' ? outroOrigem : selectOrigem;

  if (!origemFinal) {
    alert("Por favor, selecione ou informe a origem da saída.");
    return;
  }

  const finalidade = document.getElementById('form-inicio-finalidade')?.value || 'DEMANDAS INTERNAS';
  const kmSaida = Number(veiculo.km_atual || 0);
  const dataHoraSaidaAtual = new Date().toISOString();
  const emailCondutor = (usuarioLogado?.email || '').toLowerCase().trim();

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;
  }

  try {
    const agoraTs = new Date().getTime();
    const { data: reservasCarro } = await db
      .from('reservas')
      .select('*')
      .eq('status', 'CONFIRMADA')
      .or(`veiculo_id.eq.${veiculo.id},veiculo_id.eq.${veiculo.placa},veiculo_id.eq.${veiculo.nome_frota}`);

    if (reservasCarro && reservasCarro.length > 0) {
      const temConflito = reservasCarro.some(res => {
        const dIni = new Date(res.data_inicio).getTime();
        const dFim = new Date(res.data_fim).getTime();
        const resp = (res.responsavel || '').toLowerCase().trim();
        return agoraTs >= dIni && agoraTs <= dFim && resp !== emailCondutor && emailCondutor !== 'admin@arvo.tec.br';
      });

      if (temConflito) {
        alert("⛔ VEÍCULO BLOQUEADO: Este veículo possui agendamento confirmado para outro condutor neste horário.");
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="ph-bold ph-check-circle text-lg"></i> Iniciar Rota`;
        }
        return;
      }
    }

    const payloadRota = {
      veiculo_id: veiculo.nome_frota || veiculo.id,
      placa: placaCarro,
      uuid_veiculos: veiculo.uuid_veiculos || null,
      responsavel: usuarioLogado.email,
      origem: origemFinal,
      destino: null,
      finalidade: finalidade,
      data_saida: dataHoraSaidaAtual,
      data_retorno: null,
      km_saida: kmSaida,
      km_retorno: null,
      km_total: 0,
      consumo_litros: null,
      anomalia: '',
      status: 'Em Uso'
    };

    const { data: rotaCriada, error: erroRota } = await db
      .from('rotas')
      .insert([payloadRota])
      .select()
      .single();

    if (erroRota) throw erroRota;

    const { error: erroVeiculo } = await db
      .from('veiculos')
      .update({ status: 'Em Uso' })
      .eq('placa', placaCarro);

    if (erroVeiculo) throw erroVeiculo;

    e.target.reset();
    if (typeof toggleOutroOrigem === 'function') toggleOutroOrigem('');
    alert(`✅ Rota #${rotaCriada?.id || ''} iniciada com sucesso!`);
    await carregarTodosDadosDoBanco();
    setSubTab('operacao', 'minhas-rotas');
  } catch (err) {
    console.error("Erro ao iniciar rota Web:", err);
    alert("Erro ao gravar rota: " + (err.message || 'Verifique sua conexão.'));
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
    alert("Erro: Rota ativa não encontrada.");
    return;
  }

  const veiculo = (veiculos || []).find(v =>
    (rota.placa && String(v.placa) === String(rota.placa)) ||
    String(v.id) === String(rota.veiculo_id) ||
    String(v.uuid_veiculos) === String(rota.veiculo_id) ||
    String(v.nome_frota) === String(rota.veiculo_id)
  ) || {};

  const placaAlvo = rota.placa || veiculo.placa;

  if (kmFinal < Number(rota.km_saida)) {
    alert("Erro: O KM Final não pode ser inferior ao KM de Saída!");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="ph-bold ph-spinner animate-spin text-lg"></i> Gravando...`;
  }

  const situacao = document.querySelector('input[name="situacao_carro"]:checked')?.value || 'SEM';
  let anomaliaTexto = situacao === 'COM' ? (document.getElementById('form-fim-anomalia')?.value || '').trim() : '';

  const deltaKm = kmFinal - Number(rota.km_saida);
  const medConsumo = (Number(veiculo.consumo_min || 10) + Number(veiculo.consumo_max || 14)) / 2;
  const litrosEst = Number((deltaKm / medConsumo).toFixed(2));
  const dataHoraRetornoAtual = new Date().toISOString();

  try {
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

    const payloadVeiculo = {
      km_atual: kmFinal,
      status: 'Disponivel'
    };
    if (anomaliaTexto || veiculo.anomalias) {
      payloadVeiculo.anomalias = anomaliaTexto || veiculo.anomalias;
    }

    if (placaAlvo) {
      const { error: erroVeiculo } = await db.from('veiculos')
        .update(payloadVeiculo)
        .eq('placa', placaAlvo);

      if (erroVeiculo) console.warn("Aviso ao atualizar veículo por placa:", erroVeiculo.message);
    } else if (veiculo.id) {
      await db.from('veiculos').update(payloadVeiculo).eq('id', veiculo.id);
    }

    try {
      const filtrosReserva = [];
      if (placaAlvo) filtrosReserva.push(`veiculo_id.eq.${placaAlvo}`);
      if (rota.veiculo_id) filtrosReserva.push(`veiculo_id.eq.${rota.veiculo_id}`);
      if (veiculo.id) filtrosReserva.push(`veiculo_id.eq.${veiculo.id}`);

      await db.from('reservas').update({ status: 'CONCLUIDA' })
        .or(filtrosReserva.join(','))
        .eq('responsavel', rota.responsavel)
        .eq('status', 'CONFIRMADA');
    } catch (resErr) {
      console.warn("Aviso ao encerrar reservas vinculadas:", resErr);
    }

    e.target.reset();
    if (typeof toggleOutroDestino === 'function') toggleOutroDestino('');
    document.getElementById('fim-detalhes-viagem')?.classList.add('hidden');
    if (typeof toggleAnomaliaInput === 'function') toggleAnomaliaInput(false);

    alert(`Rota #${rotaId} encerrada com sucesso!`);
    await carregarTodosDadosDoBanco();
    setSubTab('operacao', 'minhas-rotas');
  } catch (err) {
    console.error("Erro ao encerrar rota Web:", err);
    alert("Erro ao gravar retorno: " + (err.message || 'Verifique sua conexão.'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="ph-bold ph-check text-lg"></i> Finalizar Rota`;
    }
  }
}

================================================================================
10. RESOLUÇÃO DE PROBLEMAS (TROUBLESHOOTING)
================================================================================
1. O botão "Instalar Aplicativo" não aparece no navegador Android:
   - Verifique se a aplicação está rodando sob HTTPS com certificado válido[cite: 3].
   - Certifique-se de que o Service Worker está registrado e ativo[cite: 3].

2. No iPhone / iPad (Safari) não aparece opção para instalar direto pelo botão:
   - A Apple não autoriza instalação automática via script no iOS[cite: 1, 10].
   - O condutor deve tocar em 'Compartilhar' e selecionar 'Adicionar à Tela de Início'[cite: 1, 10].

3. Tela travada em "Carregando..." em reservasmobile ou abastecimentomobile:
   - Ocorre quando a importação busca o arquivo JS na pasta local em vez de voltar um nível[cite: 4].
   - Ajuste o script para: <script src="../backendmobile/arquivo.js"></script>[cite: 4].

4. O botão "Sair" não responde nas telas secundárias:
   - A função `handleMobileLogout()` precisa estar presente e exposta no escopo global
     (`window.handleMobileLogout = handleMobileLogout;`) em todos os scripts[cite: 4, 6].

5. Indicativo de rota ou abastecimento "(Pendente 📶)":
   - Indica que a ação foi salva na memória do celular durante oscilação de sinal[cite: 6].
   - Assim que o dispositivo restabelecer conexão (Wi-Fi ou 4G/5G), os dados sobem
     automaticamente para a nuvem[cite: 6].
================================================================================
