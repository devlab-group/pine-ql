const _ = require('lodash');

const {Types} = require('..');
const store = require('./store.js');

function getId(value) {
    if (_.isObject(value)) {
        return value.id;
    }
    else {
        return value;
    }
}

const userType = Types.shape({
    $type: Types.string.default('user').isRequired,
    id: Types.string.isRequired,
    username: Types.string,
    friends: Types.ref('user', {
        get(ctx, users) {
            const ids = _.uniq(_.flatten(users.map(_.property('friends'))));

            return store.users.filter(
                (friend) => ids.includes(getId(friend))
            )
            .map(v => _.cloneDeep(v));
        },
        set(ctx, users, friends) {
            const index = _.keyBy(friends, _.property('id'));

            return users.map((user) => {
                user.friends = user.friends.map((friend) => index[friend]);
                return user;
            });
        },
    }),
    posts: Types.ref('post', {
        get(ctx, users) {
            const ids = users.map(_.property('id'));

            return store.posts.filter(
                (post) => ids.includes(getId(post.author))
            )
            .map(v => _.cloneDeep(v));
        },
        set(ctx, users, posts) {
            const groupped = _.groupBy(posts, post => getId(post.author));

            return users.map((user) => {
                user.posts = groupped[user.id];
                return user;
            });
        },
    }),
});

const commentType = Types.shape({
    $type: Types.string.default('comment').isRequired,
    id: Types.string.isRequired,
    text: Types.string,
    date: Types.instanceOf(Date),
    isAuthor: Types.value((ctx, comment) => {
        return getId(comment.author) === ctx.actor;
    }),
    author: Types.ref('user', {
        get(ctx, comments) {
            const ids = _.uniq(comments.map(_.property('author')));

            return store.users.filter(
                (author) => ids.includes(getId(author))
            )
            .map(v => _.cloneDeep(v));
        },
        set(ctx, comments, users) {
            const index = _.keyBy(users, _.property('id'));

            return comments.map((comment) => {
                comment.author = index[comment.author];
                return comment;
            });
        },
    }),
});

const postType = Types.shape({
    $type: Types.string.default('post').isRequired,
    id: Types.string.isRequired,
    title: Types.string.isRequired,
    date: Types.instanceOf(Date),
    intro: Types.string,
    text: Types.string,
    isAuthor: Types.value((ctx, post) => {
        return getId(post.author) === ctx.actor;
    }),
    author: Types.ref('user', {
        get(ctx, posts) {
            const ids = _.uniq(posts.map(_.property('author')));

            return store.users.filter(
                (author) => ids.includes(getId(author))
            )
            .map(v => _.cloneDeep(v));
        },
        set(ctx, posts, authors) {
            const index = _.keyBy(authors, _.property('id'));

            return posts.map((post) => {
                post.author = index[post.author];
                return post;
            });
        },
    }),
    comments: Types.ref('comment', {
        get(ctx, posts) {
            const ids = posts.map(_.property('id'));

            return store.comments.filter(
                (comment) => ids.includes(getId(comment.post))
            )
            .map(v => _.cloneDeep(v));
        },
        set(ctx, posts, comments) {
            const group = _.groupBy(comments, _.property('post'));

            return posts.map((post) => {
                post.comments = group[post.id];
                return post;
            });
        },
    }),
    lastComment: Types.ref('comment', {
        async get(ctx, posts) {
            const lastComments = posts.map(({lastComment}) => lastComment)
            .filter((item) => !! item);

            return store.comments.filter(
                (comment) => lastComments.includes(comment.id)
            );
        },
        set(ctx, posts, comments) {
            const index = _.keyBy(comments, _.property('id'));

            return posts.map((post) => {
                post.lastComment = index[post.lastComment] || null;
                return post;
            });
        },
    }),
});

const compositeType = Types.shape({
    posts: postType,
    user: userType,
});

const usePostType = Types.use('post');

const types = {
    post: postType,
    usePost: usePostType,
    user: userType,
    comment: commentType,
    composite: compositeType,
};

module.exports = types;
