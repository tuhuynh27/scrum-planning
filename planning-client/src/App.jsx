import React, { useEffect, useReducer, useState } from 'react'
import io from 'socket.io-client'
import './App.css'

export function showMessage(msg, timeout = 2000) {
  const div = document.createElement('div')
  div.classList.add('snackbar')
  div.innerText = msg
  document.body.appendChild(div);
  setTimeout(() => div.remove(), timeout)
}

// Define the initial state
const initialState = {
  users: {
  },
};

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
      };
    case 'REMOVE_USER':
      // eslint-disable-next-line no-unused-vars,no-case-declarations
      const { [action.payload]: removedUser, ...restUsers } = state.users;
      return {
        ...state,
        users: restUsers,
      };
    case 'SET_USERS':
      return {
        ...state,
        users: action.payload,
      };
    case 'SET_USER':
      return {
        ...state,
        users: {
          ...state.users,
          [action.payload.username]: action.payload.value,
        },
      };
    default:
      return state;
  }
};

function App() {
  const [connected, setConnected] = useState(null);
  const [currentTicket, setCurrentTicket] = useState('');
  const [gameState, setGameState] = useState('voting');
  const [avg, setAvg] = useState('N/A');
  const [currentVote, setCurrentVote] = useState(0);
  const [state, dispatch] = useReducer(reducer, initialState, undefined);

  const addUser = (username, value) => {
    dispatch({ type: 'ADD_USER', payload: { username, value } });
  };

  const removeUser = (username) => {
    dispatch({ type: 'REMOVE_USER', payload: username });
  };

  const setUsers = (users) => {
    dispatch({ type: 'SET_USERS', payload: users });
  };

  const setUser = (username, value) => {
    dispatch({ type: 'SET_USER', payload: { username, value } });
  };

  useEffect(() => {
    // Get all users
    fetch('https://plan-api.rwsg.lol/users').then(response => response.json()).then(data => {
      setUsers(data)
    })
    fetch('https://plan-api.rwsg.lol/context').then(response => response.json()).then(data => {
      setGameState(data.state)
      setCurrentTicket(data.ticket)
    })
  }, [connected])

  useEffect(() => {
    const username = localStorage.getItem('username')
    if (!username) {
      const username = prompt('Please enter your username:')
      if (username) {
        localStorage.setItem('username', username)
      }
    } else {
      const socket = io('https://plan-api.rwsg.lol', {
        query: { username: username },
      })

      socket.on('connect', () => {
        showMessage(`Connected to server as ${username}`)
        setConnected(username)
      })

      socket.on('userJoined', username => {
        showMessage(`${username} has joined`)
        addUser(username, 0)
      })

      socket.on('userDisconnected', username => {
        showMessage(`${username} has left`)
        removeUser(username)
      })

      socket.on('newVote', ({ username, vote }) => {
        showMessage(`${username} voted!`)
        setUser(username, vote)
      })

      socket.on('reset', data => {
        showMessage('New round!')
        setUsers(data)
      })

      socket.on('gameContext', ({ ticket, state }) => {
        setGameState(state)
        setCurrentTicket(ticket)
      })

      socket.on('signal', ({ state, data }) => {
        if (state === 'start') {
          setCurrentVote(0);
        } else {
          setAvg(data);
        }
      })

      return () => {
        socket.disconnect()
      }
    }
  }, [])

  const submitVote = (vote) => {
    const username = localStorage.getItem('username')
    console.log(JSON.stringify({ username, vote }))
    fetch('https://plan-api.rwsg.lol/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, vote }),
    }).then(r => r.json()).then(data => {
      console.log(data)
      setCurrentVote(vote)
    })
 }

 const handleTicketChange = (event) => {
   const username = localStorage.getItem('username')
   setCurrentTicket(event.target.value)
   fetch('https://plan-api.rwsg.lol/ticket', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({username, ticket: event.target.value}),
   }).then(r => r.json()).then(data => {
     console.log(data)
   })
  }

  const handleEnd = () => {
    const username = localStorage.getItem('username')
    fetch('https://plan-api.rwsg.lol/end', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({username}),
    }).then(r => r.json()).then(data => {
      console.log(data)
    })
  }

  const handleStart = () => {
    const username = localStorage.getItem('username')
    fetch('https://plan-api.rwsg.lol/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({username}),
    }).then(r => r.json()).then(data => {
      console.log(data)
    })
  }

  return (
    <>
      <div className="container mt-5">
        <h2>Scrum Planning Meeting</h2>
        <div className="row mt-4">
          <div className="col-md-6">
            {connected === 'master' && (
              <React.Fragment>
                <div className="form-group">
                  <label htmlFor="ticketNumber">Current Ticket:</label>
                  <input type="text" onChange={handleTicketChange} value={currentTicket} className="form-control" id="ticketNumber" placeholder="Enter ticket number"/>
                </div>
              </React.Fragment>
            )}
            {connected !== 'master' && (
              <React.Fragment>
                <div className="form-group">
                  <p>Current Ticket:</p>
                  <div>{currentTicket || 'Waiting for input from Scrum master'}</div>
                </div>
              </React.Fragment>
            )}
            <div className="form-group">
              <label htmlFor="joiningPlayers">Joining Developers:</label>
              <ul id="joiningPlayers" className="list-group">
                {Object.keys(state.users).map(username => (
                  <li key={username} className="list-group-item">{username}: {gameState === 'voting' ? state.users[username] > 0 ? 'Voted' : 'Not yet voted' : state.users[username] > 0 ? state.users[username] : 'Not yet voted'}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="col-md-6">
            {gameState === 'voting' && (
              <div className="form-group">
                <h2>Voting...</h2>
                <label htmlFor="estimation">Select Story Points (1-5):</label>
                <div className="estimation-buttons">
                  {[...Array(5)].map((_, index) => (
                    <button key={index} type="button"
                            onClick={() => submitVote(index + 1)}
                            className={`btn ${currentVote === index + 1 ? 'btn-primary' : 'btn-secondary'} mr-2`}>{index + 1}</button>
                  ))}
                </div>
              </div>
            )}
            {gameState !== 'voting' && (
              <div className="form-group">
                <h2>Estimate: <strong>{avg}</strong></h2>
              </div>
            )}
            {connected === 'master' && gameState === 'voting' && (
              <div className="form-group">
                <button type="button" onClick={handleEnd} className="btn btn-danger">End voting</button>
              </div>
            )}
            {connected === 'master' && gameState !== 'voting' && (
              <div className="form-group">
                <button type="button" onClick={handleStart} className="btn btn-primary">Start new round</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default App
