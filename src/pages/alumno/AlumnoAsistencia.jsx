import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { useAuth } from '../../context/AuthContext';

export default function AlumnoAsistencia() {
  const { user } = useAuth();
  // --- CONTROL DE ROLES (LA REGLA LEGAL) ---
  const [userRole, setUserRole] = useState('alumno'); 
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Leemos quién inició sesión realmente
    if (user) {
      setUserRole(user.role || user.rol || 'alumno');
      setCurrentUser(user);
      cargarDatos(user.rut);
    }
  }, [user]);

  // --- ESTADOS INTERACTIVOS ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [faltaSeleccionada, setFaltaSeleccionada] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // States for Justification
  const [archivoCertificado, setArchivoCertificado] = useState(null);
  const [motivoJustificacion, setMotivoJustificacion] = useState('');

  // --- DATOS REALES ---
  const [resumen, setResumen] = useState({
    porcentajeGlobal: 0,
    diasPresente: 0,
    diasAusente: 0,
    atrasos: 0
  });

  const [historial, setHistorial] = useState([]);
  const [diasMes, setDiasMes] = useState([]);

  const generarCalendario = (asistencias) => {
    const fechaActual = new Date();
    // Forzamos a usar el mes y año local para evitar problemas de zona horaria
    const mesActual = fechaActual.getMonth(); 
    const anioActual = fechaActual.getFullYear();
    const diasEnMes = new Date(anioActual, mesActual + 1, 0).getDate();
    
    const dias = Array.from({ length: diasEnMes }, (_, i) => {
      const dia = i + 1;
      const fechaLocal = new Date(anioActual, mesActual, dia);
      const diaSemana = fechaLocal.getDay();
      
      // Formato YYYY-MM-DD local
      const mesStr = String(mesActual + 1).padStart(2, '0');
      const diaStr = String(dia).padStart(2, '0');
      const fechaString = `${anioActual}-${mesStr}-${diaStr}`;
      
      let estado = 'futuro';
      if (diaSemana === 0 || diaSemana === 6) {
         estado = 'fin-de-semana';
      } else {
         const registro = asistencias.find(a => a.fecha === fechaString);
         if (registro) {
            estado = registro.estado.toLowerCase();
         } else if (fechaLocal <= fechaActual) {
            estado = 'sin-registro'; 
         }
      }
      return { id: dia, dia, estado, fecha: fechaString };
    });
    setDiasMes(dias);
  };

  const cargarDatos = async (rutAlumno) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('asistencia_alumnos')
        .select('*')
        .eq('rut_alumno', rutAlumno)
        .order('fecha', { ascending: false });
        
      if (error) throw error;

      if (data) {
        let presentes = 0;
        let ausentes = 0;
        let atrasosCount = 0;
        
        const hist = [];
        
        data.forEach(reg => {
           const est = reg.estado.toLowerCase();
           if (est === 'presente') presentes++;
           if (est === 'ausente') ausentes++;
           if (est === 'atraso') atrasosCount++;
           
           if (est === 'ausente' || est === 'atraso') {
              hist.push({
                 id: reg.id,
                 fecha: new Date(reg.fecha + 'T00:00:00').toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long' }),
                 tipo: reg.estado,
                 estado: reg.justificado ? 'Justificada' : 'Sin Justificar',
                 observacion: reg.observacion_justificacion || '-'
              });
           }
        });
        
        const total = presentes + ausentes + atrasosCount;
        const porcentaje = total > 0 ? Math.round(((presentes + atrasosCount) / total) * 100) : 100;
        
        setResumen({
          porcentajeGlobal: porcentaje,
          diasPresente: presentes,
          diasAusente: ausentes,
          atrasos: atrasosCount
        });
        
        setHistorial(hist);
        generarCalendario(data);
      }
    } catch (err) {
      console.error('Error cargando asistencia:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadCertificado = async (e) => {
    e.preventDefault();
    if (!faltaSeleccionada) return alert("Selecciona una inasistencia para justificar.");
    setIsUploading(true);
    
    try {
      let publicUrl = null;

      if (archivoCertificado) {
        const fileExt = archivoCertificado.name.split('.').pop();
        const fileName = `${currentUser.rut.replace(/[^0-9kK]/g, '')}_falta_${faltaSeleccionada.id}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('certificados')
          .upload(fileName, archivoCertificado);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('certificados')
          .getPublicUrl(fileName);
        
        publicUrl = data.publicUrl;
      }

      // Update the record in asistencia_alumnos to mark it as justified
      const { error } = await supabase
        .from('asistencia_alumnos')
        .update({
          justificado: true,
          archivo_justificacion_url: publicUrl,
          observacion_justificacion: motivoJustificacion
        })
        .eq('id', faltaSeleccionada.id);

      if (error) throw error;

      alert('Certificado enviado exitosamente a Inspectoría.');
      setIsModalOpen(false);
      setArchivoCertificado(null);
      setMotivoJustificacion('');
      setFaltaSeleccionada(null);
      cargarDatos(currentUser.rut);
    } catch (err) {
      console.error(err);
      alert('Hubo un error al enviar la justificación. Asegúrate de que el backend soporte estas columnas (justificado, archivo_justificacion_url, observacion_justificacion).');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando tu registro de asistencia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      
      {/* CABECERA */}
      <div className="mb-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Registro de Asistencia</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Monitorea tu calendario mensual de ingresos y atrasos.</p>
        </div>
        
        {/* REGLA LEGAL: SOLO EL APODERADO PUEDE VER EL BOTÓN DE JUSTIFICAR */}
        {userRole === 'apoderado' ? (
          <button 
            onClick={() => {
              // Automatically select the first unjustified absence if available
              const firstUnjustified = historial.find(h => h.estado === 'Sin Justificar');
              setFaltaSeleccionada(firstUnjustified || null);
              setIsModalOpen(true);
            }}
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
              <h2 className="text-base font-bold text-gray-800 dark:text-white capitalize">
                {new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
              </h2>
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
                        dia.estado === 'futuro' ? 'text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700' :
                        'text-gray-400 dark:text-gray-500 bg-transparent border border-dashed border-gray-300 dark:border-gray-600' 
                      }`}
                      title={dia.fecha}
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
              {historial.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">No tienes inasistencias registradas.</div>
              ) : (
                historial.map(item => (
                  <div key={item.id} className="p-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.tipo.toLowerCase() === 'ausente' ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 capitalize">{item.tipo}</p>
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
                      onClick={() => {
                        setFaltaSeleccionada(item);
                        setIsModalOpen(true);
                      }}
                      className="mt-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                      Adjuntar Justificativo
                    </button>
                  )}
                </div>
              )))}
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL PARA SUBIR CERTIFICADO (Mismo diseño premium anterior) --- */}
      {isModalOpen && userRole === 'apoderado' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in-up border border-gray-200 dark:border-gray-700 relative">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                Justificar Falta
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <form onSubmit={handleUploadCertificado} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Inasistencia a justificar</label>
                <select 
                  value={faltaSeleccionada?.id || ''} 
                  onChange={(e) => {
                    const found = historial.find(h => h.id.toString() === e.target.value);
                    setFaltaSeleccionada(found || null);
                  }}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                  required
                >
                  <option value="" disabled>Seleccione una inasistencia...</option>
                  {historial.filter(h => h.estado === 'Sin Justificar').map(h => (
                    <option key={h.id} value={h.id}>{h.fecha} - {h.tipo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Certificado Médico u otro (Opcional)</label>
                <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group">
                  <input 
                    type="file" 
                    onChange={(e) => setArchivoCertificado(e.target.files[0])} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                  />
                  {archivoCertificado ? (
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{archivoCertificado.name}</p>
                    </div>
                  ) : (
                    <>
                      <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3 group-hover:scale-110 transition-transform">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      </div>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Haz clic para adjuntar certificado</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Soporta PDF o Imágenes</p>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Motivo / Observación</label>
                <textarea 
                  rows="3" 
                  value={motivoJustificacion}
                  onChange={(e) => setMotivoJustificacion(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                  placeholder="Ej: Problemas de salud, asistencia a médico, etc."
                  required
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isUploading}
                  className="flex-1 py-2.5 rounded-xl font-bold text-white shadow-lg transition-colors flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 disabled:bg-blue-400 disabled:shadow-none disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Enviando...' : 'Enviar Justificación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}