package com.equipo3.dogalert.publiccontent.dto;

public record SafetyProtocolResponse(
        int version,
        String language,
        String title,
        String content
) {}