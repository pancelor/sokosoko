let enableHeldButtons = true
function disableHeldButtons() {
  enableHeldButtons = false
}

function registerKeyListeners() {
  const keyRepeatTimeout = 125
  let heldDir = null
  let holdInterval
  const keyDirMap = {
    "KeyD": 0,
    "ArrowRight": 0,
    "KeyW": 1,
    "ArrowUp": 1,
    "KeyA": 2,
    "ArrowLeft": 2,
    "KeyS": 3,
    "ArrowDown": 3,
  }
  function onKeyHold() {
    assert([0,1,2,3].includes(heldDir))
    Update(heldDir)
    RecordToHist(heldDir)
  }
  function resetHoldInterval(start=true) {
    clearInterval(holdInterval)
    if (!start) { return }
    onKeyHold()
    if (!enableHeldButtons) { return }
    holdInterval = setInterval(onKeyHold, keyRepeatTimeout)
  }
  function onKeyDown(e) {
    const dir = keyDirMap[e.code]
    if (dir === undefined) { return }
    heldDir = dir
    resetHoldInterval()
  }
  function onKeyUp(e) {
    const dir = keyDirMap[e.code]
    if (dir === undefined) { return }
    if (heldDir === dir) {
      resetHoldInterval(false)
    }
  }
  window.addEventListener("keydown", e => {
    if (e.ctrlKey && e.code === "KeyS") {
      SaveLevel()
      e.preventDefault()
      return false
    }

    if (e.ctrlKey) {
      // don't preventDefault on keyboard shortcuts
      return
    }

    e.preventDefault()
    if (e.repeat) { return false }

    onKeyDown(e)
    return false
  })
  window.addEventListener("keyup", e => {
    e.preventDefault()
    if (e.repeat) { return false }

    onKeyUp(e)
    return false
  })
}

function registerMouseListeners() {
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault()
    return false
  })
  canvas.addEventListener("mousedown", (e) => {
    mouseClickRaw(e)
    e.preventDefault()
    return false
  })
  canvas2.addEventListener("mousedown", (e) => {
    mouseClickView(e)
    e.preventDefault()
    return false
  })
}

function mouseClickRaw(e) {
  const worldPos = pcoord(Math.floor(e.offsetX / tileSize), Math.floor(e.offsetY / tileSize))
  const level = getLevelAt(worldPos)
  const levelPos = worldPos.toLevelPos(level)
  console.log(`${level.id}: ${worldPos.str()} (local: ${levelPos.str()})`)
}

function mouseClickView(e) {
  const levelPos = pcoord(Math.floor(e.offsetX / tileSize), Math.floor(e.offsetY / tileSize)).add(pcoord(-4, -4))
  if (!inbounds(levelPos, {w: 8, h: 8})) { return }

  const level = player.pos.level()
  const worldPos = Pos.fromLevel(level, levelPos)
  console.log(`${level.id}: ${worldPos.str()} (local: ${levelPos.str()})`)
}

async function redraw() {
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  await DrawGame(ctx)
}

function Raf() {
  requestAnimationFrame(redraw)
}

function init() {
  registerKeyListeners()
  registerMouseListeners()
  InitTiles()
  InitActors()
  InitGame()

  Raf()
}

window.onload = init
