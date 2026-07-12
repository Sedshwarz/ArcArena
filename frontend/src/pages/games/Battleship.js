import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../style/Battleship.css';
import { socket } from '../socket';
import pressLetterAudio from '../../assets/sfx/pressLetter.mp3';

import avatar1 from '../../assets/avatars/1.png';
import avatar2 from '../../assets/avatars/2.png';
import avatar3 from '../../assets/avatars/3.png';
import avatar4 from '../../assets/avatars/4.png';
import avatar5 from '../../assets/avatars/5.png';

const AVATARS = {
  1: avatar1, 2: avatar2, 3: avatar3, 4: avatar4, 5: avatar5
};

const GRID_SIZE = 6;
const SHIPS = [
  { id: 'cruiser', size: 3, name: 'Cruiser (3 Units)' },
  { id: 'submarine', size: 2, name: 'Submarine (2 Units)' },
  { id: 'destroyer', size: 1, name: 'Destroyer (1 Unit)' }
];

export function Battleship({ localRoom, isCreator, address, scores, onScoresUpdate, onGameOver, sfxVolume }) {
  const [gameState, setGameState] = useState(localRoom?.gameState || {});
  const [myBoard, setMyBoard] = useState(Array(GRID_SIZE * GRID_SIZE).fill(null));
  const [selectedShip, setSelectedShip] = useState(null);
  const [isHorizontal, setIsHorizontal] = useState(true);
  const [placedShips, setPlacedShips] = useState([]);
  const [hoveredCells, setHoveredCells] = useState([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [timer, setTimer] = useState(localRoom?.gameState?.phase === 'combat' ? 20 : 60);
  
  const [combatEndsAt, setCombatEndsAt] = useState(null);

  const prevPhaseRef = useRef(localRoom?.gameState?.phase);
  const prevTurnRef = useRef(localRoom?.gameState?.turn);
  const prevMyShotsRef = useRef(0);
  const prevOppShotsRef = useRef(0);
  
  const isCreatorReady = gameState.creatorReady;
  const isOpponentReady = gameState.opponentReady;
  const isLocked = isCreator ? isCreatorReady : isOpponentReady;

  const myShots = isCreator ? gameState.creatorShots : gameState.opponentShots;
  const oppShots = isCreator ? gameState.opponentShots : gameState.creatorShots;
  const oppBoardFull = isCreator ? gameState.opponentBoard : gameState.creatorBoard;
  const currentTurn = gameState.turn?.toLowerCase();
  const isMyTurn = currentTurn === address?.toLowerCase();

  const myAvatar = isCreator ? localRoom?.creatorAvatarId : localRoom?.opponentAvatarId;
  const oppAvatar = isCreator ? localRoom?.opponentAvatarId : localRoom?.creatorAvatarId;

  useEffect(() => {
    const onStateUpdated = (data) => {
      if (data.gameId === localRoom?.gameId) {
        setGameState(data.gameState);
        
        const newPhase = data.gameState.phase;
        const newTurn = data.gameState.turn;
        
        if (prevPhaseRef.current !== newPhase || prevTurnRef.current !== newTurn) {
          if (newPhase === 'combat') {
             setCombatEndsAt(Date.now() + 20000);
          }
          prevPhaseRef.current = newPhase;
          prevTurnRef.current = newTurn;
        }
      }
    };
    socket.on('battleship_state_updated', onStateUpdated);
    return () => socket.off('battleship_state_updated', onStateUpdated);
  }, [localRoom?.gameId]);

  useEffect(() => {
    if (localRoom?.gameState) {
      setGameState(localRoom.gameState);
      if (localRoom.gameState.phase === 'combat' && !combatEndsAt) {
        setCombatEndsAt(Date.now() + 20000);
      }
    }
  }, [localRoom?.gameState]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    if (localRoom?.status === 'resolved' && !isGameOver) {
      setIsGameOver(true);
    }
  }, [localRoom?.status, isGameOver]);


  useEffect(() => {
    const serverBoard = isCreator ? gameState.creatorBoard : gameState.opponentBoard;
    if (serverBoard && serverBoard.length > 0) {
      const newBoard = Array(GRID_SIZE * GRID_SIZE).fill(null);
      serverBoard.forEach(ship => {
        if (ship.cells) {
          ship.cells.forEach(idx => newBoard[idx] = ship.id);
        }
      });
      setMyBoard(newBoard);
    }
  }, [gameState.creatorBoard, gameState.opponentBoard, isCreator]);


  const autoPlaceAndLock = useCallback(() => {
    const newBoard = Array(GRID_SIZE * GRID_SIZE).fill(null);
    const placed = [];
    SHIPS.forEach(ship => {
      let placedShip = false;
      while (!placedShip) {
        const isHoriz = Math.random() < 0.5;
        const index = Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE));
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;
        let cells = [];
        if (isHoriz) {
          if (col + ship.size <= GRID_SIZE) {
            for (let i = 0; i < ship.size; i++) cells.push(index + i);
          }
        } else {
          if (row + ship.size <= GRID_SIZE) {
            for (let i = 0; i < ship.size; i++) cells.push(index + (i * GRID_SIZE));
          }
        }
        if (cells.length === ship.size) {
          const collision = cells.some(idx => newBoard[idx] !== null);
          if (!collision) {
            cells.forEach(idx => newBoard[idx] = ship.id);
            placed.push({ ...ship, cells });
            placedShip = true;
          }
        }
      }
    });
    setMyBoard(newBoard);
    setPlacedShips(placed);
    setSelectedShip(null);
    setHoveredCells([]);
    socket.emit('game_action', { gameId: localRoom?.gameId, playerAddress: address, actionData: { type: 'lock_fleet', board: placed } });
  }, [address, localRoom?.gameId]);


  useEffect(() => {
    if (gameState.phase === 'game_over') return;

    const calculateRemaining = () => {
      let remaining = 0;
      let isTimeout = false;

      if (gameState.phase === 'deployment' && gameState.deploymentEndsAt) {
        remaining = Math.ceil((gameState.deploymentEndsAt - Date.now()) / 1000);
        remaining = Math.max(0, Math.min(60, remaining));
        if (remaining === 0) isTimeout = true;
      } 
      else if (gameState.phase === 'combat' && combatEndsAt) {
        remaining = Math.ceil((combatEndsAt - Date.now()) / 1000);
        remaining = Math.max(0, Math.min(20, remaining));
        if (remaining === 0) isTimeout = true;
      }

      setTimer(remaining);

      if (isTimeout) {
        if (gameState.phase === 'deployment' && !isLocked) {
          autoPlaceAndLock();
        } else if (gameState.phase === 'combat' && currentTurn === address?.toLowerCase()) {
          socket.emit('game_action', { gameId: localRoom?.gameId, playerAddress: address, actionData: { type: 'timeout', currentTurn } });
        }
      }
    };

    calculateRemaining(); 
    const intervalId = setInterval(calculateRemaining, 250); 

    return () => clearInterval(intervalId);
  }, [gameState.phase, gameState.deploymentEndsAt, combatEndsAt, isLocked, autoPlaceAndLock, address, localRoom?.gameId, currentTurn]);

  const playBeep = () => {
    if (sfxVolume > 0) {
      const audio = new Audio(pressLetterAudio);
      audio.volume = sfxVolume / 100;
      audio.play().catch(e => {});
    }
  };

  useEffect(() => {
    const playExplosion = () => {
      if (sfxVolume > 0) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(100, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.5);
          gain.gain.setValueAtTime((sfxVolume / 100) * 0.5, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(); osc.stop(ctx.currentTime + 0.5);
        } catch(e) {}
      }
    };

    const playSplash = () => {
      if (sfxVolume > 0) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(400, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
          gain.gain.setValueAtTime((sfxVolume / 100) * 0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(); osc.stop(ctx.currentTime + 0.3);
        } catch(e) {}
      }
    };

    const myHitsCount = myShots?.length || 0;
    const oppHitsCount = oppShots?.length || 0;

    if (myHitsCount > prevMyShotsRef.current) { const lastShot = myShots[myHitsCount - 1]; if (lastShot.hit) playExplosion(); else playSplash(); }
    if (oppHitsCount > prevOppShotsRef.current) { const lastShot = oppShots[oppHitsCount - 1]; if (lastShot.hit) playExplosion(); else playSplash(); }
    
    prevMyShotsRef.current = myHitsCount;
    prevOppShotsRef.current = oppHitsCount;
  }, [myShots, oppShots, sfxVolume]);


  const handleCellHover = (index, overrideHorizontal = isHorizontal) => {
    if (gameState.phase !== 'deployment' || !selectedShip || isLocked) {
      setHoveredCells([]);
      return;
    }

    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    let cellsToOccupy = [];

    if (overrideHorizontal) {
      if (col + selectedShip.size > GRID_SIZE) { setHoveredCells([]); return; }
      for (let i = 0; i < selectedShip.size; i++) cellsToOccupy.push(index + i);
    } else {
      if (row + selectedShip.size > GRID_SIZE) { setHoveredCells([]); return; }
      for (let i = 0; i < selectedShip.size; i++) cellsToOccupy.push(index + (i * GRID_SIZE));
    }

    const collision = cellsToOccupy.some(idx => myBoard[idx] !== null);
    if (collision) { setHoveredCells([]); return; }

    setHoveredCells(cellsToOccupy);
  };

  const handleCellClick = (index) => {
    if (gameState.phase !== 'deployment' || !selectedShip || isLocked) return;

    const row = Math.floor(index / GRID_SIZE);
    const col = index % GRID_SIZE;
    let cellsToOccupy = [];

    if (isHorizontal) {
      if (col + selectedShip.size > GRID_SIZE) return; 
      for (let i = 0; i < selectedShip.size; i++) cellsToOccupy.push(index + i);
    } else {
      if (row + selectedShip.size > GRID_SIZE) return; 
      for (let i = 0; i < selectedShip.size; i++) cellsToOccupy.push(index + (i * GRID_SIZE));
    }

    const collision = cellsToOccupy.some(idx => myBoard[idx] !== null);
    if (collision) return;

    playBeep();
    const newBoard = [...myBoard];
    cellsToOccupy.forEach(idx => newBoard[idx] = selectedShip.id);
    setMyBoard(newBoard);
    setPlacedShips([...placedShips, { ...selectedShip, cells: cellsToOccupy }]);
    setSelectedShip(null);
    setHoveredCells([]);
  };


  const handleUndo = () => {
    if (placedShips.length === 0 || isLocked) return;
    playBeep();
    const lastShip = placedShips[placedShips.length - 1];
    const newBoard = [...myBoard];
    lastShip.cells.forEach(idx => newBoard[idx] = null);
    setMyBoard(newBoard);
    setPlacedShips(placedShips.slice(0, -1));
  };


  const handleLockFleet = () => {
    playBeep();
    socket.emit('game_action', {
      gameId: localRoom?.gameId,
      playerAddress: address,
      actionData: { type: 'lock_fleet', board: placedShips }
    });
  };


  const handleFire = (idx) => {
    if (gameState.phase !== 'combat' || !isMyTurn) return;
    if (myShots?.some(s => s.index === idx)) return;
    socket.emit('game_action', {
      gameId: localRoom?.gameId,
      playerAddress: address,
      actionData: { type: 'fire_shot', index: idx }
    });
  };

  return (
    <div className="battleship-wrap">
      <h2 className="cyber-title">CYBER RADAR</h2>

      {gameState.phase === 'deployment' && (
        <div className="deployment-container">
          <div className="radar-wrapper">
            <h3 className="board-title bt-creating">
              <img src={AVATARS[myAvatar] || AVATARS[1]} alt="avatar" style={{ width: '35px', filter: 'drop-shadow(0 0 8px rgba(50,226,178,0.5))' }} />
              MY FLEET
            </h3>
            <div className="radar-grid" onMouseLeave={() => setHoveredCells([])}>
              {myBoard.map((cell, idx) => {
                const isHovered = hoveredCells.includes(idx);
                return (
                  <div
                    key={idx} 
                    className={`radar-cell ${cell ? 'occupied' : ''} ${isHovered ? 'preview' : ''}`}
                    onClick={() => handleCellClick(idx)}
                    onMouseEnter={() => handleCellHover(idx)}
                    onContextMenu={(e) => { 
                      e.preventDefault(); 
                      if (!isLocked) { 
                        const newIsHorizontal = !isHorizontal;
                        setIsHorizontal(newIsHorizontal); 
                        handleCellHover(idx, newIsHorizontal); 
                      }
                    }}
                  ></div>
                );
              })}
            </div>
            <p className="hint-text">💡 Right Click: Rotate Ship</p>
          </div>

          <div className="dock-container">
            <h3 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>DOCKYARD</span>
              <span style={{ color: timer <= 10 ? '#ff6b6b' : '#32e2b2', fontSize: '1rem' }}>{timer}s</span>
            </h3>
            <button className="rotate-btn" onClick={() => { playBeep(); setIsHorizontal(!isHorizontal); setHoveredCells([]); }} disabled={isLocked}>
              <span style={{ color: '#00f2fe' }}>DIR:</span> {isHorizontal ? 'HORIZONTAL ⬌' : 'VERTICAL ⬍'}
            </button>

            <div className="ship-list">
              {SHIPS.map(ship => {
                const isPlaced = placedShips.find(p => p.id === ship.id);
                return (
                  <div key={ship.id} className={`ship-item ${selectedShip?.id === ship.id ? 'selected' : ''} ${isPlaced ? 'placed' : ''}`}
                       onClick={() => { if(!isPlaced && !isLocked) { playBeep(); setSelectedShip(ship); } }}>
                    {ship.name}
                  </div>
                );
              })}
            </div>

            <div className="dock-actions">
              <button className="undo-btn" onClick={handleUndo} disabled={placedShips.length === 0 || isLocked}>UNDO LAST MOVE</button>
              <button className="lock-fleet-btn neon-button" onClick={handleLockFleet} disabled={placedShips.length < SHIPS.length || isLocked}>
                {isLocked ? 'WAITING FOR OPPONENT...' : 'LOCK FLEET (READY)'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {(gameState.phase === 'combat' || gameState.phase === 'game_over') && (
        <div className="combat-container">

          <div className="turn-indicator">
            {gameState.phase === 'game_over' ? (
              <>
                <h2 className="cyber-title ct-1">BATTLE OVER</h2>
                <p style={{ color: '#aaa', fontFamily: 'VT323, monospace', fontSize: '1.35rem', marginTop: '20px'}}>Enemy fleet revealed!</p>
                <button className="neon-button" style={{ marginTop: '0px', padding: '15px 30px' }} onClick={() => onGameOver()}>
                  SKIP TO RESULT
                </button><br/>
              </>
            ) : (
              <>
                {gameState.suddenDeath && (
                   <h3 className="sudden-death-text">☠️ SUDDEN DEATH ☠️</h3>
                )}
                <h2 className={"cyber-title" + isMyTurn ? " my-turn" : " enemy-turn"}>
                  {isMyTurn ? 'YOUR TURN' : 'ENEMY TURN'}
                </h2>
                <p className="timer-text" style={{ color: timer <= 5 ? '#ff6b6b' : '#ebca76'}}>
                  ⏳ {timer}s
                </p>
                <div className="ammo-status">
                  <span style={{ color: '#32e2b2' }}>AMMO: {Math.max(0, (gameState.maxAmmo || 10) - (myShots?.length || 0))}</span>
                  <span style={{ color: '#ff6b6b' }}>ENEMY: {Math.max(0, (gameState.maxAmmo || 10) - (oppShots?.length || 0))}</span>
                </div>
                <p className="hint-text2">{isMyTurn ? 'Select a target coordinate' : 'Waiting for enemy to fire...'}</p>
              </>
            )}
          </div>

          <div className="battlefield-wrapper">
            <div className="radar-wrapper my-radar">
              <h3 className="board-title bt-me">
                <img src={AVATARS[myAvatar] || AVATARS[1]} alt="avatar" style={{ width: '35px', filter: 'drop-shadow(0 0 8px rgba(50,226,178,0.5))' }} />
                MY FLEET
              </h3>
              <div className="radar-grid">
                {myBoard.map((cell, idx) => {
                  const shotInfo = oppShots?.find(s => s.index === idx);
                  return (
                    <div key={idx} className={`radar-cell ${cell ? 'occupied' : ''} ${shotInfo ? (shotInfo.hit ? 'hit' : 'miss') : ''}`}>
                      {shotInfo && <span className="shot-marker">{shotInfo.hit ? '💥' : '✕'}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            

            <div className="radar-wrapper enemy-radar">
              <h3 className="board-title bt-enemy">
                ENEMY RADAR
                <img src={AVATARS[oppAvatar] || AVATARS[1]} alt="avatar" style={{ width: '35px', filter: 'drop-shadow(0 0 8px rgba(255,107,107,0.45))' }} />
              </h3>
              <div className="radar-grid">
                {Array(GRID_SIZE * GRID_SIZE).fill(null).map((_, idx) => {
                  const shotInfo = myShots?.find(s => s.index === idx);
                  const isRevealedShip = gameState.phase === 'game_over' && oppBoardFull && oppBoardFull.some(ship => ship.cells.includes(idx));
                  return (
                    <div key={idx} className={`radar-cell ${shotInfo ? (shotInfo.hit ? 'hit' : 'miss') : 'targetable'} ${!isMyTurn && gameState.phase !== 'game_over' ? 'disabled' : ''} ${isRevealedShip && (!shotInfo || !shotInfo.hit) ? 'revealed-ship' : ''}`} onClick={() => handleFire(idx)}>
                      {shotInfo && <span className="shot-marker">{shotInfo.hit ? '💥' : '✕'}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}