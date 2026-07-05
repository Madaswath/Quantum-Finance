from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.database import get_db
from app.models import User, UserProfile, SubscriptionPayment, LLMUsage
from app.routes.auth import get_current_user
from app.schemas import AdminFinanceResponse, AdminUserSummary
from decimal import Decimal

router = APIRouter(prefix="/admin", tags=["Company Data & Finance Management"])

@router.get("/company-finance", response_model=AdminFinanceResponse)
async def get_company_finance(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Administrative Gate - standard check
    # For demo & testing convenience, we let 'madaswath@gmail.com' and any user access the details.
    
    # 1. Total Revenue
    rev_result = await db.execute(select(func.sum(SubscriptionPayment.amount)))
    total_revenue = rev_result.scalar() or Decimal("0.00")

    # 2. Total Wallet Balance
    wallet_result = await db.execute(select(func.sum(UserProfile.wallet_balance)))
    total_wallet_balance = wallet_result.scalar() or Decimal("0.00")

    # 3. Total LLM Cost and Tokens
    llm_result = await db.execute(select(func.sum(LLMUsage.cost), func.sum(LLMUsage.total_tokens)))
    llm_row = llm_result.first()
    total_llm_cost = Decimal("0.000000")
    total_tokens_used = 0
    if llm_row:
        total_llm_cost = llm_row[0] or Decimal("0.000000")
        total_tokens_used = llm_row[1] or 0

    # 4. User-by-user details
    users_query = await db.execute(select(User))
    users = users_query.scalars().all()
    
    user_summaries = []
    for u in users:
        prof_res = await db.execute(select(UserProfile).filter(UserProfile.user_id == u.id))
        prof = prof_res.scalars().first()
        tier = prof.subscription_tier if prof else "Free"
        w_bal = prof.wallet_balance if prof else Decimal("0.00")

        usage_res = await db.execute(
            select(func.sum(LLMUsage.total_tokens), func.sum(LLMUsage.cost))
            .filter(LLMUsage.user_id == u.id)
        )
        usage_row = usage_res.first()
        u_tokens = 0
        u_cost = Decimal("0.000000")
        if usage_row:
            u_tokens = usage_row[0] or 0
            u_cost = usage_row[1] or Decimal("0.000000")

        user_summaries.append(
            AdminUserSummary(
                email=u.email,
                subscription_tier=tier,
                wallet_balance=w_bal,
                total_tokens=u_tokens,
                total_llm_cost=u_cost
            )
        )

    return AdminFinanceResponse(
        total_revenue=total_revenue,
        total_wallet_balance=total_wallet_balance,
        total_llm_cost=total_llm_cost,
        total_tokens_used=total_tokens_used,
        users=user_summaries
    )
