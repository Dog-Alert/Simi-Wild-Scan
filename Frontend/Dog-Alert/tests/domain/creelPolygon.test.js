import {
  CREEL_BOUNDARY,
  CREEL_BOUNDARY_PROVENANCE,
  CREEL_CENTER,
  isPointInCreel,
  isValidCoordinate,
} from '../../const/creelPolygon';

// Referencias verificadas contra la geometria real de OSM (way/352907131).
// Wikipedia y Wikidata ubican Creel en 27.75306, -107.635, dentro del poligono.
const DENTRO = {
  centroide: [27.7506615, -107.6359927],
  wikipedia: [27.75306, -107.635],
  surDelPueblo: [27.74, -107.635],
  norteDelPueblo: [27.765, -107.633],
  oesteDelPueblo: [27.7506, -107.642]
};

const FUERA = {
  lagoDeArareco: [27.7431, -107.6508],
  dosKmAlNorte: [27.77, -107.636],
  dosKmAlSur: [27.73, -107.636],
  dosKmAlEste: [27.7506, -107.615],
  dosKmAlOeste: [27.7506, -107.655],
  chihuahuaCapital: [28.633, -106.069],
  'centro erroneo de la version anterior': [27.6754, -107.6236]
};

describe('creelPolygon', () => {
  it('expone el anillo como un Polygon GeoJSON valido', () => {
    expect(CREEL_BOUNDARY.type).toBe('Polygon');
    expect(CREEL_BOUNDARY.coordinates).toHaveLength(1);

    const ring = CREEL_BOUNDARY.coordinates[0];
    expect(ring.length).toBe(CREEL_BOUNDARY_PROVENANCE.vertexCount + 1);
  });

  it('cierra el anillo repitiendo el primer vertice', () => {
    const ring = CREEL_BOUNDARY.coordinates[0];

    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('mantiene el orden [longitud, latitud] del contrato', () => {
    const ring = CREEL_BOUNDARY.coordinates[0];

    for (const [index, point] of ring.entries()) {
      expect(point).toHaveLength(2);
      expect(point[0]).toBeGreaterThanOrEqual(-108);
      expect(point[0]).toBeLessThanOrEqual(-107);
      expect(point[1]).toBeGreaterThanOrEqual(27);
      expect(point[1]).toBeLessThanOrEqual(28);

      if (index > 0) {
        const previous = ring[index - 1];
        expect(point).not.toEqual(previous);
      }
    }
  });

  it('declara su procedencia y que no es la geometria oficial', () => {
    expect(CREEL_BOUNDARY_PROVENANCE.osmId).toBe('way/352907131');
    expect(CREEL_BOUNDARY_PROVENANCE.attribution).toContain('OpenStreetMap');
    expect(CREEL_BOUNDARY_PROVENANCE.official).toBe(false);
  });

  it('mantiene el centro por defecto dentro del area', () => {
    expect(isPointInCreel(CREEL_CENTER.latitude, CREEL_CENTER.longitude)).toBe(true);
  });
});

describe('isPointInCreel', () => {
  it.each(Object.entries(DENTRO))('acepta %s', (_name, [latitude, longitude]) => {
    expect(isPointInCreel(latitude, longitude)).toBe(true);
  });

  it.each(Object.entries(FUERA))('rechaza %s', (_name, [latitude, longitude]) => {
    expect(isPointInCreel(latitude, longitude)).toBe(false);
  });

  it('rechaza el centro erroneo que uso la version anterior', () => {
    // El anillo inventado anterior estaba ~8.6 km al sur de la localidad real.
    expect(isPointInCreel(27.6754, -107.6236)).toBe(false);
  });

  it('acepta un punto exactamente sobre el borde del area', () => {
    const [longitude, latitude] = CREEL_BOUNDARY.coordinates[0][0];

    expect(isPointInCreel(latitude, longitude)).toBe(true);
  });

  it('rechaza un punto unos metros fuera del borde mas oriental', () => {
    // Vertice mas oriental del anillo: -107.6286018, 27.7644622.
    const longitude = -107.6286018 + 0.00011;

    expect(isPointInCreel(27.7644622, longitude)).toBe(false);
  });

  it('rechaza coordenadas fuera de los rangos del planeta', () => {
    expect(isPointInCreel(91, -107.635)).toBe(false);
    expect(isPointInCreel(27.7506, -181)).toBe(false);
  });

  it('rechaza valores no numericos', () => {
    expect(isPointInCreel(null, null)).toBe(false);
    expect(isPointInCreel(undefined, undefined)).toBe(false);
    expect(isPointInCreel('27.75', '-107.63')).toBe(false);
  });
});

describe('isValidCoordinate', () => {
  it('acepta los limites del rango', () => {
    expect(isValidCoordinate(0, 0)).toBe(true);
    expect(isValidCoordinate(90, 180)).toBe(true);
    expect(isValidCoordinate(-90, -180)).toBe(true);
  });

  it('rechaza lo que excede los limites', () => {
    expect(isValidCoordinate(90.1, 0)).toBe(false);
    expect(isValidCoordinate(0, 180.1)).toBe(false);
  });
});
