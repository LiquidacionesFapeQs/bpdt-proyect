// api.js - Cliente compartido para las 3 apps (GitHub Pages)

const SCRIPT_URL = "https://script.google.com/macros/s/TU_URL_AQUI/exec";  
// ← Cambia esto por tu URL real del Web App

async function callBackend(action, payload = {}) {
  try {
    const fullPayload = { action, ...payload };
    console.log(`→ Enviando: ${action}`, payload);

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(fullPayload)
    });

    const text = await res.text();
    console.log(`Respuesta de ${action}:`, text.substring(0, 250));

    const result = JSON.parse(text);
    if (result.status === 'error') throw new Error(result.message);
    
    return result.data || result;
  } catch (err) {
    console.error(`Error en ${action}:`, err);
    throw err;
  }
}

// API pública
window.API = {
  login: (user, pass) => callBackend('LOGIN', { username: user, password: pass }),
  consultarDNI: (dni) => callBackend('CONSULTAR_DNI_REGISTRO', { dni }),
  registrarTripulante: (params) => callBackend('REGISTER_TRIPULANTE', params),
  getListaEmpresas: () => callBackend('GET_LISTA_EMPRESAS'),
  subirDocumento: (params) => callBackend('UPLOAD_DOCUMENTO', params)
};
