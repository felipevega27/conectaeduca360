export function sortCursos(cursos) {
  if (!cursos || !Array.isArray(cursos)) return cursos;

  const getWeight = (nombre) => {
    if (!nombre || typeof nombre !== 'string') return 999;
    
    let weight = 0;
    
    // Nivel (1, 2, 3...)
    const levelMatch = nombre.match(/(\d+)º/);
    if (levelMatch) {
      weight += parseInt(levelMatch[1]) * 10;
    }
    
    // Básico vs Medio
    if (nombre.toLowerCase().includes('básico')) {
      weight += 0;
    } else if (nombre.toLowerCase().includes('medio')) {
      weight += 100; // Enseñanza media viene después de básica
    }
    
    // Letra del curso (A, B, C)
    const letterMatch = nombre.match(/\s([A-Z])$/);
    if (letterMatch) {
      weight += letterMatch[1].charCodeAt(0) - 65;
    }
    
    return weight;
  };

  return [...cursos].sort((a, b) => {
    // Manejar arreglo de strings (ej: ['1º Básico A', '2º Básico B'])
    if (typeof a === 'string' && typeof b === 'string') {
      return getWeight(a) - getWeight(b);
    }
    
    // Manejar arreglo de objetos (ej: {curso: '1º Básico A'} o {cursos: {nombre: '1º Básico A'}})
    const nameA = a?.nombre || a?.curso || a?.cursos?.nombre || a?.asignatura || '';
    const nameB = b?.nombre || b?.curso || b?.cursos?.nombre || b?.asignatura || '';
    
    // Si son la misma clase, desempatamos por asignatura si existe
    const weightA = getWeight(nameA);
    const weightB = getWeight(nameB);
    
    if (weightA === weightB && a?.asignatura && b?.asignatura) {
        return a.asignatura.localeCompare(b.asignatura);
    }
    if (weightA === weightB && a?.nombre && b?.nombre && a.nombre !== nameA) {
       // Por ejemplo {nombre: 'Matemática', cursos: {nombre: '1º Básico'}}
       return a.nombre.localeCompare(b.nombre);
    }

    return weightA - weightB;
  });
}
