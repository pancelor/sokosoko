//
// globals
//

let levels
let tiles
let actors

let taggedActors // make this local?

// keep these around so we can reserialize them later:
let savedFrameStack

function ImportLevel(name) {
  console.log("Loading level", name)
  if (!levelData[name]) {
    console.warn("level not found:", name)
    return false
  }
  const { tileData, actorData, frameStackData } = preloadData(name)
  importTiles(tileData)
  FitCanvasToTiles()
  importActors(actorData)
  player = allActors(Player)[0]
  importFrameStack(frameStackData)
  return true
}

function preloadData(name) {
  const { tileData, actorData, frameStackData } = levelData[name]
  assert(tileData)
  assert(actorData)
  assert(frameStackData)
  return { tileData, actorData, frameStackData }
}

function serTile(name) {
  const match = name.match(/^img\w+((?<floor>Floor)|(?<wall>Wall))$/)
  assert(match)
  assert(xor(match.groups.floor, match.groups.wall)) // exactly one is true
  return match.groups.wall ? 'x' : '.'
}

function deserTile(code, tag) { // todo: make this type: isWall(code)->bool
  assert(code === 'x' || code === '.')
  const isWall = code === 'x'
  return `img${tag}${isWall ? "Wall" : "Floor"}`
}

function importTiles(tileData) {
  // imports `tileData` into the global var `tiles`

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

  const levelHeader = (line) => line.match(/^level\s+@(?<name>[\w\d_]+)$/)

  nextLine()
  while (!eof) {
    const match = levelHeader(line)
    assert(match, "bad level header")
    const level = {}
    level.id = levels.length
    level.name = match.groups.name
    level.begin = tiles.length

    nextLine()
    while (!eof && !levelHeader(line)) {
      assertEqual(line.length, 8)
      const row = []
      for (let code of line) {
        const name = deserTile(code, level.name)
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
}

function buildDeserActorClass() {
  // e.g. buildDeserActorClass()["Player"] -> Player (constructor)
  //   (to go the other way, use constructorVar.name)

  const res = {}
  for (let cst of allActorTypes) {
    res[cst.name] = cst
  }
  return res
}

function importActors(actorData) {
  // imports `actorData` from level.dat into the global var `actors`
  const deserActorClass = buildDeserActorClass()

  let lines = sanitizeLines(actorData)
  taggedActors = {}
  actors = [];
  for (let l of lines) {
    const match = l.match(/^(?<data>[^@]+)\s*(@(?<tag>[\w\d+]+))?$/)
    assert(match)
    const { data, tag } = match.groups
    const type = data.split(' ')[0]
    const klass = deserActorClass[type]
    assert(klass !== undefined, `could not find actor type "${type}" for deserialization`)
    const a = klass.deserialize(data)
    actors.push(a);
    if (tag) {
      a.tag = tag
      taggedActors[tag] = a.id
    }
  }
}

function importFrameStack(frameStackData) {
  // imports `frameStackData` into the var `player.frameStack`
  // also uses taggedActors, a string-to-actor-id map

  let lines = sanitizeLines(frameStackData)

  let stack = null
  savedFrameStack = []
  for (const l of lines) {
    savedFrameStack.push(l)
    if (!stack) {
      // first time through the loop
      const level = levelFromName(l)
      assert(level)
      stack = new FrameBase(level.id)
    } else {
      const match = l.match(/^(?<tag>[\w\d_]+)$/)
      assert(match, `bad tag syntax: ${l}`)
      const tag = match.groups.tag
      const a = taggedActors[tag]
      assert(a, `tag "${tag}" not found while importing frameStackData`)
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
    b @ no tag parsing
    # foo
  `)
  const expected = ["hello", "comment", "a", "b @ no tag parsing"]
  assertEqual(actual.length, expected.length)
  for (let i = 0; i < expected.length; i += 1) {
    assertEqual(actual[i], expected[i])
  }
})

function exportLevelString(level) {
  const lines = []
  lines.push(`    level @${level.name}`)
  for (let rr = level.begin; rr < level.end; rr += 1) {
    const chars = ["    "]
    for (let imgName of tiles[rr]) {
      chars.push(serTile(imgName))
    }
    lines.push(chars.join(''))
  }
  return lines.join("\n")
}

function exportTilesString() {
  const lines = []
  lines.push("  tileData: `")
  for (let level of levels) {
    lines.push(exportLevelString(level))
    lines.push("")
  }
  lines.length -= 1 // drop the last newline
  lines.push("  `,")
  return lines.join("\n")
}

function exportActorsString() {
  const lines = []
  lines.push("  actorData: `")
  for (let a of actors) {
    const tag = a.tag ? ` @${a.tag}` : ""
    lines.push(`    ${a.serialize()}${tag}`)
  }
  lines.push("  `,")
  return lines.join("\n")
}

function exportFrameStackString() {
  assert(savedFrameStack)
  const lines = []
  lines.push("  frameStackData: `")
  for (let tag of savedFrameStack) {
    lines.push(`    ${tag}`)
  }
  lines.push("  `,")
  return lines.join("\n")
}

function ExportLevelString(name) {
  const lines = []
  lines.push(`levelData['${name}'] = {`)
  lines.push(exportTilesString())
  lines.push(exportActorsString())
  lines.push(exportFrameStackString())
  lines.push("}")
  lines.push("")
  return lines.join("\n")
}
