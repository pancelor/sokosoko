//
// testing; used later in this file so it needs to be first
//

const allTests = []
function RegisterTest(name, test) {
  allTests.push({name, test})
}
function RunTests() {
  for (const {name, test} of allTests) {
    try {
      test()
    } catch (err) {
      console.log(`Test failed: '${name}'`);
      throw err
    }
  }
}

function assert(b, msg=null) {
  if (!b) {
    msg = (msg === null) ? "assert error" : msg
    throw new Error(msg)
  }
}

function assertEqual(actual, expected, msg=null) {
  if (actual !== expected) {
    const expl = `expected ${expected}; got ${actual}`
    msg = (msg === null) ? expl : `${msg}: ${expl}`
    throw new Error(msg)
  }
}

function expectError(cb, msgMatch='') {
  try {
    cb()
  } catch (err) {
    if (err.message.match(msgMatch)) {
      return
    } else {
      throw err
    }
  }
  throw new Error("expected an error; got none")
}

function assertObjMatch(actual, expected, _path="") {
  for (const prop of Object.keys(expected)) {
    const pathToProp = `${_path}.${prop}`
    if (expected[prop] && expected[prop].constructor === Object) {
      assert(actual[prop].constructor === Object, `${pathToProp}: expected ${expected[prop]}; got ${actual[prop]}`)
      assertObjMatch(actual[prop], expected[prop], _path=pathToProp)
    } else {
      assertEqual(actual[prop], expected[prop], `${pathToProp}: expected ${expected[prop]}; got ${actual[prop]}`)
    }
  }
}
RegisterTest("assertObjMatch", () => {
  assertObjMatch({id: 1}, {id: 1})
  assertObjMatch({a: 1, b: 2}, {a: 1, b: 2})
  assertObjMatch({id: 1, extras: "are allowed"}, {id: 1})
  expectError(() => {
    assertObjMatch({id: 1}, {id: 2})
  }, /expected.*got/)
  expectError(() => {
    assertObjMatch({}, {id: 2})
  }, /expected.*got/)
  expectError(() => {
    assertObjMatch({a: 1, b: 3}, {a: 1, b: 2})
  }, /expected.*got/)
  assertObjMatch({foo: {bar: 1}}, {foo: {bar: 1}})
  expectError(() => {
    assertObjMatch({foo: {bar: 1}}, {foo: {bar: 2}})
  }, /expected.*got/)
})

function assertObjEqual(a, b) {
  return assertObjMatch(a, b) && assertObjMatch(b, a)
}
RegisterTest("assertObjEqual", () => {
  assertObjEqual({a: 1, b: 2}, {b:2, a: 1})
  assertObjMatch({foo: {bar: 1}}, {foo: {bar: 1}})
  expectError(() => {
    assertObjEqual({a: 1}, {a: 2})
  }, /expected.*got/)
  expectError(() => {
    assertObjEqual({a: 1}, {b:2, a: 1})
  }, /expected.*got/)
  expectError(() => {
    assertObjMatch({foo: {bar: 1}}, {foo: {bar: 2}})
  }, /expected.*got/)
})

//
// math
//

function randInt(min, max) {
  // returns an int
  //   randInt(a, b) -> [a, b)
  //   randInt(b) -> [0, b)
  if (max === undefined) {
    [min, max] = [0, min];
  }
  return Math.floor(Math.random() * (max-min)) + min;
}

function randName(length) {
  const chars = []
  for (let i = 0; i < length; i += 1) {
    chars.push(String.fromCharCode(randInt(65, 91)))
  }
  return chars.join('')
}

function choose(arr) {
  return arr[randInt(0, arr.length)]
}

function clamp(x, a, b) {
  if (x < a) { return a }
  if (x > b) { return b }
  return x
}
RegisterTest("clamp", () => {
  assertEqual(clamp(0, 3, 10), 3)
  assertEqual(clamp(3, 3, 10), 3)
  assertEqual(clamp(5, 3, 10), 5)
  assertEqual(clamp(10, 3, 10), 10)
  assertEqual(clamp(11, 3, 10), 10)
  assertEqual(clamp(-5, 3, 10), 3)
})

function saneMod(x, y) {
  // mod(x, y) returns a number in [0, y), like % should do (but doesn't)
  x = x % y
  if (x < 0) { x += y}
  return x
}
RegisterTest("saneMod", () => {
  assertEqual(saneMod(3, 10), 3)
  assertEqual(saneMod(0, 10), 0)
  assertEqual(saneMod(10, 10), 0)
  assertEqual(saneMod(-6, 10), 4)
})

function divmod(x, y) {
  return [Math.floor(x / y), saneMod(x, y)]
}
RegisterTest("divmod", () => {
  assertEqual(divmod(10, 3)[0], 3)
  assertEqual(divmod(10, 3)[1], 1)
})

function hex(str) {
  const match = str.match(/^[#]?(?<code>[a-fA-F\d]+)$/)
  if (!match) {
    throw new Error(`bad hex parse on "${str}"`)
  }
  return parseInt(match.groups.code, 16)
}
RegisterTest("hex", () => {
  assertEqual(hex("FFA300"), 16753408)
  assertEqual(hex("#FFA300"), 16753408)
})

function hexColor(str) {
  let val, r, g, b
  val = hex(str)
  ;([val, b] = divmod(val, 256))
  ;([val, g] = divmod(val, 256))
  r = val
  return {r, g, b}
}
RegisterTest("hexColor", () => {
  assertObjMatch(hexColor("#FFA300"), {r:255, g:163, b:0})
})

function int(str) {
  if (!str.match(/^\d+$/)) {
    throw new Error(`bad int parse on "${str}"`)
  }
  return parseInt(str)
}

function xor(a, b) {
  // returns the logical xor of the booleans a and b
  // returns a bool no matter how bool-y the arguments are
  return !!a != !!b
}
RegisterTest("xor", () => {
  assertEqual(xor(0, 0), false)
  assertEqual(xor(0, 1), true)
  assertEqual(xor(1, 0), true)
  assertEqual(xor(1, 1), false)
})

async function sleep(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms)
  })
}

function back(arr, i=1) {
  return arr[arr.length-i]
}

function oppDir(dir) {
  // returns the opposite direction
  return saneMod(dir + 2, 4)
}

function objFilter(obj, pred) {
  const res = {}
  for (const prop of Object.keys(obj)) {
    if (pred(prop, obj[prop])) {
      res[prop] = obj[prop]
    }
  }
  return res
}
RegisterTest("objFilter", () => {
  assertObjEqual(
    objFilter({a: 1, b: 2}, (k, v) => v === 2),
    {b: 2},
  )
  assertObjEqual(
    objFilter({a: 1, b: 2}, (k, v) => k === 'a'),
    {a: 1},
  )
})

function invertObject(obj) {
  const res = {}
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (k == "null" || k == "undefined" || v === null || v === undefined) {
      assert(0, "can't invert when there are nullishes")
    }
    assert(res[v] === undefined, `object is not 1-1: multiple keys have value ${v}`)
    res[obj[k]] = k
  }
  return res
}
RegisterTest("invertObject", () => {
  assertObjEqual(invertObject({}), {})
  assertObjEqual(invertObject({a: 1}), {1: 'a'})
  assertObjEqual(invertObject({a: 1, b: 2}), {1: 'a', 2: 'b'})
  expectError(
    () => invertObject({a: 1, b: 1}),
    "multiple keys have value"
  )
  expectError(
    () => invertObject({a: null}),
    "nullishes"
  )
  expectError(
    () => invertObject({null: 3}),
    "nullishes"
  )
})

function sum(arr) {
  let res = 0
  for (const x of arr) {
    res += x
  }
  return res
}
RegisterTest("sum", ()=> {
  assertEqual(sum([5,2,3]), 10)
  assertEqual(sum([]), 0)
  assertEqual(sum([-9]), -9)
})

function argmin(arr) {
  assert(arr.length > 0, "argmin([]) is not defined")
  let arg = 0
  let min = arr[0]
  for (let i = 0; i < arr.length; i++) {
    const elem = arr[i]
    if (elem < min) {
      arg = i
      min = elem
    }
  }
  return {arg, min}
}
RegisterTest("argmin 1", () => {
  const {arg, min} = argmin([30,60,25,100])
  assertEqual(arg, 2)
  assertEqual(min, 25)
})
RegisterTest("argmin 2", () => {
  const {arg, min} = argmin([1])
  assertEqual(arg, 0)
  assertEqual(min, 1)
})

function serialize(x) {
  if (x && x.serialize && x.serialize.constructor === Function) {
    return x.serialize()
  } else {
    return `${x}`
  }
}

// instead of this:
//     while (true) {
//       do stuff, break eventually
//     }
// use this:
//     let s = getSafeSentinel()
//     while (s()) {
//       do stuff, break eventually
//     }
function getSafeSentinel(max=100) {
  let i = 0
  return () => {
    i += 1
    const b = i < max
    if (!b) console.warn("loop sentinel triggered!")
    return b
  }
}

//
// functions for use in the chrome dev tools:
//

function singleEventListener(evName, cb) {
  const handler = (e) => {
    window.removeEventListener("keydown", handler)
    return cb(e)
  }
  window.addEventListener("keydown", handler)
}

function addDiffListener(evName, ignore=[]) {
  // e.g. addDiffListener("mousewheel", ["timestamp"])
  let last = null;
  window.addEventListener(evName, (e) => {
    if (last) {
      diffSummary(last, e, ignore)
    }
    last = e
  })
}

function diffSummary(a, b, ignore=[]) {
  const d = diff(a, b)
  console.log("old:")
  for (const prop of Object.keys(d.old)) {
    if (ignore.includes(prop)) { continue }
    console.log(`  ${prop}: ${d.old[prop]}`);
  }
  console.log("new:")
  for (const prop of Object.keys(d.new)) {
    if (ignore.includes(prop)) { continue }
    console.log(`  ${prop}: ${d.new[prop]}`);
  }
}

function diff(a, b) {
  const res = { old: {}, new: {}}
  for (const prop in a) {
    if (a[prop] !== b[prop]) {
      res.old[prop] = a[prop]
      res.new[prop] = b[prop]
    }
  }
  for (const prop in b) {
    if (a[prop] !== b[prop]) {
      res.old[prop] = a[prop]
      res.new[prop] = b[prop]
    }
  }
  return res
}

function listen(evName) {
  window.addEventListener(evName, console.log)
}

let keyHist = null
function recordingCycle() {
  // returns the new state of the recording
  const wasOn = !!keyHist
  assert(wasOn)
  recordingStop()
  recordingStart()
}
function recordingStart() {
  console.log("Recording moves...")
  // recordingOutput.innerText = ""
  keyHist = []
}
function recordingStop() {
  console.log("Recorded moves:");
  const str = keyHist.join('')
  console.log(str)
  recordingOutput.innerText = `Recorded Moves: ${str}`
  keyHist = null
}
function RecordKeyHist(dir) {
  if (!keyHist) return
  keyHist.push(dir)
}

function play(moves, dt=50) {
  let ix = 0
  const keyHistInterval = setInterval(() => {
    if (ix >= moves.length) {
      clearInterval(keyHistInterval)
      return
    }
    const dir = int(moves[ix])
    ProcessInput(dir)
    ix += 1
  }, dt)

  singleEventListener("keydown", e=>{
    if (ix < moves.length) {
      console.log("Aborted at", ix);
    }
    clearInterval(keyHistInterval)
  })
}
const solutions = {
  zero: {
    win: "22122211023300111112212110011",
  },
  one: {
    win: "033000002222112111100032232111222100300300330112332211233233110033001103332333000000011003300000011100330011",
  },
  "stomach": {
    "win": "22223333000333021100333003333333323330000112332221122223301210001033230001033333331111112221122211000333300002211112211111122111121222211100033333300333300003332212211",
  },
  two: {
    win: "010000000000003322222200000011222222222222212111101112111111111331100111211100033033303323233332222222222222",
    bonus: "100000000000003322222200000003322211111121212111101112111111333333033323331101112111111111011121110030000003322211111012232132211000022211110111211111111133110111211100033033303323323333222222222222",
  },
  tree: {
    win: "12233333333332333330010011000031222233221111011122122211011211002002223330332203300033233330033000033033332232331101122211212222222222222222220000000000000000000330000300111122221111111121101133233011111223332",
  },
  tunnels: {
    // win: "103330330000300011112222332221121111230022221033033000030001111101112211033311211003110033222332222222",
    win: "103330030003000111122223322111211211033311121123221033030000300011112223223232222222", // ethan's no-push solution
    bonus: "1033300300030001111222332332221133000110000333322212222121122230330001100000333233332221223221113300030001111222200022233222112111123002222103300300300300011111011121103331121110032223322222233300030001111101112113000333230000222111222303323332333332221223211133000300011111101112110333112111032233233222222",
  },
  original: {
    win: "00103333000000302110323000033222211012222223211111211100332321130011223303333003300100000030001123032220332211012222223211111121110033232113033332233302110033311111111121221000111222",
  },
  wack: {
    win: "0103333000000030211033230033001111233311103333222211012222222121111130011223333332223330010331113211111111221000111111222122222222111111101111112222122222222111111101111112221222003442222211211111101133233333330000000030332211012222222211111110111111221103333332230000000333",
    bonus: "01033330000000302110323304003301011112333333230000022221111110330032244444444444444444444444444433144111033322222004444444555551101222222212111113311210333333033211111113001120332233333223030010331112111111214210002333010011112111222322110323010333333231300000004444444400300445550000030330011222212230000022221111110330332221110233300113222211122222221111111101111112222221222222111211211111110111111222221122232222211211211111110111111222122212222222112111111101111112211033333303333323333330300000003033221101222222212111111011111222300000004400333032321",
  },
  dolphin: {
    win: "2222111100011211011233333033333333332211133030001111111111211110332332112230000022230033222333300000000333333300030000002222111111112222222112111100011211011233330300022233012100223333331111111211110333330333333333322211101111222200003330030011111111112111110033322233303322233330000000333033333330003000000000333300111111111121111110",
    bonus: "22221111000112211103330000222211330000010333111222230322201122333331110001100032222211222300000022223011011233330333333333332211133303001111111110002223301210022121111101003332223303322233333000000003333333300000222112111111112222222211110001121100110111223333333033333333332211112220003333001111111111211111003332213001112233333033333333332211112222000033330011111110112112111103303332221333033222333330000000330333333330000000003333001111111111211111210",
    cheese: "",
  },
  nest: {
    win: "1111122300111122223201223222100333321222223000330332210033322222230000332100",
  },
  butterfly: {
    win: "3333233233333333333322222322222333322230032321210000000001230100322332121003011111111103201112332230301121000000002222222230001001233232330010123203212103011111111111333123000000100003311100000011111111111210023322222222233333222000111110000000000301100010011210",
  },
  flare: {
    win:   "0003333332330330112222212333332330333333310233330111101111111211101111112111122332333111000003322332322101111011033333333111111222000333333331111121111133333013132111110111222233301111000300100000000000000011101001100300000000000030011110001000300000000003",
    // be careful of this once sndRip is resolved into a mechanic; idk what might happen in this situation:
    // cheese_: "11111211101111112111123331110033330333333321123300332200112110333331111123322233311100003323231001121131033333334444433222333323011111000110333333333111111111233222311000222333330112111110000332233032111001121103333331311331111112330332333233312334433443",
    bonus: "0033333033233301222212333333033233333333330111011011111112111130122222322122220000300100000111113333333111112111123333330011211111121111003300033322310011222112233330333333033012321121111112111103333333333111112222232212221011112222000033332331002230003001000001211111123303300332332330322222200001223003001121033322122210001100112221103333330011001122211122223300000003011110010034444444444444400010000030111100010003000000000103",
  },
  "size": {
    "win": "222222301033331112100003033011221000000110302232222230121000010003222222003330010000001123033201232111112133033321000022323221222223221112223001121233231032301033333333303320112333333333322",
    "bonus": "3330111210000011030322222200333001000000112303322122223221112222222223010333311121000000000222233001123211113332100301112100033300100000100223222223221112221033333333330332011233333333332300013222100001003222222",
    // "cheese": "22222230103333111210000303301122100000011030223222223012100001000322222200333001000000112303320123211111213303332100002232322122222322111222300112123323103230103333333330332011233333333332440332111011222111222232103001123100323211011222111222",
  },
  "bridge": {
    // win:
    //   start 333011
    //   up 100001121111112211111011110000000011111111111111221100010232222112112223212111111111000000000000333331110033000001000011111
    //   middle 0301033330332111111132232
    //   left 2111122322222232222211222321111100011110000000000330033111110132333330033323000022230000000001111111111112211221111101100011111222
    //   middle2 233131000000000032110112333322332223301011
    //   (up)
    //   middle3 000333333333332110011000100322222222
    //   finish 23
    "win": "3330111000011211111122111110111100000000111111111111112211000102322221121122232121111111110000000000003333311100330000010000111110301033330332111111132232211112232222223222221122232111110001111000000000033003311111013233333003332300002223000000000111111111111221122111110110001111122223313100000000003211011233332233222330101110000112111111221111101111000000001111111111111122110001023222211211222321211111111100000000000033333111003300000100001111100033333333333211001100010032222222223",
    // bonus:
    //   (win -finish)
    //   middle4 0000001003222223322112200333301111111111222
    //   (left)
    //   middle5 23333330000002222221111100000000032222222123333333
    "bonus": "333011100001121111112211111011110000000011111111111111221100010232222112112223212111111111000000000000333331110033000001000011111030103333033211111113223221111223222222322222112223211111000111100000000003300331111101323333300333230000222300000000011111111111122112211111011000111112222331310000000000321101123333223322233010111000011211111122111110111100000000111111111111112211000102322221121122232121111111110000000000003333311100330000010000111110003333333333321100110001003222222220000001003222223322112200333301111111111222211112232222223222221122232111110001111000000000033003311111013233333003332300002223000000000111111111111221122111110110001111122223333330000002222221111100000000032222222123333333",
  },
}
function playSolution(name, dt=10) {
  reset()
  const sols = solutions[currentLevelName]
  if (!sols) return
  const sol = sols[name]
  if (!sol) return
  play(sol, dt)
}
const win = (dt=0) => playSolution("win", dt)
const bonus = (dt=0) => playSolution("bonus", dt)
const cheese = (dt=0) => playSolution("cheese", dt)

const winTickTock = (dt=0) => {
  reset()
  let redR = `011111000003322233300000`
  let redL = `222211100011222223333322`
  let brownU = `10${redR}${redR}${redR}${redR}112${redL}${redL}${redL}${redL}11111`
  let brownD = `33330${redR}${redR}${redR}${redR}332${redL}${redL}${redL}${redL}332`
  let sol = `1${brownU}${brownU}${brownU}${brownU}003${brownD}${brownD}${brownD}${brownD}001${brownU}${brownU}${brownU}${brownU}`
  console.log({length: sol.length});
  play(sol, dt)
}

let devmode = false
function devmodeOn() {
  devmode = true
  mapOn()
}
function devmodeOff() {
  devmode = false
  mapOff()
}

function mapOn() {
  canvasMap.style.display = null
  canvasMini.style.display = null
}
function mapOff() {
  canvasMap.style.display = "none"
  canvasMini.style.display = "none"
}

let gameMuted = false
function muteToggle() { setGameMuted(!gameMuted) }
function setGameMuted(x) { gameMuted = x }
const mute = () => setGameMuted(true)
const unmute = () => setGameMuted(false)

let enableHeldButtons = true
function singleButtons() {
  enableHeldButtons = false
}

function listLevels() {
  for (const { name } of levelData) {
    console.log('  ', name)
  }
}

function debugActorState() {
  for (const a of actors) {
    console.log(a.serialize(), !a.dead);
  }
}

function viewOffset() {
  // hacky
  return new MapPos(4, 4)
}

function reserializeAllLevels() {
  for (const { name } of levelData) {
    assert(Import(name))
    SaveLevel(name)
  }
}

//
// misc
//

function downloadFile(name, contents, mime_type) {
  mime_type = mime_type || "text/plain";

  let blob = new Blob([contents], {type: mime_type});

  let dlink = document.createElement('a');
  dlink.download = name;
  dlink.href = window.URL.createObjectURL(blob);
  dlink.onclick = function(e) {
    // revokeObjectURL needs a delay to work properly
    let that = this;
    setTimeout(function() {
      window.URL.revokeObjectURL(that.href);
    }, 1500);
  };

  dlink.click();
  dlink.remove();
}

async function playSound(audioElement) {
  if (gameMuted) { return }
  if (!audioElement) { return }
  // console.log(audioElement.id);
  audioElement.pause()
  audioElement.currentTime = 0
  try {
    await audioElement.play()
  } catch (err) {
    // console.warn(`playSound(${audioElement.id}) failed`)
  }
}

function globalExists(cb) {
  // e.g. globalExists(() => tileData)
  try {
    cb()
    return true
  } catch (e) {
    if (e.name === "ReferenceError") {
      return false
    } else {
      throw e
    }
  }
}
