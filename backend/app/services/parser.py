import re
from datetime import datetime
from typing import Dict, Any, Optional

def parse_banking_sms(text: str, custom_rules: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    text_lower = text.lower()
    
    amount = 0.0
    account_source = "Cash"
    category = "🪑 Household"
    subcategory = "General"
    note = "Parsed SMS Transaction"
    flow_direction = "Exp."

    # 1. Detect Account Source
    if "hdfc" in text_lower:
        account_source = "HDFC Card"
    elif "icici" in text_lower:
        account_source = "ICICI"
    elif "cash" in text_lower:
        account_source = "Cash"

    # 2. Extract Amount (Rs. X, Rs X, INR X, Rs. X.XX, etc)
    amount_patterns = [
        r"(?:rs\.?|inr)\s*([0-9,.]+)",
        r"for\s*(?:rs\.?|inr)?\s*([0-9,.]+)",
        r"debited\s*(?:with\s*)?(?:rs\.?|inr)?\s*([0-9,.]+)",
        r"credited\s*(?:with\s*)?(?:rs\.?|inr)?\s*([0-9,.]+)",
        r"([0-9,.]+)\s*(?:rs|inr)"
    ]

    for pattern in amount_patterns:
        match = re.search(pattern, text_lower)
        if match:
            try:
                raw_amount = match.group(1).replace(",", "")
                amount = float(raw_amount)
                break
            except ValueError:
                continue

    # 3. Detect Flow Direction
    if any(keyword in text_lower for keyword in ["credited", "received", "deposited", "salary"]):
        flow_direction = "Income"
        category = "💼 Income"
        subcategory = "Direct Deposit"
        note = "Direct Credit Payout"

    # 4. Extract Merchant/Note Context
    merchant_patterns = [
        r"at\s+([^,\n.]+)",
        r"spent\s+on\s+([^,\n.]+)",
        r"sent\s+to\s+([^,\n.]+)",
        r"to\s+([^,\n.]+)\s+from",
        r"for\s+([^,\n.]+)",
        r"info:\s*([^,\n.]+)"
    ]

    for pattern in merchant_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            note = match.group(1).strip()
            break

    if note == "Parsed SMS Transaction" and amount > 0:
        note = f"Spend of ₹{amount} via {account_source}"

    # 5. Map to Standardized category schema
    note_lower = note.lower()
    custom_category = None
    if custom_rules:
        for kw, cat in custom_rules.items():
            if kw.lower() in note_lower or kw.lower() in text_lower:
                custom_category = cat
                break

    if custom_category:
        category = custom_category
        subcategory = "Custom Rule"
    elif flow_direction == "Exp.":
        if any(kw in note_lower for kw in ["chai", "tea", "coffee", "kings", "starbucks", "cafe", "restaurant", "diner", "food", "swiggy", "zomato", "eats", "bake", "bakery", "lunch", "dinner", "breakfast", "burger", "pizza", "snacks", "milk", "dairy"]):
            category = "🍜 Food"
            subcategory = "Groceries" if any(kw in note_lower for kw in ["grocer", "milk", "vegetable", "fruits"]) else "Restaurants"
        elif any(kw in note_lower for kw in ["rent", "owner", "room", "flat", "apartment", "furniture", "utility", "electricity", "power", "eb", "water", "gas", "wifi", "internet", "broadband", "house"]):
            category = "🪑 Household"
            subcategory = "Rent" if "rent" in note_lower else "Utilities"
        elif any(kw in note_lower for kw in ["apollo", "pharmacy", "doctor", "hospital", "clinic", "med", "medicine", "tablet", "bp", "dentist", "health", "wellness", "insurance", "physio"]):
            category = "🧘🏼 Health"
            subcategory = "Pharmacy" if any(kw in note_lower for kw in ["pharmacy", "medicine", "tablet"]) else "Hospital"
        elif any(kw in note_lower for kw in ["uber", "ola", "metro", "card", "commute", "cab", "taxi", "train", "bus", "ticket", "petrol", "fuel", "shell", "diesel", "service", "auto"]):
            category = "🚗 Transport"
            subcategory = "Fuel" if any(kw in note_lower for kw in ["petrol", "fuel"]) else "Commute"
        elif any(kw in note_lower for kw in ["zerodha", "sip", "mutual", "fund", "stock", "equity", "groww", "invest", "gold", "etf", "bonds"]):
            category = "📈 Investment"
            subcategory = "Equity & SIPs"
        elif any(kw in note_lower for kw in ["udemy", "coursera", "course", "book", "school", "tuition", "class", "exam", "college", "fees", "learning"]):
            category = "🎓 Education"
            subcategory = "Skills & Courses"
        elif any(kw in note_lower for kw in ["gift", "present", "birthday", "anniversary", "donation", "charity"]):
            category = "🎁 Gift"
            subcategory = "Personal"
        elif any(kw in note_lower for kw in ["netflix", "prime", "spotify", "movie", "theater", "mall", "pvr", "concert", "game", "play", "fun", "pub", "bar", "beer", "wine", "club"]):
            category = "🎉 Entertainment"
            subcategory = "Leisure"

    return {
        "period": datetime.utcnow().isoformat() + "Z",
        "account_source": account_source,
        "category": category,
        "subcategory": subcategory,
        "note": note,
        "amount": amount,
        "flow_direction": flow_direction
    }
