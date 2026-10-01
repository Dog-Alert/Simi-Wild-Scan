/**
 * Servicio de ubicacion (parte 3 de C2).
 *
 * Envuelve `expo-location` para obtener la posicion del dispositivo y
 * devolverla en el formato del borrador del reporte, sin know-how de UI y sin
 * React. La pantalla decide que mostrar.
 *
 * Privacidad: no se registra en consola la posicion obtenida. RF-006 pide
 * ubicacion precisa, pero solo mientras se captura el reporte: aqui no se
 * suscribe a `watchPositionAsync` ni se inicia ningun rastreo en segundo plano,
 * solo una lectura puntual con `getCurrentPositionAsync`.
 *
 * Historia: C2 - Movil - Formulario georreferenciado y limite de Creel.
 */

import * as Location from 'expo-location';

import { REPORT_MESSAGES } from '../const/reportCatalogs';
import { isPointInCreel, isValidCoordinate } from '../const/creelPolygon';

export const LOCATION_ERROR_CODES = {
  servicesOff: 'LOCATION_SERVICES_OFF',
  permissionDenied: 'LOCATION_PERMISSION_DENIED',
  permissionBlocked: 'LOCATION_PERMISSION_BLOCKED',
  unavailable: 'LOCATION_UNAVAILABLE',
  tooImprecise: 'LOCATION_TOO_IMPRECISE',
  outsideCreel: 'LOCATION_OUTSIDE_CREEL',
};

/**
 * Radio maximo aceptable del punto obtenido. Por encima de esto el reporte
 * quedaria anclado a un punto que podria caer en la calle equivocada, y como la
 * app valida contra un poligono pequeno, un error de 200 m ya puede sacar el
 * punto de Creel.
 */
const MAX_ACCEPTABLE_ACCURACY_METERS = 100;

/**
 * Pide permiso de ubicacion en primer plano.
 *
 * Distingue tres casos porque la accion de la UI es distinta en cada uno:
 * el usuario todavia puede decidir (`canAskAgain`), o ya lo rechazo de forma
 * permanente y hay que mandarlo a los ajustes.
 */
export async function requestLocationPermission() {
  try {
    const servicesEnabled = await Location.hasServicesEnabledAsync();

    if (!servicesEnabled) {
      return { ok: false, code: LOCATION_ERROR_CODES.servicesOff, message: REPORT_MESSAGES.locationServicesOff };
    }
  } catch {
    // Si no se puede consultar el estado, se intenta el permiso: es preferible
    // pedirlo que bloquear al usuario por una comprobacion que fallo.
  }

  try {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.granted) {
      return { ok: true, granted: true, canAskAgain: true };
    }

    if (permission.canAskAgain) {
      return {
        ok: false,
        code: LOCATION_ERROR_CODES.permissionDenied,
        message: REPORT_MESSAGES.locationPermissionDenied
      };
    }

    return {
      ok: false,
      code: LOCATION_ERROR_CODES.permissionBlocked,
      message: REPORT_MESSAGES.locationPermissionBlocked
    };
  } catch {
    return {
      ok: false,
      code: LOCATION_ERROR_CODES.unavailable,
      message: REPORT_MESSAGES.locationUnavailable
    };
  }
}

/**
 * Convierte un `LocationObject` de expo-location al formato del borrador.
 * `accuracy` puede venir `null` (por ejemplo en web).
 */
function toDraftLocation(position) {
  const { latitude, longitude, accuracy } = position.coords;

  return {
    latitude,
    longitude,
    source: 'GPS',
    accuracyMeters: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null
  };
}

/**
 * Lee la posicion actual del dispositivo.
 *
 * Devuelve `{ ok: true, location }` o `{ ok: false, code, message }`. No lanza
 * excepcion: el permiso ya se resolvio con `requestLocationPermission` y un
 * fallo aqui es un estado esperado que la UI debe poder mostrar.
 */
export async function getCurrentLocation() {
  let position;

  try {
    position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch {
    return {
      ok: false,
      code: LOCATION_ERROR_CODES.unavailable,
      message: REPORT_MESSAGES.locationUnavailable
    };
  }

  if (!position || !position.coords) {
    return {
      ok: false,
      code: LOCATION_ERROR_CODES.unavailable,
      message: REPORT_MESSAGES.locationUnavailable
    };
  }

  const location = toDraftLocation(position);

  if (!isValidCoordinate(location.latitude, location.longitude)) {
    return {
      ok: false,
      code: LOCATION_ERROR_CODES.unavailable,
      message: REPORT_MESSAGES.locationUnavailable
    };
  }

  if (location.accuracyMeters !== null && location.accuracyMeters > MAX_ACCEPTABLE_ACCURACY_METERS) {
    return {
      ok: false,
      code: LOCATION_ERROR_CODES.tooImprecise,
      message: REPORT_MESSAGES.locationTooImprecise,
      location
    };
  }

  if (!isPointInCreel(location.latitude, location.longitude)) {
    return {
      ok: false,
      code: LOCATION_ERROR_CODES.outsideCreel,
      message: REPORT_MESSAGES.locationOutsideCreel,
      location
    };
  }

  return { ok: true, location };
}

/**
 * Ubicacion elegida a mano por el usuario. Se marca `MANUAL` porque el
 * contrato no distingue un arrastre en el mapa de una correccion sobre el GPS.
 */
export function createManualLocation(latitude, longitude, accuracyMeters = null) {
  return {
    latitude,
    longitude,
    source: 'MANUAL',
    accuracyMeters
  };
}
