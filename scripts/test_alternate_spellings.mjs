import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function run() {
  console.log('--- Testing Alternate Spellings Search & Extraction ---');
  const tempOut = path.join(__dirname, '_temp_alt_test.js');

  await esbuild.build({
    entryPoints: [path.join(projectRoot, 'utils.tsx')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: tempOut,
    external: ['react', 'react-dom', 'lucide-react', 'idb', 'firebase', 'jszip', 'papaparse'],
    define: {
      'import.meta.env.BASE_URL': JSON.stringify('/'),
      'import.meta.env.MODE': JSON.stringify('test'),
    },
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
  });

  const utils = await import('file:///' + tempOut.replace(/\\/g, '/'));

  // Create sample entries mimicking normalized dictionary
  const sampleEntries = [
    {
      Index: '44d70de80c0261b0',
      id: '44d70de80c0261b0',
      merged_id: '44d70de80c0261b0',
      Entry: 'dlv',
      Syllabary: 'Ꮲ',
      Definition: 'somewhere',
      Source: 'ced',
      source: 'ced',
      Entry_Tone: 'dlv̋',
      tone1: 'dlv̋',
      tone2: 'dlv̋:',
      alternate_spellings: [
        {
          translit: "ilvhdlv'i",
          syllabary: "ᎢᎸᏢᎢ",
          tone: "ịlṿ́hdlv̋'i",
          tone1: "ịlṿ́hdlv̋'i",
          tone2: "ilv́hdlv̋:'i",
          source: "ced"
        }
      ]
    },
    {
      Index: '65003d68052348e9',
      id: '65003d68052348e9',
      merged_id: '65003d68052348e9',
      Entry: 'ahani',
      Syllabary: 'ᎠᎭᏂ',
      Definition: 'here',
      Source: 'ced',
      source: 'ced',
      Entry_Tone: 'a²ha²ni',
      alternate_spellings: [
        {
          translit: 'ahni',
          syllabary: 'ᎠᏂ',
          tone: 'a²hni',
          source: 'ced'
        }
      ]
    }
  ];

  const settings = {
    searchMode: 'exact',
    enableRegex: false,
    colorWordSegments: true
  };

  // 1. Search 'ilvhdlv'
  console.log('\n1. Searching for alternate spelling "ilvhdlv"...');
  let results = utils.performSearch('ilvhdlv', sampleEntries, [], new Map(), settings, {}, {}, 'All', 'dictionary');
  console.log('Results returned:', results);
  if (results.length > 0 && results[0].Index === '44d70de80c0261b0') {
    console.log('  ✓ Matched dlv entry when searching "ilvhdlv"');
    console.log('  ✓ Score:', results[0].score);
    console.log('  ✓ matchedSpelling:', results[0].matchedSpelling);
    if (results[0].matchedSpelling && results[0].matchedSpelling.translit === "ilvhdlv'i") {
      console.log('  ✓ matchedSpelling correctly identifies "ilvhdlv\'i"');
    } else {
      console.error('  ✗ FAIL: matchedSpelling not populated correctly');
      process.exit(1);
    }
  } else {
    console.error('  ✗ FAIL: Did not match dlv on ilvhdlv');
    process.exit(1);
  }

  // 2. Search primary 'dlv'
  console.log('\n2. Searching for primary spelling "dlv"...');
  results = utils.performSearch('dlv', sampleEntries, [], new Map(), settings, {}, {}, 'All', 'dictionary');
  if (results.length > 0 && results[0].Index === '44d70de80c0261b0') {
    console.log('  ✓ Matched dlv entry when searching "dlv"');
    console.log('  ✓ matchedSpelling:', results[0].matchedSpelling);
    if (!results[0].matchedSpelling) {
      console.log('  ✓ Option A verified: matchedSpelling is null when primary entry matches');
    } else {
      console.error('  ✗ FAIL: matchedSpelling should be null for primary match');
      process.exit(1);
    }
  } else {
    console.error('  ✗ FAIL: Did not match dlv on dlv');
    process.exit(1);
  }

  // 3. Search syllabary 'ᎢᎸᏢᎢ'
  console.log('\n3. Searching for alternate syllabary "ᎢᎸᏢᎢ"...');
  results = utils.performSearch('ᎢᎸᏢᎢ', sampleEntries, [], new Map(), settings, {}, {}, 'All', 'dictionary');
  if (results.length > 0 && results[0].Index === '44d70de80c0261b0') {
    console.log('  ✓ Matched dlv entry when searching alternate syllabary "ᎢᎸᏢᎢ"');
    console.log('  ✓ matchedSpelling:', results[0].matchedSpelling);
    if (results[0].matchedSpelling && results[0].matchedSpelling.syllabary === "ᎢᎸᏢᎢ") {
      console.log('  ✓ matchedSpelling correctly has syllabary "ᎢᎸᏢᎢ"');
    } else {
      console.error('  ✗ FAIL: matchedSpelling syllabary missing');
      process.exit(1);
    }
  } else {
    console.error('  ✗ FAIL: Did not match on ᎢᎸᏢᎢ');
    process.exit(1);
  }

  // 4. Search 'ahni'
  console.log('\n4. Searching for alternate spelling "ahni"...');
  results = utils.performSearch('ahni', sampleEntries, [], new Map(), settings, {}, {}, 'All', 'dictionary');
  if (results.length > 0 && results[0].Index === '65003d68052348e9') {
    console.log('  ✓ Matched ahani entry when searching alternate spelling "ahni"');
    console.log('  ✓ matchedSpelling:', results[0].matchedSpelling);
  } else {
    console.error('  ✗ FAIL: Did not match ahani on ahni');
    process.exit(1);
  }

  // Cleanup temp file
  if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
  console.log('\n=== ALL ALTERNATE SPELLING TESTS PASSED! ===');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
