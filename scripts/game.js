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

  frame() {
    return back(this.frameStack)
  }

  parent() {
    const frame = this.frame()
    assert(frame)
    const newStack = this.frameStack.slice(0, this.frameStack.length-1)
    return new FramePos(frame.mini().pos, newStack)
  }

  child(pos, frame) {
    return new FramePos(pos, [...this.frameStack, frame])
  }

  str() {
    return `${frameStackToString(this.frameStack)} : ${this.x}, ${this.y}`
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
  player = allActors(Player)[0]
  assert(player)
  actors.forEach(a=>a.onGameInit())
}

function frameStackToString(stack) {
  const chars = ['[']
  for (const frame of stack) {
    const mini = getActorId(frame.miniId)
    assert(mini)
    chars.push(`Mini#${mini.id}@${mini.pos.str()}{${frame.levelId}}, `)
  }
  return chars.join('')
}

class Frame {
  // a frame is an entry location (from the next level up) and a level id
  constructor({dir, miniId, levelId}) {
    this.dir = dir
    this.miniId = miniId
    this.levelId = levelId
  }

  mini() {
    const a = getActorId(this.miniId)
    assert(a.constructor === Mini)
    return a
  }

  level() {
    return getLevel(this.levelId)
  }
}

function Update(dir) {
  player.update(dir)
  if (checkWin()) {
    console.log("you win!")
  }
  Raf()
}

function checkWin() {
  return player.pos.frameStack.length === 0
}

function DrawGame(ctx) {
  DrawTiles(ctx)
  drawActors(ctx)
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

  onGameInit() {
    // code that runs on game init
  }

  serialize() {
    return `${this.constructor.name} ${this.pos.x} ${this.pos.y}`
  }

  static deserialize(line) {
    const [type, x, y] = line.split(' ')
    assert(type === this.name, `expected ${this.name} got ${type}`)
    const p = new Pos({x: int(x), y: int(y)})
    return new (this)(p)
  }
}

class Player extends Actor {
  static img = imgPlayer
  static color = "#FFFFFF"

  onGameInit() {
    const mini = findActor(Mini, new Pos({x:2, y:2}))
    assert(mini)
    const frameStack = [new Frame({miniId: mini.id, levelId: mini.levelId})]

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
    const numPx = 8*8
    const data = new Uint8ClampedArray(numPx*4);
    for (let ix = 0; ix < numPx; ix += 1) {
      const [y, x] = divmod(ix, 8)
      const p = new Pos({x, y})
      const a = findActor(p)
      let colorCode
      if (a) {
        colorCode = a.color()
      } else {
        colorCode = GetTileColor(p)
      }
      const { r, g, b } = hexColor(colorCode)
      const iR = ix*4
      const iG = ix*4 + 1
      const iB = ix*4 + 2
      const iA = ix*4 + 3
      data[iR] = r
      data[iG] = g
      data[iB] = b
      data[iA] = 1
    }
    // const temp = document.createElement("canvas")
    // temp.width = 8
    // temp.height = 8
    // const tempCtx = temp.getContext('2d');
    // tempCtx.imageSmoothing = false
    // ctx.putImageData(new ImageData(data, 8, 8), 0, 0)

    let { x, y } = this.pos
    x *= tileWidth
    y *= tileHeight

    // const tempData = tempCtx.getImageData(0, 0, temp.width, temp.height)
    ctx.putImageData(new ImageData(data, 8, 8), x, y)
  }

  color() {
    return this.col
  }

  update(dir) {
    return pushableUpdate(this, dir)
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
    const p = new Pos({x: int(x), y: int(y)})
    const levelId = int(id)
    const topleft = Pos.fromLevel(getLevel(levelId), new Pos({x: 0, y: 0}))
    return new (this)(p, levelId, GetTileColor(topleft))
  }
}

class Crate extends Actor {
  static img = imgCrate
  static color = "#DB856B"

  update(dir) {
    return pushableUpdate(this, dir)
  }
}

const allActorTypes = [Player, Crate, Mini]

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
  const l = levels.find(l=>l.id===id)
  assert(l)
  return l
}

function maybeTeleOut(that, dir) {
  // if that is standing in a level opening and moving out (dir)
  //   move that to the parent FramePos (teleport out one level)
  // else do nothing
  // returns whether the tele happened
  assert(that.pos.frameStack)
  assert(0 <= dir && dir < 4) // temp

  const level = that.pos.frame().level()
  const outPos = LevelOpenings(level)[dir]
  if (outPos && outPos.equals(that.pos)) {
    that.pos = that.pos.parent()
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
  assert(0 <= dir && dir < 4) // temp

  const nextPos = posDir(that.pos, dir)
  const mini = findActor(Mini, nextPos)
  if (mini) {
    const op = LevelOpenings(mini.level())[oppDir(dir)]
    if (op) {
      // teleport into the mini
      const preOp = posDir(op, oppDir(dir)) // right before entering the room, to try to push
      that.pos = that.pos.child(preOp, new Frame({miniId: mini.id, levelId: mini.levelId}))

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
  assert(oldPos.frameStack) //temp
  assert(nextPos.frameStack) //temp

  if (maybeTeleOut(that, dir)) {
    if (pushableUpdate(that, dir)) {
      return true
    } else {
      // undo
      that.pos = oldPos
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
      that.pos = oldPos
    }
  }

  const mini = findActor(Mini, nextPos)
  // how can mini exist if we already called maybeTeleIn?
  // well, if there was either no opening, or we failed to get into the opening
  if (mini && !liftedUpdate(that, mini, dir)) { return false }

  that.pos = nextPos
  return true
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
