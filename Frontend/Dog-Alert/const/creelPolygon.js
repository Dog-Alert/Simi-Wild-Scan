/**
 * Limite del area urbana de Creel, Chihuahua.
 *
 * PROCEDENCIA
 * ----------
 * Geometria real, no dibujada a mano. Proviene de OpenStreetMap
 * (colaboradores, licencia ODbL) via Overpass API:
 *
 *   osm_id   : way/352907131
 *   landuse  : residential
 *   name     : Creel
 *   municipio : Bocoyna, Chihuahua, Mexico
 *
 * bbox  : -107.6445935, 27.7361858  ->  -107.6286018, 27.7682328
 * tamano : ~1575 m (E-O) x ~3567 m (N-S)
 * area   : ~2.87 km2, 165 vertices
 *
 * QUE ES Y QUE NO ES
 * ------------------
 * Es el area residencial mapeada de Creel. NO es el limite administrativo
 * oficial de la localidad ni el poligono versionado que exige el SDD: ese sigue
 * pendiente en la decision bloqueante OPEN-002
 * (`SDD/docs/sdd/12_decisiones_y_pendientes.md:25`).
 *
 * OSM no mapea todo el crecimiento urbano reciente, asi que una zona construida
 * pero no mapeada puede quedar fuera y ser rechazada. Es un riesgo conocido.
 *
 * En la version anterior se uso un anillo inventado cuyo centro quedo ~8.6 km al
 * sur de la localidad real y habria rechazado la mayor parte de Creel. Este
 * poligono corrige ese error.
 *
 * El backend es la autoridad: el ticket de backend valida contra el poligono
 * versionado y rechaza sin almacenar las coordenadas externas. Si esta
 * poligono acepta un punto que el backend rechaza, la app muestra la
 * explicacion y exige corregir. Nunca ocurre al reves, porque el backend decide.
 *
 * ODbL exige atribucion: la app debe mostrar "OpenStreetMap contributors" en
 * alguna pantalla. Ver `CREEL_BOUNDARY_PROVENANCE`.
 *
 * Para actualizarlo, reemplaza CREEL_RING conservando el orden
 * [longitud, latitud] (GeoJSON) y recalcula CREEL_CENTER.
 *
 * Historia: C2 - Movil - Formulario georreferenciado y limite de Creel.
 */

/**
 * Atribucion y procedencia del poligono, para mostrarla en la app y cumplir la
 * licencia ODbL de OpenStreetMap.
 */
export const CREEL_BOUNDARY_PROVENANCE = {
  name: 'Creel',
  state: 'Chihuahua',
  municipality: 'Bocoyna',
  country: 'México',
  source: 'OpenStreetMap contributors (ODbL) via Overpass API',
  osmId: 'way/352907131',
  landuse: 'residential',
  attribution: '© OpenStreetMap contributors',
  vertexCount: 165,
  areaKm2: 2.87,
  official: false,
};

// Anillo exterior en sentido antihorario, [longitud, latitud] (RFC 7946).
const CREEL_RING = [
  [-107.6386067, 27.7446108], [-107.6391647, 27.7435165],
  [-107.6396598, 27.7431388], [-107.640906, 27.743169],
  [-107.6443203, 27.7440604], [-107.6445935, 27.7424438],
  [-107.6442522, 27.7419891], [-107.6430452, 27.7425873],
  [-107.642042, 27.7423594], [-107.6418006, 27.7423832],
  [-107.6415271, 27.7422217], [-107.6424444, 27.7418514],
  [-107.642675, 27.7416472], [-107.6425517, 27.7413719],
  [-107.6422298, 27.7414099], [-107.6411264, 27.7420858],
  [-107.6408297, 27.7417992], [-107.6409638, 27.7414383],
  [-107.6413876, 27.7413481], [-107.6416129, 27.7410538],
  [-107.6415277, 27.7408396], [-107.6423213, 27.739967],
  [-107.6414594, 27.737999], [-107.6390694, 27.7361858],
  [-107.6380533, 27.7362293], [-107.6348356, 27.7363671],
  [-107.6327187, 27.737727], [-107.6329577, 27.738966],
  [-107.6321895, 27.7399784], [-107.6316262, 27.7402957],
  [-107.6297312, 27.740069], [-107.6287923, 27.740341],
  [-107.6290313, 27.7407036], [-107.6301409, 27.7412627],
  [-107.6314213, 27.7418821], [-107.631831, 27.7425318],
  [-107.6317286, 27.7428038], [-107.6306872, 27.744496],
  [-107.6302604, 27.7447075], [-107.6301921, 27.7453572],
  [-107.6304082, 27.7456451], [-107.6307525, 27.7458982],
  [-107.6312786, 27.7460446], [-107.631651, 27.7457423],
  [-107.6319847, 27.7457803], [-107.631996, 27.7466391],
  [-107.6321683, 27.7470494], [-107.6321076, 27.7472278],
  [-107.6320359, 27.7474422], [-107.6317739, 27.7481429],
  [-107.6314275, 27.7486868], [-107.631157, 27.7486104],
  [-107.6309048, 27.7486899], [-107.6309108, 27.7488538],
  [-107.6311319, 27.7488538], [-107.6312621, 27.7489936],
  [-107.6311477, 27.7492079], [-107.6309433, 27.7493005],
  [-107.6305488, 27.7493958], [-107.6302434, 27.7496027],
  [-107.6304731, 27.7498512], [-107.6308293, 27.7499768],
  [-107.6313851, 27.7501359], [-107.63172, 27.7505016],
  [-107.6319078, 27.7508718], [-107.6318684, 27.7511498],
  [-107.631703, 27.7513779], [-107.6315268, 27.75151],
  [-107.6312731, 27.7515673], [-107.6305982, 27.7514194],
  [-107.6302299, 27.7513087], [-107.6299982, 27.7511433],
  [-107.6297951, 27.751168], [-107.6299883, 27.7514482],
  [-107.6298322, 27.7515313], [-107.6299017, 27.7517412],
  [-107.6299147, 27.7517538], [-107.6302162, 27.7520302],
  [-107.6304026, 27.7522142], [-107.6305631, 27.7526777],
  [-107.6306061, 27.7527234], [-107.6307434, 27.7528687],
  [-107.6309972, 27.7531372], [-107.6313489, 27.753333],
  [-107.6315685, 27.7538188], [-107.6316208, 27.7539323],
  [-107.6315669, 27.7541015], [-107.6309839, 27.7543568],
  [-107.63139, 27.7546736], [-107.6315843, 27.7547017],
  [-107.6319903, 27.7547605], [-107.6327342, 27.7550475],
  [-107.6333333, 27.7553512], [-107.6337089, 27.7561443],
  [-107.6337611, 27.756505], [-107.6336236, 27.7570101],
  [-107.6331509, 27.7582826], [-107.6312676, 27.7583424],
  [-107.6304055, 27.7588183], [-107.6304958, 27.7589449],
  [-107.6309604, 27.7595963], [-107.6313957, 27.7602534],
  [-107.6319761, 27.7608199], [-107.6329407, 27.7609332],
  [-107.63172, 27.7618623], [-107.6312207, 27.7621116],
  [-107.6307512, 27.7621002], [-107.6304653, 27.7631501],
  [-107.6309557, 27.7631377], [-107.6313782, 27.7637466],
  [-107.6298451, 27.7636718], [-107.6291571, 27.7636397],
  [-107.6286018, 27.7644622], [-107.6292054, 27.7652313],
  [-107.6304366, 27.7649536], [-107.6311126, 27.765242],
  [-107.6318369, 27.7666519], [-107.6337563, 27.7680619],
  [-107.6343961, 27.7682328], [-107.6357064, 27.7678375],
  [-107.6357764, 27.7672112], [-107.6355833, 27.7666273],
  [-107.6356917, 27.7661332], [-107.635535, 27.7656258],
  [-107.6356584, 27.765284], [-107.6356621, 27.7643222],
  [-107.6381351, 27.7639778], [-107.6380975, 27.7631348],
  [-107.6375868, 27.7624395], [-107.6383835, 27.7620763],
  [-107.6407495, 27.7626318], [-107.642004, 27.7604588],
  [-107.6402797, 27.7601114], [-107.6394091, 27.7605495],
  [-107.6382824, 27.7598999], [-107.6381574, 27.7590055],
  [-107.6383783, 27.7586855], [-107.6384106, 27.7581747],
  [-107.6381722, 27.7579417], [-107.6378096, 27.7573351],
  [-107.6380263, 27.7563649], [-107.6374634, 27.7559953],
  [-107.6374154, 27.7557702], [-107.6376149, 27.7557393],
  [-107.6378785, 27.7558884], [-107.6380695, 27.7555914],
  [-107.6384271, 27.7547812], [-107.6386772, 27.7541688],
  [-107.6391215, 27.7537866], [-107.6398769, 27.7536608],
  [-107.6405484, 27.7539302], [-107.6415968, 27.7543801],
  [-107.6417792, 27.7542662], [-107.6410407, 27.7527639],
  [-107.6414949, 27.7525049], [-107.6418636, 27.7519813],
  [-107.642498, 27.7519115], [-107.6431096, 27.7532788],
  [-107.6430951, 27.7546557], [-107.6434214, 27.7549988],
  [-107.6436828, 27.7546079], [-107.6437855, 27.7532028],
  [-107.6433885, 27.7513798], [-107.6425332, 27.7498383],
  [-107.6408602, 27.7489772],
  [-107.6386067, 27.7446108],
];

export const CREEL_BOUNDARY = {
  type: 'Polygon',
  coordinates: [CREEL_RING],
};

/**
 * Centroide del area residencial. Se usa como punto inicial al colocar la
 * ubicacion a mano, por lo que debe quedar dentro del poligono.
 */
export const CREEL_CENTER = {
  latitude: 27.7506615,
  longitude: -107.6359927,
};

/** Metros por grado de latitud, constante en la practica. */
const METERS_PER_DEGREE_LAT = 111320;

/**
 * Un punto a esta distancia (en metros) del borde se considera dentro: esta
 * sobre el limite del area de Creel, no fuera. Sin esta tolerancia el resultado
 * dependeria del redondeo del GPS y de la aritmetica, y un usuario parado justo
 * en el limite veria un rechazo injusto.
 */
const BORDER_TOLERANCE_METERS = 1;

/** Origen local para proyectar a metros; evita restar coordenadas grandes. */
const REF_LAT = 27.7506615;
const REF_LON = -107.6359927;
const METERS_PER_DEGREE_LON = METERS_PER_DEGREE_LAT * Math.cos((REF_LAT * Math.PI) / 180);

function toMeters(latitude, longitude) {
  return {
    x: (longitude - REF_LON) * METERS_PER_DEGREE_LON,
    y: (latitude - REF_LAT) * METERS_PER_DEGREE_LAT,
  };
}

function distanceToSegmentMeters(point, [segLon, segLat], [nextLon, nextLat]) {
  const a = toMeters(segLat, segLon);
  const b = toMeters(nextLat, nextLon);

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));

  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function isOnBorder(latitude, longitude) {
  const point = toMeters(latitude, longitude);

  for (let index = 0; index < CREEL_RING.length - 1; index += 1) {
    if (distanceToSegmentMeters(point, CREEL_RING[index], CREEL_RING[index + 1]) <= BORDER_TOLERANCE_METERS) {
      return true;
    }
  }

  return false;
}

function isPointInsideRing(latitude, longitude) {
  if (isOnBorder(latitude, longitude)) {
    return true;
  }

  let inside = false;

  for (let index = 0, previous = CREEL_RING.length - 2; index < CREEL_RING.length - 1; previous = index, index += 1) {
    const [currentLon, currentLat] = CREEL_RING[index];
    const [previousLon, previousLat] = CREEL_RING[previous];

    const crosses =
      currentLat > latitude !== previousLat > latitude &&
      longitude <
        ((previousLon - currentLon) * (latitude - currentLat)) / (previousLat - currentLat) +
          currentLon;

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
}

export function isValidCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function isPointInCreel(latitude, longitude) {
  if (!isValidCoordinate(latitude, longitude)) {
    return false;
  }

  return isPointInsideRing(latitude, longitude);
}
