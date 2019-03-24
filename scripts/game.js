class Pos {
  constructor({x, y}) {
    this.x = x
    this.y = y
  }

  equals(other) {
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

class FrameBase {
  constructor(levelId) {
    this.levelId = levelId
    this.parent = null
  }

  clone() {
    return new FrameBase(this.levelId)
  }

  mini() {
    assert(0, "FrameBase has no mini")
  }

  level() {
    return getLevel(this.levelId)
  }

  equals(other) {
    if (other.constructor !== FrameBase) { return false }
    return (this.levelId === other.levelId)
  }

  str() {
    return `<base; ${this.levelId}>`
  }
}

class Frame {
  constructor(miniId, parent) {
    assert(miniId)
    assert(parent)
    this.miniId = miniId
    this.parent = parent.clone()
  }

  clone() {
    return new Frame(this.miniId, this.parent.clone())
  }

  mini() {
    const a = getActorId(this.miniId)
    assert(a && a.constructor === Mini)
    return a
  }

  level() {
    const mini = this.mini()
    assert(mini)
    return getLevel(mini.levelId)
  }

  equals(other) {
    if (other.constructor !== Frame) { return false }
    if (this.miniId !== other.miniId) { return false }

    const p1 = this.parent
    const p2 = other.parent
    if (p1 === null) {
      return (p2 === null)
    } else {
      return p1.equals(p2)
    }
  }

  str() {
    const frameStrs = []
    const mini = this.mini()
    return `${this.parent.str()} | ${mini.color()}(${mini.id})`
  }
}



let player

function InitGame() {
  // note: tiles/actors have already been loaded
  InitHistory()
  player = allActors(Player)[0]
  assert(player)
  actors.forEach(a=>a.onGameInit())
}

let keyHist = []
let keyHistInterval
function getKeyHist() {
  console.log(`const winStr = "${keyHist.join('')}"`)
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
  if (checkRealWin()) { return }

  StartEpoch()
  player.update(dir)
  maybeFakeWin()
  EndEpoch()
  Raf()
}

function checkRealWin() {
  return !findActor(Flag)
}

function maybeFakeWin() {
  const a = findActor(Flag, player.pos)
  if (!a) { return false}
  destroyActor(a)
}

function destroyActor(a) {
  const ix = actors.indexOf(a)
  actors.splice(ix, 1)
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
  const innerFrame = player.frameStack
  const outerFrame = player.frameStack.parent

  // draw outer level border
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
    const fillStyle = GetLevelColor(getLevel(5))
    ctxWith(ctx, {fillStyle}, cls)
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

  if (checkRealWin()) {
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

  setFrameStack(f) {
    // by default, don't record
    this.frameStack = f
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
    const miniBlack = findActor(Mini, pcoord(3, 35))
    const miniGreen = findActor(Mini, pcoord(1, 6))
    const miniBlue = findActor(Mini, pcoord(6, 14))
    const miniBlackBase = findActor(Mini, pcoord(4, 5))
    const miniOuter = findActor(Mini, pcoord(4, 43))
    const black = imgBlackWall.dataset.color
    const green = imgGreenWall.dataset.color
    const blue = imgBlueWall.dataset.color
    assertEqual(miniBlack.color(), black)
    assertEqual(miniGreen.color(), green)
    assertEqual(miniBlue.color(), blue)
    assertEqual(miniBlackBase.color(), black)
    assertEqual(miniOuter.color(), black)
    const miniOrder = [
      miniOuter.id,

      miniBlackBase.id,
      miniGreen.id,

      // start
      miniBlue.id,
      miniBlack.id,
      miniGreen.id,

      miniBlue.id,
      miniBlack.id,
      miniGreen.id,

      miniBlue.id,
      miniBlack.id,
      miniGreen.id,
      // end
    ]

    let stack = new FrameBase(5)
    for (const miniId of miniOrder) {
      stack = new Frame(miniId, stack)
    }
    this.frameStack = stack
  }

  setFrameStack(f) {
    RecordChange({
      id: this.id,
      before: { frameStack: this.frameStack.clone() },
      after: { frameStack: f.clone() },
    })
    this.frameStack = f
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
    return new (this)(p, levelId, GetLevelColor(getLevel(levelId)))
  }
}

class FakeFlag extends Actor {
  static img = imgFlag
  static color = "#FFFFFF"
}

class Flag extends Actor {
  static img = imgFlag
  static color = "#FFFFFF"
}

class Crate extends Actor {
  static img = imgCrate
  static color = "#AA6853"

  serialize() {
    const extra = (this.img === imgCrateSpecial) ? "1" : "0"
    return `${this.constructor.name} ${this.pos.x} ${this.pos.y} ${extra}`
  }

  static deserialize(line) {
    const [type, x, y, special] = line.split(' ')
    assert(type === this.name, `expected ${this.name} got ${type}`)
    const p = pcoord(int(x), int(y))
    const that = new (this)(p)
    if (!!int(special)) {
      that.img = imgCrateSpecial
    }
    return that
  }
}

const allActorTypes = [Player, FakeFlag, Flag, Mini, Crate]

function getLevel(id) {
  return levels.find(l=>l.id===id)
}

function getLevelAt(pos) {
  return levels.find(l=>l.begin <= pos.y && pos.y < l.end)
}

function maybeTeleOut(that, dir) {
  // if that is standing in a level opening and moving out (dir)
  //   move that to the parent Frame (teleport out one level)
  // else do nothing
  // returns whether the tele happened
  assert(that.frameStack)

  const innerLevel = that.frameStack.level()
  const outPos = LevelOpenings(innerLevel)[dir]
  if (outPos && outPos.equals(that.pos)) {
    const parent = that.frameStack.parent
    that.setPos(that.frameStack.mini().pos)
    that.setFrameStack(parent)
    return true
  } else {
    return false
  }
}

function maybeTeleIn(that, dir) {
  // if that is standing next to a Mini and is moving into it (dir)
  //   move that into the mini. (one tile before the actual entrance)
  // else do nothing
  // returns whether the tele happened
  assert(that.frameStack)

  const nextPos = posDir(that.pos, dir)
  const mini = findActor(Mini, nextPos)
  if (mini) {
    const op = LevelOpenings(mini.level())[oppDir(dir)]
    if (op) {
      // teleport into the mini
      const newPos = posDir(op, oppDir(dir)) // right before entering the room; to try to push anything in the entryway thats in the way
      const newStack = new Frame(mini.id, that.frameStack)
      that.setPos(newPos)
      that.setFrameStack(newStack)

      return true
    }
  }
  return false
}

function pushableUpdate(that, dir) {
  // DRY without subclassing for pushable objects
  assert(that.frameStack)

  const oldPos = that.pos.clone()
  const oldFrameStack = that.frameStack.clone()
  const nextPos = posDir(that.pos, dir)

  if (maybeTeleOut(that, dir)) {
    if (pushableUpdate(that, dir)) {
      return true
    } else {
      // undo
      that.setPos(oldPos)
      that.setFrameStack(oldFrameStack)
    }
  }

  if (!CanMoveToTile(nextPos)) { return false }

  const crate = findActor(Crate, nextPos)
  if (crate && !liftedPushableUpdate(that, crate, dir)) { return false }

  if (maybeTeleIn(that, dir)) {
    if (pushableUpdate(that, dir)) {
      return true
    } else {
      // undo
      that.setPos(oldPos)
      that.setFrameStack(oldFrameStack)
    }
  }

  const mini = findActor(Mini, nextPos)
  // how can mini exist if we already called maybeTeleIn?
  // well, if there was either no opening, or we failed to get into the opening
  if (mini && !liftedPushableUpdate(that, mini, dir)) { return false }

  that.setPos(nextPos)
  return true
}

function liftedPushableUpdate(lifter, target, dir) {
  // lifts target into lifter's frame, tries to update it, and unlifts it
  // returns whether the update was successful
  assert(lifter.frameStack)
  assert(!target.frameStack)

  target.frameStack = lifter.frameStack.clone()
  const success = pushableUpdate(target, dir)
  delete target.frameStack

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
