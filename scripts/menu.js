let gameState
const GS_MENU = 1
const GS_PLAYING = 2

const gameProgress = {}

let menuSelectPos = null
function InitMenu(levelName) {
  gameState = GS_MENU
  const success = loadLevel("menu")
  assert(success)
  player.dead = true // need savedata to have a player so importFrameStack doesn't freak out

  menuSelectPos = new MapPos(2, 2)
  const stairs = actors.find(a=>a.constructor === Stairs && a.name === levelName)
  if (stairs) menuSelectPos = stairs.pos.mapPos()

  ResetTileCache()
  Raf()
}

function processMenuInput(dir) {
  if (![0,1,2,3].includes(dir)) return // ignore undo/redo

  const pos = menuSelectPos.addDir(dir)
  if (!CanMoveToTile(pos)) return false

  menuSelectPos = pos
  Raf()
  return true
}

function DoMenuSelect() {
  const level = getFocusedLevel()
  if (level) {
    gameState = GS_PLAYING
    playSound(sndEnter)
    reset(level)
  }
}

function getFocusedLevel() {
  const stairs = findActor(Stairs, menuSelectPos)
  return stairs ? stairs.name : null
}

async function DrawMenu(ctxMap, ctxMini, ctxView) {
  DrawTiles(ctxMap, ctxMini)
  DrawActors(ctxMap, ctxMini)
  drawImgMap(ctxMap, imgSelector, menuSelectPos)

  const screenshotMap = await createImageBitmap(canvasMap)
  ctxWith(ctxView, {fillStyle: 'white'}, cls)

  ctxView.drawImage(screenshotMap,
    0, 0, canvasView.width, canvasView.width,
    0, 0, canvasView.width, canvasView.height
  )

  const level = getFocusedLevel()
  if (level) {
    drawLabel(ctxView, level.toUpperCase())
  }

  DrawGUI(ctxView)
}

function menuOnMouseMove(e) {}
function menuOnMouseDown(e) {
  assert(gameState === GS_MENU)
  if (e.target === canvasView) {
    canvasView.focus()
  } else if (e.target === canvasMap) {
    lockScroll(()=>canvasView.focus())
  }
}

function menuOnKeyUp(e) {}
function menuOnKeyDown(e) {
  assert(gameState === GS_MENU)
  if (e.code === "Space" || e.code === "Enter") {
    DoMenuSelect()
  }
}
