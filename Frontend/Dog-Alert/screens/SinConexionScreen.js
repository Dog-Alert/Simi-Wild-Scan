import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { formatElapsed, getSyncStatus } from '../const/syncLabels';
import { canRetryManually } from '../domain/syncState';

const HEADINGS = {
  local: {
    icon: '📵',
    title: 'Sin conexión',
    body: 'El reporte fue guardado localmente y se sincronizará cuando recuperes conexión a internet.',
  },
  syncing: {
    icon: '🔄',
    title: 'Sincronizando',
    body: 'Estamos enviando tu reporte al servidor.',
  },
  synced: {
    icon: '✅',
    title: 'Reporte enviado',
    body: 'Tu reporte quedó registrado y será revisado.',
  },
  error: {
    icon: '⚠️',
    title: 'No se pudo enviar',
    body: 'Tu reporte sigue guardado en este teléfono.',
  },
};

const TONES = {
  local: { background: '#fff3ee', border: '#ffc9b3', text: '#ff6b35' },
  syncing: { background: '#f4f4f4', border: '#e0e0e0', text: '#5e5e5e' },
  synced: { background: '#e8f5e9', border: '#b7dfba', text: '#2e7d32' },
  error: { background: '#fdecea', border: '#f5c2bd', text: '#b3261e' },
};

export default function SinConexionScreen({ item, syncing, onRetry, onViewReports, onDone }) {
  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Reporte no encontrado</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={onDone}>
          <Text style={styles.primaryButtonText}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = getSyncStatus(item);
  const heading = HEADINGS[status.tone];
  const tone = TONES[status.tone];
  const retryable = canRetryManually(item);

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.icon}>{heading.icon}</Text>
      </View>

      <Text style={styles.title}>{heading.title}</Text>
      <Text style={styles.body}>{heading.body}</Text>

      <View
        testID="sync-status-card"
        style={[styles.card, { backgroundColor: tone.background, borderColor: tone.border }]}
      >
        <Text style={[styles.cardLabel, { color: tone.text }]}>{status.label}</Text>
        <Text style={styles.cardDetail}>
          {status.detail} · {formatElapsed(item.createdAt)}
        </Text>
      </View>

      {retryable ? (
        <TouchableOpacity
          style={[styles.primaryButton, syncing && styles.disabled]}
          onPress={onRetry}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>Reintentar sincronización</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {onViewReports ? (
        <TouchableOpacity style={styles.secondaryButton} onPress={onViewReports}>
          <Text style={styles.secondaryButtonText}>Ver mis reportes guardados</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.linkButton} onPress={onDone}>
        <Text style={styles.linkText}>Volver al inicio</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#ffffff',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontFamily: 'Outfit',
    fontSize: 20,
    fontWeight: '700',
    color: '#2a2a2a',
    marginBottom: 8,
  },
  body: {
    fontFamily: 'DM Sans',
    fontSize: 14,
    color: '#5e5e5e',
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  cardLabel: {
    fontFamily: 'DM Sans',
    fontSize: 14,
    fontWeight: '700',
  },
  cardDetail: {
    fontFamily: 'DM Sans',
    fontSize: 12,
    color: '#5e5e5e',
    marginTop: 2,
  },
  primaryButton: {
    alignSelf: 'stretch',
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderColor: '#ff6b35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#ff6b35',
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
  linkButton: {
    paddingVertical: 8,
  },
  linkText: {
    color: '#5e5e5e',
    fontSize: 14,
  },
});
