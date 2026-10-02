import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import FotoYUbiScreen from '../../screens/FotoYUbiScreen';
import { createEmptyReportDraft } from '../../domain/reportValidation';
import { CREEL_CENTER } from '../../const/creelPolygon';
import * as locationService from '../../services/locationService';
import * as photoService from '../../services/photoService';

jest.mock('../../services/locationService', () => ({
  requestLocationPermission: jest.fn(),
  getCurrentLocation: jest.fn(),
  createManualLocation: jest.fn((latitude, longitude, accuracyMeters = null) => ({
    latitude,
    longitude,
    source: 'MANUAL',
    accuracyMeters,
  }))
}));

jest.mock('../../services/photoService', () => ({
  PHOTO_ERROR_CODES: { cancelled: 'PHOTO_CANCELLED' },
  takeReportPhoto: jest.fn(),
  pickReportPhoto: jest.fn()
}));

const PHOTO = {
  uri: 'file://foto.jpg',
  width: 1000,
  height: 750,
  fileName: 'reporte.jpeg',
  mimeType: 'image/jpeg',
  fileSize: 500 * 1024
};

function renderScreen(overrides = {}) {
  const props = {
    draft: createEmptyReportDraft(),
    onChange: jest.fn(),
    onNext: jest.fn(),
    onBack: jest.fn(),
    ...overrides
  };

  return { ...render(<FotoYUbiScreen {...props} />), props };
}

beforeEach(() => {
  jest.clearAllMocks();
  locationService.requestLocationPermission.mockResolvedValue({ ok: true });
  locationService.getCurrentLocation.mockResolvedValue({
    ok: true,
    location: { ...CREEL_CENTER, source: 'GPS', accuracyMeters: 12 }
  });
  photoService.takeReportPhoto.mockResolvedValue({ ok: true, photo: PHOTO, exifLocation: null });
  photoService.pickReportPhoto.mockResolvedValue({ ok: true, photo: PHOTO, exifLocation: null });
});

describe('FotoYUbiScreen', () => {
  it('muestra el paso 1 activo, el paso 2 pendiente y el estado vacio de la foto', () => {
    const { getByText } = renderScreen();

    expect(getByText('Nuevo reporte')).toBeTruthy();
    expect(getByText('Toma o selecciona una foto')).toBeTruthy();
    expect(getByText('Sin ubicación')).toBeTruthy();
    expect(getByText('Abrir cámara')).toBeTruthy();
    expect(getByText('Seleccionar foto')).toBeTruthy();
  });

  it('captura la ubicacion con el GPS y la guarda en el borrador', async () => {
    const { props, getByText } = renderScreen();

    fireEvent.press(getByText('Compartir mi ubicación actual'));

    await waitFor(() => {
      expect(locationService.getCurrentLocation).toHaveBeenCalled();
    });

    expect(props.onChange).toHaveBeenCalledWith({
      location: { ...CREEL_CENTER, source: 'GPS', accuracyMeters: 12 },
      locationDerivedFromPhoto: false
    });
  });

  it('muestra el error cuando el permiso de ubicacion se deniega', async () => {
    locationService.requestLocationPermission.mockResolvedValue({
      ok: false,
      code: 'LOCATION_PERMISSION_DENIED',
      message: 'Permiso denegado'
    });

    const { getByText, queryByText } = renderScreen();

    fireEvent.press(getByText('Compartir mi ubicación actual'));

    await waitFor(() => {
      expect(getByText('Permiso denegado')).toBeTruthy();
    });

    expect(queryByText('Sin ubicación')).toBeTruthy();
  });

  it('muestra el error cuando la ubicacion queda fuera de Creel', async () => {
    locationService.getCurrentLocation.mockResolvedValue({
      ok: false,
      code: 'LOCATION_OUTSIDE_CREEL',
      message: 'Fuera de Creel'
    });

    const { getByText } = renderScreen();

    fireEvent.press(getByText('Compartir mi ubicación actual'));

    await waitFor(() => {
      expect(getByText('Fuera de Creel')).toBeTruthy();
    });
  });

  it('adjunta la foto tomada con la camara', async () => {
    const { props, getByText } = renderScreen();

    fireEvent.press(getByText('Abrir cámara'));

    await waitFor(() => {
      expect(props.onChange).toHaveBeenCalledWith({ photo: PHOTO });
    });
  });

  it('adjunta la foto elegida de la galeria', async () => {
    const { props, getByText } = renderScreen();

    fireEvent.press(getByText('Seleccionar foto'));

    await waitFor(() => {
      expect(props.onChange).toHaveBeenCalledWith({ photo: PHOTO });
    });
  });

  it('no molesta cuando la persona cierra la camara sin elegir foto', async () => {
    photoService.takeReportPhoto.mockResolvedValue({
      ok: false,
      code: 'PHOTO_CANCELLED',
      message: ''
    });

    const { props, getByText, queryByText } = renderScreen();

    fireEvent.press(getByText('Abrir cámara'));

    await waitFor(() => {
      expect(photoService.takeReportPhoto).toHaveBeenCalled();
    });

    expect(props.onChange).not.toHaveBeenCalled();
    expect(queryByText('Toma o selecciona una foto')).toBeTruthy();
  });

  it('muestra el error de foto cuando la captura falla', async () => {
    photoService.pickReportPhoto.mockResolvedValue({
      ok: false,
      code: 'PHOTO_UNAVAILABLE',
      message: 'No se pudo preparar la foto'
    });

    const { getByText } = renderScreen();

    fireEvent.press(getByText('Seleccionar foto'));

    await waitFor(() => {
      expect(getByText('No se pudo preparar la foto')).toBeTruthy();
    });
  });

  it('propone la ubicacion de los metadatos y solo la usa si se confirma', async () => {
    const { props, getByText, getAllByText } = renderScreen();

    photoService.takeReportPhoto.mockResolvedValue({
      ok: true,
      photo: PHOTO,
      exifLocation: { latitude: 27.75, longitude: -107.63 }
    });

    fireEvent.press(getByText('Abrir cámara'));

    await waitFor(() => {
      expect(getByText('La foto trae ubicación. ¿Usarla como ubicación del reporte?')).toBeTruthy();
    });

    // Todavia no se aplico: el borrador solo tiene la foto.
    expect(props.onChange).toHaveBeenCalledWith({ photo: PHOTO });
    expect(props.onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ location: expect.anything() })
    );

    fireEvent.press(getAllByText('Sí')[0]);

    expect(props.onChange).toHaveBeenCalledWith({
      location: {
        latitude: 27.75,
        longitude: -107.63,
        source: 'MANUAL',
        accuracyMeters: null,
        derivedFromPhoto: true
      },
      locationDerivedFromPhoto: true
    });
  });

  it('rechaza la ubicacion de los metadatos cuando la persona dice que no', async () => {
    const { props, getByText, getAllByText, queryByText } = renderScreen();

    photoService.pickReportPhoto.mockResolvedValue({
      ok: true,
      photo: PHOTO,
      exifLocation: { latitude: 27.75, longitude: -107.63 }
    });

    fireEvent.press(getByText('Seleccionar foto'));

    await waitFor(() => {
      expect(getByText(/La foto trae ubicación\./)).toBeTruthy();
    });

    fireEvent.press(getAllByText('No')[0]);

    expect(
      queryByText('La foto trae ubicación. ¿Usarla como ubicación del reporte?')
    ).toBeNull();
    expect(props.onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ location: expect.anything() })
    );
  });

  it('avanza a los detalles cuando ya hay ubicacion', () => {
    const { props, getByText } = renderScreen({
      draft: { ...createEmptyReportDraft(), location: { ...CREEL_CENTER, source: 'GPS' } }
    });

    fireEvent.press(getByText('Siguiente'));

    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it('no deja avanzar sin ubicacion y explica por que', () => {
    const { props, getByText } = renderScreen();

    fireEvent.press(getByText('Siguiente'));

    expect(props.onNext).not.toHaveBeenCalled();
    expect(getByText('Indica la ubicación del evento.')).toBeTruthy();
  });

  it('distingue una ubicacion tomada de la foto de una capturada con el GPS', () => {
    const { getByText, rerender } = renderScreen({
      draft: { ...createEmptyReportDraft(), location: { ...CREEL_CENTER, source: 'MANUAL', derivedFromPhoto: true } }
    });

    expect(getByText('Tomada de la foto')).toBeTruthy();

    rerender(
      <FotoYUbiScreen
        {...{
          draft: { ...createEmptyReportDraft(), location: { ...CREEL_CENTER, source: 'GPS', accuracyMeters: 8 } },
          onChange: jest.fn(),
          onNext: jest.fn(),
          onBack: jest.fn()
        }}
      />
    );

    expect(getByText('Capturada con el GPS')).toBeTruthy();
    expect(getByText(/±8 m/)).toBeTruthy();
  });
});

describe('FotoYUbiScreen - ubicacion manual', () => {
  it('abre y cierra el formulario a mano', () => {
    const { getByLabelText, getByText, queryByLabelText } = renderScreen();

    expect(queryByLabelText('Latitud manual')).toBeNull();

    fireEvent.press(getByLabelText('Ingresar ubicación manualmente'));

    expect(getByLabelText('Latitud manual')).toBeTruthy();
    expect(getByLabelText('Longitud manual')).toBeTruthy();

    fireEvent.press(getByText('Ocultar ubicación manual'));

    expect(queryByLabelText('Latitud manual')).toBeNull();
  });

  it('guarda la coordenada escrita como ubicacion manual', async () => {
    const { props, getByLabelText } = renderScreen();

    fireEvent.press(getByLabelText('Ingresar ubicación manualmente'));
    fireEvent.changeText(getByLabelText('Latitud manual'), '27.74432');
    fireEvent.changeText(getByLabelText('Longitud manual'), '-107.63432');
    fireEvent.press(getByLabelText('Usar ubicación escrita'));

    expect(props.onChange).toHaveBeenCalledWith({
      location: {
        latitude: 27.74432,
        longitude: -107.63432,
        source: 'MANUAL',
        accuracyMeters: null
      },
      locationDerivedFromPhoto: false
    });
  });

  it('acepta la coma decimal, que es como se escribe en Mexico', () => {
    const { props, getByLabelText } = renderScreen();

    fireEvent.press(getByLabelText('Ingresar ubicación manualmente'));
    fireEvent.changeText(getByLabelText('Latitud manual'), '27,74432');
    fireEvent.changeText(getByLabelText('Longitud manual'), '-107,63432');
    fireEvent.press(getByLabelText('Usar ubicación escrita'));

    expect(props.onChange).toHaveBeenCalledWith({
      location: expect.objectContaining({ latitude: 27.74432, longitude: -107.63432 }),
      locationDerivedFromPhoto: false
    });
  });

  it('exige las dos coordenadas antes de guardar', () => {
    const { props, getByLabelText, getByText } = renderScreen();

    fireEvent.press(getByLabelText('Ingresar ubicación manualmente'));
    fireEvent.changeText(getByLabelText('Latitud manual'), '27.74432');
    fireEvent.press(getByLabelText('Usar ubicación escrita'));

    expect(props.onChange).not.toHaveBeenCalled();
    expect(getByText(/latitud y la longitud/)).toBeTruthy();
  });

  it('rechaza una coordenada fuera de rango y no la guarda', () => {
    const { props, getByLabelText, getByText } = renderScreen();

    fireEvent.press(getByLabelText('Ingresar ubicación manualmente'));
    fireEvent.changeText(getByLabelText('Latitud manual'), '120');
    fireEvent.changeText(getByLabelText('Longitud manual'), '-107.63432');
    fireEvent.press(getByLabelText('Usar ubicación escrita'));

    expect(props.onChange).not.toHaveBeenCalled();
    expect(getByText(/fuera de rango/)).toBeTruthy();
  });

  it('cierra el formulario al guardar la coordenada', () => {
    const { getByLabelText, queryByLabelText } = renderScreen();

    fireEvent.press(getByLabelText('Ingresar ubicación manualmente'));
    fireEvent.changeText(getByLabelText('Latitud manual'), '27.74432');
    fireEvent.changeText(getByLabelText('Longitud manual'), '-107.63432');
    fireEvent.press(getByLabelText('Usar ubicación escrita'));

    expect(queryByLabelText('Latitud manual')).toBeNull();
  });

  it('permite seguir adelante cuando el borrador ya tiene la coordenada escrita', () => {
    // El borrador lo actualiza el padre a partir del onChange, asi que la
    // pantalla solo avanza cuando la coordenada ya volvio por props.
    const { props, getByText } = renderScreen({
      draft: {
        ...createEmptyReportDraft(),
        location: {
          latitude: 27.74432,
          longitude: -107.63432,
          source: 'MANUAL',
          accuracyMeters: null
        }
      }
    });

    expect(getByText('Ingresada a mano')).toBeTruthy();

    fireEvent.press(getByText('Siguiente'));

    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it('permite corregir una ubicacion ya guardada volviendo a abrir el formulario', () => {
    const { props, getByLabelText, getByText } = renderScreen({
      draft: {
        ...createEmptyReportDraft(),
        location: { latitude: 27.74432, longitude: -107.63432, source: 'MANUAL', accuracyMeters: null }
      }
    });

    expect(getByText('Ingresada a mano')).toBeTruthy();

    fireEvent.press(getByLabelText('Ingresar ubicación manualmente'));
    fireEvent.changeText(getByLabelText('Latitud manual'), '27.8');
    fireEvent.changeText(getByLabelText('Longitud manual'), '-107.7');
    fireEvent.press(getByLabelText('Usar ubicación escrita'));

    expect(props.onChange).toHaveBeenCalledWith({
      location: expect.objectContaining({ latitude: 27.8, longitude: -107.7 }),
      locationDerivedFromPhoto: false
    });
  });
});
