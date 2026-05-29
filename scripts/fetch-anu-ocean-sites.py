#!/usr/bin/env python3
"""
ANU Ocean PHES Site Extractor — UAE & Saudi Arabia
Run this on YOUR LOCAL COMPUTER (same IP as your browser that can access re100.anu.edu.au).
Do NOT run on a cloud server — the ANU GeoServer blocks cloud IPs.

Usage:
    pip install requests
    python scripts/fetch-anu-ocean-sites.py

Output:
    anu_ocean_sites.json  — raw extracted data
    anu_ocean_UAE.js      — ready-to-paste into js/data/anuOceanUAE.js
    anu_ocean_SA.js       — ready-to-paste into js/data/anuOceanSaudiArabia.js
"""

import json
import math
import sys
import time
from xml.etree import ElementTree

try:
    import requests
except ImportError:
    print("Missing dependency. Run:  pip install requests")
    sys.exit(1)

WFS_BASE = "https://re100.anu.edu.au/geoserver/global_ocean/wfs"

TIERS = [
    {"key": "2gwh_6h",   "label": "2GWh",  "capacity_mw": 333,  "storage_h": 6,  "energy_gwh": 2},
    {"key": "5gwh_18h",  "label": "5GWh",  "capacity_mw": 278,  "storage_h": 18, "energy_gwh": 5},
    {"key": "15gwh_18h", "label": "15GWh", "capacity_mw": 833,  "storage_h": 18, "energy_gwh": 15},
    {"key": "50gwh_18h", "label": "50GWh", "capacity_mw": 2778, "storage_h": 18, "energy_gwh": 50},
]

REGIONS = [
    # name, bbox [minLng, minLat, maxLng, maxLat], country
    ("UAE — Gulf of Oman",       [55.5, 23.0, 60.5, 26.5], "UAE"),
    ("UAE — Arabian Gulf (RAK)", [54.5, 24.5, 57.5, 27.0], "UAE"),
    ("SA — Gulf of Aqaba",       [34.2, 26.0, 36.5, 30.0], "Saudi Arabia"),
    ("SA — Red Sea North",       [35.5, 23.5, 40.0, 28.5], "Saudi Arabia"),
    ("SA — Red Sea Central",     [38.5, 18.5, 43.5, 24.5], "Saudi Arabia"),
    ("SA — Red Sea South/Jizan", [41.0, 14.5, 45.0, 20.5], "Saudi Arabia"),
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
    "Accept": "application/json",
    "Referer": "https://re100.anu.edu.au/",
}


def poly_centroid(geometry):
    """Return centroid [lat, lng] of a Polygon or MultiPolygon."""
    try:
        coords = (
            geometry["coordinates"][0][0]
            if geometry["type"] == "MultiPolygon"
            else geometry["coordinates"][0]
        )
        lngs = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        return (
            round((min(lats) + max(lats)) / 2, 5),
            round((min(lngs) + max(lngs)) / 2, 5),
        )
    except Exception:
        return None, None


def parse_desc(html):
    """Parse ANU description HTML table into a dict."""
    if not html:
        return {}
    try:
        root = ElementTree.fromstring(f"<root>{html}</root>")
        d = {}
        for tr in root.iter("tr"):
            cells = list(tr.iter("td")) + list(tr.iter("th"))
            if len(cells) >= 2:
                key = (cells[0].text or "").strip().rstrip(":")
                val = (cells[1].text or "").strip()
                if key:
                    d[key] = val
        return d
    except Exception:
        return {}


def fetch_layer(tier_key, bbox):
    b0, b1, b2, b3 = bbox
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeNames": f"global_ocean:{tier_key}",
        "outputFormat": "application/json",
        "count": "500",
        "bbox": f"{b0},{b1},{b2},{b3},EPSG:4326",
    }
    resp = requests.get(WFS_BASE, params=params, headers=HEADERS, timeout=30)
    if resp.status_code == 403:
        print(
            "\n  ERROR 403 — Your IP is not allowed by the ANU GeoServer.\n"
            "  The ANU WFS is only accessible from whitelisted IPs.\n"
            "  Try running this script from the same computer you use to browse re100.anu.edu.au.\n"
        )
        sys.exit(1)
    resp.raise_for_status()
    return resp.json()


def extract_all():
    all_sites = []
    seen_ids = set()

    for tier in TIERS:
        print(f"\n── Tier: {tier['label']} ────────────────────────")
        for region_name, bbox, country in REGIONS:
            print(f"  {region_name}...", end="", flush=True)
            try:
                gj = fetch_layer(tier["key"], bbox)
                features = gj.get("features", [])

                # Upper reservoir features (isupper == '1' or 1)
                upper_feats = [
                    f for f in features
                    if not f["properties"].get("isdam")
                    and not f["properties"].get("ispipe")
                    and str(f["properties"].get("isupper", "")) in ("1", "True", "true")
                ]

                # Pipe features for lower intake coords
                pipe_feats = {
                    f["properties"].get("identifier", ""): f
                    for f in features
                    if f["properties"].get("ispipe")
                }

                new_count = 0
                for feat in upper_feats:
                    raw_id = feat["properties"].get("identifier", "")
                    if raw_id in seen_ids:
                        continue
                    seen_ids.add(raw_id)
                    new_count += 1

                    lat, lng = poly_centroid(feat["geometry"])
                    d = parse_desc(feat["properties"].get("description", ""))

                    # Try to get lower intake point from pipe geometry
                    lower_lat, lower_lng = None, None
                    if raw_id in pipe_feats:
                        try:
                            pipe_coords = pipe_feats[raw_id]["geometry"]["coordinates"]
                            last = pipe_coords[-1]
                            lower_lng = round(last[0], 5)
                            lower_lat = round(last[1], 5)
                        except Exception:
                            pass

                    def dget(*keys):
                        for k in keys:
                            if d.get(k):
                                return d[k]
                        return None

                    all_sites.append({
                        "raw_id": raw_id,
                        "tier": tier["label"],
                        "capacity_mw": tier["capacity_mw"],
                        "storage_h": tier["storage_h"],
                        "energy_gwh": tier["energy_gwh"],
                        "class": dget("Class"),
                        "country": dget("Country") or country,
                        "region": region_name,
                        "lat": lat, "lng": lng,
                        "upper_lat": lat, "upper_lng": lng,
                        "lower_lat": lower_lat, "lower_lng": lower_lng,
                        "head_m": float(dget("Head (m)", "Head") or 0) or None,
                        "separation_km": float(dget("Separation (km)", "Separation") or 0) or None,
                        "slope_pct": float(dget("Average Slope (%)", "Slope") or 0) or None,
                        "area_ha": float(dget("Area (ha)", "Area") or 0) or None,
                        "vol_gl": float(dget("Volume (GL)", "Volume") or 0) or None,
                        "wr": float(dget("Water/Rock Ratio", "Water Rock Ratio", "Water to Rock (Pair)") or 0) or None,
                        "dam_wall_m": float(dget("Dam Wall Height (m)", "Dam Wall Height") or 0) or None,
                    })

                print(f" {len(upper_feats)} features, {new_count} new unique")
                time.sleep(0.2)

            except requests.RequestException as e:
                print(f" ERROR: {e}")

    return all_sites


def build_js_object(site, hb_id):
    return {
        "id": hb_id,
        "tier": site["tier"],
        "class": site["class"] or "C",
        "name": f"{site['region'].split('—')[-1].strip()} {site['tier']} {site['class'] or 'C'} ({site['raw_id']})",
        "country": site["country"],
        "region": site["region"].split("—")[-1].strip().split("(")[0].strip(),
        "lat": site["lat"], "lng": site["lng"],
        "upper_lat": site["upper_lat"], "upper_lng": site["upper_lng"],
        "lower_lat": site["lower_lat"], "lower_lng": site["lower_lng"],
        "head_m": site["head_m"],
        "separation_km": site["separation_km"],
        "vol_gl": site["vol_gl"],
        "wr": site["wr"],
        "energy_gwh": site["energy_gwh"],
        "storage_h": site["storage_h"],
        "slope_pct": site["slope_pct"],
        "area_ha": site["area_ha"],
        "dam_wall_m": site["dam_wall_m"],
        "capacity_mw": site["capacity_mw"],
        "configuration": "lake_ocean",
        "status": "anu_ocean",
    }


def write_js_file(path, var_name, sites, country_filter):
    tier_order = {"50GWh": 0, "15GWh": 1, "5GWh": 2, "2GWh": 3}
    country_sites = sorted(
        [s for s in sites if s["country"] == country_filter],
        key=lambda s: (tier_order.get(s["tier"], 9), s.get("class") or "Z"),
    )
    with open(path, "w") as f:
        f.write("window.HB = window.HB || {};\n")
        f.write("HB.Data = HB.Data || {};\n\n")
        f.write(f"// ANU Ocean PHES — {country_filter}\n")
        f.write(f"// Extracted from live WFS: {len(country_sites)} confirmed sites\n")
        f.write(f"// Sites: {len(country_sites)} | Tiers: ")
        tier_counts = {}
        for s in country_sites:
            tier_counts[s["tier"]] = tier_counts.get(s["tier"], 0) + 1
        f.write(str(tier_counts) + "\n")
        f.write(f"HB.Data.{var_name} = [\n")
        for i, site in enumerate(country_sites):
            cc = "ae" if country_filter == "UAE" else "sa"
            tier_str = site["tier"].lower().replace("gwh", "")
            hb_id = f"anu_oc{tier_str}_{cc}{str(i + 1).zfill(3)}"
            obj = build_js_object(site, hb_id)
            comma = "," if i < len(country_sites) - 1 else ""
            f.write("  " + json.dumps(obj, ensure_ascii=False) + comma + "\n")
        f.write("];\n")
    print(f"  Wrote {path}  ({len(country_sites)} sites)")


def main():
    print("ANU Ocean PHES Site Extractor — UAE & Saudi Arabia")
    print("=" * 50)
    print("Querying live ANU GeoServer WFS...")
    print("(This will fail with 403 if run from a cloud server — run locally!)\n")

    sites = extract_all()

    tier_order = {"50GWh": 0, "15GWh": 1, "5GWh": 2, "2GWh": 3}
    sites.sort(key=lambda s: (s["country"], tier_order.get(s["tier"], 9)))

    print(f"\n{'='*50}")
    print(f"Total unique confirmed ANU ocean sites: {len(sites)}")
    by_country = {}
    for s in sites:
        by_country.setdefault(s["country"], []).append(s)
    for c, ss in by_country.items():
        tier_counts = {}
        for s in ss:
            tier_counts[s["tier"]] = tier_counts.get(s["tier"], 0) + 1
        print(f"  {c}: {len(ss)} sites — {tier_counts}")

    # Save raw JSON
    with open("anu_ocean_sites.json", "w") as f:
        json.dump(sites, f, indent=2, ensure_ascii=False)
    print(f"\nWrote anu_ocean_sites.json")

    # Write ready-to-use JS files
    write_js_file("anu_ocean_UAE.js", "anuOceanUAE", sites, "UAE")
    write_js_file("anu_ocean_SA.js", "anuOceanSaudiArabia", sites, "Saudi Arabia")

    print("\nDone! Paste anu_ocean_UAE.js and anu_ocean_SA.js back to Claude.")
    print("OR send the contents of anu_ocean_sites.json")


if __name__ == "__main__":
    main()
