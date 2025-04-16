import * as THREE from './three/three.module.js';

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
    
        // Constrain the pitch to prevent flipping over
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    
        cameraHolder.rotation.y = yaw;
        camera.rotation.x = pitch;
    });
    
    // Fix camera zoom issues on scroll
    window.addEventListener('wheel', (e) => {
        const scrollSpeed = 1000;
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
    
        if (e.deltaY < 0) {
            cameraHolder.position.add(forward.multiplyScalar(scrollSpeed)); // Zoom in
        }
    
        if (e.deltaY > 0) {
            cameraHolder.position.add(forward.multiplyScalar(-scrollSpeed)); // Zoom out
        }
    });

    window.addEventListener('mousedown', (e) => {
        if (e.button !== 2) isLeftMouseDown = true;
    });
    window.addEventListener('mouseup', (e) => {
        if (e.button !== 2) isLeftMouseDown = false;
    });
    window.addEventListener('mousemove', (e) => {
        if (!isLeftMouseDown) return;
        
        yaw -= e.movementX * 0.002;
        pitch -= e.movementY * 0.002;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        
        // Apply rotations using quaternion to avoid gimbal lock
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

function moveCamera() {
    let speed = keysPressed.has('ShiftLeft') || keysPressed.has('ShiftRight') ? 1 : 50;
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
    updateLabels();
    renderer.render(scene, camera);
}

function updateLabels() {
    const canvas = renderer.domElement;

    scene.traverse((obj) => {
        if (obj.isMesh && obj.userData.label) {
            const vector = obj.position.clone();
            vector.y -= obj.userData.size + 100;
            vector.project(camera);

            const x = (vector.x * 0.5 + 0.5) * canvas.clientWidth;
            const y = (-vector.y * 0.5 + 0.5) * canvas.clientHeight;

            obj.userData.label.style.left = `${x}px`;
            obj.userData.label.style.top = `${y}px`;

            obj.userData.label.style.display = vector.z > 1 || vector.z < -1 ? 'none' : 'block';
        }
    });
}

let spheresData = [];  // Declare the variable before using it

async function loadSpheres() {
    const response = await fetch('constellation/spheres.json');
    const data = await response.json();

    spheresData = data;  // Store the planets data globally

    const loader = new THREE.TextureLoader();
    const dropdown = document.getElementById('planetDropdown');

    // Add options to the dropdown for each planet
    data.forEach((sphere) => {
        const option = document.createElement('option');
        option.value = sphere.name;
        option.textContent = sphere.name;
        dropdown.appendChild(option);
    });

    for (const sphere of data) {
        const geometry = new THREE.SphereGeometry(sphere.size, 64, 64);

        let materialOptions = {
            roughness: 0.1,
            metalness: 0.1
        };

        if (sphere.texture) {
            const texture = await loader.loadAsync(sphere.texture);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            materialOptions.map = texture;
        } else {
            materialOptions.color = new THREE.Color(sphere.color);
            materialOptions.emissive = new THREE.Color(sphere.color);
        }

        const material = new THREE.MeshStandardMaterial(materialOptions);
        const mesh = new THREE.Mesh(geometry, material);

        const index = data.indexOf(sphere);
        const angle = (index / data.length) * Math.PI * 2 + Math.random() * 0.5;
        
        const distance = new THREE.Vector3(...sphere.position).length();

        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance;
        const y = 0;

        mesh.position.set(x, y, z);
        sphere.position = [x, y, z];

        mesh.name = sphere.name;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (sphere.name === 'Sun') {
            const light = new THREE.PointLight(0xffffaa, 2, 100000);
            light.position.set(...sphere.position);
            light.castShadow = true;
            scene.add(light);
            
            light.shadow.mapSize.width = 5120;
            light.shadow.mapSize.height = 5120;
            light.shadow.camera.near = 0.1;
            light.shadow.camera.far = 10000;
        }

        scene.add(mesh);

        const label = document.createElement('div');
        label.className = 'planet-label';
        label.innerText = sphere.name;
        label.style.position = 'absolute';
        label.style.color = '#fff';
        label.style.fontFamily = 'sans-serif';
        label.style.pointerEvents = 'none';
        label.style.transform = 'translate(-55%, 0)';
        document.body.appendChild(label);

        mesh.userData.label = label;
        mesh.userData.size = sphere.size;
    }
}

function focusOnPlanet(planet) {
    const planetPosition = new THREE.Vector3(...planet.position);
    const distance = planet.size * 5;
    
    // Store current camera UP vector
    const currentUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    
    // Calculate target position (maintain current view direction)
    const currentDirection = new THREE.Vector3();
    camera.getWorldDirection(currentDirection);
    const targetPosition = planetPosition.clone()
        .add(currentDirection.multiplyScalar(-distance));
    
    // Reset camera system
    cameraHolder.position.copy(targetPosition);
    cameraHolder.rotation.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);
    
    // Look at planet with preserved up direction
    camera.lookAt(planetPosition);
    camera.up.copy(currentUp); // Restore original up vector
    
    // Update control variables
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    yaw = euler.y;
    pitch = euler.x;
    
    // Adjust clipping planes
    camera.near = Math.max(0.1, planet.size * 0.01);
    camera.far = 9000000 * 1.1;
    camera.updateProjectionMatrix();
}

// Event listener function triggered when the planet is selected
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
