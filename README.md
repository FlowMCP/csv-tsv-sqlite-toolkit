# csv-tsv-sqlite-toolkit

<!-- Badges (License, Node, Workflow, Coverage) — enabled after going public -->
<!-- ![License](https://img.shields.io/github/license/FlowMCP/csv-tsv-sqlite-toolkit) -->
<!-- ![Node](https://img.shields.io/badge/node-22-blue) -->
<!-- ![Workflow](https://img.shields.io/github/actions/workflow/status/FlowMCP/csv-tsv-sqlite-toolkit/test-on-push.yml) -->
<!-- ![Coverage](https://img.shields.io/codecov/c/github/FlowMCP/csv-tsv-sqlite-toolkit) -->

Load geo **CSV/TSV** files from a URL into memory and expose reusable
spatial/attribute queries as FlowMCP auto-tools. There is **no SQLite file** and
**no file seal** — the complete file is fetched in a single request, validated
on load, and held in memory (Memo 096 URL model).

Unlike GeoJSON, a CSV/TSV file is **not self-describing**: the separator, the
decimal notation, and which columns carry latitude/longitude cannot be derived
from the file. This toolkit therefore enforces a **mandatory parse config with
no silent defaults** — you must declare `separator`, `decimal`, `latColumn`,
`lonColumn`, and a `typeCoercion` map explicitly, or the load aborts.

This is a sibling of [`geojson-sqlite-toolkit`](https://github.com/FlowMCP/geojson-sqlite-toolkit)
and follows the same FlowMCP add-on pattern (own repo → thin URL schema →
in-memory load → auto-inject via `FlowMcpAdapter`).

## Install

This package is not published to npm. Use it via GitHub:

```bash
npm install github:FlowMCP/csv-tsv-sqlite-toolkit
```

No native dependencies — the load path uses the global `fetch` and a pure-JS
parser.

## Load

```javascript
import { CsvUrlStore } from 'csv-tsv-sqlite-toolkit'

const result = await CsvUrlStore.loadFromUrl( {
    url: 'https://example.org/places.csv',   // HTTPS only
    parseConfig: {
        separator: 'semicolon',               // comma | semicolon | tab
        decimal:   'comma',                   // point | comma
        latColumn: 'latitude',
        lonColumn: 'longitude',
        typeCoercion: { id: 'integer', population: 'integer', isCapital: 'integer' }
    }
} )

// result.recordCount, result.capabilities, result.fromCache
```

The store:
1. Validates the URL is HTTPS and `parseConfig` is complete (else it throws — no silent default).
2. Fetches the COMPLETE CSV/TSV in a single request.
3. Parses (`CsvParser`) and validates on load — the configured geo and `typeCoercion` columns must exist.
4. Coerces every cell with `TypeCoercer` and holds the rows in memory keyed by URL (24 h TTL).

## Query

The query engine loads rows from the in-memory store and serves three queries
(Haversine in km internally, radius in **meters** at the API):

```javascript
import { CsvDefaultMethods } from 'csv-tsv-sqlite-toolkit'

CsvDefaultMethods.featuresInBBox( { url, minLat, minLon, maxLat, maxLon, limit } )
CsvDefaultMethods.nearPoint( { url, lat, lon, radiusMeters, limit } )   // sorted by distance, distanceM in output
CsvDefaultMethods.byType( { url, column, value, limit } )
```

## FlowMCP integration

```javascript
import { FlowMcpAdapter } from 'csv-tsv-sqlite-toolkit'

await FlowMcpAdapter.loadFromUrl( { url, parseConfig } )
// -> { loaded: true, url, capabilities, recordCount, fromCache }

FlowMcpAdapter.getAvailableMethods( { url } )
// -> { methods, capabilities } (capability-filtered)

FlowMcpAdapter.buildToolDefinitions( { url, namespace: 'places' } )
// -> { tools } with names prefixed 'places.' and valid inputSchema
```

### Auto-Tools

`buildToolDefinitions` emits the following tools, subject to the loaded file's
capability matrix:

- `featuresInBBox` — rows within a latitude/longitude bounding box (requires `spatialQuery`)
- `nearPoint` — rows near a coordinate, Haversine-sorted (requires `spatialQuery`)
- `byType` — exact-match attribute filter on any column (requires `attributeFilter`)

Tool names are prefixed with the schema namespace (e.g. `places.nearPoint`).
When a capability is missing, the corresponding tool is omitted.

### Schema auto-inject contract

A FlowMCP schema declares a thin URL add-on resource. The CLI resolves the
add-on, calls `loadFromUrl`, and injects the tools:

```javascript
export const schema = {
    namespace: 'places',
    name: 'places-csv-v1',
    version: '1.0.0',
    main: {
        resources: [
            {
                source:       'url-csv',
                url:          'https://example.org/places.csv',
                addon:        'csv-tsv-sqlite-toolkit',
                addonVersion: '>=0.1.0',
                addonSource:  'github:FlowMCP/csv-tsv-sqlite-toolkit',
                parseConfig: {
                    separator: 'semicolon',
                    decimal:   'comma',
                    latColumn: 'latitude',
                    lonColumn: 'longitude',
                    typeCoercion: { population: 'integer' }
                }
            }
        ],
        tools: []
    }
}
```

Provider CSV data is never shipped in this repository — the schema points at the
provider's own HTTPS URL.

## Mandatory Config (no silent defaults)

| Field | Type | Allowed values |
|-------|------|----------------|
| `separator` | enum | `comma` (`,`), `semicolon` (`;`), `tab` (`\t`) |
| `decimal` | enum | `point` (`1.5`), `comma` (`1,5`) |
| `latColumn` | string | header name of the latitude column |
| `lonColumn` | string | header name of the longitude column |
| `typeCoercion` | object | column → `integer` \| `number` \| `string` \| `boolean` |

If any field is missing the load throws a `CSV-URL-005` error — it **never**
picks a default. TSV is covered by `separator: 'tab'` (a TSV is a CSV with a tab
separator).

### Type-Coercion rule

A `0`/`1` column **without** an explicit type is kept as **Integer**, never
silently as Boolean. Boolean is produced **only** when `typeCoercion` declares
the column as `boolean` (consistent with the FlowMCP `boolean()` rule).

## Error Codes

The URL-mode load path uses the `CSV-URL-NNN` scheme:

| Code | Meaning |
|------|---------|
| `CSV-URL-001` | `url` missing, not a string, or not HTTPS |
| `CSV-URL-002` | fetch failed (network error or non-2xx) / file unparseable as CSV/TSV |
| `CSV-URL-003` | validate-on-load: a configured geo or `typeCoercion` column is missing |
| `CSV-URL-004` | query/accessor called for a URL that was never loaded |
| `CSV-URL-005` | `parseConfig` missing or incomplete (no silent default) |

The underlying parser `CSV-NNN` codes are documented in
[`docs/error-codes.md`](docs/error-codes.md).

## Capability Matrix

| Capability | Trigger |
|------------|---------|
| `hasGeo` | `latColumn` and `lonColumn` both present in header |
| `spatialQuery` | `hasGeo` and at least one row |
| `attributeFilter` | at least one row and one column |

## Provider Data Policy

Provider CSV/TSV datasets carry individual licenses and are **never** shipped in
this repo. Only the synthetic CC0 fixture under
`tests/fixtures/synthetic-csv/` is included. The pre-push guard
[`scripts/check-no-provider-data.sh`](scripts/check-no-provider-data.sh) aborts
commits that add foreign data files.

> [OpenAddresses (Issue #1113)](https://github.com/FlowMCP/) is a **future
> consumer** of this add-on, not a part of it — no OpenAddresses or BKG data
> lives here.

## Tests

```bash
git clone https://github.com/FlowMCP/csv-tsv-sqlite-toolkit
cd csv-tsv-sqlite-toolkit
npm install
npm test                 # jest unit suites (stubbed fetch, no live network)
npm run test:coverage:src
npm run test:manual      # POC against a local (non-committed) CSV/TSV file
```

## License

MIT — see [LICENSE](./LICENSE). The synthetic fixture is CC0.
