from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.routes.auth import get_current_user
from app.models import User, LLMUsage
from app.schemas import AdvisorRequest, AdvisorResponse
from app.services.ai_engine import FinancialDiagnosticEngine
from decimal import Decimal

router = APIRouter(prefix="/advisor", tags=["Fiduciary AI Advisor"])

diagnostic_engine = FinancialDiagnosticEngine()

@router.post("/diagnostic", response_model=AdvisorResponse)
async def generate_fiduciary_diagnostic(
    payload: AdvisorRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Gate access to premium members only
    if not current_user.profile or not current_user.profile.is_premium:
        raise HTTPException(
            status_code=403, 
            detail="Premium subscription required to access AI Fiduciary Advisor insights."
        )
        
    try:
        raw_result = await diagnostic_engine.run_financial_diagnostic(
            net_worth_matrix=payload.net_worth_matrix.model_dump(),
            milestones=[m.model_dump() for m in payload.milestones],
            burn_rates=[b.model_dump() for b in payload.burn_rates]
        )
        
        if "error" in raw_result:
            raise HTTPException(status_code=500, detail=raw_result["error"])
            
        result_data = raw_result.get("result", {})
        usage = raw_result.get("usage", {})
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", 0)
        
        # Prompt: ₹10 per 1M (₹0.00001/token), Completion: ₹40 per 1M (₹0.00004/token)
        cost = Decimal(prompt_tokens) * Decimal("0.00001") + Decimal(completion_tokens) * Decimal("0.00004")
        
        llm_usage = LLMUsage(
            user_id=current_user.id,
            model="gemini-3.5-flash",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            cost=cost
        )
        db.add(llm_usage)
        await db.commit()
        
        return result_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI diagnostic generation failed: {str(e)}")
