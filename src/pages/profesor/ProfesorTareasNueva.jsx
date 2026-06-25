import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import logoTexto from '../../assets/logo_texto.png';

export default function ProfesorTareasNueva() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  const [misAsignaturas, setMisAsignaturas] = useState([]);
  const [selectedAsignaturaId, setSelectedAsignaturaId] = useState('');

  // INTERRUPTOR INTELIGENTE
  const [modoCreacion, setModoCreacion] = useState('evaluacion');

  // Estados Formulario Común
  const [tituloForm, setTituloForm] = useState('');
  const [instruccionesForm, setInstruccionesForm] = useState('');
  const [fechaForm, setFechaForm] = useState('');

  // Estados Archivos y Editor
  const [archivos, setArchivos] = useState([]);
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

  // NUEVO: Estado para Adaptación DUA / PIE
  const [iaAdaptacionPIE, setIaAdaptacionPIE] = useState(false);

  const cargarAsignaturas = async (rutProfesor) => {
    const { data } = await supabase
      .from('asignaturas')
      .select('id, nombre, id_curso, cursos(nombre, nivel)')
      .eq('rut_profesor', rutProfesor);

    if (data && data.length > 0) {
      const unicas = data.filter((v, i, a) => a.findIndex(v2 => (v2.id_curso === v.id_curso && v2.nombre === v.nombre)) === i);
      setMisAsignaturas(unicas);
      setSelectedAsignaturaId(unicas[0].id.toString());
    }
  };

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      cargarAsignaturas(parsedUser.rut);
    }
  }, []);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== instruccionesForm) {
      editorRef.current.innerHTML = instruccionesForm;
    }
  }, [instruccionesForm]);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      setInstruccionesForm(editorRef.current.innerHTML);
    }
  };

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
               <p style="margin:0; font-size: 16px; font-weight: bold; color: #111;">${tituloForm || 'Evaluación'}${iaAdaptacionPIE ? ' (Adecuación Curricular PIE)' : ''}</p>
               <p style="margin:4px 0; font-size: 12px; color: #333;">Curso: <b>${nombreCurso}</b> &nbsp;|&nbsp; Fecha: _________________</p>
               <p style="margin:4px 0; font-size: 12px; color: #333;">Nombre: _________________________________________</p>
               <table style="width: 100%; margin-top: 10px; border-collapse: collapse; font-size: 11px;">
                 <tr>
                   <td style="border: 1px solid #000; padding: 4px; text-align: center; width: 33%;">Puntaje Ideal:<br><br><b>____</b></td>
                   <td style="border: 1px solid #000; padding: 4px; text-align: center; width: 33%;">Puntaje Obtenido:<br><br><b>____</b></td>
                   <td style="border: 1px solid #000; padding: 4px; text-align: center; width: 34%; font-size:14px;">Nota:<br><br><b>____</b></td>
                 </tr>
               </table>
            </td>
          </tr>
        </table>
        <hr style="border: 1px solid #ccc; margin-bottom: 20px;" />
      `;

      const htmlHeader = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Evaluacion</title><style>body { font-family: 'Calibri', 'Arial', sans-serif; } table { border-collapse: collapse; width: 100%; margin-top: 10px; margin-bottom: 20px; } th, td { border: 1px solid #000; padding: 8px; text-align: left; } th { background-color: #f3f4f6; font-weight: bold; } h1, h2, h3 { color: #111827; } p { line-height: 1.5; }</style></head><body>";
      const htmlFooter = "</body></html>";
      const sourceHTML = htmlHeader + professionalHeader + instruccionesForm + htmlFooter;

      const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
      const fileDownload = document.createElement("a");
      document.body.appendChild(fileDownload);
      fileDownload.href = source;
      fileDownload.download = `${tituloForm || 'Evaluacion_ConectaEduc'}.doc`;
      fileDownload.click();
      document.body.removeChild(fileDownload);

      toast.success('¡Documento Word generado exitosamente!', { id: toastId });
    } catch (error) {
      console.error('Error al exportar a word:', error);
      toast.error('Error al exportar el documento.', { id: toastId });
    }
  };

  // --- FUNCIÓN QUE SE CONECTA A GROQ IA (ENTREVISTA INTELIGENTE MEJORADA) ---
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
    const toastId = toast.loading('IA diseñando el instrumento evaluativo...');

    try {
      const asignaturaSel = misAsignaturas.find(a => a.id.toString() === selectedAsignaturaId);
      const contextoCurso = asignaturaSel ? `${asignaturaSel.cursos?.nombre} (${asignaturaSel.nombre})` : 'un curso';

      // Lógica de Prompting según el instrumento seleccionado
      let promptEspecifico = "";
      
      const paramCurricularesText = modoCreacion === 'evaluacion' 
        ? `Tipo de Evaluación: ${tipoEvaluacion}. Objetivo de Aprendizaje (OA): ${oaEvaluado || 'No especificado'}. Ponderación: ${porcentaje}%.` 
        : '';
        
      const instruccionPIE = iaAdaptacionPIE 
        ? `\nMUY IMPORTANTE: Aplica el Diseño Universal de Aprendizaje (DUA). Adapta la prueba para estudiantes con Necesidades Educativas Especiales (NEE). Simplifica el lenguaje, usa instrucciones de un solo paso, resalta con <b>negrita</b> los verbos de acción. REGLA ESTRICTA: Usa SOLO 3 alternativas (A, B y C) dispuestas SIEMPRE en formato vertical una debajo de otra.` 
        : '';

      if (tipoInstrumento.includes('Prueba')) {
        promptEspecifico = `Diseña una prueba escrita sobre el tema: "${iaTema}". 
        El curso es ${contextoCurso}.
        ${paramCurricularesText}
        Nivel de dificultad: ${iaDificultad}.
        
        REGLA DE CANTIDAD CRÍTICA: Debes generar EXACTAMENTE ${iaNumPreguntas} preguntas numeradas secuencialmente desde la 1 hasta la ${iaNumPreguntas}.
        Formato de preguntas: ${iaFormatoPregunta}.`;

        // --- NUEVA LÓGICA PARA COMPRENSIÓN LECTORA ---
        if (iaFormatoPregunta === 'Comprensión Lectora (Texto + Preguntas)') {
            promptEspecifico += `\nREGLA OBLIGATORIA DE LECTURA: PRIMERO, redacta un texto original (cuento, artículo, ensayo, etc.) adecuado para la edad y nivel del curso sobre el tema indicado. Ponle un título al texto. DESPUÉS del texto, genera las preguntas, las cuales deben responderse basándose EXCLUSIVAMENTE en la lectura de ese texto. Haz que la mayoría sean de alternativas.`;
        }

        promptEspecifico += `
        \nREGLAS DE FORMATO Y DISEÑO (¡EXTREMADAMENTE IMPORTANTE!):
        1. CERO MARKDOWN: No uses asteriscos (**) para negritas, usa la etiqueta HTML <b> o <strong>. No uses el símbolo # para títulos, usa <h3>. No uses markdown para tablas (|---|---|).
        2. Títulos y Textos: Envuelve el título principal en <h2>. Si hay texto de lectura, envuelve sus párrafos en <p style='margin-bottom:15px; line-height:1.6;'>.
        3. ESTÁ PROHIBIDO usar tablas (<table>) para agrupar preguntas o alternativas.
        4. OBLIGATORIO - ALTERNATIVAS EN FORMATO VERTICAL CON <br>: Cada alternativa (A, B, C, D) DEBE ir en una línea separada. DEBES poner obligatoriamente un <br> o <br/> al final de cada alternativa. NUNCA escribas dos alternativas en la misma línea.
           Ejemplo EXACTO de formato:
           <p><b>1. ¿Pregunta de ejemplo?</b> <i>[Habilidad: Analizar]</i><br>
           A) Opción uno<br>
           B) Opción dos<br>
           C) Opción tres<br>
           D) Opción cuatro</p>
        5. Si la pregunta es de desarrollo, deja espacio visual para responder usando múltiples saltos de línea (<br><br><br><br>). 
        
        NUEVA REGLA MINEDUC: En la misma línea de la pregunta, incluye entre corchetes cursivos la habilidad cognitiva medida, por ejemplo: <i>[Habilidad: Analizar]</i>.
        ${instruccionPIE}
        
        No añadas encabezados de nombre/fecha, solo el título de la prueba, instrucciones generales y el contenido.`;
        
        if (iaIncluirRubrica) {
            promptEspecifico += `\nAl final de la prueba, agrega una etiqueta <hr> y diseña la PAUTA DE CORRECCIÓN. Es OBLIGATORIO construir la pauta usando etiquetas HTML de tabla reales (<table>, <tr>, <th>, <td>). NUNCA uses formato de tabla markdown separando por "|".`;
        }
      } else if (tipoInstrumento === 'Rúbrica Analítica') {
        promptEspecifico = `Diseña una matriz de rúbrica analítica MUY detallada sobre el tema: "${iaTema}". 
        Curso: ${contextoCurso}. Dificultad: ${iaDificultad}.
        ${paramCurricularesText}
        Instrucciones de formato OBLIGATORIO basadas en el Decreto 67 del MINEDUC de Chile:
        1. Usa OBLIGATORIAMENTE una tabla HTML.
        2. La primera fila (cabecera) debe tener fondo azul (#4f81bd) y texto blanco.
        3. Las columnas deben ser EXACTAMENTE: "Aspectos a evaluar" | "Excelente (4 pts)" | "Bien (3 pts)" | "Suficiente (2 pts)" | "Regular (1 pt)" | "Sugerencias de Mejora (Retroalimentación)".
        4. La primera columna ("Aspectos a evaluar") también debe tener fondo azul (#4f81bd) y texto blanco.
        5. Genera 5 Criterios de Evaluación detallados en las filas.
        6. Deja la última columna ("Sugerencias de Mejora") vacía para que el profesor la llene a mano cumpliendo con la evaluación formativa.
        Completa el resto de las celdas con descripciones claras del nivel de desempeño.
        ${instruccionPIE}`;
      } else {
        promptEspecifico = `Crea una lista de cotejo (checklist) formativa en tabla HTML sobre el tema: "${iaTema}" para el curso ${contextoCurso}. 
        Dificultad: ${iaDificultad}. 
        ${paramCurricularesText}
        Columnas de la tabla: Indicador a observar | Logrado | Medianamente Logrado | Por Lograr | Comentarios de Retroalimentación.
        Genera entre 5 y 8 indicadores precisos.
        ${instruccionPIE}`;
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
              content: "Eres un experto en currículum escolar chileno. Devuelve OBLIGATORIAMENTE SÓLO código HTML limpio. ESTÁ ESTRICTAMENTE PROHIBIDO USAR MARKDOWN (sin **, sin #, sin tablas de texto con |). Aplica estilos CSS en línea básicos a las tablas reales de HTML (<table style='width:100%; border-collapse:collapse; margin-top:20px; margin-bottom:20px;' border='1'>, th y td con padding). IMPORTANTE: Usa las tablas SOLO para pautas de corrección o rúbricas. NUNCA uses tablas para listar las preguntas o las alternativas. No añadas explicaciones fuera del HTML."
            },
            {
              role: "user",
              content: promptEspecifico
            }
          ],
          temperature: 0.5,
          max_tokens: 4500 // <--- ¡CÁMBIALO AQUÍ A 4500!
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

  // --- GUARDADO EN SUPABASE ---
  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!tituloForm.trim() || !selectedAsignaturaId) return;

    setIsSaving(true);
    const toastId = toast.loading(`Creando ${modoCreacion === 'evaluacion' ? 'evaluación oficial' : 'tarea formativa'}...`);

    try {
      const asignaturaSeleccionada = misAsignaturas.find(a => a.id.toString() === selectedAsignaturaId);

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
        if (!fechaForm) {
          toast.error("La fecha de entrega es obligatoria", { id: toastId });
          setIsSaving(false); return;
        }
        const { error } = await supabase.from('tareas').insert([{
          titulo: tituloForm.trim(),
          descripcion: instruccionesForm.trim() || null,
          id_curso: asignaturaSeleccionada.id_curso,
          id_asignatura: parseInt(selectedAsignaturaId),
          rut_profesor: user.rut,
          fecha_entrega: fechaForm,
          estado: 'Activa'
        }]);
        if (error) throw error;
        toast.success('Tarea formativa publicada.', { id: toastId });
        setTimeout(() => navigate('/panel/profesor/tareas'), 1500);
      }
    } catch (error) {
      console.error(error);
      toast.error('Error al guardar.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileDrop = (e) => { e.preventDefault(); if (e.dataTransfer.files) setArchivos(prev => [...prev, ...Array.from(e.dataTransfer.files)]); };
  const handleFileChange = (e) => { if (e.target.files) setArchivos(prev => [...prev, ...Array.from(e.target.files)]); };
  const removeFile = (index) => setArchivos(prev => prev.filter((_, i) => i !== index));

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-gray-800 dark:text-white dark:border dark:border-gray-700' }} />

      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button onClick={() => navigate(-1)} className="group w-fit flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 transition-all mb-4">
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Volver
          </button>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Diseñador de Actividades</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Configura tareas formativas o diseña evaluaciones formales para el Libro de Clases.</p>
        </div>
      </div>

      <div className="max-w-4xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 sm:p-8 space-y-8">

        {/* INTERRUPTOR INTELIGENTE MEJORADO */}
        <div className="flex bg-gray-100 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700/50">
          <button
            type="button"
            onClick={() => setModoCreacion('evaluacion')}
            className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${modoCreacion === 'evaluacion' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            📋 Evaluación Oficial (Libro)
          </button>
          <button
            type="button"
            onClick={() => setModoCreacion('tarea')}
            className={`flex-1 py-3 px-4 text-sm font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${modoCreacion === 'tarea' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            📝 Tarea Formativa (Subida)
          </button>
        </div>

        <form onSubmit={handleGuardar} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{modoCreacion === 'evaluacion' ? 'Título de la Evaluación *' : 'Título de la Tarea *'}</label>
              <input required type="text" maxLength={60} placeholder={modoCreacion === 'evaluacion' ? "Ej: Prueba Coef 1: Geometría y Álgebra" : "Ej: Trabajo de Investigación: Revolución Industrial"} value={tituloForm} onChange={(e) => setTituloForm(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Asignatura y Curso *</label>
              <select required value={selectedAsignaturaId} onChange={(e) => setSelectedAsignaturaId(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 dark:text-white">
                {misAsignaturas.map(a => <option key={a.id} value={a.id}>{a.cursos?.nombre} - {a.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{modoCreacion === 'evaluacion' ? 'Fecha Programada' : 'Fecha Límite de Entrega *'}</label>
              <input type="date" required={modoCreacion === 'tarea'} value={fechaForm} onChange={(e) => setFechaForm(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 dark:text-white" />
            </div>
          </div>

          {modoCreacion === 'evaluacion' && (
            <div className="p-5 bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl space-y-5">
              <h3 className="font-bold text-indigo-800 dark:text-indigo-300 text-sm uppercase tracking-wide flex items-center gap-2">
                ⚙️ Parámetros Curriculares
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Semestre</label>
                  <select value={semestreForm} onChange={(e) => setSemestreForm(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm">
                    <option value="Primer Semestre">1º Semestre</option>
                    <option value="Segundo Semestre">2º Semestre</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tipo de Evaluación</label>
                  <select value={tipoEvaluacion} onChange={(e) => setTipoEvaluacion(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm">
                    <option value="Formativa">Formativa</option>
                    <option value="Sumativa">Sumativa</option>
                    <option value="Diagnóstica">Diagnóstica</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Instrumento a Usar</label>
                  <select value={tipoInstrumento} onChange={(e) => setTipoInstrumento(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm">
                    <option value="Prueba de Desarrollo">Prueba de Desarrollo</option>
                    <option value="Prueba de Selección Múltiple">Prueba Selección Múltiple</option>
                    <option value="Rúbrica Analítica">Rúbrica Analítica</option>
                    <option value="Lista de Cotejo">Lista de Cotejo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Ponderación (%)</label>
                  <input type="number" min="1" max="100" placeholder="Ej: 20" value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Objetivo de Apdz.</label>
                  <input type="text" placeholder="Ej: OA 04..." value={oaEvaluado} onChange={(e) => setOaEvaluado(e.target.value)} className="w-full p-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm" />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 border-b border-gray-200 dark:border-gray-700 pb-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Documento Adjunto e Instrucciones</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sube tu archivo de evaluación o genera uno automáticamente con IA.</p>
              </div>

              <div className="flex gap-2">
                {instruccionesForm && (
                  <button type="button" onClick={handleExportarWord} className="text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 px-4 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-1.5 shadow-sm">
                    📄 Descargar IA en Word
                  </button>
                )}
                <button type="button" onClick={() => setIsPromptModalOpen(true)} className="text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 px-4 py-2 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-1.5 shadow-sm">
                  ✨ Generar con IA
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contenedor Subir Archivo */}
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors h-[300px]">
                <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Subir archivo desde tu equipo</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">PDF, Word, Excel, etc. (Máx 5MB)</p>
                <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600">
                  Explorar Archivos
                </button>

                {archivos.length > 0 && (
                  <div className="w-full mt-4 flex flex-col gap-2 overflow-y-auto max-h-24 px-2">
                    {archivos.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2 rounded-md">
                        <span className="truncate max-w-[80%] text-gray-600 dark:text-gray-300">{file.name}</span>
                        <button type="button" onClick={() => removeFile(idx)} className="text-red-500 hover:text-red-700">✖</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Contenedor Texto / Previsualización IA */}
              <div className="flex flex-col h-[300px]">
                {instruccionesForm ? (
                  <div className="flex-1 flex flex-col border border-purple-200 dark:border-purple-800/50 rounded-2xl bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
                    <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2 border-b border-purple-100 dark:border-purple-800/50 flex justify-between items-center">
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-400">Vista Previa Generada por IA</span>
                      <button type="button" onClick={() => setInstruccionesForm('')} className="text-[10px] text-gray-500 hover:text-red-500 uppercase font-bold">Limpiar</button>
                    </div>
                    <div className="p-4 flex-1 overflow-y-auto text-sm text-gray-800 dark:text-gray-200 rich-text-preview custom-scrollbar">
                      <style>
                        {`
                          .rich-text-preview b, .rich-text-preview strong { font-weight: bold; }
                          .rich-text-preview i, .rich-text-preview em { font-style: italic; }
                          .rich-text-preview u { text-decoration: underline; }
                          .rich-text-preview ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
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
                    className="flex-1 w-full p-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-800 dark:text-white resize-none"
                    placeholder="Escribe instrucciones adicionales para los alumnos o genera una prueba con IA aquí..."
                    onChange={(e) => setInstruccionesForm(e.target.value)}
                  ></textarea>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
            <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm">Cancelar</button>
            <button type="submit" disabled={isSaving} className={`px-5 py-2.5 rounded-xl text-white font-bold shadow-md transition-colors flex items-center gap-2 text-sm ${modoCreacion === 'evaluacion' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
              {isSaving ? "Guardando..." : (modoCreacion === 'evaluacion' ? 'Publicar en Libro de Clases' : 'Publicar Tarea Formativa')}
            </button>
          </div>
        </form>
      </div>

      {/* MODAL IA */}
      {isPromptModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl p-6 border border-gray-200 dark:border-gray-700 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 p-2 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Asistente Pedagógico IA</h3>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 border-b border-gray-200 dark:border-gray-700 pb-4">
              Configuraremos automáticamente el documento (Prueba o Rúbrica) según tus necesidades para que puedas exportarlo a Word.
            </p>

            <form onSubmit={generarContenidoConIA} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Tema Principal de la Evaluación *</label>
                <input autoFocus required type="text" placeholder="Ej: La célula eucariota y procariota" value={iaTema} onChange={(e) => setIaTema(e.target.value)} className="w-full p-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 outline-none text-sm text-gray-800 dark:text-white" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Nivel de Exigencia</label>
                  <select value={iaDificultad} onChange={(e) => setIaDificultad(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none text-sm text-gray-800 dark:text-white">
                    <option value="Básica (Recordar y Comprender)">Básica (Recordar)</option>
                    <option value="Intermedia (Aplicar y Analizar)">Intermedia (Aplicar)</option>
                    <option value="Avanzada (Evaluar y Crear)">Avanzada (Crear)</option>
                  </select>
                </div>

                {tipoInstrumento.includes('Prueba') ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Cant. de Preguntas</label>
                      <input type="number" min="1" max="20" value={iaNumPreguntas} onChange={(e) => setIaNumPreguntas(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none text-sm text-gray-800 dark:text-white" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Formato de las Preguntas</label>
                      <select value={iaFormatoPregunta} onChange={(e) => setIaFormatoPregunta(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 outline-none text-sm text-gray-800 dark:text-white">
                        <option value="Mixta (Alternativas y Desarrollo)">Mixta (Alternativas y Desarrollo)</option>
                        <option value="Solo Alternativas (Múltiple opción)">Solo Selección Múltiple</option>
                        <option value="Solo Desarrollo (Preguntas Abiertas)">Solo Preguntas de Desarrollo</option>
                        {/* NUEVA OPCIÓN AÑADIDA AQUÍ ABAJO */}
                        <option value="Comprensión Lectora (Texto + Preguntas)">Comprensión Lectora (Texto + Preguntas)</option>
                      </select>
                    </div>

                    <div className="col-span-2 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg border border-purple-100 dark:border-purple-800/50 flex items-center justify-between cursor-pointer" onClick={() => setIaIncluirRubrica(!iaIncluirRubrica)}>
                      <div>
                        <h4 className="font-bold text-xs text-purple-800 dark:text-purple-300">Generar Pauta de Corrección</h4>
                        <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-0.5">Adjuntará una tabla con las respuestas o rúbrica al final.</p>
                      </div>
                      <div className="ml-4">
                        <div className={`w-10 h-5 rounded-full transition-colors flex items-center px-1 ${iaIncluirRubrica ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                          <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${iaIncluirRubrica ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <p className="text-xs text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/50">
                      💡 Al estar en modo <b>{tipoInstrumento}</b>, la IA construirá automáticamente una tabla matricial estandarizada (con cabecera azul) lista para exportar a Word.
                    </p>
                  </div>
                )}

                {/* NUEVO BOTÓN: ADAPTACIÓN DUA / PIE */}
                <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50 flex items-center justify-between cursor-pointer" onClick={() => setIaAdaptacionPIE(!iaAdaptacionPIE)}>
                  <div>
                    <h4 className="font-bold text-xs text-blue-800 dark:text-blue-300">Adaptación Curricular DUA (PIE)</h4>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-0.5">Simplifica el lenguaje, reduce alternativas y destaca palabras clave para alumnos con NEE.</p>
                  </div>
                  <div className="ml-4">
                    <div className={`w-10 h-5 rounded-full transition-colors flex items-center px-1 ${iaAdaptacionPIE ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${iaAdaptacionPIE ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => setIsPromptModalOpen(false)} className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancelar</button>
                <button type="submit" disabled={isGenerating || !iaTema.trim()} className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50">
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