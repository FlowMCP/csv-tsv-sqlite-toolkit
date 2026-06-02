const SEPARATOR_MAP = {
    comma: ',',
    semicolon: ';',
    tab: '\t'
}


export class CsvParser {
    static separatorChar( { separator } ) {
        const char = SEPARATOR_MAP[ separator ]
        if( char === undefined ) {
            return { char: null, status: false }
        }
        return { char, status: true }
    }


    static parse( { buffer, filename, separator } ) {
        const messages = []
        const { char, status: sepStatus } = CsvParser.separatorChar( { separator } )
        if( !sepStatus ) {
            messages.push( { code: 'CSV-006', file: filename, message: `Unknown separator: ${separator}` } )
            return { headers: [], rows: [], status: false, messages }
        }
        const text = CsvParser.#decodeBuffer( { buffer, filename, messages } )
        if( text === null ) {
            return { headers: [], rows: [], status: false, messages }
        }
        const cleanText = CsvParser.#stripBom( { text } )
        const lines = CsvParser.#splitLines( { text: cleanText } )
        if( lines.length === 0 ) {
            messages.push( { code: 'CSV-005', file: filename, message: 'File is empty' } )
            return { headers: [], rows: [], status: false, messages }
        }
        const headerLine = lines.shift()
        const headers = CsvParser.#parseRow( { line: headerLine, separator: char } )
        if( headers.length === 0 ) {
            messages.push( { code: 'CSV-004', file: filename, message: 'No header row' } )
            return { headers: [], rows: [], status: false, messages }
        }
        const rows = lines
            .filter( ( line ) => line.length > 0 )
            .map( ( line ) => CsvParser.#parseRow( { line, separator: char } ) )
            .map( ( values ) => CsvParser.#rowToObject( { headers, values } ) )
        return { headers, rows, status: true, messages }
    }


    static #decodeBuffer( { buffer, filename, messages } ) {
        try {
            return buffer.toString( 'utf-8' )
        } catch ( err ) {
            messages.push( { code: 'CSV-005', file: filename, message: `Cannot decode: ${err.message}` } )
            return null
        }
    }


    static #stripBom( { text } ) {
        if( text.length > 0 && text.charCodeAt( 0 ) === 0xFEFF ) {
            return text.substring( 1 )
        }
        return text
    }


    static #splitLines( { text } ) {
        const normalized = text.replace( /\r\n/g, '\n' ).replace( /\r/g, '\n' )
        const lines = normalized.split( '\n' )
        if( lines.length > 0 && lines[ lines.length - 1 ] === '' ) {
            lines.pop()
        }
        return lines
    }


    static #parseRow( { line, separator } ) {
        const chars = line.split( '' )
        const acc = chars
            .reduce( ( state, ch, idx ) => {
                if( state.skipIndex === idx ) {
                    return state
                }
                if( state.inQuotes ) {
                    if( ch === '"' ) {
                        if( chars[ idx + 1 ] === '"' ) {
                            state.current += '"'
                            state.skipIndex = idx + 1
                            return state
                        }
                        state.inQuotes = false
                        return state
                    }
                    state.current += ch
                    return state
                }
                if( ch === '"' ) {
                    state.inQuotes = true
                    return state
                }
                if( ch === separator ) {
                    state.result.push( state.current )
                    state.current = ''
                    return state
                }
                state.current += ch
                return state
            }, { result: [], current: '', inQuotes: false, skipIndex: -1 } )
        acc.result.push( acc.current )
        return acc.result.map( ( v ) => v.trim() )
    }


    static #rowToObject( { headers, values } ) {
        const obj = {}
        headers.forEach( ( header, idx ) => {
            obj[ header ] = idx < values.length ? values[ idx ] : ''
        } )
        return obj
    }
}
