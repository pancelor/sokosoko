function FitCanvasesToTiles() {
  assert(globalExists(() => tileSize))
  assert(globalExists(() => miniTileSize))
  const { w, h } = tilesDim()
  canvasMap.width = w*tileSize
  canvasMap.height = h*tileSize
  canvasMini.width = w*miniTileSize
  canvasMini.height = h*miniTileSize
}

function CanMoveToTile(p) {
  const rp = p.roomPos()
  if (rp.oob) { return false }
  if (!rp.inbounds()) { return false }
  return !getTile(p)
}

function inbounds_(x, y, w, h) {
  if (x == null || y == null) { return false }
  // if (dim === undefined) { // TODO did we need this at any calling site?
  //   dim = tilesDim()
  // }
  // const {w, h} = dim

  return 0 <= x && x < w && 0 <= y && y < h
}

function tilesDim() {
  assert(tiles)
  assert(tiles.length > 0)
  return {
    w: tiles[0].length,
    h: tiles.length,
  }
}

function tileImg(pos) {
  const solid = getTile(pos)
  const room = pos.room()
  if (!room) return imgInternalWall
  return document.getElementById(`img${room.name}${solid ? "Wall" : "Floor"}`)
}

function DrawTiles(ctxMap, ctxMini) {
  if (mapTileCache && miniTileCache) {
    ctxMap.drawImage(mapTileCache, 0, 0)
    ctxMini.drawImage(miniTileCache, 0, 0)
    return
  }
  console.warn("redrawing tiles")
  const {w, h} = tilesDim()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = new MapPos(x, y)
      const img = tileImg(p)
      drawImgMap(ctxMap, img, p)

      const fillStyle = img.dataset.color
      ctxWith(ctxMini, {fillStyle}, () => {
        ctxMini.fillRect(x*miniTileSize, y*miniTileSize, miniTileSize, miniTileSize)
      })
    }
  }
}

let mapTileCache;
let miniTileCache;
function ResetTileCache(cb) {
  mapTileCache = null
  miniTileCache = null
  DrawTiles(canvasMap.getContext('2d'), canvasMini.getContext('2d'), true)
  screenshotTiles() // NOTE: this is async but we're just gonna let it finish whenever
}
async function screenshotTiles() {
  mapTileCache = await createImageBitmap(canvasMap)
  miniTileCache = await createImageBitmap(canvasMini)
}

function getTile(pos) {
  const mp = pos.mapPos()
  if (mp.inbounds()) {
    return tiles[mp.y][mp.x]
  } else {
    return null
  }
}

function setTile(pos, solid) {
  const mp = pos.mapPos()
  if (mp.inbounds()) {
    tiles[mp.y][mp.x] = !!solid

    // setTile only happens in development so doing this everytime is fine
    // Even in normal non-devmode it's pretty much fine
    assert(devmode)
    ResetTileCache()
  }
}

function SaveLevel(name) {
  name = name.toLowerCase()
  if (name === "") name = "untitled"
  downloadFile(`${name}.lvl`, Export(name))
}
