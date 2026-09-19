const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const vm = require('node:vm')
const { spawn } = require('node:child_process')
const Model = require('../Model.js')
const limit = Model.responseByteLimit()
const empty = '{"type":"FeatureCollection","features":[]}'

// Verify the byte guard runs before JSON.parse, including multibyte UTF-8.
const context = vm.createContext({ JSON: { parse() { throw Error('parser reached') } } })
vm.runInContext(fs.readFileSync(require.resolve('../Model.js'), 'utf8'), context)
for (const character of ['a', 'é', '€', '😀']) {
  const raw = character.repeat(Math.floor(limit / Buffer.byteLength(character)) + 1)
  assert.equal(Model.responseTooLarge(raw), true)
  assert.match(context.parseCollection(raw).error, /size limit/)
  assert.equal(context.parseZoneDocument(raw).length, 0)
}
assert.equal(Model.responseTooLarge('a'.repeat(limit)), false)
assert.equal(Model.parseCollection(empty + ' '.repeat(limit - empty.length)).error, '')
assert.ok(Model.parseCollection(empty.slice(0, -1)).error)

// Run the actual command arrays from both QML paths against a local HTTP server.
const source = fs.readFileSync(require.resolve('../Panel.qml'), 'utf8')
const commands = [...source.matchAll(/(?:fetchProc|zoneProc)\.command = (\[[\s\S]*?\n    \])/g)]
assert.equal(commands.length, 2)
const server = http.createServer((req, res) => {
  const body = empty + ' '.repeat(limit + 1 - empty.length)
  if (req.url === '/small') return res.end(empty)
  if (req.url === '/boundary') return res.end(body.slice(0, limit))
  if (req.url === '/length') res.setHeader('Content-Length', Buffer.byteLength(body))
  if (req.url === '/truncated') {
    res.setHeader('Content-Length', empty.length + 100)
    res.setHeader('Connection', 'close')
    return res.end(empty)
  }
  if (req.url === '/close') {
    res.useChunkedEncodingByDefault = false
    res.setHeader('Connection', 'close')
  }
  res.write(body.slice(0, 100))
  res.end(body.slice(100))
})
function run(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), {
      env: { ...process.env, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1' },
    })
    let bytes = 0
    child.stdout.on('data', data => { bytes += data.length })
    child.stderr.resume()
    child.on('error', reject)
    child.on('close', code => resolve({ code, bytes }))
  })
}
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    for (const [, expression] of commands) {
      for (const route of ['small', 'boundary', 'length', 'chunked', 'close', 'truncated']) {
        const url = `http://127.0.0.1:${server.address().port}/${route}`
        const command = vm.runInNewContext(expression, {
          Model: { ...Model, alertsUrl: () => url }, root: { location: {} }, url,
        })
        const result = await run(command)
        assert.equal(result.code, ['small', 'boundary'].includes(route) ? 0 : route === 'truncated' ? 18 : 63, route)
        assert.ok(result.bytes <= limit, `${route}: collected ${result.bytes} bytes`)
      }
    }
    console.log('response byte limits and real curl transfers: ok')
  } finally { server.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
