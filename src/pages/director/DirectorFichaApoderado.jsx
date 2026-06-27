import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';
import UserAvatar from '../../components/UserAvatar';
import portadaImg from '../../assets/FONDO PERFILES.png';
import toast, { Toaster } from 'react-hot-toast';

export default function DirectorFichaApoderado() {
  const { rut: paramRut } = useParams();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState({
    perfil: null,
    pupilos: []
  });

  useEffect(() => {
    if (paramRut) {
      cargarFichaApoderado();
    } else {
      setIsLoading(false);
    }
  }, [paramRut]);

  const cargarFichaApoderado = async () => {
    try {
      setIsLoading(true);

      // 1. Datos del apoderado
      const { data: perfil } = await supabase
        .from('perfiles')
        .select('*')
        .eq('rut', paramRut)
        .single();

      // 2. Pupilos a cargo
      const { data: relacion } = await supabase
        .from('relacion_apoderados')
        .select('rut_alumno, parentesco')
        .eq('rut_apoderado', paramRut);

      let pupilosInfo = [];
      if (relacion && relacion.length > 0) {
        const rutsAlumnos = relacion.map(r => r.rut_alumno);
        
        // Obtener datos de los alumnos
        const { data: perfilesAlumnos } = await supabase
          .from('perfiles')
          .select('rut, nombre, avatar_url')
          .in('rut', rutsAlumnos);

        // Obtener cursos de los alumnos
        const { data: matriculas } = await supabase
          .from('matriculas')
          .select('rut_alumno, id_curso')
          .in('rut_alumno', rutsAlumnos);

        const idsCursos = matriculas?.map(m => m.id_curso).filter(Boolean) || [];
        let cursosData = [];
        if (idsCursos.length > 0) {
          const { data: cursosRes } = await supabase
            .from('cursos')
            .select('id, nombre')
            .in('id', idsCursos);
          cursosData = cursosRes || [];
        }

        pupilosInfo = (perfilesAlumnos || []).map(alumno => {
          const rel = relacion.find(r => r.rut_alumno === alumno.rut);
          const mat = matriculas?.find(m => m.rut_alumno === alumno.rut);
          const cursoInfo = cursosData.find(c => c.id === mat?.id_curso);

          return {
            ...alumno,
            parentesco: rel?.parentesco || 'Desconocido',
            curso: cursoInfo?.nombre || 'Sin curso asignado'
          };
        });
      }

      setData({
        perfil,
        pupilos: pupilosInfo
      });

    } catch (error) {
      console.error("Error al cargar ficha del apoderado:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando ficha del apoderado...</p>
        </div>
      </div>
    );
  }

  if (!data.perfil) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 text-center bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md w-full">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Apoderado no encontrado</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">No se pudo cargar la información del apoderado. Es posible que el RUT no exista o haya sido eliminado.</p>
          <button onClick={() => navigate(-1)} className="w-full mt-4 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors">Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />
      
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="group w-fit flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 hover:text-indigo-600 transition-all">
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Volver atrás
        </button>
      </div>
          
      {/* CABECERA DEL PERFIL APODERADO */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-6 relative">
        <div className="h-32 sm:h-40 w-full bg-cover bg-center relative" style={{ backgroundImage: `url('${portadaImg}')` }}>
          <div className="absolute inset-0 bg-indigo-900/50 mix-blend-multiply"></div>
        </div>

        <div className="px-6 pb-6 sm:px-8 sm:pb-8 flex flex-col sm:flex-row gap-5 relative z-10">
          <UserAvatar 
            nombre={data.perfil.nombre} 
            avatarUrl={data.perfil.avatar_url}
            className="-mt-12 sm:-mt-16 w-24 h-24 sm:w-32 sm:h-32 mx-auto sm:mx-0 border-4 border-white dark:border-gray-800 bg-linear-to-tr from-indigo-100 to-purple-100 text-indigo-700 text-3xl sm:text-4xl font-bold shadow-lg"
          />
          
          <div className="flex-1 text-center sm:text-left sm:pt-3 pb-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2 justify-center sm:justify-start">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{data.perfil.nombre}</h1>
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mt-1 sm:mt-0">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800/50">
                  Ficha Apoderado
                </span>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-2 text-sm text-gray-500 font-medium">
              <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg> RUT: {data.perfil.rut}</span>
              {data.perfil.email && <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> {data.perfil.email}</span>}
              {data.perfil.telefono && <span className="flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg> {data.perfil.telefono}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/30">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Pupilos a Cargo
              </h3>
            </div>
            
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {data.pupilos.length > 0 ? (
                data.pupilos.map(alumno => (
                  <div key={alumno.rut} onClick={() => navigate(`/panel/director/alumnos/${alumno.rut}`)} className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-400 hover:shadow-md cursor-pointer transition-all bg-gray-50 dark:bg-gray-800/50">
                    <UserAvatar nombre={alumno.nombre} avatarUrl={alumno.avatar_url} className="w-12 h-12 text-sm" />
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">{alumno.nombre}</p>
                      <p className="text-xs text-gray-500 capitalize">{alumno.parentesco} • {alumno.curso}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-8 text-center text-gray-500">
                  Este apoderado no tiene alumnos vinculados en el sistema.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
