//
// testing; used later in this file so it needs to be first
//

const allTests = []
function RegisterTest(name, test) {
  allTests.push({name, test})
}
function RunTests() {
  for (const {name, test} of allTests) {
    console.log(`Testing '${name}'`);
    test()
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
  orig: {
    win: "00103333000000302110323000033222211012222223211111211100332321130011223303333003300100000030001123032220332211012222223211111121110033232113033332233302110033311111111121221000111222",
  },
  wack: {
    win: "0103333000000030211033230033001111233311103333222211012222222121111130011223333332223330010331113211111111221000111111222122222222111111101111112222122222222111111101111112221222003442222211211111101133233333330000000030332211012222222211111110111111221103333332230000000333",
    bonus: "01033330000000302110323304003301011112333333230000022221111110330032244444444444444444444444444433144111033322222004444444555551101222222212111113311210333333033211111113001120332233333223030010331112111111214210002333010011112111222322110323010333333231300000004444444400300445550000030330011222212230000022221111110330332221110233300113222211122222221111111101111112222221222222111211211111110111111222221122232222211211211111110111111222122212222222112111111101111112211033333303333323333330300000003033221101222222212111111011111222300000004400333032321",
  },
  kill: {
    win: "3330001112330000330332223332213001001001000001212303222001122233033332110010333112233233221111011222222110333222111110000222233333030011123300000332300223301210111222221103300000333332221122200033000111122212222211033232221111100000000330001111122222211112",
    cheese: "21123311230300000332232332213001000111100001212303222001122233033332100103331122233221110111222220000033233301111330012344444111144444442104444444103000003000003322323322112220003000300113301144441023023444444444444444444444444444444444444300003330332330444444403323332214444444444444444330000033233322113300100440410430411033000003223223332211222000033000110002244444444444444444444444444444444444444444444444444444444444112222211121110002220002220000222223300333000003232303300000332233322112200330011332211222003300113221122200033300011113304444444444444444444444444444444444444444444444444444444444444444403300000332233322000142221120330011233221122200333001111104444444444444444444444444444444444444444444444444444444443000003323301002233011421011122222110330000033333222112220003300011111122222114444444444444444444444444444444444444444444444444444444444444444444444444444330300000332230001233000003223323330121002111222221103330000033333222112220003300113322331122222220000300000003001101000003300221122222322232211222223333444444444444444444444444444444444444444444444444444444444444444003300111003323222112222000333033001133221122222331111222212113",
    // cheese2: "033222222332211222222000033001103111121222213000030033233011113444444403300003003323301113332224211222233000444444444444444223221212222122221100322001122300300033033023000000330011000003011122122111211000000222223300003330332222223322112222200000330010110003000001112222211000000033001010001110000330000330300000330001011",
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

function mapOn() { canvas.style.display = null }
function mapOff() { canvas.style.display = "none" }

let gameMuted = false
function muteToggle() { setGameMuted(!gameMuted) }
function setGameMuted(x) { gameMuted = x }
const mute = () => setGameMuted(true)
const unmute = () => setGameMuted(false)

let enableHeldButtons = true
function singleButtons() {
  enableHeldButtons = false
}

// TODO: instead of
//    levelData['fooName'] = {...}
// use
//    levelData.push({ name: "fooName", ...})
// to avoid bugs where i forget to change the name (add asserts)
// then change this function to work again
// Also, "level" is already taken; maybe rename the old word "level" to "layer"?
function listLevels() {
  for (const name of Object.keys(levelData)) {
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
