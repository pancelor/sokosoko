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
  playSound(sndWalk)

  Raf()
  return true
}

function DoMenuSelect() {
  const level = getFocusedLevel()
  if (level) {
    gameState = GS_PLAYING
    playSound(sndEnter)
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

async function DrawMenu(ctxMap, ctxMini, ctxView) {
  DrawTiles(ctxMap, ctxMini)
  DrawActors(ctxMap, ctxMini)
  drawDevmode(ctxMap)
  drawImgMap(ctxMap, imgSelector, menuSelectPos)

  const screenshotMap = await createImageBitmap(canvasMap)
  ctxWith(ctxView, {fillStyle: 'white'}, cls)

  ctxView.drawImage(screenshotMap,
    0, 0, canvasView.width, canvasView.width,
    0, 0, canvasView.width, canvasView.height
  )

  const level = getFocusedLevel()
  if (level) {
    const preview = document.getElementById(`${level}-preview`)
    drawLevelTitle(ctxView, preview, level.toUpperCase())
  }

  DrawGUI(ctxView)
}

function menuMouseMove(e, pos) {
  if (CanMoveToTile(pos)) menuSelectPos = pos
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
