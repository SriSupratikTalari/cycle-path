import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

mapboxgl.accessToken = 'pk.eyJ1Ijoic3Jpc3VwcmF0aWt0YWxhcmkiLCJhIjoiY21hcjRraGowMDJqcjJrcHl1eDdubDJudSJ9.tZANO92ZkILxnosrf6vcQg';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [-71.09415, 42.36027],
  zoom: 12,
  minZoom: 5,
  maxZoom: 18,
});

// Select the SVG inside the map container (append it if it doesn't exist)
const svg = d3.select('#map').append('svg').style('position', 'absolute').style('z-index', 2);

// Helper function to convert station coordinates to map pixel coords
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat);
  const { x, y } = map.project(point);
  return { cx: x, cy: y };
}

// Helper function to format slider minutes to HH:MM AM/PM
function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes); // Set hours & minutes
  return date.toLocaleString('en-US', { timeStyle: 'short' });
}

map.on('load', async () => {
  // Add GeoJSON source and layer for bike lanes
  map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
  });

  map.addLayer({
    id: 'bike-lanes',
    type: 'line',
    source: 'boston_route',
    paint: {
      'line-color': 'green',
      'line-width': 3,
      'line-opacity': 0.4,
    },
  });

  // Load BlueBikes station data
  const stationDataUrl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  const stationJson = await d3.json(stationDataUrl);
  let stations = stationJson.data.stations;

  // Load BlueBikes traffic data and parse date strings into Date objects
  const trips = await d3.csv(
    'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv',
    (trip) => {
      trip.started_at = new Date(trip.started_at);
      trip.ended_at = new Date(trip.ended_at);
      return trip;
    },
  );

  // Define the quantize scale to discretize departure ratio
  const stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);

  // Function to compute arrivals, departures, and total traffic for stations
  function computeStationTraffic(stations, trips) {
    const departures = d3.rollup(
      trips,
      (v) => v.length,
      (d) => d.start_station_id,
    );
    const arrivals = d3.rollup(
      trips,
      (v) => v.length,
      (d) => d.end_station_id,
    );

    return stations.map((station) => {
      const id = station.short_name;
      station.arrivals = arrivals.get(id) ?? 0;
      station.departures = departures.get(id) ?? 0;
      station.totalTraffic = station.arrivals + station.departures;
      return station;
    });
  }

  // Initialize stations with traffic data
  stations = computeStationTraffic(stations, trips);

  // Create a square root scale for circle radius
  const radiusScale = d3
    .scaleSqrt()
    .domain([0, d3.max(stations, (d) => d.totalTraffic)])
    .range([0, 25]);

  // Append SVG circles for each station
  const circles = svg
    .selectAll('circle')
    .data(stations, (d) => d.short_name) // use key function here
    .enter()
    .append('circle')
    .attr('stroke', 'white')
    .attr('stroke-width', 1)
    .attr('opacity', 0.8)
    .attr('r', (d) => radiusScale(d.totalTraffic))
    .style('--departure-ratio', (d) => stationFlow(d.departures / d.totalTraffic)) // Set departure ratio CSS var
    .each(function (d) {
      // Browser-native tooltip
      d3.select(this)
        .append('title')
        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
    });

  // Function to update circle positions on the map
  function updatePositions() {
    circles
      .attr('cx', (d) => getCoords(d).cx)
      .attr('cy', (d) => getCoords(d).cy);
  }

  updatePositions();

  // Update circles when the map moves or zooms
  map.on('move', updatePositions);
  map.on('zoom', updatePositions);
  map.on('resize', updatePositions);
  map.on('moveend', updatePositions);

  // Time filter UI elements
  const timeSlider = document.getElementById('time-slider');
  const selectedTime = document.getElementById('time-value');
  const anyTimeLabel = document.getElementById('any-time');

  // Helper: get minutes since midnight from Date object
  function minutesSinceMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  // Filter trips by time +/- 60 minutes or all if -1
  function filterTripsbyTime(trips, timeFilter) {
    return timeFilter === -1
      ? trips
      : trips.filter((trip) => {
          const startedMinutes = minutesSinceMidnight(trip.started_at);
          const endedMinutes = minutesSinceMidnight(trip.ended_at);

          return (
            Math.abs(startedMinutes - timeFilter) <= 60 ||
            Math.abs(endedMinutes - timeFilter) <= 60
          );
        });
  }

  // Update scatterplot circles based on time filter
  function updateScatterPlot(timeFilter) {
    const filteredTrips = filterTripsbyTime(trips, timeFilter);
    const filteredStations = computeStationTraffic(stations, filteredTrips);

    // Dynamically change radius scale range based on filtering
    timeFilter === -1
      ? radiusScale.range([0, 25])
      : radiusScale.range([3, 50]);

    circles
      .data(filteredStations, (d) => d.short_name)
      .join('circle')
      .attr('r', (d) => radiusScale(d.totalTraffic))
      .style('--departure-ratio', (d) => stationFlow(d.departures / d.totalTraffic));
    
    updatePositions(); // Make sure circles move to right place
  }

  // Update time display and scatterplot when slider changes
  function updateTimeDisplay() {
    const timeFilter = Number(timeSlider.value);

    if (timeFilter === -1) {
      selectedTime.textContent = '';
      anyTimeLabel.style.display = 'block';
    } else {
      selectedTime.textContent = formatTime(timeFilter);
      anyTimeLabel.style.display = 'none';
    }

    updateScatterPlot(timeFilter);
  }

  timeSlider.addEventListener('input', updateTimeDisplay);

  // Initial display update
  updateTimeDisplay();
});
