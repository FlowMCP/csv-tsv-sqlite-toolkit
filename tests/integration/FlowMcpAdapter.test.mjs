import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

import { FlowMcpAdapter } from '../../src/adapters/FlowMcpAdapter.mjs'


const __filename = fileURLToPath( import.meta.url )
const __dirname = path.dirname( __filename )

const FIXTURE_DIR = path.resolve( __dirname, '..', 'fixtures', 'synthetic-csv' )
const FIXTURE_DB = path.join( FIXTURE_DIR, 'synthetic-csv.db' )


let tmpDir = null


beforeAll( () => {
    if( !existsSync( FIXTURE_DB ) ) {
        execFileSync( 'node', [ 'build-fixture.mjs' ], { cwd: FIXTURE_DIR, stdio: 'inherit' } )
    }
    if( !existsSync( FIXTURE_DB ) ) {
        throw new Error( `Synthetic fixture DB missing after build attempt: ${FIXTURE_DB}` )
    }
    tmpDir = mkdtempSync( path.join( tmpdir(), 'csv-adapter-int-' ) )
} )


afterAll( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


function createNoSealDb( { fileName } ) {
    const dbPath = path.join( tmpDir, fileName )
    const db = new Database( dbPath )
    db.exec( 'CREATE TABLE meta( key TEXT PRIMARY KEY, value TEXT )' )
    db.prepare( 'INSERT INTO meta( key, value ) VALUES( ?, ? )' ).run( 'buildDate', '2026-06-02T00:00:00Z' )
    db.exec( 'CREATE TABLE rows( name TEXT )' )
    db.close()
    return dbPath
}


describe( 'FlowMcpAdapter.verifySeal (integration — synthetic fixture)', () => {
    test( 'returns sealed=true with qualitySeal meta for sealed synthetic DB', () => {
        const result = FlowMcpAdapter.verifySeal( { dbPath: FIXTURE_DB } )
        expect( result.sealed ).toBe( true )
        expect( result.meta ).not.toBeNull()
        expect( result.meta.qualitySeal ).toBe( 'sqlite-csv' )
        expect( typeof result.meta.capabilities ).toBe( 'object' )
        expect( result.meta.capabilities.spatialQuery ).toBe( true )
        expect( result.meta.parseConfig.separator ).toBe( 'semicolon' )
        expect( result.reason ).toBeUndefined()
    } )


    test( 'returns sealed=false NO_SEAL for plain SQLite without qualitySeal', () => {
        const noSealPath = createNoSealDb( { fileName: 'no-seal.db' } )
        const result = FlowMcpAdapter.verifySeal( { dbPath: noSealPath } )
        expect( result.sealed ).toBe( false )
        expect( result.meta ).toBeNull()
        expect( result.reason ).toBe( 'NO_SEAL' )
    } )


    test( 'returns sealed=false DB_UNREADABLE for nonexistent path', () => {
        const missingPath = path.join( tmpDir, 'does-not-exist', 'missing.db' )
        const result = FlowMcpAdapter.verifySeal( { dbPath: missingPath } )
        expect( result.sealed ).toBe( false )
        expect( result.reason ).toBe( 'DB_UNREADABLE' )
    } )
} )


describe( 'FlowMcpAdapter.getAvailableMethods (integration — synthetic fixture)', () => {
    test( 'returns the three spatial/attribute methods for the geo fixture', () => {
        const { methods, capabilities } = FlowMcpAdapter.getAvailableMethods( { dbPath: FIXTURE_DB } )
        const names = methods.map( ( m ) => m.name )
        expect( names ).toContain( 'featuresInBBox' )
        expect( names ).toContain( 'nearPoint' )
        expect( names ).toContain( 'byType' )
        expect( names.length ).toBe( 3 )
        expect( capabilities.spatialQuery ).toBe( true )
    } )
} )


describe( 'FlowMcpAdapter.buildToolDefinitions (integration — synthetic fixture)', () => {
    test( 'every tool name is prefixed with the given namespace', () => {
        const { tools } = FlowMcpAdapter.buildToolDefinitions( { dbPath: FIXTURE_DB, namespace: 'places' } )
        expect( tools.length ).toBe( 3 )
        tools.forEach( ( tool ) => {
            expect( tool.name.startsWith( 'places.' ) ).toBe( true )
            expect( tool.inputSchema ).toHaveProperty( 'type', 'object' )
            expect( Array.isArray( tool.inputSchema.required ) ).toBe( true )
        } )
        const names = tools.map( ( t ) => t.name )
        expect( names ).toContain( 'places.nearPoint' )
    } )


    test( 'rejects an invalid namespace', () => {
        expect( () => FlowMcpAdapter.buildToolDefinitions( { dbPath: FIXTURE_DB, namespace: 'Bad Name' } ) ).toThrow()
    } )
} )
