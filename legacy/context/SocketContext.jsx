import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';


const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!token || !user._id) return;

    const newSocket = io(`${API_BASE_URL}`, { transports: ['websocket'] });

    newSocket.on('connect', () => {
      // Register personal room for targeted notifications
      newSocket.emit('heartbeat', user._id);
      // Join team room for live task board sync
      if (user.team) {
        newSocket.emit('joinTeam', user.team);
      }
      
      // Join all chat channels to receive global notifications
      fetch(`${API_BASE_URL}/api/chat/channels`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(channels => {
        if (Array.isArray(channels)) {
          channels.forEach(channel => {
            newSocket.emit('joinChannel', channel._id);
          });
        }
      })
      .catch(console.error);

      // Join DMs as well
      fetch(`${API_BASE_URL}/api/chat/dm`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(dms => {
        if (Array.isArray(dms)) {
          dms.forEach(dm => {
            newSocket.emit('joinChannel', dm._id);
          });
        }
      })
      .catch(console.error);
    });

    // Notify everyone when a team member claims a pool task
    newSocket.on('poolTaskClaimed', ({ taskTitle, claimedBy }) => {
      // Dispatch a custom DOM event — UI toast can listen for this
      const msg = ` ${claimedBy} claimed "${taskTitle}"`;
      window.dispatchEvent(new CustomEvent('poolTaskClaimed', { detail: { msg } }));
    });

    // Global: forced logout when admin deactivates account
    newSocket.on('forceLogout', ({ reason }) => {
      alert(reason || 'Your account has been deactivated.');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      newSocket.disconnect();
      navigate('/login');
    });

    // Global: update cached user object if their own record changes
    newSocket.on('userUpdated', ({ userId, team, role, isTrainer }) => {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (currentUser._id === userId) {
        localStorage.setItem('user', JSON.stringify({
          ...currentUser,
          team,
          role,
          // preserve isTrainer if the event carries it, else keep existing value
          isTrainer: isTrainer !== undefined ? isTrainer : currentUser.isTrainer
        }));
        // Re-join new team room
        if (team && team !== currentUser.team) {
          if (currentUser.team) newSocket.emit('leaveTeam', currentUser.team);
          newSocket.emit('joinTeam', team);
        }
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}
