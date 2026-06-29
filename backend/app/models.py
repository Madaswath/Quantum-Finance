import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric, Text, func, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID, ARRAY, FLOAT
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True) # Nullable for OAuth logins
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    categorization_rules = relationship("CategorizationRule", back_populates="user", cascade="all, delete-orphan")
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period = Column(DateTime(timezone=True), nullable=False)
    account_source = Column(String(100), nullable=False) # 'Cash', 'HDFC Card', 'ICICI'
    category = Column(String(100), nullable=False)       # '🍜 Food', '🪑 Household', etc.
    subcategory = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    flow_direction = Column(String(10), nullable=False)  # 'Exp.' or 'Income'
    
    # Semantic embedding vector (1536 dims) represented as float array for high SQLAlchemy compatibility
    embedding = Column(ARRAY(FLOAT), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="transactions")


class CategorizationRule(Base):
    __tablename__ = "categorization_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    keyword = Column(String(100), nullable=False)
    category = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="categorization_rules")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    name = Column(String(255), nullable=True)
    age = Column(Integer, nullable=True)
    income = Column(Numeric(12, 2), nullable=True)
    goals = Column(JSON, nullable=True) # stores a list of goals: [{"target": str, "amount": float, "timeline": str}]
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="profile")

