"""
Car Compass Backend — AI-native Indian car recommendation API
FastAPI + Gemini 1.5 Flash + cars.json local database
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import google.generativeai as genai

# ---------------------------------------------------------------------------
# Environment & Gemini setup
# ---------------------------------------------------------------------------

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

gemini_model = genai.GenerativeModel("gemini-2.5-flash") if GEMINI_API_KEY else None

# ---------------------------------------------------------------------------
# Load cars.json once at startup into memory
# ---------------------------------------------------------------------------

CARS_DB: list[dict] = []

def load_cars() -> list[dict]:
    """Load and validate the cars database from cars.json."""
    db_path = Path(__file__).parent / "cars.json"
    if not db_path.exists():
        raise RuntimeError(f"cars.json not found at {db_path}")
    with open(db_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data

# ---------------------------------------------------------------------------
# FastAPI app initialisation
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Car Compass API",
    description="AI-native Indian car recommendation platform backend",
    version="1.0.0",
)

# CORS — allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    """Load cars database into memory on startup."""
    global CARS_DB
    CARS_DB = load_cars()
    print(f"[Car Compass] Loaded {len(CARS_DB)} cars from cars.json")

# ---------------------------------------------------------------------------
# Pydantic request/response models
# ---------------------------------------------------------------------------

class RecommendRequest(BaseModel):
    budget_lakhs: float = Field(..., gt=0, description="Maximum budget in lakhs")
    passengers: str = Field(..., description="Expected passengers: '1-2', '3-4', or '5+'")
    primary_usage: str = Field(..., description="Usage pattern: 'city', 'highway', or 'mixed'")
    body_type: str = Field(..., description="Preferred body type or 'no_preference'")
    preferred_brands: list[str] = Field(default=[], description="List of preferred brands (max 5)")
    priorities: list[str] = Field(
        ...,
        min_length=1,
        max_length=4,
        description="Ranked list of priorities: safety, mileage, features, performance"
    )


class ScoreBreakdown(BaseModel):
    priority_score: float
    usage_score: float
    family_score: float
    budget_score: float
    body_type_score: float


class Gain(BaseModel):
    attribute: str
    top_pick_score: int
    alt_scores: list[int]


class Tradeoff(BaseModel):
    attribute: str
    top_pick_score: int
    beaten_by: str       # e.g. "alternative_1"
    by_how_much: int


class CarResult(BaseModel):
    id: str
    brand: str
    model: str
    variant: str
    body_type: str
    price_lakhs: float
    seating_capacity: int
    fuel_type: str
    power_bhp: int
    fuel_efficiency_kmpl: float
    scores: dict
    final_score: float
    score_breakdown: ScoreBreakdown


class TopPickResult(CarResult):
    gains: list[Gain]
    tradeoffs: list[Tradeoff]


class RecommendResponse(BaseModel):
    top_pick: TopPickResult
    alternatives: list[CarResult]
    user_preferences: RecommendRequest


class ExplainRequest(BaseModel):
    user_preferences: dict
    top_pick: dict
    alternatives: list[dict]


class ExplainResponse(BaseModel):
    explanation: str


class WhyNotRequest(BaseModel):
    user_preferences: dict
    rejected_car: dict
    top_pick: dict


class WhyNotResponse(BaseModel):
    explanation: str


class HealthResponse(BaseModel):
    status: str
    cars_loaded: int

# ---------------------------------------------------------------------------
# Scoring engine — purely algorithmic, no Gemini
# ---------------------------------------------------------------------------

# Priority weights for ranked list (up to 4 priorities)
PRIORITY_WEIGHTS = [0.40, 0.30, 0.20, 0.10]

# Final score component weights
WEIGHT_PRIORITY  = 0.40
WEIGHT_USAGE     = 0.20
WEIGHT_FAMILY    = 0.15
WEIGHT_BUDGET    = 0.15
WEIGHT_BODY_TYPE = 0.10

VALID_SCORE_KEYS = {"safety", "mileage", "features", "performance", "family_comfort",
                    "city_drivability", "highway_drivability"}


def compute_priority_score(car: dict, priorities: list[str]) -> float:
    """Weighted average of user's ranked priorities (score out of 10)."""
    scores = car["scores"]
    total = 0.0
    weight_sum = 0.0
    for i, priority in enumerate(priorities[:4]):
        if priority in scores:
            w = PRIORITY_WEIGHTS[i]
            total += scores[priority] * w
            weight_sum += w
    return (total / weight_sum) if weight_sum > 0 else 0.0


def compute_usage_score(car: dict, primary_usage: str) -> float:
    """Score based on driving context (score out of 10)."""
    scores = car["scores"]
    if primary_usage == "city":
        return float(scores.get("city_drivability", 5))
    elif primary_usage == "highway":
        return float(scores.get("highway_drivability", 5))
    else:  # mixed
        return (scores.get("city_drivability", 5) + scores.get("highway_drivability", 5)) / 2.0


def compute_family_score(car: dict, passengers: str) -> float:
    """Score based on passenger count and family comfort (score out of 10)."""
    scores = car["scores"]
    if passengers == "1-2":
        return float(scores.get("performance", 5))
    elif passengers == "3-4":
        return float(scores.get("family_comfort", 5))
    else:  # "5+"
        raw = scores.get("family_comfort", 5) * 1.2
        return min(raw, 10.0)


def compute_budget_score(car: dict, budget_lakhs: float) -> float:
    """Reward cars well within budget (score out of 10, capped 0–10)."""
    price = car["price_lakhs"]
    raw = (budget_lakhs - price) / budget_lakhs * 10
    return max(0.0, min(raw, 10.0))


def compute_body_type_score(car: dict, requested_body_type: str) -> float:
    """Exact match = 10, no_preference = 7, mismatch = 3."""
    if requested_body_type == "no_preference":
        return 7.0
    return 10.0 if car["body_type"].lower() == requested_body_type.lower() else 3.0


def score_car(car: dict, req: RecommendRequest) -> tuple[float, ScoreBreakdown]:
    """Compute final weighted score and breakdown for a single car."""
    ps  = compute_priority_score(car, req.priorities)
    us  = compute_usage_score(car, req.primary_usage)
    fs  = compute_family_score(car, req.passengers)
    bs  = compute_budget_score(car, req.budget_lakhs)
    bts = compute_body_type_score(car, req.body_type)

    final = (
        ps  * WEIGHT_PRIORITY  +
        us  * WEIGHT_USAGE     +
        fs  * WEIGHT_FAMILY    +
        bs  * WEIGHT_BUDGET    +
        bts * WEIGHT_BODY_TYPE
    )

    breakdown = ScoreBreakdown(
        priority_score=round(ps, 3),
        usage_score=round(us, 3),
        family_score=round(fs, 3),
        budget_score=round(bs, 3),
        body_type_score=round(bts, 3),
    )

    return round(final, 4), breakdown


def apply_hard_filters(cars: list[dict], req: RecommendRequest) -> list[dict]:
    """
    Step 1 — Hard Filters.
    1. Remove cars above budget.
    2. Filter to matching body type (unless no_preference).
    3. Filter to preferred brands (unless empty).
    4. If fewer than 3 remain, progressively relax: brands first, then body type.
    """
    # --- Budget filter (non-relaxable) ---
    budget_filtered = [c for c in cars if c["price_lakhs"] <= req.budget_lakhs]

    # Normalise inputs for case-insensitive comparison
    requested_body = req.body_type.lower()
    preferred_brands_lower = [b.lower() for b in req.preferred_brands[:5]]

    # --- Apply both brand + body filters ---
    def apply_body(pool: list[dict]) -> list[dict]:
        if requested_body == "no_preference":
            return pool
        return [c for c in pool if c["body_type"].lower() == requested_body]

    def apply_brand(pool: list[dict]) -> list[dict]:
        if not preferred_brands_lower:
            return pool
        return [c for c in pool if c["brand"].lower() in preferred_brands_lower]

    # Full filter
    full_filtered = apply_brand(apply_body(budget_filtered))
    if len(full_filtered) >= 3:
        return full_filtered

    # Relax brand filter
    body_only = apply_body(budget_filtered)
    if len(body_only) >= 3:
        return body_only

    # Relax body type filter too (brand still relaxed)
    if len(budget_filtered) >= 1:
        return budget_filtered

    return []


def build_gains_tradeoffs(
    top_pick: dict,
    alternatives: list[dict],
) -> tuple[list[Gain], list[Tradeoff]]:
    """
    Compare top_pick scores against both alternatives for every score attribute.
    gains    → attributes where top_pick strictly beats BOTH alternatives.
    tradeoffs → attributes where top_pick is strictly beaten by AT LEAST ONE alternative.
    """
    score_keys = list(VALID_SCORE_KEYS)
    tp_scores = top_pick["scores"]
    alt_score_list = [alt["scores"] for alt in alternatives]

    gains: list[Gain] = []
    tradeoffs: list[Tradeoff] = []

    for key in score_keys:
        tp_val = tp_scores.get(key, 0)
        alt_vals = [a.get(key, 0) for a in alt_score_list]

        if all(tp_val > av for av in alt_vals):
            gains.append(Gain(
                attribute=key,
                top_pick_score=tp_val,
                alt_scores=alt_vals,
            ))
        else:
            for idx, av in enumerate(alt_vals):
                if av > tp_val:
                    tradeoffs.append(Tradeoff(
                        attribute=key,
                        top_pick_score=tp_val,
                        beaten_by=f"alternative_{idx + 1}",
                        by_how_much=av - tp_val,
                    ))

    return gains, tradeoffs

# ---------------------------------------------------------------------------
# Gemini helper
# ---------------------------------------------------------------------------

GEMINI_FALLBACK = "Our adviser is unavailable right now. Here are your results."


def call_gemini(prompt: str) -> str:
    """Call Gemini 1.5 Flash and return the text response; fall back gracefully."""
    if not gemini_model:
        return GEMINI_FALLBACK
    try:
        response = gemini_model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"[Gemini] Error: {e}")
        return GEMINI_FALLBACK

# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["Utility"])
def health_check():
    """Returns API health status and number of cars loaded."""
    return HealthResponse(status="ok", cars_loaded=len(CARS_DB))


@app.post("/recommend", response_model=RecommendResponse, tags=["Recommendation"])
def recommend(req: RecommendRequest):
    """
    Pure algorithmic recommendation engine — no Gemini.
    Step 1: Hard filters (budget → body type → brand).
    Step 2: Weighted multi-factor scoring.
    Step 3: Return top 3 (top_pick + 2 alternatives).
    """
    # --- Step 1: Hard Filters ---
    filtered_cars = apply_hard_filters(CARS_DB, req)

    if len(filtered_cars) < 1:
        raise HTTPException(
            status_code=400,
            detail="No cars match your filters. Try relaxing your brand or body type preference."
        )

    # --- Step 2: Score every remaining car ---
    scored: list[tuple[dict, float, ScoreBreakdown]] = []
    for car in filtered_cars:
        final_score, breakdown = score_car(car, req)
        scored.append((car, final_score, breakdown))

    # Sort descending by final score
    scored.sort(key=lambda x: x[1], reverse=True)

    # --- Step 3: Pick top 3 ---
    top_3 = scored[:3]

    def build_car_result(car: dict, final_score: float, breakdown: ScoreBreakdown) -> CarResult:
        return CarResult(
            id=car["id"],
            brand=car["brand"],
            model=car["model"],
            variant=car["variant"],
            body_type=car["body_type"],
            price_lakhs=car["price_lakhs"],
            seating_capacity=car["seating_capacity"],
            fuel_type=car["fuel_type"],
            power_bhp=car["power_bhp"],
            fuel_efficiency_kmpl=car["fuel_efficiency_kmpl"],
            scores=car["scores"],
            final_score=final_score,
            score_breakdown=breakdown,
        )

    # Build alternatives (ranks 2 & 3)
    alternatives_raw = top_3[1:]
    alt_cars = [a[0] for a in alternatives_raw]
    alternatives_result = [
        build_car_result(car, fs, bd) for (car, fs, bd) in alternatives_raw
    ]

    # Build top_pick with gains & tradeoffs
    tp_car, tp_score, tp_breakdown = top_3[0]
    gains, tradeoffs = build_gains_tradeoffs(tp_car, alt_cars)

    top_pick_result = TopPickResult(
        id=tp_car["id"],
        brand=tp_car["brand"],
        model=tp_car["model"],
        variant=tp_car["variant"],
        body_type=tp_car["body_type"],
        price_lakhs=tp_car["price_lakhs"],
        seating_capacity=tp_car["seating_capacity"],
        fuel_type=tp_car["fuel_type"],
        power_bhp=tp_car["power_bhp"],
        fuel_efficiency_kmpl=tp_car["fuel_efficiency_kmpl"],
        scores=tp_car["scores"],
        final_score=tp_score,
        score_breakdown=tp_breakdown,
        gains=gains,
        tradeoffs=tradeoffs,
    )

    return RecommendResponse(
        top_pick=top_pick_result,
        alternatives=alternatives_result,
        user_preferences=req,
    )


@app.post("/explain", response_model=ExplainResponse, tags=["AI Adviser"])
def explain(req: ExplainRequest):
    """
    Call Gemini to generate a concise, specific explanation of why the top pick
    is the best match for the user's preferences.
    """
    prompt = (
        "You are a friendly but sharp car buying adviser.\n\n"
        f"User preferences:\n{json.dumps(req.user_preferences, indent=2)}\n\n"
        f"Top recommended car:\n{json.dumps(req.top_pick, indent=2)}\n\n"
        f"Alternatives:\n{json.dumps(req.alternatives, indent=2)}\n\n"
        "Based on the above, explain in 3-4 lines why the top pick is the best match. "
        "Be specific, reference actual scores and user priorities. "
        "No fluff, no filler. Plain English. "
        "Respond in plain text only. No markdown, no asterisks, no bold, no bullet points, no headers. Write in flowing sentences only."
    )
    explanation = call_gemini(prompt)
    return ExplainResponse(explanation=explanation)


@app.post("/why-not", response_model=WhyNotResponse, tags=["AI Adviser"])
def why_not(req: WhyNotRequest):
    """
    Call Gemini to explain why a specific car ranked lower than the top pick,
    and identify what type of buyer it would suit.
    """
    prompt = (
        "You are a sharp car buying adviser.\n\n"
        f"User preferences:\n{json.dumps(req.user_preferences, indent=2)}\n\n"
        f"Top pick:\n{json.dumps(req.top_pick, indent=2)}\n\n"
        f"Car being questioned:\n{json.dumps(req.rejected_car, indent=2)}\n\n"
        "In 2-3 lines, explain why this car ranked lower than the top pick given these user preferences. "
        "Be specific about the trade-offs. "
        "Then in 1 line, describe what type of buyer should still consider this car. "
        "Respond in plain text only. No markdown, no asterisks, no bold, no bullet points, no headers. Write in flowing sentences only."
    )
    explanation = call_gemini(prompt)
    return WhyNotResponse(explanation=explanation)


# ---------------------------------------------------------------------------
# Local dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
