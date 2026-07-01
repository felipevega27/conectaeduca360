import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../config/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import CertificadoAlumnoRegular from '../../components/documentos/CertificadoAlumnoRegular';

export default function AlumnoDashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  // Estados Reales
  const [alumnoData, setAlumnoData] = useState({
    cursoNombre: 'Cargando...',
    asistencia: 0,
    promedioGeneral: 0,
    anotacionesNegativas: 0,
    anotacionesPositivas: 0,
    faltasInjustificadas: 0
  });

  const [ultimasNotas, setUltimasNotas] = useState([]);
  const [avisosMuro, setAvisosMuro] = useState([]);
  const [anotaciones, setAnotaciones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados y refs para Certificado
  const [alumnoInfo, setAlumnoInfo] = useState(null);
  const [configColegio, setConfigColegio] = useState(null);
  const certificadoRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: certificadoRef,
    documentTitle: 'Certificado_Alumno_Regular',
  });

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      cargarDatos(parsedUser.rut);
    }
  }, []);

  const cargarDatos = async (rutAlumno) => {
    setIsLoading(true);
    try {
      // 1. Obtener Matrícula y Curso
      const { data: matricula } = await supabase
        .from('matriculas')
        .select('id_curso, cursos(nombre)')
        .eq('rut_alumno', rutAlumno)
        .maybeSingle();

      let cursoId = null;
      let cursoNombre = 'Sin Curso';
      if (matricula) {
        cursoId = matricula.id_curso;
        cursoNombre = matricula.cursos?.nombre || 'Sin Curso';
      }

      // 2. Obtener Asistencia
      const { data: asistencias } = await supabase
        .from('asistencia_alumnos')
        .select('estado, justificado')
        .eq('rut_alumno', rutAlumno);
      
      let porcentajeAsistencia = 0;
      let faltasInjustificadas = 0;
      if (asistencias && asistencias.length > 0) {
        const presentes = asistencias.filter(a => a.estado.toLowerCase() === 'presente' || a.estado.toLowerCase() === 'atraso').length;
        faltasInjustificadas = asistencias.filter(a => a.estado.toLowerCase() === 'ausente' && a.justificado !== true).length;
        porcentajeAsistencia = Math.round((presentes / asistencias.length) * 100);
      }

      // 3. Obtener Anotaciones (Negativas y Recientes)
      const { data: anotacionesData } = await supabase
        .from('anotaciones')
        .select('*, perfiles!rut_profesor(nombre)')
        .eq('rut_alumno', rutAlumno)
        .order('fecha', { ascending: false });
      
      let negativasCount = 0;
      let positivasCount = 0;
      let ultimasAnot = [];
      if (anotacionesData) {
        negativasCount = anotacionesData.filter(a => a.tipo.toLowerCase() === 'negativa').length;
        positivasCount = anotacionesData.filter(a => a.tipo.toLowerCase() === 'positiva').length;
        ultimasAnot = anotacionesData.slice(0, 3).map(a => ({
          id: a.id,
          tipo: a.tipo.toLowerCase(),
          descripcion: a.descripcion,
          fecha: new Date(a.fecha).toLocaleDateString('es-CL'),
          profesor: a.perfiles?.nombre || 'Profesor'
        }));
      }
      setAnotaciones(ultimasAnot);

      // 4. Obtener Calificaciones y Calcular Promedio General
      const { data: calificacionesData } = await supabase
        .from('notas')
        .select('*')
        .eq('rut_alumno', rutAlumno)
        .order('fecha', { ascending: false });
      
      let promedio = 0;
      let notasRecientes = [];
      if (calificacionesData && calificacionesData.length > 0) {
        const sumaNotas = calificacionesData.reduce((acc, curr) => acc + (curr.nota || 0), 0);
        promedio = sumaNotas / calificacionesData.length;
        
        // Obtener Asignaturas y Evaluaciones para las 3 notas más recientes
        const recientes = calificacionesData.slice(0, 3);
        const asignaturasIds = [...new Set(recientes.map(n => n.id_asignatura).filter(Boolean))];
        const evaluacionesIds = [...new Set(recientes.map(n => n.id_evaluacion).filter(Boolean))];
        
        let asignaturasMap = {};
        let evaluacionesMap = {};
        
        if (asignaturasIds.length > 0) {
          const { data: asigData } = await supabase.from('asignaturas').select('id, nombre').in('id', asignaturasIds);
          if (asigData) asigData.forEach(a => asignaturasMap[a.id] = a.nombre);
        }
        if (evaluacionesIds.length > 0) {
          const { data: evalData } = await supabase.from('evaluaciones').select('id, nombre').in('id', evaluacionesIds);
          if (evalData) evalData.forEach(e => evaluacionesMap[e.id] = e.nombre);
        }

        notasRecientes = recientes.map(c => ({
          id: c.id,
          asignatura: asignaturasMap[c.id_asignatura] || 'Desconocida',
          evaluacion: evaluacionesMap[c.id_evaluacion] || 'Evaluación',
          nota: c.nota,
          fecha: new Date(c.created_at || c.fecha).toLocaleDateString('es-CL')
        }));
      }
      setUltimasNotas(notasRecientes);

      setAlumnoData({
        cursoNombre: cursoNombre,
        asistencia: porcentajeAsistencia,
        promedioGeneral: parseFloat(promedio.toFixed(1)),
        anotacionesNegativas: negativasCount,
        anotacionesPositivas: positivasCount,
        faltasInjustificadas: faltasInjustificadas
      });

      // 5. Obtener Avisos (Muro de Avisos del Curso)
      if (cursoId) {
        const { data: avisos } = await supabase
          .from('anuncios_curso')
          .select('*, perfiles!rut_profesor(nombre)')
          .eq('id_curso', cursoId)
          .order('fecha_creacion', { ascending: false });
        
        if (avisos) {
          setAvisosMuro(avisos);
        }
      }

      // 6. Datos para el certificado
      setAlumnoInfo({
        rut: rutAlumno,
        nombre: parsedUser.name || parsedUser.nombre,
        curso: cursoNombre
      });
      const { data: config } = await supabase.from('configuracion_colegio').select('*').limit(1).maybeSingle();
      setConfigColegio(config || {});

    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando Resumen Escolar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      
      {/* CABECERA PERSONALIZADA PARA EL ESTUDIANTE */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">¡Hola, {user ? (user.name || user.nombre).split(' ')[0] : 'Estudiante'}! 👋</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Este es tu rendimiento académico y tus tareas pendientes para esta semana.</p>
          </div>
          <button 
            onClick={handlePrint}
            className="flex h-10 items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Certificado Alumno Regular
          </button>
        </div>
        
        {/* ALERTA DE INASISTENCIAS SIN JUSTIFICAR */}
        {alumnoData.faltasInjustificadas > 0 && (
          <div className="mt-4 flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-sm font-bold text-red-800 dark:text-red-400">Inasistencias sin justificar</h3>
                <p className="text-xs text-red-600 dark:text-red-300">Tienes {alumnoData.faltasInjustificadas} falta(s) pendiente(s) por justificar. Pide a tu apoderado que suba el certificado.</p>
              </div>
            </div>
            <button onClick={() => navigate('/panel/alumno/asistencia')} className="text-xs font-bold text-red-700 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800 px-4 py-2 rounded-lg transition-colors">
              Ir a Asistencia
            </button>
          </div>
        )}
      </div>

      {/* TARJETAS DE RESUMEN (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        
        {/* Tarjeta Promedio */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Promedio General</p>
          <h2 className={`text-3xl font-black ${alumnoData.promedioGeneral >= 4.0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
            {alumnoData.promedioGeneral > 0 ? alumnoData.promedioGeneral.toFixed(1) : '-'}
          </h2>
        </div>

        {/* Tarjeta Asistencia */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Tu Asistencia</p>
          <h2 className={`text-3xl font-black ${alumnoData.asistencia >= 85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {alumnoData.asistencia}%
          </h2>
        </div>

        {/* Tarjeta Tareas */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Avisos del Curso</p>
          <h2 className="text-3xl font-black text-blue-700 dark:text-blue-300">
            {avisosMuro.length}
          </h2>
        </div>

        {/* Tarjeta Convivencia */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Anotaciones</p>
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Positivas</span>
              <h2 className={`text-2xl font-black ${alumnoData.anotacionesPositivas > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                {alumnoData.anotacionesPositivas}
              </h2>
            </div>
            <div className="w-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Negativas</span>
              <h2 className={`text-2xl font-black ${alumnoData.anotacionesNegativas > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                {alumnoData.anotacionesNegativas}
              </h2>
            </div>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA IZQUIERDA: CALIFICACIONES Y TAREAS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* MÓDULO ÚLTIMAS CALIFICACIONES */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                Tus Últimas Notas
              </h2>
              <button onClick={() => navigate('/panel/alumno/calificaciones')} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                Ver todas
              </button>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {ultimasNotas.map((item) => (
                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{item.asignatura}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.evaluacion} • <span className="italic">{item.fecha}</span></p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg font-black text-lg ${item.nota >= 4.0 ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                    {item.nota.toFixed(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* MÓDULO MURO DE AVISOS DEL CURSO */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                Muro de Avisos del Curso
              </h2>
            </div>
            <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto">
              {avisosMuro.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No hay avisos recientes.</p>
              ) : (
                avisosMuro.map((aviso) => (
                  <div key={aviso.id} className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 flex flex-col gap-2 bg-gray-50/50 dark:bg-gray-800 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">{aviso.titulo}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Por: {aviso.perfiles?.nombre}</p>
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 bg-white dark:bg-gray-700 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                        {new Date(aviso.fecha_creacion).toLocaleDateString('es-CL')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 font-medium leading-snug whitespace-pre-wrap bg-white dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                      {aviso.contenido}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* COLUMNA DERECHA: ASISTENCIA DE HOY Y HOJA DE VIDA */}
        <div className="space-y-6">
          

          {/* MÓDULO HOJA DE VIDA */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Tu Hoja de Vida
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {anotaciones.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">No tienes anotaciones recientes.</p>
              ) : (
                anotaciones.map((anotacion) => (
                  <div key={anotacion.id} className="relative pl-4 border-l-2 border-blue-200 dark:border-blue-800">
                    <span className={`absolute -left-1.25 top-1 w-2 h-2 rounded-full ${
                      anotacion.tipo === 'positiva' ? 'bg-emerald-500' :
                      anotacion.tipo === 'negativa' ? 'bg-red-500' : 'bg-orange-500'
                    }`}></span>
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        anotacion.tipo === 'positiva' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                        anotacion.tipo === 'negativa' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        Anotación {anotacion.tipo}
                      </span>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{anotacion.fecha}</span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 my-1 font-medium leading-snug">"{anotacion.descripcion}"</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Registrado por: Prof. {anotacion.profesor}</p>
                  </div>
                ))
              )}
            </div>
            <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-center">
               <button onClick={() => navigate('/panel/alumno/anotaciones')} className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Abrir Hoja de Vida Completa</button>
            </div>
          </div>

        </div>
      </div>

      {/* COMPONENTE OCULTO PARA IMPRIMIR PDF */}
      <div className="hidden">
        <CertificadoAlumnoRegular 
          ref={certificadoRef} 
          alumno={alumnoInfo}
          fechaEmision={new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' })}
          correlativo={Math.floor(Math.random() * 1000).toString().padStart(3, '0')}
          config={configColegio}
        />
      </div>

    </div>
  );
}