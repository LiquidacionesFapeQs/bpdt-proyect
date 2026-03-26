// ==================== CONFIGURACIÓN ====================
const SCRIPT_URL = "https://script.google.com/macros/s/TU_DEPLOY_ID/exec"; // ← CAMBIA ESTO

let currentUser = null;
let currentFileBase64 = null;
let currentFileMimeType = null;

// ==================== HELPERS ====================
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 toast ${
    type === "success" ? "bg-green-600" : "bg-red-600"
  }`;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 4000);
}

async function callBackend(action, params = {}) {
  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...params })
    });
    
    const result = await response.json();
    if (result.status === "error") throw new Error(result.message);
    return result.data;
  } catch (error) {
    showToast(error.message, "error");
    throw error;
  }
}

// ==================== LOGIN ====================
async function login() {
  const dni = document.getElementById("dni").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!dni || dni.length !== 8) {
    showToast("Ingresa un DNI válido de 8 dígitos", "error");
    return;
  }

  try {
    const userData = await callBackend("LOGIN", { username: dni, password });
    
    currentUser = userData;
    localStorage.setItem("bpdt_user", JSON.stringify(userData));

    // Redirigir visualmente
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("dashboardScreen").classList.remove("hidden");

    renderDashboard();
    loadPendientes();
    loadTiposDocumento();
    
    showToast(`Bienvenido, ${userData.nombre}`);
  } catch (e) {
    // Error ya mostrado por callBackend
  }
}

// ==================== DASHBOARD ====================
function renderDashboard() {
  document.getElementById("nombreUsuario").textContent = currentUser.nombre;
  document.getElementById("cargoUsuario").textContent = currentUser.cargo || "Tripulante";
}

async function loadPendientes() {
  try {
    const pendientes = await callBackend("GET_MIS_PENDIENTES", {
      tipoNexo: "TRIPULACION",
      idEntidad: currentUser.dni
    });

    const container = document.getElementById("pendientesList");
    container.innerHTML = "";

    if (pendientes.length === 0) {
      container.innerHTML = `<p class="text-green-600 text-center py-4">¡Todos tus documentos están al día!</p>`;
      return;
    }

    pendientes.forEach(doc => {
      const div = document.createElement("div");
      div.className = "flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl";
      div.innerHTML = `
        <div>
          <p class="font-medium">${doc.tipo_documento}</p>
          <p class="text-sm text-gray-500">${doc.estado}</p>
        </div>
        ${doc.url ? `<a href="${doc.url}" target="_blank" class="text-blue-600 hover:underline text-sm">Ver</a>` : ''}
      `;
      container.appendChild(div);
    });
  } catch (e) {}
}

async function loadTiposDocumento() {
  // Por ahora cargamos los que están en Param_Documentos para TRIPULACION
  // Puedes mejorarlo después consultando reglas
  const select = document.getElementById("tipoDocumento");
  select.innerHTML = `
    <option value="">Selecciona documento...</option>
    <option value="DNI">DNI</option>
    <option value="BREVETE">Brevete (solo conductores)</option>
    <option value="CARNET SANIDAD">Carnet de Sanidad</option>
    <option value="SCTR">SCTR</option>
  `;
}

// ==================== SUBIR DOCUMENTO ====================
document.getElementById("uploadArea").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

document.getElementById("fileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(ev) {
    currentFileBase64 = ev.target.result.split(',')[1]; // solo la parte base64
    currentFileMimeType = file.type;

    document.getElementById("imagePreview").src = ev.target.result;
    document.getElementById("previewContainer").classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

async function subirDocumento() {
  const tipoDoc = document.getElementById("tipoDocumento").value;
  const fechaVence = document.getElementById("fechaVencimiento").value;

  if (!tipoDoc) {
    showToast("Selecciona un tipo de documento", "error");
    return;
  }
  if (!currentFileBase64) {
    showToast("Selecciona una imagen", "error");
    return;
  }

  try {
    await callBackend("UPLOAD_DOCUMENTO", {
      tipoNexo: "TRIPULACION",
      nexoId: currentUser.dni,
      tipoDocumento: tipoDoc,
      base64File: currentFileBase64,
      mimeType: currentFileMimeType,
      fechaVencimiento: fechaVence || null,
      usuarioCarga: currentUser.nombre || currentUser.dni
    });

    showToast("Documento subido correctamente y enviado a validación");
    
    // Limpiar
    currentFileBase64 = null;
    document.getElementById("previewContainer").classList.add("hidden");
    document.getElementById("fileInput").value = "";
    document.getElementById("tipoDocumento").value = "";
    
    // Recargar pendientes
    loadPendientes();
  } catch (e) {
    // Error ya mostrado
  }
}

// ==================== LOGOUT ====================
function logout() {
  localStorage.removeItem("bpdt_user");
  location.reload();
}

// ==================== INIT ====================
function init() {
  const savedUser = localStorage.getItem("bpdt_user");
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("dashboardScreen").classList.remove("hidden");
    renderDashboard();
    loadPendientes();
    loadTiposDocumento();
  }

  // Tailwind script ya cargado vía CDN
}

window.onload = init;
