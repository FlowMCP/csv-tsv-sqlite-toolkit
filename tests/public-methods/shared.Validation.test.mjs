import { describe, test, expect } from '@jest/globals'
import { Validation } from '../../src/shared/Validation.mjs'


describe( 'Validation (CSV codes)', () => {
    test( 'getCodes returns the CSV code dictionary', () => {
        const codes = Validation.getCodes()
        expect( codes[ 'CSV-001' ].severity ).toBe( 'ERROR' )
        expect( codes[ 'CSV-101' ].severity ).toBe( 'WARNING' )
        expect( codes[ 'CSV-201' ].severity ).toBe( 'INFO' )
    } )


    test( 'getCodeMeta throws on unknown code', () => {
        expect( () => Validation.getCodeMeta( { code: 'CSV-999' } ) ).toThrow( 'Unknown CSV code' )
    } )


    test( 'records errors, warnings and info and reports a summary', () => {
        const v = Validation.create()
        v.error( 'CSV-001', 'x.csv', 'missing config' )
        v.warning( 'CSV-101', 'x.csv', 'short row' )
        v.info( 'CSV-201', 'x.csv', 'geo present' )
        const report = v.report()
        expect( report.status ).toBe( false )
        expect( report.summary ).toEqual( { errorCount: 1, warningCount: 1, infoCount: 1 } )
    } )


    test( 'status is true when no errors', () => {
        const v = Validation.create()
        v.info( 'CSV-202', null, 'coercion applied' )
        expect( v.report().status ).toBe( true )
    } )


    test( 'severity mismatch throws', () => {
        const v = Validation.create()
        expect( () => v.error( 'CSV-101', null, 'wrong bucket' ) ).toThrow( 'is not an ERROR' )
        expect( () => v.warning( 'CSV-001', null, 'wrong bucket' ) ).toThrow( 'is not a WARNING' )
        expect( () => v.info( 'CSV-001', null, 'wrong bucket' ) ).toThrow( 'is not an INFO' )
    } )
} )
