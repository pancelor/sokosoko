let godmode = false
function godmodeOn() {
  godmode = true
  mapOn()
}
function godmodeOff() {
  godmode = false
  mapOff()
}

function mapOn() { canvas.style.display = null }
function mapOff() { canvas.style.display = "none" }

let gameMuted = false
function setGameMuted(x) { gameMuted = x }
const mute = () => setGameMuted(true)
const unmute = () => setGameMuted(false)

let enableHeldButtons = true
function singleButtons() {
  enableHeldButtons = false
}

function registerLevelCodeListener() {
  levelCodeInput.addEventListener("keydown", (e) => {
    if (e.code === "Enter") {
      let name = levelCodeInput.value.toLowerCase()
      if (!name) { name = "orig" }
      if (!loadLevel(name)) { levelCodeInput.value = "" }
    }
  })
}

function registerKeyListeners() {
  const holdIntervalLength = 150
  let heldDirs = []
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
    const dir = back(heldDirs)
    if (dir === undefined) {
      clearInterval(holdInterval)
      return
    }
    ProcessInput(dir)
  }
  function startHoldInterval() {
    clearInterval(holdInterval)
    onKeyHold()
    if (!enableHeldButtons) { return }
    holdInterval = setInterval(onKeyHold, holdIntervalLength)
  }
  function onKeyDown(e) {
    if (e.code === "KeyR") {
      clearInterval(holdInterval)
      reset()
      Raf()
    } else if (e.code === "KeyP") {
      recordingToggle()
    } else {
      const dir = keyDirMap[e.code]
      if (dir === undefined) { return }

      if (!heldDirs.includes(dir)) {
        heldDirs.push(dir)
      }

      startHoldInterval()
    }
  }
  function onKeyUp(e) {
    const dir = keyDirMap[e.code]
    if (dir === undefined) { return }
    const keyWasCurrent = (dir === back(heldDirs))
    heldDirs = heldDirs.filter(d=>d!==dir)
    if (keyWasCurrent) {
      startHoldInterval() // do next held button on stack immediately
    }
  }
  canvas2.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
      SaveLevel(levelCodeInput.value)
      e.preventDefault()
      return false
    }

    if (e.ctrlKey || e.metaKey) {
      // don't preventDefault on keyboard shortcuts
      return
    }

    e.preventDefault()
    if (e.repeat) { return false }

    onKeyDown(e)
    return false
  })
  canvas2.addEventListener("keyup", e => {
    e.preventDefault()
    if (e.repeat) { return false }

    onKeyUp(e)
    return false
  })
}

function ProcessInput(code) {
  assert([0,1,2,3,4,5].includes(code))
  RecordKeyHist(code)
  if (code === 4) {
    Undo()
  } else if (code === 5) {
    Redo()
  } else {
    Update(code) // code is dir
  }
}

function registerMouseListeners() {
  mousepos = pcoord(0, 0)
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault()
    return false
  })
  canvas.addEventListener("mousedown", (e) => {
    const info = translateMouseFromMap(e)
    info && mouseClick(info)
    Raf()

    e.preventDefault()
    return false
  })
  canvas2.addEventListener("mousedown", (e) => {
    const info = translateMouseFromView(e)
    info && mouseClick(info)
    Raf()

    canvas2.focus()
    e.preventDefault()
    return false
  })
  canvas.addEventListener("mousemove", (e) => {
    const info = translateMouseFromMap(e)
    info && mouseMove(info)
    if (godmode) {
      Raf()
    }

    e.preventDefault()
    return false
  })
  canvas2.addEventListener("mousemove", (e) => {
    const info = translateMouseFromView(e)
    info && mouseMove(info)
    if (godmode) {
      Raf()
    }
    e.preventDefault()
    return false
  })
}

function translateMouseFromMap(e) {
  const worldPos = pcoord(Math.floor(e.offsetX / tileSize), Math.floor(e.offsetY / tileSize))
  return {e, worldPos}
}

function translateMouseFromView(e) {
  const levelPos = pcoord(Math.floor(e.offsetX / tileSize), Math.floor(e.offsetY / tileSize)).add(pcoord(-4, -4))
  if (!inbounds(levelPos, {w: 8, h: 8})) { return }

  const level = player.frameStack.level()
  const worldPos = Pos.fromLevel(level, levelPos)
  return {e, worldPos}
}

let storedActor = null
function mouseClick({e, worldPos}) {
  const level = getLevelAt(worldPos)
  const levelPos = worldPos.toLevelPos(level)
  const a = findActor(null, worldPos)
  const parts = []
  parts.push(`${level.name}(${level.id}): ${worldPos.str()}`)
  parts.push(`(local: ${levelPos.str()})`)
  if (a) {
    parts.push(`${a.constructor.name}#${a.id}`)
    if (a.tag) {
      parts.push(`@${a.tag}`)
    }
  }
  console.log(parts.join(' '))

  if (godmode) {
    StartEpoch()
    _godmodeMouseClick(e, worldPos)
    EndEpoch()
  }
}

let mousepos
function mouseMove({e, worldPos}) {
  mousepos = worldPos
}

function _godmodeMouseClick(e, worldPos) {
  if (e.button === 0) {
    // left click: paste (or move old pasted thing)
    if (!storedActor) { return }
    storedActor.setPos(worldPos)
    storedActor.setDead(false)
  } else if (e.button === 1) {
    // middle click: copy
    storedActor = findActor(null, worldPos)
    if (!storedActor) { return }
    storedActor = Actor.clone(storedActor)
  } else if (e.button === 2) {
    // right click: cut
    storedActor = findActor(null, worldPos)
    if (!storedActor) { return }
    storedActor.die()
  } else { assert(0, "unknown mouse button") }
}

function drawGodmode(ctx) {
  if (!godmode) { return }
  if (!storedActor) { return }

  // mark storedActor
  const { x, y } = storedActor.pos
  ctxWith(ctx, {globalAlpha: 0.5, fillStyle: "white"}, ()=>{
    ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize)
  })

  // mark mousepos
  drawImg(ctx, storedActor.img, mousepos)
  ctxWith(ctx, {globalAlpha: 0.5, fillStyle: "white"}, ()=>{
    ctx.fillRect(mousepos.x*tileSize, mousepos.y*tileSize, tileSize, tileSize)
  })

}

async function redraw() {
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  DrawGame(ctx)
  drawGodmode(ctx)
  await DrawView(ctx)
}

function Raf() {
  requestAnimationFrame(redraw)
}

let currentLevelName
function reset() {
  const success = loadLevel(currentLevelName)
  assert(success)
}
function loadLevel(levelName) {
  if (!ImportLevel(levelName)) { return false }
  currentLevelName = levelName
  InitGame()
  canvas2.focus()
  scrollTo(0, 0)

  Raf()
  return true
}

function devmodeInit() {
  godmodeOn()
  loadLevel('wack')
}

function init() {
  RunTests()
  canvas.tabIndex = -1 // enable key listeners / focus on the canvases
  canvas2.tabIndex = -1
  registerLevelCodeListener()
  registerKeyListeners()
  registerMouseListeners()
  loadLevel('orig')

  devmodeInit()
}
window.onload = init
