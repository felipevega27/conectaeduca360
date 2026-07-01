import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';

export default function AlumnoAnotaciones() {
  const [anotaciones, setAnotaciones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON);
      cargarAnotaciones(user.rut);
    }
  }, []);

  const cargarAnotaciones = async (rutAlumno) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('anotaciones')
        .select('id, fecha, tipo, descripcion, perfiles!rut_profesor(nombre)')
        .eq('rut_alumno', rutAlumno)
        .order('fecha', { ascending: false });

      if (data) {
        const formateadas = data.map(anot => {
          const d = new Date(anot.fecha);
          return {
            id: anot.id,
            fecha: d.toLocaleDateString('es-CL', { year: 'numeric', month: 'short', day: '2-digit' }),
            tipo: anot.tipo || 'observacion',
            profesor: anot.perfiles?.nombre || 'Inspectoría',
            asignatura: 'Convivencia Escolar', // No hay asignatura vinculada por ahora
            descripcion: anot.descripcion
          };
        });
        setAnotaciones(formateadas);
      }

    } catch (err) {
      console.error('Error cargando anotaciones:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPositivas = anotaciones.filter(a => a.tipo.toLowerCase() === 'positiva').length;
  const totalNegativas = anotaciones.filter(a => a.tipo.toLowerCase() === 'negativa').length;
  const totalObservaciones = anotaciones.filter(a => a.tipo.toLowerCase() === 'observacion').length;

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando tu hoja de vida...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      
      {/* CABECERA */}
      <div className="mb-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Hoja de Vida Escolar</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Historial oficial de convivencia y desarrollo personal (RICE).</p>
        </div>
      </div>

      {/* KPI'S RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        
        {/* Anotaciones Positivas */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all">
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Anotaciones Positivas</p>
            <h2 className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{totalPositivas}</h2>
          </div>
          <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
          </div>
        </div>

        {/* Observaciones (Neutras) */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all">
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Observaciones</p>
            <h2 className="text-3xl font-black text-amber-500 dark:text-amber-400">{totalObservaciones}</h2>
          </div>
          <div className="h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>

        {/* Anotaciones Negativas */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all">
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Faltas / Negativas</p>
            <h2 className="text-3xl font-black text-red-600 dark:text-red-400">{totalNegativas}</h2>
          </div>
          <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-500 dark:text-red-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
        </div>

      </div>

      {/* LÍNEA DE TIEMPO (TIMELINE) DE ANOTACIONES */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 sm:p-8">
        <h2 className="text-base font-bold text-gray-800 dark:text-white mb-8 border-b border-gray-100 dark:border-gray-700 pb-4">Desglose de Convivencia</h2>
        
        <div className="relative border-l-2 border-gray-100 dark:border-gray-700 ml-3 sm:ml-4 space-y-10">
          
          {anotaciones.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">No tienes anotaciones en tu hoja de vida.</p>
          ) : (
            anotaciones.map((anotacion) => {
              // Configuramos los colores según el tipo de anotación
              const tipoStr = anotacion.tipo.toLowerCase();
              const isPositiva = tipoStr === 'positiva';
              const isNegativa = tipoStr === 'negativa';
              
              const colorDot = isPositiva ? 'bg-emerald-500 ring-emerald-100 dark:ring-emerald-900/50' : isNegativa ? 'bg-red-500 ring-red-100 dark:ring-red-900/50' : 'bg-amber-500 ring-amber-100 dark:ring-amber-900/50';
              const colorBadge = isPositiva ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50' : isNegativa ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50';
              
              return (
                <div key={anotacion.id} className="relative pl-8 sm:pl-10">
                  {/* Punto de la línea de tiempo */}
                  <span className={`absolute -left-2.25 top-1.5 w-4 h-4 rounded-full ring-4 ${colorDot}`}></span>
                  
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${colorBadge}`}>
                        {tipoStr}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{anotacion.asignatura}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {anotacion.fecha}
                    </span>
                  </div>
                  
                  <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl p-4 mt-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-medium">"{anotacion.descripcion}"</p>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold text-[10px]">
                        {anotacion.profesor.split(' ')[0]?.charAt(0) || 'P'}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Ingresado por: <span className="text-gray-700 dark:text-gray-300">{anotacion.profesor}</span></p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
        </div>
        
        {/* Final de la línea de tiempo */}
        <div className="relative pl-8 sm:pl-10 mt-10">
          <span className="absolute -left-1.25 top-1 w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
          <p className="text-xs font-medium text-gray-400 dark:text-gray-500 italic">Inicio del año escolar (Marzo 2026)</p>
        </div>

      </div>

    </div>
  );
}