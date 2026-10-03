const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.get('/', (req, res) => {
  res.send('Auction Server is running!');
});

// Хранилище комнат в памяти
const rooms = {};

io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Создание или присоединение к комнате
  socket.on('joinRoom', ({ roomId, username }) => {
    socket.join(roomId);
    
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: {},
        currentBid: 0,
        highestBidder: null,
        status: 'waiting'
      };
    }

    rooms[roomId].players[socket.id] = { username, coins: 1000 };
    
    io.to(roomId).emit('roomState', rooms[roomId]);
    console.log(`${username} вошел в комнату ${roomId}`);
  });

  // Ставка (слепой аукцион)
  socket.on('placeBid', ({ roomId, amount }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[socket.id];
    if (player && player.coins >= amount) {
      if (amount > room.currentBid) {
        room.currentBid = amount;
        room.highestBidder = player.username;
      }
      
      io.to(roomId).emit('bidUpdated', {
        currentBid: room.currentBid,
        highestBidder: room.highestBidder
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
