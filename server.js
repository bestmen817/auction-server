const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Хранилище комнат
let rooms = {};

// Список лотов (машины и их стоимость/очки)
const CAR_LOTS = [
    { name: "BMW M5 CS", value: 1000 },
    { name: "Porsche 911 GT3 RS", value: 1500 },
    { name: "Lamborghini Revuelto", value: 2000 },
    { name: "Ferrari SF90", value: 2500 },
    { name: "Bugatti Chiron", value: 5000 }
];

io.on('connection', (socket) => {
    // Подключение к комнате
    socket.on('joinRoom', ({ roomId, username }) => {
        socket.join(roomId);

        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: [],
                bets: {},
                round: 0
            };
        }

        const room = rooms[roomId];

        // Добавляем игрока (максимум 2)
        if (room.players.length < 2) {
            room.players.push({
                id: socket.id,
                username: username || `Игрок ${room.players.length + 1}`,
                coins: 500, // Стартовый баланс
                score: 0,   // Очки за ценность машин
                garage: []  // Выигранные машины
            });
        }

        // Если собрались 2 игрока — старт первого раунда
        if (room.players.length === 2) {
            startNextRound(roomId);
        } else {
            socket.emit('waitingForOpponent');
        }
    });

    // Приём ставки
    socket.on('placeBet', ({ roomId, bet }) => {
        const room = rooms[roomId];
        if (!room) return;

        const player = room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Валидация: нельзя поставить больше, чем есть
        const finalBet = Math.min(Math.max(0, parseInt(bet) || 0), player.coins);
        room.bets[socket.id] = finalBet;

        // Если оба сделали ставки — определяем победителя
        if (Object.keys(room.bets).length === 2) {
            evaluateRound(roomId);
        } else {
            socket.to(roomId).emit('opponentBetted');
        }
    });

    socket.on('disconnect', () => {
        // Логика при выходе игрока
    });
});

function startNextRound(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    room.round += 1;
    room.bets = {};

    // Выбираем случайную машину для раунда
    const currentLot = CAR_LOTS[Math.floor(Math.random() * CAR_LOTS.length)];
    room.currentLot = currentLot;

    io.to(roomId).emit('roundStart', {
        round: room.round,
        lot: currentLot,
        players: room.players.map(p => ({ username: p.username, coins: p.coins, score: p.score }))
    });
}

function evaluateRound(roomId) {
    const room = rooms[roomId];
    const p1 = room.players[0];
    const p2 = room.players[1];

    const bet1 = room.bets[p1.id];
    const bet2 = room.bets[p2.id];

    let winner = null;

    if (bet1 > bet2) {
        winner = p1;
        p1.coins -= bet1; // Сгорает ставка у победителя
        p1.score += room.currentLot.value;
        p1.garage.push(room.currentLot.name);
    } else if (bet2 > bet1) {
        winner = p2;
        p2.coins -= bet2; // Сгорает ставка у победителя
        p2.score += room.currentLot.value;
        p2.garage.push(room.currentLot.name);
    } else {
        // Ничья: монеты ни у кого не сгорают
    }

    io.to(roomId).emit('roundResult', {
        winner: winner ? winner.username : "Ничья",
        bets: { [p1.username]: bet1, [p2.username]: bet2 },
        players: room.players.map(p => ({ username: p.username, coins: p.coins, score: p.score, garage: p.garage }))
    });

    // Следующий раунд через 5 секунд
    setTimeout(() => {
        if (room.round < 5) {
            startNextRound(roomId);
        } else {
            // Конец игры
            let finalWinner = p1.score > p2.score ? p1.username : (p2.score > p1.score ? p2.username : "Ничья");
            io.to(roomId).emit('gameOver', { winner: finalWinner, players: room.players });
            delete rooms[roomId];
        }
    }, 5000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
