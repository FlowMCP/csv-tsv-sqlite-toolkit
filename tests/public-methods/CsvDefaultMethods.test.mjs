import { describe, test, expect } from '@jest/globals'
import { CsvDefaultMethods } from '../../src/converters/csv/CsvDefaultMethods.mjs'


describe( 'CsvDefaultMethods', () => {
    test( 'getAllMethods returns the three spatial methods', () => {
        const methods = CsvDefaultMethods.getAllMethods()
        expect( methods.length ).toBe( 3 )
        const names = methods.map( ( m ) => m.name )
        expect( names ).toEqual( [ 'featuresInBBox', 'nearPoint', 'byType' ] )
    } )


    test( 'every method has sqlTemplate, params and outputSchema', () => {
        CsvDefaultMethods.getAllMethods().forEach( ( m ) => {
            expect( typeof m.sqlTemplate ).toBe( 'string' )
            expect( m.sqlTemplate.length ).toBeGreaterThan( 0 )
            expect( typeof m.params ).toBe( 'object' )
            expect( typeof m.outputSchema ).toBe( 'object' )
        } )
    } )


    test( 'spatial methods require spatialQuery capability', () => {
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


    test( 'getMethodByName returns a specific method', () => {
        const m = CsvDefaultMethods.getMethodByName( { name: 'nearPoint' } )
        expect( m.name ).toBe( 'nearPoint' )
        expect( m.requiresCapabilities ).toContain( 'spatialQuery' )
    } )


    test( 'getMethodByName throws on unknown', () => {
        expect( () => CsvDefaultMethods.getMethodByName( { name: 'foo' } ) ).toThrow( 'Unknown method' )
    } )
} )
