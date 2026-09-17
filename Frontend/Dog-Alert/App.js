import React from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import InicioScreen from './screens/InicioScreen';
import IniciarSesionScreen from './screens/InicioSesionScreen';
import CrearCuentaScreen from './screens/CrearCuentaScreen';
import ProtocoloDeSeguridad from './screens/ProtocoloDeSeguridad';
import PublicInfoScreen from './screens/PublicInfoScreen';
import { useAuth } from './hooks/UseAuth';

const Stack = createNativeStackNavigator();

export default function App() {
  const { user, login, register, logout, loading, error, response, clearError } = useAuth();

  const handleLogin = async (payload, navigation) => {
    const result = await login(payload);
    if (result) {
      navigation.navigate('Inicio');
    }
  };

  const handleRegister = async (payload, navigation) => {
    const result = await register(payload);
    if (result) {
      navigation.navigate('Inicio');
    }
  };

  const handleLogout = async (navigation) => {
    const ok = await logout();
    if (ok) {
      navigation.navigate('Inicio');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Inicio">
            {(props) => (
              <>
                {loading && (
                  <View style={styles.loader}>
                    <ActivityIndicator size="large" color="#2E7D32" />
                    <Text style={styles.loaderText}>Cargando...</Text>
                  </View>
                )}

                {error ? (
                  <View style={styles.errorBox}>
                    <Text style={styles.error}>{error}</Text>
                    <TouchableOpacity onPress={clearError}>
                      <Text style={styles.errorClose}>Cerrar</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {response && user ? (
                  <Text style={styles.success}>Bienvenido: {user.email || 'usuario'}</Text>
                ) : null}

                {user && (
                  <View style={styles.userBar}>
                    <Text style={styles.userBarText}>Sesión activa</Text>
                    <TouchableOpacity
                      style={styles.logoutButton}
                      onPress={() => handleLogout(props.navigation)}
                    >
                      <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <InicioScreen
                  {...props}
                  onStart={() => props.navigation.navigate('Login')}
                  onAnonymous={() => props.navigation.navigate('Protocolo')}
                  onPublicInfo={() => props.navigation.navigate('InfoPublica')}
                />
              </>
            )}
          </Stack.Screen>

          <Stack.Screen name="Login">
            {(props) => (
              <IniciarSesionScreen
                onBack={() => props.navigation.navigate('Inicio')}
                onCreateAccount={() => props.navigation.navigate('CrearCuenta')}
                onLogin={(payload) => handleLogin(payload, props.navigation)}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="CrearCuenta">
            {(props) => (
              <CrearCuentaScreen
                onBack={() => props.navigation.navigate('Login')}
                onCreate={(payload) => handleRegister(payload, props.navigation)}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Protocolo">
            {(props) => (
              <ProtocoloDeSeguridad
                onBack={() => props.navigation.navigate('Inicio')}
                onLogout={() => handleLogout(props.navigation)}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="InfoPublica">
            {(props) => (
              <PublicInfoScreen
                onBack={() => props.navigation.navigate('Inicio')}
                onLogout={() => handleLogout(props.navigation)}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loader: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 6,
    color: '#2e7d32',
    fontSize: 12,
  },
  errorBox: {
    position: 'absolute',
    top: 16,
    left: 12,
    right: 12,
    zIndex: 11,
    padding: 8,
    backgroundColor: '#fdecea',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  error: {
    color: '#b3261e',
    textAlign: 'center',
    flex: 1,
  },
  errorClose: {
    color: '#b3261e',
    fontWeight: '700',
    marginLeft: 8,
  },
  success: {
    position: 'absolute',
    top: 16,
    left: 12,
    right: 12,
    zIndex: 9,
    padding: 8,
    color: '#176b2c',
    backgroundColor: '#e8f5e9',
    textAlign: 'center',
  },
  userBar: {
    position: 'absolute',
    top: 16,
    right: 12,
    zIndex: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  userBarText: {
    fontSize: 10,
    color: '#2a2a2a',
  },
  logoutButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
