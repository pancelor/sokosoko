//
// globals
//

let tiles
let levels

function DoImports() {
  importTiles()
  FitCanvasToTiles()
  const tags = importActors()
  player = allActors(Player)[0]
  importFrameStack(tags)
}

function importTiles() {
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

  const levelHeader = (line) => line.match(/^level\s+@(?<tag>[\w\d_]+)$/)

  nextLine()
  while (!eof) {
    const match = levelHeader(line)
    assert(match, "bad level header")
    const level = {}
    level.id = levels.length
    level.tag = match.groups.tag
    level.begin = tiles.length

    nextLine()
    while (!eof && !levelHeader(line)) {
      assertEqual(line.length, 8)
      const row = []
      for (let code of line) {
        const name = deserTile(code, level.tag)
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

function exportLevelString(level) {
  const lines = []
  lines.push(`  level ${level.id}`)
  for (let rr = level.begin; rr < level.end; rr += 1) {
    const chars = ["  "]
    for (let imgName of tiles[rr]) {
      chars.push(serTile(imgName))
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

function buildDeserActorClass() {
  // e.g. buildDeserActorClass()["Player"] -> Player (constructor)
  //   (to go the other way, use constructorVar.name)

  const res = {}
  for (let cst of allActorTypes) {
    res[cst.name] = cst
  }
  return res
}

function importActors() {
  const deserActorClass = buildDeserActorClass()

  // imports `actorData` from level.dat into the global var `actors`
  if (!globalExists(() => actorData)) {
    console.warn("could not find any saved actorData")
    actors = []
    return
  }

  let lines = sanitizeLines(actorData)
  let tags = {}
  actors = [];
  for (let l of lines) {
    const match = l.match(/^(?<data>[^@]+)\s*(@(?<tag>[\w\d+]+))?$/)
    assert(match)
    const { data, tag } = match.groups
    const type = data.split(' ')[0]
    const klass = deserActorClass[type]
    assert(klass !== undefined, `could not find actor type "${type}" for deserialization`)
    const a = klass.deserialize(data)
    if (!a) continue
    actors.push(a);
    if (tag) {
      tags[tag] = a.id
    }
  }
  return tags
}

function importFrameStack(tags={}) {
  // imports `frameStackData` from level.dat into the var `player.frameStack`
  // tags is a string-to-actor-id map
  if (!globalExists(() => frameStackData)) {
    console.warn("could not find any saved frameStackData")
    return
  }

  let lines = sanitizeLines(frameStackData)

  let stack = null
  for (const l of lines) {
    if (!stack) {
      // first time through the loop
      const level = levelFromTag(l)
      assert(level)
      stack = new FrameBase(level.id)
    } else {
      const match = l.match(/^(?<tag>[\w\d_]+)$/)
      assert(match, `bad tag syntax: ${l}`)
      const tag = match.groups.tag
      const a = tags[tag]
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
  lines.push(exportTilesString())
  lines.push(exportActorsString())
  return lines.join("\n")
}
