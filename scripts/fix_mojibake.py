import os
import glob

def fix_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return
    
    # Replace known mojibake
    new_content = content.replace('â€”', '—')
    new_content = new_content.replace('â†’', '→')
    new_content = new_content.replace('âš™ï¸', '⚙️')
    new_content = new_content.replace('âŒ¨ï¸', '⌨️')
    new_content = new_content.replace('ðŸ†', '🏆')
    new_content = new_content.replace('ðŸ“…', '📅')
    new_content = new_content.replace('ðŸ“', '🏢')
    new_content = new_content.replace('ðŸŒ', '🌍')
    new_content = new_content.replace('ðŸ‘¥', '👥')
    new_content = new_content.replace('ðŸ§©', '🧩')
    new_content = new_content.replace('ðŸ‘¤', '👤')
    new_content = new_content.replace('ðŸ…', '🏅')
    new_content = new_content.replace('ðŸ”¢', '🔢')
    new_content = new_content.replace('ðŸ“‹', '📋')
    new_content = new_content.replace('ðŸŽ¨', '🎨')
    new_content = new_content.replace('ðŸ“Š', '📊')
    new_content = new_content.replace('ðŸ”', '🔍')
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Fixed {filepath}")

for ext in ('*.html', '*.js', '*.css'):
    for filepath in glob.glob(f"d:/AI-TESTE/**/{ext}", recursive=True):
        if 'node_modules' not in filepath:
            fix_file(filepath)
