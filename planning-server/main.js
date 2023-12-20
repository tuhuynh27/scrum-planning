const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allowing all HTTP methods
    allowedHeaders: ['*'], // Allowing all headers
    credentials: true // Allow credentials (if used)
  }
});

const calcAvg = (users) => {
  let sum = 0;
  let count = 0;
  Object.keys(users).forEach((user) => {
    if (users[user] > 0) {
      sum += users[user];
      count++;
    }
  });
  const average = sum / count;
  return average.toFixed(2);
}

const users = {
};
const gameContext = {
  state: 'voting', // 'voting', 'ending',
  ticket: ''
}

app.use(cors());

app.get('/users', (req, res) => {
  res.json(users);
});

app.get('/context', (req, res) => {
  res.json(gameContext);
})

app.post('/vote', express.json(), (req, res) => {
  const { username, vote } = req.body;
  if (users[username] === null || users[username] === undefined || isNaN(vote) || vote < 1 || vote > 5) {
    return res.status(400).json({ error: 'Invalid username or vote value' });
  }

  users[username] = vote;
  io.emit('newVote', { username, vote }); // Broadcast new vote to all users
  return res.status(200).json({ message: 'Vote received and saved successfully' });
});

app.post('/ticket', express.json(), (req, res) => {
  const { username, ticket } = req.body;
  if (username !== 'master') {
    return res.status(403).json({ error: 'Only "master" can change the ticket' });
  }

  gameContext.ticket = ticket;
  io.emit('gameContext', gameContext);

  return res.status(200).json({ message: 'Ticket updated' });
});

app.post('/start', express.json(), (req, res) => {
  const { username } = req.body;
  if (username !== 'master') {
    return res.status(403).json({ error: 'Only "master" can start a round' });
  }

  const roundInProgress = gameContext.state === 'voting'
  if (!roundInProgress) {
    gameContext.state = 'voting'
    for (let key in users) {
      users[key] = 0;
    }
    io.emit('gameContext', gameContext);
    io.emit('signal', { state: 'start' });
    io.emit('reset', users);
    return res.status(200).json({ message: 'New round started' });
  } else {
    return res.status(400).json({ error: 'Round is already in progress' });
  }
});

app.post('/end', express.json(), (req, res) => {
  const { username } = req.body;
  if (username !== 'master') {
    return res.status(403).json({ error: 'Only "master" can end a round' });
  }

  const roundInProgress = gameContext.state === 'voting'
  if (roundInProgress) {
    gameContext.state = 'ending'
    io.emit('gameContext', gameContext);
    io.emit('signal', { state: 'end', data: calcAvg(users) });
    return res.status(200).json({ message: 'Round ended' });
  } else {
    return res.status(400).json({ error: 'No round is currently in progress' });
  }
});

io.use((socket, next) => {
  const username = socket.handshake.query.username;
  if (username) {
    if (users[username]) {
      next(new Error('Authentication error: Username already existed'));
      return;
    }
    socket.username = username;
    users[username] = 0;
    io.emit('userJoined', username);
    console.log('A user connected: ', socket.username);
    next();
  } else {
    next(new Error('Authentication error: No token provided'));
  }
});

// Listen for client connections
io.on('connection', (socket) => {
  // Handle disconnection of clients
  socket.on('disconnect', () => {
    if (socket.username && users[socket.username] !== null) {
      delete users[socket.username];
      io.emit('userDisconnected', socket.username);
      console.log('A user disconnected: ', socket.username);
    }
  });
});

const port = process.env.PORT || 8686;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
