# Yunfei Ge · personal website

A static academic homepage with a Markdown notebook. Every push to `main` builds
the website and publishes `_site/` to GitHub Pages through `.github/workflows/pages.yml`.

## Add a blog post

Put a `.md` file in `blog/` (subfolders are supported), then commit and push.
The archive and homepage preview update automatically, **newest first**.

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
- The first title and date headings are displayed in the article header, rather
  than repeated in the body. An explicit `description` replaces the auto excerpt.
- `draft: true`, empty files, `README.md`, and files/folders beginning with `_` or
  `.` are omitted. Draft Markdown sources are not included in the deployed site.
  This is a public repository: committed source files remain visible on GitHub.
- Use `lang: zh-CN` or `lang: en` to override automatic language detection.
- Store images beside the post, e.g. `blog/images/demo.png`, and link with
  `![Description](images/demo.png)`. Images, SVG, PDFs, and video assets are copied.
- Links to another `.md` note are converted to the published `.html` URL.
- A file at `blog/my-note.md` becomes `/blog/my-note.html`. Keep its filename
  stable to preserve links. `blog/index.md` is reserved for the archive.
- Markdown supports headings, tables, syntax-highlighted fenced code, blockquotes,
  footnotes, and an automatic heading outline. HTML is supported for trusted,
  author-written content.

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

- `index.html`: academic homepage and blog preview slot.
- `blog/`: Markdown articles and their media.
- `assets/css/styles.css`: academic homepage styling.
- `assets/css/blog.css`: notebook and article styling, plus homepage preview.
- `assets/js/`: homepage navigation and notebook search/filter/copy-code behavior.
- `scripts/build_blog.py`: Markdown metadata, sorting, rendering, and static build.
- `scripts/templates/blog.html`: archive and article template.
- `_site/`: generated publication output; do not edit directly.

GitHub Pages uses **GitHub Actions** as its publishing source. The build uses the
[official Pages artifact/deployment workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
Only the homepage, website assets, published notes, and supported blog media are deployed.
