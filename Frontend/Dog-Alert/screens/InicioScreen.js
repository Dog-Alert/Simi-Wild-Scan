import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export default function InicioScreen({ onStart, onAnonymous, onPublicInfo, onReport }) {
  return (
    <View style={styles.inicioContainer}>
      <View style={styles.inicioBackground}>
        <View style={styles.inicioGradient} />
        <View style={styles.inicioImage} />

        <View style={styles.inicioContent}>
          <View style={styles.inicioInfo}>
            <View style={styles.brand}>
              <Text style={styles.brandIcon}>🐾</Text>
              <Text style={styles.brandName}>DogAlert</Text>
            </View>

            <Text style={styles.brandDescription}>
              Reporta, localiza y protege tu comunidad de incidentes con perros en
              situación de calle.
            </Text>
          </View>

          <View style={styles.inicioActions}>
            <TouchableOpacity style={styles.startButton} onPress={onStart}>
              <Text style={styles.startButtonText}>Empezar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={onPublicInfo}>
              <Text style={styles.secondaryButtonText}>Ver información pública</Text>
            </TouchableOpacity>

            {onReport ? (
              <TouchableOpacity style={styles.anonymousButton} onPress={onReport}>
                <Text style={styles.anonymousButtonText}>Reportar un incidente</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.anonymousButton} onPress={onAnonymous}>
              <Text style={styles.anonymousButtonText}>
                Continuar como anónimo · Reporte anónimo
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inicioContainer: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  inicioBackground: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    position: 'relative',
  },
  inicioGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.30)',
  },
  inicioImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
    opacity: 0.5,
  },
  inicioContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 20,
    paddingTop: 16,
  },
  inicioInfo: {
    width: '100%',
    maxWidth: 440,
    minHeight: 100,
    paddingBottom: 20,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  brandIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ff6b35',
    textAlign: 'center',
    lineHeight: 26,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    overflow: 'hidden',
  },
  brandName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  brandDescription: {
    width: '100%',
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  inicioActions: {
    width: '100%',
    gap: 10,
  },
  startButton: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  anonymousButton: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  anonymousButtonText: {
    color: 'rgba(255, 255, 255, 0.60)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});

