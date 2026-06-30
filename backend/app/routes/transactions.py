from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models import Transaction, User, CategorizationRule
from app.routes.auth import get_current_user
from app.schemas import TransactionCreate, TransactionResponse, BatchTransactionRequest, SMSParseRequest
from app.services.parser import parse_banking_sms

router = APIRouter(prefix="/transactions", tags=["Transactions Ledger"])

# Get Transactions
@router.get("", response_model=List[TransactionResponse])
async def list_transactions(
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Transaction)
        .filter(Transaction.user_id == current_user.id, Transaction.is_deleted == False)
        .order_by(Transaction.period.desc())
    )
    return result.scalars().all()


# Create Transaction
@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    tx_data: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_tx = Transaction(
        user_id=current_user.id,
        period=tx_data.period,
        account_source=tx_data.account_source,
        category=tx_data.category,
        subcategory=tx_data.subcategory,
        note=tx_data.note,
        amount=tx_data.amount,
        flow_direction=tx_data.flow_direction
    )
    db.add(new_tx)
    await db.commit()
    await db.refresh(new_tx)
    return new_tx


# Delete Transaction
@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    tx_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Transaction).filter(
            Transaction.id == tx_id, 
            Transaction.user_id == current_user.id,
            Transaction.is_deleted == False
        )
    )
    tx = result.scalars().first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    tx.is_deleted = True
    tx.deleted_at = datetime.utcnow()
    await db.commit()
    return


# Batch Ledger Ingestion
@router.post("/batch", response_model=List[TransactionResponse], status_code=status.HTTP_201_CREATED)
async def upload_batch_ledger(
    payload: BatchTransactionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    created_txs = []
    for tx_data in payload.transactions:
        new_tx = Transaction(
            user_id=current_user.id,
            period=tx_data.period,
            account_source=tx_data.account_source,
            category=tx_data.category,
            subcategory=tx_data.subcategory,
            note=tx_data.note,
            amount=tx_data.amount,
            flow_direction=tx_data.flow_direction
        )
        db.add(new_tx)
        created_txs.append(new_tx)
        
    await db.commit()
    for tx in created_txs:
        await db.refresh(tx)
    return created_txs


# Instant Regex SMS Parser Route
@router.post("/parse-sms")
async def parse_sms_string(
    payload: SMSParseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Fetch user's custom categorization rules
        result = await db.execute(
            select(CategorizationRule).filter(
                CategorizationRule.user_id == current_user.id,
                CategorizationRule.is_deleted == False
            )
        )
        rules = result.scalars().all()
        rules_dict = {rule.keyword: rule.category for rule in rules}

        parsed_data = parse_banking_sms(payload.text, rules_dict)
        return parsed_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SMS string parsing failed: {str(e)}")


# Burn Rates Aggregation Metrics
@router.get("/metrics/burn-rates")
async def get_burn_rates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Retrieve sum of expenses categorized by category matching May/June Excel
    result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .filter(
            Transaction.user_id == current_user.id, 
            Transaction.flow_direction == "Exp.",
            Transaction.is_deleted == False
        )
        .group_by(Transaction.category)
    )
    
    rows = result.all()
    return [{"category": row[0], "amount": float(row[1])} for row in rows]
