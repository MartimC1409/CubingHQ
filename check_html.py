HTML_OLD = """    <script src="https://cdn.cubing.net/js/cubing/twisty" type="module"></script>
</head>"""

HTML_NEW = """    <script src="https://cdn.cubing.net/js/cubing/twisty" type="module"></script>
    
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-YQSNC2LYVS"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-YQSNC2LYVS');
    </script>
</head>"""

content = open('d:/AI-TESTE/index.html', encoding='utf-8').read().replace('\r\n', '\n')
if HTML_OLD in content:
    content = content.replace(HTML_OLD, HTML_NEW)
    open('d:/AI-TESTE/index.html', 'w', encoding='utf-8', newline='\n').write(content)
    print("Replaced Google Analytics in HTML")
else:
    print("Not found")
