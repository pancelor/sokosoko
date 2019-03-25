//
// globals
//

let deserActorClass;
let deserTileName;
let serTileName;

function DoImports() {
  importTiles()
  FitCanvasToTiles()
  taggedActors = {}
  importActors()
  player = allActors(Player)[0]
  importFrameStack()
}

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

function exportTilesDeserTable() { // TODO this is broken
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

function importTiles() {
  initTileSerTables()

  // imports `tileData` from level.dat into the global var `tiles`
  if (!globalExists(() => tileData)) {
    console.warn("could not find any saved tileData")
    tiles = [[]]
    return
  }

  tiles = []
  levels = []

  let lines = sanitizeLines(tileData)
  let line
  let line_ix = 0 // the index of the next line
  let eof = false
  function nextLine() {
    if (line_ix === lines.length) {
      eof = true
      return false
    }
    line = lines[line_ix]
    line_ix += 1
    return true
  }

  const levelHeader = (line) => line.match(/^level (?<id>\d+)$/)

  nextLine()
  while (!eof) {
    const match = levelHeader(line)
    assert(match, "bad level header")
    const level = {}
    level.id = int(match.groups.id)
    level.begin = tiles.length

    nextLine()
    while (!eof && !levelHeader(line)) {
      assertEqual(line.length, 8)
      const row = []
      for (let code of line) {
        const name = deserTileName[code]
        assert(name)
        row.push(name)
      }
      tiles.push(row)
      nextLine()
    }
    level.end = tiles.length // level lives in `tiles` from level.begin to level.end (not inclusive on `end`)
    assert(level.begin < level.end)
    levels.push(level)
  }

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

let taggedActors
function importActors() {
  initActorSerTables()

  // imports `actorData` from level.dat into the global var `actors`
  if (!globalExists(() => actorData)) {
    console.warn("could not find any saved actorData")
    actors = []
    return
  }

  let lines = sanitizeLines(actorData)

  actors = [];
  for (let l of lines) {
    let tag
    ;([l, tag] = l.split('@'))
    const type = l.split(' ')[0]
    const klass = deserActorClass[type]
    assert(klass !== undefined, `could not find actor type ${type} for deserialization`)
    const a = klass.deserialize(l)
    if (!a) continue
    actors.push(a);
    if (tag) {
      taggedActors[tag] = a.id
    }
  }
}

function importFrameStack() {
  assert(taggedActors)
  // imports `frameStackData` from level.dat into the var `player.frameStack`
  if (!globalExists(() => frameStackData)) {
    console.warn("could not find any saved frameStackData")
    return
  }

  let lines = sanitizeLines(frameStackData)

  let stack = null
  for (const l of lines) {
    if (!stack) {
      // first time through the loop
      const baseLevelId = int(l)
      stack = new FrameBase(baseLevelId)
    } else {
      const a = taggedActors[l]
      assert(a, `tag "@${l}" not found while importing frameStackData`)
      const mini = getActorId(a)
      assert(mini)
      stack = new Frame(mini.id, stack)
    }
  }
  player = allActors(Player)[0] // hacky; dup
  assert(player)
  player.frameStack = stack
}

function sanitizeLines(lineChunk) {
  return lineChunk.split('\n').map(l=>l.split('#')[0].trim()).filter(l=>l.length > 0)
}
RegisterTest("sanitizeLines", () => {
  const actual = sanitizeLines(`
    hello
    comment   # not included

    a
    # line skipped entirely
    b
    # foo
  `)
  const expected = ["hello", "comment", "a", "b"]
  assertEqual(actual.length, expected.length)
  for (let i = 0; i < expected.length; i += 1) {
    assertEqual(actual[i], expected[i])
  }
})

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
