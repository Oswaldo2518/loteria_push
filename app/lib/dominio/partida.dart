
import 'evento.dart';
import 'lineas.dart';


enum ResultadoAplicar {
  aplicado,
  duplicado,
  hueco,
  informativo,
}


class Partida {
  Partida({
    required this.sala,
    required this.nombre,
    required this.tabla,
  });

  final String sala;
  final String nombre;
  final List<int> tabla;

  
  final List<CartaCantada> _cantadas = [];


  String? ganador;
  String? patronGanador;


  bool casi = false;
  int? cartaQueFalta;


  List<CartaCantada> get cantadas =>
      List.unmodifiable(_cantadas);


  int get ultima => _cantadas.length;


  Set<int> get idsCantados => {
        for (final c in _cantadas) c.cartaId,
      };


  CartaCantada? get ultimaCarta =>
      _cantadas.isEmpty
          ? null
          : _cantadas.last;

 
  bool estaMarcada(int cartaId) =>
      idsCantados.contains(cartaId);

  
  List<String> get patrones =>
      patronesCompletos(
        tabla,
        idsCantados,
      );

  
  bool get puedeCantarLoteria =>
      ganador == null &&
      patrones.isNotEmpty;

 
  ResultadoAplicar aplicar(EventoJuego evento) {
    switch (evento) {
      case CartaCantada c:
        
        if (c.n <= ultima) {
          return ResultadoAplicar.duplicado;
        }

        // Si faltan cartas anteriores,
        // no se aplica la adelantada.
        if (c.n > ultima + 1) {
          return ResultadoAplicar.hueco;
        }

        // La carta está en orden.
        _cantadas.add(c);

        return ResultadoAplicar.aplicado;

      case LoteriaCantada l:
        // Comprobar si ya conocíamos al ganador.
        final yaEstaba = ganador == l.ganador;

        ganador = l.ganador;
        patronGanador = l.patron;

        return yaEstaba
            ? ResultadoAplicar.duplicado
            : ResultadoAplicar.aplicado;

      case CasiGanas c:
        // Solo mostrar información.
        casi = true;
        cartaQueFalta = c.cartaId;

        return ResultadoAplicar.informativo;
    }
  }

  // Aplicar varias cartas recibidas
  // desde el servidor.
  void aplicarLote(List<CartaCantada> cartas) {
    // Ordenar las cartas por su número.
    final ordenadas = [...cartas]
      ..sort((a, b) => a.n.compareTo(b.n));

    for (final carta in ordenadas) {
      final resultado = aplicar(carta);

      // No continuar si faltan cartas previas.
      if (resultado == ResultadoAplicar.hueco) {
        break;
      }
    }
  }
}
