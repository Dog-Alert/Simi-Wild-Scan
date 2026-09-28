import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

/**
 * Chip de opcion del formulario de reporte.
 *
 * Un solo componente para tipo de incidente, certeza, tamaño, color, collar y
 * cantidad: en el diseño todos comparten medidas, radios y colores, asi que
 * separarlos en seis componentes seria repetir lo mismo seis veces.
 */
export default function OptionChip({ label, selected = false, onPress, testID }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected ? styles.chipSelected : styles.chipIdle]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : styles.chipTextIdle]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    boxSizing: 'border-box',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 34,
    borderRadius: 20,
    borderWidth: 1.34,
  },
  chipSelected: {
    backgroundColor: '#ff6b35',
    borderColor: '#ff6b35',
  },
  chipIdle: {
    backgroundColor: '#f4f4f4',
    borderColor: '#e0e0e0',
  },
  chipText: {
    fontFamily: 'DM Sans',
    fontWeight: '500',
    fontSize: 12,
    lineHeight: 17,
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  chipTextIdle: {
    color: '#5e5e5e',
  },
});
