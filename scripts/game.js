class Pos {
  constructor({x, y}) {
    this.x = x
    this.y = y
  }

  equals(other) {
    // _only_ checks x,y coords; no frame checking
    return this.x === other.x && this.y === other.y
  }

  clone() {
    return new Pos({x: this.x, y: this.y})
  }

  add({x, y}) {
    return new Pos({
      x: this.x + x,
      y: this.y + y,
    })
  }

  scale(m) {
    return new Pos({
      x: this.x*m,
      y: this.y*m,
    })
  }

  static fromLevel(level, localPos) {
    // takes a level pos and returns a world pos
    return new Pos({x: localPos.x, y: localPos.y + level.begin})
  }

  toLevelPos(level) {
    // takes a world pos and returns a level pos
    return new Pos({x: this.x, y: this.y - level.begin})
  }

  str() {
    return `(${this.x}, ${this.y})`
  }

  serialize() {
    return `${this.constructor.name} ${this.x} ${this.y}`
  }
}

class FramePos extends Pos {
  constructor(pos, frameStack) {
    super(pos)
    this.frameStack = [...frameStack]
  }

  clone() {
    const sup = Pos.prototype.clone.call(this)
    return new FramePos(sup, [...this.frameStack])
  }

  add(delta) {
    const sup = Pos.prototype.add.call(this, delta)
    return new FramePos(sup, [...this.frameStack])
  }

  scale(delta) {
    const sup = Pos.prototype.scale.call(this, delta)
    return new FramePos(sup, [...this.frameStack])
  }

  frame() {
    return back(this.frameStack)
  }

  mini() {
    const frame = this.frame()
    assert(frame)
    return frame.mini()
  }

  level() {
    const frame = this.frame()
    assert(frame)
    return frame.level()
  }

  parent() {
    const mini = this.mini()
    if (!mini) { return null }
    const newStack = this.frameStack.slice(0, this.frameStack.length-1)
    return new FramePos(mini.pos, newStack)
  }

  child(pos, frame) {
    return new FramePos(pos, [...this.frameStack, frame])
  }

  str() {
    const sup = Pos.prototype.str.call(this)
    return `${frameStackToString(this.frameStack)} ${sup}`
  }

  lift(pos) {
    // takes a pos and lifts it to be a FramePos with the same frame stack as this
    return new FramePos(pos, [...this.frameStack])
  }

  unlift(pos) {
    // converts to a normal pos
    return new Pos(this)
  }
}



let player

function InitGame() {
  // note: tiles/actors have already been loaded
  console.log("InitGame()")
  InitHistory()
  player = allActors(Player)[0]
  assert(player)
  actors.forEach(a=>a.onGameInit())
}

function frameStackToString(stack) {
  const frameStrs = ['[']
  for (const frame of stack) {
    // const mini = frame.mini()
    // if (mini) {
    //   frameStrs.push(`Mini#${mini.id}@${mini.pos.str()}`)
    // } else {
    //   frameStrs.push(`<null Mini>`)
    // }
    const color = GetLevelColor(frame.levelId)
    frameStrs.push(` ${color} |`)
  }
  return frameStrs.join(' ')
}

class Frame {
  // a frame is an entry location (from the next level up) and a level id
  constructor({miniId, levelId}) {
    this.miniId = miniId
    this.levelId = levelId
  }

  mini() {
    if (this.miniId === null) { return null }
    const a = getActorId(this.miniId)
    assert(a.constructor === Mini)
    return a
  }

  level() {
    return getLevel(this.levelId)
  }
}

let keyHist = []
let keyHistInterval
function getKeyHist() {
  console.log(`play("${keyHist.join('')}")`)
}
function play(moves, dt=50) {
  assert(keyHist.length === 0)
  console.log("about to play keyHistory; don't move please")
  clearInterval(keyHistInterval)
  let ix = 0
  keyHistInterval = setInterval(() => {
    if (ix >= moves.length) {
      clearInterval(keyHistInterval)
      console.log("done playing keyHistory; you can move again")
      return
    }
    const dir = int(moves[ix])
    Update(dir)
    ix += 1
  }, dt)
}
function RecordKeyHist(dir) {
  keyHist.push(dir)
}
function Update(dir) {
  if (checkWin()) { return }

  StartEpoch()
  player.update(dir)
  EndEpoch()
  Raf()
}

function checkWin() {
  return !!findActor(Flag, player.pos)
}

async function DrawGame(ctx) {
  DrawTiles(ctx)
  drawActors(ctx)

  await drawFancy()
}

async function drawFancy() {
  const worldImg = await createImageBitmap(canvas)
  const ctx = canvas2.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const innerFrame = player.pos.frame()
  const outerFrame = player.pos.parent() ? player.pos.parent().frame() : null

  // draw outer level
  if (outerFrame) {
    const mini = innerFrame.mini()
    assert(mini)
    const outerW = 2*tileSize
    const outerH = 2*tileSize
    const src = mini.pos.add(pcoord(-0.5, -0.5)).scale(tileSize)
    const dest = pcoord(4, 4).scale(tileSize)
    ctx.drawImage(worldImg,
      src.x, src.y, outerW, outerH,
      0, 0, canvas2.width, canvas2.height
    )
  } else {
    ctxWith(ctx, {fillStyle: "white"}, cls)
  }

  // draw inner level
  const innerW = 8 * tileSize
  const innerH = 8 * tileSize
  const src = Pos.fromLevel(innerFrame.level(), pcoord(0, 0)).scale(tileSize)
  const dest = pcoord(4, 4).scale(tileSize)
  ctx.drawImage(worldImg,
    src.x, src.y, innerW, innerH,
    dest.x, dest.y, innerW, innerH
  )

  // draw frame border
  ctxWith(ctx, {strokeStyle: "gray", lineWidth: 10, globalAlpha: 0.5}, () => {
    ctx.strokeRect(dest.x, dest.y, innerW, innerH)
  })

  // draw canvas border
  ctxWith(ctx, {strokeStyle: "black"}, () => {
    ctx.strokeRect(0, 0, canvas2.width, canvas2.height)
  })

  if (checkWin()) {
    drawMessage(ctx, "You win!")
  }
}

function drawActors(ctx) {
  allActors().forEach(e=>e.draw(ctx))
}

function InitActors() {
  ImportActors()
}

class Actor {
  static id = 1 // a counter of ids to assign to actors as they're created

  static img = null
  // override `static img = ...` on subclasses

  constructor(pos) {
    this.pos = pos
    this.img = this.constructor.img

    // get id
    this.id = Actor.id
    Actor.id += 1
  }

  color(ctx){
    // used to show recursion
    return this.constructor.color
  }

  draw(ctx){
    drawImg(ctx, this.img, this.pos)
  }

  update(dir) {
    // returns whether it moved in the given dir
    return false
  }

  setPos(p) {
    RecordChange({
      id: this.id,
      before: { pos: this.pos.clone() },
      after: { pos: p.clone() },
    })
    this.pos = p
  }

  onGameInit() {
    // code that runs on game init
  }

  serialize() {
    return `${this.constructor.name} ${this.pos.x} ${this.pos.y}`
  }

  static deserialize(line) {
    const [type, x, y] = line.split(' ')
    assert(type === this.name, `expected ${this.name} got ${type}`)
    const p = pcoord(int(x), int(y))
    return new (this)(p)
  }
}

class Player extends Actor {
  static img = imgPlayer
  static color = "#000000"

  onGameInit() {
    const mini1 = getActorId(1)
    const mini2 = getActorId(2)
    assert(mini1.constructor === Mini)
    assert(mini2.constructor === Mini)
    const frameStack = [

       // not sure whether it makes more sense for this line to be here or not...
       // also, levelId doesn't seem to be relevant at all here idk why; the code is complicated
      new Frame({miniId: null, levelId: mini1.levelId}),

      new Frame({miniId: mini1.id, levelId: mini1.levelId}),
      new Frame({miniId: mini2.id, levelId: mini2.levelId}),
    ]

    this.pos = new FramePos(this.pos, frameStack)
  }

  update(dir) {
    return pushableUpdate(this, dir)
  }
}

class Mini extends Actor {
  static img = imgMini

  constructor(p, levelId, col) {
    super(p)
    assert(levelId.constructor === Number)
    this.levelId = levelId
    this.col = col
  }

  draw(ctx) {
    const roomSize = 8
    const numPx = roomSize*roomSize
    const pxSize = 4
    assert(roomSize * pxSize === 32)
    for (let ix = 0; ix < numPx; ix += 1) {
      const [y, x] = divmod(ix, roomSize)
      const p = Pos.fromLevel(this.level(), pcoord(x, y))
      let colorCode
      const a = findActor(null, p)
      if (a) {
        colorCode = a.color()
      } else {
        colorCode = GetTileColor(p)
      }
      const screenX = this.pos.x*tileSize + x*pxSize
      const screenY = this.pos.y*tileSize + y*pxSize

      ctxWith(ctx, {fillStyle: colorCode}, () => {
        ctx.fillRect(screenX, screenY, pxSize, pxSize)
      })
    }
  }

  color() {
    return this.col
  }

  update(dir) {
    return pushableUpdate(this, dir)
  }

  setPos(p) {
    setPosUnliftedHack(this, p)
  }

  level() {
    return getLevel(this.levelId)
  }

  serialize() {
    return `${this.constructor.name} ${this.pos.x} ${this.pos.y} ${this.levelId}`
  }

  static deserialize(line) {
    const [type, x, y, id] = line.split(' ')
    assert(type === this.name, `expected ${this.name} got ${type}`)
    const p = pcoord(int(x), int(y))
    const levelId = int(id)
    return new (this)(p, levelId, GetLevelColor(levelId))
  }
}

class Flag extends Actor {
  static img = imgFlag
  static color = "#FFFFFF"
}

class Crate extends Actor {
  static img = imgCrate
  static color = "#DB856B"

  update(dir) {
    return pushableUpdate(this, dir)
  }

  setPos(p) {
    setPosUnliftedHack(this, p)
  }
}

const allActorTypes = [Player, Crate, Flag, Mini]

// function dirTo(p1, p2) {
//   // returns 0-3 if p2 is adjacent to p1
//   // otherwise null
//   const dy = p2.y - p1.y
//   const dx = p2.x - p1.x
//   if (dy === 0 && dx === 1) { return 0 }
//   if (dy === -1 && dx === 0) { return 1 }
//   if (dy === 0 && dx === -1) { return 2 }
//   if (dy === 1 && dx === 0) { return 3 }
//   return null
// }

function getLevel(id) {
  return levels.find(l=>l.id===id)
}

function getLevelAt(pos) {
  return levels.find(l=>l.begin <= pos.y && pos.y < l.end)
}

function maybeTeleOut(that, dir) {
  // if that is standing in a level opening and moving out (dir)
  //   move that to the parent FramePos (teleport out one level)
  // else do nothing
  // returns whether the tele happened
  assert(that.pos.frameStack)

  const level = that.pos.frame().level()
  const outPos = LevelOpenings(level)[dir]
  if (outPos && outPos.equals(that.pos)) {
    that.setPos(that.pos.parent())
    return true
  } else {
    return false
  }
}

function maybeTeleIn(that, dir) {
  // if that is standing next to a Mini and is moving into it (dir)
  //   move that into the mini (teleport out one level)
  // else do nothing
  // returns whether the tele happened
  assert(that.pos.frameStack)

  const nextPos = posDir(that.pos, dir)
  const mini = findActor(Mini, nextPos)
  if (mini) {
    const op = LevelOpenings(mini.level())[oppDir(dir)]
    if (op) {
      // teleport into the mini
      const preOp = posDir(op, oppDir(dir)) // right before entering the room, to try to push
      const newPos = that.pos.child(preOp, new Frame({miniId: mini.id, levelId: mini.levelId}))
      that.setPos(newPos)

      return true
    }
  }
  return false
}

function pushableUpdate(that, dir) {
  // DRY without subclassing for pushable objects
  assert(that.pos.constructor === FramePos)

  const oldPos = that.pos.clone()
  const nextPos = posDir(that.pos, dir)
  assert(oldPos.constructor === FramePos)
  assert(nextPos.constructor === FramePos)

  if (maybeTeleOut(that, dir)) {
    if (pushableUpdate(that, dir)) {
      return true
    } else {
      // undo
      that.setPos(oldPos)
    }
  }

  if (!CanMoveToTile(nextPos)) { return false }

  const crate = findActor(Crate, nextPos)
  if (crate && !liftedUpdate(that, crate, dir)) { return false }

  if (maybeTeleIn(that, dir)) {
    if (pushableUpdate(that, dir)) {
      return true
    } else {
      // undo
      that.setPos(oldPos)
    }
  }

  const mini = findActor(Mini, nextPos)
  // how can mini exist if we already called maybeTeleIn?
  // well, if there was either no opening, or we failed to get into the opening
  if (mini && !liftedUpdate(that, mini, dir)) { return false }

  that.setPos(nextPos)
  return true
}

function setPosUnliftedHack(that, p) {
  // unlift from FramePos; this is hacky and will break if multiple actors ever have pos as a FramePos
  RecordChange({
    id: that.id,
    before: { pos: new Pos(that.pos) },
    after: { pos: new Pos(p) },
  })
  that.pos = p
}


function liftedUpdate(lifter, target, dir) {
  // lifts target into lifter's framepos, tries to update it, and unlifts it
  // returns whether the update was successful
  assert(lifter.pos.constructor === FramePos)

  target.pos = lifter.pos.lift(target.pos)
  const success = target.update(dir)
  target.pos = target.pos.unlift()

  return success
}

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
    return as.find(a=>p.equals(a.pos))
  } else {
    return as[0]
  }
}
