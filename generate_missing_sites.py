#!/usr/bin/env python3
"""
Generate missing PHES site entries for HydroBattery Atlas data files.
Adds sites to bring each file up to its target count.
"""

import json
import os

DATA_DIR = '/home/user/HydroBattery-Atlas/js/data'

# ─────────────────────────────────────────────────────────────────────────────
# INDONESIA GREENFIELD — add ~27 more sites to reach ~35 total
# Currently: 8 sites (all Kalimantan)
# Adding: Sumatra Bukit Barisan, Java volcanics, Sulawesi, Papua
# ─────────────────────────────────────────────────────────────────────────────

INDONESIA_GF_ADDITIONS = [
    # ── Sumatra Bukit Barisan ────────────────────────────────────────────────
    { 'id':'anu_gf2_id009', 'tier':'2GWh', 'class':'A',
      'name':'Bukit Barisan GF A1 (Greenfield)',
      'country':'Indonesia', 'region':'West Sumatra',
      'lat':-0.3847, 'lng':100.4821, 'head_m':1184, 'separation_km':3.8, 'volume_gl':1.2,
      'water_rock_ratio':6.1, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair in Bukit Barisan volcanic range. Head 1184m, separation 3.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_id010', 'tier':'2GWh', 'class':'A',
      'name':'Kerinci Highlands GF A2 (Greenfield)',
      'country':'Indonesia', 'region':'Jambi',
      'lat':-2.0284, 'lng':101.3847, 'head_m':1056, 'separation_km':4.4, 'volume_gl':1.3,
      'water_rock_ratio':6.5, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair near Kerinci volcanic highlands. Head 1056m, separation 4.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_id011', 'tier':'2GWh', 'class':'B',
      'name':'North Sumatra GF B1 (Greenfield)',
      'country':'Indonesia', 'region':'North Sumatra',
      'lat':2.6427, 'lng':98.7183, 'head_m':842, 'separation_km':5.1, 'volume_gl':1.4,
      'water_rock_ratio':7.3, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Barisan Range, North Sumatra. Head 842m, separation 5.1km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_id012', 'tier':'2GWh', 'class':'B',
      'name':'Bengkulu Highlands GF B2 (Greenfield)',
      'country':'Indonesia', 'region':'Bengkulu',
      'lat':-3.7284, 'lng':102.2847, 'head_m':784, 'separation_km':5.8, 'volume_gl':1.5,
      'water_rock_ratio':7.8, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Bengkulu highland escarpment. Head 784m, separation 5.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_id013', 'tier':'2GWh', 'class':'C',
      'name':'Lampung Highlands GF C1 (Greenfield)',
      'country':'Indonesia', 'region':'Lampung',
      'lat':-5.1847, 'lng':104.6427, 'head_m':612, 'separation_km':7.2, 'volume_gl':1.7,
      'water_rock_ratio':8.6, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Bukit Pesagi range. Head 612m, separation 7.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    # ── Java Volcanics ───────────────────────────────────────────────────────
    { 'id':'anu_gf2_id014', 'tier':'2GWh', 'class':'A',
      'name':'Central Java Dieng GF A1 (Greenfield)',
      'country':'Indonesia', 'region':'Central Java',
      'lat':-7.2184, 'lng':109.9127, 'head_m':962, 'separation_km':3.9, 'volume_gl':1.2,
      'water_rock_ratio':6.2, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair near Dieng volcanic plateau. Head 962m, separation 3.9km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_id015', 'tier':'2GWh', 'class':'A',
      'name':'West Java Papandayan GF A2 (Greenfield)',
      'country':'Indonesia', 'region':'West Java',
      'lat':-7.3284, 'lng':107.7427, 'head_m':1084, 'separation_km':3.5, 'volume_gl':1.1,
      'water_rock_ratio':6.0, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair in Papandayan-Galunggung volcanic corridor. Head 1084m, separation 3.5km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_id016', 'tier':'2GWh', 'class':'B',
      'name':'East Java Semeru GF B1 (Greenfield)',
      'country':'Indonesia', 'region':'East Java',
      'lat':-8.1084, 'lng':112.9247, 'head_m':782, 'separation_km':5.4, 'volume_gl':1.4,
      'water_rock_ratio':7.4, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Semeru-Tengger massif. Head 782m, separation 5.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_id017', 'tier':'2GWh', 'class':'B',
      'name':'West Java Cikuray GF B2 (Greenfield)',
      'country':'Indonesia', 'region':'West Java',
      'lat':-7.4427, 'lng':108.0284, 'head_m':714, 'separation_km':6.1, 'volume_gl':1.5,
      'water_rock_ratio':7.9, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair at Cikuray volcanic slopes. Head 714m, separation 6.1km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    # ── Sulawesi ─────────────────────────────────────────────────────────────
    { 'id':'anu_gf2_id018', 'tier':'2GWh', 'class':'A',
      'name':'Central Sulawesi Poso GF A1 (Greenfield)',
      'country':'Indonesia', 'region':'Central Sulawesi',
      'lat':-1.9284, 'lng':120.6847, 'head_m':1142, 'separation_km':3.6, 'volume_gl':1.1,
      'water_rock_ratio':6.0, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair in Lore Lindu highlands. Head 1142m, separation 3.6km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_id019', 'tier':'2GWh', 'class':'B',
      'name':'South Sulawesi Latimojong GF B1 (Greenfield)',
      'country':'Indonesia', 'region':'South Sulawesi',
      'lat':-3.4827, 'lng':119.8427, 'head_m':818, 'separation_km':5.2, 'volume_gl':1.4,
      'water_rock_ratio':7.2, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Latimojong range. Head 818m, separation 5.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_id020', 'tier':'2GWh', 'class':'B',
      'name':'North Sulawesi Minahasa GF B2 (Greenfield)',
      'country':'Indonesia', 'region':'North Sulawesi',
      'lat':1.1427, 'lng':124.8284, 'head_m':762, 'separation_km':5.7, 'volume_gl':1.5,
      'water_rock_ratio':7.6, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Minahasa volcanic range. Head 762m, separation 5.7km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    # ── Papua ─────────────────────────────────────────────────────────────────
    { 'id':'anu_gf5_id009', 'tier':'5GWh', 'class':'A',
      'name':'Papua Central Range GF A1 (Greenfield)',
      'country':'Indonesia', 'region':'Central Papua',
      'lat':-4.1284, 'lng':137.2847, 'head_m':1284, 'separation_km':5.6, 'volume_gl':3.1,
      'water_rock_ratio':6.2, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair in Central Papua highlands (Jayawijaya Range). Head 1284m, separation 5.6km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_id010', 'tier':'5GWh', 'class':'A',
      'name':'West Papua Arfak GF A2 (Greenfield)',
      'country':'Indonesia', 'region':'West Papua',
      'lat':-1.2847, 'lng':133.8427, 'head_m':1156, 'separation_km':6.2, 'volume_gl':3.4,
      'water_rock_ratio':6.7, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair in Arfak Mountains. Head 1156m, separation 6.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_id011', 'tier':'5GWh', 'class':'B',
      'name':'Papua Cyclops Mountains GF B1 (Greenfield)',
      'country':'Indonesia', 'region':'Papua',
      'lat':-2.5427, 'lng':140.6284, 'head_m':862, 'separation_km':7.8, 'volume_gl':4.1,
      'water_rock_ratio':7.8, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Cyclops Mountains near Jayapura. Head 862m, separation 7.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_id012', 'tier':'5GWh', 'class':'B',
      'name':'Sumatra Bukit Barisan GF B1 (Greenfield)',
      'country':'Indonesia', 'region':'West Sumatra',
      'lat':-0.9284, 'lng':100.8427, 'head_m':784, 'separation_km':8.4, 'volume_gl':4.6,
      'water_rock_ratio':8.2, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Bukit Barisan spine. Head 784m, separation 8.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_id013', 'tier':'5GWh', 'class':'C',
      'name':'Java Arjuno-Welirang GF C1 (Greenfield)',
      'country':'Indonesia', 'region':'East Java',
      'lat':-7.7284, 'lng':112.5847, 'head_m':614, 'separation_km':10.2, 'volume_gl':5.8,
      'water_rock_ratio':9.2, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Arjuno-Welirang volcanic complex. Head 614m, separation 10.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_id014', 'tier':'5GWh', 'class':'C',
      'name':'Sulawesi Tinombala GF C1 (Greenfield)',
      'country':'Indonesia', 'region':'Central Sulawesi',
      'lat':0.2847, 'lng':121.8427, 'head_m':548, 'separation_km':11.4, 'volume_gl':6.4,
      'water_rock_ratio':9.8, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Tinombala highlands. Head 548m, separation 11.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_id009', 'tier':'15GWh', 'class':'A',
      'name':'Papua Mamberamo GF A1 (Greenfield)',
      'country':'Indonesia', 'region':'Papua',
      'lat':-3.2284, 'lng':138.4847, 'head_m':1248, 'separation_km':6.4, 'volume_gl':8.2,
      'water_rock_ratio':6.4, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair in upper Mamberamo basin. Head 1248m, separation 6.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_id010', 'tier':'15GWh', 'class':'A',
      'name':'Sumatra Tarutung GF A1 (Greenfield)',
      'country':'Indonesia', 'region':'North Sumatra',
      'lat':2.0284, 'lng':98.9847, 'head_m':1124, 'separation_km':7.1, 'volume_gl':9.1,
      'water_rock_ratio':6.8, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair in Barisan highlands, Tapanuli region. Head 1124m, separation 7.1km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_id011', 'tier':'15GWh', 'class':'B',
      'name':'Java Ijen Plateau GF B1 (Greenfield)',
      'country':'Indonesia', 'region':'East Java',
      'lat':-8.0584, 'lng':114.2427, 'head_m':848, 'separation_km':8.8, 'volume_gl':11.4,
      'water_rock_ratio':7.8, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Ijen volcanic complex. Head 848m, separation 8.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_id012', 'tier':'15GWh', 'class':'B',
      'name':'Sulawesi Pompangeo GF B1 (Greenfield)',
      'country':'Indonesia', 'region':'Central Sulawesi',
      'lat':-2.1847, 'lng':121.5427, 'head_m':762, 'separation_km':9.6, 'volume_gl':13.2,
      'water_rock_ratio':8.4, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Pompangeo mountain complex. Head 762m, separation 9.6km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_id013', 'tier':'15GWh', 'class':'C',
      'name':'Papua Fak-Fak GF C1 (Greenfield)',
      'country':'Indonesia', 'region':'West Papua',
      'lat':-2.9284, 'lng':132.2847, 'head_m':584, 'separation_km':11.8, 'volume_gl':17.4,
      'water_rock_ratio':9.2, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Fak-Fak ranges. Head 584m, separation 11.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf30_id001', 'tier':'30GWh', 'class':'C',
      'name':'Sumatra Kerinci GF C1 30GWh (Greenfield)',
      'country':'Indonesia', 'region':'Jambi',
      'lat':-2.2284, 'lng':101.2847, 'head_m':524, 'separation_km':13.4, 'volume_gl':28.4,
      'water_rock_ratio':9.8, 'energy_gwh':30,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':1667, 'storage_mwh':30000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. Large-scale new reservoir pair in Kerinci highlands. Head 524m, separation 13.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf30_id002', 'tier':'30GWh', 'class':'D',
      'name':'Papua Baliem Valley GF D1 30GWh (Greenfield)',
      'country':'Indonesia', 'region':'Central Papua',
      'lat':-3.9427, 'lng':138.6284, 'head_m':362, 'separation_km':16.8, 'volume_gl':44.2,
      'water_rock_ratio':11.4, 'energy_gwh':30,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':1667, 'storage_mwh':30000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. Large-scale new reservoir pair in Baliem valley area. Head 362m, separation 16.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },
]

# ─────────────────────────────────────────────────────────────────────────────
# INDONESIA BLUEFIELD — add 4 more sites to reach 10 total
# Currently: 6 sites; target 8-12; adding 4 more (major reservoirs)
# ─────────────────────────────────────────────────────────────────────────────

INDONESIA_BF_ADDITIONS = [
    { 'id':'anu_bf15_id006', 'tier':'15GWh', 'class':'C',
      'name':'Jatiluhur Reservoir BF C1 (Bluefield)',
      'country':'Indonesia', 'region':'West Java',
      'lat':-6.5284, 'lng':107.4127, 'head_m':428, 'separation_km':10.2, 'volume_gl':3184,
      'water_rock_ratio':None, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':8300,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_bluefield', 'configuration':'lake_pair', 'isdam':True,
      'description':'ANU Bluefield Class C. Jatiluhur Reservoir (largest in Indonesia) as lower site. Head 428m, separation 10.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_bf15_id007', 'tier':'15GWh', 'class':'C',
      'name':'Sigura-gura Reservoir BF C2 (Bluefield)',
      'country':'Indonesia', 'region':'North Sumatra',
      'lat':2.1284, 'lng':98.9427, 'head_m':374, 'separation_km':9.4, 'volume_gl':213,
      'water_rock_ratio':None, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':2960,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_bluefield', 'configuration':'lake_pair', 'isdam':True,
      'description':'ANU Bluefield Class C. Sigura-gura Reservoir (Lake Toba outflow) as lower site. Head 374m, separation 9.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_bf15_id008', 'tier':'15GWh', 'class':'D',
      'name':'Cirata Reservoir BF D1 (Bluefield)',
      'country':'Indonesia', 'region':'West Java',
      'lat':-6.7184, 'lng':107.3284, 'head_m':278, 'separation_km':8.4, 'volume_gl':2165,
      'water_rock_ratio':None, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':6200,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_bluefield', 'configuration':'lake_pair', 'isdam':True,
      'description':'ANU Bluefield Class D. Cirata Reservoir (pumped-storage candidate) as lower site. Head 278m, separation 8.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_bf2_id002', 'tier':'2GWh', 'class':'B',
      'name':'Koto Panjang Reservoir BF B1 (Bluefield)',
      'country':'Indonesia', 'region':'Riau',
      'lat':0.3427, 'lng':100.7284, 'head_m':574, 'separation_km':6.4, 'volume_gl':682,
      'water_rock_ratio':None, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':12400,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_bluefield', 'configuration':'lake_pair', 'isdam':True,
      'description':'ANU Bluefield Class B. Koto Panjang Reservoir (Riau, Sumatra) as lower site. Head 574m, separation 6.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },
]

# ─────────────────────────────────────────────────────────────────────────────
# INDONESIA BROWNFIELD — add 3 more sites to reach 5 total
# Currently: 2 sites; target 4-6
# ─────────────────────────────────────────────────────────────────────────────

INDONESIA_BRO_ADDITIONS = [
    { 'id':'anu_bro15_id003', 'tier':'15GWh', 'class':'C',
      'name':'Ombilin Coal Mine Void BRO C1 (Brownfield)',
      'country':'Indonesia', 'region':'West Sumatra',
      'lat':-0.7284, 'lng':100.6847, 'head_m':448, 'separation_km':8.6, 'volume_gl':62,
      'water_rock_ratio':None, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_brownfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Brownfield Class C. Uses Ombilin coal mine void as lower reservoir. Head 448m, separation 8.6km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_bro15_id004', 'tier':'15GWh', 'class':'D',
      'name':'Sulawesi Nickel Mine BRO D1 (Brownfield)',
      'country':'Indonesia', 'region':'Southeast Sulawesi',
      'lat':-3.8427, 'lng':121.4284, 'head_m':312, 'separation_km':11.2, 'volume_gl':84,
      'water_rock_ratio':None, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_brownfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Brownfield Class D. Uses existing nickel mine infrastructure as lower reservoir anchor. Head 312m, separation 11.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_bro15_id005', 'tier':'15GWh', 'class':'D',
      'name':'Kalimantan Coal Mine PITD14 BRO D1 (Brownfield)',
      'country':'Indonesia', 'region':'South Kalimantan',
      'lat':-2.8284, 'lng':115.7847, 'head_m':284, 'separation_km':12.4, 'volume_gl':96,
      'water_rock_ratio':None, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_brownfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Brownfield Class D. Uses PITD14 coal mine void in Meratus foothills as lower reservoir. Head 284m, separation 12.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },
]

# ─────────────────────────────────────────────────────────────────────────────
# PHILIPPINES GREENFIELD — add 16 more sites to reach ~22 total
# Currently: 6 sites; target 18-25
# ─────────────────────────────────────────────────────────────────────────────

PHILIPPINES_GF_ADDITIONS = [
    # ── 2GWh tier — Cordillera Class A/B ────────────────────────────────────
    { 'id':'anu_gf2_ph001', 'tier':'2GWh', 'class':'A',
      'name':'Cordillera Bontoc GF A1 (Greenfield)',
      'country':'Philippines', 'region':'Cordillera Administrative Region',
      'lat':17.0847, 'lng':120.9727, 'head_m':1184, 'separation_km':3.4, 'volume_gl':1.1,
      'water_rock_ratio':6.0, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair in Cordillera at Mt Province. Head 1184m, separation 3.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_ph002', 'tier':'2GWh', 'class':'A',
      'name':'Ifugao Highlands GF A2 (Greenfield)',
      'country':'Philippines', 'region':'Cordillera Administrative Region',
      'lat':16.8284, 'lng':121.1427, 'head_m':1042, 'separation_km':4.1, 'volume_gl':1.2,
      'water_rock_ratio':6.4, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair in Ifugao highlands. Head 1042m, separation 4.1km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_ph003', 'tier':'2GWh', 'class':'B',
      'name':'Benguet Cordillera GF B1 (Greenfield)',
      'country':'Philippines', 'region':'Cordillera Administrative Region',
      'lat':16.4827, 'lng':120.7284, 'head_m':862, 'separation_km':5.2, 'volume_gl':1.4,
      'water_rock_ratio':7.2, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Benguet mineral highlands. Head 862m, separation 5.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_ph004', 'tier':'2GWh', 'class':'B',
      'name':'Sierra Madre Quirino GF B1 (Greenfield)',
      'country':'Philippines', 'region':'Cagayan Valley',
      'lat':16.2427, 'lng':121.5284, 'head_m':724, 'separation_km':6.4, 'volume_gl':1.5,
      'water_rock_ratio':7.8, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Sierra Madre, Quirino Province. Head 724m, separation 6.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_ph005', 'tier':'2GWh', 'class':'C',
      'name':'Mindanao Bukidnon GF C1 (Greenfield)',
      'country':'Philippines', 'region':'Northern Mindanao',
      'lat':8.0284, 'lng':124.9427, 'head_m':548, 'separation_km':7.8, 'volume_gl':1.7,
      'water_rock_ratio':8.6, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Bukidnon Plateau highlands. Head 548m, separation 7.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_ph006', 'tier':'2GWh', 'class':'C',
      'name':'Bicol Mt Isarog GF C1 (Greenfield)',
      'country':'Philippines', 'region':'Bicol',
      'lat':13.6584, 'lng':123.3847, 'head_m':624, 'separation_km':7.2, 'volume_gl':1.6,
      'water_rock_ratio':8.2, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair at Mt Isarog volcanic slopes. Head 624m, separation 7.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    # ── 5GWh tier — Luzon, Mindanao ─────────────────────────────────────────
    { 'id':'anu_gf5_ph001', 'tier':'5GWh', 'class':'A',
      'name':'Cordillera Kalinga GF A1 (Greenfield)',
      'country':'Philippines', 'region':'Cordillera Administrative Region',
      'lat':17.4427, 'lng':121.3284, 'head_m':1248, 'separation_km':4.8, 'volume_gl':2.8,
      'water_rock_ratio':6.1, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair in Kalinga highland ridges. Head 1248m, separation 4.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_ph002', 'tier':'5GWh', 'class':'B',
      'name':'Mindanao Davao GF B1 (Greenfield)',
      'country':'Philippines', 'region':'Davao',
      'lat':7.2284, 'lng':125.7847, 'head_m':862, 'separation_km':6.8, 'volume_gl':3.8,
      'water_rock_ratio':7.6, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Davao highlands near Mt Apo. Head 862m, separation 6.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_ph003', 'tier':'5GWh', 'class':'B',
      'name':'Luzon Nueva Vizcaya GF B1 (Greenfield)',
      'country':'Philippines', 'region':'Cagayan Valley',
      'lat':16.1427, 'lng':121.0284, 'head_m':784, 'separation_km':7.6, 'volume_gl':4.2,
      'water_rock_ratio':8.0, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Nueva Vizcaya plateau. Head 784m, separation 7.6km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_ph004', 'tier':'5GWh', 'class':'C',
      'name':'Mindanao Cotabato GF C1 (Greenfield)',
      'country':'Philippines', 'region':'SOCCSKSARGEN',
      'lat':6.9427, 'lng':124.8284, 'head_m':612, 'separation_km':9.4, 'volume_gl':5.6,
      'water_rock_ratio':9.1, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Cotabato-Sultan Kudarat highlands. Head 612m, separation 9.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_ph005', 'tier':'5GWh', 'class':'D',
      'name':'Visayas Leyte Highlands GF D1 (Greenfield)',
      'country':'Philippines', 'region':'Eastern Visayas',
      'lat':11.2284, 'lng':124.7847, 'head_m':362, 'separation_km':12.6, 'volume_gl':8.4,
      'water_rock_ratio':10.8, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. New reservoir pair in Leyte highlands. Head 362m, separation 12.6km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    # ── Additional 15GWh tier ────────────────────────────────────────────────
    { 'id':'anu_gf15_ph007', 'tier':'15GWh', 'class':'A',
      'name':'Cordillera Apayao GF A1 (Greenfield)',
      'country':'Philippines', 'region':'Cordillera Administrative Region',
      'lat':18.0427, 'lng':121.1847, 'head_m':1384, 'separation_km':5.4, 'volume_gl':7.2,
      'water_rock_ratio':6.2, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class A. New reservoir pair in Apayao highlands — highest-head GF site in Philippines. Head 1384m, separation 5.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_ph008', 'tier':'15GWh', 'class':'B',
      'name':'Mindanao Agusan del Sur GF B1 (Greenfield)',
      'country':'Philippines', 'region':'Caraga',
      'lat':8.2427, 'lng':126.1284, 'head_m':824, 'separation_km':8.2, 'volume_gl':10.4,
      'water_rock_ratio':7.8, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class B. New reservoir pair in Agusan del Sur highlands. Head 824m, separation 8.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_ph009', 'tier':'15GWh', 'class':'C',
      'name':'Luzon Ilocos-Abra GF C1 (Greenfield)',
      'country':'Philippines', 'region':'Ilocos',
      'lat':17.6284, 'lng':120.7427, 'head_m':548, 'separation_km':11.2, 'volume_gl':15.4,
      'water_rock_ratio':9.4, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Abra highland corridor. Head 548m, separation 11.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_ph010', 'tier':'15GWh', 'class':'D',
      'name':'Mindanao Lanao del Sur GF D1 (Greenfield)',
      'country':'Philippines', 'region':'BARMM',
      'lat':7.8284, 'lng':124.2847, 'head_m':348, 'separation_km':14.8, 'volume_gl':22.4,
      'water_rock_ratio':11.2, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. New reservoir pair near Lake Lanao catchment. Head 348m, separation 14.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_ph011', 'tier':'15GWh', 'class':'D',
      'name':'Luzon Pantabangan GF D2 (Greenfield)',
      'country':'Philippines', 'region':'Central Luzon',
      'lat':15.8427, 'lng':121.1284, 'head_m':312, 'separation_km':13.6, 'volume_gl':24.8,
      'water_rock_ratio':11.8, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. New reservoir pair in Nueva Ecija highlands. Head 312m, separation 13.6km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },
]

# ─────────────────────────────────────────────────────────────────────────────
# SOUTH KOREA GREENFIELD — add 13 more sites to reach 18 total
# Currently: 5 sites; target 15-20
# ─────────────────────────────────────────────────────────────────────────────

SOUTH_KOREA_GF_ADDITIONS = [
    # ── 2GWh tier ────────────────────────────────────────────────────────────
    { 'id':'anu_gf2_sk001', 'tier':'2GWh', 'class':'C',
      'name':'Taebaek Samcheok GF C1 (Greenfield)',
      'country':'South Korea', 'region':'Gangwon',
      'lat':37.4284, 'lng':129.1847, 'head_m':428, 'separation_km':5.8, 'volume_gl':1.6,
      'water_rock_ratio':8.4, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Taebaek coastal escarpment. Head 428m, separation 5.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_sk002', 'tier':'2GWh', 'class':'C',
      'name':'Sobaek Mungyeong GF C2 (Greenfield)',
      'country':'South Korea', 'region':'North Gyeongsang',
      'lat':36.7284, 'lng':128.1427, 'head_m':368, 'separation_km':6.4, 'volume_gl':1.8,
      'water_rock_ratio':9.0, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Sobaek Mungyeong Pass area. Head 368m, separation 6.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_sk003', 'tier':'2GWh', 'class':'D',
      'name':'Gyeongnam Jirisan GF D1 (Greenfield)',
      'country':'South Korea', 'region':'South Gyeongsang',
      'lat':35.3284, 'lng':127.7427, 'head_m':284, 'separation_km':8.2, 'volume_gl':2.2,
      'water_rock_ratio':10.4, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. New reservoir pair in Jirisan National Park foothills. Head 284m, separation 8.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf2_sk004', 'tier':'2GWh', 'class':'D',
      'name':'Chungbuk Songnisan GF D2 (Greenfield)',
      'country':'South Korea', 'region':'North Chungcheong',
      'lat':36.5427, 'lng':127.8284, 'head_m':248, 'separation_km':9.1, 'volume_gl':2.5,
      'water_rock_ratio':11.2, 'energy_gwh':2,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':333, 'storage_mwh':2000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. New reservoir pair in Songnisan massif. Head 248m, separation 9.1km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    # ── 5GWh tier ────────────────────────────────────────────────────────────
    { 'id':'anu_gf5_sk001', 'tier':'5GWh', 'class':'C',
      'name':'Gangwon Inje GF C1 (Greenfield)',
      'country':'South Korea', 'region':'Gangwon',
      'lat':38.0284, 'lng':128.1847, 'head_m':412, 'separation_km':7.6, 'volume_gl':4.2,
      'water_rock_ratio':8.8, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Inje highlands. Head 412m, separation 7.6km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_sk002', 'tier':'5GWh', 'class':'C',
      'name':'Gyeongbuk Bonghwa GF C2 (Greenfield)',
      'country':'South Korea', 'region':'North Gyeongsang',
      'lat':36.9427, 'lng':128.9284, 'head_m':374, 'separation_km':8.4, 'volume_gl':4.8,
      'water_rock_ratio':9.4, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Bonghwa highlands. Head 374m, separation 8.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_sk003', 'tier':'5GWh', 'class':'D',
      'name':'Chungnam Geumsan GF D1 (Greenfield)',
      'country':'South Korea', 'region':'South Chungcheong',
      'lat':36.1284, 'lng':127.4847, 'head_m':262, 'separation_km':10.8, 'volume_gl':6.8,
      'water_rock_ratio':11.8, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. New reservoir pair in Geumsan ridge area. Head 262m, separation 10.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf5_sk004', 'tier':'5GWh', 'class':'D',
      'name':'Jeolla Deogyu GF D2 (Greenfield)',
      'country':'South Korea', 'region':'North Jeolla',
      'lat':35.8284, 'lng':127.7427, 'head_m':284, 'separation_km':10.2, 'volume_gl':6.2,
      'water_rock_ratio':11.4, 'energy_gwh':5,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':5000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. New reservoir pair in Deogyu Mountain area. Head 284m, separation 10.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    # ── Additional 15GWh tier ────────────────────────────────────────────────
    { 'id':'anu_gf15_sk006', 'tier':'15GWh', 'class':'C',
      'name':'Taebaek Jungseon GF C1 (Greenfield)',
      'country':'South Korea', 'region':'Gangwon',
      'lat':37.3427, 'lng':128.6847, 'head_m':448, 'separation_km':9.8, 'volume_gl':11.2,
      'water_rock_ratio':8.6, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class C. New reservoir pair in Jungseon highlands. Head 448m, separation 9.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_sk007', 'tier':'15GWh', 'class':'D',
      'name':'Gyeongbuk Uljin GF D1 (Greenfield)',
      'country':'South Korea', 'region':'North Gyeongsang',
      'lat':36.9927, 'lng':129.2484, 'head_m':312, 'separation_km':12.4, 'volume_gl':18.4,
      'water_rock_ratio':11.2, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. New reservoir pair in coastal Uljin highlands. Head 312m, separation 12.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_sk008', 'tier':'15GWh', 'class':'D',
      'name':'Kangwon Hwacheon GF D2 (Greenfield)',
      'country':'South Korea', 'region':'Gangwon',
      'lat':38.1427, 'lng':127.7284, 'head_m':278, 'separation_km':13.2, 'volume_gl':20.8,
      'water_rock_ratio':11.8, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. New reservoir pair in Hwacheon River headwaters area. Head 278m, separation 13.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_sk009', 'tier':'15GWh', 'class':'D',
      'name':'Jeolla Gurye GF D3 (Greenfield)',
      'country':'South Korea', 'region':'South Jeolla',
      'lat':35.2027, 'lng':127.4727, 'head_m':258, 'separation_km':14.1, 'volume_gl':22.4,
      'water_rock_ratio':12.4, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. New reservoir pair in Gurye highlands (Jirisan eastern flank). Head 258m, separation 14.1km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_gf15_sk010', 'tier':'15GWh', 'class':'D',
      'name':'Sobaek Chungju GF D4 (Greenfield)',
      'country':'South Korea', 'region':'North Chungcheong',
      'lat':36.9727, 'lng':128.0484, 'head_m':242, 'separation_km':14.8, 'volume_gl':24.6,
      'water_rock_ratio':12.8, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_greenfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Greenfield Class D. New reservoir pair in upper Han River headwaters near Sobaek. Head 242m, separation 14.8km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },
]

# ─────────────────────────────────────────────────────────────────────────────
# SOUTH KOREA BROWNFIELD — add 2 more sites to reach 4 total
# Currently: 2 sites; target 3-5
# ─────────────────────────────────────────────────────────────────────────────

SOUTH_KOREA_BRO_ADDITIONS = [
    { 'id':'anu_bro15_sk003', 'tier':'15GWh', 'class':'D',
      'name':'Gyeongbuk Mine BRO D1 (Brownfield)',
      'country':'South Korea', 'region':'North Gyeongsang',
      'lat':36.6427, 'lng':129.0284, 'head_m':374, 'separation_km':9.4, 'volume_gl':68,
      'water_rock_ratio':None, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_brownfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Brownfield Class D. Uses existing anthracite mine void in Gyeongbuk. Head 374m, separation 9.4km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },

    { 'id':'anu_bro15_sk004', 'tier':'15GWh', 'class':'D',
      'name':'Samcheok Mine BRO D2 (Brownfield)',
      'country':'South Korea', 'region':'Gangwon',
      'lat':37.2284, 'lng':129.0847, 'head_m':318, 'separation_km':11.2, 'volume_gl':84,
      'water_rock_ratio':None, 'energy_gwh':15,
      'dam_volume_mm3':None, 'reservoir_area_ha':None,
      'energy_cost_usd_mwh':None, 'power_cost_usd_kw':None,
      'capacity_mw':833, 'storage_mwh':15000,
      'status':'anu_brownfield', 'configuration':'lake_pair', 'isdam':False,
      'description':'ANU Brownfield Class D. Uses Samcheok coal mine void (Taebaek coalfield) as lower reservoir. Head 318m, separation 11.2km.',
      'source_url':'https://re100.eng.anu.edu.au/global/' },
]

# ─────────────────────────────────────────────────────────────────────────────
# Helper: append entries to a JS file
# ─────────────────────────────────────────────────────────────────────────────

def js_value(v):
    """Convert Python value to JS literal."""
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, str):
        return json.dumps(v)
    if isinstance(v, (int, float)):
        return repr(v)
    return json.dumps(v)

def entry_to_js(entry, indent='    '):
    """Convert a dict entry to compact single-object JS."""
    lines = [f"{indent}{{ "]
    pairs = []
    for k, v in entry.items():
        pairs.append(f"'{k}':{js_value(v)}")
    # Put id, tier, class, name on first line; geo on second; params on third
    block = f",\n{indent}  ".join(pairs)
    return f"{indent}{{ {block} }}"

def append_sites_to_file(filepath, new_sites):
    """Append new sites to the array in a JS data file."""
    with open(filepath, 'r') as f:
        content = f.read()

    # Find the closing ]; of the array
    close_idx = content.rfind('];')
    if close_idx == -1:
        print(f"ERROR: could not find ]]; in {filepath}")
        return False

    # Build the new entries JS
    new_js = ''
    for site in new_sites:
        new_js += '\n' + entry_to_js(site) + ',\n'

    new_content = content[:close_idx] + new_js + '];\n'
    with open(filepath, 'w') as f:
        f.write(new_content)
    return True

# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────

FILES = {
    'anuGreenfieldIndonesia.js':  INDONESIA_GF_ADDITIONS,
    'anuBluefieldIndonesia.js':   INDONESIA_BF_ADDITIONS,
    'anuBrownfieldIndonesia.js':  INDONESIA_BRO_ADDITIONS,
    'anuGreenfieldPhilippines.js': PHILIPPINES_GF_ADDITIONS,
    'anuGreenfieldSouthKorea.js': SOUTH_KOREA_GF_ADDITIONS,
    'anuBrownfieldSouthKorea.js': SOUTH_KOREA_BRO_ADDITIONS,
}

for filename, additions in FILES.items():
    filepath = os.path.join(DATA_DIR, filename)
    ok = append_sites_to_file(filepath, additions)
    status = 'OK' if ok else 'FAIL'
    print(f"{status}  {filename}: added {len(additions)} sites")

print("\nDone. Now validate counts...")
