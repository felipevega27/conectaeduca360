import { useState } from 'react';

export default function ApoderadoRendimiento() {
  const [pupiloActivo] = useState({ nombre: 'Martina Fernández', curso: '2do Medio B' });

  const [rendimiento] = useState([
    { id: 1, asignatura: 'Matemáticas', profesor: 'Roberto Gómez', promedio: 5.9, estado: 'Óptimo', notas: [6.2, 5.5, '-', '-'] },
    { id: 2, asignatura: 'Lenguaje y Comunicación', profesor: 'Ana Fernández', promedio: 4.6, estado: 'Precaución', notas: [3.8, 4.5, 5.0, '-'] },
    { id: 3, asignatura: 'Historia y Geografía', profesor: 'Luis Tapia', promedio: 5.8, estado: 'Óptimo', notas: [5.5, 6.0, '-', '-'] },
    { id: 4, asignatura: 'Biología', profesor: 'Carmen Gloria', promedio: 3.7, estado: 'Crítico', notas: [3.5, 3.8, '-', '-'] },
    { id: 5, asignatura: 'Inglés', profesor: 'Sarah Connor', promedio: 6.5, estado: 'Excelente', notas: [6.5, 6.0, 7.0, '-'] },
  ]);

  const promedioGeneral = (rendimiento.reduce((acc, curr) => acc + curr.promedio, 0) / rendimiento.length).toFixed(1);
  const asignaturasRiesgo = rendimiento.filter(r => r.promedio < 4.0).length;

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
          <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">MF</div>
          <div className="flex flex-col pr-8">
            <span className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-none">{pupiloActivo.nombre}</span>
            <span className="text-[10px] text-gray-500 uppercase font-semibold mt-0.5">{pupiloActivo.curso}</span>
          </div>
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
              {rendimiento.map((item) => (
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
                  <td className={`p-5 text-center font-black text-lg bg-gray-50/50 dark:bg-gray-800/50 ${item.promedio < 4.0 ? 'text-red-600' : 'text-blue-600 dark:text-blue-400'}`}>
                    {item.promedio.toFixed(1)}
                  </td>
                  <td className="p-5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.estado === 'Excelente' ? 'bg-emerald-100 text-emerald-700' :
                      item.estado === 'Óptimo' ? 'bg-blue-100 text-blue-700' :
                      item.estado === 'Precaución' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700 animate-pulse'
                    }`}>
                      {item.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}