import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { SqliteBuilder } from '../../src/shared/SqliteBuilder.mjs'
import { MetaWriter } from '../../src/shared/MetaWriter.mjs'


let tmpDir = null


beforeAll( () => { tmpDir = mkdtempSync( path.join( tmpdir(), 'csv-sqlite-' ) ) } )
afterAll( () => { if( tmpDir && existsSync( tmpDir ) ) { rmSync( tmpDir, { recursive: true, force: true } ) } } )


describe( 'SqliteBuilder + MetaWriter', () => {
    test( 'create, insert, index, atomicSwap and read back', () => {
        const dbNew = path.join( tmpDir, 'x.db.new' )
        const dbFinal = path.join( tmpDir, 'x.db' )

        const { db } = SqliteBuilder.createDatabase( {
            dbPath: dbNew,
            schema: { rows: [ { name: 'id', type: 'INTEGER' }, { name: 'lat', type: 'REAL' }, { name: 'lon', type: 'REAL' } ] }
        } )
        const { inserted } = SqliteBuilder.insertRows( {
            db, tableName: 'rows',
            rows: [ { id: 1, lat: 52.5, lon: 13.4 }, { id: 2, lat: 48.1, lon: 11.5 } ]
        } )
        expect( inserted ).toBe( 2 )
        const { indexName } = SqliteBuilder.createIndex( { db, tableName: 'rows', columns: [ 'lat', 'lon' ] } )
        expect( indexName ).toContain( 'lat' )
        MetaWriter.writeMeta( { db, metaTable: { qualitySeal: 'sqlite-csv', capabilities: { hasGeo: true } } } )
        SqliteBuilder.close( { db } )

        const { dbPath } = SqliteBuilder.atomicSwap( { dbPathNew: dbNew, dbPathFinal: dbFinal } )
        expect( dbPath ).toBe( dbFinal )
        expect( existsSync( dbNew ) ).toBe( false )

        const opened = SqliteBuilder.openDatabase( { dbPath: dbFinal } )
        const meta = MetaWriter.readMeta( { db: opened.db } )
        const count = opened.db.prepare( 'SELECT COUNT(*) AS c FROM rows' ).get().c
        SqliteBuilder.close( { db: opened.db } )

        expect( meta.qualitySeal ).toBe( 'sqlite-csv' )
        expect( meta.capabilities.hasGeo ).toBe( true )
        expect( count ).toBe( 2 )
    } )


    test( 'insertRows with empty array inserts nothing', () => {
        const dbPath = path.join( tmpDir, 'empty.db' )
        const { db } = SqliteBuilder.createDatabase( { dbPath, schema: { rows: [ { name: 'id', type: 'INTEGER' } ] } } )
        const { inserted } = SqliteBuilder.insertRows( { db, tableName: 'rows', rows: [] } )
        SqliteBuilder.close( { db } )
        expect( inserted ).toBe( 0 )
    } )


    test( 'atomicSwap throws when the source DB is missing', () => {
        expect( () => SqliteBuilder.atomicSwap( {
            dbPathNew: path.join( tmpDir, 'nope.db.new' ),
            dbPathFinal: path.join( tmpDir, 'nope.db' )
        } ) ).toThrow( 'Source DB does not exist' )
    } )
} )
