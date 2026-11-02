/**
 * auth.js — Gestión de Autenticación JWT para SistemaRAG PNP v2.0
 * Maneja: login, tokens, sesión, logout, protección de rutas
 */

"use strict";

// ── Configuración ─────────────────────────────────────────────────────────────
const API_BASE = window.__ENV__?.API_BASE_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:8000/api/v1" : "/api/v1");
const TOKEN_KEY = "sistemarag_token";
const USER_KEY  = "sistemarag_user";

// ── Utilidades de sesión ──────────────────────────────────────────────────────

const AuthManager = {
  /** Guarda el token y datos de usuario en localStorage */
  saveSession(tokenData) {
    localStorage.setItem(TOKEN_KEY, tokenData.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(tokenData.user));
    localStorage.setItem("sistemarag_session_start", new Date().toISOString());
  },

  /** Limpia la sesión del almacenamiento */
  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("sistemarag_session_start");
  },

  /** Retorna el token JWT actual o null */
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  /** Retorna el objeto de usuario actual o null */
  getUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  /** Verifica si hay sesión activa */
  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  },

  /** Headers para llamadas autenticadas */
  getAuthHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.getToken()}`,
    };
  },
};

// ── Utilidades de UI ──────────────────────────────────────────────────────────

function showToast(message, type = "info", duration = 3500) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast toast--${type} toast--visible`;
  setTimeout(() => { toast.className = "toast"; }, duration);
}

function setFieldState(fieldId, state, hintText = "") {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.remove("login-field--error", "login-field--success");
  if (state === "error") field.classList.add("login-field--error");
  if (state === "success") field.classList.add("login-field--success");

  const hint = field.querySelector(".login-field__hint");
  if (hint) hint.textContent = hintText;
}

function showLoginError(message) {
  const el = document.getElementById("login-error");
  const txt = document.getElementById("login-error-text");
  if (!el || !txt) return;
  txt.textContent = message;
  el.hidden = false;
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideLoginError() {
  const el = document.getElementById("login-error");
  if (el) el.hidden = true;
}

function setLoginLoading(loading) {
  const btn     = document.getElementById("login-btn");
  const text    = document.getElementById("login-btn-text");
  const spinner = document.getElementById("login-btn-spinner");
  const arrow   = document.getElementById("login-btn-arrow");
  if (!btn) return;

  if (loading) {
    btn.disabled = true;
    btn.classList.add("login-btn--loading");
    if (text) text.textContent = "Verificando...";
    if (spinner) spinner.hidden = false;
    if (arrow) arrow.hidden = true;
  } else {
    btn.disabled = false;
    btn.classList.remove("login-btn--loading");
    if (text) text.textContent = "Iniciar Turno";
    if (spinner) spinner.hidden = true;
    if (arrow) arrow.hidden = false;
  }
}

// ── Protección de rutas ───────────────────────────────────────────────────────

/**
 * Llama a esta función al inicio de index.html para protegerlo.
 * Si no hay token, redirige a login.html.
 */
function requireAuth() {
  if (!AuthManager.isAuthenticated()) {
    window.location.replace("login.html");
    return null;
  }
  return AuthManager.getUser();
}

/**
 * En login.html: si ya hay sesión, redirige al dashboard.
 */
function redirectIfAuthenticated() {
  if (AuthManager.isAuthenticated()) {
    window.location.replace("index.html");
  }
}

// ── Lógica de Login ───────────────────────────────────────────────────────────

async function performLogin(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${response.status}: credenciales inválidas`);
  }

  return response.json();
}

async function performLogout() {
  const token = AuthManager.getToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: AuthManager.getAuthHeaders(),
      });
    } catch (_) {
      // El logout se realiza en el cliente aunque falle el servidor
    }
  }
  AuthManager.clearSession();
  window.location.replace("login.html");
}

// ── Validación de campos ──────────────────────────────────────────────────────

function validateLoginFields(username, password) {
  let valid = true;

  if (!username || username.length < 3) {
    setFieldState("field-username", "error", "El usuario debe tener al menos 3 caracteres.");
    valid = false;
  } else {
    setFieldState("field-username", "success", "");
  }

  if (!password || password.length < 4) {
    setFieldState("field-password", "error", "La contraseña debe tener al menos 4 caracteres.");
    valid = false;
  } else {
    setFieldState("field-password", "success", "");
  }

  return valid;
}

// ── Inicialización de la página de Login ──────────────────────────────────────

function initLoginPage() {
  // Si ya está autenticado, ir al dashboard
  redirectIfAuthenticated();

  const form          = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const togglePwdBtn  = document.getElementById("toggle-password");

  if (!form) return;

  // ── Toggle contraseña ─────────────────────────────────────────────────────
  if (togglePwdBtn && passwordInput) {
    togglePwdBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      const eyeOpen   = togglePwdBtn.querySelector(".eye-open");
      const eyeClosed = togglePwdBtn.querySelector(".eye-closed");
      if (eyeOpen)   eyeOpen.hidden   = isPassword;
      if (eyeClosed) eyeClosed.hidden = !isPassword;
      togglePwdBtn.setAttribute("aria-label",
        isPassword ? "Ocultar contraseña" : "Mostrar contraseña"
      );
    });
  }

  // ── Botones de demo ───────────────────────────────────────────────────────
  document.querySelectorAll(".demo-account-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const user = btn.dataset.user;
      const pass = btn.dataset.pass;
      if (usernameInput) usernameInput.value = user;
      if (passwordInput) passwordInput.value = pass;
      // Limpiar errores previos
      setFieldState("field-username", "", "");
      setFieldState("field-password", "", "");
      hideLoginError();
      // Auto-iniciar sesión con un clic
      if (typeof form.requestSubmit === "function") {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    });
  });

  // ── Limpiar error al escribir ─────────────────────────────────────────────
  [usernameInput, passwordInput].forEach(input => {
    if (input) {
      input.addEventListener("input", () => {
        hideLoginError();
        setFieldState(`field-${input.name}`, "", "");
      });
    }
  });

  // ── Submit del formulario ─────────────────────────────────────────────────
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput?.value.trim() ?? "";
    const password = passwordInput?.value ?? "";

    // Validación del lado cliente
    if (!validateLoginFields(username, password)) return;

    hideLoginError();
    setLoginLoading(true);

    try {
      const tokenData = await performLogin(username, password);
      AuthManager.saveSession(tokenData);

      // Animación de éxito antes de redirigir
      const card = document.getElementById("login-card");
      if (card) card.classList.add("login-card--success");

      showToast(
        `Bienvenido, ${tokenData.user.rank} ${tokenData.user.full_name}`,
        "success",
        2000
      );

      setTimeout(() => {
        window.location.replace("index.html");
      }, 900);

    } catch (err) {
      setLoginLoading(false);
      setFieldState("field-username", "error", "");
      setFieldState("field-password", "error", "");
      showLoginError(err.message || "Error de autenticación. Verifique sus credenciales.");
      if (passwordInput) {
        passwordInput.value = "";
        passwordInput.focus();
      }
    }
  });

  // ── Enter desde campo username → ir a password ────────────────────────────
  if (usernameInput && passwordInput) {
    usernameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); passwordInput.focus(); }
    });
  }

  // Foco inicial
  usernameInput?.focus();
}

// ── Inicialización de la barra de usuario en el Dashboard ─────────────────────

function initUserBar(user) {
  const fullNameEl    = document.getElementById("user-full-name");
  const rankEl        = document.getElementById("user-rank");
  const badgeEl       = document.getElementById("user-badge");
  const avatarEl      = document.getElementById("user-avatar-initials");
  const logoutBtn     = document.getElementById("btn-logout");

  if (fullNameEl) fullNameEl.textContent = user.full_name;
  if (rankEl)     rankEl.textContent     = user.rank;
  if (badgeEl)    badgeEl.textContent    = user.badge_number;
  if (avatarEl) {
    const parts = user.full_name.split(" ");
    avatarEl.textContent = (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (confirm(`¿Cerrar turno, ${user.rank} ${user.full_name.split(" ")[0]}?`)) {
        await performLogout();
      }
    });
  }
}

// ── Exportar al scope global ──────────────────────────────────────────────────
window.AuthManager   = AuthManager;
window.requireAuth   = requireAuth;
window.initUserBar   = initUserBar;
window.performLogout = performLogout;
window.showToast     = showToast;

// ── Auto-inicialización ───────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Detectar si estamos en la página de login
  if (document.getElementById("login-form")) {
    initLoginPage();
  }
});
