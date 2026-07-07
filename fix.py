import re
with open('d:/AI-TESTE/app.js', encoding='utf-8') as f:
    content = f.read()

content = content.replace('const state = {', 'const ambientNoise = new Audio(\'competition_noise.webm\');\\nambientNoise.loop = true;\\nambientNoise.volume = 0.4;\\n\\nconst state = {')

old_switch = '''        $$('.view').forEach(v => v.classList.remove('active'));
        $(`#${viewName}-view`).classList.add('active');
        state.currentView = viewName;'''

new_switch = '''        $$('.view').forEach(v => v.classList.remove('active'));
        $(`#${viewName}-view`).classList.add('active');
        state.currentView = viewName;
        
        if (viewName === 'dashboard' && state.soundEnabled) {
            ambientNoise.play().catch(e => console.warn('Audio play failed', e));
        } else {
            ambientNoise.pause();
        }'''

if old_switch in content:
    content = content.replace(old_switch, new_switch)
    with open('d:/AI-TESTE/app.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Updated app.js successfully')
else:
    print('Pattern not found')
