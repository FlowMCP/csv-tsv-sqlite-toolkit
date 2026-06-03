import { CsvConfigValidator } from './CsvConfigValidator.mjs'
import { CsvParser } from '../../shared/CsvParser.mjs'
import { TypeCoercer } from './TypeCoercer.mjs'
import { CsvCapabilityDetector } from './CsvCapabilityDetector.mjs'


//
// CsvUrlStore
// -----------
// URL-mode replacement for the converter/seal path (Memo 096). It fetches a
// COMPLETE CSV/TSV document in a SINGLE request, validates it on load (F6 —
// no file seal), coerces every cell to the configured type, derives capabilities
// and holds everything IN MEMORY keyed by URL. There is no SQLite file and no
// on-disk artifact.
//
// parseConfig is MANDATORY (hard memo rule for CSV — no silent default). It must
// carry separator, decimal, latColumn, lonColumn and a typeCoercion map. The
// same CsvConfigValidator that guarded the converter guards the URL store.
//
// Row shape (identical to the former SQLite `rows` table): one plain object per
// CSV row, every cell coerced via TypeCoercer. When latColumn/lonColumn are not
// literally named `lat`/`lon`, normalized numeric `lat`/`lon` mirror columns are
// added so the spatial methods are column-name agnostic.
//
// Cache is keyed by url and mirrors the opsd pattern ( rows + capabilities +
// timestamp + ttl ).
//

const _cacheByUrl = new Map()
const CACHE_TTL_MS = 86400000


export class CsvUrlStore {
    static async loadFromUrl( { url, parseConfig, force = false } ) {
        const { status, messages } = CsvUrlStore.#validationLoadFromUrl( { url, parseConfig } )
        if( !status ) { throw new Error( messages.join( '; ' ) ) }

        const now = Date.now()
        const cached = _cacheByUrl.get( url )
        if( !force && cached && ( now - cached.timestamp ) < CACHE_TTL_MS ) {
            return {
                url,
                capabilities: cached.capabilities,
                recordCount: cached.rows.length,
                fromCache: true
            }
        }

        const buffer = await CsvUrlStore.#fetchBuffer( { url } )
        const { headers, rows } = CsvUrlStore.#parseAndValidate( { buffer, url, parseConfig } )
        const typedRows = CsvUrlStore.#coerceRows( { rows, headers, parseConfig } )
        const capabilities = CsvCapabilityDetector.detect( {
            headers,
            latColumn: parseConfig.latColumn,
            lonColumn: parseConfig.lonColumn,
            rowCount: typedRows.length
        } )

        _cacheByUrl.set( url, {
            rows: typedRows,
            headers,
            capabilities,
            latColumn: parseConfig.latColumn,
            lonColumn: parseConfig.lonColumn,
            timestamp: now
        } )

        return { url, capabilities, recordCount: typedRows.length, fromCache: false }
    }


    static getRows( { url } ) {
        const cached = _cacheByUrl.get( url )
        if( !cached ) {
            throw new Error( `CSV-URL-004: no in-memory data for url '${url}'. Call loadFromUrl first.` )
        }
        return { rows: cached.rows, latColumn: cached.latColumn, lonColumn: cached.lonColumn }
    }


    static getCapabilities( { url } ) {
        const cached = _cacheByUrl.get( url )
        if( !cached ) {
            throw new Error( `CSV-URL-004: no in-memory data for url '${url}'. Call loadFromUrl first.` )
        }
        return { capabilities: cached.capabilities }
    }


    static isLoaded( { url } ) {
        return { loaded: _cacheByUrl.has( url ) }
    }


    static clear() {
        _cacheByUrl.clear()
    }


    static async #fetchBuffer( { url } ) {
        let response = null
        try {
            response = await fetch( url )
        } catch( e ) {
            throw new Error( `CSV-URL-002: fetch failed for '${url}': ${e.message}` )
        }
        if( !response.ok ) {
            throw new Error( `CSV-URL-002: fetch failed for '${url}': HTTP ${response.status}` )
        }
        const text = await response.text()
        return Buffer.from( text, 'utf-8' )
    }


    static #parseAndValidate( { buffer, url, parseConfig } ) {
        const parsed = CsvParser.parse( {
            buffer,
            filename: url,
            separator: parseConfig.separator
        } )
        if( !parsed.status ) {
            const detail = parsed.messages
                .map( ( m ) => `${m.code}: ${m.message}` )
                .join( '; ' )
            throw new Error( `CSV-URL-002: '${url}' is not parseable CSV/TSV — ${detail}` )
        }

        const headerSet = new Set( parsed.headers )
        const missingGeo = [ parseConfig.latColumn, parseConfig.lonColumn ]
            .filter( ( col ) => !headerSet.has( col ) )
        if( missingGeo.length > 0 ) {
            throw new Error( `CSV-URL-003: '${url}' is missing required column(s): ${missingGeo.join( ', ' )}` )
        }

        const missingTyped = Object
            .keys( parseConfig.typeCoercion )
            .filter( ( col ) => !headerSet.has( col ) )
        if( missingTyped.length > 0 ) {
            throw new Error( `CSV-URL-003: '${url}' is missing typeCoercion column(s): ${missingTyped.join( ', ' )}` )
        }

        return { headers: parsed.headers, rows: parsed.rows }
    }


    static #coerceRows( { rows, headers, parseConfig } ) {
        const columnTypes = CsvUrlStore.#buildColumnTypes( { headers, parseConfig } )
        return rows
            .map( ( row ) => {
                const out = {}
                Object
                    .entries( row )
                    .forEach( ( [ key, value ] ) => {
                        const targetType = columnTypes[ key ] === undefined ? 'string' : columnTypes[ key ]
                        out[ key ] = TypeCoercer.coerce( { value, targetType, decimal: parseConfig.decimal } )
                    } )
                if( parseConfig.latColumn !== 'lat' && row[ parseConfig.latColumn ] !== undefined ) {
                    out[ 'lat' ] = TypeCoercer.coerce( { value: row[ parseConfig.latColumn ], targetType: 'number', decimal: parseConfig.decimal } )
                }
                if( parseConfig.lonColumn !== 'lon' && row[ parseConfig.lonColumn ] !== undefined ) {
                    out[ 'lon' ] = TypeCoercer.coerce( { value: row[ parseConfig.lonColumn ], targetType: 'number', decimal: parseConfig.decimal } )
                }
                return out
            } )
    }


    static #buildColumnTypes( { headers, parseConfig } ) {
        const columnTypes = {}
        headers
            .forEach( ( header ) => {
                const isLat = header === parseConfig.latColumn
                const isLon = header === parseConfig.lonColumn
                const explicit = parseConfig.typeCoercion[ header ]
                columnTypes[ header ] = isLat || isLon
                    ? 'number'
                    : ( explicit === undefined ? 'string' : explicit )
            } )
        return columnTypes
    }


    static #validationLoadFromUrl( { url, parseConfig } ) {
        const struct = { status: false, messages: [] }
        if( url === undefined || url === null ) {
            struct.messages.push( 'CSV-URL-001: url is required' )
            return struct
        }
        if( typeof url !== 'string' ) {
            struct.messages.push( 'CSV-URL-001: url must be a string' )
            return struct
        }
        if( !url.startsWith( 'https://' ) ) {
            struct.messages.push( `CSV-URL-001: url must use HTTPS, got '${url}'` )
            return struct
        }
        if( parseConfig === undefined || parseConfig === null ) {
            struct.messages.push( 'CSV-URL-005: parseConfig is required (no silent default)' )
            return struct
        }
        const configReport = CsvConfigValidator.validate( { config: parseConfig } )
        if( !configReport.status ) {
            configReport.messages
                .forEach( ( m ) => struct.messages.push( `CSV-URL-005: ${m}` ) )
            return struct
        }
        struct.status = true
        return struct
    }
}
