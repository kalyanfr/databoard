import * as THREE from "three";
import topoData from "./countries-110m.json";

/**
 * Converts geographic latitude and longitude into 3D Cartesian coordinates on a sphere.
 */
export function latLngToVector(lat, lng, radius) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/**
 * Computes rotation angles (x, y) for the globe to center on a specific lat/lng.
 */
export function latLngToRotation(lat, lng) {
  // Longitude rotates around Y axis; latitude tilts along X axis
  const targetY = -((lng - 90) * Math.PI) / 180;
  const targetX = THREE.MathUtils.clamp((lat * Math.PI) / 180, -1.15, 1.15);
  return { x: targetX, y: targetY };
}

/**
 * Builds clean LineSegments geometry for all country borders worldwide from TopoJSON.
 */
export function createCountryBordersGeometry(radius = 1.002) {
  const { scale, translate } = topoData.transform;
  const positions = [];

  for (const arc of topoData.arcs) {
    let x = 0;
    let y = 0;
    let prev = null;
    for (const [dx, dy] of arc) {
      x += dx;
      y += dy;
      const lon = x * scale[0] + translate[0];
      const lat = y * scale[1] + translate[1];
      const pt = latLngToVector(lat, lon, radius);
      if (prev) {
        positions.push(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z);
      }
      prev = pt;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/**
 * Builds subtle latitude/longitude graticule lines for a sleek cartographic appearance.
 */
export function createGraticuleGeometry(radius = 1.001) {
  const positions = [];
  const segments = 64;

  // Latitudes: -60, -30, 0 (equator), 30, 60
  const latitudes = [-60, -30, 0, 30, 60];
  for (const lat of latitudes) {
    let prev = null;
    for (let i = 0; i <= segments; i += 1) {
      const lon = -180 + (i / segments) * 360;
      const pt = latLngToVector(lat, lon, radius);
      if (prev) {
        positions.push(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z);
      }
      prev = pt;
    }
  }

  // Longitudes: -120, -60, 0, 60, 120
  const longitudes = [-120, -60, 0, 60, 120];
  for (const lon of longitudes) {
    let prev = null;
    for (let i = 0; i <= segments; i += 1) {
      const lat = -80 + (i / segments) * 160;
      const pt = latLngToVector(lat, lon, radius);
      if (prev) {
        positions.push(prev.x, prev.y, prev.z, pt.x, pt.y, pt.z);
      }
      prev = pt;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}