import os
import json

def generate_official_lists():
    base_forms_path = os.path.join('public', 'data', 'base_forms.json')
    if not os.path.exists(base_forms_path):
        print(f"Error: {base_forms_path} not found.")
        return

    with open(base_forms_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    ced_verb_ids = []
    for d in data:
        sources = d.get('sources', {})
        
        source_str = ''
        if 'cn-app-dictionary.csv' in sources:
            source_str = 'ced'
        elif 'lily-dict.csv' in sources:
            s = sources['lily-dict.csv']
            if isinstance(s, list): s = s[0]
            source_str = s.get('Source', 'lily') if isinstance(s, dict) else 'lily'
        elif 'hierarchical-dict.json' in sources:
            source_str = 'ced'
        
        if source_str == 'ced':
            pos = ''
            if 'cn-app-dictionary.csv' in sources:
                s = sources['cn-app-dictionary.csv']
                if isinstance(s, list): s = s[0]
                if isinstance(s, dict):
                    pos = s.get('Part of speech', '') or s.get('Part of speech ch', '')
            elif 'lily-dict.csv' in sources:
                s = sources['lily-dict.csv']
                if isinstance(s, list): s = s[0]
                if isinstance(s, dict):
                    pos = s.get('Part_of_Speech', '') or s.get('PoS', '') or s.get('_PoS_Lily', '')
            elif 'hierarchical-dict.json' in sources:
                s = sources['hierarchical-dict.json']
                if isinstance(s, list): s = s[0]
                if isinstance(s, dict):
                    pos = s.get('pos', '') or s.get('PoS', '')

            if 'verb' in pos.lower() or pos.lower().startswith('v'):
                ced_verb_ids.append(d['merged_id'])

    output_dir = os.path.join('public', 'data', 'lists')
    os.makedirs(output_dir, exist_ok=True)

    list_data = {
        'name': 'Official Lists|CED Verbs',
        'words': ced_verb_ids,
        'sentences': []
    }

    output_file = os.path.join(output_dir, 'official_lists_ced_verbs.json')
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(list_data, f, indent=2)

    manifest_file = os.path.join(output_dir, 'manifest.json')
    with open(manifest_file, 'w', encoding='utf-8') as f:
        json.dump(['official_lists_ced_verbs.json'], f, indent=2)

    print(f"Successfully generated CED Verbs list with {len(ced_verb_ids)} words at {output_file}")

if __name__ == '__main__':
    generate_official_lists()
