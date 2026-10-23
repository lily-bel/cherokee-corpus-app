import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function run() {
  console.log('--- Compiling utils.tsx for tone search tests ---');
  const tempOut = path.join(__dirname, '_temp_search_test.js');
  
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
  console.log('Loaded utils successfully!\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`  ✓ ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${desc}`);
      failed++;
    }
  }

  function assertEqual(actual, expected, desc) {
    if (actual === expected) {
      console.log(`  ✓ ${desc}: "${actual}"`);
      passed++;
    } else {
      console.error(`  ✗ FAIL ${desc}:\n    Expected: "${expected}"\n    Actual:   "${actual}"`);
      failed++;
    }
  }

  // --- 1. Test transformToneRegex ---
  console.log('--- 1. Testing transformToneRegex ---');
  assertEqual(utils.transformToneRegex('ga2'), 'ga[2²]', 'Standalone digit 2 expanded');
  assertEqual(utils.transformToneRegex('ga[1-4]'), 'ga[1-4¹²³⁴]', 'Character class [1-4] expanded');
  assertEqual(utils.transformToneRegex('ga[¹-⁴]'), 'ga[1-4¹²³⁴]', 'Superscript class [¹-⁴] expanded');
  assertEqual(utils.transformToneRegex('ga[23]'), 'ga[2²3³]', 'Character class [23] expanded');
  assertEqual(utils.transformToneRegex('.{1,3}ga2'), '.{1,3}ga[2²]', 'Quantifier {1,3} preserved intact');
  assertEqual(utils.transformToneRegex('a{2}'), 'a{2}', 'Exact quantifier {2} preserved intact');
  assertEqual(utils.transformToneRegex('\\d+'), '\\d+', 'Escape \\d preserved intact');
  assertEqual(utils.transformToneRegex('\\1'), '\\1', 'Backreference \\1 preserved intact');

  // --- 2. Test Tone Search with Numbers (Matching Superscripts) ---
  console.log('\n--- 2. Testing Tone Search with Numbers ---');
  const sampleEntries = [
    {
      id: '1',
      Index: '1',
      Entry: 'gawoniha',
      Entry_Tone: 'ga²wo³ni³ha',
      Syllabary: 'ᎦᏬᏂᎭ',
      Definition: 'he is speaking',
      Source: 'ced'
    },
    {
      id: '2',
      Index: '2',
      Entry: 'gadaha',
      Entry_Tone: 'ga²da²ha',
      Syllabary: 'ᎦᏓᎭ',
      Definition: 'he is dirty',
      Source: 'ced'
    },
    {
      id: '3',
      Index: '3',
      Entry: 'galiha',
      // No tone data
      Syllabary: 'ᎦᎵᎭ',
      Definition: 'he is laughing',
      Source: 'user'
    }
  ];

  const defaultSettings = {
    searchLangs: { translit: true, syllabary: true, english: true },
    searchScopes: { main: true, otherForms: true, roots: true, sentences: false, notes: false },
    toneOrthography: 'feeling_1975',
    enableRegex: false
  };

  // Searching "ga2wo3" with ASCII numbers
  let res = utils.performSearch('ga2wo3', sampleEntries, [], new Map(), defaultSettings, {}, {}, "All", 'dictionary');
  assert(res.length === 1 && res[0].id === '1', 'Searching "ga2wo3" strictly matches ga²wo³ni³ha only');

  // Searching "ga2" matches both entry 1 and entry 2, strictly excluding entry 3 (which has no tone or mismatched tone)
  res = utils.performSearch('ga2', sampleEntries, [], new Map(), defaultSettings, {}, {}, "All", 'dictionary');
  assert(res.length === 2 && res.some(r => r.id === '1') && res.some(r => r.id === '2'), 'Searching "ga2" matches both ga² entries');
  assert(!res.some(r => r.id === '3'), 'Entry 3 (no matching tone) is strictly filtered out');

  // Searching "ga2da2" matches entry 2
  res = utils.performSearch('ga2da2', sampleEntries, [], new Map(), defaultSettings, {}, {}, "All", 'dictionary');
  assert(res.length === 1 && res[0].id === '2', 'Searching "ga2da2" matches only gadaha');

  // Searching with non-matching tone returns 0 results
  res = utils.performSearch('ga4', sampleEntries, [], new Map(), defaultSettings, {}, {}, "All", 'dictionary');
  assert(res.length === 0, 'Searching mismatched tone "ga4" strictly returns 0 results');

  // --- 3. Test Tone Search with Diacritics (MCO) ---
  console.log('\n--- 3. Testing Tone Search with Diacritics ---');
  const mcoSettings = {
    ...defaultSettings,
    toneOrthography: 'mco'
  };

  // In MCO, ga²wo³ni³ha renders as ga:wo:ní:ha (or gawoni:ha with diacritics depending on tone)
  // Let's test what ga²wo³ni³ha renders in MCO:
  const renderedMco = utils.convertToneText('ga²wo³ni³ha', 'mco');
  console.log('  Sample MCO rendering for ga²wo³ni³ha:', renderedMco);

  // Searching with ASCII numbers while in MCO orthography:
  // "If numbers are typed in query match durbin and selected orthography"
  res = utils.performSearch('ga2wo3', sampleEntries, [], new Map(), mcoSettings, {}, {}, "All", 'dictionary');
  assert(res.length === 1 && res[0].id === '1', 'Searching with numbers "ga2wo3" when MCO is selected still matches Durbin/MCO');

  // Searching with MCO string
  res = utils.performSearch(renderedMco, sampleEntries, [], new Map(), mcoSettings, {}, {}, "All", 'dictionary');
  assert(res.length === 1 && res[0].id === '1', 'Searching with MCO diacritic string matches entry 1');

  // --- 4. Test Regex Searching with Tone ---
  console.log('\n--- 4. Testing Regex Searching with Tone ---');
  const regexSettings = {
    ...defaultSettings,
    enableRegex: true
  };

  // Regex "ga[1-4]" with numbers in character class
  res = utils.performSearch('^ga[1-4]', sampleEntries, [], new Map(), regexSettings, {}, {}, "All", 'dictionary');
  assert(res.length === 2, 'Regex "^ga[1-4]" matches both ga² entries');

  // Regex with quantifiers like "ga2.*"
  res = utils.performSearch('^ga2.*ha$', sampleEntries, [], new Map(), regexSettings, {}, {}, "All", 'dictionary');
  assert(res.length === 2, 'Regex "^ga2.*ha$" matches entries ending in ha with tone 2');

  // Regex without tone: plain text regex
  res = utils.performSearch('^gaw', sampleEntries, [], new Map(), regexSettings, {}, {}, "All", 'dictionary');
  assert(res.length === 1 && res[0].id === '1', 'Non-tone regex "^gaw" matches gawoniha');

  // --- 5. Test Other Forms Matching and Matched Form Display ---
  console.log('\n--- 5. Testing Other Forms Tone Matching ---');
  const entryWithForms = {
    id: '10',
    Index: '10',
    Entry: 'gowatiha',
    Entry_Tone: 'go²wa²ti³ha',
    Syllabary: 'ᎪᏩᏘᎭ',
    Definition: 'he sees it',
    Source: 'ced'
  };

  const wordFormsMap = new Map();
  wordFormsMap.set('10', [
    {
      form_name: 'infinitive',
      translit: 'uwatihti',
      surface_spelling: 'uwatihti',
      tone: 'u²wa²ti³hdi',
      tone1: 'u²wa²ti³hdi',
      syllabary: 'ᎤᏩᏘhti'
    },
    {
      form_name: 'past',
      translit: 'uwatihv',
      surface_spelling: 'uwatihv',
      tone: 'u²wa²ti³²hv',
      tone1: 'u²wa²ti³²hv',
      syllabary: 'ᎤᏩᏘᎲ'
    }
  ]);

  // Searching for infinitive tone "u2wa2ti3"
  res = utils.performSearch('u2wa2ti3', [entryWithForms], [], new Map(), defaultSettings, {}, {}, "All", 'dictionary', [], new Map(), wordFormsMap);
  assert(res.length === 1, 'Searching infinitive tone finds parent entry');
  assert(res[0].matchedForm != null, 'Entry has matchedForm populated');
  assert(res[0].matchedForm.matchedByTone === true, 'matchedForm has matchedByTone: true');
  assert(res[0].matchedForm.tone != null, 'matchedForm has tone preserved');
  assert(res[0].matchedForm.label === 'infinitive', 'matchedForm has label="infinitive"');

  // Searching for past tone "ti32"
  res = utils.performSearch('ti32', [entryWithForms], [], new Map(), defaultSettings, {}, {}, "All", 'dictionary', [], new Map(), wordFormsMap);
  assert(res.length === 1, 'Searching past contour "ti32" matches');
  assert(res[0].matchedForm?.label === 'past', 'matchedForm has label="past"');

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log(`========================================`);

  if (fs.existsSync(tempOut)) {
    fs.unlinkSync(tempOut);
  }

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
