let player

function Update(dir) {
  player.update(dir)
  Raf()
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

  draw(ctx){
    drawImg(ctx, this.img, this.pos)
  }

  update(dir) {
    // returns whether it moved in the given dir
    return false
  }

  initGame() {
    // code that runs on game init
  }

  serialize() {
    return `${this.constructor.name} ${this.pos.x} ${this.pos.y}`
  }

  static deserialize(line) {
    const [type, x, y] = line.split(' ')
    assert(type === this.name, `expected ${this.name} got ${type}`)
    const p = {x: int(x), y: int(y)}
    return new (this)(p)
  }
}

class Player extends Actor {
  static img = imgPlayer

  update(dir) {
    const nextPos = posDir(this.pos, dir)
    if (!CanMoveToTile(nextPos)) { return false }

    const crate = findActor(Crate, nextPos)
    if (crate && !crate.update(dir)) { return false }

    this.pos = nextPos
    return true
  }
}

class Crate extends Actor {
  static img = imgCrate

  update(dir) {
    const nextPos = posDir(this.pos, dir)
    if (!CanMoveToTile(nextPos)) { return false }
    this.pos = nextPos
    return true
  }
}

const allActorTypes = [Player, Crate]

function InitGame() {
  // note: tiles/actors have already been loaded
  console.log("InitGame()")
  player = allActors(Player)[0]
  assert(player)
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
    return as.find(a=>posEq(a.pos, p))
  } else {
    return as[0]
  }
}
