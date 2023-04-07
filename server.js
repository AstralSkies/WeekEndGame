// Constants
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const screenWidth = window.innerWidth;
const screenHeight = window.innerHeight;
const canvasWidth = canvas.width;
const canvasHeight = canvas.height;
canvas.style.marginLeft = "auto";
canvas.style.marginRight = "auto";
canvas.style.marginTop = (screenHeight - canvasHeight) / 2 + "px";

canvas.focus(); // Focus the canvas to enable keyboard input

const SERVER_URL = "ws://localhost:8080";
const GRID_SIZE = 50;

let socket;
let myId;
let otherPlayers = {};
let otherLasers = {};
let score = 0;

const tileSize = 32;
const playerColor = "purple";

let player = {
  x: 5,
  y: 5,
  color: playerColor,
  score: 0, // Add score to the player
  isShot: false,
};

let x = 0;
let y = 0;

const lasers = [];

// Variables
let lastFacingDirection = "right";

// Functions
function isoTo2D(x, y) {
  const offsetX = canvas.width / 2;
  const offsetY = canvas.height / 2 - tileSize * 2;
  return {
    x: x - y + offsetX,
    y: (x + y) / 2 + offsetY,
  };
}

function drawTile(x, y, color, size = tileSize, opacity = 1) {
  const pos = isoTo2D(x * size, y * size);

  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  ctx.lineTo(pos.x + size / 2, pos.y + size / 4);
  ctx.lineTo(pos.x, pos.y + size / 2);
  ctx.lineTo(pos.x - size / 2, pos.y + size / 4);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.globalAlpha = opacity; // Set the globalAlpha to the provided opacity
  ctx.fill();
  ctx.globalAlpha = 1; // Reset the globalAlpha back to 1
}

// Collision detection
function isColliding(x, y) {
  if (x < 0 || x > 10 || y < 0 || y > 10) {
    return true;
  }

  return false;
}
function isPlayerColliding(x, y) {
  for (const id in otherPlayers) {
    const otherPlayer = otherPlayers[id];
    if (otherPlayer.x === x && otherPlayer.y === y) {
      console.log("Player is colliding");
      return otherPlayer;
    }
  }
  return false;
}

function handleKeydown(event) {
  let oldX = player.x;
  let oldY = player.y;

  switch (event.key) {
    case "ArrowUp":
      event.preventDefault();
      player.y--;
      lastFacingDirection = "up";
      break;
    case "ArrowDown":
      event.preventDefault();
      player.y++;
      lastFacingDirection = "down";
      break;
    case "ArrowLeft":
      event.preventDefault();
      player.x--;
      lastFacingDirection = "left";
      break;
    case "ArrowRight":
      event.preventDefault();
      player.x++;
      lastFacingDirection = "right";
      break;
  }

  if (
    isColliding(player.x, player.y) ||
    isPlayerColliding(player.x, player.y)
  ) {
    player.x = oldX;
    player.y = oldY;
  } else {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "update",
          x: player.x,
          y: player.y,
          color: player.color === playerColor ? "purple" : player.color,
          score: player.score, // Include the player's score
        })
      );
    }
  }
}

let touchStartX = null;
let touchStartY = null;

function handleTouchStart(event) {
  event.preventDefault();
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
}

function handleTouchMove(event) {
  event.preventDefault();
  const touchMoveX = event.touches[0].clientX;
  const touchMoveY = event.touches[0].clientY;

  const touchDiffX = touchMoveX - touchStartX;
  const touchDiffY = touchMoveY - touchStartY;

  const moveThreshold = 30; // Threshold to determine when to move the player

  let dx = 0;
  let dy = 0;

  if (Math.abs(touchDiffX) > Math.abs(touchDiffY)) {
    if (touchDiffX > moveThreshold) {
      dx = 1;
      lastFacingDirection = "right";
    } else if (touchDiffX < -moveThreshold) {
      dx = -1;
      lastFacingDirection = "left";
    }
  } else {
    if (touchDiffY > moveThreshold) {
      dy = 1;
      lastFacingDirection = "down";
    } else if (touchDiffY < -moveThreshold) {
      dy = -1;
      lastFacingDirection = "up";
    }
  }

  if (dx !== 0 || dy !== 0) {
    // Only update the touch start position if we're actually moving the player
    touchStartX = touchMoveX;
    touchStartY = touchMoveY;

    const newX = player.x + dx;
    const newY = player.y + dy;

    if (!isColliding(newX, newY)) {
      player.x = newX;
      player.y = newY;
    }
  }

  // Direction detection
  switch (lastFacingDirection) {
    case "up":
      player.color = "red";
      break;
    case "down":
      player.color = "blue";
      break;
    case "left":
      player.color = "yellow";
      break;
    case "right":
      player.color = "purple";
      break;
  }
}

function drawText(text, x, y, color = "black") {
  ctx.fillStyle = color;
  ctx.font = "30px Arial";
  ctx.fillText(text, x, y);
}
function shootLasers() {
  // Store the direction in which the laser was fired
  const firingDirection = lastFacingDirection;

  const laser = {
    x: player.x,
    y: player.y,
    color: player.color,
    intervalId: null,
    direction: firingDirection, // Add the direction property to the laser
    player: player.id, // Add the player property to the laser
  };

  // Set up interval to move the laser
  laser.intervalId = setInterval(function () {
    moveLaser(laser);
  }, 100);

  // Add the laser object to the lasers array
  lasers.push(laser);
}

function drawLaser(laser) {
  const { x, y, color, direction } = laser;
  const laserWidth = 4;
  const laserHeight = 12;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(direction);
  ctx.fillStyle = "green";
  ctx.fillRect(-laserWidth / 2, -laserHeight / 2, laserWidth, laserHeight);
  ctx.restore();
}

function moveLaser(laser) {
  const dx =
    laser.direction === "left" ? -1 : laser.direction === "right" ? 1 : 0;
  const dy = laser.direction === "up" ? -1 : laser.direction === "down" ? 1 : 0;
  laser.x += dx;
  laser.y += dy;

  drawTile(laser.x, laser.y, laser.color);

  // Check if the laser is one of the other player's lasers
  if (laser.id in otherLasers) {
    // Update the position of the other player's laser
    otherLasers[laser.id].x = laser.x;
    otherLasers[laser.id].y = laser.y;
  }

  // Send the laser position update to the server
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "laser_position_update",
        id: laser.id,
        x: laser.x,
        y: laser.y,
        direction: laser.direction,
        id: player.id,
        color: laser.color === playerColor ? "yellow" : laser.color,
      })
    );
  }

  // Check if the laser has gone outside the game board
  if (laser.y < 0 || laser.y > 10 || laser.x < 0 || laser.x > 10) {
    clearInterval(laser.intervalId);
    delete otherLasers[laser.id]; // Remove the other player's laser from the object
    lasers.splice(lasers.indexOf(laser), 1);
    return;
  }

  // Check if the laser has collided with another player
  const otherPlayer = isPlayerColliding(laser.x, laser.y);
  if (otherPlayer) {
    handleLaserCollision(laser, otherPlayer);
  }
}

function handleLaserCollision(laser, otherPlayer) {
  // Increase the player's score
  player.score++;

  // Clear the interval and remove the laser from the array
  clearInterval(laser.intervalId);
  lasers.splice(lasers.indexOf(laser), 1);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the player's laser
  drawLaser(myLaser);

  // Draw other players' lasers
  for (const id in otherLasers) {
    const otherLaser = otherLasers[id];
    drawLaser(otherLaser);
  }

  // Continue to update the canvas
  requestAnimationFrame(draw);
}



function gameLoop() {
  draw();
  requestAnimationFrame(gameLoop);
  drawText(`Last facing direction: ${lastFacingDirection}`, 10, 100);
  drawText(`Your score: ${player.score}`, 10, 50);
}

// Event listeners

canvas.addEventListener("keydown", handleKeydown);
canvas.addEventListener("keydown", (event) => {
  if (event.key === " ") {
    shootLasers();
  }
});
const fireButton = document.getElementById("fireButton");
fireButton.addEventListener("touchstart", (event) => {
  event.preventDefault(); // Prevent the button from stealing focus
  shootLasers();
});
rightButton.addEventListener("touchstart", (event) => {
  event.preventDefault(); // Prevent the button from stealing focus
  const newX = player.x + 1;
  if (!isColliding(newX, player.y)) {
    player.x = newX;
    lastFacingDirection = "right";
  }
});

leftButton.addEventListener("touchstart", (event) => {
  event.preventDefault(); // Prevent the button from stealing focus
  const newX = player.x - 1;
  if (!isColliding(newX, player.y)) {
    player.x = newX;
    lastFacingDirection = "left";
  }
});

upButton.addEventListener("touchstart", (event) => {
  event.preventDefault(); // Prevent the button from stealing focus
  const newY = player.y - 1;
  if (!isColliding(player.x, newY)) {
    player.y = newY;
    lastFacingDirection = "up";
  }
});

downButton.addEventListener("touchstart", (event) => {
  event.preventDefault(); // Prevent the button from stealing focus
  const newY = player.y + 1;
  if (!isColliding(player.x, newY)) {
    player.y = newY;
    lastFacingDirection = "down";
  }
});


function connect() {
  socket = new WebSocket(SERVER_URL);
  socket.onopen = onOpen;
  socket.addEventListener("message", onMessage);
  socket.addEventListener("close", onClose);
  socket.addEventListener("error", onError);
}

function onOpen() {
  console.log("Connected to the server");

  // Initialize the player's position and send it to the server
  const x = Math.floor(Math.random() * 10) * GRID_SIZE;
  const y = Math.floor(Math.random() * 10) * GRID_SIZE;
  const initData = JSON.stringify({ type: "init", x, y });
  socket.send(initData);
}

function onMessage(event) {
  const receivedMessage = JSON.parse(event.data);

  switch (receivedMessage.type) {
    case "init":
      player.id = receivedMessage.id;
      console.log(`My id is ${player.id}`);
      break;
    case "update":
      updateOtherPlayer(receivedMessage);
      break;
    case "disconnect":
      removeDisconnectedPlayer(receivedMessage);
      break;
    case "player_shot":
      handlePlayerShot(receivedMessage);
      break;
    case "lasers_shot":
      break;

    // laser position update
    case "laser_position_update":
      handleLaserPositionUpdate(receivedMessage);
      break;
    default:
      console.warn(`Unknown message type: ${receivedMessage.type}`);
  }
}

function onClose() {
  console.log("Disconnected from the server");
  setTimeout(connect, 1000);
}

function onError(error) {
  console.error("WebSocket error:", error);
}

function updateOtherPlayer(playerData) {
  console.log("Updating other player", playerData);
  otherPlayers[playerData.id] = playerData;
}

function removeDisconnectedPlayer(playerData) {
  delete otherPlayers[playerData.id];
}
function handleLaserPositionUpdate(message) {
  
  console.log("Received laser position update", message.id, player.id);
  if(message.id === player.id) return; // Ignore the laser position update if it's from the current player (the player's laser is handled in the shootLasers() function
  otherLasers[message.id] = {
    id: message.id, // Add the id property
    x: message.x,
    y: message.y,
    color: message.color, // Add the color property
    direction: message.direction // Include the direction property for otherLasers
  };
}




connect();

window.onload = function () {
  canvas.focus();
};

gameLoop();
