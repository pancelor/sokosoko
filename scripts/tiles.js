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

function GetLevelColors(level) {
  return {
    Wall: document.getElementById(`img${level.name}Wall`).dataset.color,
    Floor: document.getElementById(`img${level.name}Floor`).dataset.color,
  }
}

function GetTileColor(p) {
  assert(0)
  // const name = getTile(p)
  // assert(name)
  // return document.getElementById(name).dataset.color
}

function levelFromName(name) {
  return levels.find(l=>l.name===name)
}

function getLevel(id) {
  return levels.find(l=>l.id===id)
}

function getLevelAt(pos) {
  return levels.find(l=>l.begin <= pos.y && pos.y < l.end)
}

function getLevelTopLeft(level) {
  return Pos.fromLevel(level, pcoord(0, 0))
}

// function getLevelTileName(level, type) {
//   assert(type === "Wall" || type === "Floor")
//   return `img${level.name}${type}`
// }

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

function LevelOpenings(level) {
  // LevelOpenings(level)[dir] -> {x, y} world coordinates (_not_ level coordinates) of an entrance to level on the `dir` side
  // LevelOpenings(level)[dir] -> null if no entrances on that side

  const openings = [null, null, null, null] // a dir-indexed dictionary
  const lastColumn = tiles[level.begin].length - 1
  for (let rr = level.begin; rr < level.end; rr += 1) {
    const y = rr - level.begin
    if (rr === level.begin) {
      const ix = tiles[rr].findIndex(name=>!solid(name))
      if (ix !== -1) {
        // assertEqual(openings[1], null) // doesn't really work...
        openings[1] = Pos.fromLevel(level, {x: ix, y})
      }
    }
    if (rr + 1 === level.end) {
      const ix = tiles[rr].findIndex(name=>!solid(name))
      if (ix !== -1) {
        // assertEqual(openings[3], null) // doesn't really work...
        openings[3] = Pos.fromLevel(level, {x: ix, y})
      }
    }
    if (!solid(tiles[rr][0])) {
      // assertEqual(openings[2], null) // doesn't really work...
      openings[2] = Pos.fromLevel(level, {x: 0, y})
    }
    if (!solid(tiles[rr][lastColumn])) {
      // assertEqual(openings[0], null) // doesn't really work...
      openings[0] = Pos.fromLevel(level, {x: lastColumn, y})
    }
  }
  return openings
}
