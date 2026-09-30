package com.equipo3.dogalert.evidence;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportEvidenceRepository
        extends JpaRepository<ReportEvidence, Long> {

    Optional<ReportEvidence> findByReportId(Long reportId);

    boolean existsByReportId(Long reportId);
}
