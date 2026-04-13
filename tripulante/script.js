const API_URL = "https://script.google.com/macros/s/AKfycbx2NvL5FI5aA_XRTfCLTCkJHUj9dq7chPeUgXBGSdw9CxF7fd-idQD-xzb_971mHd28Kw/exec";

// --- NAVEGACIÓN ---
function showView(viewName) {
    document.querySelectorAll('[id^="view-"]').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${viewName}`).classList.remove('hidden');
    if(viewName === 'register') loadEmpresas();
}

function toggleLoader(show, text = "Procesando...") {
    const l = document.getElementById('loader');
    document.getElementById('loader-text').innerText = text;
    show ? l.classList.remove('hidden') : l.classList.add('hidden');
}

// --- ACCIONES ---

async function loadEmpresas() {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getEmpresas' }) });
    const data = await res.json();
    const select = document.getElementById('reg-empresa');
    select.innerHTML = '<option value="">Seleccione Empresa</option>';
    data.empresas.forEach(e => select.innerHTML += `<option value="${e}">${e}</option>`);
}

async function handleCheckDni() {
    const dni = document.getElementById('reg-dni').value;
    if(!dni) return alert("Ingrese DNI");
    
    toggleLoader(true, "Buscando datos...");
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'checkDni', dni }) });
    const result = await res.json();
    toggleLoader(false);

    document.getElementById('reg-fields').classList.remove('hidden');
    if(result.exists) {
        alert("¡Datos encontrados! Por favor, crea tu contraseña y sube los documentos.");
        document.getElementById('reg-nombres').value = result.data.nombres;
        document.getElementById('reg-nombres').readOnly = true;
        document.getElementById('reg-apellidos').value = result.data.apellidos;
        document.getElementById('reg-apellidos').readOnly = true;
        document.getElementById('reg-cargo').value = result.data.cargo;
        document.getElementById('reg-empresa').value = result.data.empresa;
        toggleFieldsByCargo();
    }
}

function toggleFieldsByCargo() {
    const cargo = document.getElementById('reg-cargo').value;
    const box = document.getElementById('box-licencia');
    cargo === 'CONDUCTOR' ? box.classList.remove('hidden') : box.classList.add('hidden');
}

async function handleRegister() {
    const payload = {
        action: 'register',
        dni: document.getElementById('reg-dni').value,
        nombres: document.getElementById('reg-nombres').value,
        apellidos: document.getElementById('reg-apellidos').value,
        cargo: document.getElementById('reg-cargo').value,
        empresa: document.getElementById('reg-empresa').value,
        password: document.getElementById('reg-pass').value
    };

    if(!payload.password) return alert("Debe crear una contraseña");

    // Convertir archivos a Base64
    toggleLoader(true, "Subiendo documentos...");
    const fileDni = document.getElementById('file-dni').files[0];
    const fileLic = document.getElementById('file-licencia').files[0];

    if(fileDni) payload.fileDni = await toBase64(fileDni);
    if(fileLic && payload.cargo === 'CONDUCTOR') payload.fileLicencia = await toBase64(fileLic);

    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
    const result = await res.json();
    toggleLoader(false);

    if(result.success) {
        alert(result.message);
        showView('login');
    } else {
        alert("Error: " + result.message);
    }
}

// Helper: Convertir archivo a String Base64 para Apps Script
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

async function handleLogin() {
    const dni = document.getElementById('login-dni').value;
    const pass = document.getElementById('login-pass').value;

    toggleLoader(true, "Validando...");
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', dni, password: pass }) });
    const result = await res.json();
    toggleLoader(false);

    if(result.success) {
        showDashboard(result.user);
    } else {
        alert(result.message);
    }
}

function showDashboard(user) {
    showView('dashboard');
    document.getElementById('user-info').innerHTML = `
        <p class="font-bold text-lg">${user.dni}</p>
        <p class="text-sm text-gray-600">${user.empresa}</p>
        <p class="text-xs text-blue-500 uppercase">${user.rol}</p>
    `;
}
