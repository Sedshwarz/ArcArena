import React, { useState } from 'react';
import './style/FAQ.css';

const faqData = [
  {
    question: "What is ArcArena?",
    answer: "ArcArena is a decentralized Web3 competitive arcade gaming platform. You can play classic arcade games against other players and win USDC by betting on your skills."
  },
  {
    question: "How do I start playing?",
    answer: "First, connect your Web3 wallet (like MetaMask) and switch to the Arc Testnet. Create your unique player profile, then you can either create a new room with a set bet or join an existing room from the Lobby."
  },
  {
    question: "Is it free to play?",
    answer: "ArcArena requires a USDC wager to join competitive rooms. When you win a match, you claim the total prize pool (your bet + your opponent's bet). Make sure you have testnet USDC in your wallet!"
  },
  {
    question: "How can I load balance to my wallet?",
    answer: "To play on ArcArena, you need testnet USDC. You can easily fund your wallet by requesting test tokens from the official Arc Testnet Faucet. Once you receive your tokens, you can start placing bets immediately!"
  },
  {
    question: "How can I play with a friend?",
    answer: "It's very simple! When creating a room, switch the setting to 'PRIVATE ROOM'. Once your room is created, click the 'COPY INVITE LINK' button and send the link to your friend. As soon as they open the link, they will see a direct invite to join your game."
  },
  {
    question: "How does the betting and claiming work?",
    answer: "When a room is created, the wager (in USDC) is securely locked in our Escrow Smart Contract. Once the game ends, the server generates a cryptographic signature for the winner, allowing them to claim the prize safely."
  },
  {
    question: "What happens if I or my opponent leaves early?",
    answer: "If a player leaves an active room before the match is resolved, a 5% penalty (slash) is applied to their locked funds to ensure fair play. The remaining player can then safely reclaim their bet or claim the win."
  },
  {
    question: "Are my funds secure?",
    answer: "Absolutely! Your bets are locked in a verified Smart Contract on the blockchain. Funds cannot be accessed by anyone (not even us) and can only be released to the legitimate winner according to the game's rules."
  }
];

export function FAQ({ onNavigate }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [isFadingOut, setIsFadingOut] = useState(false);

  const toggleAccordion = (index) => {
    setActiveIndex(activeIndex === index ? null : index);
  };

  const handleBack = () => {
    setIsFadingOut(true);
    setTimeout(() => {
      onNavigate('home');
    }, 500);
  };

  return (
    <div className={`faq-page-container ${isFadingOut ? 'fade-out' : 'fade-in'}`}>
      <div className="back-nav-button">
        <div className="back-button" onClick={handleBack}>BACK</div>
      </div>
      <br/>
      <h2 className="faq-title">Frequently Asked Questions</h2>
        <div className="faq-list">
          {faqData.map((faq, index) => {
            const isOpen = activeIndex === index;
            return (
              <div className={`faq-item ${isOpen ? 'open' : ''}`} key={index}>
                <div className="faq-question" onClick={() => toggleAccordion(index)}>
                  <span>{faq.question}</span>
                  <span className="faq-icon">{isOpen ? '−' : '+'}</span>
                </div>
                <div className="faq-answer">
                  <div className="faq-answer-inner">
                    {faq.answer}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
    </div>
  );
}