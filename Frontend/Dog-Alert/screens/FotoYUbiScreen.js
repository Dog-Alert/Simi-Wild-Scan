import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import DecorativeMap from '../components/report/DecorativeMap';
import StepIndicator from '../components/report/StepIndicator';
import { REPORT_MESSAGES } from '../const/reportCatalogs';
import { parseManualCoordinateInput } from '../domain/reportCoordinate';
import {
  createManualLocation,
  getCurrentLocation,
  requestLocationPermission
} from '../services/locationService';
import {
  PHOTO_ERROR_CODES,
  pickReportPhoto,
  takeReportPhoto
} from '../services/photoService';

const STEPS = ['Foto y ubicación', 'Detalles'];

/**
 * Paso 1 del reporte: foto y ubicacion.
 *
 * El borrador y su actualizacion llegan por props porque el paso 2 usa el mismo
 * borrador; el estado propio de la pantalla es solo lo efimero (cargando, error,
 * sugerencia de ubicacion) que no tiene sentido conservar al cambiar de paso.
 *
 * Sobre la ubicacion de los metadatos de la foto: RF-013 ordena el orden
 * Metadatos -> GPS -> seleccion manual, y el contrato no tiene un valor para
 * "vino de la foto", asi que si se usa se manda como MANUAL. No se aplica sola:
 * se propone y la persona confirma, porque la foto se tomo con el GPS apagado o
 * en otro lugar con frecuencia.
 *
 * La ubicacion manual es el ultimo recurso: se deja a la vista, no escondida
 * tras un menu, porque es la unica salida cuando el permiso de GPS esta
 * denegado, no hay senal, o la persona quiere corregirse a mano.
 */
export default function FotoYUbiScreen({
  draft,
  onChange,
  onNext,
  onBack,
  title = 'Nuevo reporte',
  photoLocked = false,
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [exifSuggestion, setExifSuggestion] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  const photo = draft.photo;
  const location = draft.location;
  const derivedFromPhoto = Boolean(location && location.derivedFromPhoto);

  const run = async (task) => {
    setBusy(true);
    setNotice(null);

    try {
      return await task();
    } finally {
      setBusy(false);
    }
  };

  const handleShareLocation = () =>
    run(async () => {
      const permission = await requestLocationPermission();

      if (!permission.ok) {
        setNotice({ tone: 'error', message: permission.message });
        return;
      }

      const result = await getCurrentLocation();

      if (!result.ok) {
        setNotice({ tone: 'error', message: result.message });
        return;
      }

      onChange({ location: result.location, locationDerivedFromPhoto: false });
      setExifSuggestion(null);
    });

  const acceptExifLocation = () => {
    onChange({
      location: {
        ...createManualLocation(
          exifSuggestion.latitude,
          exifSuggestion.longitude,
          null
        ),
        derivedFromPhoto: true
      },
      locationDerivedFromPhoto: true
    });
    setExifSuggestion(null);
  };

  const rejectExifLocation = () => {
    setExifSuggestion(null);
  };

  // La coordenada escrita a mano viaja como MANUAL, igual que la de los
  // metadatos: el contrato solo distingue GPS de MANUAL, y quedarse sin
  // senal no significa que la ubicacion sea menos creible.
  const applyManualLocation = () => {
    const result = parseManualCoordinateInput(manualLat, manualLng);

    if (!result.ok) {
      setNotice({ tone: 'error', message: result.message });
      return;
    }

    onChange({
      location: createManualLocation(result.latitude, result.longitude),
      locationDerivedFromPhoto: false
    });
    setExifSuggestion(null);
    setManualOpen(false);
  };

  const toggleManualInput = () => {
    setManualOpen((open) => !open);
    setNotice(null);
    setExifSuggestion(null);
  };

  const attachPhoto = (result) => {
    if (result.code === PHOTO_ERROR_CODES.cancelled) {
      return;
    }

    if (!result.ok) {
      setNotice({ tone: 'error', message: result.message });
      return;
    }

    onChange({ photo: result.photo });

    if (result.exifLocation) {
      setExifSuggestion(result.exifLocation);
    }
  };

  const handleTakePhoto = () => run(() => takeReportPhoto()).then(attachPhoto);
  const handlePickPhoto = () => run(() => pickReportPhoto()).then(attachPhoto);

  const handleNext = () => {
    if (!location) {
      setNotice({ tone: 'error', message: REPORT_MESSAGES.locationRequired });
      return;
    }

    onNext();
  };

  const locationLabel = location
    ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
    : 'Sin ubicación';

  const accuracyLabel =
    location && typeof location.accuracyMeters === 'number'
      ? ` · ±${Math.round(location.accuracyMeters)} m`
      : '';

  // El origen se deduce de lo que ya viaja en el payload, sin guardar otro
  // campo en el borrador: GPS trae precisión, la foto se marca con
  // derivedFromPhoto, y lo que sobra es coordenada escrita a mano.
  let sourceLabel = 'Capturada con el GPS';

  if (location) {
    if (derivedFromPhoto) {
      sourceLabel = 'Tomada de la foto';
    } else if (location.source === 'MANUAL') {
      sourceLabel = 'Ingresada a mano';
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>📍</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      {/* El teclado del celular tapaba los campos de latitud y longitud, que
          quedan al final de la tarjeta. En iOS hay que reservar el alto del
          teclado; en Android la ventana ya se ajusta sola. */}
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
        <StepIndicator steps={STEPS} currentIndex={0} />

        {notice ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{notice.message}</Text>
          </View>
        ) : null}

        {exifSuggestion ? (
          <View style={styles.derivedNote}>
            <Text style={styles.derivedNoteText}>
              La foto trae ubicación. ¿Usarla como ubicación del reporte?
            </Text>
            <TouchableOpacity style={styles.derivedButton} onPress={acceptExifLocation}>
              <Text style={styles.derivedButtonText}>Sí</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.derivedButton} onPress={rejectExifLocation}>
              <Text style={styles.derivedButtonText}>No</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.photoCard}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleIcon}>🏷</Text>
            <Text style={styles.cardTitle}>Foto</Text>
          </View>

          {photo ? (
            <Image
              style={styles.photoPreview}
              source={{ uri: photo.uri }}
              accessibilityLabel="Foto adjunta al reporte"
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderIcon}>🖼</Text>
              <Text style={styles.photoPlaceholderText}>Toma o selecciona una foto</Text>
            </View>
          )}

          {photoLocked ? (
            <Text style={styles.photoPlaceholderText}>
              La foto no se puede cambiar al editar un reporte enviado.
            </Text>
          ) : (
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={styles.btn}
                onPress={handleTakePhoto}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.btnText}>Abrir cámara</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btn}
                onPress={handlePickPhoto}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.btnText}>Seleccionar foto</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.locationCard}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleIcon}>📍</Text>
            <Text style={styles.cardTitle}>Ubicación</Text>
          </View>

          <DecorativeMap hasLocation={Boolean(location)} />

          <Text style={styles.locationReadout}>
            {locationLabel}
            {accuracyLabel}
          </Text>
          <Text style={styles.locationSource}>{sourceLabel}</Text>

          <TouchableOpacity
            style={styles.shareLocation}
            onPress={handleShareLocation}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Compartir mi ubicación actual</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualToggle}
            onPress={toggleManualInput}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Ingresar ubicación manualmente"
          >
            <Text style={styles.manualToggleText}>
              {manualOpen ? 'Ocultar ubicación manual' : 'Ingresar ubicación manualmente'}
            </Text>
          </TouchableOpacity>

          {manualOpen ? (
            <View style={styles.manualBox}>
              <Text style={styles.manualHint}>
                Escribe las coordenadas del punto donde ocurrió. Úsalas solo si
                no puedes compartir tu ubicación o si sabes que el GPS no es
                exacto aquí.
              </Text>

              <View style={styles.manualRow}>
                <View style={styles.manualField}>
                  <Text style={styles.manualLabel}>Latitud</Text>
                  <TextInput
                    style={styles.manualInput}
                    value={manualLat}
                    onChangeText={setManualLat}
                    placeholder="27.74432"
                    placeholderTextColor="#9e9e9e"
                    keyboardType="numbers-and-punctuation"
                    inputMode="decimal"
                    accessibilityLabel="Latitud manual"
                  />
                </View>

                <View style={styles.manualField}>
                  <Text style={styles.manualLabel}>Longitud</Text>
                  <TextInput
                    style={styles.manualInput}
                    value={manualLng}
                    onChangeText={setManualLng}
                    placeholder="-107.63432"
                    placeholderTextColor="#9e9e9e"
                    keyboardType="numbers-and-punctuation"
                    inputMode="decimal"
                    accessibilityLabel="Longitud manual"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.manualApply}
                onPress={applyManualLocation}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Usar ubicación escrita"
              >
                <Text style={styles.btnText}>Usar esta ubicación</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.footer}>
          {busy ? <ActivityIndicator color="#ff6b35" /> : null}

          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.btnText}>Siguiente</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backLink} onPress={onBack} accessibilityRole="button">
            <Text style={styles.backLinkText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f4f4f4',
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1.34,
    borderBottomColor: '#e0e0e0',
  },
  headerIcon: {
    fontSize: 15,
  },
  headerTitle: {
    fontFamily: 'Outfit',
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 21,
    color: '#2a2a2a',
  },
  body: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 10,
  },
  notice: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fdecea',
  },
  noticeText: {
    fontFamily: 'DM Sans',
    fontSize: 12,
    lineHeight: 17,
    color: '#b3261e',
  },
  derivedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    borderRadius: 8,
    backgroundColor: '#f4f4f4',
  },
  derivedNoteText: {
    flex: 1,
    fontFamily: 'DM Sans',
    fontSize: 12,
    lineHeight: 17,
    color: '#5e5e5e',
  },
  derivedButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#ff6b35',
  },
  derivedButtonText: {
    fontFamily: 'Outfit',
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 17,
    color: '#ffffff',
  },
  // `photoCard` y `locationCard` comparten medidas para verse del mismo tamaño.
  // El alto natural de la de foto lo fijan la vista previa de 208 px mas el
  // titulo y los botones: 15 + 6 + 208 + 6 + 30 + 16 = 281 px. La de ubicacion
  // usa el mismo `minHeight` y el espacio sobrante queda como aire al final.
  photoCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    minHeight: 281,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  locationCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    minHeight: 281,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardTitleIcon: {
    fontSize: 14,
  },
  cardTitle: {
    fontFamily: 'DM Sans',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 19,
    color: '#2a2a2a',
  },
  photoPlaceholder: {
    height: 208,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.34,
    borderStyle: 'dashed',
    borderColor: '#9e9e9e',
    backgroundColor: '#e0e0e0',
  },
  photoPlaceholderIcon: {
    fontSize: 24,
  },
  photoPlaceholderText: {
    fontFamily: 'DM Sans',
    fontSize: 13,
    lineHeight: 18,
    color: '#9e9e9e',
  },
  photoPreview: {
    width: '100%',
    height: 208,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 4,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
  },
  btnText: {
    fontFamily: 'Outfit',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    color: '#ffffff',
    textAlign: 'center',
  },
  locationReadout: {
    fontFamily: 'DM Sans',
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 20,
    color: '#2a2a2a',
  },
  locationSource: {
    fontFamily: 'DM Sans',
    fontSize: 12,
    lineHeight: 17,
    color: '#9e9e9e',
  },
  shareLocation: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
  },
  manualToggle: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  manualToggleText: {
    fontFamily: 'DM Sans',
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
    color: '#5e5e5e',
    textDecorationLine: 'underline',
  },
  manualBox: {
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f4f4f4',
  },
  manualHint: {
    fontFamily: 'DM Sans',
    fontSize: 12,
    lineHeight: 17,
    color: '#5e5e5e',
  },
  manualRow: {
    flexDirection: 'row',
    gap: 6,
  },
  manualField: {
    flex: 1,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.34,
    borderColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  manualLabel: {
    fontFamily: 'DM Sans',
    fontSize: 12,
    lineHeight: 16,
    color: '#9e9e9e',
  },
  manualInput: {
    fontFamily: 'DM Sans',
    fontSize: 14,
    lineHeight: 19,
    color: '#2a2a2a',
    padding: 0,
  },
  manualApply: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#ff6b35',
  },
  footer: {
    gap: 8,
    alignItems: 'center',
  },
  nextButton: {
    width: '100%',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#ff6b35',
  },
  backLink: {
    paddingVertical: 4,
  },
  backLinkText: {
    fontFamily: 'DM Sans',
    fontSize: 14,
    lineHeight: 19,
    color: '#5e5e5e',
  },
});
