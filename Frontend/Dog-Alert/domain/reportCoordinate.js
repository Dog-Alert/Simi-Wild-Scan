/**
 * Entrada manual de coordenadas del reporte.
 *
 * No todas las personas pueden compartir la ubicacion con el GPS: puede estar
 * denegado el permiso, no haber senal, o simplemente querer corregirse a mano.
 * Este modulo traduce el texto que escribe la persona a numeros; la regla de
 * negocio (que la coordenada sea real) ya vive en `isValidCoordinate`, y la de
 * que caiga dentro de Creel en `isPointInCreel`.
 *
 * Acepta coma o punto como separador decimal porque en Mexico la gente escribe
 * las coordenadas de las dos formas y el teclado del celular suele cambiar
 * segun el teclado del sistema.
 *
 * Historia: C2 - Movil - Formulario georreferenciado y limite de Creel.
 */

import { isValidCoordinate } from '../const/creelPolygon';

/**
 * Convierte lo que escribe la persona en un numero, o `null` si no es un
 * numero. Acepta coma o punto decimal y descarta espacios.
 *
 * Se parsea a mano y con `Number()` a proposito: `Number('')` es 0 y
 * `Number('12abc')` es NaN, asi que sin este filtro un campo vacio pasaria
 * como coordenada 0,0 (Golfo de Guinea) en lugar de fallar.
 */
export function parseCoordinateInput(text) {
  if (typeof text === 'number') {
    return Number.isFinite(text) ? text : null;
  }

  if (typeof text !== 'string') {
    return null;
  }

  const normalized = text.trim().replace(',', '.');

  if (normalized === '' || normalized === '-' || normalized === '.') {
    return null;
  }

  // Solo digitos, un separador decimal y el signo inicial.
  if (!/^-?\d*\.?\d*$/.test(normalized)) {
    return null;
  }

  const value = Number(normalized);

  return Number.isFinite(value) ? value : null;
}

/**
 * Une las dos entradas de latitud y longitud en una coordenada, o devuelve el
 * motivo por el que no se pudo para que la pantalla lo muestre.
 *
 * Devuelve `{ ok: true, latitude, longitude }` o
 * `{ ok: false, message }`.
 */
export function parseManualCoordinateInput(latitudeText, longitudeText) {
  const latitude = parseCoordinateInput(latitudeText);
  const longitude = parseCoordinateInput(longitudeText);

  if (latitude === null || longitude === null) {
    return {
      ok: false,
      message: 'Escribe la latitud y la longitud usando solo números.'
    };
  }

  if (!isValidCoordinate(latitude, longitude)) {
    return {
      ok: false,
      message: 'Coordenadas fuera de rango: latitud entre -90 y 90, longitud entre -180 y 180.'
    };
  }

  return { ok: true, latitude, longitude };
}
