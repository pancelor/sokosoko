//
// globals
//

let rooms
let tiles
let actors

let taggedActors // make this local?

function levelDeclaredCount(name) {
  return sum(levelData.map(ld=>ld.name === name ? 1 : 0))
}

function levelDataFor(name) {
  assertEqual(levelDeclaredCount(name), 1, `Level ${name} was overdeclared`)
  return levelData.find(ld=>ld.name === name)
}

function Import(name) {
  assert(levelData)
  console.log("Loading level", name)
  if (levelDeclaredCount(name) === 0) {
    console.warn("level not found:", name)
    return false
  }
  const { tileData, actorData, frameStackData } = preloadData(name)
  importTiles(tileData)
  FitCanvasesToTiles()
  importActors(actorData)
  player = allActors(Player)[0]
  importFrameStack(frameStackData)
  return true
}

function preloadData(name) {
  const { tileData, actorData, frameStackData } = levelDataFor(name)
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
  rooms = []

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

  const roomHeader = (line) => line.match(/^room\s+@(?<name>[\w\d_]+)$/)

  nextLine()
  while (!eof) {
    const match = roomHeader(line)
    assert(match, "bad room header")
    const room = {}
    room.id = rooms.length
    room.name = match.groups.name
    room.begin = tiles.length

    nextLine()
    while (!eof && !roomHeader(line)) {
      assertEqual(line.length, 8)
      const row = []
      for (let code of line) {
        const name = deserTile(code, room.name)
        assert(name)
        row.push(name)
      }
      tiles.push(row)
      nextLine()
    }
    room.end = tiles.length // room lives in `tiles` from room.begin to room.end (not inclusive on `end`)
    assert(room.begin < room.end)
    rooms.push(room)

    // hack: add a row of solid tiles in between each level
    // to keep the pushableUpdate code simple
    const row = []
    for (let i = 0; i < 8; i += 1) row.push("imgInternalWall")
    tiles.push(row)
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
  // imports `actorData` into the global var `actors`
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
      assert(!taggedActors[tag], `trying to tag multiple actors as @${tag}`)
      taggedActors[tag] = a.id
      a.tag = tag
    }
  }
}

function importFrameStack(frameStackData) {
  // imports `frameStackData` into the var `player.frameStack`
  // also uses taggedActors, a string-to-actor-id map

  let lines = sanitizeLines(frameStackData)

  let stack = null
  for (const l of lines) {
    if (!stack) {
      // first time through the loop
      const room = roomFromName(l)
      assert(room)
      stack = new FrameBase(room.id)
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

function exportRoomString(room) {
  const lines = []
  lines.push(`    room @${room.name}`)
  for (let rr = room.begin; rr < room.end; rr += 1) {
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
  for (let room of rooms) {
    lines.push(exportRoomString(room))
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
    if (a.dead) {
      continue
      // this is hacky; idk if the editor should even
      // mess with killing/reviving actors. but it lets undos work...
      // edit: wait no it doesn't really b/c you can't undo creating an actor (not easily)
    }
    lines.push(`    ${a.serialize()}`)
  }
  lines.push("  `,")
  return lines.join("\n")
}

function exportFrameStackString() {
  const lines = []
  lines.push("  frameStackData: `")
  let frame = player.frameStack
  while (true) {
    if (frame.constructor === FrameBase) {
      lines.splice(1, 0, `    ${frame.room().name}`)
      break
    } else {
      let tag = frame.mini().tag
      if (tag === undefined) {
        tag = frame.mini().serialize()
        console.warn("mini in frameStack doesn't have a tag:", tag)
      }
      lines.splice(1, 0, `    ${tag}`)
      frame = frame.parent
    }
  }
  lines.push("  `,")
  return lines.join("\n")
}

function Export(name) {
  const lines = []
  lines.push("levelData.push({")
  lines.push(`  name: '${name}',`)
  lines.push(exportTilesString())
  lines.push(exportActorsString())
  lines.push(exportFrameStackString())
  lines.push("})")
  lines.push("")
  return lines.join("\n")
}
