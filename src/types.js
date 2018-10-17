const TypedProps = require('typed-props');

class PineTypes extends TypedProps {}

// Noop property for single item population
PineTypes.addMethod('ref', noop);

// Noop property for scheme type reference
PineTypes.addMethod('use', noop);

// Noop property for data representing
PineTypes.addMethod('value', noop);

// Noop property for default value
PineTypes.addMethod('default', noop);

function noop() {}

module.exports = PineTypes;
