import { CsvUrlStore } from './CsvUrlStore.mjs'


//
// CsvDefaultMethods
// -----------------
// Method catalog PLUS an in-process query engine that runs over the IN-MEMORY
// rows held by CsvUrlStore (Memo 096 — URL mode, no SQLite). Three methods:
//
//   inBoundingBox  -> lon-first bounding-box filter on the normalized lat/lon (RFC 7946)
//   nearPoint      -> haversine distance, radius in METERS, sorted ascending
//   byType         -> exact string match on a configured column
//
// All three methods return a normalized RFC 7946 FeatureCollection (lon-first
// coordinates) — the shared "gleicher Standard" geo output contract, identical
// to geojson-sqlite-toolkit and geo-overpass-toolkit. Every data column (all
// columns except the lat/lon coordinate fields) is carried inside the feature's
// `properties`, alongside `_source` ('csv-tsv') and `_distanceMeters` (the
// haversine metres for nearPoint, null otherwise).
//
// Rows are loaded and cached by CsvUrlStore (keyed by url). The algorithms here
// operate on plain row arrays and are source-agnostic.
//

const SOURCE = 'csv-tsv'

const FEATURE_COLLECTION_SCHEMA = {
    type: 'object',
    properties: {
        type:     { type: 'string', enum: [ 'FeatureCollection' ] },
        features: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    type:     { type: 'string', enum: [ 'Feature' ] },
                    geometry: {
                        type: 'object',
                        properties: {
                            type:        { type: 'string', enum: [ 'Point' ] },
                            coordinates: { type: 'array', items: { type: 'number' } }
                        }
                    },
                    properties: { type: 'object' }
                }
            }
        },
        meta: {
            type: 'object',
            properties: {
                count:  { type: 'integer' },
                source: { type: 'string' }
            }
        }
    }
}

const METHOD_CATALOG = [
    {
        name: 'inBoundingBox',
        requiresCapabilities: [ 'spatialQuery' ],
        params: {
            minLon:     { type: 'number',  required: true,  description: 'West bound (WGS84 longitude, lon-first RFC 7946)' },
            minLat:     { type: 'number',  required: true,  description: 'South bound (WGS84 latitude)' },
            maxLon:     { type: 'number',  required: true,  description: 'East bound (WGS84 longitude)' },
            maxLat:     { type: 'number',  required: true,  description: 'North bound (WGS84 latitude)' },
            selection:  { type: 'string',  required: false, description: 'Overpass-only selection id — ignored by static add-ons' },
            categories: { type: 'array',   required: false, description: 'Overpass-only category ids — ignored by static add-ons' },
            limit:      { type: 'integer', required: false, default: 100, description: 'Max results' }
        },
        outputSchema: FEATURE_COLLECTION_SCHEMA
    },
    {
        name: 'nearPoint',
        requiresCapabilities: [ 'spatialQuery' ],
        params: {
            lat:          { type: 'number',  required: true,  description: 'Center latitude (WGS84)' },
            lon:          { type: 'number',  required: true,  description: 'Center longitude (WGS84)' },
            radiusMeters: { type: 'number',  required: true,  description: 'Search radius in METERS' },
            selection:    { type: 'string',  required: false, description: 'Overpass-only selection id — ignored by static add-ons' },
            categories:   { type: 'array',   required: false, description: 'Overpass-only category ids — ignored by static add-ons' },
            limit:        { type: 'integer', required: false, default: 50, description: 'Max results' }
        },
        outputSchema: FEATURE_COLLECTION_SCHEMA
    },
    {
        name: 'byType',
        requiresCapabilities: [ 'attributeFilter' ],
        params: {
            column: { type: 'string',  required: true,  description: 'Column to filter on' },
            value:  { type: 'string',  required: true,  description: 'Exact value to match (string compare)' },
            limit:  { type: 'integer', required: false, default: 100, description: 'Max results' }
        },
        outputSchema: FEATURE_COLLECTION_SCHEMA
    }
]


export class CsvDefaultMethods {
    static getAllMethods() {
        return METHOD_CATALOG.map( ( m ) => ( { ...m } ) )
    }


    static getMethodsForCapabilities( { capabilities } ) {
        return METHOD_CATALOG
            .filter( ( method ) => {
                return method.requiresCapabilities.every( ( cap ) => capabilities[ cap ] === true )
            } )
            .map( ( m ) => ( { ...m } ) )
    }


    static getMethodByName( { name } ) {
        const method = METHOD_CATALOG.find( ( m ) => m.name === name )
        if( !method ) {
            throw new Error( `Unknown method: ${name}` )
        }
        return { ...method }
    }


    static clearCache() {
        CsvUrlStore.clear()
    }


    static inBoundingBox( { url, minLon, minLat, maxLon, maxLat, limit = 100 } ) {
        const { rows, latColumn, lonColumn } = CsvDefaultMethods.#loadRows( { url } )
        const features = rows
            .filter( ( row ) => {
                if( row.lat === null || row.lon === null || row.lat === undefined || row.lon === undefined ) { return false }
                return row.lon >= minLon && row.lon <= maxLon && row.lat >= minLat && row.lat <= maxLat
            } )
            .slice( 0, limit )
            .map( ( row ) => CsvDefaultMethods.#toFeature( { row, latColumn, lonColumn, distanceMeters: null } ) )
        return CsvDefaultMethods.#toFeatureCollection( { features } )
    }


    static nearPoint( { url, lat, lon, radiusMeters, limit = 50 } ) {
        const { rows, latColumn, lonColumn } = CsvDefaultMethods.#loadRows( { url } )
        const features = rows
            .filter( ( row ) => row.lat !== null && row.lon !== null && row.lat !== undefined && row.lon !== undefined )
            .map( ( row ) => {
                const distanceM = CsvDefaultMethods.#haversineKm( {
                    lat1: lat, lon1: lon, lat2: row.lat, lon2: row.lon
                } ) * 1000
                return { row, distanceMeters: Math.round( distanceM * 10 ) / 10 }
            } )
            .filter( ( entry ) => entry.distanceMeters <= radiusMeters )
            .sort( ( a, b ) => a.distanceMeters - b.distanceMeters )
            .slice( 0, limit )
            .map( ( entry ) => CsvDefaultMethods.#toFeature( {
                row: entry.row, latColumn, lonColumn, distanceMeters: entry.distanceMeters
            } ) )
        return CsvDefaultMethods.#toFeatureCollection( { features } )
    }


    static byType( { url, column, value, limit = 100 } ) {
        const { rows, latColumn, lonColumn } = CsvDefaultMethods.#loadRows( { url } )
        const features = rows
            .filter( ( row ) => String( row[ column ] ) === String( value ) )
            .slice( 0, limit )
            .map( ( row ) => CsvDefaultMethods.#toFeature( { row, latColumn, lonColumn, distanceMeters: null } ) )
        return CsvDefaultMethods.#toFeatureCollection( { features } )
    }


    static #loadRows( { url } ) {
        return CsvUrlStore.getRows( { url } )
    }


    static #toFeatureCollection( { features } ) {
        return {
            type: 'FeatureCollection',
            features,
            meta: { count: features.length, source: SOURCE }
        }
    }


    static #toFeature( { row, latColumn, lonColumn, distanceMeters } ) {
        const coordinateFields = new Set( [ 'lat', 'lon', latColumn, lonColumn ] )
        const properties = {}
        Object
            .entries( row )
            .forEach( ( [ key, value ] ) => {
                if( coordinateFields.has( key ) ) { return }
                properties[ key ] = value
            } )
        properties._source = SOURCE
        properties._distanceMeters = distanceMeters
        return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [ row.lon, row.lat ] },
            properties
        }
    }


    static #haversineKm( { lat1, lon1, lat2, lon2 } ) {
        const toRad = ( deg ) => deg * Math.PI / 180
        const R = 6371
        const dLat = toRad( lat2 - lat1 )
        const dLon = toRad( lon2 - lon1 )
        const a = Math.sin( dLat / 2 ) * Math.sin( dLat / 2 ) +
            Math.cos( toRad( lat1 ) ) * Math.cos( toRad( lat2 ) ) *
            Math.sin( dLon / 2 ) * Math.sin( dLon / 2 )
        const c = 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) )
        return R * c
    }
}
