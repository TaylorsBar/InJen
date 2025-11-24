
export const platformService = {
  wakeLock: null as WakeLockSentinel | null,

  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        console.log('Wake Lock active');
      } catch (err) {
        console.warn('Wake Lock request failed:', err);
      }
    }
  },

  async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        console.log('Wake Lock released');
      } catch (err) {
        console.warn('Wake Lock release failed:', err);
      }
    }
  },

  async toggleFullscreen() {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.warn('Enter fullscreen failed:', err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  },

  async exitFullscreen() {
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.warn('Exit fullscreen failed:', err);
      }
    }
  },

  async requestMotionPermission(): Promise<boolean> {
    // Specific handling for iOS 13+ which requires permission for DeviceMotion
    if (typeof (window as any).DeviceMotionEvent !== 'undefined' && 
        typeof (window as any).DeviceMotionEvent.requestPermission === 'function') {
      try {
        const permissionState = await (window as any).DeviceMotionEvent.requestPermission();
        return permissionState === 'granted';
      } catch (error) {
        console.error('Motion permission error:', error);
        return false;
      }
    }
    return true; // Non-iOS devices or older browsers typically don't require this
  },

  exportData(data: any, filename: string, mimeType: string = 'application/json') {
    try {
      // If data is already a string (CSV) and mimeType is not JSON, use it directly.
      // Otherwise stringify it.
      const content = (mimeType === 'application/json' && typeof data !== 'string')
        ? JSON.stringify(data, null, 2) 
        : data;

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  },

  isIOS() {
    return [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ].includes(navigator.platform) || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
  }
};
