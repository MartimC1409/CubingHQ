JS_OLD = """            state.playerName = data.person.name;

            if (!quiet) {
                // Display info
                if ($('#wca-display-name')) $('#wca-display-name').textContent = data.person.name;
                if ($('#wca-display-country')) $('#wca-display-country').textContent = data.person.country ? data.person.country.name : 'N/A';
                if ($('#wca-display-medals')) $('#wca-display-medals').textContent = `🥇${data.medals.gold} 🥈${data.medals.silver} 🥉${data.medals.bronze}`;
                if ($('#wca-display-comps')) $('#wca-display-comps').textContent = `${data.competition_count} competitions`;"""

JS_NEW = """            state.playerName = data.person.name;

            // Display info ALWAYS (so if user visits stats or setup page, it's populated)
            if ($('#wca-display-name')) $('#wca-display-name').textContent = data.person.name;
            if ($('#wca-display-country')) $('#wca-display-country').textContent = data.person.country ? data.person.country.name : 'N/A';
            if ($('#wca-display-medals')) $('#wca-display-medals').textContent = `🥇${data.medals.gold} 🥈${data.medals.silver} 🥉${data.medals.bronze}`;
            if ($('#wca-display-comps')) $('#wca-display-comps').textContent = `${data.competition_count} competitions`;"""

content = open('d:/AI-TESTE/app.js', encoding='utf-8').read().replace('\r\n', '\n')
if JS_OLD in content:
    content = content.replace(JS_OLD, JS_NEW)
    
    JS_OLD2 = """                if ($('#wca-info-display')) $('#wca-info-display').style.display = 'block';
                if ($('#wca-error-display')) $('#wca-error-display').style.display = 'none';
                showToast(`✅ Found: ${data.person.name}`, 'success');
            }

        } catch (err) {"""
        
    JS_NEW2 = """                if ($('#wca-info-display')) $('#wca-info-display').style.display = 'block';
                if ($('#wca-error-display')) $('#wca-error-display').style.display = 'none';
                
                if (!quiet) {
                    showToast(`✅ Found: ${data.person.name}`, 'success');
                }
            // End of removed if (!quiet) block

        } catch (err) {"""
        
    if JS_OLD2 in content:
        content = content.replace(JS_OLD2, JS_NEW2)
        open('d:/AI-TESTE/app.js', 'w', encoding='utf-8', newline='\n').write(content)
        print("Replaced quiet logic in JS")
    else:
        print("Not found 2")
else:
    print("Not found 1")
