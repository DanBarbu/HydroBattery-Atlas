#!/usr/bin/env node
/**
 * HydroBattery Atlas — ANU Data Completeness Audit (Rigorous)
 * Usage: node scripts/audit-atlas.js [--json] [--fix]
 *
 * Checks:
 *   A. Geographic bounds — flags sites outside country bounding box
 *   B. Tier coverage — ocean files must have 2GWh, 15GWh, 50GWh tiers
 *   C. Ocean configuration — all ocean sites must have configuration: "lake_ocean"
 *   D. Upper/lower coords — reports fraction of ocean sites with upper_lat/lower_lat
 *   E. Known ANU site verification — checks specific confirmed ANU site IDs in names
 *   F. Minimum count sanity — warns if ocean site count seems too low
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'js', 'data');

// Countries registered in the atlas with their expected dataset types
const ATLAS_COUNTRIES = {
  Romania:       { coastal: false,  oceanLikely: false },
  Malaysia:      { coastal: true,   oceanLikely: true  },
  Indonesia:     { coastal: true,   oceanLikely: true  },
  Philippines:   { coastal: true,   oceanLikely: true  },
  'South Korea': { coastal: true,   oceanLikely: true  },
  Nigeria:       { coastal: true,   oceanLikely: false }, // flat Niger Delta coast
  Kenya:         { coastal: true,   oceanLikely: false }, // mostly flat coast
  Oman:          { coastal: true,   oceanLikely: true  },
  'Saudi Arabia':{ coastal: true,   oceanLikely: true  },
  UAE:           { coastal: true,   oceanLikely: true  },
};

// A. Geographic bounding boxes [latMin, latMax, lngMin, lngMax]
const COUNTRY_BOUNDS = {
  Romania:        [43.6, 48.3, 20.2, 30.0],
  Malaysia:       [0.9,  7.5,  99.6, 119.3],
  Indonesia:      [-11.0, 5.9, 95.0, 141.1],
  Philippines:    [4.6, 21.1, 116.9, 126.7],
  'South Korea':  [33.1, 38.6, 125.9, 129.6],
  Nigeria:        [4.3, 13.9,  2.7,  14.7],
  Kenya:          [-4.7, 5.0, 33.9,  41.9],
  Oman:           [16.5, 26.6, 51.8,  59.9],
  'Saudi Arabia': [16.2, 32.2, 34.5,  55.7],
  UAE:            [22.6, 26.1, 51.6,  56.5],
};

// B. Required ocean tiers
const OCEAN_REQUIRED_TIERS = ['2GWh', '15GWh', '50GWh'];

// E. Known ANU site reference IDs that must appear in ocean files
const KNOWN_ANU_SITES = {
  'Saudi Arabia': { file: 'anuOceanSaudiArabia.js', ref: 'n28_e035_RES68475' },
  UAE:            { file: 'anuOceanUAE.js',          ref: 'n25_e056_RES17226' },
};

// F. Minimum ocean site counts
const MIN_OCEAN_COUNTS = {
  UAE:            8,
  'Saudi Arabia': 12,
  Oman:           12,
  Malaysia:       20,
  Indonesia:      20,
  Philippines:    15,
  'South Korea':  10,
};

const STANDARD_TYPES = ['Greenfield', 'Bluefield', 'Brownfield'];
const OCEAN_TYPE = 'Ocean';

function camelCountry(country) {
  return country.replace(/\s+(\w)/g, (_, c) => c.toUpperCase());
}

function expectedFiles(country) {
  const camel = camelCountry(country);
  const files = STANDARD_TYPES.map(type => ({
    type,
    filename: `anu${type}${camel}.js`,
    key: `anu${type}${camel}`,
    isOcean: false,
  }));
  if (ATLAS_COUNTRIES[country]?.oceanLikely) {
    files.push({
      type: OCEAN_TYPE,
      filename: `anuOcean${camel}.js`,
      key: `anuOcean${camel}`,
      isOcean: true,
    });
  }
  return files;
}

function countSites(filepath) {
  try {
    const src = fs.readFileSync(filepath, 'utf8');
    return (src.match(/"id":/g) || []).length;
  } catch {
    return null;
  }
}

function parseOceanSites(filepath) {
  try {
    const src = fs.readFileSync(filepath, 'utf8');
    // Extract array content using a simple regex-based approach
    const sites = [];
    // Match each object between { and } (simplified for well-formatted JSON-like objects)
    const objRegex = /\{[^{}]*\}/gs;
    const matches = src.match(objRegex) || [];
    for (const obj of matches) {
      try {
        // Try to parse individual objects
        const site = JSON.parse(obj);
        if (site.id) sites.push(site);
      } catch {
        // Try key-value extraction
        const idMatch = obj.match(/"id":\s*"([^"]+)"/);
        const latMatch = obj.match(/"lat":\s*([-\d.]+)/);
        const lngMatch = obj.match(/"lng":\s*([-\d.]+)/);
        const tierMatch = obj.match(/"tier":\s*"([^"]+)"/);
        const configMatch = obj.match(/"configuration":\s*"([^"]+)"/);
        const nameMatch = obj.match(/"name":\s*"([^"]+)"/);
        const upperLatMatch = obj.match(/"upper_lat":\s*([-\d.]+)/);
        const lowerLatMatch = obj.match(/"lower_lat":\s*([-\d.]+)/);
        if (idMatch) {
          sites.push({
            id: idMatch[1],
            lat: latMatch ? parseFloat(latMatch[1]) : null,
            lng: lngMatch ? parseFloat(lngMatch[1]) : null,
            tier: tierMatch ? tierMatch[1] : null,
            configuration: configMatch ? configMatch[1] : null,
            name: nameMatch ? nameMatch[1] : null,
            upper_lat: upperLatMatch ? parseFloat(upperLatMatch[1]) : undefined,
            lower_lat: lowerLatMatch ? parseFloat(lowerLatMatch[1]) : undefined,
          });
        }
      }
    }
    return sites;
  } catch {
    return [];
  }
}

function checkBounds(country, sites) {
  const bounds = COUNTRY_BOUNDS[country];
  if (!bounds) return [];
  const [latMin, latMax, lngMin, lngMax] = bounds;
  return sites.filter(s =>
    s.lat !== null && s.lng !== null &&
    (s.lat < latMin || s.lat > latMax || s.lng < lngMin || s.lng > lngMax)
  );
}

function runAudit() {
  const results = [];
  let totalMissing = 0;
  let totalEmpty = 0;
  let totalSites = 0;
  let totalIssues = 0;

  for (const [country, meta] of Object.entries(ATLAS_COUNTRIES)) {
    const countryResult = { country, files: [], issues: [], oceanChecks: null };

    for (const { type, filename, isOcean } of expectedFiles(country)) {
      const filepath = path.join(DATA_DIR, filename);
      const count = countSites(filepath);
      const exists = count !== null;

      countryResult.files.push({ type, filename, exists, count: count ?? 0 });

      if (!exists) {
        totalMissing++;
        countryResult.issues.push(`✗ MISSING: ${filename}`);
      } else if (count === 0) {
        totalEmpty++;
        countryResult.issues.push(`⚠ EMPTY: ${filename} (0 sites)`);
      } else {
        totalSites += count;

        // Ocean-specific checks
        if (isOcean) {
          const sites = parseOceanSites(filepath);
          const oceanChecks = { filename, siteCount: sites.length };

          // A. Geographic bounds
          const outOfBounds = checkBounds(country, sites);
          oceanChecks.boundsIssues = outOfBounds.map(s => `${s.id} lat=${s.lat} lng=${s.lng}`);

          // B. Tier coverage
          const tiers = new Set(sites.map(s => s.tier).filter(Boolean));
          oceanChecks.tiersPresent = [...tiers].sort();
          oceanChecks.tiersMissing = OCEAN_REQUIRED_TIERS.filter(t => !tiers.has(t));

          // C. Ocean configuration
          const badConfig = sites.filter(s => s.configuration !== 'lake_ocean');
          oceanChecks.configIssues = badConfig.map(s => s.id);

          // D. Upper/lower coords coverage
          const withUpper = sites.filter(s => s.upper_lat !== undefined).length;
          const withLower = sites.filter(s => s.lower_lat !== undefined).length;
          oceanChecks.upperCoords = `${withUpper}/${sites.length}`;
          oceanChecks.lowerCoords = `${withLower}/${sites.length}`;

          // E. Known ANU site verification
          const knownSite = KNOWN_ANU_SITES[country];
          if (knownSite && knownSite.file === filename) {
            oceanChecks.knownSiteRef = knownSite.ref;
            oceanChecks.knownSiteFound = sites.some(s => s.name && s.name.includes(knownSite.ref));
          }

          // F. Minimum count sanity
          const minCount = MIN_OCEAN_COUNTS[country];
          if (minCount) {
            oceanChecks.minCount = minCount;
            oceanChecks.countOk = sites.length >= minCount;
          }

          countryResult.oceanChecks = oceanChecks;

          // Accumulate issues from ocean checks
          if (oceanChecks.boundsIssues && oceanChecks.boundsIssues.length > 0) {
            for (const b of oceanChecks.boundsIssues) {
              countryResult.issues.push(`⚠ OUT-OF-BOUNDS: ${b}`);
            }
          }
          if (oceanChecks.tiersMissing && oceanChecks.tiersMissing.length > 0) {
            for (const t of oceanChecks.tiersMissing) {
              countryResult.issues.push(`⚠ MISSING TIER: ${t}`);
            }
          }
          if (oceanChecks.configIssues && oceanChecks.configIssues.length > 0) {
            countryResult.issues.push(`⚠ BAD CONFIG: ${oceanChecks.configIssues.join(', ')}`);
          }
          if (oceanChecks.knownSiteRef && !oceanChecks.knownSiteFound) {
            countryResult.issues.push(`✗ KNOWN SITE NOT FOUND: ${oceanChecks.knownSiteRef}`);
          }
          if (oceanChecks.minCount && !oceanChecks.countOk) {
            countryResult.issues.push(`⚠ LOW SITE COUNT: ${sites.length} < min ${oceanChecks.minCount}`);
          }
        }
      }
    }

    totalIssues += countryResult.issues.length;
    results.push(countryResult);
  }

  return { results, totalMissing, totalEmpty, totalSites, totalIssues };
}

function printReport({ results, totalMissing, totalEmpty, totalSites, totalIssues }) {
  const hr = '─'.repeat(90);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     HydroBattery Atlas — ANU Coverage Audit (Rigorous)       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  for (const { country, files, issues, oceanChecks } of results) {
    const totalForCountry = files.reduce((s, f) => s + (f.count || 0), 0);
    const hasIssues = issues.length > 0;
    const icon = hasIssues ? '⚠' : '✓';
    console.log(`${icon}  ${country.padEnd(16)} (${totalForCountry} sites total)`);
    console.log(hr);

    for (const { type, filename, exists, count } of files) {
      let status;
      if (!exists)    status = '✗ MISSING';
      else if (!count) status = '⚠ EMPTY';
      else             status = `✓ ${count} sites`;

      console.log(`   ${type.padEnd(12)} ${filename.padEnd(42)} ${status}`);
    }

    if (oceanChecks) {
      const oc = oceanChecks;
      console.log();
      console.log(`   Ocean checks for ${oc.filename}:`);

      // Tiers
      const tierLine = OCEAN_REQUIRED_TIERS.map(t =>
        oc.tiersPresent.includes(t) ? `✓${t}` : `✗${t}`
      ).join('  ');
      console.log(`   Tiers:          ${tierLine}`);

      // Bounds
      if (oc.boundsIssues && oc.boundsIssues.length > 0) {
        console.log(`   Bounds:         ⚠ ${oc.boundsIssues.length} site(s) outside country bbox`);
        for (const b of oc.boundsIssues) console.log(`                   ⚠ ${b}`);
      } else {
        console.log(`   Bounds:         ✓ all sites within country bbox`);
      }

      // Config
      if (oc.configIssues && oc.configIssues.length > 0) {
        console.log(`   Config:         ✗ ${oc.configIssues.length} site(s) missing lake_ocean`);
      } else {
        console.log(`   Config:         ✓ all sites have configuration: lake_ocean`);
      }

      // Upper/lower coords
      const upperNum = parseInt(oc.upperCoords.split('/')[0]);
      const total    = parseInt(oc.upperCoords.split('/')[1]);
      const upperIcon = upperNum === total ? '✓' : (upperNum === 0 ? '✗' : '⚠');
      console.log(`   Upper coords:   ${upperIcon} ${oc.upperCoords} sites have upper_lat/upper_lng`);
      const lowerNum = parseInt(oc.lowerCoords.split('/')[0]);
      const lowerIcon = lowerNum === total ? '✓' : (lowerNum === 0 ? '✗' : '⚠');
      console.log(`   Lower coords:   ${lowerIcon} ${oc.lowerCoords} sites have lower_lat/lower_lng`);

      // Known ANU site
      if (oc.knownSiteRef !== undefined) {
        const kIcon = oc.knownSiteFound ? '✓' : '✗';
        console.log(`   Known site:     ${kIcon} ${oc.knownSiteRef} ${oc.knownSiteFound ? 'FOUND' : 'NOT FOUND'}`);
      }

      // Minimum count
      if (oc.minCount !== undefined) {
        const cIcon = oc.countOk ? '✓' : '⚠';
        console.log(`   Count sanity:   ${cIcon} ${oc.siteCount} sites (min ${oc.minCount})`);
      }
    }

    if (issues.length > 0) {
      console.log();
      for (const issue of issues) {
        console.log(`   ${issue}`);
      }
    }
    console.log();
  }

  console.log('═'.repeat(65));
  console.log(`  Total sites in atlas   : ${totalSites}`);
  console.log(`  Missing files          : ${totalMissing}`);
  console.log(`  Empty files (0 sites)  : ${totalEmpty}`);
  console.log(`  Total issues           : ${totalIssues}`);
  console.log('═'.repeat(65));

  if (totalIssues > 0) {
    console.log('\n⚠  Action needed — issues summary:');
    for (const { country, issues } of results) {
      for (const issue of issues) {
        console.log(`   [${country}] ${issue}`);
      }
    }
  } else {
    console.log('\n✓  All checks passed. Atlas data is complete and valid.');
  }
  console.log();
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

const args = process.argv.slice(2);
const audit = runAudit();

if (args.includes('--json')) {
  printJson(audit);
} else {
  printReport(audit);
}
