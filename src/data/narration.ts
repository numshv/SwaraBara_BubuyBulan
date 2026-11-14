import type { SongId } from './regions'

export type ArtKind = 'horizon' | 'flames' | 'haze' | 'rain' | 'sun' | 'peat' | 'savannah' | 'embers'

export interface Cue {
  /** Month index (0 = January 2018) at which this chapter starts. */
  frame: number
  title: string
  text: string
  art: ArtKind
  alt: string
}

const ALT: Record<ArtKind, string> = {
  horizon: 'Line drawing of a forest horizon under a low sun, with thin smoke rising.',
  flames: 'Line drawing of flames spreading through a row of trees.',
  haze: 'Line drawing of a city skyline fading into thick grey haze.',
  rain: 'Line drawing of rain falling over a calm, green forest.',
  sun: 'Line drawing of a large, harsh sun over cracked, dry ground.',
  peat: 'Cross-section drawing of peat soil with fire smouldering underground.',
  savannah: 'Line drawing of open grassland with scattered small fires.',
  embers: 'Line drawing of fading embers glowing on dark ground.',
}

function cue(frame: number, title: string, text: string, art: ArtKind): Cue {
  return { frame, title, text, art, alt: ALT[art] }
}

export const CUES: Record<SongId, Cue[]> = {
  indonesia: [
    cue(0, 'Eight years of fire', 'Every glowing dot is a cluster of fire detections seen from orbit by the NOAA-20 satellite. Listen as eight years of Indonesian fire seasons rise and fall.', 'horizon'),
    cue(7, 'The 2018 dry season', 'As the rains stop in August, fires appear across the peatlands of Sumatra and Kalimantan, mostly set to clear land, then left to spread.', 'flames'),
    cue(19, 'The 2019 haze crisis', 'An El Niño year. Drained peat dries out and catches fire, and smoke blankets cities from Pekanbaru to Palangka Raya. Schools close and airports shut down.', 'haze'),
    cue(27, 'A quiet pause', 'From 2020 to 2022, La Niña brings wetter dry seasons. Fire counts fall sharply, helped by peat restoration and more firefighting patrols.', 'rain'),
    cue(66, 'El Niño returns', 'In 2023 the dry season comes back hard. South Sumatra, Kalimantan and southern Papua light up again, and the haze returns.', 'sun'),
    cue(79, 'Smouldering underground', 'In 2024 there are fewer fires, but peat fires can burn underground for months, unseen until the next drought.', 'peat'),
    cue(91, 'The 2025 season', 'Another moderate year. The pattern holds: whenever rain fails, the same drained landscapes burn first.', 'savannah'),
    cue(95, 'What the dots leave behind', 'Behind every dot are lungs filled with smoke and forest that will not grow back in our lifetime.', 'embers'),
  ],
  sumatra: [
    cue(0, 'Peat under pressure', 'Riau, Jambi and South Sumatra sit on deep peat, drained by canals for acacia and oil palm. Dry peat burns like fuel.', 'peat'),
    cue(19, 'Riau chokes', 'In September 2019, the air quality index in Pekanbaru goes far past hazardous. Thousands of people are treated for breathing problems.', 'haze'),
    cue(68, 'South Sumatra flares', 'In 2023 the peat of Ogan Komering Ilir burns again, sending haze across the Malacca Strait.', 'flames'),
  ],
  kalimantan: [
    cue(0, 'The peat heartland', 'Central Kalimantan still bears the scars of the failed Mega Rice Project: a million hectares of drained peat that burns year after year.', 'peat'),
    cue(19, 'Palangka Raya in orange', 'In 2019 the sky over Palangka Raya turns orange at noon. Kalimantan records more fire than any other island.', 'haze'),
    cue(67, 'Burning again', 'In 2023 West and Central Kalimantan flare once more, as El Niño dries the land.', 'sun'),
  ],
  java: [
    cue(0, 'Mountains and teak', 'On Java, fires mostly burn teak plantations, savannah on volcano slopes and farmland. They are small, but close to many people.', 'savannah'),
    cue(67, 'Volcano slopes alight', 'In 2023, grassland on Mount Bromo and Mount Arjuno burns for days, closing hiking trails.', 'flames'),
  ],
  sulawesi: [
    cue(0, 'Scattered flames', 'Sulawesi burns in small patches, mostly farmland cleared with fire before planting.', 'savannah'),
    cue(67, 'A dry 2023', 'In the El Niño year, fires in South and Southeast Sulawesi more than double.', 'sun'),
  ],
  bnt: [
    cue(0, 'Savannah islands', 'Sumba, Timor and Flores are dry savannah, burned on purpose almost every year to renew grazing land.', 'savannah'),
    cue(19, 'Long dry seasons', 'Here the dry season can last eight months, so fires start early and burn late.', 'sun'),
  ],
  maluku: [
    cue(0, 'The Spice Islands', 'Maluku sees few fires: small burns on Seram, Buru and Halmahera, mostly to clear land.', 'horizon'),
    cue(67, 'Small but rising', 'Even here, the 2023 drought brings more fire than usual.', 'embers'),
  ],
  papua: [
    cue(0, 'The southern lowlands', 'Around Merauke, swamp savannah burns late in the year, from September to November.', 'savannah'),
    cue(69, 'A new frontier', 'In 2023, fires spread where large plantations clear forest in the south, and Papua sees its biggest fire season in years.', 'flames'),
  ],
}

/** Index of the chapter active at playhead t. */
export function cueIndexAt(cues: Cue[], t: number): number {
  let idx = 0
  for (let i = 0; i < cues.length; i++) if (cues[i].frame <= Math.floor(t)) idx = i
  return idx
}

export const INTRO_TEXT =
  "Between 2018 and 2025, satellites recorded hundreds of thousands of fire detections across Indonesia. This piece turns them into a moving map you can watch and explore: each region has its own fire story, and a running count of the people and land it affected."
