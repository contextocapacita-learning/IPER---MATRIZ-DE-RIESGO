/* =========================================================================
   CONFIGURACIÓN DE FIREBASE
   Reemplaza estos valores con las credenciales de TU proyecto gratuito de
   Firebase (Auth + Firestore). Mientras dejes los valores "TU_..." tal como
   están, la aplicación funcionará automáticamente en MODO LOCAL (los datos
   se guardan solo en este navegador, igual que antes).
   ========================================================================= */
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};

let modoLocal = false;
let modoLocalManual = false;
let usuarioActual = null;
let auth = null;
let db = null;
let authTab = "login";
let editIndex = null;

let registros = [];
let contexto = {
  empresa: "",
  nit: "",
  trabajadores: "",
  monitor: "",
  comite: "",
  fecha: "",
};

document.getElementById("fecha-actual").innerText =
  new Date().toLocaleDateString("es-GT");

// ---------- Inicialización de Firebase (si hay credenciales reales) ----------
try {
  if (!firebaseConfig.apiKey.startsWith("TU_")) {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
  } else {
    modoLocal = true;
  }
} catch (e) {
  console.warn("No se pudo inicializar Firebase, se usará modo local.", e);
  modoLocal = true;
}

function iniciarApp() {
  if (modoLocal) {
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");
    document.getElementById("banner-local").classList.remove("hidden");
    document.getElementById("btn-logout").classList.add("hidden");
    document.getElementById("topbar-user").innerText =
      "Modo local (sin cuenta en la nube)";
    cargarDesdeLocalStorage();
    rellenarContexto();
    calcularRiesgos();
    actualizarVista();
    return;
  }

  auth.onAuthStateChanged(function (user) {
    if (user && !modoLocalManual) {
      usuarioActual = user;
      document.getElementById("auth-screen").classList.add("hidden");
      document.getElementById("app-container").classList.remove("hidden");
      document.getElementById("banner-cloud").classList.remove("hidden");
      document.getElementById("banner-local").classList.add("hidden");
      document.getElementById("btn-logout").classList.remove("hidden");
      document.getElementById("topbar-user").innerText =
        "Sesión: " + user.email;
      cargarDesdeFirestore();
    } else if (!modoLocalManual) {
      document.getElementById("auth-screen").classList.remove("hidden");
      document.getElementById("app-container").classList.add("hidden");
    }
  });
}

function usarModoLocalManual() {
  modoLocalManual = true;
  modoLocal = true;
  iniciarApp();
}

function cambiarTabAuth(tab) {
  authTab = tab;
  document
    .getElementById("tab-login")
    .classList.toggle("active", tab === "login");
  document
    .getElementById("tab-register")
    .classList.toggle("active", tab === "register");
  document.getElementById("auth-submit-btn").innerText =
    tab === "login" ? "Iniciar sesión" : "Crear cuenta";
  document.getElementById("auth-error").innerText = "";
}

function submitAuth() {
  const email = document.getElementById("auth-email").value.trim();
  const pass = document.getElementById("auth-pass").value;
  const errorBox = document.getElementById("auth-error");
  errorBox.innerText = "";

  if (!email || !pass) {
    errorBox.innerText = "Ingresa tu correo y contraseña.";
    return;
  }

  const accion =
    authTab === "login"
      ? auth.signInWithEmailAndPassword(email, pass)
      : auth.createUserWithEmailAndPassword(email, pass);

  accion.catch(function (err) {
    errorBox.innerText = traducirErrorAuth(err);
  });
}

function traducirErrorAuth(err) {
  const c = err.code || "";
  if (c.includes("email-already-in-use"))
    return 'Ese correo ya tiene una cuenta. Usa "Iniciar sesión".';
  if (c.includes("weak-password"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (
    c.includes("user-not-found") ||
    c.includes("wrong-password") ||
    c.includes("invalid-credential")
  )
    return "Correo o contraseña incorrectos.";
  if (c.includes("invalid-email")) return "El correo no es válido.";
  return "No se pudo completar la acción: " + err.message;
}

function cerrarSesion() {
  if (auth) auth.signOut();
  location.reload();
}

// ---------- Carga y guardado ----------
function cargarDesdeLocalStorage() {
  const raw = localStorage.getItem("iper_datos_v2");
  if (raw) {
    try {
      const data = JSON.parse(raw);
      registros = data.registros || [];
      contexto = data.contexto || contexto;
    } catch (e) {
      registros = [];
    }
  }
}

function cargarDesdeFirestore() {
  db.collection("iper_matrices")
    .doc(usuarioActual.uid)
    .get()
    .then(function (doc) {
      if (doc.exists) {
        const data = doc.data();
        registros = data.registros || [];
        contexto = data.contexto || contexto;
      }
      rellenarContexto();
      calcularRiesgos();
      actualizarVista();
    })
    .catch(function (err) {
      alert(
        "No se pudieron cargar tus datos de la nube: " +
          err.message +
          "\nSe muestran datos vacíos; verifica tu conexión y recarga la página.",
      );
      rellenarContexto();
      calcularRiesgos();
      actualizarVista();
    });
}

function guardarDatos() {
  if (modoLocal) {
    localStorage.setItem(
      "iper_datos_v2",
      JSON.stringify({ registros: registros, contexto: contexto }),
    );
    return;
  }
  if (usuarioActual) {
    db.collection("iper_matrices")
      .doc(usuarioActual.uid)
      .set({
        registros: registros,
        contexto: contexto,
        actualizado: new Date().toISOString(),
      })
      .catch(function (err) {
        alert(
          "Aviso: no se pudo guardar en la nube (revisa tu conexión). Tus últimos cambios podrían no haberse sincronizado.\n" +
            err.message,
        );
      });
  }
}

function actualizarContexto() {
  contexto.empresa = document.getElementById("ctx-empresa").value.trim();
  contexto.nit = document.getElementById("ctx-nit").value.trim();
  contexto.trabajadores = document
    .getElementById("ctx-trabajadores")
    .value.trim();
  contexto.monitor = document.getElementById("ctx-monitor").value.trim();
  contexto.comite = document.getElementById("ctx-comite").value.trim();
  contexto.fecha = document.getElementById("ctx-fecha").value;
  reflejarContextoEnReporte();
  guardarDatos();
}

function rellenarContexto() {
  document.getElementById("ctx-empresa").value = contexto.empresa || "";
  document.getElementById("ctx-nit").value = contexto.nit || "";
  document.getElementById("ctx-trabajadores").value =
    contexto.trabajadores || "";
  document.getElementById("ctx-monitor").value = contexto.monitor || "";
  document.getElementById("ctx-comite").value = contexto.comite || "";
  document.getElementById("ctx-fecha").value = contexto.fecha || "";
  reflejarContextoEnReporte();
}

function reflejarContextoEnReporte() {
  document.getElementById("rep-empresa").innerText =
    contexto.empresa || "Centro de trabajo no especificado";
  document.getElementById("rep-nit").innerText = contexto.nit || "—";
  document.getElementById("rep-trab").innerText = contexto.trabajadores || "—";
  document.getElementById("rep-monitor").innerText = contexto.monitor || "—";
  document.getElementById("rep-comite").innerText = contexto.comite || "—";
  document.getElementById("fecha-actual").innerText = contexto.fecha
    ? new Date(contexto.fecha + "T00:00:00").toLocaleDateString("es-GT")
    : new Date().toLocaleDateString("es-GT");
  document.getElementById("rep-estatus").innerText = modoLocal
    ? "Guardado local (este dispositivo)"
    : "Sincronizado en la nube";
}

// ---------- Exportar / Importar respaldo JSON ----------
function exportarJSON() {
  const payload = {
    registros: registros,
    contexto: contexto,
    exportado: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const nombreBase = (contexto.empresa || "matriz_iper")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase();
  a.download =
    "respaldo_" +
    nombreBase +
    "_" +
    new Date().toISOString().slice(0, 10) +
    ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importarJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.registros)) throw new Error("Formato inválido");
      const reemplazar = confirm(
        "¿Reemplazar la matriz actual (" +
          registros.length +
          " registros) con la del archivo (" +
          data.registros.length +
          " registros)?\nAceptar = reemplazar. Cancelar = agregar al final.",
      );
      if (reemplazar) {
        registros = data.registros;
      } else {
        registros = registros.concat(data.registros);
      }
      if (data.contexto) contexto = data.contexto;
      rellenarContexto();
      actualizarVista();
      guardarDatos();
      mostrarToast("Respaldo importado correctamente.");
    } catch (err) {
      alert(
        "El archivo no tiene un formato válido de respaldo de esta aplicación.",
      );
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

// ---------- Lógica de riesgo (igual que la versión original) ----------
function mapearColor(valor) {
  if (valor >= 17)
    return {
      texto: "CRÍTICO",
      color: "var(--color-critico)",
      clase: "badge-critico",
      cat: "crit",
    };
  if (valor >= 10)
    return {
      texto: "ALTO",
      color: "var(--color-alto)",
      clase: "badge-alto",
      cat: "alto",
    };
  if (valor >= 5)
    return {
      texto: "MODERADO",
      color: "var(--color-moderado)",
      clase: "badge-moderado",
      cat: "mod",
    };
  return {
    texto: "ACEPTABLE",
    color: "var(--color-aceptable)",
    clase: "badge-aceptable",
    cat: "acep",
  };
}

function calcularRiesgos() {
  const pInh = parseInt(document.getElementById("p_inh").value) || 1;
  const sInh = parseInt(document.getElementById("s_inh").value) || 1;
  const pRes = parseInt(document.getElementById("p_res").value) || 1;
  const sRes = parseInt(document.getElementById("s_res").value) || 1;

  const vInh = pInh * sInh;
  const evalInh = document.getElementById("eval_inh");
  const cInh = mapearColor(vInh);
  evalInh.innerText = cInh.texto + " (" + vInh + ")";
  evalInh.style.backgroundColor = cInh.color;

  const vRes = pRes * sRes;
  const evalRes = document.getElementById("eval_res");
  const cRes = mapearColor(vRes);
  evalRes.innerText = cRes.texto + " (" + vRes + ")";
  evalRes.style.backgroundColor = cRes.color;
}

function registroCoincideFiltro(reg) {
  const texto = document
    .getElementById("filtro-area")
    .value.trim()
    .toLowerCase();
  const tipo = document.getElementById("filtro-tipo").value;
  const nivel = document.getElementById("filtro-nivel").value;

  if (texto) {
    const campo = (
      reg.area +
      " " +
      reg.peligro +
      " " +
      (reg.fuente_peligro || "") +
      " " +
      (reg.evento_riesgo || "") +
      " " +
      reg.riesgo +
      " " +
      (reg.controles_existentes || "")
    ).toLowerCase();
    if (!campo.includes(texto)) return false;
  }
  if (tipo && reg.tipo_peligro !== tipo) return false;
  if (nivel) {
    const cRes = mapearColor(reg.p_res * reg.s_res);
    if (cRes.cat !== nivel) return false;
  }
  return true;
}

function actualizarVista() {
  guardarDatos();
  reflejarContextoEnReporte();

  const tbody = document.getElementById("tabla-cuerpo");
  tbody.innerHTML = "";

  document.querySelectorAll(".risk-dot-container").forEach(function (e) {
    e.remove();
  });
  let contadores = { acep: 0, mod: 0, alto: 0, crit: 0 };

  registros.forEach(function (reg, index) {
    const vInh = reg.p_inh * reg.s_inh;
    const vRes = reg.p_res * reg.s_res;
    const cInh = mapearColor(vInh);
    const cRes = mapearColor(vRes);
    contadores[cRes.cat]++;

    const celdaId = "cell-" + reg.p_res + "-" + reg.s_res;
    const celda = document.getElementById(celdaId);
    if (celda) {
      let dotContainer = celda.querySelector(".risk-dot-container");
      if (!dotContainer) {
        dotContainer = document.createElement("div");
        dotContainer.className = "risk-dot-container";
        celda.appendChild(dotContainer);
      }
      const dot = document.createElement("div");
      dot.className = "risk-dot";
      dot.innerText = index + 1;
      dotContainer.appendChild(dot);
    }

    if (!registroCoincideFiltro(reg)) return;

    const fila = tbody.insertRow();
    const idInfo = reg.identificador
      ? '<span class="meta-line">Identificó: ' +
        escapeHTML(reg.identificador) +
        "</span>"
      : "";
    const fuenteInfo = reg.fuente_peligro
      ? '<span class="meta-line">Fuente: ' +
        escapeHTML(reg.fuente_peligro) +
        "</span>"
      : "";
    const legalInfo = reg.referencia_legal
      ? '<span class="meta-line">Ref. legal: ' +
        escapeHTML(reg.referencia_legal) +
        "</span>"
      : "";
    const existenteInfo = reg.controles_existentes
      ? "<strong>Existente:</strong> " +
        escapeHTML(reg.controles_existentes) +
        '<br><strong style="color:var(--accent-blue);">Propuesto adicional:</strong><br>'
      : "";
    const respInfo =
      reg.responsable_control || reg.fecha_compromiso
        ? '<span class="meta-line">Responsable: ' +
          escapeHTML(reg.responsable_control || "—") +
          (reg.fecha_compromiso ? " | Fecha: " + reg.fecha_compromiso : "") +
          "</span>"
        : "";

    fila.innerHTML =
      "<td><strong>" +
      escapeHTML(reg.area) +
      "</strong>" +
      idInfo +
      "</td>" +
      '<td><span class="badge" style="background:#64748b;">' +
      escapeHTML(reg.tipo_peligro) +
      "</span></td>" +
      "<td>" +
      escapeHTML(reg.peligro) +
      fuenteInfo +
      legalInfo +
      "</td>" +
      "<td><strong>" +
      escapeHTML(reg.evento_riesgo || "—") +
      '</strong><span class="meta-line">' +
      escapeHTML(reg.riesgo) +
      "</span></td>" +
      '<td style="text-align:center; background: #fff5f5;">' +
      reg.p_inh +
      "</td>" +
      '<td style="text-align:center; background: #fff5f5;">' +
      reg.s_inh +
      "</td>" +
      // CORREGIDO: Se agregó white-space: nowrap; para evitar el corte de texto en "MODERADO (8)"
      '<td style="text-align:center; background: #fff5f5; white-space: nowrap;"><span class="badge ' +
      cInh.clase +
      '">' +
      cInh.texto +
      " (" +
      vInh +
      ")</span></td>" +
      "<td>" +
      existenteInfo +
      "<strong>[1]:</strong> " +
      escapeHTML(reg.control_elim || "Ninguno") +
      "<br>" +
      "<strong>[2]:</strong> " +
      escapeHTML(reg.control_sust || "Ninguno") +
      "<br>" +
      "<strong>[3]:</strong> " +
      escapeHTML(reg.control_ing || "Ninguno") +
      "<br>" +
      "<strong>[4]:</strong> " +
      escapeHTML(reg.control_adm || "Ninguno") +
      "<br>" +
      "<strong>[5 EPP]:</strong> " +
      escapeHTML(reg.control_epp || "Ninguno") +
      respInfo +
      "</td>" +
      '<td style="text-align:center; background: #f0fdf4;">' +
      reg.p_res +
      "</td>" +
      '<td style="text-align:center; background: #f0fdf4;">' +
      reg.s_res +
      "</td>" +
      // CORREGIDO: Se agregó white-space: nowrap; aquí también por seguridad para el riesgo residual
      '<td style="text-align:center; background: #f0fdf4; white-space: nowrap;"><span class="badge ' +
      cRes.clase +
      '">' +
      cRes.texto +
      " (" +
      vRes +
      ")</span></td>" +
      '<td class="no-print" data-html2canvas-ignore style="text-align:center; white-space:nowrap;">' +
      '<button class="btn-action edit" onclick="editarRegistro(' +
      index +
      ')">✎</button>' +
      '<button class="btn-action" onclick="eliminarRegistro(' +
      index +
      ')">X</button>' +
      "</td>";
  });

  document.getElementById("count-acep").innerText = contadores.acep;
  document.getElementById("count-mod").innerText = contadores.mod;
  document.getElementById("count-alto").innerText = contadores.alto;
  document.getElementById("count-crit").innerText = contadores.crit;
}

function escapeHTML(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

function leerFormulario() {
  return {
    area: document.getElementById("area").value.trim(),
    tipo_peligro: document.getElementById("tipo_peligro").value,
    peligro: document.getElementById("peligro").value.trim(),
    fuente_peligro: document.getElementById("fuente_peligro").value.trim(),
    evento_riesgo: document.getElementById("evento_riesgo").value.trim(),
    riesgo: document.getElementById("riesgo").value.trim(),
    identificador: document.getElementById("identificador").value.trim(),
    referencia_legal: document.getElementById("referencia_legal").value.trim(),
    controles_existentes: document
      .getElementById("controles_existentes")
      .value.trim(),
    p_inh: parseInt(document.getElementById("p_inh").value),
    s_inh: parseInt(document.getElementById("s_inh").value),
    control_elim: document.getElementById("control_elim").value.trim(),
    control_sust: document.getElementById("control_sust").value.trim(),
    control_ing: document.getElementById("control_ing").value.trim(),
    control_adm: document.getElementById("control_adm").value.trim(),
    control_epp: document.getElementById("control_epp").value.trim(),
    responsable_control: document
      .getElementById("responsable_control")
      .value.trim(),
    fecha_compromiso: document.getElementById("fecha_compromiso").value,
    p_res: parseInt(document.getElementById("p_res").value),
    s_res: parseInt(document.getElementById("s_res").value),
  };
}

function limpiarFormularioPeligro() {
  [
    "peligro",
    "fuente_peligro",
    "evento_riesgo",
    "riesgo",
    "identificador",
    "referencia_legal",
    "controles_existentes",
    "control_elim",
    "control_sust",
    "control_ing",
    "control_adm",
    "control_epp",
    "responsable_control",
    "fecha_compromiso",
  ].forEach(function (id) {
    document.getElementById(id).value = "";
  });
}

function guardarRegistro() {
  const datos = leerFormulario();

  if (!datos.area || !datos.peligro || !datos.evento_riesgo || !datos.riesgo) {
    alert(
      "Error: Indique al menos Área, Peligro, Riesgo (evento) y Consecuencia antes de registrar.",
    );
    return;
  }

  if (editIndex !== null) {
    registros[editIndex] = datos;
    mostrarToast("Registro actualizado con éxito.");
    cancelarEdicion();
  } else {
    registros.push(datos);
    mostrarToast("¡Registro incorporado con éxito!");
  }

  actualizarVista();
  limpiarFormularioPeligro();
}

function editarRegistro(index) {
  const reg = registros[index];
  editIndex = index;
  document.getElementById("area").value = reg.area;
  document.getElementById("tipo_peligro").value = reg.tipo_peligro;
  document.getElementById("peligro").value = reg.peligro;
  document.getElementById("fuente_peligro").value = reg.fuente_peligro || "";
  document.getElementById("evento_riesgo").value = reg.evento_riesgo || "";
  document.getElementById("riesgo").value = reg.riesgo;
  document.getElementById("identificador").value = reg.identificador || "";
  document.getElementById("referencia_legal").value =
    reg.referencia_legal || "";
  document.getElementById("controles_existentes").value =
    reg.controles_existentes || "";
  document.getElementById("p_inh").value = reg.p_inh;
  document.getElementById("s_inh").value = reg.s_inh;
  document.getElementById("control_elim").value = reg.control_elim || "";
  document.getElementById("control_sust").value = reg.control_sust || "";
  document.getElementById("control_ing").value = reg.control_ing || "";
  document.getElementById("control_adm").value = reg.control_adm || "";
  document.getElementById("control_epp").value = reg.control_epp || "";
  document.getElementById("responsable_control").value =
    reg.responsable_control || "";
  document.getElementById("fecha_compromiso").value =
    reg.fecha_compromiso || "";
  document.getElementById("p_res").value = reg.p_res;
  document.getElementById("s_res").value = reg.s_res;
  calcularRiesgos();

  document.getElementById("btn-submit").innerText = "Guardar Cambios";
  document.getElementById("btn-cancel-edit").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicion() {
  editIndex = null;
  document.getElementById("btn-submit").innerText = "Registrar e Incorporar";
  document.getElementById("btn-cancel-edit").classList.add("hidden");
  limpiarFormularioPeligro();
}

function eliminarRegistro(index) {
  if (confirm("¿Eliminar este registro?")) {
    registros.splice(index, 1);
    if (editIndex === index) cancelarEdicion();
    actualizarVista();
  }
}

function limpiarTodo() {
  if (
    confirm(
      "¿Eliminar toda la matriz? Esta acción no se puede deshacer. Considera exportar un respaldo (.json) primero.",
    )
  ) {
    registros = [];
    cancelarEdicion();
    actualizarVista();
  }
}

function mostrarToast(msg) {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.style.display = "block";
  setTimeout(function () {
    toast.style.display = "none";
  }, 2500);
}

function exportarReportePDF() {
  if (registros.length === 0) {
    alert(
      "No hay registros en la matriz. Agrega al menos un registro antes de exportar el PDF.",
    );
    return;
  }

  // 1. Limpiar filtros para que el PDF incluya todos los registros
  document.getElementById("filtro-area").value = "";
  document.getElementById("filtro-tipo").value = "";
  document.getElementById("filtro-nivel").value = "";
  actualizarVista();

  const btn = document.getElementById("btn-pdf");
  btn.disabled = true;
  btn.innerText = "Generando PDF...";

  const element = document.getElementById("reporte-pdf");

  // GUARDAR POSICIÓN ACTUAL DEL SCROLL DEL USUARIO
  const originalScrollY = window.scrollY;
  const originalScrollX = window.scrollX;

  // SOLUCIÓN AL BUG DE LA HOJA EN BLANCO:
  // Forzamos el viewport al inicio antes de capturar para evitar el desfase de html2canvas
  window.scrollTo(0, 0);

  const opt = {
    margin: [10, 8, 10, 8],
    filename:
      "Matriz_IPER_" +
      (contexto.empresa
        ? contexto.empresa.replace(/[^a-z0-9]/gi, "_")
        : "ISO45001") +
      ".pdf",
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
      scrollY: 0, // <-- CRÍTICO: Obliga a html2canvas a iniciar la captura en el eje Y = 0 del contenedor
      scrollX: 0, // <-- CRÍTICO: Obliga a html2canvas a iniciar la captura en el eje X = 0 del contenedor
      windowWidth: document.documentElement.offsetWidth, // Evita que layouts responsive rompan el diseño en pantallas pequeñas
      windowHeight: document.documentElement.offsetHeight,
    },
    jsPDF: { unit: "mm", format: "letter", orientation: "landscape" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] },
  };

  // Ejecutar la renderización asíncrona
  html2pdf()
    .set(opt)
    .from(element)
    .save()
    .then(function () {
      // RESTAURAR LA POSICIÓN DEL SCROLL DEL USUARIO
      window.scrollTo(originalScrollX, originalScrollY);
      btn.disabled = false;
      btn.innerText = "Exportar PDF Profesional";
    })
    .catch(function (err) {
      // EN CASO DE ERROR, TAMBIÉN RESTAURAMOS LA EXPERIENCIA DE USUARIO
      window.scrollTo(originalScrollX, originalScrollY);
      btn.disabled = false;
      btn.innerText = "Exportar PDF Profesional";
      alert("Ocurrió un error generando el PDF: " + err.message);
    });
}

iniciarApp();
