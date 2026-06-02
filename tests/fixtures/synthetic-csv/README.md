# Synthetic CSV/TSV Fixture (CC0)

This directory contains a tiny, fully synthetic geo dataset used for tests and
CI. It is **not** derived from any real-world provider — all place names are
fictional (Simpsons-style) and coordinates are arbitrary. Licensed **CC0 1.0**
(see [`LICENSE`](./LICENSE)) — use freely.

## Files

| File | Format | Separator | Decimal | Purpose |
|------|--------|-----------|---------|---------|
| `source/sample.csv` | CSV | `;` (semicolon) | `,` (comma) | The "European" case |
| `source/sample.tsv` | TSV | `\t` (tab) | `.` (point) | TSV variant |

Both carry `latitude` / `longitude` geo columns and an `isCapital` **0/1**
column. The 0/1 column proves the type-coercion rule: without an explicit
`boolean` type it is kept as an **Integer**, never silently as Boolean.

## Usage (URL mode — Memo 096)

There is no converter and no `.db` artifact anymore. Tests and the manual runner
read these source files locally and serve them through a stubbed `fetch`, so the
URL pipeline ( fetch -> parse -> validate-on-load -> in-memory ) runs end to end
without a network. Never commit third-party CSV/TSV — only this CC0 sample.
