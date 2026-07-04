#!/usr/bin/env python3
"""
validate_taxonomy.py

Validates all JSON files in the /data directory against the taxonomy.schema.json.
Exits with non-zero code if any validation fails.
"""

import json
import sys
from pathlib import Path
from jsonschema import validate, ValidationError, SchemaError


def load_schema(schema_path: Path) -> dict:
    """Load and return the JSON schema."""
    try:
        with open(schema_path, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"ERROR: Schema file not found at {schema_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in schema file: {e}")
        sys.exit(1)


def validate_file(file_path: Path, schema: dict) -> tuple[bool, list[str]]:
    """Validate a single JSON file against the schema. Returns (success, errors)."""
    try:
        with open(file_path, "r") as f:
            data = json.load(f)
    except FileNotFoundError:
        return False, [f"File not found: {file_path}"]
    except json.JSONDecodeError as e:
        return False, [f"Invalid JSON: {e}"]

    errors = []
    try:
        validate(instance=data, schema=schema)
        return True, []
    except ValidationError as e:
        # Collect all validation errors
        for err in e.context:
            errors.append(f"  - {err.message} (path: {' -> '.join(str(p) for p in err.path)})")
        if not errors:
            errors.append(f"  - {e.message} (path: {' -> '.join(str(p) for p in e.path)})")
        return False, errors
    except SchemaError as e:
        return False, [f"Schema error: {e.message}"]


def main():
    schema_path = Path(__file__).parent / "taxonomy.schema.json"
    data_dir = Path(__file__).parent / "data"

    if not data_dir.exists():
        print(f"ERROR: Data directory not found at {data_dir}")
        sys.exit(1)

    schema = load_schema(schema_path)

    json_files = list(data_dir.glob("*.json"))

    if not json_files:
        print("WARNING: No JSON files found in data directory")
        sys.exit(0)

    print(f"Found {len(json_files)} JSON file(s) to validate\n")

    # Skip ai_cache.json — stored as object, not taxonomy array
    json_files = [f for f in json_files if f.name != "ai_cache.json"]

    all_passed = True
    for json_file in sorted(json_files):
        print(f"Validating: {json_file.name}")
        success, errors = validate_file(json_file, schema)

        if success:
            print("  Status: SUCCESS")
        else:
            print("  Status: FAILURE")
            for err in errors:
                print(err)
            all_passed = False
        print()

    if all_passed:
        print("All files passed validation!")
        sys.exit(0)
    else:
        print("Validation failed!")
        sys.exit(1)


if __name__ == "__main__":
    main()