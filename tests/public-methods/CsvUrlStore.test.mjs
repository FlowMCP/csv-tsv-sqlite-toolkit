import { describe, test, expect, beforeEach, afterAll } from '@jest/globals'
import { CsvUrlStore } from '../../src/converters/csv/CsvUrlStore.mjs'


const URL = 'https://example.org/data.csv'

const CSV = [
    'id;name;category;latitude;longitude;population',
    '1;Alpha;city;50,0000;10,0000;3700',
    '2;Beta;town;51,0000;11,0000;120'
].join( '\n' )

const PARSE_CONFIG = {
    separator: 'semicolon',
    decimal: 'comma',
    latColumn: 'latitude',
    lonColumn: 'longitude',
    typeCoercion: { population: 'integer' }
}


let originalFetch = null


function mockFetch( { ok = true, status = 200, body } ) {
    global.fetch = async () => ( {
        ok,
        status,
        text: async () => body
    } )
}


function mockFetchThrows( { message } ) {
    global.fetch = async () => { throw new Error( message ) }
}


beforeEach( () => {
    if( originalFetch === null ) { originalFetch = global.fetch }
    CsvUrlStore.clear()
    mockFetch( { body: CSV } )
} )


afterAll( () => {
    CsvUrlStore.clear()
    global.fetch = originalFetch
} )


describe( 'CsvUrlStore.loadFromUrl (happy path)', () => {
    test( 'loads complete CSV in one request, derives capabilities, caches rows', async () => {
        const result = await CsvUrlStore.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } )
        expect( result.recordCount ).toBe( 2 )
        expect( result.capabilities.hasGeo ).toBe( true )
        expect( result.capabilities.spatialQuery ).toBe( true )
        expect( result.fromCache ).toBe( false )

        const { rows } = CsvUrlStore.getRows( { url: URL } )
        expect( rows.length ).toBe( 2 )
        expect( rows[ 0 ].latitude ).toBeCloseTo( 50.0 )
        expect( rows[ 0 ].lat ).toBeCloseTo( 50.0 )
        expect( rows[ 0 ].population ).toBe( 3700 )

        expect( CsvUrlStore.isLoaded( { url: URL } ).loaded ).toBe( true )
    } )


    test( 'second call without force is served from cache', async () => {
        await CsvUrlStore.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } )
        const again = await CsvUrlStore.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } )
        expect( again.fromCache ).toBe( true )
    } )
} )


describe( 'CsvUrlStore.loadFromUrl (mandatory parseConfig — no silent default)', () => {
    test( 'missing parseConfig throws CSV-URL-005', async () => {
        await expect( CsvUrlStore.loadFromUrl( { url: URL } ) )
            .rejects.toThrow( /CSV-URL-005/ )
    } )


    test( 'incomplete parseConfig (no latColumn) throws CSV-URL-005', async () => {
        const incomplete = { separator: 'semicolon', decimal: 'comma', lonColumn: 'longitude', typeCoercion: {} }
        await expect( CsvUrlStore.loadFromUrl( { url: URL, parseConfig: incomplete } ) )
            .rejects.toThrow( /CSV-URL-005/ )
    } )
} )


describe( 'CsvUrlStore.loadFromUrl (transport + validation)', () => {
    test( 'non-HTTPS url throws CSV-URL-001 (no silent skip)', async () => {
        await expect( CsvUrlStore.loadFromUrl( { url: 'http://example.org/data.csv', parseConfig: PARSE_CONFIG } ) )
            .rejects.toThrow( /CSV-URL-001/ )
    } )


    test( 'HTTP error is surfaced as CSV-URL-002', async () => {
        mockFetch( { ok: false, status: 503, body: '' } )
        await expect( CsvUrlStore.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } ) )
            .rejects.toThrow( /CSV-URL-002/ )
    } )


    test( 'network failure is surfaced as CSV-URL-002', async () => {
        mockFetchThrows( { message: 'ENOTFOUND' } )
        await expect( CsvUrlStore.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } ) )
            .rejects.toThrow( /CSV-URL-002/ )
    } )


    test( 'missing required geo column on load throws CSV-URL-003 (F6)', async () => {
        const noGeo = 'id;name;category\n1;Alpha;city'
        mockFetch( { body: noGeo } )
        await expect( CsvUrlStore.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } ) )
            .rejects.toThrow( /CSV-URL-003/ )
    } )


    test( 'missing typeCoercion column on load throws CSV-URL-003 (F6)', async () => {
        const csvNoPop = 'id;name;category;latitude;longitude\n1;Alpha;city;50,0;10,0'
        mockFetch( { body: csvNoPop } )
        await expect( CsvUrlStore.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } ) )
            .rejects.toThrow( /CSV-URL-003/ )
    } )
} )


describe( 'CsvUrlStore accessors require a loaded url', () => {
    test( 'getRows throws CSV-URL-004 when not loaded', () => {
        expect( () => CsvUrlStore.getRows( { url: 'https://example.org/none.csv' } ) ).toThrow( /CSV-URL-004/ )
    } )


    test( 'getCapabilities throws CSV-URL-004 when not loaded', () => {
        expect( () => CsvUrlStore.getCapabilities( { url: 'https://example.org/none.csv' } ) ).toThrow( /CSV-URL-004/ )
    } )
} )
