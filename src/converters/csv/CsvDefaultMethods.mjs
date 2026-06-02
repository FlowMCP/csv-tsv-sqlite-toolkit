const METHOD_CATALOG = [
    {
        name: 'featuresInBBox',
        requiresCapabilities: [ 'spatialQuery' ],
        sqlTemplate: 'SELECT * FROM rows WHERE lat BETWEEN :minLat AND :maxLat AND lon BETWEEN :minLon AND :maxLon LIMIT :limit',
        params: {
            minLat: { type: 'number', required: true, description: 'Minimum latitude of the bounding box' },
            minLon: { type: 'number', required: true, description: 'Minimum longitude of the bounding box' },
            maxLat: { type: 'number', required: true, description: 'Maximum latitude of the bounding box' },
            maxLon: { type: 'number', required: true, description: 'Maximum longitude of the bounding box' },
            limit:  { type: 'integer', required: false, default: 100, description: 'Max results' }
        },
        outputSchema: {
            type: 'array',
            items: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' } } }
        }
    },
    {
        name: 'nearPoint',
        requiresCapabilities: [ 'spatialQuery' ],
        sqlTemplate: 'SELECT * FROM rows WHERE lat IS NOT NULL AND lon IS NOT NULL',
        params: {
            lat:    { type: 'number', required: true, description: 'Latitude of the center point' },
            lon:    { type: 'number', required: true, description: 'Longitude of the center point' },
            radius: { type: 'number', required: false, default: 50, description: 'Search radius in kilometers' },
            limit:  { type: 'integer', required: false, default: 20, description: 'Max results' }
        },
        outputSchema: {
            type: 'array',
            items: { type: 'object', properties: { lat: { type: 'number' }, lon: { type: 'number' }, distanceKm: { type: 'number' } } }
        }
    },
    {
        name: 'byType',
        requiresCapabilities: [ 'attributeFilter' ],
        sqlTemplate: 'SELECT * FROM rows WHERE :column = :value LIMIT :limit',
        params: {
            column: { type: 'string', required: true, description: 'Column to filter on' },
            value:  { type: 'string', required: true, description: 'Exact value to match (string compare)' },
            limit:  { type: 'integer', required: false, default: 100, description: 'Max results' }
        },
        outputSchema: {
            type: 'array',
            items: { type: 'object' }
        }
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
}
