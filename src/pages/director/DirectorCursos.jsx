import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';

export default function DirectorCursos() {
  const navigate = useNavigate();
  const [cursos, setCursos] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [matriculasPorCurso, setMatriculasPorCurso] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para Modal de Asignación
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cursoSeleccionado, setCursoSeleccionado] = useState(null);
  const [docenteSeleccionadoRut, setDocenteSeleccionadoRut] = useState('');

  // Estados para Nuevo Curso
  const [isModalNuevoCursoOpen, setIsModalNuevoCursoOpen] = useState(false);
  const [nuevoCursoForm, setNuevoCursoForm] = useState({ nombre: '', nivel: 'Básica' });

  // Estados para Lista de Alumnos
  const [isModalAlumnosOpen, setIsModalAlumnosOpen] = useState(false);
  const [alumnosModalData, setAlumnosModalData] = useState([]);
  const [cursoModalInfo, setCursoModalInfo] = useState({ id: null, nombre: '' });
  const [isLoadingAlumnos, setIsLoadingAlumnos] = useState(false);

  // Utilidad para ordenar cursos cronológicamente (Parvularia -> Básica -> Media)
  const getValorCurso = (curso) => {
    let valor = 0;
    const nombreStr = curso.nombre.toLowerCase();
    const nivelStr = (curso.nivel || '').toLowerCase();
    
    // Peso por nivel (asegurado por nombre para compatibilidad con datos antiguos)
    if (nivelStr.includes('parvularia') || nombreStr.includes('kínder') || nombreStr.includes('kinder')) {
      valor += 0;
    } else if (nivelStr.includes('básica') || nombreStr.includes('basica') || nombreStr.includes('básico') || nombreStr.includes('basico')) {
      valor += 1000;
    } else if (nivelStr.includes('media') || nombreStr.includes('medio')) {
      valor += 2000;
    } else {
      valor += 3000;
    }

    // Sub-peso por nombre (Pre-kínder, Kínder)
    if (nombreStr.includes('pre')) valor += 10;
    else if (nombreStr.includes('kínder') || nombreStr.includes('kinder')) valor += 20;

    // Sub-peso por número (1º, 2º, etc)
    const match = nombreStr.match(/(\d+)/);
    if (match) {
      valor += parseInt(match[1]) * 100;
    }

    // Sub-peso por letra (A, B, C)
    const letraMatch = nombreStr.match(/([a-z])\s*$/i);
    if (letraMatch) {
       valor += (letraMatch[1].toUpperCase().charCodeAt(0) - 64);
    }

    return valor;
  };

  const ordenarCursos = (lista) => {
    return [...lista].sort((a, b) => getValorCurso(a) - getValorCurso(b));
  };

  const cargarDatos = async () => {
    try {
      setIsLoading(true);
      
      // 1. Traer todos los cursos
      const { data: cursosData, error: cursosError } = await supabase
        .from('cursos')
        .select('*')
        .order('nombre', { ascending: true });

      if (cursosError) throw cursosError;

      // 2. Traer a los docentes
      const { data: docentesData } = await supabase
        .from('perfiles')
        .select('rut, nombre, avatar_url')
        .eq('rol', 'profesor');

      // 3. Traer matrículas para conteo
      const { data: matriculasData } = await supabase
        .from('matriculas')
        .select('id_curso');

      // Conteo de estudiantes por curso
      const conteo = {};
      matriculasData?.forEach(m => {
        if (!conteo[m.id_curso]) conteo[m.id_curso] = 0;
        conteo[m.id_curso]++;
      });

      setCursos(ordenarCursos(cursosData || []));
      setDocentes(docentesData || []);
      setMatriculasPorCurso(conteo);

    } catch (error) {
      console.error('Error cargando cursos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const abrirModalAsignacion = (curso) => {
    setCursoSeleccionado(curso);
    setDocenteSeleccionadoRut(curso.rut_profesor_jefe || '');
    setIsModalOpen(true);
  };

  const guardarProfesorJefe = async (e) => {
    e.preventDefault();
    if (!cursoSeleccionado) return;

    try {
      setIsSaving(true);
      
      // Intentar actualizar la columna rut_profesor_jefe
      // Si no existe en la BD, tirará un error que podremos depurar.
      const { error } = await supabase
        .from('cursos')
        .update({ rut_profesor_jefe: docenteSeleccionadoRut === '' ? null : docenteSeleccionadoRut })
        .eq('id', cursoSeleccionado.id);

      if (error) {
        // Fallback en caso de que la columna no se llame así
        console.error("Error al asignar profe jefe:", error);
        toast.error("Error de esquema: Es probable que la tabla 'cursos' no tenga la columna 'rut_profesor_jefe'. " + error.message);
      } else {
        // Actualizar el estado local para reflejar el cambio sin recargar
        setCursos(prev => prev.map(c => 
          c.id === cursoSeleccionado.id ? { ...c, rut_profesor_jefe: docenteSeleccionadoRut } : c
        ));
        toast.success("Profesor jefe asignado correctamente.");
        setIsModalOpen(false);
      }

    } catch (error) {
      console.error('Error general:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const guardarNuevoCurso = async (e) => {
    e.preventDefault();
    if (!nuevoCursoForm.nombre.trim()) return;
    try {
      setIsSaving(true);
      const { data, error } = await supabase
        .from('cursos')
        .insert([{ nombre: nuevoCursoForm.nombre, nivel: nuevoCursoForm.nivel }])
        .select();
      if (error) throw error;
      setCursos(ordenarCursos([...cursos, data[0]]));
      toast.success(`Curso ${nuevoCursoForm.nombre} creado exitosamente.`);
      setIsModalNuevoCursoOpen(false);
      setNuevoCursoForm({ nombre: '', nivel: 'Básica' });
    } catch (err) {
      toast.error('Error al crear curso: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const abrirModalAlumnos = async (id_curso, nombre_curso) => {
    setCursoModalInfo({ id: id_curso, nombre: nombre_curso });
    setAlumnosModalData([]);
    setIsModalAlumnosOpen(true);
    setIsLoadingAlumnos(true);
    
    try {
      // Fetch data joining matriculas and perfiles
      const { data, error } = await supabase
        .from('matriculas')
        .select(`
          perfiles!matriculas_rut_alumno_fkey (rut, nombre, avatar_url)
        `)
        .eq('id_curso', id_curso);
        
      if (error) throw error;
      
      const alumnos = data.map(d => d.perfiles).filter(Boolean);
      alumnos.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setAlumnosModalData(alumnos);
    } catch (err) {
      console.error('Error al cargar alumnos:', err);
      toast.error('Error al cargar la lista de alumnos: ' + err.message);
    } finally {
      setIsLoadingAlumnos(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8 relative">
      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />
      
      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Gestión de Cursos</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Administra los cursos, matrícula total y asignación de Profesores Jefes.</p>
        </div>
        <button onClick={() => setIsModalNuevoCursoOpen(true)} className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          Nuevo Curso
        </button>
      </div>

      {/* GRID DE CURSOS */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cursos.map(curso => {
            const profesorJefe = docentes.find(d => d.rut === curso.rut_profesor_jefe);
            const totalAlumnos = matriculasPorCurso[curso.id] || 0;

            return (
              <div key={curso.id} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow relative overflow-hidden group">
                
                {/* Banda de color superior decorativa */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>

                <div className="flex justify-between items-start mb-4 mt-2">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">{curso.nombre}</h2>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">ID: {curso.id}</p>
                  </div>
                  <button 
                    onClick={() => abrirModalAlumnos(curso.id, curso.nombre)}
                    className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg flex flex-col items-center transition-colors cursor-pointer group/badge"
                    title="Ver lista de alumnos"
                  >
                    <span className="text-lg font-bold leading-none group-hover/badge:scale-110 transition-transform">{totalAlumnos}</span>
                    <span className="text-[10px] font-semibold uppercase mt-0.5">Alumnos</span>
                  </button>
                </div>

                <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700/50">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Profesor Jefe Asignado</p>
                  
                  {profesorJefe ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {profesorJefe.avatar_url ? (
                          <img src={profesorJefe.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-sm">
                            {profesorJefe.nombre.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm leading-tight">{profesorJefe.nombre}</p>
                          <p className="text-xs text-gray-500">{profesorJefe.rut}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => abrirModalAsignacion(curso)}
                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-2"
                        title="Cambiar Profesor Jefe"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
                        <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <p className="text-sm font-medium">Sin Jefatura Asignada</p>
                      </div>
                      <button 
                        onClick={() => abrirModalAsignacion(curso)}
                        className="text-xs font-bold uppercase tracking-wider bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Asignar
                      </button>
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE ASIGNACIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 overflow-hidden animate-[fadeInUp_0.2s_ease-out]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Asignar Profesor Jefe</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={guardarProfesorJefe} className="p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Selecciona al docente que será el profesor jefe del curso <strong>{cursoSeleccionado?.nombre}</strong>.
              </p>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Profesor Jefe</label>
                <select 
                  value={docenteSeleccionadoRut}
                  onChange={(e) => setDocenteSeleccionadoRut(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-blue-500 outline-none"
                >
                  <option value="">-- Sin Asignar --</option>
                  {docentes.map(d => (
                    <option key={d.rut} value={d.rut}>{d.nombre} ({d.rut})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600 transition-colors">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex justify-center items-center">
                  {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Guardar Asignación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR NUEVO CURSO */}
      {isModalNuevoCursoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out] overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Crear Nuevo Curso</h2>
              <button onClick={() => setIsModalNuevoCursoOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={guardarNuevoCurso} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nombre del Curso</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ej: 3º Medio A"
                  value={nuevoCursoForm.nombre}
                  onChange={(e) => setNuevoCursoForm({...nuevoCursoForm, nombre: e.target.value})}
                  className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nivel Educativo</label>
                <select 
                  value={nuevoCursoForm.nivel}
                  onChange={(e) => setNuevoCursoForm({...nuevoCursoForm, nivel: e.target.value})}
                  className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm dark:text-white focus:ring-2 focus:border-blue-500 outline-none"
                >
                  <option value="Parvularia">Parvularia (Pre-Kínder / Kínder)</option>
                  <option value="Básica">Enseñanza Básica</option>
                  <option value="Media">Enseñanza Media</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsModalNuevoCursoOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-600 transition-colors">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 shadow-lg shadow-blue-600/20 flex justify-center items-center">
                  {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Crear Curso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LISTA DE ALUMNOS */}
      {isModalAlumnosOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out] overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0 bg-gray-50/50 dark:bg-gray-800/50">
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">Alumnos Matriculados</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Curso: <strong className="text-gray-800 dark:text-gray-200">{cursoModalInfo.nombre}</strong></p>
              </div>
              <button onClick={() => setIsModalAlumnosOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors bg-white dark:bg-gray-700 rounded-full p-1.5 shadow-sm border border-gray-200 dark:border-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {isLoadingAlumnos ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-500 font-medium">Cargando nómina de alumnos...</p>
                </div>
              ) : alumnosModalData.length > 0 ? (
                <div className="space-y-3">
                  {alumnosModalData.map((alumno, idx) => (
                    <div key={alumno.rut} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 hover:bg-white dark:hover:bg-gray-800 transition-colors group">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold text-sm shrink-0 border border-blue-200 dark:border-blue-800">
                        {idx + 1}
                      </div>
                      {alumno.avatar_url ? (
                        <img src={alumno.avatar_url} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-600" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold text-sm shrink-0">
                          {alumno.nombre.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{alumno.nombre}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{alumno.rut}</p>
                      </div>
                      
                      {/* NUEVO BOTÓN: VER FICHA ALUMNO */}
                      <button 
                        onClick={() => navigate(`/panel/director/alumnos/${alumno.rut}`)}
                        className="ml-auto p-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg transition-colors border border-blue-100 dark:border-blue-800/50 flex items-center justify-center shrink-0"
                        title="Ver Ficha Completa del Alumno"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">No hay alumnos matriculados en este curso.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
