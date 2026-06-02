const ALLOWED_TARGET_TYPES = [ 'integer', 'number', 'string', 'boolean' ]


export class CsvConfigValidator {
    static validate( { config } ) {
        const struct = { status: false, messages: [] }
        const fields = [
            [ 'separator', config?.separator, [ 'comma', 'semicolon', 'tab' ] ],
            [ 'decimal',   config?.decimal,   [ 'point', 'comma' ] ],
            [ 'latColumn', config?.latColumn, null ],
            [ 'lonColumn', config?.lonColumn, null ]
        ]
        fields
            .forEach( ( [ key, value, allowed ] ) => {
                if( value === undefined || value === null || value === '' ) {
                    struct.messages.push( `${key} is required (no silent default)` )
                    return
                }
                if( allowed && !allowed.includes( value ) ) {
                    struct.messages.push( `${key} must be one of ${allowed.join( ',' )}` )
                }
            } )

        if( config?.typeCoercion === undefined || config?.typeCoercion === null ) {
            struct.messages.push( 'typeCoercion map is required (no silent default)' )
        } else if( typeof config.typeCoercion !== 'object' || Array.isArray( config.typeCoercion ) ) {
            struct.messages.push( 'typeCoercion must be a column-to-type map (object)' )
        } else {
            Object
                .entries( config.typeCoercion )
                .forEach( ( [ column, targetType ] ) => {
                    if( !ALLOWED_TARGET_TYPES.includes( targetType ) ) {
                        struct.messages.push( `typeCoercion.${column} must be one of ${ALLOWED_TARGET_TYPES.join( ',' )} (got "${targetType}")` )
                    }
                } )
        }

        if( struct.messages.length === 0 ) { struct.status = true }
        return struct
    }
}
