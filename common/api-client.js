// common/api-client.js
const SCRIPT_URL = "https://script.google.com/macros/s/TU_WEB_APP_URL/exec";   // ← Cambia esto por tu URL real

export async function callApi(action, data = {}) {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data })
    });

    if (!response.ok) throw new Error('Error en la red');

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || 'Error desconocido');
    }
    
    return result.data || result;
  } catch (error) {
    console.error(`Error en acción ${action}:`, error);
    throw error;
  }
}

// Ejemplos de uso:
// await callApi('login', { dni: '12345678', password: 'xxxx' });
// await callApi('subirDocumento', { dni, tipo: 'DNI', archivo: base64 });
