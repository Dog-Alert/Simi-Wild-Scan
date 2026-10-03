import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import StatusChip from '../components/report/StatusChip';
import { formatReportDate } from '../const/syncLabels';
import { eventTypeLabel } from '../domain/myReports';

function ReportRow({ entry, onOpen }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => onOpen(entry)}
      accessibilityRole="button"
      testID={`report-row-${entry.key}`}
    >
      {entry.photoUri ? (
        <Image source={{ uri: entry.photoUri }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Text style={styles.placeholderIcon}>🐕</Text>
        </View>
      )}

      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {eventTypeLabel(entry.eventType)}
        </Text>
        <Text style={styles.rowDate}>{formatReportDate(entry.eventAt)}</Text>
      </View>

      <StatusChip status={entry.status} />
    </TouchableOpacity>
  );
}

export default function MisReportesScreen({
  entries,
  signedIn,
  loading,
  loadingMore,
  error,
  hasMore,
  onRefresh,
  onLoadMore,
  onOpen,
  onBack,
}) {
  const header = (
    <>
      {!signedIn ? (
        <Text style={styles.notice}>
          Inicia sesión para ver también los reportes enviados con tu cuenta.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  const footer = hasMore ? (
    <TouchableOpacity style={styles.moreButton} onPress={onLoadMore} disabled={loadingMore}>
      {loadingMore ? (
        <ActivityIndicator color="#ff6b35" />
      ) : (
        <Text style={styles.moreText}>Cargar más</Text>
      )}
    </TouchableOpacity>
  ) : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Mis reportes</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(entry) => entry.key}
        renderItem={({ item }) => <ReportRow entry={item} onOpen={onOpen} />}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          loading ? null : <Text style={styles.empty}>Aún no tienes reportes.</Text>
        }
        refreshControl={<RefreshControl refreshing={Boolean(loading)} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginRight: 12,
  },
  backIcon: {
    fontSize: 20,
    color: '#2a2a2a',
  },
  title: {
    fontFamily: 'Outfit',
    fontSize: 18,
    fontWeight: '700',
    color: '#2a2a2a',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    gap: 12,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  thumbnailPlaceholder: {
    backgroundColor: '#f4f4f4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 22,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontFamily: 'DM Sans',
    fontSize: 15,
    fontWeight: '700',
    color: '#2a2a2a',
  },
  rowDate: {
    fontFamily: 'DM Sans',
    fontSize: 12,
    color: '#9e9e9e',
    marginTop: 2,
  },
  notice: {
    fontFamily: 'DM Sans',
    fontSize: 13,
    color: '#5e5e5e',
    marginBottom: 10,
  },
  error: {
    fontFamily: 'DM Sans',
    fontSize: 13,
    color: '#b3261e',
    marginBottom: 10,
  },
  empty: {
    fontFamily: 'DM Sans',
    fontSize: 14,
    color: '#9e9e9e',
    textAlign: 'center',
    marginTop: 32,
  },
  moreButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  moreText: {
    color: '#ff6b35',
    fontWeight: '700',
  },
});
