function registerLevelCodeListener() {
  levelCodeInput.addEventListener("keydown", (e) => {
    if (e.code === "Enter") {
      let name = levelCodeInput.value.toLowerCase()
      if (!name) { name = "original" }
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
      if (devmode) return // too confusing; ctrl-r instead pls
      clearInterval(holdInterval)
      reset()
      Raf()
    } else if (e.code === "KeyP") {
      recordingToggle()
    } else if (e.code === "KeyM") {
      muteToggle()
    } else if (e.code === "Space") {
      if (devmode) {
        editingTiles = !editingTiles
        if (editingTiles) storedActor = null
        Raf()
      }
    } else if (e.code === "Escape") {
      if (devmode && editingTiles) {
        editingTiles = false
        Raf()
      }
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
  canvasView.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
      SaveLevel(levelCodeInput.value)
      e.preventDefault()
      return false
    }

    if (e.ctrlKey || e.metaKey) {
      // don't preventDefault on keyboard shortcuts
      return false
    }
    if (e.code === "Tab") {
      // let user tab out to level code input
      return
    }

    e.preventDefault()
    if (e.repeat) { return false }

    onKeyDown(e)
    return false
  })
  canvasView.addEventListener("keyup", e => {
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

function lockScroll(cb) {
  const x = scrollX
  const y = scrollY
  cb()
  scrollTo(x,y)
}

function registerMouseListeners() {
  mousepos = new MapPos(0, 0)
  window.addEventListener("contextmenu", (e) => {
    e.preventDefault()
    return false
  })
  canvasMap.addEventListener("mousedown", (e) => {
    mouseClick(translateMouseFromMap(e))
    Raf()

    lockScroll(()=>canvasView.focus())

    e.preventDefault()
    return false
  })
  canvasView.addEventListener("mousedown", (e) => {
    mouseClick(translateMouseFromView(e))
    Raf()

    canvasView.focus()
    e.preventDefault()
    return false
  })
  canvasMap.addEventListener("mousemove", (e) => {
    mouseMove(translateMouseFromMap(e))
    if (devmode) {
      Raf()
    }

    e.preventDefault()
    return false
  })
  canvasView.addEventListener("mousemove", (e) => {
    mouseMove(translateMouseFromView(e))
    if (devmode) {
      Raf()
    }

    e.preventDefault()
    return false
  })
}

function translateMouseFromMap(e) {
  let x = Math.floor(e.offsetX / tileSize)
  let y = Math.floor(e.offsetY / tileSize)
  return {e, pos: new MapPos(x, y)}
}

function translateMouseFromView(e) {
  let x = Math.floor(e.offsetX / tileSize)
  let y = Math.floor(e.offsetY / tileSize)
  let {x: dx, y: dy} = viewOffset().scale(-1)
  const room = player.frameStack.innerRoom()
  const roomPos = new RoomPos(room, x+dx, y+dy)
  if (!roomPos.inbounds()) { return { e, pos: null } }

  return {e, pos: roomPos.mapPos()}
}

let storedActor = null
function mouseClick({e, pos}) {
  if (!devmode) return
  StartEpoch()
  _devmodeMouseClick(e, pos)
  EndEpoch()
}

let mousepos
function mouseMove({e, pos}) {
  if (!pos) return

  mousepos = pos
  if (devmode) {
    const LMB = e.buttons & (1<<0)
    const RMB = e.buttons & (1<<1)
    if (editingTiles) {
      if (LMB && !RMB) {
        setTileWall(pos)
      } else if (RMB && !LMB) {
        setTileFloor(pos)
      }
    }
  }
}

let editingTiles = false
function _devmodeMouseClick(e, pos) {
  // zoom out on border-click
  if (!pos) {
    if (e.button === 0) {
      if (player.frameStack.parent) {
        player.frameStack = player.frameStack.parent
      }
    }
    return
  }
  if (editingTiles) {
    if (e.button === 0) {
      setTileWall(pos)
    } else if (e.button === 2) {
      setTileFloor(pos)
    }
  } else {
    // assert we're editing actors
    if (e.button === 0) {
      // zoom in on mini-click
      const collision = findActor(null, pos)
      if (collision) {
        if (collision.constructor === Mini) {
          player.frameStack = new Frame(collision.id, player.frameStack)
          return
        } else {
          console.warn("overlap")
          return
        }
      }

      // left click: paste (or move old pasted thing)
      if (!storedActor) { return }
      storedActor.setPos(pos)
      storedActor.setDead(false)
      storedActor = null
    } else if (e.button === 1) {
      // middle click: copy
      storedActor = findActor(null, pos)
      if (!storedActor) { return }
      storedActor = Actor.clone(storedActor)
      storedActor.die()
    } else if (e.button === 2) {
      // right click: cut
      storedActor = findActor(null, pos)
      if (!storedActor) { return }
      storedActor.die()
    } else { assert(0, "unknown mouse button") }
  }
}

function drawDevmode(ctxMap) {
  if (!devmode) { return }
  if (editingTiles) {
    ctxWith(ctxMap, {globalAlpha: 0.10, fillStyle: "white"}, ()=>{
      ctxMap.fillRect(mousepos.x*tileSize, mousepos.y*tileSize, tileSize, tileSize)
    })
  } else {
    if (!storedActor) { return }

    // mark storedActor
    const { x, y } = storedActor.pos
    ctxWith(ctxMap, {globalAlpha: 0.5, fillStyle: "white"}, ()=>{
      ctxMap.fillRect(x*tileSize, y*tileSize, tileSize, tileSize)
    })

    // mark mousepos
    drawImgMap(ctxMap, lookupActorImg(storedActor), mousepos)
    ctxWith(ctxMap, {globalAlpha: 0.5, fillStyle: "white"}, ()=>{
      ctxMap.fillRect(mousepos.x*tileSize, mousepos.y*tileSize, tileSize, tileSize)
    })
  }
}

async function redraw() {
  const ctxMap = canvasMap.getContext('2d')
  ctxMap.imageSmoothingEnabled = false
  const ctxMini = canvasMini.getContext('2d')
  ctxMini.imageSmoothingEnabled = false
  const ctxView = canvasView.getContext('2d')
  ctxView.imageSmoothingEnabled = false
  DrawTiles(ctxMap, ctxMini)
  DrawActors(ctxMap, ctxMini)
  await DrawMinis(ctxMap)
  drawDevmode(ctxMap)
  await DrawView(ctxView)
  DrawMisc(ctxView)
}

function Raf() {
  requestAnimationFrame(redraw)
}

let currentLevelName
function reset(name=null) {
  const success = loadLevel(name || currentLevelName)
  recordingStart()
}
function loadLevel(name) {
  if (!Import(name)) { return false }
  currentLevelName = name
  levelCodeInput.value = name
  if (devmode) window.location.hash = `#dev#${name}`
  InitGame()
  canvasView.focus()
  // scrollTo(0, 0)

  Raf()
  return true
}

function devmodeInit() {
  const match = window.location.hash.match(/^(#(?<dev>dev))?(#(?<level>[\w\d_]+))?$/)
  const { dev, level } = match.groups
  if (level) loadLevel(level)
  if (dev) devmodeOn()
}

function init() {
  RunTests()

  // enable key listeners / focus on the canvases
  // probably tabIndex = -1 makes more sense
  // but 0 works on my machine to tab and shift-tab
  // between canvasView and levelCodeInput
  canvasMap.tabIndex = 0
  canvasView.tabIndex = 0

  registerLevelCodeListener()
  registerKeyListeners()
  registerMouseListeners()
  reset('original')

  devmodeInit()
}
window.onload = init
