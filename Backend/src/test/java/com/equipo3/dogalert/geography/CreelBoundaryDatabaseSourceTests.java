package com.equipo3.dogalert.geography;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import com.equipo3.dogalert.report.CreelBoundary;
import com.equipo3.dogalert.report.CreelEvaluation;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Fuente de verdad del limite de Creel: la tabla manda y la configuracion respalda.
 *
 * <p>El poligono de la base se elige deliberadamente distinto al de configuracion
 * para que las pruebas no puedan pasar por casualidad. Un punto que solo cabe en el
 * de la base demuestra que se esta leyendo la tabla; uno que solo cabe en el de
 * configuracion demuestra que la tabla manda de verdad.
 *
 * <p>Usa una base en memoria propia para no depender del orden de ejecucion de las
 * demas pruebas.
 */
@SpringBootTest(properties =
        "spring.datasource.url=jdbc:h2:mem:creelboundary;MODE=MySQL;DB_CLOSE_DELAY=-1")
@ActiveProfiles("test")
class CreelBoundaryDatabaseSourceTests {

    /** Rectangle mas pequeno que el de configuracion, para que no coincidan. */
    private static final String POLIGONO_APROBADO =
            """
            {"type":"Polygon","coordinates":[[
              [-107.70,27.70],[-107.65,27.70],[-107.65,27.75],[-107.70,27.75],[-107.70,27.70]
            ]]}
            """;

    /** Solo cabe dentro del poligono de la base. */
    private static final double DENTRO_DE_LA_BASE = 27.71;
    private static final double DENTRO_DE_LA_BASE_LONGITUD = -107.69;

    /** Solo cabe dentro del poligono de configuracion. */
    private static final double DENTRO_DE_CONFIGURACION = 27.80;
    private static final double DENTRO_DE_CONFIGURACION_LONGITUD = -107.60;

    @Autowired private CreelPolygonRepository polygonRepository;
    @Autowired private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        polygonRepository.deleteAll();
    }

    /**
     * Instancia propia por prueba. El bean real es un singleton con memoria de la
     * geometria cargada, asi que compartirlo haria que el resultado dependiera del
     * orden en que se ejecutan las pruebas.
     */
    private CreelBoundary boundary() {
        return new CreelBoundary(
                polygonRepository,
                objectMapper,
                "configuracion-de-respaldo",
                "27.72,-107.68;27.72,-107.54;27.84,-107.54;27.84,-107.68",
                0);
    }

    @Test
    void sinPoligonoActivoUsaElRespaldoDeConfiguracion() {
        CreelEvaluation evaluation =
                boundary().evaluate(DENTRO_DE_CONFIGURACION, DENTRO_DE_CONFIGURACION_LONGITUD);

        assertThat(evaluation.polygonVersion()).isEqualTo("configuracion-de-respaldo");
        assertThat(evaluation.inside())
                .as("el punto entra en el poligono de configuracion")
                .isTrue();
    }

    @Test
    void elPoligonoActivoDeLaBaseMandaSobreLaConfiguracion() {
        guardar("CREEL-2026-V1", POLIGONO_APROBADO, true);

        CreelEvaluation dentroDeLaBase = boundary().evaluate(DENTRO_DE_LA_BASE, DENTRO_DE_LA_BASE_LONGITUD);
        CreelEvaluation dentroDeConfiguracion = boundary().evaluate(
                DENTRO_DE_CONFIGURACION,
                DENTRO_DE_CONFIGURACION_LONGITUD);

        assertThat(dentroDeLaBase.polygonVersion()).isEqualTo("CREEL-2026-V1");
        assertThat(dentroDeLaBase.inside())
                .as("este punto solo cabe en el poligono de la base")
                .isTrue();
        assertThat(dentroDeConfiguracion.inside())
                .as("este punto cabria en el de configuracion, pero manda la base")
                .isFalse();
    }

    @Test
    void unPoligonoInactivoNoSeUsa() {
        guardar("CREEL-2026-V1", POLIGONO_APROBADO, false);

        CreelEvaluation evaluation = boundary().evaluate(DENTRO_DE_LA_BASE, DENTRO_DE_LA_BASE_LONGITUD);

        assertThat(evaluation.polygonVersion()).isEqualTo("configuracion-de-respaldo");
        assertThat(evaluation.inside())
                .as("un poligono inactivo no debe decidir nada")
                .isFalse();
    }

    /**
     * El SHA-256 es un identificador del archivo aprobado, no una comprobacion de
     * integridad en lectura: la columna es JSON y el texto se normaliza al
     * guardarse, asi que un digest distinto casi siempre es normal. La politica
     * es avisar y seguir usando el poligono, para no descartar la geometria
     * oficial y devolver el limite aproximado.
 */
    @Test
    void unShaDistintoNoImpideUsarElPoligono() {
        guardarConSha("CREEL-2026-V1", POLIGONO_APROBADO, "a".repeat(64), true);

        CreelEvaluation evaluation = boundary().evaluate(DENTRO_DE_LA_BASE, DENTRO_DE_LA_BASE_LONGITUD);

        assertThat(evaluation.polygonVersion()).isEqualTo("CREEL-2026-V1");
        assertThat(evaluation.inside()).isTrue();
    }

    @Test
    void unGeoJsonIlegibleDescartaElPoligono() {
        guardar("CREEL-2026-V1", "{\"type\":\"Point\",\"coordinates\":[-107.68,27.78]}", true);

        CreelEvaluation evaluation = boundary().evaluate(DENTRO_DE_LA_BASE, DENTRO_DE_LA_BASE_LONGITUD);

        assertThat(evaluation.polygonVersion()).isEqualTo("configuracion-de-respaldo");
        assertThat(evaluation.inside()).isFalse();
    }

    private void guardar(String version, String geoJson, boolean active) {
        guardarConSha(version, geoJson, sha256(geoJson), active);
    }

    private void guardarConSha(String version, String geoJson, String sha256, boolean active) {
        CreelPolygon polygon = new CreelPolygon();
        polygon.setVersion(version);
        polygon.setName("Limite aprobado de Creel");
        polygon.setGeoJson(geoJson);
        polygon.setSha256(sha256);
        polygon.setActive(active);
        polygonRepository.saveAndFlush(polygon);
    }

    private static String sha256(String content) {
        try {
            // Compacto, como lo que devuelve una columna JSON al releerse.
            ObjectMapper mapper = new ObjectMapper();
            String canonical = mapper.writeValueAsString(mapper.readTree(content));
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }
}