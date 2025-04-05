const express = require('express');
const cors = require('cors');
const passport = require('passport');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const authRouter = require('./routes/auth');
app.use('/auth', authRouter);

app.get('/', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.send(req.user);
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
