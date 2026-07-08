import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits } from 'viem';
import { socket } from './socket';
import { GAME_ESCROW_ADDRESS, gameEscrowABI } from '../config/contractConfig';
import './style/Lobby.css';

import avatar1 from '../assets/avatars/1.png';
import avatar2 from '../assets/avatars/2.png';
import avatar3 from '../assets/avatars/3.png';
import avatar4 from '../assets/avatars/4.png';
import avatar5 from '../assets/avatars/5.png';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

const AVATARS = {
  1: avatar1, 2: avatar2, 3: avatar3, 4: avatar4, 5: avatar5
};

export function Lobby({ onNavigate, showWarning }) {
    const [rooms, setRooms] = useState([]);
    const [filter, setFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [betFilter, setBetFilter] = useState('All');
    const [isFadingOut, setIsFadingOut] = useState(false);
    const { address, isConnected } = useAccount();
    const publicClient = usePublicClient();
    const { writeContractAsync } = useWriteContract();
    const [joiningRoomId, setJoiningRoomId] = useState(null);

    useEffect(() => {
        fetch(`${backendUrl}/rooms`)
            .then(res => res.json())
            .then(data => setRooms(data))
            .catch(err => console.error("Error fetching rooms:", err));

        if (!socket.connected) socket.connect();

        const onRoomCreated = (newRoom) => {
            setRooms(prevRooms => [newRoom, ...prevRooms.filter(r => r.gameId !== newRoom.gameId)]);
        };

        const onRoomDeleted = (deletedGameId) => {
            setRooms(prevRooms => prevRooms.filter(room => room.gameId !== deletedGameId));
        };

        socket.on('room_created', onRoomCreated);
        socket.on('room_deleted', onRoomDeleted);

        return () => {
            socket.off('room_created', onRoomCreated);
            socket.off('room_deleted', onRoomDeleted);
        };
    }, []);

    const handleJoinRoom = async (room) => {
        if (!isConnected || !address) {
            showWarning("Please connect your wallet first.");
            return;
        }
        if (address.toLowerCase() === room.creatorAddress.toLowerCase()) {
            showWarning("You cannot join your own room.");
            return;
        }

        setJoiningRoomId(room.gameId);
        try {
            const betAmountInSmallestUnit = parseUnits(String(room.bet), 6);
            const hash = await writeContractAsync({
                address: GAME_ESCROW_ADDRESS,
                abi: gameEscrowABI,
                functionName: 'lockBet',
                args: [room.gameId, betAmountInSmallestUnit]
            });

            await publicClient.waitForTransactionReceipt({ hash });

            const profile = JSON.parse(localStorage.getItem(`profile_${address}`));
            const opponentUsername = profile.username;

            const response = await fetch(`${backendUrl}/rooms/${room.gameId}/join`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ opponentUsername, opponentAddress: address })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to join room.');
            }

            const updatedRoom = await response.json();
            onNavigate('room', updatedRoom);

        } catch (error) {
            console.error("Error joining room:", error);
            showWarning("Failed to join room: " + (error.shortMessage || error.message));
        } finally {
            setJoiningRoomId(null);
        }
    };

    const handleBack = () => {
        setIsFadingOut(true);
        setTimeout(() => {
            onNavigate('home');
        }, 500);
    };

    const filteredRooms = rooms.filter(room => {
      if (filter !== 'All' && room.game !== filter) {
          return false;
      }
      if (searchTerm.trim() !== '') {
          const term = searchTerm.toLowerCase().replace('#', '');
          const shortCode = room.gameId ? room.gameId.substring(2, 6).toLowerCase() : '';
          if (!room.creatorUsername.toLowerCase().includes(term) && !shortCode.includes(term)) {
              return false;
          }
      }
      if (betFilter !== 'All' && parseFloat(room.bet) !== parseFloat(betFilter)) {
          return false;
      }
      return true;
    });

    return (
        <div className={`lobby-page-container ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
            <div className="back-nav-button">
                <div className="back-button" onClick={handleBack}>BACK</div>
            </div>
            <h2 className="lobby-title">Open Rooms</h2>

            <div className="lobby-filter-bar">
                <button className={`filter-btn ${filter === 'All' ? 'active' : ''}`} onClick={() => setFilter('All')}>All Games</button>
                <button className={`filter-btn ${filter === 'Rock-Paper-Scissors' ? 'active' : ''}`} onClick={() => setFilter('Rock-Paper-Scissors')}>RPS</button>
                <button className={`filter-btn ${filter === 'Hangman' ? 'active' : ''}`} onClick={() => setFilter('Hangman')}>Hangman</button>
                <button className={`filter-btn ${filter === 'Battleship' ? 'active' : ''}`} onClick={() => setFilter('Battleship')}>Battleship</button>
            </div>
            
            <div className="lobby-filter-bar bet-filters">
                <button className={`filter-btn ${betFilter === 'All' ? 'active' : ''}`} onClick={() => setBetFilter('All')}>All Bets</button>
                <button className={`filter-btn ${betFilter === 1 ? 'active' : ''}`} onClick={() => setBetFilter(1)}>1 USDC</button>
                <button className={`filter-btn ${betFilter === 5 ? 'active' : ''}`} onClick={() => setBetFilter(5)}>5 USDC</button>
                <button className={`filter-btn ${betFilter === 10 ? 'active' : ''}`} onClick={() => setBetFilter(10)}>10 USDC</button>
                <button className={`filter-btn ${betFilter === 20 ? 'active' : ''}`} onClick={() => setBetFilter(20)}>20 USDC</button>
            </div>

            <div className="lobby-additional-filters">
                <input
                    type="text"
                    placeholder="Search username or room code (e.g. A1B2)..."
                    className="lobby-search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    maxLength={20}
                />
            </div>

            <div className="room-list">
                {filteredRooms.length === 0 ? (
                    <div className="no-rooms-message">
                        <p>{rooms.length > 0 ? 'No rooms match the current filter.' : 'No open rooms available right now.'}</p>
                        {rooms.length === 0 && <p>Why not create one?</p>}
                    </div>
                ) : (
                    filteredRooms.map(room => (
                        <div key={room.gameId} className="room-list-item">
                            <div className="room-creator-info">
                                <img src={AVATARS[room.creatorAvatarId] || AVATARS[1]} alt="Creator Avatar" className="lobby-creator-avatar" />
                                <div className="lobby-creator-details">
                                    <span className="lobby-creator-name">@{room.creatorUsername}</span>
                                    <span className="lobby-room-id">#{room.gameId ? room.gameId.substring(2, 6).toUpperCase() : '0000'}</span>
                                </div>
                            </div>
                            <div className="room-game-info">
                                <span className="lobby-game-name">{room.game}</span>
                                <span className="lobby-bet-amount">{room.bet} USDC</span>
                            </div>
                            <div className="join-button-container">
                              <button className="join-room-btn" onClick={() => handleJoinRoom(room)} disabled={joiningRoomId === room.gameId}>
                                {joiningRoomId === room.gameId ? 'JOINING...' : 'JOIN'}
                              </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}