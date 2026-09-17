import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
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
    <View style={styles.crearCuenta}>
      <View style={styles.crearCuentaContainer}>
        <View style={styles.crearCuentaHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <Text style={styles.titulo}>Crear cuenta</Text>
        </View>

        <View style={styles.crearCuentaForm}>
          <View style={styles.formField}>
            <Text style={styles.fieldLabel}>Nombre completo</Text>
            <TextInput
              style={styles.inputContainer}
              placeholder="Nombre completo"
              placeholderTextColor="#9e9e9e"
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
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          <View style={styles.checkboxSection}>
            <View style={styles.checkboxOption}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setAdult((current) => !current)}
              >
                {adult ? <View style={styles.checkboxInner} /> : null}
              </TouchableOpacity>
              <Text style={styles.checkboxText}>Confirmo que soy mayor de edad</Text>
            </View>

            <View style={styles.checkboxOption}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setTerms((current) => !current)}
              >
                {terms ? <View style={styles.checkboxInner} /> : null}
              </TouchableOpacity>
              <Text style={styles.checkboxText}>
                Acepto el aviso de privacidad y términos de uso
              </Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
              <Text style={styles.createButtonText}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  crearCuenta: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  crearCuentaContainer: {
    flex: 1,
    width: '100%',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  crearCuentaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1.34,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 6,
  },
  backIcon: {
    fontSize: 22,
    color: '#2a2a2a',
  },
  titulo: {
    color: '#2a2a2a',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  crearCuentaForm: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 9,
  },
  formField: {
    width: 196,
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
  checkboxSection: {
    width: 196,
    paddingTop: 2,
    gap: 7,
  },
  checkboxOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    gap: 8,
  },
  checkbox: {
    width: 14,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.34,
    borderColor: '#ff6b35',
    backgroundColor: '#fff0eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  checkboxInner: {
    width: 6,
    height: 6,
    borderRadius: 2,
    backgroundColor: '#ff6b35',
  },
  checkboxText: {
    flex: 1,
    color: '#5e5e5e',
    fontSize: 10,
    lineHeight: 14,
  },
  buttonContainer: {
    width: 196,
    paddingTop: 4,
  },
  createButton: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19.5,
  },
});

