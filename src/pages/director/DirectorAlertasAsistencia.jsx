import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FichaAlumnoDrawer from '../../components/FichaAlumnoDrawer';
import { supabase } from '../../config/supabaseClient';
import { SkeletonRow } from '../../components/SkeletonLoader';

export default function DirectorAlertasAsistencia() {
  const navigate = useNavigate();
  const [isFichaDrawerOpen, setIsFichaDrawerOpen] = useState(false);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  
  // --- ESTADOS DE BASE DE DATOS ---
  const [alumnosCriticos, setAlumnosCriticos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const cargarInasistenciaCritica = async () => {
    try {
      setIsLoading(true);

      // 1. Traer todos los alumnos y sus matrículas
      const { data: perfiles } = await supabase.from('perfiles').select('*').eq('rol', 'alumno');
      const { data: asistencia } = await supabase.from('asistencia_alumnos').select('*').order('fecha', { ascending: false });

      const listaCritica = [];

      // 2. Analizar la asistencia alumno por alumno
      perfiles?.forEach(alumno => {
        // Filtramos solo los registros de este alumno
        const asisAlumno = asistencia?.filter(a => a.rut_alumno === alumno.rut) || [];
        
        if (asisAlumno.length > 0) {
          const totalDias = asisAlumno.length;
          const ausencias = asisAlumno.filter(a => a.estado === 'Ausente').length;
          
          // Cálculo de porcentaje
          const porcentajeReal = Math.round(((totalDias - ausencias) / totalDias) * 100);

          // Si tiene menos del 85% de asistencia, entra a esta tabla de riesgo
          if (porcentajeReal < 85) {
            
            // Determinar el nivel de gravedad
            let estadoRiesgo = 'Alerta Media';
            if (porcentajeReal < 50) estadoRiesgo = 'Crítico';
            else if (porcentajeReal < 70) estadoRiesgo = 'Alerta Alta';

            // Armar el visual de los "Últimos 5 días" (✅ o ❌)
            // Como ya ordenamos por fecha descendente en la consulta SQL, tomamos los primeros 5 y los invertimos para leer de izq a der.
            const ultimos5 = asisAlumno.slice(0, 5).reverse();
            const stringDias = ultimos5.map(a => a.estado === 'Ausente' ? '❌' : '✅').join('');
            
            // Rellenar con guiones si tiene menos de 5 registros en el sistema
            const visualDias = stringDias.padEnd(5, '➖');

            listaCritica.push({
              id: alumno.rut,
              rut: alumno.rut,
              nombre: alumno.nombre,
              asistencia: `${porcentajeReal}%`,
              estado: estadoRiesgo,
              ultimos5Dias: visualDias,
              porcentajeNum: porcentajeReal // Lo guardamos oculto para ordenar la tabla
            });
          }
        }
      });

      // 3. Ordenar la tabla mostrando a los más críticos (menor porcentaje) arriba
      listaCritica.sort((a, b) => a.porcentajeNum - b.porcentajeNum);
      
      setAlumnosCriticos(listaCritica);

    } catch (error) {
      console.error('Error al cargar inasistencias:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarInasistenciaCritica();
  }, []);

  const abrirFicha = (alumno) => {
    setAlumnoSeleccionado(alumno);
    setIsFichaDrawerOpen(true);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      {/* Botón Volver y Título */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="group w-fit flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-blue-600 transition-all"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Volver atrás
        </button>
        <div className="hidden sm:block h-6 w-px bg-gray-300 dark:bg-gray-700"></div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Alerta de Inasistencia Crítica</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Estudiantes bajo el 85% de asistencia. Se requiere contactar a los apoderados.</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400">
                <th className="p-4 whitespace-nowrap">Alumno</th>
                <th className="p-4 whitespace-nowrap">RUT</th>
                <th className="p-4 whitespace-nowrap">Asistencia Global</th>
                <th className="p-4 text-center whitespace-nowrap">Últimos Registros</th>
                <th className="p-4 whitespace-nowrap">Gravedad</th>
                <th className="p-4 text-right whitespace-nowrap">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm text-gray-700 dark:text-gray-300">
              {isLoading ? (
                <>
                  <tr><td colSpan="6" className="p-4"><SkeletonRow /></td></tr>
                  <tr><td colSpan="6" className="p-4"><SkeletonRow /></td></tr>
                  <tr><td colSpan="6" className="p-4"><SkeletonRow /></td></tr>
                  <tr><td colSpan="6" className="p-4"><SkeletonRow /></td></tr>
                </>
              ) : alumnosCriticos.length > 0 ? (
                alumnosCriticos.map((alumno) => (
                  <tr key={alumno.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="p-4 font-medium text-gray-800 dark:text-gray-200">{alumno.nombre}</td>
                    <td className="p-4 text-gray-500 dark:text-gray-400">{alumno.rut}</td>
                    <td className="p-4 font-bold text-red-600 dark:text-red-400 text-lg">{alumno.asistencia}</td>
                    <td className="p-4 text-center tracking-[0.3em] text-base">{alumno.ultimos5Dias}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                        alumno.estado === 'Crítico' 
                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50' 
                        : alumno.estado === 'Alerta Alta'
                        ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50'
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50'
                      }`}>
                        {alumno.estado}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => abrirFicha(alumno)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm transition-colors border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg"
                      >
                        Ver Ficha Integral
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="p-10 text-center text-emerald-600 dark:text-emerald-400 font-medium">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ¡Excelente! No hay alumnos con inasistencia crítica (bajo el 85%) en este momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AQUI VA NUESTRO DRAWER */}
      <FichaAlumnoDrawer 
        isOpen={isFichaDrawerOpen} 
        onClose={() => setIsFichaDrawerOpen(false)} 
        rutAlumno={alumnoSeleccionado?.rut} 
      />
    </div>
  );
}