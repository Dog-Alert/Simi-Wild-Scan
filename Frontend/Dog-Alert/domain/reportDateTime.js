/**
 * Entrada de fecha y hora del reporte.
 *
 * RF-010 pide que el formulario requiera fecha y hora del evento, y RF-015 que
 * solo se acepten fechas desde el lanzamiento y no futuras. Aqui solo se
 * traduce entre el texto que escribe la persona y un `Date`; las reglas de
 * negocio siguen en `domain/reportValidation.js`.
 *
 * La hora es local a propósito: quien reporta vio el evento en Creel, y
 * `buildReportPayload` convierte a UTC al serializar. Si se interpretara el
 * texto como UTC, un reporte de las 20:00 quedaria fechado 7 horas antes.
 *
 * Historia: C2 - Movil - Formulario georreferenciado y limite de Creel.
 */

import { REPORT_LIMITS } from '../const/reportCatalogs';

const DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

function pad(value) {
  return String(value).padStart(2, '0');
}

/** Divide un `Date` en los dos textos que ve la persona. */
export function formatEventAtInput(date) {
  const value = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();

  return {
    date: `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`,
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
}

/**
 * Convierte "DD/MM/AAAA" y "HH:MM" en un `Date` local, o `null` si no son
 * validos. Rechaza fechas que no existen, como 31/02: `new Date(2026, 1, 31)`
 * se corre a marzo en silencio, asi que se compara la fecha resultante con la
 * escrita.
 */
export function parseEventAtInput(dateText, timeText) {
  const dateMatch = DATE_PATTERN.exec(String(dateText ?? '').trim());
  const timeMatch = TIME_PATTERN.exec(String(timeText ?? '').trim());

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const year = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);

  if (month < 1 || month > 12 || hours > 23 || minutes > 59) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);

  const isSameDay =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;

  if (!isSameDay) {
    return null;
  }

  return parsed;
}

/** Cantidad de caracteres que la descripcion admite. */
export function descriptionRemaining(description) {
  const value = typeof description === 'string' ? description : '';

  return REPORT_LIMITS.description.maxLength - value.length;
}
