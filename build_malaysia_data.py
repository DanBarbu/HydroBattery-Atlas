import json

with open('malaysia_bluefield_all_sep10.json', 'r') as f:
    data = json.load(f)

pipe = "||"

# Malaysia region mapping based on lat/lng
def get_region(lat, lng):
    # Sabah (Borneo north)
    if lng > 115 and lat > 5:
        return 'Sabah'
    # Sarawak (Borneo south)
    if lng > 110 and lat < 5:
        return 'Sarawak'
    # Peninsular Malaysia
    if lng < 105:
        if lat > 5.5:
            return 'Perak/Kelantan'
        elif lat > 4.5:
            return 'Terengganu'
        elif lat > 3.5:
            return 'Pahang'
        elif lat > 2.5:
            return 'Selangor/Negeri Sembilan'
        else:
            return 'Johor'
    return 'Malaysia'

# Region name for site naming
def get_area_name(lat, lng):
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

sites = []
tier_map = {
    '15gwh_18h': ('15GWh', 15000, 833),
    '5gwh_18h': ('5GWh', 5000, 278),
    '2gwh_6h': ('2GWh', 2000, 333)
}

for tier_key in ['15gwh_18h', '5gwh_18h', '2gwh_6h']:
    features = data.get(tier_key, [])
    tier_label, storage_mwh, default_mw = tier_map[tier_key]

    for feat in features:
        fid_num = feat['fid'].split('.')[-1]
        lat = feat['latitude']
        lng = feat['longitude']
        region = get_region(lat, lng)
        area = get_area_name(lat, lng)
        cls = feat['class']
        head = feat['head']
        sep = feat['separation']
        wr = feat['water_rock_ratio']

        # Skip anomalous water_rock_ratio values
        if wr and wr > 1e6:
            wr = 999

        # Calculate power from energy_cost and power_cost if available
        power_cost = feat.get('power_cost', 0)
        cap_mw = default_mw

        site_id = f"my-bf-{tier_key}-{fid_num}"
        name = f"{area} Pair {fid_num} ({tier_label})"

        site = {
            'id': site_id,
            'tier': tier_label,
            'class': cls,
            'name': name,
            'country': 'Malaysia',
            'region': region,
            'lat': round(lat, 5),
            'lng': round(lng, 5),
            'head_m': head,
            'separation_km': sep,
            'volume_gl': feat.get('volume'),
            'water_rock_ratio': wr,
            'energy_gwh': feat.get('energy'),
            'dam_volume_mm3': feat.get('dam_volume'),
            'reservoir_area_ha': feat.get('reservoir_area'),
            'energy_cost_usd_mwh': feat.get('energy_cost'),
            'power_cost_usd_kw': power_cost,
            'capacity_mw': cap_mw,
            'storage_mwh': storage_mwh,
            'status': 'anu_bluefield',
            'configuration': 'lake_pair',
            'description': f"ANU Bluefield Class {cls}. Head {head}m, separation {sep}km, W:R {wr}. LCOS ${feat.get('energy_cost', 0)}/MWh.",
            'source_url': 'https://re100.eng.anu.edu.au/global/',
            'isdam': feat.get('isdam', False),
            'wfs_fid': feat['fid']
        }
        sites.append(site)

# Build JS output
lines = []
lines.append(f"window.HB = window.HB {pipe} {{}};")
lines.append(f"HB.Data = HB.Data {pipe} {{}};")
lines.append("")
lines.append("/**")
lines.append(f" * ANU Bluefield Atlas - Malaysia PHES Sites (Real WFS Data)")
lines.append(f" * Source: re100.anu.edu.au/geoserver/global_bluefield/wfs")
lines.append(f" * Filter: country='Malaysia', separation <= 10km")
lines.append(f" * Total: {len(sites)} sites across 3 tiers")

# Count by tier and class
from collections import Counter
tier_counts = Counter(s['tier'] for s in sites)
class_counts = Counter(s['class'] for s in sites)
lines.append(f" *")
for t in ['15GWh', '5GWh', '2GWh']:
    lines.append(f" *   {t}: {tier_counts.get(t, 0)} sites")
lines.append(f" *")
for c in ['A', 'B', 'C', 'D', 'E']:
    lines.append(f" *   Class {c}: {class_counts.get(c, 0)} sites")
lines.append(f" */")
lines.append("")
lines.append("HB.Data.anuBluefieldMalaysia = ")

js_content = '\n'.join(lines) + json.dumps(sites, indent=2) + ';\n'

with open('js/data/anuBluefieldMalaysia.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print(f"Generated {len(sites)} Malaysia Bluefield sites")
print(f"  By tier: {dict(tier_counts)}")
print(f"  By class: {dict(class_counts)}")
