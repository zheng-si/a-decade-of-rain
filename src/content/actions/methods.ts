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
    aspect: 1.0192,
    labelX: 25.6,
    layers: [
      { text: 'Grass cap', y: 13.86 },
      { text: 'Soil', y: 29.75 },
      { text: 'Geocomposite layer', y: 36.92 },
      { text: 'Plastic (LLDPE) geomembrane', y: 42.99 },
      { text: 'Clay', y: 50.62 },
      { text: 'Contaminant', y: 55.61 },
      { text: 'Plastic (LLDPE) geomembrane', y: 62.77 },
      { text: 'Geocomposite layer', y: 69.63 },
      { text: 'Plastic (LLDPE) geomembrane', y: 73.68 },
      { text: 'Clay', y: 80.06 },
      { text: 'Compacted soil subgrade', y: 87.38 },
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
    aspect: 1.0187,
    labelX: 25.7,
    layers: [
      { text: 'Sand', y: 15.48 },
      { text: 'Offgas collecting pipe', y: 22.65 },
      { text: 'Heater well', y: 30.13 },
      { text: 'Metal sheet', y: 35.9 },
      { text: 'Contaminant', y: 42.75 },
      { text: 'Metal sheet', y: 52.42 },
      { text: 'Sand', y: 57.87 },
      { text: 'Crushed stone', y: 65.04 },
      { text: 'Plastic liner', y: 70.65 },
      { text: 'Soil', y: 75.95 },
      { text: 'Brick pile', y: 83.58 },
    ],
  },
]
