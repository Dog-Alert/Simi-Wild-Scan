package com.equipo3.dogalert.report;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReportRepository extends JpaRepository<Report, Long> {

    Optional<Report> findByClientReportId(String clientReportId);

    boolean existsByClientReportId(String clientReportId);

    List<Report> findByStatusOrderByEventAtDesc(ReportStatus status);

    List<Report> findByEventAtBetweenOrderByEventAtDesc(
            Instant start,
            Instant end);

    List<Report> findByEventAtBetweenAndSizeAndColorAndCollar(
            Instant start,
            Instant end,
            DogSize size,
            String color,
            CollarPresence collar);
}
