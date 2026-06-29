import json
import os
from google import genai
from google.genai import types
from app.config import settings

class FinancialDiagnosticEngine:
    def __init__(self):
        # Retrieve API key securely from config
        self.api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        self._client = None

    @property
    def client(self):
        if not self._client:
            if not self.api_key:
                raise ValueError("GEMINI_API_KEY is not configured in environment settings.")
            # Initialize official Google Gen AI Client
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    async def run_financial_diagnostic(
        self, 
        net_worth_matrix: dict, 
        milestones: list, 
        burn_rates: list
    ) -> dict:
        """
        Executes a forward-looking cash flow projection and assessment
        as a private private-wealth fiduciary advisor.
        """
        
        # Format metrics clearly for Gemini input
        assets = net_worth_matrix.get("assets", 0)
        liabilities = net_worth_matrix.get("liabilities", 0)
        savings = net_worth_matrix.get("savings", 0)
        
        milestone_str = "\n".join([
            f"  * Milestone: '{m.get('target')}', Target Cost: ₹{m.get('amount')}, Timeline: '{m.get('timeline')}'"
            for m in milestones
        ])
        
        burn_rates_str = "\n".join([
            f"  * {b.get('category')}: ₹{b.get('amount')}"
            for b in burn_rates
        ])

        system_instruction = (
            "You are an elite, private banking fiduciary wealth officer. Your duty is to analyze "
            "private cash flows, project assets and liabilities over a 5-year timeline with "
            "6% inflation factored in, and formulate hyper-specific action recommendations "
            "to maximize financial health."
        )

        prompt = (
            f"Analyze the user's financial ledger metrics:\n"
            f"- Net Worth Matrix: Assets ₹{assets}, Liabilities ₹{liabilities}, Savings Pool ₹{savings}\n"
            f"- Financial Milestones:\n{milestone_str}\n"
            f"- Category Monthly Burn Rates:\n{burn_rates_str}\n\n"
            f"Generate a rigorous financial diagnostic. Account for inflation shifting purchasing power.\n"
            f"Return a strict, valid JSON object following this EXACT schema:\n"
            f"{{\n"
            f"  \"projection_years\": [ \n"
            f"    {{ \"year\": 2026, \"estimated_assets\": 100000.00, \"estimated_liabilities\": 50000.00, \"net_worth\": 50000.00 }}\n"
            f"  ],\n"
            f"  \"milestone_viability\": [\n"
            f"    {{ \"target\": \"house purchase\", \"is_viable\": true, \"inflation_adjusted_cost\": 120000.00, \"shortfall\": 0.00, \"advice\": \"Maintain current rates\" }}\n"
            f"  ],\n"
            f"  \"recommendations\": [\n"
            f"    {{ \"title\": \"Debt Refinancing\", \"impact\": \"High\", \"financial_benefits\": \"₹12,000 saved annually\", \"action_plan\": \"Move HDFC Card high interest debt into ICICI personal loan...\" }}\n"
            f"  ],\n"
            f"  \"inflation_impact_note\": \"Analytical review of inflation impact on goals.\"\n"
            f"}}\n"
            f"Return ONLY the raw JSON. Do not include markdown code fence formatting."
        )

        try:
            # Call Gemini using the latest, non-deprecated gemini-3.5-flash model
            response = self.client.models.generate_content(
                model='gemini-3.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.15,
                    response_mime_type="application/json"
                )
            )
            
            cleaned_text = response.text.strip()
            if cleaned_text.startswith("```"):
                cleaned_text = cleaned_text.replace("```json", "").replace("```", "").strip()
                
            return json.loads(cleaned_text)
            
        except Exception as e:
            return {
                "error": "Failed to run fiduciary diagnostic",
                "details": str(e)
            }
