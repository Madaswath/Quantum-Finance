from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.models import UserProfile, User
from app.routes.auth import get_current_user
from app.schemas import UserProfileUpdate, UserProfileResponse

router = APIRouter(prefix="/user-profile", tags=["User Profiles"])

@router.get("", response_model=UserProfileResponse)
async def get_profile(
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
        # Create a default profile if it doesn't exist
        profile = UserProfile(
            user_id=current_user.id,
            name="",
            age=None,
            income=None,
            goals=[]
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        
    return profile

@router.put("", response_model=UserProfileResponse)
async def update_profile(
    profile_data: UserProfileUpdate,
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
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        
    if profile_data.name is not None:
        profile.name = profile_data.name
    if profile_data.age is not None:
        profile.age = profile_data.age
    if profile_data.income is not None:
        profile.income = profile_data.income
    if profile_data.goals is not None:
        # Convert List[MilestoneSchema] to a JSON-compatible list of dicts
        profile.goals = [goal.model_dump() for goal in profile_data.goals]
    if profile_data.is_premium is not None:
        profile.is_premium = profile_data.is_premium
    if profile_data.subscription_tier is not None:
        profile.subscription_tier = profile_data.subscription_tier
    if profile_data.wallet_balance is not None:
        profile.wallet_balance = profile_data.wallet_balance
    if profile_data.current_theme is not None:
        profile.current_theme = profile_data.current_theme
    if profile_data.layout_density is not None:
        profile.layout_density = profile_data.layout_density
    if profile_data.current_language is not None:
        profile.current_language = profile_data.current_language
    if profile_data.category_budgets is not None:
        profile.category_budgets = profile_data.category_budgets
    if profile_data.starting_balances is not None:
        profile.starting_balances = profile_data.starting_balances
    if profile_data.accounts is not None:
        profile.accounts = profile_data.accounts
        
    await db.commit()
    await db.refresh(profile)
    return profile
