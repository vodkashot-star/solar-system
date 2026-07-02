"""
Augment celestial_objects.csv with additional features from frontend bodies.ts.
Adds: density, gravity, temperature, semi_major_axis, inclination, rotation_period

Run from project root: python3 spaceAI/src/augment_data.py
"""
import csv
import re
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
BODIES_TS = Path(__file__).resolve().parent.parent.parent / "client" / "src" / "components" / "solar-system" / "bodies.ts"

NEW_COLUMNS = ["density", "gravity", "temperature", "semi_major_axis", "inclination", "rotation_period"]

FIELD_MAP = {
    "density": "density",
    "gravity": "gravity",
    "temperature": "temperature",
    "semi_major_axis": "semiMajorAxis",
    "inclination": "inclination",
    "rotation_period": "rotationPeriod",
}

def extract_astronomical_data(ts_path: Path) -> dict[str, dict[str, float]]:
    """Parse ASTRONOMICAL_DATA from bodies.ts using regex."""
    text = ts_path.read_text()
    bodies: dict[str, dict[str, float]] = {}

    block_match = re.search(r"const ASTRONOMICAL_DATA.*?= \{(.*?)\};", text, re.DOTALL)
    if not block_match:
        return bodies

    block = block_match.group(1)
    body_blocks = re.findall(r"(\w+):\s*\{(.*?)\}", block, re.DOTALL)
    for name, body_text in body_blocks:
        props = {}
        for key in FIELD_MAP.values():
            m = re.search(rf"{key}:\s*(-?[\d.]+(?:e[+-]?\d+)?)", body_text)
            if m:
                props[key] = float(m.group(1))
        bodies[name] = props

    return bodies


def main():
    csv_path = DATA_DIR / "celestial_objects.csv"
    bodies = extract_astronomical_data(BODIES_TS)
    print(f"Parsed {len(bodies)} bodies from ASTRONOMICAL_DATA")

    updated = []
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["name"].strip().lower()
            if name in bodies:
                props = bodies[name]
                for col, ts_key in FIELD_MAP.items():
                    row[col] = str(props.get(ts_key, 0))
            else:
                for col in NEW_COLUMNS:
                    row[col] = "0"
            updated.append(row)

    all_cols = ["name"] + NEW_COLUMNS + [c for c in updated[0].keys() if c not in ["name"] + NEW_COLUMNS]
    # Deduplicate
    seen = set()
    ordered = []
    for c in all_cols:
        if c not in seen:
            seen.add(c)
            ordered.append(c)

    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=ordered)
        writer.writeheader()
        writer.writerows(updated)

    print(f"Augmented {csv_path} with columns: {NEW_COLUMNS}")
    for row in updated[:3]:
        print(f"  {row['name']}: { {k: row[k] for k in NEW_COLUMNS} }")


if __name__ == "__main__":
    main()
