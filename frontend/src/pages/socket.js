import { io } from 'socket.io-client';

const backendUrl = process.env.REACT_APP_BACKEND_URL;
const URL = backendUrl;

export const socket = io( URL, { 
    transports: ['websocket'], 
    autoConnect: true 
});