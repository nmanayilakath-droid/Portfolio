import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

mapboxgl.accessToken ='pk.eyJ1IjoibmlkaGltYW4iLCJhIjoiY21wOWMwaTlvMHJsNDJ1cHVqMGhuZDdhMiJ9.fu8hlbKtkFraIYOOTT4COw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 9,
  maxZoom: 18,
});

const svg = d3.select('#map svg');
const slider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

const stationUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
const tripsUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
const bostonLaneUrl = 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson';
const cambridgeLaneUrl = 'https://data.cambridgema.gov/resource/ff8g-h8fw.geojson';

let stations = [];
let trips = [];
let timeFilter = -1;
let circles = null;

const radiusScale = d3.scaleSqrt().range([2, 25]);
const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes);
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function updateTimeDisplay() {
  timeFilter = Number(slider.value);
  if (timeFilter === -1) {
    selectedTime.textContent = '';
    anyTimeLabel.style.display = 'inline';
  } else {
    selectedTime.textContent = formatTime(timeFilter);
    anyTimeLabel.style.display = 'none';
  }
}

function getStationCoords(station) {
  const point = map.project([+station.lon, +station.lat]);
  return { x: point.x, y: point.y };
}

function filterTripsByTime(trips, filterValue) {
  if (filterValue === -1) return trips;

  return trips.filter((trip) => {
    const start = minutesSinceMidnight(trip.started_at);
    const end = minutesSinceMidnight(trip.ended_at);
    return (
      Math.abs(start - filterValue) <= 60 ||
      Math.abs(end - filterValue) <= 60
    );
  });
}

function computeStationTraffic(rawStations, tripData) {
  const departures = d3.rollup(
    tripData,
    (v) => v.length,
    (d) => d.start_station_id,
  );

  const arrivals = d3.rollup(
    tripData,
    (v) => v.length,
    (d) => d.end_station_id,
  );

  return rawStations.map((station) => {
    const id = station.Number ?? station.short_name ?? station.number;
    const stationDepartures = departures.get(id) ?? 0;
    const stationArrivals = arrivals.get(id) ?? 0;

    return {
      ...station,
      departures: stationDepartures,
      arrivals: stationArrivals,
      totalTraffic: stationDepartures + stationArrivals,
    };
  });
}

function renderStationMarkers(filteredStations) {
  circles = svg
    .selectAll('circle')
    .data(filteredStations, (d) => d.Number ?? d.short_name ?? d.number);

  const entered = circles
    .enter()
    .append('circle')
    .attr('fill', 'steelblue')
    .attr('stroke', 'white')
    .attr('stroke-width', 1.2)
    .style('pointer-events', 'auto')
    .style('--departure-ratio', (d) =>
      stationFlow(d.totalTraffic > 0 ? d.departures / d.totalTraffic : 0.5),
    );

  entered.each(function (d) {
    d3.select(this)
      .append('title')
      .text(
        `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`,
      );
  });

  circles = entered.merge(circles);

  circles
    .attr('r', (d) => radiusScale(d.totalTraffic))
    .style('fill', (d) => {
      const ratio = d.totalTraffic > 0 ? d.departures / d.totalTraffic : 0.5;
      const scaled = stationFlow(ratio);
      return scaled === 0
        ? '#2a9d8f'
        : scaled === 0.5
        ? '#f4a261'
        : '#e76f51';
    })
    .attr('opacity', 0.75)
    .select('title')
    .text((d) =>
      `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`,
    );

  circles.exit().remove();
}

function updateMarkerPositions() {
  if (!circles) return;

  circles.attr('cx', (d) => getStationCoords(d).x).attr('cy', (d) => getStationCoords(d).y);
}

function updateTraffic() {
  const visibleTrips = filterTripsByTime(trips, timeFilter);
  const updatedStations = computeStationTraffic(stations, visibleTrips);
  const maxValue = d3.max(updatedStations, (d) => d.totalTraffic) || 1;
  radiusScale.domain([0, maxValue]);
  renderStationMarkers(updatedStations);
  updateMarkerPositions();
}

async function loadStations() {
  const jsonData = await d3.json(stationUrl);
  return jsonData.data.stations;
}

async function loadTrips() {
  return d3.csv(tripsUrl, (trip) => {
    trip.started_at = new Date(trip.started_at);
    trip.ended_at = new Date(trip.ended_at);
    return trip;
  });
}

function addBikeLanes(id, sourceUrl, color) {
  map.addSource(id, {
    type: 'geojson',
    data: sourceUrl,
  });

  map.addLayer({
    id,
    type: 'line',
    source: id,
    paint: {
      'line-color': color,
      'line-width': 3,
      'line-opacity': 0.55,
    },
  });
}

map.on('load', async () => {
  addBikeLanes('boston-bike-lanes', bostonLaneUrl, '#2f9e44');

  try {
    addBikeLanes('cambridge-bike-lanes', cambridgeLaneUrl, '#1d74b8');
  } catch (error) {
    console.warn('Cambridge bike lanes source may not load:', error);
  }

  try {
    stations = await loadStations();
    trips = await loadTrips();
    updateTraffic();
  } catch (error) {
    console.error('Failed to load station or trip data:', error);
  }

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));
  map.on('move', updateMarkerPositions);
  map.on('zoom', updateMarkerPositions);
  map.on('resize', updateMarkerPositions);

  slider.addEventListener('input', () => {
    updateTimeDisplay();
    updateTraffic();
  });

  updateTimeDisplay();
});

console.log('Mapbox GL JS Loaded:', mapboxgl);
