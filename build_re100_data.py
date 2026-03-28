#!/usr/bin/env python3
"""
Build ANU RE100 Greenfield, Brownfield, and Ocean PHES data files.
Fetches from GeoServer WFS (using CQL_FILTER for efficiency) and generates JS data files.
"""

import requests
import json
import time
import urllib.parse
from collections import defaultdict

# ── WFS endpoints ────────────────────────────────────────────────────────────
ENDPOINTS = {
    'greenfield': 'https://re100.anu.edu.au/geoserver/global_greenfield/wfs',
    'brownfield': 'https://re100.anu.edu.au/geoserver/global_brownfield/wfs',
    'ocean':      'https://re100.anu.edu.au/geoserver/global_ocean/wfs',
}

LAYERS = {
    'greenfield': ['global_greenfield:2gwh_6h'],
    'brownfield': ['global_brownfield:2gwh_6h', 'global_brownfield:5gwh_18h', 'global_brownfield:15gwh_18h'],
    'ocean':      ['global_ocean:2gwh_6h', 'global_ocean:5gwh_18h', 'global_ocean:15gwh_18h', 'global_ocean:50gwh_18h'],
}

# Fallback BBOX regions used only when CQL_FILTER is unavailable
BBOXES = {
    'my_peninsular': (99, 1, 105, 8),
    'my_borneo':     (115, 4, 119, 8),   # tight Sabah bbox
    'romania':       (20, 43, 30, 49),
}

PROPS = 'name,ispin,country,class,head,separation,energy,volume,water_rock_ratio,energy_cost,power_cost,reservoir_area,dam_volume,wkb_geometry'

TIER_MAP = {
    '2gwh_6h':   ('2GWh',  6,  333,  2000),
    '5gwh_18h':  ('5GWh',  18, 278,  5000),
    '15gwh_18h': ('15GWh', 18, 833,  15000),
    '50gwh_18h': ('50GWh', 18, 2778, 50000),
}

SESSION = requests.Session()
SESSION.headers['User-Agent'] = 'HydroBatteryAtlas/1.0 (data builder)'


# ── Region helpers ────────────────────────────────────────────────────────────
def get_malaysia_region(lat, lng):
    if lng > 115 and lat > 5:
        return 'Sabah'
    if lng > 110 and lat < 5:
        return 'Sarawak'
    if lat > 5.5:
        return 'Perak/Kelantan'
    if lat > 4.5:
        return 'Terengganu'
    if lat > 3.5:
        return 'Pahang'
    if lat > 2.5:
        return 'Selangor'
    return 'Johor'


def get_romania_region(lat, lng):
    if lng < 22.5 and lat > 46:
        return 'Apuseni Mountains'
    if lng < 23 and lat < 45.5:
        return 'Danube / Oltenia'
    if lat > 47:
        return 'Northern Romania'
    if lng > 27:
        return 'Moldavia'
    if lat > 45.5:
        return 'Transylvania'
    return 'Southern Carpathians'


def get_area_name_my(lat, lng):
    if lng > 116 and lat > 5.8:
        return 'Mt Kinabalu'
    if lng > 115 and lat > 5:
        return 'Crocker Range'
    if lng > 114 and lng < 115.5 and lat < 4:
        return 'Sarawak Highlands'
    if lng < 102 and lat > 5.5:
        return 'Titiwangsa Range'
    if lng > 101.5 and lng < 103 and lat > 4.5 and lat < 5.5:
        return 'Kenyir Lake'
    if lng < 102 and lat > 4 and lat < 5.5:
        return 'Cameron Highlands'
    if lng < 102 and lat > 3:
        return 'Taman Negara'
    return 'Malaysia Highlands'


def flt(v):
    """Safe float conversion."""
    try:
        return float(v) if v is not None else None
    except (ValueError, TypeError):
        return None


def extract_pin(f, tier_key):
    """Extract pin data from a GeoJSON feature."""
    p = f.get('properties', {})
    b = f.get('bbox') or [0, 0, 0, 0]
    lat = round((b[1] + b[3]) / 2, 5)
    lng = round((b[0] + b[2]) / 2, 5)
    wr = flt(p.get('water_rock_ratio'))
    if wr and wr > 1_000_000:
        wr = 999.0
    return {
        'raw_name': p.get('name', ''),
        'class': p.get('class', ''),
        'head': flt(p.get('head')),
        'separation': flt(p.get('separation')),
        'energy': flt(p.get('energy')),
        'volume': flt(p.get('volume')),
        'water_rock_ratio': wr,
        'energy_cost': flt(p.get('energy_cost')),
        'power_cost': flt(p.get('power_cost')),
        'reservoir_area': flt(p.get('reservoir_area')),
        'dam_volume': flt(p.get('dam_volume')),
        'lat': lat,
        'lng': lng,
        'tier_key': tier_key,
    }


# ── WFS fetcher ───────────────────────────────────────────────────────────────
def fetch_pins_cql(endpoint, layer, country, max_pages=50):
    """
    Fetch all pin features for a country using CQL_FILTER (fast path).
    Falls back to BBOX scan if CQL returns no results.
    """
    tier_key = layer.split(':')[1]
    pins = []
    start = 0
    page_size = 200
    cql = urllib.parse.quote(f"country='{country}'")

    print(f"  [CQL] {layer} country={country}")
    for page in range(max_pages):
        url = (
            f"{endpoint}?service=WFS&version=2.0.0&request=GetFeature"
            f"&typeName={layer}&outputFormat=application/json"
            f"&count={page_size}&startIndex={start}"
            f"&CQL_FILTER={cql}"
            f"&propertyName={PROPS}"
        )
        try:
            resp = SESSION.get(url, timeout=60)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  ERROR page {page}: {e}")
            break

        features = data.get('features', [])
        if not features:
            break

        page_pins = 0
        for f in features:
            p = f.get('properties', {})
            if not p.get('ispin'):
                continue
            pins.append(extract_pin(f, tier_key))
            page_pins += 1

        print(f"    page {page}: {len(features)} features, {page_pins} pins (total={len(pins)})")
        if len(features) < page_size:
            break
        start += page_size
        time.sleep(0.25)

    return pins


def fetch_pins_bbox(endpoint, layer, bbox_name, country, max_pages=300):
    """
    Fallback: fetch using BBOX spatial filter with client-side country filtering.
    Needed if CQL_FILTER doesn't work on this server.
    """
    minlon, minlat, maxlon, maxlat = BBOXES[bbox_name]
    tier_key = layer.split(':')[1]
    pins = []
    start = 0
    page_size = 200

    print(f"  [BBOX:{bbox_name}] {layer} country={country}")
    for page in range(max_pages):
        url = (
            f"{endpoint}?service=WFS&version=2.0.0&request=GetFeature"
            f"&typeName={layer}&outputFormat=application/json"
            f"&count={page_size}&startIndex={start}"
            f"&BBOX={minlon},{minlat},{maxlon},{maxlat},EPSG:4326"
            f"&propertyName={PROPS}"
        )
        try:
            resp = SESSION.get(url, timeout=60)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"  ERROR page {page}: {e}")
            break

        features = data.get('features', [])
        if not features:
            break

        page_pins = 0
        for f in features:
            p = f.get('properties', {})
            if not p.get('ispin'):
                continue
            if p.get('country') != country:
                continue
            pins.append(extract_pin(f, tier_key))
            page_pins += 1

        print(f"    page {page}: {len(features)} features, {page_pins} new pins (total={len(pins)})")
        if len(features) < page_size:
            break
        start += page_size
        time.sleep(0.25)

    return pins


def fetch_pins(endpoint, layer, country, bbox_names=None):
    """
    Fetch all pins for a country. Uses CQL_FILTER by default (fastest).
    If CQL returns nothing, falls back to BBOX scan.
    bbox_names: list of bbox keys for fallback (e.g. ['my_peninsular', 'my_borneo'])
    """
    pins = fetch_pins_cql(endpoint, layer, country)
    if not pins and bbox_names:
        print(f"  CQL returned 0 pins - falling back to BBOX scan")
        for bn in bbox_names:
            p = fetch_pins_bbox(endpoint, layer, bn, country)
            pins.extend(p)
            print(f"  BBOX {bn}: got {len(p)} pins")
    return pins


# ── Site builder ──────────────────────────────────────────────────────────────
def make_site(pin, source_type, country, idx):
    tier_key = pin['tier_key']
    tier_label, hours, cap_mw, storage_mwh = TIER_MAP[tier_key]
    cls  = pin['class'] or ''
    lat  = pin['lat']
    lng  = pin['lng']
    head = pin['head'] or 0
    sep  = pin['separation'] or 0
    ec   = pin['energy_cost']
    pc   = pin['power_cost']

    # Source-type prefix
    prefix_map = {'greenfield': 'gf', 'brownfield': 'brf', 'ocean': 'oc'}
    pfx = prefix_map[source_type]
    tier_short = tier_key.replace('gwh_', '').replace('h', '')  # '2_6', '5_18' etc.
    site_id = f"anu_{pfx}_{tier_short}_{idx:05d}"

    # Name
    if country == 'Malaysia':
        area = get_area_name_my(lat, lng)
        name = f"{area} {tier_label} {cls}{idx} ({source_type.capitalize()})"
    else:
        name = f"Romania {tier_label} {cls}{idx} ({source_type.capitalize()})"

    # Region
    region = get_malaysia_region(lat, lng) if country == 'Malaysia' else get_romania_region(lat, lng)

    # Status
    status = f'anu_{source_type}'

    # Configuration
    config = 'lake_ocean' if source_type == 'ocean' else 'lake_pair'

    # Description
    ec_str = f"${ec}/MWh" if ec is not None else "N/A"
    wr_str = str(round(pin['water_rock_ratio'], 1)) if pin['water_rock_ratio'] else 'N/A'
    if source_type == 'greenfield':
        desc = (f"ANU Greenfield Class {cls}. New reservoir pair on virgin land. "
                f"Head {head}m, separation {sep}km, W:R ratio {wr_str}. LCOS {ec_str}.")
    elif source_type == 'brownfield':
        desc = (f"ANU Brownfield Class {cls}. Uses existing pit or dam infrastructure as lower/upper reservoir. "
                f"Head {head}m, separation {sep}km, W:R ratio {wr_str}. LCOS {ec_str}.")
    else:  # ocean
        desc = (f"ANU Ocean Class {cls}. Upper reservoir on elevated coastal terrain; ocean as lower reservoir. "
                f"Head {head}m, separation {sep}km. LCOS {ec_str}.")

    return {
        'id': site_id,
        'tier': tier_label,
        'class': cls,
        'name': name,
        'country': country,
        'region': region,
        'lat': lat,
        'lng': lng,
        'head_m': head,
        'separation_km': sep,
        'volume_gl': pin['volume'],
        'water_rock_ratio': pin['water_rock_ratio'],
        'energy_gwh': pin['energy'],
        'dam_volume_mm3': pin['dam_volume'],
        'reservoir_area_ha': pin['reservoir_area'],
        'energy_cost_usd_mwh': ec,
        'power_cost_usd_kw': pc,
        'capacity_mw': cap_mw,
        'storage_mwh': storage_mwh,
        'status': status,
        'configuration': config,
        'description': desc,
        'source_url': 'https://re100.eng.anu.edu.au/global/',
    }


def apply_class_limit(pins, max_d, max_e):
    """Keep all A/B/C, top max_d class D (by energy_cost asc), top max_e class E."""
    by_class = defaultdict(list)
    for p in pins:
        by_class[p['class']].append(p)

    result = []
    for cls in ('A', 'B', 'C'):
        result.extend(by_class[cls])

    # Sort D by energy_cost ascending (cheapest first), take top max_d
    d_sorted = sorted(by_class['D'], key=lambda p: (p['energy_cost'] or 9999))
    result.extend(d_sorted[:max_d])

    # Sort E by energy_cost ascending, take top max_e
    e_sorted = sorted(by_class['E'], key=lambda p: (p['energy_cost'] or 9999))
    result.extend(e_sorted[:max_e])

    return result


def write_js_file(path, namespace, sites, header_comment):
    lines = [
        'window.HB = window.HB || {};',
        'HB.Data = HB.Data || {};',
        '',
        '/**',
    ]
    for line in header_comment:
        lines.append(f' * {line}')
    lines.append(' */')
    lines.append(f'HB.Data.{namespace} = ')
    content = '\n'.join(lines) + json.dumps(sites, indent=2, ensure_ascii=False) + ';\n'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  Wrote {len(sites)} sites -> {path}")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    from collections import Counter

    # ── Greenfield Malaysia ──────────────────────────────────────────────────
    print('\n=== Greenfield Malaysia ===')
    gf_my_pins = fetch_pins(
        ENDPOINTS['greenfield'], 'global_greenfield:2gwh_6h', 'Malaysia',
        bbox_names=['my_peninsular', 'my_borneo']
    )
    print(f"  Total raw pins: {len(gf_my_pins)}")
    gf_my_filtered = apply_class_limit(gf_my_pins, max_d=200, max_e=100)
    print(f"  After class filtering: {len(gf_my_filtered)}")
    gf_my_sites = [make_site(p, 'greenfield', 'Malaysia', i + 1) for i, p in enumerate(gf_my_filtered)]
    cc = Counter(s['class'] for s in gf_my_sites)
    write_js_file(
        'js/data/anuGreenfieldMalaysia.js', 'anuGreenfieldMalaysia', gf_my_sites,
        ['ANU RE100 Greenfield Atlas - Malaysia PHES Sites',
         'Source: re100.anu.edu.au/geoserver/global_greenfield/wfs',
         'Layer: global_greenfield:2gwh_6h | All class A/B/C, top-200 D, top-100 E',
         f'Total: {len(gf_my_sites)} sites  |  Class: {dict(cc)}']
    )

    # ── Greenfield Romania ───────────────────────────────────────────────────
    print('\n=== Greenfield Romania ===')
    gf_ro_pins = fetch_pins(
        ENDPOINTS['greenfield'], 'global_greenfield:2gwh_6h', 'Romania',
        bbox_names=['romania']
    )
    print(f"  Total raw pins: {len(gf_ro_pins)}")
    gf_ro_filtered = apply_class_limit(gf_ro_pins, max_d=100, max_e=50)
    print(f"  After class filtering: {len(gf_ro_filtered)}")
    gf_ro_sites = [make_site(p, 'greenfield', 'Romania', i + 1) for i, p in enumerate(gf_ro_filtered)]
    cc_ro = Counter(s['class'] for s in gf_ro_sites)
    write_js_file(
        'js/data/anuGreenfieldRomania.js', 'anuGreenfieldRomania', gf_ro_sites,
        ['ANU RE100 Greenfield Atlas - Romania PHES Sites',
         'Source: re100.anu.edu.au/geoserver/global_greenfield/wfs',
         'Layer: global_greenfield:2gwh_6h | All class A/B/C, top-100 D, top-50 E',
         f'Total: {len(gf_ro_sites)} sites  |  Class: {dict(cc_ro)}']
    )

    # ── Brownfield Malaysia ──────────────────────────────────────────────────
    print('\n=== Brownfield Malaysia ===')
    brf_my_all = []
    for layer in LAYERS['brownfield']:
        p = fetch_pins(ENDPOINTS['brownfield'], layer, 'Malaysia',
                       bbox_names=['my_peninsular', 'my_borneo'])
        brf_my_all.extend(p)
    brf_my_sites = [make_site(p, 'brownfield', 'Malaysia', i + 1) for i, p in enumerate(brf_my_all)]
    cc_bm = Counter(s['tier'] for s in brf_my_sites)
    write_js_file(
        'js/data/anuBrownfieldMalaysia.js', 'anuBrownfieldMalaysia', brf_my_sites,
        ['ANU RE100 Brownfield Atlas - Malaysia PHES Sites',
         'Source: re100.anu.edu.au/geoserver/global_brownfield/wfs',
         'Layers: 2gwh_6h, 5gwh_18h, 15gwh_18h | All sites',
         f'Total: {len(brf_my_sites)} sites  |  By tier: {dict(cc_bm)}']
    )

    # ── Brownfield Romania ───────────────────────────────────────────────────
    print('\n=== Brownfield Romania ===')
    brf_ro_all = []
    for layer in LAYERS['brownfield']:
        p = fetch_pins(ENDPOINTS['brownfield'], layer, 'Romania', bbox_names=['romania'])
        brf_ro_all.extend(p)
    brf_ro_sites = [make_site(p, 'brownfield', 'Romania', i + 1) for i, p in enumerate(brf_ro_all)]
    cc_br = Counter(s['tier'] for s in brf_ro_sites)
    write_js_file(
        'js/data/anuBrownfieldRomania.js', 'anuBrownfieldRomania', brf_ro_sites,
        ['ANU RE100 Brownfield Atlas - Romania PHES Sites',
         'Source: re100.anu.edu.au/geoserver/global_brownfield/wfs',
         'Layers: 2gwh_6h, 5gwh_18h, 15gwh_18h | All sites',
         f'Total: {len(brf_ro_sites)} sites  |  By tier: {dict(cc_br)}']
    )

    # ── Ocean Malaysia ───────────────────────────────────────────────────────
    print('\n=== Ocean Malaysia ===')
    oc_my_all = []
    for layer in LAYERS['ocean']:
        p = fetch_pins(ENDPOINTS['ocean'], layer, 'Malaysia',
                       bbox_names=['my_peninsular', 'my_borneo'])
        oc_my_all.extend(p)
    oc_my_sites = [make_site(p, 'ocean', 'Malaysia', i + 1) for i, p in enumerate(oc_my_all)]
    cc_oc = Counter(s['tier'] for s in oc_my_sites)
    write_js_file(
        'js/data/anuOceanMalaysia.js', 'anuOceanMalaysia', oc_my_sites,
        ['ANU RE100 Ocean Atlas - Malaysia PHES Sites',
         'Source: re100.anu.edu.au/geoserver/global_ocean/wfs',
         'Layers: 2gwh_6h, 5gwh_18h, 15gwh_18h, 50gwh_18h | All sites',
         f'Total: {len(oc_my_sites)} sites  |  By tier: {dict(cc_oc)}']
    )

    print('\n=== DONE ===')
    print(f"Greenfield Malaysia: {len(gf_my_sites)}")
    print(f"Greenfield Romania:  {len(gf_ro_sites)}")
    print(f"Brownfield Malaysia: {len(brf_my_sites)}")
    print(f"Brownfield Romania:  {len(brf_ro_sites)}")
    print(f"Ocean Malaysia:      {len(oc_my_sites)}")


if __name__ == '__main__':
    main()
