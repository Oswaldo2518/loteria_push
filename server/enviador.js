
'use strict';

// Enviador simulado para trabajar sin Firebase.
// Los mensajes aparecen en la terminal.
function crearEnviadorConsola(log = console.log) {
  return {
    async enviar(mensaje) {
      log(
        '[push simulado]',
        JSON.stringify(mensaje),
      );

      return 'simulado';
    },
  };
}

// Enviador real mediante Firebase Admin SDK.
// Las credenciales deben permanecer en el servidor.
function crearEnviadorFcm({ dryRun = false } = {}) {
  // Firebase se importa únicamente cuando
  // se utiliza el enviador real.
  const admin = require('firebase-admin');

  admin.initializeApp();

  const messaging = admin.messaging();

  return {
    enviar: (mensaje) =>
      messaging.send(mensaje, dryRun),
  };
}

// Comprueba si un error indica que el
// destino de notificaciones dejó de existir.
function esDestinoMuerto(err) {
  const codigo = err && err.code;

  return (
    codigo ===
      'messaging/registration-token-not-registered' ||
    codigo ===
      'messaging/invalid-registration-token'
  );
}

module.exports = {
  crearEnviadorConsola,
  crearEnviadorFcm,
  esDestinoMuerto,
};
