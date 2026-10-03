package com.equipo3.dogalert.report;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportIdempotencyRepository extends JpaRepository<ReportIdempotency, Long> {

    Optional<ReportIdempotency> findByKey(String key);

    Optional<ReportIdempotency> findByClientReportId(String clientReportId);

    boolean existsByKey(String key);

    boolean existsByClientReportId(String clientReportId);
}