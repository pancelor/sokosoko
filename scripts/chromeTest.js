function chromeTest() {
  try {
    eval(`
      class Foo {
        static member = 1
      }

      const re = /abc(?<name>\d+)def/
    `)
  } catch (err) {
    chromeWarning.style.display = null
  }
}

chromeTest()
