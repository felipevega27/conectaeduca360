import { useState, useEffect } from 'react';
import BackdropLoader from '../../components/BackdropLoader';
import { supabase } from '../../config/supabaseClient';

export default function AlumnoMateriales() {
  const [asignaturaActiva, setAsignaturaActiva] = useState('Todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [comentario, setComentario] = useState('');

  const [asignaturas, setAsignaturas] = useState(['Todas']);
  const [materiales, setMateriales] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON);
      cargarAulaVirtual(user.rut);
    }
  }, []);

  const cargarAulaVirtual = async (rutAlumno) => {
    setIsLoading(true);
    try {
      // 1. Obtener curso del alumno
      const { data: matricula } = await supabase
        .from('matriculas')
        .select('id_curso')
        .eq('rut_alumno', rutAlumno)
        .maybeSingle();

      if (!matricula) {
        setIsLoading(false);
        return;
      }

      // 2. Obtener tareas del curso
      const { data: tareasData } = await supabase
        .from('tareas')
        .select(`
          id, titulo, descripcion, fecha_entrega, archivo_url, estado,
          asignaturas(nombre)
        `)
        .eq('id_curso', matricula.id_curso);

      // 3. Obtener entregas del alumno
      const { data: entregasData } = await supabase
        .from('entregas_tareas')
        .select('id_tarea, fecha_entrega, nota')
        .eq('rut_alumno', rutAlumno);

      const entregasMap = {};
      entregasData?.forEach(e => {
        entregasMap[e.id_tarea] = e;
      });

      if (tareasData) {
        // Extraer asignaturas únicas
        const asigsSet = new Set(tareasData.map(t => t.asignaturas?.nombre).filter(Boolean));
        setAsignaturas(['Todas', ...Array.from(asigsSet)]);

        // Formatear Tareas
        const tareasFormateadas = tareasData.map(t => {
          const entregado = !!entregasMap[t.id];
          const fEntrega = new Date(t.fecha_entrega);
          return {
            id: t.id,
            asignatura: t.asignaturas?.nombre || 'General',
            titulo: t.titulo,
            descripcion: t.descripcion,
            vence: fEntrega.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }),
            estado: entregado ? 'Entregado' : 'Pendiente',
            archivo_url: t.archivo_url
          };
        });
        
        // Ordenar: pendientes primero, luego por fecha de vencimiento
        tareasFormateadas.sort((a, b) => {
          if (a.estado === 'Pendiente' && b.estado === 'Entregado') return -1;
          if (a.estado === 'Entregado' && b.estado === 'Pendiente') return 1;
          return 0;
        });

        setTareas(tareasFormateadas);

        // Formatear Materiales (Tareas que tengan archivo_url)
        const mats = tareasData
          .filter(t => t.archivo_url)
          .map(t => {
            const ext = t.archivo_url.split('.').pop().toUpperCase();
            let tipo = 'FILE';
            if (['PDF'].includes(ext)) tipo = 'PDF';
            else if (['PPT', 'PPTX'].includes(ext)) tipo = 'PPT';
            else if (['DOC', 'DOCX'].includes(ext)) tipo = 'DOC';
            else if (['JPG', 'PNG', 'JPEG'].includes(ext)) tipo = 'IMG';

            return {
              id: t.id,
              asignatura: t.asignaturas?.nombre || 'General',
              titulo: t.titulo,
              tipo: tipo,
              tamaño: '1.2 MB', // Simulado por ahora
              fecha: new Date(t.fecha_entrega).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }),
              archivo_url: t.archivo_url
            };
          });
        setMateriales(mats);
      }
    } catch (error) {
      console.error('Error cargando Aula Virtual:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrado de datos
  const materialesFiltrados = asignaturaActiva === 'Todas' ? materiales : materiales.filter(m => m.asignatura === asignaturaActiva);
  const tareasFiltradas = asignaturaActiva === 'Todas' ? tareas : tareas.filter(t => t.asignatura === asignaturaActiva);

  const abrirModalEntrega = (tarea) => {
    setTareaSeleccionada(tarea);
    setIsModalOpen(true);
  };

  const handleSubirTarea = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    
    try {
      const loggedUserJSON = localStorage.getItem('userLogged');
      const user = JSON.parse(loggedUserJSON);

      const { error } = await supabase
        .from('entregas_tareas')
        .insert({
          id_tarea: tareaSeleccionada.id,
          rut_alumno: user.rut,
          archivo_url: 'https://ejemplo.com/archivo.pdf', // Simulado
          comentario: comentario || null
        });

      if (error) throw error;
      
      alert('¡Tarea enviada con éxito al profesor!');
      setIsModalOpen(false);
      setComentario('');
      cargarAulaVirtual(user.rut); // Recargar
    } catch (err) {
      console.error(err);
      alert('Hubo un error al enviar la tarea.');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando Aula Virtual...</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      
      {/* CABECERA */}
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Aula Virtual</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Descarga apuntes y sube tus trabajos pendientes.</p>
        </div>
      </div>

      {/* FILTRO POR ASIGNATURA (PILLS) */}
      <div className="flex overflow-x-auto pb-4 mb-4 gap-2 custom-scrollbar hide-scrollbar">
        {asignaturas.map(asig => (
          <button
            key={asig}
            onClick={() => setAsignaturaActiva(asig)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${
              asignaturaActiva === asig 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {asig}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* COLUMNA 1: TAREAS Y ENTREGAS */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            Entregas Pendientes
          </h2>
          
          {tareasFiltradas.map((tarea) => (
            <div key={tarea.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                  {tarea.asignatura}
                </span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  tarea.estado === 'Pendiente' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                }`}>
                  {tarea.estado}
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-800 dark:text-white mt-1">{tarea.titulo}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">{tarea.descripcion}</p>
              
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Vence: {tarea.vence}
                </span>
                {tarea.estado === 'Pendiente' ? (
                  <button 
                    onClick={() => abrirModalEntrega(tarea)}
                    className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    Subir Trabajo
                  </button>
                ) : (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    Entregado
                  </span>
                )}
              </div>
            </div>
          ))}
          {tareasFiltradas.length === 0 && (
            <div className="text-center py-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl border-dashed">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No hay tareas para esta asignatura.</p>
            </div>
          )}
        </div>

        {/* COLUMNA 2: MATERIAL DE CLASES */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            Material de Estudio
          </h2>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {materialesFiltrados.map((item) => (
                <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                  {/* Ícono dinámico según el tipo de archivo */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    item.tipo === 'PDF' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                    item.tipo === 'PPT' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 
                    item.tipo === 'DOC' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30' :
                    item.tipo === 'IMG' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' :
                    'bg-gray-100 text-gray-600 dark:bg-gray-900/30'
                  }`}>
                    <span className="text-[10px] font-black">{item.tipo}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{item.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span>{item.asignatura}</span>
                      <span>•</span>
                      <span>Subido el {item.fecha}</span>
                    </div>
                  </div>

                  <a 
                    href={item.archivo_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </a>
                </div>
              ))}
              {materialesFiltrados.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No hay materiales subidos para esta asignatura.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* --- MODAL PARA SUBIR TAREA --- */}
      {isModalOpen && tareaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up border border-gray-200 dark:border-gray-700 relative">
            {isUploading && <BackdropLoader mensaje="Enviando tarea..." />}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Entregar Trabajo
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSubirTarea} className="p-6 space-y-5">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800/50">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{tareaSeleccionada.asignatura}</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">{tareaSeleccionada.titulo}</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Archivo a entregar</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Haz clic para buscar tu archivo</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Soporta Word, PDF, Excel o Imágenes</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Comentario para el profesor (Opcional)</label>
                <textarea 
                  rows="2" 
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                  placeholder="Ej: Profesor, le envío el trabajo finalizado."
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isUploading}
                  className="flex-1 py-2.5 rounded-xl font-bold text-white shadow-lg transition-colors flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 disabled:bg-blue-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  Enviar Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}