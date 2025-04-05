const express = require('express');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const passportjwt = require('passport-jwt');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = require('../modules/prisma');
const dotenv = require('dotenv');
dotenv.config();

const router = express.Router();

passport.use(
  new LocalStrategy(
    { usernameField: 'uname', passwordField: 'pw' },
    async (username, password, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { uname: username },
        });

        if (!user) {
          return done(null, false, { message: 'Incorrect username' });
        }
        const match = await bcrypt.compare(password, user.pw);
        if (!match) {
          return done(null, false, { message: 'Incorrect password' });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.use(
  new passportjwt.Strategy(
    {
      jwtFromRequest: passportjwt.ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (payload, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.id },
        });
        if (user) {
          return done(null, user);
        } else {
          return done(null, false);
        }
      } catch (err) {
        return done(err, false);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: id },
    });

    done(null, user);
  } catch (err) {
    done(err);
  }
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err || !user) {
      return res.status(400).json({
        message: 'Something is not right',
        user: user,
      });
    }
    req.login(user, { session: false }, (err) => {
      if (err) {
        res.send(err);
      }
      // generate a signed son web token with the contents of user object and return it in the response
      const token = jwt.sign(user, process.env.JWT_SECRET);
      return res.json({ user, token });
    });
  })(req, res);
});

router.post('/signup', async (req, res) => {
  const { uname, pw } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(pw, 10);
    const user = await prisma.user.create({
      data: {
        ...req.body,
        pw: hashedPassword,
      },
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: 'User already exists' });
  }
});

module.exports = router;
