const express = require('express')
const http = require('http')
const socketIO = require('socket.io')
const cors = require('cors')

const app = express()
const server = http.createServer(app)

const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['*'],
    credentials: true,
  },
})

const calcAvg = (users) => {
  let sum = 0
  let count = 0
  Object.keys(users).forEach((user) => {
    if (users[user] > 0) {
      sum += users[user]
      count++
    }
  })
  const average = sum / count
  return average.toFixed(2)
}

const rooms = {}

app.use(cors())

app.get('/users', (req, res) => {
  const roomId = req.query.roomId
  if (!roomId || !rooms[roomId]) {
    return res.status(400).json({error: 'Invalid room ID'})
  }

  res.json(rooms[roomId].users)
})

app.get('/context', (req, res) => {
  const roomId = req.query.roomId
  if (!roomId || !rooms[roomId]) {
    return res.status(400).json({error: 'Invalid room ID'})
  }

  res.json(rooms[roomId].gameContext)
})

app.post('/vote', express.json(), (req, res) => {
  const {username, vote, roomId} = req.body
  const room = rooms[roomId]

  if (!room || !room.users[username] === null || isNaN(vote) || vote < 1 || vote > 5) {
    console.error('Error: Invalid username, room ID, or vote value')
    return res.status(400).json({error: 'Invalid username, room ID, or vote value'})
  }

  room.users[username] = vote
  io.to(roomId).emit('newVote', {username, vote})
  console.log(`User action: Vote received and saved successfully for ${username} in room ${roomId}`)
  return res.status(200).json({message: 'Vote received and saved successfully'})
})

app.post('/start', express.json(), (req, res) => {
  const {username, roomId} = req.body
  const room = rooms[roomId]

  if (!room || username !== 'master') {
    return res.status(403).json({error: 'Invalid room ID or unauthorized access'})
  }

  const roundInProgress = room.gameContext.state === 'voting'

  if (!roundInProgress) {
    room.gameContext.state = 'voting'

    // Reset user votes within the specific room
    for (let key in room.users) {
      room.users[key] = 0
    }

    io.to(roomId).emit('gameContext', room.gameContext)
    io.to(roomId).emit('signal', {state: 'start'})
    io.to(roomId).emit('reset', room.users)

    console.log(`User action: New round started by ${username} in room ${roomId}`)
    return res.status(200).json({message: 'New round started'})
  } else {
    console.error('Error: Round is already in progress')
    return res.status(400).json({error: 'Round is already in progress'})
  }
})

app.post('/end', express.json(), (req, res) => {
  const {username, roomId} = req.body
  const room = rooms[roomId]

  if (!room || username !== 'master') {
    return res.status(403).json({error: 'Invalid room ID or unauthorized access'})
  }

  const roundInProgress = room.gameContext.state === 'voting'

  if (roundInProgress) {
    room.gameContext.state = 'ending'
    io.to(roomId).emit('gameContext', room.gameContext)
    io.to(roomId).emit('signal', {state: 'end', data: calcAvg(room.users)})

    console.log(`User action: Round ended by ${username} in room ${roomId}`)
    return res.status(200).json({message: 'Round ended'})
  } else {
    console.error('Error: No round is currently in progress')
    return res.status(400).json({error: 'No round is currently in progress'})
  }
})

io.use((socket, next) => {
  const username = socket.handshake.query.username
  const roomId = socket.handshake.query.roomId

  if (username && roomId) {
    if (!rooms[roomId]) {
      rooms[roomId] = {users: {}, gameContext: {state: 'voting', ticket: ''}}
    }

    socket.username = username
    socket.roomId = roomId

    rooms[roomId].users[username] = 0

    io.to(roomId).emit('userJoined', username)
    console.log(`A user connected to room ${roomId}: `, socket.username)
    next()
  } else {
    console.error('Error: Authentication error - No username or room ID provided')
    next(new Error('Authentication error: No username or room ID provided'))
  }
})

io.on('connection', (socket) => {
  socket.join(socket.roomId)

  socket.on('disconnect', () => {
    const roomId = socket.roomId
    if (socket.username && rooms[roomId] && rooms[roomId].users[socket.username] !== undefined) {
      delete rooms[roomId].users[socket.username]
      io.to(roomId).emit('userDisconnected', socket.username)
      console.log(`A user disconnected from room ${roomId}: `, socket.username)
    }
  })

  socket.on('ping', (callback) => {
    callback()
  })

  socket.on('ticket', (ticket) => {
    const roomId = socket.roomId
    const username = socket.username
    const room = rooms[roomId]
    if (!room || username !== 'master') {
      return
    }
    room.gameContext.ticket = ticket
    io.to(roomId).emit('gameContext', room.gameContext)
    console.log(`User action: Ticket updated by ${username} in room ${roomId}`)
  })
})

const port = process.env.PORT || 8686
server.listen(port, () => {
  console.log(`Server is running on port ${port}`)
})
