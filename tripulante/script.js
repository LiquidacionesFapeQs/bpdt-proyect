const API_URL = "https://script.google.com/macros/s/AKfycbwkD0je1fOXb7xwzFSyap6sPC_rQx3cRAIvT6Tsm4PXZOVCumroFQQlb62gz6AlsEq5HQ/exec";

// --- NAVEGACIÓN Y UX ---
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

function showToast(msg, type = 'info') {
    const t = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    document.getElementById('toast-msg').innerText = msg;
    
    // Asignación de clases y símbolos según el tipo
    icon.className = type === 'success' ? 'bg-green-500 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm' : 
                     (type === 'error' ? 'bg-brand-red w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm' : 
                     'bg-blue-500 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm');
    icon.innerText = type === 'success' ? '✓' : (type === 'error' ? '!' : 'i');
    
    t.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => t.classList.add('opacity-0', 'translate-y-10'), 4000);
}

// --- WIZARD REGISTRO UI ---
function goToStep(stepNum) {
    document.querySelectorAll('[id^="step-"]').forEach(s => s.classList.add('hidden'));
    document.getElementById(`step-${stepNum}`).classList.remove('hidden');
    document.getElementById('reg-step-label').innerText = `Paso ${stepNum} de 3`;
}

function selectCargo(cargo) {
    document.getElementById('reg-cargo').value = cargo;
    document.getElementById('btn-conductor').classList.remove('border-brand-red', 'bg-red-50', 'custom-ring');
    document.getElementById('btn-auxiliar').classList.remove('border-brand-red', 'bg-red-50', 'custom-ring');
    
    const btnId = cargo === 'CONDUCTOR' ? 'btn-conductor' : 'btn-auxiliar';
    document.getElementById(btnId).classList.add('border-brand-red', 'bg-red-50', 'custom-ring');
    
    // Mostrar u ocultar campo de licencia
    const box = document.getElementById('field-licencia');
    cargo === 'CONDUCTOR' ? box.classList.remove('hidden') : box.classList.add('hidden');
}

// --- ACCIONES CORE ---
async function loadEmpresas() {
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'getEmpresas' }) });
        const data = await res.json();
        const select = document.getElementById('reg-empresa');
        select.innerHTML = '<option value="">Seleccione Empresa</option>';
        data.empresas.forEach(e => select.innerHTML += `<option value="${e}">${e}</option>`);
    } catch(e) {
        console.error("Error cargando empresas:", e);
    }
}

async function handleCheckDni() {
    const dni = document.getElementById('reg-dni').value;
    if(!dni) return showToast("Ingrese DNI para validar", "error");
    
    toggleLoader(true, "Validando DNI en la base de datos...");
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'checkDni', dni }) });
        const result = await res.json();
        toggleLoader(false);

        if(result.exists) {
            showToast("¡Datos encontrados!", "success");
            // Guardamos en campos ocultos
            document.getElementById('reg-nombres').value = result.data.nombres;
            document.getElementById('reg-apellidos').value = result.data.apellidos;
            
            // Mostramos en UI visualmente
            document.getElementById('detected-name').innerText = `${result.data.nombres} ${result.data.apellidos}`;
            document.getElementById('dni-result').classList.remove('hidden');
            
            // Habilitar siguiente paso
            const btnNext = document.getElementById('btn-next-1');
            btnNext.classList.replace('bg-slate-200', 'bg-brand-red');
            btnNext.classList.replace('text-slate-400', 'text-white');
            btnNext.disabled = false;
        } else {
            showToast("DNI no encontrado. Contacte al administrador.", "error");
        }
    } catch (e) {
        toggleLoader(false);
        showToast("Error de conexión al servidor.", "error");
    }
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

    // 1. Validaciones
    if(!payload.dni || payload.dni.length < 8) return showToast("DNI no válido.", "error");
    if(!payload.cargo) return showToast("Debes seleccionar tu cargo.", "error");
    if(!payload.empresa) return showToast("Debes seleccionar una empresa.", "error");
    if(!payload.vencDni || !document.getElementById('file-dni').files[0]) {
        return showToast("El DNI y su fecha de vencimiento son obligatorios.", "error");
    }

    const hoy = new Date().toISOString().split('T')[0];
    if (payload.vencDni < hoy) return showToast("El DNI está vencido. No se puede registrar.", "error");
    
    if(payload.cargo === 'CONDUCTOR') {
        if(!payload.vencLicencia || !document.getElementById('file-licencia').files[0]) {
            return showToast("La Licencia y su vencimiento son obligatorios para conductores.", "error");
        }
        if (payload.vencLicencia < hoy) return showToast("La Licencia está vencida. No se puede registrar.", "error");
    }

    toggleLoader(true, "Convirtiendo y subiendo documentos...");

    try {
        // 3. Conversión Base64
        payload.fileDni = await toBase64(document.getElementById('file-dni').files[0]);
        if(payload.cargo === 'CONDUCTOR') {
            payload.fileLicencia = await toBase64(document.getElementById('file-licencia').files[0]);
        }

        // 4. Metadata Docs
        payload.docsMetadata = [ { tipo: 'DNI', venc: payload.vencDni } ];
        if(payload.cargo === 'CONDUCTOR') {
            payload.docsMetadata.push({ tipo: 'BREVETE', venc: payload.vencLicencia });
        }

        // 5. Envío
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
        const result = await res.json();

        if(result.success) {
            showToast(`¡Registro exitoso! Tu contraseña es: ${autoPass}`, "success");
            if (result.user) {
                showDashboard(result.user); 
            } else {
                setTimeout(() => location.reload(), 2000);
            }
        } else {
            showToast("Error: " + result.message, "error");
        }
    } catch (e) {
        showToast("Error de conexión durante el registro.", "error");
    }
    toggleLoader(false);
}

// Helper Base64
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

async function handleLogin() {
    const dni = document.getElementById('login-dni').value;
    const pass = document.getElementById('login-pass').value;

    if(!dni || !pass) return showToast("Completa tus credenciales", "error");

    toggleLoader(true, "Validando credenciales...");
    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', dni, password: pass }) });
        const result = await res.json();
        toggleLoader(false);

        if(result.success) {
            showDashboard(result.user);
        } else {
            showToast(result.message, "error");
        }
    } catch(e) {
        toggleLoader(false);
        showToast("Error conectando con el servidor", "error");
    }
}

function showDashboard(user) {
    document.getElementById('display-name').setAttribute('data-dni', user.dni || document.getElementById('login-dni').value);
    showView('dashboard');

    const nombreCompleto = `${user.nombres || user.NOMBRES || ''} ${user.apellidos || user.APELLIDOS || ''}`.trim();
    
    document.getElementById('display-name').innerText = nombreCompleto || "USUARIO";
    document.getElementById('display-cargo').innerText = user.cargo || user.CARGO || "SIN CARGO";
    document.getElementById('display-empresa').innerText = user.empresa || user.RAZON_SOCIAL || "SIN EMPRESA";

    // Actualizar KPI
    const cumplimiento = user.cumplimiento || {};
    const pctRaw = cumplimiento.porcentaje || 0;
    const pct = Math.round(pctRaw * 100);

    document.getElementById('compliance-pct').innerText = pct + '%';
    const label = document.getElementById('compliance-label');
    const ring = document.getElementById('compliance-ring');
    
    let color = pct >= 90 ? "#10b981" : (pct >= 71 ? "#f59e0b" : "#E30613");

    // Cálculo matemático para el SVG Stroke Dashoffset (Tailwind Custom UI)
    const circumference = 251.2; // r=40
    const offset = circumference - (pct / 100) * circumference;
    
    ring.style.strokeDashoffset = offset;
    ring.style.color = color;

    label.innerText = (cumplimiento.calificacion || "SIN CALIFICAR").toUpperCase();
    label.style.color = color;

    document.getElementById('docs-count').innerText = (user.docs || []).length;
    renderDocs(user.docs || []);
}

function renderDocs(docs) {
    const container = document.getElementById('docs-list');
    container.innerHTML = '';
    
    if (docs.length === 0) {
        container.innerHTML = '<p class="text-center text-sm text-slate-400 py-10">No hay documentos registrados aún.</p>';
        return;
    }

    docs.forEach(doc => {
        const fechaStr = doc.venc ? new Date(doc.venc).toLocaleDateString() : 'Sin fecha';
        const styles = getDocStyles(doc.estado);
        const icon = doc.tipo.includes('BREVETE') || doc.tipo.includes('LICENCIA') ? '🛞' : '🪪';
        
        const card = document.createElement('div');
        card.className = `bg-white p-5 rounded-[1.5rem] flex items-center gap-4 border shadow-sm ${styles.borderClass}`;
        
        card.innerHTML = `
            <div class="w-12 h-12 ${styles.bgIcon} rounded-2xl flex items-center justify-center text-xl">${icon}</div>
            <div class="flex-1">
                <h4 class="text-sm font-bold text-slate-800 uppercase">${doc.tipo}</h4>
                <p class="text-[10px] ${styles.textClass} font-bold uppercase">${doc.estado.replace('_', ' ')} • Vence: ${fechaStr}</p>
            </div>
        `;
        container.appendChild(card);
    });
}

// Actualizado: Usa FETCH estándar hacia API_URL
async function recalculate() {
    const dniActual = document.getElementById('display-name').getAttribute('data-dni');
    if (!dniActual) {
        return showToast("Error: No se pudo identificar el DNI para actualizar.", "error");
    }

    const icon = document.getElementById('icon-refresh');
    icon.style.transform = 'rotate(360deg)';
    toggleLoader(true, "ACTUALIZANDO INDICADORES...");
    
    try {
        // En tu backend (Apps Script doPost), debes manejar `action: 'getTripulanteByDni'`
        const res = await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: 'getTripulanteByDni', dni: dniActual }) 
        });
        const result = await res.json();
        
        toggleLoader(false);
        icon.style.transform = 'rotate(0deg)';

        if (result.exists || result.success) {
            showToast("Indicadores actualizados con éxito", "success");
            showDashboard(result.data || result.user); 
        } else {
            showToast("No se encontraron datos actualizados", "error");
        }
    } catch (e) {
        toggleLoader(false);
        icon.style.transform = 'rotate(0deg)';
        showToast("Error de conexión al actualizar.", "error");
        console.error("Error recalculate:", e);
    }
}

// Helper visual para documentos
function getDocStyles(status) {
    switch (status) {
        case 'APROBADO': 
            return { borderClass: 'border-slate-100', bgIcon: 'bg-green-50', textClass: 'text-green-600' };
        case 'RECHAZADO': 
        case 'VENCIDO':
            return { borderClass: 'border-red-100 ring-2 ring-red-50', bgIcon: 'bg-red-50', textClass: 'text-red-500' };
        default: 
            return { borderClass: 'border-amber-100', bgIcon: 'bg-amber-50', textClass: 'text-amber-500' };
    }
}
