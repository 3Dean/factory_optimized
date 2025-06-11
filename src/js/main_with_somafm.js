// At the beginning of your code, enhance your device detection
const isMobile = /Mobi|Android/i.test(navigator.userAgent);
const isLowPowerDevice = isMobile || /iPad|iPhone|iPod/.test(navigator.userAgent);

// Function to toggle light helpers visibility
/* function toggleLightHelpers() {
  if (lightHelpers.length === 0) {
    console.log("No light helpers to toggle");
    return;
  }
  
  // Toggle visibility of all helpers
  let currentState = null;
  
  // Get current state from first helper
  if (lightHelpers[0]) {
    currentState = lightHelpers[0].visible;
  }
  
  // Toggle to opposite state
  const newState = (currentState === null) ? true : !currentState;
  
  lightHelpers.forEach(helper => {
    helper.visible = newState;
  });
  
  console.log(`Light helpers ${newState ? 'shown' : 'hidden'}`);
} */
import '../style.css'
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ColorManagement, SRGBColorSpace, ACESFilmicToneMapping } from 'three';

// Global variables and state
let scene, camera, renderer;
let player, navmesh;
let audioContext, audioSource, gainNode;
let audioInitialized = false;
let pointLights = [];
let hues = [];
let particleSystem;
let analyser, audioDataArray;
let fluffyTrees = [];
let lastTime = 0;
let windMaterials = [];
let flowerParts = [];
let interactiveModels = []; // Store interactive models
let raycaster; // For detecting clicks on models
//let lightHelpers = []; // Store light helpers

// SOMA FM Audio Variables
let audioElement;
let sound;
let isPlaying = false;
let selectedStationIndex = 0;
let somaStations = [];

// Performance optimization: Create reusable vectors outside functions
const cameraDirection = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const oldPosition = new THREE.Vector3();
const velocity = new THREE.Vector3();
const mouse = new THREE.Vector2(); // For interactive model clicking
let verticalVelocity = 0;

// Debug flag for development
const DEBUG = false;

// Constants
const playerHeight = 1.9;
const playerRadius = 0.25;
const moveSpeed = 0.1;
const gravity = 0.01;
const jumpForce = 0.25;
let isOnGround = false;

// Object to store loaded models
let models = {};

// For wind animation
const windSettings = {
  strength: 0.1,
  speed: 1.5,
  chaos: 0.2,
  maxAngle: 0.15,
};

// Player movement state
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  shift: false,
};

// Mouse and touch controls
let mouseEnabled = false;
let mouseX = 0, mouseY = 0;
let playerDirection = new THREE.Vector3(0, 0, -1);
let euler = new THREE.Euler(0, Math.PI / 2, 0, "YXZ");

// Shader definitions
const foliageVertexShader = `
uniform float u_windTime;
uniform float u_effectBlend;
uniform float u_scale;

void main() {
  // Get camera-facing direction
  vec3 cameraDir = normalize(cameraPosition - position);
  
  // Create billboarding effect
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), cameraDir));
  vec3 up = cross(cameraDir, right);
  
  // Offset based on UV
  vec2 offset = (uv - 0.5) * 2.0 * u_scale;
  
  // Add wind animation
  float wind = sin(u_windTime + position.x + position.z) * 0.1;
  
  // Transform position
  vec4 finalPosition = modelViewMatrix * vec4(position, 1.0);
  
  // Apply billboarding and wind with blend factor
  finalPosition.xyz += (right * offset.x + up * offset.y) * u_effectBlend;
  finalPosition.x += wind * u_effectBlend;
  
  // Project to clip space
  gl_Position = projectionMatrix * finalPosition;
}
`;

// Wait for everything to load
window.addEventListener("load", init);

// Function to load fluffy trees
async function loadFluffyTrees() {
  
  // Clear any existing fluffy trees
  fluffyTrees = [];
  
  const treePositions = [
    //Row 1
    { pos: [39.26, 1.76, -24.72], scale: [1, 1, 1], rotation: [0, Math.PI / 2, 0], },
    { pos: [48.63, 1.56, -18.37], scale: [0.8, 0.8, 0.8], rotation: [0, Math.PI / 2, 0],  },
    { pos: [52, 1.46, -5.5], scale: [1.6, 1.6, 1.6], rotation: [0, Math.PI / 2, 0],  },
    { pos: [51.36, 1.32, 4.56], scale: [0.8, 0.8, 0.8], rotation: [0, Math.PI / 2, 0],  },
    { pos: [41.87, 1.25, 18], scale: [1.8, 1.8, 1.8], rotation: [0, Math.PI / 2, 0],  },
    
    //Row 2
    { pos: [63.62, 4, -33.36], scale: [1.2, 1.2, 1.2], rotation: [0, Math.PI / 2, 0],  },
    { pos: [67.23, 2, -18.13], scale: [1.1, 1.1, 1.1], rotation: [0, Math.PI / 2, 0],  },
    { pos: [67.21, 3.14, -9], scale: [1.4, 1.4, 1.4], rotation: [0, Math.PI / 2, 0],  },
    { pos: [66.54, 3.42, 4], scale: [1.6, 1.6, 1.6], rotation: [0, Math.PI / 2, 0],  },
    { pos: [65.71, 3, 17.13], scale: [1.4, 1.4, 1.4], rotation: [0, Math.PI / 2, 0],  },
    { pos: [67.2, 3.46, 34.18], scale: [1.8, 1.8, 1.8], rotation: [0, Math.PI / 2, 0],  }
  ];
  
  try {
    // Import the improved tree class
    const module = await import('./tree/ImprovedFluffyTree.js');
    const ImprovedFluffyTree = module.ImprovedFluffyTree;
    
    // Load each tree
    const treePromises = treePositions.map(async (treeData) => {
      try {
        const tree = new ImprovedFluffyTree();
        const treeGroup = await tree.load(
          '/assets/models/tree.glb',           // Model path
          '/assets/textures/foliage_alpha3.png', // Alpha texture 
          treeData.pos,
          treeData.scale,
          treeData.rotation
        );
        
        scene.add(treeGroup);
        fluffyTrees.push(tree);
        if (DEBUG) console.log('Improved fluffy tree added at', treeData.pos);
        return tree;
      } catch (error) {
        console.error('Failed to load fluffy tree:', error);
        return null;
      }
    });
    
    const trees = await Promise.all(treePromises);
    console.log(`Successfully loaded ${trees.filter(Boolean).length} fluffy trees`);
    return trees.filter(Boolean);
  } catch (error) {
    console.error("Failed to import ImprovedFluffyTree module:", error);
    return [];
  }
}

// Define artworks with their URLs
const artworks = [
  {
    name: "artwork01",
    url: "assets/models/artwork01.glb",
    position: new THREE.Vector3(-20, 5.5, -33.2),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(0, 0, 0),
    linkUrl: "https://nearhub.club/hLyuPmW/", // URL to open when clicked
  },
  {
    name: "artwork02",
    url: "assets/models/artwork02.glb",
    position: new THREE.Vector3(-31.19, 5.5, -33.2),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(0, 0, 0),
    linkUrl: "https://nearhub.club/kcPYd6i/south-east-asian-hub", // URL to open when clicked
  },
  {
    name: "artwork03",
    url: "assets/models/artwork03.glb",
    position: new THREE.Vector3(-34.8, 5.5, -28.9),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
    linkUrl: "https://nearhub.club/i2VFvT8/mutidao-amphitheater", // URL to open when clicked
  },
  {
    name: "artwork04",
    url: "assets/models/artwork04.glb",
    position: new THREE.Vector3(-34.8, 5.5, -21.58),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
    linkUrl: "https://nearhub.club/S5oDAd5/", // URL to open when clicked
  },
  {
    name: "artwork05",
    url: "assets/models/artwork05.glb",
    position: new THREE.Vector3(-34.8, 5.5, -14.51),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
    linkUrl: "https://nearhub.club/kGRfWy6/adam-4-artists", // URL to open when clicked
  },
  {
    name: "artwork06",
    url: "assets/models/artwork06.glb",
    position: new THREE.Vector3(-34.8, 5.5, -7.25),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
    linkUrl: "https://nearhub.club/n8avADG/near-at-ethdenver-23", // URL to open when clicked
  },
  {
    name: "artwork07",
    url: "assets/models/artwork07.glb",
    position: new THREE.Vector3(-34.8, 5.5, 0.2),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(0, Math.PI / 2, 0),
    linkUrl: "https://nearhub.club/hoXFRGi/metaverseradio-studio", // URL to open when clicked
  },
  {
    name: "artwork08",
    url: "assets/models/artwork08.glb",
    position: new THREE.Vector3(-30.85, 5.5, 4.35),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(0, Math.PI, 0),
    linkUrl: "https://nearhub.club/jJQy3wn/collegelasalle-signature2024", // URL to open when clicked
  },
  {
    name: "artwork09",
    url: "assets/models/artwork09.glb",
    position: new THREE.Vector3(-20.25, 5.5, 4.35),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(0, Math.PI, 0),
    linkUrl: "https://nearhub.club/oZcg4pC/thespians-hub", // URL to open when clicked
  },
  {
    name: "artwork10",
    url: "assets/models/artwork10.glb",
    position: new THREE.Vector3(-16.52, 5.5, -28.3),
    scale: new THREE.Vector3(1, 1, 1),
    rotation: new THREE.Euler(0, -Math.PI / 2, 0),
    linkUrl: "https://main.d1dejm6fbp1yzl.amplifyapp.com/", // URL to open when clicked
  }
];

// Main initialization function
function init() {
  // Initialize audio system
  setupSomaFMAudio();

  // Initialize raycaster for interactive models
  raycaster = new THREE.Raycaster();

  // Add event listener for model clicks
  window.addEventListener('click', onModelClick);
  window.addEventListener('mousemove', onMouseMove);
  
  // Create a debug info element
  if (DEBUG) {
    const debugElement = document.createElement('div');
    debugElement.id = 'debug-info';
    debugElement.style.position = 'absolute';
    debugElement.style.top = '10px';
    debugElement.style.left = '10px';
    debugElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    debugElement.style.color = 'white';
    debugElement.style.padding = '10px';
    debugElement.style.borderRadius = '5px';
    debugElement.style.fontFamily = 'monospace';
    debugElement.style.zIndex = '1000';
    document.body.appendChild(debugElement);
  }

  // Start the application
  start();
}

// Setup SOMA FM audio system
function setupSomaFMAudio() {
  // Define SOMA FM stations
  somaStations = [
    { name: 'Groove Salad (Chill)', stream: 'https://ice4.somafm.com/groovesalad-128-mp3', info: 'https://api.somafm.com/channels/groovesalad.json', mood: 'chill' },
    { name: 'Secret Agent (Jazz)', stream: 'https://ice6.somafm.com/secretagent-128-mp3', info: 'https://api.somafm.com/channels/secretagent.json', mood: 'jazz' },
    { name: 'Metal Detector (Metal)', stream: 'https://ice1.somafm.com/metal-128-mp3', info: 'https://api.somafm.com/channels/metal.json', mood: 'metal' },
    { name: 'Drone Zone', stream: 'https://ice1.somafm.com/dronezone-128-mp3', info: 'https://api.somafm.com/channels/dronezone.json', mood: 'drone' },
    { name: 'DEF CON Radio', stream: 'https://ice4.somafm.com/defcon-128-mp3', info: 'https://api.somafm.com/channels/defcon.json', mood: 'defcon' },
    { name: 'Beat Blender', stream: 'https://ice2.somafm.com/beatblender-128-mp3', info: 'https://api.somafm.com/channels/beatblender.json', mood: 'beat' },
    { name: 'Doomed (Dark)', stream: 'https://ice6.somafm.com/doomed-128-mp3', info: 'https://api.somafm.com/channels/doomed.json', mood: 'dark' },
    { name: 'Dub Step Beyond', stream: 'https://ice2.somafm.com/dubstep-128-mp3', info: 'https://api.somafm.com/channels/dubstep.json', mood: 'dubstep' },
    { name: 'Indie Pop Rocks', stream: 'https://ice1.somafm.com/indiepop-128-mp3', info: 'https://api.somafm.com/channels/indiepop.json', mood: 'indie' },
    { name: 'Mission Control', stream: 'https://ice6.somafm.com/missioncontrol-128-mp3', info: 'https://api.somafm.com/channels/missioncontrol.json', mood: 'space' }
  ];

  // Create a container for audio controls
  const audioControlsContainer = document.createElement('div');
  audioControlsContainer.style.position = 'fixed';
  audioControlsContainer.style.bottom = '20px';
  audioControlsContainer.style.left = '20px';
  audioControlsContainer.style.zIndex = '1000';
  audioControlsContainer.style.display = 'flex';
  audioControlsContainer.style.alignItems = 'center';
  audioControlsContainer.style.gap = '10px';
  document.body.appendChild(audioControlsContainer);

  // Create play button
  const playButton = document.createElement('button');
  playButton.textContent = 'Play Music';
  playButton.style.padding = '8px 16px';
  playButton.style.backgroundColor = '#9e552f';
  playButton.style.color = 'white';
  playButton.style.border = 'none';
  playButton.style.borderRadius = '4px';
  playButton.style.cursor = 'pointer';
  playButton.style.fontSize = '14px';
  playButton.id = 'play-pause';
  audioControlsContainer.appendChild(playButton);

  // Dropdown to select station
  const stationSelect = document.createElement('select');
  stationSelect.style.padding = '6px';
  stationSelect.style.borderRadius = '4px';
  stationSelect.style.cursor = 'pointer';
  stationSelect.style.fontSize = '12px';
  stationSelect.style.backgroundColor = '#333';
  stationSelect.style.color = '#fff';
  stationSelect.id = 'station-select';

  somaStations.forEach((station, index) => {
    const option = document.createElement('option');
    option.value = index.toString();
    option.textContent = station.name;
    stationSelect.appendChild(option);
  });
  audioControlsContainer.appendChild(stationSelect);

  // Create volume slider
  const volumeSlider = document.createElement('input');
  volumeSlider.type = 'range';
  volumeSlider.min = '0';
  volumeSlider.max = '1';
  volumeSlider.step = '0.1';
  volumeSlider.value = '0.5';
  volumeSlider.style.width = '100px';
  volumeSlider.style.cursor = 'pointer';
  volumeSlider.style.pointerEvents = 'auto';
  volumeSlider.id = 'volume-slider';
  // Explicitly apply styles for track and appearance
  volumeSlider.style.webkitAppearance = 'none';
  volumeSlider.style.appearance = 'none';
  volumeSlider.style.height = '8px';
  volumeSlider.style.borderRadius = '4px';
  volumeSlider.style.background = '#444'; // Track color
  volumeSlider.style.outline = 'none';

  // Create volume label
  const volumeLabel = document.createElement('span');
  volumeLabel.textContent = 'Volume: 50%';
  volumeLabel.style.color = 'white';
  volumeLabel.style.fontSize = '14px';
  volumeLabel.style.marginRight = '5px';
  volumeLabel.id = 'volume-label';

  // Add volume slider to container
  audioControlsContainer.appendChild(volumeSlider);

  // Create HTML audio element for streaming
  audioElement = document.createElement('audio');
  audioElement.style.display = 'none'; // Hide the audio element
  audioElement.crossOrigin = 'anonymous';
  audioElement.preload = 'none'; // Don't preload until user clicks play
  document.body.appendChild(audioElement);

  // Set initial station
  audioElement.src = somaStations[selectedStationIndex].stream;

  // Add loading indicator CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  // Initialize audio context when user interacts
  window.addEventListener("touchstart", initializeAudioContext, { once: true });
  window.addEventListener("click", initializeAudioContext, { once: true });
}

function initializeAudioContext() {
  if (audioInitialized) return;
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Create listener for Three.js audio
    const listener = new THREE.AudioListener();
    camera.add(listener);
    
    // Connect the HTML audio element to Three.js audio system
    sound = new THREE.Audio(listener);
    sound.setMediaElementSource(audioElement);
    
    // Create analyzer for visualizations
    analyser = new THREE.AudioAnalyser(sound, 128);
    audioDataArray = new Uint8Array(analyser.frequencyBinCount);
    
    // Set initial volume
    const volumeSlider = document.getElementById("volume-slider");
    audioElement.volume = volumeSlider.value;
    
    // Add event listeners for audio controls
    document.getElementById("play-pause").addEventListener("click", toggleAudio);
    document.getElementById("volume-slider").addEventListener("input", updateVolume);
    document.getElementById("station-select").addEventListener("change", changeStation);
    
    // Handle audio loading events
    audioElement.addEventListener('waiting', () => {
      const playButton = document.getElementById("play-pause");
      playButton.textContent = 'Loading...';
      playButton.disabled = true;
      playButton.style.backgroundColor = '#6c757d';
      
      // Add loading indicator if not already present
      if (!playButton.querySelector('span')) {
        const loadingIndicator = document.createElement('span');
        loadingIndicator.textContent = ' ⟳';
        loadingIndicator.style.display = 'inline-block';
        loadingIndicator.style.animation = 'spin 1s linear infinite';
        playButton.appendChild(loadingIndicator);
      }
    });

    audioElement.addEventListener('playing', () => {
      const playButton = document.getElementById("play-pause");
      playButton.textContent = 'Pause';
      playButton.disabled = false;
      playButton.style.backgroundColor = '#dc3545';
    });

    audioElement.addEventListener('error', (e) => {
      console.error('Audio error:', e);
    });
    
    audioInitialized = true;
    console.log("Audio context initialized");
  } catch (e) {
    console.error("Web Audio API not supported in this browser:", e);
  }
}

function toggleAudio() {
  if (!audioInitialized) {
    initializeAudioContext();
    return;
  }
  
  const playButton = document.getElementById("play-pause");
  
  if (!isPlaying) {
    // Show loading state
    playButton.textContent = 'Loading...';
    playButton.disabled = true;
    playButton.style.backgroundColor = '#6c757d';
    
    // Add loading indicator
    const loadingIndicator = document.createElement('span');
    loadingIndicator.textContent = ' ⟳';
    loadingIndicator.style.display = 'inline-block';
    loadingIndicator.style.animation = 'spin 1s linear infinite';
    playButton.appendChild(loadingIndicator);
    
    // Start loading the audio
    audioElement.load();
    
    // Play when ready
    audioElement.play().then(() => {
      isPlaying = true;
      playButton.textContent = 'Pause';
      playButton.disabled = false;
      playButton.style.backgroundColor = '#dc3545'; // Red for pause
    }).catch(error => {
      console.error('Error playing audio:', error);
      playButton.textContent = 'Play Music';
      playButton.disabled = false;
      playButton.style.backgroundColor = '#824323';
    });
  } else {
    audioElement.pause();
    isPlaying = false;
    playButton.textContent = 'Play Music';
    playButton.style.backgroundColor = '#9e552f'; // Blue for play
  }
}

function updateVolume() {
  const volumeSlider = document.getElementById("volume-slider");
  const volumeLabel = document.getElementById("volume-label");
  const volumeValue = volumeSlider.value;
  
  // Update volume label
  volumeLabel.textContent = `Volume: ${Math.round(volumeValue * 100)}%`;
  
  // Update audio element volume
  audioElement.volume = volumeValue;
}

function changeStation() {
  const stationSelect = document.getElementById("station-select");
  selectedStationIndex = parseInt(stationSelect.value);
  const selected = somaStations[selectedStationIndex];

  audioElement.src = selected.stream;
  audioElement.load();
  
  if (isPlaying) {
    audioElement.play();
    const playButton = document.getElementById("play-pause");
    playButton.textContent = 'Pause';
    playButton.style.backgroundColor = '#dc3545';
  }
}

// Setup the scene
function setupScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.y = playerHeight;
  camera.rotation.copy(euler);
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = .2;
  renderer.outputColorSpace = SRGBColorSpace;
  ColorManagement.enabled = true;
  document.body.appendChild(renderer.domElement);

  addLighting();
  loadEnvironmentMap();
  addParticles();

  // Handle window resize
  window.addEventListener("resize", onWindowResize);
}

function addLighting() {
  // Clear any existing light helpers
/*   lightHelpers.forEach(helper => {
    if (helper.parent) {
      helper.parent.remove(helper);
    }
  }); */
  //lightHelpers = [];
  
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0x92728e, isLowPowerDevice ? 15 : 2);
  scene.add(ambientLight);

  // Directional light
  const directionalLight = new THREE.DirectionalLight(0xa1cff7, isLowPowerDevice ? 10 : 8);
  directionalLight.position.set(0, 10, 0);
  scene.add(directionalLight);

   // Skip additional lights on low-power devices
   if (isLowPowerDevice) {
    console.log("Using simplified lighting for mobile device");
    return;
  }
  
/*   // Add directional light helper
  const directionalHelper = new THREE.DirectionalLightHelper(directionalLight, 5);
  scene.add(directionalHelper);
  lightHelpers.push(directionalHelper); */

  

  // Point lights (original array for color cycling)
  const positions = [
    new THREE.Vector3(-9, 5, 0),     // Light 1
    //new THREE.Vector3(-6.7, 5, -3.36),     // Light 2
    //new THREE.Vector3(-6.7, 5, 3.17),    // Light 3
    //new THREE.Vector3(-11, 5, 3.13)     // Light 4
  ];
  
  positions.forEach((pos, i) => {
    const light = new THREE.PointLight(0xffffff, 300, 50, 2);
    light.position.copy(pos);
    scene.add(light);
    pointLights.push(light);
    hues.push(Math.random()); // optional: gives each light a different starting color
    
/*     // Add point light helper
    const pointLightHelper = new THREE.PointLightHelper(light, 1);
    scene.add(pointLightHelper);
    lightHelpers.push(pointLightHelper); */
  });
  
    
  // Method 2: Custom cycling light with its own parameters
  const customLight = new THREE.PointLight(0xff00ff, 300, 60, 2); // Start with magenta
  customLight.position.set(-26, 8, -13);
  customLight.userData = {
    cycleSpeed: 0.002, // Faster color cycling
    hue: Math.random(), // Random starting hue
    saturation: 0.9,
    lightness: 0.7
  };
  scene.add(customLight);
  window.customLights = window.customLights || [];
  window.customLights.push(customLight);
  
/*   // Add helper for custom light
  const customLightHelper = new THREE.PointLightHelper(customLight, 1);
  scene.add(customLightHelper);
  lightHelpers.push(customLightHelper); */
    
}

// Function to add lights to all interactive artworks
function addArtworkLights(artworksData) {
  // Skip artwork lights entirely on mobile
  if (isLowPowerDevice) {
    console.log("Skipping artwork lights on mobile device");
    return;
  }
  // Check if artworksData is defined, otherwise use the global artworks array
  const artworkItems = artworksData || artworks;
  
  // Clear any existing artwork lights
  if (window.artworkLights && window.artworkLights.length > 0) {
    window.artworkLights.forEach(item => {
      if (item.light && item.light.parent) {
        item.light.parent.remove(item.light);
      }
      if (item.helper && item.helper.parent) {
        item.helper.parent.remove(item.helper);
      }
    });
  }
  
  // Initialize or reset the artwork lights array
  window.artworkLights = [];
  
  // Create a light for each artwork
  if (artworkItems && artworkItems.length > 0) {
    artworkItems.forEach((artworkData, index) => {
      // Create a point light for this artwork
      const artworkLight = new THREE.PointLight(0xffffff, 100, 5, 2);
      
      // Initial position - will be updated in the animation loop to follow rotation
      artworkLight.position.set(
        artworkData.position.x, 
        artworkData.position.y,
        artworkData.position.z
      );
      
      // Add additional properties to the light
      artworkLight.userData = {
        artworkIndex: index,
        artworkName: artworkData.name,
        pulseSpeed: 0.003 + (index * 0.001), // Different pulse speed for each artwork
        minIntensity: 80,
        maxIntensity: 150
      };
      
      // Add the light to the scene
      scene.add(artworkLight);
      
/*       // Create helper for this light
      const artworkLightHelper = new THREE.PointLightHelper(artworkLight, 1);
      scene.add(artworkLightHelper);
      lightHelpers.push(artworkLightHelper); */
      
      // Store reference to both light and helper
      window.artworkLights.push({
        light: artworkLight,
        //helper: artworkLightHelper,
        artworkIndex: index
      });
      
      console.log(`Artwork light added for: ${artworkData.name} (index: ${index})`);
    });
    
    console.log(`Created lights for ${window.artworkLights.length} artworks`);
  } else {
    console.log("No artwork data available for lights");
  }
  
/*   // Hide all helpers initially
  lightHelpers.forEach(helper => {
    helper.visible = false;
  }); */
}

// Function to update artwork lights with proper rotation handling
function updateArtworkLights(time) {
  if (window.artworkLights && window.artworkLights.length > 0) {
    window.artworkLights.forEach(item => {
      if (artworks[item.artworkIndex] && interactiveModels[item.artworkIndex]) {
        const artworkModel = interactiveModels[item.artworkIndex];
        const light = item.light;
        
        // Create an offset vector for the light position relative to the artwork
        // This defines where the light should be relative to the artwork in local space
        const localOffset = new THREE.Vector3(0, 2, 1); // 2 units above the artwork
        
        // Create a world position vector for the artwork
        const artworkPos = new THREE.Vector3();
        artworkModel.getWorldPosition(artworkPos);
        
        // Apply the artwork's rotation to the offset vector
        // This creates a new vector that properly accounts for the artwork's rotation
        const worldOffset = localOffset.clone().applyQuaternion(artworkModel.quaternion);
        
        // Add the rotated offset to the artwork's position to get the final light position
        light.position.copy(artworkPos).add(worldOffset);
        
        // Check if this specific artwork is being hovered
        let isThisArtworkHovered = false;
        
        // Only check hover if we're not in pointer lock mode
        if (!mouseEnabled && document.body.style.cursor === 'pointer') {
          raycaster.setFromCamera(mouse, camera);
          const intersects = raycaster.intersectObjects(interactiveModels, true);
          
          if (intersects.length > 0) {
            // Find what artwork we hit
            let hitObject = intersects[0].object;
            let hitModel = hitObject;
            
            // Go up the parent hierarchy until we find the interactive model
            while (hitModel && hitModel.parent && !hitModel.userData.isInteractiveModel) {
              hitModel = hitModel.parent;
            }
            
            // Check if this is the model our light is associated with
            if (hitModel && hitModel.userData.isInteractiveModel) {
              const hitIndex = interactiveModels.indexOf(hitModel);
              isThisArtworkHovered = (hitIndex === item.artworkIndex);
            }
          }
        }
        
        // Apply lighting effects based on hover state
        if (isThisArtworkHovered) {
          // Brighter when this specific artwork is hovered
          light.intensity = 200;
          
          // Create pulsing effect using time
          const pulseSpeed = light.userData?.pulseSpeed || 0.003;
          const pulse = (Math.sin(time * pulseSpeed) + 1) * 0.5; // 0 to 1
          light.distance = 5 + pulse * 5; // Pulse the light radius
        } else {
          // Normal state (not being hovered)
          light.intensity = light.userData?.minIntensity || 100;
          light.distance = 5;
        }
        
        // Update helper position
       /*  if (item.helper && item.helper.update) {
          item.helper.update();
        } */
      }
    });
  }
}

function addParticles() {
  const particleCount = 2000;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    const x = THREE.MathUtils.randFloatSpread(300);
    const y = THREE.MathUtils.randFloat(0, 300);
    const z = THREE.MathUtils.randFloatSpread(300);
    positions.set([x, y, z], i * 3);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load('assets/images/dustball.png', (glowTexture) => {
    glowTexture.colorSpace = THREE.SRGBColorSpace;
    glowTexture.needsUpdate = true;

    const material = new THREE.PointsMaterial({
      map: glowTexture,
      color: 0xffffff,
      size: .1,
      transparent: true,
      alphaTest: 0.1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
    console.log("✨ Glowing square particles initialized!");
  },
  undefined,
  (err) => {
    console.error("🚨 Error loading texture: assets/images/dustball.png", err);
  });
}

function loadEnvironmentMap() {
  const textureLoader = new THREE.TextureLoader();
  const texturePath = isMobile 
    ? "assets/images/skybox2k.jpg"  // 2048x1024
    : "assets/images/skybox8k.jpg"; // 4096x2048 or more

  textureLoader.load(texturePath, function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    // Use environment on desktop only to avoid iOS crashing
    if (!isMobile) {
      scene.environment = texture;
    }
    scene.background = texture;
    console.log(`Loaded ${isMobile ? "mobile" : "desktop"} skybox`);
  }, undefined, function (err) {
    console.error("Failed to load skybox texture:", err);
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Setup player and input controls
function setupPlayer() {
  const geometry = new THREE.CylinderGeometry(playerRadius, playerRadius, playerHeight, 16);
  geometry.translate(0, playerHeight / 2, 0);
  const material = new THREE.MeshPhongMaterial({
    color: 0xff0000,
    opacity: 0,
    transparent: true,
  });
  player = new THREE.Mesh(geometry, material);
  player.position.y = 0;
  player.castShadow = true;
  scene.add(player);
  camera.position.set(0, playerHeight, 0);
  player.add(camera);

  // Keyboard controls for desktop
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keyup", onKeyUp);

  // Only enable pointer lock for non-mobile devices
  if (!isMobile) {
    renderer.domElement.addEventListener("click", function () {
      if (!mouseEnabled) {
        mouseEnabled = true;
        renderer.domElement.requestPointerLock();
      }
    });
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onMouseMove);
  } else {
    // Initialize mobile touch controls
    setupMobileControls();
    // Prevent pinch-to-zoom and double-tap zoom
    document.addEventListener("gesturestart", (e) => e.preventDefault());
    document.addEventListener("gesturechange", (e) => e.preventDefault());
    document.addEventListener("gestureend", (e) => e.preventDefault());
    const jumpButton = document.getElementById("jump-button");
    // Mobile Jump Button
    if (jumpButton) {
      jumpButton.addEventListener("touchstart", () => {
        if (isOnGround) {
          verticalVelocity = jumpForce;
          isOnGround = false;
          // Haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(50);
          }
        }
      });
    }
  }

  // Teleport click remains for desktop
  setupTeleport();
}

// Helper function to log player position (for easier artwork placement)
function logPlayerPosition() {
  if (!player) return;
  
  console.log(`Player position: [${player.position.x.toFixed(2)}, ${player.position.y.toFixed(2)}, ${player.position.z.toFixed(2)}]`);
  console.log(`Camera rotation: [${camera.rotation.x.toFixed(2)}, ${camera.rotation.y.toFixed(2)}, ${camera.rotation.z.toFixed(2)}]`);
}

function onKeyDown(event) {
  switch (event.code) {
    case "KeyW": keys.forward = true; break;
    case "KeyS": keys.backward = true; break;
    case "KeyA": keys.left = true; break;
    case "KeyD": keys.right = true; break;
    case "ShiftLeft":
    case "ShiftRight": keys.shift = true; break;
    case "Space":
      if (isOnGround) {
        verticalVelocity = jumpForce;
        isOnGround = false;
      }
      break;
    //case "KeyT": toggleNavmeshVisibility(); break;
    case "KeyM": toggleAudio(); break;
    case "KeyP": logPlayerPosition(); break; // Add P key to log position
    //case "KeyL": toggleLightHelpers(); break; // Add L key to toggle light helpers
  }
}

function onKeyUp(event) {
  switch (event.code) {
    case "KeyW": keys.forward = false; break;
    case "KeyS": keys.backward = false; break;
    case "KeyA": keys.left = false; break;
    case "KeyD": keys.right = false; break;
    case "ShiftLeft":
    case "ShiftRight": keys.shift = false; break;
  }
}

function onPointerLockChange() {
  mouseEnabled = document.pointerLockElement === renderer.domElement;
}

function onMouseMove(event) {
  // For camera rotation when pointer is locked
  if (mouseEnabled) {
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    euler.y -= movementX * 0.002;
    euler.x -= movementY * 0.002;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    camera.rotation.copy(euler);
    playerDirection.set(0, 0, -1).applyQuaternion(camera.quaternion);
    return;
  }
  
  // For interactive model hover effect
  // Calculate mouse position in normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
  
  // Check for hover
  checkInteractiveModelHover();
}

// Function to check if mouse is hovering over an interactive model
function checkInteractiveModelHover() {
  if (!raycaster || !camera || interactiveModels.length === 0) return;
  
  // Update the raycaster with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);
  
  // Calculate objects intersecting the picking ray
  const intersects = raycaster.intersectObjects(interactiveModels, true);
  
  // Reset all models to their original state
  interactiveModels.forEach(model => {
    model.traverse(child => {
      // Only affect the frame mesh, not the artwork image
      if (child.isMesh && child.name === 'frame' && child.userData.isHighlighted) {
        // Only change emissive property back to original
        if (child.userData.originalEmissive) {
          child.material.emissive.copy(child.userData.originalEmissive);
          child.material.emissiveIntensity = child.userData.originalEmissiveIntensity || 0;
        } else {
          child.material.emissive.set(0, 0, 0);
          child.material.emissiveIntensity = 0;
        }
        child.userData.isHighlighted = false;
      }
    });
  });
  
  // Reset cursor
  document.body.style.cursor = 'auto';
  
  // Highlight the first intersected object
  if (intersects.length > 0) {
    const object = intersects[0].object;
    let interactiveModel = object;
    
    // Find the top-level interactive model
    while (interactiveModel.parent && !interactiveModel.userData.isInteractiveModel) {
      interactiveModel = interactiveModel.parent;
    }
    
    if (interactiveModel.userData.isInteractiveModel) {
      // Change cursor to indicate clickable
      document.body.style.cursor = 'pointer';
      
      // Highlight only the frame mesh
      interactiveModel.traverse(child => {
        if (child.isMesh && child.name === 'frame') {
          // Store original emissive properties if not already stored
          if (!child.userData.originalEmissive && child.material) {
            child.userData.originalEmissive = child.material.emissive.clone();
            child.userData.originalEmissiveIntensity = child.material.emissiveIntensity;
          }
          
          // Set emissive color (using a nice blue glow)
          child.material.emissive.set(0.2, 0.5, 1.0);
          child.material.emissiveIntensity = 0.5; // Adjust intensity as needed
          child.userData.isHighlighted = true;
        }
      });
    }
  }
}

// Function to handle clicks on interactive models
function onModelClick(event) {
  // Update the mouse position
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
  
  // Update the picking ray
  raycaster.setFromCamera(mouse, camera);
  
  // Find intersections
  const intersects = raycaster.intersectObjects(interactiveModels, true);
  
  if (intersects.length > 0) {
    const object = intersects[0].object;
    let interactiveModel = object;
    
    // Find the top-level interactive model
    while (interactiveModel.parent && !interactiveModel.userData.isInteractiveModel) {
      interactiveModel = interactiveModel.parent;
    }
    
    if (interactiveModel.userData.isInteractiveModel && interactiveModel.userData.linkUrl) {
      // Store the URL we want to open
      const urlToOpen = interactiveModel.userData.linkUrl;
      
      // Stop event propagation to prevent other click handlers
      event.stopPropagation();
      
      // Check if pointer is locked
      if (document.pointerLockElement === renderer.domElement) {
        // First exit pointer lock
        document.exitPointerLock();
        
        // Listen for the pointerlockchange event once
        const handlePointerLockChange = function() {
          // Only proceed if pointer lock is truly exited
          if (document.pointerLockElement === null) {
            // Remove the event listener to avoid multiple calls
            document.removeEventListener('pointerlockchange', handlePointerLockChange);
            // Now it's safe to open the URL
            window.open(urlToOpen, '_blank');
          }
        };
        
        // Add the event listener
        document.addEventListener('pointerlockchange', handlePointerLockChange, { once: true });
      } else {
        // If pointer lock is not active, open URL directly
        window.open(urlToOpen, '_blank');
      }
    }
  }
}

// Mobile touch controls for movement and camera rotation
function setupMobileControls() {
  let leftTouchId = null, rightTouchId = null;
  let leftStart = null, rightStart = null;

  window.addEventListener("touchstart", function(e) {
    for (let touch of e.changedTouches) {
      if (touch.clientX < window.innerWidth / 2 && leftTouchId === null) {
        leftTouchId = touch.identifier;
        leftStart = { x: touch.clientX, y: touch.clientY };
      } else if (touch.clientX >= window.innerWidth / 2 && rightTouchId === null) {
        rightTouchId = touch.identifier;
        rightStart = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, false);

  window.addEventListener("touchmove", function(e) {
    for (let touch of e.changedTouches) {
      if (touch.identifier === leftTouchId) {
        let deltaX = touch.clientX - leftStart.x;
        let deltaY = touch.clientY - leftStart.y;
        keys.forward = deltaY < -20;
        keys.backward = deltaY > 20;
        keys.left = deltaX < -20;
        keys.right = deltaX > 20;
      } else if (touch.identifier === rightTouchId) {
        let deltaX = touch.clientX - rightStart.x;
        let deltaY = touch.clientY - rightStart.y;
        euler.y -= deltaX * 0.005;
        euler.x -= deltaY * 0.005;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        camera.rotation.copy(euler);
        rightStart = { x: touch.clientX, y: touch.clientY };
      }
    }
  }, false);

  window.addEventListener("touchend", function(e) {
    for (let touch of e.changedTouches) {
      if (touch.identifier === leftTouchId) {
        leftTouchId = null;
        keys.forward = keys.backward = keys.left = keys.right = false;
      } else if (touch.identifier === rightTouchId) {
        rightTouchId = null;
      }
    }
  }, false);
}

// Teleport functionality
function setupTeleport() {
  const raycaster = new THREE.Raycaster();
  renderer.domElement.addEventListener("mousedown", function (event) {
    if (!mouseEnabled) return;
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObject(navmesh, true);
    if (intersects.length > 0) {
      const targetPosition = intersects[0].point.clone();
      player.position.x = targetPosition.x;
      player.position.z = targetPosition.z;
      player.position.y = targetPosition.y;
      verticalVelocity = 0;
    }
  });
}

function toggleNavmeshVisibility() {
  if (!navmesh) return;
  navmesh.traverse(function (node) {
    if (node.isMesh) {
      node.material.visible = !node.material.visible;
    }
  });
}

function placePlayerOnNavmesh(fallbackPosition) {
  if (!navmesh) {
    player.position.copy(fallbackPosition);
    return;
  }
  const raycaster = new THREE.Raycaster();
  const startPosition = new THREE.Vector3(fallbackPosition.x, 100, fallbackPosition.z);
  raycaster.set(startPosition, new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(navmesh, true);
  if (intersects.length > 0) {
    player.position.x = intersects[0].point.x;
    player.position.z = intersects[0].point.z;
    player.position.y = intersects[0].point.y;
    console.log("Player placed at position:", player.position);
    verticalVelocity = 0;
    isOnGround = true;
  } else {
    console.log("Navmesh intersection not found, using fallback position");
    player.position.copy(fallbackPosition);
  }
}

function checkIsOnNavmesh(x, z) {
  const raycaster = new THREE.Raycaster();
  const pos = new THREE.Vector3(x, 100, z);
  raycaster.set(pos, new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(navmesh, true);
  return intersects.length > 0;
}

function updatePlayerMovement() {
  if (!player || !navmesh) return;
  
  velocity.set(0, 0, 0);
  camera.getWorldDirection(cameraDirection);
  cameraDirection.y = 0;
  cameraDirection.normalize();
  cameraRight.set(-cameraDirection.z, 0, cameraDirection.x);
  
  const currentSpeed = keys.shift ? moveSpeed * 2 : moveSpeed;
  
  if (keys.forward) velocity.add(cameraDirection.clone().multiplyScalar(currentSpeed));
  if (keys.backward) velocity.add(cameraDirection.clone().multiplyScalar(-currentSpeed));
  if (keys.right) velocity.add(cameraRight.clone().multiplyScalar(currentSpeed));
  if (keys.left) velocity.add(cameraRight.clone().multiplyScalar(-currentSpeed));
  
  if (velocity.lengthSq() > 0) {
    velocity.normalize().multiplyScalar(currentSpeed);
  }
  
  oldPosition.copy(player.position);
  player.position.x += velocity.x;
  player.position.z += velocity.z;
  
  let isOnNavmesh = checkIsOnNavmesh(player.position.x, player.position.z);
  if (!isOnNavmesh) {
    player.position.x = oldPosition.x;
    player.position.z = oldPosition.z;
  }
  
  applyGravityAndVerticalMovement();
}

function applyGravityAndVerticalMovement() {
  verticalVelocity -= gravity;
  player.position.y += verticalVelocity;
  
  const raycaster = new THREE.Raycaster();
  const pos = new THREE.Vector3(player.position.x, player.position.y + 100, player.position.z);
  raycaster.set(pos, new THREE.Vector3(0, -1, 0));
  const intersects = raycaster.intersectObject(navmesh, true);
  
  if (intersects.length > 0) {
    const groundY = intersects[0].point.y;
    if (player.position.y <= groundY) {
      player.position.y = groundY;
      verticalVelocity = 0;
      isOnGround = true;
    } else {
      isOnGround = false;
    }
  } else {
    isOnGround = false;
    if (player.position.y < -50) {
      placePlayerOnNavmesh(new THREE.Vector3(0, 10, 0));
    }
  }
}

function animateGrass(time) {
  if (!flowerParts.length) return;
  
  flowerParts.forEach((flowerPart) => {
    if (!flowerPart.userData.originalRotation) return;
    
    const windTime = time * windSettings.speed * 0.001;
    const windOffset = flowerPart.userData.windOffset || 0;
    const windFactor = flowerPart.userData.windFactor || 1;
    const windAmount = Math.sin(windTime + windOffset) * windSettings.strength * windFactor;
    const chaosX = Math.sin(windTime * 1.3 + windOffset * 2) * windSettings.chaos * windFactor;
    const chaosZ = Math.cos(windTime * 0.7 + windOffset * 3) * windSettings.chaos * windFactor;
    
    const xAngle = Math.max(-windSettings.maxAngle, Math.min(windSettings.maxAngle, windAmount + chaosX));
    const zAngle = Math.max(-windSettings.maxAngle, Math.min(windSettings.maxAngle, windAmount * 0.5 + chaosZ));
    
    flowerPart.rotation.x = flowerPart.userData.originalRotation.x + xAngle;
    flowerPart.rotation.z = flowerPart.userData.originalRotation.z + zAngle;
    
    if (flowerPart.userData.originalPosition) {
      flowerPart.position.x = flowerPart.userData.originalPosition.x + chaosX * 0.02;
      flowerPart.position.z = flowerPart.userData.originalPosition.z + chaosZ * 0.02;
    }
  });
}

// Debug function to update information about interactive models
function updateDebugInfo() {
  if (!DEBUG) return;
  
  const debugElement = document.getElementById('debug-info');
  if (!debugElement) return;
  
  let content = '<strong>Interactive Models:</strong><br>';
  
  if (interactiveModels.length === 0) {
    content += 'No models loaded yet.';
  } else {
    interactiveModels.forEach((model, index) => {
      content += `<b>${index + 1}. ${model.userData.name || 'Unnamed'}</b><br>`;
      content += `Position: (${model.position.x.toFixed(2)}, ${model.position.y.toFixed(2)}, ${model.position.z.toFixed(2)})<br>`;
      content += `URL: ${model.userData.linkUrl}<br>`;
      
      // Count meshes
      let meshCount = 0;
      model.traverse(child => {
        if (child.isMesh) meshCount++;
      });
      
      content += `Meshes: ${meshCount}<br><br>`;
    });
  }
  
  // Add mouse position
  content += `<b>Mouse:</b> X: ${mouse.x.toFixed(2)}, Y: ${mouse.y.toFixed(2)}<br>`;
  
  // Add camera position
  content += `<b>Camera:</b> (${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)})<br>`;
  
  debugElement.innerHTML = content;
}

// Beat detection variables
let beatDetector = {
  threshold: 1.15,  // How much the current value must exceed the average to be a beat
  decay: 0.98,      // How quickly the average decreases
  average: 0,       // Running average of bass frequencies
  wasBeating: false,// Whether we were in a beat last frame
  beatTime: 0,      // When the last beat occurred
  beatCount: 0,     // Count of beats detected
  beatInterval: 500 // Minimum time between beats (ms)
};

function animate(time) {
  // Calculate delta time
  const now = performance.now() / 1000; // Convert to seconds
  const deltaTime = now - (lastTime || now);
  lastTime = now;

  requestAnimationFrame(animate);
  updatePlayerMovement();

  if (!isLowPowerDevice) {
    // Wind animations
    animateGrass(time);
    windMaterials.forEach(material => {
      material.uniforms.u_windTime.value += material.uniforms.u_windSpeed.value * deltaTime;
    });

    // Update tree animations
    fluffyTrees.forEach(tree => tree.update(deltaTime));

    // Check interactive model hover if not in pointer lock mode
    if (!mouseEnabled && interactiveModels.length > 0) {
      checkInteractiveModelHover();
    }
    
    // Update debug info
    if (DEBUG) {
      updateDebugInfo();
    }

    // Update original color cycling point lights
    pointLights.forEach((light, i) => {
      hues[i] += 0.001; // control speed here
      if (hues[i] > 1) hues[i] = 0;
      light.color.setHSL(hues[i], 1, 0.5);
    });
    
    // Update custom cycling lights
    if (window.customLights && window.customLights.length > 0) {
      window.customLights.forEach(light => {
        if (light.userData) {
          light.userData.hue += light.userData.cycleSpeed || 0.001;
          if (light.userData.hue > 1) light.userData.hue = 0;
          light.color.setHSL(
            light.userData.hue,
            light.userData.saturation || 1.0,
            light.userData.lightness || 0.5
          );
        }
      });
    }
    
    // Update blinking lights
    if (window.blinkingLights && window.blinkingLights.length > 0) {
      window.blinkingLights.forEach(light => {
        if (light.userData) {
          const { blinkSpeed, minIntensity, maxIntensity } = light.userData;
          // Create a sine wave pattern for smooth blinking
          const intensityFactor = (Math.sin(time * 0.001 * blinkSpeed * Math.PI) + 1) * 0.5; // 0 to 1
          const newIntensity = minIntensity + intensityFactor * (maxIntensity - minIntensity);
          light.intensity = newIntensity;
        }
      });
    }
    
    // Update artwork tracking lights
    updateArtworkLights(time);
  } else {
    // For mobile, update trees with reduced frequency
    if (time % 3 === 0) { // Only update every 3rd frame
      fluffyTrees.forEach(tree => tree.update(deltaTime));
    }
  }
  
  // Audio visualization and beat detection
  if (particleSystem && analyser) {
    analyser.getFrequencyData(audioDataArray);

    // Calculate average frequency
    let avg = 0;
    for (let i = 0; i < audioDataArray.length; i++) {
      avg += audioDataArray[i];
    }
    avg /= audioDataArray.length;
    const pulse = avg / 256;

    // Only log in debug mode
    if (DEBUG) {
      console.log("Pulse:", pulse.toFixed(2), 
                "Size:", particleSystem.material.size.toFixed(2), 
                "Opacity:", particleSystem.material.opacity.toFixed(2));
    }

    // Apply audio reactivity to particles
    particleSystem.material.size = .5 + pulse * 1.5;
    particleSystem.material.opacity = .5 + pulse * 0.4;
    particleSystem.material.color.setHSL(pulse, 1.0, 2.0);
    particleSystem.rotation.y += 0.0005 + pulse * 0.003;
    particleSystem.position.y = Math.sin(performance.now() * 0.001) * (0.5 + pulse * 0.5);
    particleSystem.material.needsUpdate = true;
    
    // Beat detection - focus on bass frequencies (first few bins)
    const bassAvg = (audioDataArray[0] + audioDataArray[1] + audioDataArray[2] + audioDataArray[3]) / 4;
    
    // Update the running average
    if (beatDetector.average === 0) {
      beatDetector.average = bassAvg;
    } else {
      beatDetector.average = beatDetector.average * beatDetector.decay + bassAvg * (1 - beatDetector.decay);
    }
    
    // Check if we have a beat
    const isBeat = bassAvg > beatDetector.threshold * beatDetector.average && 
                  time - beatDetector.beatTime > beatDetector.beatInterval;
    
    // If we just detected a beat
    if (isBeat && !beatDetector.wasBeating) {
      beatDetector.beatTime = time;
      beatDetector.beatCount++;
      
      // Visual effects on beat
      if (interactiveModels.length > 0) {
        // Pulse a random artwork on beat
        const randomIndex = Math.floor(Math.random() * interactiveModels.length);
        const model = interactiveModels[randomIndex];
        
        // Scale pulse effect
        model.scale.set(1.05, 1.05, 1.05);
        setTimeout(() => {
          model.scale.set(1, 1, 1);
        }, 200);
      }
    }
    
    beatDetector.wasBeating = isBeat;
  }

  renderer.render(scene, camera);
}

// Load models
function loadModels() {
  const loadingManager = new THREE.LoadingManager(
    function () {
      console.log("All models loaded!");
      const screen = document.getElementById("loading-screen");
      if (screen) {
        screen.style.opacity = "0";
        setTimeout(() => screen.style.display = "none", 1000);
      }
    },
    function (url, itemsLoaded, itemsTotal) {
      const progress = Math.round((itemsLoaded / itemsTotal) * 100);
      const text = document.getElementById("loader-text");
      if (text) text.textContent = `Loading... ${progress}%`;
    },
    function (url) {
      console.error("Error loading:", url);
    }
  );

  const loader = new GLTFLoader(loadingManager);
  
  // Define all the models to load
  const modelsList = [
    {
      name: "terrain1",
      url: "assets/models/terrain1.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "terrain2",
      url: "assets/models/terrain2.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "terrain3",
      url: "assets/models/terrain3.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "terrain4",
      url: "assets/models/terrain4.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "navmesh",
      url: "assets/models/navmesh.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "stairs",
      url: "assets/models/stairs.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "backroom",
      url: "assets/models/backroom.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "grass",
      url: "assets/models/grass.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "frontwall",
      url: "assets/models/frontwall.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "fence",
      url: "assets/models/fence.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
    {
      name: "wall",
      url: "assets/models/wall.glb",
      position: new THREE.Vector3(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      rotation: new THREE.Euler(0, 0, 0),
    },
  ];
  
  modelsList.forEach((modelInfo) => {
    loader.load(
      modelInfo.url,
      function (gltf) {
        const model = gltf.scene;
        model.position.copy(modelInfo.position);
        model.scale.copy(modelInfo.scale);
        model.rotation.copy(modelInfo.rotation);
        
        if (modelInfo.name === "navmesh") {
          const navmeshMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true,
            opacity: 0.3,
            transparent: true,
            visible: false,
          });
          model.traverse(function (node) {
            if (node.isMesh) {
              node.material = navmeshMaterial;
              node.castShadow = false;
              node.receiveShadow = false;
            }
          });
          navmesh = model;
        } else if (modelInfo.name === "grass") {
          // Process grass model for wind animation
          model.traverse(function (node) {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;

              // Store original positions and rotations for the animation
              node.userData.originalPosition = node.position.clone();
              node.userData.originalRotation = node.rotation.clone();

              // Add some randomness to make the animation more natural
              node.userData.windOffset = Math.random() * Math.PI * 2;
              node.userData.windFactor = 0.8 + Math.random() * 0.4; // Between 0.8 and 1.2

              // Add to flowerParts array for animation
              flowerParts.push(node);

              // Enhance materials to work with environment lighting
              if (node.material) {
                if (node.material.isMeshStandardMaterial) {
                  node.material.envMapIntensity = 1;
                  node.material.roughness = Math.max(0.2, node.material.roughness);
                  node.material.metalness = Math.min(0.8, node.material.metalness);
                  node.material.needsUpdate = true;
                } else if (Array.isArray(node.material)) {
                  node.material.forEach((material) => {
                    if (material.isMeshStandardMaterial) {
                      material.envMapIntensity = 1;
                      material.roughness = Math.max(0.2, material.roughness);
                      material.metalness = Math.min(0.8, material.metalness);
                    }
                  });
                }
              }
            }
          });
        } else {
          // Process standard model materials
          model.traverse(function (node) {
            if (node.isMesh) {
              node.castShadow = true;
              node.receiveShadow = true;

              // Enhance materials to work with environment lighting
              if (node.material) {
                if (node.material.isMeshStandardMaterial) {
                  node.material.envMapIntensity = 0.7;
                  node.material.roughness = Math.max(0.2, node.material.roughness);
                  node.material.metalness = Math.min(0.8, node.material.metalness);
                } else if (Array.isArray(node.material)) {
                  node.material.forEach((material) => {
                    if (material.isMeshStandardMaterial) {
                      material.envMapIntensity = 0.7;
                      material.roughness = Math.max(0.2, material.roughness);
                      material.metalness = Math.min(0.8, material.metalness);
                    }
                  });
                }
              }
            }
          });
        }
        
        models[modelInfo.name] = model;
        scene.add(model);
        console.log(`Model "${modelInfo.name}" loaded`);
        
        if (modelInfo.name === "navmesh" && player) {
          placePlayerOnNavmesh(new THREE.Vector3(30, 10, 0));
        }
      },
      function (xhr) {
        console.log(`${modelInfo.name}: ${Math.round((xhr.loaded / xhr.total) * 100)}% loaded`);
      },
      function (error) {
        console.error(`Error loading ${modelInfo.name}:`, error);
        if (modelInfo.name === "navmesh") {
          createBackupNavmesh();
        }
      }
    );
  });
}

function createBackupNavmesh() {
  const geometry = new THREE.BoxGeometry(50, 0.1, 50);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    wireframe: true,
    opacity: 0.3,
    transparent: true,
    visible: false,
  });
  navmesh = new THREE.Mesh(geometry, material);
  navmesh.position.y = 0;
  scene.add(navmesh);
  placePlayerOnNavmesh(new THREE.Vector3(0, 2, 0));
}

// Application cleanup function
function cleanup() {
  // Remove event listeners
  window.removeEventListener("resize", onWindowResize);
  document.removeEventListener("keydown", onKeyDown);
  document.removeEventListener("keyup", onKeyUp);
  document.removeEventListener("pointerlockchange", onPointerLockChange);
  document.removeEventListener("mousemove", onMouseMove);
  window.removeEventListener("click", onModelClick);
  
  // Reset cursor
  document.body.style.cursor = 'auto';
  
  // Stop audio if playing
  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
  }
  
  // Clean up interactive models
  interactiveModels.forEach(model => {
    scene.remove(model);
  });
  interactiveModels = [];
  
  // Clean up additional light references
  window.customLights = [];
  window.blinkingLights = [];
  window.artworkLights = [];
  
  // Dispose of geometries, materials, textures
  scene.traverse(object => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach(material => material.dispose());
      } else {
        object.material.dispose();
      }
    }
  });
  
  // Dispose of renderer
  if (renderer) {
    renderer.dispose();
  }
  
  console.log("Application resources cleaned up");
}

// Function to load interactive artwork models
function loadArtworkModels() {
  console.log("Loading interactive artwork models...");
  
  const loader = new GLTFLoader();
  
  artworks.forEach(artwork => {
    loader.load(
      artwork.url,
      function(gltf) {
        const model = gltf.scene;
        
        // Set position, scale, and rotation
        model.position.copy(artwork.position);
        model.scale.copy(artwork.scale);
        model.rotation.copy(artwork.rotation);
        
        // Mark as interactive model and store link URL
        model.userData.isInteractiveModel = true;
        model.userData.linkUrl = artwork.linkUrl;
        model.userData.name = artwork.name;
        
        // Add to scene and track in our array
        scene.add(model);
        interactiveModels.push(model);
        
        console.log(`Interactive model "${artwork.name}" loaded and placed at ${artwork.position.x}, ${artwork.position.y}, ${artwork.position.z}`);
        
        // Setup materials based on mesh name
        model.traverse(child => {
          if (child.isMesh) {
            // Ensure the mesh casts and receives shadows
            child.castShadow = false;
            child.receiveShadow = false;
            
            console.log(`Found mesh: ${child.name} in model ${artwork.name}`);
            
            // Different handling for different mesh types
            if (child.name === 'artimage') {
              // This is the artwork image - preserve its original material
              // Make sure it's a MeshStandardMaterial for emissive to work
              if (child.material && !child.material.isMeshStandardMaterial) {
                // Convert to MeshStandardMaterial while preserving properties
                const stdMaterial = new THREE.MeshStandardMaterial({
                  map: child.material.map,
                  color: child.material.color ? child.material.color.clone() : 0xffffff,
                  roughness: 0.7,
                  metalness: 0.3,
                  emissive: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000),
                  emissiveIntensity: child.material.emissiveIntensity || 0
                });
                
                child.material = stdMaterial;
              }
              
              // Store reference to the art material
              child.userData.originalMaterial = child.material;
              // Mark it as the artwork mesh
              child.userData.isArtworkMesh = true;
            } 
            else if (child.name === 'frame') {
              // This is the frame - we'll highlight this on hover
              // Make sure it's a MeshStandardMaterial
              if (child.material && !child.material.isMeshStandardMaterial) {
                const stdMaterial = new THREE.MeshStandardMaterial({
                  map: child.material.map,
                  color: child.material.color ? child.material.color.clone() : 0x333333,
                  roughness: 0.5,
                  metalness: 0.8,
                  emissive: new THREE.Color(0x000000),
                  emissiveIntensity: 0
                });
                
                child.material = stdMaterial;
              }
              
              // Store original emissive for the frame
              if (child.material) {
                child.userData.originalEmissive = child.material.emissive.clone();
                child.userData.originalEmissiveIntensity = child.material.emissiveIntensity;
              }
              
              // Mark it as a frame mesh
              child.userData.isFrameMesh = true;
            }
            else {
              // Any other mesh - standard treatment
              if (child.material && !child.material.isMeshStandardMaterial) {
                const stdMaterial = new THREE.MeshStandardMaterial({
                  map: child.material.map,
                  color: child.material.color ? child.material.color.clone() : 0xffffff,
                  roughness: 0.7,
                  metalness: 0.3
                });
                
                child.material = stdMaterial;
              }
            }
            
            child.userData.isHighlighted = false;
          }
        });
      },
      function(xhr) {
        console.log(`${artwork.name}: ${Math.round((xhr.loaded / xhr.total) * 100)}% loaded`);
      },
      function(error) {
        console.error(`Error loading ${artwork.name}:`, error);
      }
    );
  });
}

// Main start function
function start() {
  setupScene();
  setupPlayer();
  loadModels();
  loadFluffyTrees();
  loadArtworkModels(); // Load the interactive artwork models

  // Wait until models are loaded before adding lights
  setTimeout(() => {
    try {
      addArtworkLights(artworks);
      console.log("Artwork lights added successfully");
    } catch (error) {
      console.error("Error adding artwork lights:", error);
    }
  }, 2000); // Wait 2 seconds to ensure models are loaded
  
  // Tutorial Overlay
  if (isMobile) {
    if (!localStorage.getItem("tutorialSeen")) {
      document.getElementById("tutorial-overlay").style.display = "flex";
      document.getElementById("close-tutorial").addEventListener("click", () => {
        document.getElementById("tutorial-overlay").style.display = "none";
        localStorage.setItem("tutorialSeen", "true");
      });
    }
  }
  
  // Start animation loop
  requestAnimationFrame(animate);
  
  // Add window unload event for cleanup
  window.addEventListener("unload", cleanup);
}

// Module exports (for potential future modularization)
export { start, cleanup };
