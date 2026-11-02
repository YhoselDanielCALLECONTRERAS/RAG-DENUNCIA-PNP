"""
Módulo de Seguridad JWT — SistemaRAG PNP
Manejo de autenticación, tokens de acceso y gestión de contraseñas.
"""
from __future__ import annotations

import logging
import warnings
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ── Manejo de hashing compatible con bcrypt 4.x/5.x ──────────────────────────
# passlib no soporta bcrypt >= 4.x correctamente en Windows.
# Usamos bcrypt directamente.
try:
    import bcrypt as _bcrypt_lib

    def _hash_password(plain: str) -> str:
        return _bcrypt_lib.hashpw(plain.encode(), _bcrypt_lib.gensalt()).decode()

    def _verify_password(plain: str, hashed: str) -> bool:
        return _bcrypt_lib.checkpw(plain.encode(), hashed.encode())

except ImportError:
    # Fallback: hashlib SHA-256 (solo para demo, NO para producción)
    import hashlib, hmac
    _DEMO_KEY = b"sistemarag-demo-2026"

    def _hash_password(plain: str) -> str:
        h = hmac.new(_DEMO_KEY, plain.encode(), hashlib.sha256).hexdigest()
        return f"sha256${h}"

    def _verify_password(plain: str, hashed: str) -> bool:
        h = hmac.new(_DEMO_KEY, plain.encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(f"sha256${h}", hashed)

# ── HTTP Bearer scheme ────────────────────────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)


# ── Base de datos de usuarios simulada (PNP) ─────────────────────────────────
# En producción: reemplazar con conexión a base de datos real
FAKE_USERS_DB: dict[str, dict] = {
    "admin": {
        "username": "admin",
        "full_name": "Administrador del Sistema",
        "badge_number": "PNP-001",
        "rank": "Comandante",
        "unit": "División de Investigación Criminal",
        "hashed_password": _hash_password("admin123"),
        "disabled": False,
        "role": "admin",
    },
    "operador": {
        "username": "operador",
        "full_name": "Juan Carlos Pérez Ríos",
        "badge_number": "PNP-142",
        "rank": "Suboficial de 1ra",
        "unit": "Comisaría Central",
        "hashed_password": _hash_password("pnp2026"),
        "disabled": False,
        "role": "operator",
    },
    "investigador": {
        "username": "investigador",
        "full_name": "María Elena Torres Vega",
        "badge_number": "PNP-287",
        "rank": "Técnico de 1ra",
        "unit": "Sección de Delitos Patrimoniales",
        "hashed_password": _hash_password("invest2026"),
        "disabled": False,
        "role": "investigator",
    },
}


# ── Funciones de contraseña ───────────────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña plana contra su hash bcrypt."""
    return _verify_password(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Genera el hash bcrypt de una contraseña."""
    return _hash_password(password)


# ── Gestión de usuarios ───────────────────────────────────────────────────────

def get_user(username: str) -> Optional[dict]:
    """Recupera un usuario de la base de datos por nombre de usuario."""
    return FAKE_USERS_DB.get(username.lower())


def authenticate_user(username: str, password: str) -> Optional[dict]:
    """
    Autentica al usuario verificando credenciales.
    Retorna el usuario si las credenciales son válidas, None en caso contrario.
    """
    user = get_user(username)
    if not user:
        logger.warning(f"Intento de login con usuario inexistente: {username}")
        return None
    if user.get("disabled"):
        logger.warning(f"Intento de login con usuario deshabilitado: {username}")
        return None
    if not verify_password(password, user["hashed_password"]):
        logger.warning(f"Contraseña incorrecta para usuario: {username}")
        return None
    logger.info(f"Login exitoso: {username} ({user['rank']})")
    return user


# ── Tokens JWT ────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Crea un token JWT de acceso con tiempo de expiración configurable.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "iss": "SistemaRAG-PNP",
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decodifica y valida un token JWT.
    Retorna el payload si es válido, None si es inválido o expirado.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except JWTError as e:
        logger.debug(f"Token JWT inválido: {e}")
        return None


# ── Dependencias FastAPI ──────────────────────────────────────────────────────

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """
    Dependencia FastAPI: extrae y valida el token Bearer del header Authorization.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise credentials_exception

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise credentials_exception

    username: str = payload.get("sub", "")
    if not username:
        raise credentials_exception

    user = get_user(username)
    if user is None or user.get("disabled"):
        raise credentials_exception

    return user


async def get_current_active_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Dependencia: usuario autenticado y activo."""
    if current_user.get("disabled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario deshabilitado",
        )
    return current_user
