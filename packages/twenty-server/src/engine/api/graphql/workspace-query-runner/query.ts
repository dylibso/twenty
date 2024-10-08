
// TODO needed a custom function to query encode the string...
// where can i just find this in the codebase...?
// Turns an object into a query string that the REST API can recognize
export function toQuery(obj: any): string {
  const params: string[] = [];

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];

      if (key === 'filter' && typeof value === 'object' && value !== null) {
        // Special handling for 'filter'
        const filterParts: string[] = [];

        for (const filterKey in value) {
          if (value.hasOwnProperty(filterKey)) {
            const filterValue = value[filterKey];

            if (typeof filterValue === 'object' && filterValue !== null) {
              // For operators like eq, neq, in, etc.
              for (const operator in filterValue) {
                if (filterValue.hasOwnProperty(operator)) {
                  const operand = filterValue[operator];

                  if (Array.isArray(operand)) {
                    // If operand is an array, join with commas
                    const operandStr = operand.join(',');
                    const filterPart = `${filterKey}[${operator}]:${operandStr}`;
                    filterParts.push(filterPart);
                  } else {
                    const filterPart = `${filterKey}[${operator}]:${operand}`;
                    filterParts.push(filterPart);
                  }
                }
              }
            } else {
              // If the filter value is a primitive
              const filterPart = `${filterKey}:${filterValue}`;
              filterParts.push(filterPart);
            }
          }
        }

        const filterParam = `${key}=${encodeURIComponent(filterParts.join(','))}`;
        params.push(filterParam);
      } else {
        // Handle other parameters normally
        const param = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        params.push(param);
      }
    }
  }

  return params.join('&');
}

