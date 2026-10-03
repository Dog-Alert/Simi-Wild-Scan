package com.equipo3.dogalert.report;

import static java.nio.charset.StandardCharsets.UTF_8;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

import org.springframework.stereotype.Component;

import com.equipo3.dogalert.report.dto.ReportCreateRequest;

/**
 * Calcula el hash canonico del payload de creacion.
 *
 * <p>Se usa para distinguir un reintento identico, que debe devolver el recurso
 * existente, de una llave de idempotencia reutilizada con otro contenido, que
 * debe responder 409. La seccion 6.6 del SDD lo exige.
 *
 * <p>El canon se construye con los campos en un orden fijo y separados por una
 * barra vertical, de modo que dos-envios con el mismo contenido produzcan
 * siempre el mismo hash sin depender del orden del JSON, del formato de los
 * numeros ni del mapa que uso el cliente al serializar.
 *
 * <p>La foto entra como SHA-256 de sus bytes, nunca como contenido: el hash debe
 * poder persistirse en una columna CHAR(64).
 */
@Component
public class PayloadHasher {

    private static final String NO_PHOTO = "";

    public String hash(ReportCreateRequest request, byte[] photo) {
        return sha256Hex(canonical(request, photo).getBytes(UTF_8));
    }

    /**
     * SHA-256 en hexadecimal, para persistir como CHAR(64) en la tabla de
     * idempotencia.
     */
    public String sha256Hex(byte[] content) {
        return HexFormat.of().formatHex(sha256(content));
    }

    /**
     * SHA-256 en bytescrudos, porque evidencias_reportes.SHA256 es BINARY(32) y
     * no admite la cadena hexadecimal.
     */
    public byte[] sha256(byte[] content) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(content);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 no disponible", exception);
        }
    }

    private String canonical(ReportCreateRequest request, byte[] photo) {
        return String.join(
                "|",
                String.valueOf(request.clientReportId()),
                String.valueOf(request.eventAt()),
                text(request.eventType()),
                text(request.severity()),
                text(request.certainty()),
                String.valueOf(request.dogCount()),
                text(request.size()),
                text(request.color()),
                String.valueOf(request.colorUndetermined()),
                text(request.collar()),
                text(request.description()),
                String.valueOf(request.location().latitude()),
                String.valueOf(request.location().longitude()),
                String.valueOf(request.consentAccepted()),
                photo == null ? NO_PHOTO : sha256Hex(photo));
    }

    private String text(String value) {
        return value == null ? "" : value;
    }
}