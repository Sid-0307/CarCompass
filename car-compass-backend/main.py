"""
Car Compass Backend — AI-native Indian car recommendation API
FastAPI + Gemini + cars.json local database
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
    cars = data if isinstance(data, list) else data.get("cars", [])
    return cars


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
    budget_min_lakhs: float = Field(default=0, ge=0, description="Minimum budget in lakhs")
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


class RecommendResponse(BaseModel):
    top_pick: CarResult
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

# Priority weights for ranked list (positions 1–4)
# Position 1 carries 4x the weight of position 4
PRIORITY_WEIGHTS = [0.40, 0.30, 0.20, 0.10]

# Final score component weights
# Budget and body type are already hard filters — lower soft weights to avoid double-counting
# Priority and usage carry the real differentiation
WEIGHT_PRIORITY  = 0.45
WEIGHT_USAGE     = 0.25
WEIGHT_FAMILY    = 0.15
WEIGHT_BUDGET    = 0.10
WEIGHT_BODY_TYPE = 0.05

VALID_SCORE_KEYS = {
    "safety", "mileage", "features", "performance",
    "family_comfort", "city_drivability", "highway_drivability"
}


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


def compute_budget_score(car: dict, budget_min: float, budget_max: float) -> float:
    """
    Reward cars well within the budget range (score out of 10).
    Cars closer to the middle of the range score highest.
    Cars at the edges score lower but still pass (they survived the hard filter).
    """
    price = car["price_lakhs"]
    budget_range = budget_max - budget_min
    if budget_range <= 0:
        return 10.0
    # Score based on how well the price fits within the range
    # Ideal = middle of the range, scores 10
    midpoint = (budget_min + budget_max) / 2
    distance_from_mid = abs(price - midpoint)
    max_distance = budget_range / 2
    score = 10.0 * (1 - (distance_from_mid / max_distance))
    return max(0.0, min(score, 10.0))


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
    bs  = compute_budget_score(car, req.budget_min_lakhs, req.budget_lakhs)
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
    1. Remove cars outside the budget range (min to max).
    2. Filter to matching body type (unless no_preference).
    3. Filter to preferred brands (unless empty).
    4. If fewer than 3 remain, progressively relax: brands first, then body type.
    """
    # Budget filter — both floor and ceiling (non-relaxable)
    budget_filtered = [
        c for c in cars
        if c["price_lakhs"] <= req.budget_lakhs
        and c["price_lakhs"] >= req.budget_min_lakhs
    ]

    # Normalise inputs for case-insensitive comparison
    requested_body = req.body_type.lower()
    preferred_brands_lower = [b.lower() for b in req.preferred_brands[:5]]

    def apply_body(pool: list[dict]) -> list[dict]:
        if requested_body == "no_preference":
            return pool
        return [c for c in pool if c["body_type"].lower() == requested_body]

    def apply_brand(pool: list[dict]) -> list[dict]:
        if not preferred_brands_lower:
            return pool
        return [c for c in pool if c["brand"].lower() in preferred_brands_lower]

    # Full filter: brand + body type
    full_filtered = apply_brand(apply_body(budget_filtered))
    if len(full_filtered) >= 3:
        return full_filtered

    # Relax brand filter, keep body type
    body_only = apply_body(budget_filtered)
    if len(body_only) >= 3:
        return body_only

    # Relax both — return everything in budget
    if len(budget_filtered) >= 1:
        return budget_filtered

    return []


# ---------------------------------------------------------------------------
# Gemini helper
# ---------------------------------------------------------------------------

GEMINI_FALLBACK = "Our adviser is unavailable right now. Here are your results."


def call_gemini(prompt: str) -> str:
    """Call Gemini and return the text response; fall back gracefully."""
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
    Step 1: Hard filters (budget range → body type → brand).
    Step 2: Weighted multi-factor scoring.
    Step 3: Return top 3 (top_pick + 2 alternatives).
    """
    # Step 1: Hard Filters
    filtered_cars = apply_hard_filters(CARS_DB, req)

    if len(filtered_cars) < 1:
        raise HTTPException(
            status_code=400,
            detail="No cars match your filters. Try relaxing your brand or body type preference."
        )

    # Step 2: Score every remaining car
    scored: list[tuple[dict, float, ScoreBreakdown]] = []
    for car in filtered_cars:
        final_score, breakdown = score_car(car, req)
        scored.append((car, final_score, breakdown))

    # Sort descending by final score
    scored.sort(key=lambda x: x[1], reverse=True)

    # Step 3: Pick top 3
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

    top_pick_result = build_car_result(*top_3[0])
    alternatives_result = [build_car_result(*t) for t in top_3[1:]]

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
    prefs = req.user_preferences
    top = req.top_pick
    alts = req.alternatives

    budget_min = prefs.get("budget_min_lakhs", 0)
    budget_max = prefs.get("budget_lakhs", "")
    usage = prefs.get("primary_usage", "")
    passengers = prefs.get("passengers", "")
    priorities = prefs.get("priorities", [])
    top_scores = top.get("scores", {})

    # Build alternatives summary
    alt_summaries = ""
    for i, alt in enumerate(alts[:2], 1):
        alt_summaries += (
            f"Alternative {i}: {alt.get('brand')} {alt.get('model')} "
            f"at ₹{alt.get('price_lakhs')}L (score {alt.get('final_score')}/10). "
        )

    # /explain prompt
    prompt = (
        "You are a senior automotive journalist at a respected Indian car magazine. "
        "You write with precision and authority — factual, specific, zero fluff. "
        "Not conversational, not corporate. Sharp and readable.\n\n"
        f"Buyer profile: ₹{budget_min}L–₹{budget_max}L budget, "
        f"{usage} driving conditions, {passengers} passengers, "
        f"ranked priorities: {', '.join(priorities)} (in descending order of importance).\n\n"
        f"Top recommendation: {top.get('brand')} {top.get('model')} {top.get('variant')} "
        f"at ₹{top.get('price_lakhs')}L — match score {top.get('final_score')}/10. "
        f"Scores: safety {top_scores.get('safety')}/10, "
        f"mileage {top_scores.get('mileage')}/10, "
        f"performance {top_scores.get('performance')}/10, "
        f"features {top_scores.get('features')}/10, "
        f"city drivability {top_scores.get('city_drivability')}/10, "
        f"highway drivability {top_scores.get('highway_drivability')}/10.\n\n"
        f"Alternatives: {alt_summaries}\n\n"
        "Write exactly 3 sentences:\n"
        "Sentence 1: Where this car leads on the buyer's top two priorities — cite the actual scores "
        "and what they mean in real terms.\n"
        "Sentence 2: How it performs for this buyer's specific usage and passenger needs — "
        "use the actual drivability scores.\n"
        "Sentence 3: The one real trade-off and why it does not change the verdict given "
        "what this buyer ranked as important.\n\n"
        "Banned: no-brainer, seamless, perfect, ideal, truly, genuinely, absolutely, nails, "
        "comprehensive, well-rounded, smart investment, stands out, ticks all boxes, "
        "ownership satisfaction, dynamic responsiveness, feature density.\n"
        "Plain text only. No markdown. No asterisks."
    )
    explanation = call_gemini(prompt)
    return ExplainResponse(explanation=explanation)


@app.post("/why-not", response_model=WhyNotResponse, tags=["AI Adviser"])
def why_not(req: WhyNotRequest):
    """
    Call Gemini to explain why a specific car ranked lower than the top pick,
    and identify what type of buyer it would suit.
    """
    prefs = req.user_preferences
    top = req.top_pick
    rejected = req.rejected_car

    priorities = prefs.get("priorities", [])
    usage = prefs.get("primary_usage", "")
    budget_min = prefs.get("budget_min_lakhs", 0)
    budget_max = prefs.get("budget_lakhs", "")
    rejected_scores = rejected.get("scores", {})
    top_scores = top.get("scores", {})

    # /why-not prompt
    prompt = (
        "You are a senior automotive journalist at a respected Indian car magazine. "
        "You write with precision and authority — factual, specific, zero fluff. "
        "Not conversational, not corporate. Sharp and readable.\n\n"
        f"Buyer profile: ₹{budget_min}L–₹{budget_max}L budget, "
        f"{usage} driving conditions, "
        f"ranked priorities: {', '.join(priorities)} (in descending order of importance).\n\n"
        f"Top pick: {top.get('brand')} {top.get('model')} {top.get('variant')} "
        f"(₹{top.get('price_lakhs')}L, match score {top.get('final_score')}/10) — "
        f"safety {top_scores.get('safety')}/10, "
        f"mileage {top_scores.get('mileage')}/10, "
        f"performance {top_scores.get('performance')}/10, "
        f"features {top_scores.get('features')}/10, "
        f"city {top_scores.get('city_drivability')}/10, "
        f"highway {top_scores.get('highway_drivability')}/10.\n\n"
        f"Car under review: {rejected.get('brand')} {rejected.get('model')} {rejected.get('variant')} "
        f"(₹{rejected.get('price_lakhs')}L, match score {rejected.get('final_score')}/10) — "
        f"safety {rejected_scores.get('safety')}/10, "
        f"mileage {rejected_scores.get('mileage')}/10, "
        f"performance {rejected_scores.get('performance')}/10, "
        f"features {rejected_scores.get('features')}/10, "
        f"city {rejected_scores.get('city_drivability')}/10, "
        f"highway {rejected_scores.get('highway_drivability')}/10.\n\n"
        "Write exactly 3 sentences:\n"
        "Sentence 1: Where this car scores lower than the top pick on the buyer's highest-ranked "
        "priorities — cite the actual score gap, not vague adjectives.\n"
        "Sentence 2: What that gap means specifically for this buyer's usage and requirements — "
        "one concrete real-world consequence.\n"
        "Sentence 3: The specific buyer this car would suit better — describe them in one line "
        "with a concrete reason, not a generic profile.\n\n"
        "Banned: falls short, lacks, unfortunately, however that said, despite, compromises, "
        "perfect for, ideal for, great option, ownership satisfaction, dynamic responsiveness, "
        "feature density, perception of robustness.\n"
        "Plain text only. No markdown. No asterisks."
        "Do not infer characteristics not present in the scores provided. "
        "Only reference attributes that have explicit scores in the data above."
    )

    explanation = call_gemini(prompt)
    return WhyNotResponse(explanation=explanation)


# ---------------------------------------------------------------------------
# Local dev entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)