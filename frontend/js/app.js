/**

 * SistemaRAG PNP v2.0 · Denuncias Patrimoniales

 * Frontend Application — Vanilla JavaScript ES2022

 * Maneja: JWT auth guard, API communication, Web Speech API,

 *         Whisper transcription, UI state, JSON rendering

 */



'use strict';



// ══════════════════════════════════════════════════════════════════════════════

//  Configuración

// ══════════════════════════════════════════════════════════════════════════════



const CONFIG = {

  API_BASE_URL: window.__ENV__?.API_BASE_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:8000/api/v1' : '/api/v1'),

  HEALTH_CHECK_INTERVAL: 30_000,

  TOAST_DURATION: 3000,

  MAX_RECORDING_SECONDS: 120, // 2 minutos max

  EXAMPLES: [

    'Ayer a las 9pm dos sujetos en moto me encañonaron con pistola y quitaron mi celular iPhone 14. Eran dos hombres jóvenes con cascos negros. Estábamos en la cuadra 5 del Jirón Amazonas.',

    'Hoy en el mercado de Surquillo alguien me sacó la billetera del bolsillo trasero del pantalón sin que me diera cuenta. Me di cuenta cuando fui a pagar. Me robaron mi DNI y 300 soles.',

    'Anoche a las 11pm un desconocido me cogoteó por detrás en el paradero y me arrancó el reloj de oro que me regaló mi papá. Era un hombre alto con polo negro.',

    'Esta madrugada unos ladrones escalaron la pared de mi casa mientras dormíamos y se llevaron el televisor Samsung de 55 pulgadas, mi laptop y joyas de mi mamá.',

  ],

};



// ══════════════════════════════════════════════════════════════════════════════

//  Estado de la aplicación

// ══════════════════════════════════════════════════════════════════════════════



const state = {

  isLoading: false,

  currentResult: null,

  jsonViewerOpen: false,

  ragContextOpen: true,

  // Micrófono

  isRecording: false,

  mediaRecorder: null,

  audioChunks: [],

  recordingTimer: null,

  recordingSeconds: 0,

  speechRecognition: null,

};



// ══════════════════════════════════════════════════════════════════════════════

//  Selectores DOM

// ══════════════════════════════════════════════════════════════════════════════



const $ = (id) => document.getElementById(id);

const el = {

  relatoInput:      $('relato-input'),

  btnAnalyze:       $('btn-analyze'),

  btnIcon:          $('btn-icon'),

  btnSpinner:       $('btn-spinner'),

  btnText:          $('btn-text'),

  charCountBadge:   $('char-count-badge'),

  formError:        $('form-error'),

  formErrorText:    $('form-error-text'),

  includeContext:   $('include-context-toggle'),

  statusIndicator:  $('status-indicator'),

  statusDot:        document.querySelector('.status-badge__dot'),

  statusText:       document.querySelector('.status-badge__text'),

  // Micrófono

  micBtn:           $('mic-btn'),

  micStatusText:    $('mic-status-text'),

  micTimer:         $('mic-timer'),

  micTimerDisplay:  $('mic-timer-display'),

  micModeSelect:    $('mic-mode-select'),

  micIconIdle:      document.querySelector('.mic-icon-idle'),

  micIconRecording: document.querySelector('.mic-icon-recording'),

  // Datos del Denunciante (Filiación PNP)

  denuncianteNombre:            $('denunciante-nombre'),

  denuncianteDocTipo:           $('denunciante-doc-tipo'),

  denuncianteDni:               $('denunciante-dni'),

  denuncianteEdad:              $('denunciante-edad'),

  denuncianteSexo:              $('denunciante-sexo'),

  denuncianteEstadoCivil:       $('denunciante-estado-civil'),

  denuncianteGradoInstruccion:  $('denunciante-grado-instruccion'),

  denuncianteOcupacion:         $('denunciante-ocupacion'),

  denuncianteDomicilio:         $('denunciante-domicilio'),

  denuncianteTelefono:          $('denunciante-telefono'),

  btnSampleDenunciante:         $('btn-sample-denunciante'),



  // Pestañas y Vista del Acta

  panelTabBar:                  $('panel-tab-bar'),

  tabActaBtn:                   $('tab-acta-btn'),

  tabRagBtn:                    $('tab-rag-btn'),

  actaView:                     $('acta-view'),

  ragView:                      $('rag-view'),

  actaSheetContent:             $('acta-sheet-content'),

  btnPrintActa:                 $('btn-print-acta'),

  btnCopyActa:                  $('btn-copy-acta'),



  // Output panel

  emptyState:       $('empty-state'),

  resultContainer:  $('result-container'),

  tipoPenalDisplay: $('tipo-penal-display'),

  articuloDisplay:  $('articulo-display'),

  confidenceFill:   $('confidence-fill'),

  confidenceValue:  $('confidence-value'),

  confidenceBar:    $('confidence-bar'),

  dataGrid:         $('data-grid'),

  groundingText:    $('grounding-text'),

  ragContext:       $('rag-context'),

  ragDocsList:      $('rag-docs-list'),

  jsonViewer:       $('json-viewer'),

  jsonOutput:       $('json-output'),

  btnCollapseRag:   $('btn-collapse-rag'),

  btnCollapseJson:  $('btn-collapse-json'),

  btnCopyJson:      $('btn-copy-json'),

  btnDownloadJson:  $('btn-download-json'),

  requestIdBadge:   $('request-id-badge'),

  latencyDisplay:   $('latency-display'),

  toast:            $('toast'),

};



// ══════════════════════════════════════════════════════════════════════════════

//  API Client (con JWT)

// ══════════════════════════════════════════════════════════════════════════════



const api = {

  /** Headers autenticados usando AuthManager de auth.js */

  getHeaders() {

    const token = window.AuthManager?.getToken();

    return {

      'Content-Type': 'application/json',

      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),

    };

  },



  async analyze(relato, includeContext, datosDenunciante) {

    const payload = {

      relato,

      include_context: includeContext,

      ...(datosDenunciante ? { datos_denunciante: datosDenunciante } : {}),

    };

    const response = await fetch(`${CONFIG.API_BASE_URL}/analyze`, {

      method: 'POST',

      headers: this.getHeaders(),

      body: JSON.stringify(payload),

      signal: AbortSignal.timeout(30_000),

    });



    if (response.status === 401) {

      window.AuthManager?.clearSession();

      window.location.replace('login.html');

      throw new Error('Sesión expirada. Redirigiendo al login...');

    }



    if (!response.ok) {

      const errData = await response.json().catch(() => ({}));

      throw new Error(errData.detail || errData.error || `HTTP ${response.status}`);

    }



    return response.json();

  },



  async transcribeAudio(audioBlob, mimeType) {

    const token = window.AuthManager?.getToken();

    const formData = new FormData();

    const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';

    formData.append('audio', audioBlob, `recording.${ext}`);



    const response = await fetch(`${CONFIG.API_BASE_URL}/audio/transcribe`, {

      method: 'POST',

      headers: token ? { 'Authorization': `Bearer ${token}` } : {},

      body: formData,

      signal: AbortSignal.timeout(60_000),

    });



    if (response.status === 401) {

      window.AuthManager?.clearSession();

      window.location.replace('login.html');

      throw new Error('Sesión expirada.');

    }



    if (!response.ok) {

      const errData = await response.json().catch(() => ({}));

      throw new Error(errData.detail || `Error Whisper ${response.status}`);

    }



    return response.json();

  },



  async healthCheck() {

    try {

      const response = await fetch(`${CONFIG.API_BASE_URL}/health`, {

        signal: AbortSignal.timeout(5_000),

      });

      return await response.json();

    } catch {

      return null;

    }

  },

};



// ══════════════════════════════════════════════════════════════════════════════

//  UI State Management

// ══════════════════════════════════════════════════════════════════════════════



function setLoading(loading) {

  state.isLoading = loading;

  el.btnAnalyze.disabled = loading;

  el.btnAnalyze.setAttribute('aria-busy', String(loading));

  el.btnAnalyze.classList.toggle('loading', loading);

  el.btnText.textContent = loading ? 'Analizando relato...' : 'Ejecutar Análisis RAG';

  el.relatoInput.readOnly = loading;

}



function showError(message) {

  el.formErrorText.textContent = message;

  el.formError.hidden = false;

  // scrollIntoView eliminado para evitar saltos forzados hacia abajo

}



function hideError() {

  el.formError.hidden = true;

}



function showToast(message, type = 'info', duration = CONFIG.TOAST_DURATION) {

  // Usar el showToast de auth.js si está disponible (tiene tipos)

  if (window.showToast && typeof window.showToast === 'function') {

    window.showToast(message, type, duration);

  } else {

    if (el.toast) {

      el.toast.textContent = message;

      el.toast.classList.add('visible');

      setTimeout(() => el.toast.classList.remove('visible'), duration);

    }

  }

}



function updateCharCount() {

  const len = el.relatoInput?.value.length ?? 0;

  if (el.charCountBadge) {

    el.charCountBadge.textContent = `${len} / 2000`;

    el.charCountBadge.style.color = len > 1950

      ? 'rgba(239,68,68,0.9)'

      : len > 1800

        ? 'rgba(245,158,11,0.9)'

        : '';

  }

}



// ══════════════════════════════════════════════════════════════════════════════

//  Controlador de Micrófono Ultra-Resiliente (SpeechManager)

// ══════════════════════════════════════════════════════════════════════════════



const SpeechManager = {

  isRecording: false,

  mode: 'webspeech',

  activeEngine: null,

  recognition: null,

  mediaRecorder: null,

  audioStream: null,

  audioChunks: [],

  baseText: '',

  finalTranscript: '',

  restartTimer: null,

  networkErrorCount: 0,



  async start() {

    if (this.isRecording) return;

    this.isRecording = true;

    state.isRecording = true;

    this.finalTranscript = '';

    this.networkErrorCount = 0;

    clearTimeout(this.restartTimer);



    // Guardar texto actual del área de relato para continuar dictando

    this.baseText = el.relatoInput ? el.relatoInput.value : '';

    if (this.baseText.length > 0 && !this.baseText.endsWith(' ')) {

      this.baseText += ' ';

    }



    const selectedMode = el.micModeSelect?.value || 'webspeech';

    this.mode = selectedMode;



    setMicRecording(true);



    if (this.mode === 'whisper') {

      await this.startMediaRecorder();

    } else {

      const hasWebSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

      if (hasWebSpeech) {

        this.startWebSpeech();

      } else {

        showToast('Navegador sin Web Speech API. Conmutando a modo audio directo.', 'info', 3500);

        await this.startMediaRecorder();

      }

    }

  },



  stop() {

    if (!this.isRecording) return;

    this.isRecording = false;

    state.isRecording = false;

    clearTimeout(this.restartTimer);



    if (this.recognition) {

      try {

        this.recognition.onstart = null;

        this.recognition.onspeechstart = null;

        this.recognition.onresult = null;

        this.recognition.onerror = null;

        this.recognition.onend = null;

        this.recognition.stop();

      } catch (_) {}

      this.recognition = null;

    }



    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {

      try {

        this.mediaRecorder.stop();

      } catch (_) {}

    } else {

      setMicRecording(false);

    }



    if (this.audioStream) {

      try {

        this.audioStream.getTracks().forEach(t => t.stop());

      } catch (_) {}

      this.audioStream = null;

    }



    if (el.relatoInput) {

      el.relatoInput.value = el.relatoInput.value.trim();

      updateCharCount();

    }



    this.finalTranscript = '';

    this.activeEngine = null;



    if (el.micStatusText) {

      el.micStatusText.textContent = 'Presionar para dictar el relato';

    }

  },



  toggle() {

    if (this.isRecording) {

      this.stop();

    } else {

      this.start();

    }

  },



  startWebSpeech() {

    if (!this.isRecording) return;

    this.activeEngine = 'webspeech';



    clearTimeout(this.restartTimer);



    if (this.recognition) {

      try {

        this.recognition.onstart = null;

        this.recognition.onspeechstart = null;

        this.recognition.onresult = null;

        this.recognition.onerror = null;

        this.recognition.onend = null;

        this.recognition.abort();

      } catch (_) {}

      this.recognition = null;

    }



    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

      this.startMediaRecorder();

      return;

    }



    const rec = new SpeechRecognition();

    rec.lang = 'es-PE';

    rec.continuous = true;

    rec.interimResults = true;

    rec.maxAlternatives = 1;



    rec.onstart = () => {

      if (this.isRecording) {

        setMicRecording(true);

        if (el.micStatusText) {

          el.micStatusText.innerHTML = '<span style="color: #ef4444; font-weight: 700;">🔴 Escuchando en vivo...</span> Hable al micrófono';

        }

      }

    };



    rec.onspeechstart = () => {

      if (this.isRecording && el.micStatusText) {

        el.micStatusText.innerHTML = '<span style="color: #2563eb; font-weight: 700;">🗣️ Detectando voz...</span>';

      }

    };



    rec.onresult = (event) => {

      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {

        const item = event.results[i];

        const text = item[0]?.transcript || '';

        if (item.isFinal) {

          this.finalTranscript += text + ' ';

        } else {

          interim += text;

        }

      }



      // Actualizar textarea inmediatamente en tiempo real

      const full = (this.baseText + this.finalTranscript + interim).trimStart();

      if (el.relatoInput) {

        el.relatoInput.value = full;

        updateCharCount();

        el.relatoInput.scrollTop = el.relatoInput.scrollHeight;

      }



      // Subtítulo instantáneo debajo del micrófono

      if (el.micStatusText) {

        const preview = interim || this.finalTranscript.slice(-40);

        el.micStatusText.innerHTML = preview

          ? `<span style="color: #16a34a; font-weight: 700;">🎙️ Dictando:</span> "${preview.trim()}"`

          : '<span style="color: #ef4444; font-weight: 700;">🔴 Escuchando en vivo...</span> Hable al micrófono';

      }

    };



    rec.onerror = (event) => {

      console.warn('[WebSpeech] Evento error:', event.error);



      // Errores de silencio ignorados para no desactivar el micrófono

      if (event.error === 'no-speech' || event.error === 'aborted') {

        return;

      }



      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {

        this.stop();

        showToast('Permiso de micrófono bloqueado en el navegador. Active el micrófono en la barra de URL.', 'error', 6000);

        return;

      }



      if (event.error === 'network') {

        this.networkErrorCount++;

        console.warn('[WebSpeech] Error de red en servicio de voz de Google. Conteo:', this.networkErrorCount);

        if (this.networkErrorCount >= 2) {

          showToast('⚠️ Si usa Brave o un navegador sin servicio de voz de Google, use Google Chrome o Microsoft Edge para dictado en vivo.', 'warning', 8000);

        }

      }

    };



    rec.onend = () => {

      // Si sigue activo, mantener vivo el reconocimiento

      if (this.isRecording && this.activeEngine === 'webspeech') {

        this.restartTimer = setTimeout(() => {

          if (this.isRecording && this.activeEngine === 'webspeech') {

            this.startWebSpeech();

          }

        }, 80);

      } else if (!this.isRecording) {

        setMicRecording(false);

      }

    };



    this.recognition = rec;



    try {

      rec.start();

    } catch (err) {

      console.warn('[WebSpeech] start() falló:', err);

    }

  },



  async startMediaRecorder() {

    if (!this.isRecording) return;

    this.activeEngine = 'mediarecorder';



    try {

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      this.audioStream = stream;



      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')

        ? 'audio/webm;codecs=opus'

        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')

          ? 'audio/ogg;codecs=opus'

          : 'audio/webm';



      this.audioChunks = [];

      const recorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder = recorder;



      recorder.ondataavailable = (e) => {

        if (e.data.size > 0) this.audioChunks.push(e.data);

      };



      recorder.onstop = async () => {

        setMicRecording(false);

        if (this.audioStream) {

          this.audioStream.getTracks().forEach(t => t.stop());

          this.audioStream = null;

        }

        const blob = new Blob(this.audioChunks, { type: mimeType });

        this.audioChunks = [];

        await processWhisperAudio(blob, mimeType);

      };



      recorder.start(200);

      setMicRecording(true);

      if (el.micStatusText) {

        el.micStatusText.textContent = '🔴 Grabando micrófono... (hable y haga clic para finalizar)';

      }

    } catch (err) {

      console.error('[MediaRecorder] Error accediendo micrófono:', err);

      this.isRecording = false;

      state.isRecording = false;

      setMicRecording(false);

      if (err.name === 'NotAllowedError') {

        showToast('Permiso de micrófono bloqueado. Permítalo en el navegador.', 'error', 5000);

      } else {

        showToast('Error de micrófono: ' + (err.message || ''), 'error', 4000);

      }

    }

  }

};



async function processWhisperAudio(audioBlob, mimeType) {

  if (el.micBtn) {

    el.micBtn.classList.add('processing');

    el.micBtn.disabled = true;

  }

  if (el.micStatusText) {

    el.micStatusText.textContent = '⏳ Transcribiendo con Whisper...';

  }



  try {

    const result = await api.transcribeAudio(audioBlob, mimeType);

    if (result.success && result.transcription) {

      if (el.relatoInput) {

        const current = el.relatoInput.value.trim();

        el.relatoInput.value = current

          ? current + ' ' + result.transcription

          : result.transcription;

        updateCharCount();

      }

      showToast('✓ Transcrito en ' + (result.latencia_ms || 0) + 'ms', 'success');

    }

  } catch (err) {

    showToast('Error Whisper: ' + (err.message || 'Fallo de transcripción'), 'error');

    console.error('[Whisper] Error transcripción:', err);

  } finally {

    if (el.micBtn) {

      el.micBtn.classList.remove('processing');

      el.micBtn.disabled = false;

    }

    if (el.micStatusText) {

      el.micStatusText.textContent = 'Presionar para dictar el relato';

    }

  }

}



function setMicRecording(recording) {

  state.isRecording = recording;

  if (!el.micBtn) return;



  el.micBtn.classList.toggle('recording', recording);

  el.micBtn.setAttribute('aria-pressed', String(recording));



  if (el.micIconIdle) el.micIconIdle.hidden = recording;

  if (el.micIconRecording) el.micIconRecording.hidden = !recording;



  if (el.micStatusText && !recording) {

    el.micStatusText.textContent = 'Presionar para dictar el relato';

  }



  if (el.micTimer) el.micTimer.hidden = !recording;



  if (recording) {

    state.recordingSeconds = 0;

    clearInterval(state.recordingTimer);

    state.recordingTimer = setInterval(() => {

      state.recordingSeconds++;

      const min = Math.floor(state.recordingSeconds / 60);

      const sec = String(state.recordingSeconds % 60).padStart(2, '0');

      if (el.micTimerDisplay) {

        el.micTimerDisplay.textContent = `${min}:${sec}`;

      }

      if (state.recordingSeconds >= CONFIG.MAX_RECORDING_SECONDS) {

        SpeechManager.stop();

        showToast('Grabación detenida automáticamente (límite 2 min)', 'info');

      }

    }, 1000);

  } else {

    clearInterval(state.recordingTimer);

    state.recordingTimer = null;

    state.recordingSeconds = 0;

    if (el.micTimerDisplay) el.micTimerDisplay.textContent = '0:00';

  }

}



function stopMicRecording() {

  SpeechManager.stop();

}



function toggleMicRecording() {

  SpeechManager.toggle();

}



// ══════════════════════════════════════════════════════════════════════════════

//  Health Check

// ══════════════════════════════════════════════════════════════════════════════



async function checkHealth() {

  const data = await api.healthCheck();



  if (!data) {

    if (el.statusDot) el.statusDot.className = 'status-badge__dot status-badge__dot--degraded';

    if (el.statusText) el.statusText.textContent = 'Sin conexión';

    return;

  }



  const healthy = data.status === 'healthy';

  if (el.statusDot) {

    el.statusDot.className = `status-badge__dot status-badge__dot--${healthy ? 'healthy' : 'degraded'}`;

  }

  if (el.statusText) {

    el.statusText.textContent = healthy ? 'Sistema activo' : 'Modo degradado';

  }



  if (data.components?.llm_model) {

    const navModel = $('nav-model');

    if (navModel) navModel.textContent = data.components.llm_model;

  }

}



// ══════════════════════════════════════════════════════════════════════════════

//  JSON Syntax Highlighter

// ══════════════════════════════════════════════════════════════════════════════



function syntaxHighlight(obj) {

  const json = JSON.stringify(obj, null, 2);

  return json.replace(

    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+\.?\d*(?:[Ee][+-]?\d+)?)/g,

    (match) => {

      let cls = 'json-number';

      if (/^"/.test(match)) {

        cls = /:$/.test(match) ? 'json-key' : 'json-string';

      } else if (/true|false/.test(match)) {

        cls = 'json-boolean';

      } else if (/null/.test(match)) {

        cls = 'json-null';

      }

      return `<span class="${cls}">${match}</span>`;

    }

  );

}



// ══════════════════════════════════════════════════════════════════════════════

//  Result Rendering

// ══════════════════════════════════════════════════════════════════════════════



function renderDataCell(label, value, wide = false, type = 'text') {

  const cell = document.createElement('div');

  cell.className = `data-cell${wide ? ' data-cell--wide' : ''}`;



  const labelEl = document.createElement('div');

  labelEl.className = 'data-cell__label';

  labelEl.textContent = label;

  cell.appendChild(labelEl);



  const valueEl = document.createElement('div');



  if (value === null || value === undefined || value === '' || value === 'null') {

    valueEl.className = 'data-cell__value data-cell__value--null';

    valueEl.textContent = 'No especificado';

  } else if (type === 'list' && Array.isArray(value)) {

    valueEl.className = 'data-cell__value data-cell__value--list';

    value.forEach((item) => {

      const tag = document.createElement('span');

      tag.className = 'tag';

      tag.textContent = item;

      valueEl.appendChild(tag);

    });

  } else if (type === 'perp') {

    valueEl.className = 'data-cell__value';

    const perp = value;

    const container = document.createElement('div');

    container.className = 'perp-info';



    if (perp.cantidad) {

      const chip = document.createElement('span');

      chip.className = 'perp-chip';

      chip.textContent = `${perp.cantidad} perpetrador${perp.cantidad > 1 ? 'es' : ''}`;

      container.appendChild(chip);

    }

    if (perp.uso_arma) {

      const chip = document.createElement('span');

      chip.className = 'perp-chip perp-chip--armed';

      chip.textContent = `⚠ ${perp.tipo_arma || 'Armado'}`;

      container.appendChild(chip);

    }

    if (perp.uso_vehiculo) {

      const chip = document.createElement('span');

      chip.className = 'perp-chip perp-chip--vehicle';

      chip.textContent = `🏍 ${perp.tipo_vehiculo || 'En vehículo'}`;

      container.appendChild(chip);

    }

    if (perp.descripcion_fisica) {

      const chip = document.createElement('span');

      chip.className = 'perp-chip';

      chip.textContent = perp.descripcion_fisica;

      container.appendChild(chip);

    }

    if (!container.children.length) {

      const chip = document.createElement('span');

      chip.style.cssText = 'font-style:italic;font-size:12px;color:var(--color-text-muted)';

      chip.textContent = 'Sin información específica';

      container.appendChild(chip);

    }

    valueEl.appendChild(container);

  } else {

    valueEl.className = 'data-cell__value';

    valueEl.textContent = String(value);

  }



  cell.appendChild(valueEl);

  return cell;

}



function renderCronologia(cronologia) {

  const parts = [];

  if (cronologia?.hora_aproximada) parts.push(`🕐 ${cronologia.hora_aproximada}`);

  if (cronologia?.momento_dia) parts.push(cronologia.momento_dia);

  if (cronologia?.dia_semana) parts.push(cronologia.dia_semana);

  if (cronologia?.fecha_relativa) parts.push(`(${cronologia.fecha_relativa})`);

  return parts.length ? parts.join(' · ') : null;

}



function renderRagDocs(docs) {

  if (!el.ragDocsList) return;

  el.ragDocsList.innerHTML = '';

  docs.forEach((doc) => {

    const card = document.createElement('div');

    card.className = 'rag-doc-card';



    const header = document.createElement('div');

    header.className = 'rag-doc-card__header';



    const title = document.createElement('div');

    title.className = 'rag-doc-card__title';

    title.textContent = doc.titulo;



    const score = document.createElement('div');

    score.className = 'rag-doc-card__score';

    score.textContent = `sim: ${(doc.score_similitud * 100).toFixed(1)}%`;



    header.appendChild(title);

    header.appendChild(score);



    const text = document.createElement('div');

    text.className = 'rag-doc-card__text';

    text.textContent = doc.texto_fragmento;



    card.appendChild(header);

    card.appendChild(text);

    el.ragDocsList.appendChild(card);

  });

}





// ══════════════════════════════════════════════════════════════════════════════

//  Generador de Acta Oficial de Recepción de Denuncia (PNP)

// ══════════════════════════════════════════════════════════════════════════════



function escapeHtml(str) {

  if (str === null || str === undefined) return '';

  return String(str)

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;')

    .replace(/'/g, '&#039;');

}



function getComplainantData() {

  return {

    nombres_apellidos: el.denuncianteNombre?.value.trim() || 'Carlos Alberto Quispe Huamán',

    tipo_documento: el.denuncianteDocTipo?.value || 'DNI',

    numero_documento: el.denuncianteDni?.value.trim() || '47891234',

    edad: parseInt(el.denuncianteEdad?.value, 10) || 34,

    sexo: el.denuncianteSexo?.value || 'Masculino',

    estado_civil: el.denuncianteEstadoCivil?.value || 'Soltero(a)',

    grado_instruccion: el.denuncianteGradoInstruccion?.value || 'Superior Universitaria',

    ocupacion: el.denuncianteOcupacion?.value.trim() || 'Ingeniero de Sistemas',

    domicilio: el.denuncianteDomicilio?.value.trim() || 'Av. Brasil 1450 Dpto. 501, Jesús María, Lima',

    telefono: el.denuncianteTelefono?.value.trim() || '987654321',

  };

}



function loadSampleComplainantData(silent = false) {

  if (el.denuncianteNombre) el.denuncianteNombre.value = 'Carlos Alberto Quispe Huamán';

  if (el.denuncianteDocTipo) el.denuncianteDocTipo.value = 'DNI';

  if (el.denuncianteDni) el.denuncianteDni.value = '47891234';

  if (el.denuncianteEdad) el.denuncianteEdad.value = 34;

  if (el.denuncianteSexo) el.denuncianteSexo.value = 'Masculino';

  if (el.denuncianteEstadoCivil) el.denuncianteEstadoCivil.value = 'Soltero(a)';

  if (el.denuncianteGradoInstruccion) el.denuncianteGradoInstruccion.value = 'Superior Universitaria';

  if (el.denuncianteOcupacion) el.denuncianteOcupacion.value = 'Ingeniero de Sistemas';

  if (el.denuncianteDomicilio) el.denuncianteDomicilio.value = 'Av. Brasil 1450 Dpto. 501, Jesús María, Lima';

  if (el.denuncianteTelefono) el.denuncianteTelefono.value = '987654321';

  if (!silent) {

    showToast('✓ Datos de prueba del denunciante cargados', 'info', 2500);

  }

}



function renderActaOficialPNP(data, denunciante) {

  if (!el.actaSheetContent) return;

  const tabla = data.tabla_denuncia;

  const now = new Date();

  const fechaStr = now.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });

  const horaStr = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

  const actaNum = tabla.acta_numero || `ACTA-PNP-2026-${data.request_id}`;



  const user = window.AuthManager?.getUser() || {

    full_name: 'Martínez Torres, Edwin',

    rank: 'Suboficial de 1ra PNP',

    badge_number: 'CIP 318945',

    unit: 'Comisaría PNP Sectorial Lima Centro',

  };



  const cronoText = renderCronologia(tabla.cronologia);

  const bienesText = Array.isArray(tabla.bien_sustraido) ? tabla.bien_sustraido.join(', ') : tabla.bien_sustraido;

  const perp = tabla.perpetradores || {};

  const perpsDesc = `${perp.cantidad ? perp.cantidad + ' sujeto(s)' : 'Sujeto(s) no identificado(s)'} | Vehículo: ${perp.uso_vehiculo ? (perp.tipo_vehiculo || 'Sí') : 'No'} | Armas: ${perp.uso_arma ? (perp.tipo_arma || 'Sí') : 'No'}`;



  const html = `

    <div class="acta-header-block">

      <div class="acta-emblem-badge" aria-hidden="true">

        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">

          <path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3z"/>

        </svg>

      </div>

      <h1 class="acta-header-title-1">POLICÍA NACIONAL DEL PERÚ</h1>

      <h2 class="acta-header-title-2">REGIÓN POLICIAL LIMA · DIVPOL CENTRO · ${escapeHtml(user.unit || 'COMISARÍA PNP')}</h2>

      <div class="acta-doc-title">ACTA DE RECEPCIÓN DE DENUNCIA VERBAL N° ${escapeHtml(actaNum)}</div>

    </div>



    <p class="acta-intro">

      En la ciudad de Lima, siendo las <strong>${horaStr} horas</strong> del día <strong>${fechaStr}</strong>, 

      por ante el Efectivo Policial Instructor que suscribe, se hace presente la persona indicada en el rubro 

      de datos del denunciante, a fin de formular una denuncia verbal por hechos ilícitos cometidos en su agravio, 

      conforme a las prescripciones del Código Procesal Penal y Código Penal vigente:

    </p>



    <div class="acta-sec-heading">I. DATOS DEL PERSONAL POLICIAL RECEPTOR</div>

    <table class="acta-fields-table">

      <tr>

        <td class="label-cell">Efectivo Instructor:</td>

        <td class="val-cell"><strong>${escapeHtml(user.full_name)}</strong> (${escapeHtml(user.rank)})</td>

        <td class="label-cell">N° Carné / CIP:</td>

        <td class="val-cell"><strong>${escapeHtml(user.badge_number)}</strong></td>

      </tr>

      <tr>

        <td class="label-cell">Unidad / Comisaría:</td>

        <td class="val-cell" colspan="3">${escapeHtml(user.unit)}</td>

      </tr>

    </table>



    <div class="acta-sec-heading">II. DATOS GENERALES DEL DENUNCIANTE / AGRAVIADO</div>

    <table class="acta-fields-table">

      <tr>

        <td class="label-cell">Nombres y Apellidos:</td>

        <td class="val-cell"><strong>${escapeHtml(denunciante.nombres_apellidos)}</strong></td>

        <td class="label-cell">Doc. Identidad:</td>

        <td class="val-cell"><strong>${escapeHtml(denunciante.tipo_documento)} N° ${escapeHtml(denunciante.numero_documento)}</strong></td>

      </tr>

      <tr>

        <td class="label-cell">Edad / Sexo:</td>

        <td class="val-cell">${denunciante.edad} años · Sexo ${escapeHtml(denunciante.sexo)}</td>

        <td class="label-cell">Estado Civil:</td>

        <td class="val-cell">${escapeHtml(denunciante.estado_civil)}</td>

      </tr>

      <tr>

        <td class="label-cell">Grado de Instrucción:</td>

        <td class="val-cell"><span style="color:#0369a1; font-weight:700;">${escapeHtml(denunciante.grado_instruccion)}</span></td>

        <td class="label-cell">Ocupación / Oficio:</td>

        <td class="val-cell">${escapeHtml(denunciante.ocupacion)}</td>

      </tr>

      <tr>

        <td class="label-cell">Dónde vive (Domicilio):</td>

        <td class="val-cell" colspan="3"><strong>${escapeHtml(denunciante.domicilio)}</strong></td>

      </tr>

      <tr>

        <td class="label-cell">Teléfono / Celular:</td>

        <td class="val-cell" colspan="3">${escapeHtml(denunciante.telefono || 'No consigna')}</td>

      </tr>

    </table>



    <div class="acta-sec-heading">III. CALIFICACIÓN JURÍDICA Y TIPIFICACIÓN PENAL (SISTEMA RAG)</div>

    <table class="acta-fields-table">

      <tr>

        <td class="label-cell">Delito Principal:</td>

        <td class="val-cell"><strong>CONTRA EL PATRIMONIO</strong></td>

        <td class="label-cell">Tipo Penal Específico:</td>

        <td class="val-cell">

          <span class="acta-tipificacion-badge">⚖️ ${escapeHtml(tabla.tipo_penal)}</span>

        </td>

      </tr>

      <tr>

        <td class="label-cell">Artículo Aplicable:</td>

        <td class="val-cell" colspan="3">

          <strong>${escapeHtml(tabla.articulo)}</strong> (Código Penal de la República del Perú)

        </td>

      </tr>

      <tr>

        <td class="label-cell">Modalidad Delictiva:</td>

        <td class="val-cell"><strong>${escapeHtml(tabla.modalidad)}</strong></td>

        <td class="label-cell">Nivel de Violencia:</td>

        <td class="val-cell"><strong>${escapeHtml(tabla.nivel_violencia)}</strong></td>

      </tr>

      <tr>

        <td class="label-cell">Sustento Jurídico (Span):</td>

        <td class="val-cell" colspan="3">

          <em>"${escapeHtml(tabla.grounding_span)}"</em>

        </td>

      </tr>

      <tr>

        <td class="label-cell">Nivel de Certeza RAG:</td>

        <td class="val-cell" colspan="3">

          <strong>${(tabla.confianza_clasificacion * 100).toFixed(1)}%</strong> · Validación con ontología penal de laboratorio (Arts. 185, 186, 188, 189 CP).

        </td>

      </tr>

    </table>



    <div class="acta-sec-heading">IV. CIRCUNSTANCIAS Y HECHOS DENUNCIADOS</div>

    <table class="acta-fields-table">

      <tr>

        <td class="label-cell">Fecha y Hora Aproximada:</td>

        <td class="val-cell">${escapeHtml(cronoText)}</td>

        <td class="label-cell">Lugar del Suceso:</td>

        <td class="val-cell">${escapeHtml(tabla.lugar_hecho || 'Vía pública')}</td>

      </tr>

      <tr>

        <td class="label-cell">Bienes Sustraídos / Afectados:</td>

        <td class="val-cell" colspan="3"><strong>${escapeHtml(bienesText)}</strong></td>

      </tr>

      <tr>

        <td class="label-cell">Presuntos Perpetradores:</td>

        <td class="val-cell" colspan="3">${escapeHtml(perpsDesc)}</td>

      </tr>

    </table>



    <div style="font-size:11.5px; font-weight:700; margin:6px 0 2px; font-family:var(--font-sans);">MANIFESTACIÓN TEXTUAL DE LOS HECHOS SEGÚN EL RELATO DEL CIUDADANO:</div>

    <div class="acta-relato-box">

      "${escapeHtml(tabla.relato_original)}"

    </div>



    <div class="acta-sec-heading">V. DILIGENCIAS POLICIALES DISPUESTAS</div>

    <ol style="font-size:12px; margin:4px 0 10px 22px; padding:0; line-height:1.6;">

      <li>Poner el hecho en conocimiento de la <strong>Fiscalía Provincial Corporativa de Turno de Lima</strong>.</li>

      <li>Disponer la realización de la <strong>Inspección Técnico Policial (ITP)</strong> en el lugar de los hechos.</li>

      <li>Oficiar a las entidades correspondientes para el <strong>acopio y visualización de cámaras de seguridad</strong> (públicas y privadas).</li>

    </ol>



    <div class="acta-sec-heading">VI. CONSTANCIA DE ENTERADO Y CONFORMIDAD</div>

    <p style="font-size:11.5px; text-align:justify; margin-bottom:16px;">

      Leída la presente acta al denunciante, este se ratifica en todos sus extremos por ser la estricta 

      verdad de lo sucedido, firmando e imprimiendo su huella digital en señal de conformidad, 

      juntamente con el personal policial instructor que recepciona y autoriza la presente.

    </p>



    <div class="acta-signatures-grid">

      <div class="acta-sig-box">

        <div class="acta-fingerprint-box">

          Índice Derecho (Huella)

        </div>

        <div class="acta-sig-line"></div>

        <div class="acta-sig-name">${escapeHtml(denunciante.nombres_apellidos)}</div>

        <div class="acta-sig-sub">${escapeHtml(denunciante.tipo_documento)} N° ${escapeHtml(denunciante.numero_documento)}</div>

        <div class="acta-sig-sub"><strong>EL DENUNCIANTE / AGRAVIADO</strong></div>

      </div>



      <div class="acta-sig-box">

        <div style="height:85px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:10px; font-family:var(--font-sans);">

          [ Sello Oficial de Comisaría ]

        </div>

        <div class="acta-sig-line"></div>

        <div class="acta-sig-name">${escapeHtml(user.full_name)}</div>

        <div class="acta-sig-sub">${escapeHtml(user.rank)} · ${escapeHtml(user.badge_number)}</div>

        <div class="acta-sig-sub"><strong>EL INSTRUCTOR PNP (RECEPTOR)</strong></div>

      </div>

    </div>

  `;



  el.actaSheetContent.innerHTML = html;

}



function printActa() {

  window.print();

}



function copyActaText() {

  if (!el.actaSheetContent) return;

  const text = el.actaSheetContent.innerText;

  navigator.clipboard.writeText(text).then(() => {

    showToast('✓ Acta Oficial PNP copiada al portapapeles', 'success');

  }).catch(() => {

    showToast('Error al copiar el acta', 'error');

  });

}



function renderResult(data) {

  const tabla = data.tabla_denuncia;

  state.currentResult = data;



  if (el.emptyState) el.emptyState.hidden = true;

  if (el.resultContainer) el.resultContainer.hidden = false;



  if (el.tipoPenalDisplay) el.tipoPenalDisplay.textContent = tabla.tipo_penal;

  if (el.articuloDisplay) el.articuloDisplay.textContent = tabla.articulo;



  const pct = Math.round(tabla.confianza_clasificacion * 100);

  requestAnimationFrame(() => {

    if (el.confidenceFill) el.confidenceFill.style.width = `${pct}%`;

    if (el.confidenceBar) {

      el.confidenceBar.setAttribute('aria-valuenow', pct);

      el.confidenceBar.setAttribute('aria-label', `Confianza: ${pct}%`);

    }

  });

  if (el.confidenceValue) el.confidenceValue.textContent = `${pct}%`;



  if (el.requestIdBadge) {

    el.requestIdBadge.textContent = `ID: ${data.request_id}`;

    el.requestIdBadge.hidden = false;

  }



  if (el.dataGrid) {

    el.dataGrid.innerHTML = '';

    const cells = [

      ['Modalidad',       tabla.modalidad,                   false, 'text'],

      ['Nivel Violencia', tabla.nivel_violencia,             false, 'text'],

      ['Bienes Sustraídos', tabla.bien_sustraido,            true,  'list'],

      ['Lugar del Hecho', tabla.lugar_hecho,                 false, 'text'],

      ['Cronología',      renderCronologia(tabla.cronologia), false, 'text'],

      ['Perpetradores',   tabla.perpetradores,               false, 'perp'],

    ];

    cells.forEach(([label, value, wide, type]) => {

      el.dataGrid.appendChild(renderDataCell(label, value, wide, type));

    });

  }



  if (el.groundingText) el.groundingText.textContent = `"${tabla.grounding_span}"`;



  const docs = tabla.documentos_recuperados || [];

  if (docs.length > 0 && el.ragContext) {

    renderRagDocs(docs);

    el.ragContext.hidden = false;

  } else if (el.ragContext) {

    el.ragContext.hidden = true;

  }



  const jsonToShow = {

    tipo_penal:               tabla.tipo_penal,

    articulo:                 tabla.articulo,

    modalidad:                tabla.modalidad,

    nivel_violencia:          tabla.nivel_violencia,

    bien_sustraido:           tabla.bien_sustraido,

    lugar_hecho:              tabla.lugar_hecho,

    cronologia:               tabla.cronologia,

    perpetradores:            tabla.perpetradores,

    grounding_span:           tabla.grounding_span,

    confianza_clasificacion:  tabla.confianza_clasificacion,

    relato_original:          tabla.relato_original,

    timestamp_procesamiento:  tabla.timestamp_procesamiento,

    version_pipeline:         tabla.version_pipeline,

  };

  if (el.jsonOutput) el.jsonOutput.innerHTML = syntaxHighlight(jsonToShow);



  if (el.btnCopyJson) el.btnCopyJson.hidden = false;

  if (el.btnDownloadJson) el.btnDownloadJson.hidden = false;

  if (el.btnPrintActa) el.btnPrintActa.hidden = false;

  if (el.btnCopyActa) el.btnCopyActa.hidden = false;

  if (el.panelTabBar) el.panelTabBar.hidden = false;



  // Renderizar Acta Oficial de Recepción de Denuncia

  const complainantData = getComplainantData();

  renderActaOficialPNP(data, complainantData);



  // Activar por defecto la pestaña de Acta Oficial

  if (el.tabActaBtn) el.tabActaBtn.classList.add('active');

  if (el.tabRagBtn) el.tabRagBtn.classList.remove('active');

  if (el.actaView) el.actaView.hidden = false;

  if (el.ragView) el.ragView.hidden = true;



  if (el.latencyDisplay) el.latencyDisplay.textContent = `${data.latencia_ms.toFixed(0)} ms`;

}



// ══════════════════════════════════════════════════════════════════════════════

//  Collapsible Sections

// ══════════════════════════════════════════════════════════════════════════════



function setupCollapsible(btnEl, targetEl, stateKey) {

  btnEl?.addEventListener('click', () => {

    const isOpen = btnEl.getAttribute('aria-expanded') === 'true';

    const newOpen = !isOpen;

    btnEl.setAttribute('aria-expanded', String(newOpen));

    if (targetEl) targetEl.hidden = !newOpen;

    state[stateKey] = newOpen;

  });

}



// ══════════════════════════════════════════════════════════════════════════════

//  Main Analysis Handler

// ══════════════════════════════════════════════════════════════════════════════



async function handleAnalyze() {

  if (state.isLoading) return;



  const relato = el.relatoInput?.value.trim() ?? '';

  hideError();



  if (!relato) {

    showError('Por favor, ingrese el relato de la denuncia o use el micrófono.');

    el.relatoInput?.focus();

    return;

  }



  if (relato.length < 20) {

    showError('El relato es demasiado corto. Ingrese al menos 20 caracteres.');

    el.relatoInput?.focus();

    return;

  }



  setLoading(true);



  try {

    const complainantData = getComplainantData();

    const data = await api.analyze(relato, el.includeContext?.checked ?? true, complainantData);



    if (!data.success) {

      throw new Error(data.error || 'El pipeline RAG no pudo procesar el relato.');

    }



    renderResult(data);

    showToast(`✓ Análisis completado en ${data.latencia_ms.toFixed(0)}ms`, 'success');



  } catch (err) {

    let message = 'Error al conectar con el servidor. Verifique que el backend esté activo.';

    if (err.name === 'TimeoutError') {

      message = 'La solicitud excedió el tiempo máximo (30s). Intente nuevamente.';

    } else if (err.message) {

      message = err.message;

    }

    showError(message);

    console.error('[SistemaRAG] Error en análisis:', err);

  } finally {

    setLoading(false);

  }

}



// ══════════════════════════════════════════════════════════════════════════════

//  Copy / Download JSON

// ══════════════════════════════════════════════════════════════════════════════



async function copyJsonToClipboard() {

  if (!state.currentResult?.tabla_denuncia) return;

  try {

    await navigator.clipboard.writeText(

      JSON.stringify(state.currentResult.tabla_denuncia, null, 2)

    );

    showToast('JSON copiado al portapapeles', 'success');

  } catch {

    showToast('Error al copiar. Use Ctrl+A sobre el JSON.', 'error');

  }

}



function downloadJson() {

  if (!state.currentResult?.tabla_denuncia) return;

  const blob = new Blob(

    [JSON.stringify(state.currentResult.tabla_denuncia, null, 2)],

    { type: 'application/json' }

  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;

  a.download = `denuncia_${state.currentResult.request_id}_${Date.now()}.json`;

  document.body.appendChild(a);

  a.click();

  document.body.removeChild(a);

  URL.revokeObjectURL(url);

  showToast('JSON descargado correctamente', 'success');

}



// ══════════════════════════════════════════════════════════════════════════════

//  Event Listeners

// ══════════════════════════════════════════════════════════════════════════════



function setupEventListeners() {

  // Botón de análisis

  el.btnAnalyze?.addEventListener('click', handleAnalyze);



  // Cargar datos de prueba del denunciante

  el.btnSampleDenunciante?.addEventListener('click', loadSampleComplainantData);



  // Pestañas del panel derecho

  el.tabActaBtn?.addEventListener('click', () => {

    el.tabActaBtn.classList.add('active');

    el.tabRagBtn?.classList.remove('active');

    if (el.actaView) el.actaView.hidden = false;

    if (el.ragView) el.ragView.hidden = true;

  });



  el.tabRagBtn?.addEventListener('click', () => {

    el.tabRagBtn.classList.add('active');

    el.tabActaBtn?.classList.remove('active');

    if (el.actaView) el.actaView.hidden = true;

    if (el.ragView) el.ragView.hidden = false;

  });



  // Imprimir y copiar Acta Oficial

  el.btnPrintActa?.addEventListener('click', printActa);

  el.btnCopyActa?.addEventListener('click', copyActaText);



  // Ctrl+Enter para enviar

  el.relatoInput?.addEventListener('keydown', (e) => {

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {

      e.preventDefault();

      handleAnalyze();

    }

  });



  // Contador de caracteres

  el.relatoInput?.addEventListener('input', updateCharCount);



  // Micrófono

  el.micBtn?.addEventListener('click', () => {

    if (!state.isLoading) toggleMicRecording();

  });



  // Ejemplos rápidos

  document.querySelectorAll('.quick-examples__btn').forEach((btn) => {

    btn.addEventListener('click', () => {

      const idx = parseInt(btn.dataset.example, 10);

      if (CONFIG.EXAMPLES[idx] && el.relatoInput) {

        el.relatoInput.value = CONFIG.EXAMPLES[idx];

        updateCharCount();

        hideError();

        el.relatoInput.focus();

        el.relatoInput.selectionStart = el.relatoInput.selectionEnd = el.relatoInput.value.length;

      }

    });

  });



  // Collapsibles

  setupCollapsible(el.btnCollapseRag, el.ragDocsList, 'ragContextOpen');

  setupCollapsible(el.btnCollapseJson, el.jsonViewer, 'jsonViewerOpen');



  // Copy / Download

  el.btnCopyJson?.addEventListener('click', copyJsonToClipboard);

  el.btnDownloadJson?.addEventListener('click', downloadJson);

}



// ══════════════════════════════════════════════════════════════════════════════

//  Inicialización

// ══════════════════════════════════════════════════════════════════════════════



async function init() {

  // ── Protección de ruta (requiere token JWT) ───────────────────────────────

  const user = window.requireAuth?.();

  if (!user) return; // requireAuth redirige a login.html si no hay sesión



  // ── Inicializar barra de usuario ──────────────────────────────────────────

  window.initUserBar?.(user);



  // ── Setup UI ──────────────────────────────────────────────────────────────

  setupEventListeners();

  updateCharCount();



    // ── Auto-detección de soporte Web Speech API ───────────────────────────────

  const hasWebSpeech = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  if (!hasWebSpeech && el.micModeSelect) {

    el.micModeSelect.value = 'whisper';

    console.info('Web Speech API no disponible en este navegador.');

  }



  // ── Detección de Brave Browser ─────────────────────────────────────────────

  try {

    if (navigator.brave && typeof navigator.brave.isBrave === 'function') {

      navigator.brave.isBrave().then(isBrave => {

        if (isBrave) {

          const notice = document.getElementById('browser-notice');

          if (notice) {

            notice.style.background = 'rgba(234, 88, 12, 0.12)';

            notice.style.borderColor = 'rgba(234, 88, 12, 0.4)';

            notice.style.color = '#c2410c';

            notice.innerHTML = '<span>⚠️</span><span><strong>Aviso Navegador Brave:</strong> Brave bloquea la conexión de voz de Google por privacidad. Para ver la transcripción en pantalla palabra por palabra mientras habla, abra <code>http://localhost:5500</code> en <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>.</span>';

          }

        }

      });

    }

  } catch (_) {}



  // ── Health check ──────────────────────────────────────────────────────────

  await checkHealth();

  setInterval(checkHealth, CONFIG.HEALTH_CHECK_INTERVAL);



  // ── Hint de teclado ───────────────────────────────────────────────────────

  el.relatoInput?.setAttribute('title', 'Presione Ctrl+Enter para ejecutar el análisis');



  // ── Auto-carga inicial para visualización inmediata en localhost ───────────

  if (el.relatoInput && !el.relatoInput.value.trim()) {
    loadSampleComplainantData(true);
    el.relatoInput.value = CONFIG.EXAMPLES[0];
    updateCharCount();
  }

  // Garantizar que la interfaz cargue siempre desde el tope absoluto (y=0)
  window.scrollTo(0, 0);
  document.querySelectorAll('.panel__body').forEach((p) => { p.scrollTop = 0; });
  hideError();
  setLoading(false);



  console.info(

    '%c SistemaRAG PNP v2.0 · Denuncias Patrimoniales ',

    'background:#0F172A;color:#06B6D4;font-weight:bold;padding:4px 8px;border-radius:4px',

    `\nUsuario: ${user.rank} ${user.full_name} (${user.badge_number})`

  );

}



document.addEventListener('DOMContentLoaded', init);

