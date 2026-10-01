#!/usr/bin/env python3
"""Статический генератор одностраничного сайта «Центр инженерной биологии».

Зависимости: только стандартная библиотека Python 3.
Запуск из корня репозитория:  python3 src/build.py

Генерирует index.html и en/index.html, а также sitemap.xml и robots.txt.
Тело страницы лежит в src/content/<lang>/page.html.
"""

from __future__ import annotations

import os
import re
import sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, "src", "content")
BASE_URL = "https://engineeringbiology.ru"
YEAR = date.today().year

NAV = {
    "ru": [
        ("engineering", "Направление"),
        ("research", "Исследования"),
        ("method", "Метод"),
        ("goals", "Цели"),
        ("team", "Команда"),
        ("about", "О центре"),
    ],
    "en": [
        ("engineering", "Approach"),
        ("research", "Research"),
        ("method", "Method"),
        ("goals", "Goals"),
        ("team", "People"),
        ("about", "About"),
    ],
}

STRINGS = {
    "ru": {
        "brand": "Центр инженерной биологии",
        "site_name": "АНО «Центр инженерной биологии»",
        "skip": "К содержанию",
        "menu": "Разделы",
        "theme": "Переключить светлую и тёмную тему",
        "contact_label": "Почта",
        "rights": "Материалы можно цитировать со ссылкой на источник.",
        "credits_note": "Изображение: HoPo, «Caenorhabditis elegans DAPI», CC BY-SA 3.0, Wikimedia Commons. Изображение предпросмотра: ZEISS Microscopy, CC BY 2.0. Шрифты: Source Serif 4 (Adobe) и IBM Plex Mono (IBM), SIL OFL 1.1.",
    },
    "en": {
        "brand": "Center for Engineering Biology",
        "site_name": "Center for Engineering Biology",
        "skip": "Skip to content",
        "menu": "Sections",
        "theme": "Toggle light and dark theme",
        "contact_label": "Email",
        "rights": "Materials may be cited with attribution.",
        "credits_note": "Image: HoPo, \u201cCaenorhabditis elegans DAPI\u201d, CC BY-SA 3.0, Wikimedia Commons. Preview image: ZEISS Microscopy, CC BY 2.0. Fonts: Source Serif 4 (Adobe) and IBM Plex Mono (IBM), SIL OFL 1.1.",
    },
}

PAGES = [
    ("ru", "index.html", "Центр инженерной биологии. Предсказуемое управление живыми системами",
     "Центр инженерной биологии. Полный инженерный цикл от измеримого состояния живой системы до количественного предсказания вмешательства и его экспериментальной проверки."),
    ("en", "en/index.html", "Center for Engineering Biology. Predictable control of living systems",
     "Center for Engineering Biology. A full engineering cycle from a measurable state of a living system to a quantitative prediction of an intervention and its experimental validation."),
]

CONTACT = {
    "ru": [("GitHub", "https://github.com/EngineeringBiology"), ("Telegram", "https://t.me/reversebiolab"), ("Хабр", "https://habr.com/ru/users/gmuzykantov/articles/")],
    "en": [("GitHub", "https://github.com/EngineeringBiology"), ("Telegram", "https://t.me/reversebiolab"), ("Habr", "https://habr.com/ru/users/gmuzykantov/articles/")],
}


def prefix_for(out_path: str) -> str:
    return "../" * out_path.count("/")


def nav_html(lang: str, prefix: str) -> str:
    return "\n".join(f'<a href="#{h}">{t}</a>' for h, t in NAV[lang])


def lang_switch(lang: str, prefix: str) -> str:
    home_ru = prefix + "index.html"
    home_en = prefix + "en/index.html"
    if lang == "ru":
        ru = ' class="is-current" aria-current="true"'
        en = ""
    else:
        ru = ""
        en = ' class="is-current" aria-current="true"'
    return (f'<span class="lang" aria-label="Language">'
            f'<a href="{home_ru}" hreflang="ru"{ru}>RU</a>'
            f'<a href="{home_en}" hreflang="en"{en}>EN</a></span>')


def head(lang: str, title: str, desc: str, out_path: str) -> str:
    prefix = prefix_for(out_path)
    canonical = f"{BASE_URL}/" + ("" if out_path == "index.html" else "en/")
    alt_ru = f"{BASE_URL}/"
    alt_en = f"{BASE_URL}/en/"
    S = STRINGS[lang]
    return f"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta name="author" content="{S['site_name']}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141414" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="{canonical}">
<link rel="alternate" hreflang="ru" href="{alt_ru}">
<link rel="alternate" hreflang="en" href="{alt_en}">
<link rel="alternate" hreflang="x-default" href="{alt_ru}">
<meta property="og:type" content="website">
<meta property="og:locale" content="{'ru_RU' if lang == 'ru' else 'en_US'}">
<meta property="og:site_name" content="{S['site_name']}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{BASE_URL}/assets/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{BASE_URL}/assets/og.jpg">
<link rel="icon" href="{prefix}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="{prefix}assets/fonts/sourceserif4-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{prefix}assets/fonts.css">
<link rel="stylesheet" href="{prefix}assets/styles.css">"""


def header(lang: str, out_path: str) -> str:
    prefix = prefix_for(out_path)
    S = STRINGS[lang]
    home = prefix + ("index.html" if lang == "ru" else "en/index.html")
    return f"""<a class="skip" href="#main">{S['skip']}</a>
<header class="masthead">
  <div class="wrap wrap--wide masthead__inner">
    <a class="brand" href="{home}">{S['brand']}</a>
    <nav class="nav" id="nav" aria-label="{S['menu']}">
{nav_html(lang, prefix)}
    </nav>
    <div class="tools">
      {lang_switch(lang, prefix)}
      <a class="tools__gh" href="https://github.com/EngineeringBiology" rel="noreferrer noopener" target="_blank">GitHub</a>
      <button class="theme" type="button" aria-pressed="false" aria-label="{S['theme']}">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
      </button>
      <button class="menu" type="button" aria-expanded="false" aria-controls="nav" aria-label="{S['menu']}">
        <span class="menu__bars" aria-hidden="true"></span>
      </button>
    </div>
  </div>
</header>"""


def footer(lang: str, out_path: str) -> str:
    S = STRINGS[lang]
    links = "\n".join(f'<a href="{u}" target="_blank" rel="noreferrer noopener">{n}</a>' for n, u in CONTACT[lang])
    return f"""<footer class="colophon" id="contact">
  <div class="wrap">
    <div class="colophon__grid">
      <div>
        <strong>{S['brand']}</strong>
        <p class="colophon__contact">{S['contact_label']}: <a href="mailto:info@engineeringbiology.ru">info@engineeringbiology.ru</a></p>
        <nav class="colophon__links" aria-label="Links">{links}</nav>
      </div>
      <nav class="colophon__nav" aria-label="{S['menu']}">
{nav_html(lang, prefix_for(out_path))}
      </nav>
    </div>
    <p class="colophon__legal">&copy; {YEAR} {S['site_name']}. {S['rights']}</p>
    <p class="colophon__credits">{S['credits_note']}</p>
  </div>
</footer>"""


def render(lang: str, out_path: str, title: str, desc: str) -> str:
    with open(os.path.join(CONTENT, lang, "page.html"), encoding="utf-8") as fh:
        body = fh.read().strip()
    return f"""<!DOCTYPE html>
<html lang="{lang}" data-theme="light">
<head>
{head(lang, title, desc, out_path)}
<script>(function(){{var d=document.documentElement;d.classList.add("js");try{{var t=localStorage.getItem("eb-theme");if(!t)t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.setAttribute("data-theme",t);}}catch(e){{}}}})();</script>
</head>
<body>
{header(lang, out_path)}
<main id="main">
{body}
</main>
{footer(lang, out_path)}
<script src="{prefix_for(out_path)}assets/app.js" defer></script>
</body>
</html>
"""


def build() -> int:
    written = []
    for lang, out_path, title, desc in PAGES:
        html = render(lang, out_path, title, desc)
        dest = os.path.join(ROOT, out_path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w", encoding="utf-8") as fh:
            fh.write(html)
        written.append(out_path)
    entries = []
    for out_path in written:
        loc = f"{BASE_URL}/" + ("" if out_path == "index.html" else "en/")
        entries.append(f"  <url>\n    <loc>{loc}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>1.0</priority>\n  </url>")
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as fh:
        fh.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(entries) + "\n</urlset>\n")
    with open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8") as fh:
        fh.write(f"User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}/sitemap.xml\n")
    return len(written)


if __name__ == "__main__":
    print(f"Собрано страниц: {build()}")
    sys.exit(0)
