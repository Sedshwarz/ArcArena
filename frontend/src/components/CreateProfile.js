import { useState } from 'react';
import { useAccount } from 'wagmi';
import './style/Components.css';

import avatar1 from '../assets/avatars/1.png';
import avatar2 from '../assets/avatars/2.png';
import avatar3 from '../assets/avatars/3.png';
import avatar4 from '../assets/avatars/4.png';
import avatar5 from '../assets/avatars/5.png';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const AVATARS = {
  1: avatar1, 2: avatar2, 3: avatar3, 4: avatar4, 5: avatar5
};

export function CreateProfile({ onProfileCreated, showWarning }) {
  const { address } = useAccount();
  const [username, setUsername] = useState('');
  const [avatarId, setAvatarId] = useState(3);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    const trimmedUsername = username.trim();
    const usernameRegex = /^[a-zA-Z0-9_]+$/;

    if (!trimmedUsername) {
      showWarning('Username is required!');
      return;
    }

    if (trimmedUsername.length > 15) {
      showWarning('Username cannot be longer than 15 characters.');
      return;
    }

    if (!usernameRegex.test(trimmedUsername)) {
      showWarning('Username can only contain letters, numbers, and underscores (_). No spaces or special characters.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${backendUrl}/user/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, username: trimmedUsername, avatarId })
      });
      const data = await response.json();

      if (!response.ok) {
        showWarning(data.error || 'Failed to create profile');
        setIsSaving(false);
        return;
      }

      localStorage.setItem(`profile_${address}`, JSON.stringify({ username: trimmedUsername, avatarId }));
      onProfileCreated();
    } catch (err) {
      console.error(err);
      showWarning('Database connection failed! Make sure backend is running.');
    }
    setIsSaving(false);
  };

  return (
    <div className="profile-container glass-panel">
      <h2 className="neon-text pc-nt">Create Your Profile</h2>
      <p className="sub-text pc-st">Welcome! Please choose an avatar and set a username.</p>
      
      <div className="avatar-selection">
        {Object.entries(AVATARS).map(([id, src]) => (
          <div 
            key={id} 
            onClick={() => setAvatarId(Number(id))}
            style={{ 
              cursor: 'pointer', 
              opacity: avatarId === Number(id) ? 1 : 0.4,
              transform: avatarId === Number(id) ? 'scale(1.15)' : 'scale(1)',
              transition: 'all 0.3s ease',
            }}
          >
            <img src={src} alt={`Avatar ${id}`}/>
          </div>
        ))}
      </div>

      <div className="input-group">
        <input
          id="username"
          type="text"
          className="neon-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g., ArcPlayer123"
          maxLength={15}
        />
      </div>
      <button className="neon-button" onClick={handleSave} disabled={isSaving}>
        {isSaving ? 'CREATING...' : 'Create Profile'}
      </button>
    </div>
  );
}