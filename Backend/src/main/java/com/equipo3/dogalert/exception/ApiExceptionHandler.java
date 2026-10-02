package com.equipo3.dogalert.exception;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;

@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

    private static final String CODE_EMAIL_IN_USE = "EMAIL_ALREADY_REGISTERED";
    private static final String CODE_INVALID_CREDENTIALS = "INVALID_CREDENTIALS";
    private static final String CODE_LOCATION_OUTSIDE_CREEL = "LOCATION_OUTSIDE_CREEL";
    private static final String CODE_INVALID_PHOTO = "INVALID_PHOTO";
    private static final String CODE_INVALID_REPORT = "INVALID_REPORT";
    private static final String CODE_VALIDATION_ERROR = "VALIDATION_ERROR";
    private static final String CODE_INVALID_JSON = "INVALID_JSON";
    private static final String CODE_PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE";
    private static final String CODE_BAD_REQUEST = "BAD_REQUEST";

    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    public ResponseEntity<ErrorResponse> handleEmailAlreadyRegistered(
            EmailAlreadyRegisteredException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(error(CODE_EMAIL_IN_USE, exception.getMessage()));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleInvalidCredentials(
            InvalidCredentialsException exception) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(error(CODE_INVALID_CREDENTIALS, exception.getMessage()));
    }

    @ExceptionHandler(ReportLocationOutsideException.class)
    public ResponseEntity<ErrorResponse> handleReportLocationOutside(
            ReportLocationOutsideException exception) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(error(CODE_LOCATION_OUTSIDE_CREEL, exception.getMessage()));
    }

    @ExceptionHandler(InvalidPhotoException.class)
    public ResponseEntity<ErrorResponse> handleInvalidPhoto(InvalidPhotoException exception) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(error(CODE_INVALID_PHOTO, exception.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException exception) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(error(CODE_INVALID_REPORT, exception.getMessage()));
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {
        List<ErrorDetail> details = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> new ErrorDetail(
                        error.getField(),
                        Optional.ofNullable(error.getDefaultMessage()).orElse("invalid")))
                .toList();
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(error(CODE_VALIDATION_ERROR, "Datos invalidos", details));
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException exception,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(error(CODE_INVALID_JSON, "JSON invalido"));
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<ErrorResponse> handleMissingHeader(MissingRequestHeaderException exception) {
        String field = exception.getHeaderName();
        List<ErrorDetail> details = List.of(new ErrorDetail(field, "header is required"));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(error(CODE_BAD_REQUEST, "Header requerido", details));
    }

    @Override
    protected ResponseEntity<Object> handleMissingServletRequestPart(
            MissingServletRequestPartException exception,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {
        String part = exception.getRequestPartName();
        List<ErrorDetail> details = part == null ? List.of()
                : List.of(new ErrorDetail(part, "part is required"));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(error(CODE_BAD_REQUEST, "Parte multipart requerida", details));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        String name = exception.getName();
        List<ErrorDetail> details = List.of(new ErrorDetail(name, "valor invalido"));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(error(CODE_BAD_REQUEST, "Parametro invalido", details));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException exception) {
        List<ErrorDetail> details = exception.getConstraintViolations()
                .stream()
                .map(violation -> new ErrorDetail(
                        violation.getPropertyPath().toString(),
                        Optional.ofNullable(violation.getMessage()).orElse("invalid")))
                .toList();
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(error(CODE_VALIDATION_ERROR, "Datos invalidos", details));
    }

    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(error(CODE_PAYLOAD_TOO_LARGE, "El archivo supera el tamano permitido"));
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ErrorResponse> handleMultipartException(MultipartException exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(error(CODE_PAYLOAD_TOO_LARGE, "El archivo supera el tamano permitido"));
    }

    private ErrorResponse error(String code, String message) {
        return error(code, message, List.of());
    }

    private ErrorResponse error(String code, String message, List<ErrorDetail> details) {
        return new ErrorResponse(
                new ErrorBody(code, message, UUID.randomUUID().toString(), details),
                Instant.now());
    }

    public record ErrorResponse(ErrorBody error, Instant timestamp) {
    }

    public record ErrorBody(
            String code,
            String message,
            String requestId,
            List<ErrorDetail> details) {
    }

    public record ErrorDetail(String field, String message) {
    }
}