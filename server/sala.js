
'use strict';

const crypto = require('node:crypto');

const {
  barajar,
  generarTabla,
  cartaPorId,
} = require('./baraja');

const {
  patronesCompletos,
  cartaQueFalta,
} = require('./lineas');

// Error con código y estado HTTP.
class ErrorJuego extends Error {
  constructor(codigo, mensaje, estado = 400) {
    super(mensaje);
    this.codigo = codigo;
    this.estado = estado;
  }
}

// Límites de las partidas.
const MAX_JUGADORES = 30;
const MAX_SALAS = 200;
const INTERVALO_MIN_CANTO_MS = 2000;

// Caracteres permitidos para los códigos de sala.
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Fuente de valores seguros para partidas reales.
const fuenteSegura = {
  semilla: () => crypto.randomInt(0, 2 ** 31),

  clave: () =>
    crypto.randomBytes(16).toString('hex'),

  codigoSala: () =>
    Array.from(
      { length: 5 },
      () => ALFABETO[
        crypto.randomInt(ALFABETO.length)
      ],
    ).join(''),
};

// Comparar claves sin revelar diferencias
// mediante el tiempo de comparación.
function iguales(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));

  return (
    x.length === y.length &&
    crypto.timingSafeEqual(x, y)
  );
}

// Validar nombres de jugadores.
function validarNombre(nombre) {
  if (typeof nombre !== 'string') {
    throw new ErrorJuego(
      'NOMBRE_INVALIDO',
      'El nombre es obligatorio',
    );
  }

  const limpio = nombre.trim();

  if (!/^[\p{L}\p{N} ._-]{1,20}$/u.test(limpio)) {
    throw new ErrorJuego(
      'NOMBRE_INVALIDO',
      'El nombre debe tener de 1 a 20 caracteres válidos',
    );
  }

  return limpio;
}

// Validar el destino de las notificaciones.
function validarDestino(destino) {
  // Se permite jugar sin notificaciones.
  if (destino === null || destino === undefined) {
    return null;
  }

  const ok =
    typeof destino === 'object' &&
    (destino.tipo === 'token' ||
      destino.tipo === 'fid') &&
    typeof destino.valor === 'string' &&
    destino.valor.length >= 20 &&
    destino.valor.length <= 4096;

  if (!ok) {
    throw new ErrorJuego(
      'DESTINO_INVALIDO',
      'El destino de notificaciones no es válido',
    );
  }

  return {
    tipo: destino.tipo,
    valor: destino.valor,
  };
}

// Representa una partida de Lotería.
class Sala {
  constructor({
    id,
    claveCantor,
    semilla,
    fuente = fuenteSegura,
  }) {
    this.id = id;
    this.claveCantor = claveCantor;
    this.fuente = fuente;

    // El mazo completo es secreto.
    this._mazo = barajar(semilla);

    // Historial de cartas cantadas.
    this.cantadas = [];

    // Jugadores de la sala.
    this.jugadores = new Map();

    // Resultado de la partida.
    this.ganador = null;
    this.patron = null;

    this._ultimoCantoMs = -Infinity;
  }

  // Cantidad de cartas que ya fueron cantadas.
  get ultima() {
    return this.cantadas.length;
  }

  // Obtener copias de las cartas desde
  // una posición determinada.
  _cartasDesde(desde) {
    return this.cantadas
      .slice(Math.max(0, desde))
      .map((c) => ({ ...c }));
  }

  // Registrar a un nuevo jugador.
  unir(nombre, destino) {
    const limpio = validarNombre(nombre);
    const dest = validarDestino(destino);

    if (this.jugadores.has(limpio)) {
      throw new ErrorJuego(
        'NOMBRE_OCUPADO',
        'Ya hay alguien con ese nombre',
        409,
      );
    }

    if (this.jugadores.size >= MAX_JUGADORES) {
      throw new ErrorJuego(
        'SALA_LLENA',
        'La sala está llena',
        409,
      );
    }

    const claveJugador = this.fuente.clave();

    const tabla = generarTabla(
      this.fuente.semilla(),
    );

    this.jugadores.set(limpio, {
      nombre: limpio,
      tabla,
      claveJugador,
      destino: dest,
      avisadoCasi: false,
    });

    return {
      nombre: limpio,
      tabla,
      claveJugador,
      ultima: this.ultima,
      cartas: this._cartasDesde(0),
    };
  }

  // Comprobar que el jugador tenga
  // las credenciales correctas.
  _jugador(nombre, clave) {
    const j = this.jugadores.get(nombre);

    if (
      !j ||
      !iguales(
        j.claveJugador,
        clave ?? '',
      )
    ) {
      throw new ErrorJuego(
        'NO_AUTORIZADO',
        'Credenciales inválidas',
        403,
      );
    }

    return j;
  }

  // Actualizar el token o FID del jugador.
  actualizarDestino(nombre, clave, destino) {
    const j = this._jugador(nombre, clave);

    j.destino = validarDestino(destino);
  }

  // Eliminar el destino de notificaciones.
  quitarDestino(nombre) {
    const j = this.jugadores.get(nombre);

    if (j) {
      j.destino = null;
    }
  }

  // Comprobar la clave del cantor.
  verificarCantor(clave) {
    if (!iguales(this.claveCantor, clave ?? '')) {
      throw new ErrorJuego(
        'NO_AUTORIZADO',
        'Solo el cantor puede hacer eso',
        403,
      );
    }
  }

  // Cantar la siguiente carta de la baraja.
  cantar(ahoraMs) {
    // No permitir continuar después de ganar.
    if (this.ganador) {
      throw new ErrorJuego(
        'SALA_TERMINADA',
        'La partida ya terminó',
        409,
      );
    }

    // Comprobar que todavía existan cartas.
    if (this.ultima >= this._mazo.length) {
      throw new ErrorJuego(
        'SIN_CARTAS',
        'Ya se cantaron todas las cartas',
        409,
      );
    }

    // Evitar que el cantor envíe cartas
    // demasiado rápido.
    if (
      ahoraMs - this._ultimoCantoMs <
      INTERVALO_MIN_CANTO_MS
    ) {
      throw new ErrorJuego(
        'MUY_RAPIDO',
        'Canta más despacio',
        429,
      );
    }

    this._ultimoCantoMs = ahoraMs;

    // Obtener la siguiente carta secreta.
    const carta = cartaPorId(
      this._mazo[this.ultima],
    );

    // Registrar la carta cantada.
    this.cantadas.push({
      n: this.ultima + 1,
      cartaId: carta.id,
      nombre: carta.nombre,
      pista: carta.pista,
    });

    // Crear el evento de carta.
    const evento = {
      tipo: 'carta',
      sala: this.id,
      n: this.ultima,
      cartaId: carta.id,
      nombre: carta.nombre,
      pista: carta.pista,
    };

    const ids = new Set(
      this.cantadas.map((c) => c.cartaId),
    );

    // Buscar jugadores a una carta de ganar.
    const casi = [];

    for (const j of this.jugadores.values()) {
      // No avisar dos veces al mismo jugador.
      if (j.avisadoCasi) {
        continue;
      }

      const falta = cartaQueFalta(
        j.tabla,
        ids,
      );

      if (falta !== null) {
        j.avisadoCasi = true;

        // Solo preparar el aviso si el jugador
        // tiene un destino de notificaciones.
        if (j.destino) {
          casi.push({
            jugador: j.nombre,
            destino: j.destino,
            evento: {
              tipo: 'casi',
              sala: this.id,
              n: this.ultima,
              cartaId: falta,
            },
          });
        }
      }
    }

    return {
      evento,
      casi,
    };
  }

  // Reclamar Lotería.
  // El servidor verifica si realmente ganó.
  reclamar(nombre, clave) {
    const j = this._jugador(nombre, clave);

    if (this.ganador) {
      throw new ErrorJuego(
        'YA_HAY_GANADOR',
        `${this.ganador} ya cantó Lotería`,
        409,
      );
    }

    const ids = new Set(
      this.cantadas.map((c) => c.cartaId),
    );

    const patrones = patronesCompletos(
      j.tabla,
      ids,
    );

    // Si todavía no tiene una línea completa,
    // el jugador no gana.
    if (patrones.length === 0) {
      return {
        gano: false,
        evento: null,
      };
    }

    // Registrar al ganador.
    this.ganador = j.nombre;
    this.patron = patrones[0];

    return {
      gano: true,
      patron: this.patron,
      evento: {
        tipo: 'loteria',
        sala: this.id,
        n: this.ultima,
        ganador: j.nombre,
        patron: this.patron,
      },
    };
  }

  // Consultar el estado público de la sala.
  // No se expone el mazo secreto.
  estado(desde = 0) {
    return {
      sala: this.id,
      ultima: this.ultima,
      cartas: this._cartasDesde(desde),
      ganador: this.ganador,
      patron: this.patron,
    };
  }
}

// Administrador de múltiples salas.
class Salas {
  constructor({ fuente = fuenteSegura } = {}) {
    this.fuente = fuente;
    this._salas = new Map();
  }

  // Crear una sala nueva.
  crear() {
    if (this._salas.size >= MAX_SALAS) {
      throw new ErrorJuego(
        'SERVIDOR_LLENO',
        'Demasiadas salas activas',
        503,
      );
    }

    let id;

    // Garantizar que el código no se repita.
    do {
      id = this.fuente.codigoSala();
    } while (this._salas.has(id));

    const sala = new Sala({
      id,
      claveCantor: this.fuente.clave(),
      semilla: this.fuente.semilla(),
      fuente: this.fuente,
    });

    this._salas.set(id, sala);

    return sala;
  }

  // Buscar una sala por su código.
  obtener(id) {
    const sala = this._salas.get(
      String(id).toUpperCase(),
    );

    if (!sala) {
      throw new ErrorJuego(
        'SALA_NO_EXISTE',
        'No existe esa sala',
        404,
      );
    }

    return sala;
  }
}

module.exports = {
  Sala,
  Salas,
  ErrorJuego,
  fuenteSegura,
  MAX_JUGADORES,
  INTERVALO_MIN_CANTO_MS,
};
