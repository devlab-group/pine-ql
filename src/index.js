const _ = require('lodash');
const keyget = require('keyget');
const rql = require('response-ql');

const PineTypes = require('./types');
const {
    getTypeByName,
    createSchema,
    typeToObject,
    collectByPath,
    updateByPath,
    clone,
} = require('./helpers.js');


function resolve(types, type, props, depth = 10) {
    let innerType;
    if (_.isString(type)) {
        innerType = getTypeByName(types, type);
    }
    else {
        innerType = type;
    }

    if (innerType.ref) {
        throw new Error('Root property contains `ref`');
    }

    const result = _resolve(types, innerType, props, depth);

    return result;
}

function _resolve(types, type, props, depth = 10) {
    if (depth < 0) {
        return [];
    }

    let innerType;
    if (_.isString(type)) {
        innerType = getTypeByName(types, type);
    }
    else {
        innerType = type;
    }

    if (innerType.ref) {
        return resolveRef(types, type, props, depth);
    }
    else {
        return resolveShape(types, type, props, depth);
    }
}

function resolveRef(types, type, props, depth) {
    const {ref} = type;

    const innerType = getTypeByName(types, ref.type);

    return [
        {path: [], ref},
        ...resolveShape(types, innerType, props, depth),
    ];
}

function resolveShape(types, type, props, depth) {
    const innerType = getInnerType(types, type);

    if (! innerType.shape) {
        return [];
    }

    let shapeProps;
    if (props === true) {
        shapeProps = shapeToProps(innerType.shape);
    }
    else {
        shapeProps = props;
    }

    return Object.entries(innerType.shape)
    .reduce((refs, [key, shape]) => {
        if (key in shapeProps === false) {
            return refs;
        }

        const shapeRefs = _resolve(types, shape, shapeProps[key], depth - 1)
        .map(({path, ref}) => ({
            path: [key, ...path],
            ref,
        }));

        return [
            ...refs,
            ...shapeRefs,
        ];
    }, []);
}

function getInnerType(types, type) {
    if (_.isString(type)) {
        return getTypeByName(types, type);
    }
    else if (_.isObject(type)) {
        if (type.use) {
            return getInnerType(types, type.use);
        }
    }

    return type;
}

function shapeToProps(shape) {
    const result = {};

    for (const name of Object.keys(shape)) {
        result[name] = [];
    }
    return result;
}

function getPathLength({path}) {
    return path.length;
}

function sortPathLength({path: a}, {path: b}) {
    return a.length - b.length;
}

async function populate(ctx, data, refs) {
    const memory = await populateGet(ctx, data, refs);
    return populateSet(ctx, data, memory, refs);
}

// Get referred data
async function populateGet(ctx, data, refs) {
    const groups = _.groupBy(refs, getPathLength);

    const result = {};
    // TODO prevent useless requests

    for (const items of Object.values(groups)) {
        await Promise.all(items.map(async ({path, ref}) => {
            const currentValue = keyget.get(items, path);

            if (currentValue) {
                const isNonPrimitiveArray = Array.isArray(currentValue)
                    && (!currentValue.length || _.isObject(currentValue[0]));

                if (isNonPrimitiveArray) {
                    result[path.join('.')] = currentValue;
                    return;
                }
            }

            let selection;
            if (path.length > 1) {
                const subpath = path.slice(0, -1).join('.');
                if (! result[subpath]) {
                    result[subpath] = collectByPath(data, path.slice(0, -1));
                }

                selection = result[subpath];
            }
            else {
                selection = data;
            }

            const values = await ref.get(ctx, selection);
            result[path.join('.')] = values;
        }));
    }

    return result;
}

// Append data to objects
function populateSet(ctx, data, memory, refs) {
    const sorted = refs.sort(sortPathLength);

    let result = clone(data);

    for (const item of sorted) {
        const {path, ref} = item;

        result = updateByPath(
            result,
            path.slice(0, -1),
            (targets) => ref.set({...ctx}, targets, memory[path.join('.')])
        );
    }

    return result;
}

/* eslint-disable max-statements */
function filtrate(ctx, data, types, typeName, props = {}) {
    if (data === null || data === undefined) {
        return null;
    }

    const result = {};

    const type = _.isObject(typeName) // Anonymous shape
        ? typeName
        : types[typeName];

    let shape;
    if (type.shape) {
        shape = type.shape;
    }
    else if (type.use) {
        shape = types[type.use].shape;
    }
    else {
        return null;
    }

    for (const name of Object.keys(shape)) {
        const propType = shape[name];
        if (! propType.isRequired && props !== true && ! Reflect.has(props, name)) {
            continue;
        }

        const propProps = props === true ? {} : props[name];

        if (propType.ref || propType.use) {
            let propTypename;
            if (propType.ref) {
                propTypename = propType.ref.type;
            }
            else {
                propTypename = propType.use;
            }

            if (Array.isArray(data[name])) {
                result[name] = data[name].map(
                    (value) => filtrate(
                        {...ctx}, value, types, propTypename, propProps
                    )
                );
            }
            else {
                result[name] = filtrate(
                    {...ctx}, data[name], types, propTypename, propProps
                );
            }
        }
        else if (propType.value) {
            const transform = propType.value[0];
            result[name] = transform({...ctx}, data, name, result);
        }
        else if (_.isObject(data) && name in data) {
            result[name] = data[name];
        }
        else {
            result[name] = propType.default;
        }

        if (typeof result[name] === 'undefined') {
            result[name] = null;
        }
    }

    return result;
}
/* eslint-enable max-statements */

function rqlToObject(props) {
    const result = {};
    for (const [name, prop] of props.entries()) {
        if (prop === true) {
            result[name] = prop;
        }
        else {
            result[name] = rqlToObject(prop);
        }
    }
    return result;
}

class PineContext {
    constructor({pine, ctx}) {
        this.pine = pine;
        this.ctx = ctx;
    }

    grow(target, type, query) {
        return this.pine.grow(target, type, query, this.ctx);
    }
}

class PineQL {
    constructor({schema, maxDepth = 3}) {
        this.schema = schema;
        this.maxDepth = maxDepth;
    }

    async grow(target, type, query, ctx = {}) {
        const props = this.propsFromQuery(query);

        const refs = this.resolve(type, props);
        const populated = await this.populate(target, refs, ctx);
        const result = this.filtrate(populated, type, props, ctx);

        return result;
    }

    resolve(type, props) {
        return resolve(this.schema, type, props, this.maxDepth);
    }

    populate(target, refs, ctx = {}) {
        return populate(ctx, [target], refs)
        .then(([result]) => result);
    }

    filtrate(value, type, props, ctx = {}) {
        return filtrate(ctx, value, this.schema, type, props);
    }

    propsFromQuery(query) {
        let props;

        if (_.isObject(query)) {
            props = rqlToObject(query);
        }
        else if (query) {
            props = rqlToObject(
                rql(query)
            );
        }
        else {
            props = {};
        }

        return props;
    }

    context(ctx = {}) {
        return new PineContext({
            pine: this,
            ctx,
        });
    }
}

module.exports = PineQL;

PineQL.Context = PineContext;
PineQL.Types = PineTypes;
PineQL.createSchema = createSchema;
PineQL.typeToObject = typeToObject;
PineQL.resolve = resolve;
PineQL.populate = populate;
PineQL.filtrate = filtrate;
PineQL.rqlToObject = rqlToObject;
