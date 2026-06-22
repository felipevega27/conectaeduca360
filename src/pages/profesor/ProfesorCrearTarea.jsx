import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function ProfesorCrearTarea() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Datos desde Supabase
  const [asignaturasProfesor, setAsignaturasProfesor] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Estados del Formulario
  const [tituloForm, setTituloForm] = useState('');
  const [instruccionesForm, setInstruccionesForm] = useState('');
  const [idAsignaturaForm, setIdAsignaturaForm] = useState('');
  const [fechaEntregaForm, setFechaEntregaForm] = useState('');
  
  const [archivos, setArchivos] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);

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

  const handleLink = () => {
    const url = prompt('Introduce la URL del enlace (ej: https://...):');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const cargarAsignaturas = async (rutProfesor) => {
    try {
      const { data } = await supabase
        .from('asignaturas')
        .select('id, nombre, id_curso, cursos(nombre)')
        .eq('rut_profesor', rutProfesor);
      
      if (data) setAsignaturasProfesor(data);
    } catch (error) {
      console.error('Error cargando asignaturas:', error);
    }
  };

  const handleCrearTarea = async (e) => {
    e.preventDefault();
    if (!tituloForm || !idAsignaturaForm || !fechaEntregaForm) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Publicando tarea...');

    const asignaturaSel = asignaturasProfesor.find(a => a.id.toString() === idAsignaturaForm);
    if (!asignaturaSel) {
      toast.error('Error al identificar la asignatura', { id: toastId });
      setIsSaving(false);
      return;
    }

    try {
      const { error } = await supabase.from('tareas').insert([{
        titulo: tituloForm,
        descripcion: instruccionesForm,
        id_curso: asignaturaSel.id_curso,
        id_asignatura: asignaturaSel.id,
        rut_profesor: user.rut,
        fecha_entrega: fechaEntregaForm,
        estado: 'Activa'
      }]);

      if (error) throw error;

      toast.success('Tarea creada exitosamente.', { id: toastId });
      
      // Volver a la lista de tareas tras 1 segundo
      setTimeout(() => {
        navigate('/panel/profesor/tareas');
      }, 1000);

    } catch (error) {
      console.error('Error al crear tarea:', error);
      toast.error('No se pudo publicar la tarea.', { id: toastId });
      setIsSaving(false);
    }
  };

  const handleGenerateAI = () => {
    setIsGenerating(true);
    setTimeout(() => {
      if (!tituloForm) setTituloForm('Análisis Crítico: Impacto Ambiental');
      setInstruccionesForm('Por favor, investigue y redacte un ensayo de al menos 500 palabras analizando el impacto ambiental en nuestra región.<br><br><b>Criterios de Evaluación:</b><ul><li>Profundidad del análisis (40%)</li><li>Uso de fuentes confiables (30%)</li><li>Ortografía y redacción (30%)</li></ul><br><i>Nota: Recuerde adjuntar imágenes si es necesario.</i>');
      setIsGenerating(false);
      toast.success('Instrucciones generadas por ConectaEdu IA');
    }, 1500);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files);
      setArchivos(prev => [...prev, ...newFiles]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setArchivos(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index) => {
    setArchivos(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-gray-800 dark:text-white dark:border dark:border-gray-700' }} />
      
      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate('/panel/profesor/tareas')}
            className="group w-fit flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 transition-all mb-4"
          >
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Volver a Tareas
          </button>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight flex items-center gap-3">
            Crear Nueva Tarea
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Complete los detalles para asignar una nueva actividad a sus estudiantes.</p>
        </div>
        
        {/* Botón IA */}
        <button 
          type="button"
          onClick={handleGenerateAI}
          disabled={isGenerating}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all transform hover:-translate-y-0.5 ${isGenerating ? 'bg-purple-100 text-purple-400 shadow-purple-500/10' : 'bg-purple-600 text-white shadow-purple-600/30 hover:bg-purple-700'}`}
        >
          {isGenerating ? (
            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          )}
          {isGenerating ? 'Generando...' : 'Autocompletar con IA'}
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="max-w-4xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <form onSubmit={handleCrearTarea} className="p-8 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Título de la Tarea</label>
              <input 
                value={tituloForm}
                onChange={(e) => setTituloForm(e.target.value)}
                type="text" required placeholder="Ej: Mapa conceptual Unidad 1" 
                className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-gray-800 dark:text-white transition-all font-medium" 
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Curso y Asignatura</label>
              <select 
                value={idAsignaturaForm}
                onChange={(e) => setIdAsignaturaForm(e.target.value)}
                required 
                className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-gray-800 dark:text-white transition-all font-medium cursor-pointer"
              >
                <option value="" disabled>Seleccione una asignatura...</option>
                {asignaturasProfesor.map(a => (
                  <option key={a.id} value={a.id}>{a.cursos?.nombre} - {a.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Fecha de Entrega</label>
              <input 
                value={fechaEntregaForm}
                onChange={(e) => setFechaEntregaForm(e.target.value)}
                type="date" required 
                className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none text-gray-800 dark:text-white transition-all font-medium" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Instrucciones</label>
            {/* Editor Simulado */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all bg-gray-50 dark:bg-gray-900/50">
              <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 p-2 flex gap-1">
                <button type="button" onClick={() => execCommand('bold')} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-serif font-bold w-10 h-10 flex items-center justify-center" title="Negrita">B</button>
                <button type="button" onClick={() => execCommand('italic')} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-serif italic w-10 h-10 flex items-center justify-center" title="Cursiva">I</button>
                <button type="button" onClick={() => execCommand('underline')} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 font-serif underline w-10 h-10 flex items-center justify-center" title="Subrayado">U</button>
                <div className="w-px bg-gray-300 dark:bg-gray-600 mx-2 my-1"></div>
                <button type="button" onClick={() => execCommand('insertUnorderedList')} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 w-10 h-10 flex items-center justify-center" title="Lista">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
                </button>
                <button type="button" onClick={handleLink} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 w-10 h-10 flex items-center justify-center" title="Enlace">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </button>
              </div>
              <style>
                {`
                  .rich-text-editor b, .rich-text-editor strong { font-weight: bold; }
                  .rich-text-editor i, .rich-text-editor em { font-style: italic; }
                  .rich-text-editor u { text-decoration: underline; }
                  .rich-text-editor ul { list-style-type: disc; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
                  .rich-text-editor a { color: #3b82f6; text-decoration: underline; }
                  .rich-text-editor[contenteditable]:empty:before {
                    content: attr(placeholder);
                    color: #9ca3af;
                    pointer-events: none;
                    display: block;
                  }
                `}
              </style>
              <div 
                ref={editorRef}
                contentEditable
                placeholder="Detalla lo que los estudiantes deben realizar..."
                onInput={(e) => setInstruccionesForm(e.currentTarget.innerHTML)}
                className="rich-text-editor w-full p-4 bg-transparent text-base focus:outline-none text-gray-800 dark:text-white min-h-[150px] overflow-y-auto"
              ></div>
            </div>
          </div>

          {/* Drag and Drop Archivos */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Material Adjunto</label>
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              <div className="w-16 h-16 bg-blue-50 dark:bg-gray-700 text-blue-500 dark:text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <p className="text-base font-bold text-gray-700 dark:text-gray-300">Haz clic o arrastra archivos aquí</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Soporta PDF, Word, Excel, PPT (Max 10MB)</p>
            </div>

            {/* Lista de archivos subidos */}
            {archivos.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {archivos.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                        <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                      </div>
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">{file.name}</span>
                    </div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(idx); }} className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-6 flex gap-4 border-t border-gray-200 dark:border-gray-700 mt-8 justify-end">
            <button type="button" onClick={() => navigate('/panel/profesor/tareas')} className="px-6 py-3 rounded-xl border border-gray-300 dark:border-gray-600 font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Cancelar
            </button>
            <button disabled={isSaving} type="submit" className={`px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-bold text-white shadow-lg shadow-blue-600/30 transition-all ${isSaving ? 'opacity-70 cursor-wait' : 'transform hover:-translate-y-0.5'}`}>
              {isSaving ? 'Publicando Tarea...' : 'Publicar Tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
