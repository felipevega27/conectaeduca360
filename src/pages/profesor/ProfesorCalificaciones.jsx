import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import FichaAlumnoDrawer from '../../components/FichaAlumnoDrawer';
import { sortCursos } from '../../utils/sortUtils';

export default function ProfesorCalificaciones() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const [misAsignaturas, setMisAsignaturas] = useState([]);
  const [selectedAsignaturaId, setSelectedAsignaturaId] = useState('');
  const [cursoActual, setCursoActual] = useState(null);

  // NUEVO: Estado para controlar el semestre activo en la planilla
  const [semestreSeleccionado, setSemestreSeleccionado] = useState('Primer Semestre');

  const [evaluaciones, setEvaluaciones] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [isFichaDrawerOpen, setIsFichaDrawerOpen] = useState(false);
  const [rutFichaSeleccionada, setRutFichaSeleccionada] = useState(null);

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      cargarMisAsignaturas(parsedUser.rut);
    }
  }, []);

  const cargarMisAsignaturas = async (rutProfesor) => {
    try {
      const { data } = await supabase
        .from('asignaturas')
        .select('id, nombre, id_curso, cursos(nombre, nivel)')
        .eq('rut_profesor', rutProfesor);

      if (data && data.length > 0) {
        const asignaturasUnicas = data.filter((asig, index, self) =>
          index === self.findIndex((t) => (t.nombre === asig.nombre && t.id_curso === asig.id_curso))
        );
        const asignaturasOrdenadas = sortCursos(asignaturasUnicas);
        setMisAsignaturas(asignaturasOrdenadas);
        setSelectedAsignaturaId(asignaturasOrdenadas[0].id.toString());
      }
    } catch (error) {
      console.error('Error cargando asignaturas:', error);
    }
  };

  // Escuchar cambios tanto de asignatura como de semestre
  useEffect(() => {
    if (selectedAsignaturaId) cargarAlumnosYNotas(selectedAsignaturaId, semestreSeleccionado);
  }, [selectedAsignaturaId, semestreSeleccionado]);

  const cargarAlumnosYNotas = async (asigId, semestre) => {
    setIsLoading(true);
    try {
      const asignatura = misAsignaturas.find(a => a.id.toString() === asigId);
      if (!asignatura) return;

      // Actualizamos el objeto dinámicamente con el semestre elegido
      setCursoActual({
        nombre: asignatura.cursos?.nombre || 'Curso Desconocido',
        asignatura: asignatura.nombre,
        semestre: semestre
      });

      // MODIFICADO: Cargar Evaluaciones filtrando ESTRICTAMENTE por el semestre seleccionado
      const { data: evaluacionesData } = await supabase
        .from('evaluaciones')
        .select('*')
        .eq('id_asignatura', asigId)
        .eq('semestre', semestre) // <-- FILTRO DE SEMESTRE
        .order('created_at', { ascending: true });

      const evaluacionesActivas = evaluacionesData || [];
      setEvaluaciones(evaluacionesActivas);

      // Cargar Matrículas
      const { data: matriculas } = await supabase.from('matriculas').select('rut_alumno, condicion_estudiante').eq('id_curso', asignatura.id_curso);
      if (!matriculas || matriculas.length === 0) {
        setAlumnos([]); setIsLoading(false); return;
      }

      // Cargar Perfiles y Notas
      const ruts = matriculas.map(m => m.rut_alumno);
      const { data: perfiles } = await supabase.from('perfiles').select('rut, nombre').in('rut', ruts);
      const { data: notas } = await supabase.from('notas').select('id, rut_alumno, id_evaluacion, nota').eq('id_asignatura', asignatura.id);

      const alumnosList = matriculas.map(m => {
        const perfil = perfiles?.find(p => p.rut === m.rut_alumno);
        const pie = m.condicion_estudiante?.toUpperCase() === 'PIE';

        const notasUI = evaluacionesActivas.map(evaluacion => {
          const notaExistente = notas?.find(n => n.rut_alumno === m.rut_alumno && n.id_evaluacion === evaluacion.id);
          return {
            id_bd: notaExistente?.id || null,
            id_evaluacion: evaluacion.id,
            valor: notaExistente ? notaExistente.nota.toString() : ''
          };
        });

        return { id: m.rut_alumno, rut: m.rut_alumno, nombre: perfil?.nombre || 'Sin Nombre', pie, notasUI };
      });

      alumnosList.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setAlumnos(alumnosList);
    } catch (error) {
      toast.error('Error al cargar la planilla.');
    } finally {
      setIsLoading(false);
    }
  };

  const calcularPromedio = (notasUIArray, evaluacionesActuales) => {
    let sumaPonderada = 0, sumaPorcentajes = 0, sumaSimple = 0, notasValidas = 0, tienePorcentajes = false;
    notasUIArray.forEach((nota, idx) => {
      const valor = parseFloat(nota.valor);
      if (!isNaN(valor)) {
        const ev = evaluacionesActuales[idx];
        if (ev && ev.porcentaje) {
          tienePorcentajes = true;
          sumaPonderada += valor * (ev.porcentaje / 100);
          sumaPorcentajes += ev.porcentaje;
        }
        sumaSimple += valor;
        notasValidas++;
      }
    });
    if (notasValidas === 0) return '-';
    if (tienePorcentajes && sumaPorcentajes > 0) return (sumaPonderada / (sumaPorcentajes / 100)).toFixed(1);
    return (sumaSimple / notasValidas).toFixed(1);
  };

  const handleNotaChange = (alumnoRut, indexNota, valorIngresado) => {
    if (valorIngresado === '') { actualizarEstadoNota(alumnoRut, indexNota, valorIngresado); return; }
    if (!/^[1-7]?\.?[0-9]?$/.test(valorIngresado)) return;
    const num = parseFloat(valorIngresado);
    if (!isNaN(num)) { if (num > 7.0) return; if (valorIngresado.length === 3 && num < 1.0) return; }
    actualizarEstadoNota(alumnoRut, indexNota, valorIngresado);
  };

  const handleNotaBlur = (alumnoRut, indexNota, valorActual) => {
    if (valorActual === '' || valorActual === '.') return;
    let num = parseFloat(valorActual);
    if (isNaN(num)) return;
    if (num < 1.0) num = 1.0; if (num > 7.0) num = 7.0;
    actualizarEstadoNota(alumnoRut, indexNota, num.toFixed(1));
  };

  const actualizarEstadoNota = (rut, index, valor) => {
    setAlumnos(prev => prev.map(alumno => {
      if (alumno.rut === rut) {
        const nuevasNotasUI = [...alumno.notasUI];
        nuevasNotasUI[index] = { ...nuevasNotasUI[index], valor: valor };
        return { ...alumno, notasUI: nuevasNotasUI };
      }
      return alumno;
    }));
  };

  const handleGuardarCambios = async () => {
    if (!selectedAsignaturaId) return;
    setIsSaving(true);
    const toastId = toast.loading('Guardando notas en el servidor...');

    try {
      const inserts = [], updates = [], deletes = [];

      alumnos.forEach(alumno => {
        alumno.notasUI.forEach(notaCelda => {
          if (notaCelda.id_bd && notaCelda.valor === '') deletes.push(notaCelda.id_bd);
          else if (notaCelda.id_bd && notaCelda.valor !== '') updates.push({ id: notaCelda.id_bd, nota: parseFloat(notaCelda.valor) });
          else if (!notaCelda.id_bd && notaCelda.valor !== '') inserts.push({
            rut_alumno: alumno.rut, id_asignatura: parseInt(selectedAsignaturaId),
            id_evaluacion: notaCelda.id_evaluacion, nota: parseFloat(notaCelda.valor),
            tipo_evaluacion: 'Nota Parcial'
          });
        });
      });

      if (deletes.length > 0) await supabase.from('notas').delete().in('id', deletes);
      if (updates.length > 0) await supabase.from('notas').upsert(updates);
      if (inserts.length > 0) await supabase.from('notas').insert(inserts);

      toast.success('Libro actualizado correctamente.', { id: toastId });
      cargarAlumnosYNotas(selectedAsignaturaId, semestreSeleccionado);
    } catch (error) {
      toast.error('Hubo un problema al guardar.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const sumaPorcentajesTotal = evaluaciones.reduce((acc, cur) => acc + (cur.porcentaje || 0), 0);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando calificaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50/50 dark:bg-gray-900 pb-10 px-4 sm:px-8 pt-0">
      <Toaster position="top-right" />

      {/* CABECERA */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">
            Libro de Calificaciones
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Gestiona las notas y promedios semestrales de tus cursos.</p>
          <div className="flex flex-wrap items-center gap-3 mt-4">

            {/* SELECT DE ASIGNATURA */}
            <select
              className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-2.5 rounded-xl text-sm font-bold border border-gray-200 dark:border-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
              value={selectedAsignaturaId} onChange={(e) => setSelectedAsignaturaId(e.target.value)}
            >
              {misAsignaturas.map(asig => <option key={asig.id} value={asig.id}>{asig.cursos?.nombre} - {asig.nombre}</option>)}
            </select>

            {/* MODIFICADO: NUEVO SELECT DE SEMESTRE */}
            <select
              className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-2.5 rounded-xl text-sm font-bold border border-gray-200 dark:border-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
              value={semestreSeleccionado} onChange={(e) => setSemestreSeleccionado(e.target.value)}
            >
              <option value="Primer Semestre">1º Semestre</option>
              <option value="Segundo Semestre">2º Semestre</option>
            </select>

            <span className={`text-xs font-bold px-3 py-2.5 rounded-xl shadow-sm border transition-colors ${sumaPorcentajesTotal === 100 ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400' : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400'}`}>
              Ponderación {semestreSeleccionado === 'Primer Semestre' ? '1ºS' : '2ºS'}: {sumaPorcentajesTotal}% de 100%
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleGuardarCambios} disabled={isSaving || alumnos.length === 0} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-[0_2px_10px_-3px_rgba(79,70,229,0.5)] disabled:opacity-50 disabled:cursor-not-allowed">
            {isSaving ? (
              <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            )}
            {isSaving ? "Guardando..." : "Guardar Notas"}
          </button>
        </div>
      </div>

      {/* PLANILLA */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-x-auto overflow-y-hidden relative">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 dark:bg-gray-900/50 text-[11px] uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              <th className="p-4 font-black text-gray-700 dark:text-gray-300 min-w-[260px] sticky left-0 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm z-20 border-r border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                Nómina Estudiante <span className="ml-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-2 py-0.5 rounded-lg text-[10px]">{alumnos.length}</span>
              </th>

              {evaluaciones.length === 0 ? (
                <th className="p-6 text-center text-gray-400 font-normal">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Sin evaluaciones. Usa <span className="font-bold text-indigo-500">Mis Planificaciones</span> para agregar evaluaciones.</span>
                  </div>
                </th>
              ) : (
                evaluaciones.map((ev, i) => (
                  <th key={i} className="p-4 text-center min-w-[140px] border-r border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <span className="text-gray-800 dark:text-gray-200 text-xs font-black tracking-tight leading-tight max-w-[120px] truncate" title={ev.nombre}>{ev.nombre}</span>
                      <span className="bg-white border border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-md text-[9.5px] font-bold tracking-wide uppercase shadow-sm">
                        {ev.porcentaje}%
                      </span>
                    </div>
                  </th>
                ))
              )}
              <th className="p-4 text-center font-black text-indigo-700 dark:text-indigo-400 min-w-[130px] sticky right-0 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm z-20 border-l border-gray-200 dark:border-gray-700 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                Promedio<br/>Semestral
              </th>
            </tr>
          </thead>
          <tbody>
            {alumnos.length > 0 && alumnos.map((alumno, rowIndex) => {
              const promedioStr = calcularPromedio(alumno.notasUI, evaluaciones);
              return (
                <tr key={alumno.rut} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 border-b border-gray-100 dark:border-gray-800/50 last:border-0 transition-colors group">
                  <td className="p-3 sticky left-0 bg-white dark:bg-gray-800 border-r z-10 border-gray-200 dark:border-gray-700 group-hover:bg-gray-50/95 dark:group-hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center gap-3 cursor-pointer group/alumno" onClick={() => { setRutFichaSeleccionada(alumno.rut); setIsFichaDrawerOpen(true); }}>
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/40 dark:to-purple-900/40 border border-indigo-200/50 dark:border-indigo-700/50 flex items-center justify-center text-xs font-black text-indigo-700 dark:text-indigo-300 shadow-sm group-hover/alumno:scale-105 transition-transform">{alumno.nombre.substring(0, 2).toUpperCase()}</div>
                      <span className="font-bold text-sm text-gray-800 dark:text-white group-hover/alumno:text-indigo-600 dark:group-hover/alumno:text-indigo-400 transition-colors">
                        {alumno.nombre} 
                        {alumno.pie && <span className="inline-flex items-center ml-2 text-[9px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded shadow-sm border border-blue-200 dark:border-blue-800">PIE</span>}
                      </span>
                    </div>
                  </td>
                  {evaluaciones.length === 0 ? (
                     <td className="p-2 text-center bg-gray-50/30 dark:bg-gray-900/20"></td>
                  ) : evaluaciones.map((evaluacion, colIndex) => {
                    const notaObj = alumno.notasUI[colIndex] || { valor: '', id_evaluacion: evaluacion.id };
                    const esRojo = notaObj.valor && parseFloat(notaObj.valor) < 4.0;
                    return (
                      <td key={colIndex} className="p-2 border-r border-gray-100 dark:border-gray-800 text-center bg-white dark:bg-gray-800 group-hover:bg-gray-50/30 dark:group-hover:bg-gray-700/20">
                        <div className="relative inline-block w-14 h-10 group/input">
                          <input
                            type="text" maxLength="3" value={notaObj.valor} placeholder="-"
                            disabled={!!notaObj.id_bd}
                            onChange={(e) => handleNotaChange(alumno.rut, colIndex, e.target.value)}
                            onBlur={(e) => handleNotaBlur(alumno.rut, colIndex, e.target.value)}
                            className={`w-full h-full text-center font-bold text-[15px] rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 
                              ${notaObj.id_bd ? 'cursor-not-allowed opacity-80 bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700 text-gray-600 dark:text-gray-400' : ''} 
                              ${!notaObj.id_bd && notaObj.valor ? (esRojo ? 'bg-red-50 border-red-200 text-red-700 focus:ring-red-500/50 focus:border-red-500 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' : 'bg-blue-50/50 border-blue-200 text-blue-700 focus:ring-blue-500/50 focus:border-blue-500 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400') : ''} 
                              ${!notaObj.id_bd && !notaObj.valor ? 'bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]' : ''}
                            `}
                          />
                          {!!notaObj.id_bd && (
                            <div
                              className="absolute -top-1 -right-1 z-10 cursor-not-allowed"
                              onClick={() => toast('Esta nota ya ha sido cerrada y guardada.', { icon: '🔒', id: `toast-${alumno.rut}-${colIndex}` })}
                            >
                              <div className="bg-gray-200 dark:bg-gray-700 border border-white dark:border-gray-800 p-0.5 rounded-full shadow-sm text-gray-500 dark:text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                  <path d="M17,9V7c0-2.8-2.2-5-5-5S7,4.2,7,7v2c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h10c1.1,0,2-0.9,2-2V11C19,9.9,18.1,9,17,9z M9,7c0-1.7,1.3-3,3-3s3,1.3,3,3v2H9V7z"/>
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-4 text-center align-middle sticky right-0 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10 hover:z-[60] group-hover:bg-gray-50/95 dark:group-hover:bg-gray-700/50 transition-colors">
                    <div className="group/promedio relative inline-flex items-center justify-center cursor-help">
                      <span className={`font-black text-xl px-4 py-1.5 rounded-xl border shadow-sm transition-all duration-300
                        ${promedioStr === '-' ? 'text-gray-400 bg-gray-50 border-gray-200 dark:bg-gray-900/50 dark:border-gray-700' : parseFloat(promedioStr) < 4.0 ? 'text-red-700 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800' : 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'}
                      `}>
                        {promedioStr}
                      </span>
                      {/* TOOLTIP */}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 w-48 rounded-xl bg-gray-900 dark:bg-white p-3 shadow-xl opacity-0 invisible group-hover/promedio:opacity-100 group-hover/promedio:visible transition-all duration-200 z-[9999] text-left pointer-events-none transform translate-x-2 group-hover/promedio:translate-x-0">
                        <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-gray-900 dark:bg-white transform rotate-45"></div>
                        <strong className="block text-white dark:text-gray-900 mb-1 text-[11px] uppercase tracking-wider font-black">Promedio Semestral</strong>
                        <p className="text-gray-300 dark:text-gray-600 font-medium text-[11px] leading-relaxed">Promedio final ponderado del alumno en este semestre.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <FichaAlumnoDrawer isOpen={isFichaDrawerOpen} onClose={() => setIsFichaDrawerOpen(false)} rutAlumno={rutFichaSeleccionada} />
    </div>
  );
}