package com.equipo3.dogalert.exception;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ErrorResponse(
        ErrorBody error
) {

    public record ErrorBody(
            String code,
            String message,
            UUID requestId,
            List<Map<String, Object>> details
    ) {}
}