# PineQL

PineQL is lightweight GraphQL-like library to populate data. It's framework or protocol agnostic and could be used anywhere.

It's based on [typed-props](https://npmjs/packages/typed-props)
and [response-ql](https://npmjs/packages/response-ql) libraries.

## Install

Install via `npm`:

```shell
npm i pine-ql
```  

## Usage

Usage example:

```javascript
const _ = require('lodash');
const mongoist = require('mongoist');

const PineQL = require('pine-ql');
const {Types} = PineQL;

const db = mongoist();

// Create Schema
const types = {
    user: Types.shape({
        name: Type.string.isRequired,
        score: Type.number,
        friends: Type.ref('user', {
            // Get from DB
            get(ctx, users) {
                return db.users.find({
                    friends: {
                        $in: users.map(users, _.property('id')),
                    },
                });
            },
            // Return result. Append friends to users
            set(ctx, users, friends) {
                return users.map((user) => ({
                    ...user,
                    friends: friends.filter(
                        ({id}) => user.friends.includes(id)
                    ),
                }));
            },
        }),
    }),
};

const pql = new PineQL({
    types,
});

// Get some user from DB
db.users.findOne({id: 1})
.then((user) => {
    // Populate data
    return pql.grow(user, 'user', 'name,friends{score}', {});
})
.catch((error) => console.error(error));
```

Also context could be concrete:

```javascript
rql.context({userId: 1}).grow(user, 'user', 'name,friends{score}');
```

## API

### PineQL

#### constructor()

```
({ schema:<type,Shape> }) -> PineQL
```

* `schema` - *object*. Where `key` is shape name and `shape` is a shape.

#### Shape{}

```
{ <type,any> }
```
* `<type,any>` - *object*. Object where key is PineTypes property or method and
value is check method arguments converted to internal PineQL's representation. Example:

```javascript
{
    ref: {type: 'user', get(){/*...*/}, set(){/*...*/}},
    object: true,
    isRequired: true,
}
```

Shape object represents `PineTypes` converted to object with internal PineQL
rules.


#### context()

```
(context:object) -> PineContext
```

Returns contextified PineQL. Which mean that you should not to pass context
each time you call `populate()`. This is helpful when PineQl is using with
WebSockets.

* `context` - *object*. Object with context params.

returns `PineContext`.

#### grow()

```
(target:object, type:string, rql:string, context:object) -> Promise<object,Error>
```

Populate related data according to schema, put it in target object, filtrate
and returns result.

* `target` - *object*. Object which props should be populated.
* `type` - *string*. Target object type name in schema.
* `rql` - *string*. ResponseQL string.
* `context` - *object*. Context data.

returns `Promise` with updated `target` as result or raised `error`.

### PineQL.Context | PineContext

#### constructor()

```
({ pine:PineQL, context:object }) -> PineContext
```

* `pine` - *PineQL*. PineQL instance.
* `context` - *object*. Context data.

#### grow()

```
(target:object, type:string, rql:string) -> Promise<object,Error>
```

Populate related data according to schema, put it in target object, filtrate
and returns result. Use context from the Context.

* `target` - *object*. Object which props should be populated.
* `type` - *string*. Target object type name in schema.
* `rql` - *string*. ResponseQL string.

returns `Promise` with updated `target` as result or raised `error`.



### PineQL.Types | PineTypes

#### shape()

```
(shape:object<name,PineTypes>) -> PineTypes
```

Creates new TypedProps shape.

* `shape` - *object<name,PineTypes>*. PineTypes instance describing shape.

Returns `PineTypes`.

#### use()
```
(type:string) -> PineTypes
```

* `type` - *string*. Type name from schema.

Returns `PineTypes`.

#### ref()

```
(type:string, opts:RefOptions) -> PineTypes
```

Creates population reference.

* `type` - *string*. Type name from schema.
* `opts` - *RefOptions*. Type which describes how to get linked data and how
    to insert it back into objects.

Returns `PineTypes`.

#### RefOptions{}
```
get: (context:object, targets:object[], prop:string) -> Promise,
set: (context:object, targets:object[], values[]) -> object[]
```

RefOptions contains functions `get` and `set`. `get` is using to retrieve data.
and `set` to append retrieved data to dataset.

* `get` - *function*. Populates data for specified field.
* `set` - *function*. Puts data into objects. Returns updated objects.

#### default()

```
(value:*) -> PineTypes
```

Sets default property value.

* `value` - *any*. Property default value.

Returns `PineTypes`.

#### value()

```
(fn:(context:object, data:object) -> object) -> PineTypes
```

Defines value converter.

* `fn` - *function(context:object, data:object)*. Function which extracts
    value from populated object accoring to context value.



## License

MIT.
