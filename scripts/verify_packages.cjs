const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function verify() {
    console.log('--- Verifying Catalog & Packages ---');
    
    // 1. Check catalog.json
    const catalogPath = path.join(__dirname, '../public/packages/catalog.json');
    if (!fs.existsSync(catalogPath)) {
        throw new Error('catalog.json does not exist!');
    }
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    console.log(`Found ${catalog.length} items in catalog.json:`);
    catalog.forEach(item => {
        console.log(`  - [${item.id}] ${item.name} (${item.short_name}) Color: ${item.color}`);
    });

    const bible = catalog.find(c => c.id === 'cherokee-new-testament');
    const narr = catalog.find(c => c.id === 'cherokee-narratives');

    if (!bible) throw new Error('Bible missing from catalog.json!');
    if (bible.short_name !== 'BIBLE') throw new Error(`Bible short_name expected 'BIBLE', got '${bible.short_name}'`);
    if (bible.color !== '#ef4444') throw new Error(`Bible color expected '#ef4444', got '${bible.color}'`);

    if (!narr) throw new Error('Narratives missing from catalog.json!');
    if (narr.short_name !== 'NARR') throw new Error(`Narratives short_name expected 'NARR', got '${narr.short_name}'`);
    if (narr.color !== '#14b8a6') throw new Error(`Narratives color expected '#14b8a6', got '${narr.color}'`);

    // 2. Check Package ZIP files
    const bibleZipPath = path.join(__dirname, '../public/packages/cherokee_new_testament.zip');
    const narrZipPath = path.join(__dirname, '../public/packages/cherokee_narratives.zip');

    if (!fs.existsSync(bibleZipPath)) throw new Error('cherokee_new_testament.zip missing!');
    if (!fs.existsSync(narrZipPath)) throw new Error('cherokee_narratives.zip missing!');

    console.log(`\nBible ZIP size: ${(fs.statSync(bibleZipPath).size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Narratives ZIP size: ${(fs.statSync(narrZipPath).size / 1024 / 1024).toFixed(2)} MB`);

    // 3. Inspect Bible ZIP contents
    const bZip = await JSZip.loadAsync(fs.readFileSync(bibleZipPath));
    const bMeta = JSON.parse(await bZip.file('metadata.json').async('string'));
    const bSents = JSON.parse(await bZip.file('sentences.json').async('string'));

    console.log(`Bible package parsed: ${bSents.length} verses, source: ${bSents[0].source}, author: ${bMeta.author}`);
    if (bSents.length !== 7957) throw new Error(`Expected 7957 Bible verses, got ${bSents.length}`);
    if (bSents[0].source !== 'BIBLE') throw new Error(`Expected Bible sentence source 'BIBLE', got ${bSents[0].source}`);
    if (bMeta.short_name !== 'BIBLE') throw new Error(`Expected Bible metadata short_name 'BIBLE'`);
    if (bMeta.name !== 'Cherokee New Testament') throw new Error(`Expected Bible name 'Cherokee New Testament', got '${bMeta.name}'`);
    if (bMeta.description !== 'Full text of the Cherokee New Testament (27 books, 260 chapters).') throw new Error(`Expected Bible description 'Full text of the Cherokee New Testament (27 books, 260 chapters).', got '${bMeta.description}'`);
    if (bMeta.stats.notebooks !== 0) throw new Error(`Expected Bible notebooks 0, got ${bMeta.stats.notebooks}`);
    if (bMeta.source_names?.bible || bMeta.source_names?.cnt) throw new Error(`Bible source_names should not contain bible or cnt`);
    if (bMeta.source_names?.BIBLE !== 'Cherokee New Testament') throw new Error(`Expected Bible source_names.BIBLE to be 'Cherokee New Testament'`);

    // 4. Inspect Narratives ZIP contents
    const nZip = await JSZip.loadAsync(fs.readFileSync(narrZipPath));
    const nMeta = JSON.parse(await nZip.file('metadata.json').async('string'));
    const nSents = JSON.parse(await nZip.file('sentences.json').async('string'));
    const nGlosses = JSON.parse(await nZip.file('sentence_joins.json').async('string'));

    console.log(`Narratives package parsed: ${nSents.length} sentences, ${nGlosses.length} glosses, source: ${nSents[0].source}`);
    if (nSents.length !== 361) throw new Error(`Expected 361 narratives sentences, got ${nSents.length}`);
    if (nSents[0].source !== 'NARR') throw new Error(`Expected Narratives sentence source 'NARR', got ${nSents[0].source}`);
    if (nMeta.short_name !== 'NARR') throw new Error(`Expected Narratives metadata short_name 'NARR'`);
    if (nMeta.stats.notebooks !== 0) throw new Error(`Expected Narratives notebooks 0, got ${nMeta.stats.notebooks}`);

    // 5. Check core sentences.json
    const coreSentsPath = path.join(__dirname, '../public/data/sentences.json');
    const coreSents = JSON.parse(fs.readFileSync(coreSentsPath, 'utf-8'));
    console.log(`\nCore sentences count in public/data/sentences.json: ${coreSents.length}`);
    const remainingNT = coreSents.filter(s => s['source file'] === 'cherokee-new-testament.csv');
    console.log(`Remaining NT verses in core: ${remainingNT.length}`);
    if (remainingNT.length !== 0) throw new Error('Core sentences.json still has NT verses!');

    console.log('\n--- ALL VERIFICATIONS PASSED! ---');
}

verify().catch(e => {
    console.error('VERIFICATION FAILED:', e);
    process.exit(1);
});
