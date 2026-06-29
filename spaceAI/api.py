"""
SpaceAI FastAPI microservice.
GET /health
GET /classify/{body_id}?orbital_period=&axial_tilt=&mass=&radius=&eccentricity=
Returns AIAnalysis JSON matching the TypeScript AIAnalysis type.
"""
from pathlib import Path
from typing import List
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import sys
sys.path.insert(0, str(Path(__file__).parent / "src"))
from predict import CelestialPredictor, FEATURES

DATA_PATH = Path(__file__).parent / "data" / "celestial_objects.csv"

app = FastAPI(title="SpaceAI")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

predictor = CelestialPredictor()
_df = pd.read_csv(DATA_PATH).fillna(0)
_feature_matrix = _df[FEATURES].values.astype(float)
_names = _df["name"].tolist()


class Alternative(BaseModel):
    type: str
    score: float

class Feature(BaseModel):
    name: str
    value: float
    importance: float

class SimilarObject(BaseModel):
    bodyId: str
    similarity: float

class AIAnalysis(BaseModel):
    classification: str
    confidence: float
    alternatives: List[Alternative]
    features: List[Feature]
    similarObjects: List[SimilarObject]


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/classify/{body_id}", response_model=AIAnalysis)
def classify(
    body_id: str,
    orbital_period: float = Query(...),
    axial_tilt: float = Query(...),
    mass: float = Query(...),
    radius: float = Query(...),
    eccentricity: float = Query(...),
):
    if predictor.model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Run train_model.py first.")

    proba = predictor.predict_proba(orbital_period, axial_tilt, mass, radius, eccentricity)
    classes = predictor.classes_()
    importances = predictor.feature_importances() or [0.0] * len(FEATURES)

    sorted_idx = np.argsort(proba)[::-1]
    classification = classes[sorted_idx[0]]
    confidence = float(proba[sorted_idx[0]])

    alternatives = [
        Alternative(type=classes[i], score=float(proba[i]))
        for i in sorted_idx[1:4]
    ]

    features = [
        Feature(name=name, value=val, importance=imp)
        for name, val, imp in zip(
            FEATURES,
            [orbital_period, axial_tilt, mass, radius, eccentricity],
            importances,
        )
    ]

    query_vec = np.array([orbital_period, axial_tilt, mass, radius, eccentricity], dtype=float)
    sims = [
        (_names[i].lower().replace(" ", "_"), _cosine_sim(query_vec, _feature_matrix[i]))
        for i in range(len(_names))
        if _names[i].lower() != body_id.lower()
    ]
    sims.sort(key=lambda x: x[1], reverse=True)
    similar_objects = [
        SimilarObject(bodyId=bid, similarity=round(sim, 4))
        for bid, sim in sims[:3]
    ]

    return AIAnalysis(
        classification=classification,
        confidence=confidence,
        alternatives=alternatives,
        features=features,
        similarObjects=similar_objects,
    )
