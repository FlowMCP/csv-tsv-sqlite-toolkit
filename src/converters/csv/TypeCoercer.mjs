const BOOLEAN_TRUE_TOKENS = [ '1', 'true', 'ja', 'yes', 'y' ]
const BOOLEAN_FALSE_TOKENS = [ '0', 'false', 'nein', 'no', 'n' ]
const SQLITE_TYPE_MAP = {
    integer: 'INTEGER',
    number: 'REAL',
    boolean: 'INTEGER',
    string: 'TEXT'
}


export class TypeCoercer {
    static coerce( { value, targetType, decimal } ) {
        if( value === '' || value === undefined || value === null ) { return null }
        if( targetType === 'integer' ) {
            const parsed = parseInt( value, 10 )
            return Number.isNaN( parsed ) ? null : parsed
        }
        if( targetType === 'number' ) {
            const normalized = decimal === 'comma' ? String( value ).replace( ',', '.' ) : String( value )
            const parsed = parseFloat( normalized )
            return Number.isNaN( parsed ) ? null : parsed
        }
        if( targetType === 'boolean' ) {
            const token = String( value ).toLowerCase()
            if( BOOLEAN_TRUE_TOKENS.includes( token ) ) { return 1 }
            if( BOOLEAN_FALSE_TOKENS.includes( token ) ) { return 0 }
            return null
        }
        return String( value )
    }


    static sqliteTypeFor( { targetType } ) {
        const type = SQLITE_TYPE_MAP[ targetType ]
        if( type === undefined ) {
            return { type: 'TEXT', status: false }
        }
        return { type, status: true }
    }
}
