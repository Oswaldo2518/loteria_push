
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'dominio/controlador.dart';
import 'firebase_options.dart';
import 'infra/almacen_prefs.dart';
import 'infra/api_http.dart';
import 'infra/canales_android.dart';
import 'infra/fondo.dart';
import 'infra/puerto_fcm.dart';
import 'presentacion/vms.dart';

const String urlServidor = String.fromEnvironment(
  'SERVIDOR',
  defaultValue: 'http://10.0.2.2:8080',
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  FirebaseMessaging.onBackgroundMessage(
    manejadorSegundoPlano,
  );

  await FirebaseMessaging.instance
      .setForegroundNotificationPresentationOptions(
    alert: false,
    badge: false,
    sound: false,
  );

  await crearCanalesAndroid();

  final api = ApiHttp(urlServidor);

  final almacen = AlmacenPrefs(
    await SharedPreferences.getInstance(),
  );

  final controlador = ControladorPartida(
    api: api,
    push: PuertoFcm(),
    almacen: almacen,
  );

  runApp(
    AppLoteria(
      vm: JuegoVm(controlador),
      crearCantor: () => CantorVm(api),
    ),
  );
}
