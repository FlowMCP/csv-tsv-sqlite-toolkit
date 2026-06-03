import { describe, test, expect, beforeAll, afterAll } from '@jest/globals'
import { CsvDefaultMethods } from '../../src/converters/csv/CsvDefaultMethods.mjs'
import { CsvUrlStore } from '../../src/converters/csv/CsvUrlStore.mjs'


const URL = 'https://example.org/places.csv'

const CSV = [
    'id;name;category;latitude;longitude;population;isCapital',
    '1;Alpha;city;50,0000;10,0000;3700;1',
    '2;Beta;city;50,0100;10,0100;1500;0',
    '3;Far;town;60,0000;20,0000;120;0'
].join( '\n' )

const PARSE_CONFIG = {
    separator: 'semicolon',
    decimal: 'comma',
    latColumn: 'latitude',
    lonColumn: 'longitude',
    typeCoercion: { population: 'integer', isCapital: 'integer' }
}


let originalFetch = null


beforeAll( async () => {
    originalFetch = global.fetch
    global.fetch = async () => ( {
        ok: true,
        status: 200,
        text: async () => CSV
    } )
    CsvDefaultMethods.clearCache()
    await CsvUrlStore.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } )
} )


afterAll( () => {
    CsvDefaultMethods.clearCache()
    global.fetch = originalFetch
} )


describe( 'CsvDefaultMethods catalog', () => {
    test( 'getAllMethods returns the three methods (no sqlTemplate)', () => {
        const methods = CsvDefaultMethods.getAllMethods()
        expect( methods.map( ( m ) => m.name ) ).toEqual( [ 'inBoundingBox', 'nearPoint', 'byType' ] )
        methods.forEach( ( m ) => {
            expect( m.sqlTemplate ).toBeUndefined()
            expect( typeof m.params ).toBe( 'object' )
            expect( typeof m.outputSchema ).toBe( 'object' )
        } )
    } )


    test( 'getMethodsForCapabilities gates spatial methods', () => {
        const caps = { spatialQuery: false, attributeFilter: true }
        const names = CsvDefaultMethods.getMethodsForCapabilities( { capabilities: caps } ).map( ( m ) => m.name )
        expect( names ).not.toContain( 'inBoundingBox' )
        expect( names ).not.toContain( 'nearPoint' )
        expect( names ).toContain( 'byType' )
    } )


    test( 'all methods returned when all caps true', () => {
        const caps = { spatialQuery: true, attributeFilter: true }
        const result = CsvDefaultMethods.getMethodsForCapabilities( { capabilities: caps } )
        expect( result.length ).toBe( 3 )
    } )


    test( 'getMethodByName throws on unknown', () => {
        expect( () => CsvDefaultMethods.getMethodByName( { name: 'foo' } ) ).toThrow( /Unknown method/ )
    } )
} )


describe( 'CsvDefaultMethods.inBoundingBox (in-memory, lon-first RFC 7946)', () => {
    test( 'enclosing bbox returns a FeatureCollection of the near cluster', () => {
        const fc = CsvDefaultMethods.inBoundingBox( {
            url: URL, minLon: 9.9, minLat: 49.9, maxLon: 10.2, maxLat: 50.2
        } )
        expect( fc.type ).toBe( 'FeatureCollection' )
        expect( fc.meta ).toEqual( { count: 2, source: 'csv-tsv' } )
        expect( fc.features.length ).toBe( 2 )
        fc.features.forEach( ( feature ) => {
            expect( feature.type ).toBe( 'Feature' )
            expect( feature.geometry.type ).toBe( 'Point' )
            expect( feature.geometry.coordinates[ 1 ] ).toBeGreaterThan( 49 )
            expect( feature.properties._source ).toBe( 'csv-tsv' )
            expect( feature.properties._distanceMeters ).toBeNull()
        } )
    } )


    test( 'coordinates are lon-first and source lat/lon columns are not duplicated in properties', () => {
        const fc = CsvDefaultMethods.inBoundingBox( {
            url: URL, minLon: 9.9, minLat: 49.9, maxLon: 10.2, maxLat: 50.2
        } )
        const feature = fc.features[ 0 ]
        expect( feature.geometry.coordinates ).toEqual( [ 10.0, 50.0 ] )
        expect( feature.properties.name ).toBe( 'Alpha' )
        expect( feature.properties.population ).toBe( 3700 )
        expect( feature.properties.latitude ).toBeUndefined()
        expect( feature.properties.longitude ).toBeUndefined()
        expect( feature.properties.lat ).toBeUndefined()
        expect( feature.properties.lon ).toBeUndefined()
    } )


    test( 'disjoint bbox returns an empty FeatureCollection', () => {
        const fc = CsvDefaultMethods.inBoundingBox( {
            url: URL, minLon: 100, minLat: 80, maxLon: 110, maxLat: 85
        } )
        expect( fc.type ).toBe( 'FeatureCollection' )
        expect( fc.features.length ).toBe( 0 )
        expect( fc.meta.count ).toBe( 0 )
    } )
} )


describe( 'CsvDefaultMethods.inBoundingBox axis regression (lon-first)', () => {
    const BERLIN_URL = 'https://example.org/berlin.csv'
    const BERLIN_CSV = [
        'id;name;lat;lon',
        '1;Mitte;52,5200;13,4050',
        '2;Charlottenburg;52,5050;13,3000'
    ].join( '\n' )
    const BERLIN_CONFIG = {
        separator: 'semicolon',
        decimal: 'comma',
        latColumn: 'lat',
        lonColumn: 'lon',
        typeCoercion: {}
    }


    beforeAll( async () => {
        global.fetch = async () => ( {
            ok: true,
            status: 200,
            text: async () => BERLIN_CSV
        } )
        await CsvUrlStore.loadFromUrl( { url: BERLIN_URL, parseConfig: BERLIN_CONFIG } )
    } )


    test( 'a correct lon-first Berlin box returns the rows', () => {
        const fc = CsvDefaultMethods.inBoundingBox( {
            url: BERLIN_URL, minLon: 13.0, minLat: 52.3, maxLon: 13.8, maxLat: 52.7
        } )
        expect( fc.meta.count ).toBe( 2 )
    } )


    test( 'a swapped (lat-first) box returns empty — proves axis assignment', () => {
        const fc = CsvDefaultMethods.inBoundingBox( {
            url: BERLIN_URL, minLon: 52.3, minLat: 13.0, maxLon: 52.7, maxLat: 13.8
        } )
        expect( fc.meta.count ).toBe( 0 )
    } )
} )


describe( 'CsvDefaultMethods.nearPoint (in-memory, radius in METERS)', () => {
    test( 'tiny radius around Alpha returns only Alpha, _distanceMeters in properties', () => {
        const fc = CsvDefaultMethods.nearPoint( {
            url: URL, lat: 50.0, lon: 10.0, radiusMeters: 50
        } )
        expect( fc.type ).toBe( 'FeatureCollection' )
        expect( fc.features.length ).toBe( 1 )
        expect( fc.meta.count ).toBe( 1 )
        const feature = fc.features[ 0 ]
        expect( feature.properties.name ).toBe( 'Alpha' )
        expect( feature.properties._distanceMeters ).toBeLessThan( 50 )
        expect( feature.properties._source ).toBe( 'csv-tsv' )
        expect( feature.geometry.coordinates ).toEqual( [ 10.0, 50.0 ] )
    } )


    test( 'larger radius returns the cluster sorted ascending by _distanceMeters', () => {
        const fc = CsvDefaultMethods.nearPoint( {
            url: URL, lat: 50.0, lon: 10.0, radiusMeters: 5000
        } )
        expect( fc.features.length ).toBeGreaterThanOrEqual( 2 )
        const distances = fc.features.map( ( f ) => f.properties._distanceMeters )
        const sorted = [ ...distances ].sort( ( a, b ) => a - b )
        expect( distances ).toEqual( sorted )
    } )


    test( 'far center returns an empty FeatureCollection within a small radius', () => {
        const fc = CsvDefaultMethods.nearPoint( {
            url: URL, lat: 0, lon: 0, radiusMeters: 100
        } )
        expect( fc.meta.count ).toBe( 0 )
        expect( fc.features.length ).toBe( 0 )
    } )
} )


describe( 'CsvDefaultMethods.byType (in-memory)', () => {
    test( 'exact column match returns a FeatureCollection', () => {
        const fc = CsvDefaultMethods.byType( {
            url: URL, column: 'category', value: 'city'
        } )
        expect( fc.type ).toBe( 'FeatureCollection' )
        expect( fc.meta ).toEqual( { count: 2, source: 'csv-tsv' } )
        expect( fc.features.length ).toBe( 2 )
        fc.features.forEach( ( feature ) => {
            expect( feature.properties.category ).toBe( 'city' )
            expect( feature.properties._distanceMeters ).toBeNull()
            expect( feature.properties._source ).toBe( 'csv-tsv' )
        } )
    } )


    test( 'integer-coerced column matches by string compare', () => {
        const fc = CsvDefaultMethods.byType( {
            url: URL, column: 'isCapital', value: '1'
        } )
        expect( fc.meta.count ).toBe( 1 )
    } )
} )


describe( 'CsvDefaultMethods requires a loaded url', () => {
    test( 'querying an unloaded url throws CSV-URL-004', () => {
        expect( () => CsvDefaultMethods.byType( { url: 'https://example.org/never-loaded.csv', column: 'x', value: 'y' } ) )
            .toThrow( /CSV-URL-004/ )
    } )
} )
