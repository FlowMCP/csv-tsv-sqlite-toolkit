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
        expect( methods.map( ( m ) => m.name ) ).toEqual( [ 'featuresInBBox', 'nearPoint', 'byType' ] )
        methods.forEach( ( m ) => {
            expect( m.sqlTemplate ).toBeUndefined()
            expect( typeof m.params ).toBe( 'object' )
            expect( typeof m.outputSchema ).toBe( 'object' )
        } )
    } )


    test( 'getMethodsForCapabilities gates spatial methods', () => {
        const caps = { spatialQuery: false, attributeFilter: true }
        const names = CsvDefaultMethods.getMethodsForCapabilities( { capabilities: caps } ).map( ( m ) => m.name )
        expect( names ).not.toContain( 'featuresInBBox' )
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


describe( 'CsvDefaultMethods.featuresInBBox (in-memory)', () => {
    test( 'enclosing bbox returns the near cluster', () => {
        const { features, matchCount } = CsvDefaultMethods.featuresInBBox( {
            url: URL, minLat: 49.9, minLon: 9.9, maxLat: 50.2, maxLon: 10.2
        } )
        expect( matchCount ).toBe( 2 )
        features.forEach( ( f ) => expect( f.lat ).toBeGreaterThan( 49 ) )
    } )


    test( 'disjoint bbox returns 0', () => {
        const { matchCount } = CsvDefaultMethods.featuresInBBox( {
            url: URL, minLat: 80, minLon: 100, maxLat: 85, maxLon: 110
        } )
        expect( matchCount ).toBe( 0 )
    } )
} )


describe( 'CsvDefaultMethods.nearPoint (in-memory, radius in METERS)', () => {
    test( 'tiny radius around Alpha returns only Alpha, distance in meters', () => {
        const { features } = CsvDefaultMethods.nearPoint( {
            url: URL, lat: 50.0, lon: 10.0, radiusMeters: 50
        } )
        expect( features.length ).toBe( 1 )
        expect( features[ 0 ].name ).toBe( 'Alpha' )
        expect( features[ 0 ].distanceM ).toBeLessThan( 50 )
    } )


    test( 'larger radius returns the cluster sorted ascending by distance', () => {
        const { features } = CsvDefaultMethods.nearPoint( {
            url: URL, lat: 50.0, lon: 10.0, radiusMeters: 5000
        } )
        expect( features.length ).toBeGreaterThanOrEqual( 2 )
        const distances = features.map( ( f ) => f.distanceM )
        const sorted = [ ...distances ].sort( ( a, b ) => a - b )
        expect( distances ).toEqual( sorted )
    } )


    test( 'far center returns nothing within a small radius', () => {
        const { matchCount } = CsvDefaultMethods.nearPoint( {
            url: URL, lat: 0, lon: 0, radiusMeters: 100
        } )
        expect( matchCount ).toBe( 0 )
    } )
} )


describe( 'CsvDefaultMethods.byType (in-memory)', () => {
    test( 'exact column match', () => {
        const { features, matchCount } = CsvDefaultMethods.byType( {
            url: URL, column: 'category', value: 'city'
        } )
        expect( matchCount ).toBe( 2 )
        features.forEach( ( f ) => expect( f.category ).toBe( 'city' ) )
    } )


    test( 'integer-coerced column matches by string compare', () => {
        const { matchCount } = CsvDefaultMethods.byType( {
            url: URL, column: 'isCapital', value: '1'
        } )
        expect( matchCount ).toBe( 1 )
    } )
} )


describe( 'CsvDefaultMethods requires a loaded url', () => {
    test( 'querying an unloaded url throws CSV-URL-004', () => {
        expect( () => CsvDefaultMethods.byType( { url: 'https://example.org/never-loaded.csv', column: 'x', value: 'y' } ) )
            .toThrow( /CSV-URL-004/ )
    } )
} )
