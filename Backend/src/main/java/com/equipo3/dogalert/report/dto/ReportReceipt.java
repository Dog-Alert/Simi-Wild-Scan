package com.equipo3.dogalert.report.dto;

import java.util.UUID;

import com.equipo3.dogalert.report.ReportStatus;

public record ReportReceipt(Long id, UUID clientReportId, ReportStatus status, boolean replayed) {}