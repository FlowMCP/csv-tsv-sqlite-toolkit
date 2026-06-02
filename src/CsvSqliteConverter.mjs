import { CsvConverter } from './converters/csv/CsvConverter.mjs'


export class CsvSqliteConverter {
    static start( { input, inputType = 'auto', force = false, dbPath, sourceUrl = null, config } ) {
        return CsvConverter.run( { input, inputType, force, dbPath, sourceUrl, config } )
    }
}
