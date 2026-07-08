import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, usePublicClient, useBalance } from 'wagmi';
import { parseUnits, maxUint256, formatUnits } from 'viem';
import './style/CreateRoom.css';
import { GAME_ESCROW_ADDRESS, gameEscrowABI, erc20ABI } from '../config/contractConfig';
import { USDC_ADDRESS } from '../config/viemConfig';
import { socket } from './socket';
import { GAMES, BETS } from '../config/gameConstants';

import rpsImage from '../assets/games/rps.png';
import hangmanImage from '../assets/games/hangman.png';
import battleshipImage from '../assets/games/battleship.png';
import usdcIcon from '../assets/USDC.png';
const backendUrl = process.env.REACT_APP_BACKEND_URL;

const gameImages = {
  'Rock-Paper-Scissors': rpsImage,
  'Hangman': hangmanImage,
  'Battleship': battleshipImage,
};

export function CreateRoom({ onNavigate, showWarning }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState('selectGame');
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [selectedBet, setSelectedBet] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [creatorUsername, setCreatorUsername] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const { data: tokenBalance } = useBalance({
    address,
    token: USDC_ADDRESS,
  });
  const userBalanceNum = tokenBalance ? parseFloat(formatUnits(tokenBalance.value, tokenBalance.decimals)) : 0;

  useEffect(() => {
    if (address) {
      const profileData = localStorage.getItem(`profile_${address}`);
      if (profileData) {
        setCreatorUsername(JSON.parse(profileData).username);
      }
    }
  }, [address]);
  
  const handleNextGame = () => {
    setSelectedGameIndex(prevIndex => (prevIndex + 1) % GAMES.length);
  };

  const handlePrevGame = () => {
    setSelectedGameIndex(prevIndex => (prevIndex - 1 + GAMES.length) % GAMES.length);
  };

  const handleGameSelect = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setStep('selectBet');
      setIsFadingOut(false);
    }, 500);
  };

  const handleBetSelect = (bet) => {
    setSelectedBet(bet);
  };

  const handleBackToHome = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onNavigate('home');
    }, 500);
  };

  const handleBackToSelectGame = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      setStep('selectGame');
      setIsFadingOut(false);
    }, 500);
  };

  const handleCreateRoom = async () => {
    const selectedGame = GAMES[selectedGameIndex];
    if (!selectedBet || !selectedGame || !creatorUsername || !address || GAME_ESCROW_ADDRESS === '0xYourDeployedGameEscrowContractAddressHere') {
      showWarning("Error: Missing required data to create a room.");
      return;
    }

    setIsCreating(true);
    let createdRoomId = null;
    try {
      setStatusMessage('1/4: Creating room...');
      const response = await fetch(`${backendUrl}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          game: selectedGame,
          bet: selectedBet,
          creatorUsername: creatorUsername,
          creatorAddress: address,
          isPrivate: isPrivate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create room on the server.');
      }
      const newRoomData = await response.json();
      createdRoomId = newRoomData.gameId; 

      const betAmountInSmallestUnit = parseUnits(String(selectedBet), 6); 

      setStatusMessage('2/4: Checking allowance...');
      const currentAllowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20ABI,
        functionName: 'allowance',
        args: [address, GAME_ESCROW_ADDRESS],
      });

      if (currentAllowance < betAmountInSmallestUnit) {
        setStatusMessage('2/4: Awaiting approval...');
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20ABI,
          functionName: 'approve',
          args: [GAME_ESCROW_ADDRESS, maxUint256],
        });

        setStatusMessage('3/4: Processing approval...');
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatusMessage('4/4: Locking bet...');
      const lockBetHash = await writeContractAsync({
        address: GAME_ESCROW_ADDRESS,
        abi: gameEscrowABI,
        functionName: 'lockBet',
        args: [newRoomData.gameId, betAmountInSmallestUnit],
      });

      await publicClient.waitForTransactionReceipt({ hash: lockBetHash });

      setStatusMessage('Activating room...');
      await fetch(`${backendUrl}/rooms/${newRoomData.gameId}/activate`, {
        method: 'PUT'
      });

      onNavigate('room', newRoomData);

    } catch (error) {
      console.error("Error creating room:", error);
      
      if (createdRoomId) {
        socket.emit('delete_room', createdRoomId);
      }

      let errorMsg = "An unexpected error occurred.";
      if (error.message.includes('User rejected')) {
        errorMsg = "Transaction was rejected by the user.";
      } else if (error.message.includes('insufficient funds')) {
        errorMsg = "Insufficient funds to complete the transaction.";
      } else if (error.shortMessage) {
        errorMsg = error.shortMessage;
      }
      
      showWarning(errorMsg);
      setIsCreating(false);
      setStatusMessage('');
    }
  };

  const renderSelectGame = () => (
    <div className={`step-container ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
      <div className="back-nav-button" disabled={isFadingOut}>
        <div className="back-button" onClick={handleBackToHome}>BACK</div>
      </div>
      <div className="arcade-cabinet">
        <div className="marquee">
          <div className="marquee-text">SELECT GAME</div>
        </div>
        <div className="screen-area">
          <div className="screen-bezel">
            <div className="screen-display">
              <img src={gameImages[GAMES[selectedGameIndex]]} alt={GAMES[selectedGameIndex]} className="game-visual" />
            </div>
          </div>
        </div>
        <div className="name-plate">
          <div className="name-plate-inner">{GAMES[selectedGameIndex]}</div>
        </div>
        <div className="control-panel">
          <div className="button-layout">
            <button className="control-button arrow-button" onClick={handlePrevGame}>◀</button>
            <button className="control-button select-button" onClick={handleGameSelect}>START</button>
            <button className="control-button arrow-button" onClick={handleNextGame}>▶</button>
          </div>
        </div>
        <div className="cabinet-bottom"></div>
      </div>
    </div>
  );

  const renderSelectBet = () => (
    <div className={`step-container ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
      <div className="back-nav-button" disabled={isFadingOut}>
        <div className="back-button" onClick={handleBackToSelectGame}>BACK</div>
      </div>
      <h2>Select Bet Amount</h2>
      <div className="selection-grid bet-grid">
        {BETS.map(bet => {
          const isAffordable = !tokenBalance ? true : userBalanceNum >= bet;
          return (
            <div
              key={bet}
              className={`selection-box bet-box ${selectedBet === bet ? 'selected' : ''} ${!isAffordable ? 'disabled' : ''}`}
              onClick={() => isAffordable && handleBetSelect(bet)}
            >
              <img src={usdcIcon} alt="USDC" className="bet-usdc-icon" />
              <h3>{bet}</h3>
              {!isAffordable && <p className="deposit-text">Deposit USDC</p>}
            </div>
          );
        })}
      </div>
      <div className="privacy-toggle-container">
        <span className={`privacy-label ${!isPrivate ? 'active' : ''}`}>PUBLIC</span>
        <div className="privacy-switch" onClick={() => setIsPrivate(!isPrivate)}>
          <div className={`switch-handle ${isPrivate ? 'private' : ''}`}></div>
        </div>
        <span className={`privacy-label ${isPrivate ? 'active' : ''}`}>PRIVATE <span className='lck-emj'>🔒</span></span>
      </div>
      <button
        className="create-button"
        disabled={!selectedBet || isCreating}
        onClick={handleCreateRoom}
      >
        {isCreating ? statusMessage : 'Create'}
      </button>
    </div>
  );

  return step === 'selectGame' ? renderSelectGame() : renderSelectBet();
}