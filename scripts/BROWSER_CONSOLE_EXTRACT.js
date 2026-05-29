/**
 * ANU Ocean PHES Site Extractor — Browser Console Snippet
 * Covers: UAE, Saudi Arabia, Oman, Malaysia, Indonesia, Philippines, South Korea
 *
 * HOW TO USE:
 * 1. Open https://danbarbu.github.io/hydrobattery-atlas/ in Chrome or Firefox (desktop)
 * 2. Press Ctrl+Shift+I (or right-click → Inspect) to open DevTools → "Console" tab
 * 3. If Chrome shows "allow pasting" warning, type: allow pasting  then press Enter
 * 4. Paste this entire script and press Enter
 * 5. Wait ~90 seconds while it queries all tiers & regions (21 regions × 4 tiers)
 * 6. Copy the output and paste it to Claude
 *
 * WHY this works from the browser but not from the server:
 * The ANU GeoServer allows requests from your browser's IP.
 * Cloud servers have different IPs that ANU has not whitelisted.
 */

(async function extractANUOceanSites() {
  const WFS = 'https://re100.anu.edu.au/geoserver/global_ocean/wfs';

  const TIERS = [
    { key: '2gwh_6h',   label: '2GWh',  mw: 333,  h: 6,  e: 2  },
    { key: '5gwh_18h',  label: '5GWh',  mw: 278,  h: 18, e: 5  },
    { key: '15gwh_18h', label: '15GWh', mw: 833,  h: 18, e: 15 },
    { key: '50gwh_18h', label: '50GWh', mw: 2778, h: 18, e: 50 },
  ];

  // [display name, [west, south, east, north], fallback country]
  const REGIONS = [
    // UAE
    ['UAE — Gulf of Oman',           [55.5, 23.0, 60.5, 26.5], 'United Arab Emirates'],
    ['UAE — Arabian Gulf',           [54.5, 24.5, 57.5, 27.0], 'United Arab Emirates'],
    // Saudi Arabia
    ['SA — Gulf of Aqaba',           [34.2, 26.0, 36.5, 30.0], 'Saudi Arabia'],
    ['SA — Red Sea North',           [35.5, 23.5, 40.0, 28.5], 'Saudi Arabia'],
    ['SA — Red Sea Central',         [38.5, 18.5, 43.5, 24.5], 'Saudi Arabia'],
    ['SA — Red Sea South',           [41.0, 14.5, 45.0, 20.5], 'Saudi Arabia'],
    // Oman
    ['Oman — Gulf of Oman coast',    [52.0, 20.0, 60.0, 25.0], 'Oman'],
    ['Oman — Arabian Sea coast',     [51.0, 16.0, 58.0, 22.0], 'Oman'],
    // Malaysia
    ['Malaysia — Peninsular',        [99.0,  1.0, 105.0,  8.0], 'Malaysia'],
    ['Malaysia — Sabah',             [115.0, 4.0, 120.0,  7.5], 'Malaysia'],
    ['Malaysia — Sarawak',           [108.0, 0.5, 116.0,  6.0], 'Malaysia'],
    // Indonesia
    ['Indonesia — Sumatra',          [95.0, -6.0, 108.0,  6.0], 'Indonesia'],
    ['Indonesia — Java',             [105.0,-9.0, 116.0, -5.0], 'Indonesia'],
    ['Indonesia — Sulawesi',         [118.0,-5.0, 126.0,  5.0], 'Indonesia'],
    ['Indonesia — Nusa Tenggara',    [115.0,-10.0,125.0, -7.0], 'Indonesia'],
    ['Indonesia — Maluku',           [124.0,-8.0, 136.0,  4.0], 'Indonesia'],
    ['Indonesia — Papua',            [130.0,-10.0,142.0, -1.0], 'Indonesia'],
    // Philippines
    ['Philippines — Luzon',          [118.0, 14.0, 127.0, 21.0], 'Philippines'],
    ['Philippines — Visayas',        [120.0,  8.0, 127.0, 13.0], 'Philippines'],
    ['Philippines — Mindanao',       [121.0,  5.0, 127.0, 10.0], 'Philippines'],
    // South Korea
    ['South Korea',                  [125.0, 33.0, 130.0, 39.0], 'South Korea'],
  ];

  const COUNTRY_MAP = {
    'United Arab Emirates': { cc: 'ae', jsName: 'anuOceanUAE' },
    'Saudi Arabia':         { cc: 'sa', jsName: 'anuOceanSaudiArabia' },
    'Oman':                 { cc: 'om', jsName: 'anuOceanOman' },
    'Malaysia':             { cc: 'my', jsName: 'anuOceanMalaysia' },
    'Indonesia':            { cc: 'id', jsName: 'anuOceanIndonesia' },
    'Philippines':          { cc: 'ph', jsName: 'anuOceanPhilippines' },
    'South Korea':          { cc: 'kr', jsName: 'anuOceanSouthKorea' },
  };

  const parseDesc = html => {
    if (!html) return {};
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const d = {};
      doc.querySelectorAll('tr').forEach(tr => {
        const cells = [...tr.querySelectorAll('td,th')];
        if (cells.length >= 2) d[cells[0].textContent.trim().replace(/:$/,'')] = cells[1].textContent.trim();
      });
      return d;
    } catch { return {}; }
  };

  const centroid = geo => {
    const coords = geo.type === 'MultiPolygon' ? geo.coordinates[0][0] : geo.coordinates[0];
    const lats = coords.map(c=>c[1]), lngs = coords.map(c=>c[0]);
    return [+((Math.min(...lats)+Math.max(...lats))/2).toFixed(5),
            +((Math.min(...lngs)+Math.max(...lngs))/2).toFixed(5)];
  };

  const dget = (d,...keys) => { for(const k of keys) if(d[k]) return d[k]; return null; };
  const flt = v => { const n = parseFloat(v||0); return n||null; };

  const sites = [], seen = new Set();
  let failed = 0;

  for (const tier of TIERS) {
    console.log(`\n── ${tier.label} ──`);
    for (const [rname, [b0,b1,b2,b3], fallbackCountry] of REGIONS) {
      const url = `${WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=global_ocean:${tier.key}&outputFormat=application%2Fjson&count=500&bbox=${b0},${b1},${b2},${b3},EPSG:4326`;
      try {
        const gj = await fetch(url).then(r => { if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
        const all = gj.features || [];
        const uppers = all.filter(f => !f.properties.isdam && !f.properties.ispipe && String(f.properties.isupper) === '1');
        const pipeMap = Object.fromEntries(all.filter(f=>f.properties.ispipe).map(f=>[f.properties.identifier||'',f]));

        let added = 0;
        for (const f of uppers) {
          const id = f.properties.identifier || '';
          if (seen.has(id)) continue;
          seen.add(id); added++;
          const [lat,lng] = centroid(f.geometry);
          const d = parseDesc(f.properties.description);
          let ll = null, llng = null;
          const pipe = pipeMap[id];
          if (pipe?.geometry?.coordinates) {
            try { const last=pipe.geometry.coordinates.slice(-1)[0]; ll=+last[1].toFixed(5); llng=+last[0].toFixed(5); } catch{}
          }
          sites.push({
            raw_id:id, tier:tier.label, capacity_mw:tier.mw, storage_h:tier.h, energy_gwh:tier.e,
            class:dget(d,'Class'), country:dget(d,'Country')||fallbackCountry, region:rname,
            lat,lng, upper_lat:lat, upper_lng:lng, lower_lat:ll, lower_lng:llng,
            head_m:flt(dget(d,'Head (m)','Head')),
            separation_km:flt(dget(d,'Separation (km)','Separation')),
            slope_pct:flt(dget(d,'Average Slope (%)','Slope')),
            area_ha:flt(dget(d,'Area (ha)','Area')),
            vol_gl:flt(dget(d,'Volume (GL)','Volume')),
            wr:flt(dget(d,'Water/Rock Ratio','Water Rock Ratio','Water to Rock (Pair)')),
            dam_wall_m:flt(dget(d,'Dam Wall Height (m)','Dam Wall Height')),
          });
        }
        if (uppers.length > 0) console.log(`  ${rname} [${tier.label}]: ${uppers.length} features, ${added} new`);
      } catch(e) { console.warn(`  ${rname} [${tier.label}]: ${e.message}`); failed++; }
      await new Promise(r=>setTimeout(r,150));
    }
  }

  const tierOrd = {'50GWh':0,'15GWh':1,'5GWh':2,'2GWh':3};
  sites.sort((a,b)=> a.country!==b.country ? a.country.localeCompare(b.country)
                    : (tierOrd[a.tier]??9)-(tierOrd[b.tier]??9));

  const byCountry = {};
  sites.forEach(s => (byCountry[s.country]=byCountry[s.country]||[]).push(s));

  console.log('\n\n════════════════════════════════════');
  console.log(`TOTAL: ${sites.length} confirmed ANU ocean sites (${failed} queries failed)`);
  Object.entries(byCountry).forEach(([c,ss]) => {
    const tc={}; ss.forEach(s=>tc[s.tier]=(tc[s.tier]||0)+1);
    console.log(`  ${c}: ${ss.length} sites — ${JSON.stringify(tc)}`);
  });

  const mkJs = (countryName) => {
    const info = COUNTRY_MAP[countryName];
    if (!info) return '';
    const cs = byCountry[countryName] || [];
    const { cc, jsName } = info;
    const lines = [
      'window.HB = window.HB || {};',
      'HB.Data = HB.Data || {};',
      `// ANU Ocean PHES — ${countryName} | ${cs.length} confirmed sites from live WFS`,
      `HB.Data.${jsName} = [`
    ];
    cs.forEach((s,i) => {
      const tierStr = s.tier.toLowerCase().replace('gwh','');
      const id = `anu_oc${tierStr}_${cc}${String(i+1).padStart(3,'0')}`;
      const regionShort = s.region.split('—')[1]?.trim().split('(')[0].trim() || s.region;
      const obj = {
        id, tier:s.tier, class:s.class||'C',
        name:`${regionShort} ${s.tier} ${s.class||'C'} (${s.raw_id})`,
        country:s.country, region:regionShort,
        lat:s.lat, lng:s.lng, upper_lat:s.upper_lat, upper_lng:s.upper_lng,
        lower_lat:s.lower_lat, lower_lng:s.lower_lng,
        head_m:s.head_m, separation_km:s.separation_km, vol_gl:s.vol_gl, wr:s.wr,
        energy_gwh:s.energy_gwh, storage_h:s.storage_h, slope_pct:s.slope_pct,
        area_ha:s.area_ha, dam_wall_m:s.dam_wall_m, capacity_mw:s.capacity_mw,
        configuration:'lake_ocean', status:'anu_ocean'
      };
      lines.push('  '+JSON.stringify(obj)+(i<cs.length-1?',':''));
    });
    lines.push('];');
    return lines.join('\n');
  };

  let fullOutput = '==== PASTE THIS ENTIRE BLOCK TO CLAUDE ====\n\n';
  for (const [countryName] of Object.entries(COUNTRY_MAP)) {
    const cs = byCountry[countryName] || [];
    fullOutput += `=== ${countryName.toUpperCase()} (${cs.length} sites) ===\n${mkJs(countryName)}\n\n`;
  }
  fullOutput += `=== RAW JSON ===\n${JSON.stringify(sites, null, 2)}\n`;

  console.log(fullOutput);

  navigator.clipboard?.writeText(fullOutput)
    .then(() => console.log('\n✅ Copied to clipboard! Paste it to Claude.'))
    .catch(() => console.log('\nManually select and copy the output above.'));

})();
