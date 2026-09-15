package com.equipo3.dogalert.publiccontent;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.equipo3.dogalert.publiccontent.dto.SafetyProtocolResponse;

@RestController
@RequestMapping("/v1/public")
public class PublicContentController {

    @GetMapping("/protocols")
    public SafetyProtocolResponse getProtocols() {
        return new SafetyProtocolResponse(
                1,
                "es-MX",
                "Protocolo de seguridad ante perros sin responsable visible",
                """
                Mantén una distancia segura. No te acerques, persigas,
                alimentes ni intentes capturar al animal. Evita movimientos
                bruscos y no pongas en riesgo a otras personas o animales.
                Ante un peligro inmediato, aléjate del lugar y solicita ayuda
                a la autoridad correspondiente.
                """
        );
    }
}