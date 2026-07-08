import './App.css';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { WalletInfo } from './components/WalletInfo';
import { ConnectButton } from './components/ConnectButton';
import { CreateProfile } from './components/CreateProfile';
import { Warning } from './components/Warning';
import { Home } from './pages/Home';
import { CreateRoom } from './pages/CreateRoom';
import { Lobby } from './pages/Lobby';
import { Room } from './pages/Room';
import { InvitePopup } from './components/InvitePopup';
import { Leaderboard } from './pages/Leaderboard';
import { Profile } from './pages/Profile';
import { FAQ } from './components/FAQ';
import { GlobalChat } from './components/GlobalChat';
import { GlobalReclaimPrompt } from './pages/Room';
import logo from './assets/logo.png';
import bgMusicFile from './assets/sfx/music.mp3';
const backendUrl = process.env.REACT_APP_BACKEND_URL;


function App() {
  const { address, isConnected, chainId, isConnecting, isReconnecting } = useAccount();
  const { chains, switchChain } = useSwitchChain();
  const [profileExists, setProfileExists] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [roomDetails, setRoomDetails] = useState(null);
  const [warningMessage, setWarningMessage] = useState('');
  const [isProfileChecked, setIsProfileChecked] = useState(false);
  const [musicVolume, setMusicVolume] = useState(0);
  const [sfxVolume, setSfxVolume] = useState(50);
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicVolume / 100;
      
      if (musicVolume > 0) {
        audioRef.current.play().catch(e => console.log("Browser autoplay block:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [musicVolume]);
  const showWarning = useCallback((msg) => setWarningMessage(msg), []);


  useEffect(() => {
    if (isConnected && address) {
      fetch(`${backendUrl}/user/profile/${address}`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Profile not found');
        })
        .then(data => {
          setProfileExists(true);
          localStorage.setItem(`profile_${address}`, JSON.stringify({ username: data.username, avatarId: data.avatarId }));

          fetch(`${backendUrl}/rooms/active/${address}`)
            .then(res => res.ok ? res.json() : null)
            .then(roomData => {
              if (roomData) {
                setRoomDetails(roomData);
                setCurrentPage('room');
              }
              setIsProfileChecked(true);
            })
            .catch(err => {
              console.error("Error fetching active room:", err);
              setIsProfileChecked(true);
            });
        })
        .catch(err => {
          setProfileExists(false);
          setIsProfileChecked(true);
        });
    } else if (!isConnecting && !isReconnecting) {

      setRoomDetails(null);
      setCurrentPage('home');
      setProfileExists(false);
      setIsProfileChecked(true);
    }
  }, [isConnected, address, isConnecting, isReconnecting]);

  const handleProfileCreated = () => {
    setProfileExists(true);
  };

  const handleNavigate = useCallback((page, payload = null) => {
    if (page === 'room') {
      setRoomDetails(payload);
    }
    setCurrentPage(page);
  }, []);

  const renderPage = () => {
    if (isConnecting || isReconnecting) return null;
    if (isConnected && !isProfileChecked) return null;
    
    if (!isConnected) return <ConnectButton />;

    const isCorrectNetwork = chains.some(c => c.id === chainId);
    if (!isCorrectNetwork && chains.length > 0) {
      return (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <h2 style={{ color: '#ff6b6b' }}>🔴 Wrong Network!</h2>
          <p>Please switch to the Arc Testnet network to continue playing.</p>
          <button
            onClick={() => switchChain({ chainId: chains[0].id })}
            className="arcade-button"
          >
            Switch to Arc Testnet
          </button>
        </div>
      );
    }

    if (!profileExists) return <CreateProfile onProfileCreated={handleProfileCreated} showWarning={showWarning} />;

    switch (currentPage) {
      case 'createRoom':
        return <CreateRoom onNavigate={handleNavigate} showWarning={showWarning} />;
      case 'lobby':
        return <Lobby onNavigate={handleNavigate} showWarning={showWarning} />;
      case 'room':
        return <Room key={roomDetails?.gameId} roomDetails={roomDetails} onNavigate={handleNavigate} showWarning={showWarning} sfxVolume={sfxVolume} />;
      case 'leaderboard':
        return <Leaderboard onNavigate={handleNavigate} />;
      case 'faq':
        return <FAQ onNavigate={handleNavigate} />;
      case 'profile':
        return <Profile onNavigate={handleNavigate} showWarning={showWarning} />;
      case 'home':
      default:
        return <Home onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="App">
      <audio ref={audioRef} src={bgMusicFile} loop />
      <header className={"App-header" + (currentPage === 'room' ? ' room-header' : '') + (!isConnected ? ' disconnected-header' : '')}>
        <img src={logo} alt='arcarena' className='logo' />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '15px' }}>
          {isConnected && profileExists && <WalletInfo musicVolume={musicVolume} setMusicVolume={setMusicVolume} sfxVolume={sfxVolume} setSfxVolume={setSfxVolume} onNavigate={handleNavigate} isInRoom={currentPage === 'room'} />}
        </div>
      </header>
      <main className="App-main">
        {renderPage()}
      </main>
      <InvitePopup onNavigate={handleNavigate} showWarning={showWarning} />
      <GlobalReclaimPrompt showWarning={showWarning} />
      {isConnected && profileExists && currentPage === 'lobby' && <GlobalChat />}
      {warningMessage && <Warning message={warningMessage} onClose={() => setWarningMessage('')} />}
    </div>
  );
}

export default App;
