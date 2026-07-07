#!/usr/bin/env python3
"""
Augment celestial_objects.csv with physical features from bodies.ts.

Reads ASTRONOMICAL_DATA from the frontend bodies.ts (via precompute's
parse_astronomical_data — single source of truth for parsing) and writes
the following columns into the CSV if they are missing or zero:
  density, gravity, temperature, semi_major_axis, inclination, rotation_period

Run from project root:
    python3 spaceAI/src/augment_data.py
"""
import csv
import sys
from pathlib import Path

# Reuse the brace-depth parser from precompute (no duplicate regex)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from precompute import parse_astronomical_data
from predict import FEATURES

DATA_DIR  = Path(__file__).resolve().parent.parent / "data"
BODIES_TS = Path(__file__).resolve().parent.parent.parent / "client" / "src" / "components" / "solar-system" / "bodies.ts"

# Map CSV column → index in the FEATURES list returned by parse_astronomical_data
# FEATURES = [orbital_period, axial_tilt, mass, radius, eccentricity,
#              density, gravity, temperature, semi_major_axis, inclination, rotation_period]
FEATURE_INDEX = {name: i for i, name in enumerate(FEATURES)}

AUGMENT_COLS = ["density", "gravity", "temperature", "semi_major_axis", "inclination", "rotation_period"]


def main() -> None:
    csv_path = DATA_DIR / "celestial_objects.csv"
    if not csv_path.exists():
        print(f"ERROR: {csv_path} not found", file=sys.stderr)
        sys.exit(1)

    bodies = parse_astronomical_data(BODIES_TS)
    if not bodies:
        print("ERROR: could not parse ASTRONOMICAL_DATA from bodies.ts", file=sys.stderr)
        sys.exit(1)

    print(f"Parsed {len(bodies)} bodies from ASTRONOMICAL_DATA")

    updated = []
    augmented_count = 0

    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])

        # Ensure augment columns exist in fieldnames
        for col in AUGMENT_COLS:
            if col not in fieldnames:
                fieldnames.append(col)

        for row in reader:
            name = row["name"].strip().lower()
            features = bodies.get(name)

            if features:
                changed = False
                for col in AUGMENT_COLS:
                    idx = FEATURE_INDEX.get(col)
                    if idx is not None:
                        val = str(features[idx])
                        if row.get(col, "0") in ("", "0"):
                            row[col] = val
                            changed = True
                if changed:
                    augmented_count += 1
            else:
                for col in AUGMENT_COLS:
                    if not row.get(col):
                        row[col] = "0"

            updated.append(row)

    with open(csv_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated)

    print(f"Augmented {augmented_count}/{len(updated)} rows in {csv_path}")
    for row in updated[:3]:
        print(f"  {row['name']}: { {k: row.get(k) for k in AUGMENT_COLS} }")


if __name__ == "__main__":
    main()
