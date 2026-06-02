import { existsSync, statSync } from 'node:fs'


export class InputDetector {
    static detect( { input } ) {
        if( Buffer.isBuffer( input ) ) {
            return { inputType: 'buffer' }
        }
        if( typeof input === 'string' ) {
            const lower = input.toLowerCase()
            if( lower.endsWith( '.csv' ) ) {
                return { inputType: 'csv' }
            }
            if( lower.endsWith( '.tsv' ) ) {
                return { inputType: 'tsv' }
            }
            if( existsSync( input ) && statSync( input ).isFile() ) {
                return { inputType: 'file' }
            }
            throw new Error( `Cannot detect input type from path: ${input}` )
        }
        throw new Error( 'Input must be Buffer or string path' )
    }
}
