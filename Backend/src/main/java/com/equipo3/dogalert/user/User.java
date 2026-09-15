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