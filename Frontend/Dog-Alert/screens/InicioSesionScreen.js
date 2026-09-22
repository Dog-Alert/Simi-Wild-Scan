import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export default function IniciarSesionScreen({ onBack, onCreateAccount, onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (onLogin) {
      onLogin({ email, password });
    }
  };

  return (
    <View style={styles.iniciarSesion}>
      <View style={styles.iniciarSesionContainer}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.logoSection}>
          <Text style={styles.logo}>🐾</Text>
          <Text style={styles.logoText}>DogAlert</Text>
        </View>

        <View style={styles.tabsSection}>
          <View style={styles.tabs}>
            <Text style={[styles.tab, styles.tabActive]}>Iniciar sesión</Text>
            <TouchableOpacity onPress={onCreateAccount}>
              <Text style={styles.tab}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.loginForm}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Correo electrónico</Text>
            <TextInput
              style={styles.inputContainer}
              placeholder="usuario@correo.com"
              placeholderTextColor="#9e9e9e"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Contraseña</Text>
            <TextInput
              style={styles.inputContainer}
              placeholder="••••••••"
              placeholderTextColor="#9e9e9e"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Text style={styles.forgotPassword}>¿Olvidaste tu contraseña?</Text>

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Iniciar sesión</Text>
          </TouchableOpacity>

          <Text style={styles.continueWith}>── o continúa con ──</Text>

          <View style={styles.socialButtons}>
            <TouchableOpacity style={styles.socialButton}>
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialButton}>
              <Text style={styles.socialButtonText}>Apple</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  iniciarSesion: {
    flex: 1,
    minHeight: '100%',
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  iniciarSesionContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 4,
    paddingTop: 10,
  },
  backButton: {
    marginLeft: 12,
    marginBottom: 6,
  },
  backIcon: {
    fontSize: 22,
    color: '#2a2a2a',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 192,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  logo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
    textAlign: 'center',
    lineHeight: 20,
    color: '#fff',
    fontSize: 10,
    overflow: 'hidden',
  },
  logoText: {
    color: '#2a2a2a',
    fontSize: 14,
    fontWeight: '800',
  },
  tabsSection: {
    paddingTop: 16,
    paddingLeft: 14,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: 'fit-content',
    height: 29,
    borderBottomWidth: 1.34,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    width: 96,
    height: 30,
    textAlign: 'center',
    paddingVertical: 6,
    color: '#9e9e9e',
    fontSize: 11,
    fontWeight: '500',
    borderBottomWidth: 1.34,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    color: '#ff6b35',
    fontWeight: '700',
    borderBottomColor: '#ff6b35',
  },
  loginForm: {
    width: 192,
    paddingTop: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  formField: {
    width: '100%',
    gap: 3,
  },
  fieldLabel: {
    color: '#5e5e5e',
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 13.5,
  },
  inputContainer: {
    width: '100%',
    minHeight: 34,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.34,
    borderColor: '#e0e0e0',
    backgroundColor: '#f4f4f4',
    color: '#2a2a2a',
    fontSize: 11,
  },
  forgotPassword: {
    width: '100%',
    color: '#ff6b35',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 15,
    textAlign: 'right',
  },
  loginButton: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  continueWith: {
    width: '100%',
    color: '#9e9e9e',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
  socialButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  socialButton: {
    flex: 1,
    height: 34,
    borderRadius: 9,
    borderWidth: 1.34,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonText: {
    color: '#5e5e5e',
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 15,
  },
});

