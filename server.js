var express = require("express");
var app = express();
// const dotenv = require("dotenv");
// dotenv.config("./config.env");
var formidable = require("express-formidable");
app.use(formidable());

var mongodb = require("mongodb");
var mongoClient = mongodb.MongoClient;
var ObjectId = mongodb.ObjectId;

var http = require("http").createServer(app);
var bcrypt = require("bcrypt");
var fileSystem = require("fs");

var jwt = require("jsonwebtoken");
const { request } = require("http");
var accessTokenSecret = "myAccessTokenSecret1234567890";

app.use("/public", express.static(__dirname + "/public"));
app.set("view engine", "ejs");

var socketIO = require("socket.io")(http);
var socketID = "";
var users = [];

var mainURL = "";
const port = process.env.PORT || 3000;
var dbURL = "";

if (process.env.MONGODB_URI) {
  dbURL = process.env.MONGODB_URI;
  mainURL = "https://dbms-mini-project.herokuapp.com";
  console.log("connecting mongodb atlas");
} else {
  dbURL = "mongodb://localhost:27017/my_social_network";
  mainURL = "http://localhost:3000";
  console.log("connecting to mongodb local");
}

//server

http.listen(port, function () {
  console.log("Server started at " + mainURL);

  mongoClient.connect(
    dbURL,
    { useNewUrlParser: true, useUnifiedTopology: true },
    function (error, client) {
      if (error) console.log(error);
      var database = client.db("my_social_network");
      console.log("Database connected.");

      app.get("/profileViews", function (request, result) {
        result.render("profileViews");
      });

      app.get("/signup", function (request, result) {
        result.render("signup");
      });

      app.post("/signup", function (request, result) {
        var name = request.fields.name;
        var username = request.fields.username;
        var email = request.fields.email;
        var password = request.fields.password;
        var gender = request.fields.gender;
        var reset_token = "";

        database.collection("users").findOne(
          {
            $or: [
              {
                email: email,
              },
              {
                username: username,
              },
            ],
          },
          function (error, user) {
            if (user == null) {
              bcrypt.hash(password, 10, function (error, hash) {
                database.collection("users").insertOne(
                  {
                    name: name,
                    username: username,
                    email: email,
                    password: hash,
                    gender: gender,
                    reset_token: reset_token,
                    profileImage: "",
                    coverPhoto: "",
                    dob: "",
                    city: "",
                    country: "",
                    aboutMe: "",

                    notifications: [],
                  },
                  function (error, data) {
                    result.json({
                      status: "success",
                      message: "Signed up successfully. You can login now.",
                    });
                  }
                );
              });
            } else {
              result.json({
                status: "error",
                message: "Email or username already exist.",
              });
            }
          }
        );
      });

      app.get("/login", function (request, result) {
        result.render("login");
      });

      app.post("/login", function (request, result) {
        var email = request.fields.email;
        var password = request.fields.password;
        database.collection("users").findOne(
          {
            email: email,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "Email does not exist",
              });
            } else {
              bcrypt.compare(
                password,
                user.password,
                function (error, isVerify) {
                  if (isVerify) {
                    var accessToken = jwt.sign(
                      { email: email },
                      accessTokenSecret
                    );
                    database.collection("users").findOneAndUpdate(
                      {
                        email: email,
                      },
                      {
                        $set: {
                          accessToken: accessToken,
                        },
                      },
                      function (error, data) {
                        result.json({
                          status: "success",
                          message: "Login successfully",
                          accessToken: accessToken,
                          profileImage: user.profileImage,
                        });
                      }
                    );
                  } else {
                    result.json({
                      status: "error",
                      message: "Password is not correct",
                    });
                  }
                }
              );
            }
          }
        );
      });

      app.get("/user/:username", function (request, result) {
        database.collection("users").findOne(
          {
            username: request.params.username,
          },
          function (error, user) {
            if (user == null) {
              result.send({
                status: "error",
                message: "User does not exists",
              });
            } else {
              result.render("userProfile", {
                user: user,
              });
            }
          }
        );
      });

      app.get("/updateProfile", function (request, result) {
        result.render("updateProfile");
      });

      app.post("/getUser", function (request, result) {
        var accessToken = request.fields.accessToken;
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              result.json({
                status: "success",
                message: "Record has been fetched.",
                data: user,
              });
            }
          }
        );
      });

      app.get("/logout", function (request, result) {
        result.redirect("/login");
      });

      app.post("/uploadCoverPhoto", function (request, result) {
        var accessToken = request.fields.accessToken;
        var coverPhoto = "";

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.coverPhoto.size > 0 &&
                request.files.coverPhoto.type.includes("image")
              ) {
                if (user.coverPhoto != "") {
                  fileSystem.unlink(user.coverPhoto, function (error) {
                    //
                  });
                }

                coverPhoto =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.coverPhoto.name;

                // Read the file
                fileSystem.readFile(
                  request.files.coverPhoto.path,
                  function (err, data) {
                    if (err) throw err;
                    console.log("File read!");

                    // Write the file
                    fileSystem.writeFile(coverPhoto, data, function (err) {
                      if (err) throw err;
                      console.log("File written!");

                      database.collection("users").updateOne(
                        {
                          accessToken: accessToken,
                        },
                        {
                          $set: {
                            coverPhoto: coverPhoto,
                          },
                        },
                        function (error, data) {
                          result.json({
                            status: "status",
                            message: "Cover photo has been updated.",
                            data: mainURL + "/" + coverPhoto,
                          });
                        }
                      );
                    });

                    // Delete the file
                    fileSystem.unlink(
                      request.files.coverPhoto.path,
                      function (err) {
                        if (err) throw err;
                        console.log("File deleted!");
                      }
                    );
                  }
                );
              } else {
                result.json({
                  status: "error",
                  message: "Please select valid image.",
                });
              }
            }
          }
        );
      });

      app.post("/uploadProfileImage", function (request, result) {
        var accessToken = request.fields.accessToken;
        var profileImage = "";

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.profileImage.size > 0 &&
                request.files.profileImage.type.includes("image")
              ) {
                if (user.profileImage != "") {
                  fileSystem.unlink(user.profileImage, function (error) {
                    //
                  });
                }
                var oldImage = user.profileImage;
                profileImage =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.profileImage.name;

                // Read the file
                fileSystem.readFile(
                  request.files.profileImage.path,
                  function (err, data) {
                    if (err) throw err;
                    console.log("File read!");

                    // Write the file
                    fileSystem.writeFile(profileImage, data, function (err) {
                      if (err) throw err;
                      console.log("File written!");

                      database.collection("users").updateOne(
                        {
                          accessToken: accessToken,
                        },
                        {
                          $set: {
                            profileImage: profileImage,
                          },
                        },
                        function (error, data) {
                          database
                            .collection("users")
                            .findOne(
                              { accessToken: accessToken },
                              (err, data) => {
                                // console.log(data);
                                if (!err) {
                                  // console.log(data.name);
                                  database.collection("posts").updateMany(
                                    {
                                      "user._id": ObjectId(data._id),
                                    },
                                    {
                                      $set: {
                                        "user.profileImage": data.profileImage,
                                      },
                                    },
                                    function (err, dat) {
                                      if (err) console.log("user profile err");
                                    }
                                  );
                                }
                              }
                            ); // Delete the file
                          fileSystem.unlink(
                            request.files.profileImage.path,
                            function (err) {
                              if (err) throw err;
                              console.log("File deleted!");
                            }
                          );
                          result.json({
                            status: "status",
                            message: "Profile image has been updated.",
                            data: mainURL + "/" + profileImage,
                          });
                        }
                      );
                    });
                  }
                );
              } else {
                result.json({
                  status: "error",
                  message: "Please select valid image.",
                });
              }
            }
          }
        );
      });

      app.post("/updateProfile", function (request, result) {
        var accessToken = request.fields.accessToken;
        var name = request.fields.name;
        var dob = request.fields.dob;
        var city = request.fields.city;
        var country = request.fields.country;
        var aboutMe = request.fields.aboutMe;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("users").updateOne(
                {
                  accessToken: accessToken,
                },
                {
                  $set: {
                    name: name,
                    dob: dob,
                    city: city,
                    country: country,
                    aboutMe: aboutMe,
                  },
                },
                function (error, data) {
                  result.json({
                    status: "status",
                    message: "Profile has been updated.",
                  });
                }
              );
            }
          }
        );
      });

      app.get("/post/:id", function (request, result) {
        database.collection("posts").findOne(
          {
            _id: ObjectId(request.params.id),
          },
          function (error, post) {
            if (post == null) {
              result.send({
                status: "error",
                message: "Post does not exist.",
              });
            } else {
              result.render("postDetail", {
                post: post,
              });
            }
          }
        );
      });

      app.get("/", function (request, result) {
        result.render("index");
      });

      app.post("/addPost", function (request, result) {
        var accessToken = request.fields.accessToken;
        var caption = request.fields.caption;
        var image = "";

        var type = request.fields.type;
        var createdAt = new Date().getTime();
        var _id = request.fields._id;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              if (
                request.files.image.size > 0 &&
                request.files.image.type.includes("image")
              ) {
                image =
                  "public/images/" +
                  new Date().getTime() +
                  "-" +
                  request.files.image.name;

                // Read the file
                fileSystem.readFile(
                  request.files.image.path,
                  function (err, data) {
                    if (err) throw err;
                    console.log("File read!");

                    // Write the file
                    fileSystem.writeFile(image, data, function (err) {
                      if (err) throw err;
                      console.log("File written!");
                    });

                    // Delete the file
                    fileSystem.unlink(request.files.image.path, function (err) {
                      if (err) throw err;
                      console.log("File deleted!");
                    });
                  }
                );
              }

              database.collection("posts").insertOne(
                {
                  caption: caption,
                  image: image,
                  type: type,
                  createdAt: createdAt,
                  likers: [],

                  user: {
                    _id: user._id,
                    name: user.name,
                    username: user.username,
                    profileImage: user.profileImage,
                  },
                },
                function (error, data) {
                  // database.collection("users").updateOne(
                  //   {
                  //     accessToken: accessToken,
                  //   },
                  //   {
                  //     $push: {
                  //       posts: {
                  //         _id: data.insertedId,
                  //         caption: caption,
                  //         image: image,

                  //         type: type,
                  //         createdAt: createdAt,
                  //         likers: [],
                  //         comments: [],
                  //       },
                  //     },
                  //   },
                  //   function (error, data) {}
                  // );
                  result.json({
                    status: "success",
                    message: "Post has been uploaded.",
                  });
                }
              );
            }
          }
        );
      });

      app.post("/getNewsfeed", function (request, result) {
        var accessToken = request.fields.accessToken;
        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database
                .collection("friendsList")
                .findOne({ user_id: user._id }, (e, fnds) => {
                  if (e) console.log("error at friendsList");

                  var ids = [];
                  ids.push(user._id);

                  for (var j = 0; j < fnds.friends.length; j++) {
                    if (fnds.friends[j].status === "Accepted")
                      ids.push(fnds.friends[j].f_id);
                  }

                  database
                    .collection("posts")
                    .find({
                      "user._id": {
                        $in: ids,
                      },
                    })
                    .sort({
                      createdAt: -1,
                    })
                    .limit(5)
                    .toArray(function (error, data) {
                      var postIds = [];
                      for (var i = 0; i < data.length; i++) {
                        postIds.push(data[i]._id.toString());
                      }

                      database
                        .collection("comment")
                        .find({
                          post_id: {
                            $in: postIds,
                          },
                        })
                        .toArray((e, comment) => {
                          // console.log(comment, data);
                          if (e) console.log("getnewFeed er", e);
                          result.json({
                            status: "success",
                            message: "Record has been fetched",
                            data: data,
                            comments: comment,
                          });
                        });
                    });
                });
            }
          }
        );
      });

      app.post("/toggleLikePost", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("posts").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, post) {
                  if (post == null) {
                    result.json({
                      status: "error",
                      message: "Post does not exist.",
                    });
                  } else {
                    var isLiked = false;
                    for (var a = 0; a < post.likers.length; a++) {
                      var liker = post.likers[a];

                      if (liker._id.toString() == user._id.toString()) {
                        isLiked = true;
                        break;
                      }
                    }

                    if (isLiked) {
                      database.collection("posts").updateOne(
                        {
                          _id: ObjectId(_id),
                        },
                        {
                          $pull: {
                            likers: {
                              _id: user._id,
                            },
                          },
                        },
                        function (error, data) {
                          database.collection("users").updateOne(
                            {
                              $and: [
                                {
                                  _id: post.user._id,
                                },
                                {
                                  "posts._id": post._id,
                                },
                              ],
                            },
                            {
                              $pull: {
                                "posts.$[].likers": {
                                  _id: user._id,
                                },
                              },
                            }
                          );

                          result.json({
                            status: "unliked",
                            message: "Post has been unliked.",
                          });
                        }
                      );
                    } else {
                      database.collection("users").updateOne(
                        {
                          _id: post.user._id,
                        },
                        {
                          $push: {
                            notifications: {
                              _id: ObjectId(),
                              type: "photo_liked",
                              content: user.name + " has liked your post.",
                              profileImage: user.profileImage,
                              isRead: false,
                              post: {
                                _id: post._id,
                              },
                              createdAt: new Date().getTime(),
                            },
                          },
                        }
                      );

                      database.collection("posts").updateOne(
                        {
                          _id: ObjectId(_id),
                        },
                        {
                          $push: {
                            likers: {
                              _id: user._id,
                              name: user.name,
                              profileImage: user.profileImage,
                            },
                          },
                        },
                        function (error, data) {
                          database.collection("users").updateOne(
                            {
                              $and: [
                                {
                                  _id: post.user._id,
                                },
                                {
                                  "posts._id": post._id,
                                },
                              ],
                            },
                            {
                              $push: {
                                "posts.$[].likers": {
                                  _id: user._id,
                                  name: user.name,
                                  profileImage: user.profileImage,
                                },
                              },
                            }
                          );

                          result.json({
                            status: "success",
                            message: "Post has been liked.",
                          });
                        }
                      );
                    }
                  }
                }
              );
            }
          }
        );
      });

      app.post("/postComment", function (request, result) {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        var comment = request.fields.comment;
        var createdAt = new Date().getTime();

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("posts").findOne(
                {
                  _id: ObjectId(_id),
                },
                function (error, post) {
                  if (post == null) {
                    result.json({
                      status: "error",
                      message: "Post does not exist.",
                    });
                  } else {
                    var commentId = ObjectId();

                    database.collection("comment").findOne(
                      {
                        post_id: _id,
                      },
                      (err, data) => {
                        if (data == null) {
                          database.collection("comment").insertOne(
                            {
                              post_id: _id,
                              comments: [
                                {
                                  user: {
                                    _id: user._id,
                                    name: user.name,
                                    profileImage: user.profileImage,
                                  },
                                  comment: comment,
                                  createdAt: createdAt,
                                },
                              ],
                            },
                            (e, d) => {
                              if (e) console.log("error on commenting");
                              if (
                                user._id.toString() != post.user._id.toString()
                              ) {
                                database.collection("users").updateOne(
                                  {
                                    _id: post.user._id,
                                  },
                                  {
                                    $push: {
                                      notifications: {
                                        _id: ObjectId(),
                                        type: "new_comment",
                                        content:
                                          user.name +
                                          " commented on your post.",
                                        profileImage: user.profileImage,
                                        post: {
                                          _id: post._id,
                                        },
                                        isRead: false,
                                        createdAt: new Date().getTime(),
                                      },
                                    },
                                  }
                                );
                              }
                              database.collection("posts").findOne(
                                {
                                  _id: ObjectId(_id),
                                },
                                function (error, updatePost) {
                                  database
                                    .collection("comment")
                                    .findOne({ post_id: _id }, (err, data) => {
                                      if (err) console.log("comment not found");

                                      result.json({
                                        status: "success",
                                        message: "Comment has been posted.",
                                        updatePost: updatePost,
                                        comments: data.comments,
                                      });
                                    });
                                }
                              );
                            }
                          );
                        } else {
                          database.collection("comment").updateOne(
                            {
                              post_id: _id,
                            },
                            {
                              $push: {
                                comments: {
                                  user: {
                                    _id: user._id,
                                    name: user.name,
                                    profileImage: user.profileImage,
                                  },
                                  comment: comment,
                                  createdAt: createdAt,
                                },
                              },
                            },
                            (err, dat) => {
                              if (err) console.log("comment error", err);
                              if (
                                user._id.toString() != post.user._id.toString()
                              ) {
                                database.collection("users").updateOne(
                                  {
                                    _id: post.user._id,
                                  },
                                  {
                                    $push: {
                                      notifications: {
                                        _id: ObjectId(),
                                        type: "new_comment",
                                        content:
                                          user.name +
                                          " commented on your post.",
                                        profileImage: user.profileImage,
                                        post: {
                                          _id: post._id,
                                        },
                                        isRead: false,
                                        createdAt: new Date().getTime(),
                                      },
                                    },
                                  }
                                );
                              }
                              database.collection("posts").findOne(
                                {
                                  _id: ObjectId(_id),
                                },
                                function (error, updatePost) {
                                  database
                                    .collection("comment")
                                    .findOne({ post_id: _id }, (err, data) => {
                                      if (err) console.log("comment not found");

                                      result.json({
                                        status: "success",
                                        message: "Comment has been posted.",
                                        updatePost: updatePost,
                                        comments: data.comments,
                                      });
                                    });
                                }
                              );
                            }
                          );
                        }
                      }
                    );

                    // database.collection("posts").updateOne(
                    //   {
                    //     _id: ObjectId(_id),
                    //   },
                    //   {
                    //     $push: {
                    //       comments: {
                    //       _id: commentId,
                    //       user: {
                    //         _id: user._id,
                    //         name: user.name,
                    //         profileImage: user.profileImage,
                    //       },
                    //       comment: comment,
                    //       createdAt: createdAt,
                    //       replies: [],
                    //     },
                    //   },
                    // },
                    // function (error, data) {
                    //   if (user._id.toString() != post.user._id.toString()) {
                    //     database.collection("users").updateOne(
                    //       {
                    //         _id: post.user._id,
                    //       },
                    //       {
                    //         $push: {
                    //           notifications: {
                    //             _id: ObjectId(),
                    //             type: "new_comment",
                    //             content:
                    //               user.name + " commented on your post.",
                    //             profileImage: user.profileImage,
                    //             post: {
                    //               _id: post._id,
                    //             },
                    //             isRead: false,
                    //             createdAt: new Date().getTime(),
                    //           },
                    //         },
                    //       }
                    //     );
                    //   }

                    // database.collection("users").updateOne(
                    //   {
                    //     $and: [
                    //       {
                    //         _id: post.user._id,
                    //       },
                    //       {
                    //         "posts._id": post._id,
                    //       },
                    //     ],
                    //   },
                    //   {
                    // $push: {
                    //       "posts.$[].comments": {
                    //         _id: commentId,
                    //         user: {
                    //           _id: user._id,
                    //           name: user.name,
                    //           profileImage: user.profileImage,
                    //         },
                    //         comment: comment,
                    //         createdAt: createdAt,
                    //         replies: [],
                    //       },
                    //     },
                    //   }
                    // );

                    // database.collection("posts").findOne(
                    //   {
                    //     _id: ObjectId(_id),
                    //   },
                    //   function (error, updatePost) {
                    //     result.json({
                    //       status: "success",
                    //       message: "Comment has been posted.",
                    //       updatePost: updatePost,
                    //     });
                    //   }
                    // );
                    //   }
                    // );
                  }
                }
              );
            }
          }
        );
      });

      app.get("/search/:query", function (request, result) {
        var query = request.params.query;
        result.render("search", {
          query: query,
        });
      });

      app.post("/search", function (request, result) {
        var query = request.fields.query;
        var accessToken = request.fields.accessToken;

        database
          .collection("users")
          .findOne({ accessToken: accessToken }, (e, user) => {
            if (user == null) {
              console.log("no user found in search query");
            } else {
              database
                .collection("users")
                .find({
                  name: {
                    $regex: ".*" + query + ".*",
                    $options: "i",
                  },
                })
                .toArray(function (error, data) {
                  database
                    .collection("friendsList")
                    .findOne({ user_id: user._id }, (e, d) => {
                      if (e) {
                        console.log("error at search query");
                        result.json({
                          status: "error",
                          message: "failed fetcing comment",
                        });
                      } else {
                        result.json({
                          status: "success",
                          message: "Record has been fetched",
                          data: data,
                          friends: d ? d.friends : [],
                        });
                      }
                    });
                });
            }
          });
      });
      app.post("/sendFriendRequest", (request, result) => {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        // console.log("senttt");

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (err, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. please log in again. ",
              });
            } else {
              var me = user;
              database
                .collection("users")
                .findOne({ _id: ObjectId(_id) }, function (error, user) {
                  if (user == null) {
                    result.json({
                      status: "error",
                      message: "user does not exist",
                    });
                  } else {
                    database
                      .collection("friendsList")
                      .findOne({ user_id: me._id }, (e, data) => {
                        if (data == null) {
                          database.collection("friendsList").insertOne(
                            {
                              user_id: me._id,
                              friends: [
                                {
                                  f_id: user._id,
                                  name: user.name,
                                  profileImage: user.profileImage,
                                  status: "Pending",
                                  sentByMe: true,
                                },
                              ],
                            },
                            (e, d) => {
                              if (e) console.log("eror at friends list");
                            }
                          );
                        } else {
                          database.collection("friendsList").updateOne(
                            { user_id: me._id },
                            {
                              $push: {
                                friends: {
                                  f_id: user._id,
                                  name: user.name,
                                  profileImage: user.profileImage,
                                  status: "Pending",
                                  sentByMe: true,
                                },
                              },
                            },
                            (e, d) => {
                              if (e) console.log("error at friendlist ");
                            }
                          );
                        }
                        database
                          .collection("friendsList")
                          .findOne({ user_id: user._id }, (e, data) => {
                            if (data == null) {
                              database.collection("friendsList").insertOne(
                                {
                                  user_id: user._id,
                                  friends: [
                                    {
                                      f_id: me._id,
                                      name: me.name,
                                      profileImage: me.profileImage,
                                      status: "Pending",
                                      sentByMe: false,
                                    },
                                  ],
                                },
                                (e, d) => {
                                  if (e) console.log("eor at friendlist");
                                  result.json({
                                    status: "success",
                                    message: "Friend request sent .",
                                  });
                                }
                              );
                            } else {
                              database.collection("friendsList").updateOne(
                                { user_id: user._id },
                                {
                                  $push: {
                                    friends: {
                                      f_id: me._id,
                                      name: me.name,
                                      profileImage: me.profileImage,
                                      status: "Pending",
                                      sentByMe: false,
                                    },
                                  },
                                },
                                (e, d) => {
                                  if (e) console.log("eror at friendslist");
                                  result.json({
                                    status: "success",
                                    message: "Friend request sent .",
                                  });
                                }
                              );
                            }
                          });
                      });
                  }
                });
            }
          }
        );
      });
      app.get("/friends", function (request, result) {
        result.render("friends");
      });

      app.post("/getFriends", (request, result) => {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        database
          .collection("users")
          .findOne({ accessToken: accessToken }, (e, user) => {
            if (user == null) {
              result.json({
                status: "error",
                message: "user has been logged out .please login again",
              });
            } else {
              database.collection("users").findOne(
                {
                  _id: ObjectId(_id),
                },
                (error, user) => {
                  if (user == null) {
                    result.json({
                      status: "error",
                      message: "user does not exist",
                    });
                  } else {
                    database
                      .collection("friendsList")
                      .findOne({ user_id: user._id }, (e, fds) => {
                        if (e) console.log("error getting friends list");
                        result.json({
                          status: "success",
                          message: "friends fetched ",
                          fnds: fds.friends,
                        });
                      });
                  }
                }
              );
            }
          });
      });

      app.post("/acceptFriendRequest", (request, result) => {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;
        database
          .collection("users")
          .findOne({ accessToken: accessToken }, (error, user) => {
            if (user == null) {
              result.json({
                status: "error",
                message: "user has been logged out .please login again",
              });
            } else {
              var me = user;
              database.collection("users").findOne(
                {
                  _id: ObjectId(_id),
                },
                (error, user) => {
                  if (user == null) {
                    result.json({
                      status: "error",
                      message: "user does not exist",
                    });
                  } else {
                    database.collection("users").updateOne(
                      { _id: ObjectId(_id) },
                      {
                        $push: {
                          notifications: {
                            _id: ObjectId(),
                            type: "friend_request_accepted",
                            content: me.name + "accepted your request .",
                            profileImage: me.profileImage,
                            createdAt: new Date().getTime(),
                          },
                        },
                      }
                    );

                    database.collection("friendsList").updateOne(
                      {
                        $and: [
                          { user_id: user._id },
                          { "friends.f_id": me._id },
                        ],
                      },
                      {
                        $set: {
                          "friends.$.status": "Accepted",
                        },
                      },
                      function (error, data) {
                        database.collection("friendsList").updateOne(
                          {
                            $and: [
                              { user_id: me._id },
                              { "friends.f_id": user._id },
                            ],
                          },
                          {
                            $set: {
                              "friends.$.status": "Accepted",
                            },
                          },
                          function (error, data) {
                            result.json({
                              status: "success",
                              message: "Friend Request has been accepted .",
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          });
      });

      app.post("/unfriend", (request, result) => {
        var accessToken = request.fields.accessToken;
        var _id = request.fields._id;

        database
          .collection("users")
          .findOne({ accessToken: accessToken }, (error, user) => {
            if (user == null) {
              result.json({
                status: "error",
                message: "user has been logged out. please log in again",
              });
            } else {
              var me = user;

              database.collection("users").findOne(
                {
                  _id: ObjectId(_id),
                },
                (error, user) => {
                  if (error) console.log("error at unfriending");

                  if (user == null) {
                    result.json({
                      status: "error",
                      message: "user does not exist",
                    });
                  } else {
                    database.collection("friendsList").updateOne(
                      { user_id: user._id },
                      {
                        $pull: {
                          friends: {
                            f_id: me._id,
                          },
                        },
                      },
                      (error, data) => {
                        database.collection("friendsList").updateOne(
                          {
                            user_id: me._id,
                          },
                          {
                            $pull: {
                              friends: {
                                f_id: user._id,
                              },
                            },
                          },
                          (error, data) => {
                            result.json({
                              status: "success",
                              message: "friend has been removed. ",
                            });
                          }
                        );
                      }
                    );
                  }
                }
              );
            }
          });
      });

      app.get("/notifications", function (request, result) {
        result.render("notifications");
      });

      app.post("/markNotificationsAsRead", function (request, result) {
        var accessToken = request.fields.accessToken;

        database.collection("users").findOne(
          {
            accessToken: accessToken,
          },
          function (error, user) {
            if (user == null) {
              result.json({
                status: "error",
                message: "User has been logged out. Please login again.",
              });
            } else {
              database.collection("users").updateMany(
                {
                  $and: [
                    {
                      accessToken: accessToken,
                    },
                    {
                      "notifications.isRead": false,
                    },
                  ],
                },
                {
                  $set: {
                    "notifications.$.isRead": true,
                  },
                },
                function (error, data) {
                  result.json({
                    status: "success",
                    message: "Notifications has been marked as read.",
                  });
                }
              );
            }
          }
        );
      });
    }
  );
});
