import { CsvSqliteConverter } from '../../../src/index.mjs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Database from 'better-sqlite3'


const __filename = fileURLToPath( import.meta.url )
const __dirname = path.dirname( __filename )

const EXPECTED_SEAL = 'sqlite-csv'

// The synthetic CSV is the "European" case: semicolon separator, comma decimal.
// isCapital is the 0/1 column WITHOUT explicit boolean type → must stay Integer.
const CONFIG = {
    separator: 'semicolon',
    decimal: 'comma',
    latColumn: 'latitude',
    lonColumn: 'longitude',
    typeCoercion: {
        id: 'integer',
        population: 'integer',
        isCapital: 'integer'
    }
}


async function main() {
    const sourceCsv = path.join( __dirname, 'source', 'sample.csv' )
    const dbPath = path.join( __dirname, 'synthetic-csv.db' )

    console.log( '[build-fixture] Source CSV:', sourceCsv )
    console.log( '[build-fixture] Target DB :', dbPath )
    console.log( '[build-fixture] Config    :', JSON.stringify( CONFIG ) )

    const result = CsvSqliteConverter.start( {
        input: sourceCsv,
        inputType: 'csv',
        dbPath,
        config: CONFIG,
        force: false,
        sourceUrl: null
    } )

    if( !result.status ) {
        console.error( '[build-fixture] FAIL — converter aborted' )
        console.error( '[build-fixture] report:', JSON.stringify( result.report, null, 2 ) )
        process.exit( 1 )
    }

    const db = new Database( dbPath, { readonly: true } )
    const sealRow = db.prepare( "SELECT value FROM meta WHERE key = 'qualitySeal'" ).get()
    const sampleRow = db.prepare( "SELECT * FROM rows WHERE name = 'Springfield'" ).get()
    db.close()

    const seal = sealRow ? sealRow.value : null
    if( seal !== EXPECTED_SEAL ) {
        console.error( `[build-fixture] SEAL MISMATCH — expected "${EXPECTED_SEAL}", got "${seal}"` )
        process.exit( 1 )
    }

    console.log( '[build-fixture] qualitySeal =', seal )
    console.log( '[build-fixture] sample row  =', JSON.stringify( sampleRow ) )
    console.log( '[build-fixture] DONE — synthetic-csv.db is ready.' )
    process.exit( 0 )
}


main()
    .catch( ( err ) => {
        console.error( '[build-fixture] UNCAUGHT ERROR:', err )
        process.exit( 1 )
    } )
