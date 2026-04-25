const gameState = {
    score: 0,
    isCharging: false,
    isJumping: false,
    isGameOver: false,
    chargeStartTime: 0,
    currentPower: 0,
    maxChargeTime: 2000,
    chargeDirection: 1,
    grids: [],
    currentGridIndex: 0,
    cameraX: 0,
    playerWorldX: 0,
    playerWorldY: 0,
    optimalPowerMin: 0,
    optimalPowerMax: 0,
    difficulty: 1,
    obstacles: [],
    failReason: ''
};

const config = {
    gridWidth: 100,
    gridHeight: 20,
    playerWidth: 40,
    playerHeight: 60,
    minGap: 80,
    maxGap: 200,
    baseJumpPower: 8,
    maxJumpPower: 20,
    groundY: 400,
    cameraOffsetX: 200,
    gameAreaWidth: 800,
    landingTolerance: 20,
    edgeSnapTolerance: 15,
    baseMaxChargeTime: 2000,
    baseOptimalTolerance: 0.15,
    baseMinGap: 80,
    baseMaxGap: 200,
    obstacleTypes: ['spike', 'bomb', 'bird'],
    obstacleChance: 0.3
};

const player = document.getElementById('player');
const worldContainer = document.getElementById('worldContainer');
const gameArea = document.getElementById('gameArea');
const scoreDisplay = document.getElementById('score');
const powerFill = document.getElementById('powerFill');
const gameOverlay = document.getElementById('gameOverlay');
const finalScoreDisplay = document.getElementById('finalScore');
const failReasonDisplay = document.getElementById('failReason');
const restartBtn = document.getElementById('restartBtn');
const instructions = document.getElementById('instructions');
const powerHint = document.getElementById('powerHint');
const optimalZone = document.getElementById('optimalZone');
const difficultyDisplay = document.getElementById('difficulty');

function updateWorldTransform() {
    worldContainer.style.transform = `translateX(${-gameState.cameraX}px)`;
}

function calculateDifficulty() {
    gameState.difficulty = 1 + Math.floor(gameState.score / 3) * 0.2;
    gameState.difficulty = Math.min(gameState.difficulty, 5);
    
    gameState.maxChargeTime = Math.max(
        config.baseMaxChargeTime * (1 / gameState.difficulty),
        600
    );
    
    if (difficultyDisplay) {
        difficultyDisplay.textContent = `难度: ${Math.floor(gameState.difficulty)}`;
    }
}

function getOptimalTolerance() {
    const baseTolerance = config.baseOptimalTolerance;
    const reductionPerDifficulty = 0.02;
    const tolerance = baseTolerance - (gameState.difficulty - 1) * reductionPerDifficulty;
    return Math.max(tolerance, 0.06);
}

function getGapRange() {
    const difficultyMultiplier = 1 + (gameState.difficulty - 1) * 0.15;
    const minGap = config.baseMinGap * difficultyMultiplier;
    const maxGap = config.baseMaxGap + (gameState.difficulty - 1) * 30;
    return { minGap: Math.min(minGap, maxGap - 50), maxGap: Math.min(maxGap, 350) };
}

function getObstacleChance() {
    const baseChance = config.obstacleChance;
    const increasePerDifficulty = 0.08;
    return Math.min(baseChance + (gameState.difficulty - 1) * increasePerDifficulty, 0.8);
}

function calculateOptimalPower() {
    const currentGrid = gameState.grids[gameState.currentGridIndex];
    const nextGrid = gameState.grids[gameState.currentGridIndex + 1];
    
    if (!currentGrid || !nextGrid) {
        gameState.optimalPowerMin = 0.3;
        gameState.optimalPowerMax = 0.7;
        return;
    }

    const playerCenterX = gameState.playerWorldX + config.playerWidth / 2;
    const nextGridCenterX = nextGrid.x + nextGrid.width / 2;
    const requiredDistance = nextGridCenterX - playerCenterX;

    const powerRange = config.maxJumpPower - config.baseJumpPower;
    const requiredPower = (requiredDistance / 18 - config.baseJumpPower) / powerRange;

    const tolerance = getOptimalTolerance();
    gameState.optimalPowerMin = Math.max(0.1, requiredPower - tolerance);
    gameState.optimalPowerMax = Math.min(0.95, requiredPower + tolerance);
}

function updateOptimalZoneDisplay() {
    const leftPercent = gameState.optimalPowerMin * 100;
    const widthPercent = (gameState.optimalPowerMax - gameState.optimalPowerMin) * 100;
    
    optimalZone.style.left = leftPercent + '%';
    optimalZone.style.width = widthPercent + '%';
}

function updatePowerHint() {
    powerFill.classList.remove('too-weak', 'good', 'too-strong');
    powerHint.classList.remove('visible', 'too-weak', 'good', 'too-strong');

    if (!gameState.isCharging) return;

    powerHint.classList.add('visible');

    if (gameState.currentPower < gameState.optimalPowerMin) {
        powerFill.classList.add('too-weak');
        powerHint.classList.add('too-weak');
        powerHint.textContent = '偏近';
    } else if (gameState.currentPower > gameState.optimalPowerMax) {
        powerFill.classList.add('too-strong');
        powerHint.classList.add('too-strong');
        powerHint.textContent = '偏远';
    } else {
        powerFill.classList.add('good');
        powerHint.classList.add('good');
        powerHint.textContent = '合适';
    }
}

function createLandingEffect(x, y) {
    const effect = document.createElement('div');
    effect.className = 'landing-effect';
    effect.style.left = (x - 30) + 'px';
    effect.style.top = (y - 10) + 'px';
    worldContainer.appendChild(effect);
    
    setTimeout(() => effect.remove(), 500);
}

function createFailEffect(x, y) {
    const effect = document.createElement('div');
    effect.className = 'fail-effect';
    effect.style.left = (x - 40) + 'px';
    effect.style.top = (y - 40) + 'px';
    worldContainer.appendChild(effect);
    
    setTimeout(() => effect.remove(), 600);
}

function createSuccessFlash() {
    const flash = document.createElement('div');
    flash.className = 'success-flash';
    gameArea.appendChild(flash);
    
    setTimeout(() => flash.remove(), 300);
}

function createJumpTrail(x, y) {
    const trail = document.createElement('div');
    trail.className = 'jump-trail';
    trail.style.left = (x + config.playerWidth / 2 - 15) + 'px';
    trail.style.top = (y + config.playerHeight / 2 - 15) + 'px';
    worldContainer.appendChild(trail);
    
    setTimeout(() => trail.remove(), 300);
}

function createObstacleElement(obstacle) {
    const element = document.createElement('div');
    element.className = `obstacle obstacle-${obstacle.type}`;
    element.style.left = obstacle.x + 'px';
    element.style.top = obstacle.y + 'px';
    element.dataset.obstacleId = obstacle.id;

    if (obstacle.type === 'spike') {
        const spike = document.createElement('div');
        spike.className = 'spike-shape';
        element.appendChild(spike);
    } else if (obstacle.type === 'bomb') {
        const body = document.createElement('div');
        body.className = 'bomb-body';
        const fuse = document.createElement('div');
        fuse.className = 'bomb-fuse';
        const spark = document.createElement('div');
        spark.className = 'bomb-spark';
        body.appendChild(fuse);
        body.appendChild(spark);
        element.appendChild(body);
    } else if (obstacle.type === 'bird') {
        const body = document.createElement('div');
        body.className = 'bird-body';
        const wing = document.createElement('div');
        wing.className = 'bird-wing';
        const beak = document.createElement('div');
        beak.className = 'bird-beak';
        body.appendChild(wing);
        body.appendChild(beak);
        element.appendChild(body);
    }

    worldContainer.appendChild(element);
    obstacle.element = element;
}

function createWarningIndicator(x, y) {
    const warning = document.createElement('div');
    warning.className = 'obstacle-warning';
    warning.style.left = (x - 15) + 'px';
    warning.style.top = (y - 100) + 'px';
    worldContainer.appendChild(warning);
    
    setTimeout(() => warning.remove(), 1000);
}

function createObstacleForGrid(grid, previousGrid) {
    if (Math.random() > getObstacleChance()) return null;

    const type = config.obstacleTypes[Math.floor(Math.random() * config.obstacleTypes.length)];
    const positions = ['edge', 'middle', 'air'];
    const position = positions[Math.floor(Math.random() * positions.length)];
    
    let x, y;
    const gap = grid.x - (previousGrid.x + previousGrid.width);

    if (position === 'edge') {
        const edge = Math.random() > 0.5 ? 'left' : 'right';
        if (edge === 'left') {
            x = grid.x - 15;
            y = config.groundY - 40;
        } else {
            x = grid.x + grid.width - 15;
            y = config.groundY - 40;
        }
    } else if (position === 'middle') {
        x = grid.x + grid.width / 2 - 15;
        y = config.groundY - 40;
    } else {
        x = previousGrid.x + previousGrid.width + gap / 2 - 25;
        y = config.groundY - 120 - Math.random() * 60;
    }

    const obstacle = {
        id: Date.now() + Math.random(),
        type: type,
        x: x,
        y: y,
        width: type === 'bird' ? 50 : (type === 'bomb' ? 40 : 30),
        height: type === 'spike' ? 40 : 40,
        gridX: grid.x
    };

    createWarningIndicator(x, y);
    createObstacleElement(obstacle);
    gameState.obstacles.push(obstacle);
    
    return obstacle;
}

function checkObstacleCollision(jumpX, jumpY) {
    const playerLeft = jumpX;
    const playerRight = playerLeft + config.playerWidth;
    const playerTop = jumpY;
    const playerBottom = playerTop + config.playerHeight;
    const playerCenterX = playerLeft + config.playerWidth / 2;
    const playerCenterY = playerTop + config.playerHeight / 2;

    for (const obstacle of gameState.obstacles) {
        const obsLeft = obstacle.x;
        const obsRight = obstacle.x + obstacle.width;
        const obsTop = obstacle.y;
        const obsBottom = obstacle.y + obstacle.height;

        if (obstacle.type === 'bird') {
            const distX = Math.abs(playerCenterX - (obsLeft + obstacle.width / 2));
            const distY = Math.abs(playerCenterY - (obsTop + obstacle.height / 2));
            
            if (distX < (config.playerWidth + obstacle.width) / 2 - 10 &&
                distY < (config.playerHeight + obstacle.height) / 2 - 10) {
                return obstacle;
            }
        } else {
            if (playerRight > obsLeft + 5 &&
                playerLeft < obsRight - 5 &&
                playerBottom > obsTop + 5 &&
                playerTop < obsBottom - 5) {
                return obstacle;
            }
        }
    }
    return null;
}

function updatePlayerPosition() {
    player.style.left = gameState.playerWorldX + 'px';
    player.style.top = gameState.playerWorldY + 'px';
}

function updateCamera(animate = false) {
    const targetCameraX = gameState.playerWorldX - config.cameraOffsetX;
    
    if (animate) {
        const startCameraX = gameState.cameraX;
        const distance = targetCameraX - startCameraX;
        const duration = 300;
        const startTime = Date.now();

        function animateCamera() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            gameState.cameraX = startCameraX + distance * easeProgress;
            updateWorldTransform();

            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            }
        }

        animateCamera();
    } else {
        gameState.cameraX = targetCameraX;
        updateWorldTransform();
    }
}

function createGridElement(grid) {
    const gridElement = document.createElement('div');
    gridElement.className = 'grid';
    gridElement.style.left = grid.x + 'px';
    gridElement.style.top = grid.y + 'px';
    gridElement.style.width = grid.width + 'px';
    gridElement.style.height = grid.height + 'px';
    worldContainer.appendChild(gridElement);
    grid.element = gridElement;
}

function createInitialGrids() {
    const firstGrid = {
        x: 300,
        y: config.groundY,
        width: config.gridWidth,
        height: config.gridHeight
    };
    gameState.grids.push(firstGrid);
    createGridElement(firstGrid);

    for (let i = 1; i < 5; i++) {
        createNextGrid();
    }
}

function createNextGrid() {
    const lastGrid = gameState.grids[gameState.grids.length - 1];
    const gapRange = getGapRange();
    const gap = gapRange.minGap + Math.random() * (gapRange.maxGap - gapRange.minGap);
    const newGrid = {
        x: lastGrid.x + lastGrid.width + gap,
        y: config.groundY,
        width: config.gridWidth,
        height: config.gridHeight
    };
    gameState.grids.push(newGrid);
    createGridElement(newGrid);

    if (gameState.score > 0) {
        createObstacleForGrid(newGrid, lastGrid);
    }
}

function cleanUpOldObstacles() {
    const currentGrid = gameState.grids[gameState.currentGridIndex];
    if (!currentGrid) return;

    gameState.obstacles = gameState.obstacles.filter(obstacle => {
        if (obstacle.gridX < currentGrid.x - 200) {
            if (obstacle.element) {
                obstacle.element.remove();
            }
            return false;
        }
        return true;
    });
}

function initGame() {
    gameState.score = 0;
    gameState.isCharging = false;
    gameState.isJumping = false;
    gameState.isGameOver = false;
    gameState.currentPower = 0;
    gameState.cameraX = 0;
    gameState.difficulty = 1;
    gameState.obstacles = [];
    gameState.failReason = '';

    const grids = document.querySelectorAll('.grid');
    grids.forEach(grid => grid.remove());
    
    const obstacles = document.querySelectorAll('.obstacle');
    obstacles.forEach(obs => obs.remove());
    
    const warnings = document.querySelectorAll('.obstacle-warning');
    warnings.forEach(w => w.remove());
    
    gameState.grids = [];
    gameState.currentGridIndex = 0;

    scoreDisplay.textContent = '0';
    powerFill.style.width = '0%';
    gameOverlay.classList.add('hidden');
    instructions.style.display = 'block';
    if (difficultyDisplay) {
        difficultyDisplay.textContent = '难度: 1';
    }

    createInitialGrids();

    const firstGrid = gameState.grids[0];
    gameState.playerWorldX = firstGrid.x + firstGrid.width / 2 - config.playerWidth / 2;
    gameState.playerWorldY = config.groundY - config.playerHeight;
    
    updatePlayerPosition();
    updateCamera(false);
}

function startCharging() {
    if (gameState.isJumping || gameState.isGameOver) return;

    gameState.isCharging = true;
    gameState.chargeStartTime = Date.now();
    gameState.chargeDirection = 1;
    gameState.currentPower = 0;
    instructions.style.display = 'none';

    calculateOptimalPower();
    updateOptimalZoneDisplay();

    player.classList.remove('landing');
    player.classList.add('charging');
    chargeLoop();
}

function chargeLoop() {
    if (!gameState.isCharging) return;

    const elapsed = Date.now() - gameState.chargeStartTime;
    const cycleTime = gameState.maxChargeTime * 2;
    const cycleProgress = (elapsed % cycleTime) / cycleTime;

    if (cycleProgress < 0.5) {
        gameState.currentPower = cycleProgress * 2;
    } else {
        gameState.currentPower = 2 - cycleProgress * 2;
    }

    powerFill.style.width = (gameState.currentPower * 100) + '%';
    updatePowerHint();

    const compressionScale = 0.85 + gameState.currentPower * 0.15;
    player.style.transform = `scaleY(${compressionScale}) scaleX(${1 / compressionScale})`;

    requestAnimationFrame(chargeLoop);
}

function stopCharging() {
    if (!gameState.isCharging || gameState.isJumping || gameState.isGameOver) return;

    gameState.isCharging = false;
    player.classList.remove('charging');
    player.style.transform = 'scaleY(1) scaleX(1)';
    
    powerFill.classList.remove('too-weak', 'good', 'too-strong');
    powerHint.classList.remove('visible', 'too-weak', 'good', 'too-strong');
    optimalZone.style.left = '0%';
    optimalZone.style.width = '0%';

    const jumpPower = config.baseJumpPower + gameState.currentPower * (config.maxJumpPower - config.baseJumpPower);
    jump(jumpPower);
}

function jump(jumpPower) {
    gameState.isJumping = true;

    const startX = gameState.playerWorldX;
    const startY = gameState.playerWorldY;

    const jumpDistance = jumpPower * 18;
    const targetX = startX + jumpDistance;

    const jumpDuration = 600 + jumpPower * 50;
    const peakHeight = 80 + jumpPower * 10;

    const startTime = Date.now();
    let lastTrailTime = 0;

    function animateJump() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / jumpDuration, 1);

        const x = startX + jumpDistance * progress;
        const y = startY - peakHeight * 4 * progress * (1 - progress);

        const collision = checkObstacleCollision(x, y);
        if (collision) {
            gameState.playerWorldX = x;
            gameState.playerWorldY = y;
            updatePlayerPosition();
            
            const reasons = {
                'spike': '踩到了尖刺！',
                'bomb': '撞到了炸弹！',
                'bird': '被小鸟撞倒了！'
            };
            gameState.failReason = reasons[collision.type] || '碰到了障碍物！';
            gameOver();
            return;
        }

        gameState.playerWorldX = x;
        gameState.playerWorldY = y;
        updatePlayerPosition();

        if (elapsed - lastTrailTime > 50) {
            createJumpTrail(x, y);
            lastTrailTime = elapsed;
        }

        const jumpProgress = 1 - Math.abs(progress - 0.5) * 2;
        const stretchScale = 1 + jumpProgress * 0.2;
        player.style.transform = `scaleY(${stretchScale}) scaleX(${1 / stretchScale})`;

        if (progress < 1) {
            requestAnimationFrame(animateJump);
        } else {
            player.style.transform = 'scaleY(1) scaleX(1)';
            checkLanding();
        }
    }

    animateJump();
}

function checkLanding() {
    const targetGrid = gameState.grids[gameState.currentGridIndex + 1];

    if (targetGrid) {
        const playerLeft = gameState.playerWorldX;
        const playerRight = playerLeft + config.playerWidth;
        const playerBottom = gameState.playerWorldY + config.playerHeight;
        const playerCenterX = playerLeft + config.playerWidth / 2;

        const gridLeft = targetGrid.x;
        const gridRight = gridLeft + targetGrid.width;
        const gridTop = targetGrid.y;

        const isVerticalAligned = (playerBottom >= gridTop - config.landingTolerance && 
                                  playerBottom <= gridTop + config.landingTolerance);

        if (isVerticalAligned) {
            const playerOnGrid = (playerCenterX >= gridLeft - config.edgeSnapTolerance && 
                                 playerCenterX <= gridRight + config.edgeSnapTolerance);

            if (playerOnGrid) {
                const landingCollision = checkObstacleCollision(gameState.playerWorldX, gameState.playerWorldY);
                if (landingCollision) {
                    const reasons = {
                        'spike': '踩到了尖刺！',
                        'bomb': '踩到了炸弹！',
                        'bird': '被小鸟撞到了！'
                    };
                    gameState.failReason = reasons[landingCollision.type] || '碰到了障碍物！';
                    gameOver();
                    return;
                }

                let snapX;
                
                if (playerCenterX < gridLeft) {
                    snapX = gridLeft + config.playerWidth / 2;
                } else if (playerCenterX > gridRight) {
                    snapX = gridRight - config.playerWidth / 2;
                } else {
                    snapX = targetGrid.x + targetGrid.width / 2;
                }

                gameState.playerWorldX = snapX - config.playerWidth / 2;
                gameState.playerWorldY = config.groundY - config.playerHeight;
                updatePlayerPosition();

                createLandingEffect(
                    gameState.playerWorldX + config.playerWidth / 2,
                    gameState.playerWorldY + config.playerHeight
                );
                createSuccessFlash();

                player.classList.add('landing');
                setTimeout(() => player.classList.remove('landing'), 300);

                gameState.currentGridIndex++;
                gameState.score++;
                scoreDisplay.textContent = gameState.score;
                
                calculateDifficulty();
                cleanUpOldObstacles();

                createNextGrid();
                updateCamera(true);

                gameState.isJumping = false;
                return;
            }
        }
    }

    const currentGrid = gameState.grids[gameState.currentGridIndex];
    if (currentGrid) {
        const playerCenterX = gameState.playerWorldX + config.playerWidth / 2;
        const stillOnCurrentGrid = (playerCenterX >= currentGrid.x && 
                                   playerCenterX <= currentGrid.x + currentGrid.width);
        
        if (stillOnCurrentGrid) {
            gameState.playerWorldX = currentGrid.x + currentGrid.width / 2 - config.playerWidth / 2;
            gameState.playerWorldY = config.groundY - config.playerHeight;
            updatePlayerPosition();

            player.classList.add('landing');
            setTimeout(() => player.classList.remove('landing'), 300);

            gameState.isJumping = false;
            return;
        }
    }

    const tolerance = getOptimalTolerance();
    if (gameState.currentPower < gameState.optimalPowerMin - tolerance * 0.5) {
        gameState.failReason = '蓄力不足，跳得太近了！';
    } else if (gameState.currentPower > gameState.optimalPowerMax + tolerance * 0.5) {
        gameState.failReason = '蓄力过久，跳得太远了！';
    } else {
        gameState.failReason = '没有落到格子上！';
    }
    
    gameOver();
}

function gameOver() {
    gameState.isGameOver = true;
    gameState.isJumping = false;

    createFailEffect(
        gameState.playerWorldX + config.playerWidth / 2,
        gameState.playerWorldY + config.playerHeight
    );

    player.classList.add('falling');
    gameArea.classList.add('fail-animation');

    setTimeout(() => {
        gameArea.classList.remove('fail-animation');
        player.classList.remove('falling');
        finalScoreDisplay.textContent = gameState.score;
        if (failReasonDisplay && gameState.failReason) {
            failReasonDisplay.textContent = gameState.failReason;
        }
        gameOverlay.classList.remove('hidden');
    }, 600);
}

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        startCharging();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        stopCharging();
    }
});

gameArea.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        startCharging();
    }
});

document.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        stopCharging();
    }
});

gameArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startCharging();
});

document.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopCharging();
});

restartBtn.addEventListener('click', () => {
    initGame();
});

initGame();
