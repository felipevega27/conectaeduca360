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

  return (
    <div className="flex-1 bg-gray-50/50 dark:bg-gray-900 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" />

      {/* CABECERA */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Libro de Calificaciones</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">

            {/* SELECT DE ASIGNATURA */}
            <select
              className="bg-blue-100 dark:bg-gray-800 text-blue-800 dark:text-blue-400 px-3 py-1.5 rounded-lg text-sm font-bold border border-transparent outline-none"
              value={selectedAsignaturaId} onChange={(e) => setSelectedAsignaturaId(e.target.value)}
            >
              {misAsignaturas.map(asig => <option key={asig.id} value={asig.id}>{asig.cursos?.nombre} - {asig.nombre}</option>)}
            </select>

            {/* MODIFICADO: NUEVO SELECT DE SEMESTRE */}
            <select
              className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 px-3 py-1.5 rounded-lg text-sm font-bold border border-transparent outline-none"
              value={semestreSeleccionado} onChange={(e) => setSemestreSeleccionado(e.target.value)}
            >
              <option value="Primer Semestre">1º Semestre</option>
              <option value="Segundo Semestre">2º Semestre</option>
            </select>

            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${sumaPorcentajesTotal === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
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
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-[11px] uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
              <th className="p-4 font-bold min-w-[240px] sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700">
                Nómina Estudiante ({alumnos.length})
              </th>

              {evaluaciones.length === 0 ? (
                <th className="p-4 text-center text-gray-400">
                  No hay evaluaciones creadas para el <span className="font-bold text-purple-600">{semestreSeleccionado}</span>.
                </th>
              ) : (
                evaluaciones.map((ev, i) => (
                  <th key={i} className="p-4 text-center min-w-[140px] border-r border-gray-100 dark:border-gray-700">
                    <span className="text-gray-800 dark:text-gray-200 text-xs font-bold">{ev.nombre}</span>
                    <div className="mt-1 text-[9px] font-bold text-indigo-600">{ev.tipo_instrumento} ({ev.porcentaje}%)</div>
                  </th>
                ))
              )}
              <th className="p-4 text-center font-black">Promedio Semestral</th>
            </tr>
          </thead>
          <tbody>
            {alumnos.length > 0 && alumnos.map((alumno, rowIndex) => {
              const promedioStr = calcularPromedio(alumno.notasUI, evaluaciones);
              return (
                <tr key={alumno.rut} className="hover:bg-blue-50/20 dark:hover:bg-gray-700/30">
                  <td className="p-3 sticky left-0 bg-white dark:bg-gray-800 border-r z-10 border-gray-200">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setRutFichaSeleccionada(alumno.rut); setIsFichaDrawerOpen(true); }}>
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-[10px] font-bold">{alumno.nombre.substring(0, 2).toUpperCase()}</div>
                      <span className="font-bold text-sm text-gray-800 dark:text-white">{alumno.nombre} {alumno.pie && <span className="text-[8px] bg-blue-100 text-blue-700 px-1 rounded ml-1">PIE</span>}</span>
                    </div>
                  </td>
                  {evaluaciones.map((evaluacion, colIndex) => {
                    const notaObj = alumno.notasUI[colIndex] || { valor: '', id_evaluacion: evaluacion.id };
                    const esRojo = notaObj.valor && parseFloat(notaObj.valor) < 4.0;
                    return (
                      <td key={colIndex} className="p-2 border-r text-center">
                        <div className="relative inline-block w-12 h-9">
                          <input
                            type="text" maxLength="3" value={notaObj.valor} placeholder="- -"
                            disabled={!!notaObj.id_bd}
                            onChange={(e) => handleNotaChange(alumno.rut, colIndex, e.target.value)}
                            onBlur={(e) => handleNotaBlur(alumno.rut, colIndex, e.target.value)}
                            className={`w-full h-full text-center font-black text-sm rounded border focus:outline-none ${notaObj.id_bd ? 'cursor-not-allowed opacity-80 bg-gray-100 dark:bg-gray-700/50' : ''} ${notaObj.valor ? (esRojo ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-indigo-600') : 'bg-transparent text-gray-400'}`}
                          />
                          {!!notaObj.id_bd && (
                            <div
                              className="absolute inset-0 z-10 cursor-not-allowed"
                              onClick={() => toast('Esta nota ya ha sido cerrada', { icon: '🔒' })}
                            >
                              <div className="absolute top-1 right-1 opacity-70 text-gray-500">
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
                  <td className="p-4 text-center align-middle">
                    <div className="group relative inline-flex items-center justify-center cursor-help">
                      <span className={`font-black text-lg ${promedioStr === '-' ? 'text-gray-300' : parseFloat(promedioStr) < 4.0 ? 'text-red-600' : 'text-indigo-600'}`}>
                        {promedioStr}
                      </span>
                      <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl bg-white dark:bg-gray-800 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.15)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999] text-left pointer-events-none border border-gray-200 dark:border-gray-700">
                        <strong className="block text-indigo-600 dark:text-indigo-400 mb-1 text-[11px] uppercase tracking-wider">Promedio Semestral</strong>
                        <p className="text-gray-600 dark:text-gray-300 font-normal text-[11px] leading-relaxed">promedio final de alumno</p>
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