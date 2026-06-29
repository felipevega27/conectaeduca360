export const menuItems = [
  // Módulos Director (Coincide con DirectorLayout)
  { id: 'dir-dashboard', label: 'Visión General', route: '/panel/director', role: 'director', icon: 'home' },
  { id: 'dir-cursos', label: 'Gestión de Cursos', route: '/panel/director/cursos', role: 'director', icon: 'academic-cap' },
  { id: 'dir-docentes-lista', label: 'Lista Docente', route: '/panel/director/docentes', role: 'director', icon: 'users' },
  { id: 'dir-docentes-nuevo', label: 'Registrar Docente', route: '/panel/director/docentes/nuevo', role: 'director', icon: 'user-add' },
  { id: 'dir-alumnos-lista', label: 'Lista Alumno', route: '/panel/director/alumnos', role: 'director', icon: 'users' },
  { id: 'dir-alumnos-nuevo', label: 'Matricular Alumno', route: '/panel/director/alumnos/crear', role: 'director', icon: 'user-add' },
  { id: 'dir-rendimiento', label: 'Rendimiento', route: '/panel/director/rendimiento', role: 'director', icon: 'chart-bar' },
  { id: 'dir-convivencia', label: 'Convivencia', route: '/panel/director/convivencia', role: 'director', icon: 'heart' },
  { id: 'dir-utp', label: 'Gestión UTP', route: '/panel/director/utp', role: 'director', icon: 'clipboard' },
  { id: 'dir-pie', label: 'Programa PIE', route: '/panel/director/programa-pie', role: 'director', icon: 'puzzle' },
  { id: 'dir-documentos', label: 'Emisión Documentos', route: '/panel/director/documentos', role: 'director', icon: 'document' },
  { id: 'dir-configuracion', label: 'Config. Institucional', route: '/panel/director/configuracion', role: 'director', icon: 'cog' },

  // Módulos Profesor
  { id: 'prof-dashboard', label: 'Panel Principal', route: '/panel/profesor', role: 'profesor', icon: 'home' },
  { id: 'prof-asistencia', label: 'Pasar Asistencia', route: '/panel/profesor/asistencia', role: 'profesor', icon: 'clipboard-check' },
  { id: 'prof-calificaciones', label: 'Calificaciones', route: '/panel/profesor/calificaciones', role: 'profesor', icon: 'chart-bar' },
  { id: 'prof-anotaciones', label: 'Anotaciones (Hoja de Vida)', route: '/panel/profesor/anotaciones', role: 'profesor', icon: 'document-text' },
  { id: 'prof-tareas', label: 'Tareas y Evaluaciones', route: '/panel/profesor/tareas', role: 'profesor', icon: 'clipboard-list' },
  { id: 'prof-planificaciones', label: 'Planificaciones', route: '/panel/profesor/planificaciones', role: 'profesor', icon: 'document-duplicate' },
  { id: 'prof-copiloto', label: 'ConectaEdu IA (Copiloto)', route: '/panel/profesor/copiloto', role: 'profesor', icon: 'sparkles' },
];
