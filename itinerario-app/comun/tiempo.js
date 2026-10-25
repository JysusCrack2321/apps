// comun/tiempo.js
// Utilidades de fecha y hora puras (sin DOM) para la zona horaria America/Bogota (formato ISO local).

/**
 * Formatea un Date a fecha local ISO 'YYYY-MM-DD'.
 * @param {Date} [fecha=new Date()]
 * @returns {string}
 */
export function aFechaIso(fecha = new Date()) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Formatea un Date a fecha-hora local ISO 'YYYY-MM-DDTHH:MM'.
 * @param {Date} [fecha=new Date()]
 * @returns {string}
 */
export function aFechaHoraIso(fecha = new Date()) {
  const f = aFechaIso(fecha);
  const hora = String(fecha.getHours()).padStart(2, '0');
  const min = String(fecha.getMinutes()).padStart(2, '0');
  return `${f}T${hora}:${min}`;
}

/**
 * Obtiene la hora actual en formato 'HH:MM'.
 * @param {Date} [fecha=new Date()]
 * @returns {string}
 */
export function aHoraIso(fecha = new Date()) {
  const hora = String(fecha.getHours()).padStart(2, '0');
  const min = String(fecha.getMinutes()).padStart(2, '0');
  return `${hora}:${min}`;
}

/**
 * Convierte una cadena 'HH:MM' a minutos desde las 00:00.
 * @param {string} horaStr
 * @returns {number}
 */
export function horaAMinutos(horaStr) {
  if (!horaStr || typeof horaStr !== 'string') return 0;
  const [h, m] = horaStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Convierte minutos desde las 00:00 a cadena 'HH:MM'.
 * @param {number} minutos
 * @returns {string}
 */
export function minutosAHora(minutos) {
  const total = Math.max(0, Math.floor(minutos));
  if (total >= 1440) return '24:00';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Parsea una fecha ISO ('YYYY-MM-DD' o 'YYYY-MM-DDTHH:MM') en un Date local.
 * Evita la interpretación UTC que desfasa días en fechas 'YYYY-MM-DD'.
 * @param {string} isoStr
 * @returns {Date|null}
 */
export function parsearIso(isoStr) {
  if (!isoStr || typeof isoStr !== 'string') return null;
  const partes = isoStr.split('T');
  const [anio, mes, dia] = partes[0].split('-').map(Number);
  if (!anio || !mes || !dia) return null;

  let hora = 0;
  let min = 0;
  if (partes[1]) {
    const [h, m] = partes[1].split(':').map(Number);
    hora = h || 0;
    min = m || 0;
  }
  return new Date(anio, mes - 1, dia, hora, min, 0, 0);
}

/**
 * Calcula la diferencia en horas entre dos fechas ISO (hasta - desde).
 * @param {string} desdeIso
 * @param {string} hastaIso
 * @returns {number}
 */
export function diferenciaHoras(desdeIso, hastaIso) {
  const d1 = parsearIso(desdeIso);
  const d2 = parsearIso(hastaIso);
  if (!d1 || !d2) return 0;
  return (d2.getTime() - d1.getTime()) / (1000 * 60 * 60);
}

/**
 * Suma o resta días a una fecha 'YYYY-MM-DD'.
 * @param {string} fechaIso
 * @param {number} dias
 * @returns {string}
 */
export function sumarDias(fechaIso, dias) {
  const d = parsearIso(fechaIso);
  if (!d) return fechaIso;
  d.setDate(d.getDate() + dias);
  return aFechaIso(d);
}

/**
 * Obtiene el día de la semana (1 = lunes, ..., 7 = domingo).
 * @param {string} fechaIso
 * @returns {number}
 */
export function diaDeLaSemana(fechaIso) {
  const d = parsearIso(fechaIso);
  if (!d) return 1;
  const diaJs = d.getDay(); // 0 = domingo, 1 = lunes ... 6 = sábado
  return diaJs === 0 ? 7 : diaJs;
}

const NOMBRES_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const NOMBRES_DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const NOMBRES_MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Formatea una fecha para vista legible (ej. 'mié 14 oct').
 * @param {string} fechaIso
 * @returns {string}
 */
export function formatearFecha(fechaIso) {
  const d = parsearIso(fechaIso);
  if (!d) return fechaIso;
  const nomDia = NOMBRES_DIAS_CORTOS[d.getDay()];
  const dia = d.getDate();
  const nomMes = NOMBRES_MESES_CORTOS[d.getMonth()];
  return `${nomDia} ${dia} ${nomMes}`;
}

/**
 * Formatea una hora en formato amigable de 12 horas (ej. '11:59 pm', '7:00 am').
 * @param {string} horaStr 'HH:MM'
 * @returns {string}
 */
export function formatearHora12(horaStr) {
  if (!horaStr || typeof horaStr !== 'string') return '';
  const [hStr, mStr] = horaStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ? mStr.padStart(2, '0') : '00';
  if (isNaN(h)) return horaStr;
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Formatea una fecha y hora de entrega (ej. 'mié 14, 11:59 pm').
 * @param {string} fechaHoraIso 'YYYY-MM-DDTHH:MM'
 * @returns {string}
 */
export function formatearEntrega(fechaHoraIso) {
  if (!fechaHoraIso) return 'Sin fecha';
  const d = parsearIso(fechaHoraIso);
  if (!d) return fechaHoraIso;
  const nomDia = NOMBRES_DIAS_CORTOS[d.getDay()];
  const dia = d.getDate();
  const partes = fechaHoraIso.split('T');
  const hora12 = partes[1] ? formatearHora12(partes[1]) : '';
  return `${nomDia} ${dia}, ${hora12}`;
}
