import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import '../style/RPS.css';

import avatar1 from '../../assets/avatars/1.png';
import avatar2 from '../../assets/avatars/2.png';
import avatar3 from '../../assets/avatars/3.png';
import avatar4 from '../../assets/avatars/4.png';
import avatar5 from '../../assets/avatars/5.png';

const AVATARS = { 1: avatar1, 2: avatar2, 3: avatar3, 4: avatar4, 5: avatar5 };

export function RPS({ localRoom, isCreator, address, scores, onScoresUpdate, onGameOver }) {
  const [timer, setTimer] = useState(10);
  const [selectedMove, setSelectedMove] = useState(null);
  const [locked, setLocked] = useState(false);
  const [opponentLocked, setOpponentLocked] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [revealData, setRevealData] = useState(null);
  const [isGameOver, setIsGameOver] = useState(false);

  const [localScores, setLocalScores] = useState(scores);

  const transitionRef = useRef(false);


  useEffect(() => {
    if (localRoom?.status === 'resolved' && !transitionRef.current) {
      transitionRef.current = true;
      
      setTimeout(() => {
        onGameOver();
      }, 4500);
    }
  }, [localRoom?.status, onGameOver]);


  useEffect(() => {
    if (isGameOver || animating || revealData || !localRoom?.roundEndsAt) return;

    const calculateRemaining = () => {
      const remaining = Math.ceil((localRoom.roundEndsAt - Date.now()) / 1000);
      setTimer(Math.max(0, remaining));
    };

    calculateRemaining();
    const intervalId = setInterval(calculateRemaining, 250);

    return () => clearInterval(intervalId);
  }, [animating, revealData, isGameOver, localRoom?.roundEndsAt]);

  useEffect(() => {
    const onPlayerLocked = ({ gameId, playerAddress }) => {
      if (gameId === localRoom?.gameId && playerAddress?.toLowerCase() !== address?.toLowerCase()) {
        setOpponentLocked(true);
      }
    };

    const onRoundResult = (data) => {
      if (data.gameId === localRoom?.gameId) {
        setAnimating(true);

        setTimeout(() => {
          setAnimating(false);
          setRevealData(data);

          setLocalScores({
            me: isCreator ? data.scores.creator : data.scores.opponent,
            opp: isCreator ? data.scores.opponent : data.scores.creator
          });
          onScoresUpdate(data.scores);

          setTimeout(() => {
            if (data.gameOver) {
              setIsGameOver(true);
              onGameOver();
            } else {
              setRevealData(null);
              setSelectedMove(null);
              setLocked(false);
              setOpponentLocked(false);
              setTimer(10);
            }
          }, 2500);
        }, 1500);
      }
    };

    socket.on('player_locked', onPlayerLocked);
    socket.on('round_result', onRoundResult);

    return () => {
      socket.off('player_locked', onPlayerLocked);
      socket.off('round_result', onRoundResult);
    };
  }, [localRoom?.gameId, address, isCreator, onScoresUpdate, onGameOver]);

  const handleSelect = (move) => { if (!locked) setSelectedMove(move); };
  const handleLock = (move = selectedMove) => {
    if (!move || locked) return;
    setLocked(true);
    socket.emit('lock_move', { gameId: localRoom?.gameId, playerAddress: address, move });
  };

  let centerText = `00:${timer.toString().padStart(2, '0')}`;
  let stateClass = '';
  let myHandIcon = 'fa-hand-rock';
  let oppHandIcon = 'fa-hand-rock';

  let myMove = null;
  let oppMove = null;

  if (revealData) {
    myMove = isCreator ? revealData.creatorMove : revealData.opponentMove;
    oppMove = isCreator ? revealData.opponentMove : revealData.creatorMove;
  }

  if (animating) {
    myHandIcon = 'fa-hand-rock';
    oppHandIcon = 'fa-hand-rock';
    centerText = 'FIGHT!';
  } else if (revealData) {
    myHandIcon = myMove === 'Timeout' ? 'fa-times-circle' : `fa-hand-${myMove.toLowerCase()}`;
    oppHandIcon = oppMove === 'Timeout' ? 'fa-times-circle' : `fa-hand-${oppMove.toLowerCase()}`;

    if (revealData.winner === 'draw') { centerText = 'DRAW'; stateClass = 'draw'; }
    else if ((revealData.winner === 'creator' && isCreator) || (revealData.winner === 'opponent' && !isCreator)) { centerText = 'YOU WON'; stateClass = 'won'; }
    else { centerText = 'YOU LOST'; stateClass = 'loss'; }
  }

  const myHandResultClass = revealData ? (stateClass === 'won' ? 'winning-hand' : stateClass === 'loss' ? 'losing-hand' : 'draw-hand') : '';
  const oppHandResultClass = revealData ? (stateClass === 'loss' ? 'winning-hand' : stateClass === 'won' ? 'losing-hand' : 'draw-hand') : '';

  const myUsername = isCreator ? localRoom?.creatorUsername : localRoom?.opponentUsername;
  const oppUsername = isCreator ? localRoom?.opponentUsername : localRoom?.creatorUsername;
  const myAvatar = isCreator ? localRoom?.creatorAvatarId : localRoom?.opponentAvatarId;
  const oppAvatar = isCreator ? localRoom?.opponentAvatarId : localRoom?.creatorAvatarId;


  let myStatus = 'THINKING...';
  if (revealData) {
    myStatus = myMove === 'Timeout' ? 'TIMEOUT!' : myMove.toUpperCase();
  } else if (locked) {
    myStatus = 'READY!';
  }

  let oppStatus = 'THINKING...';
  if (revealData) {
    oppStatus = oppMove === 'Timeout' ? 'TIMEOUT!' : oppMove.toUpperCase();
  } else if (opponentLocked) {
    oppStatus = 'READY!';
  }

  return (
    <div className="rps-container">
      <div className="rps-scoreboard">
        <span className="score me">{localScores.me}</span>
        <span className="score-divider">-</span>
        <span className="score opp">{localScores.opp}</span>
      </div>

      <div className="rps-battle-area">
        <div className={`rps-player-panel me ${revealData && stateClass === 'won' ? 'winner' : ''}`}>
          <img src={AVATARS[myAvatar] || AVATARS[1]} alt="My Avatar" className="avatar" />
          <div className="username">@{myUsername}</div>
          <div className={`hand-display ${animating ? 'shake-left' : ''} ${myHandResultClass}`}>
            <i
              className={`fas ${myHandIcon}`}
              style={ myHandIcon === 'fa-hand-scissors' ? {transform: 'scaleX(-1) rotate(-270deg)'} : null }
            ></i>
          </div>
          <div className="status-indicator">{myStatus}</div>
        </div>

        <div className="rps-center-info">
          <div className="vs-text">VS</div>
          <div className={`round-timer ${timer <= 3 && !revealData && !animating ? 'urgent' : ''}`} />
          <span className={`round-state-text ${stateClass}`}>{centerText}</span>
        </div>

        <div className={`rps-player-panel opp ${revealData && stateClass === 'loss' ? 'winner' : ''}`}>
          <img src={AVATARS[oppAvatar] || AVATARS[1]} alt="Opponent Avatar" className="avatar" />
          <div className="username">@{oppUsername}</div>
          <div className={`hand-display ${animating ? 'shake-right' : ''} ${oppHandResultClass}`}>
            <i
              className={`fas ${oppHandIcon}`}
              style={{ transform: oppHandIcon === 'fa-hand-scissors' ? 'scaleX(1) rotate(90deg)' : 'scaleX(-1)' }}
            ></i>
          </div>
          <div className="status-indicator">{oppStatus}</div>
        </div>
      </div>

      <div className={`rps-selection-panel ${locked || animating || revealData ? 'locked' : ''}`}>
        <div className="selection-options">
          <i className={`fas fa-hand-rock ${selectedMove === 'Rock' ? 'selected' : ''}`} onClick={() => handleSelect('Rock')}></i>
          <i className={`fas fa-hand-paper ${selectedMove === 'Paper' ? 'selected' : ''}`} onClick={() => handleSelect('Paper')}></i>
          <i className={`fas fa-hand-scissors ${selectedMove === 'Scissors' ? 'selected' : ''}`} onClick={() => handleSelect('Scissors')}></i>
        </div>
        <button className="lock-btn" disabled={!selectedMove || locked} onClick={() => handleLock()}>{locked ? 'LOCKED IN' : 'LOCK IN'}</button>
      </div>
    </div>
  );
}