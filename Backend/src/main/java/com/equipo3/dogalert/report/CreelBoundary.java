package com.equipo3.dogalert.report;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.equipo3.dogalert.geography.CreelGeometry;
import com.equipo3.dogalert.geography.CreelPolygon;
import com.equipo3.dogalert.geography.CreelPolygonRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Limite de Creel: poligono activo de la base de datos y respaldo en
 * configuracion.
 *
 * <p>La tabla {@code poligonos_creel} es la fuente de verdad. El respaldo existe
 * porque esa tabla esta pensada para quedarse vacia hasta que el equipo reciba el
 * GeoJSON aprobado (ver {@code V1.2_README.md}), de modo que hoy el camino de base
 * de datos casi nunca se ejecuta y el poligono de propiedades es el que decide.
 *
 * <p>El respaldo tampoco es un detalle: mientras la geometria oficial no llegue,
 * el limite configurado es aproximado y puede rechazar reportes legitimos del
 * borde del Creel. Conviene tenerlo presente al leer las metricas.
 */
@Component
public class CreelBoundary {

    private static final Logger log = LoggerFactory.getLogger(CreelBoundary.class);

    private static final Pattern SHA256 = Pattern.compile("^[0-9a-fA-F]{64}$");

    private final CreelPolygonRepository polygonRepository;
    private final ObjectMapper objectMapper;
    private final String fallbackVersion;
    private final CreelGeometry fallbackGeometry;
    private final Duration cacheTtl;

    private volatile Resolved resolved;

    public CreelBoundary(
            CreelPolygonRepository polygonRepository,
            ObjectMapper objectMapper,
            @Value("${dogalert.creel.boundary-version:creel-2026-01}") String fallbackVersion,
            @Value("${dogalert.creel.polygon:27.72,-107.68;27.72,-107.54;27.84,-107.54;27.84,-107.68}") String fallbackDefinition,
            @Value("${dogalert.creel.cache-ttl-seconds:3600}") long cacheTtlSeconds) {
        this.polygonRepository = polygonRepository;
        this.objectMapper = objectMapper;
        this.fallbackVersion = fallbackVersion;
        this.fallbackGeometry = CreelGeometry.fromLatitudeLongitude(parsePoints(fallbackDefinition));
        this.cacheTtl = Duration.ofSeconds(cacheTtlSeconds);
    }

    /**
     * Limite solo por configuracion. Pensado para pruebas unitarias, donde no hay
     * base de datos que consultar.
     */
    public static CreelBoundary fromProperties(String version, String definition) {
        return new CreelBoundary(null, new ObjectMapper(), version, definition, 3600);
    }

    public CreelEvaluation evaluate(double latitude, double longitude) {
        Resolved current = current();
        return new CreelEvaluation(
                current.geometry().contains(latitude, longitude),
                current.version());
    }

    /**
     * Lee el poligono una vez y lo reutiliza durante el TTL configurado. Consultar
     * la tabla en cada alta seria una consulta por peticion para un dato que solo
     * cambia cuando alguien carga una geometria nueva.
     */
    private Resolved current() {
        Resolved cached = resolved;

        if (cached != null && !cached.isStale(cacheTtl)) {
            return cached;
        }

        synchronized (this) {
            if (resolved == null || resolved.isStale(cacheTtl)) {
                resolved = load();
            }
            return resolved;
        }
    }

    private Resolved load() {
        Optional<CreelPolygon> active;

        try {
            active = polygonRepository.findFirstByActiveTrueOrderByCreatedAtDesc();
        } catch (RuntimeException exception) {
            // Un fallo de base no puede impedir crear reportes. Se avisa y se usa el
            // respaldo, que es lo que se estaria usando igual sin la tabla.
            log.error("No se pudo leer el poligono activo de Creel, se usara el respaldo", exception);
            return fallback("sin consultar la base");
        }

        if (active.isEmpty()) {
            return fallback("no hay poligono activo");
        }

        CreelPolygon polygon = active.get();

        warnIfDigestDiffers(polygon);

        try {
            return new Resolved(
                    polygon.getVersion(),
                    CreelGeometry.fromGeoJson(objectMapper, polygon.getGeoJson()),
                    "base de datos",
                    Instant.now());
        } catch (RuntimeException exception) {
            log.error(
                    "El GeoJSON del poligono {} no es utilizable, se usara el respaldo: {}",
                    polygon.getVersion(),
                    exception.getMessage());
            return fallback("geojson no utilizable");
        }
    }

    private Resolved fallback(String reason) {
        log.warn(
                "Se usara el poligono de configuracion {} porque {}",
                fallbackVersion,
                reason);
        return new Resolved(fallbackVersion, fallbackGeometry, "configuracion", Instant.now());
    }

    /**
 * Compara el digest guardado con el del GeoJSON leido, pero **solo avisa**.
 *
 * <p>Se opto por no rechazar por aqui a proposito. La columna es de tipo JSON, y
 * eso implica que el texto se guarda normalizado y que al enlazar un {@code String}
 * el valor llega como una cadena con el documento escapado dentro. Un SHA
 * calculado sobre el archivo que entrega el equipo casi nunca coincide con el de
 * lo que sale de la base, asi que rechazar aqui habria descartado la geometria
 * oficial y devuelto el poligono aproximado, que es justo lo contrario de lo que
 * se busca.
 *
 * <p>El digest queda entonces como identificador del archivo aprobado, con la
 * restriccion UNIQUE que ya impose la tabla, y no como comprobacion de integridad
 * en lectura. Ver la nota del contrato de base de datos.
 */
    private void warnIfDigestDiffers(CreelPolygon polygon) {
        String declared = polygon.getSha256();

        if (declared == null || !SHA256.matcher(declared).matches()) {
            log.warn(
                    "El poligono {} tiene un SHA-256 con formato invalido; se usa como identificador",
                    polygon.getVersion());
            return;
        }

        String document;
        try {
            document = CreelGeometry.unwrapDocument(objectMapper, polygon.getGeoJson());
        } catch (RuntimeException exception) {
            return;
        }

        if (!sha256Of(document).equalsIgnoreCase(declared)) {
            log.warn(
                    "El SHA-256 guardado en el poligono {} no coincide con el GeoJSON almacenado. "
                            + "Se usa el poligono igualmente: al ser la columna JSON el texto se "
                            + "normaliza al guardarse, asi que el digest no sirve para comparar",
                    polygon.getVersion());
        }
    }

    private static String sha256Of(String content) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(content.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 no disponible en esta plataforma", exception);
        }
    }

    private static List<double[]> parsePoints(String definition) {
        List<double[]> points = new ArrayList<>();
        for (String point : definition.split(";")) {
            String[] coordinates = point.split(",");
            points.add(new double[] {
                    Double.parseDouble(coordinates[0].trim()),
                    Double.parseDouble(coordinates[1].trim()) });
        }
        return points;
    }

    private record Resolved(String version, CreelGeometry geometry, String source, Instant loadedAt) {
        boolean isStale(Duration ttl) {
            return loadedAt.plus(ttl).isBefore(Instant.now());
        }
    }
}