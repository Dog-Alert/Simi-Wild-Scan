package com.equipo3.dogalert.geography;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Poligono en formato GeoJSON. El foco esta en el orden de las coordenadas,
 * porque la tabla guarda [longitud, latitud] y la configuracion latitud,
 * longitud, y confundirlos daria un poligono en otro lado del planeta en vez de un
 * error visible.
 */
class CreelGeometryTests {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String RECTANGULO =
            """
            {"type":"Polygon","coordinates":[[
              [-107.70,27.70],[-107.65,27.70],[-107.65,27.75],[-107.70,27.75],[-107.70,27.70]
            ]]}
            """;

    @Test
    void reconoceElPuntoInterior() {
        CreelGeometry geometry = CreelGeometry.fromGeoJson(MAPPER, RECTANGULO);

        assertThat(geometry.contains(27.72, -107.68)).isTrue();
    }

    @Test
    void rechazaElPuntoExterior() {
        CreelGeometry geometry = CreelGeometry.fromGeoJson(MAPPER, RECTANGULO);

        assertThat(geometry.contains(27.80, -107.60)).isFalse();
    }

    /**
     * Si el poligono se leyera como [latitud, longitud] estos dos argumentos
     * apuntarian a un sitio distinto. La prueba falla si alguien invierte el orden
     * de los parametros publicos.
     */
    @Test
    void losArgumentosSonLatitudYLongitudEnEseOrden() {
        CreelGeometry geometry = CreelGeometry.fromGeoJson(MAPPER, RECTANGULO);

        assertThat(geometry.contains(-107.68, 27.72)).isFalse();
        assertThat(geometry.contains(27.72, -107.68)).isTrue();
    }

    @Test
    void unHuecoInteriorSacaAlPuntoDelPoligono() {
        String conHueco =
                """
                {"type":"Polygon","coordinates":[
                  [[-107.70,27.70],[-107.65,27.70],[-107.65,27.75],[-107.70,27.75],[-107.70,27.70]],
                  [[-107.69,27.71],[-107.66,27.71],[-107.66,27.74],[-107.69,27.74],[-107.69,27.71]]
                ]}
                """;

        CreelGeometry geometry = CreelGeometry.fromGeoJson(MAPPER, conHueco);

        assertThat(geometry.contains(27.725, -107.675))
                .as("el punto cae dentro del hueco")
                .isFalse();
        assertThat(geometry.contains(27.705, -107.675))
                .as("el punto cae en el contorno")
                .isTrue();
    }

    @Test
    void aceptaUnAnilloQueNoSeCierraSolo() {
        String sinCerrar =
                """
                {"type":"Polygon","coordinates":[[
                  [-107.70,27.70],[-107.65,27.70],[-107.65,27.75],[-107.70,27.75]
                ]]}
                """;

        CreelGeometry geometry = CreelGeometry.fromGeoJson(MAPPER, sinCerrar);

        assertThat(geometry.contains(27.72, -107.68)).isTrue();
    }

    @Test
    void rechazaUnGeoJsonQueNoEsPoligono() {
        assertThatThrownBy(() -> CreelGeometry.fromGeoJson(
                        MAPPER,
                        """
                        {"type":"Point","coordinates":[-107.68,27.78]}
                        """))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Polygon");
    }

    /**
     * Si el equipo guardara las coordenadas invertidas, la longitud habria caido
     * fuera de rango y el error lo dice, en vez de aceptar un poligono absurdo.
     */
    @Test
    void detectaCoordenadasInvertidas() {
        String invertido =
                """
                {"type":"Polygon","coordinates":[[
                  [27.70,-107.70],[27.70,-107.65],[27.75,-107.65],[27.75,-107.70]
                ]]}
                """;

        assertThatThrownBy(() -> CreelGeometry.fromGeoJson(MAPPER, invertido))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("longitud");
    }

    @Test
    void rechazaUnContornoConMenosDeTresVertices() {
        assertThatThrownBy(() -> CreelGeometry.fromGeoJson(
                        MAPPER,
                        """
                        {"type":"Polygon","coordinates":[[[-107.70,27.70],[-107.65,27.70]]]}
                        """))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /**
 * Una columna JSON enlazada desde un {@code String} guarda el documento como una
 * cadena escapada, no como objeto. Este es el estado real en que llega un poligono
 * insertado por la aplicacion, y sin la rama que lo desenvuelve la geometria
 * oficial no llegaria a leerse nunca.
 */
    @Test
    void aceptaElGeoJsonGuardadoComoCadenaEscapada() throws Exception {
        String documento =
                "{\"type\":\"Polygon\",\"coordinates\":[[[-107.70,27.70],[-107.65,27.70],"
                        + "[-107.65,27.75],[-107.70,27.75],[-107.70,27.70]]]}";
        String guardadoComoCadena = MAPPER.writeValueAsString(documento);

        CreelGeometry geometry = CreelGeometry.fromGeoJson(MAPPER, guardadoComoCadena);

        assertThat(geometry.contains(27.72, -107.68)).isTrue();
        assertThat(geometry.contains(27.80, -107.60)).isFalse();
    }

    @Test
    void elPoligonoDePropiedadesUsaLatitudLongitud() {
        CreelGeometry geometry = CreelGeometry.fromLatitudeLongitude(List.of(
                new double[] { 27.72, -107.68 },
                new double[] { 27.72, -107.54 },
                new double[] { 27.84, -107.54 },
                new double[] { 27.84, -107.68 }));

        assertThat(geometry.contains(27.78, -107.60)).isTrue();
        assertThat(geometry.contains(28.90, -107.10)).isFalse();
    }
}