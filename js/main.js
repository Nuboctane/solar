import * as THREE from '../three/three.module.js';
import { CameraStateManager } from './cameraStateManager.js';
import { setupCameraControls, moveCamera, updateCameraState, getCameraStateFromURL } from './cameraControls.js';
import { loadSpheres } from './planetLoader.js';
import { updateLabelConnections } from './planetLabels.js';
import { setupPlanetDropdown } from './planetNavigation.js';

let scene, camera, renderer, cameraHolder;
let lastUpdateTime = 0;
const urlUpdateInterval = 500;
let spheresData = [];
const urlParams = new URLSearchParams(window.location.search);
let lastFov = parseFloat(urlParams.get('fov')) || 75;
let yaw = parseFloat(urlParams.get('yaw')) || 0;
let pitch = parseFloat(urlParams.get('pitch')) || 0;
let keysPressed;
let velocity = new THREE.Vector3();

init();
animate();

function init() {
    scene = new THREE.Scene();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    cameraHolder = new THREE.Object3D();
    cameraHolder.position.set(0, 0, 10000);
    scene.add(cameraHolder);
    
    camera = new THREE.PerspectiveCamera(lastFov, window.innerWidth/window.innerHeight, 1, 1e7);
    cameraHolder.add(camera);
    camera.rotation.order = 'YXZ';

    const savedState = getCameraStateFromURL();
    if (savedState) {
        cameraHolder.position.set(
            savedState.position.x || 0,
            savedState.position.y || 0,
            savedState.position.z || 10000
        );
        yaw = savedState.rotation.yaw || 0;
        pitch = savedState.rotation.pitch || 0;
        camera.fov = savedState.fov || 75;
        
        const quaternion = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
        camera.quaternion.copy(quaternion);
    }

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

    const controls = setupCameraControls(cameraHolder, camera);
    keysPressed = controls.keysPressed;

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('popstate', () => {
        const savedState = getCameraStateFromURL();
        cameraHolder.position.set(savedState.position.x, savedState.position.y, savedState.position.z);
        yaw = savedState.rotation.yaw;
        pitch = savedState.rotation.pitch;
        camera.fov = savedState.fov;
        
        const quaternion = new THREE.Quaternion()
            .setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
        camera.quaternion.copy(quaternion);
        
        camera.updateProjectionMatrix();
    });

    loadSpheres(scene, camera).then(data => {
        spheresData = data;
        setupPlanetDropdown(spheresData, cameraHolder, camera);
    });

}

function animate() {
    requestAnimationFrame(animate);
    moveCamera(cameraHolder, camera, keysPressed, velocity);
    
    const now = Date.now();
    if (now - lastUpdateTime > urlUpdateInterval) {
        updateCameraState(cameraHolder, camera, yaw, pitch);
        lastUpdateTime = now;
    }

    scene.traverse(obj => {
        if (obj.userData?.updateLabel) {
            obj.userData.updateLabel();
        }
    });

    updateLabelConnections(camera);

    scene.traverse(obj => {
        if (obj.userData?.atmosphere) {
            const atmosphere = obj.userData.atmosphere;
            const uniforms = atmosphere.material?.uniforms;
            
            if (uniforms) {
                // Get world position of the planet
                const worldPosition = new THREE.Vector3();
                obj.getWorldPosition(worldPosition);
                
                // Find sun position dynamically
                let sunPosition = new THREE.Vector3(1000, 0, 0); // Default fallback
                if (obj.userData.relativeTo) {
                    const sun = scene.getObjectByName(obj.userData.relativeTo);
                    if (sun) sunPosition = sun.position;
                }
                
                // Update shader uniforms
                uniforms.planetPosition.value.copy(worldPosition);
                uniforms.sunPosition.value.copy(sunPosition);
                uniforms.viewVector.value.copy(
                    camera.position.clone().sub(worldPosition).normalize()
                );
            }
        }
    });
    
    
    renderer.render(scene, camera);
}