// No browser or new test dependency: compile the two isolated modules with
// the repository's TypeScript, then exercise the MapLibre boundary with a fake.
import assert from 'node:assert/strict'
import { test, after } from 'node:test'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const dir = mkdtempSync(join(tmpdir(), 'tuner-grid-test-'))
after(() => rmSync(dir, { recursive: true, force: true }))
for (const name of ['volumeGridData', 'mapTunerGrid']) {
  const source = readFileSync(new URL(`../src/components/${name}.ts`, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  })
  writeFileSync(join(dir, `${name}.mjs`), outputText.replaceAll("'./volumeGridData'", "'./volumeGridData.mjs'"))
}
const { setVolumeGridData, watchVolumeGridData, VOL_COARSE_SOURCE, VOL_FINE_SOURCE,
  VOL_COARSE_LAYER, VOL_FINE_LAYER } = await import(pathToFileURL(join(dir, 'volumeGridData.mjs')))
const { gridCellEdges, showTunerGrid } = await import(pathToFileURL(join(dir, 'mapTunerGrid.mjs')))
const points = (coords) => ({ type: 'FeatureCollection', features: coords.map((coordinates) => ({
  type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates },
})) })

class FakeMap {
  sources = new Map()
  layers = new Map()
  events = new Map()
  order = []
  constructor() {
    for (const [source, id, minzoom, maxzoom] of [
      [VOL_COARSE_SOURCE, VOL_COARSE_LAYER, 0, 7.5],
      [VOL_FINE_SOURCE, VOL_FINE_LAYER, 7.5, 9.5],
    ]) {
      this.addSource(source, {})
      this.getSource(source).calculateTileZoom = () => 7
      this.addLayer({ id, minzoom, maxzoom, layout: {} })
    }
  }
  getSource(id) { return this.sources.get(id) }
  addSource(id, options) {
    assert(!this.sources.has(id))
    this.sources.set(id, { ...options, setData(data) { this.data = data } })
  }
  removeSource(id) { this.sources.delete(id) }
  getLayer(id) { return this.layers.get(id) }
  addLayer(layer, before) {
    assert(!this.layers.has(layer.id))
    this.layers.set(layer.id, structuredClone(layer))
    if (before) this.order.splice(this.order.indexOf(before), 0, layer.id)
    else this.order.push(layer.id)
  }
  removeLayer(id) { this.layers.delete(id); this.order = this.order.filter((x) => x !== id) }
  getLayoutProperty(id, key) { return this.getLayer(id).layout[key] }
  setLayoutProperty(id, key, value) { this.getLayer(id).layout[key] = value; this.emit('styledata') }
  setLayerZoomRange(id, minzoom, maxzoom) {
    Object.assign(this.getLayer(id), { minzoom, maxzoom }); this.emit('styledata')
  }
  on(event, fn) {
    if (!this.events.has(event)) this.events.set(event, new Set())
    this.events.get(event).add(fn)
  }
  off(event, fn) { this.events.get(event)?.delete(fn) }
  emit(event) { for (const fn of this.events.get(event) ?? []) fn() }
  active(id, zoom) {
    const layer = this.getLayer(id)
    return this.getLayoutProperty(id, 'visibility') !== 'none' &&
      zoom >= (layer.minzoom ?? 0) && zoom < (layer.maxzoom ?? 24)
  }
}

test('occupied cells have exact bounds; selection duplicates and shared edges do not darken', () => {
  const data = points([[0.06, 0.06], [0.06, 0.06], [0.18, 0.06]])
  const edges = gridCellEdges({ data, cellDeg: 0.12 }).features
  assert.equal(edges.length, 7)
  assert.deepEqual(edges[0].geometry.coordinates, [[0, 0], [0.12, 0]])
  assert.equal(gridCellEdges({ data: points([]), cellDeg: 0.03 }).features.length, 0)
  const negative = gridCellEdges({ data: points([[-0.015, -0.015]]), cellDeg: 0.03 })
  assert.deepEqual(negative.features[0].geometry.coordinates, [[-0.03, -0.03], [0, -0.03]])
})

test('snapshot publishes the same data and the size used, including updates before subscription', () => {
  const map = new FakeMap()
  const data = points([[106.02, 16.02]])
  setVolumeGridData(map, VOL_COARSE_SOURCE, data, 0.12)
  assert.equal(map.sources.size, 2) // No debug sources on the shipping path.
  const received = []
  const stop = watchVolumeGridData(map, (source, grid) => received.push([source, grid]))
  assert.equal(received[0][1].data, map.getSource(VOL_COARSE_SOURCE).data)
  assert.equal(received[0][1].cellDeg, 0.12)
  stop()
  setVolumeGridData(map, VOL_FINE_SOURCE, points([]), 0.03)
  assert.equal(received.length, 1)
})

test('guide follows live hand-offs/visibility, updates re-binned cells, and cleans up on repeated toggles', () => {
  const map = new FakeMap()
  setVolumeGridData(map, VOL_COARSE_SOURCE, points([[0.06, 0.06]]), 0.12)
  setVolumeGridData(map, VOL_FINE_SOURCE, points([[0.015, 0.015]]), 0.03)
  const stop = showTunerGrid(map)
  assert.equal(map.getSource('tuner-grid-coarse').data.features.length, 4)
  assert(map.order.indexOf('tuner-grid-fine') < map.order.indexOf(VOL_COARSE_LAYER))
  assert.equal(map.getSource('tuner-grid-fine').calculateTileZoom, map.getSource(VOL_FINE_SOURCE).calculateTileZoom)
  for (const z of [7.499, 7.5, 9.499, 9.5, 11]) {
    assert.equal(map.active('tuner-grid-coarse', z), map.active(VOL_COARSE_LAYER, z))
    assert.equal(map.active('tuner-grid-fine', z), map.active(VOL_FINE_LAYER, z))
  }
  map.setLayerZoomRange(VOL_COARSE_LAYER, 0, 6.5)
  map.setLayerZoomRange(VOL_FINE_LAYER, 6.5, 6.5) // hand-off below Z_MID
  assert(!map.active('tuner-grid-fine', 6.5))
  assert(!map.active('tuner-grid-coarse', 6.5))
  map.setLayoutProperty(VOL_COARSE_LAYER, 'visibility', 'none')
  assert(!map.active('tuner-grid-coarse', 6))
  map.setLayoutProperty(VOL_COARSE_LAYER, 'visibility', 'visible')
  assert(map.active('tuner-grid-coarse', 6))
  setVolumeGridData(map, VOL_COARSE_SOURCE, points([[0.1, 0.1]]), 0.2)
  assert.deepEqual(map.getSource('tuner-grid-coarse').data.features[0].geometry.coordinates, [[0, 0], [0.2, 0]])
  setVolumeGridData(map, VOL_FINE_SOURCE, points([]), 0.01)
  assert.equal(map.getSource('tuner-grid-fine').data.features.length, 0)
  stop()
  assert.equal(map.layers.size, 2)
  assert.equal(map.sources.size, 2)
  assert.equal(map.events.get('styledata').size, 0)
  showTunerGrid(map)()
  assert.equal(map.layers.size, 2)
})

test('parent map removal before tuner effect cleanup is safe', () => {
  const map = new FakeMap()
  const stop = showTunerGrid(map)
  map.layers.clear()
  map.sources.clear()
  map.emit('remove')
  stop()
  assert.equal(map.events.get('remove').size, 0)
})
