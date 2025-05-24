const express = require("express");
const cors = require("cors");
const passport = require("passport");
const { Server } = require("socket.io");
const { createServer } = require("node:http");
const prisma = require("./modules/prisma");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const port = 3000;
const httpServer = createServer(app);

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const authRouter = require("./routes/auth");
const { time } = require("node:console");
app.use("/auth", authRouter);

app.get("/", (req, res) => {
  res.send(req.user);
});

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.engine.use((req, res, next) => {
  const isHandshake = req._query.sid === undefined;
  if (isHandshake) {
    passport.authenticate("jwt", { session: false })(req, res, next);
  } else {
    next();
  }
});

io.on("connection", async (socket) => {
  await prisma.user
    .update({
      where: { id: socket.request.user.id },
      data: { socketId: socket.id, lastSeen: null },
    })
    .then((socket.request.user.socketId = socket.id))
    .catch((err) => {
      console.log(err);
    });

  try {
    const user = await prisma.user.findUnique({
      where: { id: socket.request.user.id },
      omit: {
        pw: true,
      },
      include: {
        chats: {
          include: {
            chat: {
              include: {
                users: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        uname: true,
                        img: true,
                        lastSeen: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      console.error("User not found");
      return;
    }

    const chats = user.chats.map((item) => {
      if (item.chat.isGroup) {
        return {
          name: item.chat.name,
          id: item.chat.id,
          img: item.chat.img,
          isGroup: item.chat.isGroup,
        };
      } else {
        const otheruser = item.chat.users.find(
          (user) => user.user.id !== socket.request.user.id
        );
        return {
          name: otheruser.user.uname,
          id: item.chat.id,
          img: otheruser.user.img,
          isGroup: item.chat.isGroup,
          lastSeen: otheruser.user.lastSeen,
        };
      }
    });

    socket.emit("initData", chats);
  } catch (error) {
    console.error(error);
  }

  socket.on("getChat", async (chatid) => {
    try {
      const chat = await prisma.chat.findUnique({
        where: { id: parseInt(chatid) },
        include: {
          messages: {
            include: {
              sender: {
                select: { id: true, uname: true, img: true },
              },
            },
          },
          users: {
            include: {
              user: {
                select: { id: true, uname: true, img: true, lastSeen: true },
              },
            },
          },
        },
      });

      chat.messages.map((message) => {
        message.sender.uname === socket.request.user.uname &&
          (message.sender = true);
      });

      if (!chat.isGroup) {
        const otheruser = chat.users.find(
          (user) => user.user.id !== socket.request.user.id
        );
        chat.name = otheruser.user.uname;
        chat.img = otheruser.user.img;
        chat.lastSeen = otheruser.user.lastSeen;
      }

      if (!chat) {
        console.error("Chat not found");
        return;
      }

      socket.emit("getChat", chat);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("getChatUsers", async (chatid) => {
    try {
      const chatUsers = await prisma.chatUser.findMany({
        where: { chatId: parseInt(chatid) },
        include: {
          user: {
            select: { id: true, uname: true, img: true, lastSeen: true },
          },
        },
      });

      if (!chatUsers) {
        console.error("Chat users not found");
        return;
      }

      socket.emit("getChatUsers", chatUsers);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("getUsers", async () => {
    try {
      const users = await prisma.user.findMany({
        omit: {
          pw: true,
          socketId: true,
        },
      });

      if (!users) {
        console.error("users not found");
        return;
      }

      socket.emit("getUsers", users);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("sendMessage", async (data) => {
    try {
      const message = await prisma.message.create({
        data: {
          text: data.text,
          chatId: parseInt(data.chatId),
          senderId: socket.request.user.id,
        },
        include: {
          sender: {
            select: { id: true, uname: true, img: true },
          },
        },
      });

      if (!message) {
        console.error("Message not created");
        return;
      }

      prisma.chatUser
        .findMany({
          where: { chatId: parseInt(data.chatId) },
          include: {
            user: {
              select: { socketId: true },
            },
          },
        })
        .then((chat) => {
          chat.forEach((chatUser) => {
            if (
              chatUser.user.socketId &&
              chatUser.user.socketId !== socket.id
            ) {
              io.to(chatUser.user.socketId).emit("newMessage", message);
            }
          });
          socket.emit("sendMessage", message);
        });
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("newChat", async (data) => {
    try {
      const chat = await prisma.chat.create({
        data: {
          name: data.name,
          users: {
            create: data.users.map((userId) => ({
              userId: parseInt(userId),
            })),
          },
          isGroup: data.users.length > 2,
        },
      });

      if (!chat) {
        console.error("Chat not created");
        return;
      }

      socket.emit("newChat", chat);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("saveChanges", async (data) => {
    try {
      const user = await prisma.user.update({
        where: { id: socket.request.user.id },
        data: data,
      });

      if (!user) {
        console.log("update un succsessful");
        return;
      }

      socket.emit("saveChanges", user);
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("disconnect", async () => {
    console.log("user disconnected");
    await prisma.user
      .update({
        where: { id: socket.request.user.id },
        data: { socketId: null, lastSeen: new Date().toISOString() },
      })
      .then((socket.request.user.socketId = null))
      .catch((err) => {
        console.log(err);
      });
  });
});

httpServer.listen(port, () => {
  console.log(`application is running at: http://localhost:${port}`);
});
