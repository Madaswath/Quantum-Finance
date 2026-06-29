from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from app.database import get_db
from app.models import CategorizationRule, User
from app.routes.auth import get_current_user
from app.schemas import CategorizationRuleCreate, CategorizationRuleResponse

router = APIRouter(prefix="/categorization-rules", tags=["Categorization Rules"])

@router.get("", response_model=List[CategorizationRuleResponse])
async def list_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CategorizationRule)
        .filter(CategorizationRule.user_id == current_user.id)
        .order_by(CategorizationRule.created_at.desc())
    )
    return result.scalars().all()

@router.post("", response_model=CategorizationRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_rule(
    rule_data: CategorizationRuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if keyword already exists for this user
    result = await db.execute(
        select(CategorizationRule)
        .filter(CategorizationRule.user_id == current_user.id, CategorizationRule.keyword == rule_data.keyword)
    )
    existing_rule = result.scalars().first()
    if existing_rule:
         # Update existing category
         existing_rule.category = rule_data.category
         await db.commit()
         await db.refresh(existing_rule)
         return existing_rule

    new_rule = CategorizationRule(
        user_id=current_user.id,
        keyword=rule_data.keyword,
        category=rule_data.category
    )
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)
    return new_rule

@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(CategorizationRule)
        .filter(CategorizationRule.id == rule_id, CategorizationRule.user_id == current_user.id)
    )
    rule = result.scalars().first()
    if not rule:
        raise HTTPException(status_code=404, detail="Categorization rule not found")

    await db.delete(rule)
    await db.commit()
    return
