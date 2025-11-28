
export interface OBDData {
  rpm?: number;
  speed_kmh?: number;
  throttle_pos?: number;
  coolant_temp?: number;
  engine_load?: number;
  voltage?: number;
}

// --- Web Bluetooth Type Definitions ---

export interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  watchAdvertisements(): Promise<void>;
  unwatchAdvertisements(): void;
  readonly watchingAdvertisements: boolean;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

export interface BluetoothRemoteGATTServer {
  device: BluetoothDevice;
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

export interface BluetoothRemoteGATTService {
  uuid: string;
  isPrimary: boolean;
  device: BluetoothDevice;
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(characteristic?: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic[]>;
  getIncludedService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>;
  getIncludedServices(service?: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService[]>;
}

export interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  service: BluetoothRemoteGATTService;
  uuid: string;
  properties: BluetoothCharacteristicProperties;
  value?: DataView;
  getDescriptor(descriptor: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor>;
  getDescriptors(descriptor?: BluetoothDescriptorUUID): Promise<BluetoothRemoteGATTDescriptor[]>;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
}

export interface BluetoothCharacteristicProperties {
  broadcast: boolean;
  read: boolean;
  writeWithoutResponse: boolean;
  write: boolean;
  notify: boolean;
  indicate: boolean;
  authenticatedSignedWrites: boolean;
  reliableWrite: boolean;
  writableAuxiliaries: boolean;
}

export interface BluetoothRemoteGATTDescriptor {
  characteristic: BluetoothRemoteGATTCharacteristic;
  uuid: string;
  value?: DataView;
  readValue(): Promise<DataView>;
  writeValue(value: BufferSource): Promise<void>;
}

export type BluetoothServiceUUID = number | string;
export type BluetoothCharacteristicUUID = number | string;
export type BluetoothDescriptorUUID = number | string;

export interface RequestDeviceOptions {
  filters?: BluetoothLEScanFilter[];
  optionalServices?: BluetoothServiceUUID[];
  acceptAllDevices?: boolean;
}

export interface BluetoothLEScanFilter {
  name?: string;
  namePrefix?: string;
  services?: BluetoothServiceUUID[];
  manufacturerData?: { companyIdentifier: number; dataPrefix?: BufferSource; mask?: BufferSource }[];
  serviceData?: { service: BluetoothServiceUUID; dataPrefix?: BufferSource; mask?: BufferSource }[];
}

export interface Bluetooth extends EventTarget {
  getAvailability(): Promise<boolean>;
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>;
}

declare global {
  interface Navigator {
    bluetooth: Bluetooth;
  }
}

// --------------------------------------

// Common BLE Service UUIDs for OBD adapters (Vgate, Veepeak, etc.)
const OBD_SERVICE_UUIDS = [
  "0000fff0-0000-1000-8000-00805f9b34fb", // Vgate / generic
  "0000ffe0-0000-1000-8000-00805f9b34fb", // HM-10 / generic
  "000018f0-0000-1000-8000-00805f9b34fb", // Some ELM327s
];

const OBD_CHAR_UUIDS = [
  "0000fff1-0000-1000-8000-00805f9b34fb", // Write/Notify
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "00002af0-0000-1000-8000-00805f9b34fb"
];

class OBDService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private isConnected = false;
  private isPolling = false;
  private dataCallback: ((data: OBDData) => void) | null = null;
  private currentResolver: ((value: string) => void) | null = null;
  private lastResponse = '';

  // PIDs
  private readonly PIDS = {
    RPM: '010C',
    SPEED: '010D',
    THROTTLE: '0111',
    COOLANT: '0105',
    LOAD: '0104',
    VOLTAGE: 'ATRV'
  };

  async connect(): Promise<{ success: boolean; error?: string }> {
    if (!navigator.bluetooth) {
      console.error("Web Bluetooth not supported");
      return { success: false, error: "Bluetooth not supported in this browser" };
    }

    try {
      console.log("Requesting Bluetooth Device...");
      this.device = await navigator.bluetooth.requestDevice({
        filters: OBD_SERVICE_UUIDS.map(uuid => ({ services: [uuid] })),
        optionalServices: OBD_SERVICE_UUIDS
      });

      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      console.log("Connecting to GATT Server...");
      this.server = await this.device.gatt!.connect();

      console.log("Getting Service...");
      let service: BluetoothRemoteGATTService | undefined;
      
      // Try to find the first available service from our list
      for (const uuid of OBD_SERVICE_UUIDS) {
        try {
            service = await this.server.getPrimaryService(uuid);
            if (service) break;
        } catch (e) {
            // Service not found, try next
        }
      }

      if (!service) throw new Error("No compatible OBD-II service found on device.");

      console.log("Getting Characteristic...");
      // Try to find a characteristic for write/notify
      for (const uuid of OBD_CHAR_UUIDS) {
          try {
              const char = await service.getCharacteristic(uuid);
              if (char.properties.write || char.properties.writeWithoutResponse) {
                  if (char.properties.notify || char.properties.indicate) {
                      this.characteristic = char;
                      break;
                  }
              }
          } catch (e) {
              // Char not found
          }
      }
      
      if (!this.characteristic) {
          // Fallback: iterate all characteristics to find one that supports Notify & Write
          const chars = await service.getCharacteristics();
          this.characteristic = chars.find(c => 
              (c.properties.write || c.properties.writeWithoutResponse) && 
              (c.properties.notify || c.properties.indicate)
          ) || null;
      }

      if (!this.characteristic) {
          throw new Error("No read/write characteristic found on adapter.");
      }

      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', this.handleNotifications.bind(this));

      this.isConnected = true;
      
      // Initialize ELM327
      await this.initializeAdapter();
      
      return { success: true };
    } catch (error: any) {
      console.error("Connection failed", error);
      this.disconnect();
      return { success: false, error: error.message || "Connection failed" };
    }
  }

  disconnect() {
    if (this.device && this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
    this.isPolling = false;
    this.device = null;
    this.server = null;
    this.characteristic = null;
  }

  onDisconnected() {
    console.log("Device disconnected");
    this.isConnected = false;
    this.isPolling = false;
  }

  startPolling(callback: (data: OBDData) => void) {
    if (!this.isConnected) return;
    this.dataCallback = callback;
    this.isPolling = true;
    this.pollLoop();
  }

  stopPolling() {
    this.isPolling = false;
  }

  async getDTCs(): Promise<string[]> {
    if (!this.isConnected) return [];

    const wasPolling = this.isPolling;
    if (wasPolling) this.stopPolling();

    // Give it a moment to clear the current poll operation
    await new Promise(r => setTimeout(r, 100));

    try {
        const response = await this.sendCommand('03'); // Mode 03: Request DTCs
        const codes = this.parseDTCResponse(response);
        
        if (wasPolling && this.dataCallback) this.startPolling(this.dataCallback);
        return codes;
    } catch (e) {
        console.error("DTC Fetch Error", e);
        if (wasPolling && this.dataCallback) this.startPolling(this.dataCallback);
        return [];
    }
  }

  async clearDTCs(): Promise<boolean> {
      if (!this.isConnected) return false;
      
      const wasPolling = this.isPolling;
      if (wasPolling) this.stopPolling();
      await new Promise(r => setTimeout(r, 100));

      try {
          await this.sendCommand('04'); // Mode 04: Clear DTCs
          if (wasPolling && this.dataCallback) this.startPolling(this.dataCallback);
          return true;
      } catch (e) {
          console.error("DTC Clear Error", e);
          if (wasPolling && this.dataCallback) this.startPolling(this.dataCallback);
          return false;
      }
  }

  private async initializeAdapter() {
    // Basic ELM327 Init
    try {
        await this.sendCommand("ATZ"); // Reset
        await new Promise(r => setTimeout(r, 500)); // Wait for reset
        await this.sendCommand("ATE0"); // Echo Off
        await this.sendCommand("ATL0"); // Linefeeds Off
        await this.sendCommand("ATSP0"); // Auto Protocol
        await this.sendCommand("0100"); // Warm up PID 0
    } catch (e) {
        console.warn("Init commands failed, attempting to continue anyway", e);
    }
  }

  private async pollLoop() {
    while (this.isPolling && this.isConnected) {
        try {
            const rpmRaw = await this.sendCommand(this.PIDS.RPM);
            const speedRaw = await this.sendCommand(this.PIDS.SPEED);
            const throttleRaw = await this.sendCommand(this.PIDS.THROTTLE);
            const coolantRaw = await this.sendCommand(this.PIDS.COOLANT);
            const voltageRaw = await this.sendCommand(this.PIDS.VOLTAGE);
            
            const data: OBDData = {
                rpm: this.parseRPM(rpmRaw),
                speed_kmh: this.parseSpeed(speedRaw),
                throttle_pos: this.parseThrottle(throttleRaw),
                coolant_temp: this.parseCoolant(coolantRaw),
                voltage: this.parseVoltage(voltageRaw)
            };

            if (this.dataCallback) {
                this.dataCallback(data);
            }
            
            // Throttle polling slightly to avoid buffer overflows on the dongle
            await new Promise(resolve => setTimeout(resolve, 50)); 
        } catch (e) {
            console.error("Polling error:", e);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
  }

  private sendCommand(cmd: string): Promise<string> {
      return new Promise((resolve, reject) => {
          if (!this.characteristic) {
              reject("No characteristic");
              return;
          }
          
          this.currentResolver = resolve;
          this.lastResponse = '';
          
          const encoder = new TextEncoder();
          const data = encoder.encode(cmd + '\r');
          
          this.characteristic.writeValue(data).catch(reject);
          
          // Timeout
          setTimeout(() => {
              if (this.currentResolver) {
                  // console.warn(`Command ${cmd} timed out`);
                  this.currentResolver = null;
                  resolve(''); // Resolve empty to keep loop alive
              }
          }, 1500); // Extended timeout slightly
      });
  }

  private handleNotifications(event: Event) {
      const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
      if (!value) return;
      
      const decoder = new TextDecoder();
      const str = decoder.decode(value);
      this.lastResponse += str;
      
      // ELM327 ends responses with >
      if (this.lastResponse.includes('>')) {
          const cleanResponse = this.lastResponse.replace(/>/g, '').trim();
          if (this.currentResolver) {
              this.currentResolver(cleanResponse);
              this.currentResolver = null;
          }
          this.lastResponse = '';
      }
  }

  // --- Parsers ---

  private parseRPM(hex: string): number | undefined {
    const bytes = this.hexToBytes(hex);
    if (bytes.length < 2) return undefined;
    const relevant = this.findDataBytes(bytes, 0x0C);
    if (relevant && relevant.length >= 2) {
        return ((relevant[0] * 256) + relevant[1]) / 4;
    }
    return undefined;
  }

  private parseSpeed(hex: string): number | undefined {
      const bytes = this.hexToBytes(hex);
      const relevant = this.findDataBytes(bytes, 0x0D);
      if (relevant && relevant.length >= 1) {
          return relevant[0];
      }
      return undefined;
  }

  private parseThrottle(hex: string): number | undefined {
    const bytes = this.hexToBytes(hex);
    const relevant = this.findDataBytes(bytes, 0x11);
    if (relevant && relevant.length >= 1) {
        return (relevant[0] * 100) / 255;
    }
    return undefined;
  }
  
  private parseCoolant(hex: string): number | undefined {
      const bytes = this.hexToBytes(hex);
      const relevant = this.findDataBytes(bytes, 0x05);
      if (relevant && relevant.length >= 1) {
          return relevant[0] - 40;
      }
      return undefined;
  }

  private parseVoltage(response: string): number | undefined {
      // ATRV returns ASCII string e.g., "12.4V"
      const clean = response.replace(/[^0-9.]/g, '');
      const val = parseFloat(clean);
      return isNaN(val) ? undefined : val;
  }

  private parseDTCResponse(response: string): string[] {
      // Response format often: 43 01 33 00 00 00 ...
      if (response.includes("NO DATA")) return [];

      const bytes = this.hexToBytes(response);
      
      let dataBytes = bytes;
      if (dataBytes[0] === 0x43) {
          dataBytes = dataBytes.slice(1);
      } else if (dataBytes[0] === 0x41 && dataBytes[1] === 0x03) {
          dataBytes = dataBytes.slice(2);
      } else {
          const idx = dataBytes.indexOf(0x43);
          if (idx !== -1) dataBytes = dataBytes.slice(idx + 1);
      }

      const codes: string[] = [];
      for (let i = 0; i < dataBytes.length; i += 2) {
          if (i + 1 >= dataBytes.length) break;
          const A = dataBytes[i];
          const B = dataBytes[i + 1];
          if (A === 0 && B === 0) continue;
          
          const dtc = this.decodeDTCBytes(A, B);
          codes.push(dtc);
      }
      return [...new Set(codes)];
  }

  private decodeDTCBytes(A: number, B: number): string {
      const typeBits = (A & 0xC0) >> 6;
      let typeChar = 'P';
      switch(typeBits) {
          case 0: typeChar = 'P'; break;
          case 1: typeChar = 'C'; break;
          case 2: typeChar = 'B'; break;
          case 3: typeChar = 'U'; break;
      }
      
      const secondChar = (A & 0x30) >> 4;
      const thirdChar = (A & 0x0F).toString(16).toUpperCase();
      const lastTwo = B.toString(16).toUpperCase().padStart(2, '0');
      
      return `${typeChar}${secondChar}${thirdChar}${lastTwo}`;
  }

  private hexToBytes(hex: string): number[] {
      const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
      const bytes: number[] = [];
      for(let i=0; i<clean.length; i+=2) {
          bytes.push(parseInt(clean.substr(i, 2), 16));
      }
      return bytes;
  }

  private findDataBytes(bytes: number[], pid: number): number[] | null {
      for(let i=0; i<bytes.length-1; i++) {
          if (bytes[i] === 0x41 && bytes[i+1] === pid) {
              return bytes.slice(i+2);
          }
      }
      return null;
  }
}

export const obdService = new OBDService();
