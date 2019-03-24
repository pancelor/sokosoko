// class Tile {
//   constructor(name) {
//     this.img = document.getElementById(name)
//     this.solid = this.constructor.solid
//   }

//   draw(ctx) {
//     drawImg(ctx, this.img, this.pos)
//   }
// }

// class Floor extends Tile {  static solid = false }
// class RedFloor extends Floor { static imgName = "red-floor" }
// class BlueFloor extends Floor { static imgName = "blue-floor" }
// class GreenFloor extends Floor { static imgName = "green-floor" }
// class YellowFloor extends Floor { static imgName = "yellow-floor" }

// class Wall extends Tile { static solid = true }
// class RedWall extends Wall { static imgName = "red-wall" }
// class BlueWall extends Wall { static imgName = "blue-wall" }
// class GreenWall extends Wall { static imgName = "green-wall" }
// class YellowWall extends Wall { static imgName = "yellow-wall" }

// const allTileTypes = [RedFloor, BlueFloor, GreenFloor, YellowFloor, RedWall, BlueWall, GreenWall, YellowWall]

function InitTiles() {
  ImportTiles()
  fitCanvasToTiles()
}

function fitCanvasToTiles() {
  assert(globalExists(() => tileSize))
  const { w, h } = tilesDim()
  canvas.width = w*tileSize
  canvas.height = h*tileSize
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

function DrawTiles(ctx) {
  const {w: ncc, h: nrr} = tilesDim()
  for (let rr = 0; rr < nrr; rr++) {
    for (let cc = 0; cc < ncc; cc++) {
      const name = tiles[rr][cc]
      const img = document.getElementById(name)
      assert(img)
      const pos = new Pos({x: cc, y: rr})
      drawImg(ctx, img, pos)
    }
  }
}

function GetTileColor(p) {
  const name = getTile(p)
  assert(name)
  return document.getElementById(name).dataset.color
}

function GetLevelColor(levelId) {
  const topleft = Pos.fromLevel(getLevel(levelId), pcoord(0, 0))
  // return GetTileColor(topleft)
  const name = getTile(topleft)
  const match = name.match(/^img(?<col>\w+)Wall$/)
  if (!match) { return null }
  return match.groups.col
}

function getTile(p) {
  if (inbounds(p)) {
    return tiles[p.y][p.x]
  } else {
    return null
  }
}

function setTile(p, name) { // TODO use me
  if (inbounds(p)) {
    tiles[p.y][p.x] = name
  }
}

function SaveLevel() {
  downloadFile("level.dat", ExportLevelString())
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
        // assert(openings[1] === null) // doesn't really work...
        openings[1] = Pos.fromLevel(level, {x: ix, y})
      }
    }
    if (rr + 1 === level.end) {
      const ix = tiles[rr].findIndex(name=>!solid(name))
      if (ix !== -1) {
        // assert(openings[3] === null) // doesn't really work...
        openings[3] = Pos.fromLevel(level, {x: ix, y})
      }
    }
    if (!solid(tiles[rr][0])) {
      // assert(openings[2] === null) // doesn't really work...
      openings[2] = Pos.fromLevel(level, {x: 0, y})
    }
    if (!solid(tiles[rr][lastColumn])) {
      // assert(openings[0] === null) // doesn't really work...
      openings[0] = Pos.fromLevel(level, {x: lastColumn, y})
    }
  }
  return openings
}
