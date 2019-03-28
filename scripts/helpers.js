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

function pcoord(x, y) {
  return new Pos({x, y})
}

function posDir(p, dir, len=1) {
  const dx = [1,0,-1,0][dir]
  const dy = [0,-1,0,1][dir]
  const delta = pcoord(len*dx, len*dy)
  return p.add(delta)
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
  if (x.serialize && x.serialize.constructor === Function) {
    return x.serialize()
  } else {
    return `${x}`
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
function recordingToggle() {
  // returns the new state of the recording
  const wasOn = !!keyHist
  if (wasOn) {
    recordingStop()
    return false
  } else {
    recordingStart()
    return true
  }
}
function recordingStart() {
  console.log("Recording moves...")
  keyHist = []
}
function recordingStop() {
  console.log("Recorded moves:");
  console.log(keyHist.join(''))
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
  original: {
    win: "00103333000000302110323000033222211012222223211111211100332321130011223303333003300100000030001123032220332211012222223211111121110033232113033332233302110033311111111121221000111222",
  },
  wack: {
    win: "0103333000000030211033230033001111233311103333222211012222222121111130011223333332223330010331113211111111221000111111222122222222111111101111112222122222222111111101111112221222003442222211211111101133233333330000000030332211012222222211111110111111221103333332230000000333",
    bonus: "01033330000000302110323304003301011112333333230000022221111110330032244444444444444444444444444433144111033322222004444444555551101222222212111113311210333333033211111113001120332233333223030010331112111111214210002333010011112111222322110323010333333231300000004444444400300445550000030330011222212230000022221111110330332221110233300113222211122222221111111101111112222221222222111211211111110111111222221122232222211211211111110111111222122212222222112111111101111112211033333303333323333330300000003033221101222222212111111011111222300000004400333032321",
  },
  dolphin: {
    // win: "21111100011222221000000022112233030012111211233333333333333221113330011111111111111310330330332223333300000222211121111000112112112333333000222330121002211111103333333333333322111122220000333300111111111111111003332330332223333000000000033330011111111111111110",
    // bonus: "211110001122110033300000010333311122223032220112223130333311000100100100203222222112223000000022222300332223331110001121121122333333333333332211133300111111111111111030330333003322233330000022221121111000112201121123333333100022233020121002211111103333333333333322111122220003303334444444442000333300111111111111111003332213001112233333333333333221111222002220000333330011111111111111003332221030333033222333330000000000333300111111111111111210",
    // doesn't work anymore!!!:
    // cheese: "21111100011222221000000022112233030012111211233333333333333221113330011111111111111033033303322233330000022222111100011211211223333333100000222111111033333333333333322111112222222022000033300000300111131111111111144444444441111111111111231033444444444444444444444444444444444440003333001111111111111110033323313033222333300000000",
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
const win = (dt=1) => playSolution("win", dt)
const bonus = (dt=1) => playSolution("bonus", dt)
const cheese = (dt=50) => playSolution("cheese", dt)

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
