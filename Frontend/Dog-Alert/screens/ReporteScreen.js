import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import OptionChip from '../components/report/OptionChip';
import StepIndicator from '../components/report/StepIndicator';
import {
  CERTAINTIES,
  COLORS,
  COLLAR_PRESENCES,
  DOG_COUNT_BUCKETS,
  DOG_SIZES,
  EVENT_TYPES,
  OTHER_EVENT_TYPE,
  REPORT_LIMITS,
  UNDETERMINED_VALUE,
  dogCountBucketFor
} from '../const/reportCatalogs';
import {
  descriptionRemaining,
  formatEventAtInput,
  parseEventAtInput
} from '../domain/reportDateTime';

const STEPS = ['Foto y ubicación', 'Detalles'];

function Section({ label, error, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
      {error ? <Text style={styles.sectionError}>{error}</Text> : null}
    </View>
  );
}

/**
 * Paso 2 del reporte: detalles del incidente y envio.
 *
 * El formulario no pide la gravedad: la asigna quien revisa el reporte despues
 * (ver `SEVERITIES` en `const/reportCatalogs.js`).
 *
 * "Cantidad" ofrece los rangos del diseño (1 / 2-3 / 4+) y cada rango guarda su
 * cota inferior como conteo exacto, porque el contrato exige un entero y nunca
 * conviene reportar mas perros de los que se vieron.
 */
export default function ReporteScreen({
  draft,
  onChange,
  onSubmit,
  onBack,
  submitError,
  submitting,
  title = 'Nuevo reporte',
  submitLabel = 'Enviar reporte',
}) {
  const initialDateTime = useMemo(() => formatEventAtInput(draft.eventAt), []);
  const [dateText, setDateText] = useState(initialDateTime.date);
  const [timeText, setTimeText] = useState(initialDateTime.time);

  const errors = submitError && submitError.fields ? submitError.fields : {};
  const hasFieldErrors = Object.keys(errors).length > 0;

  const selectColor = (value) => {
    if (value === UNDETERMINED_VALUE) {
      onChange({ color: '', colorUndetermined: true });
      return;
    }

    onChange({ color: value, colorUndetermined: false });
  };

  // La pantalla se desmonta al volver al paso 1, asi que la fecha escribible se
  // guarda en el borrador en cuanto es interpretable. Si el texto queda a medias
  // no se guarda: al enviar se vuelve a interpretar y se reporta el error.
  const handleDateChange = (value) => {
    setDateText(value);

    const eventAt = parseEventAtInput(value, timeText);
    if (eventAt) {
      onChange({ eventAt });
    }
  };

  const handleTimeChange = (value) => {
    setTimeText(value);

    const eventAt = parseEventAtInput(dateText, value);
    if (eventAt) {
      onChange({ eventAt });
    }
  };

  const handleSubmit = () => {
    const eventAt = parseEventAtInput(dateText, timeText);

    onSubmit(eventAt ? { eventAt } : { eventAt: null });
  };

  const activeDogBucket = dogCountBucketFor(draft.dogCount);
  const remaining = descriptionRemaining(draft.description);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>📍</Text>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        <StepIndicator steps={STEPS} currentIndex={1} />

        {errors.eventAt || errors.location || errors.photo ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {errors.eventAt || errors.location || errors.photo}
            </Text>
          </View>
        ) : null}

        <Section label="Fecha y hora" error={errors.eventAt}>
          <View style={styles.datetimeRow}>
            <View style={styles.field}>
              <TextInput
                style={styles.fieldInput}
                placeholder="DD/MM/AAAA"
                placeholderTextColor="#9e9e9e"
                value={dateText}
                onChangeText={handleDateChange}
                accessibilityLabel="Fecha del evento"
              />
            </View>
            <View style={styles.field}>
              <TextInput
                style={styles.fieldInput}
                placeholder="HH:MM"
                placeholderTextColor="#9e9e9e"
                value={timeText}
                onChangeText={handleTimeChange}
                accessibilityLabel="Hora del evento"
              />
            </View>
          </View>
        </Section>

        <Section label="Tipo de incidente" error={errors.eventType}>
          <View style={styles.chips}>
            {EVENT_TYPES.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                selected={draft.eventType === option.value}
                onPress={() => onChange({ eventType: option.value })}
                testID={`chip-eventType-${option.value}`}
              />
            ))}
          </View>

          {draft.eventType === OTHER_EVENT_TYPE ? (
            <View style={styles.descriptionField}>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Describe el tipo de evento"
                placeholderTextColor="#9e9e9e"
                value={draft.eventTypeOther}
                onChangeText={(value) => onChange({ eventTypeOther: value })}
                accessibilityLabel="Detalle del tipo de evento"
              />
            </View>
          ) : null}
        </Section>

        <Section label="Certeza" error={errors.certainty}>
          <View style={styles.chips}>
            {CERTAINTIES.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                selected={draft.certainty === option.value}
                onPress={() => onChange({ certainty: option.value })}
                testID={`chip-certainty-${option.value}`}
              />
            ))}
          </View>
        </Section>

        <Section label="Tamaño" error={errors.size}>
          <View style={styles.chips}>
            {DOG_SIZES.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                selected={draft.size === option.value}
                onPress={() => onChange({ size: option.value })}
                testID={`chip-size-${option.value}`}
              />
            ))}
          </View>
        </Section>

        <Section label="Color" error={errors.color}>
          <View style={styles.chips}>
            {COLORS.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                selected={
                  option.value === UNDETERMINED_VALUE
                    ? Boolean(draft.colorUndetermined)
                    : !draft.colorUndetermined && draft.color === option.value
                }
                onPress={() => selectColor(option.value)}
                testID={`chip-color-${option.value}`}
              />
            ))}
          </View>
        </Section>

        <Section label="¿Collar?" error={errors.collar}>
          <View style={styles.chips}>
            {COLLAR_PRESENCES.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                selected={draft.collar === option.value}
                onPress={() => onChange({ collar: option.value })}
                testID={`chip-collar-${option.value}`}
              />
            ))}
          </View>
        </Section>

        <Section label="Cantidad" error={errors.dogCount}>
          <View style={styles.chips}>
            {DOG_COUNT_BUCKETS.map((bucket) => (
              <OptionChip
                key={bucket.value}
                label={bucket.label}
                selected={activeDogBucket === bucket.value}
                onPress={() => onChange({ dogCount: String(bucket.value) })}
                testID={`chip-dogCount-${bucket.value}`}
              />
            ))}
          </View>
          <Text style={styles.sectionHint}>
            Se registra la cantidad mínima del rango que elegiste.
          </Text>
        </Section>

        <Section label="Descripción adicional" error={errors.description}>
          <View style={styles.descriptionField}>
            <TextInput
              style={styles.descriptionInput}
              placeholder="Agrega detalles relevantes…"
              placeholderTextColor="#9e9e9e"
              value={draft.description}
              onChangeText={(value) => onChange({ description: value })}
              multiline
              maxLength={REPORT_LIMITS.description.maxLength}
              accessibilityLabel="Descripción del evento"
            />
          </View>
          <Text style={styles.counter}>{remaining}</Text>
        </Section>

        {submitError && !hasFieldErrors ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{submitError.message}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
        >
          <Text style={styles.submitText}>{submitLabel}</Text>
        </TouchableOpacity>

        {submitting ? <ActivityIndicator color="#ff6b35" /> : null}

        <TouchableOpacity style={styles.backLink} onPress={onBack} accessibilityRole="button">
          <Text style={styles.backLinkText}>Volver a foto y ubicación</Text>
        </TouchableOpacity>
      </ScrollView>
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
  bodyContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 9,
  },
  section: {
    gap: 4,
  },
  sectionLabel: {
    fontFamily: 'DM Sans',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 19,
    color: '#5e5e5e',
  },
  sectionHint: {
    fontFamily: 'DM Sans',
    fontSize: 12,
    lineHeight: 17,
    color: '#9e9e9e',
  },
  sectionError: {
    fontFamily: 'DM Sans',
    fontSize: 12,
    lineHeight: 17,
    color: '#b3261e',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 6,
  },
  datetimeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  field: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.34,
    borderColor: '#e0e0e0',
    backgroundColor: '#f4f4f4',
  },
  fieldInput: {
    fontFamily: 'DM Sans',
    fontSize: 14,
    lineHeight: 19,
    color: '#2a2a2a',
    padding: 0,
  },
  descriptionField: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.34,
    borderColor: '#e0e0e0',
    backgroundColor: '#f4f4f4',
  },
  descriptionInput: {
    width: '100%',
    minHeight: 56,
    fontFamily: 'DM Sans',
    fontSize: 14,
    lineHeight: 19,
    color: '#2a2a2a',
    textAlignVertical: 'top',
  },
  counter: {
    fontFamily: 'DM Sans',
    fontSize: 11,
    lineHeight: 15,
    color: '#9e9e9e',
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
  submitButton: {
    width: '100%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#ff6b35',
  },
  submitText: {
    fontFamily: 'Outfit',
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
    color: '#ffffff',
    textAlign: 'center',
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: 6,
  },
  backLinkText: {
    fontFamily: 'DM Sans',
    fontSize: 13,
    lineHeight: 18,
    color: '#5e5e5e',
  },
});
