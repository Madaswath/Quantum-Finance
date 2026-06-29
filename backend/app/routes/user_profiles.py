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
        select(UserProfile).filter(UserProfile.user_id == current_user.id)
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
        select(UserProfile).filter(UserProfile.user_id == current_user.id)
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
        profile.goals = [goal.dict() for goal in profile_data.goals]
        
    await db.commit()
    await db.refresh(profile)
    return profile
