// Act II — the two retained methods, explained layer by layer with the
// project's Rhino-modelled exploded axonometrics (the original transparent
// exports, warm-toned). Every leader's y / endpoint below was MEASURED off
// the designer's labelled Figma export, then mapped onto this artwork via
// the two exports' solid-pixel bounding boxes (aspect ratios agree to ~0.1%,
// alignment verified by overlay), so the lines land exactly where the
// designer put them while the labels stay crisp, hoverable HTML text.
// Coordinates are % of the image canvas (artwork + transparent left gutter
// for the labels), which the diagram wrapper reproduces exactly.

import landfillImg from '../../assets/actions/diagram-landfill.webp'
import thermalImg from '../../assets/actions/diagram-thermal.webp'
import landfillPhoto from '../../assets/actions/photo-landfill.webp'
import thermalPhoto from '../../assets/actions/photo-thermal.webp'

export interface MethodLayer {
  text: string
  /** Leader y, % of canvas height. */
  y: number
  /** Leader endpoint (dot centre), % of canvas width. */
  endX: number
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
  /** Where every leader line starts (labels right-align just left of it). */
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
      'Exploded axonometric of the passive landfill, top to bottom: grass, soil, geocomposite layer, plastic (LLDPE) geomembrane, clay, the contaminant, plastic geomembrane, geocomposite layer, plastic geomembrane, clay, and the compacted soil subgrade.',
    aspect: 1.1223,
    labelX: 33.5,
    layers: [
      { text: 'Grass cap', y: 13.76, endX: 51.94 },
      { text: 'Soil', y: 29.68, endX: 45.41 },
      { text: 'Geocomposite layer', y: 36.86, endX: 46.67 },
      { text: 'Plastic (LLDPE) geomembrane', y: 42.95, endX: 46.4 },
      { text: 'Clay', y: 50.6, endX: 55.26 },
      { text: 'Contaminant', y: 55.62, endX: 45.57 },
      { text: 'Plastic (LLDPE) geomembrane', y: 62.78, endX: 47.73 },
      { text: 'Geocomposite layer', y: 69.64, endX: 45.8 },
      { text: 'Plastic (LLDPE) geomembrane', y: 73.7, endX: 40.08 },
      { text: 'Clay', y: 80.1, endX: 42.15 },
      { text: 'Compacted soil subgrade', y: 87.44, endX: 50.15 },
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
    aspect: 1.1026,
    labelX: 33.5,
    layers: [
      { text: 'Sand', y: 15.56, endX: 50.83 },
      { text: 'Offgas collecting pipe', y: 22.49, endX: 50.95 },
      { text: 'Heater well', y: 29.72, endX: 47.93 },
      { text: 'Metal sheet', y: 35.3, endX: 46.89 },
      { text: 'Contaminant', y: 41.93, endX: 48.74 },
      { text: 'Metal sheet', y: 51.27, endX: 49.25 },
      { text: 'Sand', y: 56.55, endX: 48.61 },
      { text: 'Crushed stone', y: 63.47, endX: 48.62 },
      { text: 'Plastic liner', y: 68.9, endX: 41.81 },
      { text: 'Soil', y: 74.06, endX: 59.0 },
      { text: 'Brick pile', y: 81.41, endX: 42.75 },
    ],
  },
]
