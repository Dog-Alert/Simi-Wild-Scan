import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ProtocoloDeSeguridad({ onBack, onLogout }) {
  const protocols = [
    {
      icon: '🚫',
      title: 'No te acerques',
      description: 'Mantén distancia prudente aunque parezca tranquilo.',
    },
    {
      icon: '🏃',
      title: 'No lo persigas',
      description: 'Huir puede activar instinto de cacería.',
    },
    {
      icon: '👐',
      title: 'No hagas movimientos bruscos',
      description: 'Actúa con calma y retrocede lentamente.',
    },
    {
      icon: '📞',
      title: 'Busca ayuda ante peligro inmediato',
      description: 'Llama al 911 o al centro de control animal.',
    },
    {
      icon: '📸',
      title: 'Documenta si es seguro',
      description: 'Toma foto desde distancia y genera un reporte.',
    },
    {
      icon: '🏥',
      title: 'Ante mordedura',
      description: 'Lava la herida, acude a urgencias de inmediato.',
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerTitle}>
            <Text style={styles.headerTitleText}>Protocolos de seguridad</Text>
          </View>

          {onLogout ? (
            <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
              <Text style={styles.logoutButtonText}>Salir</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.protocols}>
          <Text style={styles.description}>
            Si encuentras perros en situación de calle o peligrosa, sigue estas
            indicaciones:
          </Text>

          {protocols.map((protocol) => (
            <View key={protocol.title} style={styles.protocol}>
              <View style={styles.iconButton}>
                <Text>{protocol.icon}</Text>
              </View>

              <View style={styles.protocolText}>
                <Text style={styles.protocolTitle}>{protocol.title}</Text>
                <Text style={styles.protocolDescription}>
                  {protocol.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  backButton: {
    marginRight: 6,
  },
  backIcon: {
    fontSize: 22,
    color: '#2a2a2a',
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
  headerTitle: {
    flex: 1,
  },
  headerTitleText: {
    color: '#2a2a2a',
    fontSize: 16,
    fontWeight: '700',
  },
  protocols: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
  },
  description: {
    color: '#5e5e5e',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  protocol: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f4f4f4',
    borderRadius: 9,
    padding: 9,
    marginBottom: 7,
    gap: 9,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fff0eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  protocolText: {
    flex: 1,
  },
  protocolTitle: {
    color: '#2a2a2a',
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    marginBottom: 2,
  },
  protocolDescription: {
    color: '#5e5e5e',
    fontSize: 9,
    lineHeight: 13,
  },
});

