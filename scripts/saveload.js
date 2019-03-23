//
// globals
//

let deserActorClass;
let deserTileName;
let serTileName;

function initSerTables() {
  deserActorClass = {}
  for (let cst of allActorTypes) {
    deserActorClass[cst.name] = cst
  }

  serTileName = {}
  let i = 0
  for (let img of tilesList.children) {
    serTileName[img.id] = i
    i += 1
  }

  try {
    // if level.dat has a `savedDeserTileName`, we load it here
    deserTileName = savedDeserTileName
  } catch (e) {
    if (e.name === "ReferenceError") {
      console.warn("No tile deserialization table found; rebuilding")
      deserTileName = {}
      let i = 0
      for (let img of tilesList.children) {
        deserTileName[i] = img.id
        i += 1
      }
    } else {
      throw e
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

function globalExists(varName) {
  return (window[varName] !== undefined)
}

function importTiles() {
  // imports `tileData` from level.dat into the global var `tiles`
  if (!globalExists("tileData")) {
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
      tiles[rr][cc] = deserTileName[code]
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
      const name = tiles[rr][cc];
      chars.push(serTileName[name]);
    }
    lines.push(chars.join(''))
  }
  lines.push("`")
  lines.push("")
  return lines.join("\n")
}

function importActors() {
  // imports `actorData` from level.dat into the global var `actors`
  if (!globalExists("actorData")) {
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

function exportLevelString() {
  const lines = []
  lines.push(exportTilesDeserTable())
  lines.push(exportTilesString())
  lines.push(exportActorsString())
  return lines.join("\n")
}
