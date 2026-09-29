import * as Location from 'expo-location';

import {
  LOCATION_ERROR_CODES,
  createManualLocation,
  getCurrentLocation,
  requestLocationPermission
} from '../../services/locationService';
import { REPORT_MESSAGES } from '../../const/reportCatalogs';
import { CREEL_CENTER } from '../../const/creelPolygon';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  hasServicesEnabledAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn()
}));

const OUTSIDE_CREEL = { latitude: 28.6353, longitude: -106.0889 };

function positionAt(coords) {
  return { coords };
}

beforeEach(() => {
  jest.clearAllMocks();
  Location.hasServicesEnabledAsync.mockResolvedValue(true);
  Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
});

describe('requestLocationPermission', () => {
  it('concede el permiso cuando hay servicios y el usuario acepta', async () => {
    const result = await requestLocationPermission();

    expect(result).toEqual({ ok: true, granted: true, canAskAgain: true });
  });

  it('informa que la ubicacion del dispositivo esta desactivada sin pedir permiso', async () => {
    Location.hasServicesEnabledAsync.mockResolvedValue(false);

    const result = await requestLocationPermission();

    expect(result).toEqual({
      ok: false,
      code: LOCATION_ERROR_CODES.servicesOff,
      message: REPORT_MESSAGES.locationServicesOff
    });
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('distingue un rechazo todavia recuperable de uno permanente', async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    const recoverable = await requestLocationPermission();

    expect(recoverable.code).toBe(LOCATION_ERROR_CODES.permissionDenied);
    expect(recoverable.message).toBe(REPORT_MESSAGES.locationPermissionDenied);

    Location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    const blocked = await requestLocationPermission();

    expect(blocked.code).toBe(LOCATION_ERROR_CODES.permissionBlocked);
    expect(blocked.message).toBe(REPORT_MESSAGES.locationPermissionBlocked);
  });

  it('intenta el permiso aunque falle la comprobacion de servicios', async () => {
    Location.hasServicesEnabledAsync.mockRejectedValue(new Error('boom'));

    const result = await requestLocationPermission();

    expect(result.ok).toBe(true);
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  });

  it('reporta como no disponible si la peticion de permiso lanza', async () => {
    Location.requestForegroundPermissionsAsync.mockRejectedValue(new Error('boom'));

    const result = await requestLocationPermission();

    expect(result.code).toBe(LOCATION_ERROR_CODES.unavailable);
  });
});

describe('getCurrentLocation', () => {
  it('mapea la posicion al formato del borrador con fuente GPS', async () => {
    Location.getCurrentPositionAsync.mockResolvedValue(
      positionAt({ ...CREEL_CENTER, accuracy: 12.5 })
    );

    const result = await getCurrentLocation();

    expect(result).toEqual({
      ok: true,
      location: {
        latitude: CREEL_CENTER.latitude,
        longitude: CREEL_CENTER.longitude,
        source: 'GPS',
        accuracyMeters: 12.5
      }
    });
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({ accuracy: Location.Accuracy.High });
  });

  it('deja la precision en null cuando el sistema no la reporta', async () => {
    Location.getCurrentPositionAsync.mockResolvedValue(positionAt({ ...CREEL_CENTER, accuracy: null }));

    const result = await getCurrentLocation();

    expect(result.location.accuracyMeters).toBeNull();
    expect(result.ok).toBe(true);
  });

  it('rechaza una precision demasiado baja para el poligono de Creel', async () => {
    Location.getCurrentPositionAsync.mockResolvedValue(positionAt({ ...CREEL_CENTER, accuracy: 250 }));

    const result = await getCurrentLocation();

    expect(result.ok).toBe(false);
    expect(result.code).toBe(LOCATION_ERROR_CODES.tooImprecise);
    expect(result.message).toBe(REPORT_MESSAGES.locationTooImprecise);
    // La posicion se devuelve para que la pantalla pueda sugerir corregirla.
    expect(result.location.latitude).toBe(CREEL_CENTER.latitude);
  });

  it('acepta una precision limite y rechaza justo por encima', async () => {
    Location.getCurrentPositionAsync.mockResolvedValue(positionAt({ ...CREEL_CENTER, accuracy: 100 }));
    expect((await getCurrentLocation()).ok).toBe(true);

    Location.getCurrentPositionAsync.mockResolvedValue(positionAt({ ...CREEL_CENTER, accuracy: 100.1 }));
    expect((await getCurrentLocation()).code).toBe(LOCATION_ERROR_CODES.tooImprecise);
  });

  it('rechaza una posicion fuera de Creel', async () => {
    Location.getCurrentPositionAsync.mockResolvedValue(positionAt({ ...OUTSIDE_CREEL, accuracy: 8 }));

    const result = await getCurrentLocation();

    expect(result.ok).toBe(false);
    expect(result.code).toBe(LOCATION_ERROR_CODES.outsideCreel);
    expect(result.message).toBe(REPORT_MESSAGES.locationOutsideCreel);
  });

  it('descarta coordenadas invalidas en vez de propagarlas', async () => {
    Location.getCurrentPositionAsync.mockResolvedValue(positionAt({ latitude: 999, longitude: 10, accuracy: 5 }));

    const result = await getCurrentLocation();

    expect(result.code).toBe(LOCATION_ERROR_CODES.unavailable);
  });

  it('reporta como no disponible si la lectura lanza o viene incompleta', async () => {
    Location.getCurrentPositionAsync.mockRejectedValue(new Error('boom'));
    expect((await getCurrentLocation()).code).toBe(LOCATION_ERROR_CODES.unavailable);

    Location.getCurrentPositionAsync.mockResolvedValue(null);
    expect((await getCurrentLocation()).code).toBe(LOCATION_ERROR_CODES.unavailable);

    Location.getCurrentPositionAsync.mockResolvedValue({});
    expect((await getCurrentLocation()).code).toBe(LOCATION_ERROR_CODES.unavailable);
  });
});

describe('createManualLocation', () => {
  it('marca la ubicacion como MANUAL', () => {
    const location = createManualLocation(CREEL_CENTER.latitude, CREEL_CENTER.longitude, 5);

    expect(location).toEqual({
      latitude: CREEL_CENTER.latitude,
      longitude: CREEL_CENTER.longitude,
      source: 'MANUAL',
      accuracyMeters: 5
    });
  });
});
