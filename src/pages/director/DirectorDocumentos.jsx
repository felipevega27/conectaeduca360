import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import html2pdf from 'html2pdf.js';
import CertificadoAlumnoRegular from '../../components/documentos/CertificadoAlumnoRegular';
import CertificadoMatricula from '../../components/documentos/CertificadoMatricula';
import InformeNotas from '../../components/documentos/InformeNotas';
import UserAvatar from '../../components/UserAvatar';

export default function DirectorDocumentos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [alumnos, setAlumnos] = useState([]);
  const [selectedAlumno, setSelectedAlumno] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Datos para Informe de Notas
  const [notasAlumno, setNotasAlumno] = useState([]);
  const [isFetchingNotas, setIsFetchingNotas] = useState(false);

  // Configuración Institucional
  const [config, setConfig] = useState(null);

  // Referencias para react-to-print
  const refRegular = useRef();
  const refMatricula = useRef();
  const refNotas = useRef();

  // Fecha y correlativo falsos
  const fechaHoy = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
  const correlativoRandom = Math.floor(Math.random() * 900) + 100;

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data } = await supabase.from('configuracion_colegio').select('*').limit(1).maybeSingle();
        if (data) setConfig(data);
      } catch (err) {
        console.error("Error al cargar configuración", err);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const fetchAlumnos = async () => {
      if (searchTerm.length < 2) {
        setAlumnos([]);
        return;
      }
      setIsLoading(true);
      try {
        const { data } = await supabase
          .from('perfiles')
          .select('*')
          .eq('rol', 'alumno')
          .or(`nombre.ilike.%${searchTerm}%,rut.ilike.%${searchTerm}%`)
          .limit(10);
        
        setAlumnos(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchAlumnos();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Cargar notas y curso al seleccionar alumno
  const handleSelectAlumno = async (alumno) => {
    // Estado intermedio para no fallar si faltan datos
    setSelectedAlumno({ ...alumno, curso: 'Buscando curso...' });
    setSearchTerm('');
    setAlumnos([]);
    
    setIsFetchingNotas(true);
    try {
      // 1. Obtener curso real
      const { data: matricula } = await supabase
        .from('matriculas')
        .select('id_curso')
        .eq('rut_alumno', alumno.rut)
        .maybeSingle();

      let nombreCurso = 'Sin curso asignado';
      if (matricula && matricula.id_curso) {
        const { data: curso } = await supabase
          .from('cursos')
          .select('nombre')
          .eq('id', matricula.id_curso)
          .maybeSingle();
        if (curso) nombreCurso = curso.nombre;
      }

      setSelectedAlumno({ ...alumno, curso: nombreCurso });

      // 2. Obtener notas
      const { data: notasData } = await supabase
        .from('notas')
        .select('*, asignaturas(nombre)')
        .eq('rut_alumno', alumno.rut);

      if (notasData && notasData.length > 0) {
        // Agrupar por asignatura
        const grouped = {};
        notasData.forEach(n => {
          const asigName = n.asignaturas?.nombre || 'General';
          if (!grouped[asigName]) grouped[asigName] = [];
          grouped[asigName].push(n.nota);
        });

        const notasFormat = Object.keys(grouped).map(asigName => {
          const vals = grouped[asigName];
          return {
            asignatura: asigName,
            n1: vals[0] || null,
            n2: vals[1] || null,
            n3: vals[2] || null,
            n4: vals[3] || null,
            promedio: parseFloat((vals.reduce((a,b)=>a+b,0) / vals.length).toFixed(1))
          };
        });
        setNotasAlumno(notasFormat);
      } else {
        setNotasAlumno([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingNotas(false);
    }
  };

  const downloadPDF = (ref, fileName) => {
    const element = ref.current;
    if (!element) return;
    
    const opt = {
      margin:       0.5,
      filename:     `${fileName}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, windowWidth: 800 },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
  };

  const handlePrintRegular = () => downloadPDF(refRegular, `Certificado_Regular_${selectedAlumno?.rut || ''}`);
  const handlePrintMatricula = () => downloadPDF(refMatricula, `Certificado_Matricula_${selectedAlumno?.rut || ''}`);
  const handlePrintNotas = () => downloadPDF(refNotas, `Informe_Notas_${selectedAlumno?.rut || ''}`);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Generación de Documentos</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Emite certificados oficiales y actas en formato PDF listos para imprimir.
          </p>
        </div>
      </div>

      {/* BUSCADOR SIMPLIFICADO Y FUNCIONAL */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 relative">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Buscar Alumno (Nombre o RUT)
        </label>
        
        <div className="relative">
          <input 
            type="text" 
            placeholder="Escribe el nombre o RUT del estudiante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-12 pr-12 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none transition-colors"
          />
          <svg className="w-5 h-5 absolute left-4 top-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          
          {isLoading && (
            <div className="absolute right-4 top-3.5">
              <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
          
          {searchTerm && !isLoading && (
            <button onClick={() => { setSearchTerm(''); setAlumnos([]); }} className="absolute right-4 top-3.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}

          {/* Resultados Flotantes */}
          {(alumnos.length > 0 || (searchTerm.length >= 2 && !isLoading && alumnos.length === 0)) && (
            <div className="absolute z-50 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-80 overflow-y-auto">
              
              {alumnos.length === 0 && !isLoading && searchTerm.length >= 2 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No se encontraron estudiantes con "{searchTerm}"
                </div>
              ) : (
                <div className="py-2">
                  <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50">
                    Resultados encontrados ({alumnos.length})
                  </div>
                  {alumnos.map(al => (
                    <button 
                      key={al.rut}
                      onClick={() => handleSelectAlumno(al)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-b border-gray-50 dark:border-gray-700/50 last:border-0 transition-colors flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <UserAvatar nombre={al.nombre} avatarUrl={al.avatar_url} className="w-10 h-10 text-sm bg-blue-100 text-blue-700" />
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{al.nombre}</p>
                          <p className="text-xs text-gray-500">{al.rut}</p>
                        </div>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        Seleccionar
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* PANEL DE ALUMNO Y BOTONES */}
      {selectedAlumno && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Info Alumno */}
          <div className="col-span-1 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col items-center text-center">
              <UserAvatar nombre={selectedAlumno.nombre} avatarUrl={selectedAlumno.avatar_url} className="w-24 h-24 text-2xl bg-blue-100 text-blue-700 shadow-sm mb-4" />
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">{selectedAlumno.nombre}</h3>
              <p className="text-sm text-gray-500 mb-4">{selectedAlumno.rut}</p>
              <div className="w-full bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500">Curso:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{selectedAlumno.curso}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Rol:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 capitalize">{selectedAlumno.rol}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedAlumno(null)} className="mt-6 w-full py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
              Cambiar Estudiante
            </button>
          </div>

          {/* Botones Emisión */}
          <div className="col-span-1 md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Certificado Regular */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 p-6 rounded-2xl border border-blue-100 dark:border-gray-700 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center shadow-sm mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <h4 className="font-bold text-gray-800 dark:text-white mb-2">Certificado Alumno Regular</h4>
              <p className="text-xs text-gray-500 mb-6 flex-grow">Documento oficial para acreditar situación escolar activa del estudiante.</p>
              <button onClick={handlePrintRegular} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-sm text-sm flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Generar PDF
              </button>
            </div>

            {/* Certificado Matrícula */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-800 dark:to-gray-800 p-6 rounded-2xl border border-emerald-100 dark:border-gray-700 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center shadow-sm mb-4">
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
              </div>
              <h4 className="font-bold text-gray-800 dark:text-white mb-2">Certificado de Matrícula</h4>
              <p className="text-xs text-gray-500 mb-6 flex-grow">Acredita que el alumno fue ingresado correctamente al sistema.</p>
              <button onClick={handlePrintMatricula} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-sm text-sm flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Generar PDF
              </button>
            </div>

            {/* Informe de Notas */}
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-800 dark:to-gray-800 p-6 rounded-2xl border border-purple-100 dark:border-gray-700 flex flex-col items-center text-center sm:col-span-2">
              <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center shadow-sm mb-4">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <h4 className="font-bold text-gray-800 dark:text-white mb-2">Concentración de Notas Parcial</h4>
              <p className="text-xs text-gray-500 mb-6">Genera un informe con las calificaciones actuales del estudiante por asignatura y promedio general.</p>
              <button 
                onClick={handlePrintNotas} 
                disabled={isFetchingNotas}
                className="w-full max-w-xs bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-xl transition-colors shadow-sm text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                {isFetchingNotas ? 'Cargando Notas...' : 'Generar PDF'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* COMPONENTES OCULTOS PARA IMPRESIÓN (Off-screen) */}
      <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', overflow: 'hidden' }}>
        {/* Vista Previa Oculta */}
        <div>
          <CertificadoAlumnoRegular ref={refRegular} alumno={selectedAlumno} fechaEmision={fechaHoy} correlativo={correlativoRandom} config={config} />
        </div>
        {/* Vista Previa Oculta */}
        <div>
          <CertificadoMatricula ref={refMatricula} alumno={selectedAlumno} fechaEmision={fechaHoy} correlativo={correlativoRandom + 1} config={config} />
        </div>
        {/* Vista Previa Oculta */}
        <div>
          <InformeNotas ref={refNotas} alumno={selectedAlumno} notas={notasAlumno} fechaEmision={fechaHoy} correlativo={correlativoRandom + 2} config={config} />
        </div>
      </div>

    </div>
  );
}
