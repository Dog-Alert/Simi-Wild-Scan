import {
  parseCoordinateInput,
  parseManualCoordinateInput
} from '../../domain/reportCoordinate';

describe('parseCoordinateInput', () => {
  it('interpreta un decimal con punto', () => {
    expect(parseCoordinateInput('27.74432')).toBeCloseTo(27.74432, 6);
  });

  it('acepta coma decimal porque es como se escribe en Mexico', () => {
    expect(parseCoordinateInput('27,74432')).toBeCloseTo(27.74432, 6);
  });

  it('acepta negativos', () => {
    expect(parseCoordinateInput('-107.63432')).toBeCloseTo(-107.63432, 6);
  });

  it('acepta un numero ya numerico', () => {
    expect(parseCoordinateInput(27.74432)).toBeCloseTo(27.74432, 6);
  });

  it('ignora espacios alrededor', () => {
    expect(parseCoordinateInput('  27.74432 ')).toBeCloseTo(27.74432, 6);
  });

  it('acepta un entero sin decimales', () => {
    expect(parseCoordinateInput('28')).toBe(28);
  });

  it('acepta solo el signo y los puntos, para escribir paso a paso', () => {
    expect(parseCoordinateInput('')).toBeNull();
    expect(parseCoordinateInput('   ')).toBeNull();
    expect(parseCoordinateInput('-')).toBeNull();
    expect(parseCoordinateInput('.')).toBeNull();
  });

  it('rechaza un campo vacio en vez de tomarlo como cero', () => {
    // Number('') es 0, y 0,0 cae en el Golfo de Guinea: no puede pasar.
    expect(parseCoordinateInput('')).not.toBe(0);
  });

  it('rechaza texto que no es un numero', () => {
    expect(parseCoordinateInput('abc')).toBeNull();
    expect(parseCoordinateInput('27.74abc')).toBeNull();
    expect(parseCoordinateInput('27,7.4')).toBeNull();
    expect(parseCoordinateInput('1e5')).toBeNull();
    expect(parseCoordinateInput('27 74432')).toBeNull();
  });

  it('rechaza valores que no son numeros', () => {
    expect(parseCoordinateInput(NaN)).toBeNull();
    expect(parseCoordinateInput(Infinity)).toBeNull();
    expect(parseCoordinateInput(null)).toBeNull();
    expect(parseCoordinateInput(undefined)).toBeNull();
  });
});

describe('parseManualCoordinateInput', () => {
  it('devuelve las dos coordenadas cuando son validas', () => {
    const result = parseManualCoordinateInput('27.74432', '-107.63432');

    expect(result.ok).toBe(true);
    expect(result.latitude).toBeCloseTo(27.74432, 6);
    expect(result.longitude).toBeCloseTo(-107.63432, 6);
  });

  it('avisa cuando falta una de las dos', () => {
    expect(parseManualCoordinateInput('', '-107.63432').ok).toBe(false);
    expect(parseManualCoordinateInput('27.74432', '').ok).toBe(false);
    expect(parseManualCoordinateInput('27.74432', '').message).toContain('números');
  });

  it('rechaza una latitud fuera de rango', () => {
    const result = parseManualCoordinateInput('91', '-107.63432');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('-90 y 90');
  });

  it('rechaza una longitud fuera de rango', () => {
    expect(parseManualCoordinateInput('27.74432', '181').ok).toBe(false);
  });

  it('acepta los limites exactos del rango', () => {
    expect(parseManualCoordinateInput('90', '180').ok).toBe(true);
    expect(parseManualCoordinateInput('-90', '-180').ok).toBe(true);
  });

  it('acepta el punto exacto de Creel', () => {
    const result = parseManualCoordinateInput('27.74432', '-107.63432');

    expect(result.ok).toBe(true);
  });
});
