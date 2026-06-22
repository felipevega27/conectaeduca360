import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import FichaAlumnoDrawer from '../../components/FichaAlumnoDrawer';

export default function ProfesorCalificaciones() {
  const [user, setUser] = useState(null);

  // Estado para la lista de asignaturas
  const [misAsignaturas, setMisAsignaturas] = useState([]);
  const [selectedAsignaturaId, setSelectedAsignaturaId] = useState('');
  const [cursoActual, setCursoActual] = useState(null);

  // Alumnos y Notas
  const [alumnos, setAlumnos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados Ficha del Alumno
  const [isFichaDrawerOpen, setIsFichaDrawerOpen] = useState(false);
  const [rutFichaSeleccionada, setRutFichaSeleccionada] = useState(null);

  // Nombres de las evaluaciones
  const evaluaciones = ['Nota 1', 'Nota 2', 'Nota 3', 'Nota 4'];

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
      const { data, error } = await supabase
        .from('asignaturas')
        .select('id, nombre, id_curso, cursos(nombre, nivel)')
        .eq('rut_profesor', rutProfesor);

      if (data && data.length > 0) {
        // Filtrar duplicados por si existen en la base de datos
        const asignaturasUnicas = data.filter((asig, index, self) =>
          index === self.findIndex((t) => (
            t.nombre === asig.nombre && t.id_curso === asig.id_curso
          ))
        );
        
        setMisAsignaturas(asignaturasUnicas);
        setSelectedAsignaturaId(asignaturasUnicas[0].id.toString());
      }
    } catch (error) {
      console.error('Error cargando asignaturas:', error);
    }
  };

  useEffect(() => {
    if (selectedAsignaturaId) {
      cargarAlumnosYNotas(selectedAsignaturaId);
    } else {
      setAlumnos([]);
    }
  }, [selectedAsignaturaId]);

  const cargarAlumnosYNotas = async (asigId) => {
    setIsLoading(true);
    try {
      const asignatura = misAsignaturas.find(a => a.id.toString() === asigId);
      if (!asignatura) return;

      setCursoActual({
        nombre: asignatura.cursos?.nombre || 'Curso Desconocido',
        asignatura: asignatura.nombre,
        semestre: 'Primer Semestre'
      });

      const { data: matriculas } = await supabase
        .from('matriculas')
        .select('rut_alumno, condicion_estudiante')
        .eq('id_curso', asignatura.id_curso);

      if (!matriculas || matriculas.length === 0) {
        setAlumnos([]);
        setIsLoading(false);
        return;
      }

      const ruts = matriculas.map(m => m.rut_alumno);
      const { data: perfiles } = await supabase.from('perfiles').select('rut, nombre').in('rut', ruts);

      const { data: notas } = await supabase
        .from('notas')
        .select('id, rut_alumno, nota')
        .eq('id_asignatura', asignatura.id)
        .order('id', { ascending: true });

      const notasMap = {};
      notas?.forEach(n => {
        if (!notasMap[n.rut_alumno]) notasMap[n.rut_alumno] = [];
        notasMap[n.rut_alumno].push(n);
      });

      const alumnosList = matriculas.map(m => {
        const perfil = perfiles?.find(p => p.rut === m.rut_alumno);
        const notasAlumno = notasMap[m.rut_alumno] || [];
        const pie = m.condicion_estudiante?.toUpperCase() === 'PIE';

        const notasUI = Array(4).fill(null).map((_, i) => {
          if (i < notasAlumno.length) {
            return { id_bd: notasAlumno[i].id, valor: notasAlumno[i].nota.toString() };
          }
          return { id_bd: null, valor: '' };
        });

        return {
          id: m.rut_alumno,
          rut: m.rut_alumno,
          nombre: perfil?.nombre || 'Sin Nombre',
          pie: pie,
          notasUI: notasUI
        };
      });

      alumnosList.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setAlumnos(alumnosList);

    } catch (error) {
      console.error('Error cargando libro de clases:', error);
      toast.error('Error al cargar la planilla.');
    } finally {
      setIsLoading(false);
    }
  };

  const calcularPromedio = (notasUIArray) => {
    const notasValidas = notasUIArray.map(n => parseFloat(n.valor)).filter(n => !isNaN(n));
    if (notasValidas.length === 0) return '-';
    const suma = notasValidas.reduce((a, b) => a + b, 0);
    return (suma / notasValidas.length).toFixed(1);
  };

  const handleNotaChange = (alumnoRut, indexNota, valorIngresado) => {
    if (valorIngresado === '') {
      actualizarEstadoNota(alumnoRut, indexNota, valorIngresado);
      return;
    }
    if (!/^[1-7]?\.?[0-9]?$/.test(valorIngresado)) return;

    const num = parseFloat(valorIngresado);
    if (!isNaN(num)) {
      if (num > 7.0) return;
      if (valorIngresado.length === 3 && num < 1.0) return;
    }
    actualizarEstadoNota(alumnoRut, indexNota, valorIngresado);
  };

  const handleNotaBlur = (alumnoRut, indexNota, valorActual) => {
    if (valorActual === '' || valorActual === '.') return;
    let num = parseFloat(valorActual);
    if (isNaN(num)) return;

    if (num < 1.0) num = 1.0;
    if (num > 7.0) num = 7.0;

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

  // --- NAVEGACIÓN TIPO EXCEL (Flechas y Enter) ---
  const handleKeyDown = (e, rowIndex, colIndex) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const nextInput = document.getElementById(`nota-${rowIndex + 1}-${colIndex}`);
      if (nextInput) nextInput.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = document.getElementById(`nota-${rowIndex - 1}-${colIndex}`);
      if (prevInput) prevInput.focus();
    } else if (e.key === 'ArrowRight') {
      const nextInput = document.getElementById(`nota-${rowIndex}-${colIndex + 1}`);
      if (nextInput) nextInput.focus();
    } else if (e.key === 'ArrowLeft') {
      const prevInput = document.getElementById(`nota-${rowIndex}-${colIndex - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleGuardarCambios = async () => {
    if (!selectedAsignaturaId) return;
    setIsSaving(true);
    const toastId = toast.loading('Procesando calificaciones...');

    try {
      const inserts = [];
      const updates = [];
      const deletes = [];

      alumnos.forEach(alumno => {
        alumno.notasUI.forEach(notaCelda => {
          if (notaCelda.id_bd && notaCelda.valor === '') {
            deletes.push(notaCelda.id_bd);
          } else if (notaCelda.id_bd && notaCelda.valor !== '') {
            updates.push({ id: notaCelda.id_bd, nota: parseFloat(notaCelda.valor) });
          } else if (!notaCelda.id_bd && notaCelda.valor !== '') {
            inserts.push({
              rut_alumno: alumno.rut,
              id_asignatura: parseInt(selectedAsignaturaId),
              nota: parseFloat(notaCelda.valor),
              tipo_evaluacion: 'Nota Parcial'
            });
          }
        });
      });

      if (deletes.length > 0) await supabase.from('notas').delete().in('id', deletes);
      if (updates.length > 0) await supabase.from('notas').upsert(updates);
      if (inserts.length > 0) await supabase.from('notas').insert(inserts);

      toast.success('Calificaciones guardadas exitosamente.', { id: toastId });
      cargarAlumnosYNotas(selectedAsignaturaId);

    } catch (error) {
      console.error('Error guardando notas:', error);
      toast.error('Hubo un problema al guardar los cambios.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const alumnosConPromedio = alumnos.map(a => ({ ...a, promedio: calcularPromedio(a.notasUI) })).filter(a => a.promedio !== '-');
  const reprobados = alumnosConPromedio.filter(a => parseFloat(a.promedio) < 4.0).length;
  const porcentajeReprobacion = alumnosConPromedio.length > 0 ? Math.round((reprobados / alumnosConPromedio.length) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />

      {/* CABECERA */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Libro de Calificaciones</h1>
          <div className="flex items-center gap-2 mt-2">
            <select
              className="bg-blue-100 dark:bg-gray-800 text-blue-800 dark:text-blue-400 px-3 py-1.5 rounded-lg text-sm font-bold border border-transparent dark:border-gray-700 cursor-pointer focus:ring-2 focus:ring-blue-500 transition-colors outline-none"
              value={selectedAsignaturaId}
              onChange={(e) => setSelectedAsignaturaId(e.target.value)}
            >
              {misAsignaturas.length === 0 && <option value="" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Sin Asignaturas</option>}
              {misAsignaturas.map(asig => (
                <option key={asig.id} value={asig.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium">
                  {asig.cursos?.nombre} - {asig.nombre}
                </option>
              ))}
            </select>
            {cursoActual && (
              <span className="text-gray-500 dark:text-gray-400 font-medium text-sm hidden sm:inline-block">
                • {cursoActual.semestre}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
            <svg className="w-5 h-5 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar Excel
          </button>
          <button
            disabled={isSaving || alumnos.length === 0}
            onClick={handleGuardarCambios}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold transition-colors shadow-lg shadow-blue-600/20 ${isSaving ? 'opacity-70 cursor-wait' : 'hover:bg-blue-700'}`}
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
            )}
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* ALERTA INTELIGENTE */}
      {porcentajeReprobacion >= 30 && (
        <div className="mb-6 p-4 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 flex items-start gap-3 animate-fade-in-up">
          <div className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 p-2 rounded-lg shrink-0 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div>
            <h4 className="font-bold text-red-800 dark:text-red-300 text-sm">Alerta de Rendimiento (Mineduc)</h4>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">El <span className="font-bold text-red-700 dark:text-red-300">{porcentajeReprobacion}%</span> del curso presenta promedio rojo. Según normativa interna, esto generará una alerta a UTP.</p>
          </div>
        </div>
      )}

      {/* PLANILLA DE NOTAS (Estilo Excel) */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <th className="p-4 font-bold min-w-50 sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                  Estudiante ({alumnos.length})
                </th>
                {evaluaciones.map((evaluacion, i) => (
                  <th key={i} className="p-4 font-semibold text-center min-w-25 border-r border-gray-100 dark:border-gray-700">
                    {evaluacion}
                  </th>
                ))}
                <th className="p-4 font-black text-center min-w-25 bg-gray-100/50 dark:bg-gray-700 border-l border-gray-200 dark:border-gray-700">
                  Promedio
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={evaluaciones.length + 2} className="p-10">
                    <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm font-medium">Cargando nómina oficial...</span>
                    </div>
                  </td>
                </tr>
              ) : alumnos.length === 0 ? (
                <tr>
                  <td colSpan={evaluaciones.length + 2} className="p-12 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-3 text-gray-400">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                    </div>
                    <h3 className="text-gray-900 dark:text-white font-bold text-base mb-1">Sin Estudiantes</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Seleccione otra asignatura o contacte a UTP para actualizar la matrícula.</p>
                  </td>
                </tr>
              ) : alumnos.map((alumno, rowIndex) => {
                const promedioStr = calcularPromedio(alumno.notasUI);
                const promedioNum = parseFloat(promedioStr);
                const esRojoFinal = promedioNum < 4.0;

                return (
                  <tr key={alumno.rut} className="hover:bg-blue-50/30 dark:hover:bg-gray-700/50 transition-colors group">
                    {/* COLUMNA FIJA: ESTUDIANTE */}
                    <td className="p-0 sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700 group-hover:bg-blue-50/80 dark:group-hover:bg-gray-700/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] transition-colors">
                      <div
                        onClick={() => { setRutFichaSeleccionada(alumno.rut); setIsFichaDrawerOpen(true); }}
                        className="px-4 py-3 flex items-center gap-3 cursor-pointer group/ficha"
                        title="Ver Ficha del Alumno"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-gray-500 dark:text-gray-400 text-[10px] group-hover/ficha:bg-blue-100 dark:group-hover/ficha:bg-blue-900/60 group-hover/ficha:text-blue-600 dark:group-hover/ficha:text-blue-300 transition-colors shrink-0">
                          {alumno.nombre.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate group-hover/ficha:text-blue-600 dark:group-hover/ficha:text-blue-400 transition-colors flex items-center">
                            {alumno.nombre}
                            {alumno.pie && <span className="ml-2 text-[8px] bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-sm">PIE</span>}
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{alumno.rut}</span>
                        </div>
                      </div>
                    </td>

                    {/* COLUMNAS DE NOTAS (INPUTS) */}
                    {alumno.notasUI.map((notaObj, colIndex) => {
                      const valorString = notaObj.valor;
                      const notaNum = parseFloat(valorString);
                      const esRojo = valorString !== '' && notaNum < 4.0;
                      const isSaved = !!notaObj.id_bd;

                      return (
                        <td key={colIndex} className="p-2 border-r border-gray-100 dark:border-gray-700 text-center relative bg-white dark:bg-gray-800/50 group-hover:bg-transparent">
                          <div className="relative inline-block">
                            <input
                              id={`nota-${rowIndex}-${colIndex}`}
                              type="text"
                              maxLength="3"
                              value={valorString}
                              onChange={(e) => handleNotaChange(alumno.rut, colIndex, e.target.value)}
                              onBlur={(e) => handleNotaBlur(alumno.rut, colIndex, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                              placeholder="-"
                              disabled={isSaved}
                              title={isSaved ? "Nota guardada. No se puede modificar." : "Ingresar nota"}
                              className={`w-14 h-10 text-center font-bold text-sm rounded-lg border focus:outline-none transition-all ${
                                isSaved
                                  ? (esRojo 
                                      ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-500/80 dark:text-red-400/60 cursor-not-allowed'
                                      : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 text-blue-600/80 dark:text-blue-400/60 cursor-not-allowed')
                                  : (valorString === ''
                                      ? 'bg-transparent border-transparent text-gray-400 dark:text-gray-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-200 dark:hover:border-gray-600'
                                      : esRojo
                                        ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                                        : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20')
                              }`}
                            />
                            {isSaved && (
                              <div className="absolute -top-1 -right-1 bg-gray-100 dark:bg-gray-700 rounded-full p-0.5 border border-white dark:border-gray-800 shadow-sm" title="Nota guardada">
                                <svg className="w-2.5 h-2.5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* COLUMNA FINAL: PROMEDIO */}
                    <td className="p-0 text-center bg-gray-50/50 dark:bg-gray-800/80 border-l border-gray-200 dark:border-gray-700">
                      <div className={`px-4 py-3 font-black text-lg ${promedioStr === '-'
                          ? 'text-gray-300 dark:text-gray-600'
                          : esRojoFinal
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}>
                        {promedioStr}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAWER DE FICHA DE ALUMNO */}
      <FichaAlumnoDrawer
        isOpen={isFichaDrawerOpen}
        onClose={() => setIsFichaDrawerOpen(false)}
        rutAlumno={rutFichaSeleccionada}
      />

    </div>
  );
}