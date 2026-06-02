const TARGET_COLOR = '#D97706';
const TARGET_SELECTED = '#0F172A';
const CONTEXT_FILL = '#CBD5E1';

const normalizeName = value =>
  String(value ?? '')
    .toLowerCase()
    .replace(/^kelurahan\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const formatKelurahan = properties =>
  String(properties?.WADMKD || properties?.NAMOBJ || 'Wilayah tidak diketahui').replace(/^Kelurahan\s+/i, '');

const pickName = properties => normalizeName(properties?.WADMKD || properties?.NAMOBJ);

function cloneFeatureCollection(features, decorateProperties = () => ({})) {
  return {
    type: 'FeatureCollection',
    features: features.map((feature, index) => ({
      ...feature,
      id: feature.id ?? index,
      properties: {
        ...feature.properties,
        __rayonId: feature.properties?.KDEPUM || String(index),
        __label: formatKelurahan(feature.properties),
        ...decorateProperties(feature)
      }
    }))
  };
}

function createGroupLookup(groups = []) {
  const lookup = new Map();

  groups.forEach(group => {
    group.names.forEach(name => {
      lookup.set(normalizeName(name), {
        name: group.name,
        color: group.color
      });
    });
  });

  return lookup;
}

function eachPosition(geometry, callback) {
  if (!geometry) return;

  if (geometry.type === 'Polygon') {
    geometry.coordinates.forEach(ring => ring.forEach(callback));
  }

  if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(polygon => {
      polygon.forEach(ring => ring.forEach(callback));
    });
  }
}

function featureBounds(features) {
  const bounds = new mapboxgl.LngLatBounds();

  features.forEach(feature => {
    eachPosition(feature.geometry, ([longitude, latitude]) => {
      bounds.extend([longitude, latitude]);
    });
  });

  return bounds;
}

function propertyRows(properties) {
  const rows = [
    ['Nama sekolah', 'SMAN 1 Samarinda'],
    ['Kelurahan', formatKelurahan(properties)],
    ['Kelompok rayon', properties?.__rayonGroup],
    ['Kecamatan', properties?.WADMKC],
    ['Kode wilayah', properties?.KDEPUM],
    ['Kota', properties?.WADMKK]
  ];

  return rows.filter(([, value]) => value !== null && value !== undefined && value !== '');
}

function renderDetails(panel, feature, options) {
  const properties = feature?.properties;

  if (!properties) {
    panel.innerHTML = `
      <span class="rayon-map-panel-kicker">Detail wilayah</span>
      <h3>Pilih area rayon</h3>
      <p>Klik wilayah Air Hitam, Air Putih, atau Bukit Pinang pada peta untuk melihat detail GeoJSON.</p>
    `;
    return;
  }

  const rows = propertyRows(properties)
    .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
    .join('');

  panel.innerHTML = `
    <span class="rayon-map-panel-kicker">Rayon ${options.rayonCode}</span>
    <h3>${formatKelurahan(properties)}</h3>
    <p>${options.schoolName} · ${options.relatedSchools} sekolah rayon terkait · Domisili Prioritas 5%.</p>
    <div class="rayon-map-props">${rows}</div>
    <p class="rayon-map-source">Sumber batas: ${properties.UUPP || 'GeoJSON wilayah administrasi'}</p>
  `;
}

function popupHtml(feature, options) {
  const properties = feature.properties;

  return `
    <div class="rayon-popup">
      <strong>${formatKelurahan(properties)}</strong>
      <span>${options.schoolName} · ${properties.__rayonGroup || `Rayon ${options.rayonCode}`}</span>
      <small>${properties.WADMKC || ''}${properties.KDEPUM ? ` · ${properties.KDEPUM}` : ''}</small>
    </div>
  `;
}

function schoolPopupHtml(options) {
  return `
    <div class="rayon-popup">
      <strong>${options.schoolName}</strong>
      <span>Titik pusat referensi rayon</span>
      <small>${options.schoolCoordinate[1]}, ${options.schoolCoordinate[0]}</small>
    </div>
  `;
}

function setState(container, state, message = '') {
  const stateElement = container.querySelector('[data-rayon-map-state]');
  const loader = container.querySelector('.rayon-map-loader');

  stateElement.hidden = state === 'ready';
  stateElement.dataset.state = state;
  loader.hidden = state !== 'loading';
  container.querySelector('[data-rayon-map-message]').textContent = message;
}

function fitMap(map, bounds, padding = 48) {
  map.fitBounds(bounds, {
    padding,
    duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700,
    maxZoom: 14
  });
}

function clearSelected(map, selectedId) {
  if (!selectedId) return;
  map.setFeatureState({ source: 'rayon-target', id: selectedId }, { selected: false });
}

export async function initRayonMap(container, options) {
  const config = {
    targetNames: [],
    priorityNames: [],
    colorGroups: [],
    schoolName: 'SMAN 1 Samarinda',
    schoolCoordinate: null,
    rayonCode: '1',
    relatedSchools: 3,
    ...options
  };

  const mapElement = container.querySelector('[data-rayon-mapbox]');
  const panel = container.querySelector('[data-rayon-map-panel]');
  const focusButton = container.querySelector('[data-rayon-map-focus]');
  const resetButton = container.querySelector('[data-rayon-map-reset]');
  const targetSet = new Set(config.targetNames.map(normalizeName));
  const prioritySet = new Set(config.priorityNames.map(normalizeName));
  const groupLookup = createGroupLookup(config.colorGroups);

  if (!window.mapboxgl) {
    setState(container, 'error', 'Mapbox GL JS belum termuat. Periksa koneksi internet.');
    return;
  }

  if (!config.mapboxToken) {
    setState(container, 'error', 'Token Mapbox belum tersedia di konfigurasi aplikasi.');
    return;
  }

  mapboxgl.accessToken = config.mapboxToken;
  setState(container, 'loading', 'Memuat peta dan data GeoJSON wilayah Samarinda...');

  try {
    const response = await fetch(config.geoJsonUrl);
    if (!response.ok) throw new Error(`GeoJSON gagal dimuat (${response.status})`);

    const geojson = await response.json();
    const features = Array.isArray(geojson.features) ? geojson.features : [];

    if (features.length === 0) {
      setState(container, 'empty', 'Data GeoJSON kosong atau tidak memiliki feature.');
      return;
    }

    const allData = cloneFeatureCollection(features);
    const targetData = cloneFeatureCollection(
      features.filter(feature => targetSet.has(pickName(feature.properties))),
      feature => {
        const name = pickName(feature.properties);
        const group = groupLookup.get(name) || { name: 'Rayon 1', color: TARGET_COLOR };

        return {
          __rayonGroup: group.name,
          __rayonColor: group.color,
          __isPriority: prioritySet.has(name)
        };
      }
    );

    if (targetData.features.length === 0) {
      setState(container, 'empty', 'Wilayah rayon SMAN 1 tidak ditemukan di GeoJSON.');
      return;
    }

    const cityBounds = featureBounds(allData.features);
    const targetBounds = featureBounds(targetData.features);
    renderDetails(panel, null, config);
    setState(container, 'ready');

    const map = new mapboxgl.Map({
      container: mapElement,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [117.13, -0.49],
      zoom: 11,
      cooperativeGestures: true,
      attributionControl: true
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 14
    });

    let hoveredId = null;
    let selectedId = null;

    map.on('load', () => {
      map.addSource('samarinda-kelurahan', {
        type: 'geojson',
        data: allData,
        promoteId: '__rayonId'
      });

      map.addSource('rayon-target', {
        type: 'geojson',
        data: targetData,
        promoteId: '__rayonId'
      });

      map.addLayer({
        id: 'samarinda-context-fill',
        type: 'fill',
        source: 'samarinda-kelurahan',
        paint: {
          'fill-color': CONTEXT_FILL,
          'fill-opacity': 0.22
        }
      });

      map.addLayer({
        id: 'samarinda-context-line',
        type: 'line',
        source: 'samarinda-kelurahan',
        paint: {
          'line-color': '#64748B',
          'line-opacity': 0.26,
          'line-width': 0.8
        }
      });

      map.addLayer({
        id: 'rayon-target-fill',
        type: 'fill',
        source: 'rayon-target',
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            TARGET_SELECTED,
            ['get', '__rayonColor']
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.42,
            ['boolean', ['feature-state', 'hover'], false],
            0.36,
            0.28
          ]
        }
      });

      map.addLayer({
        id: 'rayon-target-line',
        type: 'line',
        source: 'rayon-target',
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            TARGET_SELECTED,
            ['get', '__rayonColor']
          ],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            3.4,
            ['boolean', ['feature-state', 'hover'], false],
            2.8,
            2
          ],
          'line-opacity': 0.95
        }
      });

      map.addLayer({
        id: 'rayon-target-label',
        type: 'symbol',
        source: 'rayon-target',
        layout: {
          'text-field': ['get', '__label'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': 12,
          'text-allow-overlap': false,
          'text-ignore-placement': false
        },
        paint: {
          'text-color': '#0F172A',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1.6
        }
      });

      fitMap(map, targetBounds, 58);

      if (Array.isArray(config.schoolCoordinate) && config.schoolCoordinate.length === 2) {
        const schoolPopup = new mapboxgl.Popup({ offset: 24 }).setHTML(schoolPopupHtml(config));

        new mapboxgl.Marker({
          color: TARGET_COLOR,
          scale: 0.9,
          anchor: 'bottom'
        })
          .setLngLat(config.schoolCoordinate)
          .setPopup(schoolPopup)
          .addTo(map);
      }

      map.resize();
    });

    map.on('mousemove', 'rayon-target-fill', event => {
      const feature = event.features?.[0];
      if (!feature) return;

      const nextHoverId = feature.properties.__rayonId;
      if (hoveredId && hoveredId !== nextHoverId) {
        map.setFeatureState({ source: 'rayon-target', id: hoveredId }, { hover: false });
      }

      hoveredId = nextHoverId;
      map.setFeatureState({ source: 'rayon-target', id: hoveredId }, { hover: true });
      map.getCanvas().style.cursor = 'pointer';
      popup.setLngLat(event.lngLat).setHTML(popupHtml(feature, config)).addTo(map);
    });

    map.on('mouseleave', 'rayon-target-fill', () => {
      if (hoveredId) {
        map.setFeatureState({ source: 'rayon-target', id: hoveredId }, { hover: false });
      }

      hoveredId = null;
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    map.on('click', 'rayon-target-fill', event => {
      const feature = event.features?.[0];
      if (!feature) return;

      clearSelected(map, selectedId);
      selectedId = feature.properties.__rayonId;
      map.setFeatureState({ source: 'rayon-target', id: selectedId }, { selected: true });
      renderDetails(panel, feature, config);
      fitMap(map, featureBounds([feature]), 72);
    });

    focusButton?.addEventListener('click', () => {
      clearSelected(map, selectedId);
      selectedId = null;
      renderDetails(panel, null, config);
      fitMap(map, targetBounds, 58);
    });

    resetButton?.addEventListener('click', () => {
      clearSelected(map, selectedId);
      selectedId = null;
      renderDetails(panel, null, config);
      fitMap(map, cityBounds, 42);
    });
  } catch (error) {
    setState(container, 'error', error.message || 'Peta atau data GeoJSON gagal dimuat.');
  }
}
