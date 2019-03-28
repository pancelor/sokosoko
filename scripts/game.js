class Pos {
  constructor({x, y}) {
    this.x = x
    this.y = y
  }

  equals(other) {
    return this.x === other.x && this.y === other.y
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

  mini() {
    assert(0, "FrameBase has no mini")
  }

  level() {
    return getLevel(this.levelId)
  }

  mapMini(f) {
    return []
  }

  length() {
    return 1
  }

  equals(other) {
    if (other.constructor !== FrameBase) { return false }
    return (this.levelId === other.levelId)
  }

  str() {
    const level = getLevel(this.levelId)
    return `<base; ${level.name}>`
  }

  serialize() {
    const level = getLevel(this.levelId)
    return `${this.constructor.name} ${level.name}`
  }
}

class Frame {
  constructor(miniId, parent) {
    assert(miniId)
    assert(parent)
    this.miniId = miniId
    this.parent = parent
  }

  mini() {
    const a = getActorId(this.miniId)
    assert(a)
    assertEqual(a.constructor, Mini)
    return a
  }

  level() {
    const mini = this.mini()
    assert(mini)
    return getLevel(mini.levelId)
  }

  mapMini(f) {
    return [f(this.mini()), ...this.parent.mapMini(f)]
  }

  length() {
    return 1 + this.parent.length()
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
    const mini = this.mini()
    return `${this.parent.str()} | ${this.level().name}`
  }

  serialize() {
    return `${this.constructor.name} ${this.miniId} ${this.parent.serialize()}`
  }
}



let player

function InitGame() {
  // note: tiles/actors have already been loaded
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

let gotBonus = false

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

function DrawGame(ctx) {
  DrawTiles(ctx)
  drawActors(ctx)
}

async function DrawView() {
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
    const fillStyle = GetLevelColor(innerFrame.level())
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

  if (checkWin()) {
    const lines = ["You win!"]
    if (gotBonus) lines.push("excellent work")
    drawMessage(ctx, lines)
  }
}

function drawActors(ctx) {
  allActors().forEach(e=>e.draw(ctx))
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
    this.dead = false
    // note that actors might have a `tag` attribute, set by the level loader
  }

  color(){
    // used to show recursion
    return this.constructor.color
  }

  draw(ctx){
    if (this.dead) { return }
    drawImg(ctx, this.img, this.pos)
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

  setFrameStack(f) {
    // by default, don't record
    this.frameStack = f
  }

  die() {
    this.setDead(true)
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
    return `${this.constructor.name} ${this.pos.x} ${this.pos.y}`
  }

  static deserialize(line) {
    const [type, x, y] = line.split(' ')
    assertEqual(type, this.name)
    const p = pcoord(int(x), int(y))
    return new (this)(p)
  }
}

class Player extends Actor {
  static img = imgPlayer
  static color = "#000000"

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
    hack_seen_teles = new Set()
    const success = pushableUpdate(this, dir)
    maybeFakeWin()
    if (checkWin()) {
      PlayAndRecordSound(sndWin)
    }
    return success
  }
}

class Mini extends Actor {
  static img = imgMini

  constructor(p, levelId, col) {
    super(p)
    assertEqual(levelId.constructor, Number)
    this.levelId = levelId
    this.col = col
  }

  draw(ctx) {
    if (this.dead) { return }
    const roomSize = 8
    const numPx = roomSize*roomSize
    const pxSize = 4
    assertEqual(roomSize * pxSize, 32)
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

  playMoveSound() {
    PlayAndRecordSound(sndShove)
  }

  color() {
    return this.col
  }

  level() {
    return getLevel(this.levelId)
  }

  str() {
    return `${this.level().name}${this.pos.str()}`
  }

  serialize() {
    return `${this.constructor.name} ${this.pos.x} ${this.pos.y} ${this.level().name}`
  }

  static deserialize(line) {
    const [type, x, y, levelName] = line.split(' ')
    assertEqual(type, this.name)
    const p = pcoord(int(x), int(y))
    const level = levelFromName(levelName)
    assert(level, `level "${levelName}" doesn't exist`)
    return new (this)(p, level.id, GetLevelColor(level))
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

  isSpecial() {
    return this.img === imgCrateSpecial
  }

  serialize() {
    const extra = this.isSpecial() ? "1" : "0"
    return `${this.constructor.name} ${this.pos.x} ${this.pos.y} ${extra}`
  }

  setPos(p) {
    Actor.prototype.setPos.call(this, p)
    if (!this.isSpecial()) return
    if (!findActor(Flag, this.pos)) return
    this.collect()
  }

  playMoveSound() {
    PlayAndRecordSound(sndShove)
  }

  collect() {
    this.setDead(true)
    RecordChange({ // hack to talk to the sound system
      id: this.id,
      before: {},
      after: { collected: true },
    })
    PlayAndRecordSound(sndBonus)
    gotBonus = true
  }

  static deserialize(line) {
    const [type, x, y, special] = line.split(' ')
    assertEqual(type, this.name)
    const p = pcoord(int(x), int(y))
    const that = new (this)(p)
    if (!!int(special)) {
      that.img = imgCrateSpecial
    }
    return that
  }
}

const allActorTypes = [Player, FakeFlag, Flag, Mini, Crate]

function maybeTeleOut(that, dir) {
  // if that is standing in a level opening and moving out (dir)
  //   move that to the parent Frame (teleport out one level)
  // else do nothing
  // returns whether the tele happened
  assert(that.frameStack)

  const innerLevel = that.frameStack.level()
  const outPos = LevelOpenings(innerLevel)[dir]
  if (outPos && outPos.equals(that.pos)) {
    // prepare to teleport
    const oldPos = that.pos
    const oldFrameStack = that.frameStack

    const parent = that.frameStack.parent
    const mini = that.frameStack.mini()
    that.setPos(mini.pos)
    that.setFrameStack(parent)

    // that has now teleported; try to move
    if (pushableUpdate(that, dir)) {
      that.playTeleOutSound()
      return true
    } else {
      // pretty sure this is a bad idea; the physics don't work
      // (e.g. if `that` is pushing against a wall, the normal force gets
      // transmitted to the player inside the mini, not the mini itself)
      // // try to counter-push the mini we're teleporting out of
      // if (lifted(that, mini, ()=>pushableUpdate(mini, oppDir(dir)))) {
      //   return true
      // }

      // undo
      that.setPos(oldPos)
      that.setFrameStack(oldFrameStack)
    }
  }
  return false
}

let hack_seen_teles
function maybeTeleIn(that, dir) {
  // if that is standing next to a Mini and is moving into it (dir)
  //   move that into the mini. (one tile before the actual entrance)
  // else do nothing
  // returns whether the tele happened
  assert(that.frameStack)
  assert(that.frameStack.length() < 1000, "HACK infinite mini recursion") // hacky check; check it better and delete `that`, i think

  const nextPos = posDir(that.pos, dir)
  const mini = findActor(Mini, nextPos)
  if (mini) {
    const op = LevelOpenings(mini.level())[oppDir(dir)]
    if (op) {
      // if (hack_seen_teles.has(mini.id)) {
      //   console.warn('infinite mini recursion detected; killing', serialize(that))
      //   PlayAndRecordSound(sndInfinite)
      //   that.die()
      //   return true
      // }
      // hack_seen_teles.add(mini.id)

      // prepare to teleport
      const oldPos = that.pos
      const oldFrameStack = that.frameStack

      const newPos = posDir(op, oppDir(dir)) // right before entering the room; to try to push anything in the entryway thats in the way
      const newStack = new Frame(mini.id, that.frameStack)
      that.setPos(newPos)
      that.setFrameStack(newStack)

      // that has now teleported; try to move
      if (pushableUpdate(that, dir)) {
        that.playTeleInSound()
        return true
      } else {
        // undo
        that.setPos(oldPos)
        that.setFrameStack(oldFrameStack)
      }
    }
  }
  return false
}

function maybeConsume(that, food, dir) {
  // dir is the direction the _mini_ is moving
  assert(food.frameStack)
  if (that.constructor !== Mini) return false

  if (maybeTeleIn(food, oppDir(dir))) {
    that.playMoveSound()
    const newMiniPos = posDir(that.pos, dir)
    const wtf = findActor([Crate, Mini], newMiniPos)
    if (wtf) {
      // this is _very_ weird; eating the food has pushed some stuff around
      // in a way such that the food's old position is occupied again.
      // (e.g. green or purple/yellow room of level_newp.dat)

      // Im so so conflicted about what to do here;
      // I think we should succeed and evaporate the food out of existence
      // That seems to be the case in the green room of level_newp.dat
      // But what about the purple/yellow combo? which block gets eaten?
      // Wouldn't it be all of them but none of them at once? so now the three
      // remaining objects are weird half-and-half glitchy abominations?
      // (could randomize which one is murdered, but that seems like
      // a cop out and a bad experience as a player imo)

      console.warn("infinite nastiness occurs") // this doesn't even catch everything ....
      PlayAndRecordSound(sndInfinite)
      // edit: god im playing with it more and everything is so fucky;
      // return false here is no good... but return true isn't great either

      wtf.die()
    }
    that.setPos(newMiniPos)
    return true
  }
  return false
}

function pushableUpdate(that, dir) {
  // DRY without subclassing for pushable objects
  assert(that.frameStack)

  const nextPos = posDir(that.pos, dir)

  if (maybeTeleOut(that, dir)) { return true }
  if (!CanMoveToTile(nextPos)) { return false }

  const crate = findActor(Crate, nextPos)
  if (crate && lifted(that, crate, ()=>maybeConsume(that, crate, dir))) { return true }
  if (crate && !lifted(that, crate, ()=>pushableUpdate(crate, dir))) { return false }

  if (maybeTeleIn(that, dir)) { return true }

  const mini = findActor(Mini, nextPos)
  // how can mini exist if we already called maybeTeleIn?
  // well, if there was either no opening, or we failed to get into the opening
  if (mini && lifted(that, mini, ()=>maybeConsume(that, mini, dir))) { return true }
  if (mini && !lifted(that, mini, ()=>pushableUpdate(mini, dir))) { return false }

  that.playMoveSound()
  that.setPos(nextPos)
  return true
}

function lifted(lifter, target, cb) {
  // lifts target into lifter's frame, tries to update it in some way (with cb), and unlifts it
  // returns whatever cb returns
  assert(lifter.frameStack)

  // TODO: get player here and break the assert? is that possible
  assert(!target.frameStack)

  target.frameStack = lifter.frameStack
  const success = cb()
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
    return as.find(a=>!a.dead && p.equals(a.pos))
  } else {
    return as[0]
  }
}
