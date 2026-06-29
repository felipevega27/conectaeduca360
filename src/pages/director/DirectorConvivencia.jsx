import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';

// 1. REEMPLAZA LA IMPORTACIÓN ANTERIOR POR ESTAS DOS NUEVAS:
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import logoImg from '../../assets/logo.png'; // <-- LOGO PRINCIPAL
import toast, { Toaster } from 'react-hot-toast';
import { SkeletonRow } from '../../components/SkeletonLoader';
import { perteneceAlSemestre } from '../../utils/dateUtils';

export default function DirectorConvivencia() {
  const chartTiposRef = useRef(null);
  const navigate = useNavigate();

  // --- ESTADOS DE INTERACTIVIDAD ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isProtocoloModalOpen, setIsProtocoloModalOpen] = useState(false);
  const [isDetalleModalOpen, setIsDetalleModalOpen] = useState(false);
  const [casoSeleccionado, setCasoSeleccionado] = useState(null);
  const [isExportingRice, setIsExportingRice] = useState(false); // NUEVO: Estado para el botón exportar

  // --- ESTADOS DE BASE DE DATOS ---
  const [casos, setCasos] = useState([]);
  const [listaAlumnos, setListaAlumnos] = useState([]);
  const [chartData, setChartData] = useState({ labels: [], data: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [filtroActivo, setFiltroActivo] = useState('Activo');
  const [semestreActivo, setSemestreActivo] = useState('Primer Semestre');
  const [config, setConfig] = useState(null);

  // --- ESTADO DEL FORMULARIO NUEVO CASO ---
  const [nuevoCaso, setNuevoCaso] = useState({
    rut_alumno: '',
    tipo_falta: 'Acoso Escolar / Bullying',
    gravedad: 'Alta',
    descripcion: ''
  });

  // --- KPIS ---
  const [kpis, setKpis] = useState({ activos: 0, porVencer: 0, cerrados: 0 });

  // --- FUNCIÓN SUPABASE: CARGAR CASOS Y ALUMNOS ---
  const cargarCasos = async () => {
    try {
      setIsLoading(true);

      const { data: casosDataRaw, error: errCasos } = await supabase
        .from('casos_convivencia')
        .select('*')
        .order('fecha_reporte', { ascending: false });

      if (errCasos) throw errCasos;

      const casosData = casosDataRaw?.filter(c => perteneceAlSemestre(c.fecha_reporte, semestreActivo)) || [];

      const { data: perfilesData, error: errPerf } = await supabase
        .from('perfiles')
        .select('rut, nombre, rol')
        .eq('rol', 'alumno');

      if (errPerf) throw errPerf;
      setListaAlumnos(perfilesData);

      const { data: matriculasData } = await supabase.from('matriculas').select('rut_alumno, id_curso');
      const { data: cursosData } = await supabase.from('cursos').select('id, nombre');

      const casosArmados = (casosData || []).map(caso => {
        const perfil = perfilesData.find(p => p.rut === caso.rut_alumno);
        const matricula = matriculasData?.find(m => m.rut_alumno === caso.rut_alumno);
        const curso = matricula ? cursosData?.find(c => c.id === matricula.id_curso)?.nombre : 'Sin Matricular';

        const fechaReporte = new Date(caso.fecha_reporte);
        const fechaVencimiento = new Date(fechaReporte);
        fechaVencimiento.setDate(fechaVencimiento.getDate() + 15);
        const diasRestantes = Math.ceil((fechaVencimiento - new Date()) / (1000 * 60 * 60 * 24));

        return {
          id: caso.id,
          rut_alumno: caso.rut_alumno,
          alumno: perfil ? perfil.nombre : 'Desconocido',
          nivel: curso || 'Sin Matricular',
          tipo: caso.tipo_falta,
          gravedad: caso.gravedad,
          estado_protocolo: caso.estado_protocolo,
          descripcion: caso.descripcion,
          fecha: fechaReporte.toLocaleDateString('es-CL'),
          fechaVencimiento: fechaVencimiento.toLocaleDateString('es-CL'),
          diasRestantes: caso.estado_protocolo === 'Cerrado' ? 0 : diasRestantes
        };
      });

      setCasos(casosArmados);

      // --- CÁLCULO DE KPIs ---
      const activos = casosArmados.filter(c => c.estado_protocolo !== 'Cerrado');
      const cerrados = casosArmados.filter(c => c.estado_protocolo === 'Cerrado');
      const hoy = new Date();

      const porVencer = activos.filter(c => {
        const fVenc = new Date(c.fechaVencimiento.split('-').reverse().join('-'));
        const diffDias = Math.ceil((fVenc - hoy) / (1000 * 60 * 60 * 24));
        return diffDias <= 5;
      }).length;

      setKpis({ activos: activos.length, porVencer, cerrados: cerrados.length });

      // Gráfico de torta
      const conteoTipos = {};
      casosData.forEach(c => {
        conteoTipos[c.tipo_falta] = (conteoTipos[c.tipo_falta] || 0) + 1;
      });

      setChartData({
        labels: Object.keys(conteoTipos),
        data: Object.values(conteoTipos)
      });

      // Cargar configuración institucional
      const { data: configData } = await supabase.from('configuracion_colegio').select('*').limit(1).maybeSingle();
      if (configData) setConfig(configData);

    } catch (error) {
      console.error('Error cargando convivencia:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    cargarCasos();
  }, [semestreActivo]);

  // 2. REEMPLAZA POR COMPLETO TU FUNCIÓN handleExportarRICE POR ESTA CORPROATIVA:
  const handleExportarRICE = async () => {
    setIsExportingRice(true);
    try {
      // Crear el libro y la hoja de cálculo
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Bitácora RICE');

      // Configurar las propiedades base de las columnas y sus anchos automáticos
      worksheet.columns = [
        { key: 'id', width: 10 },
        { key: 'alumno', width: 30 },
        { key: 'rut', width: 15 },
        { key: 'curso', width: 15 },
        { key: 'tipo', width: 30 },
        { key: 'gravedad', width: 15 },
        { key: 'estado', width: 15 },
        { key: 'fecha', width: 18 },
        { key: 'vencimiento', width: 22 },
        { key: 'descripcion', width: 65 }
      ];

      // --- DISEÑO DE CABECERA Y LOGO ---
      // Aumentamos el tamaño de la fila 2 para dar más espacio al logo y al título
      worksheet.getRow(2).height = 60;
      worksheet.getRow(3).height = 25;

      // Fondo para toda la cabecera (Filas 2 a 4)
      for (let i = 2; i <= 4; i++) {
        worksheet.getRow(i).eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber <= 10) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0f172a' } }; // Fondo dark slate premium
            // Borde inferior para separar el banner del contenido
            if (i === 4) {
              cell.border = { bottom: { style: 'thick', color: { argb: 'FF0ea5e9' } } }; // Línea celeste de ConectaEduca360
            }
          }
        });
      }

      // Título principal
      worksheet.mergeCells('D2:J2');
      const titleCell = worksheet.getCell('D2');
      titleCell.value = 'REPORTE OFICIAL DE CONVIVENCIA ESCOLAR (RICE)';
      titleCell.font = { name: 'Segoe UI', size: 18, bold: true, color: { argb: 'FFFFFFFF' } }; // Texto blanco
      titleCell.alignment = { vertical: 'bottom', horizontal: 'right' };

      // Subtítulo con fecha
      worksheet.mergeCells('D3:J3');
      const subtitleCell = worksheet.getCell('D3');
      const fechaHoy = new Date().toLocaleDateString('es-CL');
      subtitleCell.value = `Bitácora de Protocolos Oficiales  |  Generado el: ${fechaHoy}`;
      subtitleCell.font = { name: 'Segoe UI', size: 12, italic: true, color: { argb: 'FFcbd5e1' } }; // Gris claro
      subtitleCell.alignment = { vertical: 'top', horizontal: 'right' };

      // --- LOGO DE LA INSTITUCIÓN ---
      try {
        const urlLogo = config?.logo_url || logoImg;
        const response = await fetch(urlLogo);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();

        // Agregar la imagen al workbook
        const logoId = workbook.addImage({ buffer: arrayBuffer, extension: 'png' });

        // Colocar la imagen exactamente sin estirarse (usando píxeles)
        // tl: { col: 0.5, row: 1.2 } => Columna A (mitad), Fila 2 (un poco abajo)
        worksheet.addImage(logoId, {
          tl: { col: 0.5, row: 1.1 },
          ext: { width: 70, height: 70 } // Proporción cuadrada para logo.png
        });

      } catch (imgError) {
        console.warn("No se pudo cargar el logo, verifique la ruta del logo.", imgError);
        // Fallback en caso de error
        worksheet.mergeCells('A2:C3');
        const logoPlaceholder = worksheet.getCell('A2');
        logoPlaceholder.value = config?.nombre_colegio || 'CONECTA EDUCA 360°';
        logoPlaceholder.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        logoPlaceholder.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }

      // --- FILA DE ENCABEZADOS DE LA TABLA (Fila 6) ---
      const headerRow = worksheet.getRow(6);
      headerRow.height = 28;
      headerRow.values = [
        'ID Caso', 'Alumno Involucrado', 'RUT Alumno', 'Curso',
        'Tipo de Falta', 'Gravedad', 'Estado Protocolo',
        'Fecha Reporte', 'Plazo de Vencimiento', 'Descripción Completa del Incidente'
      ];

      headerRow.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F2937' } }; // Gris oscuro premium
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'medium', color: { argb: 'FF1F2937' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
      });

      // --- CUERPO DE DATOS CON ZEBRA STRIPING Y ALERTAS INTELIGENTES ---
      casos.forEach((caso, index) => {
        const row = worksheet.addRow([
          caso.id,
          caso.alumno,
          caso.rut_alumno,
          caso.nivel,
          caso.tipo,
          caso.gravedad,
          caso.estado_protocolo,
          caso.fecha,
          caso.fechaVencimiento,
          caso.descripcion
        ]);

        row.height = 24; // Fila espaciosa y cómoda
        const esFilaPar = index % 2 === 0;

        row.eachCell((cell, colNumber) => {
          // Tipografía base limpia
          cell.font = { name: 'Segoe UI', size: 10 };

          // Alinear a la izquierda solo la descripción, el resto centrado
          cell.alignment = { vertical: 'middle', horizontal: colNumber === 10 ? 'left' : 'center', wrapText: colNumber === 10 };

          // Zebra striping: fondo intercalado sutil
          if (esFilaPar) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F9FAFB' } };
          }

          // Bordes suaves para la cuadrícula
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };

          // REGLA DE INTELIGENCIA: Formatear dinámicamente la columna "Gravedad" (Columna 6)
          if (colNumber === 6) {
            if (cell.value === 'Alta' || cell.value === 'Gravísima') {
              cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFEF4444' } }; // Texto Rojo
            } else if (cell.value === 'Media') {
              cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFF59E0B' } }; // Texto Naranja
            } else {
              cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF10B981' } }; // Texto Verde
            }
          }

          // Resaltar si el protocolo está cerrado o activo (Columna 7)
          if (colNumber === 7 && cell.value === 'Cerrado') {
            cell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF9CA3AF' } };
          }
        });
      });

      // --- GENERAR Y DESCARGAR ARCHIVO ---
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const fechaArchivo = new Date().toLocaleDateString('es-CL').replace(/\//g, '-');
      saveAs(blob, `Reporte_de_Convivencia_${fechaArchivo}.xlsx`);

    } catch (error) {
      console.error('Error al exportar Excel corporativo:', error);
      toast.error('Ocurrió un problema al dar formato al archivo Excel.');
    } finally {
      setIsExportingRice(false);
    }
  };

  const handleGuardarProtocolo = async (e) => {
    e.preventDefault();
    if (!nuevoCaso.rut_alumno) {
      toast.error("Por favor selecciona un alumno.");
      return;
    }

    try {
      const { error } = await supabase.from('casos_convivencia').insert([{
        rut_alumno: nuevoCaso.rut_alumno,
        tipo_falta: nuevoCaso.tipo_falta,
        gravedad: nuevoCaso.gravedad,
        descripcion: nuevoCaso.descripcion,
        estado_protocolo: 'Activo'
      }]);

      if (error) throw error;

      await new Promise(resolve => setTimeout(resolve, 800));

      toast.success('Protocolo activado en la base de datos y folio generado exitosamente.');
      setIsProtocoloModalOpen(false);
      setNuevoCaso({ rut_alumno: '', tipo_falta: 'Acoso Escolar / Bullying', gravedad: 'Alta', descripcion: '' });
      cargarCasos();

    } catch (error) {
      console.error('Error al guardar:', error.message);
      toast.error('Hubo un error al activar el protocolo.');
    }
  };

  const handleCerrarCaso = async (id) => {
    try {
      const { error } = await supabase
        .from('casos_convivencia')
        .update({ estado_protocolo: 'Cerrado' })
        .eq('id', id);

      if (error) throw error;

      toast.success('El caso ha sido archivado y resuelto bajo el protocolo RICE.');
      setIsDetalleModalOpen(false);
      cargarCasos();
    } catch (error) {
      toast.error('Error al cerrar el caso: ' + error.message);
    }
  };

  useEffect(() => {
    let chartTipos;

    const renderCharts = () => {
      if (chartTipos) chartTipos.destroy();
      if (chartTiposRef.current) {
        const existingChart = Chart.getChart(chartTiposRef.current);
        if (existingChart) existingChart.destroy();
      }

      if (!chartTiposRef.current || chartData.labels.length === 0) return;

      const isDark = document.documentElement.classList.contains('dark');
      Chart.defaults.color = isDark ? '#D1D5DB' : '#4B5563';

      const ctxTipos = chartTiposRef.current.getContext('2d');
      chartTipos = new Chart(ctxTipos, {
        type: 'doughnut',
        data: {
          labels: chartData.labels,
          datasets: [{
            data: chartData.data,
            backgroundColor: ['#6b64f3', '#f59e0b', '#3b82f6', '#ef4444', '#10b981', '#8b5cf6'],
            borderWidth: 0, hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } } }
        }
      });
    };

    renderCharts();
    window.addEventListener('themeChanged', renderCharts);

    return () => {
      if (chartTipos) chartTipos.destroy();
      window.removeEventListener('themeChanged', renderCharts);
    };
  }, [chartData, isLoading]);

  // FILTRO EN TIEMPO REAL
  const casosFiltrados = casos
    .filter(c => filtroActivo === 'Activo' ? c.estado_protocolo !== 'Cerrado' : c.estado_protocolo === 'Cerrado')
    .filter(caso =>
      caso.alumno.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caso.nivel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caso.tipo.toLowerCase().includes(searchTerm.toLowerCase())
    );

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando datos de convivencia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0">
      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />

      {/* CABECERA */}
      <div className="mb-3 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Convivencia Escolar</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Monitoreo RICE, plazos de la Superintendencia y bitácora de mediación.</p>
          </div>
          <select 
            className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={semestreActivo}
            onChange={(e) => setSemestreActivo(e.target.value)}
          >
            <option value="Primer Semestre">1º Semestre</option>
            <option value="Segundo Semestre">2º Semestre</option>
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">

          {/* BOTÓN EXPORTAR RICE ACTUALIZADO */}
          <button
            onClick={handleExportarRICE}
            disabled={isExportingRice || casos.length === 0}
            className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExportingRice ? (
              <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            )}
            {isExportingRice ? 'Generando Excel...' : 'Exportar RICE'}
          </button>

          <button
            onClick={() => setIsProtocoloModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-red-600/20 hover:bg-red-700 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Activar Protocolo
          </button>
        </div>
      </div>

      {/* KPIS CON LA NUEVA TARJETA DE CERRADOS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Casos Activos</p>
          <h3 className="mt-1 text-2xl font-bold text-gray-800 dark:text-white">{kpis.activos}</h3>
        </div>

        <div className={`rounded-xl border p-5 shadow-sm ${kpis.porVencer > 0 ? 'border-red-200 bg-red-50/50 dark:border-red-800/50 dark:bg-red-900/10' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'}`}>
          <p className={`text-xs font-medium uppercase ${kpis.porVencer > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>Riesgo Supereduc (Plazo Crítico)</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className={`text-2xl font-bold ${kpis.porVencer > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-800 dark:text-white'}`}>{kpis.porVencer}</h3>
            {kpis.porVencer > 0 && <span className="text-xs font-medium text-red-500">Vencen en &lt; 5 días</span>}
          </div>
        </div>

        {/* TARJETA: CASOS RESUELTOS */}
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-900/10 p-5 shadow-sm">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase">Casos Resueltos (Histórico)</p>
          <div className="flex items-baseline gap-2 mt-1">
            <h3 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{kpis.cerrados}</h3>
            <span className="text-xs font-medium text-emerald-600/80 dark:text-emerald-400/80">Archivados correctamente</span>
          </div>
        </div>
      </div>

      {/* SECCIÓN MEDIA */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">

        {/* SEMÁFORO DE CASOS */}
        <div className="xl:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden flex flex-col">
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

            <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
              <button
                onClick={() => setFiltroActivo('Activo')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${filtroActivo === 'Activo' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                Casos en Curso
              </button>
              <button
                onClick={() => setFiltroActivo('Cerrado')}
                className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${filtroActivo === 'Cerrado' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}
              >
                Historial Cerrados
              </button>
            </div>

            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Buscar alumno o falta..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full sm:w-64 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent pl-9 pr-3 text-sm text-gray-600 dark:text-gray-300 focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-6 flex-1 bg-gray-50/50 dark:bg-gray-800/50 overflow-y-auto max-h-125">
            {isLoading ? (
              <div className="space-y-3">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </div>
            ) : (
              <div className="space-y-3">
                {casosFiltrados.length > 0 ? (
                  casosFiltrados.map((caso) => (
                    <div
                      key={caso.id}
                      onClick={() => { setCasoSeleccionado(caso); setIsDetalleModalOpen(true); }}
                      className={`bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4 shadow-sm hover:shadow dark:hover:bg-gray-700 transition-colors cursor-pointer ${caso.estado_protocolo === 'Cerrado' ? 'border-gray-200 dark:border-gray-700 opacity-80' : 'border-gray-200 dark:border-gray-700'}`}
                    >
                      <div className="shrink-0 flex items-center justify-center">
                        <div className={`w-4 h-4 rounded-full shadow-inner ${caso.estado_protocolo === 'Cerrado' ? 'bg-emerald-500 shadow-emerald-500/50' :
                          caso.gravedad === 'Alta' || caso.gravedad === 'Gravísima' ? 'bg-red-500 shadow-red-500/50 animate-pulse' :
                            caso.gravedad === 'Media' ? 'bg-amber-500 shadow-amber-500/50' :
                              'bg-emerald-500 shadow-emerald-500/50'
                          }`}></div>
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                          <h4 className="font-semibold text-gray-800 dark:text-gray-100">{caso.alumno} <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">({caso.nivel})</span></h4>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${caso.estado_protocolo === 'Cerrado' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50' :
                            caso.gravedad === 'Alta' || caso.gravedad === 'Gravísima' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'
                            }`}>{caso.estado_protocolo === 'Cerrado' ? 'CASO CERRADO' : caso.tipo}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{caso.descripcion}</p>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-[10px]">
                          <span className="text-gray-400">Reportado: {caso.fecha}</span>
                          <span className={`font-bold ${caso.estado_protocolo === 'Cerrado' ? 'text-emerald-500' : caso.diasRestantes <= 5 ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}>
                            {caso.estado_protocolo === 'Cerrado' ? 'Resuelto correctamente' : caso.diasRestantes <= 0 ? 'Plazo legal vencido' : `Plazo Supereduc: Vence en ${caso.diasRestantes} días`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-white">{filtroActivo === 'Activo' ? 'Ambiente Seguro' : 'Sin Histórico'}</h4>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto mt-0.5">
                      {filtroActivo === 'Activo' ? 'No hay reportes ni denuncias críticas activas en este momento.' : 'Aún no se han cerrado casos de convivencia.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* GRÁFICO */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6 flex flex-col">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white mb-6">Distribución de Faltas RICE</h2>
          <div className="relative flex-1 min-h-62.5 w-full flex items-center justify-center">
            {!isLoading && chartData.labels.length > 0 ? (
              <canvas ref={chartTiposRef}></canvas>
            ) : (
              <div className="text-sm text-gray-400">Esperando datos de aula...</div>
            )}
          </div>
        </div>
      </div>

      {/* --- MODALES --- */}

      {/* MODAL ACTIVAR PROTOCOLO */}
      {isProtocoloModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out]">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="bg-red-100 text-red-600 p-2 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Abrir Protocolo Oficial (RICE)</h2>
              </div>
            </div>

            <form id="protocolo-form" onSubmit={handleGuardarProtocolo} className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alumno Involucrado</label>
                <select required value={nuevoCaso.rut_alumno} onChange={(e) => setNuevoCaso({ ...nuevoCaso, rut_alumno: e.target.value })} className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20">
                  <option value="">Seleccione un alumno...</option>
                  {listaAlumnos.map(alumno => (<option key={alumno.rut} value={alumno.rut}>{alumno.nombre} ({alumno.rut})</option>))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de Falta</label>
                  <select required value={nuevoCaso.tipo_falta} onChange={(e) => setNuevoCaso({ ...nuevoCaso, tipo_falta: e.target.value })} className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20">
                    <option>Bullying / Acoso Escolar</option>
                    <option>Agresión Física</option>
                    <option>Ciberacoso / Redes Sociales</option>
                    <option>Falta de Respeto a Docente</option>
                    <option>Vulneración de Derechos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gravedad Regulatoria</label>
                  <select required value={nuevoCaso.gravedad} onChange={(e) => setNuevoCaso({ ...nuevoCaso, gravedad: e.target.value })} className="w-full h-11 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20">
                    <option value="Leve">Falta Leve (Verde)</option>
                    <option value="Media">Falta Menor / Media (Amarillo)</option>
                    <option value="Alta">Falta Grave (Rojo)</option>
                    <option value="Gravísima">Falta Gravísima (Rojo Pulsante)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción de los Hechos</label>
                <textarea required rows="3" value={nuevoCaso.descripcion} onChange={(e) => setNuevoCaso({ ...nuevoCaso, descripcion: e.target.value })} placeholder="Escriba la bitácora inicial del incidente..." className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20"></textarea>
              </div>
            </form>

            <div className="flex gap-3">
              <button type="button" onClick={() => setIsProtocoloModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
              <button form="protocolo-form" type="submit" className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20">Activar y Generar Folio</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE CASO */}
      {isDetalleModalOpen && casoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out]">

            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${casoSeleccionado.estado_protocolo === 'Cerrado' ? 'bg-emerald-500' : casoSeleccionado.gravedad === 'Alta' || casoSeleccionado.gravedad === 'Gravísima' ? 'bg-red-500 animate-pulse' : casoSeleccionado.gravedad === 'Media' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Expediente de Convivencia</h2>
              </div>
              <button onClick={() => setIsDetalleModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-5 mb-8">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Estudiante Involucrado</p>
                <p className="text-base font-semibold text-gray-800 dark:text-gray-200">{casoSeleccionado.alumno} <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">({casoSeleccionado.nivel})</span></p>
                <p className="text-xs text-gray-400">RUT Alumno: {casoSeleccionado.rut_alumno}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Falta / Gravedad</p>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{casoSeleccionado.tipo}</p>
                  <span className={`text-[10px] font-bold uppercase mt-0.5 block ${casoSeleccionado.estado_protocolo === 'Cerrado' ? 'text-emerald-500' : 'text-red-500'}`}>Categoría: {casoSeleccionado.gravedad}</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Fecha Reporte</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{casoSeleccionado.fecha}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Relación del Incidente</p>
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {casoSeleccionado.descripcion}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              {casoSeleccionado.estado_protocolo !== 'Cerrado' && (
                <button
                  onClick={() => handleCerrarCaso(casoSeleccionado.id)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-600/10"
                >
                  Cerrar Caso y Archivar
                </button>
              )}
              <button onClick={() => setIsDetalleModalOpen(false)} className={`${casoSeleccionado.estado_protocolo === 'Cerrado' ? 'w-full' : 'px-5'} py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}>
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}