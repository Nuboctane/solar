import * as THREE from './three/three.module.js';
import { GLTFLoader } from './three/three.GLTFLoader.js';

let scene, camera, renderer;
const keysPressed = new Set();

const velocity = new THREE.Vector3();

let isLeftMouseDown = false;
let yaw = 0;
let pitch = 0;
let cameraHolder;

init();
loadSpheres();
animate();

function toggleLabels() {
    // Get all label containers
    const labels = document.querySelectorAll('.planet-label-container');
    let shouldShow;
    
    // Check current state of first label (if any exist)
    if (labels.length > 0) {
        const firstLabel = labels[0];
        // If currently hidden (display none or opacity 0), we should show
        shouldShow = window.getComputedStyle(firstLabel).display === 'none' || 
                    firstLabel.style.opacity === '0';
    } else {
        // If no labels found, default to showing them
        shouldShow = true;
    }
    
    // Toggle all labels
    labels.forEach(label => {
        if (shouldShow) {
            // Show labels with smooth transition
            label.style.display = 'block';
            label.style.opacity = '1';
        } else {
            // Hide labels with smooth transition
            label.style.opacity = '0';
            // After fade out completes, set display none
            setTimeout(() => {
                label.style.display = 'none';
            }, 300); // Match this with your CSS transition time
        }
    });
    
    // Return current state
    return shouldShow;
}

window.toggleLabels = toggleLabels;

const dropdown = document.getElementById('planetDropdown');
let lastSelectedValue = '';

dropdown.addEventListener('change', (event) => {
    if (event.target.value !== '' || event.target.value === lastSelectedValue) {
        onPlanetSelect(event);
    }
    lastSelectedValue = event.target.value;
});

dropdown.addEventListener('click', (event) => {
    if (dropdown.value === lastSelectedValue) {
        onPlanetSelect(event);
    }
});

function init() {
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    cameraHolder = new THREE.Object3D();
    cameraHolder.position.set(0, 0, 10000);
    scene.add(cameraHolder);
    
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 1, 1e7);
    cameraHolder.add(camera);

    camera.rotation.order = 'YXZ';

    const loader = new THREE.TextureLoader();
    loader.load('constellation/textures/stars.jpg', function (texture) {
        const geometry = new THREE.SphereGeometry(9000000, 64, 64);
        geometry.scale(-1, 1, 1);

        const material = new THREE.MeshBasicMaterial({ map: texture });
        const skybox = new THREE.Mesh(geometry, material);

        scene.add(skybox);
    });

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    document.addEventListener('keydown', (e) => {
        keysPressed.add(e.code);
    });
    
    document.addEventListener('keyup', (e) => {
        keysPressed.delete(e.code);
    });

    window.addEventListener('mousemove', (e) => {
        if (!isLeftMouseDown) return;
    
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
    
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    
        cameraHolder.rotation.y = yaw;
        camera.rotation.x = pitch;
    });
    
    window.addEventListener('wheel', (e) => {
        const scrollSpeed = 1000;
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
    
        // Reset any current animation
        isZooming = false;
    
        const direction = e.deltaY < 0 ? 1 : -1;
        const offset = forward.multiplyScalar(scrollSpeed * direction);
        zoomFrom.copy(cameraHolder.position);
        zoomTo.copy(zoomFrom.clone().add(offset));
    
        isZooming = true;
        zoomStart = null;
    
        requestAnimationFrame(zoomStep);
    });

    window.addEventListener('mousedown', (e) => {
        if (e.button !== 2) {
            isLeftMouseDown = true;
            document.body.style.cursor = 'grabbing';
        }
    });
    
    window.addEventListener('mouseup', (e) => {
        if (e.button !== 2) {
            isLeftMouseDown = false;
            document.body.style.cursor = 'grab'; // Revert to default cursor
        }
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isLeftMouseDown) return;
        
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        
        const quaternion = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
        
        camera.quaternion.copy(quaternion);
    });
    
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

}

let isZooming = false;
let zoomStart = null;
let zoomFrom = new THREE.Vector3();
let zoomTo = new THREE.Vector3();
let zoomDuration = 0.1;

function zoomStep(timestamp) {
    if (!zoomStart) zoomStart = timestamp;
    const elapsed = (timestamp - zoomStart) / 1000;
    const t = Math.min(elapsed / zoomDuration, 1);
    const easedT = t * t * (3 - 2 * t); // smoothstep

    const currentPos = zoomFrom.clone().lerp(zoomTo, easedT);
    cameraHolder.position.copy(currentPos);

    if (t < 1 && isZooming) {
        requestAnimationFrame(zoomStep);
    } else {
        isZooming = false;
    }
}

function moveCamera() {
    let speed = keysPressed.has('ShiftLeft') || keysPressed.has('ShiftRight') ? 0.001 : 0.5;
    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    camera.getWorldDirection(forward).normalize();
    right.crossVectors(forward, up).normalize();

    if (keysPressed.has('KeyW')) direction.add(forward);
    if (keysPressed.has('KeyS')) direction.sub(forward);
    if (keysPressed.has('KeyD')) direction.add(right);
    if (keysPressed.has('KeyA')) direction.sub(right);
    if (keysPressed.has('KeyE')) direction.y += 1;
    if (keysPressed.has('KeyQ')) direction.y -= 1;

    direction.normalize().multiplyScalar(speed);
    cameraHolder.position.add(direction);
}

function animate() {
    requestAnimationFrame(animate);
    moveCamera();

    // Update all label positions
    scene.traverse(obj => {
        if (obj.userData?.updateLabel) {
            obj.userData.updateLabel();
        }
    });

    // Handle label collisions and draw lines
    updateLabelConnections();
    
    renderer.render(scene, camera);
}

let spheresData = [];

async function loadSpheres() {
    const response = await fetch('constellation/spheres.json');
    const data = await response.json();

    spheresData = data;
    const sphereMap = new Map();
    const loader = new THREE.TextureLoader();
    const gltfLoader = new GLTFLoader();
    const dropdown = document.getElementById('planetDropdown');

    // First pass: Create all meshes
    for (const sphere of data) {
        let mesh;
        
        if (sphere.model) {
            try {
                const gltf = await gltfLoader.loadAsync(sphere.model);
                mesh = gltf.scene;
                
                // Calculate proper scale based on bounding box
                const bbox = new THREE.Box3().setFromObject(mesh);
                const size = bbox.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = sphere.size / maxDim;
                mesh.scale.set(scale, scale, scale);
                
                mesh.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
            } catch (error) {
                console.error(`Failed to load model for ${sphere.name}:`, error);
                mesh = createSphereMesh(sphere, loader);
            }
        } else {
            mesh = createSphereMesh(sphere, loader);
        }

        // Store bounding box info for label positioning
        const bbox = new THREE.Box3().setFromObject(mesh);
        mesh.userData.bbox = bbox;
        mesh.name = sphere.name;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.diameter = sphere.diameter;
        sphereMap.set(sphere.name, mesh);
    }

    // Second pass: Position all meshes
    for (const sphere of data) {
        const mesh = sphereMap.get(sphere.name);
        const index = data.indexOf(sphere);
        
        let x, y, z;
        
        if (sphere.relative_to && sphere.relative_to.trim() !== '') {
            const parentMesh = sphereMap.get(sphere.relative_to);
            if (parentMesh) {
                const parentPos = parentMesh.position;
                const orbitalDistance = sphere.position[0] + (parentMesh.diameter * 20);
                const angle = (index / data.length) * Math.PI * 2;
                x = parentPos.x + Math.cos(angle) * orbitalDistance;
                z = parentPos.z + Math.sin(angle) * orbitalDistance;
                y = parentPos.y;
            } else {
                [x, y, z] = sphere.position;
            }
        } else {
            const angle = (index / data.length) * Math.PI * 2 + Math.random() * 0.5;
            const distance = sphere.position[0];
            x = Math.cos(angle) * distance;
            z = Math.sin(angle) * distance;
            y = 0;
        }

        mesh.position.set(x, y, z);
        sphere.position = [x, y, z];

        // Add ring if specified
        if (sphere.ring_texture && sphere.ring_texture.trim() !== '') {
            const ringInnerRadius = sphere.size * 1.2;
            const ringOuterRadius = sphere.size * 2;
            const ringGeometry = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 64);
            const ringTexture = await loader.loadAsync(sphere.ring_texture);
            const ringMaterial = new THREE.MeshBasicMaterial({
                map: ringTexture,
                side: THREE.DoubleSide,
                transparent: true,
            });

            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI / 2;
            ring.position.copy(mesh.position);
            scene.add(ring);
            mesh.userData.ring = ring;
        }

        // Add sun light
        if (sphere.name === 'Sun') {
            const light = new THREE.PointLight(0xffffaa, 2, 100000);
            light.position.set(x, y, z);
            light.castShadow = true;
            scene.add(light);
            light.shadow.mapSize.width = 5120;
            light.shadow.mapSize.height = 5120;
            light.shadow.camera.near = 0.1;
            light.shadow.camera.far = 10000;
        }

        scene.add(mesh);

        // Create label
        const label = createLabel(mesh, sphere.name);
        mesh.userData.label = label;
        mesh.userData.size = sphere.size;
    }

    // Populate dropdown
    const sortedData = [...data].sort((a, b) => {
        if (a.name === 'Sun') return -1;
        if (b.name === 'Sun') return 1;
        const distA = Math.sqrt(a.position[0]**2 + a.position[1]**2 + a.position[2]**2);
        const distB = Math.sqrt(b.position[0]**2 + b.position[1]**2 + b.position[2]**2);
        return distA - distB;
    });

    sortedData.forEach((sphere) => {
        const option = document.createElement('option');
        option.value = sphere.name;
        option.textContent = sphere.name;
        dropdown.appendChild(option);
    });

    function createSphereMesh(sphere, textureLoader) {
        const geometry = new THREE.SphereGeometry(sphere.size, 64, 64);
        let materialOptions = {
            roughness: 0.1,
            metalness: 0.1
        };

        if (sphere.texture) {
            const texture = textureLoader.load(sphere.texture);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            materialOptions.map = texture;
        } else {
            materialOptions.color = new THREE.Color(sphere.color);
            materialOptions.emissive = new THREE.Color(sphere.color);
        }

        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial(materialOptions));
        mesh.userData.bbox = new THREE.Box3().setFromObject(mesh);
        return mesh;
    }

    function createLabel(mesh, text) {
        const labelContainer = document.createElement('div');
        labelContainer.className = 'planet-label-container';
        labelContainer.style.position = 'absolute';
        labelContainer.style.pointerEvents = 'none';
        labelContainer.style.transform = 'translate(-50%, 0)';

        const label = document.createElement('div');
        label.className = 'planet-label';
        label.textContent = text;
        label.style.color = '#fff';
        label.style.fontFamily = 'sans-serif';
        label.style.whiteSpace = 'nowrap';
        label.style.textAlign = 'center';
        label.style.textShadow = '0 0 5px #000';
        label.style.padding = '2px 8px';
        label.style.backgroundColor = 'rgba(0,0,0,0.5)';
        label.style.borderRadius = '4px';

        const lineCanvas = document.createElement('canvas');
        lineCanvas.className = 'planet-line-canvas';
        lineCanvas.width = 1;
        lineCanvas.height = 1;
        lineCanvas.style.position = 'absolute';
        lineCanvas.style.left = '0';
        lineCanvas.style.top = '0';
        lineCanvas.style.pointerEvents = 'none';

        labelContainer.appendChild(lineCanvas);
        labelContainer.appendChild(label);
        document.body.appendChild(labelContainer);

        // Store references for updates
        if (!window.planetLabels) window.planetLabels = [];
        const labelObj = { container: labelContainer, canvas: lineCanvas, mesh };
        window.planetLabels.push(labelObj);

        mesh.userData.updateLabel = () => {
            if (!mesh.userData.bbox) return;

            // Get object center in world space
            const center = new THREE.Vector3();
            mesh.userData.bbox.getCenter(center);
            center.applyMatrix4(mesh.matrixWorld);

            // Convert to screen position
            const screenPos = center.clone().project(camera);
            const screenX = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
            const screenY = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

            // Store for line drawing
            labelObj.screenPos = { x: screenX, y: screenY };

            if (screenPos.z <= 1) {
                // Position label container (will be adjusted for collisions)
                labelContainer.style.left = `${screenX}px`;
                labelContainer.style.top = `${screenY + 20}px`; // Start 20px below
                labelContainer.style.display = 'block';
            } else {
                labelContainer.style.display = 'none';
            }
        };

        return labelContainer;
    }
}


function focusOnPlanet(planet) {
    const planetPosition = new THREE.Vector3(...planet.position);
    const distance = planet.size * 5;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    const targetPosition = planetPosition.clone().sub(forward.multiplyScalar(distance));
    const startPosition = cameraHolder.position.clone();

    const duration = 0.5;
    let startTime = null;

    function animate(time) {
        if (!startTime) startTime = time;
        const elapsed = (time - startTime) / 1000;
        const t = Math.min(elapsed / duration, 1);

        const easedT = t * t * (3 - 2 * t);

        const currentPosition = startPosition.clone().lerp(targetPosition, easedT);
        cameraHolder.position.copy(currentPosition);

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
            yaw = euler.y;
            pitch = euler.x;

            camera.near = Math.max(0.1, planet.size * 0.01);
            camera.far = 9000000 * 1.1;
            camera.updateProjectionMatrix();
        }
    }

    requestAnimationFrame(animate);
}

function updateLabelConnections() {
    if (!window.planetLabels) return;

    // Sort labels by vertical position
    const visibleLabels = window.planetLabels
        .filter(item => item.container.style.display !== 'none')
        .sort((a, b) => a.screenPos.y - b.screenPos.y);

    // First pass: position labels with collision detection
    for (let i = 0; i < visibleLabels.length; i++) {
        const current = visibleLabels[i];
        const labelRect = current.container.getBoundingClientRect();
        const labelHeight = labelRect.height;
        
        // Find optimal position (start 20px below object)
        let bestY = current.screenPos.y + 20;
        
        // Check against other labels
        for (let j = 0; j < i; j++) {
            const other = visibleLabels[j];
            const otherRect = other.container.getBoundingClientRect();
            
            if (Math.abs(otherRect.left - labelRect.left) < otherRect.width &&
                bestY < otherRect.bottom + 5) {
                bestY = otherRect.bottom + 5;
            }
        }
        
        current.container.style.top = `${bestY}px`;
        current.finalPos = { 
            x: parseFloat(current.container.style.left),
            y: bestY 
        };
    }

    // Second pass: draw connecting lines
    visibleLabels.forEach(labelObj => {
        const canvas = labelObj.canvas;
        const ctx = canvas.getContext('2d');
        
        // Calculate line start (object position) and end (label position)
        const startX = labelObj.screenPos.x;
        const startY = labelObj.screenPos.y;
        const endX = labelObj.finalPos.x;
        const endY = labelObj.finalPos.y - 10; // 10px above label
        
        // Set canvas size to cover the line
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);
        
        canvas.style.left = `${minX}px`;
        canvas.style.top = `${minY}px`;
        canvas.width = maxX - minX;
        canvas.height = maxY - minY;
        
    });
}


function onPlanetSelect(event) {
    const planetName = event.target.value;
    if (planetName) {
        const selectedPlanet = spheresData.find((sphere) => sphere.name === planetName);
        if (selectedPlanet) {
            focusOnPlanet(selectedPlanet);
        }
    }
}

window.onPlanetSelect = onPlanetSelect;
