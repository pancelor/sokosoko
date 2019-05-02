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
  throw new Error(`expected an error (${msgMatch}); got none`)
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
    if (i < max) {
      return true
    } else {
      throw new Error("loop sentinel triggered!")
    }
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
  recordingStop()
  recordingStart()
}
function recordingStart() {
  console.log("Recording moves...")
  // recordingOutput.innerText = ""
  keyHist = []
}
function recordingStop() {
  assert(keyHist !== null)
  const str = keyHist.join('')
  recordingOutput.innerText = `Recorded Moves: ${str}`
  if (!devmode) return

  console.log("Recorded moves:");
  console.log(str)
  const reduced = reduceWinstr(str)
  if (str !== reduced) {
    console.log("(reduced):");
    console.log(reduced)
  }
}
function RecordKeyHist(dir) {
  if (!keyHist) return
  keyHist.push(dir)
}

function play(moves, dt=50) {
  reset()
  play_(moves, dt)
}

function play_(moves, dt=50) {
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
  two: {
    win: "010000000000003322222200000011222222222222212111101112111111111331100111211100033033303323233332222222222222",
    bonus: "100000000000003322222200000003322211111121212111101112111111333333033323331101112111111111011121110030000003322211111012232132211000022211110111211111111133110111211100033033303323323333222222222222",
  },
  original: {
    win: "00103333000000302110323000033222211012222223211111211100332321130011223303333003300100000030001123032220332211012222223211111121110033232113033332233302110033311111111121221000111222",
  },
  tunnels: {
    // win: "103330330000300011112222332221121111230022221033033000030001111101112211033311211003110033222332222222", // my old solution
    win: "103330030003000111122223322111211211033311121123221033030000300011112223223232222222", // ethan's no-push solution
    // even with ethan's solution, you still need to push black to get the bonus: 103330030003000111122223322211330001100003333222122221211222303300011000033332221222113303210003000111122223322211211033311121123221033003000300011112222332222223330003000111
    bonus: "1033300300030001111222332332221133000110000333322212222121122230330001100000333233332221223221113300030001111222200022233222112111123002222103300300300300011111011121103331121110032223322222233300030001111101112113000333230000222111222303323332333332221223211133000300011111101112110333112111032233233222222",
  },
  oldstomach: {
    win: "21221122233332330003330211003330033333323001033333311111222100033330001122221221101123002111000330033333330033330003332211",
  },
  butterfly: {
    win: "3333233233333333333322222322222333322230032321210000000001230100322332121003011111111103201112332230301121000000002222222230001001233232330010123203212103011111111111333123000000100003311100000011111111111210023322222222233333222000111110000000000301100010011210",
  },
  balloon: {
    win: "33301112222222330121000003012100000011030322222200333001000000112303232111133133210000223222223221112221100033221103333333333303320112333333333322",
    bonus: "33301112222222330012100000301210000001103032222220333033300100030001112303232111121110032123230303332100002232222232211122212230010333333333303320112333333333323000132221000010303222222",
  },
  flare: {
    win: "003333303323301222212333332330333333333301111121111112111221111112111110330003322332333131110110011222233311100003322332322103011221111111321111100333333333331111121111101103333332111110111222233303001111121111111110010030000000000000111100300100000000000030111100300100000000003",
    // bonus: "0033333033233301222212333333033233333333330111011011111112111130122222322122220000300100000111113333333111112111123333330011211111121111003300033322310011222112233330333333033012321121111112111103333333333111112222232212221011112222000033332331002230003001000001211111123303300332332330322222200001223003001121033322122210001100112221103333330011001122211122223300000003011110010034444444444444400010000030111100010003000000000103",
  },
  dolphin: {
    win: "222111100011211011233330333333333322111333001111111111211110332332112230000022230033222333300000000333333330000222211111111222222221111000112110112333303000222330121002212111101003311223333303333333333221111222000222200003333001111111111211111003332223303322233330000000033333333000000000333300111111111121111110",
    bonus: "22221111000112211103330000222211330000010333111222230322201122333331110001100032222211222300000022223011011233330333333333332211133303001111111110002223301210022121111101003332223303322233333000000003333333300000222112111111112222222211110001121100110111223333333033333333332211112220003333001111111111211111003332213001112233333033333333332211112222000033330011111110112112111103303332221333033222333330000000330333333330000000003333001111111111211111210",
  },

  wack: {
    win: "00103330303000003021103230033001111233311103333222211022012222221211121110003322321033330332111112121100033233332332333001033311111121111321211023301210011111122212222222111112110111111222221222222211111121101111112222122200033303322110122222211321111121101111112211033333322300000003332",
    bonus: "0010333000030000030211003230033001111233311103333222211022201222222121112111003323210333303321222330211001111212110003323333333311111112121102330121001113332330333330002221111101111121112223221103323010303220322101010000001033330300000003033001122221223000000222211111103133334033222111023330011322112212222212121112111011111122221222222211111211011111121222212222222121110111121101111112222122222221111112111011111120333333323330333300000003033221101222222321113333111111444444444444444211111211011111121121103333332230000000333032321",
  },
  door: {
    win: "0113322111111111111121122223311222233323322223333330333322222113110033112233303323310000000003122222222210110000000011101100001111111113332111100000002223303330332111111220033333333333333001133221111111111111122122222223323332222333333033332222332300000000032110112333322332233002111331301222222222101121110033112233300000000011101100001111112111100030303333333333211001100010032222222220033330111111133333333313300113322111111111111121122223311222233233322223333330333322223323000000000322222221122222",
    bonus: "011332211111111111112112222331122223332332222333333033332222211311003311223330332331000000000312222222221011000000001110110000111111111333211110000000222330333033211111122003333333333333300113322111111111111112212222222332333222233333303333222233230000000003211011233332233223300211133130122222222210112111003311223330000000001110110000111111211110003030333333333321100110001003222222220000001003222223322330333001133221111111111111212122231222233233322223333333311033332222332300000000032222433221100022233330021200122222222210112111003311223330000000001110110000111111132111100000230112110333333330332333333330011332211111111011211121212222222333233222233333303333222220332300000000032222222123303321111012222",
  },
  bellyache: {
    win: "12222330033033102110033300333333230010333333111112221000333300012122333300000211100033003333333003333000333221100001111122111112",
    bonus: "122223300033302110033323300000333300333333233011111110122033333330033330001122221220211001000112111012223210122003310033330332223223233011300000330322211112211111112211122333300000211100033003333333003333000333221100001111122111110003333033223333331111110011211112223333300333330000103222221111122111133330033333000001001121111222",
  },

  //
  // close to done:
  //

  porpoise: {
    win: "12122114444444444442111122330332114444444403123303321113003333312233303332232110111121111121021111011000332332211121111011113121111011100332332112111100330332011230321111211103321101123323333023033033303320112111223333030011230321233122211",
  },
  sadclown: {
    "win": "122223233011210000021100332300221211211011112",
    // clownparty cheese on `gc 8135998`:
    // "cheese": "122232212321000000030001122323002110112130332332122012111011010000222002223233233303001003332333032222123300010012111011111122",
  },
  clownparty: {
    win: "122222033221101323210010300011211011221103323303322222330013221030121000002110001122330332300211121121111122",
    bonus: "1222233111212331003332212030011000112110112211000000103323303322223323303322222330013221030121000002110001122330332222221123003000002300211121133221101111001011222122222122211011112221222212301033323000300003333033030000300003323223331110010311122212222212221102330000300030000332322333323303322223221000000030113221100222110002330301132211211133303300300003000332322",
    cheese: "12112110112100000101122212222241231003332300003000332322233033003233001112",

    // ehhhh this is only sorta cheese... you still end up looping.
    // the issue is you might not notice; this might be the first solution you try and you'll learn nothing
    // could prevent it by blocking up near top of orange (so you can't push blocks back in place) but that ruins the really really good bonus...
    // cheese: "12121113330322321222032031100331121322100300122321000300121110132333032222332333032223322121033012100000030001121121203033232300211011212211111122",
  },
  roots: {
    win: "22223323323330333300010033001000111121100332333011113333333300010033001000111111111110010033001000333331113330121100111023332233000022221113001100001111122221112222",
  },

  //
  // rejected / testing / etc:
  //

  dollop: {
    win: "0333233011112100233311111030333332333333330000001000003330012100031301300122222202103323000100300112330332111103201112330332221030011230322222223211210301113440011223333230004110033222213300101233210112123003221231122223222222111111110111112223330103303321111121001100332222321100112233330110333122210430033211210003300121100112233333011322200201301223333033211111322211001033323000000102301033033211111121001100332222203333222222111223333323333333001100001000001033332",
    // is this even cheese? yes, b/c no unpacking in black... it's not a great level tho
    cheese: "0333333332333333330000001000000333012100043001322122103332300043001222224241233033113321111230000220221101233300003012100222322301114210000300122222210323103230000000112330332111103201112330332221030011230322222224444412223223012100010032222232200011332212101023301444441032230301210010032222123033221030110011223333231003321210011003322223014011203324444443221111003223023301001123122330001003222230111232223444444444111244122030323214411222304444444441222230041000332101212323302103011121000000103303321144444444440103303321111112100110033222220333233222122223333323333333001100000100001033332",
  },
  froot: {
    win: "211033330003330112333300333333001000001121113303330003330012223333322222212232222031000100300000011332222224444444444444444444444441222333332222221223222322211111002300322231333303311121113330000022100010030000001111333322222212220322232221112033330332303330",
  },
  nest: {
    win: "1111122300111122223201223222100333321222223000330332210033322222230000332100",
  },
  tree: {
    win: "12233333333332333330010011000031222233221111011122122211011211002002223330332203300033233330033000033033332232331101122211212222222222222222220000000000000000000330000300111122221111111121101133233011111223332",
  },
  riptest2: {
    win: "00000103330003000112222200000333332221101121111211",
    bonus: "23300003001222222444444422100030001222222222244444444444444010003000122222212232222222222222222222",
  },
}
function playSolution(name, dt=10) {
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
  let redR = `011111000003322233300000`
  let redL = `222211100011222223333322`
  let brownU = `10${redR}${redR}${redR}${redR}112${redL}${redL}${redL}${redL}11111`
  let brownD = `33330${redR}${redR}${redR}${redR}332${redL}${redL}${redL}${redL}332`
  let sol = `1${brownU}${brownU}${brownU}${brownU}003${brownD}${brownD}${brownD}${brownD}001${brownU}${brownU}${brownU}${brownU}`
  console.log({length: sol.length});
  play(sol, dt)
}

function reduceWinstr(s) {
  const res = []
  const sent = getSafeSentinel()
  while (sent()) {
    const match = s.match(/^(.*)45(.*)$/)
    if (!match) break
    s = match[1] + match[2]
  }
  assert(s.indexOf('5') === -1, "invalid winstr (bad 5)")

  const sent2 = getSafeSentinel()
  while (sent2()) {
    const match = s.match(/^(.*)[0123]4(.*)$/)
    if (!match) break
    s = match[1] + match[2]
  }
  assert(s.indexOf('4') === -1, "invalid winstr (bad  4)")

  return s
}
RegisterTest("reduceWinstr", () => {
  assertEqual(reduceWinstr(""), "")
  assertEqual(reduceWinstr("012302"), "012302")
  assertEqual(reduceWinstr("14"), "")
  assertEqual(reduceWinstr("0142"), "02")
  assertEqual(reduceWinstr("0452"), "02")
  assertEqual(reduceWinstr("0444455552"), "02") // illegal winstr, but it's fine
  assertEqual(reduceWinstr("00000044445555240450"), "00000000") // illegal winstr, but it's fine
})

let devmode = false
function devmodeOn() {
  devmode = true
  mapOn()
}
function devmodeOff() {
  devmode = false
  mapOff()
}

let debugIds = false

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
    reserializeLevel(name)
  }
}

function reserializeLevel(name) {
  assert(Import(name))
  SaveLevel(name)
}

function getUniqueRoomFromNamePrefix(prefix) {
  prefix = prefix.toLowerCase()
  let res = null
  for (const r of rooms) {
    if (r.name.toLowerCase().startsWith(prefix)) {
      if (res) return null
      res = r
    }
  }
  return res
}

function swapColors(...cols) {
  assert(cols.length > 0)
  const rs = cols.map(c=>getUniqueRoomFromNamePrefix(c))
  if (rs.some(r=>r===null)) {
    console.log(`failed`)
    return
  }
  const temp = rs[0].name
  for (let i = 0; i < rs.length - 1; ++i) {
    rs[i].name = rs[i + 1].name
  }
  rs[rs.length-1].name = temp
  ResetTileCache()
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
