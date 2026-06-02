import { describe, test, expect } from '@jest/globals'
import { CsvMetadataSchema } from '../../src/converters/csv/CsvMetadataSchema.mjs'


describe( 'CsvMetadataSchema', () => {
    test( 'getPflichtKeys lists the mandatory meta keys', () => {
        const keys = CsvMetadataSchema.getPflichtKeys()
        expect( keys ).toContain( 'qualitySeal' )
        expect( keys ).toContain( 'parseConfig' )
        expect( keys ).toContain( 'columnTypes' )
        expect( keys ).toContain( 'capabilities' )
    } )


    test( 'buildMeta returns an object with all keys', () => {
        const meta = CsvMetadataSchema.buildMeta( {
            qualitySeal: 'sqlite-csv',
            converterVersion: 'csv-tsv-sqlite-toolkit@0.1.0',
            sourceUrl: null,
            sourceHash: null,
            buildDate: '2026-06-02T00:00:00Z',
            rowCounts: { rows: 3 },
            capabilities: { hasGeo: true },
            parseConfig: { separator: 'comma' },
            columnTypes: { id: 'integer' },
            validationReport: { errors: 0, warnings: 0, info: 1 }
        } )
        CsvMetadataSchema.getPflichtKeys().forEach( ( key ) => {
            expect( meta ).toHaveProperty( key )
        } )
    } )


    test( 'computeSeal grants sqlite-csv only on a clean report', () => {
        const clean = { summary: { errorCount: 0, warningCount: 0, infoCount: 2 } }
        expect( CsvMetadataSchema.computeSeal( { validationReport: clean } ) ).toBe( 'sqlite-csv' )
    } )


    test( 'computeSeal returns null on warnings, errors, or force', () => {
        const warned = { summary: { errorCount: 0, warningCount: 1, infoCount: 0 } }
        const errored = { summary: { errorCount: 1, warningCount: 0, infoCount: 0 } }
        const clean = { summary: { errorCount: 0, warningCount: 0, infoCount: 0 } }
        expect( CsvMetadataSchema.computeSeal( { validationReport: warned } ) ).toBeNull()
        expect( CsvMetadataSchema.computeSeal( { validationReport: errored } ) ).toBeNull()
        expect( CsvMetadataSchema.computeSeal( { validationReport: clean, forceUsed: true } ) ).toBeNull()
    } )


    test( 'parseCapabilities handles string and object capabilities', () => {
        expect( CsvMetadataSchema.parseCapabilities( { metaTable: { capabilities: { hasGeo: true } } } ).hasGeo ).toBe( true )
        expect( CsvMetadataSchema.parseCapabilities( { metaTable: { capabilities: '{"hasGeo":true}' } } ).hasGeo ).toBe( true )
        expect( CsvMetadataSchema.parseCapabilities( { metaTable: {} } ) ).toBeNull()
    } )
} )
