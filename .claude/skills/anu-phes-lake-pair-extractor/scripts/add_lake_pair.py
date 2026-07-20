#!/usr/bin/env python3
"""
Validate an extracted lake-pair record and append it to an atlas data file.

The atlas data files are plain `HB.Data.<name> = [ … ];` JS arrays of object
literals (js/data/anuBluefield<Region>.js, js/data/mineVoids.js). This helper
takes a JSON record, validates/derives the required fields, formats it as a JS
object literal, and inserts it just before the array's closing `];`.

Usage:
    python3 add_lake_pair.py --file js/data/anuBluefieldRomania.js --record pair.json
    echo '{...}' | python3 add_lake_pair.py --file js/data/mineVoids.js --record -

Add --dry-run to print the formatted block without writing.

After writing, bump the corresponding `?v=` cache-buster on the <script> tag in
index.html (the app is cache-versioned) and reload to validate on the map.
"""
from __future__ import annotations

import argparse
import json
import re
import sys

BLUEFIELD_REQUIRED = ["id", "tier", "name", "country", "region", "lat", "lng",
                      "head_m", "separation_km", "energy_gwh", "configuration"]
MINEVOID_REQUIRED = ["id", "name", "country", "region", "lat", "lng",
                     "head_m", "capacity_mw", "storage_mwh"]

STORAGE_HOURS = {"2GWh": 6, "5GWh": 18, "15GWh": 18, "50GWh": 50, "150GWh": 168}


def _load(path: str) -> dict:
    text = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
    return json.loads(text)


def _is_minevoid(record: dict, target: str) -> bool:
    return "mineVoids" in target or "mine_type" in record or "upper_pit_elevation_m" in record


def _derive_bluefield(r: dict) -> dict:
    """Fill derived fields consistent with existing records."""
    hours = STORAGE_HOURS.get(r.get("tier"))
    if r.get("storage_mwh") is None and r.get("energy_gwh") is not None:
        r["storage_mwh"] = int(round(r["energy_gwh"] * 1000))
    if r.get("capacity_mw") is None and r.get("energy_gwh") is not None and hours:
        r["capacity_mw"] = int(round(r["energy_gwh"] * 1000 / hours))
    r.setdefault("configuration", "lake_pair")
    r.setdefault("status", "anu_bluefield")
    r.setdefault("source_url", "https://re100.eng.anu.edu.au/global/")
    r.setdefault("isdam", False)
    for k in ("class", "volume_gl", "water_rock_ratio", "dam_volume_mm3",
              "reservoir_area_ha", "energy_cost_usd_mwh", "power_cost_usd_kw", "wfs_fid"):
        r.setdefault(k, None)
    if not r.get("description"):
        cls = r.get("class") or "?"
        r["description"] = (
            f"ANU Bluefield Class {cls} {r.get('tier','')}. "
            f"Head {r['head_m']}m, separation {r['separation_km']}km."
        )
    return r


def _validate(record: dict, required: list[str]) -> list[str]:
    return [f for f in required if record.get(f) in (None, "")]


def _js_value(v) -> str:
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return json.dumps(v)
    return json.dumps(str(v), ensure_ascii=False)


def _format_object(record: dict, indent: str = "  ") -> str:
    lines = [indent + "{"]
    items = list(record.items())
    for i, (k, v) in enumerate(items):
        comma = "," if i < len(items) - 1 else ""
        lines.append(f'{indent}  "{k}": {_js_value(v)}{comma}')
    lines.append(indent + "}")
    return "\n".join(lines)


def _insert(js_path: str, block: str) -> None:
    with open(js_path, encoding="utf-8") as fh:
        lines = fh.readlines()

    # Find the last line that is exactly the array closer `];`
    close_idx = None
    for i in range(len(lines) - 1, -1, -1):
        if lines[i].rstrip("\n").strip() == "];":
            close_idx = i
            break
    if close_idx is None:
        raise SystemExit(f"Could not find array closer '];' in {js_path}")

    # Ensure the previous object ends with a comma.
    j = close_idx - 1
    while j >= 0 and lines[j].strip() == "":
        j -= 1
    if j >= 0 and lines[j].rstrip("\n").rstrip().endswith("}"):
        lines[j] = lines[j].rstrip("\n").rstrip() + ",\n"

    new_lines = lines[:close_idx] + [block + "\n"] + lines[close_idx:]
    with open(js_path, "w", encoding="utf-8") as fh:
        fh.writelines(new_lines)


def _main() -> None:
    ap = argparse.ArgumentParser(description="Append a lake-pair record to an atlas JS data file")
    ap.add_argument("--file", required=True, help="Target js/data/*.js file")
    ap.add_argument("--record", required=True, help="JSON record file, or '-' for stdin")
    ap.add_argument("--dry-run", action="store_true", help="Print block, do not write")
    args = ap.parse_args()

    record = _load(args.record)
    minevoid = _is_minevoid(record, args.file)
    if not minevoid:
        record = _derive_bluefield(record)

    missing = _validate(record, MINEVOID_REQUIRED if minevoid else BLUEFIELD_REQUIRED)
    if missing:
        raise SystemExit(f"Missing required fields: {', '.join(missing)}")

    block = _format_object(record)
    if args.dry_run:
        print(block)
        return

    _insert(args.file, block)
    print(f"Inserted '{record['id']}' into {args.file}")
    print("Next: bump the ?v= cache version for this file in index.html and reload the map.")


if __name__ == "__main__":
    _main()
