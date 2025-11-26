#!/usr/bin/env node
/**
 * fetch_all_tepco_regions.js
 * 
 * Fetches capacity data from all TEPCO regions and combines them into a single dataset.
 * Regions include: kikan (基幹系統) and all regional systems (tokyo23, kanagawa, etc.)
 * 
 * Usage:
 *   node tools/fetch_all_tepco_regions.js --out data/power/capacity/tepco_all_regions.json
 */

import { TEPCOCapacityFetcher } from './fetchers/tepco.js';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// TEPCO region configurations
const REGIONS = [
  {
    id: 'kikan',
    name: '基幹系統（275kV以上）',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_kikan.zip'
  },
  {
    id: 'tochigi',
    name: '栃木県',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_tochigi.zip'
  },
  {
    id: 'gunma',
    name: '群馬県',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_gunma.zip'
  },
  {
    id: 'ibaraki',
    name: '茨城県',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_ibaraki.zip'
  },
  {
    id: 'saitama',
    name: '埼玉県',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_saitama.zip'
  },
  {
    id: 'chiba',
    name: '千葉県',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_chiba.zip'
  },
  {
    id: 'tokyo23',
    name: '東京都[23区]',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_tokyo23.zip'
  },
  {
    id: 'tama',
    name: '東京都[多摩地区]',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_tama.zip'
  },
  {
    id: 'kanagawa',
    name: '神奈川県',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_kanagawa.zip'
  },
  {
    id: 'yamanashi',
    name: '山梨県',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_yamanashi.zip'
  },
  {
    id: 'shizuoka',
    name: '静岡県[富士川以東]',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_shizuoka.zip'
  },
  {
    id: 'fukushima',
    name: '福島県[一部]',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_fukushima.zip'
  },
  {
    id: 'nagano',
    name: '長野県[一部]',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_nagano.zip'
  },
  {
    id: 'niigata',
    name: '新潟県[一部]',
    url: 'https://www.tepco.co.jp/pg/consignment/system/csv_new/csv_akiyouryou_niigata.zip'
  }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      out[key] = val;
      if (val !== true) i++;
    }
  }
  return out;
}

async function fetchRegion(region, retries = 3) {
  console.log(`\n[fetch-all] Fetching ${region.name} (${region.id})...`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const fetcher = new TEPCOCapacityFetcher({
        region: region.id,
        sourceUrl: region.url
      });

      const entries = await fetcher.fetch(false); // Non-strict validation
      console.log(`[fetch-all] ✓ ${region.name}: ${entries.length} entries`);
      
      return {
        region: region.id,
        regionName: region.name,
        entries,
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[fetch-all] ✗ Attempt ${attempt}/${retries} failed for ${region.name}: ${error.message}`);
      
      if (attempt < retries) {
        const backoff = Math.pow(2, attempt) * 1000;
        console.log(`[fetch-all] Retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      } else {
        console.error(`[fetch-all] ✗ Failed to fetch ${region.name} after ${retries} attempts`);
        return {
          region: region.id,
          regionName: region.name,
          entries: [],
          error: error.message,
          fetchedAt: new Date().toISOString()
        };
      }
    }
  }
}

async function main() {
  const argv = parseArgs();
  const outputPath = argv.out || './data/power/capacity/tepco_all_regions.json';
  const regions = argv.regions ? argv.regions.split(',') : null; // Optional: filter specific regions
  const parallel = argv.parallel === 'true'; // Optional: parallel fetching (not recommended due to rate limits)

  console.log('[fetch-all] TEPCO All Regions Capacity Data Fetcher');
  console.log('[fetch-all] =============================================');
  console.log(`[fetch-all] Output: ${outputPath}`);
  console.log(`[fetch-all] Parallel: ${parallel ? 'yes' : 'no (sequential)'}`);
  
  // Filter regions if specified
  const regionsToFetch = regions 
    ? REGIONS.filter(r => regions.includes(r.id))
    : REGIONS;

  console.log(`[fetch-all] Fetching ${regionsToFetch.length} regions...`);

  const results = [];
  
  if (parallel) {
    // Parallel fetching (faster but may hit rate limits)
    console.warn('[fetch-all] Warning: Parallel fetching may cause rate limit issues');
    const promises = regionsToFetch.map(region => fetchRegion(region));
    results.push(...await Promise.all(promises));
  } else {
    // Sequential fetching (recommended)
    for (const region of regionsToFetch) {
      const result = await fetchRegion(region);
      results.push(result);
      
      // Rate limiting: wait 2 seconds between regions
      if (regionsToFetch.indexOf(region) < regionsToFetch.length - 1) {
        console.log('[fetch-all] Waiting 2s before next region...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Combine all entries
  const allEntries = results.flatMap(r => r.entries || []);
  const failedRegions = results.filter(r => r.error);
  
  console.log('\n[fetch-all] =============================================');
  console.log(`[fetch-all] Summary:`);
  console.log(`[fetch-all]   Total regions: ${results.length}`);
  console.log(`[fetch-all]   Successful: ${results.length - failedRegions.length}`);
  console.log(`[fetch-all]   Failed: ${failedRegions.length}`);
  console.log(`[fetch-all]   Total entries: ${allEntries.length}`);
  
  if (failedRegions.length > 0) {
    console.log(`[fetch-all] Failed regions:`);
    failedRegions.forEach(r => {
      console.log(`[fetch-all]   - ${r.regionName}: ${r.error}`);
    });
  }

  // Regional breakdown
  console.log(`[fetch-all] Regional breakdown:`);
  results.forEach(r => {
    if (r.entries && r.entries.length > 0) {
      console.log(`[fetch-all]   - ${r.regionName}: ${r.entries.length} entries`);
    }
  });

  // Create output structure
  const output = {
    metadata: {
      fetchedAt: new Date().toISOString(),
      totalRegions: results.length,
      successfulRegions: results.length - failedRegions.length,
      failedRegions: failedRegions.length,
      totalEntries: allEntries.length,
      regions: results.map(r => ({
        region: r.region,
        regionName: r.regionName,
        entryCount: r.entries ? r.entries.length : 0,
        fetchedAt: r.fetchedAt,
        error: r.error || null
      }))
    },
    entries: allEntries
  };

  // Ensure output directory exists
  const outputDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  // Write combined output
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`[fetch-all] ✓ Wrote ${allEntries.length} entries to ${outputPath}`);

  // Also write just the entries array (for easier use with geo_locator)
  const entriesOnlyPath = outputPath.replace('.json', '_entries_only.json');
  await writeFile(entriesOnlyPath, JSON.stringify(allEntries, null, 2), 'utf-8');
  console.log(`[fetch-all] ✓ Wrote entries-only to ${entriesOnlyPath}`);

  process.exit(failedRegions.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('[fetch-all] Fatal error:', error);
  process.exit(1);
});
