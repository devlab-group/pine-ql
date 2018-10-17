const _ = require('lodash');
const should = require('should');
const rql = require('response-ql');

const PineQL = require('../');
const {
    Types,
    resolve,
    populate,
    filtrate,
    createSchema,
    typeToObject,
    rqlToObject,
} = PineQL;

const store = require('./store.js');
const types = require('./types.js');

describe('PineQL', function() {
    let schema;

    before(function() {
        schema = createSchema(types);
    });

    describe('resolve()', function() {
        it('Should extract refs by type name', function() {
            const props = rql('author, title, text, comments{author,text}');
            const refs = resolve(schema, 'post', rqlToObject(props), 3);

            should(refs).be.instanceOf(Array);
            should(refs).has.lengthOf(3);

            should(refs[0].path).be.deepEqual(['author']);
            should(refs[1].path).be.deepEqual(['comments']);
            should(refs[2].path).be.deepEqual(['comments', 'author']);
        });

        it('Should extract refs with type schema', function() {
            const props = rql('author, title, text, comments{author,text}');
            const refs = resolve(schema, schema.post, rqlToObject(props), 3);

            should(refs).be.instanceOf(Array);
            should(refs).has.lengthOf(3);

            should(refs[0].path).be.deepEqual(['author']);
            should(refs[1].path).be.deepEqual(['comments']);
            should(refs[2].path).be.deepEqual(['comments', 'author']);
        });

        it('Should extract refs from `use`', function() {
            const type = typeToObject(Types.use('post'));

            const props = rql('author, title, text, comments{author,text}');
            const refs = resolve(schema, type, rqlToObject(props), 3);

            should(refs).be.instanceOf(Array);
            should(refs).has.lengthOf(3);

            should(refs[0].path).be.deepEqual(['author']);
            should(refs[1].path).be.deepEqual(['comments']);
            should(refs[2].path).be.deepEqual(['comments', 'author']);
        });

        it('Should extract refs from multiple `use`', function() {
            const type = typeToObject(Types.use('usePost'));

            const props = rql('author, title, text, comments{author,text}');
            const refs = resolve(schema, type, rqlToObject(props), 3);

            should(refs).be.instanceOf(Array);
            should(refs).has.lengthOf(3);

            should(refs[0].path).be.deepEqual(['author']);
            should(refs[1].path).be.deepEqual(['comments']);
            should(refs[2].path).be.deepEqual(['comments', 'author']);
        });

        it('Should extract ref with `use`', function() {
            const type = typeToObject(Types.ref('post', {get(){}, set(){}}));

            const props = rql('author, title, text, comments{author,text}');
            should.throws(() => {
                resolve(schema, type, rqlToObject(props));
            }, /Root \w+ contains `ref`/);
        });

        it('Should extract refs from nested shapes', function() {
            const type = typeToObject(Types.shape({
                blogs: Types.shape({
                    sections: Types.shape({
                        posts: Types.ref('post', {get(){}, set(){}}),
                    }),
                }),
            }));

            const props = rql('blogs{sections{posts{author}}}');
            const refs = resolve(schema, type, rqlToObject(props));

            should(refs).be.instanceOf(Array);
            should(refs).has.lengthOf(2);

            should(refs[0].path).be.deepEqual([
                'blogs', 'sections', 'posts',
            ]);
            should(refs[1].path).be.deepEqual([
                'blogs', 'sections', 'posts', 'author',
            ]);
        });
    });

    describe('populate()', function() {
        it('Should return populated props', async function() {
            const props = rql(
                'author{posts}, title, text, comments{author{friends},text}'
            );
            const refs = resolve(schema, 'post', rqlToObject(props), 3);

            const [post] = await populate({}, [store.posts[0]], refs);
            should(post).has.ownProperty('author')
            .which.has.ownProperty('friends');

            should(post.author.friends).be.instanceOf(Array).with.lengthOf(0);
            should(post).has.ownProperty('comments')
            .which.is.instanceOf(Array).with.lengthOf(3);

            const comment1 = post.comments[0];
            const comment2 = post.comments[1];

            should(comment1).has.ownProperty('author')
            .which.has.ownProperty('id').which.is.equal(2);

            should(comment2).has.ownProperty('author')
            .which.has.ownProperty('id').which.is.equal(3);
        });

        it('Should return nested props', async function() {
            const props = rql(
                'blogs{sections{posts{author}}}'
            );
            const type = Types.shape({
                blogs: Types.shape({
                    sections: Types.shape({
                        posts: Types.use('post'),
                    }),
                }),
            });

            const refs = resolve(schema, typeToObject(type), rqlToObject(props), 4);

            const source = {
                blogs: [{
                    sections: [{
                        posts: [
                            store.posts[0],
                        ],
                    }],
                }],
            };

            const result = await populate({}, [source], refs);

            should(result).be.instanceOf(Array).with.lengthOf(1);

            const site = result[0];
            should(site).has.ownProperty('blogs')
            .which.is.instanceOf(Array).with.lengthOf(1);

            const blog = site.blogs[0];
            should(blog).has.ownProperty('sections')
            .which.is.instanceOf(Array).with.lengthOf(1);

            const section = blog.sections[0];
            should(section).has.ownProperty('posts')
            .which.is.instanceOf(Array).with.lengthOf(1);

            const post = section.posts[0];
            should(post).has.ownProperty('author')
            .which.is.instanceOf(Object);

            should(post.author).has.ownProperty('id');
            should(post.author).has.ownProperty('username').which.equal('admin');
        });
    });

    describe('filtrate()', function() {
        it('should filtrate results', async function() {
            const ctx = {
                actor: 1,
            };

            const props = rqlToObject(rql('author{posts{author,isAuthor}}'));
            const refs = resolve(schema, 'post', props, 3);

            const posts = await populate(ctx, [store.posts[0]], refs);

            const result = posts.map(
                (post) => filtrate(ctx, post, schema, 'post', props)
            );

            should(result).be.instanceOf(Array).and.has.lengthOf(1);

            const post = result[0];

            should(post).has.ownProperty('id');
            should(post).has.ownProperty('$type').which.is.equal('post');
            should(post).has.ownProperty('author');

            const author = post.author;
            should(author).has.ownProperty('id');
            should(author).has.ownProperty('$type').which.is.equal('user');
            should(author).has.ownProperty('posts').which.is.instanceOf(Array);

            const authorPosts = author.posts;
            should(authorPosts).have.lengthOf(1);

            const authorsPost = authorPosts[0];
            should(authorsPost).has.ownProperty('id');
            should(authorsPost).has.ownProperty('$type').which.is.equal('post');
            should(authorsPost).has.ownProperty('isAuthor').which.is.equal(true);

            const postsAuthor = authorsPost.author;
            should(postsAuthor).has.ownProperty('id');
            should(postsAuthor).has.ownProperty('$type').which.is.equal('user');
        });

        it('Should produce the same output with PineQL class', async function() {
            const pql = new PineQL({
                schema,
            });
            const query = 'author{posts{author,isAuthor}}';

            const ctx = {
                actor: 1,
            };

            const post = await pql.context(ctx).grow(store.posts[0], 'post', query);

            should(post).has.ownProperty('id');
            should(post).has.ownProperty('$type').which.is.equal('post');
            should(post).has.ownProperty('author');

            const author = post.author;
            should(author).has.ownProperty('id');
            should(author).has.ownProperty('$type').which.is.equal('user');
            should(author).has.ownProperty('posts').which.is.instanceOf(Array);

            const authorPosts = author.posts;
            should(authorPosts).have.lengthOf(1);

            const authorsPost = authorPosts[0];
            should(authorsPost).has.ownProperty('id');
            should(authorsPost).has.ownProperty('$type').which.is.equal('post');
            should(authorsPost).has.ownProperty('isAuthor').which.is.equal(true);

            const postsAuthor = authorsPost.author;
            should(postsAuthor).has.ownProperty('id');
            should(postsAuthor).has.ownProperty('$type').which.is.equal('user');
        });

        it('Should return `id` and `$type` if there is no ResponseQL', async function() {
            const pql = new PineQL({
                schema,
            });
            const query = '';

            const ctx = {
                actor: 1,
            };

            const post = await pql.context(ctx).grow(store.posts[0], 'post', query);

            should(post).has.ownProperty('id');
            should(post).has.ownProperty('$type').which.is.equal('post');
        });

        it('Should return shape for `use` Type', async function() {
            const pql = new PineQL({
                schema,
            });
            const query = 'title';

            const ctx = {
                actor: 1,
            };

            const post = await pql.grow(store.posts[0], 'usePost', query, ctx);

            should(post).has.ownProperty('id');
            should(post).has.ownProperty('$type').which.is.equal('post');
            should(post).has.ownProperty('title').which.is.equal('Hello');
        });

        it('Should return null for nulled values', async function() {
            const pql = new PineQL({
                schema,
            });
            const query = 'title,lastComment';

            const ctx = {
                actor: 1,
            };

            const post1 = await pql.grow(store.posts[0], 'post', query, ctx);
            const post2 = await pql.grow(store.posts[1], 'post', query, ctx);

            should(post1).has.ownProperty('lastComment')
            .which.is.instanceOf(Object)
            .and.has.ownProperty('id')
            .which.is.equal(3);

            should(post2).has.ownProperty('lastComment')
            .which.is.equal(null);
        });
    });
});
