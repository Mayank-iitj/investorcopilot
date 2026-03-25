"""Authentication routes."""
from datetime import timedelta

from fastapi import APIRouter, Form, HTTPException, Request, status

from app.config import settings
from app.services.auth import authenticate_admin, create_access_token
from app.services.rate_limit import limiter

router = APIRouter()


@router.post("/auth/token")
@limiter.limit("10/minute")
async def login_for_access_token(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
):
    _ = request

    if not settings.ADMIN_PASSWORD_HASH:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured. Set ADMIN_PASSWORD_HASH.",
        )

    if not authenticate_admin(username, password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    access_token = create_access_token(
        subject=username,
        expires_delta=timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.JWT_EXPIRE_MINUTES * 60,
    }
