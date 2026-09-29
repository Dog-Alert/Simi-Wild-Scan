import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.card}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={10}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.logoSection}>
            <Text style={styles.logo}>🐾</Text>
            <Text style={styles.logoText}>DogAlert</Text>
          </View>

          <View style={styles.tabsSection}>
            <View style={styles.tabs}>
              <View style={[styles.tab, styles.tabActive]}>
                <Text style={[styles.tabLabel, styles.tabLabelActive]}>Iniciar sesión</Text>
              </View>

              {/* `hitSlop` amplia el area tactil sin cambiar el alto visible de
                  30 px que fija el diseno: sin esto el texto de 11 px era
                  practicamente intocable y el enlace no respondia. */}
              <TouchableOpacity
                onPress={onCreateAccount}
                style={styles.tab}
                accessibilityRole="button"
                accessibilityLabel="Crear cuenta"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID="tab-create-account"
              >
                <Text style={styles.tabLabel}>Crear cuenta</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.loginForm} testID="login-form">
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Correo electrónico</Text>
              <TextInput
                style={styles.inputContainer}
                placeholder="usuario@correo.com"
                placeholderTextColor="#9e9e9e"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
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
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <Text style={styles.forgotPassword}>¿Olvidaste tu contraseña?</Text>

            <TouchableOpacity
              style={styles.loginButton}
              onPress={handleLogin}
              accessibilityRole="button"
              testID="submit-login"
            >
              <Text style={styles.loginButtonText}>Iniciar sesión</Text>
            </TouchableOpacity>

            <Text style={styles.continueWith}>── o continúa con ──</Text>

            <View style={styles.socialButtons}>
              <TouchableOpacity style={styles.socialButton} accessibilityRole="button">
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} accessibilityRole="button">
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Se conservan los medidas de `css/` (Figma). El unico cambio respecto al
  // archivo original es que el ancho es fluido: antes `logoSection` y
  // `loginForm` mediam 192 px fijos y en el telefono el formulario se veia
  // como una columna angosta pegada a una esquina.
  screen: {
    flex: 1,
    width: '100%',
    backgroundColor: '#ffffff',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    marginLeft: -8,
  },
  backIcon: {
    fontSize: 26,
    color: '#2a2a2a',
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  logo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ff6b35',
    textAlign: 'center',
    lineHeight: 26,
    color: '#ffffff',
    fontSize: 14,
    overflow: 'hidden',
  },
  logoText: {
    color: '#2a2a2a',
    fontSize: 22,
    fontWeight: '800',
  },
  tabsSection: {
    paddingTop: 16,
    paddingLeft: 14,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    borderBottomWidth: 1.34,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1.34,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#ff6b35',
  },
  tabLabel: {
    color: '#9e9e9e',
    fontSize: 13,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#ff6b35',
    fontWeight: '700',
  },
  loginForm: {
    width: '100%',
    paddingTop: 16,
    paddingHorizontal: 14,
    gap: 12,
  },
  formField: {
    width: '100%',
    gap: 3,
  },
  fieldLabel: {
    color: '#5e5e5e',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  inputContainer: {
    width: '100%',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1.34,
    borderColor: '#e0e0e0',
    backgroundColor: '#f4f4f4',
    color: '#2a2a2a',
    fontSize: 14,
  },
  forgotPassword: {
    width: '100%',
    color: '#ff6b35',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    textAlign: 'right',
  },
  loginButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  continueWith: {
    width: '100%',
    color: '#9e9e9e',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  socialButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    height: 44,
    borderRadius: 9,
    borderWidth: 1.34,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonText: {
    color: '#5e5e5e',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
