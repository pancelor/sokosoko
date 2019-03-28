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

function inbounds(p, dim) {
  const {x, y} = p
  if (x == null || y == null) { return false }
  if (dim === undefined) {
    dim = tilesDim()
  }
  const {w, h} = dim

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
      drawImgMap(ctxMap, img, pcoord(x, y))

      const fillStyle = document.getElementById(name).dataset.color
      ctxWith(ctxMini, {fillStyle}, () => {
        ctxMini.fillRect(x*miniTileSize, y*miniTileSize, miniTileSize, miniTileSize)
      })
    }
  }
}

function GetRoomColors(room) {
  return {
    Wall: document.getElementById(`img${room.name}Wall`).dataset.color,
    Floor: document.getElementById(`img${room.name}Floor`).dataset.color,
  }
}

function GetTileColor(p) {
  assert(0)
  // const name = getTile(p)
  // assert(name)
  // return document.getElementById(name).dataset.color
}

function roomFromName(name) {
  return rooms.find(l=>l.name===name)
}

function getRoom(id) {
  return rooms.find(l=>l.id===id)
}

function getRoomAt(pos) {
  return rooms.find(l=>l.begin <= pos.y && pos.y < l.end)
}

function getRoomTopLeft(room) {
  return Pos.fromRoom(room, pcoord(0, 0))
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

function RoomOpenings(room) {
  // RoomOpenings(room)[dir] -> {x, y} world coordinates (_not_ room coordinates) of an entrance to room on the `dir` side
  // RoomOpenings(room)[dir] -> null if no entrances on that side

  const openings = [null, null, null, null] // a dir-indexed dictionary
  const lastColumn = tiles[room.begin].length - 1
  for (let rr = room.begin; rr < room.end; rr += 1) {
    const y = rr - room.begin
    if (rr === room.begin) {
      const ix = tiles[rr].findIndex(name=>!solid(name))
      if (ix !== -1) {
        // assertEqual(openings[1], null) // doesn't really work...
        openings[1] = Pos.fromRoom(room, {x: ix, y})
      }
    }
    if (rr + 1 === room.end) {
      const ix = tiles[rr].findIndex(name=>!solid(name))
      if (ix !== -1) {
        // assertEqual(openings[3], null) // doesn't really work...
        openings[3] = Pos.fromRoom(room, {x: ix, y})
      }
    }
    if (!solid(tiles[rr][0])) {
      // assertEqual(openings[2], null) // doesn't really work...
      openings[2] = Pos.fromRoom(room, {x: 0, y})
    }
    if (!solid(tiles[rr][lastColumn])) {
      // assertEqual(openings[0], null) // doesn't really work...
      openings[0] = Pos.fromRoom(room, {x: lastColumn, y})
    }
  }
  return openings
}
