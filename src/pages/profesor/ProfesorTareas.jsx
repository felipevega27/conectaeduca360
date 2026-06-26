import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function ProfesorTareas() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const [cursoFiltro, setCursoFiltro] = useState('Todos');

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
      const { data: perfiles } = await supabase
        .from('perfiles')
        .select('rut, nombre')
        .in('rut', ruts);

      const { data: entregasData } = await supabase
        .from('entregas_tareas')
        .select('*')
        .eq('id_tarea', tarea.id);

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

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" />

      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Gestión de Tareas</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Administre las asignaciones, califique entregas y revise el progreso de sus estudiantes.</p>
        </div>
        <button onClick={() => navigate('/panel/profesor/tareas/nueva')} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-600/30 transform hover:-translate-y-0.5">
          Crear Nueva Tarea
        </button>
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
            <div className="col-span-full py-12 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
          ) : tareasFiltradas.length === 0 ? (
            <div className="col-span-full py-16 text-center">No hay tareas creadas.</div>
          ) : (
            tareasFiltradas.map(tarea => {
              const porcentaje = tarea.total > 0 ? Math.round((tarea.entregas / tarea.total) * 100) : 0;
              return (
                <div key={tarea.id} className="group relative border border-gray-200 rounded-2xl p-6 bg-white dark:bg-gray-800 flex flex-col h-full shadow-sm">
                  <div className={`absolute top-0 left-0 w-full h-1.5 ${tarea.estado === 'Activa' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <div className="flex justify-between items-start mb-4 mt-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-50 text-green-700 border border-green-200">{tarea.estado}</span>
                    <span className="text-xs font-bold text-gray-500">{porcentaje}% Entregado</span>
                  </div>
                  <h3 className="font-extrabold text-gray-800 dark:text-white text-base leading-tight mb-1">{tarea.titulo}</h3>
                  <p className="text-xs text-gray-400 font-medium mb-4">{tarea.curso} • {tarea.asignatura}</p>
                  <div className="mt-auto space-y-3">
                    <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg">Vence: <b>{formatDate(tarea.fechaEntrega)}</b></div>
                    <button onClick={() => abrirDetalles(tarea)} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all">Revisar Entregas ({tarea.entregas}/{tarea.total})</button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ======================================================= */}
      {/* 🚀 NUEVA SALA DE CALIFICACIÓN (MODO GOOGLE CLASSROOM) 🚀 */}
      {/* ======================================================= */}
      {isDetallesOpen && tareaSeleccionada && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 animate-fade-in">

            {/* Encabezado Superior del Dashboard */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-gray-800 dark:text-white">Sala de Corrección: {tareaSeleccionada.titulo}</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tareaSeleccionada.curso} • {tareaSeleccionada.asignatura}</p>
              </div>
              <div className="flex items-center gap-3">
                
                {/* Botón Exportar Estandarizado */}
                <button 
                  onClick={exportarExcel} 
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Exportar Planilla
                </button>

                {/* Botón Cerrar Estandarizado */}
                <button 
                  onClick={() => setIsDetallesOpen(false)} 
                  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-bold shadow-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  Cerrar Sala
                </button>
                
              </div>
            </div>

            {isLoadingDetalles ? (
              <div className="flex-1 flex justify-center items-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
            ) : (
              <div className="flex-1 flex overflow-hidden">

                {/* PANEL IZQUIERDO (35%): Lista de Alumnos */}
                <div className="w-[35%] border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/20 divide-y divide-gray-100 dark:divide-gray-700 custom-scrollbar">
                  {alumnosTarea.map(al => {
                    const esActivo = alumnoSeleccionado?.id === al.id;
                    return (
                      <div
                        key={al.id}
                        onClick={() => handleSeleccionarAlumno(al)}
                        className={`p-3.5 flex items-center justify-between cursor-pointer transition-all ${esActivo ? 'bg-blue-50 dark:bg-blue-900/40 border-l-4 border-blue-600' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                      >
                        <div className="flex items-center gap-2.5 truncate max-w-[70%]">
                          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${al.estado === 'Entregado' ? 'bg-green-500' : al.estado === 'Atrasado' ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                          <p className={`text-xs font-bold truncate ${esActivo ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>{al.nombre}</p>
                        </div>
                        <div className="text-right shrink-0">
                          {al.nota ? (
                            <span className="text-[11px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">{al.nota}</span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{al.estado}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* PANEL DERECHO (65%): Espacio de Trabajo e Inspección del Alumno */}
                <div className="w-[65%] p-6 overflow-y-auto bg-white dark:bg-gray-800 custom-scrollbar">
                  {alumnoSeleccionado ? (
                    <div className="space-y-6">

                      {/* Cabecera Alumno Activo */}
                      <div className="border-b pb-4 border-gray-100 dark:border-gray-700">
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Estudiante Seleccionado</span>
                        <h3 className="text-xl font-black text-gray-800 dark:text-white mt-0.5">{alumnoSeleccionado.nombre}</h3>
                        <p className="text-xs text-gray-400">RUT: {alumnoSeleccionado.id} &nbsp;|&nbsp; Estado: <b className={alumnoSeleccionado.estado === 'Entregado' ? 'text-green-500' : 'text-orange-500'}>{alumnoSeleccionado.estado}</b></p>
                      </div>

                      {/* Cuerpo de la Entrega */}
                      {alumnoSeleccionado.estado === 'Entregado' ? (
                        <div className="space-y-6">

                          {/* Comentario */}
                          {alumnoSeleccionado.comentario && (
                            <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                              <h4 className="text-xs font-bold text-gray-500 uppercase mb-1">Mensaje o Comentario del Alumno:</h4>
                              <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{alumnoSeleccionado.comentario}"</p>
                            </div>
                          )}

                          {/* Archivo Adjunto */}
                          {alumnoSeleccionado.archivo_url ? (
                            <div className="p-4 border-2 border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-xl flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-indigo-900 dark:text-indigo-300">Archivo Adjunto Cargado</p>
                                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">Entregado el: {alumnoSeleccionado.fecha}</p>
                                </div>
                              </div>
                              <a href={alumnoSeleccionado.archivo_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/10 transition-colors">Abrir Documento 👁️</a>
                            </div>
                          ) : (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 text-amber-800 dark:text-amber-400 rounded-xl text-xs font-bold">
                              ⚠️ El alumno marcó la tarea como entregada pero no adjuntó ningún documento físico.
                            </div>
                          )}

                          {/* Sección de Calificación */}
                          <div className="p-5 bg-gray-50 dark:bg-gray-900/30 border rounded-xl space-y-3 max-w-sm">
                            <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Calificación Curricular (Decreto 67)</h4>
                            <p className="text-[11px] text-gray-400">Puedes ingresar una nota oficial (Ej: 6.5) o la cantidad de décimas obtenidas (Ej: 3).</p>
                            <div className="flex items-center gap-3 pt-1">
                              <input
                                type="number" step="0.1" placeholder="Ej: 7.0 o 5" value={notaInput}
                                onChange={(e) => setNotaInput(e.target.value)}
                                className="w-32 text-center text-sm font-black p-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              />
                              <button
                                onClick={handleGuardarNota} disabled={isSavingNota}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                              >
                                {isSavingNota ? 'Guardando...' : 'Registrar'}
                              </button>
                            </div>
                          </div>

                        </div>
                      ) : (
                        <div className="py-12 text-center text-gray-400">
                          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <p className="text-sm font-bold">El alumno aún no ha realizado la entrega</p>
                          <p className="text-xs text-gray-400 mt-1">Su estado actual figura como: <b>{alumnoSeleccionado.estado}</b></p>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="h-full flex justify-center items-center text-gray-400 text-sm">Selecciona un alumno del panel izquierdo para comenzar a revisar.</div>
                  )}
                </div>

              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}