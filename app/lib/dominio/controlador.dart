
import 'dart:async';

import 'almacen.dart';
import 'api_juego.dart';
import 'evento.dart';
import 'partida.dart';
import 'puerto_push.dart';
import 'sesion.dart';

class ControladorPartida {
  ControladorPartida({
    required this.api,
    required this.push,
    required this.almacen,
  });

  final ApiJuego api;
  final PuertoPush push;
  final Almacen almacen;

  static const _kSesion = 'sesion';

  Partida? partida;

  PermisoPush permiso = PermisoPush.sinPreguntar;

  bool avisosActivos = false;

  String? ultimoError;

  Sesion? _sesion;

  bool _sincronizando = false;

  final _cambios =
      StreamController<void>.broadcast();

  final List<StreamSubscription<Object?>> _subs = [];

  Stream<void> get cambios => _cambios.stream;

  void _notificar() {
    if (!_cambios.isClosed) {
      _cambios.add(null);
    }
  }

  Future<void> leerPermiso() async {
    permiso = await push.estadoPermiso();
    _notificar();
  }

  Future<PermisoPush> pedirPermisoAvisos() async {
    permiso = await push.pedirPermiso();
    _notificar();

    return permiso;
  }

  Future<void> unirse({
    required String sala,
    required String nombre,
  }) async {
    final id = sala.trim().toUpperCase();

    permiso = await push.estadoPermiso();

    final destino = permiso == PermisoPush.concedido
        ? await push.obtenerDestino()
        : null;

    final u = await api.unirse(
      id,
      nombre,
      destino,
    );

    final sesion = Sesion(
      sala: id,
      nombre: u.nombre,
      tabla: u.tabla,
      claveJugador: u.claveJugador,
    );

    await almacen.guardarTexto(
      _kSesion,
      sesion.aTexto(),
    );

    await _empezar(sesion);

    partida!.aplicarLote(u.cartas);

    _notificar();
  }

  Future<bool> restaurar() async {
    final sesion = Sesion.desdeTexto(
      await almacen.leerTexto(_kSesion),
    );

    if (sesion == null) {
      return false;
    }

    permiso = await push.estadoPermiso();

    await _empezar(sesion);

    final inicial = await push.mensajeInicial();

    if (inicial != null) {
      await _alRecibir(inicial);
    }

    await sincronizar();

    return true;
  }

  Future<void> _empezar(Sesion sesion) async {
    _sesion = sesion;

    partida = Partida(
      sala: sesion.sala,
      nombre: sesion.nombre,
      tabla: sesion.tabla,
    );

    avisosActivos =
        permiso == PermisoPush.concedido;

    if (avisosActivos) {
      await push.suscribirTema(
        'sala_${sesion.sala}',
      );
    }

    for (final s in _subs) {
      await s.cancel();
    }

    _subs
      ..clear()
      ..add(
        push.enPrimerPlano.listen(_alRecibir),
      )
      ..add(
        push.alAbrirDesdeNotificacion.listen(
          (m) async {
            await _alRecibir(m);
            await sincronizar();
          },
        ),
      )
      ..add(
        push.destinoCambiado.listen(
          _alCambiarDestino,
        ),
      );
  }

  Future<void> _alRecibir(MensajePush m) async {
    final p = partida;

    if (p == null) {
      return;
    }

    if (EventoJuego.salaDe(m.datos) != p.sala) {
      return;
    }

    final evento = EventoJuego.desdeDatos(
      m.datos,
    );

    if (evento == null) {
      return;
    }

    final r = p.aplicar(evento);

    if (r == ResultadoAplicar.hueco) {
      await sincronizar();
    }

    _notificar();
  }

  Future<void> sincronizar() async {
    final p = partida;

    if (p == null || _sincronizando) {
      return;
    }

    _sincronizando = true;

    try {
      final e = await api.estado(
        p.sala,
        p.ultima,
      );

      p.aplicarLote(e.cartas);

      if (e.ganador != null) {
        p.ganador = e.ganador;
        p.patronGanador = e.patron;
      }

      ultimoError = null;
    } on Object catch (err) {
      ultimoError = err is ErrorApi
          ? err.mensaje
          : 'Sin conexión con el cantor';
    } finally {
      _sincronizando = false;
      _notificar();
    }
  }

  Future<void> _alCambiarDestino(
    DestinoPush d,
  ) async {
    final s = _sesion;

    if (s == null) {
      return;
    }

    try {
      await api.actualizarDestino(
        s.sala,
        s.nombre,
        s.claveJugador,
        d,
      );
    } on Object {
      return;
    }
  }

  Future<ResultadoReclamo> reclamarLoteria() async {
    final p = partida!;
    final s = _sesion!;

    final r = await api.reclamar(
      p.sala,
      s.nombre,
      s.claveJugador,
    );

    if (r.gano) {
      p.ganador = s.nombre;
      p.patronGanador = r.patron;

      _notificar();
    }

    return r;
  }

  Future<void> salir() async {
    final p = partida;

    for (final s in _subs) {
      await s.cancel();
    }

    _subs.clear();

    if (p != null && avisosActivos) {
      await push.desuscribirTema(
        'sala_${p.sala}',
      );
    }

    await almacen.borrar(_kSesion);

    partida = null;
    _sesion = null;
    avisosActivos = false;

    _notificar();
  }

  Future<void> cerrar() async {
    for (final s in _subs) {
      await s.cancel();
    }

    _subs.clear();

    await _cambios.close();
  }
}
