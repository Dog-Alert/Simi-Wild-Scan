package com.equipo3.dogalert.report;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * El Requisito C del contrato pide un indice sobre reportes propios.
 *
 * <p>Este test existe porque el indice no se creaba: no habia ningun @Index en las
 * entidades y ddl-auto=update solo crea tablas y columnas. Nadie lo notaba porque
 * una consulta sin indice sigue respondiendo bien, solo que mas lento.
 */
@DataJpaTest
@ActiveProfiles("test")
class ReportIndexSchemaTests {

    private static final String TABLA = "reportes";
    private static final String INDICE = "idx_reportes_usuario_fecha";

    @Autowired
    private DataSource dataSource;

    @Test
    void creaElIndiceDeReportesPropiosEnElOrdenDelCursor() throws Exception {
        List<String> columnas = columnasDelIndice();

        assertThat(columnas)
                .as("el indice debe cubrir el filtro por usuario y el ORDER BY completo")
                .containsExactly("ID_USUARIO", "FECHA_EVENTO", "ID_REPORTE");
    }

    /**
     * Cada motor guarda los identificadores con su propia caja, H2 en mayusculas y
     * MySQL tal como se declaro, asi que se comparan sin distinguir. El nombre de la
     * tabla tampoco se puede fijar: getIndexInfo no avisa cuando no coincide y solo
     * devuelve cero filas, que es justo el fallo que este test busca detectar.
     */
    private List<String> columnasDelIndice() throws Exception {
        try (Connection conexion = dataSource.getConnection()) {
            List<Columna> encontradas = new ArrayList<>();

            DatabaseMetaData meta = conexion.getMetaData();
            String tabla = tablaReal(meta, conexion.getCatalog());

            try (var info = meta.getIndexInfo(conexion.getCatalog(), null, tabla, false, false)) {
                while (info.next()) {
                    String nombre = info.getString("INDEX_NAME");
                    String columna = info.getString("COLUMN_NAME");
                    if (nombre != null && nombre.equalsIgnoreCase(INDICE)
                            && columna != null) {
                        encontradas.add(
                                new Columna(columna, info.getShort("ORDINAL_POSITION")));
                    }
                }
            }

            assertThat(encontradas)
                    .as("el indice %s debe existir en la tabla %s", INDICE, TABLA)
                    .isNotEmpty();

            return encontradas.stream()
                    .sorted(Comparator.comparingInt(Columna::posicion))
                    .map(Columna::nombre)
                    .map(String::toUpperCase)
                    .toList();
        }
    }

    private String tablaReal(DatabaseMetaData meta, String catalogo) throws Exception {
        try (var tablas = meta.getTables(catalogo, null, "%", new String[] {"TABLE"})) {
            while (tablas.next()) {
                String nombre = tablas.getString("TABLE_NAME");
                if (nombre != null && nombre.equalsIgnoreCase(TABLA)) {
                    return nombre;
                }
            }
        }
        throw new IllegalStateException("La tabla " + TABLA + " no existe en el esquema");
    }

    private record Columna(String nombre, int posicion) {
    }
}