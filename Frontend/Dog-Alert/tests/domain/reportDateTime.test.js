import { REPORT_LIMITS } from '../../const/reportCatalogs';
import {
  descriptionRemaining,
  formatEventAtInput,
  parseEventAtInput
} from '../../domain/reportDateTime';

describe('formatEventAtInput', () => {
  it('divide la fecha en los dos textos del formulario', () => {
    expect(formatEventAtInput(new Date(2026, 9, 5, 18, 30))).toEqual({
      date: '05/10/2026',
      time: '18:30'
    });
  });

  it('rellena con ceros para que el ancho del campo no cambie', () => {
    expect(formatEventAtInput(new Date(2026, 0, 1, 7, 5))).toEqual({
      date: '01/01/2026',
      time: '07:05'
    });
  });

  it('usa el momento actual cuando no hay fecha todavia', () => {
    const before = new Date();
    const { date, time } = formatEventAtInput(null);
    const parsed = parseEventAtInput(date, time);

    expect(parsed.getTime()).toBeGreaterThanOrEqual(before.getTime() - 60000);
  });

  it('usa el momento actual cuando la fecha es invalida', () => {
    const { date, time } = formatEventAtInput(new Date('no-es-fecha'));

    expect(parseEventAtInput(date, time)).toBeInstanceOf(Date);
  });
});

describe('parseEventAtInput', () => {
  it('interpreta la hora como local, no como UTC', () => {
    const parsed = parseEventAtInput('05/10/2026', '18:30');

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(9);
    expect(parsed.getDate()).toBe(5);
    expect(parsed.getHours()).toBe(18);
    expect(parsed.getMinutes()).toBe(30);
  });

  it('acepta un solo digito en dia, mes y hora', () => {
    const parsed = parseEventAtInput('5/10/2026', '8:05');

    expect(parsed.getDate()).toBe(5);
    expect(parsed.getHours()).toBe(8);
  });

  it('rechaza una fecha que no existe', () => {
    // new Date(2026, 1, 31) se corre a marzo en silencio.
    expect(parseEventAtInput('31/02/2026', '10:00')).toBeNull();
    expect(parseEventAtInput('32/01/2026', '10:00')).toBeNull();
  });

  it('rechaza un mes fuera de rango', () => {
    expect(parseEventAtInput('05/13/2026', '10:00')).toBeNull();
    expect(parseEventAtInput('05/00/2026', '10:00')).toBeNull();
  });

  it('rechaza una hora o un minuto imposibles', () => {
    expect(parseEventAtInput('05/10/2026', '24:00')).toBeNull();
    expect(parseEventAtInput('05/10/2026', '10:60')).toBeNull();
  });

  it('rechaza formatos que no son DD/MM/AAAA y HH:MM', () => {
    expect(parseEventAtInput('2026-10-05', '18:30')).toBeNull();
    expect(parseEventAtInput('05/10/26', '18:30')).toBeNull();
    expect(parseEventAtInput('5/10/2026', '6:30 PM')).toBeNull();
  });

  it('rechaza textos vacios o ausentes', () => {
    expect(parseEventAtInput('', '')).toBeNull();
    expect(parseEventAtInput(undefined, undefined)).toBeNull();
    expect(parseEventAtInput('05/10/2026', '')).toBeNull();
  });
});

describe('descriptionRemaining', () => {
  const { maxLength } = REPORT_LIMITS.description;

  it('descuenta lo escrito del maximo permitido', () => {
    const text = 'Perro flaco, sin collar';

    expect(descriptionRemaining(text)).toBe(maxLength - text.length);
  });

  it('devuelve el maximo completo cuando no hay texto', () => {
    expect(descriptionRemaining('')).toBe(maxLength);
    expect(descriptionRemaining(undefined)).toBe(maxLength);
  });

  it('no baja de cero si el texto excede el maximo', () => {
    expect(descriptionRemaining('a'.repeat(maxLength + 100))).toBe(-100);
  });
});
