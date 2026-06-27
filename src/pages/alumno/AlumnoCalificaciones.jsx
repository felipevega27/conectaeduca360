import { useState } from 'react';

export default function AlumnoCalificaciones() {
  // Datos simulados de calificaciones del estudiante
  const [calificaciones] = useState([
    { 
      id: 1, 
      asignatura: 'Lenguaje y Comunicación', 
      docente: 'Prof. Ana Fernández', 
      notas: [
        { id: 101, evaluacion: 'Control de Lectura: Subterra', nota: 3.8, ponderacion: '20%' },
        { id: 102, evaluacion: 'Ensayo Literario', nota: 4.5, ponderacion: '30%' },
        { id: 103, evaluacion: 'Disertación', nota: 5.0, ponderacion: '50%' }
      ], 
      promedio: 4.6 
    },
    { 
      id: 2, 
      asignatura: 'Matemáticas', 
      docente: 'Prof. Roberto Gómez', 
      notas: [
        { id: 201, evaluacion: 'Prueba Ecuaciones Cuadráticas', nota: 6.2, ponderacion: '50%' },
        { id: 202, evaluacion: 'Guía Práctica', nota: 5.5, ponderacion: '50%' }
      ], 
      promedio: 5.9 
    },
    { 
      id: 3, 
      asignatura: 'Historia y Geografía', 
      docente: 'Prof. Luis Tapia', 
      notas: [
        { id: 301, evaluacion: 'Prueba Unidad 1', nota: 5.5, ponderacion: '50%' },
        { id: 302, evaluacion: 'Mapa Conceptual', nota: 6.0, ponderacion: '50%' }
      ], 
      promedio: 5.8 
    },
    { 
      id: 4, 
      asignatura: 'Biología', 
      docente: 'Prof. Carmen Gloria', 
      notas: [
        { id: 401, evaluacion: 'Informe de Laboratorio', nota: 3.5, ponderacion: '40%' },
        { id: 402, evaluacion: 'Prueba La Célula', nota: 3.8, ponderacion: '60%' }
      ], 
      promedio: 3.7 
    },
  ]);

  const promedioGeneral = (calificaciones.reduce((acc, curr) => acc + curr.promedio, 0) / calificaciones.length).toFixed(1);
  const asignaturasRiesgo = calificaciones.filter(c => c.promedio < 4.0).length;

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
        {calificaciones.map((materia) => (
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
                  <p className={`text-2xl font-black ${materia.promedio >= 4.0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                    {materia.promedio.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            {/* Desglose de Notas */}
            <div className="p-5">
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-3">Evaluaciones</h4>
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
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}