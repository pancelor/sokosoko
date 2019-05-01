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

function checkActorsInWalls() {
  for (const a of actors) {
    if (!CanMoveToTile(a.pos)) {
      console.warn(`An actor is in a wall: ${a.serialize()}`)
    }
  }
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
  checkActorsInWalls()
  return true
}

function preloadData(name) {
  const { tileData, actorData, frameStackData } = levelDataFor(name)
  assert(tileData)
  assert(actorData)
  assert(frameStackData)
  return { tileData, actorData, frameStackData }
}

function serTile(solid) {
  assert(solid === true || solid === false) // TODO rm
  return solid ? 'x' : '.'
}

function deserTile(code) {
  assert(code === 'x' || code === '.')
  const solid = (code === 'x')
  return solid
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
    const name = match.groups.name
    const begin = tiles.length
    const end = 0 // will be overwritten once the parse is done
    const room = new Room(name, begin, 0)

    nextLine()
    while (!eof && !roomHeader(line)) {
      // if (line.length !== 8) console.warn("line wrong length?")
      const row = []
      for (let code of line) {
        const solid = deserTile(code)
        assert(solid === true || solid === false) // TODO rm
        row.push(solid)
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
    for (let i = 0; i < tiles[0].length; i += 1) row.push(true)
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

function deserSingleActor(line, deserActorClass=null) {
  if (!deserActorClass) deserActorClass = buildDeserActorClass()
  const match = line.match(/^(?<data>[^@]+)\s*(@(?<tag>[\w\d+]+))?$/)
  if (!match) return null
  const { data, tag } = match.groups
  const type = data.split(' ')[0]
  const klass = deserActorClass[type]
  assert(klass !== undefined, `could not find actor type "${type}" for deserialization`)
  const a = klass.deserialize(data)
  if (!a) return null
  if (tag) {
    assert(!taggedActors[tag], `trying to tag multiple actors as @${tag}`)
    taggedActors[tag] = a.id
    a.tag = tag
  }
  return a
}

function importActors(actorData) {
  // imports `actorData` into the global var `actors`
  const deserActorClass = buildDeserActorClass()

  let lines = sanitizeLines(actorData)
  taggedActors = {}
  actors = [];
  for (let l of lines) {
    const a = deserSingleActor(l, deserActorClass)
    assert(a)
    actors.push(a)
  }
}

function importFrameStack(frameStackData) {
  // imports `frameStackData` into the var `player.frameStack`
  // also uses taggedActors, a string-to-actor-id map

  let lines = sanitizeLines(frameStackData)

  let stack = null
  for (const l of lines) {
    const match = l.match(/^(?<tag>[\w\d_]+)$/)
    assert(match, `bad tag syntax: ${l}`)
    const tag = match.groups.tag
    const a = taggedActors[tag]
    assert(a, `tag "${tag}" not found while importing frameStackData`)
    const mini = getActorId(a)
    assert(mini)
    if (!stack) {
      // first time through the loop
      const room = mini.pos.room()
      assert(room)
      stack = cons(room, stack)
    }
    stack = cons(mini, stack)
  }
  if (!stack) {
    // frameStackData was empty; default to a white room
    room = Room.findName("White")
    assert(room)
    stack = cons(room, stack)
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
    for (let solid of tiles[rr]) {
      assert(solid === true || solid === false) // TODO rm
      chars.push(serTile(solid))
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
  while (frame.parent) {
    let tag = frame.data.tag
    if (tag === undefined) {
      tag = randInt(0, 100000)
      frame.data.tag = tag
    }
    lines.splice(1, 0, `    ${tag}`)
    frame = frame.parent
  }
  lines.push("  `,")
  return lines.join("\n")
}

function Export(name) {
  assert(name.length > 0)
  const lines = []
  lines.push("levelData.push({")
  lines.push(`  name: '${name}',`)
  lines.push(exportTilesString())
  const fs = exportFrameStackString() // hack: do this first so the actors get auto-tagged if needed
  lines.push(exportActorsString())
  lines.push(fs)
  lines.push("})")
  lines.push("")
  return lines.join("\n")
}
