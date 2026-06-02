import Database from 'better-sqlite3'
import { renameSync, existsSync, unlinkSync } from 'node:fs'


export class SqliteBuilder {
    static createDatabase( { dbPath, schema } ) {
        if( existsSync( dbPath ) ) {
            unlinkSync( dbPath )
        }
        const db = new Database( dbPath )
        db.pragma( 'journal_mode = WAL' )
        db.pragma( 'synchronous = NORMAL' )
        Object.entries( schema ).forEach( ( [ tableName, columns ] ) => {
            const columnDefs = columns
                .map( ( col ) => `"${col.name}" ${col.type}` )
                .join( ', ' )
            db.exec( `CREATE TABLE "${tableName}" ( ${columnDefs} )` )
        } )
        return { db }
    }


    static openDatabase( { dbPath } ) {
        const db = new Database( dbPath )
        return { db }
    }


    static insertRows( { db, tableName, rows } ) {
        if( rows.length === 0 ) {
            return { inserted: 0 }
        }
        const columns = Object.keys( rows[ 0 ] )
        const placeholders = columns.map( () => '?' ).join( ', ' )
        const columnList = columns.map( ( c ) => `"${c}"` ).join( ', ' )
        const stmt = db.prepare( `INSERT INTO "${tableName}" ( ${columnList} ) VALUES ( ${placeholders} )` )
        const insertMany = db.transaction( ( items ) => {
            items.forEach( ( item ) => {
                const values = columns.map( ( col ) => SqliteBuilder.#coerceValue( { value: item[ col ] } ) )
                stmt.run( values )
            } )
        } )
        insertMany( rows )
        return { inserted: rows.length }
    }


    static createIndex( { db, tableName, columns } ) {
        const indexName = `idx_${tableName}_${columns.join( '_' )}`
        const columnList = columns.map( ( c ) => `"${c}"` ).join( ', ' )
        db.exec( `CREATE INDEX "${indexName}" ON "${tableName}" ( ${columnList} )` )
        return { indexName }
    }


    static atomicSwap( { dbPathNew, dbPathFinal } ) {
        if( !existsSync( dbPathNew ) ) {
            throw new Error( `Source DB does not exist: ${dbPathNew}` )
        }
        if( existsSync( dbPathFinal ) ) {
            unlinkSync( dbPathFinal )
        }
        renameSync( dbPathNew, dbPathFinal )
        return { dbPath: dbPathFinal }
    }


    static close( { db } ) {
        db.close()
    }


    static #coerceValue( { value } ) {
        if( value === undefined || value === null ) {
            return null
        }
        if( value === '' ) {
            return null
        }
        return value
    }
}
