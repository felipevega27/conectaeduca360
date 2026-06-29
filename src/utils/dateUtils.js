export const getMesesSemestre = (semestre) => {
  if (semestre === 'Primer Semestre') return [2, 3, 4, 5, 6]; 
  if (semestre === 'Segundo Semestre') return [7, 8, 9, 10, 11]; 
  return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
};

export const perteneceAlSemestre = (fechaString, semestreActivo) => {
  if (!fechaString) return false;
  const mesesValidos = getMesesSemestre(semestreActivo);
  const mesStr = fechaString.includes('T') ? fechaString.split('T')[0].split('-')[1] : fechaString.split('-')[1];
  return mesesValidos.includes(parseInt(mesStr, 10) - 1);
};
