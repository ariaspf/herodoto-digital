// js/app.js

// ==========================================
// ⚙️ CONFIGURACIÓN DE VISUALIZACIÓN Y SISTEMA
// ==========================================
const RANGOS_VISIBLES = [
    '1.1.0',   // Proemio
    '1.30.',   // Capítulo 30
    '1.31.',   // Capítulo 31
    '1.32.',   // Capítulo 32
    '1.33.'    // Capítulo 33
];

// Configuración de Candados (Locks)
const LOCK_TTL_MINUTES = 2;        // Tiempo para considerar "Zombie"
const HEARTBEAT_INTERVAL = 30000;  // Latido cada 30 segundos

const TRADUCCIONES_MORF = {
    // Clases de palabra (UPOS)
    "VERB": "Verbo", "NOUN": "Sustantivo", "ADJ": "Adjetivo", "PROPN": "Nombre Propio",
    "DET": "Determinante", "ADP": "Preposición", "PRON": "Pronombre", "ADV": "Adverbio / Conjunción",
    "CCONJ": "Conjunción Coord.", "SCONJ": "Conjunción Sub.", "PART": "Partícula",
    "NUM": "Número", "PUNCT": "Puntuación",

    // Etiquetas de rasgos
    "Case": "Caso", "Gender": "Género", "Number": "Número", "Tense": "Tiempo",
    "Voice": "Voz", "Mood": "Modo", "Person": "Persona", "VerbForm": "Forma Verbal",

    // Valores de los rasgos
    "Nom": "Nominativo", "Gen": "Genitivo", "Dat": "Dativo", "Acc": "Acusativo", "Voc": "Vocativo",
    "Masc": "Masculino", "Fem": "Femenino", "Neut": "Neutro",
    "Sing": "Singular", "Plur": "Plural", "Dual": "Dual",
    "Pres": "Presente", "Past": "Pasado/Aoristo", "Fut": "Futuro", "Perf": "Perfecto", "Pluperf": "Pluscuamperfecto",
    "Act": "Activa", "Mid": "Media", "Pass": "Pasiva",
    "Ind": "Indicativo", "Sub": "Subjuntivo", "Opt": "Optativo", "Imp": "Imperativo",
    "Part": "Participio", "Inf": "Infinitivo",
    "1": "1ª", "2": "2ª", "3": "3ª",

    // --- TÉRMINOS DIALECTALES ---
    "ionic": "Jónico", "epic": "Épico", "attic": "Ático", "aeolic": "Eólico", "doric": "Dórico",
    "dat_plural_oisi": "Dativo Plural en -oisi", "uncontracted": "Forma no contracta",
    "psilosis": "Psilosis", "eta_for_alpha": "Eta por Alfa larga",
    "seguro": "Alta", "dudoso": "Baja", "probable": "Media"
};

// ESTADO GLOBAL
let tokensActuales = [];
let currentUser = null;      
let currentHeartbeat = null; 
let currentAnchor = null;    
let currentLockedRef = null; // [NUEVO] Rastrea qué sección tengo bloqueada yo

// ==========================================
// 🚀 INICIO DE LA APLICACIÓN
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Aplicación iniciada 🏛️");
    
    initUI();
    initAuth(); 
    await cargarSecciones();
});

/* =========================================
   1. LÓGICA DE INTERFAZ (UI)
   ========================================= */
function initUI() {
    const workspace = document.querySelector('.workspace-container');
    
    // Paneles Laterales
    document.getElementById('toggle-left').addEventListener('click', () => {
        workspace.classList.add('hide-left');
        document.getElementById('show-left').classList.remove('hidden');
    });
    document.getElementById('show-left').addEventListener('click', () => {
        workspace.classList.remove('hide-left');
        document.getElementById('show-left').classList.add('hidden');
    });

    document.getElementById('toggle-right').addEventListener('click', () => {
        workspace.classList.add('hide-right');
        document.getElementById('show-right').classList.remove('hidden');
    });
    document.getElementById('show-right').addEventListener('click', () => {
        workspace.classList.remove('hide-right');
        document.getElementById('show-right').classList.add('hidden');
    });

    // Pestañas
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-tab');
            document.getElementById(`tab-${targetId}`).classList.add('active');
        });
    });

    // Filtros
    const filters = document.querySelectorAll('.morph-filters input[type="checkbox"]');
    filters.forEach(checkbox => {
        checkbox.addEventListener('change', () => aplicarFiltros());
    });

    // Navegación
    const selector = document.getElementById('section-selector');
    selector.addEventListener('change', (e) => {
        const referencia = e.target.value;
        if(referencia) cargarContenido(referencia);
    });

    document.getElementById('btn-prev').addEventListener('click', () => navegar(-1));
    document.getElementById('btn-next').addEventListener('click', () => navegar(1));

    // Botón Guardar Traducción
    const btnSave = document.getElementById('btn-save');
    if(btnSave) {
        btnSave.addEventListener('click', guardarTraduccion);
    }

    // Botón Guardar Nota
    const btnAddNote = document.getElementById('btn-add-note');
    if(btnAddNote) {
        btnAddNote.addEventListener('click', crearNota);
    }
}

function aplicarFiltros() {
    const chkVerbs = document.getElementById('filter-verbs');
    const chkNouns = document.getElementById('filter-nouns');
    const chkAdjs = document.getElementById('filter-adjs');
    const chkPropn = document.getElementById('filter-propn');

    const filtrosActivos = {
        'VERB': chkVerbs ? chkVerbs.checked : false,
        'NOUN': chkNouns ? chkNouns.checked : false,
        'ADJ': chkAdjs ? chkAdjs.checked : false,
        'PROPN': chkPropn ? chkPropn.checked : false
    };

    const hayFiltros = Object.values(filtrosActivos).some(v => v === true);
    const words = document.querySelectorAll('.greek-word');

    words.forEach(span => {
        const upos = span.getAttribute('data-upos');
        if (!hayFiltros) {
            span.classList.remove('highlighted', 'dimmed');
        } else if (filtrosActivos[upos]) {
            span.classList.add('highlighted');
            span.classList.remove('dimmed');
        } else {
            span.classList.add('dimmed');
            span.classList.remove('highlighted');
        }
    });
}

function navegar(direccion) {
    const selector = document.getElementById('section-selector');
    const index = selector.selectedIndex;
    if (direccion === -1 && index > 0) { 
        selector.selectedIndex = index - 1;
        cargarContenido(selector.value);
    } else if (direccion === 1 && index < selector.options.length - 1) { 
        selector.selectedIndex = index + 1;
        cargarContenido(selector.value);
    }
}

/* =========================================
   2. SISTEMA DE USUARIOS (LOGIN)
   ========================================= */

function initAuth() {
    const modal = document.getElementById('login-modal');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const btnClose = document.getElementById('btn-close-modal');
    const formLogin = document.getElementById('login-form');

    checkSession();

    if(btnLogin) btnLogin.addEventListener('click', () => modal.showModal());
    if(btnClose) btnClose.addEventListener('click', () => modal.close());

    if(formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('login-error');

            errorMsg.textContent = "Conectando...";
            
            const { data, error } = await _supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                errorMsg.textContent = "❌ " + error.message;
            } else {
                errorMsg.textContent = "";
                modal.close();
                formLogin.reset();
                await actualizarInterfazUsuario(data.user);
            }
        });
    }

    if(btnLogout) {
        btnLogout.addEventListener('click', async () => {
            // [NUEVO] Limpiar candado antes de salir
            detenerHeartbeat();
            await liberarCandadoActual(); 
            
            await _supabase.auth.signOut();
            await actualizarInterfazUsuario(null);
        });
    }
}

async function checkSession() {
    const { data: { session } } = await _supabase.auth.getSession();
    await actualizarInterfazUsuario(session?.user || null);
}

async function obtenerNombrePerfil(uuid) {
    if(!uuid) return "Desconocido";
    const { data } = await _supabase
        .from('perfiles')
        .select('username, nombre_completo')
        .eq('id', uuid)
        .maybeSingle();
    
    if (data?.nombre_completo) return data.nombre_completo;
    if (data?.username) return data.username;
    return "Usuario";
}

async function actualizarInterfazUsuario(user) {
    currentUser = user; 
    
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const userStatus = document.getElementById('user-status');
    const editor = document.getElementById('translation-editor');
    const btnSave = document.getElementById('btn-save');

    if (user) {
        btnLogin.classList.add('hidden');
        btnLogout.classList.remove('hidden');
        const nombre = await obtenerNombrePerfil(user.id);
        userStatus.innerHTML = `<i class="fa-solid fa-user-tag"></i> ${nombre}`;
        
        const ref = document.getElementById('section-selector').value;
        if(ref) cargarContenido(ref);

    } else {
        btnLogin.classList.remove('hidden');
        btnLogout.classList.add('hidden');
        userStatus.textContent = "Visitante";
        
        editor.disabled = true;
        editor.placeholder = "Inicia sesión para editar la traducción.";
        btnSave.style.display = 'none';
        detenerHeartbeat();
    }
}

/* =========================================
   3. LÓGICA DE DATOS (Backend & Locks)
   ========================================= */

async function cargarSecciones() {
    const selector = document.getElementById('section-selector');
    const { data, error } = await _supabase
        .from('libro1_estructura')
        .select('reference')
        .order('reference', { ascending: true });

    if (error) {
        console.error("Error:", error);
        return;
    }

    const seccionesFiltradas = data.filter(item => {
        return RANGOS_VISIBLES.some(filtro => item.reference.startsWith(filtro));
    });

    seccionesFiltradas.sort((a, b) => a.reference.localeCompare(b.reference, undefined, { numeric: true }));

    selector.innerHTML = '<option value="" disabled selected>Selecciona un pasaje...</option>';
    seccionesFiltradas.forEach(item => {
        const option = document.createElement('option');
        option.value = item.reference;
        option.textContent = `Sección ${item.reference}`;
        selector.appendChild(option);
    });
    
    if (seccionesFiltradas.length > 0) {
        selector.value = seccionesFiltradas[0].reference;
        cargarContenido(seccionesFiltradas[0].reference);
    }
}

async function cargarContenido(ref) {
    // 1. Limpieza inicial + [NUEVO] Liberar candado anterior
    detenerHeartbeat(); 
    await liberarCandadoActual(); 
    
    const containerGriego = document.getElementById('greek-text-container');
    const editorEspanol = document.getElementById('translation-editor');
    const displayRef = document.querySelector('.ref-display');
    const statusSpan = document.getElementById('save-status');
    const btnSave = document.getElementById('btn-save');
    
    displayRef.textContent = ref;
    containerGriego.innerHTML = '<p class="loading">Cargando texto...</p>';
    statusSpan.innerHTML = ""; 

    // 2. Cargar Tokens (Griego)
    const { data: tokens, error: errorTokens } = await _supabase
        .from('libro1_tokens')
        .select('*')
        .eq('reference', ref);

    if (!errorTokens) {
        tokens.sort((a, b) => {
            const sentComparison = a.sentence_id.localeCompare(b.sentence_id, undefined, { numeric: true });
            if (sentComparison !== 0) return sentComparison;
            return a.token_id_int - b.token_id_int;
        });
        tokensActuales = tokens;
        renderGriego(tokens);
    }

    // 3. Cargar Traducción + Info de Candado + Autor
    const { data: trad } = await _supabase
        .from('traducciones')
        .select('*')
        .eq('reference', ref)
        .maybeSingle();

    editorEspanol.value = trad ? trad.texto_espanol : '';
    
    // 4. Mostrar Autoría
    if (trad && trad.autor_id) {
        const nombreAutor = await obtenerNombrePerfil(trad.autor_id);
        const fecha = new Date(trad.updated_at).toLocaleString();
        statusSpan.innerHTML = `<span style="color:#666; font-size:0.85em; background:#f0f0f0; padding:2px 6px; border-radius:4px;">📝 Última ed.: <b>${nombreAutor}</b> (${fecha})</span>`;
    }

    // 5. CARGAR NOTAS
    await cargarNotas(ref);

    // 6. Lógica de Candado INTELIGENTE ("El Portero")
    if (!currentUser) {
        editorEspanol.disabled = true;
        editorEspanol.style.backgroundColor = "#f9f9f9";
        btnSave.style.display = 'none';
        return; 
    }

    // A. Analizar situación
    let esCandadoZombie = false;
    let bloqueadoPorOtro = false;
    let nombreLocker = "";

    if (trad && trad.locked_at && trad.locked_by) {
        const ahora = new Date();
        const fechaLock = new Date(trad.locked_at);
        const diferenciaMinutos = (ahora - fechaLock) / 1000 / 60; 

        if (trad.locked_by !== currentUser.id) {
            if (diferenciaMinutos < LOCK_TTL_MINUTES) {
                bloqueadoPorOtro = true;
                nombreLocker = await obtenerNombrePerfil(trad.locked_by);
            } else {
                esCandadoZombie = true;
                console.log("🧟 Candado Zombie detectado. Liberando acceso...");
            }
        }
    }

    // B. Decidir acceso
    if (bloqueadoPorOtro) {
        // --- MODO BLOQUEADO ---
        editorEspanol.disabled = true;
        editorEspanol.style.backgroundColor = "#ffebee";
        editorEspanol.style.border = "2px solid #ef5350";
        btnSave.style.display = 'none';
        
        statusSpan.innerHTML = `
            <span style="color:#d32f2f; font-weight:bold; background:#ffcdd2; padding:4px 8px; border-radius:4px; display:inline-flex; align-items:center; gap:5px;">
                🔒 Editando ahora: ${nombreLocker} 
                <span style="font-size:0.8em; font-weight:normal;">(Espere...)</span>
            </span>`;
        
        detenerHeartbeat(); 

    } else {
        // --- MODO EDICIÓN ---
        editorEspanol.disabled = false;
        editorEspanol.style.backgroundColor = "#fff";
        editorEspanol.style.border = "1px solid #ddd";
        editorEspanol.placeholder = "Escribe tu traducción aquí...";
        btnSave.style.display = 'inline-block';
        
        await adquirirCandado(ref);
        iniciarHeartbeat(ref);
    }
    
    // Limpieza de filtros
    const checkboxes = document.querySelectorAll('.morph-filters input');
    if(checkboxes) checkboxes.forEach(i => i.checked = false);
}

// --- FUNCIONES DE CANDADO (MODIFICADAS) ---

async function adquirirCandado(ref) {
    if (!currentUser) return;
    
    // [NUEVO] Marcamos localmente que tenemos este candado
    currentLockedRef = ref;

    await _supabase.from('traducciones').upsert({
        reference: ref,
        locked_by: currentUser.id,
        locked_at: new Date().toISOString()
    }, { onConflict: 'reference' });
}

async function liberarCandadoActual() {
    if (!currentUser || !currentLockedRef) return;
    
    const refALiberar = currentLockedRef;
    currentLockedRef = null; // Limpiamos la variable local inmediatamente

    console.log("🔓 Liberando candado explícitamente:", refALiberar);

    await _supabase.from('traducciones')
        .update({ locked_by: null, locked_at: null })
        .eq('reference', refALiberar)
        .eq('locked_by', currentUser.id);
}

// ==========================================
// 💓 SISTEMA DE HEARTBEAT (Silencioso)
// ==========================================

function iniciarHeartbeat(ref) {
    if (currentHeartbeat) clearInterval(currentHeartbeat);
    
    // console.log("💓 Iniciando latido para:", ref); // Comentado para limpiar consola

    currentHeartbeat = setInterval(async () => {
        if (!currentUser) {
            detenerHeartbeat();
            return;
        }
        
        const { error } = await _supabase
            .from('traducciones')
            .update({ locked_at: new Date().toISOString() })
            .eq('reference', ref)
            .eq('locked_by', currentUser.id);

        if (error) {
            console.warn("⚠️ Error en latido (conexión o pérdida de candado).");
        } 
        // Eliminado log de éxito repetitivo

    }, HEARTBEAT_INTERVAL);
}

function detenerHeartbeat() {
    if (currentHeartbeat) {
        clearInterval(currentHeartbeat);
        currentHeartbeat = null;
    }
}

// --- GUARDAR TRADUCCIÓN ---
async function guardarTraduccion() {
    const { data: { user } } = await _supabase.auth.getUser();
    
    if (!user) {
        alert("Debes iniciar sesión para guardar.");
        return;
    }

    const selector = document.getElementById('section-selector');
    const editor = document.getElementById('translation-editor');
    const statusSpan = document.getElementById('save-status');
    const btn = document.getElementById('btn-save');

    const ref = selector.value;
    const texto = editor.value;

    if (!ref) return;

    btn.disabled = true;

    const { error } = await _supabase
        .from('traducciones')
        .upsert(
            { 
                reference: ref, 
                texto_espanol: texto,
                autor_id: user.id,
                updated_at: new Date().toISOString(),
                locked_by: user.id,
                locked_at: new Date().toISOString()
            },
            { onConflict: 'reference' }
        );

    if (error) {
        console.error("Error SQL:", error.message);
        statusSpan.textContent = "❌ Error";
    } else {
        statusSpan.textContent = "✅ Guardado correctamente";
        setTimeout(() => cargarContenido(ref), 1500);
    }

    btn.disabled = false;
}

/* =========================================
   4. RENDERIZADO
   ========================================= */

function renderGriego(tokens) {
    const container = document.getElementById('greek-text-container');
    container.innerHTML = ''; 
    const p = document.createElement('p');
    p.style.lineHeight = '2.2';

    tokens.forEach(token => {
        const span = document.createElement('span');
        span.textContent = token.form;
        span.className = 'greek-word';
        span.setAttribute('data-upos', token.upos);
        
        span.addEventListener('click', () => {
            document.querySelectorAll('.greek-word').forEach(w => w.classList.remove('selected'));
            span.classList.add('selected');
            
            mostrarDefinicion(token);

            currentAnchor = token.form;
            const anchorPreview = document.getElementById('anclaje-preview');
            if(anchorPreview) {
                anchorPreview.innerHTML = `Nota sobre: <strong style="color:#d35400;">${currentAnchor}</strong>`;
            }
        });

        p.appendChild(span);
        p.appendChild(document.createTextNode(' ')); 
    });
    container.appendChild(p);
}

// --- VISUALIZACIÓN DE DICCIONARIO Y MORFOLOGÍA ---

function mostrarDefinicion(token) {
    const dictContent = document.getElementById('dictionary-content');
    
    const morfologiaHTML = formatearMorfologia(token.morph_hybrid);
    const claseTraducida = TRADUCCIONES_MORF[token.upos] || token.upos;
    let dialectoHTML = '';
    
    if (token.analysis_hybrid && token.analysis_hybrid.dialect) {
        const d = token.analysis_hybrid.dialect;
        const variante = TRADUCCIONES_MORF[d.variant] || d.variant;
        const rasgo = TRADUCCIONES_MORF[d.rasgo] || d.rasgo;
        const certeza = TRADUCCIONES_MORF[d.certeza] || d.certeza;

        dialectoHTML = `
            <div style="margin-top: 15px; background: #e3f2fd; padding: 10px; border-radius: 6px; border-left: 4px solid #2196f3;">
                <h4 style="margin: 0 0 5px 0; color: #1565c0; font-size: 0.9em; display:flex; align-items:center; gap:5px;">
                    🏛️ Variante: ${variante}
                </h4>
                <p style="margin: 0; font-size: 0.9em; color: #333;">
                    <strong>Rasgo:</strong> ${rasgo}
                </p>
                <div style="margin-top:5px; font-size: 0.8em; color: #555;">
                    <em>Certeza: ${certeza}</em>
                </div>
            </div>
        `;
    }

    dictContent.innerHTML = `
        <span class="lemma-title">${token.form}</span>
        <div style="margin-bottom: 15px;">
            <p><strong>Lema:</strong> ${token.lemma}</p>
            <p><strong>Clase:</strong> <span class="badge">${claseTraducida}</span></p>
        </div>
        
        <div class="morph-box" style="background: #f8f9fa; padding: 10px; border-radius: 6px; border: 1px solid #eee;">
            <h4 style="margin-top:0; font-size: 0.9em; color: #666;">Morfología</h4>
            <div style="font-size: 0.95em; line-height: 1.6;">${morfologiaHTML}</div>
        </div>

        ${dialectoHTML}
        
        <hr>
        <div id="lsj-definition-container">
            <p style="color:#888; font-style:italic;">🔎 Consultando LSJ...</p>
        </div>
    `;
    
    const workspace = document.querySelector('.workspace-container');
    if (workspace.classList.contains('hide-right')) {
        document.getElementById('show-right').click();
    }

    consultarLSJ(token);
}

async function consultarLSJ(token) {
    const container = document.getElementById('lsj-definition-container');
    if(!container) return;

    try {
        let query = _supabase
            .from('lsj_diccionario')
            .select('definition_md, lemma, urn');

        let busquedaPorUrn = false;

        if (token.lsj_id && Array.isArray(token.lsj_id) && token.lsj_id.length > 0) {
            const rawID = token.lsj_id[0];
            const cleanID = rawID.replace(/['"]/g, '').trim(); 
            query = query.eq('urn', cleanID); 
            busquedaPorUrn = true;
        } else {
            query = query.eq('lemma_clean', token.lemma);
        }

        const { data, error } = await query.maybeSingle();

        if (error) throw error;

        if (data && data.definition_md) {
            const htmlDefinition = simpleMarkdown(data.definition_md);
            container.innerHTML = `
                <h4 style="margin-bottom:10px; color:#2c3e50;">Diccionario LSJ</h4>
                <div class="lsj-entry" style="font-size: 0.95rem; line-height: 1.5;">
                    ${htmlDefinition}
                </div>
                ${!busquedaPorUrn ? '<small style="color:#d35400;">⚠️ Coincidencia por lema (puede no ser exacto)</small>' : ''}
            `;
        } else {
            container.innerHTML = `<p style="color:#999;">No se encontró definición exacta en el LSJ para <em>${token.lemma}</em>.</p>`;
        }

    } catch (err) {
        console.error("Error LSJ:", err);
        container.innerHTML = `<p style="color:red;">Error cargando diccionario.</p>`;
    }
}

function formatearMorfologia(morph) {
    if (!morph) return '<span style="color:#999">No disponible</span>';
    if (typeof morph === 'object') {
        const entradas = Object.entries(morph);
        if (entradas.length === 0) return '<span style="color:#999">Sin rasgos</span>';
        return entradas
            .map(([clave, valor]) => {
                const claveTraducida = TRADUCCIONES_MORF[clave] || clave;
                const valorTraducido = TRADUCCIONES_MORF[valor] || valor;
                return `<b>${claveTraducida}:</b> ${valorTraducido}`;
            }).join('<br>');
    }
    return String(morph);
}

// --- UTILIDADES ---

function simpleMarkdown(md) {
    if (!md) return '';
    let html = md
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:#f4f1ea; padding:0 4px; border-radius:3px; color:#c0392b;">$1</code>')
        .replace(/\n/g, '<br>');
    return html;
}


/* =========================================
   5. SISTEMA DE NOTAS
   ========================================= */

async function cargarNotas(seccionReference) {
    const container = document.getElementById('notas-list');
    if(!container) return;

    container.innerHTML = '<p style="color:#666; padding:10px; font-size:0.9em;">Cargando notas...</p>';

    try {
        const { data: notas, error } = await _supabase
            .from('notas_criticas')
            .select('*')
            .eq('reference', seccionReference) 
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (!notas || notas.length === 0) {
            container.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #999;">
                    <p>No hay notas para esta sección.</p>
                </div>
            `;
            return;
        }

        const htmlNotas = notas.map(nota => {
            let badgeClass = "badge-default";
            if(nota.tipo === "Realia") badgeClass = "badge-realia";
            if(nota.tipo === "Filológica") badgeClass = "badge-filologica";
            if(nota.tipo === "Aclaratoria") badgeClass = "badge-aclaratoria";

            return `
            <div class="nota-card" id="nota-${nota.id}" style="border-bottom: 1px solid #eee; padding: 15px 0;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:center;">
                    <span class="badge ${badgeClass}">${nota.tipo}</span>
                    <button class="btn-delete-note" onclick="eliminarNota('${nota.id}')" title="Borrar nota" style="background:none; border:none; cursor:pointer; font-size:0.9em;">🗑️</button>
                </div>
                
                ${nota.anclaje ? `<div style="margin-bottom:5px; font-size:0.85em; color:#7f8c8d;">Sobre: <strong style="color:#c0392b;">${nota.anclaje}</strong></div>` : ''}
                
                <div class="nota-contenido" 
                     contenteditable="true" 
                     style="padding:5px; border-radius:4px; border:1px solid transparent; transition:all 0.2s;"
                     onfocus="this.style.background='#fff'; this.style.borderColor='#ddd';"
                     onblur="guardarEdicion('${nota.id}', this)">${nota.contenido}</div>
                
                <small style="font-size:0.75rem; color:#ccc; margin-top:5px; display:block;">
                   Editado: ${new Date(nota.updated_at).toLocaleDateString()}
                </small>
            </div>
        `}).join('');

        container.innerHTML = htmlNotas;

    } catch (err) {
        console.error("Error cargando notas:", err);
        container.innerHTML = '<p style="color:red;">Error al cargar notas.</p>';
    }
}

async function crearNota() {
    if (!currentUser) return alert("Debes iniciar sesión para agregar notas.");

    const inputContenido = document.getElementById('nueva-nota-contenido');
    const inputTipo = document.getElementById('nueva-nota-tipo'); 
    const selectorRef = document.getElementById('section-selector');
    
    if (!inputContenido || !inputContenido.value.trim()) return alert("Escribe algo en la nota");
    if (!selectorRef.value) return;

    const nuevaNota = {
        reference: selectorRef.value,
        contenido: inputContenido.value,
        tipo: inputTipo.value || "Filológica", 
        anclaje: currentAnchor, 
        autor_id: currentUser.id
    };

    try {
        const { error } = await _supabase
            .from('notas_criticas')
            .insert([nuevaNota]);

        if (error) throw error;

        inputContenido.value = "";
        currentAnchor = null; 
        
        const preview = document.getElementById('anclaje-preview');
        if(preview) preview.innerHTML = "";

        cargarNotas(selectorRef.value);

    } catch (err) {
        console.error("Error guardando nota:", err);
        alert("Error al guardar nota.");
    }
}

window.guardarEdicion = async function(idNota, elementoHTML) {
    if (!currentUser) {
        alert("Debes estar logueado para editar.");
        return; 
    }

    const nuevoTexto = elementoHTML.innerText;
    
    try {
        const { error } = await _supabase
            .from('notas_criticas')
            .update({ 
                contenido: nuevoTexto,
                updated_at: new Date() 
            })
            .eq('id', idNota);

        if (error) throw error;
        
        elementoHTML.style.borderLeft = "3px solid #2ecc71";
        elementoHTML.style.background = "#f0fff4";
        setTimeout(() => {
            elementoHTML.style.borderLeft = "1px solid transparent";
            elementoHTML.style.background = "transparent";
        }, 2000);

    } catch (err) {
        console.error("Error editando:", err);
        alert("No se pudo guardar la edición.");
    }
};

window.eliminarNota = async function(idNota) {
    if (!currentUser) return alert("Debes estar logueado.");
    if (!confirm("¿Seguro que quieres borrar esta nota?")) return;

    try {
        const { error } = await _supabase
            .from('notas_criticas')
            .delete()
            .eq('id', idNota);

        if (error) throw error;

        const el = document.getElementById(`nota-${idNota}`);
        if(el) el.remove();

    } catch (err) {
        console.error("Error borrando:", err);
        alert("Error al borrar.");
    }
};
