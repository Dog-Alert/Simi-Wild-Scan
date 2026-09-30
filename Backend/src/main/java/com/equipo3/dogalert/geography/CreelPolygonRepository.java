package com.equipo3.dogalert.geography;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CreelPolygonRepository
        extends JpaRepository<CreelPolygon, String> {

    Optional<CreelPolygon> findFirstByActiveTrueOrderByCreatedAtDesc();
}
