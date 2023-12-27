import React, { useEffect, useReducer, useState } from 'react'
import io from 'socket.io-client'
import QRCode from 'react-qr-code'
import { showMessage } from './snatch'
import { appendRandomChars, extractHashValue } from './utils'
import './App.css'

const BASE_URL = 'https://plan-api.rwsg.lol'

const roomId = extractHashValue(window.location.hash) || 'null'

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

function App() {
  const [connected, setConnected] = useState(null)
  const [currentTicket, setCurrentTicket] = useState('')
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
  }, [connected])

  useEffect(() => {
    const roomId = extractHashValue(window.location.hash)
    if (!roomId) {
      const roomName = prompt('Please enter the room name to create room:')
      window.location.hash = appendRandomChars(roomName)
      localStorage.setItem('username-' + roomName, 'master')
      window.location.reload()
    }
    const username = localStorage.getItem('username-' + roomId)
    if (!username) {
      const username = prompt('Please enter your username:')
      if (username) {
        localStorage.setItem('username', username)
      }
      window.location.reload()
    } else {
      const socket = io(BASE_URL, {
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
        setCurrentTicket(ticket)
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
    }
  }, [])

  const submitVote = (vote) => {
    const username = localStorage.getItem('username')
    console.log(JSON.stringify({username, vote}))
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
    const username = localStorage.getItem('username')
    fetch(BASE_URL + '/ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({roomId, username, ticket: data}),
    }).then(r => r.json()).then(data => {
      console.log(data)
    })
  }

  const handleTicketChange = (event) => {
    setCurrentTicket(event.target.value)
    sendTicketToServer(event.target.value)
  }

  const handleEnd = () => {
    const username = localStorage.getItem('username')
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
    const username = localStorage.getItem('username')
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
    localStorage.removeItem('username')
    window.location.reload()
  }

  return (
    <>
      <div className="container mt-5">
        <h2>RWSG Scrum Planning Poker</h2>
        <div className="text-left">Room <strong>{roomId}</strong>, ping {ping}ms</div>
        <div className="d-flex flex-column text-right">
          {connected === 'master' && <React.Fragment>
            <div className="p-2">Scan this QR code to join</div>
            <div className="p-2"><QRCode value={`https://plan.rwsg.lol/#${roomId}`} style={{height: '150px', width: '150px'}}/></div>
          </React.Fragment>}
          <div className="p-2">Logged in as <strong>{connected && connected.toLowerCase()}</strong>
            <button className="btn btn-sm btn-dark ml-2" onClick={handleLogout}>Logout</button>
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
                <button type="button" onClick={handleEnd} className="btn btn-primary">Show cards</button>
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
          <h5 className="card-title"><strong>{username.toLowerCase()}</strong></h5>
          <p className="card-text">
            {voteStatus > 0 ? 'Done!' : 'Hmm...'}
          </p>
          <div
            className={`voting-card ${gameState === 'voting' && voteStatus > 0 ? 'voted' : null} ${gameState !== 'voting' && voteStatus > 0 ? 'revealed' : null}`}>
            {gameState !== 'voting' && voteStatus > 0 && voteStatus}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
