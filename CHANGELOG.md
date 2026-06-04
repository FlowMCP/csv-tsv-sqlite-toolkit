# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-06-04

First published release. URL in-memory architecture and geo-standard alignment.

### Added
- Load geo **CSV/TSV from a URL** with a **mandatory parse config** (no silent
  defaults), validate-on-load, and the shared geo method family (`nearPoint`,
  `inBoundingBox`, `byType`).
- `FlowMcpAdapter` for FlowMCP CLI integration.

### Changed
- Rebuilt to **URL in-memory mode** (Memo 096) — no SQLite artifact, no file seal.
- Lon-first normalized **RFC-7946 FeatureCollection** output, aligned to the geo
  add-on standard (Memo 100).
- **Renamed repository** `csv-tsv-sqlite-toolkit` → `geo-csv-tsv-toolkit` (Memo 106).
  The old URL redirects; the npm package name is `geo-csv-tsv-toolkit`.

### Fixed
- CI no longer fails the build on a Codecov upload error (best-effort coverage upload).
