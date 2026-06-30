from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime
from typing import Optional, List, Literal
from decimal import Decimal
from uuid import UUID

# User schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserResponse(BaseModel):
    id: UUID
    email: str
    created_at: datetime

    @field_validator("email")
    @classmethod
    def mask_email_field(cls, v: str) -> str:
        if "@" in v:
            name, domain = v.split("@", 1)
            if len(name) <= 2:
                masked = name[0] + "*" * len(name)
            else:
                masked = name[0] + "*" * (len(name) - 2) + name[-1]
            return f"{masked}@{domain}"
        return v

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


# Transaction schemas
class TransactionBase(BaseModel):
    period: datetime
    account_source: str = Field(..., description="Cash, HDFC Card, or ICICI")
    category: str = Field(..., description="e.g. 🍜 Food, 🪑 Household")
    subcategory: Optional[str] = None
    note: Optional[str] = None
    amount: Decimal = Field(..., max_digits=12, decimal_places=2)
    flow_direction: Literal["Income", "Exp."]
    transaction_type: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionResponse(TransactionBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# Bulk Ledger batch schemas
class BatchTransactionRequest(BaseModel):
    transactions: List[TransactionCreate]


# SMS Parse schemas
class SMSParseRequest(BaseModel):
    text: str


# AI Advisor schemas
class NetWorthMatrixSchema(BaseModel):
    assets: Decimal
    liabilities: Decimal
    savings: Decimal

class MilestoneSchema(BaseModel):
    target: str
    amount: Decimal
    timeline: str
    priority: Optional[float] = 1.0
    years_left: Optional[float] = 1.0
    amount_required_today: Optional[Decimal] = Decimal("0.0")
    amount_available_today: Optional[Decimal] = Decimal("0.0")
    inflation: Optional[Decimal] = Decimal("0.05")
    step_up: Optional[Decimal] = Decimal("0.05")
    sip_required: Optional[Decimal] = Decimal("0.0")

class BurnRateSchema(BaseModel):
    category: str
    amount: Decimal

class AdvisorRequest(BaseModel):
    net_worth_matrix: NetWorthMatrixSchema
    milestones: List[MilestoneSchema]
    burn_rates: List[BurnRateSchema]

class MilestoneViability(BaseModel):
    target: str
    is_viable: bool
    inflation_adjusted_cost: Decimal
    shortfall: Decimal
    advice: str

class Recommendation(BaseModel):
    title: str
    impact: Literal["High", "Medium", "Low"]
    financial_benefits: str
    action_plan: str

class ProjectionYear(BaseModel):
    year: int
    estimated_assets: Decimal
    estimated_liabilities: Decimal
    net_worth: Decimal

class AdvisorResponse(BaseModel):
    projection_years: List[ProjectionYear]
    milestone_viability: List[MilestoneViability]
    recommendations: List[Recommendation]
    inflation_impact_note: str


# Categorization Rule Schemas
class CategorizationRuleCreate(BaseModel):
    keyword: str
    category: str

class CategorizationRuleResponse(BaseModel):
    id: UUID
    user_id: UUID
    keyword: str
    category: str
    created_at: datetime

    class Config:
        from_attributes = True


# User Profile and Goal Setting Schemas
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    income: Optional[Decimal] = None
    goals: Optional[List[MilestoneSchema]] = None
    is_premium: Optional[bool] = None

class UserProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: Optional[str] = None
    age: Optional[int] = None
    income: Optional[Decimal] = None
    goals: Optional[List[MilestoneSchema]] = None
    is_premium: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

