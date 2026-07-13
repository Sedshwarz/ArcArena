import { useState, useEffect, useRef } from 'react';
import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { formatUnits } from 'viem';
import { arcTestnet, USDC_ADDRESS } from '../config/viemConfig';
import './style/Components.css';
import USDC_ICON from '../assets/usdc-small2.png';
import avatar1 from '../assets/avatars/1.png';
import avatar2 from '../assets/avatars/2.png';
import avatar3 from '../assets/avatars/3.png';
import avatar4 from '../assets/avatars/4.png';
import avatar5 from '../assets/avatars/5.png';

const AVATARS = {
  1: avatar1, 2: avatar2, 3: avatar3, 4: avatar4, 5: avatar5
};

export function WalletInfo({ musicVolume, setMusicVolume, sfxVolume, setSfxVolume, onNavigate, isInRoom }) {
  const { address, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const [username, setUsername] = useState('');
  const [avatarId, setAvatarId] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [headerRightClass, setHeaderRightClass] = useState('');
  const dropdownRef = useRef(null);
  const [mscToggle, setMscToggle] = useState(musicVolume > 0);
  const [sfxToggle, setSfxToggle] = useState(sfxVolume > 0);

  useEffect(() => {
    setMscToggle(musicVolume > 0);
  }, [musicVolume]);

  useEffect(() => {
    setSfxToggle(sfxVolume > 0);
  }, [sfxVolume]);

  const isCorrectNetwork = chainId === arcTestnet.id;

  useEffect(() => {
    const loadProfile = () => {
      if (address) {
        const profileData = localStorage.getItem(`profile_${address}`);
        if (profileData) {
          const parsed = JSON.parse(profileData);
          setUsername(parsed.username);
          if (parsed.avatarId) setAvatarId(parsed.avatarId);
        }
      }
    };

    loadProfile();

    window.addEventListener('profileUpdated', loadProfile);
    return () => window.removeEventListener('profileUpdated', loadProfile);
  }, [address]);


  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  useEffect(() => {
    const checkLayoutState = () => {
      const isMobileWidth = window.innerWidth < 500;

      if (isMobileWidth || isInRoom) {
        setHeaderRightClass('hr-mobile');
      } else {
        setHeaderRightClass('');
      }
    };

    checkLayoutState();

    window.addEventListener('resize', checkLayoutState);

    return () => window.removeEventListener('resize', checkLayoutState);
  }, [isInRoom]);


  const { data: nativeBalance } = useBalance({
    address,
    query: { enabled: !!address && isCorrectNetwork, refetchInterval: 2000 },
  });

  const { data: tokenBalance } = useBalance({
    address,
    token: USDC_ADDRESS,
    query: { enabled: !!address && isCorrectNetwork, refetchInterval: 2000 },
  });

  const formatAddress = (addr) => {
    return `${addr?.substring(0, 4)}...${addr?.substring(addr.length - 4)}`;
  };

  if (!isCorrectNetwork) {
    return (
      <div className="wallet-info error-network">
        🔴 Wrong Network
      </div>
    );
  }

  return (
    <div className={`header-right ${headerRightClass}`}>

      <div className="balance-box">
        <img src={USDC_ICON} alt="USDC" className="balance-icon" />
        <span className="balance-text">
          {tokenBalance ? parseFloat(formatUnits(tokenBalance.value, tokenBalance.decimals)).toFixed(2) : '0.00'} {tokenBalance?.symbol || 'USDC'}
        </span>
        <div className="balance-tooltip">
          <span>Gas ({nativeBalance?.symbol || 'Native'}):</span>
          <span>{nativeBalance ? parseFloat(formatUnits(nativeBalance.value, nativeBalance.decimals)).toFixed(4) : '0'}</span>
        </div>
      </div>

      <div className="user-dropdown" ref={dropdownRef}>
        <div className="dropdown-trigger" onClick={() => setIsOpen(!isOpen)}>
          <img src={AVATARS[avatarId] || AVATARS[1]} alt="User Avatar" className="user-avatar" />
          <div className="user-details">
            <span className="user-name">@{username || 'Player'}</span>
            <span className="user-address">({formatAddress(address)})</span>
          </div>
          <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
        </div>

        <div className="hrm-settings" onClick={() => setIsOpen(!isOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </div>

        {isOpen && (
          <div className="dropdown-menu">
            {
              !isInRoom && (
                <div className="dropdown-item di-profile" onClick={() => { onNavigate('profile'); setIsOpen(false); }}>
                  <i className="fas fa-user"></i> Profile
                </div>
              )
            }

            <div className="dropdown-item di-balance">
              <img src={USDC_ICON} alt="USDC" className="balance-icon" />
              <span className="balance-text">
                {tokenBalance ? parseFloat(formatUnits(tokenBalance.value, tokenBalance.decimals)).toFixed(2) : '0.00'} {tokenBalance?.symbol || 'USDC'}
              </span>
            </div>

            {
              (headerRightClass !== '' && window.innerWidth < 768) ? 
              <>

                <div className="sound-mobile-container">
                  <div className="smcw">
                    <label className="msc-volume smcmv">Music</label>
                    <div 
                      className={`sound-toggle ${mscToggle && 'active-tg'}`} 
                      onClick={()=>{setMscToggle(!mscToggle); setMusicVolume(!mscToggle ? 100 : 0);}}>
                    </div>
                  </div>

                  <div className="smcw">
                    <label className="msc-volume smcmv">SFX</label>
                    <div 
                      className={`sound-toggle ${sfxToggle && 'active-tg'}`} 
                      onClick={()=>{setSfxToggle(!sfxToggle); setSfxVolume(!sfxToggle ? 100 : 0);}}>
                    </div>
                  </div>
                </div>

              </> :

                <div style={{ padding: '10px 15px', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                  <label className="msc-volume">
                    Music <span>{musicVolume}%</span>
                  </label>
                  <input className="msc-slider" type="range" min="0" max="100" value={musicVolume} onChange={e => setMusicVolume(e.target.value)} />

                  <label className="msc-volume">
                    SFX <span>{sfxVolume}%</span>
                  </label>
                  <input className="msc-slider" type="range" min="0" max="100" value={sfxVolume} onChange={e => setSfxVolume(e.target.value)} />
                </div>
            }

            {
              !isInRoom && (
                <button className="dropdown-item disconnect-btn" onClick={() => disconnect()}>
                  <i className="fas fa-wallet"></i> Disconnect
                </button>
              )
            }

          </div>
        )}
      </div>
    </div>
  );
}