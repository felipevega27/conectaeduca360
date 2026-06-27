import { useState, useEffect } from 'react';
import BackdropLoader from '../../components/BackdropLoader';
import { supabase } from '../../config/supabaseClient';

export default function ApoderadoAsistencia() {
  const [pupilos, setPupilos] = useState([]);
  const [pupiloActivo, setPupiloActivo] = useState(null);
  const [inasistencias, setInasistencias] = useState([]);
  const [metricas, setMetricas] = useState({ porcentaje: 100, faltas: 0, atrasos: 0 });
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Inicializar estado desde localStorage
  useEffect(() => {
    const pActivoStr = localStorage.getItem('pupiloActivo');
    const pListaStr = localStorage.getItem('apoderadoPupilos');
    if (pActivoStr) setPupiloActivo(JSON.parse(pActivoStr));
    if (pListaStr) setPupilos(JSON.parse(pListaStr));
  }, []);

  // Escuchar si el pupilo cambia en otra vista
  useEffect(() => {
    const handlePupiloChanged = () => {
      const pActivoStr = localStorage.getItem('pupiloActivo');
      if (pActivoStr) setPupiloActivo(JSON.parse(pActivoStr));
    };
    window.addEventListener('pupiloChanged', handlePupiloChanged);
    return () => window.removeEventListener('pupiloChanged', handlePupiloChanged);
  }, []);

  // Cargar asistencia
  useEffect(() => {
    if (pupiloActivo) {
      cargarAsistencia(pupiloActivo.rut);
    }
  }, [pupiloActivo]);

  const cargarAsistencia = async (rutAlumno) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('asistencia_alumnos')
        .select('*')
        .eq('rut_alumno', rutAlumno)
        .order('fecha', { ascending: false });

      if (data) {
        const total = data.length;
        const faltasArr = data.filter(a => a.estado.toLowerCase() === 'ausente');
        const atrasosArr = data.filter(a => a.estado.toLowerCase() === 'atrasado');
        const presentes = total - faltasArr.length - atrasosArr.length;
        
        const porcentaje = total > 0 ? Math.round(((presentes + atrasosArr.length) / total) * 100) : 100;

        setMetricas({ porcentaje, faltas: faltasArr.length, atrasos: atrasosArr.length });

        const anomalos = [...faltasArr, ...atrasosArr].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        setInasistencias(anomalos.map(a => ({
          id: a.id,
          fecha: new Date(a.fecha).toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
          tipo: a.estado.toLowerCase() === 'ausente' ? 'Ausencia Día Completo' : 'Atraso',
          estado: 'Pendiente de Justificar', // Simulado
          comprobante: null
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCambiarPupilo = (e) => {
    const seleccionado = pupilos.find(p => p.rut === e.target.value);
    setPupiloActivo(seleccionado);
    localStorage.setItem('pupiloActivo', JSON.stringify(seleccionado));
    window.dispatchEvent(new Event('pupiloChanged'));
  };

  const handleJustificar = (e) => {
    e.preventDefault();
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setIsModalOpen(false);
      alert('Certificado enviado exitosamente a Inspectoría.');
    }, 1500);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando asistencia...</div>;
  }

  if (!pupiloActivo) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm text-center">
          <p className="text-gray-500">No tienes pupilos asignados a tu cuenta.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Asistencia y Justificativos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestione legalmente las inasistencias de su pupilo.</p>
        </div>
        
        {/* Selector de Pupilo */}
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900 p-2 pl-3 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="h-8 w-8 shrink-0 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
            {pupiloActivo.iniciales || pupiloActivo.nombre.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
          </div>
          <div className="flex flex-col flex-1 pr-2">
            {pupilos.length > 1 ? (
              <select 
                value={pupiloActivo.rut} 
                onChange={handleCambiarPupilo}
                className="bg-transparent text-sm font-bold text-gray-800 dark:text-gray-200 leading-none outline-none cursor-pointer appearance-none"
              >
                {pupilos.map(p => (
                  <option key={p.rut} value={p.rut} className="text-gray-800">{p.nombre}</option>
                ))}
              </select>
            ) : (
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 leading-none">{pupiloActivo.nombre}</span>
            )}
            <span className="text-[10px] text-gray-500 uppercase font-semibold mt-0.5">{pupiloActivo.curso}</span>
          </div>
          {pupilos.length > 1 && (
            <svg className="w-5 h-5 text-gray-400 pointer-events-none mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PANEL IZQUIERDO: RESUMEN Y BOTÓN DE ACCIÓN */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-6">Resumen Anual</h3>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Asistencia Total</span>
                  <span className={`text-2xl font-black ${metricas.porcentaje < 85 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{metricas.porcentaje}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div className={`${metricas.porcentaje < 85 ? 'bg-red-500' : 'bg-emerald-500'} h-2 rounded-full`} style={{ width: `${metricas.porcentaje}%` }}></div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2 text-right">Límite legal para aprobar: 85%</p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <p className="text-xs text-gray-500">Inasistencias</p>
                  <p className="text-xl font-bold text-red-600">{metricas.faltas} Días</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Atrasos</p>
                  <p className="text-xl font-bold text-amber-500">{metricas.atrasos} Días</p>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-600/20 transition-all flex justify-center items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            Subir Nuevo Justificativo
          </button>
        </div>

        {/* PANEL DERECHO: HISTORIAL LEGAL */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
            <h2 className="text-sm font-bold text-gray-800 dark:text-white">Trámites de Justificación</h2>
          </div>
          
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {inasistencias.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No hay inasistencias ni atrasos registrados.</div>
            ) : (
              inasistencias.map((item) => (
                <div key={item.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${item.tipo.includes('Ausencia') ? 'bg-red-500' : 'bg-amber-500'}`}></span>
                      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 capitalize">{item.fecha}</h3>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{item.tipo}</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      item.estado === 'Aprobado por Inspectoría' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.estado}
                    </span>
                  </div>

                  <div className="flex flex-col justify-center sm:items-end">
                    {item.estado === 'Pendiente de Justificar' ? (
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="mt-2 sm:mt-0 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        Adjuntar Documento
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                        {item.comprobante}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL JUSTIFICACIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in-up relative overflow-hidden">
            {isUploading && <BackdropLoader mensaje="Enviando justificativo..." />}
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Enviar Justificativo</h2>
            <p className="text-xs text-gray-500 mb-6">El documento será revisado por Inspectoría General.</p>
            
            <form onSubmit={handleJustificar} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">1. Seleccione la fecha</label>
                <select className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  {inasistencias.filter(i => i.estado === 'Pendiente de Justificar').map(i => (
                    <option key={i.id}>{i.fecha} ({i.tipo})</option>
                  ))}
                  {inasistencias.filter(i => i.estado === 'Pendiente de Justificar').length === 0 && (
                    <option disabled>No hay inasistencias pendientes</option>
                  )}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">2. Fotografía o PDF del Certificado Médico</label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-blue-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors">
                  <svg className="w-8 h-8 text-blue-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Toca para subir archivo</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 transition-colors">Cancelar</button>
                <button type="submit" disabled={isUploading} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex justify-center items-center">
                  Enviar a Inspectoría
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}