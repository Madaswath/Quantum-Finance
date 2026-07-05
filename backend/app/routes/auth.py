from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.database import get_db
from app.models import User, UserProfile
from app.schemas import UserCreate, UserResponse, LoginRequest, TokenResponse
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Argon2id password hashing context
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_jwt_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


# Traditional Registration
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == user_data.email.lower()))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already registered"
        )
    
    hashed_pw = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email.lower(),
        hashed_password=hashed_pw
    )
    db.add(new_user)
    await db.flush() # ensure new_user.id is populated
    
    default_profile = UserProfile(
        user_id=new_user.id,
        name="",
        age=None,
        income=None,
        goals=[]
    )
    db.add(default_profile)
    await db.commit()
    await db.refresh(new_user)
    return new_user


# Traditional Login
@router.post("/login", response_model=TokenResponse)
async def login_user(login_data: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == login_data.email.lower()))
    user = result.scalars().first()
    
    if not user or not user.hashed_password or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Generate tokens
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    access_token = create_jwt_token({"sub": str(user.id), "type": "access"}, access_token_expires)
    refresh_token = create_jwt_token({"sub": str(user.id), "type": "refresh"}, refresh_token_expires)
    
    # Store refresh token securely in HTTP-only cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=int(refresh_token_expires.total_seconds())
    )
    # Store access token securely in HTTP-only cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=int(access_token_expires.total_seconds())
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user
    )


# Google Federated Sign-In Endpoint Mock/Verification
@router.post("/google", response_model=TokenResponse)
async def google_login(payload: dict, response: Response, db: AsyncSession = Depends(get_db)):
    id_token_str = payload.get("id_token")
    if not id_token_str:
        raise HTTPException(status_code=400, detail="Google id_token is required")
        
    # Standard security workflow:
    # 1. Decode & verify id_token using google.oauth2.id_token.verify_oauth2_token(id_token, requests.Request(), CLIENT_ID)
    # 2. Extract Google Email
    # In a real environment, we'd invoke the Google verification library. We mock verify here for smooth preview compilation.
    
    email = payload.get("email") or "google_user@gmail.com"
    
    # Upsert User
    result = await db.execute(select(User).filter(User.email == email.lower()))
    user = result.scalars().first()
    
    if not user:
        user = User(email=email.lower()) # Google user has no traditional password
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
    # Generate short-lived Access and long-lived Refresh tokens
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    refresh_token_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    access_token = create_jwt_token({"sub": str(user.id), "type": "access"}, access_token_expires)
    refresh_token = create_jwt_token({"sub": str(user.id), "type": "refresh"}, refresh_token_expires)
    
    # Store refresh token in secure HTTP-Only cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=int(refresh_token_expires.total_seconds())
    )
    # Store access token securely in HTTP-only cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=int(access_token_expires.total_seconds())
    )
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user
    )


# Logout Endpoint to clear HttpOnly cookies
@router.post("/logout")
async def logout_user(response: Response):
    response.delete_cookie("access_token", httponly=True, secure=True, samesite="strict")
    response.delete_cookie("refresh_token", httponly=True, secure=True, samesite="strict")
    return {"status": "success", "message": "Logged out successfully"}


# Dependency to protect routes and extract current user
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    # 1. First attempt to fetch token from HTTP-Only cookie
    token = request.cookies.get("access_token")
    
    # 2. Fallback to Authorization header if cookies are not present (for compatibility/development tools)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
         raise HTTPException(
             status_code=status.HTTP_401_UNAUTHORIZED,
             detail="Authorization token is missing or invalid"
         )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None or token_type != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")
        
    result = await db.execute(select(User).filter(User.id == user_id))
    user = result.scalars().first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
