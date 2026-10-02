package com.equipo3.dogalert.geography;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Poligono de Creel en memoria, normalizado al formato GeoJSON.
 *
 * <p>Las posiciones se guardan como {@code [longitud, latitud]}, que es el orden
 * que exige la especificacion GeoJSON y el inverso del que usa la propiedad
 * {@code dogalert.creel.polygon}. Confundir ambos es el error clasico de esta
 * tabla, asi que al leer se comprueba que cada valor caiga en su rango y el error
 * dice que se esperaba un orden distinto.
 *
 * <p>El primer anillo es el contorno exterior y los siguientes son huecos: un
 * punto dentro de un hueco queda fuera del poligono.
 */
public final class CreelGeometry {

    private static final String POLYGON_TYPE = "Polygon";
    private static final double MIN_LONGITUDE = -180;
    private static final double MAX_LONGITUDE = 180;
    private static final double MIN_LATITUDE = -90;
    private static final double MAX_LATITUDE = 90;
    private static final int MINIMUM_RING_POSITIONS = 3;

    private final List<List<double[]>> rings;

    private CreelGeometry(List<List<double[]>> rings) {
        this.rings = rings;
    }

    /**
 * Devuelve el documento como texto plano, deshaciendo el envoltorio de cadena si
 * lo hay. Ver {@link #fromGeoJson} para cuando ocurre eso.
 */
    public static String unwrapDocument(ObjectMapper mapper, String storedValue) {
        JsonNode root = parse(mapper, storedValue);

        if (root != null && root.isTextual()) {
            return root.asText();
        }
        return storedValue;
    }

    /**
     * Lee un poligono desde lo que devuelve la columna.
     *
     * <p>Acepta las dos formas que se dan en la practica: un objeto JSON, que es
     * lo que hay si la fila se inserto como documento; y un JSON que en realidad
     * es una cadena con el documento escapado dentro, que es lo que ocurre cuando
     * Hibernate enlaza un {@code String} a una columna JSON. Sin esta segunda
     * rama, un poligono insertado por la aplicacion se leeria como una cadena y
     * ninguna validacion pasaria.
     */
    public static CreelGeometry fromGeoJson(ObjectMapper mapper, String storedValue) {
        JsonNode root = parse(mapper, unwrapDocument(mapper, storedValue));

        if (root == null || !root.isObject()) {
            throw new IllegalArgumentException("El GeoJSON del poligono debe ser un objeto");
        }
        if (!POLYGON_TYPE.equalsIgnoreCase(root.path("type").asText())) {
            throw new IllegalArgumentException(
                    "Solo se admite un GeoJSON de tipo " + POLYGON_TYPE + ", no de tipo "
                            + root.path("type").asText());
        }

        JsonNode coordinates = root.get("coordinates");
        if (coordinates == null || !coordinates.isArray() || coordinates.isEmpty()) {
            throw new IllegalArgumentException("El poligono no tiene coordenadas");
        }

        List<List<double[]>> rings = new ArrayList<>();
        for (JsonNode ring : coordinates) {
            rings.add(readRing(ring));
        }

        if (rings.get(0).size() < MINIMUM_RING_POSITIONS) {
            throw new IllegalArgumentException(
                    "El contorno del poligono necesita al menos tres vertices distintos");
        }

        return new CreelGeometry(List.copyOf(rings));
    }

    private static JsonNode parse(ObjectMapper mapper, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("El GeoJSON del poligono esta vacio");
        }
        try {
            return mapper.readTree(value);
        } catch (Exception exception) {
            throw new IllegalArgumentException("El GeoJSON del poligono no es un JSON valido", exception);
        }
    }

    /**
     * Poligono a partir de pares latitud/longitud, el orden de la propiedad de
     * configuracion. Se invierte aqui para que el resto de la clase trabaje siempre
     * con el orden del GeoJSON.
     */
    public static CreelGeometry fromLatitudeLongitude(List<double[]> points) {
        if (points.size() < MINIMUM_RING_POSITIONS) {
            throw new IllegalArgumentException("El poligono de Creel debe tener al menos tres puntos");
        }

        List<double[]> ring = new ArrayList<>(points.size());
        for (double[] point : points) {
            ring.add(new double[] { point[1], point[0] });
        }

        return new CreelGeometry(List.of(closeRing(ring)));
    }

    public boolean contains(double latitude, double longitude) {
        if (!inRing(longitude, latitude, rings.get(0))) {
            return false;
        }
        for (int ring = 1; ring < rings.size(); ring++) {
            if (inRing(longitude, latitude, rings.get(ring))) {
                return false;
            }
        }
        return true;
    }

    private static List<double[]> readRing(JsonNode ring) {
        if (ring == null || !ring.isArray() || ring.size() < MINIMUM_RING_POSITIONS) {
            throw new IllegalArgumentException("Un anillo del poligono necesita al menos tres posiciones");
        }

        List<double[]> positions = new ArrayList<>(ring.size());
        for (JsonNode position : ring) {
            if (!position.isArray() || position.size() < 2
                    || !position.get(0).isNumber() || !position.get(1).isNumber()) {
                throw new IllegalArgumentException(
                        "Cada posicion del GeoJSON debe ser [longitud, latitud] numerica");
            }
            positions.add(readPosition(position.get(0).asDouble(), position.get(1).asDouble()));
        }

        return closeRing(positions);
    }

    private static double[] readPosition(double longitude, double latitude) {
        if (longitude < MIN_LONGITUDE || longitude > MAX_LONGITUDE) {
            throw new IllegalArgumentException(
                    "Coordenada fuera de rango: " + longitude + " no puede ser una longitud. "
                            + "El GeoJSON espera [longitud, latitud]");
        }
        if (latitude < MIN_LATITUDE || latitude > MAX_LATITUDE) {
            throw new IllegalArgumentException(
                    "Coordenada fuera de rango: " + latitude + " no puede ser una latitud. "
                            + "El GeoJSON espera [longitud, latitud]");
        }
        return new double[] { longitude, latitude };
    }

    /** Cierra el anillo si el GeoJSON llega sin repetir el primer punto al final. */
    private static List<double[]> closeRing(List<double[]> positions) {
        double[] first = positions.get(0);
        double[] last = positions.get(positions.size() - 1);
        if (first[0] != last[0] || first[1] != last[1]) {
            positions.add(new double[] { first[0], first[1] });
        }
        return positions;
    }

    private static boolean inRing(double longitude, double latitude, List<double[]> ring) {
        boolean inside = false;
        for (int i = 0, j = ring.size() - 1; i < ring.size(); j = i++) {
            double[] current = ring.get(i);
            double[] previous = ring.get(j);
            boolean crosses = (current[1] > latitude) != (previous[1] > latitude);
            if (crosses && longitude < (previous[0] - current[0]) * (latitude - current[1])
                    / (previous[1] - current[1]) + current[0]) {
                inside = !inside;
            }
        }
        return inside;
    }
}