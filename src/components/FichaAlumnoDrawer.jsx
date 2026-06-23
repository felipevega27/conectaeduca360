import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabaseClient';
import UserAvatar from './UserAvatar';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import toast from 'react-hot-toast';

export default function FichaAlumnoDrawer({ isOpen, onClose, rutAlumno }) {
  const navigate = useNavigate();

  // --- ESTADOS DE PESTAÑAS Y CARGA ---
  const [activeTab, setActiveTab] = useState('pedagogico');
  const [isLoading, setIsLoading] = useState(true);
  const [rolUsuario, setRolUsuario] = useState('director');

  // --- ESTADOS DE DATOS DEL ESTUDIANTE (TU LÓGICA + LA NUEVA) ---
  const [infoAlumno, setInfoAlumno] = useState(null);
  const [matricula, setMatricula] = useState(null);
  const [apoderadoInfo, setApoderadoInfo] = useState(null);
  const [metricas, setMetricas] = useState({ promedio: '--', asistencia: '--%' });
  const [casosConvivencia, setCasosConvivencia] = useState([]);
  const [registroPie, setRegistroPie] = useState(null);
  const [sesionesPie, setSesionesPie] = useState([]);

  // --- NUEVOS ESTADOS PARA CONVIVENCIA (INGRESO Y EXPORTACIÓN) ---
  const [nuevaAnotacion, setNuevaAnotacion] = useState({
    tipo_falta: 'Anotación Positiva',
    gravedad: 'Formativa',
    descripcion: ''
  });
  const [isSavingAnotacion, setIsSavingAnotacion] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!isOpen || !rutAlumno) return;

    const cargarExpedienteCompleto = async () => {
      try {
        setIsLoading(true);

        // 1. Identificar al usuario logueado para Seguridad
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: perfilUsuario } = await supabase.from('perfiles').select('rol').eq('email', user.email).single();
          if (perfilUsuario) setRolUsuario(perfilUsuario.role || perfilUsuario.rol);
        }

        // 2. Cargar Información Base
        const { data: alumnoData } = await supabase.from('perfiles').select('*').eq('rut', rutAlumno).single();
        setInfoAlumno(alumnoData);

        const { data: matData } = await supabase.from('matriculas').select('*, cursos(nombre)').eq('rut_alumno', rutAlumno).maybeSingle();
        setMatricula(matData);

        // 3. BUSCAR APODERADO (TU LÓGICA RESTAURADA)
        const { data: relacion } = await supabase.from('relacion_apoderados').select('*').eq('rut_alumno', rutAlumno).maybeSingle();
        if (relacion) {
          const { data: perfilApoderado } = await supabase.from('perfiles').select('nombre').eq('rut', relacion.rut_apoderado).maybeSingle();
          setApoderadoInfo({
            nombre: perfilApoderado?.nombre || 'Apoderado Sin Nombre',
            parentesco: relacion.parentesco,
            telefono: relacion.telefono || 'Sin registro'
          });
        } else {
          setApoderadoInfo(null);
        }

        // 4. CÁLCULO REAL DE NOTAS Y ASISTENCIA (TU LÓGICA RESTAURADA)
        const { data: notas } = await supabase.from('notas').select('nota').eq('rut_alumno', rutAlumno);
        let promCalculado = '--';
        if (notas && notas.length > 0) {
          const suma = notas.reduce((acc, curr) => acc + Number(curr.nota), 0);
          promCalculado = (suma / notas.length).toFixed(1);
        }

        const { data: asistencia } = await supabase.from('asistencia_alumnos').select('estado').eq('rut_alumno', rutAlumno);
        let asisCalculada = '--%';
        if (asistencia && asistencia.length > 0) {
          const ausencias = asistencia.filter(a => a.estado === 'Ausente').length;
          asisCalculada = `${Math.round(((asistencia.length - ausencias) / asistencia.length) * 100)}%`;
        }
        setMetricas({ promedio: promCalculado, asistencia: asisCalculada });

        // 5. Historial Completo de Convivencia (Para la Pestaña)
        const { data: convData } = await supabase.from('casos_convivencia').select('*').eq('rut_alumno', rutAlumno).order('fecha_reporte', { ascending: false });
        setCasosConvivencia(convData || []);

        // 6. Expediente Clínico PIE
        const { data: pieData } = await supabase.from('pie_estudiantes').select('*').eq('rut_alumno', rutAlumno).maybeSingle();
        setRegistroPie(pieData);

        if (pieData) {
          const { data: sesData } = await supabase.from('pie_sesiones').select('*').eq('rut_alumno', rutAlumno).order('fecha_sesion', { ascending: false });
          const { data: especialistasData } = await supabase.from('perfiles').select('rut, nombre');
          const sesionesProcesadas = (sesData || []).map(s => ({
            ...s,
            nombre_especialista: especialistasData?.find(e => e.rut === s.rut_especialista)?.nombre || 'Especialista'
          }));
          setSesionesPie(sesionesProcesadas);
        }

      } catch (error) {
        console.error("Error al estructurar la ficha:", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    cargarExpedienteCompleto();
  }, [isOpen, rutAlumno]);

  // --- REDIRECCIÓN AL PERFIL COMPLETO (TU LÓGICA RESTAURADA) ---
  const handleVerPerfilCompleto = () => {
    onClose();
    navigate(`/panel/director/alumnos/${rutAlumno}`);
  };

  // --- FUNCIONES NUEVAS: GUARDAR Y EXPORTAR ---
  const handleGuardarAnotacion = async (e) => {
    e.preventDefault();
    if (!nuevaAnotacion.descripcion.trim()) {
      toast.error('La descripción no puede estar vacía.');
      return;
    }
    setIsSavingAnotacion(true);
    try {
      const { data, error } = await supabase.from('casos_convivencia').insert([{
        rut_alumno: rutAlumno,
        tipo_falta: nuevaAnotacion.tipo_falta,
        gravedad: nuevaAnotacion.gravedad,
        descripcion: nuevaAnotacion.descripcion,
        estado_protocolo: nuevaAnotacion.gravedad === 'Formativa' ? 'Cerrado' : 'Activo' // Las formativas se cierran automáticamente
      }]).select();

      if (error) throw error;

      toast.success('Anotación guardada exitosamente.');
      setCasosConvivencia([data[0], ...casosConvivencia]);
      setNuevaAnotacion({ tipo_falta: 'Anotación Positiva', gravedad: 'Formativa', descripcion: '' });
    } catch (error) {
      console.error('Error al guardar anotación:', error);
      toast.error('Ocurrió un error al guardar la anotación.');
    } finally {
      setIsSavingAnotacion(false);
    }
  };

  const handleExportarPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const fechaHoy = new Date().toLocaleDateString('es-CL');
      
      doc.setFontSize(18);
      doc.text('Hoja de Vida y Convivencia', 14, 22);
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Alumno: ${infoAlumno?.nombre || 'N/A'}`, 14, 30);
      doc.text(`RUT: ${infoAlumno?.rut || 'N/A'}`, 14, 36);
      doc.text(`Curso: ${matricula?.cursos?.nombre || 'Sin Matricular'}`, 14, 42);
      doc.text(`Fecha Emisión: ${fechaHoy}`, 14, 48);

      const tableColumn = ["Fecha", "Tipo", "Gravedad", "Estado", "Descripción"];
      const tableRows = [];

      casosConvivencia.forEach(caso => {
        const casoData = [
          new Date(caso.fecha_reporte).toLocaleDateString('es-CL'),
          caso.tipo_falta,
          caso.gravedad,
          caso.estado_protocolo,
          caso.descripcion
        ];
        tableRows.push(casoData);
      });

      doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 55,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [15, 23, 42] }
      });

      doc.save(`Hoja_Vida_${infoAlumno?.rut}_${fechaHoy.replace(/\//g, '-')}.pdf`);
      toast.success('PDF exportado correctamente');
    } catch (error) {
      console.error("Error al generar PDF", error);
      toast.error('Error al generar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportarExcel = async () => {
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Hoja de Vida');
      
      worksheet.columns = [
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Tipo de Falta', key: 'tipo', width: 25 },
        { header: 'Gravedad', key: 'gravedad', width: 15 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Descripción', key: 'descripcion', width: 60 }
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

      casosConvivencia.forEach(caso => {
        worksheet.addRow({
          fecha: new Date(caso.fecha_reporte).toLocaleDateString('es-CL'),
          tipo: caso.tipo_falta,
          gravedad: caso.gravedad,
          estado: caso.estado_protocolo,
          descripcion: caso.descripcion
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fechaHoy = new Date().toLocaleDateString('es-CL').replace(/\//g, '-');
      saveAs(blob, `Hoja_Vida_${infoAlumno?.rut}_${fechaHoy}.xlsx`);
      toast.success('Excel exportado correctamente');
    } catch (error) {
      console.error("Error al generar Excel", error);
      toast.error('Error al generar Excel');
    } finally {
      setIsExporting(false);
    }
  };

  // --- PERMISOS ---
  const tieneAccesoConvivencia = ['director', 'inspector', 'docente', 'especialista'].includes(rolUsuario);
  const tieneAccesoPie = ['director', 'especialista'].includes(rolUsuario);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Fondo translúcido */}
      <div onClick={onClose} className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity animate-[fadeIn_0.2s_ease-out]" />

      {/* Drawer Lateral */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all duration-300 animate-[slideLeft_0.25s_ease-out] flex flex-col h-full text-left">

        {/* BOTÓN CERRAR */}
        <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Compilando historial unificado...</span>
          </div>
        ) : infoAlumno ? (
          <>
            {/* ENCABEZADO PERFIL */}
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 shrink-0">
              <div className="flex items-center gap-4">
                <UserAvatar 
                  nombre={infoAlumno.nombre} 
                  avatarUrl={infoAlumno.avatar_url}
                  className="w-16 h-16 rounded-2xl bg-blue-600 text-white text-2xl font-black shadow-lg shadow-blue-600/25 shrink-0"
                />
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{infoAlumno.nombre}</h2>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
                    {matricula?.cursos?.nombre || 'Sin Matricular'} • RUT: {infoAlumno.rut}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {matricula?.condicion_estudiante && (
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wide border border-blue-100 dark:border-blue-800">
                        {matricula.condicion_estudiante}
                      </span>
                    )}
                    {parseInt(metricas.asistencia) < 85 && metricas.asistencia !== '--%' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide text-red-700 bg-red-100 border border-red-200 dark:bg-red-900/30 dark:border-red-800/50 dark:text-red-400 uppercase animate-pulse">
                        Riesgo Deserción
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* PESTAÑAS */}
            <div className="px-6 pt-4 shrink-0">
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/60 p-1 rounded-lg">
                <button onClick={() => setActiveTab('pedagogico')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${activeTab === 'pedagogico' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'}`}>
                  Resumen Pedagógico
                </button>
                <button onClick={() => setActiveTab('convivencia')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-md transition-colors ${activeTab === 'convivencia' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'}`}>
                  Convivencia {!tieneAccesoConvivencia && '🔒'}
                </button>
                <button onClick={() => setActiveTab('pie')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-md transition-colors ${activeTab === 'pie' ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'}`}>
                  Expediente PIE {!tieneAccesoPie && '🔒'}
                </button>
              </div>
            </div>

            {/* CONTENIDO INTERACTIVO */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* --- PESTAÑA A: RESUMEN PEDAGÓGICO (TU LÓGICA RESTAURADA) --- */}
              {activeTab === 'pedagogico' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Asistencia Total</p>
                      <p className={`text-3xl font-black mt-1 ${parseInt(metricas.asistencia) < 85 ? 'text-red-500' : 'text-emerald-500'}`}>
                        {metricas.asistencia}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm text-center">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Promedio General</p>
                      <p className={`text-3xl font-black mt-1 ${Number(metricas.promedio) < 4.0 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}>
                        {metricas.promedio}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">Apoderado Titular</h3>
                    {apoderadoInfo ? (
                      <div className="flex items-center gap-4">
                        <UserAvatar 
                          nombre={apoderadoInfo.nombre} 
                          avatarUrl={apoderadoInfo.avatar_url} // asume que podría venir en apoderadoInfo si se añadiera
                          className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 font-bold"
                        />
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-white text-sm">{apoderadoInfo.nombre} <span className="font-normal text-gray-500">({apoderadoInfo.parentesco})</span></p>
                          <p className="text-blue-600 dark:text-blue-400 font-medium text-xs mt-0.5">{apoderadoInfo.telefono}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 italic">No hay apoderado registrado en el sistema.</p>
                    )}
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Antecedentes Generales</h3>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-gray-400 mb-0.5">Fecha Nacimiento</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{infoAlumno.fecha_nacimiento ? new Date(infoAlumno.fecha_nacimiento).toLocaleDateString('es-CL') : 'No registrada'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 mb-0.5">Dirección</p>
                        <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{infoAlumno.direccion || 'No informada'}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* --- PESTAÑA B: CONVIVENCIA ESCOLAR --- */}
              {activeTab === 'convivencia' && (
                !tieneAccesoConvivencia ? (
                  <RenderBloqueo mensaje="El historial de convivencia y actas RICE requiere credenciales de Docente, Inspectoría o Equipo Directivo." />
                ) : (
                  <div className="space-y-6">
                    {/* INGRESO RÁPIDO */}
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                      <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Ingreso Rápido de Anotación
                      </h3>
                      <form onSubmit={handleGuardarAnotacion} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <select 
                            value={nuevaAnotacion.tipo_falta} 
                            onChange={(e) => setNuevaAnotacion({...nuevaAnotacion, tipo_falta: e.target.value})}
                            className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="Anotación Positiva">Anotación Positiva</option>
                            <option value="Anotación Negativa">Anotación Negativa</option>
                            <option value="Observación General">Observación General</option>
                            <option value="Acoso Escolar / Bullying">Acoso Escolar / Bullying</option>
                            <option value="Falta de Respeto">Falta de Respeto</option>
                          </select>
                          <select 
                            value={nuevaAnotacion.gravedad} 
                            onChange={(e) => setNuevaAnotacion({...nuevaAnotacion, gravedad: e.target.value})}
                            className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="Formativa">Formativa (Cierre Automático)</option>
                            <option value="Leve">Falta Leve</option>
                            <option value="Media">Falta Media</option>
                            <option value="Alta">Falta Grave</option>
                          </select>
                        </div>
                        <textarea 
                          required
                          value={nuevaAnotacion.descripcion}
                          onChange={(e) => setNuevaAnotacion({...nuevaAnotacion, descripcion: e.target.value})}
                          rows="2"
                          placeholder="Describa el hecho, actitud o incidente..."
                          className="w-full text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <div className="flex justify-end">
                          <button 
                            type="submit" 
                            disabled={isSavingAnotacion}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-md transition-colors disabled:opacity-50"
                          >
                            {isSavingAnotacion ? 'Guardando...' : 'Guardar en Hoja de Vida'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* HISTORIAL Y EXPORTACIÓN */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Historial Reciente</h3>
                        <div className="flex gap-2">
                          <button 
                            onClick={handleExportarPDF} 
                            disabled={isExporting || casosConvivencia.length === 0}
                            className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            PDF
                          </button>
                          <button 
                            onClick={handleExportarExcel} 
                            disabled={isExporting || casosConvivencia.length === 0}
                            className="px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-100 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            Excel
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                        {casosConvivencia.length > 0 ? (
                          casosConvivencia.map(caso => (
                            <div key={caso.id} className={`p-4 rounded-xl border ${caso.gravedad === 'Formativa' ? 'border-blue-100 bg-blue-50/30' : caso.estado_protocolo === 'Cerrado' ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-80' : 'border-red-100 dark:border-red-900/30 bg-white dark:bg-gray-800 shadow-sm'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className={`font-bold text-sm ${caso.gravedad === 'Formativa' ? 'text-blue-700' : 'text-gray-800 dark:text-gray-200'}`}>{caso.tipo_falta}</h4>
                                  <p className="text-[10px] text-gray-400 mt-0.5">Fecha: {new Date(caso.fecha_reporte).toLocaleDateString('es-CL')}</p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${caso.gravedad === 'Formativa' ? 'bg-blue-100 text-blue-700' : caso.estado_protocolo === 'Cerrado' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                  {caso.gravedad === 'Formativa' ? 'Anotación' : caso.estado_protocolo}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 whitespace-pre-wrap mt-3 shadow-sm">{caso.descripcion}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/10 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Hoja de Vida en Blanco</p>
                            <p className="text-xs text-gray-400 mt-1">El estudiante no registra anotaciones en el sistema.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* --- PESTAÑA C: EXPEDIENTE CLÍNICO PIE --- */}
              {activeTab === 'pie' && (
                !tieneAccesoPie ? (
                  <RenderBloqueo mensaje="Ley N° 19.628. La información diagnóstica, test psicométricos y evolución médica solo son visibles para Especialistas PIE y Dirección." />
                ) : (
                  <div className="space-y-6">
                    {registroPie ? (
                      <>
                        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-800 p-5 rounded-xl border border-blue-100 dark:border-gray-700 shadow-sm">
                          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Ficha de Diagnóstico Ministerial</h3>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Clasificación Dto. 170</p>
                              <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold ${registroPie.tipo_necesidad === 'NEEP' ? 'bg-blue-200 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-purple-200 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'}`}>
                                {registroPie.tipo_necesidad}
                              </span>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Estado FUDEI</p>
                              <span className={`text-sm font-bold ${registroPie.estado_fudei === 'Al Día' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                {registroPie.estado_fudei}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-gray-500 dark:text-gray-400 text-xs mb-1">Diagnóstico Clínico</p>
                            <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm bg-white dark:bg-gray-900 p-3 rounded-lg">{registroPie.diagnostico}</p>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 pl-1">Libro de Registro (Atenciones)</h3>
                          <div className="space-y-3">
                            {sesionesPie.length > 0 ? (
                              sesionesPie.map(sesion => (
                                <div key={sesion.id} className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">{sesion.nombre_especialista}</span>
                                    <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                      {new Date(sesion.fecha_sesion).toLocaleDateString('es-CL')}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-wide">{sesion.lugar_atencion}</p>
                                  <p className="text-gray-600 dark:text-gray-300 text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded-lg whitespace-pre-wrap">{sesion.observacion}</p>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-center text-gray-500 py-4">No se registran atenciones clínicas cargadas en este período.</p>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-10 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-bold text-gray-600 dark:text-gray-300">No Pertenece a PIE</p>
                        <p className="text-xs text-gray-500 mt-1">Este estudiante no tiene expediente clínico abierto.</p>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {/* FOOTER CON BOTONES (TU LÓGICA RESTAURADA) */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 shrink-0">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cerrar Ficha
              </button>
              <button
                onClick={handleVerPerfilCompleto}
                disabled={!infoAlumno}
                className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                Acceder al Perfil Completo
              </button>
            </div>
          </>
        ) : (
          <p className="text-center text-red-500 py-10">Error: No se pudo localizar la ficha del estudiante.</p>
        )}
      </div>
    </div>
  );
}

// --- SUB-COMPONENTE: PANTALLA DE BLOQUEO ---
function RenderBloqueo({ mensaje }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-800/50">
      <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 flex items-center justify-center mb-3 text-xl shadow-xs">
        🔒
      </div>
      <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-1">Sección Protegida</h4>
      <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed">{mensaje}</p>
    </div>
  );
}