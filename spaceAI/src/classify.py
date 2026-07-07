"""
Thin shim — delegates to `python run.py classify`.

This file is kept for backwards compatibility. New code should use:
    python run.py classify [--dataset ...] [--output ...]
"""
import subprocess
import sys
from pathlib import Path

if __name__ == "__main__":
    run_py = Path(__file__).resolve().parent.parent / "run.py"
    sys.exit(subprocess.call([sys.executable, str(run_py), "classify"] + sys.argv[1:]))
