let gameState
const GS_MENU = 1
const GS_PLAYING = 2

let menuSelectHexPos = null
function InitMenu(levelName) {
  gameState = GS_MENU
  const success = loadLevel("menu")
  assert(success)

  menuSelectHexPos = { row: 2, col: 1 }
  const stairs = findStairs(levelName)
  if (stairs) menuSelectHexPos = pos_as_hex(stairs.pos.mapPos())

  ResetTileCache()
  Raf()
}

function findStairs(levelName) {
  return actors.find(a=>a.constructor === Stairs && a.name === levelName)
}

function processMenuInput(dir) {
  if (![0,1,2,3].includes(dir)) return false // ignore undo/redo

  const pos = hex_as_pos(menuSelectHexPos).addDir(dir)
  if (!pos.roomPos().inbounds()) return false

  menuSelectHexPos = pos_as_hex(pos)
  playSound(sndWalk)

  Raf()
  return true
}

function DoMenuSelect() {
  const level = getFocusedLevel()
  if (level) {
    gameState = GS_PLAYING
    playSound(sndLoad)
    return loadLevel(level)
  } else {
    return false
  }
}

function getFocusedLevel() {
  if (!menuSelectHexPos) return null
  const { col: x, row: y } = menuSelectHexPos
  const stairs = findActor(Stairs, new MapPos(x, y))
  return stairs ? stairs.name : null
}

async function DrawMenu(ctxMap, ctxMini, ctxView) {
  const bkgColor = Room.findName("White").tileColors().Floor
  ctxWith(ctxView, {fillStyle: bkgColor}, cls)

  // draw stairs
  for (const a of actors) {
    if (a.constructor.name !== "Stairs") continue
    const { x, y } = oddr_offset_to_pixel({ row: a.pos.y, col: a.pos.x })
    const imgPreview = document.getElementById(`${a.name}-preview`) || imgCrate
    ctxView.drawImage(imgPreview, x, y)
    if (getProgress(a.name, "win")) ctxView.drawImage(imgCheck, x+4, y+16)
    if (getProgress(a.name, "bonus")) ctxView.drawImage(imgCheck, x+9, y+16)
  }
  drawDevmode(ctxView)

  // temp
  if (menuSelectHexPos) {
    const { x, y } = oddr_offset_to_pixel(menuSelectHexPos)
    ctxView.drawImage(imgSelector, x, y)
  }
  // visualizeCandidates(ctxView)

  const level = getFocusedLevel()
  if (level) drawLevelLabel(ctxView, level)

  DrawMisc(ctxView)
}

function menuMouseMove(e, pos) {
  if (pos.roomPos().inbounds()) {
    menuSelectHexPos = pixel_to_pointy_hex({ x: e.offsetX, y: e.offsetY })
  }
}

function maybeMenuMouseClick(e, pos) {
  assert(gameState === GS_MENU)
  menuSelectHexPos = pixel_to_pointy_hex({ x: e.offsetX, y: e.offsetY })
  if (e.button === 0) return DoMenuSelect()
  return false
}

function menuOnKeyUp(e) { sharedOnKeyUp(e) }
function menuOnKeyDown(e) {
  assert(gameState === GS_MENU)
  sharedOnKeyDown(e)
  if (e.code === "Space" || e.code === "Enter") {
    DoMenuSelect()
  }
}

//
// local storage
//

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

//
// hex coordinates
//
// There are 4 main coordinate systems in use:
//   * oddr coordinates (hex)
//   * cube coordinates (alternate hex system)
//   * pixel coordinates
//   * "standard" MapPos coordinates
// see https://www.redblobgames.com/grids/hexagons/#pixel-to-hex more info

function hex_as_pos(hex) {
  return new MapPos(hex.col, hex.row)
}

function pos_as_hex(pos) {
  return { row: pos.y, col: pos.x }
}

function cube_to_oddr(cube) {
  const col = cube.x + (cube.z - (cube.z&1)) / 2
  const row = cube.z
  return { row, col }
}

function cube_round(cube) {
  let rx = Math.round(cube.x)
  let ry = Math.round(cube.y)
  let rz = Math.round(cube.z)

  const x_diff = Math.abs(rx - cube.x)
  const y_diff = Math.abs(ry - cube.y)
  const z_diff = Math.abs(rz - cube.z)

  if (x_diff > y_diff && x_diff > z_diff) {
    rx = -ry-rz
  } else if (y_diff > z_diff) {
    ry = -rx-rz
  } else {
    rz = -rx-ry
  }

  return { x: rx, y: ry, z: rz}
}

function cube_neighbors(cube) {
  const cube_directions = [
    { x: +1, y: -1, z: 0 }, { x: +1, y: 0, z: -1 }, { x: 0, y: +1, z: -1 },
    { x: -1, y: +1, z: 0 }, { x: -1, y: 0, z: +1 }, { x: 0, y: -1, z: +1 },
  ]
  return cube_directions.map(d=>({ x: d.x+cube.x, y: d.y+cube.y, z: d.z+cube.z }))
}

let candidates = [] // temp debug stuff; you can move it inside this fxn if you don't need to visualize anymore
function pixel_to_pointy_hex(point) {
  const size = 43*2/3 // magic; tweaked manually until it worked well enough
  const q = (Math.sqrt(3)/3 * point.x  -  1/3 * point.y) / size
  const r = (                        2/3 * point.y) / size
  let cube = cube_round({ x: q, y: -q-r, z: r })

  // hack: the above gets us close enough,
  // now adjust to a neighbor if necessary
  candidates = cube_neighbors(cube)
  candidates.push(cube)
  const distSqs = candidates.map(c=>{
    let { x, y } = oddr_offset_to_pixel(cube_to_oddr(c))
    x += 32 // adjust center
    y += 32
    assert(imgHexmask1.width === 64 && imgHexmask1.height === 64)
    return (x-point.x)**2 + (y-point.y)**2
  })
  const { arg: ix } = argmin(distSqs)
  cube = candidates[ix]
  return cube_to_oddr(cube)
}
function visualizeCandidates(ctxView) {
  for (let c of candidates) {
    const { x, y } = oddr_offset_to_pixel(cube_to_oddr(c))
    ctxWith(ctxView, {globalAlpha: 0.5}, () => {
      ctxView.drawImage(imgSelector, x, y)
    })
  }
}

function oddr_offset_to_pixel(hex) {
  const x = hex.col*48 + 24*(hex.row&1)
  const y = hex.row*39
  return new MapPos(x, y)
}

function translateHex({e, pos}) {
  if (gameState === GS_MENU) pos = hex_as_pos(pixel_to_pointy_hex({ x: e.offsetX, y: e.offsetY }))
  return { e, pos }
}
