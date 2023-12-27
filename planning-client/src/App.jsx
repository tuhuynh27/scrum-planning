import React, { useEffect, useReducer, useState } from 'react'
import io from 'socket.io-client'
import QRCode from 'react-qr-code'
import { showMessage } from './snatch'
import { appendRandomChars, extractHashValue } from './utils'
import './App.css'

const BASE_URL = 'https://plan-api.rwsg.lol'

// Define the initial state
const initialState = {
  users: {},
}

// Reducer function to handle state changes
const reducer = (state, action) => {
  switch (action.type) {
    case 'ADD_USER':
      return {
        ...state,
        users: {
          ...state.users,
          [action.payload.username]: action.payload.value,
        },
      }
    case 'REMOVE_USER':
      // eslint-disable-next-line no-unused-vars,no-case-declarations
      const {[action.payload]: removedUser, ...restUsers} = state.users
      return {
        ...state,
        users: restUsers,
      }
    case 'SET_USERS':
      return {
        ...state,
        users: action.payload,
      }
    case 'SET_USER':
      return {
        ...state,
        users: {
          ...state.users,
          [action.payload.username]: action.payload.value,
        },
      }
    default:
      return state
  }
}

let socket = null

function App() {
  const [roomId, setRoomId] = useState(extractHashValue(window.location.hash))
  const [username, setUsername] = useState(localStorage.getItem('username-' + roomId))

  const [connected, setConnected] = useState(null)
  const [currentTicket, setCurrentTicket] = useState('')
  const [timerId, setTimerId] = useState(null)
  const [gameState, setGameState] = useState('voting')
  const [avg, setAvg] = useState('N/A')
  const [currentVote, setCurrentVote] = useState(0)
  const [state, dispatch] = useReducer(reducer, initialState, undefined)
  const [ping, setPing] = useState(0)

  const addUser = (username, value) => {
    dispatch({type: 'ADD_USER', payload: {username, value}})
  }

  const removeUser = (username) => {
    dispatch({type: 'REMOVE_USER', payload: username})
  }

  const setUsers = (users) => {
    dispatch({type: 'SET_USERS', payload: users})
  }

  const setUser = (username, value) => {
    dispatch({type: 'SET_USER', payload: {username, value}})
  }

  useEffect(() => {
    // Get all users
    fetch(BASE_URL + '/users' + '?roomId=' + roomId).then(response => response.json()).then(data => {
      setUsers(data)
    })
    fetch(BASE_URL + '/context' + '?roomId=' + roomId).then(response => response.json()).then(data => {
      setGameState(data.state)
      setCurrentTicket(data.ticket)
    })
  }, [connected, roomId])

  useEffect(() => {
    if (!roomId) {
      const roomName = prompt('Please enter the room name to create a poker room:')
      if (roomName) {
        const newRoomId = appendRandomChars(roomName.toLowerCase())
        window.location.hash = newRoomId
        localStorage.setItem('username-' + newRoomId, 'master')
        setRoomId(newRoomId)
        setUsername('master')
      }
      return
    }
    if (!username) {
      const newUsername = prompt('Please enter your name:')
      if (newUsername) {
        localStorage.setItem('username-' + roomId, newUsername && newUsername.toLowerCase())
        setUsername(newUsername)
      }
      return
    }

    socket = io(BASE_URL, {
      query: {username, roomId},
    })

    socket.on('connect', () => {
      showMessage(`Logged in as ${username}`)
      setConnected(username)
    })

    socket.on('userJoined', username => {
      showMessage(`${username} has joined!`)
      addUser(username, 0)
    })

    socket.on('userDisconnected', username => {
      showMessage(`${username} has left!`)
      removeUser(username)
    })

    socket.on('newVote', ({username, vote}) => {
      showMessage(`${username} voted!`)
      setUser(username, vote)
    })

    socket.on('reset', data => {
      showMessage('New voting round!')
      setUsers(data)
    })

    socket.on('gameContext', ({ticket, state}) => {
      setGameState(state)
      if (connected !== 'master') {
        setCurrentTicket(ticket)
      }
    })

    socket.on('signal', ({state, data}) => {
      if (state === 'start') {
        setCurrentVote(0)
      } else {
        setAvg(data)
      }
    })

    const interval = setInterval(() => {
      const start = Date.now()

      socket.emit('ping', () => {
        const duration = Date.now() - start
        setPing(duration)
      })
    }, 1000)

    return () => {
      socket.disconnect()
      clearInterval(interval)
    }
  }, [roomId, username])

  const submitVote = (vote) => {
    fetch(BASE_URL + '/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({username, vote, roomId}),
    }).then(r => r.json()).then(data => {
      setCurrentVote(vote)
    })
  }

  const sendTicketToServer = (data) => {
    if (socket) {
      socket.emit('ticket', data)
    }
  }

  const handleTicketChange = (event) => {
    const {value} = event.target
    setCurrentTicket(value)

    if (timerId) {
      clearTimeout(timerId)
    }
    const newTimerId = setTimeout(() => {
      sendTicketToServer(value)
    }, 500)

    setTimerId(newTimerId)
  }

  const handleEnd = () => {
    fetch(BASE_URL + '/end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({roomId, username}),
    }).then(r => r.json()).then(data => {
      console.log(data)
    })
  }

  const handleStart = () => {
    fetch(BASE_URL + '/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({roomId, username}),
    }).then(r => r.json()).then(data => {
      console.log(data)
      setCurrentTicket('')
      sendTicketToServer('')
    })
  }

  const handleLogout = () => {
    localStorage.removeItem('username-' + roomId)
    window.location.reload()
  }

  const handleChangeRoom = () => {
    window.location.hash = ''
    window.location.reload()
  }

  if (!roomId || !username || !connected) {
    return (
      <>
        <div className="jumbotron jumbotron-fluid">
          <div className="container">
            <h1 className="display-4">♠ Planning Poker v1</h1>
            <p className="lead">Simple and fun story point estimations.</p>
          </div>
        </div>
        <div className="container">
          <p>Please refresh if you keep seeing this page.</p>
          <p>Note: We do not support mobile in-app browser, please open in external browser.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="container mt-5">

        <div className="container-fluid">
          <div className="row">
            <div className="col-md-6">
              <h2>♠ Planning Poker v1</h2>
              <p>"Make estimates with your teammates with this simple app"</p>
              <p>Room <strong>{roomId}</strong>, ping {ping}ms <button className="btn btn-secondary btn-sm"
                                                                       onClick={handleChangeRoom}>Change room</button>
              </p>
            </div>

            <div className="col-md-6">
              <div className="d-flex flex-column text-right">
                {connected === 'master' && <React.Fragment>
                  <div className="p-2">Scan this QR code to join</div>
                  <div className="p-2"><QRCode value={`https://plan.rwsg.lol/#${roomId}`}
                                               style={{height: '150px', width: '150px'}}/></div>
                </React.Fragment>}
                <div className="p-2">Logged in as <strong>{connected}</strong>
                  <button className="btn btn-sm btn-dark ml-2" onClick={handleLogout}>Change name</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row mt-4">
          <div className="col-md-12">
            {connected === 'master' && (
              <React.Fragment>
                <div className="form-group">
                  <label htmlFor="ticketNumber">Current Ticket:</label>
                  <input type="text" onChange={handleTicketChange} value={currentTicket} className="form-control"
                         style={{maxWidth: '500px'}} id="ticketNumber" placeholder="Enter ticket number"/>
                </div>
              </React.Fragment>
            )}
            {connected !== 'master' && (
              <React.Fragment>
                <div className="form-group">
                  <p>Current Ticket: <strong>{currentTicket || 'Waiting for input from Scrum master'}</strong></p>
                </div>
              </React.Fragment>
            )}
            <div id="joiningPlayers" className="card-group">
              {Object.keys(state.users).map(username => (
                <UserCard
                  key={username}
                  username={username}
                  voteStatus={state.users[username]}
                  gameState={gameState}
                />
              ))}
            </div>
          </div>
          <div className="col-md-12 text-center">
            {connected === 'master' && gameState === 'voting' && (
              <div className="form-group">
                <button type="button" onClick={handleEnd} className="btn btn-secondary">Show cards</button>
              </div>
            )}
            {connected === 'master' && gameState !== 'voting' && (
              <div className="form-group">
                <button type="button" onClick={handleStart} className="btn btn-secondary">Vote next issue</button>
              </div>
            )}
            {gameState === 'voting' && (
              <div className="form-group">
                <h2>Voting...</h2>
                <label htmlFor="estimation">Choose your card:</label>
                <div className="estimation-buttons">
                  {[...Array(5)].map((_, index) => (
                    <button key={index} type="button"
                            onClick={() => submitVote(index + 1)}
                            className={`btn btn-lg ${currentVote === index + 1 ? 'btn-primary' : 'btn-secondary'} mr-2`}>{index + 1}</button>
                  ))}
                </div>
              </div>
            )}
            {gameState !== 'voting' && (
              <div className="form-group">
                <h2>Average: <strong>{isNaN(avg) ? '0' : avg}</strong></h2>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const UserCard = ({username, voteStatus, gameState}) => {
  return (
    <div className="col-md-3 mb-3">
      <div className="card">
        <div className="card-body">
          <h5 className="card-title"><strong>{username}</strong></h5>
          <p className="card-text">
            {voteStatus > 0 ? 'Done!' : 'Hmm...'}
          </p>
          <div
            className={`voting-card ${gameState === 'voting' && voteStatus > 0 ? 'voted' : null} ${gameState !== 'voting' && voteStatus > 0 ? 'revealed' : null}`}>
            {gameState !== 'voting' && voteStatus > 0 && voteStatus || '♠'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
