#!/usr/bin/env node
/**
 * HydroBattery Atlas — ANU Data Completeness Audit
 * Usage: node scripts/audit-atlas.js [--json] [--fix]
 *
 * Reads all js/data/anu*.js files and reports coverage gaps.
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

const STANDARD_TYPES = ['Greenfield', 'Bluefield', 'Brownfield'];
const OCEAN_TYPE = 'Ocean';

// Expected file name → HB.Data key mapping
function expectedFiles(country) {
  const camel = country.replace(/\s+(\w)/g, (_, c) => c.toUpperCase());
  const files = STANDARD_TYPES.map(type => ({
    type,
    filename: `anu${type}${camel}.js`,
    key: `anu${type}${camel}`,
  }));
  if (ATLAS_COUNTRIES[country]?.oceanLikely) {
    files.push({
      type: OCEAN_TYPE,
      filename: `anuOcean${camel}.js`,
      key: `anuOcean${camel}`,
    });
  }
  return files;
}

function countSites(filepath) {
  try {
    const src = fs.readFileSync(filepath, 'utf8');
    return (src.match(/"id":/g) || []).length;
  } catch {
    return null; // file missing
  }
}

function runAudit() {
  const results = [];
  let totalMissing = 0;
  let totalEmpty = 0;
  let totalSites = 0;

  for (const [country, meta] of Object.entries(ATLAS_COUNTRIES)) {
    const countryResult = { country, files: [], issues: [] };

    for (const { type, filename } of expectedFiles(country)) {
      const filepath = path.join(DATA_DIR, filename);
      const count = countSites(filepath);
      const exists = count !== null;

      countryResult.files.push({ type, filename, exists, count: count ?? 0 });

      if (!exists) {
        totalMissing++;
        countryResult.issues.push(`MISSING: ${filename}`);
      } else if (count === 0) {
        totalEmpty++;
        countryResult.issues.push(`EMPTY: ${filename} (0 sites)`);
      } else {
        totalSites += count;
      }
    }

    results.push(countryResult);
  }

  return { results, totalMissing, totalEmpty, totalSites };
}

function printReport({ results, totalMissing, totalEmpty, totalSites }) {
  const COL = { country: 14, type: 12, file: 35, sites: 6, status: 10 };
  const hr = '─'.repeat(85);

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║     HydroBattery Atlas — ANU Coverage Audit          ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  for (const { country, files, issues } of results) {
    const totalForCountry = files.reduce((s, f) => s + (f.count || 0), 0);
    console.log(`▶  ${country.padEnd(16)} (${totalForCountry} sites total)`);
    console.log(hr);

    for (const { type, filename, exists, count } of files) {
      let status;
      if (!exists)   status = '✗ MISSING';
      else if (!count) status = '⚠ EMPTY';
      else             status = `✓ ${count} sites`;

      console.log(`   ${type.padEnd(12)} ${filename.padEnd(38)} ${status}`);
    }
    console.log();
  }

  console.log('═'.repeat(55));
  console.log(`  Total sites in atlas : ${totalSites}`);
  console.log(`  Missing files        : ${totalMissing}`);
  console.log(`  Empty files (0 sites): ${totalEmpty}`);
  console.log('═'.repeat(55));

  if (totalMissing + totalEmpty > 0) {
    console.log('\n⚠  Action needed:');
    for (const { country, issues } of results) {
      for (const issue of issues) {
        console.log(`   [${country}] ${issue}`);
      }
    }
  } else {
    console.log('\n✓  All expected files present with data.');
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
