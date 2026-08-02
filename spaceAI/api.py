"""
SpaceAI FastAPI microservice.
GET /                 HTML dashboard (precomputed classifications, corrections, dataset stats)
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
from fastapi.responses import HTMLResponse
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


def _dataset_stats() -> tuple[list[dict], int]:
    """Row counts per dataset CSV + size of the pending-corrections queue."""
    stats = []
    for path in sorted(Path(__file__).parent.glob("data/*.csv")):
        try:
            with path.open("r", encoding="utf-8") as fh:
                rows = sum(1 for _ in fh) - 1
        except OSError:
            rows = 0
        stats.append({"name": path.name, "rows": max(rows, 0)})
    pending = 0
    if PENDING_CORRECTIONS_PATH.exists():
        try:
            pending = len(json.loads(PENDING_CORRECTIONS_PATH.read_text("utf-8")))
        except (json.JSONDecodeError, OSError):
            pending = 0
    return stats, pending


def _corrections_count() -> int:
    try:
        from src.database import Correction as CorrectionModel, get_session, init_db
        init_db()
        with get_session() as session:
            return session.query(CorrectionModel).count()
    except Exception:
        return 0


_DASHBOARD_TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SpaceAI Dashboard</title>
<style>
:root{--bg:#0b1020;--card:#131a2e;--line:#232c46;--text:#e6ebf5;--muted:#8b96b3;--accent:#4fc3f7;--ok:#66bb6a;--warn:#ffb74d;}
*{box-sizing:border-box}
body{margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--bg);color:var(--text)}
header{padding:18px 24px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:16px;flex-wrap:wrap}
header h1{margin:0;font-size:18px;letter-spacing:.5px}
header .sub{color:var(--muted);font-size:12px;font-weight:400}
.pill{font-size:11px;padding:2px 10px;border-radius:10px;border:1px solid var(--line);color:var(--muted)}
a.pill{text-decoration:none;color:var(--accent)}
main{max-width:1100px;margin:0 auto;padding:20px 24px 60px;display:grid;gap:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px 16px}
.card h2{margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
th{color:var(--muted);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
tr:last-child td{border-bottom:none}
.type{color:var(--accent);font-weight:600}
.badge{font-size:10.5px;padding:1px 7px;border-radius:9px}
.badge.ok{background:rgba(102,187,106,.15);color:var(--ok)}
.badge.warn{background:rgba(255,183,77,.15);color:var(--warn)}
.bar{width:80px;height:5px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;display:inline-block;vertical-align:middle;margin-right:8px}
.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--accent),#7c4dff)}
a{color:var(--accent);text-decoration:none}
.empty{color:var(--muted);text-align:center;padding:14px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}
.stat b{display:block;font-size:22px}
.stat span{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
code{background:rgba(255,255,255,.06);padding:1px 5px;border-radius:4px;font-size:11.5px}
footer{padding:14px 24px;color:var(--muted);font-size:11px;border-top:1px solid var(--line)}
</style>
</head>
<body>
<header>
  <h1>SpaceAI <span class="sub">celestial classification microservice</span></h1>
  <span class="pill">model: __MODEL__</span>
  <span class="pill">cached bodies: <b id="cacheCount">0</b></span>
  <span class="pill">corrections: <b id="corrTotal">__CORR_TOTAL__</b></span>
  <a class="pill" href="/docs">OpenAPI /docs</a>
</header>
<main>
  <section>
    <h2 style="color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:1px;margin:0 0 10px">Dataset</h2>
    <div class="stats">__STATS__</div>
  </section>
  <section class="card">
    <h2>Precomputed classifications</h2>
    <table><thead><tr><th>Body</th><th>Classification</th><th>Confidence</th><th>Uncertainty</th><th>Top alternatives</th></tr></thead>
    <tbody id="precomp"></tbody></table>
  </section>
  <section class="card">
    <h2>User corrections (live)</h2>
    <table><thead><tr><th>ID</th><th>Body</th><th>Predicted → Corrected</th><th>Uncertainty</th><th>Source</th><th>When</th></tr></thead>
    <tbody id="corr"></tbody></table>
  </section>
  <section class="card">
    <h2>API reference</h2>
    <table><thead><tr><th>Method</th><th>Path</th><th>Purpose</th></tr></thead>
    <tbody>__ENDPOINTS__</tbody></table>
    <p style="margin:10px 0 0;color:var(--muted);font-size:11.5px">Interactive forms, schemas and try-it buttons: <a href="/docs">/docs</a></p>
  </section>
</main>
<footer>SpaceAI · Express on :5000 proxies inference from its merged cache — FastAPI is the training / retraining service. Dashboard refreshes every 5s.</footer>
<script>
const DATA = __DATA__;
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function pct(v){return Math.round((v||0)*100)+'%';}
function badge(u){return u>=0.4 ? '<span class="badge warn">uncertain</span>' : '<span class="badge ok">confident</span>';}
function renderPrecomputed(map){
  var rows=Object.keys(map).map(function(id){
    var r=map[id]||{};
    var alts=(r.alternatives||[]).slice(0,2).map(function(a){return esc(a.type)+' '+Math.round((a.score||0)*100)+'%';}).join(' &middot; ');
    return '<tr><td>'+esc(id)+'</td><td class="type">'+esc(r.classification||'-')+'</td><td><span class="bar"><i style="width:'+pct(r.confidence)+'"></i></span>'+pct(r.confidence)+'</td><td>'+badge(r.uncertainty)+' '+(Math.round((r.uncertainty||0)*1000)/10)+'%</td><td>'+(alts||'&mdash;')+'</td></tr>';
  }).join('');
  document.getElementById('precomp').innerHTML=rows||'<tr><td colspan="5" class="empty">No precomputed classifications yet &mdash; classify a body or run npm run ai:train</td></tr>';
  document.getElementById('cacheCount').textContent=Object.keys(map).length;
}
function renderCorrections(list){
  var rows=list.map(function(r){
    return '<tr><td>'+esc(r.id)+'</td><td>'+esc(r.body_id)+'</td><td>'+esc(r.predicted_type)+' &rarr; '+esc(r.corrected_type)+'</td><td>'+(Math.round((r.uncertainty||0)*1000)/10)+'%</td><td>'+esc(r.source)+'</td><td>'+esc(r.created_at||'')+'</td></tr>';
  }).join('');
  document.getElementById('corr').innerHTML=rows||'<tr><td colspan="6" class="empty">No corrections yet &mdash; submit one from the solar-system app</td></tr>';
}
renderPrecomputed(DATA.precomputed||{});
renderCorrections(DATA.corrections||[]);
setInterval(function(){
  fetch('/precomputed').then(function(r){return r.json();}).then(renderPrecomputed).catch(function(){});
  fetch('/corrections?limit=20').then(function(r){return r.json();}).then(renderCorrections).catch(function(){});
},5000);
</script>
</body>
</html>
"""


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


@app.get("/", response_class=HTMLResponse)
def dashboard():
    """Self-contained HTML dashboard for the SpaceAI microservice."""
    from cache import get_all
    try:
        precomputed = get_all()
    except Exception:
        precomputed = {}

    corrections = list_corrections(limit=20)
    stats, pending = _dataset_stats()

    data_json = json.dumps(
        {"precomputed": precomputed, "corrections": corrections},
        ensure_ascii=False,
    ).replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e")

    stat_cards = "".join(
        f'<div class="stat"><b>{s["rows"]:,}</b><span>{s["name"]}</span></div>'
        for s in stats
    )
    stat_cards += (
        f'<div class="stat"><b>{pending}</b><span>pending corrections</span></div>'
    )

    endpoints = [
        ("GET", "/health", "Liveness check"),
        ("GET", "/precomputed", "All cached classifications (what Express merges)"),
        ("GET", "/classify/{body_id}", "Classify a body from 11 features"),
        ("POST", "/classify/{body_id}/correct", "Submit a user correction"),
        ("GET", "/corrections", "List recent corrections"),
        ("POST", "/predict/mass", "Regression: mass prediction ± 5–95% CI"),
        ("POST", "/predict/temperature", "Regression: temperature prediction ± 5–95% CI"),
    ]
    endpoint_rows = "".join(
        f"<tr><td><code>{m}</code></td><td><code>{p}</code></td><td>{d}</td></tr>"
        for m, p, d in endpoints
    )

    model_state = "loaded" if predictor.model is not None else "not trained"
    html = (
        _DASHBOARD_TEMPLATE
        .replace("__DATA__", data_json)
        .replace("__MODEL__", model_state)
        .replace("__STATS__", stat_cards)
        .replace("__ENDPOINTS__", endpoint_rows)
        .replace("__CORR_TOTAL__", str(_corrections_count()))
    )
    return HTMLResponse(html)
