export class CsvCapabilityDetector {
    static detect( { headers, latColumn, lonColumn, rowCount } ) {
        const headerSet = new Set( headers )
        const hasGeo = headerSet.has( latColumn ) && headerSet.has( lonColumn )
        const hasRows = rowCount > 0

        return {
            hasGeo,
            spatialQuery: hasGeo && hasRows,
            attributeFilter: hasRows && headers.length > 0
        }
    }
}
