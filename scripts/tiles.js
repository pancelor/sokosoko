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
  assert(globalExists(() => [tileWidth, tileHeight]))
  const { width, height } = tilesDim()
  canvas.width = width*tileWidth
  canvas.height = height*tileHeight
}

function solid(tileName) {
  if (tileName === null) { return false }
  return [
    "imgRedWall",
    "imgBlueWall",
    "imgGreenWall",
    "imgYellowWall",
  ].includes(tileName)
}

function CanMoveToTile(p) {
  if (!inbounds(p)) { return false }
  if (solid(getTile(p))) { return false }
  return true
}

function inbounds(p) {
  const {x, y} = p
  const {width, height} = tilesDim()
  if (x == null || y == null) { return false }
  return 0 <= x && x < width && 0 <= y && y < height
}

function tilesDim() {
  assert(tiles)
  assert(tiles.length > 0)
  return {
    width: tiles[0].length,
    height: tiles.length,
  }
}

function DrawTiles(ctx) {
  const {width: ncc, height: nrr} = tilesDim()
  for (let rr = 0; rr < nrr; rr++) {
    for (let cc = 0; cc < ncc; cc++) {
      const name = tiles[rr][cc]
      const img = document.getElementById(name)
      assert(img)
      const pos = {x: cc, y: rr}
      drawImg(ctx, img, pos)
    }
  }
}


function getTile(p) { // TODO use me
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
    if (rr === level.begin) {
      const ix = tiles[rr].findIndex(name=>!solid(name))
      if (ix !== -1) {
        // assert(openings[1] === null) // doesn't really work...
        openings[1] = {x: ix, y: rr}
      }
    }
    if (rr + 1 === level.end) {
      const ix = tiles[rr].findIndex(name=>!solid(name))
      if (ix !== -1) {
        // assert(openings[3] === null) // doesn't really work...
        openings[3] = {x: ix, y: rr}
      }
    }
    if (!solid(tiles[rr][0])) {
      // assert(openings[2] === null) // doesn't really work...
      openings[2] = {x: 0, y: rr}
    }
    if (!solid(tiles[rr][lastColumn])) {
      // assert(openings[0] === null) // doesn't really work...
      openings[0] = {x: lastColumn, y: rr}
    }
  }
  return openings
}
