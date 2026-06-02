import { describe, test, expect } from '@jest/globals'
import { TypeCoercer } from '../../src/converters/csv/TypeCoercer.mjs'


describe( 'TypeCoercer', () => {
    test( '0/1 default to Integer, never Boolean', () => {
        const a = TypeCoercer.coerce( { value: '1', targetType: 'integer', decimal: 'point' } )
        const b = TypeCoercer.coerce( { value: '0', targetType: 'integer', decimal: 'point' } )
        expect( a ).toBe( 1 )
        expect( b ).toBe( 0 )
        expect( typeof a ).toBe( 'number' )
        expect( typeof b ).toBe( 'number' )
        expect( Number.isInteger( a ) ).toBe( true )
    } )


    test( 'comma decimal normalizes to float', () => {
        const v = TypeCoercer.coerce( { value: '52,52', targetType: 'number', decimal: 'comma' } )
        expect( v ).toBeCloseTo( 52.52 )
        expect( typeof v ).toBe( 'number' )
    } )


    test( 'point decimal leaves dotted decimals unchanged', () => {
        const v = TypeCoercer.coerce( { value: '52.52', targetType: 'number', decimal: 'point' } )
        expect( v ).toBeCloseTo( 52.52 )
    } )


    test( 'boolean only when explicitly requested — true tokens', () => {
        expect( TypeCoercer.coerce( { value: '1', targetType: 'boolean', decimal: 'point' } ) ).toBe( 1 )
        expect( TypeCoercer.coerce( { value: 'ja', targetType: 'boolean', decimal: 'point' } ) ).toBe( 1 )
        expect( TypeCoercer.coerce( { value: 'true', targetType: 'boolean', decimal: 'point' } ) ).toBe( 1 )
    } )


    test( 'boolean false tokens', () => {
        expect( TypeCoercer.coerce( { value: '0', targetType: 'boolean', decimal: 'point' } ) ).toBe( 0 )
        expect( TypeCoercer.coerce( { value: 'nein', targetType: 'boolean', decimal: 'point' } ) ).toBe( 0 )
    } )


    test( 'string target returns the raw string', () => {
        expect( TypeCoercer.coerce( { value: 'Springfield', targetType: 'string', decimal: 'point' } ) ).toBe( 'Springfield' )
    } )


    test( 'empty / null / undefined become null', () => {
        expect( TypeCoercer.coerce( { value: '', targetType: 'integer', decimal: 'point' } ) ).toBeNull()
        expect( TypeCoercer.coerce( { value: null, targetType: 'integer', decimal: 'point' } ) ).toBeNull()
        expect( TypeCoercer.coerce( { value: undefined, targetType: 'number', decimal: 'point' } ) ).toBeNull()
    } )


    test( 'non-numeric integer/number become null (no crash)', () => {
        expect( TypeCoercer.coerce( { value: 'abc', targetType: 'integer', decimal: 'point' } ) ).toBeNull()
        expect( TypeCoercer.coerce( { value: 'abc', targetType: 'number', decimal: 'comma' } ) ).toBeNull()
    } )


    test( 'sqliteTypeFor maps target types to storage classes', () => {
        expect( TypeCoercer.sqliteTypeFor( { targetType: 'integer' } ).type ).toBe( 'INTEGER' )
        expect( TypeCoercer.sqliteTypeFor( { targetType: 'number' } ).type ).toBe( 'REAL' )
        expect( TypeCoercer.sqliteTypeFor( { targetType: 'boolean' } ).type ).toBe( 'INTEGER' )
        expect( TypeCoercer.sqliteTypeFor( { targetType: 'string' } ).type ).toBe( 'TEXT' )
        const unknown = TypeCoercer.sqliteTypeFor( { targetType: 'weird' } )
        expect( unknown.status ).toBe( false )
        expect( unknown.type ).toBe( 'TEXT' )
    } )
} )
