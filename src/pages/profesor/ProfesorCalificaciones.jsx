import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import FichaAlumnoDrawer from '../../components/FichaAlumnoDrawer';

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
        setMisAsignaturas(asignaturasUnicas);
        setSelectedAsignaturaId(asignaturasUnicas[0].id.toString());
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
      <div className="mb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight">
            Libro de Calificaciones
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-3">

            {/* SELECT DE ASIGNATURA */}
            <select
              className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 dark:border-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
              value={selectedAsignaturaId} onChange={(e) => setSelectedAsignaturaId(e.target.value)}
            >
              {misAsignaturas.map(asig => <option key={asig.id} value={asig.id}>{asig.cursos?.nombre} - {asig.nombre}</option>)}
            </select>

            {/* MODIFICADO: NUEVO SELECT DE SEMESTRE */}
            <select
              className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 dark:border-gray-700 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
              value={semestreSeleccionado} onChange={(e) => setSemestreSeleccionado(e.target.value)}
            >
              <option value="Primer Semestre">1º Semestre</option>
              <option value="Segundo Semestre">2º Semestre</option>
            </select>

            <span className={`text-xs font-bold px-3 py-2 rounded-xl shadow-sm border transition-colors ${sumaPorcentajesTotal === 100 ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400' : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-400'}`}>
              Ponderación {semestreSeleccionado === 'Primer Semestre' ? '1ºS' : '2ºS'}: {sumaPorcentajesTotal}% de 100%
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleGuardarCambios} disabled={isSaving || alumnos.length === 0} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold">
            {isSaving ? "Guardando..." : "Guardar Notas"}
          </button>
        </div>
      </div>

      {/* PLANILLA */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg shadow-gray-200/50 dark:shadow-none overflow-x-auto overflow-y-hidden relative">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800 text-[11px] uppercase text-gray-500 border-b-2 border-gray-200 dark:border-gray-700">
              <th className="p-4 font-black text-gray-600 dark:text-gray-300 min-w-[260px] sticky left-0 bg-white dark:bg-gray-800 z-20 border-r-2 border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                Nómina Estudiante <span className="ml-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full text-[10px]">{alumnos.length}</span>
              </th>

              {evaluaciones.length === 0 ? (
                <th className="p-4 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center py-4 gap-2">
                    <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    <span>No hay evaluaciones creadas para el <span className="font-bold text-indigo-500">{semestreSeleccionado}</span>.</span>
                  </div>
                </th>
              ) : (
                evaluaciones.map((ev, i) => (
                  <th key={i} className="p-4 text-center min-w-[160px] border-r border-gray-100 dark:border-gray-700 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <span className="text-gray-800 dark:text-gray-200 text-xs font-black tracking-tight leading-tight">{ev.nombre}</span>
                      <span className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-2.5 py-1 rounded-md text-[9px] font-bold tracking-wider uppercase shadow-sm border border-indigo-100 dark:border-indigo-800/50">{ev.tipo_instrumento} • {ev.porcentaje}%</span>
                    </div>
                  </th>
                ))
              )}
              <th className="p-4 text-center font-black text-indigo-600 dark:text-indigo-400 min-w-[140px] sticky right-0 bg-white dark:bg-gray-800 z-20 border-l-2 border-gray-200 dark:border-gray-700 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)]">Promedio<br/>Semestral</th>
            </tr>
          </thead>
          <tbody>
            {alumnos.length > 0 && alumnos.map((alumno, rowIndex) => {
              const promedioStr = calcularPromedio(alumno.notasUI, evaluaciones);
              return (
                <tr key={alumno.rut} className="hover:bg-blue-50/20 dark:hover:bg-gray-700/30">
                  <td className="p-3 sticky left-0 bg-white dark:bg-gray-800 border-r-2 z-10 border-gray-200 dark:border-gray-700 group-hover:bg-blue-50/20 dark:group-hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center gap-3 cursor-pointer group/alumno" onClick={() => { setRutFichaSeleccionada(alumno.rut); setIsFichaDrawerOpen(true); }}>
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-xs font-black text-indigo-700 dark:text-indigo-300 shadow-sm group-hover/alumno:scale-105 transition-transform">{alumno.nombre.substring(0, 2).toUpperCase()}</div>
                      <span className="font-bold text-sm text-gray-800 dark:text-white group-hover/alumno:text-indigo-600 dark:group-hover/alumno:text-indigo-400 transition-colors">
                        {alumno.nombre} 
                        {alumno.pie && <span className="inline-flex items-center ml-2 text-[9px] font-black bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-1.5 py-0.5 rounded shadow-sm">PIE</span>}
                      </span>
                    </div>
                  </td>
                  {evaluaciones.map((evaluacion, colIndex) => {
                    const notaObj = alumno.notasUI[colIndex] || { valor: '', id_evaluacion: evaluacion.id };
                    const esRojo = notaObj.valor && parseFloat(notaObj.valor) < 4.0;
                    return (
                      <td key={colIndex} className="p-2 border-r text-center">
                        <div className="relative inline-block w-[4.5rem] h-10 group/input">
                          <input
                            type="text" maxLength="3" value={notaObj.valor} placeholder="- -"
                            disabled={!!notaObj.id_bd}
                            onChange={(e) => handleNotaChange(alumno.rut, colIndex, e.target.value)}
                            onBlur={(e) => handleNotaBlur(alumno.rut, colIndex, e.target.value)}
                            className={`w-full h-full text-center font-black text-[15px] rounded-xl border-2 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 
                              ${notaObj.id_bd ? 'cursor-not-allowed opacity-80 bg-gray-100 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600' : ''} 
                              ${!notaObj.id_bd && notaObj.valor ? (esRojo ? 'bg-red-50 border-red-300 text-red-600 shadow-[inset_0_2px_4px_rgba(220,38,38,0.1)]' : 'bg-blue-50 border-blue-300 text-indigo-700 shadow-[inset_0_2px_4px_rgba(67,56,202,0.1)]') : ''} 
                              ${!notaObj.id_bd && !notaObj.valor ? 'bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 text-gray-800 dark:text-white shadow-sm' : ''}
                            `}
                          />
                          {!!notaObj.id_bd && (
                            <div
                              className="absolute inset-0 z-10 cursor-not-allowed flex items-start justify-end p-1.5"
                              onClick={() => toast('Esta nota ya ha sido cerrada y guardada.', { icon: '🔒', id: `toast-${alumno.rut}-${colIndex}` })}
                            >
                              <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-0.5 rounded-full shadow-sm text-gray-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-4 text-center align-middle sticky right-0 bg-white dark:bg-gray-800 border-l-2 border-gray-200 dark:border-gray-700 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.05)] z-10 hover:z-[60] group-hover:bg-blue-50/20 dark:group-hover:bg-gray-700/50 transition-colors">
                    <div className="group/promedio relative inline-flex items-center justify-center cursor-help">
                      <span className={`font-black text-xl px-4 py-1.5 rounded-xl border-2 shadow-sm transition-all duration-300
                        ${promedioStr === '-' ? 'text-gray-400 bg-gray-50 border-gray-100 dark:bg-gray-800/50 dark:border-gray-700' : parseFloat(promedioStr) < 4.0 ? 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/50' : 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/50'}
                      `}>
                        {promedioStr}
                      </span>
                      {/* TOOLTIP RESTAURADO - AHORA A LA IZQUIERDA */}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 w-48 rounded-xl bg-gray-900 dark:bg-white p-3 shadow-xl opacity-0 invisible group-hover/promedio:opacity-100 group-hover/promedio:visible transition-all duration-200 z-[9999] text-left pointer-events-none transform translate-x-2 group-hover/promedio:translate-x-0">
                        {/* Triangulito indicador a la derecha */}
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