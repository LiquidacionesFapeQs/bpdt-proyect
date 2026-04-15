const API_URL = "https://script.google.com/macros/s/AKfycbwt_mlT__C4FolgI4ygxx7-UCj1xq4G-jFgac7_RGA1QzhgzZurOkHD4FuIBHW-sWzAjg/exec";

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

    // 1. Validaciones de campos obligatorios
    if(!payload.dni || payload.dni.length < 8) return alert("DNI no válido.");
    if(!payload.vencDni || !document.getElementById('file-dni').files[0]) {
        return alert("El DNI y su fecha de vencimiento son obligatorios.");
    }

    // 2. Validación de Fecha: No permitir documentos vencidos
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
        // 3. Conversión de archivos a Base64
        payload.fileDni = await toBase64(document.getElementById('file-dni').files[0]);
        if(payload.cargo === 'CONDUCTOR') {
            payload.fileLicencia = await toBase64(document.getElementById('file-licencia').files[0]);
        }

        // 4. Construcción del objeto de metadatos para la Columna F
        payload.docsMetadata = [
            { tipo: 'DNI', venc: payload.vencDni }
        ];

        if(payload.cargo === 'CONDUCTOR') {
            payload.docsMetadata.push({ tipo: 'BREVETE', venc: payload.vencLicencia });
        }

        // 5. Envío al servidor
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
// REEMPLAZA TU FUNCIÓN showDashboard POR ESTA:
function showDashboard(user) {
    showView('dashboard');

    // Extraemos con seguridad (por si el servidor manda nombres en mayúsculas)
    const nombreCompleto = `${user.nombres || user.NOMBRES || ''} ${user.apellidos || user.APELLIDOS || ''}`.trim();
    
    document.getElementById('display-name').innerText = nombreCompleto || "USUARIO";
    document.getElementById('display-cargo').innerText = user.cargo || user.CARGO || "SIN CARGO";
    document.getElementById('display-empresa').innerText = user.empresa || user.RAZON_SOCIAL || "";

    // Actualizar KPI
    const cumplimiento = user.cumplimiento || {};
    const pct = Math.round((cumplimiento.porcentaje || 0) * 100);
    
    document.getElementById('compliance-pct').innerText = pct + '%';
    const label = document.getElementById('compliance-label');
    const ring = document.getElementById('compliance-ring');
    
    let color = pct >= 90 ? "#10b981" : (pct >= 70 ? "#f59e0b" : "#E30613");
    ring.style.background = `conic-gradient(${color} ${pct}%, #e2e8f0 ${pct}%)`;
    label.innerText = cumplimiento.calificacion || "SIN CALIFICAR";
    label.style.color = color;

    // Renderizar lista de documentos
    renderDocs(user.docs || []);
}

function renderDocs(docs) {
    const container = document.getElementById('docs-list');
    container.innerHTML = '<p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Estado de tus documentos</p>';

    if (docs.length === 0) {
        container.innerHTML += '<p class="text-center text-sm text-slate-400 py-10">No hay documentos registrados aún.</p>';
        return;
    }

    docs.forEach(doc => {
        const card = document.createElement('div');
        card.className = "p-4 bg-white rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center animate-fade-in";
        
        // Formatear fecha
        const fechaStr = doc.venc ? new Date(doc.venc).toLocaleDateString() : 'Sin fecha';
        
        card.innerHTML = `
            <div>
                <p class="text-xs font-bold text-slate-800 uppercase">${doc.tipo}</p>
                <p class="text-[10px] text-slate-400 font-medium">Vencimiento: ${fechaStr}</p>
            </div>
            <span class="px-3 py-1 rounded-full text-[9px] font-black ${getStatusClass(doc.estado)}">
                ${doc.estado.replace('_', ' ')}
            </span>
        `;
        container.appendChild(card);
    });
}

// Helper para colores de etiquetas
function getStatusClass(status) {
    switch (status) {
        case 'APROBADO': return 'bg-emerald-100 text-emerald-600';
        case 'RECHAZADO': return 'bg-rose-100 text-rose-600';
        default: return 'bg-amber-100 text-amber-600'; // PENDIENTE_VALIDACION
    }
}
