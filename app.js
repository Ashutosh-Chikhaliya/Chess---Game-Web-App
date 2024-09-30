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
let currentPlayer = "w";
let whiteTime = 600;
let blackTime = 600;
let isWhiteTurn = true;
let timerInterval = null;

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.render("index", { title: "chess game" });
});

io.on("connection", function (uniquesocket) {
  console.log("connected");

  if (!players.white) {
    players.white = uniquesocket.id;
    uniquesocket.emit("playerRole", "w");
  } else if (!players.black) {
    players.black = uniquesocket.id;
    uniquesocket.emit("playerRole", "b");
  } else {
    uniquesocket.emit("spectatorRole");
  }

  // Notify clients when both players are connected
  if (players.white && players.black) {
    io.emit("bothPlayersConnected");
    startGameTimer();
  }

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

  uniquesocket.on("disconnected", function () {
    if (uniquesocket.id == players.white) {
      delete players.white;
    } else if (uniquesocket.id == players.black) {
      delete players.black;
    }
  });
});

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
    }
  }, 1000);
};

const switchTurn = () => {
  isWhiteTurn = !isWhiteTurn;
  startGameTimer(); // Restart the timer for the next player's turn
};

server.listen(3000, () => {
  console.log("server running...");
});
