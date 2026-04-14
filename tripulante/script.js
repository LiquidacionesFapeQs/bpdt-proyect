const API_URL = "https://script.google.com/macros/s/AKfycbwJPfX6B7DRciLZdEWkoqlUPkvORfvA_Ysk6yyBHr8qSY6QzNW5dXwBZ527vJw7DbgUPg/exec";

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
        password: autoPass 
    };

    // 1. Validaciones (Campos y Fechas)
    if(!payload.dni || payload.dni.length < 8) return alert("DNI no válido.");
    if(!payload.vencDni || !document.getElementById('file-dni').files[0]) {
        return alert("El DNI y su fecha de vencimiento son obligatorios.");
    }

    const hoy = new Date().toISOString().split('T')[0];
    if (payload.vencDni < hoy) return alert("El DNI está vencido. No se puede registrar.");
    
    if(payload.cargo === 'CONDUCTOR') {
        if(!payload.vencLicencia || !document.getElementById('file-licencia').files[0]) {
            return alert("La Licencia y su vencimiento son obligatorios para conductores.");
        }
        if (payload.vencLicencia < hoy) return alert("La Licencia está vencida. No se puede registrar.");
    }

    toggleLoader(true, "Subiendo documentos...");

    try {
        // 2. Preparar archivos en Base64
        payload.fileDni = await toBase64(document.getElementById('file-dni').files[0]);
        if(payload.cargo === 'CONDUCTOR') {
            payload.fileLicencia = await toBase64(document.getElementById('file-licencia').files[0]);
        }

        // --- SOLUCIÓN AQUÍ: CONSTRUIR DOCSMETADATA ---
        // Este array es el que lee el servidor para llenar la Columna F
        payload.docsMetadata = [
            { tipo: 'DNI', venc: payload.vencDni }
        ];

        if(payload.cargo === 'CONDUCTOR') {
            payload.docsMetadata.push({ tipo: 'BREVETE', venc: payload.vencLicencia });
        }
        // --------------------------------------------

        // 3. Envío al servidor
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();

        if(result.success) {
            alert(`¡Registro exitoso!\nContraseña: ${autoPass}`);
            location.reload(); 
        } else {
            alert("Error: " + result.message);
        }
    } catch (e) {
        alert("Error de conexión.");
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

// Añadimos 'kpi' como segundo parámetro
function showDashboard(user, kpi) {
    showView('dashboard');

    // 1. Datos de Identidad
    document.getElementById('user-info').innerHTML = `
        <h2 class="text-xl font-black text-slate-800">${user.dni}</h2>
        <p class="text-[10px] font-bold text-blue-600 uppercase tracking-widest">${user.empresa}</p>
        <p class="text-[9px] font-medium text-slate-400 uppercase">${user.cargo || user.rol}</p>
    `;

    // 2. Cálculo del porcentaje para la tarjeta
    const card = document.getElementById('compliance-card');
    const rawPct = (kpi && kpi.porcentaje) ? kpi.porcentaje : 0;
    const pct = Math.round(rawPct * 100);

    // 3. Inyectar datos en la tarjeta
    document.getElementById('compliance-pct').innerText = `${pct}%`;
    document.getElementById('compliance-label').innerText = (kpi && kpi.calificacion) ? kpi.calificacion : "SIN DATOS";

    // 4. Cambiar el COLOR de la tarjeta dinámicamente
    card.className = "p-6 rounded-2xl text-white shadow-lg transition-all duration-500"; // Reset
    
    if (pct >= 90) card.classList.add('bg-emerald-500'); // Verde si es alto
    else if (pct >= 70) card.classList.add('bg-amber-500'); // Naranja si es medio
    else card.classList.add('bg-rose-500'); // Rojo si es bajo (como tu 0%)
}
