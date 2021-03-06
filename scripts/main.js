const KeyDirMap = {
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

function registerLevelCodeListener() {
  levelCodeInput.addEventListener("keydown", (e) => {
    if (e.code === "Enter") {
      let name = levelCodeInput.value.toLowerCase()
      if (!name) name = "original"
      if (!loadLevel(name)) levelCodeInput.value = ""
    }
  })
}

let heldDirs = []
let holdTimeout
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
function sharedOnKeyDown(e) {
  assert(gameState === GS_PLAYING || gameState === GS_MENU)
  if (e.code in KeyDirMap) {
    const dir = KeyDirMap[e.code]
    if (!heldDirs.includes(dir)) heldDirs.push(dir)
    onKeyHold(true)
  } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    if (!devmode) return
    editingTiles = true
    storedActor = null
    Raf()
  } else if (e.code === "Semicolon") {
    if (!devmode) return
    // save to RAM but not disk
    SaveLevel(currentLevelName, true)
    console.log("level saved")
  } else if (e.code === "KeyM") {
    muteToggle()
    Raf()
  }
}
function gameOnKeyDown(e) {
  assert(gameState === GS_PLAYING)
  sharedOnKeyDown(e)
  if (e.code === "Escape") {
    playSound(sndWalk)
    InitMenu(currentLevelName)
  } else if (e.code === "KeyR") {
    // clearTimeout(holdTimeout)
    reset()
    Raf()
  } else if (e.code === "KeyP") {
    recordingCycle()
  } else if (e.code === "KeyQ") {
    if (!devmode) return
    cycleStoredActor(usingStockActors ? 1 : 0)
    Raf()
  } else if (e.code === "Space" || e.code === "Enter") {
    if (player.won) {
      InitMenu(currentLevelName)
      Raf()
      return
    }
  }
}
function sharedOnKeyUp(e) {
  assert(gameState === GS_PLAYING || gameState === GS_MENU)
  if (e.code in KeyDirMap) {
    const dir = KeyDirMap[e.code]
    const keyWasCurrent = (dir === back(heldDirs))
    heldDirs = heldDirs.filter(d=>d!==dir)
    if (keyWasCurrent) onKeyHold(false) // do next held button on stack immediately
  } else if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
    if (!devmode) return
    editingTiles = false
    Raf()
  }
}
function gameOnKeyUp(e) { sharedOnKeyUp(e) }

function registerKeyListeners() {
  function maybeSave(e) {
    if (devmode && (e.ctrlKey || e.metaKey) && e.code === "KeyS") {
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

    // don't preventDefault on keyboard shortcuts
    if (e.ctrlKey || e.metaKey) return false
    // let user tab out to level code input
    if (e.code === "Tab") return false

    e.preventDefault()
    if (e.repeat) return false

    // delegate the input
    if (gameState === GS_PLAYING) {
      gameOnKeyDown(e)
    } else if (gameState === GS_MENU) {
      menuOnKeyDown(e)
    } else {
      assert(0, "bad gameState")
    }

    return false
  })
  canvasView.addEventListener("keyup", e => {
    e.preventDefault()
    if (e.repeat) return false

    // delegate the input
    if (gameState === GS_PLAYING) {
      gameOnKeyUp(e)
    } else if (gameState === GS_MENU) {
      menuOnKeyUp(e)
    } else {
      assert(0, "bad gameState")
    }

    return false
  })
}

function ProcessInput(code) {
  if (gameState === GS_PLAYING) {
    processGameInput(code)
  } else if (gameState === GS_MENU) {
    processMenuInput(code)
  } else {
    assert(0, "bad gameState")
  }
}

function processGameInput(code) {
  assert(gameState === GS_PLAYING)
  assert([0,1,2,3,4,5].includes(code))
  let success
  if (code === 4) {
    success = Undo()
  } else if (code === 5) {
    success = Redo()
  } else {
    success = Update(code) // code is dir
  }
  Raf()
  if (!success) return // skip recording key hist if update failed
  RecordKeyHist(code)
}

function lockScroll(cb) {
  const x = scrollX
  const y = scrollY
  cb()
  scrollTo(x,y)
}

function onMouseDown(e) {
  if (e.target === canvasView) {
    mouseClick(translateHex(translateMouseFromView(e)))
    Raf()
    canvasView.focus()
  } else if (e.target === canvasMap) {
    mouseClick(translateHex(translateMouseFromMap(e)))
    Raf()
    lockScroll(()=>canvasView.focus())
  }
}

function onMouseMove(e) {
  if (e.target === canvasView) {
    mouseMove(translateHex(translateMouseFromView(e)))
    if (devmode || gameState === GS_MENU) Raf()
  } else if (e.target === canvasMap) {
    mouseMove(translateHex(translateMouseFromMap(e)))
    if (devmode || gameState === GS_MENU) Raf()
  }
}

let gameHasWindowFocus = false
function registerMouseListeners() {
  mousepos = new MapPos(0, 0)
  canvasView.addEventListener("blur", (e) => {
    gameHasWindowFocus = false
    Raf()
  })
  canvasView.addEventListener("focus", (e) => {
    gameHasWindowFocus = true
    Raf()
  })
  canvasView.addEventListener("contextmenu", (e) => {
    e.preventDefault()
    return false
  })
  canvasMap.addEventListener("contextmenu", (e) => {
    e.preventDefault()
    return false
  })

  canvasMap.addEventListener("mousedown", (e) => {
    onMouseDown(e)

    e.preventDefault()
    return false
  })
  canvasView.addEventListener("mousedown", (e) => {
    onMouseDown(e)

    e.preventDefault()
    return false
  })
  canvasMap.addEventListener("mousemove", (e) => {
    onMouseMove(e)

    e.preventDefault()
    return false
  })
  canvasView.addEventListener("mousemove", (e) => {
    onMouseMove(e)

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
  const room = innerRoom(viewFrameStack)
  const roomPos = new RoomPos(room, x+dx, y+dy)
  if (!roomPos.inbounds()) { return { e, pos: null } }

  return {e, pos: roomPos.mapPos()}
}

let storedActor = null
function mouseClick({e, pos}) {
  if (maybeHudInteract(e, pos)) return
  if (!devmode) return
  _devmodeMouseClick(e, pos)
}

let mousepos
function mouseMove({e, pos}) {
  if (!pos) return

  if (gameState === GS_MENU) {
    menuMouseMove(e, pos)
  }

  if (debugIds) {
    let a = findActor(null, pos)
    if (a) actorIdOutput.innerText = `getActorId(${a.id})\n${a.serialize()}`
  }

  mousepos = pos
  if (devmode) {
    const LMB = e.buttons & (1<<0)
    const RMB = e.buttons & (1<<1)
    if (editingTiles) {
      if (LMB && !RMB) {
        setTile(pos, 1)
      } else if (RMB && !LMB) {
        setTile(pos, 0)
      }
    }
  }
}

function maybeHudInteract(e, pos) {
  if (gameState === GS_MENU) {
    if (maybeMenuMouseClick(e, pos)) return true
  }

  if (e.button !== 0) return false

  const col = Math.floor(e.offsetX / tileSize)
  const row = Math.floor(e.offsetY / tileSize)
  const elem = getHudElem(row, col)
  if (elem === imgHudReset) {
    reset()
    Raf()
    return true
  } else if (elem === imgHudSoundOn || elem === imgHudSoundOff) {
    muteToggle()
    Raf()
    return true
  } else if (elem === imgHudUndo) {
    const success = Undo()
    Raf()
    return success
  } else if (elem === imgHudRedo) {
    const success = Redo()
    Raf()
    return success
  } else if (elem === imgHudRedoGray || elem === imgHudUndoGray) {
    return true // don't interact but consume the click
  } else {
    return false
  }
}

function maybeChangeViewFrameStack(e, pos) {
  assert(devmode) // not necessary in general, but that's what i'm assuming for now
  if (e.button !== 0) return false

  // zoom out on border-click
  if (!pos) {
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

  if (editingTiles) return false

  // zoom in on mini-click
  const mini = findActor(Mini, pos)
  if (mini) {
    if (e.target === canvasMap) {
      // rebase
      viewFrameStack = cons(pos.room(), null)
      if (storedActor === player) player.frameStack = viewFrameStack
    }

    // add the new mini
    viewFrameStack = cons(mini, viewFrameStack)
    if (storedActor === player) player.frameStack = cons(mini, player.frameStack)

    return true
  }
  return false
}

let usingStockActors = false;
let stockActorsPos = 0;
function getStockActor(n) {
  const base = innerRoom(player.frameStack).name
  const opts = []
  const cols = "White Pink Red Orange Yellow Green Blue Purple Brown Black".split(' ')
  for (const c of cols) {
    if (Room.findName(c)) opts.push(`Mini ${base} 0 8 ${c}`)
  }
  opts.push(`Crate ${base} 0 8 0`)
  opts.push(`Player ${base} 0 8 0`)
  opts.push(`Flag ${base} 0 8 0`)
  return opts[saneMod(n, opts.length)]
}

function cycleStoredActor(scrollAmount) {
  usingStockActors = true
  if (storedActor) storedActor.dead = true // avoid undo system

  stockActorsPos += scrollAmount
  const a = deserSingleActor(getStockActor(stockActorsPos))
  assert(a)
  actors.push(a);
  storedActor = a;
  storedActor.dead = true // avoid undo system
}

let editingTiles = false
function _devmodeMouseClick(e, pos) {
  if (maybeChangeViewFrameStack(e, pos)) return
  if (!pos) return
  if (editingTiles) {
    if (e.button === 0) {
      setTile(pos, 1)
    } else if (e.button === 2) {
      setTile(pos, 0)
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
    ctxWith(ctxMap, {globalAlpha: 0.35, fillStyle: "white"}, ()=>{
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
  if (gameState === GS_MENU) {
    await DrawMenu(ctxMap, ctxMini, ctxView)
  } else if (gameState === GS_PLAYING) {
    DrawTiles(ctxMap, ctxMini)
    DrawActors(ctxMap, ctxMini)
    await DrawMinis(ctxMap)
    drawDevmode(ctxMap)
    await DrawView(ctxView)
    DrawGameMisc(ctxView)
    DrawMisc(ctxView)
  } else {
    assert(0, "bad gameState")
  }
}

function Raf() {
  requestAnimationFrame(redraw)
}

function setHashLevel(name) {
  if (devmode) window.location.hash = `#dev#${name}`
}

let currentLevelName
function reset() {
  playSound(sndUndo)
  const success = loadLevel(currentLevelName)
  assert(success)
}
function loadLevel(name) {
  const prevGS = gameState
  if (name !== "menu") gameState = GS_PLAYING
  if (!Import(name)) {
    gameState = prevGS
    return false
  }
  currentLevelName = name
  levelCodeInput.value = name.toUpperCase()
  setHashLevel(name)
  InitLevel()
  canvasView.focus()
  // scrollTo(0, 0)

  Raf()
  return true
}
function SaveLevel(name, skipDisk=false) {
  name = name.toLowerCase()
  if (name === "") name = "untitled"
  const { str, obj } = Export(name)

  if (!skipDisk) {
    downloadFile(`${name}.lvl`, `levelData.push(${str})\n`)
    setHashLevel(name)
  }

  // update RAM levelData cache
  const ix = levelData.findIndex(lvl => lvl.name === name)
  if (ix !== -1) {
    levelData[ix] = obj
  } else {
    console.log("caching new level");
    levelData.push(obj)
  }
}

function devmodeInit() {
  const match = window.location.hash.match(/^(#(?<dev>dev))?(#(?<level>[\w\d_]+))?$/)
  const { dev, level } = match.groups
  if (level) loadLevel(level)
  if (dev) devmodeOn()
  if (!devmode) {
    for (const elem of [levelCodeInput.previousElementSibling, levelCodeInput]) {
      elem.style.display = "none"
    }
  }
}

function init() {
  if (devmode) RunTests()

  // enable key listeners / focus on the canvases
  // probably tabIndex = -1 makes more sense
  // but 0 works on my machine to tab and shift-tab
  // between canvasView and levelCodeInput
  canvasMap.tabIndex = 0
  canvasView.tabIndex = 0

  registerLevelCodeListener()
  registerKeyListeners()
  registerMouseListeners()
  InitMenu()
  canvasView.focus()

  devmodeInit()
  document.body.removeChild(loadingText)
}
window.onload = init
