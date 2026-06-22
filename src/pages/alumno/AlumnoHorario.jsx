import { useState } from 'react';

export default function AlumnoHorario() {
  const [diaFiltro, setDiaFiltro] = useState('Hoy'); // 'Hoy' o 'Semana'

  // Simulación del cronograma de clases para el día de hoy
  const [cronogramaHoy] = useState([
    { bloque: '1° y 2° Bloque', hora: '08:00 - 09:30', asignatura: 'Matemáticas', sala: 'Sala 12', profesor: 'Prof. Roberto Gómez', estado: 'Terminada' },
    { bloque: '3° y 4° Bloque', hora: '09:45 - 11:15', asignatura: 'Lenguaje y Comunicación', sala: 'Sala 14', profesor: 'Prof. Ana Fernández', estado: 'En Curso' },
    { bloque: '5° Bloque', hora: '11:30 - 12:15', asignatura: 'Historia y Geografía', sala: 'Sala 08', profesor: 'Prof. Luis Tapia', estado: 'Pendiente' },
    { bloque: '6° y 7° Bloque', hora: '12:15 - 13:45', asignatura: 'Biología', sala: 'Laboratorio Química', profesor: 'Prof. Carmen Gloria', estado: 'Pendiente' },
  ]);

  // Calendario de evaluaciones solemnes o parciales próximas
  const [proximasEvaluaciones] = useState([
    { id: 1, asignatura: 'Historia', tipo: 'Prueba Coef. 2', tema: 'Proceso de Independencia de Chile', fecha: 'Viernes 19 de Junio', diasRestantes: 5, urgente: true },
    { id: 2, asignatura: 'Matemáticas', tipo: 'Control Parcial', tema: 'Sistemas de Ecuaciones Lineales', fecha: 'Martes 23 de Junio', diasRestantes: 9, urgente: false },
    { id: 3, asignatura: 'Lenguaje', tipo: 'Entrega de Ensayo', tema: 'Análisis Crítico de Subterra', fecha: 'Lunes 29 de Junio', diasRestantes: 15, urgente: false },
  ]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      
      {/* CABECERA */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
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
              <span className="text-xs text-gray-400 dark:text-gray-500 font-semibold uppercase">Junio 2026</span>
            </div>

            <div className="p-4 space-y-3">
              {cronogramaHoy.map((clase, idx) => (
                <div 
                  key={idx} 
                  className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    clase.estado === 'En Curso'
                    ? 'border-indigo-300 dark:border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/20 ring-1 ring-indigo-400/30'
                    : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  {/* Bloque / Horario */}
                  <div className="flex items-center gap-3 min-  w-35">
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
              ))}
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
              {proximasEvaluaciones.map((evaluacion) => (
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

                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">"{evaluacion.tema}"</p>
                  
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 border-t border-dashed border-gray-100 dark:border-gray-700 pt-2.5">
                    <span className="font-medium">{evaluacion.fecha}</span>
                    <span className={`font-bold ${evaluacion.urgente ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      {evaluacion.diasRestantes === 1 ? '¡Mañana!' : `En ${evaluacion.diasRestantes} días`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}