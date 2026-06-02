import { describe, test, expect } from '@jest/globals'
import { InputDetector } from '../../src/shared/InputDetector.mjs'


describe( 'InputDetector', () => {
    test( 'detects .csv path', () => {
        expect( InputDetector.detect( { input: '/tmp/places.csv' } ).inputType ).toBe( 'csv' )
    } )


    test( 'detects .tsv path', () => {
        expect( InputDetector.detect( { input: '/tmp/places.tsv' } ).inputType ).toBe( 'tsv' )
    } )


    test( 'detects a Buffer as buffer', () => {
        expect( InputDetector.detect( { input: Buffer.from( 'a,b' ) } ).inputType ).toBe( 'buffer' )
    } )


    test( 'throws on undetectable string path', () => {
        expect( () => InputDetector.detect( { input: '/tmp/no-such-thing.xyz' } ) ).toThrow( 'Cannot detect input type' )
    } )


    test( 'throws on non-string non-buffer input', () => {
        expect( () => InputDetector.detect( { input: 42 } ) ).toThrow( 'Input must be Buffer or string path' )
    } )
} )
