from fastapi import APIRouter, Depends, HTTPException
from app.routes.auth import get_current_user
from app.models import User
from app.schemas import AdvisorRequest, AdvisorResponse
from app.services.ai_engine import FinancialDiagnosticEngine

router = APIRouter(prefix="/advisor", tags=["Fiduciary AI Advisor"])

diagnostic_engine = FinancialDiagnosticEngine()

@router.post("/diagnostic", response_model=AdvisorResponse)
async def generate_fiduciary_diagnostic(
    payload: AdvisorRequest,
    current_user: User = Depends(get_current_user)
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
            
        return raw_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI diagnostic generation failed: {str(e)}")
