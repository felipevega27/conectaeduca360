import jsPDF from 'jspdf';
import logo from '../assets/logo.png';
import headerBg from '../assets/imagen_documentos.png';

/**
 * Inicializa un documento PDF con el encabezado institucional estándar de ConectaEduc.
 * @param {string} tituloCabecera Título principal (Ej: "COLEGIO CONECTAEDUC")
 * @param {string} subtituloCabecera Subtítulo (Ej: "Reporte Oficial")
 * @param {object} config Configuración de la BD (logo, nombre, etc.)
 * @returns {Promise<jsPDF>} Retorna el objeto doc de jsPDF listo para usar.
 */
export const initSchoolPdf = async (tituloCabecera, subtituloCabecera, config = {}) => {
  const doc = new jsPDF();
  let headerHeight = 35;

  // Cargar y dibujar la imagen de fondo del header
  try {
    const bgImg = new Image();
    bgImg.src = headerBg;
    await new Promise((resolve, reject) => {
      bgImg.onload = resolve;
      bgImg.onerror = reject;
    });
    
    // Calcular aspect ratio para evitar deformaciones
    const aspectRatio = bgImg.naturalHeight / bgImg.naturalWidth;
    headerHeight = 210 * aspectRatio;
    
    doc.addImage(bgImg, 'PNG', 0, 0, 210, headerHeight);
    
    // Nota: Como la imagen ya tiene todo el branding, no superponemos textos
    // para evitar que se vea manchado o empalmado.
    
  } catch (err) {
    console.warn("No se pudo cargar la imagen de fondo para el PDF", err);
    doc.setFillColor(1, 6, 148); // Fallback blue-900
    doc.rect(0, 0, 210, 32, 'F');
    headerHeight = 32;

    const logoUrl = config?.logo_url || logo;
    try {
      const img = new Image();
      img.src = logoUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      if (img.complete && img.naturalWidth > 0) {
        doc.addImage(img, 'PNG', 14, 4, 24, 24);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text(config?.nombre_colegio || tituloCabecera, 42, 17);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(subtituloCabecera || "", 42, 24);
      }
    } catch (fallbackErr) {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text(config?.nombre_colegio || tituloCabecera, 14, 17);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(subtituloCabecera || "", 14, 24);
    }
  }

  // Ajustar el inicio para que quede justo debajo de la imagen sin solaparse con ella
  doc.startY = headerHeight + 2;
  return doc;
};

/**
 * Agrega un pie de página estándar a todas las páginas del documento.
 * @param {jsPDF} doc Documento actual
 * @param {string} text Texto del pie de página
 */
export const addPdfFooter = (doc, text) => {
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(148, 163, 184);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(text || 'Documento oficial generado por el Sistema ConectaEduc', 14, 285);
  }
};
