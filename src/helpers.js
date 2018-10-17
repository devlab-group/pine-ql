const {isPlainObject} = require('lodash');
const TypedProps = require('typed-props');

function byLink(get) {
    return function(target, name) {
        const trail = [name];

        let next = get(target, name);

        while (typeof next === 'string') {
            if (trail.includes(next)) {
                throw new Error(
                    `Cycle reference: "${trail.join('->')}->${next}"`
                );
            }

            trail.push(next);
            next = get(target, next);
        }

        return next;
    };
}

const RULES = {
    shape(shape) {
        return createSchema(shape);
    },
    default(value) {
        return value;
    },
    string() {
        return true;
    },
    bool() {
        return true;
    },
    number() {
        return true;
    },
    object() {
        return true;
    },
    array() {
        return true;
    },
    ref(type, {get, set}) {
        return {type, get, set};
    },
    use(type) {
        return type;
    },
    isRequired() {
        return true;
    },
};

function typeToObject(type) {
    const result = {};

    const checks = TypedProps.getChecks(type);

    checks.forEach(({name, args}) => {
        if (Reflect.has(RULES, name)) {
            result[name] = RULES[name](...args);
        }
        else {
            result[name] = args;
        }
    });

    return result;
}

function createSchema(types) {
    const schema = {};

    for (const [name, type] of Object.entries(types)) {
        schema[name] = typeToObject(type);
    }

    return schema;
}

const findTypeByName = byLink((types, name) => {
    const type = types[name];

    if (! type) {
        return;
    }
    else if (type.use) {
        return type.use;
    }
    else {
        return type;
    }
});

function getTypeByName(types, type) {
    const result = findTypeByName(types, type);

    if (! result) {
        throw new Error(`Type ${type} could not be find`);
    }

    return result;
}

function flattenReduce(result, values) {
    if (Array.isArray(values)) {
        return [...result, ...values];
    }
    else {
        return [...result, values];
    }
}

function collectByPath(target, path) {
    if (Array.isArray(target)) {
        return target.map((item) => collectByPath(item, path))
        .reduce(flattenReduce, []);
    }

    const value = target[path[0]];

    if (path.length < 2) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => collectByPath(item, path.slice(1)))
        .reduce(flattenReduce, []);
    }
    else {
        const result = collectByPath(value, path.slice(1));
        if (! Array.isArray(result)) {
            return [result];
        }
        else {
            return result;
        }
    }
}

function updateByPath(target, path, update) {
    if (path.length) {
        if (Array.isArray(target)) {
            return target.map(
                (item) => updateByPath(item, path, update)
            );
        }
        else {
            const key = path[0];
            if (key in target === false) {
                return target;
            }

            return {
                ...target,
                [key]: updateByPath(target[key], path.slice(1), update),
            };
        }
    }
    else if (! Array.isArray(target)) {
        return update([target])[0];
    }
    else {
        return update(target);
    }
}

function clone(target) {
    if (! target || typeof target !== 'object') {
        return target;
    }
    else if (Array.isArray(target)) {
        return target.map(clone);
    }
    else if (isPlainObject(target)) {
        const duplicate = Object.getOwnPropertyNames(target)
        .reduce(function (result, name){
            result[name] = clone(target[name]);
            return result;
        }, {});

        return duplicate;
    }
    else if (typeof target.clone === 'function') {
        return target.clone();
    }
    else {
        return target;
    }
}

exports.getTypeByName = getTypeByName;
exports.typeToObject = typeToObject;
exports.createSchema = createSchema;
exports.collectByPath = collectByPath;
exports.updateByPath = updateByPath;
exports.clone = clone;
