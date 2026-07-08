import React, { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { socket } from '../pages/socket';
import './style/GlobalChat.css';
const backendUrl = process.env.REACT_APP_BACKEND_URL;

export function GlobalChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [unread, setUnread] = useState(0);
    const [username, setUsername] = useState('Player');
    const { address } = useAccount();
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (address) {
            const p = localStorage.getItem(`profile_${address}`);
            if (p) setUsername(JSON.parse(p).username);
        }
    }, [address]);

    useEffect(() => {
        fetch(`${backendUrl}/chat`)
            .then(res => res.json())
            .then(data => setMessages(data))
            .catch(err => console.error("Chat load error:", err));

        if (!socket.connected) socket.connect();

        const onReceiveChat = (msg) => {
            setMessages(prev => [...prev, msg]);
            if (!isOpen) {
                setUnread(prev => prev + 1);
            }
        };

        socket.on('receive_global_chat', onReceiveChat);
        return () => socket.off('receive_global_chat', onReceiveChat);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            setUnread(0);
        }
    }, [messages, isOpen]);

    const handleSend = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        socket.emit('send_global_chat', { sender: username, text: newMessage.trim() });
        setNewMessage('');
    };

    const formatTime = (ts) => {
        return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="global-chat-container">
            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <h3><span>🌐</span> Global Chat</h3>
                        <button onClick={() => setIsOpen(false)} className="close-chat-btn">×</button>
                    </div>
                    <div className="chat-body">
                        {messages.length === 0 ? <p className="chat-empty">No messages in the last hour...</p> : null}
                        {messages.map(msg => (
                            <div key={msg.id} className={`chat-message ${msg.sender === username ? 'me' : 'other'}`}>
                                <span className="chat-sender">{msg.sender}</span>
                                <span className="chat-text">{msg.text}</span>
                                <span className="chat-time">{formatTime(msg.timestamp)}</span>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                    <form className="chat-input-area" onSubmit={handleSend}>
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." maxLength={100} />
                        <button type="submit" disabled={!newMessage.trim()}>SEND</button>
                    </form>
                </div>
            )}

            <button className="chat-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
                💬
                {unread > 0 && !isOpen && <span className="unread-badge">{unread}</span>}
            </button>
        </div>
    );
}