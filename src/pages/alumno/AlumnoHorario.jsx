import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';

export default function AlumnoHorario() {
  const [diaFiltro, setDiaFiltro] = useState('Hoy'); 
  const [cronogramaHoy, setCronogramaHoy] = useState([]);
  const [proximasEvaluaciones, setProximasEvaluaciones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON);
      cargarDatos(user.rut);
    }
  }, []);

  const cargarDatos = async (rutAlumno) => {
    setIsLoading(true);
    try {
      // 1. Obtener curso
      const { data: matricula } = await supabase.from('matriculas').select('id_curso').eq('rut_alumno', rutAlumno).maybeSingle();
      if (!matricula) {
        setIsLoading(false);
        return;
      }
      const idCurso = matricula.id_curso;

      // 2. Horario de Hoy
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const hoy = dias[new Date().getDay()]; 

      const { data: horarioData } = await supabase
        .from('horarios')
        .select('bloque, hora_inicio, hora_fin, sala, asignaturas(nombre), perfiles(nombre)')
        .eq('id_curso', idCurso)
        .eq('dia_semana', hoy === 'Sábado' || hoy === 'Domingo' ? 'Lunes' : hoy) // Fallback Lunes si es finde
        .order('hora_inicio', { ascending: true });

      const ahora = new Date();
      const horaActualStr = ahora.toTimeString().substring(0, 5); // "14:30"

      if (horarioData) {
        const cronograma = horarioData.map((h, index) => {
          let estado = 'Pendiente';
          if (h.hora_fin < horaActualStr) estado = 'Terminada';
          else if (h.hora_inicio <= horaActualStr && h.hora_fin >= horaActualStr) estado = 'En Curso';
          
          return {
            id: index,
            bloque: h.bloque || `Bloque ${index + 1}`,
            hora: `${h.hora_inicio.substring(0,5)} - ${h.hora_fin.substring(0,5)}`,
            asignatura: h.asignaturas?.nombre || 'Asignatura',
            sala: h.sala || 'Por definir',
            profesor: h.perfiles?.nombre || 'Profesor no asignado',
            estado
          };
        });
        setCronogramaHoy(cronograma);
      }

      // 3. Próximas Evaluaciones
      const { data: asigs } = await supabase.from('asignaturas').select('id, nombre').eq('id_curso', idCurso);
      if (asigs && asigs.length > 0) {
        const ids = asigs.map(a => a.id);
        const hoyIso = ahora.toISOString().split('T')[0];
        
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
    return <div className="p-8 text-center text-gray-500">Cargando tu horario...</div>;
  }

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
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${diaFiltro === 'Hoy' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'}`}
          >
            Clases de Hoy
          </button>
          <button 
            onClick={() => alert('Abriendo vista de malla horaria completa de Lunes a Viernes...')}
            className="px-3 py-1.5 text-xs font-bold rounded-md text-gray-600 dark:text-gray-400"
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
                Bloques de Clase para Hoy
              </h2>
              <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold capitalize">
                {new Date().toLocaleDateString('es-CL', { weekday: 'long' })}
              </span>
            </div>

            <div className="p-4 space-y-3">
              {cronogramaHoy.length === 0 ? (
                 <p className="text-sm text-gray-500 text-center py-6">No hay clases programadas para hoy o no estás asignado a un curso con horario.</p>
              ) : (
                cronogramaHoy.map((clase, idx) => (
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