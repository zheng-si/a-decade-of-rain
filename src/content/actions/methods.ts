// Act II — the two retained methods, explained layer by layer with the
// project's Rhino-modelled exploded axonometrics. The full labelled figure
// (diagram + leader lines + labels) is the designer's own artwork, exported
// straight from Figma, so the leaders are pixel-accurate by construction.

import landfillFig from '../../assets/actions/figure-landfill.webp'
import thermalFig from '../../assets/actions/figure-thermal.webp'
import landfillPhoto from '../../assets/actions/photo-landfill.webp'
import thermalPhoto from '../../assets/actions/photo-thermal.webp'

export interface Method {
  key: 'landfill' | 'thermal'
  title: string
  /** One-line teaser on the resting photo panel. */
  tagline: string
  body: string
  caption: string
  /** The full labelled exploded figure (diagram + leaders + labels). */
  figure: string
  /** Real-site photograph for the resting panel. */
  photo: string
  figureAlt: string
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
    figure: landfillFig,
    photo: landfillPhoto,
    figureAlt:
      'Exploded axonometric of the passive landfill, top to bottom: grass cap, soil, geocomposite layer, plastic (LLDPE) geomembrane, clay, the contaminant, plastic geomembrane, geocomposite layer, plastic geomembrane, clay, and the compacted soil subgrade.',
  },
  {
    key: 'thermal',
    title: 'Ex-situ Thermal Treatment',
    tagline: 'Cook the dioxin out of the soil at roughly 335 °C.',
    body: 'Thermal treatment destroys the dioxin instead of storing it, and it is far more involved. An enclosed pile is built above ground; the contaminated soil is excavated and loaded in; heater wells cook it to roughly 335 °C while the offgas is collected and cleaned. Used at Đà Nẵng, the full cycle of building, loading, heating and unloading ran about four years.',
    caption: 'Ex-situ thermal treatment pile, layered structure',
    figure: thermalFig,
    photo: thermalPhoto,
    figureAlt:
      'Exploded axonometric of the thermal treatment pile, top to bottom: sand, offgas collecting pipe, heater well, metal sheet, the contaminant, metal sheet, sand, crushed stone, plastic liner, soil, and the brick pile base.',
  },
]
