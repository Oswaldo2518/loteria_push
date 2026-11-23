
'use strict';

// Tabla de 4 filas y 4 columnas.
//
// Posiciones:
//  0   1   2   3
//  4   5   6   7
//  8   9  10  11
// 12  13  14  15

// Patrones que permiten ganar una partida.
const PATRONES = [
  // Tabla completa.
  [
    'llena',
    Array.from(
      { length: 16 },
      (_, i) => i,
    ),
  ],

  // Cuatro filas.
  ...[0, 4, 8, 12].map((s, i) => [
    `fila${i + 1}`,
    [s, s + 1, s + 2, s + 3],
  ]),

  // Cuatro columnas.
  ...[0, 1, 2, 3].map((s, i) => [
    `columna${i + 1}`,
    [s, s + 4, s + 8, s + 12],
  ]),

  // Diagonales.
  ['diagonal1', [0, 5, 10, 15]],
  ['diagonal2', [3, 6, 9, 12]],

  // Esquinas.
  ['esquinas', [0, 3, 12, 15]],

  // Centro.
  ['centro', [5, 6, 9, 10]],
].map(
  ([nombre, posiciones]) =>
    Object.freeze({
      nombre,
      posiciones,
    }),
);

// Devuelve los patrones que ya están completos.
function patronesCompletos(tabla, cantadas) {
  return PATRONES.filter((p) =>
    p.posiciones.every((pos) =>
      cantadas.has(tabla[pos]),
    ),
  ).map((p) => p.nombre);
}

// Busca una carta que falte para completar
// algún patrón ganador.
function cartaQueFalta(tabla, cantadas) {
  // Si ya hay un patrón ganador,
  // no necesitamos buscar otra carta.
  if (patronesCompletos(tabla, cantadas).length > 0) {
    return null;
  }

  for (const p of PATRONES) {
    // Excluir la tabla llena para evitar
    // avisos innecesarios de "¡Casi!".
    if (p.nombre === 'llena') {
      continue;
    }

    const faltan = p.posiciones
      .map((pos) => tabla[pos])
      .filter((id) => !cantadas.has(id));

    // Si falta exactamente una carta,
    // devolver su identificador.
    if (faltan.length === 1) {
      return faltan[0];
    }
  }

  return null;
}

// Convertir un patrón en una descripción legible.
function describirPatron(nombre) {
  if (nombre === 'llena') {
    return 'la tabla llena';
  }

  if (nombre === 'esquinas') {
    return 'las cuatro esquinas';
  }

  if (nombre === 'centro') {
    return 'el centro';
  }

  if (nombre.startsWith('diagonal')) {
    return 'una diagonal';
  }

  const m = /^(fila|columna)(\d)$/.exec(nombre);

  return m
    ? `la ${m[1]} ${m[2]}`
    : nombre;
}

// Exportar las funciones para el servidor.
module.exports = {
  PATRONES,
  patronesCompletos,
  cartaQueFalta,
  describirPatron,
};
