"""
Discovery recommendation service
Recommends similar celestial objects based on feature similarity
"""
import argparse
import sys
import numpy as np
import pandas as pd
from pathlib import Path
from predict import CelestialPredictor

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def cosine_similarity(a, b):
    dot = sum(ax * bx for ax, bx in zip(a, b))
    na = sum(ax * ax for ax in a) ** 0.5
    nb = sum(bx * bx for bx in b) ** 0.5
    return dot / (na * nb) if na and nb else 0


def recommend(objects, query_idx, top_k=3):
    results = []
    query = objects[query_idx]
    for i, obj in enumerate(objects):
        if i == query_idx:
            continue
        sim = cosine_similarity(query, obj)
        results.append((i, sim))
    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_k]


def main():
    parser = argparse.ArgumentParser(description="Recommend similar celestial objects")
    parser.add_argument("--dataset", default=None, help="Path to CSV with features")
    parser.add_argument("--object-idx", type=int, default=0, help="Index of object to match")
    parser.add_argument("--features", nargs=11, type=float, metavar=("F1", "F2", "F3"),
                        help="Query features: all 11 features (see FEATURES in predict.py)")
    parser.add_argument("--top-k", type=int, default=3, help="Number of recommendations")
    parser.add_argument("--model", default=None, help="Path to .pkl model (for classification)")
    parser.add_argument("--debug", action="store_true", help="Verbose output")
    args = parser.parse_args()

    if args.features:
        query = list(args.features)
        names = ["Query"]
        objects = [query]
        labels = {0: "query"}
    elif args.dataset:
        from predict import FEATURES
        df = pd.read_csv(args.dataset)
        features = FEATURES
        missing = [c for c in features if c not in df.columns]
        if missing:
            print(f"Missing columns: {missing}", file=sys.stderr)
            sys.exit(1)
        objects = df[features].values.tolist()
        names = df.get("type", df.index).tolist()
        labels = {i: names[i] for i in range(len(names))}
        if args.object_idx >= len(objects):
            print(f"Index {args.object_idx} out of range (max {len(objects)-1})", file=sys.stderr)
            sys.exit(1)
        query = objects[args.object_idx]
        print(f"Finding matches for: {names[args.object_idx]}", file=sys.stderr)
    else:
        print("Provide --features or --dataset", file=sys.stderr)
        sys.exit(1)

    recs = recommend(objects, objects.index(query) if args.features else args.object_idx, args.top_k)

    print(f"{'Rank':<6} {'Name':<20} {'Similarity':<10}")
    print("-" * 36)
    for rank, (idx, sim) in enumerate(recs, 1):
        print(f"{rank:<6} {str(labels.get(idx, idx)):<20} {sim:<10.4f}")

    if args.model:
        predictor = CelestialPredictor(args.model)
        if predictor.model:
            pred = predictor.predict(*query)
            print(f"\nQuery classification: {pred}")
            if args.debug:
                probs = predictor.predict_proba(*query)
                if probs is not None:
                    for cls, p in zip(predictor.classes_(), probs):
                        print(f"  {cls}: {p:.3f}")


if __name__ == "__main__":
    main()
