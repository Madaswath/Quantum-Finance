from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models import User, UserProfile, WalletTransaction, SubscriptionPayment
from app.routes.auth import get_current_user
from app.schemas import WalletCreditRequest, SubscriptionPurchaseRequest, UserProfileResponse

router = APIRouter(prefix="/wallet", tags=["Wallet & Subscriptions"])

@router.post("/credit", response_model=UserProfileResponse)
async def credit_wallet(
    payload: WalletCreditRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(UserProfile).filter(
            UserProfile.user_id == current_user.id,
            UserProfile.is_deleted == False
        )
    )
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="UserProfile not found")

    amount = payload.amount
    profile.wallet_balance = (profile.wallet_balance or 0) + amount

    transaction = WalletTransaction(
        user_id=current_user.id,
        amount=amount,
        transaction_type="credit",
        description=f"Credited ₹{amount} to wallet."
    )
    db.add(transaction)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.post("/purchase-subscription", response_model=UserProfileResponse)
async def purchase_subscription(
    payload: SubscriptionPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(UserProfile).filter(
            UserProfile.user_id == current_user.id,
            UserProfile.is_deleted == False
        )
    )
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="UserProfile not found")

    tier = payload.tier
    cost = 99 if tier == "Plus" else 199

    if (profile.wallet_balance or 0) < cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient wallet balance. Subscription to {tier} costs ₹{cost}, but your balance is ₹{profile.wallet_balance}."
        )

    # Deduct cost from wallet
    profile.wallet_balance -= cost
    profile.subscription_tier = tier
    profile.is_premium = True  # both Plus and Pro are premium

    # Create WalletTransaction (debit)
    tx = WalletTransaction(
        user_id=current_user.id,
        amount=-cost,
        transaction_type="purchase",
        description=f"Purchased {tier} Subscription plan."
    )
    db.add(tx)

    # Create SubscriptionPayment
    payment = SubscriptionPayment(
        user_id=current_user.id,
        amount=cost,
        tier=tier,
        status="success"
    )
    db.add(payment)

    await db.commit()
    await db.refresh(profile)
    return profile
