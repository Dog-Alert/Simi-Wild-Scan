package com.equipo3.dogalert.publiccontent;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1")
public class HealthController {

    @GetMapping("/health")
    public Map<String, String> getHealth() {
        return Map.of("status", "ok");
    }
}