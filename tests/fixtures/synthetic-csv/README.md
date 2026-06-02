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
`boolean` type it is stored as **Integer**, never silently as Boolean.

## Regenerate

```bash
node tests/fixtures/synthetic-csv/build-fixture.mjs
```

This builds `synthetic-csv.db` (gitignored) and asserts the `sqlite-csv` seal.
