class BasePos {
  constructor(x, y) {
    this.x = x
    this.y = y
  }

  addDir(dir, len=1) {
    const x = [1,0,-1,0][dir]
    const y = [0,-1,0,1][dir]
    return this.add(x, y)
  }
}

class MapPos extends BasePos {
  serialize() {
    return `${this.x} ${this.y}`
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
    const { w, h } = tilesDim()
    return inbounds_(this.x, this.y, w, h)
  }

  roomPos() {
    const room = this.room()
    if (!room) return RoomPos.OOB(this.x, this.y)
    return new RoomPos(room, this.x, this.y - room.begin)
  }

  mapPos() {
    return this
  }

  room() {
    return rooms.find(r=>r.begin <= this.y && this.y < r.end)
  }
}

class RoomPos extends BasePos {
  static OOB(x, y) {
    // a hack to keep tracer from getting mad mid-teleport
    return {
      oob: true,
      inbounds: () => false,
      serialize: ()=>`OOB@(${x}, ${y})`,
    }
  }

  constructor(room_, x, y) {
    super(x, y)
    assertEqual(room_.constructor.name, "Room")
    this.room_ = room_
  }
  serialize() {
    return `${this.room_.name} ${this.x} ${this.y}`
  }
  str() {
    return `RoomPos(${this.room_.name}, ${this.x}, ${this.y})`
  }
  static deserialize(name, x, y) {
    assertEqual(name.constructor.name, "String")
    assertEqual(x.constructor.name, "String")
    assertEqual(y.constructor.name, "String")
    const room = Room.findName(name)
    assert(room)
    return new RoomPos(room, int(x), int(y))
  }

  equals(other) {
    return this.room_ === other.room_ && this.x === other.x && this.y === other.y
  }

  add(x, y) {
    if (y === undefined && (x.constructor === RoomPos || x.constructor === MapPos)) {
      ;({x, y} = x.roomPos())
    }
    return new RoomPos(
      this.room_,
      this.x + x,
      this.y + y,
    )
  }
  scale(m) {
    return new (this.constructor)(
      this.room_,
      this.x*m,
      this.y*m,
    )
  }

  inbounds() {
    const { begin, end } = this.room()
    return inbounds_(this.x, this.y, tiles[0].length, end - begin)
  }

  roomPos() {
    return this
  }

  mapPos() {
    return new MapPos(this.x, this.y + this.room_.begin)
  }

  room() {
    return this.room_
  }
}

class Room {
  constructor(name, begin, end) {
    this.name = name
    this.begin = begin
    this.end = end
  }

  relPos(x, y) {
    assert(y !== undefined) // dunno if i should support this or not
    return new RoomPos(this, x, y).mapPos()
  }

  mapCorner() {
    // returns the top left corner of this room, as a MapPos
    return this.relPos(0, 0)
  }

  tileColors() {
    return {
      Wall: document.getElementById(`img${this.name}Wall`).dataset.color,
      Floor: document.getElementById(`img${this.name}Floor`).dataset.color,
    }
  }

  static findName(name) {
    return rooms.find(b=>b.name===name)
  }

  openings(room) {
    // room.openings()[dir] -> pos of an entrance to room on the `dir` side
    // room.openings()[dir] -> null if no entrances on that side

    const openings = [null, null, null, null] // a dir-indexed dictionary
    const lastColumn = tiles[this.begin].length - 1
    for (let rr = this.begin; rr < this.end; rr += 1) {
      const y = rr - this.begin
      if (rr === this.begin) {
        const ix = tiles[rr].findIndex(solid=>!solid)
        if (ix !== -1) {
          // assertEqual(openings[1], null) // doesn't really work...
          openings[1] = new RoomPos(this, ix, y).mapPos()
        }
      }
      if (rr + 1 === this.end) {
        const ix = tiles[rr].findIndex(solid=>!solid)
        if (ix !== -1) {
          // assertEqual(openings[3], null) // doesn't really work...
          openings[3] = new RoomPos(this, ix, y).mapPos()
        }
      }
      if (!tiles[rr][0]) {
        // assertEqual(openings[2], null) // doesn't really work...
        openings[2] = new RoomPos(this, 0, y).mapPos()
      }
      if (!tiles[rr][lastColumn]) {
        // assertEqual(openings[0], null) // doesn't really work...
        openings[0] = new RoomPos(this, lastColumn, y).mapPos()
      }
    }
    return openings
  }
}



let player
function InitLevel() {
  // note: tiles/actors have already been loaded
  ResetTileCache()
  viewFrameStack = player.frameStack
  InitHistory()
  actors.forEach(a=>a.onLevelInit())
}

function Update(dir) {
  if (player.won || player.dead) return false

  StartEpoch()
  const res = player.update(dir)
  viewFrameStack = player.frameStack
  events = EndEpoch()
  // tempLogEvents(events)
  Raf()
  return res
}

// function tempLogEvents(events) {
//   for (const {id, before, after} of events.half1) {
//     const allKeys = [...Object.keys(before), ...Object.keys(before)]
//     if (allKeys.includes("frameStack")) {
//       console.log(epochToString(events))
//     }
//   }
// }

function maybeFakeWin() {
  const a = findActor(FakeFlag, player.pos)
  if (!a) { return false }
  a.die()
  return true
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
    const src = m.innerRoom.mapCorner().scale(miniTileSize)
    const dest = m.pos.scale(tileSize)
    ctxMap.drawImage(screenshotMini,
      src.x, src.y, pixSize, pixSize,
      dest.x, dest.y, pixSize, pixSize,
    )
    if (debugIds) {
      // print mini id above the mini
      ctxWith(ctxMap, {
        font: `10px Consolas`,
        fillStyle: "black",
        textAlign: "center",
      }, () => {
        ctxMap.fillText(m.id, m.pos.x*tileSize, m.pos.y*tileSize)
      })
    }
  }
  // draw highlight if we're zoomed out
  let pfs = player.frameStack
  if (length(viewFrameStack) < length(pfs)) {
    while (length(viewFrameStack) + 1 < length(pfs)) {
      assert(pfs.data && pfs.parent)
      pfs = pfs.parent
    }
    assert(length(viewFrameStack) + 1  === length(pfs))
    const m = pfs.data
    const dest = m.pos.scale(tileSize)
    ctxWith(ctxMap, {strokeStyle: 'white', globalAlpha: '0.85', lineWidth: 4}, () => {
      ctxMap.strokeRect(dest.x, dest.y, tileSize, tileSize)
    })
  }
}

let viewFrameStack
async function DrawView(ctx) {
  const screenshotMap = await createImageBitmap(canvasMap)

  ctxWith(ctx, {fillStyle: 'black'}, cls)

  // draw outer border
  if (viewFrameStack.parent) {
    const mini = viewFrameStack.data
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
    const dposList = [ // note: the dimensionality of this list is formatted weird
      [-1, -1], [0, -1], [1, -1],
      [-1,  0],          [1,  0],
      [-1,  1], [0,  1], [1,  1],
    ]
    const remaining = new Set([1,3,4,6]) // the indicies of the 4 cardinals in dposList; HACK: assumes you're never in the corner of a mini. and that only 1 tile in each direction is visible
    for (let i = 0; i < dposList.length; ++i) {
      const [dx, dy] = dposList[i]
      const p = mini.pos.add(dx, dy)
      if (!p.roomPos().inbounds()) continue

      remaining.delete(i)
      const mini2 = findActor(Mini, p)
      if (!mini2) continue
      const src2 = mini2.innerRoom.mapCorner().scale(tileSize)
      ctx.drawImage(screenshotMap,
        src2.x, src2.y, tileSize*8, tileSize*8,
        (0.5+dx)*tileSize*8, (0.5+dy)*tileSize*8, tileSize*8, tileSize*8
      )
    }
    const parent = viewFrameStack.parent
    if (parent.parent) {
      const mini2 = parent.data
      assert(mini2)
      for (const i of remaining) {
        const dir = i === 1 ? 1 : i === 3 ? 2 : i === 4 ? 0 : i === 6 ? 3 : assert(0, "bad i")
        const src = mini2.pos.addDir(dir).scale(tileSize)

        // console.log("dir", dir)
        let dest = new MapPos(0, 0).addDir(dir)
        // console.log("dest1", dest.str())
        dest = dest.scale(8)
        // console.log("dest2", dest.str())
        const tempp = mini.pos.roomPos().scale(-1) // gotta temp this otherwise adding converts it into a mappos
        dest = dest.add(tempp.x, tempp.y) // yes, mini, not mini2
        // console.log("dest3", dest.str())
        dest = dest.scale(8)
        // console.log("dest4", dest.str())

        const vo = viewOffset()
        ctx.drawImage(screenshotMap,
          src.x, src.y, tileSize, tileSize,
          (vo.x + dest.x)*tileSize, (vo.y + dest.y)*tileSize, tileSize*8*8, tileSize*8*8
        )
      }
    }
  }
  // draw inner room
  const innerW = 8 * tileSize
  const innerH = 8 * tileSize
  const src = innerRoom(viewFrameStack).mapCorner().scale(tileSize)
  const dest = viewOffset().scale(tileSize)
  ctx.drawImage(screenshotMap,
    src.x, src.y, innerW, innerH,
    dest.x, dest.y, innerW, innerH
  )

  // // draw gray if we're zoomed in
  // if (!equals(viewFrameStack, player.frameStack) && !showmode) {
  //   ctxWith(ctx, {fillStyle: 'white', globalAlpha: "0.35"}, cls)
  // }
}

function DrawGameMisc(ctxView) {
  assert(gameState === GS_PLAYING)
  const innerW = 8 * tileSize
  const innerH = 8 * tileSize
  const dest = viewOffset().scale(tileSize)

  // draw solid player if we're zoomed in
  if (equals(viewFrameStack, player.frameStack) && !player.dead) {
    drawImgMap(ctxView, lookupActorImg(player), player.pos.roomPos().add(viewOffset())) // v hacky
  }

  // draw frame border
  ctxWith(ctxView, {strokeStyle: "white", lineWidth: 7, globalAlpha: 0.4}, () => {
    ctxView.strokeRect(dest.x, dest.y, innerW, innerH)
  })

  // draw "you win!"
  if (player.won) {
    const lines = ["You win!"]
    if (player.gotBonus) lines.push("very good")
    lines.push("[space] to continue")
    drawMessage(ctxView, lines)
  }
}

function DrawMisc(ctxView) {
  assert(gameState === GS_PLAYING || gameState === GS_MENU)
  // draw canvas border
  ctxWith(ctxView, {strokeStyle: "black"}, () => {
    ctxView.strokeRect(0, 0, canvasView.width, canvasView.height)
  })

  DrawGUI(ctxView)

  // draw gray if we've lost window focus in
  if (!gameHasWindowFocus && !showmode) {
    ctxWith(ctxView, {fillStyle: 'white', globalAlpha: "0.50"}, cls)
  }
}

let showmode = false
function DrawGUI(ctxView) {
  if (showmode) return

  // draw mute button
  ctxView.drawImage(gameMuted ? imgSoundOff : imgSoundOn, canvasView.width - tileSize, 0)
}

function DrawActors(ctxMap, ctxMini) {
  allActors().forEach((a) => {
    if (a === player) {
      ctxWith(ctxMap, {globalAlpha: 0.25}, () => a.draw(ctxMap, ctxMini))
    } else {
      a.draw(ctxMap, ctxMini)
    }
  })
}

function lookupActorImg(actor) {
  const cst = actor.constructor
  if (cst === Player) {
    return imgPlayer
  } else if (cst === Crate) {
    return actor.special ? imgCrateSpecial : imgCrate
  } else if (cst === Mini) {
    const name = actor.innerRoom.name
    return document.getElementById(`img${name}Floor`)
  } else if (cst === Flag) {
    return imgFlag
  } else if (cst === FakeFlag) {
    return imgFlag
  } else if (cst === Stairs) {
    return document.getElementById(`${actor.name}-preview`) || imgCrate
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
    return imgCrateMini // not legit but who cares
  } else if (cst === Flag) {
    return imgFlagMini
  } else if (cst === FakeFlag) {
    return imgFlagMini
  } else if (cst === Stairs) {
    return imgCrateMini // not legit but who cares
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
    const before = this.pos.mapPos()
    const after = p
    RecordChange({
      id: this.id,
      before: { pos: before },
      after: { pos: after },
    })
    this.pos = after.mapPos()
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

  onLevelInit() {
    // code that runs on game init
  }

  static clone(a) {
    const new_ = a.constructor.deserialize(a.serialize())
    actors.push(new_)
    return new_
  }

  serialize() {
    const tag = this.tag ? ` @${this.tag}` : ""
    return `${this.constructor.name} ${this.pos.roomPos().serialize()}${tag}`
  }

  static deserialize(line) {
    const [type, rName, rx, ry] = line.split(' ')
    assertEqual(type, this.name)
    const p = RoomPos.deserialize(rName, rx, ry)
    return new (this)(p)
  }
}

class Player extends Actor {
  onLevelInit() {
    this.won = false
    this.gotBonus = false
  }

  set(prop, f) {
    const before = this[prop]
    const after = f
    RecordChange({
      id: this.id,
      before: { [prop]: before },
      after: { [prop]: after },
    })
    this[prop] = after
  }

  setFrameStack(f) {
    return this.set("frameStack", f)
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
    resetPushableCache()
    const success = maybePushableUpdate(this, dir)
    maybeFakeWin()
    if (findActor(Flag, player.pos)) {
      this.set("won", true)
      PlayAndRecordSound(sndWin)
    }
    return success
  }
}

class Mini extends Actor {
  constructor(p, innerRoom) {
    super(p)
    assertEqual(innerRoom.constructor.name, "Room")
    this.innerRoom = innerRoom
  }
  str() {
    return `${this.innerRoom.name} ${this.pos.str()}`
  }
  serialize() {
    const tag = this.tag ? ` @${this.tag}` : ""
    return `${this.constructor.name} ${this.pos.roomPos().serialize()} ${this.innerRoom.name}${tag}`
  }
  static deserialize(line) {
    const [type, rName, rx, ry, innerRoomName] = line.split(' ')
    assertEqual(type, this.name)
    const p = RoomPos.deserialize(rName, rx, ry)
    const innerRoom = Room.findName(innerRoomName)
    assert(innerRoom, `room "${innerRoomName}" doesn't exist`)
    return new (this)(p, innerRoom)
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
  serialize() {
    const spStr = this.special ? "1" : "0"
    const tag = this.tag ? ` @${this.tag}` : ""
    return `${this.constructor.name} ${this.pos.roomPos().serialize()} ${spStr}${tag}`
  }
  static deserialize(line) {
    const [type, rName, rx, ry, special] = line.split(' ')
    assertEqual(type, this.name)
    const p = RoomPos.deserialize(rName, rx, ry)
    return new (this)(p, !!int(special))
  }

  setPos(p) {
    Actor.prototype.setPos.call(this, p)
    this.maybeCollect()
  }

  playMoveSound() {
    PlayAndRecordSound(sndShove)
  }

  maybeCollect() {
    if (!this.special) return false
    if (!findActor(Flag, this.pos)) return false

    this.setDead(true)
    PlayAndRecordSound(sndBonus)
    player.set("gotBonus", true)
    return true
  }
}

class Stairs extends Actor {
  constructor(p, name) {
    super(p)
    this.name = name
  }
  serialize() {
    const tag = this.tag ? ` @${this.tag}` : ""
    return `${this.constructor.name} ${this.pos.roomPos().serialize()} ${this.name}${tag}`
  }
  static deserialize(line) {
    const [type, rName, rx, ry, name] = line.split(' ')
    assertEqual(type, this.name)
    const p = RoomPos.deserialize(rName, rx, ry)
    return new (this)(p, name)
  }
}

const allActorTypes = [Player, FakeFlag, Flag, Mini, Crate, Stairs]

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

function deadActors(csts) {
  return allActors(csts).filter(a=>a.dead)
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

function findActorUnderMe(cst, that) {
  // finds an actor with the given constructor(s) at the given actor's location
  const as = allActors(cst)
  const mpos = that.pos.mapPos()
  return as.find(a=>!a.dead && a !== that && mpos.equals(a.pos))
}
