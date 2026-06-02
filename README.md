# csv-tsv-sqlite-toolkit

<!-- Badges (License, Node, Workflow, Coverage) — enabled after going public -->
<!-- ![License](https://img.shields.io/github/license/FlowMCP/csv-tsv-sqlite-toolkit) -->
<!-- ![Node](https://img.shields.io/badge/node-22-blue) -->
<!-- ![Workflow](https://img.shields.io/github/actions/workflow/status/FlowMCP/csv-tsv-sqlite-toolkit/test-on-push.yml) -->
<!-- ![Coverage](https://img.shields.io/codecov/c/github/FlowMCP/csv-tsv-sqlite-toolkit) -->

Convert geo **CSV/TSV** files into queryable SQLite databases with a quality
seal, capability detection, and reusable spatial queries.

Unlike GeoJSON, a CSV/TSV file is **not self-describing**: the separator, the
decimal notation, and which columns carry latitude/longitude cannot be derived
from the file. This toolkit therefore enforces a **mandatory parse config with
no silent defaults** — you must declare `separator`, `decimal`, `latColumn`,
`lonColumn`, and a `typeCoercion` map explicitly, or the conversion aborts.

This is a sibling of [`gtfs-sqlite-toolkit`](https://github.com/FlowMCP/gtfs-sqlite-toolkit)
and follows the same FlowMCP add-on pattern (own repo → converter → sealed
SQLite → auto-inject via `FlowMcpAdapter`).

## FlowMCP Integration

### Overview

This toolkit is a **FlowMCP file add-on**: it converts a geo CSV/TSV into a
sealed SQLite resource that any FlowMCP schema can declare via
`source: 'sqlite-csv'`. The FlowMCP-CLI auto-injects spatial query tools by
reading the quality seal and capability matrix the converter writes into the
`meta` table.

The toolkit is distributed as a GitHub repository — **not** via the npm
registry.

### Schema Example

```javascript
export const schema = {
    namespace: 'places',
    name: 'places-csv-v1',
    version: '1.0.0',
    main: {
        resources: [
            {
                source:       'sqlite-csv',
                mode:         'file-based',
                path:         '${FLOWMCP_RESOURCES}/places.db',
                addon:        'csv-tsv-sqlite-toolkit',
                addonVersion: '>=0.1.0',
                addonSource:  'github:FlowMCP/csv-tsv-sqlite-toolkit'
            }
        ],
        tools: [
            // OPTIONAL: schema-specific tools here.
            // Default CSV spatial tools are injected automatically (see Auto-Tools).
        ]
    }
}
```

`${FLOWMCP_RESOURCES}` resolves to the env var of the same name, with the
default `~/.flowmcp/resources/`. Provider CSV data is never shipped in this
repository — users convert and place their DB under that path locally.

### Import

```bash
# Latest from main
npm install github:FlowMCP/csv-tsv-sqlite-toolkit

# Pin to a release
npm install github:FlowMCP/csv-tsv-sqlite-toolkit#v0.1.0
```

> **Not on the npm registry.** Distribution is via GitHub only.

### Auto-Tools

When FlowMCP-CLI accepts a `source: 'sqlite-csv'` resource it auto-injects the
following tools (subject to the converted file's capability matrix):

- `featuresInBBox` — rows within a latitude/longitude bounding box (requires `spatialQuery`)
- `nearPoint` — rows near a coordinate, Haversine-sorted (requires `spatialQuery`)
- `byType` — exact-match attribute filter on any column (requires `attributeFilter`)

Tool names are prefixed with the schema namespace (e.g. `places.nearPoint`).
When a capability is missing from the converted DB, the corresponding tool is
omitted.

### Seal Verification

Before auto-injection the CLI calls `FlowMcpAdapter.verifySeal( { dbPath } )`.
The result has the shape `{ sealed, meta, reason? }`:

| Reason | Meaning |
|--------|---------|
| `NO_SEAL` | `meta.qualitySeal` is missing or not `'sqlite-csv'`. |
| `NO_META` | DB exists but the `meta` table is absent. |
| `DB_UNREADABLE` | File missing, locked, or corrupt. |

When `sealed === true`, `meta` carries the mandatory keys (`qualitySeal`,
`converterVersion`, `sourceUrl`, `sourceHash`, `buildDate`, `rowCounts`,
`capabilities`, `parseConfig`, `columnTypes`, `validationReport`). The
`parseConfig` is recorded so a conversion is fully reproducible.

## Quickstart

```javascript
import { CsvSqliteConverter } from 'csv-tsv-sqlite-toolkit'

const result = CsvSqliteConverter.start( {
    input:     './places.csv',
    inputType: 'csv',
    dbPath:    './places.db',
    config: {
        separator: 'semicolon',   // comma | semicolon | tab
        decimal:   'comma',       // point | comma
        latColumn: 'latitude',
        lonColumn: 'longitude',
        typeCoercion: { id: 'integer', population: 'integer', isCapital: 'integer' }
    }
} )

console.log( result.seal )         // 'sqlite-csv' or null
console.log( result.capabilities ) // { hasGeo: true, spatialQuery: true, attributeFilter: true }
```

## Mandatory Config (no silent defaults)

| Field | Type | Allowed values |
|-------|------|----------------|
| `separator` | enum | `comma` (`,`), `semicolon` (`;`), `tab` (`\t`) |
| `decimal` | enum | `point` (`1.5`), `comma` (`1,5`) |
| `latColumn` | string | header name of the latitude column |
| `lonColumn` | string | header name of the longitude column |
| `typeCoercion` | object | column → `integer` \| `number` \| `string` \| `boolean` |

If any field is missing the converter returns `status: false` with a
`CSV-001` error — it **never** picks a default. TSV is covered by
`separator: 'tab'` (a TSV is a CSV with a tab separator).

### Type-Coercion rule

A `0`/`1` column **without** an explicit type is stored as **Integer**, never
silently as Boolean. Boolean is produced **only** when `typeCoercion` declares
the column as `boolean` (consistent with the FlowMCP `boolean()` rule).

## Query Engine

`CsvQueryEngine` loads the sealed DB once (in-memory cache) and serves three
spatial queries, mirroring the OPSD engine pattern:

```javascript
import { CsvQueryEngine } from 'csv-tsv-sqlite-toolkit'

CsvQueryEngine.featuresInBBox( { dbPath, minLat, minLon, maxLat, maxLon, limit } )
CsvQueryEngine.nearPoint( { dbPath, lat, lon, radius, limit } )   // Haversine, km
CsvQueryEngine.byType( { dbPath, column, value, limit } )
```

## Methods

### `CsvSqliteConverter.start( { input, inputType, force, dbPath, sourceUrl, config } )` → `{ status, dbPath, report, capabilities, seal, aborted }`

| Param | Type | Default | Required |
|-------|------|---------|----------|
| `input` | `Buffer` \| `string` | — | yes |
| `inputType` | `'csv'` \| `'tsv'` \| `'file'` \| `'buffer'` \| `'auto'` | `'auto'` | no |
| `force` | `boolean` | `false` | no |
| `dbPath` | `string` | — | yes |
| `sourceUrl` | `string` \| `null` | `null` | no |
| `config` | mandatory parse config (see above) | — | yes |

## Error Codes

All `CSV-NNN` codes are documented in [`docs/error-codes.md`](docs/error-codes.md).

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

## Contributing

```bash
git clone https://github.com/FlowMCP/csv-tsv-sqlite-toolkit
cd csv-tsv-sqlite-toolkit
npm install
npm test
npm run test:coverage:src
```

## License

MIT — see [LICENSE](./LICENSE).
