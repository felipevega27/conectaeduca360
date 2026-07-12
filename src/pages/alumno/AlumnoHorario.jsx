import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function AlumnoHorario() {
  const { user } = useAuth();
  const [diaFiltro, setDiaFiltro] = useState('Hoy'); 
  const [horarioCompleto, setHorarioCompleto] = useState([]);
  const [proximasEvaluaciones, setProximasEvaluaciones] = useState([]);
  const [feriadoHoy, setFeriadoHoy] = useState(null);
  const [feriadosSemana, setFeriadosSemana] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Determinar "Hoy" (Fallback a Lunes si es finde)
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diaActualReal = dias[new Date().getDay()];
  const diaHoy = diaActualReal === 'Sábado' || diaActualReal === 'Domingo' ? 'Lunes' : diaActualReal;

  useEffect(() => {
    if (user) {
      cargarDatos(user.rut);
    }
  }, [user]);

  const cargarDatos = async (rutAlumno) => {
    setIsLoading(true);
    try {
      const ahora = new Date();
      // Formato local YYYY-MM-DD para hoy
      const yyyy = ahora.getFullYear();
      const mm = String(ahora.getMonth() + 1).padStart(2, '0');
      const dd = String(ahora.getDate()).padStart(2, '0');
      const hoyIso = `${yyyy}-${mm}-${dd}`;

      // 0. Verificar Feriados de la semana actual
      const fechasSemanaActual = [];
      const tempDate = new Date();
      let currentDay = tempDate.getDay() || 7; 
      
      // Si es fin de semana (Sábado o Domingo), mostrar la semana que viene
      if (currentDay > 5) {
         tempDate.setDate(tempDate.getDate() + (8 - currentDay));
         currentDay = 1; // Ajustamos a Lunes
      }

      tempDate.setDate(tempDate.getDate() - currentDay + 1); // Obtener el Lunes
      
      for (let i = 0; i < 5; i++) {
         const f = new Date(tempDate);
         f.setDate(tempDate.getDate() + i);
         // Extraer fecha local sin usar toISOString para evitar desfase de UTC (4 hrs en Chile)
         const fYear = f.getFullYear();
         const fMonth = String(f.getMonth() + 1).padStart(2, '0');
         const fDay = String(f.getDate()).padStart(2, '0');
         fechasSemanaActual.push(`${fYear}-${fMonth}-${fDay}`);
      }

      const { data: feriadosData } = await supabase
        .from('feriados')
        .select('*')
        .in('fecha', fechasSemanaActual);
      
      const feriadosDict = {};
      let feriadoHoyData = null;

      if (feriadosData) {
        feriadosData.forEach(f => {
           if (f.fecha === hoyIso) feriadoHoyData = f;
           const dateObj = new Date(f.fecha + 'T12:00:00'); // Evitar timezone shift
           const diaNombre = dias[dateObj.getDay()];
           feriadosDict[diaNombre] = f.nombre;
        });
      }

      setFeriadoHoy(feriadoHoyData);
      setFeriadosSemana(feriadosDict);

      // 1. Obtener curso
      const { data: matricula } = await supabase.from('matriculas').select('id_curso').eq('rut_alumno', rutAlumno).maybeSingle();
      if (!matricula) {
        setIsLoading(false);
        return;
      }
      const idCurso = matricula.id_curso;

      // 2. Horario Completo del Curso
      const { data: horarioData } = await supabase
        .from('horarios')
        .select('bloque, hora_inicio, hora_fin, sala, dia_semana, asignaturas(nombre), perfiles(nombre)')
        .eq('id_curso', idCurso)
        .order('hora_inicio', { ascending: true });

      const horaActualStr = ahora.toTimeString().substring(0, 5); // "14:30"

      if (horarioData) {
        const cronograma = horarioData.map((h, index) => {
          let estado = 'Pendiente';
          if (diaActualReal === h.dia_semana) {
             if (h.hora_fin < horaActualStr) estado = 'Terminada';
             else if (h.hora_inicio <= horaActualStr && h.hora_fin >= horaActualStr) estado = 'En Curso';
          } else {
             estado = 'Pendiente'; // Otros días
          }
          
          return {
            id: index,
            dia: h.dia_semana,
            bloque: h.bloque || `Bloque ${index + 1}`,
            hora: `${h.hora_inicio.substring(0,5)} - ${h.hora_fin.substring(0,5)}`,
            asignatura: h.asignaturas?.nombre || 'Asignatura',
            sala: h.sala || 'Por definir',
            profesor: h.perfiles?.nombre || 'Profesor no asignado',
            estado,
            hora_inicio: h.hora_inicio
          };
        });
        setHorarioCompleto(cronograma);
      }

      // 3. Próximas Evaluaciones
      const { data: asigs } = await supabase.from('asignaturas').select('id, nombre').eq('id_curso', idCurso);
      if (asigs && asigs.length > 0) {
        const ids = asigs.map(a => a.id);
        
        const { data: evals } = await supabase
          .from('evaluaciones')
          .select('id, nombre, fecha, id_asignatura')
          .in('id_asignatura', ids)
          .gte('fecha', hoyIso)
          .order('fecha', { ascending: true })
          .limit(5);

        if (evals) {
           const evalsFormateadas = evals.map(e => {
             const asigNombre = asigs.find(a => a.id === e.id_asignatura)?.nombre;
             const fechaEval = new Date(e.fecha + 'T12:00:00'); // Mediodía para evitar UTC shift
             
             // Diferencia en días
             const diffTime = fechaEval - ahora;
             const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
             
             return {
                id: e.id,
                asignatura: asigNombre,
                tipo: 'Evaluación',
                tema: e.nombre,
                fecha: fechaEval.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' }),
                diasRestantes: diffDays > 0 ? diffDays : 0,
                urgente: diffDays <= 7
             };
           });
           setProximasEvaluaciones(evalsFormateadas);
        }
      }
    } catch (err) {
      console.error('Error cargando horario:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando tu horario...</p>
        </div>
      </div>
    );
  }

  // Filtrar horario según selección
  let horarioFiltrado = [];
  if (diaFiltro === 'Hoy') {
     horarioFiltrado = horarioCompleto.filter(h => h.dia === diaHoy).sort((a,b) => a.hora_inicio.localeCompare(b.hora_inicio));
  }

  // Para la vista semanal, agrupamos por día
  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const horarioPorDia = {};
  diasSemana.forEach(d => {
    horarioPorDia[d] = horarioCompleto.filter(h => h.dia === d).sort((a,b) => a.hora_inicio.localeCompare(b.hora_inicio));
  });

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      
      {/* CABECERA */}
      <div className="mb-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Mi Horario y Evaluaciones</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Ubica tus salas de clases y organiza tus jornadas de estudio.</p>
        </div>
        
        {/* Filtro rápido */}
        <div className="flex bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <button 
            onClick={() => setDiaFiltro('Hoy')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${diaFiltro === 'Hoy' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            Clases de Hoy
          </button>
          <button 
            onClick={() => setDiaFiltro('Semanal')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${diaFiltro === 'Semanal' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            Ver Semanal
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* BLOQUE IZQUIERDO: CRONOGRAMA DE CLASES */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                {diaFiltro === 'Hoy' ? 'Bloques de Clase para Hoy' : 'Malla Horaria Semanal'}
              </h2>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold capitalize">
                {diaFiltro === 'Hoy' ? diaHoy : 'Lunes a Viernes'}
              </span>
            </div>

            <div className="p-4">
              {diaFiltro === 'Hoy' ? (
                // VISTA: HOY
                feriadoHoy ? (
                  <div className="flex flex-col items-center justify-center py-10 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-800">
                    <span className="text-4xl mb-3">🏖️</span>
                    <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-300">¡Es Feriado!</h3>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1 capitalize text-center px-4">{feriadoHoy.nombre}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {horarioFiltrado.length === 0 ? (
                       <p className="text-sm text-gray-500 text-center py-6">No hay clases programadas para este día.</p>
                    ) : (
                      horarioFiltrado.map((clase, idx) => (
                      <div 
                        key={idx} 
                        className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                          clase.estado === 'En Curso'
                          ? 'border-indigo-300 dark:border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-400/30'
                          : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'
                        }`}
                      >
                        {/* Bloque / Horario */}
                        <div className="flex items-center gap-3 min-w-[140px]">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide ${
                            clase.estado === 'En Curso' ? 'bg-indigo-600 text-white' :
                            clase.estado === 'Terminada' ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 line-through' :
                            'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                          }`}>
                            {clase.bloque.split(' ')[0]}
                          </span>
                          <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400">{clase.hora}</span>
                        </div>

                        {/* Asignatura y Ubicación */}
                        <div className="flex-1">
                          <h4 className={`text-base font-bold ${clase.estado === 'Terminada' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                            {clase.asignatura}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{clase.profesor}</p>
                        </div>

                        {/* Ubicación de la Sala */}
                        <div className="text-left sm:text-right">
                          <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold ${
                            clase.estado === 'En Curso' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}>
                            {clase.sala}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                )
              ) : (
                // VISTA: SEMANAL
                <div className="space-y-6">
                  {diasSemana.map(dia => (
                     <div key={dia} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                       <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                         <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300">{dia}</h3>
                         {feriadosSemana[dia] && (
                           <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full uppercase tracking-wider">Feriado</span>
                         )}
                       </div>
                       <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {feriadosSemana[dia] ? (
                            <div className="px-4 py-6 flex flex-col items-center justify-center bg-emerald-50/30 dark:bg-emerald-900/10">
                               <span className="text-2xl mb-1">🏖️</span>
                               <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 text-center capitalize">{feriadosSemana[dia]}</p>
                            </div>
                          ) : horarioPorDia[dia].length === 0 ? (
                            <p className="text-xs text-gray-400 dark:text-gray-500 px-4 py-3 italic">Sin clases este día.</p>
                          ) : (
                            horarioPorDia[dia].map((clase, idx) => (
                              <div key={idx} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <div className="flex items-center gap-2 w-32 shrink-0">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                    {clase.bloque.split(' ')[0]}
                                  </span>
                                  <span className="text-[10px] font-mono text-gray-500">{clase.hora}</span>
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{clase.asignatura}</p>
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{clase.profesor}</p>
                                </div>
                                <div className="text-left sm:text-right">
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                                    {clase.sala}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                       </div>
                     </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BLOQUE DERECHO: AGENDA DE PRUEBAS */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Próximas Evaluaciones
              </h2>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {proximasEvaluaciones.length === 0 ? (
                 <p className="text-sm text-gray-500 text-center py-6">No hay evaluaciones programadas pronto.</p>
              ) : (
                proximasEvaluaciones.map((evaluacion) => (
                  <div 
                    key={evaluacion.id} 
                    className={`border rounded-xl p-4 transition-all ${
                      evaluacion.urgente 
                      ? 'border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-950/10' 
                      : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase">{evaluacion.asignatura}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        evaluacion.urgente ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                      }`}>
                        {evaluacion.tipo}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 capitalize">"{evaluacion.tema}"</p>
                    
                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 border-t border-dashed border-gray-100 dark:border-gray-700 pt-2.5">
                      <span className="font-medium capitalize">{evaluacion.fecha}</span>
                      <span className={`font-bold ${evaluacion.urgente ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {evaluacion.diasRestantes === 0 ? '¡Hoy!' : evaluacion.diasRestantes === 1 ? '¡Mañana!' : `En ${evaluacion.diasRestantes} días`}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}