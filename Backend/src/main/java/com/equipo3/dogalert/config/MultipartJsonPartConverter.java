package com.equipo3.dogalert.config;

import org.springframework.http.MediaType;
import org.springframework.http.converter.json.AbstractJackson2HttpMessageConverter;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Lee como JSON la parte "payload" de un multipart cuando el cliente no le
 * asigna Content-Type (React Native la envía como application/octet-stream).
 * Solo lectura: nunca se usa para escribir respuestas.
 */
@Component
public class MultipartJsonPartConverter extends AbstractJackson2HttpMessageConverter {

    public MultipartJsonPartConverter(ObjectMapper objectMapper) {
        super(objectMapper, MediaType.APPLICATION_OCTET_STREAM, MediaType.TEXT_PLAIN);
    }

    @Override
    protected boolean canWrite(MediaType mediaType) {
        return false;
    }
}