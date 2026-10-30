import os
import json
import re

def get_entry_translit(d):
    sources = d.get('sources', {})
    translit = ''
    if 'cn-app-dictionary.csv' in sources:
        s = sources['cn-app-dictionary.csv']
        if isinstance(s, list): s = s[0]
        if isinstance(s, dict):
            translit = s.get('Practical') or s.get('Entry') or ''
    if not translit and 'lily-dict.csv' in sources:
        s = sources['lily-dict.csv']
        if isinstance(s, list): s = s[0]
        if isinstance(s, dict):
            raw = s.get('Entry') or ''
            translit = raw.split(',')[0].strip() if ',' in raw else raw
    if not translit and 'hierarchical-dict.json' in sources:
        s = sources['hierarchical-dict.json']
        if isinstance(s, list): s = s[0]
        if isinstance(s, dict):
            translit = s.get('practical') or ''
    if not translit:
        translit = d.get('surface_spelling') or d.get('translit') or ''
    return translit.strip()

def translit_sort_key(item):
    tr, mid = item
    clean_tr = re.sub(r'[^a-zA-Z]', '', tr).lower()
    return (clean_tr, tr.lower(), mid)

def generate_official_lists():
    base_forms_path = os.path.join('public', 'data', 'base_forms.json')
    if not os.path.exists(base_forms_path):
        print(f"Error: {base_forms_path} not found.")
        return

    with open(base_forms_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    ced_verbs = []
    ced_non_verbs = []

    for d in data:
        sources = d.get('sources', {})

        is_ced = 'cn-app-dictionary.csv' in sources or 'hierarchical-dict.json' in sources
        if not is_ced and 'lily-dict.csv' in sources:
            s = sources['lily-dict.csv']
            if isinstance(s, list): s = s[0]
            if isinstance(s, dict) and s.get('Source') == 'ced':
                is_ced = True

        if not is_ced:
            continue

        pos = (d.get('PoS') or d.get('Part_of_Speech') or d.get('pos') or '').strip()
        if not pos:
            for s_name in ['cn-app-dictionary.csv', 'hierarchical-dict.json', 'lily-dict.csv']:
                if s_name in sources:
                    s = sources[s_name]
                    if isinstance(s, list): s = s[0]
                    if isinstance(s, dict):
                        pos = (s.get('Part of speech') or s.get('Part_of_Speech') or s.get('PoS') or s.get('_PoS_Lily') or s.get('pos') or '').strip()
                        if pos: break

        pos_lower = pos.lower()
        # Verbs in CED are labeled: 'verb (v.t.)', 'verb (v.i.)', 'verb (v.t.&v.i.)', 'vi', 'vt', 'v'
        # Adverbs are labeled 'adverb', 'adv', which must NOT match.
        is_verb = False
        if pos_lower in ('vi', 'vt', 'v', 'v.i.', 'v.t.'):
            is_verb = True
        elif pos_lower.startswith('verb') and not pos_lower.startswith('verbal'):
            is_verb = True
        elif 'verb' in pos_lower and 'adverb' not in pos_lower and 'adv' not in pos_lower:
            is_verb = True

        tr = get_entry_translit(d)
        if is_verb:
            ced_verbs.append((tr, d['merged_id']))
        else:
            ced_non_verbs.append((tr, d['merged_id']))

    ced_verbs.sort(key=translit_sort_key)
    ced_non_verbs.sort(key=translit_sort_key)

    output_dir = os.path.join('public', 'data', 'lists')
    os.makedirs(output_dir, exist_ok=True)

    verbs_data = {
        'name': 'Official Lists|CED Verbs',
        'words': [mid for _, mid in ced_verbs],
        'sentences': []
    }
    verbs_file = os.path.join(output_dir, 'official_lists_ced_verbs.json')
    with open(verbs_file, 'w', encoding='utf-8') as f:
        json.dump(verbs_data, f, indent=2)

    non_verbs_data = {
        'name': 'Official Lists|CED Non-Verbs',
        'words': [mid for _, mid in ced_non_verbs],
        'sentences': []
    }
    non_verbs_file = os.path.join(output_dir, 'official_lists_ced_non_verbs.json')
    with open(non_verbs_file, 'w', encoding='utf-8') as f:
        json.dump(non_verbs_data, f, indent=2)

    manifest_file = os.path.join(output_dir, 'manifest.json')
    manifest_list = [
        'official_lists_ced_verbs.json',
        'official_lists_ced_non_verbs.json'
    ]
    with open(manifest_file, 'w', encoding='utf-8') as f:
        json.dump(manifest_list, f, indent=2)

    print(f"Successfully generated CED Verbs ({len(ced_verbs)} words) and CED Non-Verbs ({len(ced_non_verbs)} words) in alphabetical transliteration order.")

if __name__ == '__main__':
    generate_official_lists()
