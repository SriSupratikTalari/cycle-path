import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';
console.log('Mapbox GL JS Loaded:', mapboxgl);
mapboxgl.accessToken = 'pk.eyJ1Ijoic3Jpc3VwcmF0aWt0YWxhcmkiLCJhIjoiY21hcjRraGowMDJqcjJrcHl1eDdubDJudSJ9.tZANO92ZkILxnosrf6vcQg';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12', 
  center: [-71.09415, 42.36027], 
  zoom: 12, 
  minZoom: 5, 
  maxZoom: 18, 
});
map.on('load', async () => {
    // 1. Add the GeoJSON source for bike lanes
    map.addSource('boston_route', {
      type: 'geojson',
      data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
    });
  
    // 2. Add a layer to visualize the bike lanes
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
  
    // 3. Load additional JSON data (e.g., BlueBikes station data)
    let jsonData;
    try {
      const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';
  
      // Await JSON fetch
      jsonData = await d3.json(jsonurl);
  
      console.log('Loaded JSON Data:', jsonData); // Log to verify structure
    } catch (error) {
      console.error('Error loading JSON:', error); // Handle errors
    }
    let stations = jsonData.data.stations;
    console.log('Stations Array:', stations)
  });

// let stations = jsonData.data.stations;
// console.log('Stations Array:', stations);