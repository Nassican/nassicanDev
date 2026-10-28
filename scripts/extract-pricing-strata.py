"""Reproduce the six Bogotá rows from the verified SDM PDF; no extrapolation."""
import argparse
import hashlib
import json
import re
from pathlib import Path

import pymupdf

parser = argparse.ArgumentParser()
parser.add_argument("pdf", type=Path)
parser.add_argument("--output", type=Path, default=Path(__file__).parent / "data/pricing-bogota-strata.json")
args = parser.parse_args()
study = json.loads((Path(__file__).parent / "data/pricing-bogota-strata.json").read_text(encoding="utf-8"))
pdf = pymupdf.open(args.pdf)
assert len(pdf) == 19
assert "2024" in pdf[9].get_text() and "2021" in pdf[10].get_text()
rows = []
for page_number in (10, 11):
    text = pdf[page_number - 1].get_text()
    for match in re.finditer(r"(?m)^\s*([1-6])\s*\n\s*[\d.]+\s*\n\s*[\d,]+%\s*\n\s*\$\s*([\d.]+)", text):
        rows.append({"stratum": int(match[1]), "income": int(match[2].replace(".", "")), "page": page_number})
assert [row["stratum"] for row in rows] == list(range(1, 7))
assert all(row["income"] > 0 for row in rows)
study["strata"] = rows
study["sha256"] = hashlib.sha256(args.pdf.read_bytes()).hexdigest()
args.output.write_text(json.dumps(study, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Verified six rows from SDM table 4, pages 10–11: {args.output}")
