import { SqliteBuilder } from '../../shared/SqliteBuilder.mjs'


const _cache = { byPath: {} }


export class CsvQueryEngine {
    static loadRows( { dbPath } ) {
        const cached = _cache.byPath[ dbPath ]
        if( cached ) {
            return { rows: cached, fromCache: true }
        }
        const { db } = SqliteBuilder.openDatabase( { dbPath } )
        const rows = db.prepare( 'SELECT * FROM rows' ).all()
        SqliteBuilder.close( { db } )
        _cache.byPath[ dbPath ] = rows
        return { rows, fromCache: false }
    }


    static clearCache() {
        _cache.byPath = {}
        return { cleared: true }
    }


    static featuresInBBox( { dbPath, minLat, minLon, maxLat, maxLon, limit = 100 } ) {
        const { rows, fromCache } = CsvQueryEngine.loadRows( { dbPath } )
        const features = rows
            .filter( ( row ) => {
                if( row.lat === null || row.lon === null ) { return false }
                return row.lat >= minLat && row.lat <= maxLat && row.lon >= minLon && row.lon <= maxLon
            } )
            .slice( 0, limit )
        return { features, matchCount: features.length, fromCache }
    }


    static nearPoint( { dbPath, lat, lon, radius = 50, limit = 20 } ) {
        const { rows, fromCache } = CsvQueryEngine.loadRows( { dbPath } )
        const features = rows
            .filter( ( row ) => row.lat !== null && row.lon !== null )
            .map( ( row ) => {
                const distanceKm = CsvQueryEngine.#haversineKm( { lat1: lat, lon1: lon, lat2: row.lat, lon2: row.lon } )
                return { ...row, distanceKm: Math.round( distanceKm * 1000 ) / 1000 }
            } )
            .filter( ( row ) => row.distanceKm <= radius )
            .sort( ( a, b ) => a.distanceKm - b.distanceKm )
            .slice( 0, limit )
        return { features, matchCount: features.length, fromCache }
    }


    static byType( { dbPath, column, value, limit = 100 } ) {
        const { rows, fromCache } = CsvQueryEngine.loadRows( { dbPath } )
        const features = rows
            .filter( ( row ) => String( row[ column ] ) === String( value ) )
            .slice( 0, limit )
        return { features, matchCount: features.length, fromCache }
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
