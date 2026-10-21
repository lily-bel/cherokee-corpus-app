import fs from 'fs';
import path from 'path';

const DIST_DIR = path.resolve('dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');
const BASE_FORMS_PATH = path.resolve('public/data/base_forms.json');
const ASPECT_CLASSES_PATH = path.resolve('public/data/aspect_classes.json');
const CLASS_MASCOTS_PATH = path.resolve('public/data/class_mascots.json');
const SENTENCES_PATH = path.resolve('public/data/sentences.json');

const CANONICAL_BASE = 'https://dictionary.hanehlda.org';

const SOURCE_SHORTHAND = {
  'lily-dict.csv': 'CED',
  'ced': 'CED',
  'cherokee dictionary 1975 durbin feeling': 'CED',
  'durbin feeling': 'CED',
  'cn-app-dictionary.csv': 'CED',
  'cn': 'CND',
  'cnd': 'CND',
  'cnld': 'CNLD',
  'cnmed': 'CNMED',
  'ncmed': 'NCMED',
  'kirk-book-data.csv': 'KIRK',
  'kirk': 'KIRK',
  'learning-to-use-the-cherokee-verb.csv': 'LTU',
  'ltu': 'LTU',
  'cherokee-new-testament.csv': 'CNT',
  'cherokee-new-testament': 'CNT',
  'cnt': 'CNT',
  'bible': 'BIBLE',
  'rrd': 'RRD',
  'cwl': 'CWL',
  'noq': 'NOQ',
  'mds': 'MDS',
  'msct': 'MSCT',
  'banks': 'BANKS',
  'hierarchical-dict.json': 'KR'
};

function resolveSourceShorthand(sourceStr) {
  if (!sourceStr) return '';
  const s = String(sourceStr).toLowerCase().trim();
  if (SOURCE_SHORTHAND[s]) return SOURCE_SHORTHAND[s];
  if (s.includes('feeling') || s.includes('1975') || s.includes('ced')) return 'CED';
  if (s.includes('new testament') || s.includes('testament')) return 'CNT';
  if (s.includes('kirk')) return 'KIRK';
  if (s.includes('learning-to-use') || s.includes('ltu')) return 'LTU';
  return s.replace(/\.csv$/i, '').toUpperCase();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeMetaContent(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r\n/g, '&#10;')
    .replace(/[\r\n]/g, '&#10;');
}

function cleanSentenceText(text) {
  if (!text) return '';
  return String(text)
    .replace(/\*/g, '')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanMascotDef(def) {
  if (!def) return '';
  let cleaned = String(def)
    .replace(/\s*\(.*?\)/g, '')
    .replace(/["']/g, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.includes(',') || cleaned.includes(';')) {
    cleaned = cleaned.split(/[,;]/)[0].trim();
  }
  return cleaned;
}

function formatCommunityRoot(raw) {
  if (!raw) return '';
  return raw.toLowerCase()
    .replace(/>/g, '')
    .replace(/k/g, 'g')
    .replace(/t/g, 'd')
    .replace(/ts/g, 'j');
}

function getMorphologyLine(entry, className, PoS) {
  let setLabel = '';
  let rootText = '';
  let classText = className ? `[${className}]` : '';

  const segs = entry.surface_segments && (entry.surface_segments.present || entry.surface_segments);
  if (Array.isArray(segs)) {
    const pron = segs.find(s => s.role === 'pronoun' || (s.role && s.role.startsWith('pron')));
    if (pron) {
      setLabel = (pron.set === 'B' || pron.role === 'pron_b') ? 'Set B' : 'Set A';
    }
    const root = segs.find(s => s.role === 'root');
    if (root) {
      rootText = root.text;
    }
  }

  const rawSurface = entry.segmented_surface && (entry.segmented_surface.present || entry.segmented_surface);
  if (typeof rawSurface === 'string') {
    if (!setLabel) {
      if (rawSurface.includes('pron_b|')) setLabel = 'Set B';
      else if (rawSurface.includes('pron_a|')) setLabel = 'Set A';
    }
    if (!rootText) {
      const m = rawSurface.match(/root\|([^-\|]+)/);
      if (m) rootText = m[1];
    }
  }

  const lily = entry.sources && entry.sources['lily-dict.csv'];
  if (!setLabel && lily && lily.Verb_Set) {
    setLabel = lily.Verb_Set;
  }
  if (!rootText && lily && lily.Verb_Root) {
    rootText = formatCommunityRoot(lily.Verb_Root);
  }
  if (!setLabel && entry.is_combined_part_b) {
    setLabel = 'Set B';
  }

  const parts = [setLabel, rootText, classText].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(' - ');
  }
  return PoS || '';
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
    if (sources['lily-dict.csv'] && sources['lily-dict.csv']['Source']) sourceStr = sources['lily-dict.csv']['Source'];
    else if (sources['cn-app-dictionary.csv']) sourceStr = 'cn-app-dictionary.csv';
    else if (sources['lily-dict.csv']) sourceStr = 'lily-dict.csv';
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

  return {
    translit: translit.trim(),
    syllabary: syllabary.trim(),
    definition: definition.trim(),
    PoS: PoS.trim(),
    sourceStr,
    className: className ? String(className).trim() : '',
    root_h: root_h ? String(root_h).trim() : '',
    root_g: root_g ? String(root_g).trim() : ''
  };
}

function getRootDisplay(slug, verbs) {
  const first = verbs.find(v => v.root_h || v.root_g) || verbs[0] || {};
  let commH = first.root_h ? formatCommunityRoot(first.root_h) : '';
  let commG = first.root_g ? formatCommunityRoot(first.root_g) : '';

  if (!commH && !commG && slug) {
    try {
      const decoded = Buffer.from(slug, 'base64').toString('utf8');
      if (decoded && decoded.includes('|')) {
        const parts = decoded.split('|');
        commH = formatCommunityRoot(parts[0]);
        commG = formatCommunityRoot(parts[1] || parts[0]);
      }
    } catch (e) {}
  }

  if (commH && commG && commH !== commG) {
    return `-${commH}- / -${commG}-`;
  } else if (commH || commG) {
    return `-${commH || commG}-`;
  } else {
    return `-${formatCommunityRoot(slug)}-`;
  }
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
    .replace(/<meta\s+name=["']twitter:[^"']*["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, '')
    .trim();

  function generateHtmlPage({ title, description, url, themeColor = '#f59e0b' }) {
    const safeTitle = escapeHtml(title);
    const safeDesc = escapeMetaContent(description);
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
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
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
  const classMascots = fs.existsSync(CLASS_MASCOTS_PATH) ? JSON.parse(fs.readFileSync(CLASS_MASCOTS_PATH, 'utf8')) : {};
  const aspectClassesData = fs.existsSync(ASPECT_CLASSES_PATH) ? JSON.parse(fs.readFileSync(ASPECT_CLASSES_PATH, 'utf8')) : {};

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
    const { translit, syllabary, definition: def, PoS, sourceStr, className, root_h, root_g } = norm;
    const shorthand = resolveSourceShorthand(sourceStr);

    // Track for roots and classes
    const rootSlug = entry.root_slug || entry.slug || (entry.sources && entry.sources['hierarchical-dict.json'] && (entry.sources['hierarchical-dict.json'].root_slug || entry.sources['hierarchical-dict.json'].slug));
    const hdDef = entry.sources && entry.sources['hierarchical-dict.json'] && entry.sources['hierarchical-dict.json'].definition;
    if (rootSlug) {
      let rList = rootToVerbsMap.get(rootSlug);
      if (!rList) {
        rList = [];
        rootToVerbsMap.set(rootSlug, rList);
      }
      rList.push({ id, syllabary, translit, def: hdDef || def, root_h, root_g });
    }

    if (className) {
      let cList = classToVerbsMap.get(className);
      if (!cList) {
        cList = [];
        classToVerbsMap.set(className, cList);
      }
      cList.push({ id, syllabary, translit, def: hdDef || def });
    }

    // Title: Syllabary only
    const title = syllabary || translit || 'Cherokee Dictionary Entry';

    // Description:
    // Line 1: translit
    // Line 2: Morphology (e.g. Set A - nehld - [ih-ohd]) or PoS
    // Line 3: definition [source]
    const line1 = translit;
    const line2 = getMorphologyLine(entry, className, PoS);
    const line3 = def ? `${def}${shorthand ? ` [${shorthand}]` : ''}` : '';

    const descParts = [line1, line2, line3].filter(Boolean);
    const description = descParts.join('\n') || 'Cherokee dictionary entry';

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
    const rootDisplay = getRootDisplay(slug, verbs);
    const title = `Root: ${rootDisplay}`;

    const countLine = `${verbs.length} derived verb${verbs.length === 1 ? '' : 's'}`;
    const firstWithTranslit = verbs.find(v => v.translit && v.def) || verbs[0];
    let exampleLine = '';
    if (firstWithTranslit) {
      const trans = firstWithTranslit.translit || firstWithTranslit.syllabary || '';
      const cleanedDef = cleanMascotDef(firstWithTranslit.def);
      if (trans && cleanedDef) {
        exampleLine = `e.g. ${trans} "${cleanedDef}"`;
      } else if (trans) {
        exampleLine = `e.g. ${trans}`;
      }
    }

    const description = [countLine, exampleLine].filter(Boolean).join('\n') || 'Cherokee root';

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

    let mascotPresent = mascot.present || '';
    let mascotDef = cleanMascotDef(mascot.definition);

    if (!mascotPresent && verbs.length > 0) {
      const v = verbs.find(v => v.translit && v.def) || verbs[0];
      if (v) {
        mascotPresent = v.translit || v.syllabary || '';
        mascotDef = cleanMascotDef(v.def);
      }
    }

    const title = `Aspect Class: [${className}]`;
    const verbsCount = verbs.length;
    const countLine = `${verbsCount} verb${verbsCount === 1 ? '' : 's'} in class`;
    let exampleLine = '';
    if (mascotPresent && mascotDef) {
      exampleLine = `e.g. ${mascotPresent} "${mascotDef}"`;
    } else if (mascotPresent) {
      exampleLine = `e.g. ${mascotPresent}`;
    }

    const description = [countLine, exampleLine].filter(Boolean).join('\n') || 'Cherokee verb aspect class';
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
        const cleanSyll = cleanSentenceText(s.syllabary);
        const cleanPhon = cleanSentenceText(s.phonetic);
        const cleanEng = cleanSentenceText(s.english);
        const source = s.source || s['source file'] || (Array.isArray(s.sources) && s.sources[0]) || '';
        const shorthand = resolveSourceShorthand(source);

        const title = cleanSyll || cleanPhon || 'Cherokee Sentence';
        const line1 = cleanPhon;
        const line2 = cleanEng ? `${cleanEng}${shorthand ? ` [${shorthand}]` : ''}` : '';
        const description = [line1, line2].filter(Boolean).join('\n') || 'Cherokee Corpus Sentence';

        const pageHtml = generateHtmlPage({
          title,
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
