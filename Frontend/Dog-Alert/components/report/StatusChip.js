import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const TONES = {
  local: { background: '#fff3ee', text: '#ff6b35' },
  syncing: { background: '#f4f4f4', text: '#5e5e5e' },
  synced: { background: '#e8f5e9', text: '#2e7d32' },
  error: { background: '#fdecea', text: '#b3261e' },
  pending: { background: '#fff8e1', text: '#c77700' },
  verified: { background: '#e8f5e9', text: '#2e7d32' },
  rejected: { background: '#fdecea', text: '#b3261e' },
  archived: { background: '#f4f4f4', text: '#5e5e5e' },
};

export default function StatusChip({ status }) {
  const tone = TONES[status.tone] || TONES.archived;

  return (
    <View style={[styles.chip, { backgroundColor: tone.background }]}>
      <Text style={[styles.text, { color: tone.text }]}>{status.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'DM Sans',
    fontSize: 11,
    fontWeight: '700',
  },
});
