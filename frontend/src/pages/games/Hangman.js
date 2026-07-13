import React, { useState, useEffect, useRef } from 'react';
import '../style/Hangman.css';
import { socket } from '../socket';
import pressLetterAudio from '../../assets/sfx/pressLetter.mp3';
import revealedWordAudio from '../../assets/sfx/revealedWord.mp3';
import wrongAudio from '../../assets/sfx/wrong.mp3';

import avatar1 from '../../assets/avatars/1.png';
import avatar2 from '../../assets/avatars/2.png';
import avatar3 from '../../assets/avatars/3.png';
import avatar4 from '../../assets/avatars/4.png';
import avatar5 from '../../assets/avatars/5.png';

const AVATARS = { 1: avatar1, 2: avatar2, 3: avatar3, 4: avatar4, 5: avatar5 };

const GallowsSVG = ({ errors }) => {
  const strokeColor = errors >= 6 ? "#ff6b6b" : "#eef2f5";
  return (
    <svg height="200" width="160" className="gallows-svg">
      <line x1="10" y1="190" x2="150" y2="190" stroke="#aaa" strokeWidth="4" />
      <line x1="40" y1="190" x2="40" y2="20" stroke="#aaa" strokeWidth="4" />
      <line x1="40" y1="20" x2="100" y2="20" stroke="#aaa" strokeWidth="4" />
      <line x1="100" y1="20" x2="100" y2="40" stroke="#aaa" strokeWidth="4" />

      <circle cx="100" cy="55" r="15" stroke={strokeColor} strokeWidth="4" fill="none" className={errors >= 1 ? 'show-part' : 'hide-part'} />
      <line x1="100" y1="70" x2="100" y2="120" stroke={strokeColor} strokeWidth="4" className={errors >= 2 ? 'show-part' : 'hide-part'} />
      <line x1="100" y1="80" x2="70" y2="100" stroke={strokeColor} strokeWidth="4" className={errors >= 3 ? 'show-part' : 'hide-part'} />
      <line x1="100" y1="80" x2="130" y2="100" stroke={strokeColor} strokeWidth="4" className={errors >= 4 ? 'show-part' : 'hide-part'} />
      <line x1="100" y1="120" x2="75" y2="160" stroke={strokeColor} strokeWidth="4" className={errors >= 5 ? 'show-part' : 'hide-part'} />
      <line x1="100" y1="120" x2="125" y2="160" stroke={strokeColor} strokeWidth="4" className={errors >= 6 ? 'show-part' : 'hide-part'} />
    </svg>
  );
};

export function Hangman({ localRoom, isCreator, address, scores, onScoresUpdate, onGameOver, sfxVolume }) {
  const [gameState, setGameState] = useState(localRoom?.gameState || {});
  const [timer, setTimer] = useState(15);
  const [isGuessing, setIsGuessing] = useState(false);
  const [guessInput, setGuessInput] = useState('');
  const [isGameOver, setIsGameOver] = useState(false);


  useEffect(() => {
    if (localRoom?.gameState) {
      setGameState(localRoom.gameState);
    }
  }, [localRoom?.gameState]);


  const transitionRef = useRef(false);

  useEffect(() => {
    let timeoutId;
    if (localRoom?.status === 'resolved' && !transitionRef.current) {
      transitionRef.current = true;
      setIsGameOver(true);

      timeoutId = setTimeout(() => {
        if (typeof onGameOver === 'function') {
          onGameOver();
        }
      }, 1500);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [localRoom?.status, onGameOver]);


  useEffect(() => {
    const onStateUpdated = (data) => {
      if (transitionRef.current) return;
      if (data.gameId === localRoom?.gameId) {
        setGameState(data.gameState);
      }
    };
    socket.on('hangman_state_updated', onStateUpdated);
    return () => socket.off('hangman_state_updated', onStateUpdated);
  }, [localRoom?.gameId]);


  useEffect(() => {
    if (gameState.isRoundOver || isGameOver || !gameState.roundEndsAt) return;

    const calculateRemaining = () => {
      const remaining = Math.ceil((gameState.roundEndsAt - Date.now()) / 1000);
      setTimer(Math.max(0, Math.min(15, remaining)));
    };

    calculateRemaining();
    const intervalId = setInterval(calculateRemaining, 250);

    return () => clearInterval(intervalId);
  }, [gameState.isRoundOver, isGameOver, gameState.roundEndsAt]);

  const category = gameState.category || "Waiting for game...";
  const actualWord = gameState.word || "";
  const guessedLetters = gameState.guessedLetters || [];

  const myErrors = isCreator ? gameState.creatorErrors || 0 : gameState.opponentErrors || 0;
  const oppErrors = isCreator ? gameState.opponentErrors || 0 : gameState.creatorErrors || 0;

  const myAddress = address?.toLowerCase();
  const currentTurn = gameState.turn?.toLowerCase();
  const isMyTurn = currentTurn === myAddress;

  const myUsername = isCreator ? localRoom?.creatorUsername : localRoom?.opponentUsername;
  const oppUsername = isCreator ? localRoom?.opponentUsername : localRoom?.creatorUsername;

  const myAvatar = isCreator ? localRoom?.creatorAvatarId : localRoom?.opponentAvatarId;
  const oppAvatar = isCreator ? localRoom?.opponentAvatarId : localRoom?.creatorAvatarId;

  useEffect(() => {
    if (!isMyTurn) setIsGuessing(false);
  }, [isMyTurn]);


  const prevScores = useRef(scores);

  useEffect(() => {
    if (sfxVolume > 0 && gameState.isRoundOver) {
      if (scores.me > prevScores.current.me) {
        const audio = new Audio(revealedWordAudio);
        audio.volume = sfxVolume / 100;
        audio.play().catch(e => console.log(e));
        prevScores.current = scores;
      } else if (scores.opp > prevScores.current.opp) {
        const audio = new Audio(wrongAudio);
        audio.volume = sfxVolume / 100;
        audio.play().catch(e => console.log(e));
        prevScores.current = scores;
      }
    }
    if (!gameState.isRoundOver) {
      prevScores.current = scores;
    }
  }, [scores, gameState.isRoundOver, sfxVolume]);


  const playClickSound = () => {
    if (!sfxVolume || sfxVolume === 0) return;
    const audio = new Audio(pressLetterAudio);
    audio.volume = sfxVolume / 100;
    audio.play().catch(e => console.log("Audio play error:", e));
  };

  const words = actualWord.split(' ');
  let globalIndex = 0;

  const keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];

  const handleLetterClick = (letter) => {
    if (!isMyTurn || guessedLetters.includes(letter) || isGuessing) return;
    playClickSound();

    socket.emit('game_action', {
      gameId: localRoom?.gameId,
      playerAddress: address,
      actionData: { type: 'guess_letter', letter }
    });
  };

  const submitGuess = () => {
    if (guessInput && guessInput.trim().length > 0) {
      setIsGuessing(false);
      socket.emit('game_action', {
        gameId: localRoom?.gameId,
        playerAddress: address,
        actionData: { type: 'guess_word', word: guessInput.trim().toUpperCase() }
      });
      setGuessInput('');
    }
  };

  return (
    <div className="game-wrap">
      <div className="hangman-container" >

        <div className={`hangman-side ${isMyTurn ? 'active-turn' : ''}`}>
          <div className="hangman-side-top">
            <img src={AVATARS[myAvatar] || AVATARS[1]} alt="avatar" style={{ width: '50px', filter: 'drop-shadow(0 0 10px rgba(50,226,178,0.5))' }} />
            <span className="player-id" style={{ margin: 0 }}>@{myUsername} (You)</span>
          </div>
          <span className="player-score">Score: {scores.me}/3</span>
          <GallowsSVG errors={myErrors} />
          <span className="error-count" style={{ color: myErrors >= 5 ? '#ff6b6b' : '#aaa' }}>Errors: {myErrors}/6</span>
        </div>

        <div className="hangman-center">
          <div className="category-text">Category: {category}</div>

          <div className={`timer-badge ${timer <= 5 ? 'urgent' : ''}`}>
            00:{timer.toString().padStart(2, '0')}
          </div>

          <div className="word-display">
            {words.map((word, wordIdx) => (
              <div key={`word-${wordIdx}`} className="word-group">
                {word.split('').map((char) => {
                  const isRevealed = guessedLetters.includes(char);
                  const id = globalIndex++;
                  return (
                    <div key={id} className="letter-box">
                      {isRevealed ? char : ''}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="keyboard">
            {keyboardRows.map((row, rowIndex) => (
              <div key={rowIndex} className="keyboard-row">
                {row.map(letter => {
                  const isGuessed = guessedLetters.includes(letter);
                  return (
                    <button
                      key={letter}
                      className="key-btn"
                      disabled={isGuessed || !isMyTurn}
                      onClick={() => handleLetterClick(letter)}
                    >
                      {letter}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {isGuessing ? (
            <div className="guess-input-container">
              <input
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="GUESS..."
                className="guess-input"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitGuess();
                  if (e.key === 'Escape') setIsGuessing(false);
                }}
              />
              <button className="guess-submit-btn" onClick={submitGuess}>✓</button>
              <button className="guess-cancel-btn" onClick={() => setIsGuessing(false)}>✕</button>
            </div>
          ) : (
            <button className="guess-word-btn" onClick={() => { setIsGuessing(true); setGuessInput(''); }} disabled={!isMyTurn}>GUESS WORD</button>
          )}
        </div>

        <div className={`hangman-side ${!isMyTurn ? 'active-turn at-enemy' : ''}`}>
          <div className="hangman-side-top">
            <img src={AVATARS[oppAvatar] || AVATARS[1]} alt="avatar" style={{ width: '50px', filter: 'drop-shadow(0 0 10px rgba(255,107,107,0.5))' }} />
            <span className="player-id" style={{ margin: 0 }}>@{oppUsername}</span>
          </div>
          <span className="player-score">Score: {scores.opp}/3</span>
          <GallowsSVG errors={oppErrors} />
          <span className="error-count" style={{ color: oppErrors >= 5 ? '#ff6b6b' : '#aaa' }}>Errors: {oppErrors}/6</span>
        </div>

      </div>
    </div>
  );
}