import { describe, test, expect } from '@jest/globals'
import { CsvCapabilityDetector } from '../../src/converters/csv/CsvCapabilityDetector.mjs'


describe( 'CsvCapabilityDetector', () => {
    test( 'detects geo + spatial + attribute when lat/lon present and rows exist', () => {
        const caps = CsvCapabilityDetector.detect( {
            headers: [ 'name', 'latitude', 'longitude' ],
            latColumn: 'latitude',
            lonColumn: 'longitude',
            rowCount: 5
        } )
        expect( caps.hasGeo ).toBe( true )
        expect( caps.spatialQuery ).toBe( true )
        expect( caps.attributeFilter ).toBe( true )
    } )


    test( 'no geo when a configured column is missing', () => {
        const caps = CsvCapabilityDetector.detect( {
            headers: [ 'name', 'latitude' ],
            latColumn: 'latitude',
            lonColumn: 'longitude',
            rowCount: 5
        } )
        expect( caps.hasGeo ).toBe( false )
        expect( caps.spatialQuery ).toBe( false )
        expect( caps.attributeFilter ).toBe( true )
    } )


    test( 'spatialQuery false when no rows', () => {
        const caps = CsvCapabilityDetector.detect( {
            headers: [ 'latitude', 'longitude' ],
            latColumn: 'latitude',
            lonColumn: 'longitude',
            rowCount: 0
        } )
        expect( caps.hasGeo ).toBe( true )
        expect( caps.spatialQuery ).toBe( false )
        expect( caps.attributeFilter ).toBe( false )
    } )
} )
