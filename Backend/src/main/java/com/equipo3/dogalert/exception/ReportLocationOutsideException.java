package com.equipo3.dogalert.exception;

public class ReportLocationOutsideException extends RuntimeException {
    public ReportLocationOutsideException() {
        super("La ubicación está fuera del área de cobertura de Creel");
    }
}