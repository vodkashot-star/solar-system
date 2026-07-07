"""Override SPACEAI_DATABASE_URL before any module imports so tests use an
in-memory SQLite database. This ensures every run starts with a clean schema
(no stale columns) and never touches the real database."""
import os

os.environ["SPACEAI_DATABASE_URL"] = "sqlite:///file::memory:?cache=shared&mode=memory&uri=true"
