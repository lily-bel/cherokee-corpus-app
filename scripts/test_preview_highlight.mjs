import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function run() {
  console.log('--- Compiling utils.tsx and ReferenceFormsPreview.tsx for preview highlight tests ---');
  const tempOut = path.join(__dirname, '_temp_preview_test.js');
  
  await esbuild.build({
    entryPoints: [path.join(projectRoot, 'components', 'ReferenceFormsPreview.tsx')],
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

  const previewModule = await import('file:///' + tempOut.replace(/\\/g, '/'));
  console.log('Loaded ReferenceFormsPreview successfully!\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const { getReferencePreviewMatchedForms, getPreviewStripMatchedSlotKeys } = previewModule;

  // Sample verb entry with canonical forms
  const sampleEntry = {
    Index: '100',
    Entry: 'gawoniha',
    Entry_Tone: 'ga²wo³ni³ha',
    Syllabary: 'ᎦᏬᏂᎭ',
    Definition: 'he is speaking, talking',
    PoS: 'v.t.'
  };

  const sampleForms = [
    {
      form_name: '1s|3s|present',
      translit: 'jiwoniha',
      tone: 'ji²wo²ni³ha',
      syllabary: 'ᏥᏬᏂᎭ'
    },
    {
      form_name: '2s|3s|imperative',
      translit: 'hiwonihi',
      tone: 'hi²wo²ni³hi',
      syllabary: 'ᎯᏬᏂᎯ'
    },
    {
      form_name: '3s|3s|present',
      translit: 'gawoniha',
      tone: 'ga²wo³ni³ha',
      syllabary: 'ᎦᏬᏂᎭ'
    },
    {
      form_name: '3s|3s|habitual',
      translit: 'gawonihisgo\'i',
      tone: 'ga²wo³ni³hi³sgo³\'i',
      syllabary: 'ᎦᏬᏂᎯᏍᎪᎢ'
    },
    {
      form_name: '3s|3s|completive past',
      translit: 'uwonihsv\'i',
      tone: 'u²wo²ni³hsv́²\'i',
      syllabary: 'ᎤᏬᏂᏒᎢ'
    },
    {
      form_name: '3s|3s|infinitive',
      translit: 'uwonihisdi',
      tone: 'u²wo²ni³hi³sdi',
      syllabary: 'ᎤᏬᏂᎯᏍᏗ'
    },
    // Non-canonical form (e.g. 3p present - not in 6-8 preview)
    {
      form_name: '3p|3s|present',
      translit: 'anawoniha',
      tone: 'a²na²wo³ni³ha',
      syllabary: 'ᎠᎾᏬᏂᎭ'
    }
  ];

  const defaultSettings = {
    searchLangs: { translit: true, syllabary: true, english: true },
    toneOrthography: 'feeling_1975'
  };

  const { displayedCards, hasMiniPreview } = getReferencePreviewMatchedForms(sampleForms, sampleEntry, null, defaultSettings);
  assert(hasMiniPreview, 'Verb has mini preview');
  assert(displayedCards.length >= 6, `Mini preview has ${displayedCards.length} displayed cards`);
  console.log('displayedCards slots:', displayedCards.map(c => ({ slotKey: c.slotKey, form_name: c.form?.form_name, translit: c.form?.translit })));

  // --- Test 1: Search infinitive ---
  console.log('\n--- 1. Testing Single Preview Form Match (Infinitive) ---');
  let matchedKeys = getPreviewStripMatchedSlotKeys(displayedCards, 'uwonihisdi', defaultSettings, sampleEntry, null, {
    label: 'infinitive',
    translit: 'uwonihisdi',
    syllabary: 'ᎤᏬᏂᎯᏍᏗ'
  });
  assert(matchedKeys.size === 1, `Exactly 1 form matches (got ${matchedKeys.size})`);
  assert(matchedKeys.has('3s|3s|infinitive'), 'Matched slot is 3s|3s|infinitive');

  // Verify desktop hiding condition
  let anyPreviewMatches = hasMiniPreview && matchedKeys.size > 0;
  assert(anyPreviewMatches === true, 'anyPreviewMatches is TRUE (desktop will hide "matched form:" text via lg:hidden)');

  // --- Test 2: Search partial stem matching multiple forms ---
  console.log('\n--- 2. Testing Multiple Preview Form Matches (Stem "woni") ---');
  matchedKeys = getPreviewStripMatchedSlotKeys(displayedCards, 'woni', defaultSettings, sampleEntry, null, null);
  assert(matchedKeys.size >= 5, `Multiple forms matched stem "woni" (${matchedKeys.size} matched)`);
  assert(matchedKeys.has('1s|3s|present'), 'Matches 1s|3s|present');
  assert(matchedKeys.has('2s|3s|imperative'), 'Matches 2s|3s|imperative');
  assert(matchedKeys.has('3s|3s|present'), 'Matches 3s|3s|present');
  assert(matchedKeys.has('3s|3s|habitual'), 'Matches 3s|3s|habitual');
  assert(matchedKeys.has('3s|3s|infinitive'), 'Matches 3s|3s|infinitive');
  anyPreviewMatches = hasMiniPreview && matchedKeys.size > 0;
  assert(anyPreviewMatches === true, 'anyPreviewMatches is TRUE for multiple matches');

  // --- Test 3: Search non-preview form (e.g. "anawoniha") ---
  console.log('\n--- 3. Testing Non-Preview Form Match ("anawoniha") ---');
  matchedKeys = getPreviewStripMatchedSlotKeys(displayedCards, 'anawoniha', defaultSettings, sampleEntry, null, {
    label: '3p|3s|present',
    translit: 'anawoniha',
    syllabary: 'ᎠᎾᏬᏂᎭ'
  });
  assert(matchedKeys.size === 0, `0 preview forms matched (got ${matchedKeys.size})`);
  anyPreviewMatches = hasMiniPreview && matchedKeys.size > 0;
  assert(anyPreviewMatches === false, 'anyPreviewMatches is FALSE (desktop will SHOW "matched form:" text)');

  // --- Test 4: Search Syllabary ---
  console.log('\n--- 4. Testing Syllabary Match ---');
  matchedKeys = getPreviewStripMatchedSlotKeys(displayedCards, 'ᎤᏬᏂᎯᏍᏗ', defaultSettings, sampleEntry, null, null);
  assert(matchedKeys.size === 1, 'Syllabary query matches exactly 1 card');
  assert(matchedKeys.has('3s|3s|infinitive'), 'Matches infinitive card by syllabary');

  // --- Test 5: Tone search ---
  console.log('\n--- 5. Testing Tone Match ---');
  matchedKeys = getPreviewStripMatchedSlotKeys(displayedCards, 'ga2wo3', defaultSettings, sampleEntry, null, null);
  console.log('matchedKeys for ga2wo3:', Array.from(matchedKeys));
  assert(matchedKeys.size >= 1, 'Tone query matches card(s)');
  assert(matchedKeys.has('3s|3s|present'), 'Matches 3s|3s|present by tone');

  // --- Test 6: Empty query ---
  console.log('\n--- 6. Testing Empty Query ---');
  matchedKeys = getPreviewStripMatchedSlotKeys(displayedCards, '', defaultSettings, sampleEntry, null, null);
  assert(matchedKeys.size === 0, 'Empty query matches 0 cards');

  // Cleanup temp file
  try { fs.unlinkSync(tempOut); } catch (_) {}

  console.log('\n========================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('========================================');

  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
