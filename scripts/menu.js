let gameState
const GS_MENU = 1
const GS_PLAYING = 2

const gameProgress = {}

let menuSelectPos = null
function InitMenu(levelName) {
  gameState = GS_MENU
  const success = loadLevel("menu")
  assert(success)

  menuSelectPos = new MapPos(2, 2)
  const stairs = findStairs(levelName)
  if (stairs) menuSelectPos = stairs.pos.mapPos()

  ResetTileCache()
  Raf()
}

function findStairs(levelName) {
  return actors.find(a=>a.constructor === Stairs && a.name === levelName)
}

function processMenuInput(dir) {
  if (![0,1,2,3].includes(dir)) return // ignore undo/redo

  const pos = menuSelectPos.addDir(dir)
  if (!pos.roomPos().inbounds()) return false

  menuSelectPos = pos
  playSound(sndWalk)

  Raf()
  return true
}

function DoMenuSelect() {
  const level = getFocusedLevel()
  if (level) {
    gameState = GS_PLAYING
    playSound(sndLoad)
    reset(level)
    return true
  } else {
    return false
  }
}

function getFocusedLevel() {
  const stairs = findActor(Stairs, menuSelectPos)
  return stairs ? stairs.name : null
}

function maybeDrawTutorialBang(ctxMap) {
  // hacky hardcoded stuff here
  if (!isLocalStorageAvailable()) return

  const unbeaten = n => !getProgress(n, "win")
  let s
  if (unbeaten("push")) s = findStairs("push")
  else if (unbeaten("block")) s = findStairs("block")
  else if (unbeaten("poke")) s = findStairs("poke")
  else if (unbeaten("passage")) s = findStairs("passage")
  else if (unbeaten("original")) s = findStairs("original")
  else if (unbeaten("slightly")) s = findStairs("slightly")
  else return
  assert(s)
  drawImgMap(ctxMap, imgArrowDown, s.pos.addDir(1))
}

async function DrawMenu(ctxMap, ctxMini, ctxView) {
  DrawTiles(ctxMap, ctxMini)
  DrawActors(ctxMap, ctxMini)
  drawDevmode(ctxMap)
  maybeDrawTutorialBang(ctxMap)
  drawImgMap(ctxMap, imgSelector, menuSelectPos)

  const screenshotMap = await createImageBitmap(canvasMap)
  ctxWith(ctxView, {fillStyle: 'white'}, cls)

  ctxView.drawImage(screenshotMap,
    0, 0, canvasView.width, canvasView.width,
    0, 0, canvasView.width, canvasView.height
  )

  const level = getFocusedLevel()
  if (level) drawLevelLabel(ctxView, level)

  DrawMisc(ctxView)
}

function menuMouseMove(e, pos) {
  if (pos.roomPos().inbounds()) menuSelectPos = pos
}

function maybeMenuMouseClick(e, pos) {
  assert(gameState === GS_MENU)
  menuSelectPos = pos
  if (e.button === 0) return DoMenuSelect()
  return false
}

function menuOnKeyUp(e) {}
function menuOnKeyDown(e) {
  assert(gameState === GS_MENU)
  if (e.code === "Space" || e.code === "Enter") {
    DoMenuSelect()
  }
}


function isLocalStorageAvailable(cb) {
  return !!ignoreCorsErrors(() => window.localStorage)
}

function ignoreCorsErrors(cb) {
  try {
    return cb()
  } catch (e) {
    // ignore CORS stuff when developing locally
    if (e.name !== "SecurityError") throw e
  }
}

function clearProgress(levelName) {
  return ignoreCorsErrors(() => {
    window.localStorage.clear()
  })
}

function getProgress(levelName, type) {
  assert(type === "win" || type === "bonus")
  return ignoreCorsErrors(() => {
    const ls = window.localStorage
    if (ls && ls[levelName]) {
      return ls[levelName].includes(type)
    } else {
      return false
    }
  })
}

function setProgress(levelName, type) {
  // return the previous state
  assert(type === "win" || type === "bonus")
  if (getProgress(levelName, type)) return true
  return ignoreCorsErrors(() => {
    const ls = window.localStorage
    if (ls[levelName]) {
      ls[levelName] = `${ls[levelName]} ${type}`
    } else {
      ls[levelName] = type
    }
    return false
  })
}
