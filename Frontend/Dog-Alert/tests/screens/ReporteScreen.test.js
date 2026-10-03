import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import ReporteScreen from '../../screens/ReporteScreen';
import { createEmptyReportDraft } from '../../domain/reportValidation';
import { CREEL_CENTER } from '../../const/creelPolygon';

function renderScreen(overrides = {}) {
  const props = {
    draft: createEmptyReportDraft(),
    onChange: jest.fn(),
    onSubmit: jest.fn(),
    onBack: jest.fn(),
    submitError: null,
    submitting: false,
    ...overrides
  };

  return { ...render(<ReporteScreen {...props} />), props };
}

describe('ReporteScreen', () => {
  it('muestra el paso 2 activo y ninguna seccion de gravedad', () => {
    const { getByText, queryByText } = renderScreen();

    expect(getByText('Nuevo reporte')).toBeTruthy();
    expect(getByText('Detalles')).toBeTruthy();
    // La gravedad la asigna quien revisa el reporte, no quien lo captura.
    expect(queryByText('Gravedad')).toBeNull();
  });

  it('muestra todas las secciones del formulario del diseño', () => {
    const { getByText } = renderScreen();

    [
      'Fecha y hora',
      'Tipo de incidente',
      'Certeza',
      'Tamaño',
      'Color',
      '¿Collar?',
      'Cantidad',
      'Descripción adicional',
    ].forEach((label) => {
      expect(getByText(label)).toBeTruthy();
    });
  });

  it('tiene un solo boton de enviar y su texto es Enviar reporte', () => {
    const { getAllByText } = renderScreen();

    expect(getAllByText('Enviar reporte')).toHaveLength(1);
  });

  it('registra la eleccion de cada grupo de opciones', () => {
    const { props, getByTestId } = renderScreen();

    fireEvent.press(getByTestId('chip-eventType-ATTACK_PET'));
    expect(props.onChange).toHaveBeenCalledWith({ eventType: 'ATTACK_PET' });

    fireEvent.press(getByTestId('chip-certainty-MEDIUM'));
    expect(props.onChange).toHaveBeenCalledWith({ certainty: 'MEDIUM' });

    fireEvent.press(getByTestId('chip-size-SMALL'));
    expect(props.onChange).toHaveBeenCalledWith({ size: 'SMALL' });

    fireEvent.press(getByTestId('chip-collar-UNDETERMINED'));
    expect(props.onChange).toHaveBeenCalledWith({ collar: 'UNDETERMINED' });
  });

  it('guarda la cota inferior del rango de cantidad elegido', () => {
    const { props, getByTestId } = renderScreen();

    fireEvent.press(getByTestId('chip-dogCount-2'));
    expect(props.onChange).toHaveBeenCalledWith({ dogCount: '2' });

    fireEvent.press(getByTestId('chip-dogCount-4'));
    expect(props.onChange).toHaveBeenCalledWith({ dogCount: '4' });
  });

  it('marca el rango activo a partir de la cantidad ya guardada', () => {
    const { getByTestId } = renderScreen({
      draft: { ...createEmptyReportDraft(), dogCount: '2' }
    });

    expect(getByTestId('chip-dogCount-2').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('chip-dogCount-1').props.accessibilityState.selected).toBe(false);
  });

  it('trata "No sé" de color como color indeterminado, no como un color', () => {
    const { props, getByTestId } = renderScreen();

    fireEvent.press(getByTestId('chip-color-UNDETERMINED'));

    expect(props.onChange).toHaveBeenCalledWith({ color: '', colorUndetermined: true });
  });

  it('limpia la marca de color indeterminado al elegir un color', () => {
    const { props, getByTestId } = renderScreen({
      draft: { ...createEmptyReportDraft(), colorUndetermined: true }
    });

    fireEvent.press(getByTestId('chip-color-Café'));

    expect(props.onChange).toHaveBeenCalledWith({ color: 'Café', colorUndetermined: false });
  });

  it('muestra el campo de detalle solo con el tipo Otro', () => {
    const base = {
      draft: createEmptyReportDraft(),
      onChange: jest.fn(),
      onSubmit: jest.fn(),
      onBack: jest.fn(),
      submitError: null,
      submitting: false
    };

    const { queryByLabelText, rerender } = render(<ReporteScreen {...base} />);

    expect(queryByLabelText('Detalle del tipo de evento')).toBeNull();

    rerender(<ReporteScreen {...base} draft={{ ...base.draft, eventType: 'OTHER' }} />);

    expect(queryByLabelText('Detalle del tipo de evento')).toBeTruthy();
  });

  it('escribe la descripcion en el borrador', () => {
    const { props, getByLabelText } = renderScreen();

    fireEvent.changeText(getByLabelText('Descripción del evento'), 'Perro flaco, sin collar');

    expect(props.onChange).toHaveBeenCalledWith({ description: 'Perro flaco, sin collar' });
  });

  it('envia la fecha y hora escrita en el formulario', () => {
    const { props, getByLabelText } = renderScreen();

    fireEvent.changeText(getByLabelText('Fecha del evento'), '15/10/2026');
    fireEvent.changeText(getByLabelText('Hora del evento'), '18:30');
    fireEvent.press(getByLabelText('Enviar reporte'));

    const expected = new Date(2026, 9, 15, 18, 30);
    expect(props.onSubmit).toHaveBeenCalledWith({ eventAt: expected });
  });

  it('envia la fecha nula si el texto no se puede interpretar', () => {
    const { props, getByLabelText } = renderScreen();

    fireEvent.changeText(getByLabelText('Fecha del evento'), 'no-es-fecha');
    fireEvent.press(getByLabelText('Enviar reporte'));

    expect(props.onSubmit).toHaveBeenCalledWith({ eventAt: null });
  });

  it('rechaza una fecha que no existe, como 31/02', () => {
    const { props, getByLabelText } = renderScreen();

    fireEvent.changeText(getByLabelText('Fecha del evento'), '31/02/2026');
    fireEvent.press(getByLabelText('Enviar reporte'));

    expect(props.onSubmit).toHaveBeenCalledWith({ eventAt: null });
  });

  it('muestra los errores por campo que devuelve la API', () => {
    const { getByText } = renderScreen({
      submitError: {
        message: 'Revisa los datos',
        fields: {
          description: 'La descripción admite mínimo 20 caracteres.',
          color: 'Indica el color o marca "No sé".'
        }
      }
    });

    expect(getByText('La descripción admite mínimo 20 caracteres.')).toBeTruthy();
    expect(getByText('Indica el color o marca "No sé".')).toBeTruthy();
  });

  it('muestra el error general cuando la API no senala un campo', () => {
    const { getByText } = renderScreen({
      submitError: { message: 'No se pudo enviar el reporte.', fields: {} }
    });

    expect(getByText('No se pudo enviar el reporte.')).toBeTruthy();
  });

  it('avisa cuando la ubicacion quedo fuera de Creel', () => {
    const draft = {
      ...createEmptyReportDraft(),
      location: { latitude: 28.6353, longitude: -106.0889, source: 'GPS' }
    };

    const { getByText } = renderScreen({
      draft,
      submitError: {
        message: 'Fuera de Creel',
        fields: { location: 'Esta ubicación está fuera del área de Creel.' }
      }
    });

    expect(getByText('Esta ubicación está fuera del área de Creel.')).toBeTruthy();
  });

  it('regresa a la pantalla de foto y ubicacion', () => {
    const { props, getByText } = renderScreen();

    fireEvent.press(getByText('Volver a foto y ubicación'));

    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('no pierde la ubicacion capturada en el paso anterior', () => {
    const { props, getByLabelText } = renderScreen({
      draft: {
        ...createEmptyReportDraft(),
        location: { ...CREEL_CENTER, source: 'GPS', accuracyMeters: 12 }
      }
    });

    fireEvent.press(getByLabelText('Enviar reporte'));

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('ReporteScreen - edicion', () => {
  it('usa el titulo y el texto del boton recibidos', () => {
    const { getByText, getByLabelText, props } = renderScreen({
      title: 'Editar reporte',
      submitLabel: 'Guardar cambios',
    });

    fireEvent.press(getByLabelText('Guardar cambios'));

    expect(getByText('Editar reporte')).toBeTruthy();
    expect(getByText('Guardar cambios')).toBeTruthy();
    expect(props.onSubmit).toHaveBeenCalled();
  });
});
