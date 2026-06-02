import { describe, test, expect } from '@jest/globals'
import { CsvConfigValidator } from '../../src/converters/csv/CsvConfigValidator.mjs'


describe( 'CsvConfigValidator', () => {
    const validConfig = {
        separator: 'semicolon',
        decimal: 'comma',
        latColumn: 'latitude',
        lonColumn: 'longitude',
        typeCoercion: { id: 'integer' }
    }


    test( 'accepts a complete valid config', () => {
        const { status, messages } = CsvConfigValidator.validate( { config: validConfig } )
        expect( status ).toBe( true )
        expect( messages.length ).toBe( 0 )
    } )


    test( 'empty config is rejected with at least 5 messages (no silent default)', () => {
        const { status, messages } = CsvConfigValidator.validate( { config: {} } )
        expect( status ).toBe( false )
        expect( messages.length ).toBeGreaterThanOrEqual( 5 )
        const joined = messages.join( ' | ' )
        expect( joined ).toContain( 'separator' )
        expect( joined ).toContain( 'decimal' )
        expect( joined ).toContain( 'latColumn' )
        expect( joined ).toContain( 'lonColumn' )
        expect( joined ).toContain( 'typeCoercion' )
    } )


    test( 'missing separator alone is rejected', () => {
        const config = { ...validConfig }
        delete config.separator
        const { status, messages } = CsvConfigValidator.validate( { config } )
        expect( status ).toBe( false )
        expect( messages.some( ( m ) => m.includes( 'separator' ) ) ).toBe( true )
    } )


    test( 'missing decimal alone is rejected', () => {
        const config = { ...validConfig }
        delete config.decimal
        const { status, messages } = CsvConfigValidator.validate( { config } )
        expect( status ).toBe( false )
        expect( messages.some( ( m ) => m.includes( 'decimal' ) ) ).toBe( true )
    } )


    test( 'invalid separator enum value is rejected', () => {
        const { status, messages } = CsvConfigValidator.validate( { config: { ...validConfig, separator: 'pipe' } } )
        expect( status ).toBe( false )
        expect( messages.some( ( m ) => m.includes( 'separator must be one of' ) ) ).toBe( true )
    } )


    test( 'invalid decimal enum value is rejected', () => {
        const { status, messages } = CsvConfigValidator.validate( { config: { ...validConfig, decimal: 'dot' } } )
        expect( status ).toBe( false )
        expect( messages.some( ( m ) => m.includes( 'decimal must be one of' ) ) ).toBe( true )
    } )


    test( 'empty-string latColumn is rejected (no silent default)', () => {
        const { status, messages } = CsvConfigValidator.validate( { config: { ...validConfig, latColumn: '' } } )
        expect( status ).toBe( false )
        expect( messages.some( ( m ) => m.includes( 'latColumn is required' ) ) ).toBe( true )
    } )


    test( 'typeCoercion must be a map, not an array', () => {
        const { status, messages } = CsvConfigValidator.validate( { config: { ...validConfig, typeCoercion: [] } } )
        expect( status ).toBe( false )
        expect( messages.some( ( m ) => m.includes( 'typeCoercion must be' ) ) ).toBe( true )
    } )


    test( 'unknown target type in typeCoercion is rejected', () => {
        const { status, messages } = CsvConfigValidator.validate( { config: { ...validConfig, typeCoercion: { x: 'date' } } } )
        expect( status ).toBe( false )
        expect( messages.some( ( m ) => m.includes( 'typeCoercion.x' ) ) ).toBe( true )
    } )
} )
