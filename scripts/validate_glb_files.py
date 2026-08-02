#!/usr/bin/env python3
"""
Validate GLB files in client/public/models/

Checks:
1. All expected GLB files exist
2. Files are valid GLB format (basic binary header check)
3. Reports file sizes for bundle analysis

Usage:
    python3 scripts/validate_glb_files.py
"""
import json
import struct
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODELS_DIR = PROJECT_ROOT / "client" / "public" / "models"
ASSETS_DIR = PROJECT_ROOT / "client" / "src" / "assets" / "solar"

def get_expected_models():
    """Extract model names from asset JSON files."""
    models = []
    for asset_file in sorted(ASSETS_DIR.glob("*.glb.asset.json")):
        with open(asset_file) as f:
            data = json.load(f)
            url = data.get("url", "")
            if url.startswith("/models/"):
                model_name = url.replace("/models/", "").replace(".glb", "")
                models.append(model_name)
    return models

def validate_glb(filepath):
    """Validate GLB binary header.
    
    GLB format: https://github.com/KhronosGroup/glTF/tree/main/specification/2.0
    - First 4 bytes: magic number 0x46546C67 (glTF)
    - Next 4 bytes: version (should be 2)
    - Next 4 bytes: total file length
    """
    try:
        with open(filepath, "rb") as f:
            header = f.read(12)
            if len(header) < 12:
                return False, "File too small"
            
            magic, version, length = struct.unpack("<III", header)
            
            if magic != 0x46546C67:
                return False, f"Invalid magic: {hex(magic)}"
            if version != 2:
                return False, f"Unsupported version: {version}"
            if length != filepath.stat().st_size:
                return False, f"Length mismatch: header={length}, file={filepath.stat().st_size}"
            
            return True, None
    except Exception as e:
        return False, str(e)

def format_size(size):
    """Format file size in human-readable form."""
    for unit in ["B", "KB", "MB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} GB"

def main():
    print("GLB File Validation")
    print("=" * 70)
    
    expected_models = get_expected_models()
    print(f"Expected models: {len(expected_models)}")
    
    # Check for GLB files in models directory
    existing_glbs = {f.stem for f in MODELS_DIR.glob("*.glb")}
    print(f"Existing GLB files: {len(existing_glbs)}")
    
    missing = set(expected_models) - existing_glbs
    extra = existing_glbs - set(expected_models)
    
    print()
    
    # Validate each expected model
    valid_count = 0
    invalid_count = 0
    total_size = 0
    
    print(f"{'Model':<25} {'Size':>10} {'Status':<15}")
    print("-" * 70)
    
    for model in sorted(expected_models):
        filepath = MODELS_DIR / f"{model}.glb"
        
        if not filepath.exists():
            print(f"{model:<25} {'MISSING':>10} {'✗ NOT FOUND':<15}")
            invalid_count += 1
            continue
        
        size = filepath.stat().st_size
        total_size += size
        
        is_valid, error = validate_glb(filepath)
        
        if is_valid:
            print(f"{model:<25} {format_size(size):>10} {'✓ Valid':<15}")
            valid_count += 1
        else:
            print(f"{model:<25} {format_size(size):>10} {'✗ INVALID':<15} {error}")
            invalid_count += 1
    
    # Report extra files
    if extra:
        print()
        print("Extra GLB files (not in asset JSONs):")
        for model in sorted(extra):
            filepath = MODELS_DIR / f"{model}.glb"
            size = filepath.stat().st_size
            total_size += size
            print(f"  {model}: {format_size(size)}")
    
    # Summary
    print()
    print("=" * 70)
    print(f"Total: {valid_count} valid, {invalid_count} invalid, {len(missing)} missing")
    print(f"Total size: {format_size(total_size)}")
    
    if missing:
        print(f"\nMissing models: {', '.join(sorted(missing))}")
    
    if invalid_count > 0:
        sys.exit(1)
    
    print("\n✓ All GLB files are valid")
    sys.exit(0)

if __name__ == "__main__":
    main()
