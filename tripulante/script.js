const API_URL = "https://script.google.com/macros/s/AKfycbw23m-TN4n_Ytx4TO5eqs89Kh8d13p9uceVb663AnpWcSeX7S7LlZlsfueVbUAyYlU/exec";

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
    // 1. Capturamos el DNI y generamos la clave automáticamente
    const dniInput = document.getElementById('reg-dni').value;
    const autoPass = dniInput.toString().slice(-4); 

    const payload = {
        action: 'register',
        dni: dniInput,
        nombres: document.getElementById('reg-nombres').value,
        apellidos: document.getElementById('reg-apellidos').value,
        cargo: document.getElementById('reg-cargo').value,
        empresa: document.getElementById('reg-empresa').value,
        vencDni: document.getElementById('venc-dni').value,
        vencLicencia: document.getElementById('venc-licencia').value,
        password: autoPass // Enviamos la clave autogenerada
    };

    // 2. Validaciones de archivos y fechas obligatorias
    if(!payload.dni || payload.dni.length < 8) return alert("DNI no válido.");
    if(!payload.vencDni || !document.getElementById('file-dni').files[0]) {
        return alert("El DNI y su fecha de vencimiento son obligatorios.");
    }
    
    if(payload.cargo === 'CONDUCTOR') {
        if(!payload.vencLicencia || !document.getElementById('file-licencia').files[0]) {
            return alert("Para conductores, la Licencia y su vencimiento son obligatorios.");
        }
    }

    toggleLoader(true, "Procesando registro...");

    try {
        // 3. Conversión de archivos a Base64
        const fileDni = document.getElementById('file-dni').files[0];
        payload.fileDni = await toBase64(fileDni);

        if(payload.cargo === 'CONDUCTOR') {
            const fileLic = document.getElementById('file-licencia').files[0];
            payload.fileLicencia = await toBase64(fileLic);
        }

        // 4. Envío al servidor (Apps Script)
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();

        if(result.success) {
            alert(`¡Registro exitoso!\n\nTu contraseña de acceso son los últimos 4 dígitos de tu DNI: ${autoPass}`);
            location.reload(); // Limpia el formulario y vuelve al login
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        alert("Error de conexión con el servidor.");
    }
    toggleLoader(false);
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
