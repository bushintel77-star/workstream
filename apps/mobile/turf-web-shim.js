function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function polygon(coordinates) {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: coordinates },
  };
}

function featureCollection(features) {
  return {
    type: "FeatureCollection",
    features: features,
  };
}

function area(feature) {
  const coordinates = feature && feature.geometry ? feature.geometry.coordinates : [];
  const rings = feature && feature.geometry && feature.geometry.type === "Polygon" ? coordinates : coordinates[0] || [];
  const ring = rings[0] || [];
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) / 2;
}

function difference(collection) {
  const first = collection && collection.features ? collection.features[0] : null;
  return first ? clone(first) : null;
}

function mask(feature) {
  return feature ? clone(feature) : null;
}

function buffer(feature) {
  return feature ? clone(feature) : null;
}

module.exports = {
  polygon: polygon,
  featureCollection: featureCollection,
  difference: difference,
  area: area,
  mask: mask,
  buffer: buffer,
};
