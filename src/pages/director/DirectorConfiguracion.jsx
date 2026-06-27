import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import { SkeletonCard, SkeletonBase } from '../../components/SkeletonLoader';
import BackdropLoader from '../../components/BackdropLoader';
export default function DirectorConfiguracion() {
  const [config, setConfig] = useState({
    nombre_colegio: '',
    rbd: '',
    nombre_director: '',
    resolucion_exenta: ''
  });
  const [firmaFile, setFirmaFile] = useState(null);
  const [firmaUrl, setFirmaUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    cargarConfiguracion();
  }, []);

  const cargarConfiguracion = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from('configuracion_colegio').select('*').limit(1).maybeSingle();
      if (error && error.code !== 'PGRST116') throw error; // Ignorar si no existe (crearemos luego)
      
      if (data) {
        setConfig({
          id: data.id,
          nombre_colegio: data.nombre_colegio || '',
          rbd: data.rbd || '',
          nombre_director: data.nombre_director || '',
          resolucion_exenta: data.resolucion_exenta || ''
        });
        if (data.firma_director_url) setFirmaUrl(data.firma_director_url);
      }
    } catch (error) {
      console.error("Error cargando configuración:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const guardarCambios = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let finalFirmaUrl = firmaUrl;

      // Subir firma si hay una nueva
      if (firmaFile) {
        const fileExt = firmaFile.name.split('.').pop();
        const fileName = `firma_director_${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('documentos').upload(fileName, firmaFile);
        
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(fileName);
        finalFirmaUrl = publicUrl;
      }

      const upsertData = {
        nombre_colegio: config.nombre_colegio,
        rbd: config.rbd,
        nombre_director: config.nombre_director,
        resolucion_exenta: config.resolucion_exenta,
        firma_director_url: finalFirmaUrl
      };

      if (config.id) {
        upsertData.id = config.id; // Para hacer UPDATE si ya existe
      }

      // Upsert: Si tiene ID actualiza, si no, inserta
      const { data, error } = await supabase.from('configuracion_colegio').upsert([upsertData]).select();
      if (error) throw error;

      toast.success("¡Configuración guardada exitosamente! Todos los PDFs nuevos utilizarán esta información.");
      if (data && data[0]) {
        setConfig(prev => ({ ...prev, id: data[0].id }));
        setFirmaUrl(data[0].firma_director_url);
      }
      setFirmaFile(null);

    } catch (error) {
      console.error(error);
      toast.error("Error guardando la configuración. Verifica que la tabla exista en Supabase.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-8 space-y-6 bg-gray-50/50 dark:bg-gray-900">
        <SkeletonBase className="w-1/3 h-8" />
        <SkeletonCard className="h-96 max-w-3xl" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />
      
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Configuración Institucional</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Datos maestros para la generación automática de certificados y documentos.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 sm:p-8 max-w-3xl relative overflow-hidden">
        {isSaving && <BackdropLoader mensaje="Guardando configuración..." />}
        <form onSubmit={guardarCambios} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nombre de la Institución</label>
              <input 
                type="text" 
                required 
                value={config.nombre_colegio} 
                onChange={(e) => setConfig({...config, nombre_colegio: e.target.value})}
                placeholder="Ej: Colegio Bicentenario"
                className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm dark:text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">RBD (Rol Base de Datos)</label>
              <input 
                type="text" 
                required 
                value={config.rbd} 
                onChange={(e) => setConfig({...config, rbd: e.target.value})}
                placeholder="Ej: 12345-6"
                className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm dark:text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nombre del Director(a)</label>
              <input 
                type="text" 
                required 
                value={config.nombre_director} 
                onChange={(e) => setConfig({...config, nombre_director: e.target.value})}
                placeholder="Ej: Felipe Guzmán Vega"
                className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm dark:text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Resolución Exenta (Opcional)</label>
              <input 
                type="text" 
                value={config.resolucion_exenta} 
                onChange={(e) => setConfig({...config, resolucion_exenta: e.target.value})}
                placeholder="Ej: Resolución Nº 1234"
                className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm dark:text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Firma Digital del Director(a)</label>
            <p className="text-xs text-gray-500 mb-4">Esta firma aparecerá al pie de los certificados (Formato PNG transparente recomendado).</p>
            
            <div className="flex items-center gap-6">
              {firmaUrl ? (
                <div className="w-32 h-auto p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
                  <img src={firmaUrl} alt="Firma Director" className="w-full h-auto object-contain" />
                </div>
              ) : (
                <div className="w-32 h-16 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                  <span className="text-xs text-gray-400 font-medium">Sin firma</span>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setFirmaFile(e.target.files[0])}
                className="text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-end">
            <button 
              type="submit" 
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              Guardar Configuración
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
