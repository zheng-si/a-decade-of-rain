// Act II — the two retained methods, explained layer by layer with the
// project's Rhino-modelled exploded axonometrics. The bare artwork is derived
// from the designer's labelled Figma export (white ground knocked out; baked
// text, leaders and paper grain removed at asset-build time), and every
// leader's y / endpoint below was MEASURED off that same export, so the lines
// land exactly where the designer put them while the labels stay crisp,
// hoverable HTML text. Coordinates are % of the artwork canvas, which the
// diagram wrapper reproduces exactly (same aspect ratio, image fills it).

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
    aspect: 1.1542,
    labelX: 33.7,
    layers: [
      { text: 'Grass', y: 13.8, endX: 53.2 },
      { text: 'Soil', y: 29.7, endX: 46.9 },
      { text: 'Geocomposite layer', y: 36.9, endX: 48.1 },
      { text: 'Plastic (LLDPE) geomembrane', y: 43.0, endX: 47.9 },
      { text: 'Clay', y: 50.6, endX: 56.5 },
      { text: 'Contaminant', y: 55.6, endX: 47.1 },
      { text: 'Plastic (LLDPE) geomembrane', y: 62.8, endX: 49.2 },
      { text: 'Geocomposite layer', y: 69.6, endX: 47.3 },
      { text: 'Plastic (LLDPE) geomembrane', y: 73.7, endX: 41.7 },
      { text: 'Clay', y: 80.0, endX: 43.7 },
      { text: 'Compacted soil subgrade', y: 87.4, endX: 51.5 },
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
      { text: 'Sand', y: 15.5, endX: 51.1 },
      { text: 'Offgas collecting pipe', y: 22.5, endX: 51.2 },
      { text: 'Heater well', y: 29.7, endX: 48.2 },
      { text: 'Metal sheet', y: 35.3, endX: 47.2 },
      { text: 'Contaminant', y: 41.9, endX: 49.0 },
      { text: 'Metal sheet', y: 51.3, endX: 49.5 },
      { text: 'Sand', y: 56.5, endX: 48.9 },
      { text: 'Crushed stone', y: 63.5, endX: 48.9 },
      { text: 'Plastic liner', y: 68.9, endX: 42.1 },
      { text: 'Soil', y: 74.1, endX: 59.2 },
      { text: 'Brick pile', y: 81.4, endX: 43.1 },
    ],
  },
]
