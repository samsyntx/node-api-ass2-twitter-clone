// Import modules
const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jsonWebToken = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");

// Define Database Path
const databasePath = path.join(__dirname, "twitterClone.db");

// Calling express and define accept format
const app = express();
app.use(express.json());

// Initialization The Database and Server
let database = null;

const initializationDatabaseAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(
      3000,
      console.log("Server is running at: http://localhost:3000/")
    );
  } catch (error) {
    console.log(`Server Error ${error.message}`);
    process.exit(1);
  }
};
initializationDatabaseAndServer();

// API 1
const validatePassword = (password) => {
  return password.length >= 6;
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const queryToGetUsername = `
    SELECT *
    FROM user
    WHERE username = '${username}';`;
  const isUsernameExit = await database.get(queryToGetUsername);

  if (isUsernameExit === undefined) {
    const queryToRegisterUser = `
      INSERT INTO user(name, username, password, gender)
      VALUES ('${name}', '${username}', '${hashedPassword}', '${gender}');`;
    if (validatePassword(password) === true) {
      const resgisterNewUser = await database.run(queryToRegisterUser);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// API 2
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const queryToCheckUsername = `
  SELECT *
  FROM user
  WHERE username = '${username}';`;
  const isUserNameAvailable = await database.get(queryToCheckUsername);
  if (isUserNameAvailable === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      isUserNameAvailable.password
    );
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jsonWebToken.sign(payload, "My_Secret_Key");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Middleware Function for Authentication
const checkValidation = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jsonWebToken.verify(jwtToken, "My_Secret_Key", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// Getting Current User Login
const gettingUserIdWhoIsLogIn = (username) => {
  const queryToGetUserId = `
    SELECT user_id
    FROM user
    WHERE username = '${username}'`;
  const userId = database.get(queryToGetUserId);
  return userId;
};

// API 3
app.get("/user/tweets/feed/", checkValidation, async (request, response) => {
  const { username } = request;
  const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

  const queryToSelectFollowing = `
  SELECT following_user_id
  FROM follower
  WHERE follower_id = '${loggedInUserId.user_id}'`;
  const selectFollowingId = await database.all(queryToSelectFollowing);

  const follwingUserIdArray = selectFollowingId.map(
    (each) => each.following_user_id
  );

  const queryToDisplayTweet = `
  SELECT user.username AS username, tweet.tweet AS tweet, tweet.date_time AS dateTime
  FROM tweet INNER JOIN user ON user.user_id = tweet.user_id
  WHERE tweet.user_id in (${follwingUserIdArray})
  ORDER BY dateTime DESC
  LIMIT 4 ;`;
  const displayingTweet = await database.all(queryToDisplayTweet);
  response.send(displayingTweet);
});

// API 4
app.get("/user/following/", checkValidation, async (request, response) => {
  const { username } = request;
  const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

  const queryToSelectFollowing = `
  SELECT following_user_id
  FROM follower
  WHERE follower_id = '${loggedInUserId.user_id}'`;
  const selectFollowingId = await database.all(queryToSelectFollowing);

  const turningIntoList = selectFollowingId.map(
    (each) => each.following_user_id
  );

  const queryToDisplayName = `
  SELECT name
  FROM user
  WHERE user_id IN (${turningIntoList});`;
  const displayName = await database.all(queryToDisplayName);
  response.send(displayName);
});

// API 5
app.get("/user/followers/", checkValidation, async (request, response) => {
  const { username } = request;
  const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

  const queryToSelectFollower = `
  SELECT follower_user_id
  FROM follower
  WHERE follower_id = '${loggedInUserId.user_id}'`;
  const selectFollowingId = await database.all(queryToSelectFollower);

  const turningIntoList = selectFollowingId.map(
    (each) => each.follower_user_id
  );

  const queryToDisplayNameFollower = `
  SELECT name
  FROM user
  WHERE user_id IN (${turningIntoList});`;
  const displayNameOfFollowers = await database.all(queryToDisplayNameFollower);
  response.send(displayNameOfFollowers);
});

// API 6
app.get("/tweets/:tweetId/", checkValidation, async (request, response) => {
  const { username } = request;
  const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

  const { tweetId } = request.params;

  const queryToGetFollowing = `
  SELECT following_user_id
  FROM follower
  WHERE follower_id = '${loggedInUserId.user_id}';`;
  const gettingFollowingId = await database.all(queryToGetFollowing);

  const FollowingIdTurningIntoList = gettingFollowingId.map(
    (each) => each.following_user_id
  );

  const getTweetIdQuery = `
  SELECT tweet_id
  FROM tweet
  WHERE user_id IN (${FollowingIdTurningIntoList});`;
  const selectTweetId = await database.get(getTweetIdQuery);

  if (selectTweetId.tweet_id === tweetId) {
    const queryToGetTweetCount = `
      SELECT tweet.tweet AS tweet, SUM(like.like_id) AS likes,  SUM(reply.reply_id) AS replies, tweet.date_time AS dateTime
      FROM (tweet JOIN reply ON tweet.tweet_id = reply.tweet_id) AS tweetReply JOIN like ON tweetReply.tweet_id = like.tweet_id
      WHERE tweet.tweet_id = '${tweetId}';`;
    const displayTweet = await database.get(queryToGetTweetCount);
    response.send(displayTweet);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

// API 7
const convertLikedUserNameDBObjectToResponseObject = (dbObject) => {
  return {
    likes: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/likes/",
  checkValidation,
  async (request, response) => {
    const { username } = request;
    const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

    const { tweetId } = request.params;

    const queryToGetFollowing = `
  SELECT following_user_id
  FROM follower
  WHERE follower_id = '${loggedInUserId.user_id}';`;
    const gettingFollowingId = await database.all(queryToGetFollowing);

    const FollowingIdTurningIntoList = gettingFollowingId.map(
      (each) => each.following_user_id
    );

    const getTweetIdQuery = `
  SELECT tweet_id
  FROM tweet
  WHERE user_id IN (${FollowingIdTurningIntoList});`;
    const selectTweetId = await database.get(getTweetIdQuery);

    if (selectTweetId.tweet_id === tweetId) {
      const queryToGetUserWhoLikes = `
        SELECT user.name AS name
        FROM user INNER JOIN like ON user.user_id = like.user_id
        WHERE like.tweet_id = '${tweetId}';`;
      const getWhoLikes = await database.all(queryToGetUserWhoLikes);
      const getLikedUserNames = getWhoLikes.map((eachUser) => eachUser.likes);
      response.send(
        convertLikedUserNameDBObjectToResponseObject(getLikedUserNames)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// API 8
const convertUserNameReplyedDBObjectToResponseObject = (dbObject) => {
  return {
    replies: dbObject,
  };
};

app.get(
  "/tweets/:tweetId/replies/",
  checkValidation,
  async (request, response) => {
    const { username } = request;
    const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

    const { tweetId } = request.params;

    const queryToGetFollowing = `
  SELECT following_user_id
  FROM follower
  WHERE follower_id = '${loggedInUserId.user_id}';`;
    const gettingFollowingId = await database.all(queryToGetFollowing);

    const FollowingIdTurningIntoList = gettingFollowingId.map(
      (each) => each.following_user_id
    );

    const getTweetIdQuery = `
  SELECT tweet_id
  FROM tweet
  WHERE user_id IN (${FollowingIdTurningIntoList});`;
    const selectTweetId = await database.get(getTweetIdQuery);

    if (selectTweetId.tweet_id === tweetId) {
      const queryToGetUserWhoReplies = `
        SELECT user.name AS name, reply.reply AS reply
        FROM user INNER JOIN reply ON user.user_id = reply.user_id
        WHERE reply.tweet_id = '${tweetId}';`;
      const getWhoReply = await database.all(queryToGetUserWhoReplies);
      response.send(
        convertUserNameReplyedDBObjectToResponseObject(getWhoReply)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// API 9
app.get("/user/tweets/", checkValidation, async (request, response) => {
  const { username } = request;
  const loggedInUserId = await gettingUserIdWhoIsLogIn(username);
});

module.exports = app;
