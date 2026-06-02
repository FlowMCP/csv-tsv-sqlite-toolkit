const CSV_CODES = {
    'CSV-001': { severity: 'ERROR',   description: 'Mandatory parse config missing (separator/decimal/latColumn/lonColumn/typeCoercion)' },
    'CSV-002': { severity: 'ERROR',   description: 'Configured latColumn or lonColumn not present in header' },
    'CSV-003': { severity: 'ERROR',   description: 'Datatype mismatch during coercion' },
    'CSV-004': { severity: 'ERROR',   description: 'CSV/TSV file has no header row' },
    'CSV-005': { severity: 'ERROR',   description: 'File is empty or unparseable' },
    'CSV-006': { severity: 'ERROR',   description: 'Unsupported input format' },

    'CSV-101': { severity: 'WARNING', description: 'Row has fewer columns than header' },
    'CSV-102': { severity: 'WARNING', description: 'Non-numeric value in lat/lon column (row skipped for geo)' },
    'CSV-103': { severity: 'WARNING', description: 'Duplicate header column name' },
    'CSV-104': { severity: 'WARNING', description: 'Non-UTF-8 encoding detected' },

    'CSV-201': { severity: 'INFO',    description: 'Geo columns detected (lat + lon present)' },
    'CSV-202': { severity: 'INFO',    description: 'Type coercion applied to one or more columns' }
}


export class Validation {
    #errors
    #warnings
    #info


    constructor() {
        this.#errors = []
        this.#warnings = []
        this.#info = []
    }


    static create() {
        return new Validation()
    }


    static getCodes() {
        return { ...CSV_CODES }
    }


    static getCodeMeta( { code } ) {
        if( !CSV_CODES[ code ] ) {
            throw new Error( `Unknown CSV code: ${code}` )
        }
        return { ...CSV_CODES[ code ] }
    }


    error( code, file, message ) {
        const meta = Validation.getCodeMeta( { code } )
        if( meta.severity !== 'ERROR' ) {
            throw new Error( `Code ${code} is not an ERROR (severity: ${meta.severity})` )
        }
        this.#errors.push( { code, file, message, severity: 'ERROR' } )
    }


    warning( code, file, message ) {
        const meta = Validation.getCodeMeta( { code } )
        if( meta.severity !== 'WARNING' ) {
            throw new Error( `Code ${code} is not a WARNING (severity: ${meta.severity})` )
        }
        this.#warnings.push( { code, file, message, severity: 'WARNING' } )
    }


    info( code, file, message ) {
        const meta = Validation.getCodeMeta( { code } )
        if( meta.severity !== 'INFO' ) {
            throw new Error( `Code ${code} is not an INFO (severity: ${meta.severity})` )
        }
        this.#info.push( { code, file, message, severity: 'INFO' } )
    }


    report() {
        return {
            status: this.#errors.length === 0,
            errors: [ ...this.#errors ],
            warnings: [ ...this.#warnings ],
            info: [ ...this.#info ],
            summary: {
                errorCount: this.#errors.length,
                warningCount: this.#warnings.length,
                infoCount: this.#info.length
            }
        }
    }
}
