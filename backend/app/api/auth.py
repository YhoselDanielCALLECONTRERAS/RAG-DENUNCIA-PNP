"""
Endpoints de Autenticación JWT — SistemaRAG PNP
Rutas: /auth/login, /auth/me, /auth/logout
"""
from __future__ import annotations

import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.security import (
    authenticate_user,
    create_access_token,
    get_current_active_user,
)
from app.models.schemas import LoginRequest, TokenResponse, UserInfoResponse

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticación"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Inicio de sesión del personal PNP",
    description=(
        "Autentica al personal policial con usuario y contraseña. "
        "Retorna un token JWT de acceso con tiempo de expiración configurable."
    ),
    responses={
        200: {"description": "Login exitoso — token JWT emitido"},
        401: {"description": "Credenciales inválidas"},
        422: {"description": "Datos de entrada inválidos"},
    },
)
async def login(payload: LoginRequest) -> TokenResponse:
    """
    Autenticación del personal PNP.

    **Usuarios demo disponibles:**
    - `admin` / `admin123` → Comandante, rol admin
    - `operador` / `pnp2026` → Suboficial, rol operator
    - `investigador` / `invest2026` → Técnico, rol investigator
    """
    user = authenticate_user(payload.username.strip().lower(), payload.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos. Verifique sus credenciales.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": user["username"]},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    logger.info(
        f"Token emitido para: {user['username']} "
        f"({user['rank']}) — expira en {settings.ACCESS_TOKEN_EXPIRE_MINUTES} min"
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserInfoResponse(
            username=user["username"],
            full_name=user["full_name"],
            badge_number=user["badge_number"],
            rank=user["rank"],
            unit=user["unit"],
            role=user["role"],
        ),
    )


@router.get(
    "/me",
    response_model=UserInfoResponse,
    summary="Información del usuario autenticado",
    description="Retorna los datos del personal PNP cuyo token es válido.",
)
async def get_me(
    current_user: dict = Depends(get_current_active_user),
) -> UserInfoResponse:
    """Obtiene el perfil del usuario autenticado."""
    return UserInfoResponse(
        username=current_user["username"],
        full_name=current_user["full_name"],
        badge_number=current_user["badge_number"],
        rank=current_user["rank"],
        unit=current_user["unit"],
        role=current_user["role"],
    )


@router.post(
    "/logout",
    summary="Cierre de sesión",
    description=(
        "Cierre de turno del personal PNP. "
        "El token se invalida en el cliente (stateless JWT)."
    ),
)
async def logout(
    current_user: dict = Depends(get_current_active_user),
) -> JSONResponse:
    """
    Cierre de sesión. Al ser JWT stateless, la invalidación se delega al frontend
    que debe eliminar el token del almacenamiento local.
    """
    logger.info(f"Logout solicitado por: {current_user['username']}")
    return JSONResponse(content={
        "success": True,
        "message": f"Sesión cerrada correctamente. Hasta pronto, {current_user['rank']} {current_user['full_name']}.",
    })
