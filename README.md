# Cherokee Dictionary and Corpus App

A comprehensive Cherokee language app built in React. Features include:
- Dictionary with multiple sources ([CED](https://cherokeenationdictionary.net/), [online dictionary](https://www.cherokeedictionary.net/), etc), root-word integration and audio for CED, and robust search options.
- Tools to create custom dictionaries, conjugations, audio, sentences, etc.
- Feature-rich full text reader with glossing. Link words to dictionary entries and create word-level notes in-context.
- Import/Export for custom packages (words/sentences/glosses/audio/etc) with color coding for package management.
- WIP study tools (custom word lists, widgets with custom exercises)

## The Data

Dictionary data sources were synthesized over time from various sources.
- [cherokeenationdictionary.net] - The official Cherokee Nation dictionary site. A maintained version of the CED by Durbin Feeling. Includes audio, sentence examples, and some conjugations for each word.
- [cherokeedictionary.net] - The original online dictionary site. Contains CED and additional sources such as Raven Rock Dictionary, Noquisi Word List, Consortium Word List, and other smaller sources. Some typos and quality issues.
- [Moondove's Spiral](https://web.archive.org/web/20160328135446/http://home.earthlink.net/~deanna1jc/moondoves_spiral_dictionary.htm) - A now offline website with a barebones wordlist. No syllabary so it is turned off by default in the app, but it nonetheless has many idioms and frequently used conversational words unlisted by other sources (ie donadagohvi).
- _Cherokee Verb Reference Guide_ by Wyman Kirk - A print book, containing verbs mostly accounted for in CED, but with tables of 5x5 conjugations.
- [_Learning to use the Cherokee Verb_](https://language.cherokee.org/media/vnihnhms/learning-to-use-the-cherokee-verb.pdf) by Durbin Feeling - A print book with deep conjugations of a small number of verbs.
- [King Recreation](https://github.com/CharlieMcVicker/king-recreation/tree/main) - An analysis of CED verbs to describe their roots and verb classes. This information is built into the app.
- [Cherokee New Testament](https://www.cherokeedictionary.net/cnt/) - The New Testament, translated to Cherokee. Used as a full text for reading + glossing.

I converted the print sources to CSVs and consolidated everything [here](https://github.com/lily-bel/cherokee-data-consolidation). This pre-processing allows for maintained sources like the CN dictionary and Root word project to be updated and used downstream in the app.

## Search Tab

- **Multi-Language Input**: Search using Syllabary, Phonetics/Transliteration, or English. Supports searching by root and conjugations (if available), tone, sentence examples, or your own notes.
- **Flexible Scope**: All search options can be toggled on or off. Combined with regular expression support, this allows for narrow grammatical search for studying sound or tone.
- **Detailed List View** - Search results include icons to indicate the dictionary source (CED, etc) and whether the entry has audio, custom word forms, and notes. These icons are color-coded by user / package.
- **Root Integration**: CED search results are grouped by their morphological root. Roots have their own unique pages with a list of verbs they form.
- Search history, source filtering (CED, custom dictionaries, etc), and other QoL features.

## Entry View

Clicking on a word brings you to its unique page. Aside from the entry and definition, there is a lot of useful information here.
- **Audio** - Official audio is included from the Cherokee Nation dictionary. Custom audio can be recorded for entries and conjugations.
- **Grammatical Data** - Based on dictionary sources words may have tone, root + verb class, conjugations, and grammar details like Set and required prefixes (de-, wi-).
- **Sentence examples** - CED sentences are linked to words by default. Sentences can be manually glossed and will appear under the glossed words as other examples.
- **Customization** - Official words can have custom audio, conjugations, and notes.
- **URL Sharing** - Each entry and root has a unique ID and can be shared with a URL.

## Reader Tab
An immersive environment for reading full texts in Cherokee that integrates with other app features.
- **Reading Modes** - Toggle between syllabary, phonetics, or both, and turn english translation on or off.
- **Built-in Texts** - The CED sentences and Cherokee New Testament are available in full text form.
- **Interactive Glossing**: Tap any word in a text to connect it to its dictionary entry (and create optional word-level notes) or mark it for future investigation.
- **Text Importer (WIP)**: Upload your own texts to create your own corpus. _WIP - Lining up Cherokee + English and segmenting texts into sentences UX is still in progress._

## Lists Tab
Organize words and sentences and see custom data all in one place.
- **Favorites + Custom Lists**: One-tap bookmarking for words and sentences, or create your own lists.
- ****: Create your own lists.
- **Smart Lists**: Automatic collections for entries where you have recorded audio, added personal notes, or created custom glosses.
- **Mass Actions**: Export lists or move items between collections effortlessly.

## Custom Dictionaries Tab
Take control of your learning by building your own linguistic database.

- **Custom Notebooks**: Create multiple private dictionaries to organize your field notes or personal vocabulary.
- **Entry Creation**: Add new words or sentences with full support for Syllabary, Transliteration, and definitions.
- **Metadata Management**: Edit and refine your entries over time.
- **Export/Import**: Move your personal data between devices using JSON backups or export to CSV for use in spreadsheet software.

## 📦 Packages Tab
Manage the vast amount of data available in the app through a modular system.

- **Data Modularization**: Enable or disable specific "packages" (e.g., CED, Community Dictionaries) to keep your workspace focused.
- **Package Details**: View metadata, versioning, and contribution info for each data source.
- **Community Contributions**: Import third-party packages to expand your corpus.

## 🛠️ Widgets Tab
A collection of specialized tools for specific linguistic tasks and learning games.

- **Built-in Tools**: Includes a Syllabary Learner, Transliteration Converter, and Pronoun Game.
- **Custom Widgets**: Import your own HTML-based tools or point to external web-based linguistic resources.
- **Seamless Integration**: Widgets run within the app environment and can be accessed via direct URLs.

---

## ⚙️ Customization & Settings
- **Dark/Light Mode**: Full theme support for comfortable reading.
- **Visual Preferences**: Toggle Part of Speech labels in lists, root headers, and interactive UI elements.
- **Data Portability**: Full Backup/Restore system ensures your personal library is never lost.
