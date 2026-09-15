package com.equipo3.dogalert.publiccontent;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({
        PublicContentController.class,
        HealthController.class
})
@AutoConfigureMockMvc(addFilters = false)
class PublicContentControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void protocolsReturnPublicSafetyInformation() throws Exception {
        mockMvc.perform(get("/v1/public/protocols"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.language").value("es-MX"))
                .andExpect(jsonPath("$.title").isNotEmpty())
                .andExpect(jsonPath("$.content").isNotEmpty());
    }

    @Test
    void healthReturnsOk() throws Exception {
        mockMvc.perform(get("/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));
    }
}