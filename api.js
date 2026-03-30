/**
 * api.js — Capa de comunicación compartida HT-BPDT v2.0
 * Coloca este archivo en la RAÍZ del repositorio (mismo nivel que las carpetas).
 * ⚠️  Reemplaza GAS_URL con la URL de tu deployment de Google Apps Script.
 */

const GAS_URL = 'https://script.google.com/macros/s/REEMPLAZA_CON_TU_DEPLOYMENT_ID/exec';

// ─────────────────────────────────────────────
//  LLAMADA CENTRAL A GAS
// ─────────────────────────────────────────────

async function gasCall(action, params = {}) {
  const body = JSON.stringify({ action, ...params });
  let response;

  try {
    response = await fetch(GAS_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' }, // GAS requiere text/plain para evitar preflight CORS
      body
    });
  } catch (networkErr) {
    throw new Error('Sin conexión. Verifica tu red e intenta nuevamente.');
  }

  if (!response.ok) {
    throw new Error(`Error del servidor: HTTP ${response.status}`);
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error('Respuesta inválida del servidor.');
  }

  if (json.status === 'error') {
    throw new Error(json.message || 'Error desconocido.');
  }

  return json.data;
}

// ─────────────────────────────────────────────
//  GESTIÓN DE SESIÓN (sessionStorage)
// ─────────────────────────────────────────────

const Session = {
  KEY: 'htbpdt_v2',

  set(data) {
    sessionStorage.setItem(this.KEY, JSON.stringify(data));
  },

  get() {
    try {
      return JSON.parse(sessionStorage.getItem(this.KEY));
    } catch {
      return null;
    }
  },

  clear() {
    sessionStorage.removeItem(this.KEY);
  },

  /**
   * Verifica sesión activa y rol permitido.
   * Si no cumple, redirige a la página de inicio.
   * @param {string[]} rolesPermitidos - Ej: ['ASISTENTE', 'VALIDADOR']
   */
  require(rolesPermitidos = []) {
    const s = this.get();
    if (!s) {
      window.location.href = rootPath() + 'tripulante/index.html';
      return null;
    }
    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(s.rol)) {
      alert(`Acceso denegado. Esta sección es para: ${rolesPermitidos.join(', ')}.`);
      Session.clear();
      window.location.href = rootPath() + 'tripulante/index.html';
      return null;
    }
    return s;
  }
};

/** Devuelve la ruta relativa hacia la raíz del repositorio */
function rootPath() {
  const depth = window.location.pathname.split('/').filter(Boolean).length;
  return depth > 1 ? '../' : './';
}

// ─────────────────────────────────────────────
//  COMPRESIÓN DE IMÁGENES
// ─────────────────────────────────────────────

/**
 * Comprime una imagen y retorna su base64 (sin prefijo data:...).
 * Reduce el payload antes de enviar a GAS.
 * @param {File} file - Archivo de imagen
 * @param {number} maxKB - Tamaño máximo en KB (default: 800)
 */
async function comprimirImagen(file, maxKB = 800) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('El archivo seleccionado no es una imagen válida.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo procesar la imagen.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = file.size > maxKB * 1024
          ? Math.sqrt((maxKB * 1024) / file.size)
          : 1;
        canvas.width  = Math.floor(img.width  * ratio);
        canvas.height = Math.floor(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
        resolve(base64);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────
//  UTILIDADES DE UI
// ─────────────────────────────────────────────

/** Formatea fecha a DD/MM/YYYY */
function formatFecha(valor) {
  if (!valor) return '—';
  const d = new Date(valor);
  return isNaN(d.getTime())
    ? String(valor)
    : d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Retorna class CSS según estado del documento */
function badgeClase(estado) {
  const e = String(estado || '').toUpperCase();
  if (e === 'APROBADO')             return 'badge-ok';
  if (e === 'PENDIENTE_VALIDACION') return 'badge-pending';
  if (e === 'RECHAZADO')            return 'badge-rejected';
  return 'badge-missing';
}

/** Retorna texto legible para el estado */
function badgeTexto(estado) {
  const e = String(estado || '').toUpperCase();
  if (e === 'APROBADO')             return 'Aprobado';
  if (e === 'PENDIENTE_VALIDACION') return 'En revisión';
  if (e === 'RECHAZADO')            return 'Rechazado';
  return 'Sin subir';
}

/** Retorna emoji según estado */
function badgeIcono(estado) {
  const e = String(estado || '').toUpperCase();
  if (e === 'APROBADO')             return '✅';
  if (e === 'PENDIENTE_VALIDACION') return '⏳';
  if (e === 'RECHAZADO')            return '❌';
  return '📋';
}
