(function initializeCicsFlight() {
  const WIDTH = 960;
  const HEIGHT = 320;
  const PLAYER_X = 220;
  const PLAYER_RADIUS = 15;
  const GAP = 132;
  const PILLAR_WIDTH = 76;
  const PILLAR_SPACING = 290;
  const BEST_SCORE_KEY = 'facicuse-cics-flight-best-v1';

  function mountGame(root) {
    if (!root || root.dataset.gameMounted === 'true') return;
    const canvas = root.querySelector('[data-flight-canvas]');
    const startButton = root.querySelector('[data-flight-start]');
    const pauseButton = root.querySelector('[data-flight-pause]');
    const status = root.querySelector('[data-flight-status]');
    const scoreOutput = root.querySelector('[data-flight-score]');
    const bestOutput = root.querySelector('[data-flight-best]');
    const gameOverCta = root.querySelector('[data-flight-cta]');
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !startButton || !status) return;

    root.dataset.gameMounted = 'true';
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let bestScore = 0;
    try {
      bestScore = Number(window.localStorage.getItem(BEST_SCORE_KEY)) || 0;
    } catch {
      bestScore = 0;
    }

    let score = 0;
    let playerY = HEIGHT / 2;
    let velocityY = 0;
    let obstacles = [];
    let mode = 'ready';
    let lastFrame = 0;
    let animationFrame = 0;

    if (bestOutput) bestOutput.textContent = String(bestScore);

    function drawBackground() {
      context.fillStyle = '#1c2447';
      context.fillRect(0, 0, WIDTH, HEIGHT);

      context.save();
      context.strokeStyle = 'rgba(253, 252, 248, .08)';
      context.lineWidth = 1;
      for (let x = 28; x < WIDTH; x += 48) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, HEIGHT);
        context.stroke();
      }
      context.fillStyle = 'rgba(253, 252, 248, .34)';
      [[82, 52], [385, 78], [540, 38], [855, 74], [760, 265], [95, 255]].forEach(([x, y]) => {
        context.beginPath();
        context.arc(x, y, 2, 0, Math.PI * 2);
        context.fill();
      });
      context.restore();

      context.fillStyle = '#e5b84b';
      context.fillRect(0, HEIGHT - 12, WIDTH, 12);
      context.fillStyle = '#f3f1ea';
      context.fillRect(0, HEIGHT - 7, WIDTH, 7);
    }

    function drawPillar(x, gapY, label) {
      const lowerY = gapY + GAP;
      context.fillStyle = '#f3f1ea';
      context.strokeStyle = '#e5b84b';
      context.lineWidth = 5;

      context.fillRect(x, 0, PILLAR_WIDTH, gapY - 14);
      context.strokeRect(x + 2.5, 2.5, PILLAR_WIDTH - 5, gapY - 19);
      context.fillRect(x - 8, gapY - 18, PILLAR_WIDTH + 16, 18);
      context.strokeRect(x - 5.5, gapY - 15.5, PILLAR_WIDTH + 11, 13);

      context.fillRect(x - 8, lowerY, PILLAR_WIDTH + 16, 18);
      context.strokeRect(x - 5.5, lowerY + 2.5, PILLAR_WIDTH + 11, 13);
      context.fillRect(x, lowerY + 18, PILLAR_WIDTH, HEIGHT - lowerY - 30);
      context.strokeRect(x + 2.5, lowerY + 20.5, PILLAR_WIDTH - 5, HEIGHT - lowerY - 35);

      context.fillStyle = '#1c2447';
      context.font = '700 12px Figtree, sans-serif';
      context.textAlign = 'center';
      context.fillText(label, x + PILLAR_WIDTH / 2, Math.max(28, gapY - 35));
      context.fillText('CICS', x + PILLAR_WIDTH / 2, Math.min(HEIGHT - 28, lowerY + 48));
    }

    function drawPlayer() {
      context.save();
      context.translate(PLAYER_X, playerY);
      context.rotate(Math.max(-0.35, Math.min(0.55, velocityY / 800)));
      context.fillStyle = '#e5b84b';
      context.strokeStyle = '#fdfcf8';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(-17, -10);
      context.lineTo(22, 0);
      context.lineTo(-17, 12);
      context.lineTo(-8, 1);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = '#1c2447';
      context.beginPath();
      context.arc(-5, 0, 3, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    function draw() {
      drawBackground();
      obstacles.forEach((obstacle, index) => drawPillar(obstacle.x, obstacle.gapY, `ROOM ${index + 1}`));
      drawPlayer();

      if (mode === 'ready') {
        context.fillStyle = 'rgba(28, 36, 71, .78)';
        context.fillRect(300, 118, 360, 78);
        context.fillStyle = '#fdfcf8';
        context.font = '800 24px Figtree, sans-serif';
        context.textAlign = 'center';
        context.fillText('READY FOR TAKEOFF?', WIDTH / 2, 151);
        context.font = '500 15px Figtree, sans-serif';
        context.fillText('Press Play, tap, or press Space', WIDTH / 2, 178);
      } else if (mode === 'paused') {
        context.fillStyle = 'rgba(28, 36, 71, .82)';
        context.fillRect(350, 126, 260, 62);
        context.fillStyle = '#fdfcf8';
        context.font = '800 24px Figtree, sans-serif';
        context.textAlign = 'center';
        context.fillText('PAUSED', WIDTH / 2, 165);
      }
    }

    function updateScore(nextScore) {
      score = nextScore;
      if (scoreOutput) scoreOutput.textContent = String(score);
      if (score > bestScore) {
        bestScore = score;
        if (bestOutput) bestOutput.textContent = String(bestScore);
        try {
          window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
        } catch {
          // The game remains playable when storage is unavailable.
        }
      }
    }

    function gameOver() {
      mode = 'over';
      cancelAnimationFrame(animationFrame);
      pauseButton.disabled = true;
      startButton.textContent = 'Play Again';
      status.textContent = `Nice flight! You passed ${score} room${score === 1 ? '' : 's'}. Try again or explore the real CICS spaces.`;
      if (gameOverCta) gameOverCta.hidden = false;
      draw();
    }

    function frame(now) {
      if (mode !== 'playing') return;
      const dt = Math.min((now - (lastFrame || now)) / 1000, 0.032);
      lastFrame = now;
      velocityY += 900 * dt;
      playerY += velocityY * dt;
      obstacles.forEach((obstacle) => {
        obstacle.x -= 205 * dt;
        if (!obstacle.scored && obstacle.x + PILLAR_WIDTH < PLAYER_X) {
          obstacle.scored = true;
          updateScore(score + 1);
        }
      });

      obstacles = obstacles.filter((obstacle) => obstacle.x + PILLAR_WIDTH > -10);
      if (obstacles.length < 3) {
        const rightmost = obstacles.reduce((max, item) => Math.max(max, item.x), WIDTH);
        const minGapY = 54;
        const maxGapY = HEIGHT - GAP - 54;
        obstacles.push({
          x: rightmost + PILLAR_SPACING,
          gapY: minGapY + Math.random() * (maxGapY - minGapY),
          scored: false,
        });
      }

      const hitBoundary = playerY - PLAYER_RADIUS < 8 || playerY + PLAYER_RADIUS > HEIGHT - 12;
      const hitPillar = obstacles.some((obstacle) => {
        const withinPillar = PLAYER_X + PLAYER_RADIUS > obstacle.x && PLAYER_X - PLAYER_RADIUS < obstacle.x + PILLAR_WIDTH;
        const outsideGap = playerY - PLAYER_RADIUS < obstacle.gapY || playerY + PLAYER_RADIUS > obstacle.gapY + GAP;
        return withinPillar && outsideGap;
      });

      draw();
      if (hitBoundary || hitPillar) {
        gameOver();
        return;
      }
      animationFrame = requestAnimationFrame(frame);
    }

    function flap() {
      if (mode === 'ready' || mode === 'over') {
        startGame();
        return;
      }
      if (mode === 'playing') velocityY = -330;
    }

    function startGame() {
      cancelAnimationFrame(animationFrame);
      score = 0;
      if (scoreOutput) scoreOutput.textContent = '0';
      playerY = HEIGHT / 2;
      velocityY = -260;
      obstacles = [
        { x: 565, gapY: 84, scored: false },
        { x: 565 + PILLAR_SPACING, gapY: 172, scored: false },
        { x: 565 + PILLAR_SPACING * 2, gapY: 110, scored: false },
      ];
      mode = 'playing';
      lastFrame = 0;
      startButton.textContent = 'Restart';
      pauseButton.disabled = false;
      pauseButton.textContent = 'Pause';
      status.textContent = 'Tap, click, or press Space to fly between the room pillars.';
      if (gameOverCta) gameOverCta.hidden = true;
      canvas.focus();
      animationFrame = requestAnimationFrame(frame);
    }

    function togglePause() {
      if (mode === 'playing') {
        mode = 'paused';
        cancelAnimationFrame(animationFrame);
        pauseButton.textContent = 'Resume';
        status.textContent = 'Paused. Resume when you are ready.';
        draw();
      } else if (mode === 'paused') {
        mode = 'playing';
        lastFrame = 0;
        pauseButton.textContent = 'Pause';
        status.textContent = 'Tap, click, or press Space to fly between the room pillars.';
        animationFrame = requestAnimationFrame(frame);
        canvas.focus();
      }
    }

    startButton.addEventListener('click', startGame);
    pauseButton.addEventListener('click', togglePause);
    canvas.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      canvas.focus();
      flap();
    });
    canvas.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.code === 'ArrowUp') {
        event.preventDefault();
        flap();
      } else if (event.code === 'Escape' && (mode === 'playing' || mode === 'paused')) {
        event.preventDefault();
        togglePause();
      }
    });

    draw();
  }

  window.initCicsFlightGame = mountGame;
  document.querySelectorAll('[data-cics-flight-game]').forEach(mountGame);
})();
