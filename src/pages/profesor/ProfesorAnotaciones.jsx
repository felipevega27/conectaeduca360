import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function ProfesorAnotaciones() {
  const [user, setUser] = useState(null);

  // --- ESTADOS DEL FORMULARIO ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlumno, setSelectedAlumno] = useState(null);
  const [tipoAnotacion, setTipoAnotacion] = useState('negativa'); // 'positiva', 'negativa', 'observacion'
  const [gravedad, setGravedad] = useState('Leve');
  const [descripcion, setDescripcion] = useState('');

  // Datos desde Supabase
  const [alumnosDisponibles, setAlumnosDisponibles] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loggedUserJSON = localStorage.getItem('userLogged');
    if (loggedUserJSON) {
      const parsedUser = JSON.parse(loggedUserJSON);
      setUser(parsedUser);
      cargarAlumnosProfesor(parsedUser.rut);
      cargarHistorialReciente(parsedUser.rut);
    }
  }, []);

  const cargarAlumnosProfesor = async (rutProfesor) => {
    try {
      // 1. Obtener cursos donde hace clases
      const { data: asignaturas } = await supabase
        .from('asignaturas')
        .select('id_curso, cursos(nombre)')
        .eq('rut_profesor', rutProfesor);

      if (!asignaturas || asignaturas.length === 0) return;
      
      const cursosIds = [...new Set(asignaturas.map(a => a.id_curso))];

      // 2. Obtener alumnos de esos cursos
      const { data: matriculas } = await supabase
        .from('matriculas')
        .select('rut_alumno, id_curso')
        .in('id_curso', cursosIds);

      if (matriculas && matriculas.length > 0) {
        const ruts = matriculas.map(m => m.rut_alumno);
        const { data: perfiles } = await supabase.from('perfiles').select('rut, nombre').in('rut', ruts);

        const alumnosFormateados = matriculas.map(m => {
          const perfil = perfiles?.find(p => p.rut === m.rut_alumno);
          const cursoName = asignaturas.find(a => a.id_curso === m.id_curso)?.cursos?.nombre || 'Curso Desconocido';
          return {
            id: m.rut_alumno,
            rut: m.rut_alumno,
            nombre: perfil?.nombre || 'Sin Nombre',
            curso: cursoName
          };
        });

        // Eliminar duplicados
        const alumnosUnicos = Array.from(new Map(alumnosFormateados.map(a => [a.rut, a])).values());
        alumnosUnicos.sort((a,b) => a.nombre.localeCompare(b.nombre));
        setAlumnosDisponibles(alumnosUnicos);
      } else {
        setAlumnosDisponibles([]);
      }
    } catch (error) {
      console.error('Error cargando alumnos:', error);
    }
  };

  const cargarHistorialReciente = async (rutProfesor) => {
    try {
      const { data } = await supabase
        .from('anotaciones')
        .select('id, tipo, gravedad, descripcion, fecha, rut_alumno')
        .eq('rut_profesor', rutProfesor)
        .order('fecha', { ascending: false })
        .limit(10);
      
      if (data && data.length > 0) {
        const rutsAnotaciones = data.map(a => a.rut_alumno);
        const { data: perfiles } = await supabase.from('perfiles').select('rut, nombre').in('rut', rutsAnotaciones);

        const historialMapeado = data.map(a => {
          const perfil = perfiles?.find(p => p.rut === a.rut_alumno);
          return {
            ...a,
            perfiles: { nombre: perfil?.nombre || 'Sin Nombre' }
          };
        });
        setHistorial(historialMapeado);
      } else {
        setHistorial([]);
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
    }
  };

  const alumnosFiltrados = searchTerm 
    ? alumnosDisponibles.filter(a => a.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || a.curso.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (!selectedAlumno) {
      toast.error('Por favor seleccione un estudiante primero.');
      return;
    }
    if (!descripcion.trim()) {
      toast.error('La descripción no puede estar vacía.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Guardando anotación...');

    try {
      const { error } = await supabase.from('anotaciones').insert([{
        rut_alumno: selectedAlumno.rut,
        rut_profesor: user.rut,
        tipo: tipoAnotacion,
        gravedad: tipoAnotacion === 'negativa' ? gravedad : null,
        descripcion: descripcion
      }]);

      if (error) throw error;

      toast.success(`Anotación guardada en hoja de vida de ${selectedAlumno.nombre}`, { id: toastId });
      
      // Limpiar formulario y recargar historial
      setSelectedAlumno(null);
      setSearchTerm('');
      setDescripcion('');
      cargarHistorialReciente(user.rut);

    } catch (error) {
      console.error('Error al guardar anotación:', error);
      toast.error('Hubo un error al guardar.', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportarPDF = () => {
    try {
      const doc = new jsPDF();
      const fechaHoy = new Date().toLocaleDateString('es-CL');
      
      doc.setFontSize(18);
      doc.text('Mis Anotaciones Registradas', 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Profesor: ${user?.nombre || 'N/A'}`, 14, 30);
      doc.text(`Fecha Emisión: ${fechaHoy}`, 14, 36);

      const tableColumn = ["Fecha", "Alumno", "Tipo", "Gravedad", "Descripción"];
      const tableRows = [];

      historial.forEach(item => {
        const rowData = [
          formatDate(item.fecha),
          item.perfiles?.nombre || 'Desconocido',
          item.tipo,
          item.gravedad || 'N/A',
          item.descripcion
        ];
        tableRows.push(rowData);
      });

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42] }
      });

      doc.save(`Anotaciones_Profesor_${fechaHoy.replace(/\//g, '-')}.pdf`);
      toast.success('PDF exportado correctamente');
    } catch (error) {
      console.error("Error al generar PDF", error);
      toast.error('Error al generar PDF');
    }
  };

  const handleExportarExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Mis Anotaciones');
      
      worksheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Alumno', key: 'alumno', width: 25 },
        { header: 'Tipo de Falta', key: 'tipo', width: 20 },
        { header: 'Gravedad', key: 'gravedad', width: 15 },
        { header: 'Descripción', key: 'descripcion', width: 60 }
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

      historial.forEach(item => {
        worksheet.addRow({
          fecha: formatDate(item.fecha),
          alumno: item.perfiles?.nombre || 'Desconocido',
          tipo: item.tipo,
          gravedad: item.gravedad || 'N/A',
          descripcion: item.descripcion
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fechaHoy = new Date().toLocaleDateString('es-CL').replace(/\//g, '-');
      saveAs(blob, `Anotaciones_Profesor_${fechaHoy}.xlsx`);
      toast.success('Excel exportado correctamente');
    } catch (error) {
      console.error("Error al generar Excel", error);
      toast.error('Error al generar Excel');
    }
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      <Toaster position="top-right" toastOptions={{ className: 'dark:bg-gray-800 dark:text-white dark:border dark:border-gray-700' }} />
      
      {/* CABECERA */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Hoja de Vida y Convivencia</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Ingreso rápido de anotaciones al libro digital.</p>
        </div>
        
        {/* BOTONES EXPORTAR EN CABECERA ESTÁNDAR */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            onClick={handleExportarPDF} 
            disabled={historial.length === 0}
            className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Descargar historial en PDF"
          >
            <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Exportar PDF
          </button>
          <button 
            onClick={handleExportarExcel} 
            disabled={historial.length === 0}
            className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Descargar historial en Excel"
          >
            <svg className="w-5 h-5 text-green-600 dark:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exportar Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* COLUMNA IZQUIERDA: FORMULARIO DE INGRESO */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              <h2 className="text-base font-bold text-gray-800 dark:text-white">Nueva Anotación</h2>
            </div>

            <form onSubmit={handleGuardar} className="p-6 space-y-6">
              
              {/* 1. SELECCIÓN DE ALUMNO */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">1. Buscar Estudiante</label>
                {!selectedAlumno ? (
                  <div className="relative">
                    <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input 
                      type="text" 
                      placeholder="Escriba el nombre o curso del estudiante..." 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-10 pl-10 pr-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:text-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all"
                    />
                    
                    {/* Resultados de búsqueda flotantes */}
                    {searchTerm && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                        {alumnosFiltrados.length > 0 ? (
                          alumnosFiltrados.map(a => (
                            <div 
                              key={a.id} 
                              onClick={() => { setSelectedAlumno(a); setSearchTerm(''); }}
                              className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-50 dark:border-gray-700 last:border-0 flex items-center justify-between"
                            >
                              <div>
                                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{a.nombre}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{a.curso}</p>
                              </div>
                              <span className="text-blue-600 font-medium text-xs">Seleccionar</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">No se encontraron alumnos.</div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                        {selectedAlumno.nombre.substring(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{selectedAlumno.nombre}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{selectedAlumno.curso} • {selectedAlumno.rut}</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setSelectedAlumno(null)}
                      className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                    >
                      Cambiar
                    </button>
                  </div>
                )}
              </div>

              {/* 2. TIPO DE ANOTACIÓN */}
              <div className="transition-all duration-300">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">2. Tipo de Anotación</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className={`flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${tipoAnotacion === 'positiva' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    <input type="radio" name="tipo" className="sr-only" checked={tipoAnotacion === 'positiva'} onChange={() => setTipoAnotacion('positiva')} />
                    <svg className={`w-8 h-8 mb-2 ${tipoAnotacion === 'positiva' ? 'text-emerald-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    <span className={`text-sm font-bold ${tipoAnotacion === 'positiva' ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400'}`}>Positiva</span>
                  </label>
                  
                  <label className={`flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${tipoAnotacion === 'negativa' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    <input type="radio" name="tipo" className="sr-only" checked={tipoAnotacion === 'negativa'} onChange={() => setTipoAnotacion('negativa')} />
                    <svg className={`w-8 h-8 mb-2 ${tipoAnotacion === 'negativa' ? 'text-red-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <span className={`text-sm font-bold ${tipoAnotacion === 'negativa' ? 'text-red-700 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>Negativa / Falta</span>
                  </label>

                  <label className={`flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${tipoAnotacion === 'observacion' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                    <input type="radio" name="tipo" className="sr-only" checked={tipoAnotacion === 'observacion'} onChange={() => setTipoAnotacion('observacion')} />
                    <svg className={`w-8 h-8 mb-2 ${tipoAnotacion === 'observacion' ? 'text-orange-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className={`text-sm font-bold ${tipoAnotacion === 'observacion' ? 'text-orange-700 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400'}`}>Observación</span>
                  </label>
                </div>
              </div>

              {/* 3. GRAVEDAD (Solo si es negativa) */}
              {tipoAnotacion === 'negativa' && (
                <div className="animate-fade-in-up">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Clasificación RICE (Reglamento Interno)</label>
                  <select 
                    value={gravedad}
                    onChange={(e) => setGravedad(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-800 text-sm focus:border-red-500 focus:outline-none text-gray-800 dark:text-white"
                  >
                    <option value="Leve">Leve (Ej: Atrasos, no traer materiales)</option>
                    <option value="Grave">Grave (Ej: Faltas de respeto, copiar en prueba)</option>
                    <option value="Gravísima">Gravísima (Ej: Agresión física, ciberacoso)</option>
                  </select>
                </div>
              )}

              {/* 4. DESCRIPCIÓN */}
              <div className="transition-all duration-300">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">3. Descripción de los Hechos</label>
                <textarea 
                  rows="4" 
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Redacte de forma objetiva lo sucedido en clases..."
                  className={`w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-transparent p-3 text-sm focus:outline-none text-gray-800 dark:text-white transition-all ${
                    tipoAnotacion === 'positiva' ? 'focus:border-emerald-500' : tipoAnotacion === 'negativa' ? 'focus:border-red-500' : 'focus:border-orange-500'
                  }`}
                ></textarea>
              </div>

              {/* BOTÓN SUBMIT */}
              <button 
                type="submit"
                disabled={!selectedAlumno || descripcion.trim() === '' || isSaving}
                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2 ${
                  !selectedAlumno || descripcion.trim() === '' || isSaving
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed shadow-none'
                  : tipoAnotacion === 'positiva' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' 
                  : tipoAnotacion === 'negativa' ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                  : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20'
                }`}
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>Registrar Anotación en el Sistema</span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* COLUMNA DERECHA: HISTORIAL RECIENTE */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm h-full">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4">Tus Anotaciones Recientes</h3>
            
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {historial.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-10">No has registrado anotaciones recientemente.</p>
              )}
              {historial.map(item => (
                <div key={item.id} className="border-b border-gray-100 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{item.perfiles?.nombre}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      item.tipo === 'positiva' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 
                      item.tipo === 'negativa' ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                      'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                    }`}>
                      {item.tipo} {item.gravedad && `- ${item.gravedad}`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{formatDate(item.fecha)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{item.descripcion}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}