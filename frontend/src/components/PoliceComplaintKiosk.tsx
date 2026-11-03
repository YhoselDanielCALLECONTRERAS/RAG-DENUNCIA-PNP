import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Printer,
  Download,
  Copy,
  Shield,
  User,
  FileText,
  Sparkles,
  Fingerprint,
  RefreshCw,
  Check,
  Lock,
  LogOut,
  AlertCircle
} from 'lucide-react';

// ══════════════════════════════════════════════════════════════════════════════
//  INTERFACES DE DATOS (MODELOS)
// ══════════════════════════════════════════════════════════════════════════════

export interface ComplainantData {
  nombres: string;
  apellidos: string;
  dni: string;
  telefono: string;
  domicilio: string;
  ocupacion: string;
  gradoInstruccion: string;
  estadoCivil: string;
  edad: number;
  sexo: string;
}

export interface RagActaData {
  actaNumero: string;
  fechaEmision: string;
  horaEmision: string;
  instructorNombre: string;
  instructorGrado: string;
  instructorCip: string;
  unidadPolicial: string;
  tipoPenal: string;
  articulo: string;
  modalidad: string;
  nivelViolencia: string;
  bienesSustraidos: string;
  lugarHecho: string;
  cronologia: string;
  perpetradores: string;
  manifestacion: string;
  confianzaScore: number;
}

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE REUTILIZABLE: InlineField (Edición In-situ sin autoFocus)
// ══════════════════════════════════════════════════════════════════════════════

interface InlineFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  isTextarea?: boolean;
  rows?: number;
  className?: string;
  placeholder?: string;
  highlight?: boolean;
}

const InlineField: React.FC<InlineFieldProps> = ({
  label,
  value,
  onChange,
  isTextarea = false,
  rows = 2,
  className = '',
  placeholder = 'Haga clic para editar...',
  highlight = false,
}) => {
  return (
    <div className="group relative w-full transition-all">
      {label && (
        <span className="block text-[10px] font-bold tracking-wider uppercase text-slate-400 mb-1">
          {label}
        </span>
      )}
      {isTextarea ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-transparent text-slate-800 text-xs leading-relaxed rounded px-2 py-1.5 border border-transparent 
            hover:border-slate-300 hover:bg-slate-50/80 focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500/30 
            outline-none resize-none transition-all ${highlight ? 'font-semibold text-slate-900' : ''} ${className}`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-transparent text-slate-800 text-xs rounded px-2 py-1 border border-transparent 
            hover:border-slate-300 hover:bg-slate-50/80 focus:border-cyan-500 focus:bg-white focus:ring-1 focus:ring-cyan-500/30 
            outline-none transition-all ${highlight ? 'font-semibold text-slate-900' : ''} ${className}`}
        />
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  SUB-COMPONENTE: LOGIN AISLADO (SE DESMONTA COMPLETAMENTE TRAS LOGIN)
// ══════════════════════════════════════════════════════════════════════════════

interface LoginViewProps {
  onLoginSuccess: (user: string) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('operador');
  const [password, setPassword] = useState('pnp2026');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Por favor complete sus credenciales oficiales.');
      return;
    }
    // Autenticación simulada exitosa
    onLoginSuccess(username);
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-900 p-6 select-none">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-800 p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 text-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Shield className="w-9 h-9" />
          </div>
          <div className="text-[11px] font-bold tracking-widest text-cyan-600 uppercase">
            POLICÍA NACIONAL DEL PERÚ
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            SistemaRAG PNP 2026
          </h1>
          <p className="text-xs text-slate-500">
            Plataforma Asistida de Denuncias Patrimoniales (LLM + RAG)
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Usuario / Carné CIP
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all pl-9"
                placeholder="ej. operador"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Contraseña de Servicio
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all pl-9"
                placeholder="••••••••"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-cyan-500/25 transition-all text-sm tracking-wide mt-2"
          >
            Iniciar Turno en Kiosco
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Acceso Restringido PNP</span>
          <span className="font-mono">v2.0.0</span>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL: PoliceComplaintKiosk
// ══════════════════════════════════════════════════════════════════════════════

export default function PoliceComplaintKiosk() {
  // ── ESTADO DE AUTENTICACIÓN (LOGIN DESMONTADO CONDICIONALMENTE) ─────────────
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(true);
  const [loggedUser, setLoggedUser] = useState<string>('operador');

  // ── ESTADOS DEL FORMULARIO DE FILIACIÓN ─────────────────────────────────────
  const [complainant, setComplainant] = useState<ComplainantData>({
    nombres: 'Carlos Alberto',
    apellidos: 'Quispe Huamán',
    dni: '47891234',
    telefono: '987-654-321',
    domicilio: 'Av. Brasil 1450, Dpto. 501, Jesús María, Lima',
    ocupacion: 'Ingeniero de Sistemas',
    gradoInstruccion: 'Superior Universitaria',
    estadoCivil: 'Soltero',
    edad: 34,
    sexo: 'Masculino',
  });

  // ── ESTADO DEL RELATO Y MICRÓFONO ──────────────────────────────────────────
  const [relato, setRelato] = useState<string>(
    'El día de ayer, aproximadamente a las 21:30 horas, mientras transitaba por la intersección de la Av. Arequipa con Jr. Risso en Lince, fui interceptado por dos sujetos a bordo de una motocicleta lineal negra sin placa visible. El copiloto descendió portando un arma de fuego (pistola corta), me apuntó directamente al pecho amenazándome de muerte para que no gritara. Me despojaron violentamente de mi teléfono celular marca Apple modelo iPhone 14 Pro color grafito y mi billetera de cuero con 380 soles en efectivo y tarjetas bancarias. Los asaltantes abordaron la moto y fugaron a gran velocidad rumbo a la Av. Javier Prado.'
  );

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  // ── ESTADO DEL ACTA OFICIAL RAG (CAMPOS EDITABLES) ──────────────────────────
  const [acta, setActa] = useState<RagActaData>({
    actaNumero: 'ACTA-PNP-2026-0842-D3',
    fechaEmision: '01 de Noviembre de 2026',
    horaEmision: '22:15 horas',
    instructorNombre: 'Martínez Torres, Edwin',
    instructorGrado: 'Suboficial de 1ra PNP',
    instructorCip: 'CIP 318945',
    unidadPolicial: 'Comisaría PNP Sectorial Lima Centro · DIVPOL Centro',
    tipoPenal: 'Robo Agravado',
    articulo: 'Art. 189 del Código Penal (Inc. 3 a mano armada y 4 con concurso de dos o más personas)',
    modalidad: 'Asalto a mano armada con arma de fuego y vehículo menor (motocicleta lineal)',
    nivelViolencia: 'Intimidación grave y amenaza inminente contra la vida e integridad física',
    bienesSustraidos: '01 Teléfono Celular iPhone 14 Pro (S/ 4,500.00), 01 Billetera con documentos y S/ 380.00 en efectivo.',
    lugarHecho: 'Vía pública: Intersección Av. Arequipa con Jr. Risso, Distrito de Lince, Lima',
    cronologia: 'Ayer a las 21:30 hrs aproximadamente (Horario nocturno)',
    perpetradores: '02 sujetos de sexo masculino, complexión delgada, provistos de cascos cerrados oscuros y arma corta.',
    manifestacion:
      'El agraviado manifiesta que se dirigía a su domicilio cuando fue sorprendido por los malhechores. Reconoce que uno portaba un arma de fuego tipo revólver o pistola. Solicita el auxilio de la unidad de patrullaje y solicita copia certificada de la presente para trámites de seguro y bloqueo de líneas.',
    confianzaScore: 94.8,
  });

  // ── SOLUCIÓN BUG 1: GARANTIZAR SCROLL AL TOPE AL MONTAR (SIN scrollIntoView) ──
  useEffect(() => {
    // La vista carga siempre estrictamente desde el tope (y=0)
    window.scrollTo(0, 0);
  }, [isLoggedIn]);

  // ── CONTROL DEL TEMPORIZADOR DEL MICRÓFONO ─────────────────────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
      if (!relato.includes('además')) {
        setTimeout(() => {
          setRelato((prev) => prev + ' Además, los facinerosos vestían casacas oscuras impermeables.');
        }, 3000);
      }
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleProcessRag = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setActa((prev) => ({
        ...prev,
        actaNumero: `ACTA-PNP-2026-${Math.floor(1000 + Math.random() * 9000)}-D3`,
        confianzaScore: 96.2,
      }));
    }, 800);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    alert('Generando PDF oficial con membrete PNP y hash de seguridad SHA-256...');
  };

  const handleCopyText = () => {
    const textToCopy = `POLICÍA NACIONAL DEL PERÚ - ACTA N° ${acta.actaNumero}\nTIPIFICACIÓN: ${acta.tipoPenal} (${acta.articulo})\nDENUNCIANTE: ${complainant.nombres} ${complainant.apellidos} - DNI: ${complainant.dni}\nBIENES: ${acta.bienesSustraidos}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2200);
  };

  const loadSampleCase = () => {
    setComplainant({
      nombres: 'María Elena',
      apellidos: 'Rojas Benavides',
      dni: '09876543',
      telefono: '991-234-567',
      domicilio: 'Calle Las Flores 320, San Isidro, Lima',
      ocupacion: 'Contadora Pública',
      gradoInstruccion: 'Superior Universitaria',
      estadoCivil: 'Casada',
      edad: 41,
      sexo: 'Femenino',
    });
    setRelato(
      'Esta mañana en la estación Javier Prado del Metropolitano, al subir al bus alimentador en medio de la multitud, sentí que me abrieron la cartera. Al revisar me percaté de que sustrajeron mi monedero con S/ 500 y mi celular Samsung Galaxy S23. No hubo violencia ni amenazas directas.'
    );
    setActa((prev) => ({
      ...prev,
      tipoPenal: 'Hurto Simple',
      articulo: 'Art. 185 del Código Penal (Apoderamiento ilegítimo sin violencia ni amenaza)',
      modalidad: 'Destreza / Carterismo en aglomeración de transporte público',
      nivelViolencia: 'Sin violencia física ni intimidación',
      bienesSustraidos: '01 Monedero de cuero, S/ 500.00 en efectivo y 01 celular Samsung Galaxy S23',
      perpetradores: 'Sujeto no identificado (aprovechamiento de tumulto)',
      confianzaScore: 92.5,
    }));
  };

  // ════════════════════════════════════════════════════════════════════════════
  //  SOLUCIÓN BUG 2: DESMONTAJE CONDICIONAL DEL LOGIN (SIN CAPAS FANTASMAS)
  // ════════════════════════════════════════════════════════════════════════════
  if (!isLoggedIn) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setLoggedUser(user);
          setIsLoggedIn(true);
        }}
      />
    );
  }

  return (
    // ══════════════════════════════════════════════════════════════════════════
    //  SOLUCIÓN BUG 3: ESTRUCTURA EXACTA DE LAYOUT Y SCROLL INDEPENDIENTE
    // ══════════════════════════════════════════════════════════════════════════
    <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* ── HEADER SUPERIOR (h-16 shrink-0 bg-slate-900) ──────────────────── */}
      <header className="h-16 shrink-0 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between text-white z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase">
                POLICÍA NACIONAL DEL PERÚ
              </span>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                RAG Activo
              </span>
            </div>
            <h1 className="text-sm font-bold text-white tracking-tight">
              Kiosco Asistido de Denuncias Patrimoniales (Tesis 2026)
            </h1>
          </div>
        </div>

        {/* Controles de perfil y demostración */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={loadSampleCase}
            className="text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-md border border-slate-700 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            Cargar Caso de Prueba
          </button>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-semibold text-white">
                SO1 PNP E. Martínez T.
              </div>
              <div className="text-[10px] text-cyan-400 font-mono">
                CIP 318945 · Guardia
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLoggedIn(false)}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 flex items-center justify-center transition-colors"
              title="Cerrar turno"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── CONTENEDOR DE PANELES (GRID 2 COLUMNAS h-full) ─────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 min-h-full">

          {/* ════════════════════════════════════════════════════════════════════
              PANEL IZQUIERDO: Captura y Voz (h-full overflow-y-auto)
             ════════════════════════════════════════════════════════════════════ */}
          <div className="h-full overflow-y-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-8">
            
            {/* Sección 1: Formulario de Filiación del Denunciante */}
            <div>
              <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-cyan-600" />
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    I. Filiación del Denunciante / Agraviado
                  </h2>
                </div>
                <span className="text-[10px] font-semibold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-100">
                  RENIEC Verificado
                </span>
              </div>

              {/* Grid 2 Columnas (Sin autoFocus) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nombres
                  </label>
                  <input
                    type="text"
                    value={complainant.nombres}
                    onChange={(e) => setComplainant({ ...complainant, nombres: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg px-3 py-2 border border-slate-200 
                      hover:border-slate-300 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Apellidos
                  </label>
                  <input
                    type="text"
                    value={complainant.apellidos}
                    onChange={(e) => setComplainant({ ...complainant, apellidos: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg px-3 py-2 border border-slate-200 
                      hover:border-slate-300 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    DNI / Documento
                  </label>
                  <input
                    type="text"
                    value={complainant.dni}
                    maxLength={8}
                    onChange={(e) => setComplainant({ ...complainant, dni: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg px-3 py-2 border border-slate-200 
                      hover:border-slate-300 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={complainant.telefono}
                    onChange={(e) => setComplainant({ ...complainant, telefono: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg px-3 py-2 border border-slate-200 
                      hover:border-slate-300 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Grado de Instrucción
                  </label>
                  <select
                    value={complainant.gradoInstruccion}
                    onChange={(e) => setComplainant({ ...complainant, gradoInstruccion: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg px-3 py-2 border border-slate-200 
                      hover:border-slate-300 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                  >
                    <option value="Superior Universitaria">Superior Universitaria</option>
                    <option value="Superior Técnica">Superior Técnica</option>
                    <option value="Secundaria Completa">Secundaria Completa</option>
                    <option value="Primaria">Primaria</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ocupación
                  </label>
                  <input
                    type="text"
                    value={complainant.ocupacion}
                    onChange={(e) => setComplainant({ ...complainant, ocupacion: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg px-3 py-2 border border-slate-200 
                      hover:border-slate-300 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dónde vive (Dirección Domiciliaria)
                  </label>
                  <input
                    type="text"
                    value={complainant.domicilio}
                    onChange={(e) => setComplainant({ ...complainant, domicilio: e.target.value })}
                    className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg px-3 py-2 border border-slate-200 
                      hover:border-slate-300 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Sección 2: Captura de Voz y Transcripción */}
            <div>
              <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-cyan-600" />
                  <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                    II. Captura de Voz y Narrativa Espontánea
                  </h2>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {relato.length} caracteres
                </span>
              </div>

              {/* Botón Central de Micrófono con Animación Pulse */}
              <div className="flex flex-col items-center justify-center py-6 mb-5 bg-slate-50/80 rounded-xl border border-slate-200/80 relative overflow-hidden">
                <div className="relative flex items-center justify-center">
                  {isRecording && (
                    <>
                      <span className="absolute w-24 h-24 rounded-full bg-cyan-400/20 animate-ping" />
                      <span className="absolute w-20 h-20 rounded-full bg-cyan-400/30 animate-pulse" />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
                      isRecording
                        ? 'bg-rose-500 text-white shadow-rose-500/30 scale-105'
                        : 'bg-cyan-500 hover:bg-cyan-600 text-white shadow-cyan-500/20 hover:scale-105'
                    }`}
                    aria-label={isRecording ? 'Detener grabación' : 'Iniciar grabación de voz'}
                  >
                    {isRecording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                  </button>
                </div>

                <div className="mt-3 text-center">
                  {isRecording ? (
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                        Escuchando en vivo...
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {formatTimer(recordingSeconds)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs font-medium text-slate-500">
                      Haga clic en el micrófono para dictar el relato
                    </span>
                  )}
                </div>
              </div>

              {/* Textarea de Transcripción (Sin autoFocus) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Transcripción del Hecho (Texto sin procesar)
                </label>
                <textarea
                  rows={6}
                  value={relato}
                  onChange={(e) => setRelato(e.target.value)}
                  placeholder="El relato del ciudadano dictado por voz o tipeado aparecerá aquí..."
                  className="w-full bg-slate-50 text-slate-800 text-xs leading-relaxed rounded-lg p-3.5 border border-slate-200 
                    hover:border-slate-300 focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all resize-y"
                />
              </div>

              {/* Botón de Procesamiento RAG */}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleProcessRag}
                  disabled={isAnalyzing}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs py-3.5 px-6 rounded-lg shadow-sm hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Extrayendo hechos y tipificando con LLM+RAG...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-cyan-100" />
                      <span>⚡ Procesar Denuncia con LLM + RAG</span>
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>

          {/* ════════════════════════════════════════════════════════════════════
              PANEL DERECHO: Acta Oficial PNP y Edición (h-full overflow-y-auto)
             ════════════════════════════════════════════════════════════════════ */}
          <div className="h-full overflow-y-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
            
            {/* Header de Acciones del Acta */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-cyan-600" />
                <span className="text-xs font-bold text-slate-900 tracking-tight">
                  Acta Oficial de Recepción (Formato A4)
                </span>
                <span className="text-[10px] font-mono bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded border border-cyan-100">
                  {acta.actaNumero}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Copiar texto del acta"
                >
                  {copiedToast ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                  {copiedToast ? 'Copiado' : 'Copiar'}
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-400" />
                  Imprimir Acta
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="text-xs font-semibold text-cyan-700 hover:text-cyan-800 bg-cyan-50 hover:bg-cyan-100/80 border border-cyan-200 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-600" />
                  Descargar PDF
                </button>
              </div>
            </div>

            {/* ── CUERPO DEL DOCUMENTO A4 INSTITUCIONAL ──────────────────────── */}
            <div className="space-y-6">
              
              {/* Membrete Oficial PNP */}
              <div className="text-center pb-4 border-b-2 border-slate-900 space-y-1">
                <div className="w-10 h-10 mx-auto mb-1.5 rounded-full border-2 border-slate-900 flex items-center justify-center font-serif font-black text-slate-900 text-sm">
                  PNP
                </div>
                <div className="text-[11px] font-black tracking-widest text-slate-900 uppercase">
                  POLICÍA NACIONAL DEL PERÚ
                </div>
                <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  REGIÓN POLICIAL LIMA · DIVPOL CENTRO
                </div>
                <InlineField
                  value={acta.unidadPolicial}
                  onChange={(val) => setActa({ ...acta, unidadPolicial: val })}
                  className="text-center font-semibold text-xs text-slate-700"
                />
                <div className="pt-2">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded tracking-wider">
                    ACTA DE RECEPCIÓN DE DENUNCIA VERBAL N° {acta.actaNumero}
                  </span>
                </div>
              </div>

              {/* Párrafo de Apertura Legal */}
              <p className="text-xs text-slate-600 leading-relaxed text-justify">
                En la ciudad de Lima, siendo las <strong>{acta.horaEmision}</strong> del día{' '}
                <strong>{acta.fechaEmision}</strong>, por ante el Efectivo Policial Instructor que suscribe, 
                se hace presente el ciudadano cuyos datos se detallan en el rubro siguiente, con la finalidad de interponer 
                denuncia penal por la presunta comisión de delito patrimonial cometido en su agravio:
              </p>

              {/* SECCIÓN I: DATOS DEL INSTRUCTOR */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2.5 py-1 rounded border-l-4 border-slate-900">
                  I. Datos del Instructor Policial
                </div>
                <div className="grid grid-cols-2 gap-3 p-1 text-xs">
                  <div>
                    <InlineField
                      label="Efectivo Policial Receptor"
                      value={acta.instructorNombre}
                      onChange={(val) => setActa({ ...acta, instructorNombre: val })}
                      highlight
                    />
                  </div>
                  <div>
                    <InlineField
                      label="Grado / Carné CIP"
                      value={`${acta.instructorGrado} · ${acta.instructorCip}`}
                      onChange={(val) => setActa({ ...acta, instructorCip: val })}
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN II: FILIACIÓN DEL DENUNCIANTE */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2.5 py-1 rounded border-l-4 border-slate-900">
                  II. Filiación del Denunciante / Agraviado
                </div>
                <div className="grid grid-cols-3 gap-3 p-1 text-xs">
                  <div className="col-span-1 sm:col-span-2">
                    <InlineField
                      label="Nombres y Apellidos"
                      value={`${complainant.nombres} ${complainant.apellidos}`}
                      onChange={(val) => {
                        const parts = val.split(' ');
                        setComplainant({ ...complainant, nombres: parts[0] || '', apellidos: parts.slice(1).join(' ') });
                      }}
                      highlight
                    />
                  </div>
                  <div>
                    <InlineField
                      label="DNI N°"
                      value={complainant.dni}
                      onChange={(val) => setComplainant({ ...complainant, dni: val })}
                    />
                  </div>
                  <div>
                    <InlineField
                      label="Edad / Sexo"
                      value={`${complainant.edad} años · ${complainant.sexo}`}
                      onChange={() => {}}
                    />
                  </div>
                  <div>
                    <InlineField
                      label="Grado de Instrucción"
                      value={complainant.gradoInstruccion}
                      onChange={(val) => setComplainant({ ...complainant, gradoInstruccion: val })}
                    />
                  </div>
                  <div>
                    <InlineField
                      label="Ocupación"
                      value={complainant.ocupacion}
                      onChange={(val) => setComplainant({ ...complainant, ocupacion: val })}
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2">
                    <InlineField
                      label="Dónde vive (Domicilio)"
                      value={complainant.domicilio}
                      onChange={(val) => setComplainant({ ...complainant, domicilio: val })}
                    />
                  </div>
                  <div>
                    <InlineField
                      label="Teléfono"
                      value={complainant.telefono}
                      onChange={(val) => setComplainant({ ...complainant, telefono: val })}
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN III: TIPIFICACIÓN RAG SEGÚN CÓDIGO PENAL */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2.5 py-1 rounded border-l-4 border-cyan-500">
                  <span>III. Calificación Jurídica y Tipificación Penal (LLM + RAG)</span>
                  <span className="text-[10px] font-mono text-cyan-700 bg-cyan-100/80 px-2 py-0.5 rounded">
                    Confianza: {acta.confianzaScore}%
                  </span>
                </div>
                <div className="p-3 bg-cyan-50/40 border border-cyan-100 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <InlineField
                        label="Tipo Penal Determinado"
                        value={acta.tipoPenal}
                        onChange={(val) => setActa({ ...acta, tipoPenal: val })}
                        className="text-sm font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <InlineField
                        label="Artículo Aplicable (Código Penal)"
                        value={acta.articulo}
                        onChange={(val) => setActa({ ...acta, articulo: val })}
                        className="font-semibold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-cyan-100/60">
                    <div>
                      <InlineField
                        label="Modalidad Delictiva"
                        value={acta.modalidad}
                        onChange={(val) => setActa({ ...acta, modalidad: val })}
                      />
                    </div>
                    <div>
                      <InlineField
                        label="Nivel de Violencia"
                        value={acta.nivelViolencia}
                        onChange={(val) => setActa({ ...acta, nivelViolencia: val })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECCIÓN IV: BIENES SUSTRAÍDOS Y CIRCUNSTANCIAS */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2.5 py-1 rounded border-l-4 border-slate-900">
                  IV. Bienes Sustraídos y Circunstancias del Hecho
                </div>
                <div className="space-y-3 p-1 text-xs">
                  <div>
                    <InlineField
                      label="Bienes Afectados y Estimación Patrimonial"
                      value={acta.bienesSustraidos}
                      onChange={(val) => setActa({ ...acta, bienesSustraidos: val })}
                      isTextarea
                      rows={2}
                      highlight
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <InlineField
                        label="Lugar del Hecho"
                        value={acta.lugarHecho}
                        onChange={(val) => setActa({ ...acta, lugarHecho: val })}
                      />
                    </div>
                    <div>
                      <InlineField
                        label="Cronología / Horario"
                        value={acta.cronologia}
                        onChange={(val) => setActa({ ...acta, cronologia: val })}
                      />
                    </div>
                  </div>
                  <div>
                    <InlineField
                      label="Perpetradores / Armas / Vehículos"
                      value={acta.perpetradores}
                      onChange={(val) => setActa({ ...acta, perpetradores: val })}
                      isTextarea
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN V: MANIFESTACIÓN */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 bg-slate-100 px-2.5 py-1 rounded border-l-4 border-slate-900">
                  V. Manifestación del Denunciante
                </div>
                <div className="p-1">
                  <InlineField
                    value={acta.manifestacion}
                    onChange={(val) => setActa({ ...acta, manifestacion: val })}
                    isTextarea
                    rows={4}
                    className="text-justify leading-relaxed text-xs"
                  />
                </div>
              </div>

              {/* SECCIÓN VI: FIRMAS DIGITALES Y HUELLA DACTILAR */}
              <div className="pt-6 border-t border-slate-200">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-6">
                  Suscripción y Cierre del Acta de Denuncia
                </div>

                <div className="grid grid-cols-2 gap-6 items-end">
                  {/* Firma Denunciante + Huella */}
                  <div className="flex flex-col items-center">
                    <div className="flex gap-3 items-end mb-2">
                      <div className="w-36 border-b border-slate-700 pb-1 text-center text-[9px] text-slate-400">
                        (Firma del Agraviado)
                      </div>
                      <div className="w-14 h-16 border border-dashed border-slate-400 rounded flex flex-col items-center justify-center p-1 bg-slate-50">
                        <Fingerprint className="w-6 h-6 text-slate-400" />
                        <span className="text-[7px] font-bold text-slate-500 text-center leading-tight mt-0.5">
                          Índice Der.
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-slate-900">
                        {complainant.nombres} {complainant.apellidos}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        DNI N° {complainant.dni}
                      </div>
                    </div>
                  </div>

                  {/* Firma Efectivo PNP */}
                  <div className="flex flex-col items-center">
                    <div className="w-40 border-b border-slate-700 pb-1 text-center text-[9px] text-slate-400 mb-6">
                      (Firma y Sello del Instructor)
                    </div>
                    <div className="text-center">
                      <div className="text-xs font-bold text-slate-900">
                        {acta.instructorNombre}
                      </div>
                      <div className="text-[10px] text-slate-600 font-medium">
                        {acta.instructorGrado}
                      </div>
                      <div className="text-[9px] text-cyan-600 font-mono">
                        {acta.instructorCip} · PNP
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pie de Documento Oficial */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400 font-mono">
                <span>SISTEMARAG PNP · LAB 2026</span>
                <span>REGISTRO OFICIAL AUDITABLE</span>
              </div>

            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
