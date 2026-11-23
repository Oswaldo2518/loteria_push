
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:loteria_push/dominio/almacen.dart';
import 'package:loteria_push/dominio/controlador.dart';
import 'package:loteria_push/presentacion/pantalla_juego.dart';
import 'package:loteria_push/presentacion/vms.dart';

import 'falsos.dart';

void main() {
  late ApiFalsa api;
  late PuertoPushFalso push;
  late ControladorPartida c;
  late JuegoVm vm;

  setUp(() {
    api = ApiFalsa();
    push = PuertoPushFalso();

    c = ControladorPartida(
      api: api,
      push: push,
      almacen: AlmacenMemoria(),
    );

    vm = JuegoVm(c);
  });

  Future<void> abrir(WidgetTester t) async {
    await t.runAsync(
      () => c.unirse(sala: 'ABCDE', nombre: 'Ana'),
    );

    await t.pumpWidget(
      MaterialApp(
        home: PantallaJuego(vm: vm),
      ),
    );
  }

  FilledButton boton(WidgetTester t) {
    return t.widget<FilledButton>(
      find.widgetWithText(
        FilledButton,
        '¡LOTERÍA!',
      ),
    );
  }

  testWidgets(
    'muestra la sala, la espera y el aviso sin push',
    (t) async {
      await abrir(t);

      expect(find.text('Sala ABCDE'), findsOneWidget);

      expect(
        find.text('Esperando la primera carta...'),
        findsOneWidget,
      );

      expect(
        find.textContaining('Sin avisos'),
        findsOneWidget,
      );

      expect(
        find.text('El Gallo'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'el botón LOTERÍA se activa al completar una fila',
    (t) async {
      await abrir(t);

      expect(boton(t).onPressed, isNull);

      api.cartasServidor.addAll([
        carta(1, 1),
        carta(2, 2),
        carta(3, 3),
        carta(4, 4),
      ]);

      await t.runAsync(c.sincronizar);
      await t.pump();

      expect(boton(t).onPressed, isNotNull);

      expect(
        find.textContaining('#4'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'cuando gana otro jugador se muestra el ganador',
    (t) async {
      await abrir(t);

      api
        ..cartasServidor.addAll([
          carta(1, 1),
          carta(2, 2),
          carta(3, 3),
          carta(4, 4),
        ])
        ..ganadorServidor = 'Beto'
        ..patronServidor = 'fila3';

      await t.runAsync(c.sincronizar);
      await t.pump();

      expect(
        find.textContaining('Beto ganó con la fila 3'),
        findsOneWidget,
      );

      expect(boton(t).onPressed, isNull);
    },
  );
}
