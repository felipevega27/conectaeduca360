import { useState, useEffect } from 'react';
import { mockUsers } from '../../utils/mockUsers';
import { useNavigate } from 'react-router-dom';

export default function AlumnoDashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      setUser(JSON.parse(loggedUserJSON));
    } else {
      const fallbackUser = mockUsers.find(u => u.role === 'alumno');
      setUser(fallbackUser);
    }
  }, []);

  // --- DATOS SIMULADOS DEL ALUMNO ---
  const [alumno] = useState({
    curso: '2do Medio B',
    asistencia: 94, // %
    promedioGeneral: 5.8,
    anotacionesNegativas: 0
  });

  // Últimas notas subidas al sistema
  const [ultimasNotas] = useState([
    { id: 1, asignatura: 'Matemáticas', evaluacion: 'Prueba Ecuaciones', nota: 6.2, fecha: 'Hoy' },
    { id: 2, asignatura: 'Lenguaje', evaluacion: 'Control de Lectura', nota: 3.8, fecha: 'Ayer' }, // Nota roja
    { id: 3, asignatura: 'Historia', evaluacion: 'Disertación', nota: 5.5, fecha: 'Hace 3 días' },
  ]);

  // Tareas pendientes asignadas por los profesores
  const [tareasPendientes] = useState([
    { id: 101, asignatura: 'Lenguaje', titulo: 'Ensayo sobre Don Quijote', vence: 'Mañana', urgencia: 'alta' },
    { id: 102, asignatura: 'Biología', titulo: 'Guía de Células', vence: 'Viernes 18', urgencia: 'media' },
  ]);

  // Últimas anotaciones en el libro de clases
  const [anotaciones] = useState([
    { id: 201, tipo: 'positiva', descripcion: 'Excelente participación en la feria científica escolar.', fecha: 'Lunes 08', profesor: 'Luis Tapia' },
    { id: 202, tipo: 'observacion', descripcion: 'No trae materiales completos para artes.', fecha: 'Semana pasada', profesor: 'Ana Gómez' },
  ]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      
      {/* CABECERA PERSONALIZADA PARA EL ESTUDIANTE */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">¡Hola, {user ? (user.name || user.nombre).split(' ')[0] : 'Estudiante'}! 👋</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Este es tu rendimiento académico y tus tareas pendientes para esta semana.</p>
      </div>

      {/* TARJETAS DE RESUMEN (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        
        {/* Tarjeta Promedio */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Promedio General</p>
          <h2 className={`text-3xl font-black ${alumno.promedioGeneral >= 4.0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
            {alumno.promedioGeneral.toFixed(1)}
          </h2>
        </div>

        {/* Tarjeta Asistencia */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Tu Asistencia</p>
          <h2 className={`text-3xl font-black ${alumno.asistencia >= 85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {alumno.asistencia}%
          </h2>
        </div>

        {/* Tarjeta Tareas */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Tareas Pendientes</p>
          <h2 className="text-3xl font-black text-blue-700 dark:text-blue-300">
            {tareasPendientes.length}
          </h2>
        </div>

        {/* Tarjeta Convivencia */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center hover:-translate-y-1 hover:shadow-lg transition-all">
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Anotaciones Negativas</p>
          <h2 className={`text-3xl font-black ${alumno.anotacionesNegativas > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>
            {alumno.anotacionesNegativas}
          </h2>
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

          {/* MÓDULO TAREAS PENDIENTES */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                Tareas y Asignaciones
              </h2>
            </div>
            <div className="p-4 space-y-3">
              {tareasPendientes.map((tarea) => (
                <div key={tarea.id} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-800 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {tarea.urgencia === 'alta' 
                        ? <span className="flex h-3 w-3 rounded-full bg-red-500"></span>
                        : <span className="flex h-3 w-3 rounded-full bg-amber-400"></span>
                      }
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">{tarea.titulo}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tarea.asignatura}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Vence {tarea.vence}
                    </span>
                    <button className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/40 px-3 py-1.5 rounded-lg transition-colors">
                      Entregar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* COLUMNA DERECHA: ASISTENCIA DE HOY Y HOJA DE VIDA */}
        <div className="space-y-6">
          
          {/* MÓDULO ASISTENCIA HOY */}
          <div className="bg-linear-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-sm overflow-hidden text-white p-6 relative">
            <svg className="absolute top-0 right-0 w-32 h-32 text-emerald-400/30 -mt-4 -mr-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1.177-7.86l-2.765-2.767L7 12.431l3.119 3.121a1 1 0 001.414 0l5.952-5.95-1.062-1.062-5.6 5.6z"/></svg>
            <h2 className="text-sm font-bold text-emerald-50 mb-1">Registro de Portería</h2>
            <p className="text-2xl font-black mb-4">Ingreso Registrado</p>
            <div className="bg-emerald-700/30 backdrop-blur-sm rounded-xl p-3 inline-block">
              <p className="text-xs font-medium text-emerald-100">Llegaste hoy a las:</p>
              <p className="text-lg font-bold">07:52 AM</p>
            </div>
          </div>

          {/* MÓDULO HOJA DE VIDA */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Tu Hoja de Vida
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {anotaciones.map((anotacion) => (
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
              ))}
            </div>
            <div className="p-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-center">
               <button className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Abrir Hoja de Vida Completa</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}