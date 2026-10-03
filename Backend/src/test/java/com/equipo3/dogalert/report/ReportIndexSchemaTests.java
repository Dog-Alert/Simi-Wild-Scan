package com.equipo3.dogalert.report;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;

import jakarta.validation.ConstraintViolationException;

/**
 * Lee los metadatos del esquema y falla si los objetos que sostienen la
 * idempotencia y los reportes propios no existen.
 *
 * <p>Existe por una razón concreta: en este repositorio las migraciones NO se
 * ejecutan automáticamente, así que un índice o una restricción escrita solo en
 * SQL puede no llegar a crearse nunca, sin error visible. El criterio de
 * aceptación «los reintentos no duplican reportes» deja de cumplirse y nadie se
 * entera.
 *
 * <p>Por eso estos objetos se declaran en las ENTIDADES ({@code @Index},
 * {@code unique = true}), que Hibernate sí crea al arrancar, y este test vigila
 * que la declaración siga ahí. Las migraciones de
 * {@code Backend/src/database/migrations/} replican los mismos nombres para que
 * las dos vías converjan.
 *
 * <p>El esquema de prueba lo genera Hibernate ({@code ddl-auto=create-drop} en
 * {@code application-test.properties}), así que lo que se comprueba aquí es la
 * entidad, no el SQL.
 */
@DataJpaTest
@ActiveProfiles("test")
class ReportIndexSchemaTests {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private ReportIdempotencyRepository idempotencyRepository;

    // -----------------------------------------------------------------------
    // Requisito C · índice de reportes propios
    // -----------------------------------------------------------------------

    @Test
    void existeIndiceDeReportesPropiosConSusTresColumnasEnOrden() throws SQLException {
        Map<String, List<String>> indices = indicesDe("REPORTES");

        assertTrue(
                indices.containsKey("idx_reportes_usuario_fecha"),
                "falta el indice idx_reportes_usuario_fecha declarado en Report.java. "
                        + "Sin el, GET /v1/me/reports recorre la tabla completa.");

        assertEquals(
                List.of("ID_USUARIO", "FECHA_EVENTO", "ID_REPORTE"),
                indices.get("idx_reportes_usuario_fecha"),
                "idx_reportes_usuario_fecha debe cubrir el filtro por ID_Usuario y el "
                        + "orden (Fecha_Evento, ID_Reporte). Con dos columnas, los empates "
                        + "de Fecha_Evento habrian que resolverse aparte.");
    }

    @Test
    void elIndiceDeReportesPropiosNoEsUnico() throws SQLException {
        assertFalse(
                indicesUnicosDe("REPORTES").containsKey("idx_reportes_usuario_fecha"),
                "idx_reportes_usuario_fecha no debe ser UNIQUE: GET /v1/me/reports "
                        + "lista, no busca por llave.");
    }

    // -----------------------------------------------------------------------
    // Requisito A · las dos unicidades que sostienen la idempotencia
    // -----------------------------------------------------------------------

    @Test
    void existenLasDosUnicidadesQueSostienenLaIdempotencia() throws SQLException {
        List<List<String>> unicas = new ArrayList<>(unicasDe("IDEMPOTENCIA_REPORTES").values());

        assertTrue(
                unicas.contains(List.of("LLAVE")),
                "falta la restriccion UNIQUE sobre Llave. Es la que detiene la carrera "
                        + "entre dos peticiones simultaneas con la misma llave: sin ella el "
                        + "pre chequeo deja pasar a las dos y se crean dos reportes.");

        assertTrue(
                unicas.contains(List.of("ID_REPORTE_CLIENTE")),
                "falta la restriccion UNIQUE sobre ID_Reporte_Cliente. Un cliente puede "
                        + "cambiar solo uno de los dos valores, asi que la unicidad atempeta "
                        + "no basta.");
    }

    @Test
    void elIndiceDeIdempotenciaCubreLaColumnaDelReporte() throws SQLException {
        assertEquals(
                List.of("ID_REPORTE"),
                indicesDe("IDEMPOTENCIA_REPORTES").get("idx_idempotencia_reporte"));
    }

    @Test
    void elHashDelPayloadEsObligatorioYLasReferenciasSonOpcionales() throws SQLException {
        Map<String, String> nulabilidad = columnasDe("IDEMPOTENCIA_REPORTES");

        assertEquals(
                "NO",
                nulabilidad.get("HASH_PAYLOAD"),
                "Hash_Payload no puede ser NULL: es lo que distingue un reintento "
                        + "identico (200) de una llave reutilizada con otro contenido (409).");

        assertEquals(
                "YES",
                nulabilidad.get("ID_USUARIO"),
                "ID_Usuario admite NULL porque un reporte puede ser anonimo.");

        assertEquals(
                "YES",
                nulabilidad.get("ID_REPORTE"),
                "ID_Reporte admite NULL porque es la marca de que el autor borro el "
                        + "reporte: el UUID sigue consumido y el reintento responde 410.");
    }

    @Test
    void idUsuarioNoDeclaraLlaveForanea() throws SQLException {
        List<String> referenciadas = new ArrayList<>();

        try (Connection conexion = dataSource.getConnection();
                ResultSet rs =
                        conexion.getMetaData()
                                .getImportedKeys(
                                        conexion.getCatalog(), null, "IDEMPOTENCIA_REPORTES")) {

            while (rs.next()) {
                referenciadas.add(rs.getString("FKCOLUMN_NAME"));
            }
        }

        assertFalse(
                referenciadas.contains("ID_USUARIO"),
                "ID_Usuario no debe tener llave foranea: Usuarios.ID_Usuario es INT y esta "
                        + "columna es BIGINT, una combinacion que MySQL rechaza. Ademas el "
                        + "contrato pide conservar la reserva aunque la cuenta se borre.");

        assertTrue(
                referenciadas.contains("ID_REPORTE"),
                "ID_Reporte si debe referenciar a Reportes: al borrarse el reporte la "
                        + "fila de la reserva se queda, y eso es justamente lo que marca "
                        + "el 410 REPORT_DELETED.");
    }

    // -----------------------------------------------------------------------
    // La restriccion, probada de verdad y no solo por metadatos
    // -----------------------------------------------------------------------

    @Test
    void rechazaDosReservasConLaMismaLlave() {
        String llave = UUID.randomUUID().toString();
        idempotencyRepository.saveAndFlush(reserva(llave, UUID.randomUUID().toString()));

        ReportIdempotency duplicada = reserva(llave, UUID.randomUUID().toString());

        assertThrows(
                DataIntegrityViolationException.class,
                () -> idempotencyRepository.saveAndFlush(duplicada),
                "sin el UNIQUE sobre Llave el pre chequeo deja pasar a las dos peticiones "
                        + "simultaneas y se crean dos reportes");
    }

    @Test
    void rechazaDosReservasConElMismoClientReportId() {
        String clientReportId = UUID.randomUUID().toString();
        idempotencyRepository.saveAndFlush(reserva(UUID.randomUUID().toString(), clientReportId));

        ReportIdempotency duplicada =
                reserva(UUID.randomUUID().toString(), clientReportId);

        assertThrows(
                DataIntegrityViolationException.class,
                () -> idempotencyRepository.saveAndFlush(duplicada),
                "un cliente puede cambiar solo uno de los dos valores, asi que la "
                        + "unicidad atempeta no basta");
    }

    @Test
    void laReservaDeUnaLlaveSeConsultaPorLlaveYPorClientReportId() {
        String llave = UUID.randomUUID().toString();
        String clientReportId = UUID.randomUUID().toString();

        idempotencyRepository.saveAndFlush(reserva(llave, clientReportId));

        assertTrue(idempotencyRepository.existsByKey(llave));
        assertTrue(idempotencyRepository.existsByClientReportId(clientReportId));
        assertEquals(
                clientReportId,
                idempotencyRepository.findByKey(llave).orElseThrow().getClientReportId());
    }

    @Test
    void unaReservaSinHashNoSePersiste() {
        ReportIdempotency sinHash = reserva(UUID.randomUUID().toString());
        sinHash.setPayloadHash(null);

        assertThrows(
                ConstraintViolationException.class,
                () -> idempotencyRepository.saveAndFlush(sinHash),
                "Hash_Payload es lo que distingue un reintento identico (200) de una "
                        + "llave reutilizada con otro contenido (409)");
    }

    // -----------------------------------------------------------------------
    // Utilidades
    // -----------------------------------------------------------------------

    private ReportIdempotency reserva(String llave) {
        return reserva(llave, UUID.randomUUID().toString());
    }

    private ReportIdempotency reserva(String llave, String clientReportId) {
        ReportIdempotency reserva = new ReportIdempotency();
        reserva.setKey(llave);
        reserva.setClientReportId(clientReportId);
        reserva.setPayloadHash("a".repeat(64));
        reserva.setHttpStatus(201);
        return reserva;
    }

    /**
     * Índices de una tabla, como nombre normalizado a minúsculas y columnas en
     * el orden en que el motor las reporta.
     *
     * <p>El nombre se normaliza porque H2 convierte los identificadores sin
     * comillas a mayúsculas, mientras que en Cloud SQL/MySQL se crean con el
     * nombre tal cual está escrito en la migración. Comparar en minúsculas hace
     * que el test valida la intención y no la convención de cada motor.
     */
    private Map<String, List<String>> indicesDe(String tabla) throws SQLException {
        return indicesDe(tabla, false);
    }

    private Map<String, List<String>> indicesUnicosDe(String tabla) throws SQLException {
        return indicesDe(tabla, true);
    }

    private Map<String, List<String>> indicesDe(String tabla, boolean soloUnicos)
            throws SQLException {
        Map<String, List<String>> porIndice = new LinkedHashMap<>();

        try (Connection conexion = dataSource.getConnection();
                ResultSet rs =
                        conexion.getMetaData()
                                .getIndexInfo(conexion.getCatalog(), null, tabla, soloUnicos, false)) {

            while (rs.next()) {
                String nombre = rs.getString("INDEX_NAME");
                if (nombre != null) {
                    porIndice
                            .computeIfAbsent(nombre.toLowerCase(), clave -> new ArrayList<>())
                            .add(rs.getString("COLUMN_NAME"));
                }
            }
        }

        return porIndice;
    }

    /** Columnas de las restricciones UNIQUE, para comparar por columna y no por nombre. */
    private Map<String, List<String>> unicasDe(String tabla) throws SQLException {
        return indicesUnicosDe(tabla);
    }

    private Map<String, String> columnasDe(String tabla) throws SQLException {
        Map<String, String> porColumna = new LinkedHashMap<>();

        try (Connection conexion = dataSource.getConnection();
                Statement sentencia = conexion.createStatement();
                ResultSet rs = sentencia.executeQuery("SELECT * FROM " + tabla + " WHERE 1 = 0")) {

            ResultSetMetaData meta = rs.getMetaData();
            for (int i = 1; i <= meta.getColumnCount(); i++) {
                porColumna.put(
                        meta.getColumnName(i).toUpperCase(),
                        meta.isNullable(i) == ResultSetMetaData.columnNoNulls ? "NO" : "YES");
            }
        }

        return porColumna;
    }
}