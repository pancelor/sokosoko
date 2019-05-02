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

function registerKeyListeners() {
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
  function gameOnKeyDown(e) {
    assert(gameState === GS_PLAYING)
    if (e.code === "Escape") {
      if (devmode) {
        if (editingTiles) {
          editingTiles = false
          Raf()
        }
      } else {
        playSound(sndExit)
        InitMenu(currentLevelName)
      }
    } else if (e.code === "KeyU") {
      if (devmode) {
        playSound(sndExit)
        InitMenu(currentLevelName)
      }
    } else if (e.code === "KeyR") {
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
    } else if (e.code === "Space" || e.code === "Enter") {
      if (player.won) {
        InitMenu(currentLevelName)
        Raf()
        return
      }
      if (devmode) {
        editingTiles = !editingTiles
        storedActor = null
        Raf()
      }
    }
  }
  function gameOnKeyUp(e) {}

  function maybeSave(e) {
    if (gameState === GS_PLAYING && (e.ctrlKey || e.metaKey) && e.code === "KeyS") {
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
    if (e.code in KeyDirMap) {
      const dir = KeyDirMap[e.code]
      if (!heldDirs.includes(dir)) heldDirs.push(dir)
      onKeyHold(true)
    } else if (gameState === GS_PLAYING) {
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
    if (e.code in KeyDirMap) {
      const dir = KeyDirMap[e.code]
      const keyWasCurrent = (dir === back(heldDirs))
      heldDirs = heldDirs.filter(d=>d!==dir)
      if (keyWasCurrent) {
        onKeyHold(false) // do next held button on stack immediately
      }
    } else if (gameState === GS_PLAYING) {
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
  if (!success) return // skip recording key hist if update failed
  RecordKeyHist(code)
}

function lockScroll(cb) {
  const x = scrollX
  const y = scrollY
  cb()
  scrollTo(x,y)
}

function gameOnMouseDown(e) {
  assert(gameState === GS_PLAYING)
  if (e.target === canvasView) {
    mouseClick(translateMouseFromView(e))
    Raf()
    canvasView.focus()
  } else if (e.target === canvasMap) {
    mouseClick(translateMouseFromMap(e))
    Raf()
    lockScroll(()=>canvasView.focus())
  }
}

function gameOnMouseMove(e) {
  assert(gameState === GS_PLAYING)
  if (e.target === canvasView) {
    mouseMove(translateMouseFromView(e))
    if (devmode) Raf()
  } else if (e.target === canvasMap) {
    mouseMove(translateMouseFromMap(e))
    if (devmode) Raf()
  }
}

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

  canvasMap.addEventListener("mousedown", (e) => {
    if (gameState === GS_PLAYING) {
      gameOnMouseDown(e)
    } else if (gameState === GS_MENU) {
      menuOnMouseDown(e)
    } else {
      assert(0, "bad gameState")
    }

    e.preventDefault()
    return false
  })
  canvasView.addEventListener("mousedown", (e) => {
    if (gameState === GS_PLAYING) {
      gameOnMouseDown(e)
    } else if (gameState === GS_MENU) {
      menuOnMouseDown(e)
    } else {
      assert(0, "bad gameState")
    }

    e.preventDefault()
    return false
  })
  canvasMap.addEventListener("mousemove", (e) => {
    if (gameState === GS_PLAYING) {
      gameOnMouseMove(e)
    } else if (gameState === GS_MENU) {
      menuOnMouseMove(e)
    } else {
      assert(0, "bad gameState")
    }

    e.preventDefault()
    return false
  })
  canvasView.addEventListener("mousemove", (e) => {
    if (gameState === GS_PLAYING) {
      gameOnMouseMove(e)
    } else if (gameState === GS_MENU) {
      menuOnMouseMove(e)
    } else {
      assert(0, "bad gameState")
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
  const room = innerRoom(viewFrameStack)
  const roomPos = new RoomPos(room, x+dx, y+dy)
  if (!roomPos.inbounds()) { return { e, pos: null } }

  return {e, pos: roomPos.mapPos()}
}

let storedActor = null
function mouseClick({e, pos}) {
  if (maybeGuiInteract(e)) return
  if (!devmode) return
  _devmodeMouseClick(e, pos)
}

let mousepos
function mouseMove({e, pos}) {
  if (!pos) return

  mousepos = pos
  if (devmode) {
    if (debugIds) {
      let a = findActor(null, pos)
      if (a) actorIdOutput.innerText = `getActorId(${a.id})\n${a.serialize()}`
    }

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
  return false
}

function maybeChangeViewFrameStack(e, pos) {
  assert(devmode) // not necessary in general, but that's what i'm assuming for now

  // zoom out on border-click
  if (e.button !== 0) return false
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
  maybeChangeViewFrameStack(e, pos)
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
    DrawMisc(ctxView)
  } else {
    assert(0, "bad gameState")
  }
}

function Raf() {
  requestAnimationFrame(redraw)
}

let currentLevelName
function reset(name=null) {
  const success = loadLevel(name || currentLevelName)
  if (!success) return
  recordingStart()
}
function loadLevel(name) {
  if (name !== "menu") gameState = GS_PLAYING
  if (!Import(name)) return false
  currentLevelName = name
  levelCodeInput.value = name.toUpperCase()
  if (devmode) window.location.hash = `#dev#${name}`
  InitLevel()
  canvasView.focus()
  // scrollTo(0, 0)

  Raf()
  return true
}

function devmodeInit() {
  const match = window.location.hash.match(/^(#(?<dev>dev))?(#(?<level>[\w\d_]+))?$/)
  const { dev, level } = match.groups
  if (level) reset(level)
  if (dev) devmodeOn()
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
}
window.onload = init
