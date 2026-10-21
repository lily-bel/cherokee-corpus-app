import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function run() {
  console.log('--- 1. Compiling utils.tsx with esbuild ---');
  const tempOut = path.join(__dirname, '_temp_utils_test.js');
  
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

  console.log('Loaded utils successfully!');

  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, desc) {
    if (actual === expected) {
      console.log(`  ✓ ${desc}: "${actual}"`);
      passed++;
    } else {
      console.error(`  ✗ FAIL ${desc}:\n    Expected: "${expected}"\n    Actual:   "${actual}"`);
      failed++;
    }
  }

  console.log('\n--- 2. Testing Example Word: dùlv̌hwị́sdànẹha across 6 Tone Orthographies x 3 Consonant Styles ---');

  const toneWord = 'dùlv̌hwị́sdànẹha';

  const expectedMatrix = {
    mco: {
      classic: 'dù:lv̌:hwísdà:neha',
      aspiration: 'tù:lv̌:whístà:neha',
      reverse_aspiration: 'dù:lv̌:whísdà:neha',
    },
    mco_short: {
      classic: 'dùlv̌hwị́sdànẹha',
      aspiration: 'tùlv̌whị́stànẹha',
      reverse_aspiration: 'dùlv̌whị́sdànẹha',
    },
    uchihara: {
      classic: 'dùùlvv́hwísdààneha',
      aspiration: 'tùùlvv́whístààneha',
      reverse_aspiration: 'dùùlvv́whísdààneha',
    },
    montgomery_anderson: {
      classic: 'duùlvv́hwísdaàneha',
      aspiration: 'tuùlvv́whístaàneha',
      reverse_aspiration: 'duùlvv́whísdaàneha',
    },
    feeling_1975: {
      classic: 'du¹lv²³hwị³sda¹nẹ²ha',
      aspiration: 'tu¹lv²³whị³sta¹nẹ²ha',
      reverse_aspiration: 'du¹lv²³whị³sda¹nẹ²ha',
    },
    feeling_modified: {
      classic: 'du²¹lv²³hwi³sda²¹ne²ha',
      aspiration: 'tu²¹lv²³whi³sta²¹ne²ha',
      reverse_aspiration: 'du²¹lv²³whi³sda²¹ne²ha',
    },
  };

  for (const [orthography, styles] of Object.entries(expectedMatrix)) {
    console.log(`\n  [Orthography: ${orthography}]`);
    for (const [style, expected] of Object.entries(styles)) {
      const actual = utils.convertToneText(toneWord, orthography, style);
      assertEqual(actual, expected, `${orthography} + ${style}`);
    }
  }

  console.log('\n--- 3. Testing Non-Tone Vowel Length Colon (:) on dulvhwisdaneha ---');

  const plainWord = 'dulvhwisdaneha';

  const expectedLengthMatrix = {
    withLength: {
      classic: 'du:lv:hwisda:neha',
      aspiration: 'tu:lv:whista:neha',
      reverse_aspiration: 'du:lv:whisda:neha',
    },
    withoutLength: {
      classic: 'dulvhwisdaneha',
      aspiration: 'tulvwhistaneha',
      reverse_aspiration: 'dulvwhisdaneha',
    },
  };

  for (const [style, expected] of Object.entries(expectedLengthMatrix.withLength)) {
    const actual = utils.formatTranslitWithLength(plainWord, toneWord, true, style);
    assertEqual(actual, expected, `Length ON + ${style}`);
  }

  for (const [style, expected] of Object.entries(expectedLengthMatrix.withoutLength)) {
    const actual = utils.formatTranslitWithLength(plainWord, toneWord, false, style);
    assertEqual(actual, expected, `Length OFF + ${style}`);
  }

  console.log('\n--- 4. Testing Surface Segment Projection (Color Preservation) ---');

  const mockSegments = [
    { text: 'du', role: 'prefix' },
    { text: 'lvhwisda', role: 'root' },
    { text: 'ne', role: 'suffix' },
    { text: 'ha', role: 'suffix' }
  ];

  // Test projectToneOrLengthOntoSegments for uchihara
  const projectedUchihara = utils.projectToneOrLengthOntoSegments(mockSegments, toneWord, {
    showTone: true,
    toneOrthography: 'uchihara',
    showLengthInTranslit: false,
    translitStyle: 'classic'
  });
  const uchiharaFull = projectedUchihara.map(s => s.text).join('');
  assertEqual(uchiharaFull, 'dùùlvv́hwísdààneha', 'Projected uchihara segment text matches full word');
  assertEqual(projectedUchihara.length, mockSegments.length, 'Segment count preserved');
  assertEqual(projectedUchihara[0].role, 'prefix', 'Segment 0 role preserved');
  assertEqual(projectedUchihara[1].role, 'root', 'Segment 1 role preserved');
  assertEqual(projectedUchihara[2].role, 'suffix', 'Segment 2 role preserved');
  assertEqual(projectedUchihara[3].role, 'suffix', 'Segment 3 role preserved');

  // Test projectToneOrLengthOntoSegments for non-tone length colon
  const projectedLength = utils.projectToneOrLengthOntoSegments(mockSegments, toneWord, {
    showTone: false,
    toneOrthography: 'mco',
    showLengthInTranslit: true,
    translitStyle: 'classic'
  });
  const lengthFull = projectedLength.map(s => s.text).join('');
  assertEqual(lengthFull, 'du:lv:hwisda:neha', 'Projected non-tone length segment text matches full word');

  console.log('\n--- 5. Testing restoreSpacesFromPractical ---');
  const spaceTone = 'dùlv̌hwị́sdànẹhaigs';
  const spacePractical = 'dulvhwisdaneha igs';
  const restored = utils.restoreSpacesFromPractical(spaceTone, spacePractical);
  assertEqual(restored, 'dùlv̌hwị́sdànẹha igs', 'Restores missing space based on practical tokens');

  console.log('\n--- 6. Batch dataset test on base_forms.json and sentences ---');

  const baseFormsPath = path.join(projectRoot, 'public', 'data', 'base_forms.json');
  if (fs.existsSync(baseFormsPath)) {
    const baseForms = JSON.parse(fs.readFileSync(baseFormsPath, 'utf-8'));
    console.log(`Checking ${baseForms.length} base entries across all orthographies...`);
    let entriesChecked = 0;
    for (const entry of baseForms) {
      const cnSource = entry.sources && entry.sources['cn-app-dictionary.csv'];
      const lilySource = entry.sources && entry.sources['lily-dict.csv'];
      const t1 = (cnSource && (cnSource['Tone and length 1'] || cnSource.tone1)) || (lilySource && lilySource.Entry_Tone) || entry['Tone and length 1'] || entry.tone1;
      const t2 = (cnSource && (cnSource['Tone and length 2'] || cnSource.tone2)) || entry['Tone and length 2'] || entry.tone2;
      const tone = t1 || t2;
      if (tone) {
        for (const orth of ['mco', 'mco_short', 'uchihara', 'montgomery_anderson', 'feeling_1975', 'feeling_modified']) {
          const res = utils.convertToneText(tone, orth, 'classic');
          if (!res || typeof res !== 'string' || res.includes('undefined')) {
            throw new Error(`Invalid conversion for entry ${entry.merged_id} in ${orth}: ${res}`);
          }
        }
        entriesChecked++;
      }
    }
    console.log(`  ✓ Successfully converted tone for all ${entriesChecked} tone-bearing entries in all 6 orthographies.`);
    passed++;
  }

  const sentencesPath = path.join(projectRoot, 'public', 'data', 'sentences.json');
  if (fs.existsSync(sentencesPath)) {
    const sentences = JSON.parse(fs.readFileSync(sentencesPath, 'utf-8'));
    console.log(`Checking ${sentences.length} sentences for formatSentenceText...`);
    let sentencesChecked = 0;
    for (const s of sentences.slice(0, 1000)) {
      const translit = s.phonetic || s.transliteration || s.Sentence_Transliteration;
      if (translit) {
        for (const orth of ['mco', 'uchihara', 'feeling_1975']) {
          const res = utils.formatSentenceText(translit, orth, false, 'classic');
          if (!res || typeof res !== 'string' || res.includes('undefined')) {
            throw new Error(`Invalid sentence conversion for sentence ${s.sentence_id || s.id} in ${orth}: ${res}`);
          }
        }
        sentencesChecked++;
      }
    }
    console.log(`  ✓ Successfully formatted sample of ${sentencesChecked} sentences without errors.`);
    passed++;
  }

  // Cleanup temp file
  if (fs.existsSync(tempOut)) {
    fs.unlinkSync(tempOut);
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log(`========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
