/**
 * Image registry. Every photograph on the site is listed here with its alt text.
 * `temporary: true` marks stock images used only for the preview (see
 * src/assets/temp/CREDITS.md). They are replaced in Deliverable 8 with the
 * client's own work, served from the portfolio database.
 */
import type { StaticImageData } from "next/image";
import coupleNight from "@/assets/temp/couple-night.jpg";
import whiteDressDesert from "@/assets/temp/white-dress-desert.jpg";
import coupleBench from "@/assets/temp/couple-bench.jpg";
import callaLily from "@/assets/temp/calla-lily.jpg";
import daisy from "@/assets/temp/daisy.jpg";
import fieldWalk from "@/assets/temp/field-walk.jpg";
import lakeSunset from "@/assets/temp/lake-sunset.jpg";
import portraitClose from "@/assets/temp/portrait-close.jpg";
import portraitReading from "@/assets/temp/portrait-reading.jpg";
import familyCity from "@/assets/temp/family-city.jpg";
import familyStreet from "@/assets/temp/family-street.jpg";
import professionalSuit from "@/assets/temp/professional-suit.jpg";
import portraitSunlight from "@/assets/temp/portrait-sunlight.jpg";
import concertLights from "@/assets/temp/concert-lights.jpg";
import stageCrowd from "@/assets/temp/stage-crowd.jpg";
import fireworks from "@/assets/temp/fireworks.jpg";
import stringLights from "@/assets/temp/string-lights.jpg";
import stationHall from "@/assets/temp/station-hall.jpg";
import styledBakery from "@/assets/temp/styled-bakery.jpg";
import styledCake from "@/assets/temp/styled-cake.jpg";
import styledStationery from "@/assets/temp/styled-stationery.jpg";
import coffeeBar from "@/assets/temp/coffee-bar.jpg";
import minimalVase from "@/assets/temp/minimal-vase.jpg";
import whiteHeels from "@/assets/temp/white-heels.jpg";
import type { ServiceSlug } from "./services";

export type Photo = {
  id: string;
  src: StaticImageData;
  alt: string;
  category: ServiceSlug;
  temporary: boolean;
};

const t = (id: string, src: StaticImageData, alt: string, category: ServiceSlug): Photo => ({
  id, src, alt, category, temporary: true,
});

export const photos = {
  coupleNight: t("couple-night", coupleNight, "A couple embracing outdoors at night", "weddings"),
  whiteDressDesert: t("white-dress-desert", whiteDressDesert, "A woman in a white dress walking across the desert", "weddings"),
  coupleBench: t("couple-bench", coupleBench, "A couple sitting together on a bench by the sea", "weddings"),
  callaLily: t("calla-lily", callaLily, "A single white calla lily against a dark wall", "weddings"),
  daisy: t("daisy", daisy, "A white daisy seen from below against a pale sky", "weddings"),
  fieldWalk: t("field-walk", fieldWalk, "A woman walking through a sunlit field", "weddings"),
  lakeSunset: t("lake-sunset", lakeSunset, "A woman sitting by a lake at sunset", "portraits"),
  portraitClose: t("portrait-close", portraitClose, "Close portrait of a woman with curly hair", "portraits"),
  portraitReading: t("portrait-reading", portraitReading, "A woman reading in soft window light", "portraits"),
  familyCity: t("family-city", familyCity, "A mother holding her daughter on a city street", "portraits"),
  familyStreet: t("family-street", familyStreet, "A mother hugging her child on a cobbled street", "portraits"),
  professionalSuit: t("professional-suit", professionalSuit, "A man in a navy suit holding a cup", "portraits"),
  portraitSunlight: t("portrait-sunlight", portraitSunlight, "A woman in profile against a bright sky", "portraits"),
  concertLights: t("concert-lights", concertLights, "Stage lights over a concert crowd", "events"),
  stageCrowd: t("stage-crowd", stageCrowd, "A crowd facing a lit stage", "events"),
  fireworks: t("fireworks", fireworks, "Fireworks over a city at night", "events"),
  stringLights: t("string-lights", stringLights, "String lights over a street at dusk", "events"),
  stationHall: t("station-hall", stationHall, "A busy hall full of people", "events"),
  styledBakery: t("styled-bakery", styledBakery, "Biscuits, lemons and daffodils styled on a dark table", "products"),
  styledCake: t("styled-cake", styledCake, "A cake and ingredients styled on a dark wooden table", "products"),
  styledStationery: t("styled-stationery", styledStationery, "Tied bundles of letters, a pen and an ink pot", "products"),
  coffeeBar: t("coffee-bar", coffeeBar, "Pour-over coffee being brewed at a coffee bar", "products"),
  minimalVase: t("minimal-vase", minimalVase, "A small vase on a white table against a blue wall", "products"),
  whiteHeels: t("white-heels", whiteHeels, "White heels on a paint-spattered floor", "products"),
} satisfies Record<string, Photo>;

export const heroPhoto = photos.coupleNight;

export const servicePhotos: Record<ServiceSlug, { hero: Photo; panel: Photo; story: Photo[] }> = {
  weddings: {
    hero: photos.whiteDressDesert,
    panel: photos.coupleBench,
    story: [photos.callaLily, photos.coupleBench, photos.fieldWalk, photos.daisy, photos.coupleNight],
  },
  portraits: {
    hero: photos.portraitReading,
    panel: photos.portraitClose,
    story: [photos.portraitClose, photos.familyCity, photos.professionalSuit, photos.lakeSunset, photos.familyStreet],
  },
  events: {
    hero: photos.concertLights,
    panel: photos.concertLights,
    story: [photos.stageCrowd, photos.stringLights, photos.fireworks, photos.stationHall, photos.concertLights],
  },
  products: {
    hero: photos.styledCake,
    panel: photos.styledBakery,
    story: [photos.styledBakery, photos.coffeeBar, photos.minimalVase, photos.styledStationery, photos.whiteHeels],
  },
};

export const portfolioPhotos: Photo[] = Object.values(photos);
