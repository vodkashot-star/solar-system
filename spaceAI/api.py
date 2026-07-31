"""
SpaceAI FastAPI microservice.
GET /health
GET /classify/{body_id}?orbital_period=&axial_tilt=&mass=&radius=&eccentricity=
GET /precomputed
Returns AIAnalysis JSON matching the TypeScript AIAnalysis type.
"""
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Dict, List
import json
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import sys
sys.path.insert(0, str(Path(__file__).parent / "src"))
from predict import CelestialPredictor, FEATURES

DATA_PATH = Path(__file__).parent / "data" / "celestial_objects.csv"

# CSV names → frontend body ids (bodies.ts). CSV rows use display names that
# don't match the app's kebab-case ids, which breaks "Similar bodies" clicks.
CSV_NAME_TO_BODY_ID = {
    "apollo lunar module": "apollo-lm",
    "apollolm": "apollo-lm",
    "newhorizons": "new-horizons",
    "junospacecraft": "juno-spacecraft",
    "voyager2": "voyager-2",
    "voyager": "voyager",
    "1i/'oumuamua": "oumuamua",
    "2i/borisov": "borisov",
    "67p/churyumov-gerasimenko": "churyumov",
    "9p/tempel 1": "tempel1",
    "81p/wild 2": "wild2",
}


def _csv_name_to_body_id(name: str) -> str:
    key = name.lower().replace(" ", "")
    return CSV_NAME_TO_BODY_ID.get(key, name.lower().replace(" ", "_"))


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
    uncertainty: float = 0.0
    alternatives: List[Alternative]
    features: List[Feature]
    similarObjects: List[SimilarObject]


def _cosine_sim(a: np.ndarray, b: np.ndarray) -> float:
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


predictor = CelestialPredictor()
_df = pd.read_csv(DATA_PATH).fillna(0)
_feature_matrix = _df[FEATURES].values.astype(float)
_names = _df["name"].tolist()

# Regression models (loaded on demand)
_mass_regressor = None
_temp_regressor = None


def _load_regressor(target: str):
    import joblib
    path = Path(__file__).parent / "models" / f"{target}_regressor.pkl"
    if not path.exists():
        return None
    return joblib.load(str(path))


PENDING_CORRECTIONS_PATH = Path(__file__).parent / "data" / "pending_corrections.json"


def _drain_pending_corrections():
    """Import corrections queued by Express while this service was offline.

    Express writes Postgres (durable) and, when :8000 is unreachable, appends
    the correction to pending_corrections.json. Draining here keeps the SQLite
    retrain source in sync so no correction is orphaned.
    """
    if not PENDING_CORRECTIONS_PATH.exists():
        return
    try:
        pending = json.loads(PENDING_CORRECTIONS_PATH.read_text("utf-8"))
    except (json.JSONDecodeError, OSError) as err:
        print(f"[corrections] Failed to read pending corrections: {err}")
        return
    if not isinstance(pending, list) or not pending:
        return
    from src.database import Correction as CorrectionModel, get_session, init_db
    init_db()
    imported = 0
    with get_session() as session:
        for entry in pending:
            if not isinstance(entry, dict) or not entry.get("body_id"):
                continue
            session.add(
                CorrectionModel(
                    body_id=entry["body_id"],
                    predicted_type=entry.get("predicted_type", ""),
                    corrected_type=entry.get("corrected_type", ""),
                    features=entry.get("features", []),
                    uncertainty=entry.get("uncertainty", 0.0) or 0.0,
                    source="user",
                )
            )
            imported += 1
        session.commit()
    if imported:
        try:
            PENDING_CORRECTIONS_PATH.unlink()
        except OSError:
            pass
        print(f"[corrections] Imported {imported} queued corrections from Express")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from src.database import init_db
    init_db()
    _drain_pending_corrections()
    # precompute_all is CPU-bound — run in a thread executor so we don't block
    # the event loop during startup
    import asyncio
    from src.precompute import precompute_all
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, precompute_all)
    yield


def _predict_regression(target: str, values: list[float]) -> dict:
    from train_regression import FEATURES as REG_FEATURES
    exclude = [target] if target in REG_FEATURES else []
    feature_cols = [c for c in REG_FEATURES if c not in exclude]
    feature_vals = [v for i, v in enumerate(values) if REG_FEATURES[i] not in exclude]
    X = pd.DataFrame([feature_vals], columns=feature_cols)

    reg = _load_regressor(target)
    if reg is None:
        raise HTTPException(status_code=503, detail=f"{target} regressor not trained")
    pred = float(reg.predict(X)[0])
    n_trees = len(reg.named_steps["reg"].estimators_)
    tree_preds = [float(tree.predict(X)[0]) for tree in reg.named_steps["reg"].estimators_]
    ci = (round(float(np.percentile(tree_preds, 5)), 4),
          round(float(np.percentile(tree_preds, 95)), 4))
    return {"prediction": round(pred, 4), "confidence_interval": list(ci)}


app = FastAPI(title="SpaceAI", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/precomputed")
def get_precomputed():
    from cache import get_all
    return get_all()


class CorrectionRequest(BaseModel):
    body_id: str
    predicted_type: str
    corrected_type: str
    features: List[float]
    uncertainty: float = 0.0


class CorrectionResponse(BaseModel):
    id: int
    status: str


class PredictResponse(BaseModel):
    prediction: float
    confidence_interval: List[float]


@app.post("/classify/{body_id}/correct", response_model=CorrectionResponse)
def submit_correction(body_id: str, correction: CorrectionRequest):
    from src.database import Correction as CorrectionModel, get_session
    from src.database import init_db
    init_db()
    with get_session() as session:
        record = CorrectionModel(
            body_id=body_id,
            predicted_type=correction.predicted_type,
            corrected_type=correction.corrected_type,
            features=correction.features,
            uncertainty=correction.uncertainty if correction.uncertainty else 0.0,
            source="user",
        )
        session.add(record)
        session.commit()
        return CorrectionResponse(id=record.id, status="recorded")


@app.get("/corrections")
def list_corrections(limit: int = 50):
    from src.database import Correction as CorrectionModel, get_session
    from src.database import init_db
    init_db()
    with get_session() as session:
        rows = session.query(CorrectionModel).order_by(
            CorrectionModel.created_at.desc()
        ).limit(limit).all()
    return [
        {
            "id": r.id,
            "body_id": r.body_id,
            "predicted_type": r.predicted_type,
            "corrected_type": r.corrected_type,
            "uncertainty": r.uncertainty,
            "source": r.source,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@app.post("/predict/mass", response_model=PredictResponse)
def predict_mass(body: Dict[str, List[float]]):
    vals = (body.get("features", []) + [0] * 11)[:11]
    return _predict_regression("mass", vals)


@app.post("/predict/temperature", response_model=PredictResponse)
def predict_temperature(body: Dict[str, List[float]]):
    vals = (body.get("features", []) + [0] * 11)[:11]
    return _predict_regression("temperature", vals)


@app.get("/classify/{body_id}", response_model=AIAnalysis)
def classify(
    body_id: str,
    orbital_period: float = Query(...),
    axial_tilt: float = Query(...),
    mass: float = Query(...),
    radius: float = Query(...),
    eccentricity: float = Query(...),
    density: float = Query(0),
    gravity: float = Query(0),
    temperature: float = Query(0),
    semi_major_axis: float = Query(0),
    inclination: float = Query(0),
    rotation_period: float = Query(0),
):
    if predictor.model is None:
        raise HTTPException(status_code=503, detail="Model not loaded. Run train_model.py first.")

    proba = predictor.predict_proba(
        orbital_period, axial_tilt, mass, radius, eccentricity,
        density, gravity, temperature, semi_major_axis, inclination, rotation_period,
    )
    classes = predictor.classes_()
    importances = predictor.feature_importances() or [0.0] * len(FEATURES)

    sorted_idx = np.argsort(proba)[::-1]
    classification = classes[sorted_idx[0]]
    confidence = float(proba[sorted_idx[0]])
    uncertainty = predictor.predict_uncertainty(
        orbital_period, axial_tilt, mass, radius, eccentricity,
        density, gravity, temperature, semi_major_axis, inclination, rotation_period,
    ) or 0.0

    alternatives = [
        Alternative(type=classes[i], score=float(proba[i]))
        for i in sorted_idx[1:4]
    ]

    values = [orbital_period, axial_tilt, mass, radius, eccentricity,
              density, gravity, temperature, semi_major_axis, inclination, rotation_period]
    features = [
        Feature(name=name, value=val, importance=imp)
        for name, val, imp in zip(FEATURES, values, importances)
    ]

    query_vec = np.array(values, dtype=float)
    sims = [
        (_csv_name_to_body_id(_names[i]), _cosine_sim(query_vec, _feature_matrix[i]))
        for i in range(len(_names))
        if _names[i].lower() != body_id.lower()
    ]
    sims.sort(key=lambda x: x[1], reverse=True)
    similar_objects = [
        SimilarObject(bodyId=bid, similarity=round(sim, 4))
        for bid, sim in sims[:3]
    ]

    result = AIAnalysis(
        classification=classification,
        confidence=confidence,
        uncertainty=uncertainty,
        alternatives=alternatives,
        features=features,
        similarObjects=similar_objects,
    )

    from cache import set as cache_set
    cache_set(body_id, result.model_dump())

    return result
