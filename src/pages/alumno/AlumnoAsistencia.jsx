import { useState, useEffect } from 'react';

export default function AlumnoAsistencia() {
  // --- CONTROL DE ROLES (LA REGLA LEGAL) ---
  const [userRole, setUserRole] = useState('alumno'); 

  useEffect(() => {
    // Leemos quién inició sesión realmente
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const user = JSON.parse(loggedUserJSON);
      setUserRole(user.role || user.rol || 'alumno');
    }
  }, []);

  // --- ESTADOS INTERACTIVOS ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [faltaSeleccionada, setFaltaSeleccionada] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // --- DATOS SIMULADOS ---
  const [resumen] = useState({
    porcentajeGlobal: 94,
    diasPresente: 62,
    diasAusente: 4,
    atrasos: 2
  });

  const [historial] = useState([
    { id: 1, fecha: 'Jueves 04 de Junio', tipo: 'Ausente', estado: 'Justificada', observacion: 'Licencia Médica' },
    { id: 2, fecha: 'Viernes 05 de Junio', tipo: 'Ausente', estado: 'Justificada', observacion: 'Licencia Médica' },
    { id: 3, fecha: 'Lunes 18 de Mayo', tipo: 'Atraso', estado: 'Sin Justificar', observacion: 'Llegó a las 08:20 AM' },
    { id: 4, fecha: 'Martes 21 de Abril', tipo: 'Ausente', estado: 'Sin Justificar', observacion: '-' },
  ]);

  const diasMes = Array.from({ length: 30 }, (_, i) => {
    const dia = i + 1;
    const diaSemana = new Date(2026, 5, dia).getDay(); 
    let estado = 'presente';
    if (diaSemana === 0 || diaSemana === 6) estado = 'fin-de-semana'; 
    else if (dia === 4 || dia === 5) estado = 'ausente'; 
    else if (dia === 12) estado = 'atraso'; 
    else if (dia > 14) estado = 'futuro'; 
    return { id: dia, dia, estado };
  });

  const handleUploadCertificado = (e) => {
    e.preventDefault();
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setIsModalOpen(false);
      alert('Certificado enviado exitosamente a Inspectoría.');
    }, 1500);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      
      {/* CABECERA */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Registro de Asistencia</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Monitorea tu calendario mensual de ingresos y atrasos.</p>
        </div>
        
        {/* REGLA LEGAL: SOLO EL APODERADO PUEDE VER EL BOTÓN DE JUSTIFICAR */}
        {userRole === 'apoderado' ? (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            Justificar Falta
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg text-sm font-medium text-amber-700 dark:text-amber-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z" /></svg>
            Solo Apoderados pueden justificar
          </div>
        )}
      </div>

      {/* KPI'S DE ASISTENCIA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm md:col-span-2 flex items-center justify-between hover:-translate-y-1 hover:shadow-md transition-all">
          <div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Porcentaje Anual</p>
            <div className="flex items-end gap-2">
              <h2 className={`text-4xl font-black ${resumen.porcentajeGlobal >= 85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {resumen.porcentajeGlobal}%
              </h2>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Meta Mineduc: 85%</span>
            </div>
          </div>
          <div className="w-32 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${resumen.porcentajeGlobal}%` }}></div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center hover:-translate-y-1 hover:shadow-md transition-all">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Días Ausente</p>
          <h2 className="text-3xl font-black text-red-500 dark:text-red-400">{resumen.diasAusente}</h2>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm flex flex-col items-center justify-center text-center hover:-translate-y-1 hover:shadow-md transition-all">
          <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Atrasos</p>
          <h2 className="text-3xl font-black text-amber-500 dark:text-amber-400">{resumen.atrasos}</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CALENDARIO ELEGANTE */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden h-full">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800 dark:text-white">Junio 2026</h2>
              <div className="flex gap-4 text-[10px] font-bold uppercase text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Presente</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span> Ausente</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Atraso</span>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="text-center text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">{d}</div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 gap-y-4 gap-x-2">
                {diasMes.map(dia => (
                  <div key={dia.id} className="flex justify-center">
                    <div 
                      className={`w-9 h-9 flex items-center justify-center rounded-full text-sm font-semibold transition-all ${
                        dia.estado === 'presente' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50' :
                        dia.estado === 'ausente' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 ring-1 ring-red-300 dark:ring-red-800/50 shadow-sm dark:shadow-none' :
                        dia.estado === 'atraso' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 ring-1 ring-amber-300 dark:ring-amber-800/50 shadow-sm dark:shadow-none' :
                        dia.estado === 'fin-de-semana' ? 'text-gray-300 dark:text-gray-600 bg-transparent' :
                        'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700' 
                      }`}
                    >
                      {dia.dia}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* HISTORIAL */}
        <div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden h-full flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-sm font-bold text-gray-800 dark:text-white">Registro de Inasistencias</h2>
            </div>
            
            <div className="divide-y divide-gray-100 dark:divide-gray-700 flex-1 overflow-y-auto custom-scrollbar">
              {historial.map(item => (
                <div key={item.id} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${item.tipo === 'Ausente' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{item.tipo}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      item.estado === 'Justificada' 
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                      : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {item.estado}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{item.fecha}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 italic bg-gray-50 dark:bg-gray-900/50 p-2 rounded border border-gray-100 dark:border-gray-700">
                    Obs: {item.observacion}
                  </p>
                  
                  {/* REGLA LEGAL: SOLO APODERADO VE ESTE BOTÓN */}
                  {item.estado === 'Sin Justificar' && userRole === 'apoderado' && (
                    <button 
                      onClick={() => setIsModalOpen(true)}
                      className="mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      Adjuntar Justificativo
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL PARA SUBIR CERTIFICADO (Mismo diseño premium anterior) --- */}
      {isModalOpen && userRole === 'apoderado' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
           {/* ... el código del modal se mantiene igual ... */}
        </div>
      )}

    </div>
  );
}