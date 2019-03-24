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
    "KeyZ": 4,
    "KeyY": 5,
  }
  function onKeyHold() {
    assert([0,1,2,3,4,5].includes(heldDir))
    if (heldDir === 4) {
      Undo()
    } else if (heldDir === 5) {
      Redo()
    } else {
      Update(heldDir)
      RecordKeyHist(heldDir) // TODO this might be confusing since we also have undo.js...
    }
  }
  function resetHoldInterval(start=true) {
    clearInterval(holdInterval)
    if (!start) { return }
    onKeyHold()
    if (!enableHeldButtons) { return }
    holdInterval = setInterval(onKeyHold, keyRepeatTimeout)
  }
  function onKeyDown(e) {
    if (e.code === "KeyR") {
      reset()
      Raf()
    }

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
  mouseClickLevel(level, levelPos)
}

function mouseClickView(e) {
  const levelPos = pcoord(Math.floor(e.offsetX / tileSize), Math.floor(e.offsetY / tileSize)).add(pcoord(-4, -4))
  mouseClickLevel(player.frameStack.level(), levelPos)
}

function mouseClickLevel(level, levelPos) {
  if (!inbounds(levelPos, {w: 8, h: 8})) { return }

  const worldPos = Pos.fromLevel(level, levelPos)
  const a = findActor(null, worldPos)
  const parts = []
  parts.push(`${GetLevelLabel(level)}(${level.id}): ${worldPos.str()}`)
  parts.push(`(local: ${levelPos.str()})`)
  if (a) {
    parts.push(`${a.constructor.name}#${a.id}`)
  }
  console.log(parts.join(' '))
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
  reset()
}

function reset() {
  InitTiles()
  InitActors()
  InitGame()

  Raf()
}

window.onload = init
