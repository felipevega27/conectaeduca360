import { useState } from 'react';

export default function AlumnoMateriales() {
  // Filtro de asignaturas
  const [asignaturaActiva, setAsignaturaActiva] = useState('Todas');
  
  // Estados para la ventana de entrega de tareas
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tareaSeleccionada, setTareaSeleccionada] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const asignaturas = ['Todas', 'Lenguaje', 'Matemáticas', 'Biología', 'Historia'];

  // Base de datos simulada de Materiales de Estudio (Descargas)
  const [materiales] = useState([
    { id: 1, asignatura: 'Matemáticas', titulo: 'Guía de Ecuaciones Cuadráticas', tipo: 'PDF', tamaño: '1.2 MB', fecha: 'Ayer' },
    { id: 2, asignatura: 'Lenguaje', titulo: 'Presentación: El Boom Latinoamericano', tipo: 'PPT', tamaño: '4.5 MB', fecha: 'Hace 2 días' },
    { id: 3, asignatura: 'Historia', titulo: 'Resumen Unidad 1: Chile en el S. XX', tipo: 'PDF', tamaño: '2.1 MB', fecha: 'Semana pasada' },
    { id: 4, asignatura: 'Biología', titulo: 'Esquema de Célula Eucarionte', tipo: 'IMG', tamaño: '800 KB', fecha: 'Semana pasada' },
  ]);

  // Base de datos simulada de Tareas (Entregas)
  const [tareas] = useState([
    { id: 101, asignatura: 'Lenguaje', titulo: 'Ensayo sobre Don Quijote', vence: 'Mañana, 23:59', estado: 'Pendiente', descripcion: 'Escribir un ensayo de 2 planas sobre la locura del protagonista. Formato Word o PDF.' },
    { id: 102, asignatura: 'Biología', titulo: 'Guía de Células Resuelta', vence: 'Viernes 18, 14:00', estado: 'Pendiente', descripcion: 'Subir fotografía clara de la guía desarrollada en clases.' },
    { id: 103, asignatura: 'Matemáticas', titulo: 'Ejercicios Página 45', vence: 'Lunes 08', estado: 'Entregado', descripcion: 'Resolver los 10 ejercicios del libro.' },
  ]);

  // Filtrado de datos
  const materialesFiltrados = asignaturaActiva === 'Todas' ? materiales : materiales.filter(m => m.asignatura === asignaturaActiva);
  const tareasFiltradas = asignaturaActiva === 'Todas' ? tareas : tareas.filter(t => t.asignatura === asignaturaActiva);

  const abrirModalEntrega = (tarea) => {
    setTareaSeleccionada(tarea);
    setIsModalOpen(true);
  };

  const handleSubirTarea = (e) => {
    e.preventDefault();
    setIsUploading(true);
    // Simulación de carga al servidor
    setTimeout(() => {
      setIsUploading(false);
      setIsModalOpen(false);
      alert('¡Tarea enviada con éxito al profesor!');
    }, 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      
      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Aula Virtual</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Descarga apuntes y sube tus trabajos pendientes.</p>
        </div>
      </div>

      {/* FILTRO POR ASIGNATURA (PILLS) */}
      <div className="flex overflow-x-auto pb-4 mb-4 gap-2 custom-scrollbar hide-scrollbar">
        {asignaturas.map(asig => (
          <button
            key={asig}
            onClick={() => setAsignaturaActiva(asig)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${
              asignaturaActiva === asig 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {asig}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* COLUMNA 1: TAREAS Y ENTREGAS */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
            Entregas Pendientes
          </h2>
          
          {tareasFiltradas.map((tarea) => (
            <div key={tarea.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                  {tarea.asignatura}
                </span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  tarea.estado === 'Pendiente' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                }`}>
                  {tarea.estado}
                </span>
              </div>
              <h3 className="text-base font-bold text-gray-800 dark:text-white mt-1">{tarea.titulo}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">{tarea.descripcion}</p>
              
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Vence: {tarea.vence}
                </span>
                {tarea.estado === 'Pendiente' ? (
                  <button 
                    onClick={() => abrirModalEntrega(tarea)}
                    className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors shadow-sm"
                  >
                    Subir Trabajo
                  </button>
                ) : (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    Entregado
                  </span>
                )}
              </div>
            </div>
          ))}
          {tareasFiltradas.length === 0 && (
            <div className="text-center py-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl border-dashed">
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No hay tareas para esta asignatura.</p>
            </div>
          )}
        </div>

        {/* COLUMNA 2: MATERIAL DE CLASES */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            Material de Estudio
          </h2>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {materialesFiltrados.map((item) => (
                <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                  {/* Ícono dinámico según el tipo de archivo */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    item.tipo === 'PDF' ? 'bg-red-100 text-red-600 dark:bg-red-900/30' :
                    item.tipo === 'PPT' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30'
                  }`}>
                    <span className="text-[10px] font-black">{item.tipo}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{item.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      <span>{item.asignatura}</span>
                      <span>•</span>
                      <span>{item.tamaño}</span>
                    </div>
                  </div>

                  <button className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </button>
                </div>
              ))}
              {materialesFiltrados.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No hay materiales subidos para esta asignatura.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* --- MODAL PARA SUBIR TAREA --- */}
      {isModalOpen && tareaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up border border-gray-200 dark:border-gray-700">
            
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Entregar Trabajo
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleSubirTarea} className="p-6 space-y-5">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-100 dark:border-blue-800/50">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{tareaSeleccionada.asignatura}</p>
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">{tareaSeleccionada.titulo}</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Archivo a entregar</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group">
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  </div>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Haz clic para buscar tu archivo</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Soporta Word, PDF, Excel o Imágenes</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Comentario para el profesor (Opcional)</label>
                <textarea 
                  rows="2" 
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                  placeholder="Ej: Profesor, le envío el trabajo finalizado."
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isUploading}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-white shadow-lg transition-colors flex justify-center items-center gap-2 ${
                    isUploading ? 'bg-blue-400 cursor-not-allowed shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                  }`}
                >
                  {isUploading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : 'Enviar Tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}