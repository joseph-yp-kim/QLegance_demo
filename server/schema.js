import PostsList from './data/posts';
import UsersList from './data/users';
import CommentsList from './data/comments';

import {
  GraphQLInt,
  GraphQLFloat,
  GraphQLString,
  GraphQLList,
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLNonNull,
  GraphQLSchema,
} from 'graphql';

const User = new GraphQLObjectType({
  name: 'user',
  fields: () => ({
    _id: {type: new GraphQLNonNull(GraphQLInt)},
    username: {type: new GraphQLNonNull(GraphQLString)},
    profilePic: {type: GraphQLString},
  })
});

const Comment = new GraphQLObjectType({
  name: 'comment',
  fields: () => ({
    _id: {type: new GraphQLNonNull(GraphQLInt)},
    content: {type: new GraphQLNonNull(GraphQLString)},
    user: {
      type: User,
      resolve: function({user}) {
        for (let i = 0; i < UsersList.length; i += 1) {
          if (UsersList[i].username === user) return UsersList[i];
        }
      }
    } 
  })
});

const Post = new GraphQLObjectType({
  name: 'post',
  fields: () => ({
    _id: {type: new GraphQLNonNull(GraphQLInt)},
    image: {type: new GraphQLNonNull(GraphQLString)},
    caption: {type: GraphQLString},
    user: {
      type: new GraphQLNonNull(User),
      resolve: function({user}) {
        for (let i = 0; i < UsersList.length; i += 1) {
          if (UsersList[i].username === user) return UsersList[i];
        }
      }
    },
    comments: {
      type: new GraphQLList(Comment),
      resolve: function({comments}) {
        const output = [];
        for (let i = 0; i < comments.length; i += 1) {
          output.push(CommentsList[comments[i]]);
        }
        return output;
      }
    }
  })
});

// This is the Root Query
const Query = new GraphQLObjectType({
  name: 'InstaSchema',
  description: 'Root of the Instagram Schema',
  fields: () => ({
    posts: {
      type: new GraphQLList(Post),
      resolve: function() {
        return PostsList;
      }
    }
  })
});

// This the Schema
const Schema = new GraphQLSchema({
  query: Query
});

export default Schema;