import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getHealthStatus, getPublicInfo, getPublicReports } from '../apis/API_Client';

export default function PublicInfoScreen({ onBack, onLogout }) {
  const [health, setHealth] = useState(null);
  const [info, setInfo] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        const [healthData, infoData, reportsData] = await Promise.all([
          getHealthStatus().catch(() => ({ status: 'unavailable' })),
          getPublicInfo().catch(() => []),
          getPublicReports().catch(() => []),
        ]);

        if (!mounted) {
          return;
        }

        setHealth(healthData);
        setInfo(infoData);
        setReports(reportsData);
      } catch (e) {
        if (mounted) {
          setError(e.message || 'No se pudo cargar la información pública');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Información pública</Text>

        {onLogout ? (
          <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Salir</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#ff6b35" />
          <Text style={styles.loadingText}>Cargando información pública...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Estado del backend</Text>
            <Text style={styles.statusText}>
              {health?.status || 'Desconocido'}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Información pública</Text>
            {info.length === 0 ? (
              <Text style={styles.emptyText}>No hay información pública disponible.</Text>
            ) : (
              info.map((item, index) => (
                <Text key={`info-${index}`} style={styles.itemText}>
                  {typeof item === 'string' ? item : JSON.stringify(item)}
                </Text>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Reportes públicos</Text>
            {reports.length === 0 ? (
              <Text style={styles.emptyText}>No hay reportes públicos disponibles.</Text>
            ) : (
              reports.map((item, index) => (
                <Text key={`report-${index}`} style={styles.itemText}>
                  {typeof item === 'string' ? item : JSON.stringify(item)}
                </Text>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    paddingRight: 8,
  },
  backIcon: {
    fontSize: 22,
    color: '#2a2a2a',
  },
  title: {
    flex: 1,
    color: '#2a2a2a',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: '#ff6b35',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#5e5e5e',
    fontSize: 12,
  },
  error: {
    color: '#b3261e',
    textAlign: 'center',
    fontSize: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 12,
    gap: 12,
  },
  card: {
    backgroundColor: '#f4f4f4',
    borderRadius: 12,
    padding: 12,
  },
  sectionTitle: {
    color: '#2a2a2a',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  statusText: {
    color: '#176b2c',
    fontSize: 12,
    fontWeight: '600',
  },
  itemText: {
    color: '#5e5e5e',
    fontSize: 11,
    lineHeight: 18,
  },
  emptyText: {
    color: '#9e9e9e',
    fontSize: 11,
    lineHeight: 18,
  },
});
