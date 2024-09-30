const express = require("express");
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require("path");
const { title } = require("process");

const app = express();
const server = http.createServer(app);

const io = socket(server);
const chess = new Chess();
let players = {};
let spectators = [];
let currentPlayer = "w";
let whiteTime = 600;
let blackTime = 600;
let isWhiteTurn = true;
let timerInterval = null;

// Function to reset the game
const resetGame = () => {
  chess.reset(); // Reset the chess board
  players = {}; // Clear players
  spectators = []; // Clear spectators list
  whiteTime = 600; // Reset timers
  blackTime = 600;
  isWhiteTurn = true;
  clearInterval(timerInterval); // Stop the timer
  timerInterval = null;
};

// start the game timer
const startGameTimer = () => {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (isWhiteTurn) {
      whiteTime--;
    } else {
      blackTime--;
    }

    io.emit("timeUpdate", { whiteTime, blackTime });

    // Stop the timer if any player's time runs out
    if (whiteTime <= 0 || blackTime <= 0) {
      clearInterval(timerInterval);
      const winner = whiteTime <= 0 ? "Black" : "White";
      io.emit("gameOver", `${winner} wins by timeout`);
      resetGame();
    }
  }, 1000);
};

const switchTurn = () => {
  isWhiteTurn = !isWhiteTurn;
  // startGameTimer(); // Restart the timer for the next player's turn
};

io.on("connection", function (uniquesocket) {
  if (!players.white) {
    players.white = uniquesocket.id;
    uniquesocket.emit("playerRole", "w");
    console.log(`white player joined : ${players.white}`);
  } else if (!players.black) {
    players.black = uniquesocket.id;
    uniquesocket.emit("playerRole", "b");
    console.log(`black player joined : ${players.black}`);
  } else {
    // Any additional connections are spectators
    spectators.push(uniquesocket.id);
    uniquesocket.emit("spectatorRole");
    console.log(`Spectator joined: ${uniquesocket.id}`);
    console.log(`Spectator : ${spectators.length}`);
  }

  // Notify clients when both players are connected
  if (players.white && players.black) {
    io.emit("bothPlayersConnected");
    startGameTimer();
  }

  // Handle player move
  uniquesocket.on("move", (move) => {
    try {
      if (chess.turn() === "w" && uniquesocket.id !== players.white) return;
      if (chess.turn() === "b" && uniquesocket.id !== players.black) return;

      const result = chess.move(move);

      if (result) {
        io.emit("move", move);
        io.emit("boardState", chess.fen());
        switchTurn();

        // Check for checkmate
        if (chess.isCheckmate()) {
          const winner = chess.turn() === "w" ? "Black" : "White";
          io.emit("gameOver", `${winner} wins by checkmate`);
          clearInterval(timerInterval);
          resetGame(); // Reset game after checkmate
        }
      } else {
        console.log("Invalid Move : ", move);
        uniquesocket.emit("invalid move", move);
      }
    } catch (err) {
      console.log(err);
      uniquesocket.emit("invalid move : ", move);
    }
  });

  // Handle player disconnection
  uniquesocket.on("disconnect", function () {
    console.log("Player disconnected:", uniquesocket.id);

    if (uniquesocket.id === players.white) {
      io.emit("gameOver", "White player disconnected. Black wins by default.");
      resetGame();
    } else if (uniquesocket.id === players.black) {
      io.emit("gameOver", "Black player disconnected. White wins by default.");
      resetGame();
    } else {
      // If a spectator disconnects, simply remove them from the spectators list
      spectators = spectators.filter((id) => id !== uniquesocket.id);
      console.log(
        "Spectator disconnected. Spectators remaining:",
        spectators.length
      );
    }
  });
});

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { title: "chess game" });
});

server.listen(3000, () => {
  console.log("server running...");
});
