# 🎭 Omegle Clone - Anonymous Video Chat

A real-time anonymous chat application with text and video support using WebRTC.

## 🏗️ System Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   User A        │         │   User B        │
│   (Browser)     │         │   (Browser)     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ WebSocket                 │ WebSocket
         │ (Socket.IO)               │ (Socket.IO)
         │                           │
         └───────────┬───────────────┘
                     │
              ┌──────▼──────┐
              │   Backend   │
              │  (Node.js)  │
              │  Socket.IO  │
              │   Server    │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  User Queue │
              │  & Matching │
              └─────────────┘

WebRTC Flow (Peer-to-Peer Video):
┌──────────┐    Signaling     ┌──────────┐
│  User A  │◄────(via WS)────►│  User B  │
│          │                  │          │
│          │◄──── Media ─────►│          │
│          │   (P2P Direct)   │          │
└──────────┘                  └──────────┘
```

## 📁 Project Structure

```
omegle-clone/
├── backend/
│   ├── server.js           # Main server with Socket.IO
│   ├── matchmaking.js      # User queue & matching logic
│   ├── moderation.js       # Rate limiting & reports
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatBox.jsx
│   │   │   ├── VideoPlayer.jsx
│   │   │   └── Controls.jsx
│   │   ├── hooks/
│   │   │   ├── useSocket.js
│   │   │   └── useWebRTC.js
│   │   ├── App.jsx
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🚀 Quick Start

### Backend
```bash
cd backend
npm install
npm start
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🔧 WebRTC Signaling Flow

1. **User A** joins → added to waiting queue
2. **User B** joins → matched with User A
3. Server sends `matched` event to both users
4. **User A** creates WebRTC offer → sends via Socket.IO
5. Server relays offer to **User B**
6. **User B** creates answer → sends via Socket.IO
7. Server relays answer to **User A**
8. ICE candidates exchanged via Socket.IO
9. **Direct P2P connection established** for video/audio

## 🌐 STUN/TURN Servers

- **STUN**: Helps discover public IP address (free Google STUN used)
- **TURN**: Relays traffic when P2P fails (needed for strict NATs)

## 📦 Deployment

- **Frontend**: Vercel / Netlify
- **Backend**: Render / Railway / AWS EC2
- **TURN Server**: Twilio / Metered.ca (for production)
