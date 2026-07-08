import React, { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, maxUint256 } from 'viem';
import { GAME_ESCROW_ADDRESS, gameEscrowABI, erc20ABI } from '../config/contractConfig';
import { USDC_ADDRESS } from '../config/viemConfig';
import './style/InvitePopup.css';
const backendUrl = process.env.REACT_APP_BACKEND_URL;

export function InvitePopup({ onNavigate, showWarning }) {
  const { address, isConnected } = useAccount();
  const [inviteRoom, setInviteRoom] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const hasCheckedUrl = useRef(false);

  useEffect(() => {
    if (hasCheckedUrl.current) return;
    hasCheckedUrl.current = true;

    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    
    if (joinId) {
      window.history.replaceState({}, document.title, window.location.pathname);

      fetch(`${backendUrl}/rooms/${joinId}`)
        .then(res => {
          if (!res.ok) throw new Error("Room not found");
          return res.json();
        })
        .then(data => {
          if (data && data.status === 'waiting') {
            setInviteRoom(data);
          } else {
            if (showWarning) showWarning("This room is already full or has started.");
          }
        })
        .catch(err => {
          if (showWarning) showWarning("Invalid or expired invite link.");
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (inviteRoom && address && inviteRoom.creatorAddress?.toLowerCase() === address.toLowerCase()) {
      setInviteRoom(null);
      if (onNavigate) onNavigate('room', inviteRoom);
    }
  }, [inviteRoom, address, onNavigate]);

  
  const handleAccept = async () => {
    if (!isConnected) {
      if (showWarning) showWarning("Please connect your wallet from the top menu first!");
      return;
    }
    if (!inviteRoom) return;
    setIsJoining(true);
    
    try {
      const betAmount = parseUnits(String(inviteRoom.bet), 6);
      
      const allowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: erc20ABI,
        functionName: 'allowance',
        args: [address, GAME_ESCROW_ADDRESS]
      });
      
      if (allowance < betAmount) {
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS, abi: erc20ABI,
          functionName: 'approve', args: [GAME_ESCROW_ADDRESS, maxUint256]
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      const joinHash = await writeContractAsync({
        address: GAME_ESCROW_ADDRESS, abi: gameEscrowABI,
        functionName: 'lockBet', args: [inviteRoom.gameId, betAmount]
      });
      await publicClient.waitForTransactionReceipt({ hash: joinHash });

      const profileData = localStorage.getItem(`profile_${address}`);
      const username = profileData ? JSON.parse(profileData).username : 'Player';

      const res = await fetch(`${backendUrl}/rooms/${inviteRoom.gameId}/join`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opponentUsername: username, opponentAddress: address })
      });

      if (!res.ok) throw new Error("Failed to join room on server.");
      const updatedRoom = await res.json();
      
      setInviteRoom(null);
      if (onNavigate) onNavigate('room', updatedRoom);
      
    } catch (error) {
      console.error(error);
      if (showWarning) {
        if (error.message.includes('User rejected')) showWarning("Transaction rejected.");
        else showWarning("Failed to join room: " + (error.shortMessage || error.message));
      }
    }
    setIsJoining(false);
  };

  const handleClose = () => {
    setInviteRoom(null);
  };

  if (!inviteRoom) return null;

  return (
    <div className="invite-overlay">
      <div className="invite-box">
        <h2>Game Invite!</h2>
        <p><strong>Creator:</strong> <span style={{ color: '#32e2b2' }}>@{inviteRoom.creatorUsername}</span></p>
        <p><strong>Game:</strong> {inviteRoom.game}</p>
        <p style={{ marginBottom: '30px' }}><strong>Bet:</strong> <span style={{ color: '#ebca76' }}>{inviteRoom.bet} USDC</span></p>
        
        <div className="ib-invite-buttons">
          <button 
            className="ib-accept-btn" 
            onClick={handleAccept} 
            disabled={isJoining}
          >
            {isJoining ? 'JOINING...' : (!isConnected ? 'CONNECT WALLET FIRST' : 'ACCEPT & PAY')}
          </button>
          <button 
            className="ib-decline-btn" 
            onClick={handleClose} 
            disabled={isJoining}
          >
            DECLINE
          </button>
        </div>
      </div>
    </div>
  );
}