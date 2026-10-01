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

export default function CrearCuentaScreen({ onBack, onCreate }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);

  const handleCreate = () => {
    if (onCreate) {
      onCreate({ fullName, email, password, confirmPassword, adult, terms });
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
        <View style={styles.crearCuentaHeader}>
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={10}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <Text style={styles.titulo}>Crear cuenta</Text>
        </View>

        <View style={styles.crearCuentaForm} testID="register-form">
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Nombre completo</Text>
            <TextInput
              style={styles.inputContainer}
              placeholder="Nombre completo"
              placeholderTextColor="#9e9e9e"
              autoComplete="name"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Correo electrónico</Text>
            <TextInput
              style={styles.inputContainer}
              placeholder="Correo electrónico"
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
              placeholder="Contraseña"
              placeholderTextColor="#9e9e9e"
              secureTextEntry
              autoComplete="password-new"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Confirmar contraseña</Text>
            <TextInput
              style={styles.inputContainer}
              placeholder="Confirmar contraseña"
              placeholderTextColor="#9e9e9e"
              secureTextEntry
              autoComplete="password-new"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          <View style={styles.checkboxSection}>
            {/* `hitSlop` amplia el area tactil del checkbox de 14 px del
                diseno sin alterar su tamano visible. */}
            <View style={styles.checkboxOption}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setAdult((current) => !current)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: adult }}
                accessibilityLabel="Confirmo que soy mayor de edad"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {adult ? <View style={styles.checkboxInner} /> : null}
              </TouchableOpacity>
              <Text style={styles.checkboxText}>Confirmo que soy mayor de edad</Text>
            </View>

            <View style={styles.checkboxOption}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setTerms((current) => !current)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: terms }}
                accessibilityLabel="Acepto el aviso de privacidad y terminos de uso"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {terms ? <View style={styles.checkboxInner} /> : null}
              </TouchableOpacity>
              <Text style={styles.checkboxText}>
                Acepto el aviso de privacidad y términos de uso
              </Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleCreate}
              accessibilityRole="button"
              testID="submit-create-account"
            >
              <Text style={styles.createButtonText}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Se conservan las medidas de `css/` (Figma). `formField`, `checkboxSection`
  // y `buttonContainer` tenian `width: 196` fijo, por eso el formulario se
  // veia angosto y pegado a la izquierda; ahora el ancho es fluido.
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
  crearCuentaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1.34,
    borderBottomColor: '#e0e0e0',
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
  titulo: {
    color: '#2a2a2a',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  crearCuentaForm: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
  checkboxSection: {
    width: '100%',
    paddingTop: 2,
    gap: 10,
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.34,
    borderColor: '#ff6b35',
    backgroundColor: '#fff0eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxInner: {
    width: 9,
    height: 9,
    borderRadius: 3,
    backgroundColor: '#ff6b35',
  },
  checkboxText: {
    flex: 1,
    color: '#5e5e5e',
    fontSize: 13,
    lineHeight: 18,
  },
  buttonContainer: {
    width: '100%',
    paddingTop: 4,
  },
  createButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
});
