
import 'package:shared_preferences/shared_preferences.dart';

import '../dominio/almacen.dart';

class AlmacenPrefs implements Almacen {
  AlmacenPrefs(this._p);

  final SharedPreferences _p;

  @override
  Future<String?> leerTexto(String clave) async {
    return _p.getString(clave);
  }

  @override
  Future<void> guardarTexto(
    String clave,
    String valor,
  ) async {
    await _p.setString(clave, valor);
  }

  @override
  Future<void> borrar(String clave) async {
    await _p.remove(clave);
  }
}
