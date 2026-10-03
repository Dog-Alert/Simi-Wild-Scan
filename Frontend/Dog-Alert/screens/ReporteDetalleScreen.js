import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import StatusChip from '../components/report/StatusChip';
import { formatReportDateTime } from '../const/syncLabels';
import { toReportDetail } from '../domain/myReports';

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export default function ReporteDetalleScreen({ entry, busy, onBack, onRetry, onEdit, onDelete }) {
  if (!entry) {
    return (
      <View style={styles.missing}>
        <Text style={styles.title}>Este reporte ya no existe.</Text>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.link}>Volver a mis reportes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const detail = toReportDetail(entry);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        {detail.photoUri ? (
          <Image source={{ uri: detail.photoUri }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Text style={styles.placeholderIcon}>🐕</Text>
          </View>
        )}

        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.zone}>
          <Text style={styles.zoneText}>📍 Creel</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title}>{detail.title}</Text>
        <StatusChip status={detail.status} />
      </View>

      <View style={styles.stats}>
        <Stat label="Gravedad" value={detail.severity} />
        <Stat label="Perros" value={detail.dogCount} />
        <Stat label="Tamaño" value={detail.size} />
      </View>

      {detail.description ? (
        <View style={styles.descriptionBox}>
          <Text style={styles.description}>"{detail.description}"</Text>
        </View>
      ) : null}

      {detail.eventAt ? (
        <Text style={styles.date}>Reportado el {formatReportDateTime(detail.eventAt)}</Text>
      ) : null}

      {busy ? <ActivityIndicator color="#ff6b35" style={styles.busy} /> : null}

      {onRetry ? (
        <TouchableOpacity style={styles.primaryButton} onPress={onRetry} disabled={busy}>
          <Text style={styles.primaryButtonText}>Reintentar sincronización</Text>
        </TouchableOpacity>
      ) : null}

      {onEdit || onDelete ? (
        <View style={styles.actions}>
          {onEdit ? (
            <TouchableOpacity style={styles.editButton} onPress={onEdit} disabled={busy}>
              <Text style={styles.editText}>Editar</Text>
            </TouchableOpacity>
          ) : null}
          {onDelete ? (
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete} disabled={busy}>
              <Text style={styles.deleteText}>Eliminar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4',
  },
  content: {
    paddingBottom: 24,
  },
  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  link: {
    color: '#ff6b35',
    fontWeight: '700',
  },
  hero: {
    height: 200,
  },
  photo: {
    width: '100%',
    height: 200,
  },
  photoPlaceholder: {
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  backIcon: {
    fontSize: 18,
    color: '#2a2a2a',
  },
  zone: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(42,42,42,0.75)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  zoneText: {
    color: '#ffffff',
    fontSize: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: 'Outfit',
    fontSize: 20,
    fontWeight: '700',
    color: '#2a2a2a',
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  stat: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#9e9e9e',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2a2a2a',
    marginTop: 2,
  },
  descriptionBox: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  description: {
    fontFamily: 'DM Sans',
    fontSize: 14,
    color: '#2a2a2a',
  },
  date: {
    fontSize: 12,
    color: '#9e9e9e',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  busy: {
    marginTop: 12,
  },
  primaryButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  editButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ff6b35',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  editText: {
    color: '#ff6b35',
    fontSize: 16,
    fontWeight: '700',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#e53935',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
