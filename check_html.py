HTML_OLD = """    <!-- Google AdSense Auto Ads -->
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1447384831345579"
     crossorigin="anonymous"></script>
</head>"""

HTML_NEW = """    <!-- Google AdSense Verification & Auto Ads -->
    <meta name="google-adsense-account" content="ca-pub-1447384831345579">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1447384831345579"
     crossorigin="anonymous"></script>
</head>"""

content = open('d:/AI-TESTE/index.html', encoding='utf-8').read().replace('\r\n', '\n')
if HTML_OLD in content:
    content = content.replace(HTML_OLD, HTML_NEW)
    open('d:/AI-TESTE/index.html', 'w', encoding='utf-8', newline='\n').write(content)
    print("Added adsense meta tag")
else:
    print("Not found")
