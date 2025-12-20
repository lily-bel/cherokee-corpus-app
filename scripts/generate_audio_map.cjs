const fs = require('fs');
const path = require('path');

const AUDIO_DIR = path.join(__dirname, '../public/data/audio');
const OUTPUT_FILE = path.join(__dirname, '../public/data/audio_manifest.json');

// Ensure directory exists
if (!fs.existsSync(AUDIO_DIR)) {
    console.error(`Directory not found: ${AUDIO_DIR}`);
    process.exit(1);
}

// Get list of audio files
const files = fs.readdirSync(AUDIO_DIR).filter(f => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav'));

// Write simple list to JSON
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(files, null, 2));

console.log(`Generated audio manifest with ${files.length} files.`);
