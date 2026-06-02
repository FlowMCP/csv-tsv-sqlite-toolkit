import { describe, test, expect, beforeAll, afterEach, afterAll } from '@jest/globals'
import { FlowMcpAdapter } from '../../src/adapters/FlowMcpAdapter.mjs'
import { CsvUrlStore } from '../../src/converters/csv/CsvUrlStore.mjs'


const URL = 'https://example.org/places.csv'

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


beforeAll( async () => {
    originalFetch = global.fetch
    mockFetch( { body: CSV } )
    CsvUrlStore.clear()
    await FlowMcpAdapter.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } )
} )


afterEach( () => {
    mockFetch( { body: CSV } )
} )


afterAll( () => {
    CsvUrlStore.clear()
    global.fetch = originalFetch
} )


describe( 'FlowMcpAdapter.loadFromUrl', () => {
    test( 'loads a complete CSV in one request and reports capabilities', async () => {
        CsvUrlStore.clear()
        const result = await FlowMcpAdapter.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } )
        expect( result.loaded ).toBe( true )
        expect( result.recordCount ).toBe( 2 )
        expect( result.capabilities.spatialQuery ).toBe( true )
    } )


    test( 'missing parseConfig is rejected (CSV-URL-005, no silent default)', async () => {
        CsvUrlStore.clear()
        await expect( FlowMcpAdapter.loadFromUrl( { url: URL } ) )
            .rejects.toThrow( /CSV-URL-005/ )
    } )


    test( 'rejects non-HTTPS url (no silent skip)', async () => {
        await expect( FlowMcpAdapter.loadFromUrl( { url: 'http://example.org/x.csv', parseConfig: PARSE_CONFIG } ) )
            .rejects.toThrow( /CSV-URL-001/ )
    } )


    test( 'missing required column on load is rejected (F6, replaces verifySeal)', async () => {
        mockFetch( { body: 'id;name;category\n1;Alpha;city' } )
        CsvUrlStore.clear()
        await expect( FlowMcpAdapter.loadFromUrl( { url: 'https://example.org/bad.csv', parseConfig: PARSE_CONFIG } ) )
            .rejects.toThrow( /CSV-URL-003/ )
    } )


    test( 'fetch failure (HTTP error) is surfaced, not silently skipped', async () => {
        mockFetch( { ok: false, status: 503, body: '' } )
        CsvUrlStore.clear()
        await expect( FlowMcpAdapter.loadFromUrl( { url: 'https://example.org/down.csv', parseConfig: PARSE_CONFIG } ) )
            .rejects.toThrow( /CSV-URL-002/ )
    } )
} )


describe( 'FlowMcpAdapter.getAvailableMethods', () => {
    test( 'returns the three methods for a loaded geo url', async () => {
        mockFetch( { body: CSV } )
        CsvUrlStore.clear()
        await FlowMcpAdapter.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } )
        const { methods, capabilities } = FlowMcpAdapter.getAvailableMethods( { url: URL } )
        const names = methods.map( ( m ) => m.name ).sort()
        expect( names ).toEqual( [ 'byType', 'featuresInBBox', 'nearPoint' ] )
        expect( capabilities.spatialQuery ).toBe( true )
    } )
} )


describe( 'FlowMcpAdapter.buildToolDefinitions', () => {
    test( 'tools are namespace-prefixed with valid inputSchema and method name', async () => {
        mockFetch( { body: CSV } )
        CsvUrlStore.clear()
        await FlowMcpAdapter.loadFromUrl( { url: URL, parseConfig: PARSE_CONFIG } )
        const { tools } = FlowMcpAdapter.buildToolDefinitions( { url: URL, namespace: 'places' } )
        expect( tools.length ).toBe( 3 )
        const names = tools.map( ( t ) => t.name )
        expect( names ).toContain( 'places.featuresInBBox' )
        expect( names ).toContain( 'places.nearPoint' )
        expect( names ).toContain( 'places.byType' )
        tools.forEach( ( tool ) => {
            expect( tool.inputSchema.type ).toBe( 'object' )
            expect( typeof tool.inputSchema.properties ).toBe( 'object' )
            expect( Array.isArray( tool.inputSchema.required ) ).toBe( true )
            expect( typeof tool.method ).toBe( 'string' )
            expect( tool.sqlTemplate ).toBeUndefined()
        } )
    } )


    test( 'invalid namespace rejected', () => {
        expect( () => FlowMcpAdapter.buildToolDefinitions( { url: URL, namespace: 'Bad Name' } ) ).toThrow()
    } )
} )
