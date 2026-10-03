import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import InicioScreen from './screens/InicioScreen';
import IniciarSesionScreen from './screens/InicioSesionScreen';
import CrearCuentaScreen from './screens/CrearCuentaScreen';
import ProtocoloDeSeguridad from './screens/ProtocoloDeSeguridad';
import PublicInfoScreen from './screens/PublicInfoScreen';
import FotoYUbiScreen from './screens/FotoYUbiScreen';
import ReporteScreen from './screens/ReporteScreen';
import SinConexionScreen from './screens/SinConexionScreen';
import MisReportesScreen from './screens/MisReportesScreen';
import ReporteDetalleScreen from './screens/ReporteDetalleScreen';
import { useAuth } from './hooks/UseAuth';
import { useReportDraft } from './hooks/UseReportDraft';
import { useOutbox } from './hooks/useOutbox';
import { useMyReports } from './hooks/useMyReports';
import { createClientReportId } from './apis/reportsApi';
import { SYNC_ERROR_KINDS, SYNC_STATES, canRetryManually } from './domain/syncState';

const Stack = createNativeStackNavigator();

export default function App() {
  const { user, session, login, register, logout, loading, error, response, clearError } = useAuth();
  const { draft, updateDraft, resetDraft } = useReportDraft();
  const outbox = useOutbox(session);
  const myReports = useMyReports(session, outbox.items);

  // El id se genera al entrar al formulario y se conserva entre reintentos, para
  // que un envio repetido no cree dos reportes. Se descarta al terminar.
  const [clientReportId, setClientReportId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

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

  // Entrada al reporte desde el inicio. Siempre es un reporte nuevo: si la
  // persona abandono uno a medias y vuelve a empezar, no debe heredar el
  // borrador anterior ni el id de idempotencia del intento previo.
  const enterReportFlow = (navigation) => {
    resetDraft();
    setClientReportId(createClientReportId());
    setSubmitError(null);

    navigation.navigate('ReporteFotoUbicacion');
  };

  const handleSubmitReport = async (patch, navigation) => {
    const currentDraft = { ...draft, ...patch };
    // El id se conserva entre reintentos para que reenviar no cree dos reportes.
    // Se genera aqui tambien para que ningun camino de entrada pueda enviarlo nulo.
    const reportId = clientReportId || createClientReportId();

    setClientReportId(reportId);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { item, error } = await outbox.enqueue({ draft: currentDraft, clientReportId: reportId });

      // El formulario sigue abierto: se corrige ahi y se envia con un UUID nuevo.
      if (item.state === SYNC_STATES.error && item.errorKind === SYNC_ERROR_KINDS.needsCorrection) {
        await outbox.remove(item.localId);
        setClientReportId(createClientReportId());
        setSubmitError({
          message: error ? error.message : 'Revisa los datos del reporte.',
          fields: error ? error.fieldErrors : {},
        });
        return;
      }

      resetDraft();
      setClientReportId(null);
      navigation.navigate('EstadoEnvio', { localId: item.localId });
    } catch (error) {
      setSubmitError({ message: error.message, fields: error.fieldErrors });
    } finally {
      setSubmitting(false);
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
                  onReport={() => enterReportFlow(props.navigation)}
                  onMyReports={() => props.navigation.navigate('MisReportes')}
                />
              </>
            )}
          </Stack.Screen>

          <Stack.Screen name="ReporteFotoUbicacion">
            {(props) => (
              <FotoYUbiScreen
                draft={draft}
                onChange={updateDraft}
                onNext={() => props.navigation.navigate('ReporteDetalles')}
                onBack={() => props.navigation.navigate('Inicio')}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="ReporteDetalles">
            {(props) => (
              <ReporteScreen
                draft={draft}
                onChange={updateDraft}
                onSubmit={(patch) => handleSubmitReport(patch, props.navigation)}
                onBack={() => props.navigation.navigate('ReporteFotoUbicacion')}
                submitError={submitError}
                submitting={submitting}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="EstadoEnvio">
            {(props) => {
              const localId = props.route.params ? props.route.params.localId : null;

              return (
                <SinConexionScreen
                  item={outbox.items.find((item) => item.localId === localId) || null}
                  syncing={outbox.syncing}
                  onRetry={() => outbox.retry(localId).catch(() => null)}
                  onViewReports={() => props.navigation.navigate('MisReportes')}
                  onDone={() => props.navigation.navigate('Inicio')}
                />
              );
            }}
          </Stack.Screen>

          <Stack.Screen name="MisReportes">
            {(props) => (
              <MisReportesScreen
                entries={myReports.entries}
                signedIn={Boolean(session)}
                loading={myReports.loading}
                loadingMore={myReports.loadingMore}
                error={myReports.error}
                hasMore={myReports.hasMore}
                onRefresh={() => {
                  myReports.refresh();
                  outbox.sync().catch(() => null);
                }}
                onLoadMore={myReports.loadMore}
                onOpen={(entry) =>
                  props.navigation.navigate('ReporteDetalle', {
                    key: entry.key,
                    clientReportId: (entry.report || entry.item).clientReportId,
                  })
                }
                onBack={() => props.navigation.navigate('Inicio')}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="ReporteDetalle">
            {(props) => {
              const { key, clientReportId } = props.route.params || {};
              // Al sincronizarse, un reporte de la cola reaparece como reporte del servidor.
              const entry =
                myReports.entries.find((candidate) => candidate.key === key) ||
                myReports.entries.find(
                  (candidate) => (candidate.report || candidate.item).clientReportId === clientReportId
                ) ||
                null;
              const item = entry ? entry.item : null;

              return (
                <ReporteDetalleScreen
                  entry={entry}
                  busy={outbox.syncing}
                  onBack={() => props.navigation.navigate('MisReportes')}
                  onRetry={
                    item && canRetryManually(item)
                      ? () => outbox.retry(item.localId).catch(() => null)
                      : undefined
                  }
                />
              );
            }}
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
    fontSize: 12,
    color: '#2a2a2a',
  },
  logoutButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
