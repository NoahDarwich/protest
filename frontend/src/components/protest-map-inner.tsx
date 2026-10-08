"use client";

import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { MapDataPoint } from "@/lib/api";
import type { ColorMode } from "@/lib/types";
import { REPRESSION_COLORS, REPRESSION_SHORT_LABELS, SEVERITY_COLORS, SEVERITY_LABELS } from "@/lib/constants";

const REPRESSION_COLOR_MAP: Record<string, string> = {};
const repressionKeys = Object.keys(REPRESSION_SHORT_LABELS);
repressionKeys.forEach((key, i) => {
  REPRESSION_COLOR_MAP[key] = REPRESSION_COLORS[i % REPRESSION_COLORS.length];
});

function getPointColor(point: MapDataPoint, colorMode: ColorMode): string {
  if (colorMode === "severity") {
    return SEVERITY_COLORS[point.severity] || SEVERITY_COLORS[0];
  }
  return REPRESSION_COLOR_MAP[point.repression] || "#94a3b8";
}

function HeatmapLayer({ points, colorMode, visible }: { points: MapDataPoint[]; colorMode: ColorMode; visible: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length || !visible) return;

    const heatData: [number, number, number][] = points.map((p) => [
      p.lat,
      p.lng,
      colorMode === "severity"
        ? 0.2 + (p.severity / 5) * 0.8
        : 0.6,
    ]);

    const gradient: Record<number, string> =
      colorMode === "severity"
        ? { 0: "#6b7280", 0.2: "#7eb8a4", 0.4: "#d4a87c", 0.6: "#c98a5a", 0.8: "#c97b7b", 1: "#a35555" }
        : { 0.2: "#7eb8a4", 0.4: "#d4a87c", 0.6: "#c98a5a", 0.8: "#c97b7b", 1: "#a35555" };

    const heat = L.heatLayer(heatData, {
      radius: 10,
      blur: 12,
      maxZoom: 10,
      minOpacity: 0.3,
      gradient,
    }).addTo(map);

    return () => { map.removeLayer(heat); };
  }, [map, points, colorMode, visible]);

  return null;
}

function ClusterLayer({ points, colorMode, visible }: { points: MapDataPoint[]; colorMode: ColorMode; visible: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length || !visible) return;

    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      disableClusteringAtZoom: 13,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 32 : count < 100 ? 38 : 44;
        return L.divIcon({
          html: `<div class="protest-cluster" style="width:${size}px;height:${size}px;line-height:${size}px">${count}</div>`,
          className: "",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    points.forEach((p) => {
      const color = getPointColor(p, colorMode);
      const icon = L.divIcon({
        html: `<div class="protest-marker" style="background:${color}"></div>`,
        className: "",
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });

      const marker = L.marker([p.lat, p.lng], { icon });

      const repLabel = REPRESSION_SHORT_LABELS[p.repression] || p.repression || "—";
      const sevLabel = SEVERITY_LABELS[p.severity] || "Unknown";
      const sevColor = SEVERITY_COLORS[p.severity] || "#94a3b8";

      marker.bindPopup(`
        <div style="font-size:13px;line-height:1.5;min-width:180px;color:#1f2937">
          <div style="font-weight:600;font-size:14px">${p.country}</div>
          <div style="color:#6b7280;margin-top:2px">${repLabel}</div>
          ${p.demand ? `<div style="color:#9ca3af;margin-top:2px">Demand: ${p.demand}</div>` : ""}
          ${p.tactic ? `<div style="color:#9ca3af">Tactic: ${p.tactic}</div>` : ""}
          <div style="margin-top:6px;display:flex;align-items:center;gap:6px">
            <span style="width:10px;height:10px;border-radius:50%;background:${sevColor};display:inline-block;flex-shrink:0"></span>
            <span style="color:#6b7280">Severity: ${sevLabel}</span>
          </div>
        </div>
      `);

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    return () => { map.removeLayer(clusterGroup); };
  }, [map, points, colorMode, visible]);

  return null;
}

function ZoomRouter({ points, colorMode }: { points: MapDataPoint[]; colorMode: ColorMode }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => { map.off("zoomend", onZoom); };
  }, [map]);

  const showHeatmap = zoom < 7;
  const showClusters = zoom >= 7;

  return (
    <>
      <HeatmapLayer points={points} colorMode={colorMode} visible={showHeatmap} />
      <ClusterLayer points={points} colorMode={colorMode} visible={showClusters} />
    </>
  );
}

interface ProtestMapInnerProps {
  points: MapDataPoint[];
  colorMode: ColorMode;
}

export default function ProtestMapInner({ points, colorMode }: ProtestMapInnerProps) {
  const [mapReady, setMapReady] = useState(false);
  const handleMapReady = useCallback(() => { setMapReady(true); }, []);

  return (
    <MapContainer
      center={[30.5852, 36.2384]}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
      zoomControl={true}
      whenReady={handleMapReady}
    >
      <TileLayer
        attribution='Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={16}
      />
      {mapReady && <ZoomRouter points={points} colorMode={colorMode} />}
    </MapContainer>
  );
}
