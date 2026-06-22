export const formatRut = (rut) => {
  // Limpiamos todo lo que no sea número o la letra K (mayúscula o minúscula)
  let value = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  
  // Si está vacío o es un solo número, lo devolvemos tal cual
  if (value.length <= 1) return value;

  // Separamos el cuerpo del dígito verificador
  let body = value.slice(0, -1);
  let dv = value.slice(-1);

  // Le agregamos los puntos cada 3 números al cuerpo usando una expresión regular
  body = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  // Unimos todo con el guion final
  return `${body}-${dv}`;
};