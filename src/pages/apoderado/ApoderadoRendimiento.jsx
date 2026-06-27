import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';

export default function ApoderadoRendimiento() {
  const [pupilos, setPupilos] = useState([]);
  const [pupiloActivo, setPupiloActivo] = useState(null);
  const [rendimiento, setRendimiento] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Inicializar estado desde localStorage
  useEffect(() => {
    const pActivoStr = localStorage.getItem('pupiloActivo');
    const pListaStr = localStorage.getItem('apoderadoPupilos');
    if (pActivoStr) setPupiloActivo(JSON.parse(pActivoStr));
    if (pListaStr) setPupilos(JSON.parse(pListaStr));
  }, []);

  // Escuchar si el pupilo cambia en otra vista (opcional, pero útil)
  useEffect(() => {
    const handlePupiloChanged = () => {
      const pActivoStr = localStorage.getItem('pupiloActivo');
      if (pActivoStr) setPupiloActivo(JSON.parse(pActivoStr));
    };
    window.addEventListener('pupiloChanged', handlePupiloChanged);
    return () => window.removeEventListener('pupiloChanged', handlePupiloChanged);
  }, []);

  // Cargar las calificaciones cuando cambie el pupilo activo
  useEffect(() => {
    if (pupiloActivo) {
      cargarCalificaciones(pupiloActivo.rut);
    }
  }, [pupiloActivo]);

  const cargarCalificaciones = async (rutAlumno) => {
    setIsLoading(true);
    try {
      // 1. Obtener matrícula
      const { data: matData } = await supabase
        .from('matriculas')
        .select('id_curso')
        .eq('rut_alumno', rutAlumno)
        .maybeSingle();

      if (!matData) {
        setRendimiento([]);
        return;
      }

      // 2. Obtener asignaturas
      const { data: asigData } = await supabase
        .from('asignaturas')
        .select('id, nombre, id_curso, rut_profesor')
        .eq('id_curso', matData.id_curso);

      // 3. Obtener nombres de profesores
      let profesores = {};
      if (asigData && asigData.length > 0) {
        const ruts = [...new Set(asigData.map(a => a.rut_profesor).filter(Boolean))];
        if (ruts.length > 0) {
          const { data: profData } = await supabase
            .from('perfiles')
            .select('rut, nombre')
            .in('rut', ruts);
          profData?.forEach(p => { profesores[p.rut] = p.nombre; });
        }
      }

      // 4. Obtener evaluaciones del curso
      const { data: evalData } = await supabase
        .from('evaluaciones')
        .select('id, id_asignatura')
        .eq('id_curso', matData.id_curso);

      // 5. Obtener notas
      const { data: califData } = await supabase
        .from('notas')
        .select('id_evaluacion, nota')
        .eq('rut_alumno', rutAlumno);

      const rendimientosArr = asigData?.map(asig => {
        const evalsAsig = evalData?.filter(e => e.id_asignatura === asig.id) || [];
        const notasAsig = evalsAsig.map(e => {
          const c = califData?.find(x => x.id_evaluacion === e.id);
          return c ? c.nota : '-';
        });

        // Completamos con '-' hasta tener 4 casilleros
        const padding = 4 - notasAsig.length;
        if (padding > 0) {
          notasAsig.push(...Array(padding).fill('-'));
        }

        const notasValidas = notasAsig.filter(n => typeof n === 'number');
        const promedio = notasValidas.length > 0 
          ? notasValidas.reduce((a, b) => a + b, 0) / notasValidas.length 
          : 0;

        let estado = 'Sin Evaluación';
        if (promedio > 0) {
          if (promedio >= 6.0) estado = 'Excelente';
          else if (promedio >= 5.0) estado = 'Óptimo';
          else if (promedio >= 4.0) estado = 'Precaución';
          else estado = 'Crítico';
        }

        return {
          id: asig.id,
          asignatura: asig.nombre,
          profesor: profesores[asig.rut_profesor] || 'Profesor no asignado',
          promedio,
          estado,
          notas: notasAsig
        };
      }) || [];

      setRendimiento(rendimientosArr);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCambiarPupilo = (e) => {
    const seleccionado = pupilos.find(p => p.rut === e.target.value);
    setPupiloActivo(seleccionado);
    localStorage.setItem('pupiloActivo', JSON.stringify(seleccionado));
    window.dispatchEvent(new Event('pupiloChanged'));
  };

  const promedioGeneral = rendimiento.filter(r => r.promedio > 0).length > 0 
    ? (rendimiento.filter(r => r.promedio > 0).reduce((acc, curr) => acc + curr.promedio, 0) / rendimiento.filter(r => r.promedio > 0).length).toFixed(1)
    : '-';
  const asignaturasRiesgo = rendimiento.filter(r => r.promedio > 0 && r.promedio < 4.0).length;

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando rendimiento...</div>;
  }

  if (!pupiloActivo) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm text-center">
          <p className="text-gray-500">No tienes pupilos asignados a tu cuenta.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Rendimiento Académico</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Informe oficial de calificaciones parciales.</p>
        </div>
        
        {/* Selector de Pupilo */}
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-2 pl-3 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
            {pupiloActivo.iniciales || pupiloActivo.nombre.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
          </div>
          <div className="flex flex-col flex-1 pr-2">
            {pupilos.length > 1 ? (
              <select 
                value={pupiloActivo.rut} 
                onChange={handleCambiarPupilo}
                className="bg-transparent text-sm font-bold text-gray-800 dark:text-gray-200 leading-none outline-none cursor-pointer appearance-none"
              >
                {pupilos.map(p => (
                  <option key={p.rut} value={p.rut} className="text-gray-800">{p.nombre}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-none">{pupiloActivo.nombre}</span>
            )}
            <span className="text-[10px] text-gray-500 uppercase font-semibold mt-0.5">{pupiloActivo.curso}</span>
          </div>
          {pupilos.length > 1 && (
            <svg className="w-5 h-5 text-gray-400 pointer-events-none mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          )}
        </div>
      </div>

      {/* KPI'S ANALÍTICOS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex flex-col justify-center">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Promedio General</p>
          <div className="flex items-end gap-3">
            <h2 className="text-5xl font-black text-indigo-600 dark:text-indigo-400">{promedioGeneral}</h2>
            <span className="text-sm font-medium text-emerald-500 mb-1.5 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              En alza
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Riesgo Repitencia</p>
            <h2 className={`text-3xl font-black ${asignaturasRiesgo > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {asignaturasRiesgo} <span className="text-lg text-gray-500 font-medium">Asignaturas</span>
            </h2>
          </div>
        </div>

        <div className="bg-linear-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 shadow-sm text-white flex flex-col justify-center relative overflow-hidden">
          <svg className="absolute -right-4 -top-4 w-24 h-24 text-indigo-500/50" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-1 z-10">Descargar Informe</p>
          <h2 className="text-xl font-bold mb-3 z-10">Certificado de Notas Parciales</h2>
          <button className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold py-2 px-4 rounded-lg transition-colors z-10 w-max backdrop-blur-sm">
            Generar PDF Oficial
          </button>
        </div>
      </div>

      {/* TABLA OFICIAL DE RENDIMIENTO */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 font-bold">
                <th className="p-5">Asignatura / Docente</th>
                <th className="p-5 text-center">N1</th>
                <th className="p-5 text-center">N2</th>
                <th className="p-5 text-center">N3</th>
                <th className="p-5 text-center">N4</th>
                <th className="p-5 text-center bg-gray-100/50 dark:bg-gray-800">Promedio</th>
                <th className="p-5">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rendimiento.length === 0 ? (
                <tr><td colSpan="7" className="p-8 text-center text-gray-500">No hay asignaturas registradas para este estudiante.</td></tr>
              ) : (
                rendimiento.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="p-5">
                      <p className="font-bold text-gray-800 dark:text-gray-200">{item.asignatura}</p>
                      <p className="text-xs text-gray-500">{item.profesor}</p>
                    </td>
                    {item.notas.map((nota, idx) => (
                      <td key={idx} className={`p-5 text-center font-semibold ${nota < 4.0 && nota !== '-' ? 'text-red-600' : 'text-gray-600 dark:text-gray-300'}`}>
                        {nota}
                      </td>
                    ))}
                    <td className={`p-5 text-center font-black text-lg bg-gray-50/50 dark:bg-gray-800/50 ${item.promedio > 0 && item.promedio < 4.0 ? 'text-red-600' : 'text-blue-600 dark:text-blue-400'}`}>
                      {item.promedio > 0 ? item.promedio.toFixed(1) : '-'}
                    </td>
                    <td className="p-5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.estado === 'Excelente' ? 'bg-emerald-100 text-emerald-700' :
                        item.estado === 'Óptimo' ? 'bg-blue-100 text-blue-700' :
                        item.estado === 'Precaución' ? 'bg-amber-100 text-amber-700' :
                        item.estado === 'Sin Evaluación' ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' :
                        'bg-red-100 text-red-700 animate-pulse'
                      }`}>
                        {item.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}