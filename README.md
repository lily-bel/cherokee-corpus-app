# Cherokee Dictionary and Corpus App
## Beta version link - [lily-bel.github.io/cherokee-corpus-app](https://lily-bel.github.io/cherokee-corpus-app/)
_Note - Please wait for version 1.0 for guaranteed import/export compatibility. Cached data should be stable from beta version onward._

A comprehensive Cherokee language app built in React for web and mobile. 

Features include:
- Dictionary with multiple sources ([CED](https://cherokeenationdictionary.net/), [online dictionary](https://www.cherokeedictionary.net/), etc), root-word integration and audio for CED, and robust search options.
- Tools to create custom dictionaries, conjugations, audio, sentences, etc.
- Feature-rich full text reader with glossing. Link words to dictionary entries and create word-level notes in context.
- Import/Export for custom packages (words/sentences/glosses/audio/etc) with color coding for package management.
- WIP study tools (custom word lists, widgets with study exercises, etc).

## The Data
Lexical sources were synthesized over time from various sources.
- [cherokeenationdictionary.net](cherokeenationdictionary.net) - The official Cherokee Nation dictionary site. A maintained version of the CED by Durbin Feeling. Includes audio, sentence examples, and some conjugations for each word.
- [cherokeedictionary.net](cherokeedictionary.net) - The original online dictionary site. Contains CED and additional sources such as Raven Rock Dictionary, Noquisi Word List, Consortium Word List, and other smaller sources. Some typos and quality issues.
- [Moondove's Spiral](https://web.archive.org/web/20160328135446/http://home.earthlink.net/~deanna1jc/moondoves_spiral_dictionary.htm) - A now offline website with a barebones word list. No syllabary, so it is hidden by default in the app, but nonetheless has many idioms and conversational words not covered by other sources (i.e. donadagohvi).
- _Cherokee Verb Reference Guide_ by Wyman Kirk - A print book containing verbs mostly accounted for in CED, but with tables of 5x5 conjugations.
- [_Learning to use the Cherokee Verb_](https://language.cherokee.org/media/vnihnhms/learning-to-use-the-cherokee-verb.pdf) by Durbin Feeling - A print book with deep conjugations of a small number of verbs.
- [King Recreation](https://github.com/CharlieMcVicker/king-recreation/tree/main) - An analysis of CED verbs to describe their roots and verb classes. This data is built into the app.
- [Cherokee New Testament](https://www.cherokeedictionary.net/cnt/) - The New Testament translated into Cherokee. Used as a full text for reading + glossing.

I converted the print sources to CSVs and consolidated everything [here](https://github.com/lily-bel/cherokee-data-consolidation). This pre-processing allows for maintained sources like the CN dictionary and root word project to be updated and used downstream in the app.

## 🧐 Search Tab
Feature-rich dictionary search.
- **Multi-Language Input**: Search using Syllabary, Phonetics/Transliteration, or English. Supports searching by root and conjugations (if available), tone, sentence examples, or your own notes.
- **Flexible Scope**: All search options can be toggled on or off. Combined with regular expression support, this allows for narrow grammatical search for studying sound or tone.
- **Detailed List View** - Search results include icons to indicate the dictionary source (CED, etc) and whether the entry has audio, custom word forms, and notes. These icons are color-coded by user / package.
- **Root Integration**: CED search results are grouped by their morphological root. Roots have their own unique pages with a list of verbs they form.
- Search history, source filtering (CED, custom dictionaries, etc), and other QoL features.

## ✏️ Entry View
Clicking on a word brings you to its unique page. Aside from the entry and definition, there is a lot of useful information here.
- **Audio** - Official audio is included from the Cherokee Nation dictionary. Custom audio can be recorded for entries and conjugations.
- **Grammatical Data** - Based on dictionary sources words may have tone, root + verb class, conjugations, and grammar details like Set and required prefixes (de-, wi-).
- **Sentence examples** - CED sentences are linked to words by default. Sentences can be manually glossed and will appear under the glossed words as other examples.
- **Customization** - Official words can have custom audio, conjugations, and notes.
- **URL Sharing** - Each entry and root has a unique ID and can be shared with a URL.

## 📖 Reader Tab
An immersive environment for reading full texts in Cherokee that integrates with other app features.
- **Reading Modes** - Toggle between syllabary, phonetics, or both, and turn english translation on or off.
- **Built-in Texts** - The CED sentences and Cherokee New Testament are available in full text form.
- **Interactive Glossing**: Tap any word in a text to connect it to its dictionary entry (and create optional word-level notes) or mark it for future investigation.
- **Text Importer (WIP)**: Upload your own texts to create your own corpus. _WIP - Lining up Cherokee + English and segmenting texts into sentences UX is still in progress._

## 📝 Lists Tab
Organize words and sentences and see custom data all in one place.
- **Favorites + Custom Lists**: Star words and sentences to easily save them, or create your own lists.
- **Smart Lists**: Built-in lists for entries with custom audio, word forms, notes, and glosses.
- _Study modes planned for later release._

## 📚 Custom Dictionaries Tab
Create notebooks of custom words or sentences with all the features of built-in words.
- **Entry Parity**: Custom entries have the same functionality as official sources. Custom words can be glossed to official sentences and vice-versa.
- **Color Coding**: User-generated words, sentences, glosses, audio, and notes share a gold color scheme, compared to the grey of official sources.

## 📦 Packages Tab
Manage official and custom packages, import and export data _(words, sentences, audio, conjugations, notes, and glosses)_ to share with others.
- **Official Sources and "My Library"** - Official (built-in) corpus and user-generated data appear as packages and can be enabled/disabled.
- **Exporting**: User-generated data can be exported (deliniated by lists or custom dictionaries) into an organized zip file.
- **Importing**: Imported package data appears across the app in the chosen color.
- **Information at a glace**: Packages are listed with counts of their data, and can be opened and viewed/searched in the package viewer.

## 🛠️ Widgets Tab
An optional tab for custom HTML widgets.
- **Syllabary Learner**: A (frankly better) version of my Learn Cherokee Syllabary app. Practice tracing, writing, and reading syllabary.
- **Transliteration**: Convert syllabary <-> phonetics in 3 modes.
- **Pronoun Game** - Practice pronomial prefixes.
- **Grammar Guide**: Embed of the online CED grammar guide.
