// Act II — the two retained methods, explained layer by layer with the
// project's Rhino-modelled exploded axonometrics. The image is the designer's
// own white-label export (transparent ground) with the leader LINES AND DOTS
// KEPT BAKED — endpoints are exact by construction and cannot drift — while
// the label text was erased at asset-build time and re-set as crisp,
// hoverable HTML at each leader's measured row. Coordinates are % of the
// image canvas, which the diagram wrapper reproduces exactly.

import landfillImg from '../../assets/actions/diagram-landfill.webp'
import thermalImg from '../../assets/actions/diagram-thermal.webp'
import landfillPhoto from '../../assets/actions/photo-landfill.webp'
import thermalPhoto from '../../assets/actions/photo-thermal.webp'

export interface MethodLayer {
  text: string
  /** Leader row, % of canvas height (measured off the baked line). */
  y: number
}

export interface Method {
  key: 'landfill' | 'thermal'
  title: string
  /** One-line teaser on the resting photo panel. */
  tagline: string
  body: string
  caption: string
  img: string
  /** Real-site photograph for the resting panel. */
  photo: string
  imgAlt: string
  /** Canvas aspect ratio (w/h) — the diagram wrapper reproduces it. */
  aspect: number
  /** Where the baked leader lines start; labels right-align just left of it. */
  labelX: number
  layers: MethodLayer[]
}

export const METHODS_HEAD = {
  eyebrow: 'Act II · The engineering',
  title: 'The Methods, Layer by Layer',
  dek: 'The two retained approaches are exercises in layering. One wraps the contaminated soil in engineered barriers; the other cooks it inside a sealed pile. Exploded, layer by layer, this is what each one is made of.',
}

export const METHODS: Method[] = [
  {
    key: 'landfill',
    title: 'Passive Landfill',
    tagline: 'Seal the contaminated soil away under engineered layers.',
    body: 'The landfill does not destroy anything; its only job is isolation. The contaminated soil is excavated and hauled into an engineered cell, then sealed between sandwiches of clay, plastic geomembrane and geocomposite drainage layers, above and below, so nothing infiltrates the groundwater and nothing escapes to the surface.',
    caption: 'Passive landfill, layered structure',
    img: landfillImg,
    photo: landfillPhoto,
    imgAlt:
      'Exploded axonometric of the passive landfill, top to bottom: grass cap, soil, geocomposite layer, plastic (LLDPE) geomembrane, clay, the contaminant, plastic geomembrane, geocomposite layer, plastic geomembrane, clay, and the compacted soil subgrade.',
    aspect: 1.1542,
    labelX: 33.7,
    layers: [
      { text: 'Grass cap', y: 13.84 },
      { text: 'Soil', y: 29.72 },
      { text: 'Geocomposite layer', y: 36.89 },
      { text: 'Plastic (LLDPE) geomembrane', y: 42.96 },
      { text: 'Clay', y: 50.6 },
      { text: 'Contaminant', y: 55.58 },
      { text: 'Plastic (LLDPE) geomembrane', y: 62.75 },
      { text: 'Geocomposite layer', y: 69.6 },
      { text: 'Plastic (LLDPE) geomembrane', y: 73.65 },
      { text: 'Clay', y: 80.04 },
      { text: 'Compacted soil subgrade', y: 87.36 },
    ],
  },
  {
    key: 'thermal',
    title: 'Ex-situ Thermal Treatment',
    tagline: 'Cook the dioxin out of the soil at roughly 335 °C.',
    body: 'Thermal treatment destroys the dioxin instead of storing it, and it is far more involved. An enclosed pile is built above ground; the contaminated soil is excavated and loaded in; heater wells cook it to roughly 335 °C while the offgas is collected and cleaned. Used at Đà Nẵng, the full cycle of building, loading, heating and unloading ran about four years.',
    caption: 'Ex-situ thermal treatment pile, layered structure',
    img: thermalImg,
    photo: thermalPhoto,
    imgAlt:
      'Exploded axonometric of the thermal treatment pile, top to bottom: sand, offgas collecting pipe, heater well, metal sheet, the contaminant, metal sheet, sand, crushed stone, plastic liner, soil, and the brick pile base.',
    aspect: 1.1101,
    labelX: 34.0,
    layers: [
      { text: 'Sand', y: 15.51 },
      { text: 'Offgas collecting pipe', y: 22.45 },
      { text: 'Heater well', y: 29.69 },
      { text: 'Metal sheet', y: 35.27 },
      { text: 'Contaminant', y: 41.91 },
      { text: 'Metal sheet', y: 51.26 },
      { text: 'Sand', y: 56.54 },
      { text: 'Crushed stone', y: 63.47 },
      { text: 'Plastic liner', y: 68.9 },
      { text: 'Soil', y: 74.03 },
      { text: 'Brick pile', y: 81.42 },
    ],
  },
]
