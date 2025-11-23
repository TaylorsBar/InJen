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
  private commandQueue: string[] = [];
  private processingQueue = false;
  private lastResponse = '';
  private currentResolver: ((value: string) => void) | null = null;

  // PIDs
  private readonly PIDS = {
    RPM: '010C',
    SPEED: '010D',
    THROTTLE: '0111',
    COOLANT: '0105',
    LOAD: '0104',
    VOLTAGE: 'ATRV'
  };

  async connect(): Promise<boolean> {
    if (!navigator.bluetooth) {
      console.error("Web Bluetooth not supported");
      return false;
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

      if (!service) throw new Error("No matching OBD service found.");

      console.log("Getting Characteristic...");
      // Try to find a characteristic for write/notify
      for (const uuid of OBD_CHAR_UUIDS) {
          try {
              this.characteristic = await service.getCharacteristic(uuid);
              if (this.characteristic) break;
          } catch (e) {
              // Char not found
          }
      }
      
      if (!this.characteristic) {
          // Fallback: get any characteristic
          const chars = await service.getCharacteristics();
          if (chars.length > 0) this.characteristic = chars[0];
          else throw new Error("No characteristics found.");
      }

      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', this.handleNotifications.bind(this));

      this.isConnected = true;
      
      // Initialize ELM327
      await this.initializeAdapter();
      
      return true;
    } catch (error) {
      console.error("Connection failed", error);
      this.disconnect();
      return false;
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

  private async initializeAdapter() {
    await this.sendCommand("ATZ"); // Reset
    await this.sendCommand("ATE0"); // Echo Off
    await this.sendCommand("ATL0"); // Linefeeds Off
    await this.sendCommand("ATSP0"); // Auto Protocol
    await this.sendCommand("0100"); // Warm up PID 0
  }

  private async pollLoop() {
    while (this.isPolling && this.isConnected) {
        try {
            const rpmRaw = await this.sendCommand(this.PIDS.RPM);
            const speedRaw = await this.sendCommand(this.PIDS.SPEED);
            const throttleRaw = await this.sendCommand(this.PIDS.THROTTLE);
            const coolantRaw = await this.sendCommand(this.PIDS.COOLANT);
            
            const data: OBDData = {
                rpm: this.parseRPM(rpmRaw),
                speed_kmh: this.parseSpeed(speedRaw),
                throttle_pos: this.parseThrottle(throttleRaw),
                coolant_temp: this.parseCoolant(coolantRaw)
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
          }, 1000);
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
    // Expected: 41 0C A B
    const bytes = this.hexToBytes(hex);
    if (bytes.length < 2) return undefined;
    // For PID 010C, data starts at index 2 (0:41, 1:0C, 2:A, 3:B) usually, 
    // but sometimes response is just AABB if headers off.
    // Assuming standard response "41 0C A B"
    const relevant = this.findDataBytes(bytes, 0x0C);
    if (relevant && relevant.length >= 2) {
        return ((relevant[0] * 256) + relevant[1]) / 4;
    }
    return undefined;
  }

  private parseSpeed(hex: string): number | undefined {
      // Expected: 41 0D A
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

  private hexToBytes(hex: string): number[] {
      // Remove whitespace and non-hex chars
      const clean = hex.replace(/[^0-9A-Fa-f]/g, '');
      const bytes: number[] = [];
      for(let i=0; i<clean.length; i+=2) {
          bytes.push(parseInt(clean.substr(i, 2), 16));
      }
      return bytes;
  }

  private findDataBytes(bytes: number[], pid: number): number[] | null {
      // Look for sequence 41 [PID]
      for(let i=0; i<bytes.length-1; i++) {
          if (bytes[i] === 0x41 && bytes[i+1] === pid) {
              return bytes.slice(i+2);
          }
      }
      // If we are in "NO DATA" or error state
      return null;
  }
}

export const obdService = new OBDService();