# Source assets (not deployed)

This directory holds editable or high-resolution originals. The build publishes
optimized files from `assets/`, and does not copy `source-assets/` into `_site/`.

- `figures/`: original publication figure PDFs, tracked for future image exports.
- `photos/`: local photo sources/crops, ignored by Git. Currently contains the
  intermediate portrait crop. Public derivatives are in `assets/images/profile/`.

The source PDFs correspond to the WebP images in `assets/images/publications/`.
Do not reference originals from webpage HTML; export an optimized image instead.
