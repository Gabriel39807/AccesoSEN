// Importar funciones de Firebase desde CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig ={
  apiKey: "AIzaSyB7nOx5QwaxfS6f_Fe44MedyQPm0Wv2eZI",
  authDomain: "sadi-demo-aa8f1.firebaseapp.com",
  projectId: "sadi-demo-aa8f1",
  storageBucket: "sadi-demo-aa8f1.firebasestorage.app",
  messagingSenderId: "649215379832",
  appId: "1:649215379832:web:ae784d8c11e37e043f208d",
  measurementId: "G-HWM3LKYLPG"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================
// LÓGICA DE INTERFAZ (UI)
// ============================================================

window.switchView = (viewId) => {
    document.querySelectorAll('.mobile-screen').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
}

window.togglePass = (id) => {
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
}

window.toggleModal = (show) => {
    const modal = document.getElementById('modal-equipo');
    show ? modal.classList.remove('hidden') : modal.classList.add('hidden');
}

// ============================================================
// MÓDULO 1: AUTENTICACIÓN REAL
// ============================================================

// Monitor de estado de sesión (Automático)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuario logueado
        document.getElementById('user-email-display').innerText = user.email;
        loadEquiposFromDB(user.email); // Cargar datos de ESTE usuario
        switchView('dashboard-view');
    } else {
        // Usuario no logueado
        switchView('login-view');
    }
});

// Función de Login
window.handleLogin = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('login-error');

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged se encargará de redirigir
        errorMsg.classList.add('hidden');
    } catch (error) {
        console.error(error);
        errorMsg.innerText = "Error: " + error.message;
        errorMsg.classList.remove('hidden');
    }
}

// Función Logout
window.handleLogout = async () => {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error(error);
    }
}

// Función Recuperar Contraseña (REAL)
window.handleResetPassword = async () => {
    const email = document.getElementById('rec-email').value;
    try {
        await sendPasswordResetEmail(auth, email);
        alert(`¡Correo enviado! Revisa ${email} para cambiar tu clave.`);
        switchView('login-view');
    } catch (error) {
        alert("Error: " + error.message);
    }
}

// ============================================================
// MÓDULO 2: BASE DE DATOS (FIRESTORE)
// ============================================================

// 1. Agregar equipo a la Nube
window.addEquipoToDB = async () => {
    const nombre = document.getElementById('eq-nombre').value;
    const serial = document.getElementById('eq-serial').value;
    const user = auth.currentUser;

    if (!user) return;

    try {
        // Guardamos en la colección "equipos"
        await addDoc(collection(db, "equipos"), {
            nombre: nombre,
            serial: serial,
            user_email: user.email, // Relación con el usuario
            fecha: new Date()
        });
        
        toggleModal(false);
        // No necesitamos recargar manual, usaremos escucha en tiempo real
        alert("Guardado en Firestore correctamente");
        
        // Limpiar inputs
        document.getElementById('eq-nombre').value = '';
        document.getElementById('eq-serial').value = '';

    } catch (e) {
        console.error("Error adding document: ", e);
        alert("Error al guardar en base de datos");
    }
}

// 2. Leer equipos de la Nube (Tiempo Real)
function loadEquiposFromDB(email) {
    const q = query(collection(db, "equipos"), where("user_email", "==", email));
    
    // onSnapshot escucha cambios en vivo (Si agregas algo, aparece solo)
    onSnapshot(q, (querySnapshot) => {
        const container = document.getElementById('equipos-list');
        container.innerHTML = ''; // Limpiar

        if(querySnapshot.empty) {
            container.innerHTML = '<p style="text-align:center; color:#777;">No tienes equipos registrados.</p>';
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            container.innerHTML += `
                <div class="card item-card">
                    <div style="display:flex; align-items:center;">
                        <i class="ph ph-laptop item-icon"></i>
                        <div>
                            <h4>${data.nombre}</h4>
                            <span style="font-size:0.8rem; color:#666;">Serial: ${data.serial}</span>
                        </div>
                    </div>
                </div>
            `;
        });
    });
}

/* ==========================================
   LÓGICA RECUPERACIÓN (MOCKUP VISUAL)
   ========================================== */

// Paso 1 -> 2
window.goToStep2 = () => {
    const email = document.getElementById('rec-email').value;
    if(email.includes('@')) {
        // Simulamos envío
        alert(`Código enviado a ${email}`);
        document.getElementById('rec-step-1').classList.add('hidden');
        document.getElementById('rec-step-2').classList.remove('hidden');
        // Enfocar primer cuadro
        setTimeout(() => document.getElementById('c1').focus(), 500);
    } else {
        alert("Ingresa un correo válido");
    }
};

window.goToStep1 = () => {
    document.getElementById('rec-step-2').classList.add('hidden');
    document.getElementById('rec-step-1').classList.remove('hidden');
};

// Mover foco en los cuadritos
window.moveFocus = (current, nextId) => {
    if(current.value.length >= 1) {
        document.getElementById(nextId).focus();
    }
};

// Paso 2 -> 3 (Validar Código)
window.verifyCodeInput = () => {
    // Concatenar los 5 inputs
    const c1 = document.getElementById('c1').value;
    const c2 = document.getElementById('c2').value;
    const c3 = document.getElementById('c3').value;
    const c4 = document.getElementById('c4').value;
    const c5 = document.getElementById('c5').value;
    const code = c1 + c2 + c3 + c4 + c5;

    // Aceptamos el código de la imagen '82476' o '12345'
    if(code === '82476' || code === '12345') {
        document.getElementById('rec-step-2').classList.add('hidden');
        document.getElementById('rec-step-3').classList.remove('hidden');
    } else {
        document.getElementById('code-error').classList.remove('hidden');
        // Poner bordes rojos (opcional)
        document.querySelectorAll('.code-input').forEach(i => i.style.borderColor = 'red');
    }
};

// Validación en vivo (Checklist visual)
window.validateLive = () => {
    const p1 = document.getElementById('new-pass-1').value;
    
    // 1. Minimo 8
    updateReq('req-len', p1.length >= 8);
    // 2. Mayuscula
    updateReq('req-may', /[A-Z]/.test(p1));
    // 3. Numero
    updateReq('req-num', /[0-9]/.test(p1));
};

function updateReq(id, isValid) {
    const el = document.getElementById(id);
    const icon = el.querySelector('i');
    if(isValid) {
        icon.className = "ph-fill ph-check-circle green";
        el.style.color = "#333";
    } else {
        icon.className = "ph ph-x-circle red";
        el.style.color = "#555";
    }
}

// Paso 3 -> 4 (Finalizar)
window.finishRecovery = () => {
    const p1 = document.getElementById('new-pass-1').value;
    const p2 = document.getElementById('new-pass-2').value;

    if(p1 === p2 && p1.length >= 8) {
        document.getElementById('rec-step-3').classList.add('hidden');
        document.getElementById('rec-step-4').classList.remove('hidden');
    } else {
        if(p1 !== p2) document.getElementById('pass-match-error').classList.remove('hidden');
        else alert("Cumple con los requisitos mínimos.");
    }
};