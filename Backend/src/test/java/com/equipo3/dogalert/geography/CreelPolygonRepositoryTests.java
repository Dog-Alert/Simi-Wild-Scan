package com.equipo3.dogalert.geography;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@ActiveProfiles("test")
class CreelPolygonRepositoryTests {

    @Autowired
    private CreelPolygonRepository polygonRepository;

    @Test
    void obtainsActivePolygon() {
        CreelPolygon polygon = new CreelPolygon();
        polygon.setVersion("CREEL-2026-V1");
        polygon.setName("Limite aprobado de Creel");
        polygon.setGeoJson(
                "{\"type\":\"Polygon\",\"coordinates\":[]}");
        polygon.setSha256(
                "0123456789abcdef0123456789abcdef"
                        + "0123456789abcdef0123456789abcdef");
        polygon.setActive(true);

        polygonRepository.saveAndFlush(polygon);

        assertTrue(
                polygonRepository
                        .findFirstByActiveTrueOrderByCreatedAtDesc()
                        .isPresent());
        assertEquals(
                "CREEL-2026-V1",
                polygonRepository
                        .findFirstByActiveTrueOrderByCreatedAtDesc()
                        .orElseThrow()
                        .getVersion());
    }
}
