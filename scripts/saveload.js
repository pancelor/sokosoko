//
// globals
//

let deserActorClass;
let deserTileName;
let serTileName;

function initActorSerTables() {
  // e.g. deserActorClass["Player"] -> Player (constructor)
  //   (to go the other way, use constructorVar.name)

  deserActorClass = {}
  for (let cst of allActorTypes) {
    deserActorClass[cst.name] = cst
  }
}

function initTileSerTables() {
  // e.g. serTileName["dirt"] -> 1
  // e.g. deserTileName[1] -> "dirt"

  serTileName = {}
  let i = 0
  for (let img of tilesList.children) {
    serTileName[img.id] = i
    i += 1
  }

  if (globalExists(() => savedDeserTileName)) {
    deserTileName = savedDeserTileName
  } else {
    console.warn("No tile deserialization table found; rebuilding")
    deserTileName = {}
    let i = 0
    for (let img of tilesList.children) {
      deserTileName[i] = img.id
      i += 1
    }
  }
}

function exportTilesDeserTable() {
  const lines = []
  lines.push("const savedDeserTileName = {")
  let i = 0
  for (let img of tilesList.children) {
    lines.push(`  ${i}: "${img.id}",`)
    i += 1
  }
  lines.push("}")
  lines.push("")
  return lines.join("\n")
}

let tiles
let levels

function ImportTiles() {
  initTileSerTables()

  // imports `tileData` from level.dat into the global var `tiles`
  if (!globalExists(() => tileData)) {
    console.warn("could not find any saved tileData")
    tiles = [[]]
    return
  }

  tiles = []
  levels = []

  let lines = tileData.trim().split('\n').map(l=>l.trim())
  let line
  let line_ix = 0
  function nextLine() {
    if (line_ix === lines.length) { return false }
    line = lines[line_ix]
    line_ix += 1
    return true
  }

  function parseLevel() {
    const level = {}
    const good = nextLine()
    if (!good) { return false }

    const match = line.match(/^level (?<id>\d+)$/)
    assert(match, "bad level header")
    level.id = int(match.groups.id)
    level.begin = tiles.length

    while (nextLine()) {
      if (line === '') { break }
      assert(line.length === 8)
      const row = []
      for (let code of line) {
        const name = deserTileName[code]
        assert(name)
        row.push(name)
      }
      tiles.push(row)
    }
    level.end = tiles.length // level lives in `tiles` from level.begin to level.end (not inclusive on `end`)
    assert(level.begin < level.end)
    levels.push(level)
    return true
  }

  while (parseLevel()) {}

  // console.log(exportTilesString());
  // console.log(levels);
}

function exportLevelString(level) {
  const lines = []
  lines.push(`  level ${level.id}`)
  for (let rr = level.begin; rr < level.end; rr += 1) {
    const chars = ["  "]
    for (let imgName of tiles[rr]) {
      chars.push(serTileName[imgName])
    }
    lines.push(chars.join(''))
  }
  return lines.join("\n")
}

function exportTilesString() {
  const lines = []
  lines.push("const tileData = `")
  for (let level of levels) {
    lines.push(exportLevelString(level))
    lines.push("")
  }
  lines.push("`")
  lines.push("")
  return lines.join("\n")
}

function ImportActors() {
  initActorSerTables()

  // imports `actorData` from level.dat into the global var `actors`
  if (!globalExists(() => actorData)) {
    console.warn("could not find any saved actorData")
    actors = []
    return
  }

  let lines = actorData.trim().split('\n').map(l=>l.trim())
  actors = [];
  for (let l of lines) {
    const type = l.split(' ')[0]
    const klass = deserActorClass[type]
    assert(klass !== undefined, `could not find actor type ${type} for deserialization`)
    actors.push(klass.deserialize(l));
  }
}

function exportActorsString() {
  const lines = []
  lines.push("const actorData = `")
  for (let a of actors) {
    lines.push(`  ${a.serialize()}`)
  }
  lines.push("`")
  lines.push("")
  return lines.join("\n")
}

function ExportLevelString() {
  const lines = []
  lines.push(exportTilesDeserTable())
  lines.push(exportTilesString())
  lines.push(exportActorsString())
  return lines.join("\n")
}
