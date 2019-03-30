function FitCanvasesToTiles() {
  assert(globalExists(() => tileSize))
  assert(globalExists(() => miniTileSize))
  const { w, h } = tilesDim()
  canvasMap.width = w*tileSize
  canvasMap.height = h*tileSize
  canvasMini.width = w*miniTileSize
  canvasMini.height = h*miniTileSize
}

function solid(tileName) {
  if (tileName === null) { return false }
  return !!tileName.match(/^img\w+Wall$/)
}

function CanMoveToTile(p) {
  if (!inbounds(p)) { return false }
  if (solid(getTile(p))) { return false }
  return true
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

function lookupTileImg(name) {
  return document.getElementById(name)
}
function lookupTileImgMini(name) {
  return document.getElementById(`${name}-mini`)
}
function DrawTiles(ctxMap, ctxMini) {
  const {w, h} = tilesDim()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const name = tiles[y][x]
      const img = document.getElementById(name)
      drawImgMap(ctxMap, img, new MapPos(x, y))

      const fillStyle = document.getElementById(name).dataset.color
      ctxWith(ctxMini, {fillStyle}, () => {
        ctxMini.fillRect(x*miniTileSize, y*miniTileSize, miniTileSize, miniTileSize)
      })
    }
  }
}

function GetTileColor(p) {
  assert(0)
  // const name = getTile(p)
  // assert(name)
  // return document.getElementById(name).dataset.color
}

function GetRoomColors(room) { // todo room.tileColors()
  return {
    Wall: document.getElementById(`img${room.name}Wall`).dataset.color,
    Floor: document.getElementById(`img${room.name}Floor`).dataset.color,
  }
}

function roomFromName(name) { // todo Room.findName
  return rooms.find(l=>l.name===name)
}

function getRoom(id) { // todo Room.findId
  return rooms.find(l=>l.id===id)
}

function getRoomAt(pos) { //todo kill; use pos.room() instead
  assert(pos.constructor === MapPos)
  return pos.room()
}

function getTile(p) {
  if (inbounds(p)) {
    return tiles[p.y][p.x]
  } else {
    return null
  }
}

function setTile(p, name) {
  if (inbounds(p)) {
    tiles[p.y][p.x] = name
  }
}

function setTileWall(p) {
  let name = getTile(p)
  assert(name)
  name = name.replace("Floor", "Wall")
  setTile(p, name)
}

function setTileFloor(p) {
  let name = getTile(p)
  assert(name)
  name = name.replace("Wall", "Floor")
  setTile(p, name)
}

function SaveLevel(name) {
  name = name.toLowerCase()
  downloadFile(`${name}.lvl`, Export(name))
}
