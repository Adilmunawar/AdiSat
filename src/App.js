import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
// satellite.js and Font Awesome will be loaded via CDN

// Main App component for the Satellite Tracker
const App = () => {
    // Refs for the Three.js canvas and label renderer
    const mountRef = useRef(null);
    const labelRendererRef = useRef(null);
    const compassRef = useRef(null); // Ref for the compass UI element

    // State for Three.js core components
    const [scene, setScene] = useState(null);
    const [camera, setCamera] = useState(null);
    const [renderer, setRenderer] = useState(null);
    const [labelRenderer, setLabelRenderer] = useState(null); // New state for CSS2DRenderer
    const [controls, setControls] = useState(null); // Store OrbitControls instance

    // State for satellite data and selection
    const [satellites, setSatellites] = useState([]);
    const [selectedSatellite, setSelectedSatellite] = useState(null);
    // Ref to hold the latest data for the selected satellite, updated frequently but not triggering re-renders directly
    const selectedSatelliteDisplayDataRef = useRef(null);


    // State for time control
    const [simulationTime, setSimulationTime] = useState(new Date()); // Time for calculations
    const [displayTime, setDisplayTime] = useState(new Date()); // Time for UI display (updates every second)
    const [isPaused, setIsPaused] = useState(false);
    const [timeMultiplier, setTimeMultiplier] = useState(60); // 1x, 60x, 3600x (real-time, 1 min/sec, 1 hour/sec)

    // State to track if satellite.js and Font Awesome have been loaded
    const [isLibsLoaded, setIsLibsLoaded] = useState(false);

    // State for clicked Earth coordinates
    const [clickedEarthCoords, setClickedEarthCoords] = useState(null);

    // New states for visibility toggles
    const [hideBehindEarth, setHideBehindEarth] = useState(true);
    const [hideNightSide, setHideNightSide] = useState(false);

    // New state for satellite type filters
    const [filters, setFilters] = useState({
        Starlink: true,
        GPS: true,
        ISS: true,
        Hubble: true,
        Weather: true,
        EarthObservation: true,
        GroundStations: true, // New filter for ground stations
    });

    // New state for user's home location and its Three.js mesh
    const [userHomeLocation, setUserHomeLocation] = useState(null); // { latitude, longitude }
    const homeGroundStationMeshRef = useRef(null); // Ref to store the Three.js mesh for the home location

    // State for satellite search input
    const [satelliteSearchQuery, setSatelliteSearchQuery] = useState('');

    // Hardcoded TLE data with added details and icon classes
    // Expanded with more diverse and numerous (mock) satellites
    const TLE_DATA = [
        // ISS
        {
            name: 'ISS (ZARYA)',
            type: 'ISS',
            line1: '1 25544U 98067A   25194.50000000  .00000000  00000-0  00000-0 0  9999',
            line2: '2 25544  51.6416 119.2942 0005700 248.0673 111.9327 15.49887750456789',
            iconClass: 'fa-solid fa-satellite-dish',
            details: {
                description: 'The International Space Station is a modular space station (habitable artificial satellite) in low Earth orbit. It is a multinational collaborative project involving five participating space agencies.',
                launchDate: 'November 20, 1998',
                operator: 'NASA, Roscosmos, JAXA, ESA, CSA',
                purpose: 'Space research laboratory, microgravity environment research',
                mass: '450,000 kg (approx)',
                dimensions: '109 m x 73 m x 20 m (approx)',
            },
        },
        // Hubble
        {
            name: 'HUBBLE SPACE TELESCOPE',
            type: 'Hubble',
            line1: '1 20580U 90037B   25194.50000000  .00000000  00000-0  00000-0 0  9999',
            line2: '2 20580  28.4700 200.0000 0002700 250.0000 110.0000 15.00000000000000',
            iconClass: 'fa-solid fa-telescope',
            details: {
                description: 'A space telescope that was launched into low Earth orbit in 1990 and remains in operation. It is one of NASA\'s Great Observatories.',
                launchDate: 'April 24, 1990',
                operator: 'NASA, ESA',
                purpose: 'Astronomical observation, deep space imaging',
                mass: '11,110 kg',
                dimensions: '13.2 m (length) x 4.2 m (diameter)',
            },
        },
        // GPS (NAVSTAR) - Multiple mock GPS satellites
        ...Array.from({ length: 5 }).map((_, i) => ({
            name: `GPS (NAVSTAR ${75 + i})`,
            type: 'GPS',
            line1: `1 4827${4 + i}U 21063A   25194.50000000  .00000000  00000-0  00000-0 0  9999`,
            line2: `2 4827${4 + i}  55.0000 ${150 + i * 5}.0000 0001000 ${180 + i * 5}.0000 ${180 - i * 5}.0000  2.00000000000000`,
            iconClass: 'fa-solid fa-map-marker-alt',
            details: {
                description: 'One of the satellites in the Global Positioning System (GPS) constellation, providing precise positioning, navigation, and timing services worldwide.',
                launchDate: `June ${17 + i}, 2021`,
                operator: 'United States Space Force',
                purpose: 'Navigation, positioning, timing',
                mass: '2,030 kg (on-orbit)',
                dimensions: 'Approx. 2.54 m x 1.27 m x 1.27 m (body)',
            },
        })),
        // Starlink - Many mock Starlink satellites
        ...Array.from({ length: 50 }).map((_, i) => ({
            name: `STARLINK-${1000 + i}`,
            type: 'Starlink',
            line1: `1 4471${9 + i}U 19074A   25194.50000000  .00000000  00000-0  00000-0 0  9999`,
            line2: `2 4471${9 + i}  53.0000 ${300 + i * 0.5}.0000 0001000 ${100 + i * 0.5}.0000 ${260 - i * 0.5}.0000 15.20000000000000`,
            iconClass: 'fa-solid fa-satellite',
            details: {
                description: 'Part of SpaceX\'s Starlink constellation, providing satellite Internet access coverage.',
                launchDate: `November ${11 + i}, 2019`,
                operator: 'SpaceX',
                purpose: 'Satellite Internet access',
                mass: '260 kg (approx)',
                dimensions: 'Approx. 3.2 m x 1.6 m (flat panel)',
            },
        })),
        // Weather Satellites
        {
            name: 'NOAA 15',
            type: 'Weather',
            line1: '1 25338U 98030A   25194.50000000  .00000000  00000-0  00000-0 0  9999',
            line2: '2 25338  98.7400 30.0000 0010000 90.0000 270.0000 14.20000000000000',
            iconClass: 'fa-solid fa-cloud-sun-rain',
            details: {
                description: 'A weather satellite operated by NOAA, part of the POES (Polar-orbiting Operational Environmental Satellite) series, providing global weather data.',
                launchDate: 'May 13, 1998',
                operator: 'NOAA',
                purpose: 'Meteorological observation, environmental monitoring',
                mass: '1,440 kg',
                dimensions: '4.2 m x 1.8 m (deployed)',
            },
        },
        {
            name: 'GOES 16',
            type: 'Weather',
            line1: '1 42054U 16071A   25194.50000000  .00000000  00000-0  00000-0 0  9999',
            line2: '2 42054   0.0000 280.0000 0000000 0.0000 0.0000  1.00273790000000',
            iconClass: 'fa-solid fa-globe-americas',
            details: {
                description: 'A geostationary operational environmental satellite operated by NOAA, providing continuous weather imagery and atmospheric measurements over the Western Hemisphere.',
                launchDate: 'November 19, 2016',
                operator: 'NOAA',
                purpose: 'Geostationary weather monitoring, severe storm detection',
                mass: '5,192 kg (launch)',
                dimensions: '6.1 m x 2.6 m (deployed)',
            },
        },
        // Earth Observation Satellites
        {
            name: 'TERRA (EOS AM-1)',
            type: 'EarthObservation',
            line1: '1 25994U 99068A   25194.50000000  .00000000  00000-0  00000-0 0  9999',
            line2: '2 25994  98.2000 100.0000 0001000 150.0000 210.0000 14.50000000000000',
            iconClass: 'fa-solid fa-globe',
            details: {
                description: 'A multi-national NASA scientific research satellite in orbit around the Earth, part of the Earth Observing System. It monitors Earth\'s land, atmosphere, and oceans.',
                launchDate: 'December 18, 1999',
                operator: 'NASA',
                purpose: 'Earth observation, climate research',
                mass: '4,864 kg',
                dimensions: '6.5 m x 3.5 m x 3.5 m (deployed)',
            },
        },
        {
            name: 'AQUA (EOS PM-1)',
            type: 'EarthObservation',
            line1: '1 27424U 02022A   25194.50000000  .00000000  00000-0  00000-0 0  9999',
            line2: '2 27424  98.2000 200.0000 0001000 200.0000 160.0000 14.50000000000000',
            iconClass: 'fa-solid fa-water',
            details: {
                description: 'A NASA scientific research satellite in orbit around the Earth, part of the Earth Observing System. It collects information about Earth\'s water cycle.',
                launchDate: 'May 4, 2002',
                operator: 'NASA',
                purpose: 'Earth observation, water cycle research',
                mass: '2,850 kg',
                dimensions: '6.5 m x 3.5 m x 3.5 m (deployed)',
            },
        },
    ];

    // Static Ground Station data
    const GROUND_STATIONS = [
        { name: 'NASA Goldstone', latitude: 35.33, longitude: -116.89, iconClass: 'fa-solid fa-broadcast-tower' },
        { name: 'ESA Kourou', latitude: 5.25, longitude: -52.76, iconClass: 'fa-solid fa-broadcast-tower' },
        { name: 'JAXA Tsukuba', latitude: 36.06, longitude: 140.13, iconClass: 'fa-solid fa-broadcast-tower' },
        { name: 'ISRO Bengaluru', latitude: 12.97, longitude: 77.59, iconClass: 'fa-solid fa-broadcast-tower' },
        { name: 'China Wenchang', latitude: 19.61, longitude: 110.95, iconClass: 'fa-solid fa-broadcast-tower' },
    ];


    // Function to convert ECI (Earth-Centered Inertial) coordinates to Lat/Lon/Alt
    const eciToGeodetic = useCallback((eci, gdtime) => {
        // Access satellite.js from the global window object
        if (window.satellite) {
            const gmst = window.satellite.gstime(gdtime);
            return window.satellite.eciToGeodetic(eci, gmst);
        }
        return null;
    }, []);

    // Function to calculate satellite position and velocity
    const calculateSatellitePosition = useCallback((satrec, date) => {
        // Access satellite.js from the global window object
        if (!window.satellite) return null;

        const positionAndVelocity = window.satellite.propagate(satrec, date);
        const positionEci = positionAndVelocity.position;

        // Add robust check for NaN values in ECI position
        if (!positionEci || isNaN(positionEci.x) || isNaN(positionEci.y) || isNaN(positionEci.z)) {
            // console.warn('Invalid ECI position calculated (NaN values detected):', positionEci);
            return null;
        }

        const geodetic = eciToGeodetic(positionEci, date);
        // Add robust check for NaN values in geodetic position
        if (!geodetic || isNaN(geodetic.latitude) || isNaN(geodetic.longitude) || isNaN(geodetic.height)) {
            // console.warn('Invalid geodetic position calculated (NaN values detected):', geodetic);
            return null;
        }

        // Convert radians to degrees
        const longitude = window.satellite.degreesLong(geodetic.longitude);
        const latitude = window.satellite.degreesLat(geodetic.latitude);
        const altitude = geodetic.height; // Altitude in kilometers

        // Convert ECI position to Three.js coordinates (scaled for globe)
        const R = 6371; // Earth radius in km
        const scale = 0.0001; // Scale factor for Three.js scene (1 unit = 10000 km)
        const scaledAltitude = (R + altitude) * scale;

        // Convert spherical coordinates (lat, lon, alt) to Cartesian (x, y, z)
        const phi = (90 - latitude) * (Math.PI / 180);
        const theta = (longitude + 180) * (Math.PI / 180);

        const x = -scaledAltitude * Math.sin(phi) * Math.cos(theta);
        const y = scaledAltitude * Math.cos(phi);
        const z = scaledAltitude * Math.sin(phi) * Math.sin(theta);

        return {
            position: new THREE.Vector3(x, y, z),
            latitude: latitude,
            longitude: longitude,
            altitude: altitude,
            velocity: (positionAndVelocity.velocity ? Math.sqrt(
                positionAndVelocity.velocity.x * positionAndVelocity.velocity.x +
                positionAndVelocity.velocity.y * positionAndVelocity.velocity.y +
                positionAndVelocity.velocity.z * positionAndVelocity.velocity.z
            ) : 0), // km/s
        };
    }, [eciToGeodetic]);

    // Function to convert Lat/Lon/Alt to Three.js coordinates on Earth's surface
    const geodeticToSpherical = useCallback((latitude, longitude, altitude = 0, radius = 0.6371) => {
        const latRad = latitude * (Math.PI / 180);
        const lonRad = longitude * (Math.PI / 180);

        const x = radius * Math.cos(latRad) * Math.cos(lonRad);
        const y = radius * Math.sin(latRad);
        const z = radius * Math.cos(latRad) * Math.sin(lonRad);
        return new THREE.Vector3(x, y, z);
    }, []);

    // New function to calculate look angles (azimuth, elevation) from an observer to a satellite
    const getSatelliteLookAngles = useCallback((satrec, observer, date) => {
        if (!window.satellite || !observer || typeof observer.latitude === 'undefined' || typeof observer.longitude === 'undefined') {
            return null;
        }

        // Observer location in geodetic coordinates (radians)
        const observerGd = {
            latitude: observer.latitude * Math.PI / 180,
            longitude: observer.longitude * Math.PI / 180,
            height: 0 // Assume observer is at sea level for simplicity
        };

        const positionAndVelocity = window.satellite.propagate(satrec, date);
        const gmst = window.satellite.gstime(date);
        const observerEcf = window.satellite.geodeticToEcf(observerGd); // Convert observer to Earth-Centered Fixed
        const positionEci = positionAndVelocity.position; // Satellite position in Earth-Centered Inertial

        // Add robust check for NaN values in ECI position before converting
        if (!positionEci || isNaN(positionEci.x) || isNaN(positionEci.y) || isNaN(positionEci.z)) {
            // console.warn('Invalid ECI position for look angles (NaN values detected):', positionEci);
            return null;
        }

        // Convert ECI to ECF for look angle calculation
        const positionEcf = window.satellite.eciToEcf(positionEci, gmst);

        const lookAngles = window.satellite.ecfToAziEle(observerEcf, positionEcf);

        // lookAngles contains azimuth, elevation, and range in radians
        return {
            azimuth: lookAngles.azimuth, // Radians
            elevation: lookAngles.elevation, // Radians
            range: lookAngles.range // Kilometers
        };
    }, []);


    // Effect for initializing the Three.js scene, loading external libraries, and setting up controls
    useEffect(() => {
        if (!mountRef.current) return;

        // Load satellite.js from CDN
        const satelliteScript = document.createElement('script');
        satelliteScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/satellite.js/4.0.0/satellite.min.js';
        satelliteScript.async = true;

        // Load Font Awesome from CDN
        const fontAwesomeLink = document.createElement('link');
        fontAwesomeLink.rel = 'stylesheet';
        fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css';

        let loadedCount = 0;
        const totalToLoad = 2; // satellite.js script and Font Awesome stylesheet

        const checkAllLoaded = () => {
            loadedCount++;
            if (loadedCount === totalToLoad) {
                setIsLibsLoaded(true);
                console.log('All external libraries loaded (satellite.js, Font Awesome)');
            }
        };

        satelliteScript.onload = checkAllLoaded;
        satelliteScript.onerror = (error) => {
            console.error('Failed to load satellite.js from CDN:', error);
            checkAllLoaded(); // Still call checkAllLoaded to avoid blocking if one fails
        };
        document.head.appendChild(satelliteScript);

        fontAwesomeLink.onload = checkAllLoaded;
        fontAwesomeLink.onerror = (error) => {
            console.error('Failed to load Font Awesome from CDN:', error);
            checkAllLoaded(); // Still call checkAllLoaded
        };
        document.head.appendChild(fontAwesomeLink);


        // Scene setup
        const newScene = new THREE.Scene();
        // Set a background color to make it clear if the canvas is rendering
        newScene.background = new THREE.Color(0x0a0a2a); // Dark blue/purple background for space

        const newCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const newRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        newRenderer.setSize(window.innerWidth, window.innerHeight);
        newRenderer.setPixelRatio(window.devicePixelRatio);
        newRenderer.shadowMap.enabled = true; // Enable shadows
        newRenderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
        mountRef.current.appendChild(newRenderer.domElement);

        // CSS2DRenderer for labels
        const newLabelRenderer = new CSS2DRenderer();
        newLabelRenderer.setSize(window.innerWidth, window.innerHeight);
        newLabelRenderer.domElement.style.position = 'absolute';
        newLabelRenderer.domElement.style.top = '0px';
        newLabelRenderer.domElement.style.pointerEvents = 'none'; // Allow clicks to pass through
        labelRendererRef.current.appendChild(newLabelRenderer.domElement);


        // Add OrbitControls for camera interaction
        const newControls = new OrbitControls(newCamera, newRenderer.domElement);
        newControls.enableDamping = true;
        newControls.dampingFactor = 0.05;
        newControls.screenSpacePanning = false;
        newControls.minDistance = 0.8; // Closer zoom
        newControls.maxDistance = 5;
        newControls.update();

        // Earth Globe with texture
        const earthGeometry = new THREE.SphereGeometry(0.6371, 64, 64);
        const textureLoader = new THREE.TextureLoader();

        // Load Earth texture with error handling
        const earthTexture = textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
            undefined, // onProgress
            (err) => {
                console.error('Error loading Earth texture:', err);
                // Fallback to a solid color if texture fails
                earthMaterial.color.set(0x0077ff);
                earthMaterial.map = null;
            }
        );
        const earthMaterial = new THREE.MeshPhongMaterial({ map: earthTexture, flatShading: false });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.receiveShadow = true; // Earth receives shadows
        earth.name = 'Earth'; // Give Earth a name for raycasting
        newScene.add(earth);

        // Atmosphere Glow (simple translucent sphere)
        const atmosphereGeometry = new THREE.SphereGeometry(0.6371 * 1.02, 64, 64); // Slightly larger
        const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: 0x88ccff, // Light blue
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide, // Render from inside
        });
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        newScene.add(atmosphere);

        // NEW: Clouds Layer
        const cloudsTexture = textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png',
            undefined,
            (err) => {
                console.error('Error loading Clouds texture:', err);
            }
        );
        const cloudsGeometry = new THREE.SphereGeometry(0.6371 * 1.003, 64, 64); // Slightly larger than Earth
        const cloudsMaterial = new THREE.MeshPhongMaterial({
            map: cloudsTexture,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending, // Makes clouds blend nicely
            shininess: 0, // No shininess for clouds
        });
        const clouds = new THREE.Mesh(cloudsGeometry, cloudsMaterial);
        newScene.add(clouds);
        newScene.userData.clouds = clouds; // Store for rotation

        // NEW: Night Lights Layer
        const nightLightsTexture = textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_lights_2048.png',
            undefined,
            (err) => {
                console.error('Error loading Night Lights texture:', err);
            }
        );
        const nightLightsGeometry = new THREE.SphereGeometry(0.6371 * 1.001, 64, 64); // Very slightly larger than Earth
        const nightLightsMaterial = new THREE.MeshBasicMaterial({
            map: nightLightsTexture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            opacity: 0, // Start with 0 opacity, will be adjusted dynamically
        });
        const nightLights = new THREE.Mesh(nightLightsGeometry, nightLightsMaterial);
        newScene.add(nightLights);
        newScene.userData.nightLights = nightLights; // Store for opacity control


        // Starfield Background
        const starGeometry = new THREE.SphereGeometry(90, 64, 64);
        // Load Starfield texture with error handling
        const starTexture = textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/galaxy_starfield.png',
            undefined, // onProgress
            (err) => {
                console.error('Error loading Starfield texture:', err);
                // Fallback to a solid dark background if texture fails
                stars.material.color.set(0x050515);
                stars.material.map = null;
            }
        );
        const starMaterial = new THREE.MeshBasicMaterial({
            map: starTexture,
            side: THREE.BackSide, // Render on the inside of the sphere
        });
        const stars = new THREE.Mesh(starGeometry, starMaterial);
        newScene.add(stars);

        // Add lights (Sunlight)
        const ambientLight = new THREE.AmbientLight(0x333333); // Soft ambient light
        newScene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        sunLight.position.set(5, 0, 0); // Initial sun position
        sunLight.castShadow = true; // Sun casts shadows
        sunLight.shadow.mapSize.width = 2048; // Shadow quality
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        newScene.add(sunLight);
        // Store the sunLight for later rotation
        newScene.userData.sunLight = sunLight;
        newScene.userData.earth = earth; // Store earth for rotation

        // Add Day/Night Terminator Line (initially hidden)
        const terminatorMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, transparent: true, opacity: 0.7 });
        const terminatorGeometry = new THREE.BufferGeometry();
        const terminatorLine = new THREE.Line(terminatorGeometry, terminatorMaterial);
        terminatorLine.name = 'TerminatorLine';
        newScene.add(terminatorLine);
        newScene.userData.terminatorLine = terminatorLine; // Store for updates


        // Set camera position
        newCamera.position.z = 2;

        setScene(newScene);
        setCamera(newCamera);
        setRenderer(newRenderer);
        setLabelRenderer(newLabelRenderer);
        setControls(newControls); // Store controls instance

        // Handle window resize
        const onWindowResize = () => {
            newCamera.aspect = window.innerWidth / window.innerHeight;
            newCamera.updateProjectionMatrix();
            newRenderer.setSize(window.innerWidth, window.innerHeight);
            newLabelRenderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', onWindowResize);

        // Cleanup on unmount
        return () => {
            if (mountRef.current && newRenderer.domElement) {
                mountRef.current.removeChild(newRenderer.domElement);
            }
            if (labelRendererRef.current && newLabelRenderer.domElement) {
                labelRendererRef.current.removeChild(newLabelRenderer.domElement);
            }
            newRenderer.dispose();
            newControls.dispose();
            document.head.removeChild(satelliteScript); // Clean up the script tag
            document.head.removeChild(fontAwesomeLink); // Clean up the link tag
            window.removeEventListener('resize', onWindowResize);
        };
    }, []); // Empty dependency array, runs once on mount

    // Effect for processing TLE data and creating satellite meshes
    useEffect(() => {
        if (!scene || !isLibsLoaded || !window.satellite || !labelRenderer) return;

        // Store original materials for resetting highlight
        const originalSatelliteMaterial = new THREE.MeshPhongMaterial({ color: 0xffa500, flatShading: false });
        // Make default orbit lines slightly transparent and thinner
        const originalOrbitMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, linewidth: 1 });
        const highlightSatelliteMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00, flatShading: false }); // Yellow highlight
        const highlightOrbitMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8, linewidth: 2 }); // Thicker yellow highlight

        const newSatellites = TLE_DATA.map(data => {
            const satrec = window.satellite.twoline2satrec(data.line1, data.line2);

            // Create a small sphere for the satellite (primarily for raycasting)
            const satelliteGeometry = new THREE.SphereGeometry(0.01, 16, 16); // Increased size for visibility
            const satelliteMesh = new THREE.Mesh(satelliteGeometry, originalSatelliteMaterial.clone()); // Clone material for individual control
            satelliteMesh.castShadow = true; // Satellites cast shadows
            satelliteMesh.userData.name = data.name; // Store name for raycasting
            satelliteMesh.userData.isSatellite = true; // Tag for raycasting
            satelliteMesh.userData.type = data.type; // Store type for filtering
            scene.add(satelliteMesh);

            // Create a line for the orbit path
            const orbitLine = new THREE.Line(new THREE.BufferGeometry(), originalOrbitMaterial.clone()); // Clone material
            scene.add(orbitLine);

            // Create a div element for the label with Font Awesome icon
            const satelliteLabelDiv = document.createElement('div');
            satelliteLabelDiv.className = 'satellite-label flex items-center space-x-1'; // Use flex for icon and text
            satelliteLabelDiv.style.color = 'white';
            satelliteLabelDiv.style.fontSize = '12px'; // Slightly larger font for readability
            satelliteLabelDiv.style.backgroundColor = 'rgba(0,0,0,0.6)';
            satelliteLabelDiv.style.padding = '3px 8px'; // More padding
            satelliteLabelDiv.style.borderRadius = '5px'; // More rounded
            satelliteLabelDiv.style.pointerEvents = 'none'; // Important for interaction
            satelliteLabelDiv.style.whiteSpace = 'nowrap'; // Prevent wrapping
            satelliteLabelDiv.innerHTML = `<i class="${data.iconClass}" style="color: #ADD8E6;"></i> <span>${data.name}</span>`; // Add icon with specific color

            const satelliteLabel = new CSS2DObject(satelliteLabelDiv);
            satelliteLabel.position.set(0, 0.02, 0); // Offset label slightly above satellite
            satelliteMesh.add(satelliteLabel); // Add label to satellite mesh

            // Ground track line
            const groundTrackMaterial = new THREE.LineBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.7 }); // Magenta ground track
            const groundTrackGeometry = new THREE.BufferGeometry();
            const groundTrackLine = new THREE.Line(groundTrackGeometry, groundTrackMaterial);
            scene.add(groundTrackLine);
            groundTrackLine.visible = false; // Hide by default

            // Orbital plane visualization (RingGeometry)
            const orbitalPlaneMaterial = new THREE.MeshBasicMaterial({
                color: 0x00ffff, // Cyan color
                transparent: true,
                opacity: 0.05, // Very subtle
                side: THREE.DoubleSide,
            });
            const orbitalPlaneGeometry = new THREE.RingGeometry(0.6371 + 0.05, 0.6371 + 0.06, 64); // Ring around Earth
            const orbitalPlaneMesh = new THREE.Mesh(orbitalPlaneGeometry, orbitalPlaneMaterial);
            orbitalPlaneMesh.rotation.x = Math.PI / 2; // Orient to XY plane initially
            orbitalPlaneMesh.visible = false; // Hide by default
            scene.add(orbitalPlaneMesh); // Add to scene

            return {
                name: data.name,
                type: data.type, // Store type
                satrec,
                mesh: satelliteMesh,
                orbitLine: orbitLine,
                pathPoints: [], // Store points for the orbit path
                label: satelliteLabel,
                groundTrackLine: groundTrackLine,
                groundTrackPoints: [],
                details: data.details, // Store in-depth details
                originalMaterials: {
                    mesh: originalSatelliteMaterial,
                    orbitLine: originalOrbitMaterial,
                },
                highlightMaterials: {
                    mesh: highlightSatelliteMaterial,
                    orbitLine: highlightOrbitMaterial,
                },
                orbitalPlane: orbitalPlaneMesh, // Store orbital plane mesh
            };
        });

        // Create Ground Station meshes
        const groundStationMeshes = GROUND_STATIONS.map(station => {
            const stationPos = geodeticToSpherical(station.latitude, station.longitude, 0, 0.6371 + 0.002); // Slightly above Earth
            const stationGeometry = new THREE.SphereGeometry(0.008, 16, 16); // Small sphere for ground station
            const stationMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Green color
            const stationMesh = new THREE.Mesh(stationGeometry, stationMaterial);
            stationMesh.position.copy(stationPos);
            stationMesh.userData.name = station.name;
            stationMesh.userData.isGroundStation = true; // Tag for raycasting
            stationMesh.userData.type = 'GroundStations'; // Type for filtering
            scene.add(stationMesh);

            // Label for ground station
            const stationLabelDiv = document.createElement('div');
            stationLabelDiv.className = 'ground-station-label flex items-center space-x-1';
            stationLabelDiv.style.color = '#aaffaa'; // Light green text
            stationLabelDiv.style.fontSize = '10px';
            stationLabelDiv.style.backgroundColor = 'rgba(0,0,0,0.6)';
            stationLabelDiv.style.padding = '2px 6px';
            stationLabelDiv.style.borderRadius = '3px';
            stationLabelDiv.style.whiteSpace = 'nowrap';
            stationLabelDiv.style.pointerEvents = 'none';
            stationLabelDiv.innerHTML = `<i class="${station.iconClass}" style="color: #aaffaa;"></i> <span>${station.name}</span>`;
            const stationLabel = new CSS2DObject(stationLabelDiv);
            stationLabel.position.set(0, 0.015, 0); // Offset above the sphere
            stationMesh.add(stationLabel);

            return {
                ...station,
                mesh: stationMesh,
                label: stationLabel,
            };
        });

        setSatellites(newSatellites);
        scene.userData.groundStations = groundStationMeshes; // Store ground stations in scene userData
        if (newSatellites.length > 0) {
            setSelectedSatellite(newSatellites[0]); // Select the first satellite by default
        }

        // Initialize home ground station mesh (hidden by default)
        const homeStationGeometry = new THREE.SphereGeometry(0.01, 16, 16);
        const homeStationMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red for home
        const homeStationMesh = new THREE.Mesh(homeStationGeometry, homeStationMaterial);
        homeStationMesh.name = 'HomeGroundStation';
        homeStationMesh.visible = false; // Initially hidden
        scene.add(homeStationMesh);
        homeGroundStationMeshRef.current = homeStationMesh; // Store reference

        // Label for home ground station
        const homeLabelDiv = document.createElement('div');
        homeLabelDiv.className = 'home-station-label flex items-center space-x-1';
        homeLabelDiv.style.color = '#ffaaaa'; // Light red text
        homeLabelDiv.style.fontSize = '10px';
        homeLabelDiv.style.backgroundColor = 'rgba(0,0,0,0.6)';
        homeLabelDiv.style.padding = '2px 6px';
        homeLabelDiv.style.borderRadius = '3px';
        homeLabelDiv.style.whiteSpace = 'nowrap';
        homeLabelDiv.style.pointerEvents = 'none';
        homeLabelDiv.innerHTML = `<i class="fa-solid fa-house-user" style="color: #ffaaaa;"></i> <span>My Home</span>`;
        const homeLabel = new CSS2DObject(homeLabelDiv);
        homeLabel.position.set(0, 0.015, 0); // Offset above the sphere
        homeStationMesh.add(homeLabel);
        homeGroundStationMeshRef.current.label = homeLabel; // Store label reference too

    }, [scene, isLibsLoaded, labelRenderer, geodeticToSpherical]); // Added geodeticToSpherical to dependencies

    // Effect to handle satellite highlighting and orbital plane visibility when selectedSatellite changes
    useEffect(() => {
        satellites.forEach(sat => {
            if (selectedSatellite && sat.name === selectedSatellite.name) {
                // Apply highlight materials
                sat.mesh.material = sat.highlightMaterials.mesh;
                sat.orbitLine.material = sat.highlightMaterials.orbitLine;
                sat.orbitalPlane.visible = true; // Show orbital plane

                // Focus camera on selected satellite
                if (controls && sat.mesh.position) {
                    controls.target.copy(sat.mesh.position);
                    controls.update();
                }
            } else {
                // Revert to original materials
                sat.mesh.material = sat.originalMaterials.mesh;
                sat.orbitLine.material = sat.originalMaterials.orbitLine;
                sat.orbitalPlane.visible = false; // Hide orbital plane
            }
        });
    }, [selectedSatellite, satellites, controls]);


    // Animation loop for updating satellite positions, Earth rotation, and rendering
    useEffect(() => {
        if (!scene || !camera || !renderer || !controls || satellites.length === 0 || !isLibsLoaded || !labelRenderer || !compassRef.current) return;

        let animationFrameId;
        let lastTimestamp = performance.now();

        const animate = (timestamp) => {
            animationFrameId = requestAnimationFrame(animate);

            // Calculate delta time for consistent animation speed
            const deltaTime = timestamp - lastTimestamp;
            lastTimestamp = timestamp;

            if (!isPaused) {
                // Advance simulation time based on time multiplier
                setSimulationTime(prevTime => {
                    const newTime = new Date(prevTime.getTime() + (deltaTime * timeMultiplier));
                    return newTime;
                });
            }

            // Update Earth rotation based on simulation time (simplified for visual effect)
            // A more accurate rotation would involve sidereal time calculations
            const earth = scene.userData.earth;
            if (earth) {
                earth.rotation.y = simulationTime.getTime() * 0.000000005; // Adjust speed as needed
            }

            // NEW: Rotate clouds independently
            const clouds = scene.userData.clouds;
            if (clouds) {
                clouds.rotation.y += 0.000000002 * deltaTime; // Slightly slower than Earth
            }

            // Update sun light position based on simulation time (simplified)
            const sunLight = scene.userData.sunLight;
            if (sunLight) {
                sunLight.position.x = 5 * Math.cos(simulationTime.getTime() * 0.000000005);
                sunLight.position.z = 5 * Math.sin(simulationTime.getTime() * 0.000000005);

                // Update terminator line based on sun position
                const terminatorLine = scene.userData.terminatorLine;
                if (terminatorLine) {
                    const points = [];
                    const earthRadius = 0.6371; // Match Earth's radius
                    const sunDirection = sunLight.position.clone().normalize();
                    const axis = new THREE.Vector3(0, 1, 0); // Earth's rotation axis (North Pole)

                    // Calculate terminator points
                    for (let i = 0; i <= 360; i += 5) { // 5-degree increments
                        const angle = i * Math.PI / 180;
                        const x = Math.cos(angle) * earthRadius;
                        const z = Math.sin(angle) * earthRadius;
                        const y = 0; // On the equator

                        const point = new THREE.Vector3(x, y, z);
                        // Rotate point to align with Earth's current rotation
                        point.applyAxisAngle(axis, earth.rotation.y);

                        // Calculate dot product with sun direction to find day/night boundary
                        const dot = point.normalize().dot(sunDirection);

                        // If point is on the terminator (dot product close to zero)
                        if (Math.abs(dot) < 0.05) { // Tolerance for "on the line"
                            points.push(point);
                        }
                    }
                    if (points.length > 1) {
                        terminatorLine.geometry.setFromPoints(points);
                        terminatorLine.visible = true;
                    } else {
                        terminatorLine.visible = false;
                    }
                }

                // NEW: Update night lights opacity
                const nightLights = scene.userData.nightLights;
                if (nightLights) {
                    // Calculate the angle between the sun's direction and the camera's direction relative to Earth
                    const sunDirection = sunLight.position.clone().normalize();
                    const cameraDirection = camera.position.clone().normalize();
                    const dotProduct = sunDirection.dot(cameraDirection);

                    // Interpolate opacity: 1 when looking directly away from sun (-1), 0 when looking at sun (1)
                    // Use a smoothstep-like function for a smoother fade
                    const opacity = THREE.MathUtils.smoothstep(dotProduct, -0.8, 0.8); // Adjust range as needed
                    nightLights.material.opacity = 1 - opacity; // Inverse for night side visibility
                }
            }

            satellites.forEach(sat => {
                const positionData = calculateSatellitePosition(sat.satrec, simulationTime);
                if (positionData && positionData.position) { // Ensure positionData and its position property are valid
                    sat.mesh.position.copy(positionData.position);

                    // Update selectedSatelliteDisplayDataRef for the currently selected satellite
                    if (selectedSatellite && sat.name === selectedSatellite.name) {
                        const lookAngles = userHomeLocation && userHomeLocation.latitude != null && userHomeLocation.longitude != null
                            ? getSatelliteLookAngles(sat.satrec, userHomeLocation, simulationTime)
                            : null;
                        selectedSatelliteDisplayDataRef.current = { ...positionData, lookAngles: lookAngles };
                    }

                    // Update path points
                    // Added NaN check before pushing to pathPoints to prevent BufferGeometry errors
                    if (!isNaN(positionData.position.x) && !isNaN(positionData.position.y) && !isNaN(positionData.position.z)) {
                        sat.pathPoints.push(positionData.position.clone());
                        // Keep a reasonable number of points for the path (e.g., last 5000 points for longer trails)
                        if (sat.pathPoints.length > 5000) { // Increased from 1000
                            sat.pathPoints.shift();
                        }
                        sat.orbitLine.geometry.setFromPoints(sat.pathPoints);
                        sat.orbitLine.geometry.attributes.position.needsUpdate = true; // Important for line updates
                    } else {
                        console.warn(`Skipping orbit path point for ${sat.name} due to NaN position:`, positionData.position);
                    }


                    // Update ground track for selected satellite
                    if (selectedSatellite && sat.name === selectedSatellite.name) {
                        const newGroundPoint = geodeticToSpherical(positionData.latitude, positionData.longitude, 0, 0.6371 + 0.001); // Slightly above Earth

                        // Glitch fix: Check for large longitude jumps (antimeridian crossing)
                        if (sat.groundTrackPoints.length > 0) {
                            // Only calculate lastLatLon if needed for the jump check
                            const lastPositionAndVelocity = window.satellite.propagate(sat.satrec, new Date(simulationTime.getTime() - deltaTime * timeMultiplier));
                            const lastPositionEci = lastPositionAndVelocity.position;
                            let lastLatLon = null;
                            if (lastPositionEci && !isNaN(lastPositionEci.x) && !isNaN(lastPositionEci.y) && !isNaN(lastPositionEci.z)) {
                                lastLatLon = window.satellite.eciToGeodetic(lastPositionEci, window.satellite.gstime(new Date(simulationTime.getTime() - deltaTime * timeMultiplier)));
                            }

                            if (lastLatLon && !isNaN(lastLatLon.longitude)) {
                                const currentLatLon = positionData;

                                // Convert longitudes to be in the range of -180 to 180 for consistent comparison
                                const normalizedLastLon = (window.satellite.degreesLong(lastLatLon.longitude) + 540) % 360 - 180;
                                const normalizedCurrentLon = (currentLatLon.longitude + 540) % 360 - 180;

                                const deltaLon = Math.abs(normalizedLastLon - normalizedCurrentLon);

                                // If longitude jump is significant (e.g., > 180 degrees, indicating antimeridian cross)
                                if (deltaLon > 180) { // Degrees
                                    // Start a new segment by clearing previous points
                                    sat.groundTrackPoints = [];
                                }
                            }
                        }
                        // Added NaN check before pushing to groundTrackPoints
                        if (!isNaN(newGroundPoint.x) && !isNaN(newGroundPoint.y) && !isNaN(newGroundPoint.z)) {
                            sat.groundTrackPoints.push(newGroundPoint);
                            if (sat.groundTrackPoints.length > 5000) { // Increased from 300
                                sat.groundTrackPoints.shift();
                            }
                            sat.groundTrackLine.geometry.setFromPoints(sat.groundTrackPoints);
                            sat.groundTrackLine.geometry.attributes.position.needsUpdate = true; // Important for line updates
                        } else {
                            console.warn(`Skipping ground track point for ${sat.name} due to NaN position:`, newGroundPoint);
                        }
                        sat.groundTrackLine.visible = true;

                        // Update orbital plane orientation for selected satellite
                        const inclination = sat.satrec.inclo; // Inclination in radians
                        const raan = sat.satrec.nodeo; // Right Ascension of Ascending Node in radians

                        sat.orbitalPlane.position.copy(earth.position); // Center at Earth
                        sat.orbitalPlane.rotation.set(0, 0, 0); // Reset rotations
                        sat.orbitalPlane.rotateZ(raan); // Rotate around Z (North Pole) by RAAN
                        sat.orbitalPlane.rotateX(inclination); // Tilt by inclination around X-axis (after RAAN)


                    } else {
                        sat.groundTrackLine.visible = false; // Hide ground track for unselected satellites
                        sat.groundTrackPoints = []; // Clear points when unselected
                        sat.orbitalPlane.visible = false; // Hide orbital plane
                    }

                    // Satellite Visibility Logic
                    let isVisible = true;

                    // Apply type filter
                    if (!filters[sat.type]) {
                        isVisible = false;
                    }

                    // 1. Hide behind Earth (from camera's perspective)
                    if (isVisible && hideBehindEarth) {
                        const satPosRelative = sat.mesh.position.clone().sub(earth.position);
                        const cameraPosRelative = camera.position.clone().sub(earth.position);
                        // If dot product is negative, satellite is behind the Earth from camera's view
                        if (satPosRelative.dot(cameraPosRelative) < 0) {
                            isVisible = false;
                        }
                    }

                    // 2. Hide on night side
                    if (isVisible && hideNightSide) {
                        const satPosRelative = sat.mesh.position.clone().sub(earth.position);
                        const sunDirection = sunLight.position.clone().normalize();
                        // If dot product is negative, satellite is on the night side
                        if (satPosRelative.dot(sunDirection) < 0) {
                            isVisible = false;
                        }
                    }

                    sat.mesh.visible = isVisible;
                    sat.label.visible = isVisible; // Also hide label
                    sat.orbitLine.visible = isVisible; // Also hide orbit line
                    // Ground track and orbital plane visibility are handled by selectedSatellite logic
                } else {
                    // If positionData is null/invalid, hide the satellite and its associated elements
                    sat.mesh.visible = false;
                    sat.label.visible = false;
                    sat.orbitLine.visible = false;
                    sat.groundTrackLine.visible = false;
                    sat.orbitalPlane.visible = false;
                }
            });

            // Ground Station Visibility Logic
            if (scene.userData.groundStations) {
                scene.userData.groundStations.forEach(station => {
                    // Check if ground station is visible from the camera's perspective (not behind Earth's curvature)
                    const earth = scene.userData.earth;
                    const stationPosWorld = station.mesh.position.clone();
                    const cameraPosWorld = camera.position.clone();

                    const vecEarthToStation = stationPosWorld.clone().sub(earth.position).normalize();
                    const vecEarthToCamera = cameraPosWorld.clone().sub(earth.position).normalize();

                    // If the dot product is negative, the station is on the opposite side of the Earth from the camera
                    const isStationVisibleFromCamera = vecEarthToStation.dot(vecEarthToCamera) > 0;

                    station.mesh.visible = filters.GroundStations && isStationVisibleFromCamera;
                    station.label.visible = filters.GroundStations && isStationVisibleFromCamera;
                });
            }

            // Update Home Ground Station position and visibility
            if (homeGroundStationMeshRef.current && userHomeLocation && userHomeLocation.latitude != null && userHomeLocation.longitude != null) {
                const homePos = geodeticToSpherical(userHomeLocation.latitude, userHomeLocation.longitude, 0, 0.6371 + 0.002);
                homeGroundStationMeshRef.current.position.copy(homePos);

                // Apply visibility check for home ground station too
                const earth = scene.userData.earth;
                const homeStationPosWorld = homeGroundStationMeshRef.current.position.clone();
                const cameraPosWorld = camera.position.clone();

                const vecEarthToHomeStation = homeStationPosWorld.clone().sub(earth.position).normalize();
                const vecEarthToCamera = cameraPosWorld.clone().sub(earth.position).normalize();

                const isHomeStationVisibleFromCamera = vecEarthToHomeStation.dot(vecEarthToCamera) > 0;

                homeGroundStationMeshRef.current.visible = isHomeStationVisibleFromCamera;
                homeGroundStationMeshRef.current.label.visible = isHomeStationVisibleFromCamera;

            } else if (homeGroundStationMeshRef.current) {
                homeGroundStationMeshRef.current.visible = false;
                homeGroundStationMeshRef.current.label.visible = false;
            }


            // Update compass orientation
            if (compassRef.current && camera) {
                const cameraWorldDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraWorldDirection); // Get camera's forward direction in world space

                // Project onto the XZ plane (assuming Y is up for world North)
                cameraWorldDirection.y = 0; // Ignore vertical component
                cameraWorldDirection.normalize(); // Normalize to get a unit vector

                // Calculate angle from World North (+Z axis) to camera's projected direction
                // Math.atan2(y, x) calculates the angle from the positive X-axis to the point (x, y).
                // We want the angle from the positive Z-axis to the point (cameraWorldDirection.x, cameraWorldDirection.z).
                // So, we use atan2(cameraWorldDirection.x, cameraWorldDirection.z) to get angle from +Z towards +X.
                let angleRad = Math.atan2(cameraWorldDirection.x, cameraWorldDirection.z);

                // Convert radians to degrees
                let angleDeg = angleRad * (180 / Math.PI);

                // Apply inverse rotation to the compass UI element
                // If camera looks North (angleDeg = 0), compass rotates 0. N is at top.
                // If camera looks East (angleDeg = 90), compass rotates -90deg (counter-clockwise). E moves to top.
                compassRef.current.style.transform = `rotateZ(${-angleDeg}deg)`;
            }


            controls.update(); // Update OrbitControls
            renderer.render(scene, camera);
            labelRenderer.render(scene, camera); // Render CSS2D objects
        };

        animate(performance.now()); // Start the animation loop

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [scene, camera, renderer, controls, satellites, isPaused, timeMultiplier, isLibsLoaded, calculateSatellitePosition, geodeticToSpherical, labelRenderer, hideBehindEarth, hideNightSide, filters, userHomeLocation, getSatelliteLookAngles]); // Removed selectedSatellite from dependencies as it's updated in a separate effect

    // Effect to update the displayTime state for UI display every second
    useEffect(() => {
        const timer = setInterval(() => {
            setDisplayTime(new Date());

            // NEW: Update selected satellite data for UI display here, reading from the ref
            if (selectedSatellite && selectedSatelliteDisplayDataRef.current) {
                setSelectedSatellite(prev => {
                    // Only update if the satellite is still the same one selected
                    if (prev && prev.name === selectedSatellite.name) {
                        return {
                            ...prev,
                            currentData: selectedSatelliteDisplayDataRef.current
                        };
                    }
                    return prev;
                });
            }

        }, 1000); // Update every second

        return () => clearInterval(timer);
    }, [selectedSatellite]); // Dependencies: only selectedSatellite. simulationTime, userHomeLocation, etc. are handled by the ref update


    // Click handling for satellite and Earth selection
    const onCanvasClick = useCallback((event) => {
        if (!camera || !renderer || !satellites.length || !scene) return;

        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const mouse = new THREE.Vector2();
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);

        // Collect all interactive objects (satellites and Earth)
        const interactiveObjects = satellites.map(s => s.mesh);
        const earth = scene.getObjectByName('Earth');
        if (earth) {
            interactiveObjects.push(earth);
        }
        // Add ground station meshes to interactive objects
        if (scene.userData.groundStations) {
            scene.userData.groundStations.forEach(station => interactiveObjects.push(station.mesh));
        }
        // Add home ground station mesh if visible
        if (homeGroundStationMeshRef.current && homeGroundStationMeshRef.current.visible) {
            interactiveObjects.push(homeGroundStationMeshRef.current);
        }


        const intersects = raycaster.intersectObjects(interactiveObjects);

        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;

            if (clickedObject.userData.isSatellite) {
                const clickedSatellite = satellites.find(s => s.mesh.userData.name === clickedObject.userData.name);
                if (clickedSatellite) {
                    setSelectedSatellite(clickedSatellite);
                    setClickedEarthCoords(null); // Clear Earth coordinates if a satellite is clicked
                }
            } else if (clickedObject.userData.isGroundStation) {
                const clickedStation = scene.userData.groundStations.find(gs => gs.mesh.userData.name === clickedObject.userData.name);
                if (clickedStation) {
                    // For ground stations, we can display their lat/lon or other details
                    setClickedEarthCoords({
                        latitude: clickedStation.latitude.toFixed(2),
                        longitude: clickedStation.longitude.toFixed(2),
                        name: clickedStation.name,
                        isStation: true
                    });
                    setSelectedSatellite(null);
                }
            } else if (clickedObject.name === 'HomeGroundStation') {
                // Handle click on user's home location marker
                if (userHomeLocation) {
                    setClickedEarthCoords({
                        latitude: userHomeLocation.latitude.toFixed(2),
                        longitude: userHomeLocation.longitude.toFixed(2),
                        name: 'My Home Location',
                        isStation: true // Treat as a station for display purposes
                    });
                    setSelectedSatellite(null);
                }
            }
            else if (clickedObject.name === 'Earth') {
                const intersectionPoint = intersects[0].point;
                // Convert 3D point on Earth to Lat/Lon
                const earthRadius = 0.6371; // Same as Earth geometry radius
                const lat = Math.asin(intersectionPoint.y / earthRadius) * (180 / Math.PI);
                const lon = Math.atan2(intersectionPoint.z, intersectionPoint.x) * (180 / Math.PI);

                setClickedEarthCoords({ latitude: lat.toFixed(2), longitude: lon.toFixed(2) });
                setSelectedSatellite(null); // Clear selected satellite if Earth is clicked
            }
        }
    }, [camera, renderer, satellites, scene, userHomeLocation]);


    useEffect(() => {
        const canvas = mountRef.current;
        if (canvas) {
            canvas.addEventListener('click', onCanvasClick);
        }
        return () => {
            if (canvas) {
                canvas.removeEventListener('click', onCanvasClick);
            }
        };
    }, [onCanvasClick]);

    const handleFilterChange = (type) => {
        setFilters(prevFilters => ({
            ...prevFilters,
            [type]: !prevFilters[type],
        }));
    };

    // State for latitude and longitude input fields
    const [inputLatitude, setInputLatitude] = useState('');
    const [inputLongitude, setInputLongitude] = useState('');

    const handleSetHomeLocation = () => {
        const lat = parseFloat(inputLatitude);
        const lon = parseFloat(inputLongitude);

        if (!isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            setUserHomeLocation({ latitude: lat, longitude: lon });
            // Optionally clear input fields after setting
            // setInputLatitude('');
            // setInputLongitude('');
        } else {
            // Display an error message or provide feedback for invalid input
            console.error("Invalid latitude or longitude. Please enter values between -90 to 90 for latitude and -180 to 180 for longitude.");
            alert("Invalid latitude or longitude. Please enter values between -90 to 90 for latitude and -180 to 180 for longitude.");
        }
    };

    const handleResetView = useCallback(() => {
        if (camera && controls) {
            // Reset camera position
            camera.position.set(0, 0, 2);
            // Reset controls target to origin (center of Earth)
            controls.target.set(0, 0, 0);
            controls.update();
            // Optionally clear any selected satellite or clicked coordinates
            setSelectedSatellite(null);
            setClickedEarthCoords(null);
        }
    }, [camera, controls]);


    return (
        <div className="relative w-full h-screen bg-gray-900 overflow-hidden font-inter">
            {/* Three.js Canvas */}
            <div ref={mountRef} className="absolute inset-0 z-0" />
            {/* CSS2DRenderer container for labels */}
            <div ref={labelRendererRef} className="absolute inset-0 z-10 pointer-events-none" />

            {/* Overlay UI */}
            <div className="absolute top-0 left-0 p-4 w-full md:w-1/3 lg:w-1/4 z-20">
                <div className="bg-gray-800 bg-opacity-90 rounded-xl shadow-2xl p-6 space-y-6"> {/* Increased padding, shadow, rounded corners */}
                    <h1 className="text-3xl font-bold text-white mb-4 tracking-wide">AdiSat Tracker</h1> {/* Larger title, tracking-wide */}

                    {/* Time Control */}
                    <div className="space-y-3"> {/* Added space-y for better spacing */}
                        <h2 className="text-xl font-semibold text-gray-200">Simulation Control</h2>
                        <div className="flex items-center space-x-3"> {/* Increased space-x */}
                            <button
                                onClick={() => setIsPaused(!isPaused)}
                                className="px-6 py-3 rounded-lg shadow-lg text-white font-bold transition-all duration-300 hover:scale-105 transform active:scale-95"
                                style={{ backgroundColor: isPaused ? '#dc2626' : '#16a34a' }} // More vibrant red/green
                                aria-label={isPaused ? "Play simulation" : "Pause simulation"}
                            >
                                {isPaused ? 'Play' : 'Pause'}
                            </button>
                            <input
                                type="range"
                                min="1"
                                max="3600" // Max speed: 1 hour per second
                                value={timeMultiplier}
                                onChange={(e) => setTimeMultiplier(Number(e.target.value))}
                                className="flex-grow h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500" // Styled slider
                                aria-label="Simulation speed multiplier"
                            />
                            <span className="text-sm text-gray-300">{timeMultiplier}x Speed</span>
                        </div>
                        <button
                            onClick={handleResetView}
                            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-lg font-bold hover:bg-indigo-700 transition-all duration-300 hover:scale-105 transform active:scale-95"
                            aria-label="Reset camera view"
                        >
                            Reset View
                        </button>
                    </div>

                    {/* Time Display */}
                    <div className="bg-gray-700 bg-opacity-80 p-4 rounded-lg shadow-md border border-gray-600"> {/* Styled card */}
                        <p className="text-sm text-gray-200 leading-relaxed">
                            <span className="font-semibold text-white">Simulation Time:</span> {simulationTime.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-200 leading-relaxed">
                            <span className="font-semibold text-white">Real World Time:</span> {displayTime.toLocaleString()}
                        </p>
                    </div>

                    {/* Satellite Visibility Toggles */}
                    <div className="space-y-2 border-t pt-4 mt-4 border-gray-700">
                        <h3 className="text-xl font-semibold text-gray-200 mb-2">Visibility Options:</h3>
                        <label className="flex items-center text-gray-300 text-sm cursor-pointer hover:text-white transition-colors duration-200">
                            <input
                                type="checkbox"
                                className="form-checkbox h-5 w-5 text-blue-500 rounded focus:ring-blue-500"
                                checked={hideBehindEarth}
                                onChange={(e) => setHideBehindEarth(e.target.checked)}
                                aria-label="Toggle visibility of satellites behind Earth"
                            />
                            <span className="ml-3">Hide Satellites Behind Earth</span>
                        </label>
                        <label className="flex items-center text-gray-300 text-sm cursor-pointer hover:text-white transition-colors duration-200">
                            <input
                                type="checkbox"
                                className="form-checkbox h-5 w-5 text-blue-500 rounded focus:ring-blue-500"
                                checked={hideNightSide}
                                onChange={(e) => setHideNightSide(e.target.checked)}
                                aria-label="Toggle visibility of satellites on night side"
                            />
                            <span className="ml-3">Hide Night-Side Satellites</span>
                        </label>
                    </div>

                    {/* Satellite Type Filters */}
                    <div className="space-y-2 border-t pt-4 mt-4 border-gray-700">
                        <h3 className="text-xl font-semibold text-gray-200 mb-2">Filters:</h3>
                        {Object.keys(filters).map(type => (
                            <label key={type} className="flex items-center text-gray-300 text-sm cursor-pointer hover:text-white transition-colors duration-200">
                                <input
                                    type="checkbox"
                                    className="form-checkbox h-5 w-5 text-purple-500 rounded focus:ring-purple-500"
                                    checked={filters[type]}
                                    onChange={() => handleFilterChange(type)}
                                    aria-label={`Toggle visibility for ${type} satellites`}
                                />
                                <span className="ml-3">{type.replace(/([A-Z])/g, ' $1').trim()}</span>
                            </label>
                        ))}
                    </div>

                    {/* New UI for Home Location Input */}
                    <div className="border-t pt-4 mt-4 border-gray-700">
                        <h3 className="text-xl font-semibold text-gray-200 mb-2">Set My Home Location:</h3>
                        <div className="flex flex-col space-y-3">
                            <input
                                type="number"
                                placeholder="Latitude (-90 to 90)"
                                step="0.01"
                                value={inputLatitude}
                                onChange={(e) => setInputLatitude(e.target.value)}
                                className="p-3 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm shadow-inner"
                                aria-label="Home location latitude input"
                            />
                            <input
                                type="number"
                                placeholder="Longitude (-180 to 180)"
                                step="0.01"
                                value={inputLongitude}
                                onChange={(e) => setInputLongitude(e.target.value)}
                                className="p-3 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm shadow-inner"
                                aria-label="Home location longitude input"
                            />
                            <button
                                onClick={handleSetHomeLocation}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg font-bold hover:bg-blue-700 transition-colors duration-200 hover:scale-105 transform active:scale-95"
                                aria-label="Set home location"
                            >
                                Set Home Location
                            </button>
                        </div>
                        {userHomeLocation && (
                            <p className="text-xs text-gray-400 mt-2">
                                Current Home: Lat {userHomeLocation.latitude.toFixed(2)}°, Lon {userHomeLocation.longitude.toFixed(2)}°
                            </p>
                        )}
                    </div>


                    {/* Satellite Selector */}
                    <div className="border-t pt-4 mt-4 border-gray-700">
                        <label htmlFor="satellite-search" className="block text-xl font-semibold text-gray-200 mb-2">
                            Find Satellite:
                        </label>
                        <input
                            id="satellite-search"
                            type="text"
                            placeholder="Search satellites..."
                            value={satelliteSearchQuery}
                            onChange={(e) => setSatelliteSearchQuery(e.target.value)}
                            className="w-full p-3 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm shadow-inner mb-3"
                            aria-label="Search satellite by name"
                        />
                        <label htmlFor="satellite-select" className="block text-md font-medium text-gray-300 mb-1">
                            Select from list:
                        </label>
                        <select
                            id="satellite-select"
                            className="mt-1 block w-full pl-4 pr-12 py-3 text-base bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-md appearance-none cursor-pointer"
                            onChange={(e) => {
                                const selectedName = e.target.value;
                                const sat = satellites.find(s => s.name === selectedName);
                                setSelectedSatellite(sat);
                                setClickedEarthCoords(null); // Clear Earth coords when satellite selected
                            }}
                            value={selectedSatellite ? selectedSatellite.name : ''}
                            disabled={!isLibsLoaded || satellites.length === 0}
                            aria-label="Select a satellite from the list"
                        >
                            {isLibsLoaded && satellites.length > 0 ? (
                                satellites
                                    .filter(sat => sat.name.toLowerCase().includes(satelliteSearchQuery.toLowerCase()))
                                    .map(sat => (
                                        <option key={sat.name} value={sat.name}>
                                            {sat.name}
                                        </option>
                                    ))
                            ) : (
                                <option value="">Loading Satellites...</option>
                            )}
                        </select>
                    </div>

                    {/* Selected Satellite Details */}
                    {selectedSatellite && selectedSatellite.currentData && (
                        <div className="bg-blue-700 bg-opacity-80 p-4 rounded-lg shadow-md border border-blue-600">
                            <h2 className="text-xl font-semibold text-white mb-2 leading-tight">
                                {selectedSatellite.name}
                            </h2>
                            <p className="text-sm text-gray-200 leading-relaxed">
                                <span className="font-medium">Type:</span> {selectedSatellite.type}
                            </p>
                            <p className="text-sm text-gray-200 leading-relaxed">
                                <span className="font-medium">Latitude:</span> {selectedSatellite.currentData.latitude.toFixed(2)}°
                            </p>
                            <p className="text-sm text-gray-200 leading-relaxed">
                                <span className="font-medium">Longitude:</span> {selectedSatellite.currentData.longitude.toFixed(2)}°
                            </p>
                            <p className="text-sm text-gray-200 leading-relaxed">
                                <span className="font-medium">Altitude:</span> {selectedSatellite.currentData.altitude.toFixed(2)} km
                            </p>
                            <p className="text-sm text-gray-200 leading-relaxed">
                                <span className="font-medium">Velocity:</span> {selectedSatellite.currentData.velocity.toFixed(2)} km/s
                            </p>

                            {/* New section for Home Location Tracking */}
                            {userHomeLocation && selectedSatellite.currentData.lookAngles && (
                                <div className="mt-4 pt-4 border-t border-blue-600">
                                    <h3 className="text-md font-semibold text-blue-200 mb-2 leading-tight">From My Home Location:</h3>
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                        <span className="font-medium">Azimuth:</span> {(selectedSatellite.currentData.lookAngles.azimuth * 180 / Math.PI).toFixed(2)}°
                                    </p>
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                        <span className="font-medium">Elevation:</span> {(selectedSatellite.currentData.lookAngles.elevation * 180 / Math.PI).toFixed(2)}°
                                    </p>
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                        <span className="font-medium">Range:</span> {selectedSatellite.currentData.lookAngles.range.toFixed(2)} km
                                    </p>
                                    {selectedSatellite.currentData.lookAngles.elevation < 0 && (
                                        <p className="text-xs text-red-400 mt-1">Satellite is below the horizon from your location.</p>
                                    )}
                                </div>
                            )}

                            {/* In-depth Details */}
                            {selectedSatellite.details && (
                                <div className="mt-4 pt-4 border-t border-blue-600">
                                    <h3 className="text-md font-semibold text-blue-200 mb-2 leading-tight">Details:</h3>
                                    {Object.entries(selectedSatellite.details).map(([key, value]) => (
                                        <p key={key} className="text-xs text-gray-400 leading-relaxed">
                                            <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span> {value}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Clicked Earth Coordinates / Ground Station Info */}
                    {clickedEarthCoords && (
                        <div className="bg-green-700 bg-opacity-80 p-4 rounded-lg shadow-md border border-green-600">
                            <h2 className="text-xl font-semibold text-white mb-2 leading-tight">
                                {clickedEarthCoords.isStation ? `Ground Station: ${clickedEarthCoords.name}` : 'Clicked Earth Location'}
                            </h2>
                            <p className="text-sm text-gray-200 leading-relaxed">
                                <span className="font-medium">Latitude:</span> {clickedEarthCoords.latitude}°
                            </p>
                            <p className="text-sm text-gray-200 leading-relaxed">
                                <span className="font-medium">Longitude:</span> {clickedEarthCoords.longitude}°
                            </p>
                        </div>
                    )}

                    {!isLibsLoaded && (
                        <div className="bg-yellow-600 bg-opacity-90 p-5 rounded-lg text-center text-yellow-900 font-bold text-lg shadow-xl animate-pulse">
                            Loading Libraries... Please wait.
                        </div>
                    )}

                    <p className="text-xs text-gray-400 mt-4 leading-relaxed">
                        *Drag the globe to rotate the view. Click on satellites to select. Click on Earth/markers to get coordinates.
                    </p>
                </div>
            </div>

            {/* Compass UI */}
            <div className="absolute bottom-6 right-6 z-20"> {/* Adjusted position */}
                <div ref={compassRef} className="relative w-28 h-28 bg-white bg-opacity-80 rounded-full shadow-xl flex items-center justify-center transition-transform duration-100 ease-linear"> {/* Slightly larger, more opaque */}
                    <div className="absolute text-base font-bold text-red-600" style={{ top: '10px' }}>N</div> {/* Larger text */}
                    <div className="absolute text-base font-bold text-gray-700" style={{ bottom: '10px' }}>S</div>
                    <div className="absolute text-base font-bold text-gray-700" style={{ left: '10px' }}>W</div>
                    <div className="absolute text-base font-bold text-gray-700" style={{ right: '10px' }}>E</div>
                    <i className="fa-solid fa-compass text-5xl text-gray-800"></i> {/* Larger icon */}
                </div>
            </div>
        </div>
    );
};

export default App;
