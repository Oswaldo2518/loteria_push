
/// Los datos recibidos por push no se consideran
/// confiables hasta comprobar su contenido.
sealed class EventoJuego {
  const EventoJuego(this.n);

  final int n;

  // Normalizar el código de sala.
  static String? salaDe(Map<String, Object?> datos) {
    final s = datos['sala'];

    return (s is String &&
            s.isNotEmpty &&
            s.length <= 8)
        ? s.toUpperCase()
        : null;
  }

  // Convertir los datos recibidos en un evento.
  static EventoJuego? desdeDatos(
    Map<String, Object?> datos,
  ) {
    final tipo = datos['tipo'];

    final n = _entero(
      datos['n'],
      min: 1,
      max: 54,
    );

    if (tipo is! String || n == null) {
      return null;
    }

    switch (tipo) {
      case 'carta':
        final id = _entero(
          datos['cartaId'],
          min: 1,
          max: 54,
        );

        final nombre = _texto(datos['nombre']);

        final pista = _texto(
          datos['pista'],
          max: 200,
        );

        if (id == null ||
            nombre == null ||
            pista == null) {
          return null;
        }

        return CartaCantada(
          n: n,
          cartaId: id,
          nombre: nombre,
          pista: pista,
        );

      case 'loteria':
        final ganador = _texto(
          datos['ganador'],
          max: 20,
        );

        final patron = _texto(
          datos['patron'],
          max: 20,
        );

        if (ganador == null || patron == null) {
          return null;
        }

        return LoteriaCantada(
          n: n,
          ganador: ganador,
          patron: patron,
        );

      case 'casi':
        final id = _entero(
          datos['cartaId'],
          min: 1,
          max: 54,
        );

        if (id == null) {
          return null;
        }

        return CasiGanas(
          n: n,
          cartaId: id,
        );

      default:
        // Los tipos desconocidos se ignoran.
        return null;
    }
  }

  // Aceptar números enteros o números en texto.
  static int? _entero(
    Object? valor, {
    required int min,
    required int max,
  }) {
    final x = valor is int
        ? valor
        : int.tryParse('$valor');

    return (x != null && x >= min && x <= max)
        ? x
        : null;
  }

  // Validar textos recibidos.
  static String? _texto(
    Object? valor, {
    int max = 120,
  }) {
    if (valor is! String) {
      return null;
    }

    final texto = valor.trim();

    return (texto.isNotEmpty && texto.length <= max)
        ? texto
        : null;
  }
}

// Evento de una carta cantada.
final class CartaCantada extends EventoJuego {
  const CartaCantada({
    required int n,
    required this.cartaId,
    required this.nombre,
    required this.pista,
  }) : super(n);

  final int cartaId;
  final String nombre;
  final String pista;

  factory CartaCantada.desdeJson(
    Map<String, dynamic> json,
  ) {
    return CartaCantada(
      n: json['n'] as int,
      cartaId: json['cartaId'] as int,
      nombre: json['nombre'] as String,
      pista: json['pista'] as String,
    );
  }
}

// Evento que anuncia a un ganador.
final class LoteriaCantada extends EventoJuego {
  const LoteriaCantada({
    required int n,
    required this.ganador,
    required this.patron,
  }) : super(n);

  final String ganador;
  final String patron;
}

// Aviso personal de "¡Casi!".
final class CasiGanas extends EventoJuego {
  const CasiGanas({
    required int n,
    required this.cartaId,
  }) : super(n);

  final int cartaId;
}
