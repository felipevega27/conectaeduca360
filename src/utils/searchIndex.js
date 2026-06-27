export const menuItems = [
  // Módulos Director
  { id: 'dir-dashboard', label: 'Panel Principal (Director)', route: '/panel/director', role: 'director', icon: 'home' },
  { id: 'dir-documentos', label: 'Gestión de Documentos', route: '/panel/director/documentos', role: 'director', icon: 'document' },
  { id: 'dir-comunicados', label: 'Comunicados Oficiales', route: '/panel/director/comunicados', role: 'director', icon: 'megaphone' },
  { id: 'dir-matriculas', label: 'Matrículas', route: '/panel/director/matriculas', role: 'director', icon: 'users' },
  { id: 'dir-certificados', label: 'Certificados', route: '/panel/director/certificados', role: 'director', icon: 'academic-cap' },

  // Módulos Profesor
  { id: 'prof-dashboard', label: 'Mi Horario', route: '/panel/profesor', role: 'profesor', icon: 'calendar' },
  { id: 'prof-asistencia', label: 'Pasar Asistencia', route: '/panel/profesor/asistencia', role: 'profesor', icon: 'clipboard-check' },
  { id: 'prof-calificaciones', label: 'Calificaciones', route: '/panel/profesor/calificaciones', role: 'profesor', icon: 'chart-bar' },
  { id: 'prof-anotaciones', label: 'Anotaciones (Hoja de Vida)', route: '/panel/profesor/anotaciones', role: 'profesor', icon: 'document-text' },
  { id: 'prof-tareas', label: 'Tareas y Evaluaciones', route: '/panel/profesor/tareas', role: 'profesor', icon: 'clipboard-list' },
  { id: 'prof-planificaciones', label: 'Planificaciones', route: '/panel/profesor/planificaciones', role: 'profesor', icon: 'document-duplicate' },
  { id: 'prof-copiloto', label: 'ConectaEdu IA (Copiloto)', route: '/panel/profesor/copiloto', role: 'profesor', icon: 'sparkles' },
];
