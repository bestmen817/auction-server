const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Настройка CORS для работы с Telegram Mini App и веб-клиентами
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Базовый эндпоинт для проверки работы сервера
app.get('/', (req, res) => {
  res.send('Auction Server is running!');
});

// Хранилище комнат аукциона в памяти сервера
const rooms = {};

io.on('connection', (socket) => {
  console.log('Пользователь подключился:', socket.id);

  // Вход в комнату аукциона
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
    
    // Сообщаем всем в комнате текущее состояние
    io.to(roomId).emit('roomState', rooms[roomId]);
    console.log(`${username} вошел в комнату ${roomId}`);
  });

  // Обработка ставки
  socket.on('placeBid', ({ roomId, amount }) => {
    const room = rooms[roomId];
    if (!room) return;

    const player = room.players[socket.id];
    if (player && player.coins >= amount) {
      if (amount > room.currentBid) {
        room.currentBid = amount;
        room.highestBidder = player.username;
      }
      
      // Рассылаем обновленную ставку всем участникам комнаты
      io.to(roomId).emit('bidUpdated', {
        currentBid: room.currentBid,
        highestBidder: room.highestBidder
      });
    }
  });

  // Отключение пользователя
  socket.on('disconnect', () => {
    console.log('Пользователь отключился:', socket.id);
  });
});

// Порт назначается автоматически платформой Render или берется 3000 по умолчанию
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
