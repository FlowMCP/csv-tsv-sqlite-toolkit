import { readFileSync } from 'node:fs'
import { CsvParser } from '../../shared/CsvParser.mjs'
import { SqliteBuilder } from '../../shared/SqliteBuilder.mjs'
import { MetaWriter } from '../../shared/MetaWriter.mjs'
import { Validation } from '../../shared/Validation.mjs'
import { InputDetector } from '../../shared/InputDetector.mjs'
import { CsvConfigValidator } from './CsvConfigValidator.mjs'
import { TypeCoercer } from './TypeCoercer.mjs'
import { CsvCapabilityDetector } from './CsvCapabilityDetector.mjs'
import { CsvMetadataSchema } from './CsvMetadataSchema.mjs'


const CONVERTER_VERSION = 'csv-tsv-sqlite-toolkit@0.1.0'


export class CsvConverter {
    static run( { input, inputType = 'auto', force = false, dbPath, sourceUrl = null, config } ) {
        const configReport = CsvConfigValidator.validate( { config } )
        if( !configReport.status ) {
            return CsvConverter.#abort( { code: 'CSV-001', messages: configReport.messages } )
        }

        const resolvedType = inputType === 'auto'
            ? InputDetector.detect( { input } ).inputType
            : inputType

        const { buffer, filename } = CsvConverter.#loadBuffer( { input, inputType: resolvedType } )
        const parsed = CsvParser.parse( { buffer, filename, separator: config.separator } )
        if( !parsed.status ) {
            return CsvConverter.#abort( { code: 'CSV-005', messages: parsed.messages.map( ( m ) => m.message ) } )
        }

        const v = Validation.create()
        const headerSet = new Set( parsed.headers )
        const missingGeo = [ config.latColumn, config.lonColumn ]
            .filter( ( col ) => !headerSet.has( col ) )
        missingGeo
            .forEach( ( col ) => v.error( 'CSV-002', filename, `Configured geo column not found in header: ${col}` ) )

        if( missingGeo.length === 0 ) {
            v.info( 'CSV-201', filename, 'Geo columns present' )
        }
        if( Object.keys( config.typeCoercion ).length > 0 ) {
            v.info( 'CSV-202', filename, 'Type coercion configured' )
        }

        const report = v.report()
        if( report.errors.length > 0 && !force ) {
            return {
                status: false,
                dbPath: null,
                report,
                capabilities: null,
                seal: null,
                aborted: true
            }
        }

        const { columnTypes, sqliteColumns } = CsvConverter.#buildColumnPlan( {
            headers: parsed.headers,
            config
        } )

        const typedRows = CsvConverter.#coerceRows( {
            rows: parsed.rows,
            columnTypes,
            config
        } )

        const dbPathNew = `${dbPath}.new`
        const { db } = SqliteBuilder.createDatabase( {
            dbPath: dbPathNew,
            schema: { rows: sqliteColumns }
        } )
        SqliteBuilder.insertRows( { db, tableName: 'rows', rows: typedRows } )
        SqliteBuilder.createIndex( { db, tableName: 'rows', columns: [ 'lat', 'lon' ] } )

        const capabilities = CsvCapabilityDetector.detect( {
            headers: parsed.headers,
            latColumn: config.latColumn,
            lonColumn: config.lonColumn,
            rowCount: typedRows.length
        } )

        const seal = CsvMetadataSchema.computeSeal( {
            validationReport: report,
            forceUsed: force && report.errors.length > 0
        } )

        const meta = CsvMetadataSchema.buildMeta( {
            qualitySeal: seal,
            converterVersion: CONVERTER_VERSION,
            sourceUrl,
            sourceHash: null,
            buildDate: new Date().toISOString(),
            rowCounts: { rows: typedRows.length },
            capabilities,
            parseConfig: {
                separator: config.separator,
                decimal: config.decimal,
                latColumn: config.latColumn,
                lonColumn: config.lonColumn,
                typeCoercion: config.typeCoercion
            },
            columnTypes,
            validationReport: {
                errors: report.summary.errorCount,
                warnings: report.summary.warningCount,
                info: report.summary.infoCount
            }
        } )
        MetaWriter.writeMeta( { db, metaTable: meta } )

        SqliteBuilder.close( { db } )
        SqliteBuilder.atomicSwap( { dbPathNew, dbPathFinal: dbPath } )

        return {
            status: true,
            dbPath,
            report,
            capabilities,
            seal,
            aborted: false
        }
    }


    static #loadBuffer( { input, inputType } ) {
        if( inputType === 'buffer' ) {
            return { buffer: input, filename: 'input.csv' }
        }
        if( inputType === 'csv' || inputType === 'tsv' || inputType === 'file' ) {
            const buffer = readFileSync( input )
            const filename = input.split( '/' ).pop()
            return { buffer, filename }
        }
        throw new Error( `Unsupported inputType: ${inputType}` )
    }


    static #buildColumnPlan( { headers, config } ) {
        const columnTypes = {}
        const sqliteColumns = []

        headers
            .forEach( ( header ) => {
                const isLat = header === config.latColumn
                const isLon = header === config.lonColumn
                const explicit = config.typeCoercion[ header ]
                const targetType = isLat || isLon
                    ? 'number'
                    : ( explicit !== undefined ? explicit : 'string' )
                columnTypes[ header ] = targetType
                const { type } = TypeCoercer.sqliteTypeFor( { targetType } )
                sqliteColumns.push( { name: header, type } )
            } )

        const hasLat = headers.includes( config.latColumn )
        const hasLon = headers.includes( config.lonColumn )
        if( hasLat && config.latColumn !== 'lat' ) {
            sqliteColumns.push( { name: 'lat', type: 'REAL' } )
            columnTypes[ 'lat' ] = 'number'
        }
        if( hasLon && config.lonColumn !== 'lon' ) {
            sqliteColumns.push( { name: 'lon', type: 'REAL' } )
            columnTypes[ 'lon' ] = 'number'
        }

        return { columnTypes, sqliteColumns }
    }


    static #coerceRows( { rows, columnTypes, config } ) {
        return rows
            .map( ( row ) => {
                const out = {}
                Object
                    .entries( row )
                    .forEach( ( [ key, value ] ) => {
                        const targetType = columnTypes[ key ] || 'string'
                        out[ key ] = TypeCoercer.coerce( { value, targetType, decimal: config.decimal } )
                    } )
                if( config.latColumn !== 'lat' && row[ config.latColumn ] !== undefined ) {
                    out[ 'lat' ] = TypeCoercer.coerce( { value: row[ config.latColumn ], targetType: 'number', decimal: config.decimal } )
                }
                if( config.lonColumn !== 'lon' && row[ config.lonColumn ] !== undefined ) {
                    out[ 'lon' ] = TypeCoercer.coerce( { value: row[ config.lonColumn ], targetType: 'number', decimal: config.decimal } )
                }
                return out
            } )
    }


    static #abort( { code, messages } ) {
        const v = Validation.create()
        messages.forEach( ( message ) => v.error( code, null, message ) )
        return {
            status: false,
            dbPath: null,
            report: v.report(),
            capabilities: null,
            seal: null,
            aborted: true
        }
    }
}
