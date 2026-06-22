import { useState } from 'react';

export default function ProfesorCopiloto() {
  const [herramienta, setHerramienta] = useState('rubrica');
  const [tema, setTema] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultado, setResultado] = useState(null);

  const generarContenido = (e) => {
    e.preventDefault();
    if (!tema.trim()) return;
    
    setIsGenerating(true);
    setResultado(null);

    // Simulamos el tiempo de "pensamiento" de la Inteligencia Artificial (2.5 segundos)
    setTimeout(() => {
      let respuestaSimulada = '';
      
      if (herramienta === 'rubrica') {
        respuestaSimulada = `RÚBRICA DE EVALUACIÓN: ${tema.toUpperCase()}
        
Criterios (Puntaje 1 al 4):

1. Comprensión del Tema (4 pts):
- Excelente (4): Demuestra un entendimiento profundo y preciso del tema.
- Bueno (3): Entiende los conceptos principales, pero omite detalles.
- Regular (2): Comprensión superficial o con errores conceptuales.
- Deficiente (1): No demuestra comprensión del tema.

2. Argumentación y Análisis (4 pts):
- Excelente (4): Argumentos sólidos, respaldados con evidencia clara.
- Bueno (3): Argumentos válidos, evidencia parcial.
- Regular (2): Afirmaciones sin suficiente respaldo.
- Deficiente (1): Sin argumentos claros ni respaldo.

3. Redacción y Ortografía (4 pts):
- Excelente (4): Sin errores, vocabulario variado y pertinente.
- Bueno (3): 1-3 errores menores, buen vocabulario.
- Regular (2): 4-6 errores que dificultan la lectura parcial.
- Deficiente (1): Múltiples errores que impiden la comprensión.`;
      } else if (herramienta === 'actividad') {
        respuestaSimulada = `PLANIFICACIÓN DE ACTIVIDAD: ${tema.toUpperCase()}
        
Estructura sugerida para bloque de 90 minutos:

1. INICIO (15 minutos) - "Activación de conocimientos":
Muestre a los estudiantes una imagen o un video corto (2 min) relacionado con el tema. Haga 3 preguntas abiertas al curso: "¿Qué observan?", "¿Qué creen que pasará?", "¿Cómo se relaciona con lo que vimos ayer?".

2. DESARROLLO (55 minutos) - "Trabajo Práctico":
Divida al curso en grupos de 4. Entregue un texto o problema a resolver. Cada grupo debe crear un mapa conceptual en papelógrafo resumiendo los 3 puntos clave del tema. El docente monitorea y guía a los grupos.

3. CIERRE (20 minutos) - "Ticket de Salida":
Un representante por grupo presenta su mapa conceptual en 2 minutos. 
Al finalizar, entregue un "Ticket de Salida" (papel pequeño) donde cada alumno deba responder individualmente: "Escribe 1 cosa nueva que aprendiste hoy y 1 duda que te quedó".`;
      } else {
        respuestaSimulada = `PREGUNTAS DE EVALUACIÓN: ${tema.toUpperCase()}
        
Nivel Cognitivo: Aplicación y Análisis (Taxonomía de Bloom)

Pregunta 1 (Alternativa):
Analizando el contexto de ${tema}, ¿Cuál de las siguientes afirmaciones describe mejor la causa principal del fenómeno estudiado?
A) Ocurrió de manera espontánea sin intervención externa.
B) Fue resultado directo de las políticas implementadas en la época.
C) Se debió exclusivamente a factores geográficos.
D) Es una consecuencia de la falta de recursos naturales.
(Respuesta correcta sugerida: B)

Pregunta 2 (Desarrollo Breve):
Explique en sus propias palabras cómo el concepto de ${tema} impacta en la sociedad actual. Proporcione al menos un ejemplo concreto para respaldar su respuesta.

Pregunta 3 (Desarrollo Extenso):
Compare y contraste dos posturas diferentes respecto a ${tema}. ¿Cuál postura considera usted más acertada y por qué? Justifique su respuesta utilizando al menos tres argumentos válidos vistos en clases.`;
      }

      setResultado(respuestaSimulada);
      setIsGenerating(false);
    }, 2500);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 transition-colors duration-300 pb-10 px-4 sm:px-8 pt-8">
      
      {/* CABECERA */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-transparent bg-clip-text bg-linear-to-r from-purple-600 to-blue-600 flex items-center gap-2">
          ConectaEdu IA 
          <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase border border-purple-200">BETA</span>
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Asistente pedagógico para creación de rúbricas, actividades y pruebas en segundos.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* PANEL DE CONTROL IA */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6">
          <form onSubmit={generarContenido} className="space-y-6">
            
            {/* Selector de Herramienta */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">1. ¿Qué necesitas crear hoy?</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className={`flex flex-col items-center p-3 text-center rounded-xl border-2 cursor-pointer transition-all ${herramienta === 'rubrica' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  <input type="radio" className="sr-only" checked={herramienta === 'rubrica'} onChange={() => setHerramienta('rubrica')} />
                  <svg className={`w-6 h-6 mb-1 ${herramienta === 'rubrica' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  <span className={`text-xs font-bold ${herramienta === 'rubrica' ? 'text-purple-700 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300'}`}>Rúbrica de Evaluación</span>
                </label>
                
                <label className={`flex flex-col items-center p-3 text-center rounded-xl border-2 cursor-pointer transition-all ${herramienta === 'actividad' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  <input type="radio" className="sr-only" checked={herramienta === 'actividad'} onChange={() => setHerramienta('actividad')} />
                  <svg className={`w-6 h-6 mb-1 ${herramienta === 'actividad' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  <span className={`text-xs font-bold ${herramienta === 'actividad' ? 'text-purple-700 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300'}`}>Actividad de Clase</span>
                </label>

                <label className={`flex flex-col items-center p-3 text-center rounded-xl border-2 cursor-pointer transition-all ${herramienta === 'preguntas' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  <input type="radio" className="sr-only" checked={herramienta === 'preguntas'} onChange={() => setHerramienta('preguntas')} />
                  <svg className={`w-6 h-6 mb-1 ${herramienta === 'preguntas' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span className={`text-xs font-bold ${herramienta === 'preguntas' ? 'text-purple-700 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300'}`}>Preguntas para Prueba</span>
                </label>
              </div>
            </div>

            {/* Prompt del usuario */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">2. Especifique el Tema o Aprendizaje Esperado</label>
              <textarea 
                required
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ej: Un ensayo argumentativo sobre el impacto de las redes sociales en adolescentes..."
                rows="4"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 p-4 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none text-gray-800 dark:text-white transition-all"
              ></textarea>
            </div>

            {/* Botón Generar */}
            <button 
              type="submit"
              disabled={isGenerating || !tema.trim()}
              className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all flex justify-center items-center gap-2 ${
                isGenerating || !tema.trim() 
                ? 'bg-gray-300 text-gray-500 shadow-none cursor-not-allowed' 
                : 'bg-linear-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-purple-500/25'
              }`}
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Generando con IA...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Generar Material
                </>
              )}
            </button>
          </form>
        </div>

        {/* PANTALLA DE RESULTADOS */}
        <div className="bg-gray-900 rounded-2xl shadow-xl border border-gray-800 p-6 flex flex-col h-125 lg:h-auto overflow-hidden relative">
          
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-800">
            <h3 className="text-white font-bold flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Resultado Generado
            </h3>
            {resultado && (
              <button 
                onClick={() => alert('¡Texto copiado al portapapeles!')}
                className="text-xs font-bold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors border border-gray-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                Copiar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {isGenerating ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 animate-pulse">
                <svg className="w-12 h-12 text-purple-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                <p className="text-sm font-medium">Analizando pedagogía e indexando currículum nacional...</p>
              </div>
            ) : resultado ? (
              <div className="text-gray-300 text-sm whitespace-pre-wrap font-mono leading-relaxed animate-fade-in-up">
                {resultado}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3">
                <svg className="w-10 h-10 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                <p className="text-sm">Escribe un tema y haz clic en Generar para ver la magia.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}