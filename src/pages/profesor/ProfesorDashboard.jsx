import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';

export default function ProfesorDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [profesorJefe, setProfesorJefe] = useState({
    curso: 'Sin Jefatura',
    alumnosRiesgo: 0,
    justificacionesPendientes: 0,
    avancePlanificacion: 0
  });

  const [clasesHoy, setClasesHoy] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados para el Modal de Jefatura
  const [isModalJefaturaOpen, setIsModalJefaturaOpen] = useState(false);
  const [alumnosJefatura, setAlumnosJefatura] = useState([]);

  // Obtener el día de la semana actual en español
  const getDiaHoy = () => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[new Date().getDay()];
  };

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      cargarDatosDashboard(parsedUser.rut);
    }
  }, []);

  const cargarDatosDashboard = async (rutProfesor) => {
    setIsLoading(true);
    try {
      // 1. Obtener Jefatura (si es profesor jefe de algún curso)
      const { data: cursoJefatura } = await supabase
        .from('cursos')
        .select('id, nombre')
        .eq('rut_profesor_jefe', rutProfesor)
        .maybeSingle();

      if (cursoJefatura) {
        // Contar alumnos en riesgo (con más de 1 inasistencia)
        const { data: asistencias } = await supabase.from('asistencia_alumnos').select('rut_alumno').eq('id_curso', cursoJefatura.id).eq('estado', 'Ausente');
        const alumnosRiesgoSet = new Set(asistencias?.map(a => a.rut_alumno) || []);
        
        setProfesorJefe({
          curso: cursoJefatura.nombre,
          alumnosRiesgo: alumnosRiesgoSet.size,
          justificacionesPendientes: 0 // TODO: Conectar con justificaciones reales a futuro
        });

        // Cargar alumnos de jefatura
        const { data: matriculas } = await supabase
          .from('matriculas')
          .select('rut_alumno')
          .eq('id_curso', cursoJefatura.id);

        if (matriculas && matriculas.length > 0) {
          const ruts = matriculas.map(m => m.rut_alumno);
          const { data: perfiles } = await supabase.from('perfiles').select('rut, nombre, email').in('rut', ruts);
          
          const lista = matriculas.map(m => {
            const perfil = perfiles?.find(p => p.rut === m.rut_alumno);
            return {
              rut: m.rut_alumno,
              nombre: perfil?.nombre || 'Sin Nombre',
              email: perfil?.email || 'Sin correo registrado'
            };
          });
          lista.sort((a,b) => a.nombre.localeCompare(b.nombre));
          setAlumnosJefatura(lista);
        }
      }

      // Obtener porcentaje de avance de planificaciones del profesor
      const { data: planes } = await supabase
        .from('planificaciones')
        .select('id')
        .eq('rut_profesor', rutProfesor);
      
      // Simulamos que el objetivo anual por profesor son 10 planificaciones.
      const planesCount = planes ? planes.length : 0;
      const avanceCalculado = Math.min(Math.round((planesCount / 10) * 100), 100);
      
      setProfesorJefe(prev => ({ ...prev, avancePlanificacion: avanceCalculado }));

      // 2. Obtener Clases de Hoy desde 'horarios'
      const diaHoy = getDiaHoy();
      const { data: horariosHoy } = await supabase
        .from('horarios')
        .select('*, cursos(nombre), asignaturas(nombre)')
        .eq('rut_profesor', rutProfesor)
        .eq('dia_semana', diaHoy)
        .order('hora_inicio', { ascending: true });

      if (horariosHoy && horariosHoy.length > 0) {
        // Obtener los leccionarios de hoy para ver cuáles están firmados
        const hoyISO = new Date().toISOString().split('T')[0];
        const horariosIds = horariosHoy.map(h => h.id);
        const { data: leccionarios } = await supabase
          .from('leccionarios')
          .select('id_horario, firmado')
          .in('id_horario', horariosIds)
          .eq('fecha', hoyISO);

        const leccionariosMap = {};
        leccionarios?.forEach(lec => {
          leccionariosMap[lec.id_horario] = lec.firmado;
        });

        // Formatear las clases para el estado
        const ahora = new Date();
        const horaActualStr = ahora.getHours().toString().padStart(2, '0') + ':' + ahora.getMinutes().toString().padStart(2, '0');

        const clasesFormateadas = horariosHoy.map(h => {
          let estado = 'Pendiente';
          if (horaActualStr >= h.hora_inicio && horaActualStr <= h.hora_fin) {
            estado = 'En Curso';
          } else if (horaActualStr > h.hora_fin || leccionariosMap[h.id]) {
            estado = 'Finalizada';
          }

          return {
            id: h.id, // ID del horario
            id_curso: h.id_curso,
            id_asignatura: h.id_asignatura,
            bloque: h.bloque,
            hora: `${h.hora_inicio.substring(0, 5)} - ${h.hora_fin.substring(0, 5)}`,
            curso: h.cursos?.nombre || 'Curso Desconocido',
            asignatura: h.asignaturas?.nombre || 'Asignatura Desconocida',
            sala: h.sala || 'Sala Asignada',
            estado: estado,
            leccionarioFirmado: !!leccionariosMap[h.id]
          };
        });

        setClasesHoy(clasesFormateadas);
      } else {
        setClasesHoy([]);
      }
    } catch (error) {
      console.error('Error cargando dashboard del profesor:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      
      {/* CABECERA DINÁMICA */}
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">
            ¡Hola, {user ? user.nombre?.split(' ')[0] : 'Profesor'}!
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Este es tu bloque de clases y tareas pendientes para hoy.</p>
        </div>
        <div className="flex h-9 items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 shadow-sm">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Hoy: {getDiaHoy()} {new Date().getDate()}
          </span>
        </div>
      </div>

      {/* ALERTAS OBLIGATORIAS MINEDUC */}
      {clasesHoy.some(c => !c.leccionarioFirmado && c.estado !== 'Pendiente') && (
        <div className="mb-3 p-4 rounded-xl border border-orange-200 dark:border-orange-800/50 bg-orange-50 dark:bg-orange-900/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 p-2 rounded-lg mt-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
            </div>
            <div>
              <h4 className="font-bold text-gray-800 dark:text-white text-sm">Firma de Libro Digital pendiente</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">Tienes {clasesHoy.filter(c => !c.leccionarioFirmado && c.estado !== 'Pendiente').length} bloque(s) finalizados que requieren registro de leccionario.</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/panel/profesor/asistencia', { state: clasesHoy.find(c => !c.leccionarioFirmado && c.estado !== 'Pendiente') })} 
            className="text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/50 hover:bg-orange-200 dark:hover:bg-orange-800 px-3 py-2 rounded-lg transition-colors shrink-0"
          >
            Resolver Ahora
          </button>
        </div>
      )}

      {/* RECUADROS DE RESUMEN OPERATIVO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* Tu Jefatura */}
        <div 
          onClick={() => {
            if(profesorJefe.curso !== 'Sin Jefatura') setIsModalJefaturaOpen(true);
          }}
          className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] transition-all hover:-translate-y-1 hover:shadow-lg ${profesorJefe.curso !== 'Sin Jefatura' ? 'cursor-pointer' : ''}`}
        >
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tu Curso Jefatura</p>
            {profesorJefe.curso !== 'Sin Jefatura' && (
               <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            )}
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white mt-1">{profesorJefe.curso}</h3>
          <div className="mt-4 flex gap-4 text-xs font-semibold">
            <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
              {profesorJefe.alumnosRiesgo} Alumnos en Riesgo S.A.T
            </span>
          </div>
        </div>

        {/* Justificaciones */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] transition-all hover:-translate-y-1 hover:shadow-lg">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Inasistencias por Justificar</p>
          <h3 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white mt-1">{profesorJefe.justificacionesPendientes}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">Apoderados enviaron certificados médicos en la app.</p>
        </div>

        {/* Cobertura Curricular Personal */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between">
          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avance de Planificación</p>
            <h3 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white mt-1">{profesorJefe.avancePlanificacion}%</h3>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full mt-4 overflow-hidden">
            <div className={`h-full rounded-full ${profesorJefe.avancePlanificacion >= 50 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{width: `${profesorJefe.avancePlanificacion}%`}}></div>
          </div>
        </div>

      </div>

      {/* CRONOGRAMA / HORARIO DE HOY */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Horario de Clases de Hoy
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">Clases vigentes</span>
        </div>

        <div className="p-6 space-y-4">
          {clasesHoy.length > 0 && clasesHoy.map((clase) => (
            <div 
              key={clase.id} 
              className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                clase.estado === 'En Curso' 
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/20 ring-1 ring-blue-500/20' 
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-sm dark:hover:bg-gray-700/50'
              }`}
            >
              
              {/* Bloque y Hora */}
              <div className="flex items-center gap-4 min-w-37.5">
                <div className={`text-center px-3 py-1.5 rounded-lg font-bold text-xs ${
                  clase.estado === 'En Curso' ? 'bg-blue-600 text-white' :
                  clase.estado === 'Finalizada' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' :
                  'bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                }`}>
                  {clase.bloque}
                </div>
                <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400">{clase.hora}</span>
              </div>

              {/* Asignatura y Sala */}
              <div className="flex-1">
                <h4 className="font-bold text-gray-800 dark:text-white text-base">{clase.asignatura}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{clase.curso} • <span className="font-semibold text-gray-700 dark:text-gray-300">{clase.sala}</span></p>
              </div>

              {/* Estado de Firmas Legales */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
                
                {/* Botón Pasar Lista / Ver Lista */}
                <button 
                  onClick={() => navigate('/panel/profesor/asistencia', { state: clase })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    clase.leccionarioFirmado 
                    ? 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700' 
                    : 'border-blue-600 text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                  }`}
                >
                  {clase.leccionarioFirmado ? 'Ver Asistencia' : 'Pasar Lista'}
                </button>

                {/* Estatus Leccionario */}
                {clase.leccionarioFirmado ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                    Firmado
                  </span>
                ) : (
                  <button 
                    onClick={() => navigate('/panel/profesor/asistencia', { state: clase })}
                    className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-800 border border-orange-200 dark:border-orange-800/50 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Firma Pendiente
                  </button>
                )}
                
              </div>
            </div>
          ))}
        {clasesHoy.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p className="text-sm font-medium">No tienes clases asignadas para el día de hoy.</p>
          </div>
        )}
        </div>
      </div>

      {/* MODAL ALUMNOS DE JEFATURA */}
      {isModalJefaturaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalJefaturaOpen(false)}></div>
          
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex flex-col max-h-[85vh] animate-fade-in-up border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  Alumnos de {profesorJefe.curso}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Total: {alumnosJefatura.length} estudiantes matriculados</p>
              </div>
              <button onClick={() => setIsModalJefaturaOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {alumnosJefatura.map(alumno => (
                  <div key={alumno.rut} className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                      {alumno.nombre.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{alumno.nombre}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{alumno.rut}</p>
                    </div>
                    <div className="hidden sm:block text-right">
                       <p className="text-xs text-gray-500 dark:text-gray-400">{alumno.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-right">
              <button 
                onClick={() => setIsModalJefaturaOpen(false)}
                className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}