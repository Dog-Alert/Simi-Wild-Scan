import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Mapa decorativo de la pantalla de foto y ubicacion.
 *
 * Reproduce el plano de fondo del diseno de Figma: la retícula, una calle y las
 * manzanas. NO es un mapa real: no usa teselas ni tiles, y por lo tanto no ubica
 * al usuario en ningun punto geografico. Por eso el pin solo aparece cuando ya
 * hay una ubicacion capturada, y su posicion es la del diseno, no la del
 * dispositivo. La coordenada real se valida aparte contra el poligono de Creel.
 *
 * Las medidas del diseno (176 x 80) se convierten a porcentajes para que el
 * plano se estire con el ancho de la pantalla sin deformar las proporciones.
 */

const GRID_COLUMNS = [0, 16, 32, 48, 64, 80, 96];
const GRID_ROWS = [0, 14, 28, 42, 56, 70, 84];

const BLOCKS = [
  { left: 10, top: 10, width: 30, height: 22 },
  { left: 50, top: 8, width: 28, height: 18 },
  { left: 10, top: 42, width: 20, height: 18 },
  { left: 55, top: 40, width: 26, height: 22 },
  { left: 15, top: 68, width: 35, height: 18 },
  { left: 55, top: 65, width: 22, height: 20 },
];

export default function DecorativeMap({ hasLocation = false }) {
  return (
    <View style={styles.map}>
      {GRID_COLUMNS.map((left) => (
        <View key={`col-${left}`} style={[styles.gridLine, { left: `${left}%`, top: 0, width: 1, height: '100%' }]} />
      ))}

      {GRID_ROWS.map((top) => (
        <View key={`row-${top}`} style={[styles.gridLine, { top: `${top}%`, left: 0, height: 1, width: '100%' }]} />
      ))}

      <View style={[styles.road, { left: 0, top: '38%', width: '100%', height: '7.5%' }]} />
      <View style={[styles.road, { left: '42%', top: 0, width: '3.4%', height: '100%' }]} />

      {BLOCKS.map((block) => (
        <View
          key={`block-${block.left}-${block.top}`}
          style={[
            styles.block,
            {
              left: `${block.left}%`,
              top: `${block.top}%`,
              width: `${block.width}%`,
              height: `${block.height}%`,
            }
          ]}
        />
      ))}

      {hasLocation ? <View style={styles.pin} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    position: 'relative',
    width: '100%',
    height: 128,
    marginTop: 6,
    backgroundColor: '#eaf0ec',
    borderRadius: 12,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#d6e0d8',
  },
  road: {
    position: 'absolute',
    backgroundColor: '#c8d8ca',
  },
  block: {
    position: 'absolute',
    backgroundColor: '#d4ddd6',
    borderRadius: 3,
  },
  pin: {
    position: 'absolute',
    left: '41%',
    top: '24.5%',
    width: 20,
    height: 20,
    backgroundColor: '#ff6b35',
    borderWidth: 1.34,
    borderColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderRadius: 10,
    transform: [{ rotate: '-45deg' }],
  },
});
