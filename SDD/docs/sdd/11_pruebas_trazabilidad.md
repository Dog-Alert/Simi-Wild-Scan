# 11. Pruebas y trazabilidad

## 11.1 Estrategia

La pirámide incluye pruebas unitarias de dominio, integración con DB/servicios, contrato OpenAPI, E2E móvil, seguridad, rendimiento, recuperación, usabilidad y aceptación. Cada evidencia debe registrar versión, ambiente, datos, resultado, ticket y requisito.

## 11.2 Familias de pruebas

| ID | Familia | Alcance |
|---|---|---|
| T-AUTH | Identidad y autorización | Registro, sesión, roles, propiedad y timeout admin |
| T-REP | Reportes | Formulario, validación, foto, ubicación, edición y borrado |
| T-OFF | Offline | Cifrado, estados, recuperación, reintento e idempotencia |
| T-MOD | Moderación | Estados, checklist, motivos y publicación |
| T-MATCH | Coincidencias | 100 m, 10 min, características, hash y relaciones |
| T-PUB | Público/mapas | Verificados, aproximación, filtros, externos y avisos |
| T-ADM | Panel/métricas | Filtros, KPI y estimaciones |
| T-EXP | Exportación | Formatos, privacidad, filtros y auditoría |
| T-RET | Retención | Cinco años, 12 meses, borrado y evidencia |
| T-SEC | Seguridad | TLS, RBAC, archivos, secretos, cifrado y logs |
| T-PERF | Rendimiento | Disponibilidad, API, sync y heatmap |
| T-USA | Usabilidad/accesibilidad | Cinco participantes, tiempo y WCAG |
| T-REC | Recuperación | Respaldo, RPO/RTO y restauración |
| T-CI | Calidad | PR, pipeline, cobertura y trazabilidad |

## 11.3 Matriz de requisitos funcionales

| Requisito | Diseño principal | Prueba |
|---|---|---|
| RF-001 | API pública y navegación pública | T-PUB-001 |
| RF-002 | `POST /reports` sin identidad | T-REP-001 |
| RF-003 | autenticación JWT propia, perfil y aviso | T-AUTH-001 |
| RF-004 | autenticación JWT propia y almacenamiento seguro | T-AUTH-002 |
| RF-005 | Roles, guardas y rutas | T-AUTH-003 |
| RF-006 | Perfil/consentimiento cifrado | T-AUTH-004 |
| RF-007 | Prepantalla y protocolos | T-REP-002 |
| RF-008 | Catálogo `event_type` | T-REP-003 |
| RF-009 | Catálogo `severity` independiente | T-REP-004 |
| RF-010 | Invariantes y formulario | T-REP-005 |
| RF-011 | Catálogo `certainty` | T-REP-006 |
| RF-012 | Media opcional y UX segura | T-REP-007 |
| RF-013 | Señales EXIF privadas | T-REP-008 |
| RF-014 | Adaptador GPS/mapa manual | T-REP-009 |
| RF-015 | Validación cliente/servidor | T-REP-010 |
| RF-016 | Outbox SQLite cifrado | T-OFF-001 |
| RF-017 | Máquina de estados local | T-OFF-002 |
| RF-018 | Trabajador de sincronización | T-OFF-003 |
| RF-019 | Llave idempotente única | T-OFF-004 |
| RF-020 | Estado inicial `PENDING` | T-MOD-001 |
| RF-021 | Transiciones y motivo | T-MOD-002 |
| RF-022 | Checklist de moderación | T-MOD-003 |
| RF-023 | Relación `CORROBORATES` | T-MATCH-001 |
| RF-024 | Endpoints `/me/reports` | T-REP-011 |
| RF-025 | Edición, versión y `PENDING` | T-REP-012 |
| RF-026 | Borrado físico y auditoría mínima | T-RET-001 |
| RF-027 | Ausencia de capacidad anónima | T-REP-013 |
| RF-028 | Consulta MySQL y compatibilidad | T-MATCH-002 |
| RF-029 | Candidato no bloqueante | T-MATCH-003 |
| RF-030 | Hash/payload/idempotencia | T-MATCH-004 |
| RF-031 | Repositorio público filtrado | T-PUB-002 |
| RF-032 | Cuadrícula pública/heatmap | T-PUB-003 |
| RF-033 | Guardas admin y DTO privado | T-SEC-001 |
| RF-034 | Servicio común de filtros | T-PUB-004 |
| RF-035 | Aviso de cobertura | T-PUB-005 |
| RF-036 | Polígono versionado y bandera | T-PUB-006 |
| RF-037 | Bandeja administrativa | T-ADM-001 |
| RF-038 | Filtros administrativos | T-ADM-002 |
| RF-039 | Servicio de KPI verificados | T-ADM-003 |
| RF-040 | Política de estimación | T-ADM-004 |
| RF-041 | Flujo temporal de exportación | T-EXP-001 |
| RF-042 | Política de salida aproximada | T-EXP-002 |
| RF-043 | `Bitacora_Administrativa` protegida | T-SEC-002 |
| RF-044 | Política de reportes | T-RET-002 |
| RF-045 | Trabajo diario de anonimización | T-RET-003 |
| RF-046 | Protocolos versionados | T-PUB-007 |
| RF-047 | Sin permisos/servicio de notificación | T-SEC-003 |

## 11.4 Matriz de requisitos no funcionales

| Requisito | Diseño principal | Prueba/evidencia |
|---|---|---|
| RNF-PLAT-01 | React Native + TypeScript | Build Android/iOS |
| RNF-PLAT-02 | Rutas admin y RBAC API | T-AUTH-003 |
| RNF-PLAT-03 | Catálogo español/i18n | T-USA-001 |
| RNF-REN-01 | Cloud Run/Cloud SQL/monitoreo | Reporte mensual/ensayo |
| RNF-REN-02 | Outbox y payload sin foto | T-PERF-001 |
| RNF-REN-03 | API/índices/escalado | T-PERF-002 con 100 concurrentes |
| RNF-REN-04 | MySQL, caché/materialización | T-PERF-003 con cinco años |
| RNF-REN-05 | Compresión y validación doble | T-REP-007 |
| RNF-SEG-01 | TLS/entrada HTTPS de Cloud Run | T-SEC-004 |
| RNF-SEG-02 | RBAC/privilegio mínimo con JWT propia | T-SEC-005 |
| RNF-SEG-03 | Timeout admin 15 min | T-AUTH-005 |
| RNF-SEG-04 | Cloud SQL/fotos/respaldos cifrados | Evidencia configuración |
| RNF-SEG-05 | Cola offline cifrada, sin logs ni copias | T-SEC-007 |
| RNF-SEG-06 | Esquemas/rate limit/MIME/tamaño | T-SEC-008 |
| RNF-SEG-07 | Sin secretos en el repositorio | T-CI-001 |
| RNF-PRI-01 | Minimización/finalidad/retención | Revisión privacidad |
| RNF-PRI-02 | Aviso previo | T-AUTH-001 |
| RNF-PRI-03 | Contacto opcional/no público | T-AUTH-004 |
| RNF-PRI-04 | DTO público aproximado | T-PUB-003 |
| RNF-PRI-05 | Trabajo diario + auditoría redactada | T-RET-003 |
| RNF-USA-01 | Flujo guiado | Estudio con cinco participantes |
| RNF-USA-02 | Formulario optimizado | Mediana de tiempos |
| RNF-USA-03 | Sistema UI accesible | Auditoría WCAG móvil |
| RNF-USA-04 | Catálogo de errores claros | T-USA-002 |
| RNF-CON-01 | Outbox/idempotencia | T-OFF-004 |
| RNF-CON-02 | Backup diario 30 días | Evidencia GCP |
| RNF-CON-03 | Plan RPO/RTO | T-REC-001 |
| RNF-CON-04 | Restauración previa | T-REC-002 |
| RNF-MAN-01 | Protección de rama/PR | Evidencia GitHub |
| RNF-MAN-02 | Pipeline CI | T-CI-002 |
| RNF-MAN-03 | IDs SRS/Jira/pruebas | Auditoría de trazabilidad |
| RNF-MAN-04 | Cobertura crítica 70 % | Reporte CI |

## 11.5 Casos E2E mínimos

1. Visitante consulta protocolo y mapa aproximado.
2. Anónimo completa y envía reporte sin foto.
3. Anónimo guarda offline y sincroniza tras reinicio.
4. Adulto crea cuenta, inicia sesión y da/retira consentimiento.
5. Registrado crea, consulta, edita y borra un reporte.
6. Administrador verifica y el reporte aparece públicamente aproximado.
7. Administrador rechaza/archiva y desaparece de público.
8. Dos reportes compatibles se relacionan como corroborantes.
9. Reintento idéntico no duplica.
10. Filtros de panel, mapa y exportación producen poblaciones consistentes.
11. Trabajo de retención anonimiza cuenta vencida sin borrar reportes.
12. Respaldo se restaura dentro de objetivos.

## 11.6 Aceptación

- 47 RF con prueba aprobada.
- 33 RNF con evidencia o prueba aprobada.
- Cero defectos críticos o altos.
- Android e iOS funcionales.
- Restauración y seguridad verificadas.
- Michelle Gutiérrez ejecuta los flujos acordados y firma/acepta evidencia.
