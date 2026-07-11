import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAccount, useWriteContract, usePublicClient, useBalance } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { GAME_ESCROW_ADDRESS, gameEscrowABI } from '../config/contractConfig';
import { USDC_ADDRESS } from '../config/viemConfig';
import { socket } from './socket';
import { RPS } from './games/RPS';
import { Hangman } from './games/Hangman';
import { Battleship } from './games/Battleship';
import './style/Room.css';

import avatar1 from '../assets/avatars/1.png';
import avatar2 from '../assets/avatars/2.png';
import avatar3 from '../assets/avatars/3.png';
import avatar4 from '../assets/avatars/4.png';
import avatar5 from '../assets/avatars/5.png';

const AVATARS = { 1: avatar1, 2: avatar2, 3: avatar3, 4: avatar4, 5: avatar5 };

export function GlobalReclaimPrompt({ showWarning }) {
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const [pending, setPending] = useState(localStorage.getItem('aborted_rematch_pending'));
    const [isRoomActive, setIsRoomActive] = useState(false);

    useEffect(() => {
        const checkState = () => {
            setPending(localStorage.getItem('aborted_rematch_pending'));
            setIsRoomActive(!!document.querySelector('.room-container-arcade'));
        };

        checkState();
        window.addEventListener('storage', checkState);
        const interval = setInterval(checkState, 500);

        return () => {
            window.removeEventListener('storage', checkState);
            clearInterval(interval);
        };
    }, []);

    if (!pending || isRoomActive) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0,0,0,0.95)', zIndex: 99999, display: 'flex',
            justifyContent: 'center', alignItems: 'center', flexDirection: 'column'
        }}>
            <div style={{
                background: '#1a1a1a', padding: '40px', borderRadius: '15px',
                border: '2px solid #ff4757', textAlign: 'center', maxWidth: '500px'
            }}>
                <h2 style={{ color: '#ff4757', textShadow: '0 0 10px #ff4757', fontFamily: "'Press Start 2P', cursive", fontSize: '1.2rem', marginBottom: '20px' }}>
                    FUNDS LOCKED
                </h2>
                <p style={{ color: '#fff', marginBottom: '30px', fontSize: '1rem', lineHeight: '1.5' }}>
                    The opponent canceled the rematch, but your bet is securely locked in the smart contract. Reclaim it now.
                </p>
                <button
                    className="reclaim-button"
                    onClick={async () => {
                        try {
                            if (showWarning) showWarning("Opening wallet for secure refund...");
                            const hash = await writeContractAsync({
                                address: GAME_ESCROW_ADDRESS,
                                abi: gameEscrowABI,
                                functionName: 'reclaimBet',
                                args: [pending]
                            });
                            await publicClient.waitForTransactionReceipt({ hash });
                            if (showWarning) showWarning("Bet successfully returned to your wallet!");

                            localStorage.removeItem('aborted_rematch_pending');
                            localStorage.removeItem(`locked_rematch_${pending}`);
                            setPending(null);
                        } catch (e) {
                            console.error(e);
                            if (showWarning) showWarning(e.shortMessage || "Reclaim failed. Please try again.");
                        }
                    }}
                >
                    RECLAIM BET
                </button>
            </div>
        </div>
    );
}




const GameOverScreen = ({ room, isWinner, onNavigate, showWarning, localPlayerAddress, userBalanceNum }) => {
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();
    const [isClaiming, setIsClaiming] = useState(false);
    const [claimStatus, setClaimStatus] = useState('Claim Prize');

    const handleClaim = async () => {
        if (!isWinner || room.hasClaimed) return;
        setIsClaiming(true);
        setClaimStatus('Claiming...');
        try {
            const claimHash = await writeContractAsync({
                address: GAME_ESCROW_ADDRESS,
                abi: gameEscrowABI,
                functionName: 'claimPrize',
                args: [room.gameId, localPlayerAddress, room.signature],
            });
            await publicClient.waitForTransactionReceipt({ hash: claimHash });
            socket.emit('prize_claimed', { gameId: room.gameId });
            setClaimStatus('Claimed!');
        } catch (error) {
            console.error("Claim error:", error);
            showWarning(error.shortMessage || "Failed to claim prize.");
            setClaimStatus('Claim Prize');
            setIsClaiming(false);
        }
    };

    const handleLeave = () => {
        socket.emit('leave_resolved_room', { gameId: room.gameId, playerAddress: localPlayerAddress });
        onNavigate('home');
    };

    const isCreator = localPlayerAddress?.toLowerCase() === room.creatorAddress?.toLowerCase();
    const opponentLeft = isCreator ? room.opponentLeft : room.creatorLeft;
    const iRequested = isCreator ? room.rematch?.creator : room.rematch?.opponent;
    const opponentRequested = isCreator ? room.rematch?.opponent : room.rematch?.creator;

    const mustClaimFirst = isWinner && !room.hasClaimed;
    const isInsufficientBalance = userBalanceNum < parseFloat(room.bet);

    let rematchText = 'Rematch';
    let isRematchDisabled = false;

    if (opponentLeft) {
        rematchText = 'Opponent Left';
        isRematchDisabled = true;
    } else if (isInsufficientBalance) {
        rematchText = 'Insufficient USDC';
        isRematchDisabled = true;
    } else if (mustClaimFirst) {
        rematchText = opponentRequested ? 'Approve Rematch' : 'Rematch';
        isRematchDisabled = true;
    } else if (iRequested) {
        rematchText = 'Waiting...';
        isRematchDisabled = true;
    } else if (opponentRequested) {
        rematchText = 'Approve Rematch';
        isRematchDisabled = false;
    } else {
        rematchText = 'Rematch';
        isRematchDisabled = false;
    }

    const handleRematch = () => {
        if (isRematchDisabled) return;
        socket.emit('request_rematch', { gameId: room.gameId, playerAddress: localPlayerAddress });
    };

    return (
        <div className="game-over-container" style={{order: 0}}>
            {
                room.scores.creator !== 0 || room.scores.opponent !== 0 ?
                    <h2 className="game-over-title got-2">
                        {room.scores.creator} - {room.scores.opponent}
                    </h2> : null
            }
            <h2 className="game-over-title">{isWinner ? 'YOU WIN' : 'YOU LOSE'}</h2>
            <div className="game-over-buttons">
                {isWinner && (
                    <button className="game-over-btn claim-btn" onClick={handleClaim} disabled={isClaiming || room.hasClaimed}>
                        {room.hasClaimed ? 'Claimed' : claimStatus}
                    </button>
                )}
                <button className="game-over-btn rematch-btn" onClick={handleRematch} disabled={isRematchDisabled}>
                    {rematchText}
                </button>
                <button
                    className="game-over-btn leave-btn"
                    onClick={handleLeave}
                    disabled={isWinner && !room.hasClaimed}
                >
                    Leave
                </button>
            </div>
        </div>
    );
};

const PlayerConsole = ({ playerType, room, isLocalPlayer, onReadyClick }) => {
    const isCreator = playerType === 'creator';
    const player = isCreator
        ? { username: room.creatorUsername, address: room.creatorAddress, avatarId: room.creatorAvatarId }
        : { username: room.opponentUsername, address: room.opponentAddress, avatarId: room.opponentAvatarId };

    const isReady = isCreator ? room.creatorReady : room.opponentReady;

    const handleReady = () => {
        if (isLocalPlayer && !isReady && room.status === 'playing') {
            onReadyClick();
        }
    };

    const getButtonText = () => {
        if (isReady || !room?.opponentAddress) return 'READY';
        return 'READY UP';
    };

    return (
        <div className={`player-console ${isCreator ? 'creator-console' : 'opponent-console'}`}>
            <div className="player-info-panel">
                <h3 className="player-username" title={player.username || 'Waiting...'}>
                    {player.username ? `@${player.username}` : 'Waiting...'}
                </h3>
            </div>
            <div className={"player-avatar-area" + (player.avatarId ? "" : " no-opponent")}>
                {player.avatarId ? (
                    <img src={AVATARS[player.avatarId] || AVATARS[1]} alt="Player Avatar" />
                ) : (
                    <div style={{ color: '#555', fontSize: '3rem', fontFamily: "'Press Start 2P', cursive" }}>?</div>
                )}
            </div>

            <div className="player-action-area">
                <button
                    className={`ready-button-arcade ${isReady ? 'ready' : ''}`}
                    onClick={handleReady}
                    disabled={!isLocalPlayer || isReady || !room?.opponentAddress || room.status === 'resolved'}
                >
                    {getButtonText()}
                </button>
            </div>

            <div className="player-status-section">
                <p className="ready-status-text">
                    {room.status === 'waiting' && 'Waiting for opponent'}
                    {room.status === 'playing' && (isReady ? 'Player is Ready' : 'Waiting for player...')}
                    {room.status === 'resolved' && 'Game Over'}
                </p>
            </div>
        </div>
    );
};

export function Room({ roomDetails: initialRoomDetails, onNavigate, showWarning, sfxVolume }) {
    const { address } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    const { data: tokenBalance } = useBalance({
        address,
        token: USDC_ADDRESS,
    });
    const userBalanceNum = tokenBalance ? parseFloat(formatUnits(tokenBalance.value, tokenBalance.decimals)) : 0;

    const [room, setRoom] = useState(initialRoomDetails);
    const [copySuccess, setCopySuccess] = useState('');
    const [countdown, setCountdown] = useState(null);
    const [scores, setScores] = useState({ me: 0, opp: 0 });
    const [isLeaving, setIsLeaving] = useState(false);
    const [isGameActive, setIsGameActive] = useState(false);
    const roomRef = useRef(room);

    const [abortedRematchId, setAbortedRematchId] = useState(null);
    const didILockRematchRef = useRef(null);
    const abortedRematchIdRef = useRef(null);
    const isProcessingRematchRef = useRef(false);

    useEffect(() => {
        roomRef.current = room;
    }, [room]);

    useEffect(() => {
        const pendingId = localStorage.getItem('aborted_rematch_pending');
        if (pendingId) {
            setAbortedRematchId(pendingId);
        }
    }, []);

    useEffect(() => {
        setRoom(prevRoom => {
            if (prevRoom && prevRoom.gameId === initialRoomDetails.gameId) {
                return prevRoom;
            }
            return initialRoomDetails;
        });
    }, [initialRoomDetails]);

    useEffect(() => {
        if (socket.connected && address) {
            socket.emit('register_player', address);
        }

        const handleRoomUpdate = (updatedRoom) => {
            setRoom(prevRoom => {
                if (prevRoom && prevRoom.gameId === updatedRoom.gameId) {
                    return updatedRoom;
                }
                return prevRoom;
            });
        };

        const handleOpponentForfeited = ({ gameId: forfeitedGameId, forfeiterAddress }) => {
            if (roomRef.current.gameId === forfeitedGameId && address?.toLowerCase() !== forfeiterAddress.toLowerCase()) {
                showWarning("Opponent has forfeited. You will be returned to the main menu.");
                setTimeout(() => onNavigate('home'), 3000);
            }
        };

        const handleRematchAccepted = async ({ oldGameId, newRoom }) => {
            if (oldGameId === roomRef.current.gameId) {
                isProcessingRematchRef.current = true;
                try {
                    showWarning("Rematch accepted! Please confirm bet lock in wallet...");
                    const betAmountInSmallestUnit = parseUnits(String(newRoom.bet), 6);

                    const lockHash = await writeContractAsync({
                        address: GAME_ESCROW_ADDRESS,
                        abi: gameEscrowABI,
                        functionName: 'lockBet',
                        args: [newRoom.gameId, betAmountInSmallestUnit]
                    });

                    await publicClient.waitForTransactionReceipt({ hash: lockHash });

                    didILockRematchRef.current = newRoom.gameId;
                    localStorage.setItem(`locked_rematch_${newRoom.gameId}`, "true");

                    if (abortedRematchIdRef.current === newRoom.gameId) {
                        setAbortedRematchId(newRoom.gameId);
                        localStorage.setItem('aborted_rematch_pending', newRoom.gameId);
                        showWarning("Opponent canceled the rematch. Please reclaim your locked bet.");
                    } else {
                        onNavigate('room', newRoom);
                    }
                } catch (error) {
                    console.error("Rematch lockBet error:", error);
                    if (abortedRematchIdRef.current !== newRoom.gameId) {
                        showWarning("Rematch canceled: Bet lock rejected or failed.");
                        socket.emit('leave_resolved_room', { gameId: oldGameId, playerAddress: address });
                        socket.emit('abort_rematch', { oldGameId, newGameId: newRoom.gameId });
                    }
                    onNavigate('home');
                } finally {
                    isProcessingRematchRef.current = false;
                }
            }
        };

        const handleRematchUpdated = ({ gameId, rematch }) => {
            setRoom(prevRoom => {
                if (prevRoom && prevRoom.gameId === gameId) {
                    return { ...prevRoom, rematch };
                }
                return prevRoom;
            });
        };

        const handleOpponentLeftResolved = ({ gameId, playerAddress }) => {
            setRoom(prevRoom => {
                if (prevRoom && prevRoom.gameId === gameId) {
                    const isCreator = prevRoom.creatorAddress.toLowerCase() === playerAddress.toLowerCase();
                    return {
                        ...prevRoom,
                        creatorLeft: isCreator ? true : prevRoom.creatorLeft,
                        opponentLeft: !isCreator ? true : prevRoom.opponentLeft
                    };
                }
                return prevRoom;
            });
        };

        const handleRematchAborted = ({ oldGameId, newGameId }) => {
            if (roomRef.current.gameId === oldGameId || roomRef.current.gameId === newGameId) {
                abortedRematchIdRef.current = newGameId;

                const hasLockedBet = localStorage.getItem(`locked_rematch_${newGameId}`) === "true" || didILockRematchRef.current === newGameId;

                if (hasLockedBet) {
                    setAbortedRematchId(newGameId);
                    localStorage.setItem('aborted_rematch_pending', newGameId);
                    showWarning("Rematch canceled by opponent. You must reclaim your locked bet.");
                } else if (isProcessingRematchRef.current) {
                    showWarning("Opponent canceled. If your transaction confirms, you will need to reclaim your bet.");
                } else {
                    showWarning("Rematch canceled: Transaction rejected.");
                    onNavigate('home');
                }
            }
        };

        socket.on('room_updated', handleRoomUpdate);
        socket.on('opponent_forfeited', handleOpponentForfeited);
        socket.on('rematch_accepted', handleRematchAccepted);
        socket.on('rematch_updated', handleRematchUpdated);
        socket.on('opponent_left_resolved_room', handleOpponentLeftResolved);
        socket.on('rematch_aborted', handleRematchAborted);

        return () => {
            socket.off('room_updated', handleRoomUpdate);
            socket.off('opponent_forfeited', handleOpponentForfeited);
            socket.off('rematch_accepted', handleRematchAccepted);
            socket.off('rematch_updated', handleRematchUpdated);
            socket.off('opponent_left_resolved_room', handleOpponentLeftResolved);
            socket.off('rematch_aborted', handleRematchAborted);
        };
    }, [address, onNavigate, showWarning, publicClient, writeContractAsync]);


    useEffect(() => {
        const gameId = initialRoomDetails.gameId;

        const syncRoomState = () => {
            if (socket.connected) {
                socket.emit('request_room_update', gameId);
            }
        };
        syncRoomState();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncRoomState();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        socket.on('connect', syncRoomState);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            socket.off('connect', syncRoomState);
        };
    }, [initialRoomDetails.gameId]);


    useEffect(() => {
        if (room.status === 'playing' && room.creatorReady && room.opponentReady && countdown === null) {
            setCountdown(3);
        }
    }, [room.status, room.creatorReady, room.opponentReady, countdown]);


    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(c => (c !== null ? c - 1 : null)), 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0) {
            setIsGameActive(true);
            setCountdown(null);
        }
    }, [countdown]);

    const isCreator = useMemo(() => address?.toLowerCase() === room.creatorAddress.toLowerCase(), [address, room.creatorAddress]);
    useEffect(() => {
        if (room?.scores) {
            const myScore = isCreator ? room.scores.creator : room.scores.opponent;
            const oppScore = isCreator ? room.scores.opponent : room.scores.creator;
            setScores({ me: myScore, opp: oppScore });
        }
    }, [room?.scores, isCreator]);

    const isOpponent = useMemo(() => address?.toLowerCase() === room.opponentAddress?.toLowerCase(), [address, room.opponentAddress]);

    const handleReadyClick = () => {
        socket.emit('player_ready', { gameId: room.gameId, playerAddress: address });
    };

    const handleCopyInvite = () => {
        const inviteLink = `${window.location.origin}/?join=${room.gameId}`;

        navigator.clipboard.writeText(inviteLink).then(() => {
            setCopySuccess('Copied!');
            setTimeout(() => setCopySuccess(''), 2000);
        }, () => {
            showWarning('Failed to copy link.');
        });
    };


    const handleLeaveRoom = async () => {
        const isLocalCreator = address?.toLowerCase() === room?.creatorAddress?.toLowerCase();

        // 1. PENDING
        if (room.status === 'pending') {
            if (!isLocalCreator) {
                onNavigate('home');
                return;
            }
            setIsLeaving(true);
            showWarning("Cleaning up stuck room...");
            socket.emit('delete_room', room.gameId);
            setTimeout(() => onNavigate('home'), 500);
            return;
        }

        // 2. WAITING
        if (room.status === 'waiting') {
            if (!isLocalCreator) return;

            setIsLeaving(true);
            showWarning("Reclaiming your bet. Please confirm in wallet.");
            try {
                const reclaimHash = await writeContractAsync({
                    address: GAME_ESCROW_ADDRESS,
                    abi: gameEscrowABI,
                    functionName: 'reclaimBet',
                    args: [room.gameId],
                });
                await publicClient.waitForTransactionReceipt({ hash: reclaimHash });

                socket.emit('leave_waiting_room', { gameId: room.gameId }, (response) => {
                    if (response.success) {
                        showWarning("You have left the waiting room and reclaimed your bet.");
                        onNavigate('home');
                    } else {
                        socket.emit('delete_room', room.gameId);
                        onNavigate('home');
                    }
                });
            } catch (error) {
                console.error("Reclaim bet error:", error);
                showWarning("Contract reclaim failed or rejected. Forcing exit...");
                socket.emit('delete_room', room.gameId);
                onNavigate('home');
            }
            return;
        }

        // 3. PLAYING
        if (room.status === 'playing' && !isLeaving) {
            setIsLeaving(true);
            showWarning("Leaving will incur a penalty. Confirm in wallet.");
            try {
                const leaveHash = await writeContractAsync({
                    address: GAME_ESCROW_ADDRESS,
                    abi: gameEscrowABI,
                    functionName: 'leaveGame',
                    args: [room.gameId],
                });

                await publicClient.waitForTransactionReceipt({ hash: leaveHash });

                socket.emit('player_forfeited', { gameId: room.gameId, forfeiterAddress: address }, (response) => {
                    if (response.success) {
                        showWarning("You have left the game with a penalty.");
                        onNavigate('home');
                    } else {
                        showWarning("Server could not process the leave request. Forcing exit...");
                        socket.emit('leave_resolved_room', { gameId: room.gameId, playerAddress: address });
                        onNavigate('home');
                    }
                });

            } catch (error) {
                console.error("Leave game error:", error);
                showWarning("Contract interaction failed. Forcing exit...");
                socket.emit('leave_resolved_room', { gameId: room.gameId, playerAddress: address });
                onNavigate('home');
            }
        }
    };
    

    const renderGameComponent = () => {
        if (abortedRematchId) {
            return (
                <div className="room-state-container">
                    <h3 style={{ color: '#ff4757', textShadow: '0 0 10px #ff4757' }}>REMATCH CANCELED</h3>
                    <p style={{ maxWidth: '450px', margin: '0 auto 15px' }}>
                        The opponent rejected the transaction. Your funds are safe in the contract. Click below to reclaim them back to your wallet.
                    </p>
                    <button
                        className="invite-button-arcade"
                        style={{ background: '#28a745', boxShadow: '0 5px 0 #19692c' }}
                        onClick={async () => {
                            try {
                                showWarning("Opening wallet for secure refund...");
                                const reclaimHash = await writeContractAsync({
                                    address: GAME_ESCROW_ADDRESS,
                                    abi: gameEscrowABI,
                                    functionName: 'reclaimBet',
                                    args: [abortedRematchId],
                                });
                                await publicClient.waitForTransactionReceipt({ hash: reclaimHash });
                                showWarning("Your bet has been successfully returned to your wallet!");

                                localStorage.removeItem(`locked_rematch_${abortedRematchId}`);
                                localStorage.removeItem('aborted_rematch_pending');
                                setAbortedRematchId(null);
                                didILockRematchRef.current = null;
                                onNavigate('home');
                            } catch (error) {
                                console.error("Manual reclaim error:", error);
                                showWarning(error.shortMessage || "Reclaim failed. Please try again.");
                            }
                        }}
                    >
                        RECLAIM BET
                    </button>
                </div>
            );
        }
        if (room.status === 'waiting' || !room.opponentAddress) {
            return (
                <div className="room-state-container">
                    <h4>Waiting for an Opponent...</h4>
                    <button className="invite-button-arcade" onClick={handleCopyInvite}>
                        {copySuccess || `COPY INVITE`}
                    </button>
                </div>
            );
        }

        if (room.status === 'resolved') {
            const isWinner = room.winnerAddress?.toLowerCase() === address?.toLowerCase();
            return <GameOverScreen room={room} isWinner={isWinner} onNavigate={onNavigate} showWarning={showWarning} localPlayerAddress={address} userBalanceNum={userBalanceNum} />;
        }

        if (room.status === 'playing') {
            return (
                <div className="room-state-container">
                    {countdown > 0 ? (
                        <div className="countdown-display">{countdown}</div>
                    ) : (
                        <>
                            <h3>READY UP!</h3>
                            <p>The game will begin once both players are ready.</p>
                        </>
                    )}
                </div>
            );
        }
    };

    const handleScoresUpdate = useCallback((newScores) => {
        setScores(newScores);
    }, []);

    const handleGameOver = useCallback(() => {
        setIsGameActive(false);
    }, []);

    const formatRoomId = (id) => id ? `#${id.substring(2, 6)}` : '';

    if (isGameActive) {
        const gameProps = {
            localRoom: room,
            isCreator,
            address,
            scores,
            onScoresUpdate: handleScoresUpdate,
            onGameOver: handleGameOver,
            sfxVolume
        };
        switch (room.game) {
            case 'Hangman': return <Hangman {...gameProps} />;
            case 'Rock-Paper-Scissors': return <RPS {...gameProps} />;
            case 'Battleship': return <Battleship {...gameProps} />;
            default:
                showWarning("Unknown game type. Returning to home.");
                onNavigate('home');
                return null;
        }
    }

    return (
        <div className={"room-container-arcade" + (room.status === 'resolved' ? ' game-over-st' : '')}>
            <div className="room-header-info">
                <div className="header-left">
                    <div className="bet-display">
                        <span className="hl-text1">BET: </span>
                        <span className="hl-text2">{room.bet} USDC</span>
                    </div>

                    <div className="header-room-id">
                        <span className="hl-text1">ROOM:</span>
                        <span className="hl-text2 hlt2">{formatRoomId(room.gameId)}</span>
                    </div>
                </div>

                <div className="header-center">
                    <h2 className="glitch-text">{room.game}</h2>
                </div>

                <div className="room-header-right">
                    {
                        room.isPrivate ?
                            <span style={{ color: '#ff5100' }}>
                                <i className="fas fa-lock"></i> Private
                            </span> :
                            <span style={{ color: 'lightblue', marginRight: '5px', letterSpacing: '-0.8px' }}>
                                <i className="fas fa-globe"></i> Public
                            </span>
                    }
                    <button className="leave-room-button" onClick={handleLeaveRoom} disabled={isLeaving || room.status === 'resolved' || !!abortedRematchId}>
                        {isLeaving ? 'LEAVING...' : 'LEAVE'}
                    </button>
                </div>
            </div>

            <div className="room-main-content">
                <PlayerConsole playerType="creator" room={room} isLocalPlayer={isCreator} onReadyClick={handleReadyClick} />

                <div className="game-display-area">
                    <div className="scanlines"></div>
                    <div className="noise"></div>
                    <div className="noise noise-moving"></div>

                    <div className="game-content-z">
                        {renderGameComponent()}
                    </div>
                </div>

                <PlayerConsole playerType="opponent" room={room} isLocalPlayer={isOpponent} onReadyClick={handleReadyClick} />
            </div>
        </div>
    );
}