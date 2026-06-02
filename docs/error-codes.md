# CSV-NNN Error Codes

Reference for all codes emitted by `csv-tsv-sqlite-toolkit`. Codes are grouped by
severity, signalled by the numeric range.

| Range | Severity |
|-------|----------|
| `CSV-001` – `CSV-099` | ERROR (blocks conversion in default mode) |
| `CSV-100` – `CSV-199` | WARNING (allows conversion, but no seal) |
| `CSV-200` – `CSV-299` | INFO (informational, seal still possible) |

## ERROR codes

| Code | Meaning | Example |
|------|---------|---------|
| `CSV-001` | Mandatory parse config missing | `config` is `{}` — no `separator`/`decimal`/`latColumn`/`lonColumn`/`typeCoercion` |
| `CSV-002` | Configured `latColumn`/`lonColumn` not present in header | Config says `latColumn: 'lat'` but header has `latitude` |
| `CSV-003` | Datatype mismatch during coercion | Column typed `integer` contains `"abc"` |
| `CSV-004` | CSV/TSV file has no header row | First row is empty |
| `CSV-005` | File is empty or unparseable | Zero-byte input |
| `CSV-006` | Unsupported input format | Unknown separator token |

## WARNING codes

| Code | Meaning | Example |
|------|---------|---------|
| `CSV-101` | Row has fewer columns than header | A short row, padded with empty values |
| `CSV-102` | Non-numeric value in lat/lon column | `latitude` cell is `"n/a"` |
| `CSV-103` | Duplicate header column name | Two columns named `name` |
| `CSV-104` | Non-UTF-8 encoding detected | ISO-8859-1 bytes |

## INFO codes

| Code | Meaning | Example |
|------|---------|---------|
| `CSV-201` | Geo columns detected (lat + lon present) | Both configured geo columns found |
| `CSV-202` | Type coercion applied | One or more columns coerced per `typeCoercion` |

## No silent defaults

There is **no default** for any of the five mandatory config fields
(`separator`, `decimal`, `latColumn`, `lonColumn`, `typeCoercion`). A missing
value raises `CSV-001` and aborts the conversion — the converter never guesses.

## Type coercion rule

A `0`/`1` column **without** an explicit type is stored as **Integer**, never
silently as Boolean. Boolean is produced **only** when the `typeCoercion` map
declares the column as `boolean` (consistent with the FlowMCP `boolean()`
primitive rule).

## Adding new codes

Add to `src/shared/Validation.mjs` (the `CSV_CODES` dictionary). The severity is
derived from the numeric range. Document the new code in this file.
