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

  // Evaluaciones y Alumnos
  const [evaluaciones, setEvaluaciones] = useState([]); // <-- AHORA ES DINÁMICO
  const [alumnos, setAlumnos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados Ficha del Alumno
  const [isFichaDrawerOpen, setIsFichaDrawerOpen] = useState(false);
  const [rutFichaSeleccionada, setRutFichaSeleccionada] = useState(null);

  // Estados Modal Nueva Evaluación
  const [isModalEvalOpen, setIsModalEvalOpen] = useState(false);
  const [nombreNuevaEval, setNombreNuevaEval] = useState('');
  const [descripcionNuevaEval, setDescripcionNuevaEval] = useState('');
  const [porcentajeNuevaEval, setPorcentajeNuevaEval] = useState('');
  const [isCreatingEval, setIsCreatingEval] = useState(false);

  // Estados Modal Administrar Evaluaciones
  const [isModalAdminOpen, setIsModalAdminOpen] = useState(false);
  const [isDeletingEval, setIsDeletingEval] = useState(false);

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

  useEffect(() => {
    if (selectedAsignaturaId) {
      cargarAlumnosYNotas(selectedAsignaturaId);
    } else {
      setAlumnos([]);
      setEvaluaciones([]);
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

      // 1. Cargar las evaluaciones dinámicas (las columnas)
      const { data: evaluacionesData } = await supabase
        .from('evaluaciones')
        .select('*')
        .eq('id_asignatura', asigId)
        .order('created_at', { ascending: true });

      const evaluacionesActivas = evaluacionesData || [];
      setEvaluaciones(evaluacionesActivas);

      // 2. Cargar Matrículas
      const { data: matriculas } = await supabase
        .from('matriculas')
        .select('rut_alumno, condicion_estudiante')
        .eq('id_curso', asignatura.id_curso);

      if (!matriculas || matriculas.length === 0) {
        setAlumnos([]);
        setIsLoading(false);
        return;
      }

      // 3. Cargar Perfiles de alumnos
      const ruts = matriculas.map(m => m.rut_alumno);
      const { data: perfiles } = await supabase.from('perfiles').select('rut, nombre').in('rut', ruts);

      // 4. Cargar Notas y cruzarlas con id_evaluacion
      const { data: notas } = await supabase
        .from('notas')
        .select('id, rut_alumno, id_evaluacion, nota')
        .eq('id_asignatura', asignatura.id);

      const alumnosList = matriculas.map(m => {
        const perfil = perfiles?.find(p => p.rut === m.rut_alumno);
        const pie = m.condicion_estudiante?.toUpperCase() === 'PIE';

        // Mapear las notas EXACTAMENTE a las evaluaciones que existen
        const notasUI = evaluacionesActivas.map(evaluacion => {
          const notaExistente = notas?.find(n => n.rut_alumno === m.rut_alumno && n.id_evaluacion === evaluacion.id);
          return {
            id_bd: notaExistente?.id || null,
            id_evaluacion: evaluacion.id,
            valor: notaExistente ? notaExistente.nota.toString() : ''
          };
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

  // --- CREAR NUEVA EVALUACIÓN (COLUMNA) ---
  const handleCrearEvaluacion = async (e) => {
    e.preventDefault();
    if (!nombreNuevaEval.trim()) return;

    setIsCreatingEval(true);
    const toastId = toast.loading('Creando columna de evaluación...');

    try {
      const porcentaje = porcentajeNuevaEval ? parseInt(porcentajeNuevaEval) : null;
      if (porcentaje !== null && (porcentaje <= 0 || porcentaje > 100)) {
        toast.error('El porcentaje debe estar entre 1 y 100.', { id: toastId });
        setIsCreatingEval(false);
        return;
      }

      const { error } = await supabase.from('evaluaciones').insert([{
        id_asignatura: parseInt(selectedAsignaturaId),
        nombre: nombreNuevaEval.trim(),
        descripcion: descripcionNuevaEval.trim() || null,
        porcentaje: porcentaje
      }]);

      if (error) throw error;

      toast.success('Evaluación creada', { id: toastId });
      setNombreNuevaEval('');
      setDescripcionNuevaEval('');
      setPorcentajeNuevaEval('');
      setIsModalEvalOpen(false);

      // Recargar para que aparezca la nueva columna a todos los alumnos
      cargarAlumnosYNotas(selectedAsignaturaId);

    } catch (error) {
      console.error(error);
      toast.error('Error al crear evaluación', { id: toastId });
    } finally {
      setIsCreatingEval(false);
    }
  };

  // --- ELIMINAR EVALUACIÓN ---
  const handleEliminarEvaluacion = async (idEval) => {
    if (!window.confirm("¿Estás seguro de eliminar esta evaluación? Se borrarán todas las notas asociadas.")) return;
    setIsDeletingEval(true);
    const toastId = toast.loading('Eliminando evaluación...');

    try {
      // Eliminar las notas asociadas primero para evitar errores de llave foránea
      await supabase.from('notas').delete().eq('id_evaluacion', idEval);
      
      const { error } = await supabase.from('evaluaciones').delete().eq('id', idEval);
      if (error) throw error;

      toast.success('Evaluación y sus notas eliminadas', { id: toastId });
      
      // Si ya no quedan evaluaciones, cerramos el modal
      if (evaluaciones.length <= 1) {
        setIsModalAdminOpen(false);
      }
      
      cargarAlumnosYNotas(selectedAsignaturaId);
    } catch (error) {
      console.error(error);
      toast.error('Error al eliminar', { id: toastId });
    } finally {
      setIsDeletingEval(false);
    }
  };

  const calcularPromedio = (notasUIArray, evaluacionesActuales) => {
    let sumaPonderada = 0;
    let sumaPorcentajes = 0;
    let sumaSimple = 0;
    let notasValidasCount = 0;
    let tienePorcentajes = false;

    notasUIArray.forEach((nota, index) => {
      const valor = parseFloat(nota.valor);
      if (!isNaN(valor)) {
        const evaluacion = evaluacionesActuales[index];
        if (evaluacion && evaluacion.porcentaje) {
          tienePorcentajes = true;
          sumaPonderada += valor * (evaluacion.porcentaje / 100);
          sumaPorcentajes += evaluacion.porcentaje;
        }
        sumaSimple += valor;
        notasValidasCount++;
      }
    });

    if (notasValidasCount === 0) return '-';

    if (tienePorcentajes && sumaPorcentajes > 0) {
      // Si la suma de porcentajes no llega al 100% todavía, promediamos en base a los porcentajes rendidos
      return (sumaPonderada / (sumaPorcentajes / 100)).toFixed(1);
    }

    return (sumaSimple / notasValidasCount).toFixed(1);
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
              id_evaluacion: notaCelda.id_evaluacion, // <-- DATO CLAVE AÑADIDO
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

  const alumnosConPromedio = alumnos.map(a => ({ ...a, promedio: calcularPromedio(a.notasUI, evaluaciones) })).filter(a => a.promedio !== '-');
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
          {evaluaciones.length > 0 && (
            <button
              onClick={() => setIsModalAdminOpen(true)}
              className="flex items-center gap-2.5 px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Administrar
            </button>
          )}

          <button
            onClick={() => setIsModalEvalOpen(true)}
            disabled={!selectedAsignaturaId}
            className="flex items-center gap-2.5 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-sm font-bold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors shadow-sm disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            Añadir Evaluación
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

      {/* PLANILLA DE NOTAS */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <th className="p-4 font-bold min-w-50 sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                  Estudiante ({alumnos.length})
                </th>

                {evaluaciones.length === 0 ? (
                  <th className="p-4 font-medium text-center text-gray-400 italic">No hay evaluaciones. Haz clic en "Añadir Evaluación".</th>
                ) : (
                  evaluaciones.map((evaluacion, i) => (
                    <th key={i} className="p-4 font-semibold text-center min-w-32 border-r border-gray-100 dark:border-gray-700" title={evaluacion.descripcion || evaluacion.nombre}>
                      <div className="flex flex-col items-center justify-center">
                        <span className="truncate block max-w-[120px] mx-auto text-sm">{evaluacion.nombre}</span>
                        {evaluacion.porcentaje && (
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-1 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full ring-1 ring-blue-200 dark:ring-blue-800">
                            {evaluacion.porcentaje}%
                          </span>
                        )}
                        {evaluacion.descripcion && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal mt-1 w-full truncate max-w-[120px] mx-auto">
                            {evaluacion.descripcion}
                          </span>
                        )}
                      </div>
                    </th>
                  ))
                )}

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
                      <span className="text-sm font-medium">Cargando nómina y columnas...</span>
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
                  </td>
                </tr>
              ) : alumnos.map((alumno, rowIndex) => {
                const promedioStr = calcularPromedio(alumno.notasUI, evaluaciones);
                const promedioNum = parseFloat(promedioStr);
                const esRojoFinal = promedioNum < 4.0;

                return (
                  <tr key={alumno.rut} className="hover:bg-blue-50/30 dark:hover:bg-gray-700/50 transition-colors group">
                    <td className="p-0 sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-700 group-hover:bg-blue-50/80 dark:group-hover:bg-gray-700/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)] transition-colors">
                      <div
                        onClick={() => { setRutFichaSeleccionada(alumno.rut); setIsFichaDrawerOpen(true); }}
                        className="px-4 py-3 flex items-center gap-3 cursor-pointer group/ficha"
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

                    {/* COLUMNAS DINÁMICAS DE NOTAS */}
                    {evaluaciones.length === 0 ? (
                      <td className="p-2 border-r border-gray-100 dark:border-gray-700 text-center bg-gray-50/30 dark:bg-gray-800/20"></td>
                    ) : (
                      alumno.notasUI.map((notaObj, colIndex) => {
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
                                className={`w-14 h-10 text-center font-bold text-sm rounded-lg border focus:outline-none transition-all ${isSaved
                                  ? (esRojo
                                    ? 'bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30 text-red-500/80 dark:text-red-400/60'
                                    : 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30 text-blue-600/80 dark:text-blue-400/60')
                                  : (valorString === ''
                                    ? 'bg-transparent border-transparent text-gray-400 dark:text-gray-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 hover:border-gray-200 dark:hover:border-gray-600'
                                    : esRojo
                                      ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                                      : 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20')
                                  }`}
                              />
                            </div>
                          </td>
                        );
                      })
                    )}

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

      {/* MODAL CREAR EVALUACIÓN */}
      {isModalEvalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-200 dark:border-gray-700 animate-fade-in-up">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Añadir Evaluación</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Ingresa los detalles de la evaluación para añadirla al libro de clases.</p>

            <form onSubmit={handleCrearEvaluacion}>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Nombre Corto *</label>
                  <input
                    type="text"
                    autoFocus
                    required
                    maxLength={40}
                    placeholder="Ej: Prueba Sumativa 1"
                    value={nombreNuevaEval}
                    onChange={(e) => setNombreNuevaEval(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Descripción / Significado</label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="Ej: Prueba sobre lectura complementaria"
                    value={descripcionNuevaEval}
                    onChange={(e) => setDescripcionNuevaEval(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Porcentaje de Ponderación (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="Ej: 25"
                    value={porcentajeNuevaEval}
                    onChange={(e) => setPorcentajeNuevaEval(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalEvalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium text-sm transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingEval || !nombreNuevaEval.trim()}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm transition-colors shadow-md shadow-blue-600/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isCreatingEval ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : null}
                  Crear Columna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ADMINISTRAR EVALUACIONES */}
      {isModalAdminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700 animate-fade-in-up flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Administrar Evaluaciones</h3>
              <button onClick={() => setIsModalAdminOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Aquí puedes eliminar columnas creadas por error. Las notas guardadas en ellas también se borrarán.</p>
            
            <div className="overflow-y-auto custom-scrollbar pr-2 flex-1 space-y-3 mb-6">
              {evaluaciones.map(ev => (
                <div key={ev.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-800 dark:text-white text-sm">{ev.nombre}</span>
                    <span className="text-xs text-gray-500">{ev.porcentaje ? `${ev.porcentaje}% - ` : ''}{ev.descripcion || 'Sin descripción'}</span>
                  </div>
                  <button 
                    onClick={() => handleEliminarEvaluacion(ev.id)}
                    disabled={isDeletingEval}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                    title="Eliminar Evaluación"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
              {evaluaciones.length === 0 && (
                <p className="text-center text-sm text-gray-500">No hay evaluaciones.</p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setIsModalAdminOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium text-sm transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER DE FICHA DE ALUMNO */}
      <FichaAlumnoDrawer
        isOpen={isFichaDrawerOpen}
        onClose={() => setIsFichaDrawerOpen(false)}
        rutAlumno={rutFichaSeleccionada}
      />

    </div>
  );
}