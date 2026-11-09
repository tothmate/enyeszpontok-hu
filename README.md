# enyeszpontok.hu

Static archive of the former WordPress site https://enyeszpontok.hu/, served by GitHub Pages from `docs/`.

How it was made:

1. Mirror the live site with wget (pages listed in `wp-sitemap.xml` plus everything they link to):
   ```
   wget --mirror --page-requisites --adjust-extension --convert-links \
     --restrict-file-names=windows --no-host-directories -e robots=off \
     --reject-regex '(/wp-json|xmlrpc\.php|/feed/?|/wp-admin|wp-login\.php|/embed/?$|\?p=|\?replytocom=|/oembed)' \
     -i seeds.txt -P mirror
   ```
   Then fetch the files that scripts load at runtime, which wget can't see
   (e.g. the PDF viewer's worker): `wget -x -nH -P mirror -i extra-files.txt`
2. `python3 clean.py mirror docs` renames query-string files (`style.css?ver=…`), drops WordPress-only
   tags and scripts, fixes canonical URLs and turns `…/index.html` links into clean `…/` links.

To change a page, edit the HTML in `docs/` directly and push.

To check every page in a real browser (failed requests, JS errors, broken images, PDF embeds):
`NODE_PATH=<node_modules with playwright-core> CHROME=<chromium binary> node check.cjs <base url> docs`
