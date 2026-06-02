import { MetaWriter } from '../../shared/MetaWriter.mjs'
import { SqliteBuilder } from '../../shared/SqliteBuilder.mjs'


const PFLICHT_KEYS = [
    'qualitySeal',
    'converterVersion',
    'sourceUrl',
    'sourceHash',
    'buildDate',
    'rowCounts',
    'capabilities',
    'parseConfig',
    'columnTypes',
    'validationReport'
]


export class CsvMetadataSchema {
    static getPflichtKeys() {
        return [ ...PFLICHT_KEYS ]
    }


    static buildMeta( {
        qualitySeal,
        converterVersion,
        sourceUrl,
        sourceHash,
        buildDate,
        rowCounts,
        capabilities,
        parseConfig,
        columnTypes,
        validationReport
    } ) {
        return {
            qualitySeal,
            converterVersion,
            sourceUrl,
            sourceHash,
            buildDate,
            rowCounts,
            capabilities,
            parseConfig,
            columnTypes,
            validationReport
        }
    }


    static parseMeta( { dbPath } ) {
        const { db } = SqliteBuilder.openDatabase( { dbPath } )
        const raw = MetaWriter.readMeta( { db } )
        SqliteBuilder.close( { db } )
        return {
            qualitySeal: raw.qualitySeal,
            converterVersion: raw.converterVersion,
            sourceUrl: raw.sourceUrl,
            sourceHash: raw.sourceHash,
            buildDate: raw.buildDate,
            rowCounts: raw.rowCounts,
            capabilities: raw.capabilities,
            parseConfig: raw.parseConfig,
            columnTypes: raw.columnTypes,
            validationReport: raw.validationReport
        }
    }


    static parseCapabilities( { metaTable } ) {
        const caps = metaTable.capabilities
        if( !caps ) return null
        return typeof caps === 'string' ? JSON.parse( caps ) : caps
    }


    static computeSeal( { validationReport, forceUsed = false } ) {
        if( forceUsed ) return null
        if( validationReport.summary.errorCount > 0 ) return null
        if( validationReport.summary.warningCount > 0 ) return null
        return 'sqlite-csv'
    }
}
