import {
  buildReportPayload,
  createEmptyReportDraft,
  isReportValid,
  validateColor,
  validateDescription,
  validateDogCount,
  validateEventType,
  validateReport,
} from '../../domain/reportValidation';
import { REPORT_LIMITS, REPORT_MIN_EVENT_DATE } from '../../const/reportCatalogs';
import { CREEL_CENTER } from '../../const/creelPolygon';

const DAY = 24 * 60 * 60 * 1000;

const NOW = new Date('2026-10-15T12:00:00.000Z');
const VALID_DATE = new Date(REPORT_MIN_EVENT_DATE.getTime() + DAY);
const DATE_BEFORE_LAUNCH = new Date(REPORT_MIN_EVENT_DATE.getTime() - DAY);
const FUTURE_DATE = new Date('2026-10-16T12:00:00.000Z');

function validDraft() {
  return {
    ...createEmptyReportDraft(),
    eventAt: VALID_DATE,
    eventType: 'ATTACK_PET',
    consentAccepted: true,
    severity: 'HIGH',
    certainty: 'MEDIUM',
    dogCount: '3',
    size: 'MEDIUM',
    color: 'negro con manchas blancas',
    collar: 'NO',
    description: 'Perro que persiguió a una mascota por la calle sin correa.',
    location: {
      latitude: CREEL_CENTER.latitude,
      longitude: CREEL_CENTER.longitude,
      source: 'GPS',
      accuracyMeters: 12.5,
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('borrador vacío', () => {
  it('devuelve todos los campos faltantes de una sola vez', () => {
    const errors = validateReport(createEmptyReportDraft());

    expect(Object.keys(errors).sort()).toEqual(
      [
        'certainty',
        'collar',
        'color',
        'consentAccepted',
        'description',
        'dogCount',
        'eventAt',
        'eventType',
        'location',
        'severity',
        'size',
      ].sort()
    );
  });

  it('exige una gravedad del catalogo', () => {
    expect(validateReport({ ...validDraft(), severity: '' }).severity).toBeTruthy();
    expect(validateReport({ ...validDraft(), severity: 'EXTREME' }).severity).toBeTruthy();
    expect(validateReport(validDraft()).severity).toBeUndefined();
  });

  it('exige aceptar el consentimiento', () => {
    expect(validateReport({ ...validDraft(), consentAccepted: false }).consentAccepted).toBeTruthy();
    expect(validateReport({ ...validDraft(), consentAccepted: 'true' }).consentAccepted).toBeTruthy();
  });
});

describe('validateEventAt', () => {
  it('rechaza una fecha ausente', () => {
    expect(validateReport({ ...validDraft(), eventAt: null }).eventAt).toBeTruthy();
  });

  it('rechaza una fecha futura', () => {
    expect(validateReport({ ...validDraft(), eventAt: FUTURE_DATE }).eventAt).toContain(
      'no puede ser futura'
    );
  });

  it('rechaza una fecha anterior al lanzamiento', () => {
    expect(validateReport({ ...validDraft(), eventAt: DATE_BEFORE_LAUNCH }).eventAt).toContain(
      'anterior al lanzamiento'
    );
  });

  it('acepta una fecha valida', () => {
    expect(validateReport(validDraft()).eventAt).toBeUndefined();
  });
});

describe('validateEventType', () => {
  it('rechaza un tipo vacio', () => {
    expect(validateEventType('', '')).toBeTruthy();
  });

  it('rechaza un valor fuera del catalogo', () => {
    expect(validateEventType('PERRO_SUELTO', '')).toBeTruthy();
  });

  it('exige descripcion cuando el tipo es Otro', () => {
    expect(validateEventType('OTHER', '   ')).toBe('Describe el tipo de evento.');
  });

  it('acepta Otro con descripcion', () => {
    expect(validateEventType('OTHER', 'Riña entre perros')).toBeNull();
  });

  it('rechaza una descripcion de Otro muy larga', () => {
    const long = 'a'.repeat(REPORT_LIMITS.eventTypeOther.maxLength + 1);
    expect(validateEventType('OTHER', long)).toContain('120');
  });
});

describe('validateDogCount', () => {
  it('rechaza vacio, cero y negativos', () => {
    expect(validateDogCount('')).toBeTruthy();
    expect(validateDogCount('0')).toBeTruthy();
    expect(validateDogCount('-2')).toBeTruthy();
  });

  it('rechaza decimales', () => {
    expect(validateDogCount('2.5')).toBeTruthy();
  });

  it('rechaza mas de 999', () => {
    expect(validateDogCount('1000')).toBeTruthy();
  });

  it('acepta los extremos del rango', () => {
    expect(validateDogCount('1')).toBeNull();
    expect(validateDogCount('999')).toBeNull();
  });
});

describe('validateColor', () => {
  it('exige color o la opcion de no determinarlo', () => {
    expect(validateColor('', false)).toBe('Indica el color o marca "No sé".');
  });

  it('acepta la opcion No se pudo determinar', () => {
    expect(validateColor('', true)).toBeNull();
  });

  it('acepta un color corto', () => {
    expect(validateColor('café', false)).toBeNull();
  });

  it('rechaza un color de mas de 120 caracteres', () => {
    const long = 'a'.repeat(REPORT_LIMITS.color.maxLength + 1);
    expect(validateColor(long, false)).toContain('120');
  });
});

describe('validateDescription', () => {
  it('exige descripcion', () => {
    expect(validateDescription('  ')).toBe('Describe lo que ocurrió.');
  });

  it('rechaza menos de 20 caracteres', () => {
    expect(validateDescription('a'.repeat(19))).toContain('mínimo');
  });

  it('acepta exactamente 20 caracteres', () => {
    expect(validateDescription('a'.repeat(20))).toBeNull();
  });

  it('rechaza mas de 2000 caracteres', () => {
    expect(validateDescription('a'.repeat(2001))).toContain('2000');
  });
});

describe('ubicacion', () => {
  it('exige ubicacion', () => {
    expect(validateReport({ ...validDraft(), location: null }).location).toBe(
      'Indica la ubicación del evento.'
    );
  });

  it('rechaza una precision negativa', () => {
    const draft = validDraft();
    draft.location = { ...draft.location, accuracyMeters: -5 };
    expect(validateReport(draft).location).toContain('precisión');
  });

  it('bloquea un punto fuera de Creel', () => {
    const draft = validDraft();
    draft.location = { ...draft.location, latitude: 31.6904, longitude: -106.0245 };
    expect(validateReport(draft).location).toContain('fuera del área de Creel');
  });

  it('acepta el punto del centro de Creel', () => {
    const draft = validDraft();
    draft.location = { ...draft.location, source: 'MANUAL', accuracyMeters: null };
    expect(validateReport(draft).location).toBeUndefined();
  });
});

describe('foto', () => {
  it('es opcional', () => {
    expect(validateReport(validDraft()).photo).toBeUndefined();
  });

  it('rechaza un mime no permitido', () => {
    const draft = { ...validDraft(), photo: { uri: 'x', mimeType: 'application/pdf' } };
    expect(validateReport(draft).photo).toContain('JPEG');
  });

  it('rechaza un archivo de mas de 1 MB', () => {
    const draft = {
      ...validDraft(),
      photo: { uri: 'x', mimeType: 'image/jpeg', fileSize: 1048577 },
    };
    expect(validateReport(draft).photo).toContain('1 MB');
  });
});

describe('validateReport e isReportValid', () => {
  it('acepta un borrador completo', () => {
    expect(validateReport(validDraft())).toEqual({});
    expect(isReportValid(validDraft())).toBe(true);
  });

  it('rechaza un borrador incompleto', () => {
    expect(isReportValid(createEmptyReportDraft())).toBe(false);
  });
});

describe('buildReportPayload', () => {
  it('arma el payload con los nombres del contrato', () => {
    const payload = buildReportPayload(validDraft(), 'uuid-1');

    expect(payload).toEqual({
      clientReportId: 'uuid-1',
      eventAt: VALID_DATE.toISOString(),
      eventType: 'ATTACK_PET',
      eventTypeOther: null,
      severity: 'HIGH',
      certainty: 'MEDIUM',
      dogCount: 3,
      size: 'MEDIUM',
      color: 'negro con manchas blancas',
      colorUndetermined: false,
      collar: 'NO',
      description: 'Perro que persiguió a una mascota por la calle sin correa.',
      location: {
        latitude: CREEL_CENTER.latitude,
        longitude: CREEL_CENTER.longitude,
        source: 'GPS',
        accuracyMeters: 12.5,
      },
      consentAccepted: true,
    });
  });

  it('manda el color en null cuando se marco No se pudo determinar', () => {
    const draft = { ...validDraft(), color: 'negro', colorUndetermined: true };
    const payload = buildReportPayload(draft, 'uuid-2');

    expect(payload.color).toBeNull();
    expect(payload.colorUndetermined).toBe(true);
  });

  it('envia eventTypeOther solo cuando el tipo es Otro', () => {
    const draft = { ...validDraft(), eventType: 'OTHER', eventTypeOther: 'Riña entre perros' };
    expect(buildReportPayload(draft, 'uuid-3').eventTypeOther).toBe('Riña entre perros');

    const notOther = { ...draft, eventType: 'SIGHTING' };
    expect(buildReportPayload(notOther, 'uuid-4').eventTypeOther).toBeNull();
  });

  it('convierte dogCount a numero', () => {
    expect(buildReportPayload({ ...validDraft(), dogCount: '12' }, 'uuid-5').dogCount).toBe(12);
  });

  it('no incluye la foto dentro del payload', () => {
    const draft = { ...validDraft(), photo: { uri: 'file://foto.jpg', mimeType: 'image/jpeg' } };
    expect(buildReportPayload(draft, 'uuid-6')).not.toHaveProperty('photo');
  });
});
