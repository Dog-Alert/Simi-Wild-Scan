package com.equipo3.dogalert.exception;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    public ResponseEntity<ErrorResponse> handleEmailAlreadyRegistered(
            EmailAlreadyRegisteredException exception) {

        return createResponse(
                HttpStatus.CONFLICT,
                "EMAIL_ALREADY_REGISTERED",
                exception.getMessage(),
                List.of()
        );
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCredentials(
            InvalidCredentialsException exception) {

        return createResponse(
                HttpStatus.UNAUTHORIZED,
                "INVALID_CREDENTIALS",
                exception.getMessage(),
                List.of()
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException exception) {

        List<Map<String, Object>> details = exception
                .getBindingResult()
                .getFieldErrors()
                .stream()
                .map(fieldError -> Map.<String, Object>of(
                        "field", fieldError.getField(),
                        "message", fieldError.getDefaultMessage() == null
                                ? "Valor inválido"
                                : fieldError.getDefaultMessage()
                ))
                .toList();

        return createResponse(
                HttpStatus.UNPROCESSABLE_ENTITY,
                "VALIDATION_ERROR",
                "La solicitud contiene datos inválidos",
                details
        );
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableMessage(
            HttpMessageNotReadableException exception) {

        return createResponse(
                HttpStatus.BAD_REQUEST,
                "INVALID_JSON",
                "El cuerpo de la solicitud no contiene JSON válido",
                List.of()
        );
    }

    private ResponseEntity<ErrorResponse> createResponse(
            HttpStatus status,
            String code,
            String message,
            List<Map<String, Object>> details) {

        ErrorResponse.ErrorBody errorBody =
                new ErrorResponse.ErrorBody(
                        code,
                        message,
                        UUID.randomUUID(),
                        details
                );

        return ResponseEntity
                .status(status)
                .body(new ErrorResponse(errorBody));
    }
}