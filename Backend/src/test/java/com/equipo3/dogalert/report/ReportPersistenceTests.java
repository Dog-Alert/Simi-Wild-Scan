package com.equipo3.dogalert.report;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class ReportPersistenceTests {

    @Test
    void reportStoresTheCurrentScalarContract() {
        Report report = validReport();

        assertNull(report.getUserId());
        assertFalse(report.isHasPhoto());
        assertEquals(ReportStatus.PENDING, report.getStatus());
        assertEquals(27.75d, report.getLatitude());
        assertEquals(-107.633d, report.getLongitude());
        assertEquals("CREEL-2026-V1", report.getBoundaryVersion());
    }

    @Test
    void reportCanRepresentAUserOwnedReportWithPhoto() {
        Report report = validReport();
        report.setUserId(17L);
        report.setHasPhoto(true);

        assertEquals(17L, report.getUserId());
        assertTrue(report.isHasPhoto());
    }

    private Report validReport() {
        Report report = new Report();
        report.setClientReportId(UUID.randomUUID());
        report.setEventAt(Instant.parse("2026-09-28T18:00:00Z"));
        report.setEventType("SIGHTING");
        report.setSeverity("LOW");
        report.setCertainty("MEDIUM");
        report.setDogCount(2);
        report.setSize("MEDIUM");
        report.setColor("cafe");
        report.setColorUndetermined(false);
        report.setCollar("UNDETERMINED");
        report.setDescription(
                "Dos perros sin responsable aparente observados cerca del camino.");
        report.setLatitude(27.75d);
        report.setLongitude(-107.633d);
        report.setBoundaryVersion("CREEL-2026-V1");
        report.setConsentAccepted(true);
        report.setStatus(ReportStatus.PENDING);
        return report;
    }
}
