import React, { useEffect, useState } from 'react';
import './style/Warning.css';

export function Warning({ message, onClose }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 500);
      }, 4000); 
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message && !isVisible) return null;

  return (
    <div className={`warning-container ${isVisible ? 'fade-in' : 'fade-out'}`}>
      <div className="warning-content">
        <span className="warning-icon">⚠️</span>
        <p>{message}</p>
      </div>
    </div>
  );
}