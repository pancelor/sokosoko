let gameState
const GS_MENU = 1
const GS_PLAYING = 2

const gameProgress = {}

let menuFocus = null
function InitMenu(levelName) {
  gameState = GS_MENU
  const success = loadLevel("menu")
  assert(success)
  player.dead = true // need savedata to have a player so importFrameStack doesn't freak out

  menuFocus = actors.find(a=>a.constructor === Stairs && a.name === levelName)
  if (!menuFocus) menuFocus = actors.find(a=>a.constructor === Stairs && a.name === "zero")

  ResetTileCache()
  Raf()
}

function MenuUpdate(dir) {
  assert([0,1,2,3].includes(dir))

  let { pos } = menuFocus
  const sent = getSafeSentinel()
  while (sent()) {
    pos = pos.addDir(dir)
    if (!CanMoveToTile(pos)) return false
    const a = findActor(Stairs, pos)
    if (a) {
      menuFocus = a
      Raf()
      return true
    }
  }
}

function DoMenuSelect() {
  gameState = GS_PLAYING
  reset(getSelectedLevelName())
}

function getSelectedLevelName() {
  return menuFocus.name
}

async function DrawMenu(ctxMap, ctxMini, ctxView) {
  DrawTiles(ctxMap, ctxMini)
  DrawActors(ctxMap, ctxMini)
  drawImgMap(ctxMap, imgSelector, menuFocus.pos)

  const screenshotMap = await createImageBitmap(canvasMap)
  ctxWith(ctxView, {fillStyle: 'white'}, cls)

  ctxView.drawImage(screenshotMap,
    0, 0, canvasView.width, canvasView.width,
    0, 0, canvasView.width, canvasView.height
  )

  drawLabel(ctxView, getSelectedLevelName().toUpperCase())
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
  } else if (e.code in KeyDirMap) {
    const dir = KeyDirMap[e.code]
    if (![0,1,2,3].includes(dir)) return // only movement in menu
    MenuUpdate(dir)
  }
}
