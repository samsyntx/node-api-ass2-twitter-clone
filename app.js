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

  const followingUserIdArray = selectFollowingId.map(
    (each) => each.following_user_id
  );

  const queryToDisplayTweet = `
  SELECT user.username AS username, tweet.tweet AS tweet, tweet.date_time AS dateTime
  FROM 
    follower INNER JOIN tweet
    ON follower.following_user_id = tweet.user_id INNER JOIN user
    ON tweet.user_id = user.user_id
  WHERE follower.follower_user_id = '${loggedInUserId.user_id}'
  ORDER BY tweet.date_time DESC
  LIMIT 4;`;
  const displayingTweet = await database.all(queryToDisplayTweet);
  response.send(displayingTweet);
});
// API 4
app.get("/user/following/", checkValidation, async (request, response) => {
  const { username } = request;
  const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

  const queryToSelectFollower = `
  SELECT following_user_id
  FROM follower
  WHERE follower_user_id = '${loggedInUserId.user_id}'`;
  const selectFollowingId = await database.all(queryToSelectFollower);

  const turningIntoList = selectFollowingId.map(
    (each) => each.following_user_id
  );

  const queryToDisplayNameFollower = ` 
  SELECT name
  FROM user
  WHERE user_id IN (${turningIntoList});`;
  const displayNameOfFollowers = await database.all(queryToDisplayNameFollower);
  response.send(displayNameOfFollowers);
});

// API 5
app.get("/user/followers/", checkValidation, async (request, response) => {
  const { username } = request;
  const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

  const queryToSelectFollowing = `
  SELECT follower_user_id
  FROM follower
  WHERE following_user_id = '${loggedInUserId.user_id}'`;
  const selectFollowingId = await database.all(queryToSelectFollowing);

  const turningIntoList = selectFollowingId.map(
    (each) => each.follower_user_id
  );

  const queryToDisplayName = `
  SELECT name
  FROM user
  WHERE user_id IN (${turningIntoList});`;
  const displayName = await database.all(queryToDisplayName);
  response.send(displayName);
});

// API 6
app.get("/tweets/:tweetId/", checkValidation, async (request, response) => {
  const { username } = request;
  const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

  const { tweetId } = request.params;

  const getTweetIdQuery = `
  SELECT tweet_id
  FROM tweet
  WHERE user_id = (
        SELECT following_user_id
        FROM follower
        WHERE follower_user_id = '${loggedInUserId.user_id}'
  );`;
  const selectTweetId = await database.all(getTweetIdQuery);

  const TweetIdsInList = selectTweetId.map((eachItem) => eachItem.tweet_id);
  const isValidTweetId = TweetIdsInList.includes(parseInt(tweetId));

  if (isValidTweetId === true) {
    const queryToGetTweetCount = `
      SELECT 
        tweet, 
        (SELECT COUNT(like_id)
         FROM like
         WHERE tweet_id = '${tweetId}') AS likes,  
         (SELECT COUNT(reply_id)
          FROM reply
          WHERE tweet_id = '${tweetId}') AS replies, 
        date_time AS dateTime
      FROM 
        tweet
      WHERE tweet_id = '${tweetId}';`;
    const displayTweet = await database.get(queryToGetTweetCount);
    response.send(displayTweet);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

// API 7
app.get(
  "/tweets/:tweetId/likes/",
  checkValidation,
  async (request, response) => {
    const { username } = request;
    const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

    const { tweetId } = request.params;

    const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id=${loggedInUserId.user_id};`;
    const getFollowingIdsArray = await database.all(getFollowingIdsQuery);
    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });

    const getTweetIdQuery = `
  SELECT tweet_id
  FROM tweet
  WHERE user_id IN (${getFollowingIds});`;
    const selectTweetId = await database.all(getTweetIdQuery);

    const tweetIdInList = selectTweetId.map((eachItem) => eachItem.tweet_id);
    const isValidTweetIdRequested = tweetIdInList.includes(parseInt(tweetId));

    if (isValidTweetIdRequested === true) {
      const queryToGetUserWhoLikes = `
        SELECT user.username AS name
        FROM user INNER JOIN like ON user.user_id = like.user_id
        WHERE like.tweet_id = '${tweetId}';`;
      const getWhoLikes = await database.all(queryToGetUserWhoLikes);

      const getLikedUserNames = getWhoLikes.map((eachUser) => eachUser.name);
      response.send({ likes: getLikedUserNames });
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

    const getTweetIdQuery = `
  SELECT tweet_id
  FROM tweet
  WHERE user_id = (
        SELECT following_user_id
        FROM follower
        WHERE follower_user_id = '${loggedInUserId.user_id}'
    );`;
    const selectTweetId = await database.all(getTweetIdQuery);
    const tweetIdInList = selectTweetId.map((eachItem) => eachItem.tweet_id);

    const isRequestTweetIdValid = tweetIdInList.includes(parseInt(tweetId));

    if (isRequestTweetIdValid === true) {
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

  const queryToGetTweetData = `
    SELECT
      tweet AS tweet,
      (SELECT COUNT(like_id)
        FROM like
        WHERE tweet_id = tweet.tweet_id) AS likes,
      (SELECT COUNT(reply_id)
      FROM reply
      WHERE tweet_id = tweet.tweet_id) AS replies,
      date_time AS dateTime
    FROM tweet
    WHERE
      user_id = '${loggedInUserId.user_id}';`;
  const displayTweetData = await database.all(queryToGetTweetData);
  response.send(displayTweetData);
});

// API 10
app.post("/user/tweets/", checkValidation, async (request, response) => {
  const { username } = request;
  const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

  const { tweet } = request.body;

  const currentDateTime = new Date();

  const queryToCreateTweet = `
  INSERT INTO tweet(tweet, user_id, date_time)
  VALUES ('${tweet}', '${loggedInUserId.user_id}', '${currentDateTime}');`;
  await database.run(queryToCreateTweet);
  response.send("Created a Tweet");
});

// API 11
app.delete("/tweets/:tweetId/", checkValidation, async (request, response) => {
  const { username } = request;
  const loggedInUserId = await gettingUserIdWhoIsLogIn(username);

  const { tweetId } = request.params;
  const tweetIdInt = parseInt(tweetId);

  const queryToGetTweetIds = `
  SELECT tweet_id
  FROM tweet 
  WHERE user_id = '${loggedInUserId.user_id}';`;
  const gettingLogInUserTweetId = await database.all(queryToGetTweetIds);

  const creatingList = gettingLogInUserTweetId.map(
    (eachItem) => eachItem.tweet_id
  );

  const isTweetIdValid = creatingList.includes(tweetIdInt);

  if (isTweetIdValid === true) {
    const queryToDeleteTweet = `
      DELETE FROM tweet
      WHERE tweet_id = '${tweetId}';`;
    await database.run(queryToDeleteTweet);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
