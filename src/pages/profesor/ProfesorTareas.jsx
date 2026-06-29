import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import BackdropLoader from '../../components/BackdropLoader';
import { SkeletonCard } from '../../components/SkeletonLoader';
import { perteneceAlSemestre } from '../../utils/dateUtils';

export default function ProfesorTareas() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const [cursoFiltro, setCursoFiltro] = useState('Todos');
  const [semestreActivo, setSemestreActivo] = useState('Primer Semestre');

  // Estados para Modal "Sala de Corrección"
  const [isDetallesOpen, setIsDetallesOpen] = useState(false);
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null);
  const [alumnosTarea, setAlumnosTarea] = useState([]);
  const [isLoadingDetalles, setIsLoadingDetalles] = useState(false);

  // NUEVO: Alumno seleccionado activamente dentro de la sala de revisión
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);

  // Estados para Calificación
  const [notaInput, setNotaInput] = useState('');
  const [isSavingNota, setIsSavingNota] = useState(false);
  const [isPublishingNotes, setIsPublishingNotes] = useState(false);

  // Datos desde Supabase
  const [asignaturasProfesor, setAsignaturasProfesor] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros dinámicos: Solo los cursos del profesor, únicos y ordenados alfabéticamente
  const misCursos = ['Todos', ...Array.from(new Set(asignaturasProfesor.map(a => a.cursos?.nombre).filter(Boolean))).sort()];

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      cargarAsignaturas(parsedUser.rut);
      cargarTareas(parsedUser.rut);
    }
  }, [semestreActivo]);

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
        const tareasFiltradas = data.filter(t => perteneceAlSemestre(t.fecha_entrega, semestreActivo));

        const tareasMapeadas = tareasFiltradas.map(t => ({
          id: t.id,
          titulo: t.titulo,
          id_curso: t.id_curso,
          curso: t.cursos?.nombre || 'Sin curso',
          asignatura: t.asignaturas?.nombre || 'Sin asignatura',
          fechaEntrega: t.fecha_entrega,
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

  const abrirDetalles = async (tarea) => {
    setTareaSeleccionada(tarea);
    setIsDetallesOpen(true);
    setIsLoadingDetalles(true);
    setAlumnoSeleccionado(null);

    try {
      const { data: matriculasData } = await supabase
        .from('matriculas')
        .select('rut_alumno')
        .eq('id_curso', tarea.id_curso);

      if (!matriculasData || matriculasData.length === 0) {
        setAlumnosTarea([]);
        setIsLoadingDetalles(false);
        return;
      }

      const ruts = matriculasData.map(m => m.rut_alumno);
      
      const [perfilesRes, entregasRes] = await Promise.all([
        supabase.from('perfiles').select('rut, nombre, avatar_url').in('rut', ruts),
        supabase.from('entregas_tareas').select('*').eq('id_tarea', tarea.id)
      ]);

      const perfiles = perfilesRes.data;
      const entregasData = entregasRes.data;

      const hoy = new Date();
      const fechaLimite = new Date(tarea.fechaEntrega + 'T23:59:59');

      const listaFormateada = matriculasData.map(m => {
        const perfil = perfiles?.find(p => p.rut === m.rut_alumno);
        const entrega = (entregasData || []).find(e => e.rut_alumno === m.rut_alumno);
        let estadoStr = 'Pendiente';

        if (entrega) {
          estadoStr = 'Entregado';
        } else if (hoy > fechaLimite) {
          estadoStr = 'Atrasado';
        }

        return {
          id: m.rut_alumno,
          nombre: perfil?.nombre || 'Alumno Desconocido',
          avatar_url: perfil?.avatar_url || null,
          estado: estadoStr,
          nota: entrega?.nota || null,
          fecha: entrega ? new Date(entrega.fecha_entrega).toLocaleString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null,
          comentario: entrega?.comentario || null,
          archivo_url: entrega?.archivo_url || null
        };
      });

      listaFormateada.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setAlumnosTarea(listaFormateada);

      // Seleccionar automáticamente al primer alumno para agilizar el flujo
      if (listaFormateada.length > 0) {
        setAlumnoSeleccionado(listaFormateada[0]);
        setNotaInput(listaFormateada[0].nota ? listaFormateada[0].nota.toString() : '');
      }

    } catch (error) {
      console.error('Error cargando detalles:', error);
      toast.error('No se pudieron cargar los detalles.');
    } finally {
      setIsLoadingDetalles(false);
    }
  };

  const handleSeleccionarAlumno = (alumno) => {
    setAlumnoSeleccionado(alumno);
    setNotaInput(alumno.nota ? alumno.nota.toString() : '');
  };

  const handleGuardarNota = async () => {
    if (!alumnoSeleccionado) return;
    const notaFloat = parseFloat(notaInput);

    if (isNaN(notaFloat) || notaFloat < 0) {
      toast.error("Ingrese una nota o número de décimas válido.");
      return;
    }

    setIsSavingNota(true);
    const toastId = toast.loading('Guardando en el servidor...');

    try {
      const { error } = await supabase
        .from('entregas_tareas')
        .update({ nota: notaFloat })
        .eq('id_tarea', tareaSeleccionada.id)
        .eq('rut_alumno', alumnoSeleccionado.id);

      if (error) throw error;

      toast.success('Calificación guardada correctamente', { id: toastId });

      // Actualizar localmente la lista completa y el alumno activo
      const alumnoActualizado = { ...alumnoSeleccionado, nota: notaFloat };
      setAlumnosTarea(prev => prev.map(a => a.id === alumnoSeleccionado.id ? alumnoActualizado : a));
      setAlumnoSeleccionado(alumnoActualizado);

    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar.', { id: toastId });
    } finally {
      setIsSavingNota(false);
    }
  };

  const publicarNotasLibro = async () => {
    if (!tareaSeleccionada) return;

    // Solo publicar si hay notas ingresadas (alumnosTarea tienen nota no nula)
    const entregasConNota = alumnosTarea.filter(a => a.nota !== null && a.nota !== undefined);
    
    if (entregasConNota.length === 0) {
      toast.error('No hay notas calificadas para publicar.');
      return;
    }

    setIsPublishingNotes(true);
    const toastId = toast.loading('Publicando notas al Libro de Clases...');

    try {
      // 1. Crear la evaluación
      const { data: nuevaEvaluacion, error: errEval } = await supabase
        .from('evaluaciones')
        .insert([{
          id_asignatura: tareaSeleccionada.id_asignatura,
          nombre: `Tarea: ${tareaSeleccionada.titulo}`,
          fecha: new Date().toISOString().split('T')[0],
          tipo_instrumento: 'Tarea',
          porcentaje: 100, // Puede ser ajustable en el futuro
          semestre: semestreActivo
        }])
        .select()
        .single();

      if (errEval || !nuevaEvaluacion) throw errEval || new Error('No se pudo crear la evaluación');

      // 2. Preparar el payload masivo para la tabla de notas
      const notasPayload = entregasConNota.map(alumno => ({
        rut_alumno: alumno.id,
        id_asignatura: tareaSeleccionada.id_asignatura,
        nota: alumno.nota,
        tipo_evaluacion: 'Nota Parcial',
        fecha: new Date().toISOString().split('T')[0],
        id_evaluacion: nuevaEvaluacion.id
      }));

      // 3. Insertar notas
      const { error: errNotas } = await supabase
        .from('notas')
        .insert(notasPayload);

      if (errNotas) throw errNotas;

      toast.success(`Se publicaron ${notasPayload.length} notas exitosamente en el Libro de Clases.`, { id: toastId });

    } catch (error) {
      console.error('Error publicando notas:', error);
      toast.error('Error al publicar las notas.', { id: toastId });
    } finally {
      setIsPublishingNotes(false);
    }
  };

  const exportarExcel = () => {
    if (!alumnosTarea || alumnosTarea.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "RUT;Nombre Estudiante;Estado;Fecha Entrega;Valoracion\n";
    alumnosTarea.forEach(row => {
      csvContent += `"${row.id}";"${row.nombre}";"${row.estado}";"${row.fecha || 'No entregado'}";"${row.nota || 'Sin Evaluar'}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Reporte_Tarea_${tareaSeleccionada.titulo.replace(/ /g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tareasFiltradas = cursoFiltro === 'Todos' ? tareas : tareas.filter(t => t.curso === cursoFiltro);
  const formatDate = (dateStr) => { if (!dateStr) return ''; const d = new Date(dateStr + 'T12:00:00'); return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }); };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando tareas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 pb-10 px-4 sm:px-8 pt-0">
      <Toaster position="top-right" />

      {/* CABECERA */}
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Gestión de Tareas</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Administre las asignaciones, califique entregas y revise el progreso de sus estudiantes.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <select 
            className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={semestreActivo}
            onChange={(e) => setSemestreActivo(e.target.value)}
          >
            <option value="Primer Semestre">1º Semestre</option>
            <option value="Segundo Semestre">2º Semestre</option>
          </select>
          <button onClick={() => navigate('/panel/profesor/tareas/nueva')} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-600/30 transform hover:-translate-y-0.5">
            Crear Nueva Tarea
          </button>
        </div>
      </div>

      {/* PLANILLA PRINCIPAL */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row items-center gap-4 overflow-x-auto">
          <span className="text-sm font-bold text-gray-500 dark:text-gray-400 shrink-0">Filtrar por curso:</span>
          <div className="flex flex-wrap gap-2">
            {misCursos.map(curso => (
              <button key={curso} onClick={() => setCursoFiltro(curso)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${cursoFiltro === curso ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500' : 'bg-gray-50 dark:bg-gray-800/50 text-gray-600 hover:bg-gray-100'}`}>{curso}</button>
            ))}
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {isLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : tareasFiltradas.length === 0 ? (
            <div className="col-span-full py-16 text-center">No hay tareas creadas.</div>
          ) : (
            tareasFiltradas.map(tarea => {
              const porcentaje = tarea.total > 0 ? Math.round((tarea.entregas / tarea.total) * 100) : 0;
              return (
                <div key={tarea.id} className="group relative border border-gray-100 dark:border-gray-700/60 rounded-2xl p-6 bg-white dark:bg-gray-800/80 backdrop-blur-sm flex flex-col h-full shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="flex justify-between items-center mb-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${tarea.estado === 'Activa' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600'}`}>
                      {tarea.estado === 'Activa' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>}
                      {tarea.estado}
                    </span>
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{porcentaje}% Entregado</span>
                  </div>
                  <h3 className="font-extrabold text-gray-800 dark:text-white text-lg tracking-tight leading-tight mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{tarea.titulo}</h3>
                  <p className="text-xs text-gray-400 font-medium mb-5">{tarea.curso} <span className="mx-1 opacity-50">•</span> {tarea.asignatura}</p>
                  
                  <div className="mt-auto space-y-3">
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700/50">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      <span>Vence: <b className="text-gray-700 dark:text-gray-300 ml-1">{formatDate(tarea.fechaEntrega)}</b></span>
                    </div>
                    <button onClick={() => abrirDetalles(tarea)} className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2">
                      Revisar Entregas
                      <span className="bg-white/20 px-2 py-0.5 rounded-md text-xs">{tarea.entregas}/{tarea.total}</span>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ======================================================= */}
      {isDetallesOpen && tareaSeleccionada && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-gray-900/50 transition-opacity"
          onClick={() => setIsDetallesOpen(false)}
        >
          <div 
            className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden animate-fade-in border border-gray-200 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Encabezado Superior */}
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-900">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{tareaSeleccionada.titulo}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">{tareaSeleccionada.curso} <span className="mx-1.5 opacity-50">•</span> {tareaSeleccionada.asignatura}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                
                {/* Botón Publicar Notas */}
                <button 
                  onClick={publicarNotasLibro}
                  disabled={isPublishingNotes}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {isPublishingNotes ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  )}
                  Publicar Notas
                </button>

                {/* Botón Exportar */}
                <button 
                  onClick={exportarExcel} 
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-bold transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Exportar
                </button>

                {/* Botón Cerrar */}
                <button 
                  onClick={() => setIsDetallesOpen(false)} 
                  className="p-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl text-gray-500 dark:text-gray-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                
              </div>
            </div>

            {/* Modal Body Container con relative para el BackdropLoader */}
            <div className="flex-1 flex overflow-hidden relative">
              {isLoadingDetalles && (
                <BackdropLoader mensaje="Cargando entregas..." />
              )}
                {/* PANEL IZQUIERDO (30%): Lista de Alumnos */}
                <div className="w-[35%] lg:w-[30%] border-r border-gray-100 dark:border-gray-800 overflow-y-auto bg-white dark:bg-gray-900 custom-scrollbar py-4 px-2">
                  {alumnosTarea.map(al => {
                    const esActivo = alumnoSeleccionado?.id === al.id;
                    return (
                      <div
                        key={al.id}
                        onClick={() => handleSeleccionarAlumno(al)}
                        className={`mx-2 my-1.5 p-3 flex items-center justify-between cursor-pointer transition-colors rounded-2xl border ${esActivo ? 'bg-white dark:bg-gray-800 border-indigo-100 dark:border-indigo-900/50 shadow-sm' : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
                      >
                        <div className="flex items-center gap-3 truncate max-w-[80%]">
                          <div className={`relative flex items-center justify-center w-10 h-10 rounded-full shrink-0 overflow-hidden ${al.estado === 'Entregado' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : al.estado === 'Atrasado' ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                            {al.avatar_url ? (
                              <img src={al.avatar_url} alt={al.nombre} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-black">{al.nombre.charAt(0)}</span>
                            )}
                          </div>
                          <div className="truncate">
                            <p className={`text-sm font-bold truncate ${esActivo ? 'text-indigo-900 dark:text-indigo-400' : 'text-gray-800 dark:text-gray-200'}`}>{al.nombre}</p>
                            <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mt-0.5">{al.estado}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {al.nota ? (
                            <span className="text-xs font-bold text-gray-900 dark:text-white px-1.5">{al.nota}</span>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* PANEL DERECHO (70%): Espacio de Trabajo e Inspección del Alumno */}
                <div className="w-[65%] lg:w-[70%] p-8 lg:p-12 overflow-y-auto bg-white dark:bg-gray-900 custom-scrollbar">
                  {alumnoSeleccionado ? (
                    <div className="space-y-8 max-w-4xl mx-auto">

                      {/* Cabecera Alumno Activo */}
                      <div className="flex items-center gap-5 border-b pb-8 border-gray-100 dark:border-gray-800">
                        <div className="w-20 h-20 rounded-3xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-500 text-3xl font-black overflow-hidden shrink-0">
                          {alumnoSeleccionado.avatar_url ? (
                            <img src={alumnoSeleccionado.avatar_url} alt={alumnoSeleccionado.nombre} className="w-full h-full object-cover" />
                          ) : (
                            alumnoSeleccionado.nombre.charAt(0)
                          )}
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 rounded-md">Revisión de Estudiante</span>
                          <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-2 leading-none">{alumnoSeleccionado.nombre}</h3>
                          <div className="flex items-center gap-3 mt-3 text-xs font-medium text-gray-500">
                            <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg> RUT: {alumnoSeleccionado.id}</span>
                            <span className="opacity-40">•</span>
                            <span className={alumnoSeleccionado.estado === 'Entregado' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>Estado: {alumnoSeleccionado.estado}</span>
                          </div>
                        </div>
                      </div>

                      {/* Cuerpo de la Entrega */}
                      {alumnoSeleccionado.estado === 'Entregado' ? (
                        <div className="space-y-6">

                          {/* Archivo Adjunto */}
                          {alumnoSeleccionado.archivo_url ? (
                            <div className="p-6 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-[1.5rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-4">
                                <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-800/30">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                </div>
                                <div>
                                  <p className="text-base font-bold text-gray-900 dark:text-white">Documento Adjunto Cargado</p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Subido el: {alumnoSeleccionado.fecha}</p>
                                </div>
                              </div>
                              <a href={alumnoSeleccionado.archivo_url} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-5 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-900 dark:text-white font-bold text-sm rounded-xl transition-colors text-center flex justify-center items-center gap-2">
                                Abrir Documento
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                              </a>
                            </div>
                          ) : (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 rounded-2xl text-sm font-medium flex items-center gap-3">
                              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                              El alumno marcó la tarea como entregada pero no adjuntó ningún archivo.
                            </div>
                          )}

                          {/* Comentario */}
                          {alumnoSeleccionado.comentario && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-[1.5rem] relative">
                              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Mensaje del Estudiante</h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300 italic relative z-10 leading-relaxed">{alumnoSeleccionado.comentario}</p>
                            </div>
                          )}

                          {/* Sección de Calificación */}
                          <div className="p-6 bg-white dark:bg-gray-800 rounded-[1.5rem] border border-gray-200 dark:border-gray-700 relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                            <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
                            <div className="pl-2">
                              <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">Evaluación y Calificación</h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ingresa la nota oficial curricular (Decreto 67) o décimas formativas.</p>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 font-bold text-sm">Nota</div>
                                <input
                                  type="number" step="0.1" placeholder="Ej: 7.0" value={notaInput}
                                  onChange={(e) => setNotaInput(e.target.value)}
                                  className="w-32 pl-14 pr-4 py-3 text-base font-black bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-800 transition-colors outline-none"
                                />
                              </div>
                              <button
                                onClick={handleGuardarNota} disabled={isSavingNota}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-colors shrink-0 disabled:opacity-50"
                              >
                                {isSavingNota ? 'Guardando...' : 'Registrar Calificación'}
                              </button>
                            </div>
                          </div>

                        </div>
                      ) : (
                        <div className="py-20 flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600 mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Sin Entrega Activa</h4>
                          <p className="text-sm text-gray-500 max-w-sm">El estudiante aún no ha enviado su respuesta.</p>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="h-full flex flex-col justify-center items-center text-gray-400">
                      <svg className="w-16 h-16 text-gray-200 dark:text-gray-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                      <p className="text-base font-bold text-gray-600 dark:text-gray-400">Ningún estudiante seleccionado</p>
                      <p className="text-sm mt-1">Haz clic en un alumno de la lista para revisar su entrega.</p>
                    </div>
                  )}
                </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}