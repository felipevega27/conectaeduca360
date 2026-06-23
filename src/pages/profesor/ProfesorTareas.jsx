import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function ProfesorTareas() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const [cursoFiltro, setCursoFiltro] = useState('Todos');

  // Estados para Modal Detalles
  const [isDetallesOpen, setIsDetallesOpen] = useState(false);
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null);
  const [alumnosTarea, setAlumnosTarea] = useState([]); // Reemplaza a mockAlumnos
  const [isLoadingDetalles, setIsLoadingDetalles] = useState(false);

  // Datos desde Supabase
  const [asignaturasProfesor, setAsignaturasProfesor] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
      // 🚀 Consulta anidada: Trae la tarea, el nombre del curso, los matriculados (para el total) y las entregas
      const { data, error } = await supabase
        .from('tareas')
        .select(`
          id, titulo, descripcion, fecha_entrega, estado, id_curso,
          cursos(nombre, matriculas(rut_alumno)),
          asignaturas(nombre),
          entregas_tareas(id)
        `)
        .eq('rut_profesor', rutProfesor)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const tareasMapeadas = data.map(t => ({
          id: t.id,
          titulo: t.titulo,
          id_curso: t.id_curso,
          curso: t.cursos?.nombre || 'Sin curso',
          asignatura: t.asignaturas?.nombre || 'Sin asignatura',
          fechaEntrega: t.fecha_entrega,
          // Calculamos el progreso real contando los arreglos
          entregas: t.entregas_tareas ? t.entregas_tareas.length : 0,
          total: t.cursos?.matriculas ? t.cursos.matriculas.length : 0,
          estado: t.estado,
          descripcion: t.descripcion
        }));
        setTareas(tareasMapeadas);
      }
    } catch (error) {
      console.error('Error cargando tareas:', error);
      toast.error('Error al cargar las tareas');
    } finally {
      setIsLoading(false);
    }
  };

  // --- NUEVA FUNCIÓN: CARGAR DETALLES REALES AL ABRIR EL MODAL ---
  const abrirDetalles = async (tarea) => {
    setTareaSeleccionada(tarea);
    setIsDetallesOpen(true);
    setIsLoadingDetalles(true);

    try {
      // 1. Obtener todos los alumnos matriculados en el curso de esta tarea
      const { data: matriculasData } = await supabase
        .from('matriculas')
        .select('rut_alumno, perfiles(nombre)')
        .eq('id_curso', tarea.id_curso);

      // 2. Obtener todas las entregas que se han hecho para esta tarea específica
      const { data: entregasData } = await supabase
        .from('entregas_tareas')
        .select('*')
        .eq('id_tarea', tarea.id);

      const hoy = new Date();
      const fechaLimite = new Date(tarea.fechaEntrega + 'T23:59:59');

      // 3. Cruzar los datos: Ver quién entregó y quién falta
      const listaFormateada = (matriculasData || []).map(m => {
        const entrega = (entregasData || []).find(e => e.rut_alumno === m.rut_alumno);
        let estadoStr = 'Pendiente';

        if (entrega) {
          estadoStr = 'Entregado';
        } else if (hoy > fechaLimite) {
          estadoStr = 'Atrasado'; // Si no hay entrega y ya pasó la fecha
        }

        return {
          id: m.rut_alumno,
          nombre: m.perfiles?.nombre || 'Alumno Desconocido',
          estado: estadoStr,
          nota: entrega?.nota || null,
          fecha: entrega ? new Date(entrega.fecha_entrega).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null,
          comentario: entrega?.comentario || null,
          archivo_url: entrega?.archivo_url || null
        };
      });

      // Ordenar lista alfabéticamente
      listaFormateada.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setAlumnosTarea(listaFormateada);

    } catch (error) {
      console.error('Error cargando detalles:', error);
      toast.error('No se pudieron cargar los detalles de los alumnos.');
    } finally {
      setIsLoadingDetalles(false);
    }
  };

  const tareasFiltradas = cursoFiltro === 'Todos' ? tareas : tareas.filter(t => t.curso === cursoFiltro);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-gray-800 dark:text-white dark:border dark:border-gray-700' }} />

      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Gestión de Tareas</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Administre las asignaciones, adjunte recursos y revise el progreso de sus estudiantes.</p>
        </div>
        <button
          onClick={() => navigate('/panel/profesor/tareas/nueva')}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-600/30 transform hover:-translate-y-0.5"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Crear Nueva Tarea
        </button>
      </div>

      {/* FILTROS Y CONTENIDO */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">

        {/* Barra de Filtros */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row items-center gap-4 overflow-x-auto">
          <span className="text-sm font-bold text-gray-500 dark:text-gray-400 shrink-0">Filtrar por curso:</span>
          <div className="flex flex-wrap gap-2">
            {misCursos.map(curso => (
              <button
                key={curso}
                onClick={() => setCursoFiltro(curso)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${cursoFiltro === curso
                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500 dark:ring-blue-400'
                    : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
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
            <div className="col-span-full py-12 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : tareasFiltradas.length === 0 ? (
            <div className="col-span-full py-16 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">No hay tareas</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Aún no has creado tareas o no hay resultados para el filtro actual.</p>
            </div>
          ) : tareasFiltradas.map(tarea => {
            const porcentaje = tarea.total > 0 ? Math.round((tarea.entregas / tarea.total) * 100) : 0;
            return (
              <div key={tarea.id} className="group relative border border-gray-200 dark:border-gray-700 rounded-2xl p-6 hover:shadow-xl hover:shadow-blue-500/5 dark:hover:shadow-blue-500/10 transition-all duration-300 bg-white dark:bg-gray-800 flex flex-col h-full transform hover:-translate-y-1 overflow-hidden">

                {/* Barra decorativa superior */}
                <div className={`absolute top-0 left-0 w-full h-1.5 ${tarea.estado === 'Activa' ? 'bg-green-500' : 'bg-gray-400'}`}></div>

                <div className="flex justify-between items-start mb-4 mt-1">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${tarea.estado === 'Activa' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/50' :
                      tarea.estado === 'Cerrada' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600' :
                        'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50'
                    }`}>
                    {tarea.estado}
                  </span>

                  {/* Progress Indicator Mini */}
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400" title={`${tarea.entregas} de ${tarea.total} entregas`}>
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {porcentaje}%
                  </div>
                </div>

                <h3 className="font-extrabold text-gray-900 dark:text-white text-lg leading-tight mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{tarea.titulo}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-6 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  {tarea.curso} • {tarea.asignatura}
                </p>

                <div className="mt-auto space-y-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700/50">
                    <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Vence: <span className="font-bold">{formatDate(tarea.fechaEntrega)}</span>
                  </div>

                  <button
                    onClick={() => abrirDetalles(tarea)}
                    className="w-full py-2.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-sm font-bold rounded-xl transition-colors border border-blue-200 dark:border-blue-800/50 flex justify-center items-center gap-2"
                  >
                    Revisar Detalles
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL DETALLES DE TAREA */}
      {isDetallesOpen && tareaSeleccionada && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsDetallesOpen(false)}></div>

          <div className="relative z-[70] w-full max-w-md bg-white dark:bg-gray-800 h-full shadow-2xl flex flex-col animate-[fadeInRight_0.3s_ease-out] border-l border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <h2 className="text-lg font-extrabold text-gray-800 dark:text-white">Detalles de Tarea</h2>
              <button onClick={() => setIsDetallesOpen(false)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{tareaSeleccionada.titulo}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{tareaSeleccionada.curso} • {tareaSeleccionada.asignatura}</p>
              </div>

              {/* Stats Rápidas */}
              <div className="flex items-center gap-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30">
                <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-blue-200 dark:text-blue-900/50" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="text-blue-600 dark:text-blue-400" strokeDasharray={`${tareaSeleccionada.total > 0 ? Math.round((tareaSeleccionada.entregas / tareaSeleccionada.total) * 100) : 0}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                      {tareaSeleccionada.total > 0 ? Math.round((tareaSeleccionada.entregas / tareaSeleccionada.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{tareaSeleccionada.entregas} <span className="text-sm text-gray-500 font-medium">/ {tareaSeleccionada.total}</span></p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Entregas recibidas</p>
                </div>
              </div>

              {/* Lista de Alumnos Real */}
              <div>
                <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-3 uppercase tracking-wider">Estado de Alumnos</h4>

                {isLoadingDetalles ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alumnosTarea.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No hay alumnos matriculados en este curso.</p>
                    ) : (
                      alumnosTarea.map(al => (
                        <div key={al.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 uppercase shrink-0">
                              {al.nombre.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-tight">{al.nombre}</p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{al.fecha || 'Sin entrega registrada'}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${al.estado === 'Entregado' ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400' :
                                al.estado === 'Atrasado' ? 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400' :
                                  'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400'
                              }`}>
                              {al.estado}
                            </span>
                            {al.nota && <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-1">Nota: {al.nota}</p>}
                            {!al.nota && al.estado === 'Entregado' && <button className="text-[11px] font-bold text-blue-600 hover:underline mt-1 block w-full text-right">Calificar</button>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <button disabled={alumnosTarea.length === 0} className="w-full py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                Descargar Reporte Excel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}