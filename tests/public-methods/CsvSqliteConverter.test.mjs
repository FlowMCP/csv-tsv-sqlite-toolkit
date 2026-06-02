import { describe, test, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'

import { CsvSqliteConverter } from '../../src/CsvSqliteConverter.mjs'
import { CsvQueryEngine } from '../../src/converters/csv/CsvQueryEngine.mjs'


let tmpDir = null

const CSV_TEXT = [
    'id;name;category;latitude;longitude;population;isCapital',
    '1;Springfield;city;52,5200;13,4050;3700;1',
    '2;Shelbyville;city;48,1351;11,5820;1500;0',
    '3;Capital City;city;50,1109;8,6821;750;1'
].join( '\n' )

const TSV_TEXT = [
    'id\tname\tcategory\tlatitude\tlongitude\tpopulation\tisCapital',
    '1\tSpringfield\tcity\t52.5200\t13.4050\t3700\t1',
    '2\tShelbyville\tcity\t48.1351\t11.5820\t1500\t0'
].join( '\n' )

const SEMI_CONFIG = {
    separator: 'semicolon',
    decimal: 'comma',
    latColumn: 'latitude',
    lonColumn: 'longitude',
    typeCoercion: { id: 'integer', population: 'integer', isCapital: 'integer' }
}

const TAB_CONFIG = {
    separator: 'tab',
    decimal: 'point',
    latColumn: 'latitude',
    lonColumn: 'longitude',
    typeCoercion: { id: 'integer', population: 'integer', isCapital: 'integer' }
}


beforeAll( () => {
    tmpDir = mkdtempSync( path.join( tmpdir(), 'csv-toolkit-conv-' ) )
} )


afterEach( () => {
    CsvQueryEngine.clearCache()
} )


afterAll( () => {
    if( tmpDir && existsSync( tmpDir ) ) {
        rmSync( tmpDir, { recursive: true, force: true } )
        tmpDir = null
    }
} )


function convertSemicolon( { fileName } ) {
    const dbPath = path.join( tmpDir, fileName )
    const result = CsvSqliteConverter.start( {
        input: Buffer.from( CSV_TEXT, 'utf-8' ),
        inputType: 'buffer',
        dbPath,
        config: SEMI_CONFIG
    } )
    return { dbPath, result }
}


describe( 'CsvSqliteConverter — config rejection (no silent default)', () => {
    test( 'empty config aborts with status false and CSV-001', () => {
        const result = CsvSqliteConverter.start( {
            input: Buffer.from( CSV_TEXT, 'utf-8' ),
            inputType: 'buffer',
            dbPath: path.join( tmpDir, 'should-not-exist.db' ),
            config: {}
        } )
        expect( result.status ).toBe( false )
        expect( result.aborted ).toBe( true )
        expect( result.dbPath ).toBeNull()
        const codes = result.report.errors.map( ( e ) => e.code )
        expect( codes ).toContain( 'CSV-001' )
        expect( existsSync( path.join( tmpDir, 'should-not-exist.db' ) ) ).toBe( false )
    } )


    test( 'missing separator aborts (no DB written)', () => {
        const config = { ...SEMI_CONFIG }
        delete config.separator
        const result = CsvSqliteConverter.start( {
            input: Buffer.from( CSV_TEXT, 'utf-8' ),
            inputType: 'buffer',
            dbPath: path.join( tmpDir, 'no-sep.db' ),
            config
        } )
        expect( result.status ).toBe( false )
        expect( result.report.errors.some( ( e ) => e.message.includes( 'separator' ) ) ).toBe( true )
    } )
} )


describe( 'CsvSqliteConverter — semicolon CSV round-trip', () => {
    test( 'seals as sqlite-csv and records parseConfig in meta', () => {
        const { dbPath, result } = convertSemicolon( { fileName: 'semi.db' } )
        expect( result.status ).toBe( true )
        expect( result.seal ).toBe( 'sqlite-csv' )

        const db = new Database( dbPath, { readonly: true } )
        const seal = db.prepare( "SELECT value FROM meta WHERE key='qualitySeal'" ).get().value
        const parseConfig = JSON.parse( db.prepare( "SELECT value FROM meta WHERE key='parseConfig'" ).get().value )
        db.close()

        expect( seal ).toBe( 'sqlite-csv' )
        expect( parseConfig.separator ).toBe( 'semicolon' )
        expect( parseConfig.decimal ).toBe( 'comma' )
    } )


    test( 'comma-decimal lat/lon parsed to float; isCapital 0/1 stays Integer', () => {
        const { dbPath } = convertSemicolon( { fileName: 'types.db' } )

        const db = new Database( dbPath, { readonly: true } )
        const row = db.prepare( "SELECT * FROM rows WHERE name='Springfield'" ).get()
        const colType = db.prepare( "SELECT typeof(isCapital) AS t, typeof(lat) AS lt FROM rows WHERE name='Springfield'" ).get()
        db.close()

        // decimal-comma "52,5200" → 52.52 (float)
        expect( row.lat ).toBeCloseTo( 52.52 )
        expect( row.lon ).toBeCloseTo( 13.405 )
        expect( colType.lt ).toBe( 'real' )

        // isCapital 0/1 WITHOUT explicit boolean → Integer, not Boolean
        expect( row.isCapital ).toBe( 1 )
        expect( typeof row.isCapital ).toBe( 'number' )
        expect( colType.t ).toBe( 'integer' )
    } )


    test( 'lat/lon index exists on the rows table', () => {
        const { dbPath } = convertSemicolon( { fileName: 'idx.db' } )
        const db = new Database( dbPath, { readonly: true } )
        const idx = db
            .prepare( "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='rows'" )
            .all()
            .map( ( r ) => r.name )
        db.close()
        expect( idx.some( ( n ) => n.includes( 'lat' ) && n.includes( 'lon' ) ) ).toBe( true )
    } )
} )


describe( 'CsvSqliteConverter — explicit boolean coercion', () => {
    test( 'isCapital declared boolean still stores 0/1 but is semantically boolean-typed', () => {
        const dbPath = path.join( tmpDir, 'boolean.db' )
        const result = CsvSqliteConverter.start( {
            input: Buffer.from( CSV_TEXT, 'utf-8' ),
            inputType: 'buffer',
            dbPath,
            config: { ...SEMI_CONFIG, typeCoercion: { ...SEMI_CONFIG.typeCoercion, isCapital: 'boolean' } }
        } )
        expect( result.status ).toBe( true )

        const db = new Database( dbPath, { readonly: true } )
        const columnTypes = JSON.parse( db.prepare( "SELECT value FROM meta WHERE key='columnTypes'" ).get().value )
        const row = db.prepare( "SELECT * FROM rows WHERE name='Springfield'" ).get()
        db.close()

        expect( columnTypes.isCapital ).toBe( 'boolean' )
        expect( row.isCapital ).toBe( 1 )
    } )
} )


describe( 'CsvSqliteConverter — TSV round-trip', () => {
    test( 'tab separator parses a TSV with point decimals', () => {
        const dbPath = path.join( tmpDir, 'tab.db' )
        const result = CsvSqliteConverter.start( {
            input: Buffer.from( TSV_TEXT, 'utf-8' ),
            inputType: 'buffer',
            dbPath,
            config: TAB_CONFIG
        } )
        expect( result.status ).toBe( true )
        expect( result.seal ).toBe( 'sqlite-csv' )

        const db = new Database( dbPath, { readonly: true } )
        const row = db.prepare( "SELECT * FROM rows WHERE name='Springfield'" ).get()
        db.close()
        expect( row.lat ).toBeCloseTo( 52.52 )
        expect( row.isCapital ).toBe( 1 )
        expect( typeof row.isCapital ).toBe( 'number' )
    } )
} )


describe( 'CsvQueryEngine — spatial queries against a sealed DB', () => {
    test( 'nearPoint returns nearest features sorted by distance', () => {
        const { dbPath } = convertSemicolon( { fileName: 'near.db' } )
        const { features } = CsvQueryEngine.nearPoint( { dbPath, lat: 52.52, lon: 13.405, radius: 50, limit: 10 } )
        expect( features.length ).toBeGreaterThanOrEqual( 1 )
        expect( features[ 0 ].name ).toBe( 'Springfield' )
        expect( features[ 0 ].distanceKm ).toBeCloseTo( 0, 1 )
    } )


    test( 'featuresInBBox returns features within the box', () => {
        const { dbPath } = convertSemicolon( { fileName: 'bbox.db' } )
        const { features } = CsvQueryEngine.featuresInBBox( {
            dbPath, minLat: 49, minLon: 8, maxLat: 53, maxLon: 14, limit: 100
        } )
        const names = features.map( ( f ) => f.name )
        expect( names ).toContain( 'Springfield' )
        expect( names ).toContain( 'Capital City' )
        expect( names ).not.toContain( 'Shelbyville' )
    } )


    test( 'byType filters on an exact column value', () => {
        const { dbPath } = convertSemicolon( { fileName: 'bytype.db' } )
        const { features } = CsvQueryEngine.byType( { dbPath, column: 'category', value: 'city', limit: 100 } )
        expect( features.length ).toBe( 3 )
        const capitals = CsvQueryEngine.byType( { dbPath, column: 'isCapital', value: 1, limit: 100 } )
        expect( capitals.features.length ).toBe( 2 )
    } )


    test( 'second call hits the in-memory cache', () => {
        const { dbPath } = convertSemicolon( { fileName: 'cache.db' } )
        const first = CsvQueryEngine.byType( { dbPath, column: 'category', value: 'city' } )
        const second = CsvQueryEngine.byType( { dbPath, column: 'category', value: 'city' } )
        expect( first.fromCache ).toBe( false )
        expect( second.fromCache ).toBe( true )
    } )
} )
