import jsPDF from 'jspdf';
import logo from '../assets/logo.png';

/**
 * Inicializa un documento PDF con el encabezado institucional estándar de ConectaEduc.
 * @param {string} tituloCabecera Título principal (Ej: "COLEGIO CONECTAEDUC")
 * @param {string} subtituloCabecera Subtítulo (Ej: "Reporte Oficial")
 * @param {object} config Configuración de la BD (logo, nombre, etc.)
 * @returns {Promise<jsPDF>} Retorna el objeto doc de jsPDF listo para usar.
 */
export const initSchoolPdf = async (tituloCabecera, subtituloCabecera, config = {}) => {
  const doc = new jsPDF();

  // Fondo del header
  doc.setFillColor(1, 6, 148); // blue-900
  doc.rect(0, 0, 210, 32, 'F');

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
    } else {
      throw new Error("Imagen cargada pero sin dimensiones válidas");
    }
  } catch (err) {
    console.warn("No se pudo cargar el logo para el PDF", err);
    // Fallback sin logo
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text(config?.nombre_colegio || tituloCabecera, 14, 17);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(subtituloCabecera || "", 14, 24);
  }

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
