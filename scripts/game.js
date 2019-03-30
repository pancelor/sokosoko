class Tracer {
  static indent_str = "  "
  constructor(silent) {
    this.indent = 0
    this.silent = silent
  }

  tracify(fxn) {
    return (...args) => {
      this.enter(fxn.name, args)
      const ret = fxn(...args)
      this.exit(fxn.name, args, ret)
      return ret
    }
  }

  toggle() {
    this.silent = !this.silent
  }

  // main fxnality
  printSignature(name, args) {
    const parts = []
    parts.push(`${name}(`)
    for (const a of args) {
      if (a.str) {
        parts.push(`${a.str()}, `)
      } else {
        parts.push(`${serialize(a)}, `)
      }
    }
    parts.push(")")
    return parts.join('')
  }
  enter(name, args) {
    this.print(`-> ${this.printSignature(name, args)}`)
    this.changeIndent(1)
  }
  exit(name, args, ret) {
    this.changeIndent(-1)
    this.print(`${ret} <- ${this.printSignature(name, args)}`)
  }
  changeIndent(di) {
    this.indent += di
    assert(this.indent >= 0)
  }
  print(msg) {
    if (this.silent) return
    const parts = []
    for (let i = 0; i < this.indent; i++) {
      parts.push(Tracer.indent_str)
    }
    parts.push(msg)
    console.log(parts.join(''))
  }
}
const tracer = new Tracer()
tracer.toggle()

class BasePos {
  constructor(x, y) {
    this.x = x
    this.y = y
  }

  addDir(dir, len=1) {
    const x = [1,0,-1,0][dir]
    const y = [0,-1,0,1][dir]
    return this.add({x, y})
  }
}

class MapPos extends BasePos {
  serialize() {
    return `${this.constructor.name} ${this.x} ${this.y}`
  }
  str() {
    return `MapPos(${this.x}, ${this.y})`
  }

  add(x, y) {
    if (y === undefined && (x.constructor === RoomPos || x.constructor === MapPos)) {
      ;({x, y} = x.mapPos())
    }
    return new (this.constructor)(
      this.x + x,
      this.y + y,
    )
  }

  scale(m) {
    return new (this.constructor)(
      this.x*m,
      this.y*m,
    )
  }

  equals(x, y) {
    if (y === undefined && (x.constructor === RoomPos || x.constructor === MapPos)) {
      ;({x, y} = x.mapPos())
    }

    return this.x === x && this.y === y
  }

  inbounds() {
    const {w, h} = tilesDim()
    return inbounds_(this.x, this.y, w, h)
  }

  roomPos() {
    const room = this.room()
    return new RoomPos(room, this.x, this.y - room.begin)
  }

  mapPos() {
    return this
  }

  room() {
    return rooms.find(l=>l.begin <= pos.y && pos.y < l.end)
  }
}

class RoomPos extends BasePos {
  constructor(room, x, y) {
    super(x, y)
    assertEqual(room.constructor, String)
    this.room = room
  }
  serialize() {
    return `${this.constructor.name} ${this.room.name} ${this.x} ${this.y}`
  }
  str() {
    return `RoomPos(${this.room.name}, ${this.x}, ${this.y})`
  }
  static deserialize(name, x, y) {
    return new RoomPos(name, int(x), int(y))
  }

  equals(other) {
    return this.room === other.room && this.x === other.x && this.y === other.y
  }

  add(x, y) {
    if (y === undefined && (x.constructor === RoomPos || x.constructor === MapPos)) {
      ;({x, y} = x.roomPos())
    }
    return new RoomPos(
      this.room,
      this.x + x,
      this.y + y,
    )
  }
  scale(m) {
    return new (this.constructor)(
      this.room,
      this.x*m,
      this.y*m,
    )
  }


  inbounds() {
    return inbounds_(this.x, this.y, 8, 8)
  }

  roomPos() {
    return this
  }

  mapPos() {
    return new MapPos(this.x, this.y + this.room.begin)
  }

  room() {
    return this.room
  }
}

class FrameBase {
  constructor(room) {
    assert(room)
    this.room = room
    this.parent = null
  }
  serialize() {
    return `${this.constructor.name} ${this.room.name}`
  }
  str() {
    return `<base; ${this.room.name}>`
  }

  mini() {
    assert(0, "FrameBase has no mini")
  }

  mapMini(f) {
    return []
  }

  length() {
    return 1
  }

  equals(other) {
    if (other.constructor !== this.constructor) { return false }
    return (this.room === other.room)
  }
}

class Frame {
  constructor(mini, parent) {
    assert(mini)
    assert(parent)
    this.mini = mini
    this.parent = parent
  }
  serialize() {
    return `${this.constructor.name} ${this.mini.id} ${this.parent.serialize()}`
  }
  str() {
    return `${this.parent.str()} | ${this.room.name}`
  }

  room() { // todo delete?
    return this.mini.room
  }

  mapMini(f) {
    return [f(this.mini), ...this.parent.mapMini(f)]
  }

  length() {
    return 1 + this.parent.length()
  }

  equals(other) {
    if (other.constructor !== Frame) { return false }
    if (this.mini !== other.mini) { return false }

    const p1 = this.parent
    const p2 = other.parent
    if (p1 === null) {
      return (p2 === null)
    } else {
      return p1.equals(p2)
    }
  }
}

class Room {
  constructor(name, begin, end) {
    this.name = name
    this.begin = begin
    this.end = end
  }

  mapCorner() {
    // returns the top left corner of this room, as a MapPos
    return new MapPos(0, this.begin)
  }

  tileColors() {
    return {
      Wall: document.getElementById(`img${this.name}Wall`).dataset.color,
      Floor: document.getElementById(`img${this.name}Floor`).dataset.color,
    }
  }

  static findName(name) {
    return rooms.find(l=>l.name===name)
  }

  static findId(id) {
    return rooms.find(l=>l.id===id)
  }

  openings(room) {
    // room.openings()[dir] -> pos of an entrance to room on the `dir` side
    // room.openings()[dir] -> null if no entrances on that side

    const openings = [null, null, null, null] // a dir-indexed dictionary
    const lastColumn = tiles[this.begin].length - 1
    for (let rr = this.begin; rr < this.end; rr += 1) {
      const y = rr - this.begin
      if (rr === this.begin) {
        const ix = tiles[rr].findIndex(name=>!solid(name))
        if (ix !== -1) {
          // assertEqual(openings[1], null) // doesn't really work...
          openings[1] = new RoomPos(this, ix, y)
        }
      }
      if (rr + 1 === this.end) {
        const ix = tiles[rr].findIndex(name=>!solid(name))
        if (ix !== -1) {
          // assertEqual(openings[3], null) // doesn't really work...
          openings[3] = new RoomPos(this, ix, y)
        }
      }
      if (!solid(tiles[rr][0])) {
        // assertEqual(openings[2], null) // doesn't really work...
        openings[2] = new RoomPos(this, 0, y)
      }
      if (!solid(tiles[rr][lastColumn])) {
        // assertEqual(openings[0], null) // doesn't really work...
        openings[0] = new RoomPos(this, lastColumn, y)
      }
    }
    return openings
  }
}



let player
let gotBonus
function InitGame() {
  // note: tiles/actors have already been loaded
  gotBonus = false
  InitHistory()
  actors.forEach(a=>a.onGameInit())
}

function Update(dir) {
  if (checkWin()) { return }

  StartEpoch()
  player.update(dir)
  events = EndEpoch()
  Raf()
}

function checkWin() {
  return findActor(Flag, player.pos)
}

function maybeFakeWin() {
  const a = findActor(FakeFlag, player.pos)
  if (!a) { return false }
  a.die()
}

function destroyActor(a) { // hacky; don't use me
  const ix = actors.indexOf(a)
  actors.splice(ix, 1)
}

async function DrawMinis(ctxMap) {
  const roomSize = 8
  const screenshotMini = await createImageBitmap(canvasMini)
  for (const m of allActors(Mini)) {
    if (m.dead) continue
    const pixSize = roomSize*miniTileSize
    const src = m.room().mapCorner().scale(miniTileSize)
    const dest = m.pos.scale(tileSize)
    ctxMap.drawImage(screenshotMini,
      src.x, src.y, pixSize, pixSize,
      dest.x, dest.y, pixSize, pixSize,
    )
  }
}

async function DrawView(ctx) {
  const screenshotMap = await createImageBitmap(canvasMap)
  const innerFrame = player.frameStack
  const outerFrame = player.frameStack.parent

  ctxWith(ctx, {fillStyle: 'white'}, cls)

  // draw outer border
  if (outerFrame) {
    const mini = innerFrame.mini()
    assert(mini)
    assert(viewOffset().equals(4, 4)) // for (8,8): 2->3, 0.5->1
    const outerW = 2*tileSize
    const outerH = 2*tileSize
    const src = mini.pos.add(-0.5, -0.5).scale(tileSize)
    const dest = viewOffset().scale(tileSize)
    ctx.drawImage(screenshotMap,
      src.x, src.y, outerW, outerH,
      0, 0, canvasView.width, canvasView.height
    )
    for (const dy of [-1, 0, 1]) {
      for (const dx of [-1, 0, 1]) {
        if (dx === 0 && dy === 0) continue
        const mini2 = findActor(Mini, mini.pos.add(dx, dy))
        if (!mini2) continue
        const src2 = mini2.room().mapCorner().scale(tileSize)
        ctx.drawImage(screenshotMap,
          src2.x, src2.y, tileSize*8, tileSize*8,
          (0.5+dx)*tileSize*8, (0.5+dy)*tileSize*8, tileSize*8, tileSize*8
        )
      }
    }
  }
  // draw inner room
  const innerW = 8 * tileSize
  const innerH = 8 * tileSize
  const src = innerFrame.room().mapCorner().scale(tileSize)
  const dest = viewOffset().scale(tileSize)
  ctx.drawImage(screenshotMap,
    src.x, src.y, innerW, innerH,
    dest.x, dest.y, innerW, innerH
  )
}

function DrawMisc(ctxView) {
  const innerW = 8 * tileSize
  const innerH = 8 * tileSize
  const dest = viewOffset().scale(tileSize)

  // draw frame border
  ctxWith(ctxView, {strokeStyle: "white", lineWidth: 7, globalAlpha: 0.4}, () => {
    ctxView.strokeRect(dest.x, dest.y, innerW, innerH)
  })

  // draw canvas border
  ctxWith(ctxView, {strokeStyle: "black"}, () => {
    ctxView.strokeRect(0, 0, canvasView.width, canvasView.height)
  })

  if (checkWin()) {
    const lines = ["You win!"]
    if (gotBonus) lines.push("very good")
    drawMessage(ctxView, lines)
  }
}

function DrawActors(ctxMap, ctxMini) {
  allActors().forEach(e=>e.draw(ctxMap, ctxMini))
}

function lookupActorImg(actor) {
  const cst = actor.constructor
  if (cst === Player) {
    return imgPlayer
  } else if (cst === Crate) {
    return actor.special ? imgCrateSpecial : imgCrate
  } else if (cst === Mini) {
    return imgMiniPlaceholder
  } else if (cst === Flag) {
    return imgFlag
  } else if (cst === FakeFlag) {
    return imgFlag
  } else {
    assert(0, `Don't know img for ${cst.name}`)
  }
}
function lookupActorImgMini(actor) {
  const cst = actor.constructor
  if (cst === Player) {
    return imgPlayerMini
  } else if (cst === Crate) {
    return actor.special ? imgCrateSpecialMini : imgCrateMini
  } else if (cst === Mini) {
    return imgMiniPlaceholder
  } else if (cst === Flag) {
    return imgFlagMini
  } else if (cst === FakeFlag) {
    return imgFlagMini
  } else {
    assert(0, `Don't know img for ${cst.name}`)
  }
}

class Actor {
  static id = 1 // a counter of ids to assign to actors as they're created

  constructor(pos) {
    this.pos = pos.mapPos()

    // get id
    this.id = Actor.id
    Actor.id += 1
    this.dead = false
    // note that actors might have a `tag` attribute, set by the level loader
  }

  draw(ctxMap, ctxMini){
    if (this.dead) return
    drawImgMap(ctxMap, lookupActorImg(this), this.pos)
    drawImgMini(ctxMini, lookupActorImgMini(this), this.pos)
  }

  update(dir) {
    // returns whether it moved in the given dir
    return false
  }

  playTeleInSound() {}
  playTeleOutSound() {}
  playMoveSound() {}

  setPos(p) {
    const before = this.pos
    const after = p
    RecordChange({
      id: this.id,
      before: { pos: before },
      after: { pos: after },
    })
    this.pos = after
  }

  die() {
    this.setDead(true)
  }

  setFrameStack(f) {
    // by default, don't record
    this.frameStack = f
  }

  setDead(b) {
    const before = this.dead
    const after = b
    RecordChange({
      id: this.id,
      before: { dead: before },
      after: { dead: after },
    })
    this.dead = after
  }

  onGameInit() {
    // code that runs on game init
  }

  static clone(a) {
    const new_ = a.constructor.deserialize(a.serialize())
    actors.push(new_)
    return new_
  }

  serialize() {
    const tag = this.tag ? ` @${this.tag}` : ""
    return `${this.constructor.name} ${this.pos.roomSerialize()}${tag}`
  }

  static deserialize(line) {
    const [type, rName, rx, ry] = line.split(' ')
    assertEqual(type, this.name)
    const p = new RoomPos(rName, int(rx), int(ry))
    return new (this)(p)
  }
}

class Player extends Actor {
  setFrameStack(f) {
    const before = this.frameStack
    const after = f
    RecordChange({
      id: this.id,
      before: { frameStack: before },
      after: { frameStack: after },
    })
    this.frameStack = after
  }

  playMoveSound() {
    PlayAndRecordSound(sndWalk)
  }

  playTeleInSound() {
    PlayAndRecordSound(sndEnter)
  }

  playTeleOutSound() {
    PlayAndRecordSound(sndExit)
  }

  update(dir) {
    // hack_seen_teles = new Set()
    const success = pushableUpdate(this, dir)
    maybeFakeWin()
    if (checkWin()) {
      PlayAndRecordSound(sndWin)
    }
    return success
  }
}

class Mini extends Actor {
  constructor(p, innerRoom) {
    super(p)
    assertEqual(innerRoom.constructor, Room)
    this.innerRoom = innerRoom
  }
  str() {
    return `${this.innerRoom.name}${this.pos.str()}`
  }
  serialize() {
    const tag = this.tag ? ` @${this.tag}` : ""
    return `${this.constructor.name} ${this.pos.roomPos().serialize()} ${this.innerRoom.name}${tag}`
  }
  static deserialize(line) {
    const [type, rName, rx, ry, innerRoomName] = line.split(' ')
    assertEqual(type, this.name)
    const p = RoomPos.deserialize(rName, rx, ry)
    const innerRoom = roomFromName(innerRoomName)
    assert(innerRoom, `room "${innerRoomName}" doesn't exist`)
    return new (this)(p, innerRoom, innerRoom.name)
  }

  draw(ctxMap, ctxMini) {
    if (this.dead) return
    drawImgMap(ctxMap, lookupActorImg(this), this.pos) // comment me out

    assert(miniTileSize === 4)
    const { Wall, Floor } = this.innerRoom.tileColors()
    ctxWith(ctxMini, {fillStyle: Wall}, () => {
      ctxMini.fillRect(this.pos.x*4, this.pos.y*4, 4, 4);
    })
    ctxWith(ctxMini, {fillStyle: Floor}, () => {
      ctxMini.fillRect(this.pos.x*4+1, this.pos.y*4+1, 2, 2);
    })
  }

  playMoveSound() {
    PlayAndRecordSound(sndShove)
  }
}

class FakeFlag extends Actor {}

class Flag extends Actor {}

class Crate extends Actor {
  constructor(p, special) {
    super(p)
    this.special = special
  }

  setPos(p) {
    Actor.prototype.setPos.call(this, p)
    this.maybeCollect()
  }

  playMoveSound() {
    PlayAndRecordSound(sndShove)
  }

  maybeCollect() {
    if (!this.special) return
    if (!findActor(Flag, this.pos)) return

    this.setDead(true)
    PlayAndRecordSound(sndBonus)
    gotBonus = true
  }

  serialize() {
    const spStr = this.special ? "1" : "0"
    const tag = this.tag ? ` @${this.tag}` : ""
    return `${this.constructor.name} ${this.pos.roomPos().serialize()} ${spStr}${tag}`
  }

  static deserialize(line) {
    const [type, rName, rx, ry, special] = line.split(' ')
    assertEqual(type, this.name)
    const p = new RoomPos(rName, int(rx), int(ry))
    return new (this)(p, !!int(special))
  }
}

const allActorTypes = [Player, FakeFlag, Flag, Mini, Crate]

function allActors(csts) {
  // allActors() -> all actors
  // allActors(Foo) -> all actors with constructor Foo
  // allActors([Foo, Bar]) -> all actors with constructor Foo or constructor Bar
  if (!csts) { return actors }
  if (!Array.isArray(csts)) { csts = [csts] }
  return actors.filter(a=>csts.includes(a.constructor))
}

function getActorId(id) {
  return actors.find(a=>a.id===id)
}

function findActor(cst, p) {
  // finds an actor with the given constructor(s) at the given location
  // (or anywhere, if no pos is given)
  const as = allActors(cst)
  if (p) {
    const mpos = p.mapPos()
    return as.find(a=>!a.dead && mpos.equals(a.pos))
  } else {
    return as[0]
  }
}
