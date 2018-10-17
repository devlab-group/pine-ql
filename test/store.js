module.exports = {
    users: [
        {
            id: 1,
            username: 'admin',
            friends: [],
        },
        {
            id: 2,
            username: 'jack',
            friends: [3],
        },
        {
            id: 3,
            username: 'bob',
            friends: [2],
        },
    ],
    posts: [
        {
            id: 1,
            title: 'Hello',
            intro: 'Hello world',
            text: 'Hello World\n This is simple post',
            author: 1,
            date: new Date(0),
            lastComment: 3,
        },
        {
            id: 2,
            title: 'Post #2',
            intro: 'Second post',
            text: 'This is the second post',
            author: 2,
            date: new Date(0),
            lastComment: null,
        },
    ],
    comments: [
        {
            id: 1,
            post: 1,
            text: 'Wow',
            author: 2,
            date: new Date(2),
        },
        {
            id: 2,
            post: 1,
            text: 'Foo',
            author: 3,
            date: new Date(3),
        },
        {
            id: 3,
            post: 1,
            text: 'This is awesome!',
            author: 1,
            date: new Date(4),
        },
    ],
};
