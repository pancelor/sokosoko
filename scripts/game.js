const allActorTypes = []

class Player {

}

function initGame() {
  console.log("initGame()")
}

function drawGame(ctx) {
  // TODO
}

function initTiles() {
  importTiles()
}

function initActors() {
  importActors()
}

function fitCanvasToTiles() {
  const { width, height } = tilesDim()
  canvas.width = width*gridX
  canvas.height = height*gridX
}

function tilesDim() {
  assert(tiles)
  assert(tiles.length > 0)
  return {
    width: tiles[0].length,
    height: tiles.length,
  }
}
