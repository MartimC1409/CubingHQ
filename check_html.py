JS_OLD = """    // Build table of all personal records
    const allEvents = Object.keys(prs);

    // Define a sort order matching WCA typical order
    const eventOrder = ['333', '222', '444', '555', '666', '777', '333bf', '333fm', '333oh', 'clock', 'minx', 'pyram', 'skewb', 'sq1', '444bf', '555bf', '333mbf'];

    allEvents.sort((a, b) => {
        const idxA = eventOrder.indexOf(a);
        const idxB = eventOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    if (allEvents.length === 0) {"""

JS_NEW = """    // Show ONLY the personal records for the currently selected event
    let allEvents = Object.keys(prs).filter(evt => evt === currentEvent);

    if (allEvents.length === 0) {"""

content = open('d:/AI-TESTE/app.js', encoding='utf-8').read().replace('\r\n', '\n')
if JS_OLD in content:
    content = content.replace(JS_OLD, JS_NEW)
    open('d:/AI-TESTE/app.js', 'w', encoding='utf-8', newline='\n').write(content)
    print("Updated updatePRDisplay to show only current event")
else:
    print("Not found")
