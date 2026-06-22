import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';

export default function ProfesorTareas() {
  const [user, setUser] = useState(null);
  
  const [cursoFiltro, setCursoFiltro] = useState('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Datos desde Supabase
  const [asignaturasProfesor, setAsignaturasProfesor] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Filtros dinámicos (Nombres de cursos únicos)
  const misCursos = ['Todos', ...new Set(asignaturasProfesor.map(a => a.cursos?.nombre).filter(Boolean))];

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      cargarAsignaturas(parsedUser.rut);
      cargarTareas(parsedUser.rut);
    }
  }, []);

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

  const cargarTareas = async (rutProfesor) => {
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('tareas')
        .select('id, titulo, descripcion, fecha_entrega, estado, cursos(nombre), asignaturas(nombre)')
        .eq('rut_profesor', rutProfesor)
        .order('created_at', { ascending: false });

      if (data) {
        // En un futuro, cruzaremos con 'entregas_tareas' para sacar 'entregas' y 'total'. Por ahora simulamos los contadores.
        const tareasMapeadas = data.map(t => ({
          id: t.id,
          titulo: t.titulo,
          curso: t.cursos?.nombre || 'Sin curso',
          asignatura: t.asignaturas?.nombre || 'Sin asignatura',
          fechaEntrega: t.fecha_entrega,
          entregas: 0,
          total: 0, // No tenemos total de alumnos directo aquí, pero está la métrica
          estado: t.estado,
          descripcion: t.descripcion
        }));
        setTareas(tareasMapeadas);
      }
    } catch (error) {
      console.error('Error cargando tareas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const tareasFiltradas = cursoFiltro === 'Todos' ? tareas : tareas.filter(t => t.curso === cursoFiltro);

  const handleCrearTarea = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const toastId = toast.loading('Publicando tarea...');

    const formData = new FormData(e.target);
    const titulo = formData.get('titulo');
    const idAsignatura = formData.get('idAsignatura'); // Es el ID de la asignatura seleccionada
    const fechaEntrega = formData.get('fechaEntrega');
    const instrucciones = formData.get('instrucciones');

    const asignaturaSel = asignaturasProfesor.find(a => a.id.toString() === idAsignatura);
    if (!asignaturaSel) {
      toast.error('Error al identificar la asignatura', { id: toastId });
      setIsSaving(false);
      return;
    }

    try {
      const { error } = await supabase.from('tareas').insert([{
        titulo: titulo,
        descripcion: instrucciones,
        id_curso: asignaturaSel.id_curso,
        id_asignatura: asignaturaSel.id,
        rut_profesor: user.rut,
        fecha_entrega: fechaEntrega,
        estado: 'Activa'
      }]);

      if (error) throw error;

      toast.success('Tarea creada y publicada exitosamente.', { id: toastId });
      setIsModalOpen(false);
      cargarTareas(user.rut); // Recargar la vista

    } catch (error) {
      console.error('Error al crear tarea:', error);
      toast.error('No se pudo publicar la tarea.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00'); // Evita timezone offset issues
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-gray-800 dark:text-white dark:border dark:border-gray-700' }} />
      
      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Gestión de Tareas</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Administre las asignaciones y revise el progreso de sus estudiantes.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nueva Tarea
        </button>
      </div>

      {/* FILTROS Y CONTENIDO */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        
        {/* Barra de Filtros */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex flex-col sm:flex-row items-center gap-4 overflow-x-auto">
          <span className="text-sm font-bold text-gray-600 dark:text-gray-300 shrink-0">Filtrar por curso:</span>
          <div className="flex flex-wrap gap-2">
            {misCursos.map(curso => (
              <button 
                key={curso}
                onClick={() => setCursoFiltro(curso)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  cursoFiltro === curso 
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800' 
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                }`}
              >
                {curso}
              </button>
            ))}
          </div>
        </div>

        {/* Cuadrícula de Tareas */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full py-10 text-center text-gray-500">Cargando tareas...</div>
          ) : tareasFiltradas.length === 0 ? (
            <div className="col-span-full py-10 text-center text-gray-500">No tienes tareas asignadas para este filtro.</div>
          ) : tareasFiltradas.map(tarea => (
            <div key={tarea.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md transition-shadow bg-white dark:bg-gray-800 flex flex-col h-full">
              
              <div className="flex justify-between items-start mb-3">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  tarea.estado === 'Activa' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50' :
                  tarea.estado === 'Cerrada' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600' :
                  'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50'
                }`}>
                  {tarea.estado}
                </span>
                <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                </button>
              </div>

              <h3 className="font-bold text-gray-800 dark:text-white text-lg leading-tight mb-1">{tarea.titulo}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-4">{tarea.curso} • {tarea.asignatura}</p>

              <div className="mt-auto space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Vence: <span className="font-semibold">{formatDate(tarea.fechaEntrega)}</span>
                </div>

                {/* Botón */}
                <button className="w-full py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-lg transition-colors border border-blue-100 dark:border-blue-800/50">
                  Revisar Detalles
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* VENTANA MODAL (CREAR TAREA) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center px-4 sm:px-0">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          
          <div className="relative z-70 w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                Asignar Nueva Tarea
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleCrearTarea} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Título de la Tarea</label>
                <input name="titulo" type="text" required placeholder="Ej: Mapa conceptual Unidad 1" className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-900/50 text-sm focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Curso y Asignatura</label>
                  <select name="idAsignatura" required className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-900/50 text-sm focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white">
                    {asignaturasProfesor.length === 0 && <option value="">Sin Asignaturas</option>}
                    {asignaturasProfesor.map(a => (
                      <option key={a.id} value={a.id}>{a.cursos?.nombre} - {a.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Fecha de Entrega</label>
                  <input name="fechaEntrega" type="date" required className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-900/50 text-sm focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Instrucciones</label>
                <textarea name="instrucciones" rows="3" placeholder="Detalla lo que los estudiantes deben realizar..." className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-900/50 text-sm focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white"></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button disabled={isSaving} type="submit" className={`flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-white shadow-lg shadow-blue-600/20 transition-colors ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>
                  {isSaving ? 'Publicando...' : 'Publicar Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}