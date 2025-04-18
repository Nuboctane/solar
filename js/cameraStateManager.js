import * as THREE from '../three/three.module.js';

export class CameraStateManager {
    constructor() {
        this.lastUpdateTime = 0;
        this.updateInterval = 1000;
        this.pendingUpdate = false;
        this.lastState = null;
    }

    shouldUpdate(newState) {
        const now = Date.now();
        const stateChanged = !this.lastState || 
            this.lastState.position.x !== newState.position.x ||
            this.lastState.position.y !== newState.position.y ||
            this.lastState.position.z !== newState.position.z ||
            Math.abs(this.lastState.rotation.yaw - newState.rotation.yaw) > 0.01 ||
            Math.abs(this.lastState.rotation.pitch - newState.rotation.pitch) > 0.01;

        return stateChanged && (now - this.lastUpdateTime > this.updateInterval);
    }

    safeUpdateURL(state) {
        try {
            if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
                const params = new URLSearchParams();
                
                params.set('px', state.position.x.toFixed(2));
                params.set('py', state.position.y.toFixed(2));
                params.set('pz', state.position.z.toFixed(2));
                params.set('yaw', state.rotation.yaw.toFixed(4));
                params.set('pitch', state.rotation.pitch.toFixed(4));
                params.set('fov', state.fov.toFixed(2));
                
                if (window.isSecureContext || window.location.hostname === 'localhost') {
                    window.history.replaceState({}, '', `?${params.toString()}`);
                    this.lastUpdateTime = Date.now();
                    this.lastState = {...state};
                    this.pendingUpdate = false;
                    return true;
                }
            }
        } catch (e) {
            console.warn('URL update failed:', e);
        }
        return false;
    }
}