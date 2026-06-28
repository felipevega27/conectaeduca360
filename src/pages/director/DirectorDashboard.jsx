import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { useNavigate } from 'react-router-dom';
import FichaAlumnoDrawer from '../../components/FichaAlumnoDrawer';
import { supabase } from '../../config/supabaseClient';
import logo from '../../assets/logo.png';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { initSchoolPdf, addPdfFooter } from '../../utils/pdfUtils';
import toast, { Toaster } from 'react-hot-toast';
import useDirectorDashboard from '../../hooks/useDirectorDashboard';
import { SkeletonRow } from '../../components/SkeletonLoader';
import BackdropLoader from '../../components/BackdropLoader';

export default function DirectorDashboard() {
  const navigate = useNavigate();

  // --- ESTADOS DE INTERACTIVIDAD ---
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('csv');
  const [isFichaDrawerOpen, setIsFichaDrawerOpen] = useState(false);
  const [rutFichaSeleccionada, setRutFichaSeleccionada] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // --- ESTADOS BASE DE DATOS (Supabase) via HOOK ---
  const {
    totalAlumnos,
    porcentajes,
    asistenciaGlobal,
    alumnosRiesgo,
    metricasUTP,
    metricasPIE,
    protocolosActivos,
    alertas,
    isLoading,
    isUsingFallback
  } = useDirectorDashboard();

  // --- REFERENCIAS DE GRÁFICOS ---
  const chartAreaRef = useRef(null);
  const chartBarRef = useRef(null);
  const chartDoughnutRef = useRef(null);
  const chartLineRef = useRef(null);
  const revenueChartRef = useRef(null);
  const trafficChartRef = useRef(null);

  // FILTRO DINÁMICO DE ALERTAS
  const alertasFiltradas = alertas.filter(alerta => {
    const matchSearch = alerta.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        alerta.curso.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPriority = priorityFilter === 'Todas' || alerta.prioridad === priorityFilter;
    return matchSearch && matchPriority;
  });

  // --- EFECTO DE GRÁFICOS ---
  useEffect(() => {
    const destroyChartSafely = (ref) => {
      if (ref.current) {
        const existingChart = Chart.getChart(ref.current);
        if (existingChart) existingChart.destroy();
      }
    };

    const renderCharts = () => {
      destroyChartSafely(chartAreaRef); destroyChartSafely(chartBarRef); destroyChartSafely(chartDoughnutRef);
      destroyChartSafely(chartLineRef); destroyChartSafely(revenueChartRef); destroyChartSafely(trafficChartRef);

      if (!chartAreaRef.current || !chartBarRef.current || !chartDoughnutRef.current ||
        !chartLineRef.current || !revenueChartRef.current || !trafficChartRef.current) return;

      const isDark = document.documentElement.classList.contains('dark');
      Chart.defaults.color = isDark ? '#D1D5DB' : '#4B5563';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#f1f5f9';

      new Chart(chartAreaRef.current, { type: 'line', data: { labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'], datasets: [{ data: [88, 92, 90, 85, 94], borderColor: '#010694', borderWidth: 2, fill: true, backgroundColor: 'rgba(1, 6, 148, 0.1)', tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, min: 80 } } } });
      new Chart(chartBarRef.current, { type: 'bar', data: { labels: ['1°M', '2°M', '3°M', '4°M'], datasets: [{ data: [2, 5, alumnosRiesgo, 0], backgroundColor: '#ef4444', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } } });

      // GRÁFICO DONA PIE ACTUALIZADO CON DATOS REALES
      new Chart(chartDoughnutRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Atendidos', 'Pendientes'],
          datasets: [{
            data: [metricasPIE.porcentaje, 100 - metricasPIE.porcentaje],
            backgroundColor: ['#6d70fc', 'rgba(0,0,0,0.05)'],
            borderWidth: 0
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '80%', plugins: { legend: { display: false }, tooltip: { enabled: false } } }
      });

      // GRÁFICO LÍNEA CONVIVENCIA
      const lineaConvivencia = protocolosActivos > 0 ? [1, 2, 1, protocolosActivos + 1, protocolosActivos] : [0, 0, 0, 0, 0];
      new Chart(chartLineRef.current, { type: 'line', data: { labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Actual'], datasets: [{ data: lineaConvivencia, borderColor: '#f59e0b', borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } } });

      const ctxRev = revenueChartRef.current.getContext('2d');
      let gradient = ctxRev.createLinearGradient(0, 0, 0, 400); gradient.addColorStop(0, 'rgba(1, 6, 148, 0.2)'); gradient.addColorStop(1, 'rgba(1, 6, 148, 0)');
      new Chart(ctxRev, { type: 'line', data: { labels: ['Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct'], datasets: [{ label: 'Asistencia General %', data: [85, 88, 92, 90, 94, 91, 95, asistenciaGlobal || 93], borderColor: '#010694', backgroundColor: gradient, tension: 0.4, fill: true, pointBackgroundColor: '#ffffff', pointBorderColor: '#010694', pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 70, grid: { color: gridColor, borderDash: [5, 5] }, border: { display: false } }, x: { grid: { display: false }, border: { display: false } } } } });
      new Chart(trafficChartRef.current, { type: 'pie', data: { labels: ['Regular', 'Prioritario (SEP)', 'PIE'], datasets: [{ data: [porcentajes.regular, porcentajes.sep, porcentajes.pie], backgroundColor: ['#010694', '#6d70fc', '#22c55e'], borderWidth: 2, borderColor: isDark ? '#1f2937' : '#ffffff', hoverOffset: 8 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: isDark ? '#374151' : '#ffffff', titleColor: isDark ? '#f3f4f6' : '#1f2937', bodyColor: isDark ? '#d1d5db' : '#4b5563', borderColor: isDark ? '#4b5563' : '#e5e7eb', borderWidth: 1, padding: 12, usePointStyle: true, callbacks: { label: (context) => ` ${context.label}: ${context.parsed}%` } } } } });
    };

    renderCharts();
    window.addEventListener('themeChanged', renderCharts);

    return () => {
      destroyChartSafely(chartAreaRef); destroyChartSafely(chartBarRef); destroyChartSafely(chartDoughnutRef);
      destroyChartSafely(chartLineRef); destroyChartSafely(revenueChartRef); destroyChartSafely(trafficChartRef);
      window.removeEventListener('themeChanged', renderCharts);
    };
  }, [porcentajes, asistenciaGlobal, alumnosRiesgo, metricasPIE, protocolosActivos]); 

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data: perfiles } = await supabase.from('perfiles').select('rut, nombre').eq('rol', 'alumno');
      const { data: matriculas } = await supabase.from('matriculas').select('rut_alumno, condicion_estudiante, id_curso');
      const { data: cursos } = await supabase.from('cursos').select('id, nombre');
      const { data: asistencia } = await supabase.from('asistencia_alumnos').select('rut_alumno, estado');
      const { data: configData } = await supabase.from('configuracion_colegio').select('*').limit(1).maybeSingle();
      const config = configData || {};

      if (!perfiles || !matriculas || !cursos || !asistencia) throw new Error("Faltan datos para exportar");

      const rbd = config.rbd || "12345-6";

      if (exportFormat === 'csv') {
        const rows = [
          ["RBD", "RUT_ALUMNO", "NOMBRE_COMPLETO", "CURSO", "CONDICION", "ASISTENCIA_PCT", "ESTADO_MATRICULA"]
        ];

        perfiles.forEach(perfil => {
          const mat = matriculas.find(m => m.rut_alumno === perfil.rut);
          const cursoNombre = mat ? (cursos.find(c => c.id === mat.id_curso)?.nombre || 'SIN CURSO') : 'SIN MATRICULA';
          const condicion = mat?.condicion_estudiante || 'REGULAR';
          
          const asisEstudiante = asistencia.filter(a => a.rut_alumno === perfil.rut);
          let asistenciaPct = "0";
          if (asisEstudiante.length > 0) {
            const presentes = asisEstudiante.filter(a => a.estado === 'Presente' || a.estado === 'Atraso').length;
            asistenciaPct = Math.round((presentes / asisEstudiante.length) * 100).toString();
          }

          const estadoMatricula = mat ? 'ACTIVO' : 'INACTIVO';

          rows.push([
            rbd,
            perfil.rut,
            `"${perfil.nombre}"`, 
            `"${cursoNombre}"`,
            condicion.toUpperCase(),
            asistenciaPct,
            estadoMatricula
          ]);
        });

        const csvContent = rows.map(r => r.join(";")).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `reporte_sige_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Reporte CSV descargado correctamente.');
      } else if (exportFormat === 'pdf') {
        const doc = await initSchoolPdf(
          config.nombre_colegio || "COLEGIO CONECTAEDUC",
          "Reporte Oficial de Asistencia - Consolidado Mensual SIGE",
          config
        );
        
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`RBD:`, 14, 42);
        doc.setFont("helvetica", "normal");
        doc.text(`${rbd}`, 25, 42);

        doc.setFont("helvetica", "bold");
        doc.text(`Fecha Emisión:`, 14, 48);
        doc.setFont("helvetica", "normal");
        doc.text(`${new Date().toLocaleDateString('es-CL')}`, 42, 48);

        let pieImgData = null;
        if (trafficChartRef.current) {
          try {
            pieImgData = trafficChartRef.current.toDataURL('image/png', 1.0);
          } catch(e) { console.error("Error capturing pie chart:", e); }
        }

        let tPresente = 0, tAtraso = 0, tAusente = 0, tJustificado = 0;
        
        asistencia.forEach(a => {
          if (a.estado === 'Presente') tPresente++;
          else if (a.estado === 'Atraso') tAtraso++;
          else if (a.estado === 'Ausente') tAusente++;
          else if (a.estado === 'Justificado') tJustificado++;
        });
        
        const totalAsis = tPresente + tAtraso + tAusente + tJustificado;
        
        let startYTable = 59;

        const chartY = 56;
        doc.setDrawColor(226, 232, 240); 
        doc.setFillColor(248, 250, 252); 
        doc.roundedRect(14, chartY, 110, 32, 2, 2, 'FD');

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59); 
        doc.text("Distribución General de Asistencia", 20, chartY + 7);
        
        const barWidth = 98;
        const barHeight = 6;
        const startX = 20;
        const barY = chartY + 12;

        if (totalAsis > 0) {
          const pPres = tPresente / totalAsis;
          const pAtr = tAtraso / totalAsis;
          const pJus = tJustificado / totalAsis;
          const pAus = tAusente / totalAsis;

          let currentX = startX;

          doc.setFillColor(34, 197, 94);
          if (pPres > 0) doc.rect(currentX, barY, barWidth * pPres, barHeight, 'F');
          currentX += barWidth * pPres;

          doc.setFillColor(234, 179, 8);
          if (pAtr > 0) doc.rect(currentX, barY, barWidth * pAtr, barHeight, 'F');
          currentX += barWidth * pAtr;

          doc.setFillColor(59, 130, 246);
          if (pJus > 0) doc.rect(currentX, barY, barWidth * pJus, barHeight, 'F');
          currentX += barWidth * pJus;

          doc.setFillColor(239, 68, 68);
          if (pAus > 0) doc.rect(currentX, barY, barWidth * pAus, barHeight, 'F');

          const legendY = barY + 9;
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          
          doc.setFillColor(34, 197, 94);
          doc.rect(20, legendY - 2.5, 3, 3, 'F');
          doc.setTextColor(34, 197, 94);
          doc.text(`Pres: ${Math.round(pPres*100)}%`, 24, legendY);

          doc.setFillColor(234, 179, 8);
          doc.rect(46, legendY - 2.5, 3, 3, 'F');
          doc.setTextColor(234, 179, 8);
          doc.text(`Atras: ${Math.round(pAtr*100)}%`, 50, legendY);

          doc.setFillColor(59, 130, 246);
          doc.rect(74, legendY - 2.5, 3, 3, 'F');
          doc.setTextColor(59, 130, 246);
          doc.text(`Justif: ${Math.round(pJus*100)}%`, 78, legendY);

          doc.setFillColor(239, 68, 68);
          doc.rect(102, legendY - 2.5, 3, 3, 'F');
          doc.setTextColor(239, 68, 68);
          doc.text(`Ausen: ${Math.round(pAus*100)}%`, 106, legendY);
        } else {
          doc.setFillColor(226, 232, 240); 
          doc.rect(startX, barY, barWidth, barHeight, 'F');
          doc.setFontSize(9);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(148, 163, 184); 
          doc.text("Sin datos de asistencia registrados.", startX + 15, barY + 5);
        }

        doc.setDrawColor(226, 232, 240);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(127, chartY, 69, 32, 2, 2, 'FD');
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Composición Matrícula", 131, chartY + 7);

        if (pieImgData && trafficChartRef.current) {
          let imgW = 24;
          let imgH = 24;
          const ratio = trafficChartRef.current.width / trafficChartRef.current.height;
          
          if (ratio > 1) { 
             imgH = 24 / ratio;
          } else { 
             imgW = 24 * ratio;
          }

          const imgX = 130 + (24 - imgW) / 2; 
          const imgY = chartY + 9 + (24 - imgH) / 2; 

          doc.addImage(pieImgData, 'PNG', imgX, imgY, imgW, imgH);
          
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          
          const legendX = 156;
          
          doc.setFillColor(1, 6, 148);
          doc.rect(legendX, chartY + 11, 3, 3, 'F');
          doc.setTextColor(1, 6, 148);
          doc.text(`Regular: ${porcentajes.regular}%`, legendX + 4, chartY + 13.5);

          doc.setFillColor(109, 112, 252);
          doc.rect(legendX, chartY + 17, 3, 3, 'F');
          doc.setTextColor(109, 112, 252);
          doc.text(`SEP: ${porcentajes.sep}%`, legendX + 4, chartY + 19.5);

          doc.setFillColor(34, 197, 94);
          doc.rect(legendX, chartY + 23, 3, 3, 'F');
          doc.setTextColor(34, 197, 94);
          doc.text(`PIE: ${porcentajes.pie}%`, legendX + 4, chartY + 25.5);
        } else {
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(148, 163, 184);
          doc.text("Gráfico no disponible.", 134, chartY + 20);
        }

        startYTable = chartY + 44;

        const tableColumn = ["RBD", "RUT ALUMNO", "NOMBRE COMPLETO", "CURSO", "CONDICIÓN", "% ASIS.", "ESTADO"];
        const tableRows = [];

        perfiles.forEach(perfil => {
          const mat = matriculas.find(m => m.rut_alumno === perfil.rut);
          const cursoNombre = mat ? (cursos.find(c => c.id === mat.id_curso)?.nombre || 'SIN CURSO') : 'SIN MATRICULA';
          const condicion = mat?.condicion_estudiante || 'REGULAR';
          
          const asisEstudiante = asistencia.filter(a => a.rut_alumno === perfil.rut);
          let asistenciaPct = "0%";
          if (asisEstudiante.length > 0) {
            const presentes = asisEstudiante.filter(a => a.estado === 'Presente' || a.estado === 'Atraso').length;
            asistenciaPct = Math.round((presentes / asisEstudiante.length) * 100) + "%";
          }
          const estadoMatricula = mat ? 'ACTIVO' : 'INACTIVO';

          tableRows.push([
            rbd,
            perfil.rut,
            perfil.nombre,
            cursoNombre,
            condicion.toUpperCase(),
            asistenciaPct,
            estadoMatricula
          ]);
        });

        autoTable(doc, {
          head: [tableColumn],
          body: tableRows,
          startY: startYTable,
          theme: 'grid',
          styles: { 
            fontSize: 8,
            cellPadding: 3,
            textColor: [50, 50, 50],
            font: "helvetica"
          },
          headStyles: { 
            fillColor: [1, 6, 148], 
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center'
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252] 
          },
          columnStyles: {
            0: { halign: 'center', fontStyle: 'bold' },
            1: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center', fontStyle: 'bold', textColor: [1, 6, 148] },
            6: { halign: 'center' }
          }
        });

        addPdfFooter(doc, 'Reporte oficial de asistencia generado por el Sistema ConectaEduc - Cumplimiento SIGE');

        doc.save(`reporte_sige_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('Reporte PDF descargado correctamente.');
      }

      setIsExportModalOpen(false);
    } catch (error) {
      console.error("Error al generar archivo:", error);
      toast.error("Hubo un error al generar el archivo.");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium tracking-wide">Cargando panel de control...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-0 relative">
      <Toaster position="top-right" toastOptions={{ className: 'dark:!bg-gray-800 dark:!text-white dark:border dark:!border-gray-700' }} />
      {isExporting && <BackdropLoader mensaje="Exportando informe SIGE..." />}

      <div className="mb-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Panel de Control Directivo</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            Vista general de indicadores académicos y administrativos.
            {isUsingFallback && (
              <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded dark:bg-yellow-900 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800" title="La base de datos no tiene la función RPC aún. Usando modo compatibilidad.">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                Modo Compatibilidad
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 shadow-sm">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Hoy: {new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </div>
          <button onClick={() => setIsExportModalOpen(true)} className="flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            SIGE Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {/* TARJETA 1: ASISTENCIA */}
        <div onClick={() => navigate('/panel/director/alertas-asistencia')} className="group cursor-pointer relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] dark:shadow-none transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between h-40">
          <div className="flex items-start justify-between z-10">
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ASISTENCIA & SUBVENCIÓN</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-gray-800 dark:text-white">
                {isLoading ? '...' : `${asistenciaGlobal}%`}
              </h3>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg p-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          </div>
          <div className="absolute bottom-2 left-4 right-4 h-12 opacity-80 z-20">
            <span className="flex items-center text-xs font-bold text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>
              Impacto SEP: -$1.2M proyectado
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-16 w-full opacity-30">
            <canvas ref={chartAreaRef}></canvas>
          </div>
        </div>

        {/* TARJETA 2: RIESGO */}
        <div onClick={() => navigate('/panel/director/sat')} className="group cursor-pointer relative overflow-hidden rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-900/10 p-5 shadow-[0_2px_10px_-3px_rgba(239,68,68,0.1)] dark:shadow-none transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between h-40">
          <div className="flex items-start justify-between z-10">
            <div>
              <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase">S.A.T. (RIESGO DESERCIÓN)</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-gray-800 dark:text-white">
                {isLoading ? '...' : alumnosRiesgo}
              </h3>
            </div>
            <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg p-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
          </div>
          <div className="absolute bottom-2 left-4 right-4 h-12 opacity-80">
            <canvas ref={chartBarRef}></canvas>
          </div>
        </div>

        {/* TARJETA 3: PIE (NUEVA LÓGICA DE DATOS REALES) */}
        <div onClick={() => navigate('/panel/director/programa-pie')} className="group cursor-pointer relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] dark:shadow-none transition-all hover:-translate-y-1 hover:shadow-lg flex items-center justify-between h-40">
          <div className="z-10">
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">COBERTURA PIE (NEE)</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-gray-800 dark:text-white">
              {isLoading ? '...' : `${metricasPIE.porcentaje}%`}
            </h3>
            <span className={`text-[10px] font-medium mt-2 block border px-2 py-1 rounded ${metricasPIE.pendientes > 0 ? 'text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20' : 'text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20'}`}>
              {metricasPIE.pendientes > 0 ? `${metricasPIE.pendientes} hrs especialistas pendientes` : 'Cobertura completa'}
            </span>
          </div>
          <div className="h-20 w-20 relative">
            <canvas ref={chartDoughnutRef}></canvas>
          </div>
        </div>

        {/* TARJETA 4: PROTOCOLOS SUPEREDUC (NUEVA LÓGICA DE DATOS REALES) */}
        <div onClick={() => navigate('/panel/director/convivencia')} className="group cursor-pointer relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] dark:shadow-none transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between h-40">
          <div className="flex items-start justify-between z-10">
            <div>
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">PROTOCOLOS SUPEREDUC</p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-gray-800 dark:text-white">
                {isLoading ? '...' : protocolosActivos}
              </h3>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg p-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.315 48.315 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" /></svg>
            </div>
          </div>
          <div className="absolute bottom-2 left-4 right-4 h-12 opacity-80">
            <canvas ref={chartLineRef}></canvas>
          </div>
        </div>
      </div>

      {/* --- GRÁFICOS PRINCIPALES --- */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">Evolución de Asistencia vs Meta Subvención</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Línea base requerida Mineduc: 85%</p>
            </div>
            <select className="rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent dark:bg-gray-800 px-2 py-1 text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option>Semestre Actual</option>
              <option>Semestre Anterior</option>
            </select>
          </div>
          <div className="relative h-64 w-full">
            <canvas ref={revenueChartRef}></canvas>
          </div>
        </div>

        {/* TARJETA COMPOSICIÓN MATRÍCULA */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4 md:p-6 flex flex-col">
          <div className="flex justify-between items-start w-full mb-4">
            <div className="flex-col items-center">
              <div className="flex items-center mb-1 relative group">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mr-1">Composición Matrícula</h3>
                <svg className="w-4 h-4 text-gray-400 hover:text-gray-800 dark:hover:text-white cursor-pointer ml-1 transition-colors" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.529 9.988a2.502 2.502 0 1 1 5 .191A2.441 2.441 0 0 1 12 12.582V14m-.01 3.008H12M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                <div className="absolute z-20 p-4 w-72 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-300 top-full mt-2 left-0 pointer-events-none">
                  <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Distribución de Alumnos</h4>
                  <p className="mb-3">Visualiza la cantidad acumulada de estudiantes matriculados según su tipo de financiamiento.</p>
                </div>
              </div>
            </div>
            <button type="button" className="inline-flex items-center text-blue-600 dark:text-blue-400 font-medium hover:underline text-sm">
              Año Actual <svg className="w-4 h-4 ml-1.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 9-7 7-7-7" /></svg>
            </button>
          </div>

          <div className="relative h-56 w-full flex items-center justify-center my-2">
            <canvas ref={trafficChartRef}></canvas>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mt-2 mb-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1"><span className="w-2 h-2 rounded-full bg-[#010694]"></span> Regular</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-200 mt-1">{porcentajes.regular}%</p>
            </div>
            <div className="border-l border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#6d70fc' }}></span> SEP</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-200 mt-1">{porcentajes.sep}%</p>
            </div>
            <div className="border-l border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1"><span className="w-2 h-2 rounded-full bg-[#22c55e]"></span> PIE</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-200 mt-1">{porcentajes.pie}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 items-center border-t border-gray-100 dark:border-gray-700 justify-between mt-auto">
            <div className="flex justify-between items-center pt-4">
              <button className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-center inline-flex items-center transition-colors" type="button">
                Total alumnos: {totalAlumnos}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- WIDGET UTP --- */}
      <div className="mt-6 mb-2 grid grid-cols-1 md:grid-cols-3 gap-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 shadow-sm">
        <div className="md:col-span-3 mb-2 flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477-4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              Estado de Gestión Académica (UTP)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Monitoreo global de planificaciones y cobertura curricular del establecimiento.</p>
          </div>
          <button onClick={() => navigate('/panel/director/utp')} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">Ver Detalle</button>
        </div>

        <div className="flex flex-col justify-center">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cobertura Curricular</p>
          <div className="flex items-end gap-3 mt-2">
            <h3 className="text-3xl font-black text-gray-800 dark:text-white">{metricasUTP.coberturaPromedio}%</h3>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">Promedio General</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 h-2 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${metricasUTP.coberturaPromedio}%` }}></div>
          </div>
        </div>

        <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-700 pt-4 md:pt-0 md:pl-6">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entrega de Planificaciones</p>
          <div className="flex items-end gap-3 mt-2">
            <h3 className="text-3xl font-black text-gray-800 dark:text-white">{metricasUTP.porcentajeAlDia}%</h3>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Unidades al día</span>
          </div>
          <div className="w-full bg-red-400 dark:bg-red-500/80 h-2 rounded-full mt-3 overflow-hidden flex">
            <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${metricasUTP.porcentajeAlDia}%` }}></div>
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-gray-500 dark:text-gray-400 font-medium">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"></span> {metricasUTP.alDia} Al Día</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> {metricasUTP.atrasados} Atrasados</span>
          </div>
        </div>

        <div className="flex flex-col justify-center border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-700 pt-4 md:pt-0 md:pl-6">
          <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-800/30 flex items-start gap-3 h-full">
            <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 p-2 rounded-lg shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Revisión Pendiente UTP</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">Hay <strong className="text-amber-800 dark:text-amber-400">{metricasUTP.pendientes} planificaciones</strong> en la cola esperando validación de la unidad técnica.</p>
            </div>
          </div>
        </div>
      </div>

      {/* --- TABLA INTERACTIVA --- */}
      <div className="mt-6 mb-8 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 dark:border-gray-700 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">Alertas Recientes Mineduc</h3>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Filtros de Prioridad */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
              {['Todas', 'Alta', 'Media', 'Baja'].map(prio => (
                <button 
                  key={prio}
                  onClick={() => setPriorityFilter(prio)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    priorityFilter === prio 
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {prio}
                </button>
              ))}
            </div>

            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Buscar alumno o curso..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-64 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent pl-9 pr-3 text-sm text-gray-600 dark:text-white focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="p-4">Alumno / Curso</th>
                  <th className="p-4">Tipo de Alerta</th>
                  <th className="p-4">Fecha de Registro</th>
                  <th className="p-4">Prioridad</th>
                  <th className="p-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {alertasFiltradas.length > 0 ? (
                  alertasFiltradas.map((alerta) => (
                    <tr key={alerta.id} className="group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full bg-${alerta.color}-100 dark:bg-${alerta.color}-900/30 flex items-center justify-center text-xs font-bold text-${alerta.color}-700 dark:text-${alerta.color}-400`}>
                            {alerta.iniciales}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-800 dark:text-gray-200">{alerta.nombre}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{alerta.curso}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-300 font-medium">{alerta.tipo}</td>
                      <td className="p-4 text-gray-500 dark:text-gray-400">{alerta.fecha}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${alerta.prioridad === 'Alta'
                          ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50'
                          : alerta.prioridad === 'Media'
                            ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800/50'
                            : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                          }`}>
                          {alerta.prioridad}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => { setRutFichaSeleccionada(alerta.rut); setIsFichaDrawerOpen(true); }} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm">
                          Ver Ficha
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-12 text-center">
                      <div className="mx-auto w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-1">Sin alertas activas</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No hay reportes ni inasistencias críticas en el sistema en este momento.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* --- VENTANA MODAL EXPORTAR --- */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Exportar a SIGE</h2>
              <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Seleccione el formato oficial del Ministerio de Educación para descargar el reporte de asistencia mensual consolidada.
            </p>

            <div className="space-y-3 mb-8">
              <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${exportFormat === 'csv' ? 'border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                <div className="flex items-center gap-3">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <div>
                    <span className="block font-semibold text-gray-800 dark:text-gray-200 text-sm">Formato CSV (SIGE)</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Requerido para subvención</span>
                  </div>
                </div>
                <input type="radio" name="export-type" checked={exportFormat === 'csv'} onChange={() => setExportFormat('csv')} className="w-5 h-5 text-blue-600 dark:text-blue-500" />
              </label>

              <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${exportFormat === 'pdf' ? 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                <div className="flex items-center gap-3">
                  <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                  <div>
                    <span className="block font-semibold text-gray-800 dark:text-gray-200 text-sm">Documento PDF</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Para presentación en reunión</span>
                  </div>
                </div>
                <input type="radio" name="export-type" checked={exportFormat === 'pdf'} onChange={() => setExportFormat('pdf')} className="w-5 h-5 text-blue-600 dark:text-blue-500" />
              </label>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setIsExportModalOpen(false)} disabled={isExporting} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleExport} disabled={isExporting} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50">
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AQUI VA NUESTRO DRAWER AL HACER CLIC EN VER FICHA */}
      <FichaAlumnoDrawer
        isOpen={isFichaDrawerOpen}
        onClose={() => setIsFichaDrawerOpen(false)}
        rutAlumno={rutFichaSeleccionada}
      />

    </div>
  );
}