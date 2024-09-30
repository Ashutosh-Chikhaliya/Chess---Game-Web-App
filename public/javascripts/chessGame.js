const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");

let sourceSquare = null;
let playerRole = null;
let legalMoves = [];
let timerInterval = null;

const showLegalMoves = (row, col) => {
  const fromSquare = `${String.fromCharCode(97 + col)}${8 - row}`;
  const moves = chess.moves({ square: fromSquare, verbose: true });

  legalMoves = moves.map((move) => {
    const targetCol = move.to.charCodeAt(0) - 97;
    const targetRow = 8 - parseInt(move.to[1]);
    return { row: targetRow, col: targetCol };
  });

  sourceSquare = { row, col };
  renderBoard();
};

const handleMove = (source, target) => {
  const move = {
    from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
    to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
    promotion: "q",
  };

  socket.emit("move", move);

  // Clear legal moves after the move
  legalMoves = [];
  renderBoard();
};

const getPieceUnicode = (piece) => {
  const unicodePiece = {
    p: "♟",
    r: "♜",
    n: "♞",
    b: "♝",
    q: "♛",
    k: "♚",
    P: "♟︎",
    R: "♖",
    N: "♘",
    B: "♗",
    Q: "♕",
    K: "♔",
  };

  return unicodePiece[piece.type] || "";
};

// timer
socket.on("timeUpdate", ({ whiteTime, blackTime }) => {
  if (playerRole === "w") {
    document.getElementById("white-timer").innerText = formatTime(whiteTime);
    document.getElementById("black-timer").innerText = formatTime(blackTime);

    if (chess.turn() === "w") {
      document.getElementById("white-timer").style.backgroundColor = "red";
      document.getElementById("black-timer").style.backgroundColor = "grey";
    } else {
      document.getElementById("white-timer").style.backgroundColor = "grey";
      document.getElementById("black-timer").style.backgroundColor = "red";
    }
  } else {
    document.getElementById("white-timer").innerText = formatTime(blackTime);
    document.getElementById("black-timer").innerText = formatTime(whiteTime);

    if (chess.turn() === "b") {
      document.getElementById("white-timer").style.backgroundColor = "red";
      document.getElementById("black-timer").style.backgroundColor = "grey";
    } else {
      document.getElementById("white-timer").style.backgroundColor = "grey";
      document.getElementById("black-timer").style.backgroundColor = "red";
    }
  }
});

const formatTime = (time) => {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

socket.on("playerRole", (role) => {
  playerRole = role;

  if (playerRole === "w") {
    document.getElementById("white-player").innerText = "Opponent (Black)";
    document.getElementById("black-player").innerText = "You (White)";
  } else {
    document.getElementById("white-player").innerText = "Opponent (white)";
    document.getElementById("black-player").innerText = "You (black)";
  }
  renderBoard();
});

socket.on("spectatorRole", () => {
  playerRole = null;
  renderBoard();
});

socket.on("boardState", (fen) => {
  chess.load(fen);
  renderBoard();
});

socket.on("move", (move) => {
  chess.move(move);
  renderBoard();

  if (chess.game_over()) {
    if (chess.in_checkmate()) {
      const winner = chess.turn() === "w" ? "Black" : "White"; // Winner is the opposite of the current turn
      socket.emit("gameOver", `${winner} wins by checkmate`);
    } else if (chess.in_stalemate()) {
      socket.emit("gameOver", "The game is a draw by stalemate");
    } else if (chess.in_draw()) {
      socket.emit("gameOver", "The game is a draw");
    } else if (chess.insufficient_material()) {
      socket.emit(
        "gameOver",
        "The game is a draw due to insufficient material"
      );
    }
  }
});

socket.on("bothPlayersConnected", () => {
  renderBoard();
});

// show winner
socket.on("gameOver", (message) => {
  document.getElementById("winner-message").innerText = message;
  document.getElementById("winner-message").style.display = "block";
  clearInterval(timerInterval);

  boardElement.classList.add("game-over");
});

const renderBoard = () => {
  const board = chess.board();
  boardElement.innerHTML = "";

  board.forEach((row, rowindex) => {
    row.forEach((square, squareindex) => {
      const squareElement = document.createElement("div");
      squareElement.classList.add(
        "square",
        (rowindex + squareindex) % 2 === 0 ? "light" : "dark"
      );

      squareElement.dataset.row = rowindex;
      squareElement.dataset.col = squareindex;

      // Highlight the king if it's in check
      if (
        chess.in_check() &&
        square &&
        square.type === "k" &&
        square.color === chess.turn()
      ) {
        squareElement.classList.add("in-check");
      }

      if (square) {
        const pieceElement = document.createElement("div");
        pieceElement.classList.add(
          "piece",
          square.color === "w" ? "white" : "black"
        );
        pieceElement.innerText = getPieceUnicode(square);
        pieceElement.draggable = playerRole === square.color;

        pieceElement.addEventListener("dragstart", (e) => {
          if (pieceElement.draggable) {
            sourceSquare = { row: rowindex, col: squareindex };
            e.dataTransfer.setData("text/plain", "");
            e.dataTransfer.effectAllowed = "move";
          }
        });

        pieceElement.addEventListener("dragend", () => {
          sourceSquare = null; // Reset source square on drag end
        });

        pieceElement.addEventListener("click", () => {
          if (pieceElement.draggable) {
            showLegalMoves(rowindex, squareindex); // Show legal moves on piece click
          }
        });

        squareElement.appendChild(pieceElement);
      }

      // Highlight legal moves with a dot
      const isLegalMove = legalMoves.some(
        (move) => move.row === rowindex && move.col === squareindex
      );
      if (isLegalMove) {
        const dotElement = document.createElement("div");
        dotElement.classList.add("legal-move-dot");

        dotElement.addEventListener("click", () => {
          handleMove(sourceSquare, { row: rowindex, col: squareindex });
        });

        squareElement.appendChild(dotElement);
      }

      // Handle drop event for moving pieces
      squareElement.addEventListener("dragover", (e) => {
        e.preventDefault(); // Allow the drop
      });

      squareElement.addEventListener("drop", (e) => {
        e.preventDefault();
        if (sourceSquare) {
          handleMove(sourceSquare, { row: rowindex, col: squareindex });
        }
      });

      boardElement.appendChild(squareElement);
    });
  });

  if (playerRole === "b") {
    boardElement.classList.add("flipped");
  } else {
    boardElement.classList.remove("flipped");
  }
};

renderBoard();
