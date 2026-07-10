// Act II — the two retained methods, explained layer by layer with the
// project's Rhino-modelled exploded axonometrics (rendered white, styled in
// Illustrator). Label text and vertical anchors follow the Figma design.

import landfillImg from '../../assets/actions/method-landfill.webp'
import thermalImg from '../../assets/actions/method-thermal.webp'
import landfillPhoto from '../../assets/actions/photo-landfill.webp'
import thermalPhoto from '../../assets/actions/photo-thermal.webp'

export interface MethodLayer {
  text: string
  /** Vertical anchor, % of diagram height. */
  y: number
  /** Where the leader line ends, % of figure width (into the image). */
  endX?: number
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
    imgAlt: 'Exploded axonometric of the passive landfill: contaminated soil sealed between layers of clay, plastic geomembrane and geocomposite, under a grass cap',
    layers: [
      { text: 'Grass cap', y: 19, endX: 50 },
      { text: 'Soil', y: 29, endX: 49 },
      { text: 'Geocomposite layer', y: 35, endX: 50 },
      { text: 'Plastic (LLDPE) geomembrane', y: 41, endX: 50 },
      { text: 'Clay', y: 47, endX: 51 },
      { text: 'Contaminant', y: 53, endX: 60 },
      { text: 'Plastic (LLDPE) geomembrane', y: 60, endX: 50 },
      { text: 'Geocomposite layer', y: 65, endX: 51 },
      { text: 'Plastic (LLDPE) geomembrane', y: 71, endX: 50 },
      { text: 'Clay', y: 77, endX: 51 },
      { text: 'Compacted soil subgrade', y: 84, endX: 50 },
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
    imgAlt: 'Exploded axonometric of the thermal treatment pile: contaminated soil between metal sheets and heater wells, over crushed stone, a plastic liner and a brick pile base',
    layers: [
      { text: 'Sand', y: 17, endX: 52 },
      { text: 'Offgas collecting pipe', y: 23, endX: 57 },
      { text: 'Heater well', y: 29, endX: 60 },
      { text: 'Metal sheet', y: 34, endX: 51 },
      { text: 'Contaminant', y: 42, endX: 59 },
      { text: 'Metal sheet', y: 50, endX: 51 },
      { text: 'Sand', y: 56, endX: 51 },
      { text: 'Crushed stone', y: 61, endX: 50 },
      { text: 'Plastic liner', y: 68, endX: 53 },
      { text: 'Soil', y: 75, endX: 58 },
      { text: 'Brick pile', y: 82, endX: 47 },
    ],
  },
]
