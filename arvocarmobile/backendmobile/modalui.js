// =========================================================================
// COMPONENTE VISUAL DE POP-UP & CONFIRMAÇÃO (UI MODAL)
// =========================================================================

/**
 * Exibe um Pop-up informativo/alerta na tela.
 * @param {'sucesso'|'erro'|'aviso'|'info'} tipo 
 * @param {string} titulo 
 * @param {string} mensagem 
 * @param {Function} [onClose] 
 */
function mostrarPopup(tipo, titulo, mensagem, onClose = null) {
  const modalId = `modal-popup-${Date.now()}`;
  
  const icones = {
    sucesso: { icon: 'ph-check-circle', bg: 'bg-emerald-100', text: 'text-emerald-600', btn: 'bg-brand-700 hover:bg-brand-800' },
    erro: { icon: 'ph-x-circle', bg: 'bg-rose-100', text: 'text-rose-600', btn: 'bg-rose-600 hover:bg-rose-700' },
    aviso: { icon: 'ph-warning', bg: 'bg-amber-100', text: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700' },
    info: { icon: 'ph-info', bg: 'bg-blue-100', text: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700' }
  };

  const estilo = icones[tipo] || icones.info;

  const modalHtml = `
    <div id="${modalId}" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div class="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
        <div class="w-14 h-14 ${estilo.bg} ${estilo.text} rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
          <i class="ph-bold ${estilo.icon}"></i>
        </div>
        <div>
          <h3 class="text-base font-black text-slate-900">${titulo}</h3>
          <p class="text-xs text-slate-500 mt-1 leading-relaxed">${mensagem}</p>
        </div>
        <div class="pt-2">
          <button id="${modalId}-btn" class="w-full py-3 ${estilo.btn} text-white font-bold rounded-xl text-xs shadow-md transition">
            Entendido
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById(`${modalId}-btn`).onclick = () => {
    document.getElementById(modalId)?.remove();
    if (onClose) onClose();
  };
}

/**
 * Exibe um Pop-up de Confirmação com botões 'Confirmar' e 'Cancelar'.
 * @param {string} titulo 
 * @param {string} mensagem 
 * @param {Function} onConfirm 
 * @param {string} [textoBotao] 
 */
function mostrarConfirmacao(titulo, mensagem, onConfirm, textoBotao = "Confirmar") {
  const modalId = `modal-confirm-${Date.now()}`;

  const modalHtml = `
    <div id="${modalId}" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div class="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
        <div class="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-inner">
          <i class="ph-bold ph-question"></i>
        </div>
        <div>
          <h3 class="text-base font-black text-slate-900">${titulo}</h3>
          <p class="text-xs text-slate-500 mt-1 leading-relaxed">${mensagem}</p>
        </div>
        <div class="flex gap-2 pt-2">
          <button id="${modalId}-cancel" class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">
            Cancelar
          </button>
          <button id="${modalId}-confirm" class="flex-1 py-2.5 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-xl text-xs shadow-md transition">
            ${textoBotao}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  document.getElementById(`${modalId}-cancel`).onclick = () => {
    document.getElementById(modalId)?.remove();
  };

  document.getElementById(`${modalId}-confirm`).onclick = () => {
    document.getElementById(modalId)?.remove();
    if (onConfirm) onConfirm();
  };
}