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

// API 3
app.get("/user/tweets/feed/", checkValidation, async (request, response) => {});
