import os
from pathlib import Path

DATABASE_URL: str = (
    os.environ.get("SPACEAI_DATABASE_URL")
    or os.environ.get("DATABASE_URL")
    or f"sqlite:///{Path(__file__).resolve().parent.parent / 'data' / 'spaceai.db'}"
)
