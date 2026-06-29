from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import auth, transactions, advisor

app = FastAPI(
    title="Quantum Wealth Financial Super-App API",
    description="Fiduciary Private Ledger & AI Diagnostic Service Engine",
    version="1.0.0"
)

# CORS configuration for seamless client integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    from app.database import engine
    from app.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Mount Routes
from app.routes import auth, transactions, advisor, categorization_rules, user_profiles

app.include_router(auth.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(advisor.router, prefix="/api")
app.include_router(categorization_rules.router, prefix="/api")
app.include_router(user_profiles.router, prefix="/api")

@app.get("/")
def read_root():
    return {
        "status": "Online",
        "service": "Quantum Wealth Financial API Engine",
        "documentation": "/docs"
    }
