package com.equipo3.dogalert.report;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, Long> {
    Optional<Report> findByClientReportId(UUID clientReportId);
}