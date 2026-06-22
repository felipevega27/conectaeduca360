import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabaseClient';

const regionesChile = {
  "Región de Arica y Parinacota": ["Arica", "Camarones", "Putre", "General Lagos"],
  "Región de Tarapacá": ["Iquique", "Alto Hospicio", "Pozo Almonte", "Camiña", "Colchane", "Huara", "Pica"],
  "Región de Antofagasta": ["Antofagasta", "Mejillones", "Sierra Gorda", "Taltal", "Calama", "Ollagüe", "San Pedro de Atacama", "Tocopilla", "María Elena"],
  "Región de Atacama": ["Copiapó", "Caldera", "Tierra Amarilla", "Chañaral", "Diego de Almagro", "Vallenar", "Alto del Carmen", "Freirina", "Huasco"],
  "Región de Coquimbo": ["La Serena", "Coquimbo", "Andacollo", "La Higuera", "Paihuano", "Vicuña", "Illapel", "Los Vilos", "Salamanca", "Ovalle", "Combarbalá", "Monte Patria", "Río Hurtado", "Canela"],
  "Región de Valparaíso": ["Valparaíso", "Viña del Mar", "Quilpué", "Villa Alemana", "Concón", "Quintero", "Puchuncaví", "Casablanca", "San Antonio", "Quillota", "La Calera", "San Felipe", "San Esteban", "Limache", "Olmué", "Zapallar"],
  "Región Metropolitana": ["Cerrillos", "Cerro Navia", "Conchalí", "El Bosque", "Estación Central", "Huechuraba", "Independencia", "La Cisterna", "La Florida", "La Granja", "La Pintana", "La Reina", "Las Condes", "Lo Barnechea", "Lo Espejo", "Lo Prado", "Macul", "Maipú", "Ñuñoa", "Pedro Aguirre Cerda", "Peñalolén", "Providencia", "Pudahuel", "Quilicura", "Quinta Normal", "Recoleta", "Renca", "San Joaquín", "San Miguel", "San Ramón", "Santiago", "Vitacura", "Puente Alto", "Pirque", "San José de Maipo", "Colina", "Lampa", "Tiltil", "San Bernardo", "Buin", "Calera de Tango", "Paine", "Melipilla", "Talagante", "Padre Hurtado", "Peñaflor"],
  "Región de O'Higgins": ["Rancagua", "Machalí", "Graneros", "San Fernando", "Rengo", "Pichilemu", "Santa Cruz", "Chimbarongo"],
  "Región del Maule": ["Talca", "Curicó", "Linares", "Cauquenes", "Constitución", "Molina", "San Javier", "Parral"],
  "Región de Ñuble": ["Chillán", "Chillán Viejo", "San Carlos", "Bulnes", "Coihueco", "Quillón"],
  "Región del Biobío": ["Concepción", "Talcahuano", "San Pedro de la Paz", "Chiguayante", "Hualpén", "Coronel", "Tomé", "Los Ángeles", "Arauco", "Lota"],
  "Región de La Araucanía": ["Temuco", "Padre Las Casas", "Villarrica", "Angol", "Victoria", "Lautaro", "Pucón"],
  "Región de Los Ríos": ["Valdivia", "Corral", "Lanco", "Los Lagos", "Mariquina", "Paillaco", "Panguipulli", "La Unión"],
  "Región de Los Lagos": ["Puerto Montt", "Calbuco", "Puerto Varas", "Castro", "Ancud", "Quellón", "Osorno", "Purranque"],
  "Región de Aysén": ["Coyhaique", "Aysén", "Cisnes", "Chile Chico"],
  "Región de Magallanes": ["Punta Arenas", "Puerto Natales", "Porvenir"]
};

export default function DirectorCrearDocente() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);

  const [regionSeleccionada, setRegionSeleccionada] = useState('');
  const [comunasDisponibles, setComunasDisponibles] = useState([]);
  const [cursosDisponibles, setCursosDisponibles] = useState([]);
  const [esProfesorJefe, setEsProfesorJefe] = useState(false);

  const [form, setForm] = useState({
    rut: '',
    nombre: '',
    titulo_profesional: '',
    curso_o_cargo: '',
    tipo_contrato: 'Planta (Contrato Indefinido)',
    id_curso_jefatura: '',
    email: '',
    telefono: '',
    calle_numero: '',
    comuna: ''
  });

  useEffect(() => {
    const cargarCursos = async () => {
      const { data } = await supabase.from('cursos').select('*').order('nombre');
      setCursosDisponibles(data || []);
    };
    cargarCursos();
  }, []);

  const handleRegionChange = (e) => {
    const region = e.target.value;
    setRegionSeleccionada(region);
    setComunasDisponibles(regionesChile[region] || []);
    setForm({ ...form, comuna: '' });
  };

  const formatRUT = (rut) => {
    let valor = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (valor.length === 0) return '';
    const cuerpo = valor.slice(0, -1);
    const dv = valor.slice(-1);
    let cuerpoFormateado = '';
    for (let i = cuerpo.length; i > 0; i -= 3) {
      const inicio = Math.max(0, i - 3);
      cuerpoFormateado = cuerpo.slice(inicio, i) + (cuerpoFormateado ? '.' + cuerpoFormateado : '');
    }
    return valor.length > 1 ? `${cuerpoFormateado}-${dv}` : valor;
  };

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    setIsConfirmModalOpen(true);
  };

  const registrarDocente = async () => {
    setIsSaving(true);
    setFormError(null);

    try {
      const cuerpoRut = form.rut.replace(/[^0-9kK]/g, '');
      const claveInicial = cuerpoRut.substring(0, 4);

      if (!claveInicial) throw new Error("RUT Inválido.");

      let direccionFinal = null;
      if (form.calle_numero && form.comuna && regionSeleccionada) {
        direccionFinal = `${form.calle_numero}, ${form.comuna}, ${regionSeleccionada}`;
      }

      // SUBIR AVATAR SI EXISTE
      let avatarUrl = null;
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${form.rut}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile);

        if (uploadError) throw new Error("Error subiendo foto de perfil: " + uploadError.message);

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);
          
        avatarUrl = publicUrl;
      }

      const idJefaturaFinal = esProfesorJefe && form.id_curso_jefatura ? parseInt(form.id_curso_jefatura) : null;

      const { error } = await supabase.from('perfiles').insert([{
        rut: form.rut,
        nombre: form.nombre,
        rol: 'profesor',
        titulo_profesional: form.titulo_profesional,
        curso_o_cargo: form.curso_o_cargo,
        id_curso_jefatura: idJefaturaFinal,
        tipo_contrato: form.tipo_contrato,
        email: form.email || null,
        telefono: form.telefono ? `+56 9 ${form.telefono}` : null,
        direccion: direccionFinal,
        clave: claveInicial,
        requiere_cambio_clave: true,
        avatar_url: avatarUrl
      }]);

      if (error) {
        if (error.code === '23505') throw new Error("Este RUT ya está registrado en el establecimiento.");
        throw error;
      }

      // Si es profesor jefe, sincronizamos la tabla cursos
      if (idJefaturaFinal) {
        const { error: cursoError } = await supabase
          .from('cursos')
          .update({ rut_profesor_jefe: form.rut })
          .eq('id', idJefaturaFinal);

        if (cursoError) throw new Error("Error asignando jefatura al curso: " + cursoError.message);
      }

      await new Promise(resolve => setTimeout(resolve, 800));
      setIsConfirmModalOpen(false);
      setSuccessData({ rut: form.rut, clave: claveInicial, nombre: form.nombre, especialidad: form.curso_o_cargo });

    } catch (err) {
      console.error(err);
      setFormError(err.message || "No se pudo registrar al docente.");
      setIsConfirmModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900 pb-10 px-4 sm:px-8 pt-8 relative">
      
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          Registrar Nuevo Profesional Docente
        </h1>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm p-6 sm:p-8 max-w-4xl relative z-10">
        <form onSubmit={handleOpenConfirm} className="space-y-8">
          
          {/* SECCIÓN 1 */}
          <div>
            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px]">1</span>
              Identificación y Contacto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">RUT del Docente</label>
                <input required type="text" placeholder="Ej: 14.234.567-8" value={form.rut} onChange={(e) => setForm({...form, rut: formatRUT(e.target.value)})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none" maxLength={12} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Nombre Completo</label>
                <input required type="text" placeholder="Ej: María José Rojas" value={form.nombre} onChange={(e) => setForm({...form, nombre: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Teléfono Celular</label>
                <div className="flex">
                  <span className="inline-flex items-center h-11 px-4 whitespace-nowrap text-sm font-medium text-gray-600 bg-gray-100 border border-r-0 border-gray-300 rounded-l-xl dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600">
                    +56 9
                  </span>
                  <input type="text" maxLength="8" placeholder="12345678" value={form.telefono} onChange={(e) => setForm({...form, telefono: e.target.value.replace(/\D/g, '')})} className="w-full h-11 px-4 rounded-r-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Correo Institucional / Personal</label>
                <input required type="email" placeholder="profesor@colegio.cl" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none" />
              </div>

              {/* INPUT DE FOTO DE PERFIL */}
              <div className="md:col-span-2 mt-2 mb-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Foto de Perfil (Opcional)</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setAvatarFile(e.target.files[0])} 
                  className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400" 
                />
              </div>
            </div>

            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Dirección Particular</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Región</label>
                <select value={regionSeleccionada} onChange={handleRegionChange} className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-white outline-none">
                  <option value="" disabled>Seleccione Región</option>
                  {Object.keys(regionesChile).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Comuna</label>
                <select value={form.comuna} onChange={(e) => setForm({...form, comuna: e.target.value})} disabled={!regionSeleccionada} className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-white outline-none disabled:opacity-50">
                  <option value="" disabled>Seleccione Comuna</option>
                  {comunasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Calle y Número</label>
                <input type="text" placeholder="Ej: Pasaje Las Flores 456" value={form.calle_numero} onChange={(e) => setForm({...form, calle_numero: e.target.value})} className="w-full h-10 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-white outline-none" />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2 */}
          <div>
            <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-4 border-b border-gray-100 dark:border-gray-700 pb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px]">2</span>
              Antecedentes Profesionales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Título Profesional / Grado</label>
                <input required type="text" placeholder="Ej: Pedagogía en Educación Básica" value={form.titulo_profesional} onChange={(e) => setForm({...form, titulo_profesional: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Asignatura(s) que Imparte</label>
                <input required type="text" placeholder="Ej: Matemáticas y Física" value={form.curso_o_cargo} onChange={(e) => setForm({...form, curso_o_cargo: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Situación Contractual</label>
                <select value={form.tipo_contrato} onChange={(e) => setForm({...form, tipo_contrato: e.target.value})} className="w-full h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-transparent text-sm dark:text-white focus:border-blue-500 outline-none">
                  <option value="Planta (Contrato Indefinido)" className="dark:bg-gray-800">Planta (Contrato Indefinido)</option>
                  <option value="Plazo Fijo (Anual)" className="dark:bg-gray-800">Plazo Fijo (Anual)</option>
                  <option value="Reemplazo" className="dark:bg-gray-800">Reemplazo Temporal</option>
                  <option value="Honorarios (Por horas)" className="dark:bg-gray-800">Honorarios (Por Horas Cronológicas)</option>
                </select>
              </div>
            </div>

            {/* JEFATURA */}
            <div className="bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-200">Asignación de Jefatura</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Activar solo si el docente asumirá como Profesor Jefe de un curso.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={esProfesorJefe} onChange={() => setEsProfesorJefe(!esProfesorJefe)} />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {esProfesorJefe && (
                <div className="mt-4 pt-4 border-t border-indigo-100 dark:border-indigo-800/30 animate-[fadeIn_0.2s_ease-out]">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Seleccionar Curso de Jefatura</label>
                  <select required={esProfesorJefe} value={form.id_curso_jefatura} onChange={(e) => setForm({...form, id_curso_jefatura: e.target.value})} className="w-full md:w-1/2 h-11 px-4 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm dark:text-white focus:border-blue-500 outline-none">
                    <option value="" disabled>Seleccione el curso a su cargo...</option>
                    {cursosDisponibles.map(c => (
                      <option key={c.id} value={c.id} className="dark:bg-gray-800">{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {formError && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">{formError}</p>
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-600/20 flex justify-center items-center">
              Dar de Alta Contrato
            </button>
          </div>
        </form>
      </div>

      {/* MODAL CONFIRMAR ALTA */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out]">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-2 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Dar de Alta</h2>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">¿Seguro que desea registrar a este docente en el sistema?</p>
            
            {isSaving ? (
              <div className="flex w-full items-center justify-center py-2">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-red-500 border-r-green-500 border-b-yellow-500 rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setIsConfirmModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  No, cancelar
                </button>
                <button onClick={registrarDocente} className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
                  Sí, registrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- NUEVO MODAL DE ÉXITO ESTILO MODERN UI --- */}
      {successData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-200 dark:border-gray-700 animate-[fadeInUp_0.2s_ease-out]">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-2 rounded-full">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">¡Docente Registrado!</h2>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              El perfil ha sido creado. Entrega estas credenciales; el sistema pedirá un cambio de clave en el primer ingreso.
            </p>

            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Acceso Docente</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Usuario: <span className="font-bold">{successData.rut}</span></p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Clave: <span className="font-bold">{successData.clave}</span></p>
              </div>
            </div>

            <button 
              onClick={() => navigate('/panel/director/docentes')} 
              className="w-full py-2.5 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
            >
              Entendido, volver al equipo
            </button>
          </div>
        </div>
      )}

    </div>
  );
}