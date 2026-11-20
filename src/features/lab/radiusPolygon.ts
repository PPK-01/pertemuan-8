export type RadiusPolygon = {
  type: 'Feature';
  properties: { radiusM: number };
  geometry: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
};

const EARTH_RADIUS_M = 6371000;
const DEFAULT_STEPS = 64;

/**
 * Membuat polygon lingkaran radius dalam meter agar skala peta tetap benar pada semua zoom.
 * Titik dikembalikan dalam urutan [longitude, latitude] sesuai GeoJSON.
 */
export function buildRadiusPolygon(
  lat: number,
  lng: number,
  radiusM: number,
  steps = DEFAULT_STEPS,
): RadiusPolygon {
  const angularDistance = radiusM / EARTH_RADIUS_M;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const ring: [number, number][] = [];

  for (let index = 0; index <= steps; index += 1) {
    const bearing = (index / steps) * 2 * Math.PI;
    const pointLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
        Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const pointLng =
      lngRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
        Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(pointLat),
      );

    ring.push([(pointLng * 180) / Math.PI, (pointLat * 180) / Math.PI]);
  }

  return {
    type: 'Feature',
    properties: { radiusM },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}
