import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';

export default function ProfesorJefatura() {
  const [user, setUser] = useState(null);
  const [curso, setCurso] = useState(null);
  const [alumnos, setAlumnos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Stats
  const [promedioCurso, setPromedioCurso] = useState(0);
  const [asistenciaCurso, setAsistenciaCurso] = useState(0);
  const [totalAnotacionesNegativas, setTotalAnotacionesNegativas] = useState(0);

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      cargarJefatura(parsedUser.rut);
    } else {
      setIsLoading(false);
    }
  }, []);

  const cargarJefatura = async (rutProfesor) => {
    try {
      setIsLoading(true);
      // 1. Buscar si es profesor jefe de algún curso
      const { data: cursoData, error: cursoError } = await supabase
        .from('cursos')
        .select('*')
        .eq('rut_profesor_jefe', rutProfesor)
        .single();

      if (cursoError && cursoError.code !== 'PGRST116') {
        throw cursoError;
      }

      if (cursoData) {
        setCurso(cursoData);
        // 2. Cargar alumnos de ese curso
        const { data: matriculas, error: alumnosError } = await supabase
          .from('matriculas')
          .select('rut_alumno, condicion_estudiante')
          .eq('id_curso', cursoData.id);

        if (alumnosError) throw alumnosError;

        let alumnosData = [];
        if (matriculas && matriculas.length > 0) {
          const ruts = matriculas.map(m => m.rut_alumno);
          const { data: perfiles } = await supabase.from('perfiles').select('rut, nombre, email, avatar_url').in('rut', ruts);

          alumnosData = matriculas.map(m => {
            const perfil = perfiles?.find(p => p.rut === m.rut_alumno);
            return {
              id: m.rut_alumno,
              rut: m.rut_alumno,
              nombre: perfil?.nombre || 'Sin Nombre',
              email: perfil?.email || 'Sin correo',
              avatar_url: perfil?.avatar_url || null,
              pie: m.condicion_estudiante?.toUpperCase() === 'PIE'
            };
          });
          alumnosData.sort((a, b) => a.nombre.localeCompare(b.nombre));
        }

        const ruts = alumnosData.map(a => a.rut);

        // Traer datos reales
        const { data: asistencias } = await supabase.from('asistencia_alumnos').select('rut_alumno, estado').in('rut_alumno', ruts);
        const { data: notas } = await supabase.from('notas').select('rut_alumno, nota').in('rut_alumno', ruts);
        const { data: anotaciones } = await supabase.from('anotaciones').select('rut_alumno, tipo').in('rut_alumno', ruts);

        const alumnosConStats = alumnosData.map(al => {
          // 1. Asistencia
          const asisAlumno = asistencias?.filter(a => a.rut_alumno === al.rut) || [];
          const presentes = asisAlumno.filter(a => a.estado === 'Presente' || a.estado === 'Atrasado').length;
          const asis = asisAlumno.length > 0 ? Math.round((presentes / asisAlumno.length) * 100) : 0;

          // 2. Notas
          const notasAlumno = notas?.filter(n => n.rut_alumno === al.rut && n.nota) || [];
          let suma = 0;
          notasAlumno.forEach(n => suma += parseFloat(n.nota));
          const prom = notasAlumno.length > 0 ? (suma / notasAlumno.length).toFixed(1) : (0).toFixed(1);

          // 3. Anotaciones
          const anotAlumno = anotaciones?.filter(a => a.rut_alumno === al.rut && a.tipo?.toLowerCase() === 'negativa') || [];
          const anot = anotAlumno.length;

          return {
            ...al,
            promedioGeneral: parseFloat(prom),
            asistenciaGeneral: asis,
            anotacionesNegativas: anot
          };
        });

        setAlumnos(alumnosConStats);

        // Calcular promedios globales del curso
        if (alumnosConStats.length > 0) {
          const promTotal = alumnosConStats.reduce((acc, al) => acc + al.promedioGeneral, 0) / alumnosConStats.length;
          const asisTotal = alumnosConStats.reduce((acc, al) => acc + al.asistenciaGeneral, 0) / alumnosConStats.length;
          const anotTotal = alumnosConStats.reduce((acc, al) => acc + al.anotacionesNegativas, 0);

          setPromedioCurso(promTotal.toFixed(1));
          setAsistenciaCurso(asisTotal.toFixed(0));
          setTotalAnotacionesNegativas(anotTotal);
        }

      }
    } catch (error) {
      console.error("Error cargando jefatura:", error);
      toast.error("Error al cargar los datos de la jefatura.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!curso) {
    return (
      <div className="p-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8 text-center border border-gray-200 dark:border-gray-700">
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No tienes jefatura asignada</h2>
          <p className="text-gray-500 dark:text-gray-400">Actualmente no estás registrado como profesor jefe de ningún curso en el sistema.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 p-4 sm:p-8">
      <Toaster position="top-right" />

      {/* HEADER */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
          <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 p-2.5 rounded-xl">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
          </span>
          Mi Curso: {curso.nombre}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm sm:text-base">
          Monitorea el rendimiento, asistencia y conducta de tus estudiantes.
        </p>
      </div>

      {/* STATS GLOBALES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Promedio Curso</p>
            <p className={`text-2xl font-bold mt-0.5 ${parseFloat(promedioCurso) >= 4.0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>{promedioCurso}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Asistencia Global</p>
            <p className={`text-2xl font-bold mt-0.5 ${asistenciaCurso >= 85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>{asistenciaCurso}%</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Anotaciones Neg.</p>
            <p className="text-2xl font-bold mt-0.5 text-gray-800 dark:text-white">{totalAnotacionesNegativas}</p>
          </div>
        </div>
      </div>

      {/* TABLA DE ALUMNOS */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <h2 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
            Nómina de Estudiantes
            <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 px-2 py-0.5 rounded-md text-xs font-semibold">{alumnos.length}</span>
          </h2>
          <button className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Exportar Informe
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-semibold">Alumno</th>
                <th className="px-6 py-4 font-semibold">RUT</th>
                <th className="px-6 py-4 font-semibold text-center">Promedio Gral</th>
                <th className="px-6 py-4 font-semibold text-center">Asistencia</th>
                <th className="px-6 py-4 font-semibold text-center">Anotaciones</th>
                <th className="px-6 py-4 font-semibold text-center">Estado S.A.T.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {alumnos.map((alumno) => (
                <tr key={alumno.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {alumno.avatar_url ? (
                        <img src={alumno.avatar_url} alt={alumno.nombre} className="w-9 h-9 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {alumno.nombre.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          {alumno.nombre}
                          {alumno.pie && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" title="Programa de Integración Escolar">PIE</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{alumno.rut}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-bold px-2.5 py-1 rounded-lg ${alumno.promedioGeneral >= 4.0
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                      {alumno.promedioGeneral}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-medium ${alumno.asistenciaGeneral < 85 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300'}`}>
                      {alumno.asistenciaGeneral}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`font-medium ${alumno.anotacionesNegativas > 3 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      {alumno.anotacionesNegativas}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {alumno.promedioGeneral >= 4.0 && alumno.asistenciaGeneral >= 85 ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Normal
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border border-amber-200 dark:border-amber-800/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> En Riesgo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {alumnos.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No hay estudiantes registrados en este curso.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
