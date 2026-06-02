import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'


const __filename = fileURLToPath( import.meta.url )
const __dirname = path.dirname( __filename )

const FIXTURE_DIR = path.resolve( __dirname, '..', 'fixtures', 'synthetic-csv' )


console.log( '[run-all] Building synthetic-csv fixture...' )
execFileSync( 'node', [ 'build-fixture.mjs' ], { cwd: FIXTURE_DIR, stdio: 'inherit' } )
console.log( '[run-all] DONE.' )
