import * as THREE from '../three/three.module.js';
import { CameraStateManager } from './cameraStateManager.js';

const cameraStateManager = new CameraStateManager();

let isLeftMouseDown = false;
let isZooming = false;
let zoomStart = null;
let zoomFrom = new THREE.Vector3();
let zoomTo = new THREE.Vector3();
const zoomDuration = 0.1;

export function setupCameraControls(cameraHolder, camera) {
    const keysPressed = new Set();
    const velocity = new THREE.Vector3();
    const urlParams = new URLSearchParams(window.location.search);
    let yaw = parseFloat(urlParams.get('yaw')) || 0;
    let pitch = parseFloat(urlParams.get('pitch')) || 0;

    window.addEventListener('contextmenu', (e) => e.preventDefault());
    
    document.addEventListener('keydown', (e) => {
        keysPressed.add(e.code);
    });
    
    document.addEventListener('keyup', (e) => {
        keysPressed.delete(e.code);
    });
    
    window.addEventListener('wheel', (e) => {
        const hoveredElement = document.elementFromPoint(e.clientX, e.clientY);
        if (!hoveredElement) return;
    
        const cursorStyle = getComputedStyle(hoveredElement).cursor;
        if (cursorStyle === 'pointer') {
            // Block scroll or just return early
            return;
        }
        
        if (e.shiftKey) {
            const fovChangeSpeed = 1;
            const direction = e.deltaY < 0 ? -1 : 1;
            camera.fov = Math.max(1, Math.min(125, camera.fov + fovChangeSpeed * direction));
            camera.updateProjectionMatrix();
        } else {
            //if mouse is not in a scrollwheel element
            const scrollSpeed = 1000;
            const forward = new THREE.Vector3();
            camera.getWorldDirection(forward);
            
            isZooming = false;
            
            const direction = e.deltaY < 0 ? 1 : -1;
            const offset = forward.multiplyScalar(scrollSpeed * direction);
            zoomFrom.copy(cameraHolder.position);
            zoomTo.copy(zoomFrom.clone().add(offset));
            
            isZooming = true;
            zoomStart = null;
            
            requestAnimationFrame(zoomStep);
        }
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
            document.body.style.cursor = 'grab';
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
        updateCameraState(cameraHolder, camera, yaw, pitch);
    });

    function zoomStep(timestamp) {
        const elapsed = (timestamp - zoomStart) / 1000;
        const t = Math.min(elapsed / zoomDuration, 1);
        const easedT = t * t * (3 - 2 * t);

        const currentPos = zoomFrom.clone().lerp(zoomTo, easedT);
        cameraHolder.position.copy(currentPos);

        if (t < 1 && isZooming) {
            requestAnimationFrame(zoomStep);
        } else {
            isZooming = false;
            updateCameraState(cameraHolder, camera, yaw, pitch);
        }
    }

    return { keysPressed, velocity, yaw, pitch };
}

export function moveCamera(cameraHolder, camera, keysPressed, velocity) {
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

    velocity.copy(direction);
}

export function updateCameraState(cameraHolder, camera, yaw, pitch) {
    const currentState = {
        position: {
            x: cameraHolder.position.x,
            y: cameraHolder.position.y,
            z: cameraHolder.position.z
        },
        rotation: {
            yaw: yaw,
            pitch: pitch
        },
        fov: camera.fov
    };

    if (cameraStateManager.shouldUpdate(currentState)) {
        cameraStateManager.safeUpdateURL(currentState);
    }
}

export function getCameraStateFromURL() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.toString()) {
            return {
                position: {
                    x: parseFloat(params.get('px')) || 0,
                    y: parseFloat(params.get('py')) || 0,
                    z: parseFloat(params.get('pz')) || 10000
                },
                rotation: {
                    yaw: parseFloat(params.get('yaw')) || 0,
                    pitch: parseFloat(params.get('pitch')) || 0
                },
                fov: parseFloat(params.get('fov')) || 75
            };
        }
        return null;
    } catch (e) {
        console.warn('State restoration failed:', e);
        return null;
    }
}