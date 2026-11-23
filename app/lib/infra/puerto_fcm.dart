
import 'package:firebase_messaging/firebase_messaging.dart';

import '../dominio/api_juego.dart';
import '../dominio/puerto_push.dart';

class PuertoFcm implements PuertoPush {
  PuertoFcm() : _fcm = FirebaseMessaging.instance;

  final FirebaseMessaging _fcm;

  
PermisoPush _mapear(AuthorizationStatus s) {
  return switch (s) {
    AuthorizationStatus.authorized ||
    AuthorizationStatus.provisional =>
      PermisoPush.concedido,

    AuthorizationStatus.denied ||
    AuthorizationStatus.deniedPermanently =>
      PermisoPush.denegado,

    AuthorizationStatus.notDetermined =>
      PermisoPush.sinPreguntar,
  };
}


  MensajePush _aMensaje(RemoteMessage m) {
    return MensajePush(
      datos: Map<String, Object?>.from(m.data),
      titulo: m.notification?.title,
      cuerpo: m.notification?.body,
    );
  }

  @override
  Future<PermisoPush> estadoPermiso() async {
    final settings = await _fcm.getNotificationSettings();

    return _mapear(settings.authorizationStatus);
  }

  @override
  Future<PermisoPush> pedirPermiso() async {
    final settings = await _fcm.requestPermission(
      alert: true,
      badge: false,
      sound: true,
    );

    return _mapear(settings.authorizationStatus);
  }

  @override
  Future<DestinoPush?> obtenerDestino() async {
    final token = await _fcm.getToken();

    return token == null
        ? null
        : DestinoPush('token', token);
  }

  @override
  Stream<DestinoPush> get destinoCambiado {
    return _fcm.onTokenRefresh.map(
      (token) => DestinoPush('token', token),
    );
  }

  @override
  Stream<MensajePush> get enPrimerPlano {
    return FirebaseMessaging.onMessage.map(_aMensaje);
  }

  @override
  Stream<MensajePush> get alAbrirDesdeNotificacion {
    return FirebaseMessaging.onMessageOpenedApp.map(
      _aMensaje,
    );
  }

  @override
  Future<MensajePush?> mensajeInicial() async {
    final mensaje = await _fcm.getInitialMessage();

    return mensaje == null
        ? null
        : _aMensaje(mensaje);
  }

  @override
  Future<void> suscribirTema(String tema) {
    return _fcm.subscribeToTopic(tema);
  }

  @override
  Future<void> desuscribirTema(String tema) {
    return _fcm.unsubscribeFromTopic(tema);
  }
}
