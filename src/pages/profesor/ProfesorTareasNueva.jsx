import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import logoTexto from '../../assets/logo_texto.png';
import BackdropLoader from '../../components/BackdropLoader';
import { notificarCurso } from '../../utils/notificacionesUtils';
import { sortCursos } from '../../utils/sortUtils';
import { useAuth } from '../../context/AuthContext';

export default function ProfesorTareasNueva() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [misAsignaturas, setMisAsignaturas] = useState([]);
  const [selectedAsignaturaId, setSelectedAsignaturaId] = useState('');

  // INTERRUPTOR INTELIGENTE
  const [modoCreacion, setModoCreacion] = useState('evaluacion');
  const [pasoActual, setPasoActual] = useState(1);

  // Estados Formulario Común
  const [tituloForm, setTituloForm] = useState('');
  const [instruccionesForm, setInstruccionesForm] = useState('');
  const [fechaForm, setFechaForm] = useState('');

  // Estados Archivos y Editor
  const [archivos, setArchivos] = useState([]);
  const [isDragging, setIsDragging] = useState(false); // NUEVO: Efecto Drag & Drop
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

  // Estados Específicos para EVALUACIÓN
  const [porcentaje, setPorcentaje] = useState('20');
  const [tipoInstrumento, setTipoInstrumento] = useState('Prueba de Desarrollo');
  const [tipoEvaluacion, setTipoEvaluacion] = useState('Sumativa');
  const [oaEvaluado, setOaEvaluado] = useState('');
  const [semestreForm, setSemestreForm] = useState('Primer Semestre');

  const [isSaving, setIsSaving] = useState(false);

  // --- ESTADOS PARA LA IA AVANZADA (ENTREVISTA PEDAGÓGICA) ---
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Respuestas del profesor a la IA
  const [iaTema, setIaTema] = useState('');
  const [iaDificultad, setIaDificultad] = useState('Intermedia (Aplicar y Analizar)');
  const [iaNumPreguntas, setIaNumPreguntas] = useState('5');
  const [iaFormatoPregunta, setIaFormatoPregunta] = useState('Mixta (Alternativas y Desarrollo)');
  const [iaIncluirRubrica, setIaIncluirRubrica] = useState(true);
  const [iaAdaptacionPIE, setIaAdaptacionPIE] = useState(false);

  // NUEVO ESTADO: Para el modo "Tarea Formativa"
  const [iaTipoTarea, setIaTipoTarea] = useState('Guía de Ejercicios Paso a Paso');

  const cargarAsignaturas = async (rutProfesor) => {
    const { data } = await supabase
      .from('asignaturas')
      .select('id, nombre, id_curso, cursos(nombre, nivel)')
      .eq('rut_profesor', rutProfesor);

    if (data && data.length > 0) {
      let unicas = data.filter((v, i, a) => a.findIndex(v2 => (v2.id_curso === v.id_curso && v2.nombre === v.nombre)) === i);
      unicas = sortCursos(unicas);
      setMisAsignaturas(unicas);
      setSelectedAsignaturaId(unicas[0].id.toString());
    }
  };

  useEffect(() => {
    if (user) {
      cargarAsignaturas(user.rut);
    }
  }, [user]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== instruccionesForm) {
      editorRef.current.innerHTML = instruccionesForm;
    }
  }, [instruccionesForm]);

  // --- EXPORTAR A WORD (LA MAGIA) ---
  const handleExportarWord = async () => {
    if (!instruccionesForm.trim()) {
      toast.error('No hay contenido para exportar.');
      return;
    }

    const toastId = toast.loading('Generando documento profesional...');

    try {
      let base64Logo = '';
      try {
        const response = await fetch(logoTexto);
        const blob = await response.blob();
        base64Logo = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error("No se pudo cargar el logo", e);
      }

      const asignaturaSel = misAsignaturas.find(a => a.id.toString() === selectedAsignaturaId);
      const nombreCurso = asignaturaSel ? asignaturaSel.cursos?.nombre : '_________________';
      const nombreAsignatura = asignaturaSel ? asignaturaSel.nombre : '';

      const professionalHeader = `
        <table style="width:100%; border:none; margin-bottom: 20px; font-family: Arial, sans-serif;">
          <tr>
            <td style="width: 30%; border:none; text-align: left; vertical-align: top;">
               ${base64Logo ? `<img src="${base64Logo}" style="max-height: 50px;" />` : '<h2 style="margin:0; font-size:18px; color:#1e3a8a;">Colegio ConectaEdu</h2>'}
               <p style="margin:5px 0 0 0; font-size: 11px; color:#666;">Asignatura: ${nombreAsignatura}</p>
            </td>
            <td style="width: 70%; border:none; text-align: right; vertical-align: top;">
               <p style="margin:0; font-size: 16px; font-weight: bold; color: #111;">${tituloForm || 'Documento'}${iaAdaptacionPIE ? ' (Adecuación Curricular PIE)' : ''}</p>
               <p style="margin:4px 0; font-size: 12px; color: #333;">Curso: <b>${nombreCurso}</b> &nbsp;|&nbsp; Fecha: _________________</p>
               <p style="margin:4px 0; font-size: 12px; color: #333;">Nombre: _________________________________________</p>
               ${modoCreacion === 'evaluacion' ? `
               <table style="width: 100%; margin-top: 10px; border-collapse: collapse; font-size: 11px;">
                 <tr>
                   <td style="border: 1px solid #000; padding: 4px; text-align: center; width: 33%;">Puntaje Ideal:<br><br><b>____</b></td>
                   <td style="border: 1px solid #000; padding: 4px; text-align: center; width: 33%;">Puntaje Obtenido:<br><br><b>____</b></td>
                   <td style="border: 1px solid #000; padding: 4px; text-align: center; width: 34%; font-size:14px;">Nota:<br><br><b>____</b></td>
                 </tr>
               </table>` : ''}
            </td>
          </tr>
        </table>
        <hr style="border: 1px solid #ccc; margin-bottom: 20px;" />
      `;

      const htmlHeader = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Documento</title><style>body { font-family: 'Calibri', 'Arial', sans-serif; } table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 20px; } th, td { border: 1px solid #000; padding: 8px; text-align: left; } th { background-color: #f3f4f6; font-weight: bold; } h1, h2, h3 { color: #111827; } p { line-height: 1.5; }</style></head><body>";
      const htmlFooter = "</body></html>";
      const sourceHTML = htmlHeader + professionalHeader + instruccionesForm + htmlFooter;

      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `${tituloForm || 'Documento_ConectaEduc'}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);

      toast.success('¡Documento Word generado exitosamente!', { id: toastId });
    } catch (error) {
      console.error('Error al exportar a word:', error);
      toast.error('Error al exportar el documento.', { id: toastId });
    }
  };

  // --- FUNCIÓN QUE SE CONECTA A GROQ IA (DOBLE CEREBRO INTELIGENTE) ---
  const generarContenidoConIA = async (e) => {
    e.preventDefault();
    if (!iaTema.trim()) {
      toast.error("El tema principal es obligatorio.");
      return;
    }

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey || apiKey === 'tu_clave_aqui' || apiKey === 'undefined') {
      toast.error('Falta la API Key de Groq. Revisa tu archivo .env');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('IA diseñando el contenido pedagógico...');

    try {
      const asignaturaSel = misAsignaturas.find(a => a.id.toString() === selectedAsignaturaId);
      const contextoCurso = asignaturaSel ? `${asignaturaSel.cursos?.nombre} (${asignaturaSel.nombre})` : 'un curso';

      let promptEspecifico = "";

      const instruccionPIE = iaAdaptacionPIE
        ? `\nMUY IMPORTANTE: Aplica el Diseño Universal de Aprendizaje (DUA). Adapta el documento para estudiantes con Necesidades Educativas Especiales (NEE). Simplifica el lenguaje, usa instrucciones de un solo paso, resalta con <b>negrita</b> los verbos de acción y conceptos clave. Si hay alternativas, usa SOLO 3 opciones (A, B y C) en vertical.`
        : '';

      // --- CEREBRO 1: MODO TAREA FORMATIVA ---
      if (modoCreacion === 'tarea') {
        promptEspecifico = `Diseña una "${iaTipoTarea}" sobre el tema: "${iaTema}".
        El curso es ${contextoCurso}. Nivel de dificultad: ${iaDificultad}.
        
        ESTRUCTURA OBLIGATORIA:
        1. Título principal llamativo envuelto en <h2>.
        2. Un breve párrafo introductorio o motivacional (<p>).
        3. Instrucciones claras paso a paso usando listas (<ul> o <ol>).
        4. El desarrollo de la actividad (preguntas, ejercicios o esquema de investigación).
        5. Deja espacio visual si el alumno debe responder ahí mismo (usa <br><br><br>).
        
        ${instruccionPIE}
        
        REGLA DE FORMATO: Devuelve SÓLO código HTML limpio. ESTÁ ESTRICTAMENTE PROHIBIDO USAR MARKDOWN.`;

        // --- CEREBRO 2: MODO EVALUACIÓN (LIBRO DE CLASES) ---
      } else {
        const paramCurricularesText = `Tipo de Evaluación: ${tipoEvaluacion}. Objetivo de Aprendizaje (OA): ${oaEvaluado || 'No especificado'}. Ponderación: ${porcentaje}%.`;

        if (tipoInstrumento.includes('Prueba')) {
          promptEspecifico = `Diseña una prueba escrita sobre el tema: "${iaTema}". 
          El curso es ${contextoCurso}.
          ${paramCurricularesText}
          Nivel de dificultad: ${iaDificultad}.
          
          REGLA DE CANTIDAD CRÍTICA: Debes generar EXACTAMENTE ${iaNumPreguntas} preguntas numeradas secuencialmente.
          Formato de preguntas: ${iaFormatoPregunta}.`;

          if (iaFormatoPregunta === 'Comprensión Lectora (Texto + Preguntas)') {
            promptEspecifico += `\nREGLA OBLIGATORIA DE LECTURA: PRIMERO, redacta un texto original adecuado para la edad. DESPUÉS del texto, genera las preguntas basándose EXCLUSIVAMENTE en la lectura.`;
          }

          promptEspecifico += `
          \nREGLAS DE FORMATO Y DISEÑO (¡EXTREMADAMENTE IMPORTANTE!):
          1. CERO MARKDOWN: No uses asteriscos (**), usa <b>. No uses # para títulos, usa <h3>.
          2. ESTÁ PROHIBIDO usar tablas (<table>) para agrupar preguntas o alternativas.
          3. OBLIGATORIO - ALTERNATIVAS EN FORMATO VERTICAL CON <br>: Cada alternativa (A, B, C, D) DEBE ir en una línea separada con un <br> al final.
          4. Deja espacio para desarrollo (<br><br><br>). 
          5. Incluye la habilidad cognitiva: <i>[Habilidad: Analizar]</i>.
          ${instruccionPIE}
          No añadas encabezados de nombre/fecha.`;

          if (iaIncluirRubrica) {
            promptEspecifico += `\nAl final de la prueba, agrega una etiqueta <hr> y diseña la PAUTA DE CORRECCIÓN (Obligatorio usar tablas HTML reales, no markdown).`;
          }
        } else if (tipoInstrumento === 'Rúbrica Analítica') {
          promptEspecifico = `Diseña una matriz de rúbrica analítica MUY detallada sobre el tema: "${iaTema}". Curso: ${contextoCurso}. Dificultad: ${iaDificultad}.
          OBLIGATORIO: Tabla HTML. Cabecera y primera columna con fondo azul (#4f81bd) y texto blanco. Columnas: Aspectos a evaluar | Excelente | Bien | Suficiente | Regular | Sugerencias de Mejora. ${instruccionPIE}`;
        } else {
          promptEspecifico = `Crea una lista de cotejo (checklist) formativa en tabla HTML sobre: "${iaTema}" para el curso ${contextoCurso}. Dificultad: ${iaDificultad}. Columnas: Indicador | Logrado | Medianamente Logrado | Por Lograr | Comentarios. ${instruccionPIE}`;
        }
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "Eres un experto en currículum escolar chileno. Devuelve OBLIGATORIAMENTE SÓLO código HTML limpio. ESTÁ ESTRICTAMENTE PROHIBIDO USAR MARKDOWN. Aplica estilos CSS en línea básicos a las tablas reales de HTML (<table style='width:100%; border-collapse:collapse; margin-top:20px;' border='1'>). No añadas explicaciones fuera del HTML."
            },
            {
              role: "user",
              content: promptEspecifico
            }
          ],
          temperature: 0.5,
          max_tokens: 4500
        })
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error?.message || `Error ${response.status}`);

      if (data.choices && data.choices.length > 0) {
        let htmlGenerado = data.choices[0].message.content.replace(/```html/g, '').replace(/```/g, '');

        setInstruccionesForm(htmlGenerado);
        toast.success('¡Generación exitosa!', { id: toastId });
        setIsPromptModalOpen(false);
      } else {
        throw new Error('Sin contenido generado.');
      }

    } catch (error) {
      console.error("Error:", error);
      toast.error(`Fallo: ${error.message}`, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  // --- GUARDADO EN SUPABASE CON SUBIDA DE ARCHIVOS ---
  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!tituloForm.trim() || !selectedAsignaturaId) return;

    setIsSaving(true);
    const toastId = toast.loading(`Publicando ${modoCreacion === 'evaluacion' ? 'evaluación oficial' : 'tarea formativa'}...`);

    try {
      const asignaturaSeleccionada = misAsignaturas.find(a => a.id.toString() === selectedAsignaturaId);

      // 1. Subir archivo a Supabase Storage (Si el profesor adjuntó algo)
      let archivoUrlGuardado = null;
      if (archivos.length > 0) {
        toast.loading('Subiendo archivo adjunto...', { id: toastId });
        const file = archivos[0]; // Solo tomamos 1 archivo por ahora
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from('archivos_tareas').upload(fileName, file);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('archivos_tareas').getPublicUrl(fileName);
          archivoUrlGuardado = publicUrlData.publicUrl;
        } else {
          console.error("Error al subir archivo", uploadError);
          toast.error("Advertencia: No se pudo subir el archivo adjunto.", { id: toastId });
        }
      }

      // 2. Guardar el registro en la base de datos
      if (modoCreacion === 'evaluacion') {
        const { error } = await supabase.from('evaluaciones').insert([{
          id_asignatura: parseInt(selectedAsignaturaId),
          nombre: tituloForm.trim(),
          descripcion: instruccionesForm.trim() || null,
          porcentaje: porcentaje ? parseInt(porcentaje) : null,
          tipo_instrumento: tipoInstrumento,
          oa_evaluado: oaEvaluado.trim() || null,
          fecha_planificada: fechaForm || null,
          semestre: semestreForm
        }]);
        if (error) throw error;
        toast.success('Evaluación guardada. Columna añadida al Libro de Clases.', { id: toastId });
        setTimeout(() => navigate('/panel/profesor/calificaciones'), 1500);

      } else {
        if (modoCreacion === 'tarea' && !fechaForm) {
          toast.error("La fecha límite de entrega es obligatoria para las tareas.", { id: toastId });
          setIsSaving(false); return;
        }
        const { error } = await supabase.from('tareas').insert([{
          titulo: tituloForm.trim(),
          descripcion: instruccionesForm.trim() || null,
          id_curso: asignaturaSeleccionada.id_curso,
          id_asignatura: parseInt(selectedAsignaturaId),
          rut_profesor: user.rut,
          fecha_entrega: modoCreacion === 'tarea' ? fechaForm : null,
          estado: modoCreacion === 'material' ? 'Material de Estudio' : 'Activa',
          archivo_url: archivoUrlGuardado // <-- EL LINK DEL ARCHIVO SE GUARDA AQUÍ
        }]);
        if (error) throw error;
        
        // NOTIFICAR AL CURSO (Alumnos y Apoderados)
        await notificarCurso(
          asignaturaSeleccionada.id_curso, 
          ['alumno', 'apoderado'],
          'alerta', 
          modoCreacion === 'material' ? 'Nuevo Material de Estudio' : 'Nueva Tarea Asignada', 
          `El profesor ${user?.nombre || user?.rut} ha subido ${modoCreacion === 'material' ? 'el material' : 'la tarea'}: "${tituloForm.trim()}" en ${asignaturaSeleccionada.nombre}.`,
          null
        );

        toast.success(modoCreacion === 'material' ? 'Material de estudio publicado.' : 'Tarea formativa publicada correctamente.', { id: toastId });
        setTimeout(() => navigate('/panel/profesor/tareas'), 1500);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error general al guardar.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  // Funciones de Drag & Drop mejoradas
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setArchivos([e.dataTransfer.files[0]]); // Solo 1 archivo
    }
  };
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setArchivos([e.target.files[0]]);
    }
  };
  const removeFile = () => setArchivos([]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-gray-800 dark:text-white dark:border dark:border-gray-700' }} />

      {/* CABECERA */}
      <div className="mb-4 flex items-start gap-4">
        <button onClick={() => navigate(-1)} className="group flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 transition-all mt-1 shrink-0">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Volver
        </button>
        <div className="border-l-2 border-gray-300 dark:border-gray-600 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Diseñador de Actividades</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configura tareas formativas o diseña evaluaciones formales para el Libro de Clases.</p>
        </div>
      </div>

      <div className="max-w-4xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 sm:p-8 space-y-8 relative overflow-hidden">
        
        {isSaving && (
          <BackdropLoader mensaje="Guardando cambios..." />
        )}

        {/* STEPPER HEADER */}
        <div className="flex justify-between items-center mb-8 relative px-4 sm:px-12">
          <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-1 bg-gray-200 dark:bg-gray-700 rounded-full z-0"></div>
          <div className={`absolute left-10 top-1/2 -translate-y-1/2 h-1 bg-indigo-500 rounded-full z-0 transition-all duration-500`} style={{ width: pasoActual === 1 ? '0%' : pasoActual === 2 ? '50%' : 'calc(100% - 5rem)' }}></div>
          
          <div className={`relative z-10 flex flex-col items-center gap-2 ${pasoActual >= 1 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${pasoActual >= 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>1</div>
            <span className="text-xs font-bold hidden sm:block">Datos Básicos</span>
          </div>
          
          <div className={`relative z-10 flex flex-col items-center gap-2 ${pasoActual >= 2 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${pasoActual >= 2 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>2</div>
            <span className="text-xs font-bold hidden sm:block">Configuración</span>
          </div>
          
          <div className={`relative z-10 flex flex-col items-center gap-2 ${pasoActual >= 3 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${pasoActual >= 3 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>3</div>
            <span className="text-xs font-bold hidden sm:block">Contenido</span>
          </div>
        </div>

        <form onSubmit={handleGuardar} className="space-y-6">
          
          {pasoActual === 1 && (
            <div className="space-y-6 animate-fade-in">
              {/* INTERRUPTOR INTELIGENTE */}
              <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700/50 flex-col sm:flex-row">
                <button
                  type="button"
                  onClick={() => setModoCreacion('evaluacion')}
                  className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${modoCreacion === 'evaluacion' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  📋 Crear Evaluación
                </button>
                <button
                  type="button"
                  onClick={() => setModoCreacion('tarea')}
                  className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${modoCreacion === 'tarea' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  📝 Crear Tarea
                </button>
                <button
                  type="button"
                  onClick={() => setModoCreacion('material')}
                  className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${modoCreacion === 'material' ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                >
                  📚 Material de Estudio
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{modoCreacion === 'evaluacion' ? 'Título de la Evaluación *' : modoCreacion === 'tarea' ? 'Título de la Tarea *' : 'Título del Material *'}</label>
                  <input required type="text" maxLength={60} placeholder={modoCreacion === 'evaluacion' ? "Ej: Prueba Coef 1: Geometría y Álgebra" : modoCreacion === 'tarea' ? "Ej: Trabajo de Investigación: Revolución Industrial" : "Ej: Apuntes de Geometría"} value={tituloForm} onChange={(e) => setTituloForm(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-gray-800 dark:text-white transition-all shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Asignatura y Curso *</label>
                  <select required value={selectedAsignaturaId} onChange={(e) => setSelectedAsignaturaId(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-gray-800 dark:text-white transition-all shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                    {misAsignaturas.map(a => <option key={a.id} value={a.id}>{a.cursos?.nombre} - {a.nombre}</option>)}
                  </select>
                </div>
                {modoCreacion !== 'material' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{modoCreacion === 'evaluacion' ? 'Fecha Programada' : 'Fecha Límite de Entrega *'}</label>
                    <input type="date" required={modoCreacion === 'tarea'} value={fechaForm} onChange={(e) => setFechaForm(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-gray-800 dark:text-white transition-all shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- ESTO REEMPLAZA A TU BLOQUE DE PARÁMETROS CURRICULARES --- */}
          {pasoActual === 2 && (
            <div className="animate-fade-in">
              {modoCreacion === 'evaluacion' ? (
                <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-2xl space-y-5">
                  <h3 className="font-bold text-indigo-800 dark:text-indigo-300 text-sm uppercase flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Parámetros del Libro de Clases
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Semestre</label>
                      <select value={semestreForm} onChange={(e) => setSemestreForm(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 shadow-sm text-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                        <option value="Primer Semestre">1º Semestre</option>
                        <option value="Segundo Semestre">2º Semestre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tipo de Evaluación</label>
                      <select value={tipoEvaluacion} onChange={(e) => setTipoEvaluacion(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 shadow-sm text-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                        <option value="Formativa">Formativa</option>
                        <option value="Sumativa">Sumativa</option>
                        <option value="Diagnóstica">Diagnóstica</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Instrumento a Usar</label>
                      <select value={tipoInstrumento} onChange={(e) => setTipoInstrumento(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 shadow-sm text-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
                        <option value="Prueba de Desarrollo">Prueba de Desarrollo</option>
                        <option value="Prueba de Selección Múltiple">Prueba Selección Múltiple</option>
                        <option value="Rúbrica Analítica">Rúbrica Analítica</option>
                        <option value="Lista de Cotejo">Lista de Cotejo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ponderación (%)</label>
                      <input type="number" min="1" max="100" placeholder="Ej: 20" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 shadow-sm text-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-800" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Objetivo de Apdz.</label>
                      <input type="text" placeholder="Ej: OA 04..." value={oaEvaluado} onChange={(e) => setOaEvaluado(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 shadow-sm text-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-800" />
                    </div>
                  </div>
                </div>
              ) : modoCreacion === 'tarea' ? (
                <div className="p-6 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-2xl">
                  <h3 className="font-bold text-blue-800 dark:text-blue-300 text-sm uppercase flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Configuración de Tarea Formativa
                  </h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Esta actividad no afectará el promedio final. Es un recurso de práctica para tus estudiantes.
                  </p>
                </div>
              ) : (
                <div className="p-6 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-2xl">
                  <h3 className="font-bold text-emerald-800 dark:text-emerald-300 text-sm uppercase flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    Material de Estudio
                  </h3>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Este material estará disponible para que los estudiantes lo descarguen y estudien a su propio ritmo. No requiere entrega ni fecha límite.
                  </p>
                </div>
              )}
            </div>
          )}

          {pasoActual === 3 && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 border-b border-gray-200 dark:border-gray-700 pb-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Cuerpo de la Actividad y Archivo Adjunto</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sube el documento de la actividad o generalo de forma automática usando la IA.</p>
              </div>

              <div className="flex gap-2">
                {instruccionesForm && (
                  <button type="button" onClick={handleExportarWord} className="text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 px-4 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-1.5 shadow-sm">
                    📄 Descargar en Word
                  </button>
                )}
                <button type="button" onClick={() => setIsPromptModalOpen(true)} className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 px-4 py-2 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-1.5 shadow-sm">
                  ✨ Redactar con IA
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* CONTENEDOR SUBIR ARCHIVO (MEJORADO CON DRAG & DROP) */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-300 h-[300px] ${isDragging
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.02]'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
              >
                <div className={`p-3 rounded-full mb-3 ${isDragging ? 'bg-blue-100 text-blue-600 dark:bg-blue-800/50 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500'}`}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                </div>
                <p className={`text-sm font-bold ${isDragging ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {isDragging ? '¡Suelta el archivo aquí!' : 'Arrastra y suelta un archivo aquí'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">PDF o Word (Máx 5MB). O búscalo en tu equipo:</p>

                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="px-5 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                  Explorar Archivos
                </button>

                {archivos.length > 0 && (
                  <div className="w-full mt-5 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800/50 p-3 rounded-xl flex justify-between items-center text-xs font-bold shadow-sm ring-1 ring-blue-500/20">
                    <div className="flex items-center gap-2 truncate text-blue-700 dark:text-blue-400">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <span className="truncate">{archivos[0].name}</span>
                    </div>
                    <button type="button" onClick={removeFile} className="text-gray-400 hover:text-red-500 transition-colors p-1 bg-gray-100 hover:bg-red-50 rounded-md dark:bg-gray-800 dark:hover:bg-red-900/30">✖</button>
                  </div>
                )}
              </div>

              {/* CONTENEDOR TEXTO / PREVISUALIZACIÓN IA */}
              <div className="flex flex-col h-[300px]">
                {instruccionesForm ? (
                  <div className="flex-1 flex flex-col border border-purple-200 dark:border-purple-800/50 rounded-2xl bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
                    <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 border-b border-purple-100 dark:border-purple-800/50 flex justify-between items-center">
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Texto Generado con IA</span>
                      <button type="button" onClick={() => setInstruccionesForm('')} className="text-[10px] text-gray-500 hover:text-red-500 uppercase font-bold transition-colors">Limpiar</button>
                    </div>
                    <div className="p-5 flex-1 overflow-y-auto text-sm text-gray-800 dark:text-gray-200 rich-text-preview custom-scrollbar">
                      <style>
                        {`
                          .rich-text-preview b, .rich-text-preview strong { font-weight: bold; }
                          .rich-text-preview i, .rich-text-preview em { font-style: italic; }
                          .rich-text-preview h2 { font-size: 1.25rem; font-weight: 800; margin-bottom: 0.75rem; color: #1e3a8a; }
                          .rich-text-preview h3 { font-size: 1.1rem; font-weight: bold; margin-top: 1rem; margin-bottom: 0.5rem; }
                          .dark .rich-text-preview h2 { color: #60a5fa; }
                          .rich-text-preview u { text-decoration: underline; }
                          .rich-text-preview ul, .rich-text-preview ol { padding-left: 1.5rem; margin: 0.5rem 0; }
                          .rich-text-preview ul { list-style-type: disc; }
                          .rich-text-preview ol { list-style-type: decimal; }
                          .rich-text-preview table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                          .rich-text-preview th, .rich-text-preview td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
                          .dark .rich-text-preview th, .dark .rich-text-preview td { border-color: #4b5563; }
                          .rich-text-preview th { background-color: #f3f4f6; font-weight: bold; }
                          .dark .rich-text-preview th { background-color: #374151; color: white; }
                        `}
                      </style>
                      <div dangerouslySetInnerHTML={{ __html: instruccionesForm }} />
                    </div>
                  </div>
                ) : (
                  <textarea
                    className="flex-1 w-full p-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none text-sm text-gray-800 dark:text-white resize-none transition-all shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                    placeholder="Escribe instrucciones adicionales para los alumnos o genera un documento estructurado presionando el botón 'Redactar con IA'..."
                    onChange={(e) => setInstruccionesForm(e.target.value)}
                  ></textarea>
                )}
              </div>
            </div>
          </div>
          )}

          <div className="pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-between gap-3 mt-8">
            {pasoActual > 1 ? (
              <button type="button" onClick={() => setPasoActual(pasoActual - 1)} className="px-5 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm">Atrás</button>
            ) : (
              <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm">Cancelar</button>
            )}

            {pasoActual < 3 ? (
              <button type="button" onClick={() => {
                if (pasoActual === 1) {
                  if (!tituloForm.trim() || !selectedAsignaturaId || (modoCreacion === 'tarea' && !fechaForm)) {
                    toast.error('Completa los campos obligatorios (*) para continuar.');
                    return;
                  }
                }
                setPasoActual(pasoActual + 1);
              }} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/30 transition-colors">Siguiente</button>
            ) : (
              <button type="submit" disabled={isSaving} className={`px-6 py-2.5 rounded-xl text-white font-bold shadow-md transition-colors flex items-center gap-2 text-sm ${modoCreacion === 'evaluacion' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'}`}>
                {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                {isSaving ? "Guardando..." : (modoCreacion === 'evaluacion' ? 'Publicar en Libro' : 'Publicar Tarea')}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* MODAL IA INTELIGENTE (BIFURCADO) */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-xl p-7 border border-gray-200 dark:border-gray-700 animate-fade-in-up relative overflow-hidden">
            {isGenerating && (
              <BackdropLoader mensaje="Diseñando contenido pedagógico..." />
            )}
            
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 p-2.5 rounded-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white">Asistente Pedagógico IA</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Elaboración inteligente de {modoCreacion === 'evaluacion' ? 'Instrumentos de Evaluación' : 'Recursos Formativos'}
                </p>
              </div>
            </div>

            <form onSubmit={generarContenidoConIA} className="space-y-5 mt-6 border-t border-gray-100 dark:border-gray-700 pt-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Tema Principal de la Actividad *</label>
                <input autoFocus required type="text" placeholder="Ej: La célula eucariota y procariota" value={iaTema} onChange={(e) => setIaTema(e.target.value)} className="w-full p-3.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none text-sm text-gray-800 dark:text-white transition-all" />
              </div>

              {/* LÓGICA BIFURCADA EN EL FORMULARIO IA */}
              {modoCreacion === 'tarea' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Nivel de Exigencia</label>
                    <select value={iaDificultad} onChange={(e) => setIaDificultad(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all shadow-sm cursor-pointer">
                      <option>Básica (Recordar)</option>
                      <option>Intermedia (Aplicar)</option>
                      <option>Avanzada (Crear)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Tipo de Actividad</label>
                    <select value={iaTipoTarea} onChange={(e) => setIaTipoTarea(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all shadow-sm cursor-pointer">
                      <option value="Guía de Ejercicios Paso a Paso">Guía de Ejercicios</option>
                      <option value="Pauta de Investigación">Pauta de Investigación</option>
                      <option value="Proyecto Práctico para la Casa">Proyecto Práctico</option>
                      <option value="Cuestionario de Reflexión">Cuestionario de Reflexión</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Exigencia Cognitiva</label>
                    <select value={iaDificultad} onChange={(e) => setIaDificultad(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all shadow-sm cursor-pointer">
                      <option>Básica (Recordar)</option>
                      <option>Intermedia (Aplicar)</option>
                      <option>Avanzada (Evaluar)</option>
                    </select>
                  </div>
                  {tipoInstrumento.includes('Prueba') && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Cant. Preguntas</label>
                        <input type="number" min="1" max="20" value={iaNumPreguntas} onChange={(e) => setIaNumPreguntas(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all shadow-sm hover:bg-gray-50" />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Formato del Instrumento</label>
                        <select value={iaFormatoPregunta} onChange={(e) => setIaFormatoPregunta(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm transition-all shadow-sm cursor-pointer">
                          <option>Mixta (Alternativas y Desarrollo)</option>
                          <option>Solo Selección Múltiple</option>
                          <option>Solo Preguntas de Desarrollo</option>
                          <option>Comprensión Lectora (Texto + Preguntas)</option>
                        </select>
                      </div>
                      <div className="col-span-2 bg-purple-50 dark:bg-purple-900/20 p-3.5 rounded-xl border border-purple-100 dark:border-purple-800/50 flex justify-between items-center cursor-pointer transition-colors" onClick={() => setIaIncluirRubrica(!iaIncluirRubrica)}>
                        <div>
                          <h4 className="font-bold text-xs text-purple-800 dark:text-purple-300">Generar Pauta de Corrección</h4>
                          <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">Adjunta tabla de respuestas al final.</p>
                        </div>
                        <div className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors ${iaIncluirRubrica ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${iaIncluirRubrica ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* BOTÓN DUA UNIVERSAL */}
              <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 p-3.5 rounded-xl border border-blue-100 dark:border-blue-800/50 flex items-center justify-between cursor-pointer transition-colors" onClick={() => setIaAdaptacionPIE(!iaAdaptacionPIE)}>
                <div>
                  <h4 className="font-bold text-xs text-blue-800 dark:text-blue-300">Adaptación Curricular DUA (PIE)</h4>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">Simplifica lenguaje y destaca conceptos clave.</p>
                </div>
                <div className={`w-11 h-6 rounded-full flex items-center px-1 transition-colors ${iaAdaptacionPIE ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${iaAdaptacionPIE ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-5 mt-2 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setIsPromptModalOpen(false)} className="px-6 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
                <button type="submit" disabled={isGenerating || !iaTema.trim()} className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50 shadow-md shadow-purple-600/30">
                  {isGenerating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Generar Documento ✨'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}