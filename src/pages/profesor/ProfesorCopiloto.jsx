import { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import { initSchoolPdf, addPdfFooter } from '../../utils/pdfUtils';
import autoTable from 'jspdf-autotable';
import BackdropLoader from '../../components/BackdropLoader';

export default function ProfesorCopiloto() {
  const [herramienta, setHerramienta] = useState('rubrica');
  const [tema, setTema] = useState('');
  const [nivelObjetivo, setNivelObjetivo] = useState('1º Básico');
  const [isGenerating, setIsGenerating] = useState(false);

  const nivelesEducativos = [
    '1º Básico', '2º Básico', '3º Básico', '4º Básico', '5º Básico', '6º Básico', '7º Básico', '8º Básico',
    '1º Medio', '2º Medio', '3º Medio', '4º Medio'
  ];
  const [resultado, setResultado] = useState(null);
  const [userData, setUserData] = useState(null);
  const [asignaturas, setAsignaturas] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('userLogged'));
    if (user) {
      setUserData(user);
      cargarAsignaturas(user.rut);
    }
  }, []);

  const cargarAsignaturas = async (rut) => {
    const { data } = await supabase.from('asignaturas').select('nombre').eq('rut_profesor', rut);
    if (data) setAsignaturas([...new Set(data.map(a => a.nombre))]);
  };

  const formatMarkdown = (text) => {
    if (!text) return '';
    let formatted = text
      .replace(/</g, "&lt;").replace(/>/g, "&gt;")
      
      // Encabezados
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-6 mb-2 text-blue-800 dark:text-blue-300">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-extrabold mt-8 mb-3 text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-black mt-8 mb-4 text-blue-600 dark:text-blue-400 border-b-2 border-blue-100 dark:border-blue-900/50 pb-3">$1</h1>')
      
      // Listas Numeradas (ej. 1. Texto)
      .replace(/^\s*(\d+)\.\s+(.*)$/gim, '<div class="flex items-start gap-3 mt-6 mb-3"><span class="flex items-center justify-center bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold rounded-lg w-7 h-7 text-sm shrink-0">$1</span><span class="font-bold text-gray-800 dark:text-gray-200 mt-0.5">$2</span></div>')
      
      // Listas con Viñetas (ej. * Texto o - Texto)
      .replace(/^\s*[\*\-]\s+(.*)$/gim, '<div class="flex items-start gap-2 mb-2 ml-4"><span class="text-blue-500 mt-1 shrink-0"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="2.5"></circle></svg></span><span class="flex-1 text-gray-700 dark:text-gray-300">$1</span></div>')
      
      // Negritas y Cursivas
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-extrabold text-gray-900 dark:text-white">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-700 dark:text-gray-300">$1</em>');
    
    // Manejo de saltos de línea inteligentes
    // Evita saltos de línea dobles después de elementos de bloque que ya tienen márgenes
    formatted = formatted
      .replace(/<\/div>\n/g, '</div>')
      .replace(/<\/h1>\n/g, '</h1>')
      .replace(/<\/h2>\n/g, '</h2>')
      .replace(/<\/h3>\n/g, '</h3>')
      .replace(/\n/g, '<br />');

    return formatted;
  };

  const exportarPDF = async () => {
    if (!resultado) return;
    try {
      const doc = await initSchoolPdf(
        "COLEGIO CONECTAEDUC", 
        `Material Pedagógico IA: ${herramienta.toUpperCase()}`
      );
      
      let yPos = doc.startY || 80;
      
      // Tipo de Material
      doc.setFontSize(16);
      doc.setTextColor(30, 64, 175); // Azul principal
      doc.setFont("helvetica", "bold");
      doc.text(`Material Pedagógico IA: ${herramienta.toUpperCase()}`, 14, yPos);
      yPos += 10;
      
      // Tema del PDF
      doc.setFontSize(13);
      doc.setTextColor(80, 80, 80); // Gris oscuro
      doc.setFont("helvetica", "bold");
      const tituloLines = doc.splitTextToSize(`Tema: ${tema}`, 180);
      doc.text(tituloLines, 14, yPos);
      yPos += tituloLines.length * 6 + 6;
      
      const lines = resultado.split('\n');
      let tableRows = [];
      let tableHeaders = [];
      let inTable = false;

      const checkPageBreak = (neededSpace = 10) => {
        if (yPos + neededSpace > 280) {
          doc.addPage();
          yPos = 20;
        }
      };

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();

        // Detectar y construir tablas
        if (line.startsWith('|') && line.endsWith('|')) {
           const cells = line.split('|').slice(1, -1).map(c => c.trim());
           // Ignorar la fila de guiones divisores de tabla Markdown
           if (cells.every(c => /^[-:]+$/.test(c))) continue;
           
           if (!inTable) {
              inTable = true;
              tableHeaders = cells;
           } else {
              tableRows.push(cells);
           }
           continue;
        }

        // Si se acaba la tabla, renderizarla
        if (inTable && !line.startsWith('|')) {
           checkPageBreak(30);
           autoTable(doc, {
             head: [tableHeaders],
             body: tableRows,
             startY: yPos,
             theme: 'grid',
             styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
             headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
             margin: { left: 14, right: 14 }
           });
           yPos = doc.lastAutoTable.finalY + 10;
           inTable = false;
           tableHeaders = [];
           tableRows = [];
        }

        if (!line) {
           yPos += 3;
           continue;
        }

        // Limpieza de negritas y cursivas para renderizado simple
        line = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

        let isHeader = false;
        let fontSize = 10;
        let fontStyle = "normal";
        let textColor = [50, 50, 50];
        let indent = 14;

        // Detectar tipo de línea
        if (line.startsWith('### ')) {
           line = line.substring(4);
           isHeader = true; fontSize = 11; fontStyle = "bold"; textColor = [30, 64, 175];
        } else if (line.startsWith('## ')) {
           line = line.substring(3);
           isHeader = true; fontSize = 12; fontStyle = "bold"; textColor = [30, 64, 175];
        } else if (line.startsWith('# ')) {
           line = line.substring(2);
           isHeader = true; fontSize = 14; fontStyle = "bold"; textColor = [30, 64, 175];
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
           line = "• " + line.substring(2);
           indent = 18;
        } else if (/^\d+\.\s/.test(line)) {
           indent = 18;
        }

        doc.setFontSize(fontSize);
        doc.setFont("helvetica", fontStyle);
        doc.setTextColor(...textColor);

        const splitLine = doc.splitTextToSize(line, 210 - indent - 14);
        checkPageBreak(splitLine.length * 5 + 2);
        
        doc.text(splitLine, indent, yPos);
        yPos += splitLine.length * 5 + (isHeader ? 4 : 2);
      }

      // Si el texto termina justo al final de la tabla
      if (inTable) {
         checkPageBreak(30);
         autoTable(doc, {
           head: [tableHeaders],
           body: tableRows,
           startY: yPos,
           theme: 'grid',
           styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
           headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold' },
           margin: { left: 14, right: 14 }
         });
      }

      addPdfFooter(doc);
      doc.save(`Material_${herramienta}_${tema.substring(0, 10).replace(/[^a-zA-Z0-9]/g,'_')}.pdf`);
    } catch (error) {
      console.error(error);
      alert("Error al generar PDF");
    }
  };

  const generarContenido = async (e) => {
    e.preventDefault();
    if (!tema.trim()) return;

    setIsGenerating(true);
    setResultado(null);

    const asignaturasTexto = asignaturas.length > 0 ? asignaturas.join(', ') : 'diversas áreas';

    const promptIA = `Eres un asistente pedagógico experto. 
    Docente: ${userData?.nombre || 'Profesor'}.
    Especialidad: ${asignaturasTexto}.
    Sistema: Educación Chilena.
    Nivel Educativo: ${nivelObjetivo}.
    
    Tarea: Generar contenido de tipo ${herramienta} para el tema: "${tema}" destinado estrictamente a estudiantes de ${nivelObjetivo}.
    Asegúrate de usar un lenguaje pedagógico formal y adecuado para el currículum de Chile en el nivel especificado. NUNCA uses la terminología "grados" ni "escuela", utiliza exclusivamente "${nivelObjetivo}" como nivel escolar.
    Responde solo con el contenido solicitado.`;

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      
      // DIAGNÓSTICO: Esto te mostrará en la consola si la llave existe
      console.log("¿Existe la API Key?:", apiKey ? "Sí" : "NO ESTÁ CARGADA");

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant", 
          messages: [{ role: "user", content: promptIA }]
        })
      });

      const data = await response.json();
      
      // DIAGNÓSTICO: Esto imprimirá el error real del servidor en la consola
      if (!response.ok) {
        console.error("Detalle del error de Groq:", JSON.stringify(data, null, 2));
        throw new Error(data.error?.message || JSON.stringify(data));
      }
      
      setResultado(data.choices[0].message.content);
    } catch (error) {
      setResultado(`Error: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ... (El resto de tu JSX se mantiene igual)
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 p-8">
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Copiloto Pedagógico IA</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Bienvenido, {userData?.nombre}. IA configurada para: {asignaturas.join(', ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* PANEL DE CONTROL */}
        <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-2xl shadow-sm p-6">
          <form onSubmit={generarContenido} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">1. ¿Qué necesitas crear?</label>
              <div className="grid grid-cols-3 gap-3">
                {['rubrica', 'actividad', 'preguntas'].map((h) => (
                  <label key={h} className={`p-3 text-center rounded-xl border-2 cursor-pointer transition-all bg-white dark:bg-gray-900 ${herramienta === h ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-300 dark:hover:border-blue-500'}`}>
                    <input type="radio" className="sr-only" checked={herramienta === h} onChange={() => setHerramienta(h)} />
                    <span className="text-xs font-bold capitalize">{h}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">2. Nivel Educativo Objetivo</label>
              <select
                value={nivelObjetivo}
                onChange={(e) => setNivelObjetivo(e.target.value)}
                className="w-full rounded-xl border p-3.5 text-sm bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-100 mb-2"
              >
                {nivelesEducativos.map(nivel => (
                  <option key={nivel} value={nivel}>{nivel}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">3. Tema o Aprendizaje Esperado</label>
              <textarea
                required
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ej: Análisis del texto argumentativo..."
                rows="4"
                className="w-full rounded-xl border p-4 text-sm bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-100"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/30 transition-all"
            >
              {isGenerating ? 'Consultando a la IA...' : 'Generar Contenido'}
            </button>
          </form>
        </div>

        {/* RESULTADO */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-800 dark:text-gray-200 overflow-hidden h-[500px] shadow-sm flex flex-col relative">
          {isGenerating && (
            <BackdropLoader mensaje="Generando material pedagógico de alta calidad..." />
          )}
          
          {resultado ? (
            <>
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 shrink-0">
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Resultado de la IA</h3>
                <button 
                  onClick={exportarPDF}
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  Guardar PDF
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div 
                  className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 pb-10" 
                  dangerouslySetInnerHTML={{ __html: formatMarkdown(resultado) }} 
                />
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 p-6">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                <p>El resultado aparecerá aquí.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}