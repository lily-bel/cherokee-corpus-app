import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve('dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');
const BASE_FORMS_PATH = path.resolve('public/data/base_forms.json');
const CONJUGATIONS_PATH = path.resolve('public/data/conjugations.json');
const ASPECT_CLASSES_PATH = path.resolve('public/data/aspect_classes.json');
const CLASS_MASCOTS_PATH = path.resolve('public/data/class_mascots.json');
const SENTENCES_PATH = path.resolve('public/data/sentences.json');

const CANONICAL_BASE = 'https://dictionary.hanehlda.org';

const SOURCE_SHORTHAND = {
  'lily-dict.csv': 'CED',
  'ced': 'CED',
  'cn-app-dictionary.csv': 'CND',
  'cn': 'CND',
  'cnld': 'CNLD',
  'cnmed': 'CNMED',
  'ncmed': 'NCMED',
  'kirk-book-data.csv': 'KIRK',
  'kirk': 'KIRK',
  'learning-to-use-the-cherokee-verb.csv': 'LTU',
  'ltu': 'LTU',
  'rrd': 'RRD',
  'cwl': 'CWL',
  'noq': 'NOQ',
  'mds': 'MDS',
  'msct': 'MSCT',
  'banks': 'BANKS',
  'cnt': 'CNT',
  'bible': 'BIBLE',
  'hierarchical-dict.json': 'KR'
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCommunityRoot(raw) {
  if (!raw) return '';
  return raw.toLowerCase()
    .replace(/>/g, '')
    .replace(/k/g, 'g')
    .replace(/t/g, 'd')
    .replace(/ts/g, 'j');
}

function parseRoleTaggedSegmentation(taggedStr) {
  if (!taggedStr || taggedStr === '---') return [];
  const segments = [];
  for (const part of String(taggedStr).split('-')) {
    const pipeIdx = part.indexOf('|');
    if (pipeIdx === -1) continue;
    const rTag = part.slice(0, pipeIdx);
    const text = part.slice(pipeIdx + 1).replace(/’/g, "'");
    if (!text) continue;
    segments.push({ role: rTag, text });
  }
  return segments;
}

function normalizeEntry(d) {
  let translit = d.Entry || d.translit || d.surface_spelling || '';
  let syllabary = d.Syllabary || d.syllabary || '';
  let definition = d.Definition || d.definition || d.English || '';
  let PoS = d.PoS || d.pos || '';
  let sourceStr = d.Source || d.source || '';

  const sources = d.sources || {};
  const sourceKeys = Object.keys(sources);

  if (!sourceStr) {
    if (sources['cn-app-dictionary.csv']) sourceStr = 'cn-app-dictionary.csv';
    else if (sources['lily-dict.csv']) sourceStr = sources['lily-dict.csv']['Source'] || 'lily-dict.csv';
    else if (sources['kirk-book-data.csv']) sourceStr = 'kirk-book-data.csv';
    else if (sources['learning-to-use-the-cherokee-verb.csv']) sourceStr = 'learning-to-use-the-cherokee-verb.csv';
    else if (sources['hierarchical-dict.json']) sourceStr = 'hierarchical-dict.json';
    else if (sourceKeys.length > 0) sourceStr = sourceKeys[0];
  }

  if (sources['cn-app-dictionary.csv']) {
    const s = sources['cn-app-dictionary.csv'];
    translit = translit || s['Practical'] || s['Entry'] || '';
    syllabary = syllabary || s['Syllabary'] || '';
    definition = definition || s['Translations'] || '';
    PoS = PoS || s['Part of speech'] || s['Part of speech ch'] || '';
  } else if (sources['lily-dict.csv']) {
    const s = sources['lily-dict.csv'];
    translit = translit || s['Entry'] || '';
    syllabary = syllabary || s['Syllabary'] || '';
    definition = definition || s['Definition'] || '';
    PoS = PoS || s['PoS'] || '';
  } else if (sources['kirk-book-data.csv']) {
    const s = sources['kirk-book-data.csv'];
    translit = translit || s['Cherokee'] || '';
    definition = definition || s['English'] || '';
  } else if (sources['learning-to-use-the-cherokee-verb.csv']) {
    const s = sources['learning-to-use-the-cherokee-verb.csv'];
    translit = translit || s['Cherokee'] || '';
    syllabary = syllabary || s['Syllabary'] || '';
    definition = definition || s['English'] || '';
  } else if (sources['hierarchical-dict.json']) {
    const s = sources['hierarchical-dict.json'];
    translit = translit || s['practical'] || s['surface_spelling'] || '';
    definition = definition || s['definition'] || '';
  }

  const hdSource = sources['hierarchical-dict.json'];
  const className = d.class_name || d['hierarchical-dict.json_Class'] || (hdSource && (hdSource.class_name || hdSource['morphology.class_name']));
  const root_h = d.root_h || d['hierarchical-dict.json_root_h'] || (hdSource && (hdSource.h_grade_root || hdSource['morphology.h_grade_root']));
  const root_g = d.root_g || d['hierarchical-dict.json_root_g'] || (hdSource && (hdSource.glottal_grade_root || hdSource['morphology.glottal_grade_root']));
  const taggedSurface = d.segmented_surface || d['hierarchical-dict.json_segmented_surface'] || (hdSource && hdSource.segmented_surface);

  return {
    translit: translit.trim(),
    syllabary: syllabary.trim(),
    definition: definition.trim(),
    PoS: PoS.trim(),
    sourceStr,
    className: className ? String(className).trim() : '',
    root_h: root_h ? String(root_h).trim() : '',
    root_g: root_g ? String(root_g).trim() : '',
    taggedSurface: typeof taggedSurface === 'string' ? taggedSurface : (taggedSurface && taggedSurface.present ? taggedSurface.present : '')
  };
}

async function run() {
  console.time('Prerender embed metadata');

  if (!fs.existsSync(INDEX_HTML_PATH)) {
    console.error('dist/index.html not found! Run vite build first.');
    process.exit(1);
  }

  const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

  // Extract head elements from index.html (like links, scripts)
  const headMatch = indexHtml.match(/<head>([\s\S]*?)<\/head>/i);
  const headInner = headMatch ? headMatch[1] : '';

  const cleanHead = headInner
    .replace(/<title>.*?<\/title>/gi, '')
    .replace(/<meta\s+property=["']og:[^"']*["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .trim();

  function generateHtmlPage({ title, description, url, themeColor = '#f59e0b' }) {
    const safeTitle = escapeHtml(title);
    const safeDesc = escapeHtml(description);
    const safeUrl = escapeHtml(url);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDesc}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Cherokee Corpus Reference" />
    <meta name="theme-color" content="${themeColor}" />
    ${cleanHead}
</head>
<body>
    <div id="root"></div>
</body>
</html>`;
  }

  console.log('Reading database files...');
  const baseForms = JSON.parse(fs.readFileSync(BASE_FORMS_PATH, 'utf8'));
  const conjugations = fs.existsSync(CONJUGATIONS_PATH) ? JSON.parse(fs.readFileSync(CONJUGATIONS_PATH, 'utf8')) : [];
  const classMascots = fs.existsSync(CLASS_MASCOTS_PATH) ? JSON.parse(fs.readFileSync(CLASS_MASCOTS_PATH, 'utf8')) : {};
  const aspectClassesData = fs.existsSync(ASPECT_CLASSES_PATH) ? JSON.parse(fs.readFileSync(ASPECT_CLASSES_PATH, 'utf8')) : {};

  // Index conjugations by merged_id
  const conjByMergedId = new Map();
  for (const c of conjugations) {
    const mid = c.merged_id;
    if (!mid) continue;
    let list = conjByMergedId.get(mid);
    if (!list) {
      list = [];
      conjByMergedId.set(mid, list);
    }
    list.push(c);
  }

  // Ensure output directories exist
  const wordDir = path.join(DIST_DIR, 'word');
  const rootDir = path.join(DIST_DIR, 'root');
  const classDir = path.join(DIST_DIR, 'class');
  const sentenceDir = path.join(DIST_DIR, 'sentence');
  fs.mkdirSync(wordDir, { recursive: true });
  fs.mkdirSync(rootDir, { recursive: true });
  fs.mkdirSync(classDir, { recursive: true });
  fs.mkdirSync(sentenceDir, { recursive: true });

  const rootToVerbsMap = new Map();
  const classToVerbsMap = new Map();

  // 1. Prerender Words
  console.log(`Prerendering ${baseForms.length} words...`);
  for (const entry of baseForms) {
    const id = entry.Index || entry.id || entry.merged_id;
    if (!id) continue;

    const norm = normalizeEntry(entry);
    const { translit, syllabary, definition: def, PoS, sourceStr, className, root_h, root_g, taggedSurface } = norm;
    const shorthand = SOURCE_SHORTHAND[sourceStr] || SOURCE_SHORTHAND[sourceStr.toLowerCase()] || sourceStr.toUpperCase();

    // Track for roots and classes
    const rootSlug = entry.root_slug || entry.slug;
    if (rootSlug) {
      let rList = rootToVerbsMap.get(rootSlug);
      if (!rList) {
        rList = [];
        rootToVerbsMap.set(rootSlug, rList);
      }
      rList.push({ id, syllabary, translit, def, root_h, root_g });
    }

    if (className) {
      let cList = classToVerbsMap.get(className);
      if (!cList) {
        cList = [];
        classToVerbsMap.set(className, cList);
      }
      cList.push({ id, syllabary, translit, def });
    }

    // Title: ᎠᏓᏕᎦ (adadega) — it's bouncing [CND]
    let titleParts = [];
    if (syllabary) titleParts.push(syllabary);
    if (translit) titleParts.push(`(${translit})`);
    if (def) titleParts.push(`— ${def}`);
    if (shorthand) titleParts.push(`[${shorthand}]`);
    const title = titleParts.join(' ') || 'Cherokee Dictionary Entry';

    // Description: Morphology & Segmentation + Principal parts
    const descParts = [];

    // Morphology line
    if (taggedSurface) {
      const segs = parseRoleTaggedSegmentation(taggedSurface);
      const segText = segs.map(s => s.text).join('-');

      let setLabel = '';
      const pronSeg = segs.find(s => s.role === 'pron_b' || s.role === 'pronoun' && s.set === 'B');
      setLabel = pronSeg ? 'Set B' : 'Set A';

      const rootSeg = segs.find(s => s.role === 'root');
      const rootText = rootSeg ? `Root: -${rootSeg.text}-` : (root_h ? `Root: -${formatCommunityRoot(root_h)}-` : '');
      const classText = className ? `Class: [${className}]` : '';

      const morphOverview = [setLabel, rootText, classText].filter(Boolean).join(' • ');
      if (morphOverview) {
        descParts.push(`Morphology: ${morphOverview}`);
      }
      if (segText) {
        descParts.push(`Segmentation: ${segText}`);
      }
    } else if (PoS) {
      descParts.push(`Part of speech: ${PoS}`);
    }

    // Principal parts line
    const entryConjs = conjByMergedId.get(id);
    if (entryConjs && entryConjs.length > 0) {
      const getForm = (key) => entryConjs.find(c => (c.normalized_key || '').toLowerCase().includes(key));
      const p1 = getForm('1s|3s|present');
      const imp = getForm('2s|3s|imperative');
      const hab = getForm('3s|3s|habitual');
      const past = getForm('3s|3s|completive past') || getForm('past');
      const inf = getForm('3s|3s|infinitive');

      const getTrans = (c) => c ? (c['cn-app-dictionary.csv_Practical'] || c['lily-dict.csv_Entry'] || c.Practical || c.translit || c.surface_spelling || '') : '';
      const partsList = [];
      if (p1 && getTrans(p1)) partsList.push(`1s: ${getTrans(p1)}`);
      if (imp && getTrans(imp)) partsList.push(`Imp: ${getTrans(imp)}`);
      if (hab && getTrans(hab)) partsList.push(`Hab: ${getTrans(hab)}`);
      if (past && getTrans(past)) partsList.push(`Past: ${getTrans(past)}`);
      if (inf && getTrans(inf)) partsList.push(`Inf: ${getTrans(inf)}`);

      if (partsList.length > 0) {
        descParts.push(`Forms: ${partsList.join(' • ')}`);
      }
    }

    const description = descParts.join('\n') || def || 'Cherokee dictionary entry';
    const pageHtml = generateHtmlPage({
      title,
      description,
      url: `${CANONICAL_BASE}/word/${id}`
    });

    fs.writeFileSync(path.join(wordDir, `${id}.html`), pageHtml, 'utf8');
  }

  // 2. Prerender Roots
  console.log(`Prerendering ${rootToVerbsMap.size} roots...`);
  for (const [slug, verbs] of rootToVerbsMap.entries()) {
    const first = verbs[0] || {};
    const commH = first.root_h ? formatCommunityRoot(first.root_h) : '';
    const commG = first.root_g ? formatCommunityRoot(first.root_g) : '';

    let rootDisplay = '∅';
    if (commH && commG && commH !== commG) {
      rootDisplay = `-${commH}- / -${commG}-`;
    } else if (commH || commG) {
      rootDisplay = `-${commH || commG}-`;
    } else {
      rootDisplay = `-${formatCommunityRoot(slug)}-`;
    }

    const title = `Cherokee Root: ${rootDisplay}`;
    const topExamples = verbs.filter(v => v.translit).slice(0, 4).map(v => `${v.syllabary || ''} (${v.translit}): ${v.def}`).join('; ');
    const description = `${verbs.length} derived verb${verbs.length === 1 ? '' : 's'}${topExamples ? ` • Examples: ${topExamples}` : ''}`;

    const pageHtml = generateHtmlPage({
      title,
      description,
      url: `${CANONICAL_BASE}/root/${slug}`
    });

    fs.writeFileSync(path.join(rootDir, `${slug}.html`), pageHtml, 'utf8');
  }

  // 3. Prerender Classes
  // Ensure all aspect classes from aspect_classes.json are included
  const allClasses = new Set([...classToVerbsMap.keys()]);
  if (Array.isArray(aspectClassesData.classes)) {
    for (const c of aspectClassesData.classes) {
      allClasses.add(c.name);
      if (Array.isArray(c.subclasses)) {
        for (const sub of c.subclasses) {
          allClasses.add(sub.name);
          if (Array.isArray(sub.variants)) {
            for (const v of sub.variants) {
              allClasses.add(v.name);
            }
          }
        }
      }
    }
  }

  console.log(`Prerendering ${allClasses.size} aspect classes...`);
  for (const className of allClasses) {
    const verbs = classToVerbsMap.get(className) || [];
    const mascot = classMascots[className] || {};
    const mascotText = mascot.present ? ` (Mascot: ${mascot.present} "${mascot.definition || ''}")` : '';
    const title = `Cherokee Aspect Class: [${className}]${mascotText}`;

    const topExamples = verbs.filter(v => v.translit).slice(0, 4).map(v => `${v.syllabary || ''} (${v.translit}): ${v.def}`).join('; ');
    const verbsCount = verbs.length;
    const countText = verbsCount > 0 ? `${verbsCount} verb${verbsCount === 1 ? '' : 's'} in class` : 'Cherokee verb aspect class';
    const description = `${countText}${topExamples ? ` • Examples: ${topExamples}` : ''}`;

    const safeFilename = encodeURIComponent(className);
    const pageHtml = generateHtmlPage({
      title,
      description,
      url: `${CANONICAL_BASE}/class/${safeFilename}`
    });

    fs.writeFileSync(path.join(classDir, `${safeFilename}.html`), pageHtml, 'utf8');
  }

  // 4. Prerender Sentences
  if (fs.existsSync(SENTENCES_PATH)) {
    try {
      const sentences = JSON.parse(fs.readFileSync(SENTENCES_PATH, 'utf8'));
      console.log(`Prerendering ${sentences.length} sentences...`);
      for (const s of sentences) {
        const id = s.sentence_id || s.id;
        if (!id) continue;
        const syllabary = (s.syllabary || '').replace(/\*/g, '').trim();
        const phonetic = (s.phonetic || '').replace(/\*/g, '').trim();
        const english = (s.english || '').replace(/\*/g, '').trim();
        const source = s['source file'] || s.source || '';
        const shorthand = SOURCE_SHORTHAND[source] || SOURCE_SHORTHAND[source.toLowerCase()] || '';

        const titleParts = [];
        if (syllabary) titleParts.push(syllabary);
        if (phonetic) titleParts.push(`(${phonetic})`);
        const title = titleParts.length > 0 ? titleParts.join(' ') : 'Cherokee Sentence';

        const descParts = [];
        if (english) descParts.push(english);
        if (shorthand) descParts.push(`[${shorthand}]`);
        else if (source) descParts.push(`[${source}]`);
        const description = descParts.join(' ') || 'Cherokee Corpus Sentence';

        const pageHtml = generateHtmlPage({
          title: `${title} — Cherokee Corpus`,
          description,
          url: `${CANONICAL_BASE}/sentence/${id}`
        });

        fs.writeFileSync(path.join(sentenceDir, `${id}.html`), pageHtml, 'utf8');
      }
    } catch (e) {
      console.warn("Could not prerender sentences:", e);
    }
  }

  console.timeEnd('Prerender embed metadata');
  console.log('Prerendering completed successfully.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
