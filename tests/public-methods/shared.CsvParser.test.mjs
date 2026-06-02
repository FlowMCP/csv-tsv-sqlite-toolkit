import { describe, test, expect } from '@jest/globals'
import { CsvParser } from '../../src/shared/CsvParser.mjs'


const toBuffer = ( text ) => Buffer.from( text, 'utf-8' )


describe( 'CsvParser', () => {
    test( 'separatorChar maps the three allowed separators', () => {
        expect( CsvParser.separatorChar( { separator: 'comma' } ).char ).toBe( ',' )
        expect( CsvParser.separatorChar( { separator: 'semicolon' } ).char ).toBe( ';' )
        expect( CsvParser.separatorChar( { separator: 'tab' } ).char ).toBe( '\t' )
        expect( CsvParser.separatorChar( { separator: 'pipe' } ).status ).toBe( false )
    } )


    test( 'parses a semicolon CSV', () => {
        const csv = 'a;b;c\n1;2;3\n4;5;6'
        const { headers, rows, status } = CsvParser.parse( { buffer: toBuffer( csv ), filename: 'x.csv', separator: 'semicolon' } )
        expect( status ).toBe( true )
        expect( headers ).toEqual( [ 'a', 'b', 'c' ] )
        expect( rows.length ).toBe( 2 )
        expect( rows[ 0 ] ).toEqual( { a: '1', b: '2', c: '3' } )
    } )


    test( 'parses a tab TSV', () => {
        const tsv = 'a\tb\n1\t2\n3\t4'
        const { headers, rows, status } = CsvParser.parse( { buffer: toBuffer( tsv ), filename: 'x.tsv', separator: 'tab' } )
        expect( status ).toBe( true )
        expect( headers ).toEqual( [ 'a', 'b' ] )
        expect( rows[ 1 ] ).toEqual( { a: '3', b: '4' } )
    } )


    test( 'quote handling stays separator-agnostic — separator inside quotes is preserved', () => {
        const csv = 'name;note\n"Berlin, DE";"a ; b"'
        const { rows } = CsvParser.parse( { buffer: toBuffer( csv ), filename: 'x.csv', separator: 'semicolon' } )
        expect( rows[ 0 ].name ).toBe( 'Berlin, DE' )
        expect( rows[ 0 ].note ).toBe( 'a ; b' )
    } )


    test( 'escaped double-quote inside a quoted field', () => {
        const csv = 'a\n"he said ""hi"""'
        const { rows } = CsvParser.parse( { buffer: toBuffer( csv ), filename: 'x.csv', separator: 'comma' } )
        expect( rows[ 0 ].a ).toBe( 'he said "hi"' )
    } )


    test( 'unknown separator yields status false with CSV-006', () => {
        const { status, messages } = CsvParser.parse( { buffer: toBuffer( 'a,b' ), filename: 'x.csv', separator: 'pipe' } )
        expect( status ).toBe( false )
        expect( messages[ 0 ].code ).toBe( 'CSV-006' )
    } )


    test( 'empty file yields status false', () => {
        const { status, messages } = CsvParser.parse( { buffer: toBuffer( '' ), filename: 'x.csv', separator: 'comma' } )
        expect( status ).toBe( false )
        expect( messages[ 0 ].code ).toBe( 'CSV-005' )
    } )


    test( 'strips BOM from header', () => {
        const csv = '﻿a,b\n1,2'
        const { headers } = CsvParser.parse( { buffer: toBuffer( csv ), filename: 'x.csv', separator: 'comma' } )
        expect( headers ).toEqual( [ 'a', 'b' ] )
    } )
} )
