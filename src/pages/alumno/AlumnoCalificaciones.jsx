import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';

export default function AlumnoCalificaciones() {
  const [asignaturas, setAsignaturas] = useState([]);
  const [promedioGeneral, setPromedioGeneral] = useState('0.0');
  const [asignaturasRiesgo, setAsignaturasRiesgo] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON);
      cargarCalificaciones(user.rut);
    }
  }, []);

  const cargarCalificaciones = async (rutAlumno) => {
    setIsLoading(true);
    try {
      // 1. Obtener matrícula
      const { data: matricula } = await supabase
        .from('matriculas')
        .select('id_curso')
        .eq('rut_alumno', rutAlumno)
        .maybeSingle();
      
      if (!matricula) {
        setIsLoading(false);
        return;
      }

      // 2. Obtener asignaturas del curso
      const { data: asigData } = await supabase
        .from('asignaturas')
        .select('id, nombre, perfiles(nombre)')
        .eq('id_curso', matricula.id_curso);
      
      if (!asigData || asigData.length === 0) {
        setIsLoading(false);
        return;
      }

      const idsAsig = asigData.map(a => a.id);

      // 3. Obtener evaluaciones
      const { data: evalData } = await supabase
        .from('evaluaciones')
        .select('id, nombre, porcentaje, id_asignatura')
        .in('id_asignatura', idsAsig);

      // 4. Obtener notas del alumno
      const { data: califData } = await supabase
        .from('notas')
        .select('id_evaluacion, nota')
        .eq('rut_alumno', rutAlumno);

      let sumPromedios = 0;
      let countPromedios = 0;
      let countRiesgo = 0;

      const materiasFormateadas = asigData.map(asig => {
        const evalDeAsig = evalData?.filter(e => e.id_asignatura === asig.id) || [];
        const notasFormateadas = [];
        let sumaNotas = 0;
        
        evalDeAsig.forEach(e => {
          const calif = califData?.find(c => c.id_evaluacion === e.id);
          if (calif) {
            notasFormateadas.push({
              id: e.id,
              evaluacion: e.nombre,
              nota: calif.nota,
              ponderacion: e.porcentaje ? `${e.porcentaje}%` : '-'
            });
            sumaNotas += calif.nota;
          }
        });

        const promedio = notasFormateadas.length > 0 ? sumaNotas / notasFormateadas.length : 0;
        
        if (promedio > 0) {
          sumPromedios += promedio;
          countPromedios++;
          if (promedio < 4.0) countRiesgo++;
        }

        return {
          id: asig.id,
          asignatura: asig.nombre,
          docente: asig.perfiles?.nombre || 'Profesor no asignado',
          notas: notasFormateadas,
          promedio: promedio
        };
      });

      setAsignaturas(materiasFormateadas);
      setPromedioGeneral(countPromedios > 0 ? (sumPromedios / countPromedios).toFixed(1) : '0.0');
      setAsignaturasRiesgo(countRiesgo);

    } catch (error) {
      console.error('Error cargando calificaciones:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando tus calificaciones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      
      {/* CABECERA */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Mis Calificaciones</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Revisa tu rendimiento académico del Primer Semestre.</p>
      </div>

      {/* KPI'S DEL ALUMNO */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all">
          <div>
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Promedio General</p>
            <h2 className="text-3xl font-black text-blue-600 dark:text-blue-400">{promedioGeneral}</h2>
          </div>
          <div className="h-12 w-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all">
          <div>
            <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Asignaturas en Riesgo</p>
            <h2 className={`text-3xl font-black ${asignaturasRiesgo > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{asignaturasRiesgo}</h2>
          </div>
          <div className={`h-12 w-12 rounded-full flex items-center justify-center ${asignaturasRiesgo > 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
        </div>
      </div>

      {/* LISTADO DE ASIGNATURAS */}
      <div className="space-y-4">
        {asignaturas.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500">No hay asignaturas registradas.</p>
          </div>
        ) : (
          asignaturas.map((materia) => (
            <div key={materia.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md">
              
              {/* Cabecera de la Asignatura */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-white">{materia.asignatura}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{materia.docente}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">Promedio</p>
                    <p className={`text-2xl font-black ${materia.promedio === 0 ? 'text-gray-400' : materia.promedio >= 4.0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                      {materia.promedio > 0 ? materia.promedio.toFixed(1) : '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Desglose de Notas */}
              <div className="p-5">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-3">Evaluaciones</h4>
                {materia.notas.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">Aún no tienes notas registradas en esta asignatura.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {materia.notas.map((nota) => (
                      <div key={nota.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate" title={nota.evaluacion}>
                            {nota.evaluacion.length > 25 ? nota.evaluacion.substring(0, 25) + '...' : nota.evaluacion}
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">Ponderación: {nota.ponderacion}</span>
                        </div>
                        <div className={`flex items-center justify-center w-10 h-10 rounded-lg font-black text-sm ${
                          nota.nota >= 4.0 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        }`}>
                          {nota.nota.toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
}