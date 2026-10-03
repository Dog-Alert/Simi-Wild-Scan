package com.equipo3.dogalert.user;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "Usuarios")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ID_Usuario")
    private Long id;

    @Column(name = "Nombre", length = 150)
    private String name;

    @Column(name = "Correo", nullable = false, unique = true, length = 254)
    private String email;

    @Column(name = "Contrasena_Hash", nullable = false, length = 255)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "Rol", nullable = false)
    private Role role = Role.USUARIO;

    @Column(name = "Mayor_Edad", nullable = false)
    private boolean adultConfirmed;

    @Column(name = "Telefono", length = 25)
    private String phone;

    @Column(name = "Contacto_Autorizado", nullable = false)
    private boolean contactAuthorized;

    @Column(name = "Aviso_Privacidad_Aceptado", nullable = false)
    private boolean privacyAccepted;

    @Column(name = "Ultimo_Login")
    private Instant lastLogin;

    @Column(name = "Ultima_Actividad", nullable = false)
    private Instant lastActivity;

    @Column(name = "Datos_Anonimizados", nullable = false)
    private boolean dataAnonymized;

    @Enumerated(EnumType.STRING)
    @Column(name = "Estado_Cuenta", nullable = false)
    private AccountStatus accountStatus = AccountStatus.ACTIVA;

    @Column(name = "Fecha_Creacion", nullable = false)
    private Instant createdAt;

    @Column(name = "Fecha_Actualizacion", nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void beforeInsert() {
        Instant now = Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        if (lastActivity == null) {
            lastActivity = now;
        }

        updatedAt = now;
    }

    @PreUpdate
    public void beforeUpdate() {
        updatedAt = Instant.now();
    }

    /**
     * RF-044 del SRS: los datos personales se eliminan despues de 12 meses sin un
     * inicio de sesion exitoso, y un login nuevo reinicia el periodo. El corte se
     * mide sobre Ultimo_Login y no sobre Ultima_Actividad como propone el SDD
     * 9.5, porque el SRS habla de inicio de sesion, no de cualquier actividad.
     *
     * Quien nunca ha iniciado sesion se mide desde Fecha_Creacion, que para esas
     * cuentas cumple el mismo papel que el primer login.
     */
    public boolean isAnonymizationDue(Instant cutoff) {
        return !dataAnonymized
                && accountStatus != AccountStatus.ANONIMIZADA
                && role == Role.USUARIO
                && retentionReference().isBefore(cutoff);
    }

    /**
     * Elimina los datos personales sin tocar la fila. RF-043 obliga a conservar
     * los reportes que el autor no borro, y esos reportes siguen apuntando a este
     * identificador, asi que la cuenta no puede desaparecer.
     *
     * El correo no puede quedar en null porque la columna es NOT NULL y UNIQUE, y
     * la contraseña tampoco, por NOT NULL. Por eso el llamante debe pasar un
     * correo centinela unico por cuenta y un hash que ninguna contraseña pueda
     * satisfacer.
     */
    public void anonymizePersonalData(String anonymousEmail, String unusablePasswordHash) {
        this.name = null;
        this.email = anonymousEmail;
        this.phone = null;
        this.passwordHash = unusablePasswordHash;
        this.adultConfirmed = false;
        this.contactAuthorized = false;
        this.privacyAccepted = false;
        this.dataAnonymized = true;
        this.accountStatus = AccountStatus.ANONIMIZADA;
    }

    private Instant retentionReference() {
        return lastLogin != null ? lastLogin : createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public Role getRole() {
        return role;
    }

    public boolean isAdultConfirmed() {
        return adultConfirmed;
    }

    public String getPhone() {
        return phone;
    }

    public boolean isContactAuthorized() {
        return contactAuthorized;
    }

    public boolean isPrivacyAccepted() {
        return privacyAccepted;
    }

    public Instant getLastLogin() {
        return lastLogin;
    }

    public Instant getLastActivity() {
        return lastActivity;
    }

    public boolean isDataAnonymized() {
        return dataAnonymized;
    }

    public AccountStatus getAccountStatus() {
        return accountStatus;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public void setAdultConfirmed(boolean adultConfirmed) {
        this.adultConfirmed = adultConfirmed;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public void setContactAuthorized(boolean contactAuthorized) {
        this.contactAuthorized = contactAuthorized;
    }

    public void setPrivacyAccepted(boolean privacyAccepted) {
        this.privacyAccepted = privacyAccepted;
    }

    public void setLastLogin(Instant lastLogin) {
        this.lastLogin = lastLogin;
    }

    public void setLastActivity(Instant lastActivity) {
        this.lastActivity = lastActivity;
    }

    public void setDataAnonymized(boolean dataAnonymized) {
        this.dataAnonymized = dataAnonymized;
    }

    public void setAccountStatus(AccountStatus accountStatus) {
        this.accountStatus = accountStatus;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

}