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
  InitTiles()
  InitActors()
  InitGame()

  Raf()
}

window.onload = init
