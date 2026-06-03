import { FlowMcpAdapter, CsvDefaultMethods } from '../../src/index.mjs'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'


const __filename = fileURLToPath( import.meta.url )
const __dirname = path.dirname( __filename )


//
// Manual POC runner (URL mode — Memo 096). Point the first argument at a LOCAL
// CSV/TSV file you keep OUTSIDE the repo. Never commit third-party data. The
// file is read locally and served through a stubbed fetch so the URL pipeline
// ( fetch -> parse -> validate-on-load -> in-memory ) runs end to end without a
// network. Falls back to the CC0 synthetic fixture.
//
// parseConfig is MANDATORY (no silent default). The defaults below match the
// synthetic fixture (semicolon separator, comma decimal, latitude/longitude).
//

async function main() {
    const arg = process.argv[ 2 ]
    const file = arg
        ? path.resolve( arg )
        : path.join( __dirname, '..', 'fixtures', 'synthetic-csv', 'source', 'sample.csv' )
    const url = 'https://example.org/manual-data.csv'

    const parseConfig = {
        separator: 'semicolon',
        decimal: 'comma',
        latColumn: 'latitude',
        lonColumn: 'longitude',
        typeCoercion: { population: 'integer', isCapital: 'integer' }
    }

    console.log( '[run-all] file:', file )
    console.log( '[run-all] url :', url )

    const body = readFileSync( file, 'utf-8' )
    global.fetch = async () => ( { ok: true, status: 200, text: async () => body } )

    const loaded = await FlowMcpAdapter.loadFromUrl( { url, parseConfig } )
    console.log( '[run-all] loaded:', loaded.loaded, 'records:', loaded.recordCount, 'capabilities:', loaded.capabilities )

    const { tools } = FlowMcpAdapter.buildToolDefinitions( { url, namespace: 'places' } )
    console.log( '[run-all] tools:', tools.map( ( t ) => t.name ) )

    const bbox = CsvDefaultMethods.inBoundingBox( {
        url, minLon: 5, minLat: 47, maxLon: 15, maxLat: 55, limit: 100
    } )
    console.log( '[run-all] inBoundingBox matchCount:', bbox.matchCount )

    const near = CsvDefaultMethods.nearPoint( {
        url, lat: 52.52, lon: 13.405, radiusMeters: 500000, limit: 50
    } )
    console.log( '[run-all] nearPoint matchCount:', near.matchCount )

    process.exit( 0 )
}


main()
    .catch( ( err ) => {
        console.error( '[run-all] UNCAUGHT ERROR:', err )
        process.exit( 1 )
    } )
