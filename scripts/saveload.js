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

function ImportTiles() {
  initTileSerTables()

  // imports `tileData` from level.dat into the global var `tiles`
  if (!globalExists(() => tileData)) {
    console.warn("could not find any saved tileData")
    tiles = [[]]
    return
  }

  let lines = tileData.trim().split('\n').map(l=>l.trim())
  const nrr = lines.length
  const ncc = lines[0].length
  tiles = [];
  for (let rr = 0; rr < nrr; rr++) {
    tiles.push([]);
    for (let cc = 0; cc < ncc; cc++) {
      const code = lines[rr][cc];
      const name = deserTileName[code]
      assert(name)
      tiles[rr][cc] = name
    }
  }
}

function exportTilesString() {
  const lines = []
  lines.push("const tileData = `")
  const {width: ncc, height: nrr} = tilesDim()
  for (let rr = 0; rr < nrr; rr++) {
    const chars = ["  "]
    for (let cc = 0; cc < ncc; cc++) {
      const imgName = tiles[rr][cc];
      chars.push(serTileName[imgName]);
    }
    lines.push(chars.join(''))
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
