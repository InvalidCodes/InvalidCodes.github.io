# Yunfei Ge · personal website

A static academic homepage with a Markdown notebook. Every push to `main` builds
the website and publishes `_site/` to GitHub Pages through `.github/workflows/pages.yml`.

## Add a blog post

Put a `.md` file in `blog/` (subfolders are supported), then commit and push.
The archive and homepage preview update automatically, **newest first**.

Put book reflections in `blog/reading-notes/` to include them only in the dedicated
**Reading Notes** archive. Blog and Reading Notes have separate lists, topic
filters, and previous/next navigation; the homepage Blog preview includes only
Blog posts. The five imported
English translations are documented in [the import manifest](blog/reading-notes/README.md).

Recommended format:

```markdown
---
title: A small idea worth keeping
date: 2026-09-26
description: A short introduction for the article list.
tags: [Research, Robotics]
---

Your Markdown goes here.

## The idea

Text, images, lists, tables, and fenced code blocks all work.
```

Metadata is optional. A plain file can use the existing `csdn.md` format:

```markdown
# My article title

## Sep 1, 2025

The article starts here.
```

- Title: `title` in front matter → first `#` heading → filename.
- Date: `date` in front matter → date heading immediately after the title →
  `YYYY-MM-DD-` filename prefix → first Git addition date. Uncommitted files use
  their modification date in local previews. **Set `date` for precise ordering.**
  Use `date: '2021-01'` when only the month is known; the page will not invent a day.
- The first title and date headings are displayed in the article header, rather
  than repeated in the body. An explicit `description` replaces the auto excerpt.
- Optional `subtitle` appears below the article title, outside the table of contents.
- `draft: true`, empty files, `README.md`, and files/folders beginning with `_` or
  `.` are omitted. Draft Markdown sources are not included in the deployed site.
  This is a public repository: committed source files remain visible on GitHub.
- Use `lang: zh-CN` or `lang: en` to override automatic language detection.
- Store images beside the post, e.g. `blog/images/demo.png`, and link with
  `![Description](images/demo.png)`. Images, SVG, PDFs, and video assets are copied.
- Links to another `.md` note are converted to the published `.html` URL.
- A file at `blog/my-note.md` becomes `/blog/my-note.html`. Keep its filename
  stable to preserve links. `blog/index.md` and `blog/reading-notes/index.md` are
  reserved for the archives.
- Optional `source_url` adds a link to an imported reading note's Chinese original.
- Markdown supports headings, tables, syntax-highlighted fenced code, blockquotes,
  footnotes, and an automatic heading outline. HTML is supported for trusted,
  author-written content.
- Math uses `\(...\)` or `$...$` inline, and `\[...\]` or `$$...$$` in separate
  blocks. Arithmatex preserves the TeX during the build; locally hosted KaTeX and
  fonts render it in the browser. Math assets load only for articles with formulas.

## Local preview

One-time setup:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-blog.txt
```

Build and serve:

```bash
.venv/bin/python scripts/build_blog.py
.venv/bin/python -m http.server 8000 --directory _site
```

Open `http://localhost:8000/blog/`. After editing Markdown, templates, CSS, or JS,
run the build again and refresh the browser. Generated files stay out of Git.

```bash
.venv/bin/python -m unittest discover -s scripts/tests -v
```

## Structure

```text
index.html                 Academic homepage
blog/                      Blog Markdown and article media
  reading-notes/           Separate reading-notes collection
assets/                    Files served to visitors
  css/typography.css       Shared heading (DM Sans), note (Klee), and prose (Times) fonts
  css/home.css             Academic homepage styling; headings use Aptos
  css/blog.css             Blog styling and homepage blog preview
  js/home.js               Homepage navigation
  js/blog.js               Blog search, filtering, and code copying
  js/blog-art.js           Hero word cloud, opening initial, and cursor stardust
  js/blog-math.js          Article math rendering
  images/profile/          Optimized portraits
  images/publications/     Optimized paper figures
  images/logos/            Institution and conference logos
  images/favicon.png       Browser icon
  vendor/katex/            Math library, fonts, and license
scripts/
  build_blog.py            Static website build
  templates/blog.html      Archive and article template
  tests/test_blog.py       Build regression checks
source-assets/             Original figures and local photo crops; never deployed
docs/archive/              Historical documentation; not current instructions
requirements-blog.txt      Pinned build dependencies
.github/workflows/         GitHub Pages build and deployment
```

Local working directories are intentionally ignored by Git: `.venv/` is the
Python build environment; `_site/` is regenerated on every build. Neither is
hand-authored website content. Python caches and OS metadata can be removed
without losing source files.

KaTeX's font files are referenced by its bundled CSS, including fallback formats;
keep the vendor distribution and license together. Original figure PDFs live in
`source-assets/figures/` instead of the public image directory.

GitHub Pages uses **GitHub Actions** as its publishing source. The build uses the
[official Pages artifact/deployment workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
Only the homepage, website assets, published notes, and supported blog media are deployed.
