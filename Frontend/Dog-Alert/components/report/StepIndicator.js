import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Indicador de pasos del formulario: "1 Foto y ubicacion" / "2 Detalles".
 *
 * El diseno distingue tres estados por paso: activo (naranja), pendiente (gris)
 * y completado (verde, con palomita). El verde se reserva para cuando la persona
 * ya avanzo al paso siguiente.
 */
export default function StepIndicator({ steps, currentIndex }) {
  return (
    <View style={styles.steps}>
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isDone = index < currentIndex;
        const state = isActive ? 'active' : isDone ? 'done' : 'idle';

        return (
          <View key={step} style={styles.step}>
            <View
              style={[
                styles.badge,
                state === 'active' && styles.badgeActive,
                state === 'done' && styles.badgeDone,
                state === 'idle' && styles.badgeIdle
              ]}
            >
              <Text
                style={[styles.badgeText, state === 'idle' && styles.badgeTextIdle]}
              >
                {isDone ? '✓' : index + 1}
              </Text>
            </View>

            <Text
              style={[
                styles.label,
                state === 'active' && styles.labelActive,
                state === 'idle' && styles.labelIdle
              ]}
            >
              {step}
            </Text>

            {index < steps.length - 1 ? (
              <View
                style={[
                  styles.connector,
                  isDone ? styles.connectorDone : styles.connectorIdle
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    gap: 4,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeActive: {
    backgroundColor: '#ff6b35',
  },
  badgeDone: {
    backgroundColor: '#2e9e5b',
  },
  badgeIdle: {
    backgroundColor: '#e0e0e0',
  },
  badgeText: {
    fontFamily: 'Outfit',
    fontWeight: '700',
    fontSize: 9,
    lineHeight: 14,
    color: '#ffffff',
  },
  badgeTextIdle: {
    color: '#9e9e9e',
  },
  label: {
    fontFamily: 'DM Sans',
    fontWeight: '600',
    fontSize: 9,
    lineHeight: 14,
    color: '#2e9e5b',
  },
  labelActive: {
    color: '#ff6b35',
  },
  labelIdle: {
    color: '#9e9e9e',
    fontWeight: '400',
  },
  connector: {
    height: 1,
    flex: 1,
  },
  connectorDone: {
    backgroundColor: '#ff6b35',
  },
  connectorIdle: {
    backgroundColor: '#e0e0e0',
  },
});
