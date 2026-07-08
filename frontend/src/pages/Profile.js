import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import './style/Profile.css';

import avatar1 from '../assets/avatars/1.png';
import avatar2 from '../assets/avatars/2.png';
import avatar3 from '../assets/avatars/3.png';
import avatar4 from '../assets/avatars/4.png';
import avatar5 from '../assets/avatars/5.png';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const AVATARS = {
  1: avatar1, 2: avatar2, 3: avatar3, 4: avatar4, 5: avatar5
};

export function Profile({ onNavigate, showWarning }) {
  const { address } = useAccount();
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [username, setUsername] = useState('');
  const [avatarId, setAvatarId] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveText, setSaveText] = useState('SAVE CHANGES');
  const [stats, setStats] = useState({ points: 0, winRate: "0%", pnl: "+0 USDC", matches: 0 });
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (address) {
      const cached = localStorage.getItem(`profile_${address}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setUsername(parsed.username);
        if (parsed.avatarId) setAvatarId(parsed.avatarId);
      }

      fetch(`${backendUrl}/user/profile/${address}?t=${Date.now()}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) {
            setUsername(data.username);
            setAvatarId(data.avatarId || 1);
            const winRate = data.matches > 0 ? Math.round((data.wins / data.matches) * 100) + "%" : "0%";
            const pnlStr = data.pnl >= 0 ? `+${data.pnl} USDC` : `${data.pnl} USDC`;
            setStats({ points: data.points, winRate, pnl: pnlStr, matches: data.matches });
            if (data.history) {
              const sortedHistory = [...data.history].sort((a, b) => b.timestamp - a.timestamp);
              setHistory(sortedHistory);
            }
          }
        })
        .catch(err => console.error("Stats fetch error:", err));
    }
  }, [address]);

  const handleBack = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onNavigate('home');
    }, 500);
  };

  const handleSave = async () => {
    if (!username.trim() || username.length < 3) {
      showWarning("Username must be at least 3 characters long.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${backendUrl}/user/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, username, avatarId })
      });
      const data = await response.json();

      if (!response.ok) {
        showWarning(data.error || "Failed to update profile");
        setIsSaving(false);
        return;
      }

      localStorage.setItem(`profile_${address}`, JSON.stringify({ username, avatarId }));
      window.dispatchEvent(new Event('profileUpdated')); // WalletInfo'yu anında güncellemesi için sinyal gönder
      setIsSaving(false); setSaveText('✅ SAVED!'); setTimeout(() => setSaveText('SAVE CHANGES'), 2000);
    } catch (err) {
      console.error(err); showWarning("Database connection failed!"); setIsSaving(false);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className={`profile-container ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
      <div className="back-nav-button">
        <div className="back-button" onClick={handleBack}>BACK</div>
      </div>
      <h2 className="profile-title">My Profile</h2>

      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            <img src={AVATARS[avatarId] || AVATARS[1]} alt="Avatar" />
            <div
              className="avatar-edit-badge"
              title="Cycle Avatar"
              onClick={() => setAvatarId(prev => prev === 5 ? 1 : prev + 1)}
            >
              <i className="fas fa-exchange-alt"></i>
            </div>
          </div>
          <div className="profile-info-edit">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={15}
              spellCheck={false}
            />
            <div className="wallet-info-wallet-address">
              <label>Wallet Address:</label>
              <div className="wallet-badge">{formatAddress(address)}</div>
            </div>
          </div>
        </div>
        <button className="neon-button save-profile-btn" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'SAVING...' : saveText}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-box"><span className="stat-value" style={{ color: '#00f2fe' }}>{stats.points}</span><span className="stat-label">TOTAL POINTS</span></div>
        <div className="stat-box"><span className="stat-value" style={{ color: '#32e2b2' }}>{stats.winRate}</span><span className="stat-label">WIN RATE</span></div>
        <div className="stat-box"><span className="stat-value" style={{ color: '#ebca76' }}>{stats.pnl}</span><span className="stat-label">TOTAL EARNINGS</span></div>
        <div className="stat-box"><span className="stat-value" style={{ color: '#ccc' }}>{stats.matches}</span><span className="stat-label">MATCHES PLAYED</span></div>
      </div>

      <h3 className="history-title">Recent Matches</h3>
      <div className="history-list">
        {history.length === 0 ? (
          <div style={{ color: '#aaa', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>No matches played yet.</div>
        ) : (
          history.map((match, index) => (
            <div key={`${match.id}-${index}`} className={`history-item ${match.result}`}>
              <div className="history-game">{match.game} vs @{match.opponent}</div>
              <div className="history-amount">{match.amount}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}