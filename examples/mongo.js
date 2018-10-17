const _ = require('lodash');
const mongoist = require('mongoist');

const PineQL = require('pine-ql');
const {Types} = PineQL;

const db = mongoist();

// Create Schema
const types = {
    user: Types.shape({
        $type: Type.default('user').isRequired,
        id: Type.string.value((ctx, user) => user._id).isRequired,
        name: Type.string,
        score: Type.number,
        friends: Type.ref('user', {
            // Get from DB
            get(ctx, users) {
                return db.users.find({
                    friends: {
                        $in: users.map(users, _.property('_id')),
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

const rql = new PineQL({
    types,
});

// Get some user from DB
db.users.findOne({_id: 1})
.then((user) => {
    // Populate data
    return rql.populate(user, 'user', 'name,friends{score}', {});
})
.catch((error) => console.error(error));
