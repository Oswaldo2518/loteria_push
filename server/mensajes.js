
'use strict';

const { describirPatron } = require('./lineas');

// Constructores de mensajes para Firebase.
// No envían mensajes: solamente los preparan.

// Límite máximo de tamaño del mensaje.
const LIMITE_BYTES = 4096;

// Tiempo de vida de cada notificación.
const TTL_CARTA_MS = 60 * 1000;
const TTL_CASI_MS = 5 * 60 * 1000;
const TTL_FIN_MS = 60 * 60 * 1000;

// Convierte todos los valores a cadenas.
function aTexto(datos) {
  return Object.fromEntries(
    Object.entries(datos).map(
      ([k, v]) => [k, String(v)],
    ),
  );
}

// Genera el tema de una sala.
function tema(sala) {
  return `sala_${sala}`;
}

// Comprueba que el mensaje no exceda 4 KB.
function comprobarTamano(mensaje) {
  const bytes = Buffer.byteLength(
    JSON.stringify(mensaje),
    'utf8',
  );

  if (bytes > LIMITE_BYTES) {
    throw new Error(
      `Mensaje de ${bytes} bytes excede ${LIMITE_BYTES}`,
    );
  }

  return mensaje;
}

// Calcula cuándo caduca un mensaje.
// APNs utiliza segundos Unix.
function caduca(ahoraMs, ttlMs) {
  return String(
    Math.floor(
      (ahoraMs + ttlMs) / 1000,
    ),
  );
}

// 1. MENSAJE DE CARTA CANTADA.
// Se dirige a todos los jugadores de la sala.
function mensajeCarta(ev, ahoraMs) {
  const colapso = `carta_${ev.sala}`;

  return comprobarTamano({
    topic: tema(ev.sala),

    notification: {
      title: ` ${ev.nombre}`,
      body: ev.pista,
    },

    data: aTexto({
      tipo: 'carta',
      sala: ev.sala,
      n: ev.n,
      cartaId: ev.cartaId,
      nombre: ev.nombre,
      pista: ev.pista,
    }),

    android: {
      priority: 'high',
      ttl: TTL_CARTA_MS,
      collapseKey: colapso,

      notification: {
        channelId: 'cartas',
        tag: colapso,
      },
    },

    apns: {
      headers: {
        'apns-priority': '10',
        'apns-collapse-id': colapso,
        'apns-expiration': caduca(
          ahoraMs,
          TTL_CARTA_MS,
        ),
      },

      payload: {
        aps: {
          sound: 'default',
          'thread-id': tema(ev.sala),
        },
      },
    },
  });
}

// 2. MENSAJE DE "¡CASI!".
// Se dirige personalmente a un jugador.
function mensajeCasi(ev, ahoraMs) {
  const colapso = `casi_${ev.sala}`;

  return comprobarTamano({
    notification: {
      title: '¡Casi! ',
      body:
        'Estás a UNA carta de cantar Lotería. ¡Atento!',
    },

    data: aTexto({
      tipo: 'casi',
      sala: ev.sala,
      n: ev.n,
      cartaId: ev.cartaId,
    }),

    android: {
      priority: 'high',
      ttl: TTL_CASI_MS,
      collapseKey: colapso,

      notification: {
        channelId: 'momentos',
        tag: colapso,
      },
    },

    apns: {
      headers: {
        'apns-priority': '10',
        'apns-collapse-id': colapso,
        'apns-expiration': caduca(
          ahoraMs,
          TTL_CASI_MS,
        ),
      },

      payload: {
        aps: {
          sound: 'default',
          'thread-id': tema(ev.sala),
        },
      },
    },
  });
}

// 3. MENSAJE DE LOTERÍA.
// Informa a todos los jugadores quién ganó.
function mensajeLoteria(ev, ahoraMs) {
  const colapso = `fin_${ev.sala}`;

  return comprobarTamano({
    topic: tema(ev.sala),

    notification: {
      title: ' ¡LOTERÍA!',
      body:
        `${ev.ganador} ganó con ` +
        `${describirPatron(ev.patron)}. ¡Felicidades!`,
    },

    data: aTexto({
      tipo: 'loteria',
      sala: ev.sala,
      n: ev.n,
      ganador: ev.ganador,
      patron: ev.patron,
    }),

    android: {
      priority: 'high',
      ttl: TTL_FIN_MS,
      collapseKey: colapso,

      notification: {
        channelId: 'momentos',
        tag: colapso,
      },
    },

    apns: {
      headers: {
        'apns-priority': '10',
        'apns-collapse-id': colapso,
        'apns-expiration': caduca(
          ahoraMs,
          TTL_FIN_MS,
        ),
      },

      payload: {
        aps: {
          sound: 'default',
          'thread-id': tema(ev.sala),
        },
      },
    },
  });
}

// Cambia un mensaje dirigido al tema
// para dirigirlo a un dispositivo específico.
function haciaDestino(mensaje, destino) {
  const base = { ...mensaje };

  // El mensaje personal no lleva tema.
  delete base.topic;

  if (destino.tipo === 'fid') {
    return {
      ...base,
      fid: destino.valor,
    };
  }

  return {
    ...base,
    token: destino.valor,
  };
}

// Exportar las funciones y constantes.
module.exports = {
  tema,
  aTexto,
  mensajeCarta,
  mensajeCasi,
  mensajeLoteria,
  haciaDestino,
  TTL_CARTA_MS,
  TTL_CASI_MS,
  TTL_FIN_MS,
  LIMITE_BYTES,
};
