#!/usr/bin/env python3
"""
HydroSHEDS / HydroATLAS Enrichment Pipeline
============================================
Downloads HydroLAKES and BasinATLAS data for Malaysia & Romania,
then enriches HydroBattery Atlas site records with:
  - Water availability (discharge, precipitation, evapotranspiration)
  - Lake/reservoir characteristics (volume, depth, area, residence time)
  - Environmental constraints (protected areas, population)
  - Climate (aridity, moisture index, temperature)

Data sources (CC-BY 4.0):
  - HydroLAKES v1.0: https://www.hydrosheds.org/products/hydrolakes
  - BasinATLAS v1.0 (lev12): https://www.hydrosheds.org/hydroatlas

Usage:
  python build_hydro_enrichment.py            # Full pipeline
  python build_hydro_enrichment.py --skip-download  # Use cached data
"""

import os
import sys
import re
import json
import zipfile
import requests
import warnings
import numpy as np
import pandas as pd

warnings.filterwarnings('ignore')  # suppress geopandas CRS warnings

# ── Configuration ────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data', 'hydrosheds')
JS_DIR   = os.path.join(os.path.dirname(__file__), 'js', 'data')

# Bounding boxes: (minlon, minlat, maxlon, maxlat)
REGIONS = {
    'Malaysia': {
        'bbox': (99.0, 0.5, 119.5, 8.0),
        'hydrolakes_continent': 'as',
        'basinatlas_continent': 'as',
    },
    'Romania': {
        'bbox': (20.0, 43.0, 30.5, 49.0),
        'hydrolakes_continent': 'eu',
        'basinatlas_continent': 'eu',
    },
    'Europe (other)': {
        'bbox': (-11.0, 35.0, 30.5, 72.0),
        'hydrolakes_continent': 'eu',
        'basinatlas_continent': 'eu',
    },
    'North America': {
        'bbox': (-130.0, 24.0, -60.0, 55.0),
        'hydrolakes_continent': 'na',
        'basinatlas_continent': 'na',
    },
    'East Asia': {
        'bbox': (100.0, 20.0, 150.0, 50.0),
        'hydrolakes_continent': 'as',
        'basinatlas_continent': 'as',
    },
    'Australia': {
        'bbox': (112.0, -45.0, 155.0, -10.0),
        'hydrolakes_continent': 'au',
        'basinatlas_continent': 'au',
    },
    'South America': {
        'bbox': (-75.0, -35.0, -34.0, 5.0),
        'hydrolakes_continent': 'sa',
        'basinatlas_continent': 'sa',
    },
    'Africa': {
        'bbox': (15.0, -35.0, 35.0, 0.0),
        'hydrolakes_continent': 'af',
        'basinatlas_continent': 'af',
    },
}

# HydroSHEDS download URLs (v1.0)
DOWNLOAD_URLS = {
    'hydrolakes': 'https://data.hydrosheds.org/file/HydroLAKES/HydroLAKES_polys_v10_shp.zip',
    # BasinATLAS is a single global file (~4 GB), NOT continental tiles
    'basinatlas': 'https://data.hydrosheds.org/file/hydroatlas/BasinATLAS_Data_v10_shp.zip',
    # Fallback: figshare mirror at https://doi.org/10.6084/m9.figshare.9890531
}

# Maximum distance (degrees) for nearest-lake search (~5 km at equator)
MAX_LAKE_DIST_DEG = 0.10

# Attributes to extract from BasinATLAS level 12
BASIN_ATTRS = {
    'dis_m3_pyr': 'discharge_m3s',         # Mean annual discharge (m3/s)
    'run_mm_cyr': 'runoff_mm_yr',           # Mean annual runoff (mm/yr)
    'pre_mm_cyr': 'precip_mm_yr',           # Mean annual precipitation (mm/yr)
    'pet_mm_cyr': 'pet_mm_yr',              # Potential evapotranspiration (mm/yr)
    'ari_ix_cav': 'aridity_index',          # Aridity index (higher = more arid)
    'cmi_ix_cyr': 'moisture_index',         # Climate moisture index
    'tmp_dc_cyr': 'temp_c_avg',             # Mean annual temperature (°C × 10)
    'snw_pc_cyr': 'snow_cover_pct',         # Snow cover extent (%)
    'ele_mt_cav': 'basin_elev_m',           # Mean basin elevation (m)
    'slp_dg_cav': 'basin_slope_deg',        # Mean basin slope (degrees × 100)
    'pac_pct_cse': 'protected_area_pct',    # Protected area coverage (%)
    'for_pc_cse': 'forest_pct',             # Forest coverage (%)
    'crp_pc_cse': 'cropland_pct',           # Cropland coverage (%)
    'urb_pc_cse': 'urban_pct',             # Urban area coverage (%)
    'pop_ct_csu': 'population',             # Total population in catchment
    'inu_pc_clt': 'inundation_pct',         # Inundation extent (%)
    'dor_pc_pva': 'regulation_degree',      # Degree of regulation (%)
}

# Attributes to extract from HydroLAKES
LAKE_ATTRS = {
    'Hylak_id':  'hydrolakes_id',           # Unique lake ID
    'Lake_name': 'lake_name',               # Lake name (if available)
    'Lake_area': 'lake_area_km2',           # Surface area (km2)
    'Vol_total': 'lake_vol_mcm',            # Total volume (million cubic meters)
    'Depth_avg': 'lake_depth_avg_m',        # Average depth (m)
    'Res_time':  'lake_res_time_days',      # Residence time (days)
    'Dis_avg':   'lake_discharge_m3s',      # Average discharge through lake (m3/s)
    'Shore_len': 'lake_shore_km',           # Shoreline length (km)
    'Elevation': 'lake_elevation_m',        # Lake surface elevation (m)
    'Lake_type': 'lake_type',               # 1=Lake, 2=Reservoir, 3=Lake control
}

SESSION = requests.Session()
SESSION.headers['User-Agent'] = 'HydroBatteryAtlas/1.0 (enrichment pipeline)'


# ── Download helpers ─────────────────────────────────────────────────────────
def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def download_file(url, dest_path):
    """Download a file with progress indication."""
    if os.path.exists(dest_path):
        size_mb = os.path.getsize(dest_path) / 1e6
        print(f"  [cached] {os.path.basename(dest_path)} ({size_mb:.0f} MB)")
        return True

    print(f"  Downloading {os.path.basename(dest_path)}...")
    print(f"  URL: {url}")
    try:
        resp = SESSION.get(url, stream=True, timeout=300)
        resp.raise_for_status()
        total = int(resp.headers.get('content-length', 0))
        downloaded = 0
        with open(dest_path, 'wb') as f:
            for chunk in resp.iter_content(chunk_size=1024 * 1024):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded / total * 100
                    print(f"\r  {downloaded / 1e6:.0f} / {total / 1e6:.0f} MB ({pct:.0f}%)", end='', flush=True)
        print(f"\n  Downloaded: {dest_path}")
        return True
    except Exception as e:
        print(f"\n  Download FAILED: {e}")
        print(f"  Please download manually from: {url}")
        print(f"  Save to: {dest_path}")
        if os.path.exists(dest_path):
            os.remove(dest_path)
        return False


def extract_zip(zip_path, extract_to):
    """Extract shapefile from zip archive."""
    if any(f.endswith('.shp') for f in os.listdir(extract_to) if os.path.isfile(os.path.join(extract_to, f))):
        print(f"  [cached] Already extracted in {extract_to}")
        return True

    print(f"  Extracting {os.path.basename(zip_path)}...")
    try:
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(extract_to)
        print(f"  Extracted to: {extract_to}")
        return True
    except Exception as e:
        print(f"  Extract FAILED: {e}")
        return False


def find_shapefile(directory, pattern=''):
    """Find .shp file in directory (recursive)."""
    for root, dirs, files in os.walk(directory):
        for f in files:
            if f.endswith('.shp') and pattern.lower() in f.lower():
                return os.path.join(root, f)
    return None


# ── Data loading ─────────────────────────────────────────────────────────────
def load_hydrolakes(bbox):
    """Load HydroLAKES data filtered to bounding box."""
    import geopandas as gpd

    extract_dir = os.path.join(DATA_DIR, 'hydrolakes')
    shp = find_shapefile(extract_dir, 'HydroLAKES_polys')
    if not shp:
        print("  ERROR: HydroLAKES shapefile not found")
        return None

    print(f"  Loading HydroLAKES from {os.path.basename(shp)}...")
    gdf = gpd.read_file(shp, bbox=bbox)
    print(f"  Loaded {len(gdf)} lakes in bbox {bbox}")
    return gdf


def load_basinatlas(bbox):
    """Load BasinATLAS level 12 data filtered to bounding box."""
    import geopandas as gpd

    extract_dir = os.path.join(DATA_DIR, 'basinatlas')
    shp = find_shapefile(extract_dir, 'lev12')
    if not shp:
        # Try alternate naming
        shp = find_shapefile(extract_dir, 'BasinATLAS')
    if not shp:
        print("  BasinATLAS shapefile not found (download ~4 GB file first)")
        return None

    print(f"  Loading BasinATLAS (lev12) from {os.path.basename(shp)}...")
    gdf = gpd.read_file(shp, bbox=bbox)
    print(f"  Loaded {len(gdf)} sub-basins in bbox {bbox}")
    return gdf


# ── Site loading ─────────────────────────────────────────────────────────────
def load_js_sites():
    """Load all site coordinates from JS data files."""
    sites = []

    # Parse JS data files to extract site arrays
    js_files = {
        'knownSites':             'knownSites.js',
        'anuBluefieldMalaysia':   'anuBluefieldMalaysia.js',
        'anuBluefieldRomania':    'anuBluefieldRomania.js',
        'anuGreenfieldMalaysia':  'anuGreenfieldMalaysia.js',
        'anuGreenfieldRomania':   'anuGreenfieldRomania.js',
        'anuBrownfieldMalaysia':  'anuBrownfieldMalaysia.js',
        'anuBrownfieldRomania':   'anuBrownfieldRomania.js',
        'anuOceanMalaysia':       'anuOceanMalaysia.js',
        'mineVoids':              'mineVoids.js',
    }

    for namespace, filename in js_files.items():
        path = os.path.join(JS_DIR, filename)
        if not os.path.exists(path):
            print(f"  [skip] {filename} not found")
            continue

        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract JSON array from JS assignment
        # Pattern: HB.Data.xxx = [...];
        start = content.find('[')
        end = content.rfind(']') + 1
        if start < 0 or end <= 0:
            print(f"  [skip] {filename}: no array found")
            continue

        arr = None
        try:
            arr = json.loads(content[start:end])
        except json.JSONDecodeError:
            pass

        if arr is None:
            # Fallback: scan entire file for id/lat/lng/name/country fields
            # Works even with nested objects, comments, and JS syntax
            text = content[start:end]

            # Split into approximate object blocks by finding each 'id:' field
            # then scanning forward for lat/lng/name/country
            arr = []
            for id_match in re.finditer(r"""id\s*:\s*['"]([^'"]+)['"]""", text):
                obj = {'id': id_match.group(1)}
                # Scan a window after the id field (up to 2000 chars)
                window = text[id_match.start():id_match.start() + 2000]
                for key in ('lat', 'lng'):
                    m = re.search(rf"""{key}\s*:\s*([+-]?\d+\.?\d*)""", window)
                    if m:
                        obj[key] = float(m.group(1))
                for key in ('name', 'country'):
                    m = re.search(rf"""{key}\s*:\s*['"]([^'"]+)['"]""", window)
                    if m:
                        obj[key] = m.group(1)
                if 'lat' in obj and 'lng' in obj:
                    arr.append(obj)
            if arr:
                print(f"  [regex] Extracted {len(arr)} objects from {filename}")
            else:
                print(f"  [skip] {filename}: could not parse")
                continue

        count = 0
        for s in arr:
            lat = s.get('lat')
            lng = s.get('lng')
            if lat is not None and lng is not None:
                sites.append({
                    'id':        s.get('id', ''),
                    'name':      s.get('name', ''),
                    'country':   s.get('country', ''),
                    'lat':       float(lat),
                    'lng':       float(lng),
                    'source':    namespace,
                })
                count += 1
        print(f"  Loaded {count} sites from {filename}")

    print(f"  Total: {len(sites)} sites with coordinates")
    return sites


# ── Spatial enrichment ───────────────────────────────────────────────────────
def enrich_with_lakes(sites, lakes_gdf):
    """Find nearest lake for each site and extract attributes."""
    from shapely.geometry import Point
    from scipy.spatial import cKDTree

    if lakes_gdf is None or lakes_gdf.empty:
        return

    # Build KD-tree of lake centroids for fast nearest-neighbour
    lake_centroids = lakes_gdf.geometry.centroid
    lake_coords = np.array([(c.x, c.y) for c in lake_centroids])
    tree = cKDTree(lake_coords)

    matched = 0
    for site in sites:
        dist, idx = tree.query([site['lng'], site['lat']])
        if dist <= MAX_LAKE_DIST_DEG:
            row = lakes_gdf.iloc[idx]
            lake_data = {}
            for src_col, dst_key in LAKE_ATTRS.items():
                if src_col in row.index:
                    val = row[src_col]
                    # Clean up values
                    if pd.isna(val):
                        val = None
                    elif isinstance(val, (np.integer, np.int64)):
                        val = int(val)
                    elif isinstance(val, (np.floating, np.float64)):
                        val = round(float(val), 2)
                    lake_data[dst_key] = val
            lake_data['lake_dist_km'] = round(dist * 111.0, 1)  # approx deg→km
            site['lake'] = lake_data
            matched += 1

    print(f"  Lakes matched: {matched}/{len(sites)} sites (within {MAX_LAKE_DIST_DEG * 111:.0f} km)")


def enrich_with_basins(sites, basins_gdf):
    """Point-in-polygon join to find containing sub-basin for each site."""
    from shapely.geometry import Point

    if basins_gdf is None or basins_gdf.empty:
        return

    # Build spatial index
    sindex = basins_gdf.sindex

    matched = 0
    for site in sites:
        pt = Point(site['lng'], site['lat'])
        candidates = list(sindex.intersection(pt.bounds))
        if not candidates:
            continue

        for idx in candidates:
            if basins_gdf.geometry.iloc[idx].contains(pt):
                row = basins_gdf.iloc[idx]
                basin_data = {}
                for src_col, dst_key in BASIN_ATTRS.items():
                    if src_col in row.index:
                        val = row[src_col]
                        if pd.isna(val):
                            val = None
                        elif isinstance(val, (np.integer, np.int64)):
                            val = int(val)
                        elif isinstance(val, (np.floating, np.float64)):
                            val = round(float(val), 2)
                        basin_data[dst_key] = val

                # Post-process scaled values
                if basin_data.get('temp_c_avg') is not None:
                    basin_data['temp_c_avg'] = round(basin_data['temp_c_avg'] / 10, 1)
                if basin_data.get('basin_slope_deg') is not None:
                    basin_data['basin_slope_deg'] = round(basin_data['basin_slope_deg'] / 100, 2)

                site['basin'] = basin_data
                matched += 1
                break

    print(f"  Basins matched: {matched}/{len(sites)} sites")


# ── Output ───────────────────────────────────────────────────────────────────
def write_enrichment_js(sites, output_path):
    """Write enrichment data as a JS lookup table keyed by site ID."""
    lookup = {}
    enriched = 0

    for s in sites:
        entry = {}
        if 'lake' in s:
            entry['lake'] = s['lake']
        if 'basin' in s:
            entry['basin'] = s['basin']
        if entry:
            lookup[s['id']] = entry
            enriched += 1

    js_content = (
        'window.HB = window.HB || {};\n'
        'HB.Data = HB.Data || {};\n'
        '\n'
        '/**\n'
        ' * HydroSHEDS / HydroATLAS Enrichment Data\n'
        ' * Source: HydroLAKES v1.0 + BasinATLAS v1.0 (level 12)\n'
        ' * License: CC-BY 4.0 — https://www.hydrosheds.org\n'
        f' * Enriched sites: {enriched} / {len(sites)}\n'
        f' * Generated: {pd.Timestamp.now().strftime("%Y-%m-%d %H:%M")}\n'
        ' *\n'
        ' * Lake attributes: area, volume, depth, residence time, discharge, elevation\n'
        ' * Basin attributes: discharge, runoff, precipitation, evapotranspiration,\n'
        ' *   aridity, temperature, protected areas, forest/crop/urban cover, population\n'
        ' */\n'
        'HB.Data.hydroAtlas = '
        + json.dumps(lookup, indent=2, ensure_ascii=False)
        + ';\n'
    )

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(js_content)

    size_kb = os.path.getsize(output_path) / 1024
    print(f"\n  Wrote {output_path}")
    print(f"  Enriched: {enriched}/{len(sites)} sites ({size_kb:.0f} KB)")
    return enriched


def write_summary(sites):
    """Print enrichment statistics."""
    lake_count = sum(1 for s in sites if 'lake' in s)
    basin_count = sum(1 for s in sites if 'basin' in s)
    both_count = sum(1 for s in sites if 'lake' in s and 'basin' in s)

    by_country = {}
    for s in sites:
        c = s.get('country', 'Unknown')
        if c not in by_country:
            by_country[c] = {'total': 0, 'lake': 0, 'basin': 0}
        by_country[c]['total'] += 1
        if 'lake' in s:
            by_country[c]['lake'] += 1
        if 'basin' in s:
            by_country[c]['basin'] += 1

    print("\n" + "=" * 60)
    print("ENRICHMENT SUMMARY")
    print("=" * 60)
    print(f"Total sites:     {len(sites)}")
    print(f"Lake matches:    {lake_count}")
    print(f"Basin matches:   {basin_count}")
    print(f"Both:            {both_count}")
    print()
    for country, counts in sorted(by_country.items()):
        print(f"  {country}: {counts['total']} sites, "
              f"{counts['lake']} lake matches, {counts['basin']} basin matches")


# ── Main pipeline ────────────────────────────────────────────────────────────
def main():
    skip_download = '--skip-download' in sys.argv

    ensure_dir(DATA_DIR)

    # ── Step 1: Download data ────────────────────────────────────────────────
    if not skip_download:
        print("\n=== Step 1: Download HydroSHEDS data ===")
        print("NOTE: First download may take 10-30 minutes (large shapefiles)")

        # HydroLAKES (global, ~700 MB)
        hl_zip = os.path.join(DATA_DIR, 'HydroLAKES_polys_v10_shp.zip')
        hl_dir = os.path.join(DATA_DIR, 'hydrolakes')
        ensure_dir(hl_dir)
        if download_file(DOWNLOAD_URLS['hydrolakes'], hl_zip):
            extract_zip(hl_zip, hl_dir)

        # BasinATLAS (single global file, ~4 GB)
        ba_zip = os.path.join(DATA_DIR, 'BasinATLAS_Data_v10_shp.zip')
        ba_dir = os.path.join(DATA_DIR, 'basinatlas')
        ensure_dir(ba_dir)
        if download_file(DOWNLOAD_URLS['basinatlas'], ba_zip):
            extract_zip(ba_zip, ba_dir)
    else:
        print("\n=== Skipping download (--skip-download) ===")

    # ── Step 2: Load site coordinates ────────────────────────────────────────
    print("\n=== Step 2: Load HydroBattery Atlas sites ===")
    all_sites = load_js_sites()

    if not all_sites:
        print("ERROR: No sites loaded. Exiting.")
        return

    # ── Step 3: Regional enrichment ──────────────────────────────────────────
    for region_name, cfg in REGIONS.items():
        bbox = cfg['bbox']

        # Filter sites for this region
        region_sites = [s for s in all_sites
                        if bbox[0] <= s['lng'] <= bbox[2]
                        and bbox[1] <= s['lat'] <= bbox[3]]
        print(f"\n=== Step 3: Enrich {region_name} ({len(region_sites)} sites) ===")

        if not region_sites:
            print(f"  No sites in {region_name} bounding box, skipping")
            continue

        # Load and match HydroLAKES
        print(f"\n  --- HydroLAKES ---")
        lakes = load_hydrolakes(bbox)
        if lakes is not None:
            enrich_with_lakes(region_sites, lakes)
            del lakes  # free memory

        # Load and match BasinATLAS
        print(f"\n  --- BasinATLAS (lev12) ---")
        basins = load_basinatlas(bbox)
        if basins is not None:
            enrich_with_basins(region_sites, basins)
            del basins

    # ── Step 4: Write output ─────────────────────────────────────────────────
    print("\n=== Step 4: Write enrichment data ===")
    output_path = os.path.join(JS_DIR, 'hydroAtlasEnrichment.js')
    write_enrichment_js(all_sites, output_path)
    write_summary(all_sites)

    print("\n=== DONE ===")
    print(f"Output: {output_path}")
    print("Next steps:")
    print("  1. Add <script src='js/data/hydroAtlasEnrichment.js?v=1'></script> to index.html")
    print("  2. Update siteDetailPanel.js to display water resource data")
    print("  3. Bump cache versions and test")


if __name__ == '__main__':
    main()
