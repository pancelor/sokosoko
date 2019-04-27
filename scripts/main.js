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
  let heldDirs = []
  let holdTimeout
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
  const holdDelay = {
    // different delays per input type
    // each entry is [initialDelay, holdDelay]
    0: [150, 150],
    1: [150, 150],
    2: [150, 150],
    3: [150, 150],
    4: [300, 75], // undo / redo are different than normal directions
    5: [300, 75],
  }
  function onKeyHold(wait=false) {
    const dir = back(heldDirs)
    if (dir === undefined) return
    ProcessInput(dir)
    clearTimeout(holdTimeout)
    if (!enableHeldButtons) return
    holdTimeout = setTimeout(onKeyHold, holdDelay[dir][wait ? 0 : 1])
  }
  function onKeyDown(e) {
    if (e.code === "KeyR") {
      if (devmode) return // too confusing; ctrl-r instead pls
      clearTimeout(holdTimeout)
      reset()
      Raf()
    } else if (e.code === "KeyP") {
      recordingCycle()
    } else if (e.code === "KeyM") {
      muteToggle()
      Raf()
    } else if (e.code === "KeyQ") {
      if (!devmode) return
      editingTiles = false
      cycleStoredActor(usingStockActors ? (e.shiftKey ? -1 : 1) : 0)
      Raf()
    } else if (e.code === "BracketLeft") {
      maybeLoadPrevLevel()
    } else if (e.code === "BracketRight") {
      maybeLoadNextLevel()
    } else if (e.code === "Space") {
      if (checkWin()) {
        maybeLoadNextLevel()
        Raf()
        return
      }
      if (devmode) {
        editingTiles = !editingTiles
        storedActor = null
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

      onKeyHold(true)
    }
  }
  function onKeyUp(e) {
    const dir = keyDirMap[e.code]
    if (dir === undefined) { return }
    const keyWasCurrent = (dir === back(heldDirs))
    heldDirs = heldDirs.filter(d=>d!==dir)
    if (keyWasCurrent) {
      onKeyHold(false) // do next held button on stack immediately
    }
  }

  function maybeSave(e) {
    if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
      SaveLevel(levelCodeInput.value)
      return true
    } else {
      return false
    }
  }
  levelCodeInput.addEventListener("keydown", e => {
    if (maybeSave(e)) {
      e.preventDefault()
      return false
    }
  })
  canvasView.addEventListener("keydown", e => {
    if (maybeSave(e)) {
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
  if (code === 4) {
    Undo()
  } else if (code === 5) {
    Redo()
  } else {
    const res = Update(code) // code is dir
    if (!res) return // skip recording key hist if update failed
  }
  RecordKeyHist(code)
}

function lockScroll(cb) {
  const x = scrollX
  const y = scrollY
  cb()
  scrollTo(x,y)
}

// this isn't good enough for user experience
// let viewFocused
function registerMouseListeners() {
  mousepos = new MapPos(0, 0)
  canvasView.addEventListener("contextmenu", (e) => {
    e.preventDefault()
    return false
  })
  canvasMap.addEventListener("contextmenu", (e) => {
    e.preventDefault()
    return false
  })
  // canvasView.addEventListener("focus", () => { viewFocused = true })
  // canvasView.addEventListener("blur", () => { viewFocused = false })

  canvasMap.addEventListener("mousedown", (e) => {
    mouseClick(translateMouseFromMap(e))
    Raf()

    lockScroll(()=>canvasView.focus())

    e.preventDefault()
    return false
  })
  canvasView.addEventListener("mousedown", (e) => {
    // if (!viewFocused) return

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
  const room = viewFrameStack.data.innerRoom
  const roomPos = new RoomPos(room, x+dx, y+dy)
  if (!roomPos.inbounds()) { return { e, pos: null } }

  return {e, pos: roomPos.mapPos()}
}

let storedActor = null
function mouseClick({e, pos}) {
  if (maybeGuiInteract(e)) return
  if (!devmode) return
  maybeChangeViewFrameStack(e, pos) // do we want to let non-devmode users use this?

  _devmodeMouseClick(e, pos)
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

function maybeGuiInteract(e) {
  // hacky calculation here
  const x = e.offsetX
  const y = e.offsetY
  const W = canvasView.width
  const H = canvasView.height
  const firstCol = 0 <= x && x < tileSize
  const firstRow = 0 <= y && y < tileSize
  const lastCol = W - tileSize <= x && x < W
  const lastRow = H - tileSize <= y && y < H
  if (firstRow && lastCol && e.button === 0) {
    muteToggle()
    return true
  }
  if (devmode) {
  // these are too confusing in the first 10 seconds of seeing the game
    if (lastRow && firstCol && e.button === 0) {
      return maybeLoadPrevLevel()
    }
    if (lastRow && lastCol && e.button === 0) {
      return maybeLoadNextLevel()
    }
  }
  return false
}

function maybeChangeViewFrameStack(e, pos) {
  // zoom out on border-click
  if (e.button !== 0) return false
  if (!pos) {
    if (!devmode) return false
    if (viewFrameStack.parent) {
      viewFrameStack = viewFrameStack.parent
      if (storedActor === player) {
        assert(player.frameStack.parent)
        player.frameStack = player.frameStack.parent
      }
      return true
    }
    return false
  }
  if (devmode && editingTiles) return false
  // zoom in on mini-click
  assert(0)
  const mini = findActor(Mini, pos)
  if (mini) {
    viewFrameStack = cons(mini, viewFrameStack)
    if (storedActor === player) {
      player.frameStack = cons(mini, player.frameStack)
    }
    return true
  }
  return false
}

let usingStockActors = false;
let stockActorsPos = 0;
let stockActors = [
  "Mini White 0 8 White",
  "Mini White 0 8 Red",
  "Mini White 0 8 Orange",
  "Mini White 0 8 Yellow",
  "Mini White 0 8 Green",
  "Mini White 0 8 Blue",
  "Mini White 0 8 Purple",
  "Mini White 0 8 Pink",
  "Mini White 0 8 Brown",
  "Mini White 0 8 Black",
  "Crate White 0 8 0",
  "Player White 0 8 0",
  "Flag White 0 8 0",
]
function cycleStoredActor(scrollAmount) {
  usingStockActors = true
  if (storedActor) storedActor.dead = true // avoid undo system

  stockActorsPos += scrollAmount
  stockActorsPos = saneMod(stockActorsPos, stockActors.length)
  const a = deserSingleActor(stockActors[stockActorsPos])
  assert(a)
  actors.push(a);
  storedActor = a;
  storedActor.dead = true // avoid undo system
}

let editingTiles = false
function _devmodeMouseClick(e, pos) {
  if (!pos) return
  if (editingTiles) {
    if (e.button === 0) {
      setTileWall(pos)
    } else if (e.button === 2) {
      setTileFloor(pos)
    }
  } else {
    // assert we're editing actors
    if (e.button === 0) {
      // left click: paste (or move old pasted thing)
      if (findActor(null, pos)) {
        if (storedActor) console.warn("overlap")
        return
      }

      usingStockActors = false
      if (!storedActor) return
      storedActor.pos = pos // avoid undo system
      storedActor.dead = false // avoid undo system
      storedActor = null
    } else if (e.button === 1) {
      // middle click: copy
      usingStockActors = false
      storedActor = findActor(null, pos)
      if (!storedActor) return
      storedActor = Actor.clone(storedActor)
      storedActor.dead = true // avoid undo system
    } else if (e.button === 2) {
      // right click: cut
      usingStockActors = false
      storedActor = findActor(null, pos)
      if (!storedActor) return
      storedActor.dead = true // avoid undo system
    } else { assert(0, "unknown mouse button") }
  }
}

function drawDevmode(ctxMap) {
  if (!devmode) { return }
  if (editingTiles) {
    const room = mousepos.room()
    if (!room) return
    const name = room.name
    const img = document.getElementById(`img${name}Wall`)

    ctxWith(ctxMap, {globalAlpha: 0.50}, ()=>{
      drawImgMap(ctxMap, img, mousepos)
    })
  } else {
    if (!storedActor) { return }

    // mark storedActor
    const { x, y } = storedActor.pos
    ctxWith(ctxMap, {globalAlpha: 0.65, fillStyle: "white"}, ()=>{
      ctxMap.fillRect(x*tileSize, y*tileSize, tileSize, tileSize)
    })

    // mark mousepos
    drawImgMap(ctxMap, lookupActorImg(storedActor), mousepos)
    if (storedActor.constructor === Mini) {
      // this lets you realize you're placing, e.g., a white mini in a white room
      drawImgMap(ctxMap, imgMiniPlaceholder, mousepos)
    }
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
  levelCodeInput.value = name.toUpperCase()
  if (devmode) window.location.hash = `#dev#${name}`
  InitGame()
  canvasView.focus()
  // scrollTo(0, 0)

  Raf()
  return true
}

// returns the next level name
// defaults to the first level
// returns null if targetName is the last level
function nextLevelName(targetName) {
  let found = false
  for (const name of mainLevelNames) {
    if (found) return name
    if (name === targetName) found = true
  }
  if (found) {
    return null
  } else {
    return mainLevelNames[0]
  }
}
function CanContinue() {
  if (!currentLevelName) return true // game start
  if (!mainLevelNames.includes(currentLevelName)) return false
  return nextLevelName(currentLevelName) !== null
}
function maybeLoadNextLevel() {
  if (CanContinue()) {
    reset(nextLevelName(currentLevelName))
    return true
  } else {
    return false
  }
}

// returns the prev level name
// defaults to the last level
// returns null if targetName is the first level
function prevLevelName(targetName) {
  let found = false
  for (let i = mainLevelNames.length - 1; i >= 0; --i) {
    const name = mainLevelNames[i]
    if (found) return name
    if (name === targetName) found = true
  }
  if (found) {
    return null
  } else {
    return mainLevelNames[mainLevelNames.length - 1]
  }
}
function CanGoBack() {
  if (!mainLevelNames.includes(currentLevelName)) return false
  return prevLevelName(currentLevelName) !== null
}
function maybeLoadPrevLevel() {
  if (CanGoBack()) {
    reset(prevLevelName(currentLevelName))
    return true
  } else {
    return false
  }
}

function devmodeInit() {
  const match = window.location.hash.match(/^(#(?<dev>dev))?(#(?<level>[\w\d_]+))?$/)
  const { dev, level } = match.groups
  if (level) reset(level)
  if (dev) devmodeOn()
}

function editLevelList() {
  function addListItem(parent, text) {
    const child = document.createElement('li')
    child.innerText = text
    parent.appendChild(child)
  }

  for (const name of mainLevelNames) {
    addListItem(mainLevelsList, name.toUpperCase())
  }
}

function init() {
  editLevelList()
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
  maybeLoadNextLevel()

  devmodeInit()
}
window.onload = init
