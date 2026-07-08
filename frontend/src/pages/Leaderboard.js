import React, { useState, useEffect } from 'react';
import './style/Leaderboard.css';

import avatar1 from '../assets/avatars/1.png';
import avatar2 from '../assets/avatars/2.png';
import avatar3 from '../assets/avatars/3.png';
import avatar4 from '../assets/avatars/4.png';
import avatar5 from '../assets/avatars/5.png';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const AVATARS = {
  1: avatar1, 2: avatar2, 3: avatar3, 4: avatar4, 5: avatar5
};

export function Leaderboard({ onNavigate }) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetch(`${backendUrl}/leaderboard`)
      .then(res => res.json())
      .then(data => {
        const rankedData = data.map((user, index) => ({ ...user, rank: index + 1 }));
        setLeaderboard(rankedData);
      })
      .catch(err => console.error("Error fetching leaderboard:", err));
  }, []);

  const handleBack = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onNavigate('home');
    }, 500);
  };

  const top3 = [];
  if (leaderboard[1]) top3.push(leaderboard[1]);
  if (leaderboard[0]) top3.push(leaderboard[0]);
  if (leaderboard[2]) top3.push(leaderboard[2]);

  const remaining = leaderboard.slice(3);

  return (
    <div className={`leaderboard-container ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
      <div className="back-nav-button">
        <div className="back-button" onClick={handleBack}>BACK</div>
      </div>
      <h2 className="leaderboard-title">Leaderboard</h2>

      <div className="podium-wrapper">
        {top3.map((user) => (
          <div key={user.rank} className={`podium-step podium-${user.rank}`}>
            <div title={user.username} className={user.rank === 1 ? 'podium-username podium-1' : 'podium-username'}>
              @{user.username}
            </div>
            <div className="podium-avatar-container">
              {user.rank === 1 && <div className="crown-icon">👑</div>}
              <img src={AVATARS[user.avatarId] || AVATARS[1]} alt="Avatar" className="podium-avatar" />
              {(user.rank === 2 || user.rank === 3) && <div className="medal-icon">{user.rank === 2 ? '🥈' : '🥉'}</div>}
            </div>
            <div className="podium-box"><span>{user.rank}</span></div>
            <div className="podium-points">{user.points} PTS</div>
          </div>
        ))}
      </div>

      <div className="leaderboard-list">
        {remaining.map((user) => (
          <div key={user.rank} className="list-item">
            <div style={{ display: 'flex'}}>
              <div className="list-rank">#{user.rank}</div>
              <div className="list-username">@{user.username}</div>
            </div>
            <div className="list-points">{user.points} PTS</div>
          </div>
        ))}
      </div>
    </div>
  );
}