package com.equipo3.dogalert.report;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class CreelBoundary {
    private final String version;
    private final List<double[]> polygon;

    public CreelBoundary(
            @Value("${dogalert.creel.boundary-version:creel-2026-01}") String version,
            @Value("${dogalert.creel.polygon:27.72,-107.68;27.72,-107.54;27.84,-107.54;27.84,-107.68}") String definition) {
        this.version = version;
        polygon = List.of(definition.split(";")).stream()
                .map(point -> point.split(","))
                .map(point -> new double[] { Double.parseDouble(point[0]), Double.parseDouble(point[1]) })
                .toList();
        if (polygon.size() < 3) {
            throw new IllegalArgumentException("El polígono de Creel debe tener al menos tres puntos");
        }
    }

    public String version() { return version; }

    public boolean contains(double latitude, double longitude) {
        boolean inside = false;
        for (int i = 0, j = polygon.size() - 1; i < polygon.size(); j = i++) {
            double[] current = polygon.get(i);
            double[] previous = polygon.get(j);
            boolean crosses = (current[1] > longitude) != (previous[1] > longitude);
            if (crosses && latitude < (previous[0] - current[0]) * (longitude - current[1])
                    / (previous[1] - current[1]) + current[0]) {
                inside = !inside;
            }
        }
        return inside;
    }
}