import { OBDData, BluetoothDevice, BluetoothRemoteGATTServer, BluetoothRemoteGATTCharacteristic } from "./obdService";

// UUIDs for the Custom "CartelWorx" Hardware (Serial over BLE)
const CAN_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e"; // UART Service
const CAN_RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // Write to device
const CAN_TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // Notify from device

export interface CanFrame {
  timestamp: number;
  id: number;
  extended: boolean;
  dlc: number;
  data: number[];
  direction: 'rx' | 'tx';
}

export type CanBitrate = 125000 | 250000 | 500000 | 1000000;
export type CanMode = 'NORMAL' | 'LOOPBACK' | 'LISTEN_ONLY' | 'CONFIG';

type CanDataCallback = (frame: CanFrame) => void;

class CanService {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null; // We write to this
  private txChar: BluetoothRemoteGATTCharacteristic | null = null; // We receive from this
  
  private isConnected = false;
  private subscribers: CanDataCallback[] = [];
  
  // Hardware State
  private currentBitrate: CanBitrate = 500000;
  private currentMode: CanMode = 'NORMAL';

  public async connect(): Promise<boolean> {
    if (!navigator.bluetooth) return false;

    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [CAN_SERVICE_UUID] }],
        optionalServices: [CAN_SERVICE_UUID]
      });

      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));
      this.server = await this.device.gatt!.connect();
      
      const service = await this.server.getPrimaryService(CAN_SERVICE_UUID);
      this.rxChar = await service.getCharacteristic(CAN_RX_CHAR_UUID);
      this.txChar = await service.getCharacteristic(CAN_TX_CHAR_UUID);

      await this.txChar.startNotifications();
      this.txChar.addEventListener('characteristicvaluechanged', this.handleNotification.bind(this));

      this.isConnected = true;
      console.log("CAN Bus Hardware Connected");
      
      // Default Init
      await this.configureMCP2515(500000, 'NORMAL');
      
      return true;
    } catch (error) {
      console.error("CAN Connection failed:", error);
      this.disconnect();
      return false;
    }
  }

  public disconnect() {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
    this.device = null;
    this.server = null;
    this.rxChar = null;
    this.txChar = null;
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      bitrate: this.currentBitrate,
      mode: this.currentMode
    };
  }

  /**
   * Configures the MCP2515 Controller settings.
   * Maps to firmware commands that write to CNF1, CNF2, CNF3 and CANCTRL registers.
   */
  public async configureMCP2515(bitrate: CanBitrate, mode: CanMode) {
    if (!this.isConnected) return;

    // Protocol: C<bitrate_code><mode_code>\r
    // Bitrate: 4=125k, 5=250k, 6=500k, 8=1M (slcan style mapping)
    // Mode: 0=Normal, 1=Loopback, 2=Listen
    
    let bitrateCmd = 'S6'; // Default 500k
    switch(bitrate) {
        case 125000: bitrateCmd = 'S4'; break;
        case 250000: bitrateCmd = 'S5'; break;
        case 500000: bitrateCmd = 'S6'; break;
        case 1000000: bitrateCmd = 'S8'; break;
    }

    let modeCmd = 'O'; // Open in Normal
    if (mode === 'LOOPBACK') modeCmd = 'L'; // Custom cmd for Loopback if supported
    if (mode === 'LISTEN_ONLY') modeCmd = 'L'; // Often L is listen only in slcan

    // Sequence: Close, Set Speed, Open
    await this.writeRaw('C'); // Close/Config mode
    await new Promise(r => setTimeout(r, 50));
    await this.writeRaw(bitrateCmd);
    await new Promise(r => setTimeout(r, 50));
    await this.writeRaw(modeCmd); // Open

    this.currentBitrate = bitrate;
    this.currentMode = mode;
  }

  /**
   * Sends a standard or extended CAN Frame.
   * Protocol: 
   * Standard: t<id_3_chars><dlc_1_char><data_hex>\r
   * Extended: T<id_8_chars><dlc_1_char><data_hex>\r
   */
  public async sendFrame(id: number, data: number[], isExtended?: boolean) {
    if (!this.isConnected) return;
    
    const dlcStr = data.length.toString();
    const dataStr = data.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
    
    // Auto-detect extended frame if not specified
    const useExtended = isExtended !== undefined ? isExtended : id > 0x7FF;

    let cmd = '';
    if (useExtended) {
        const idStr = id.toString(16).padStart(8, '0').toUpperCase();
        cmd = `T${idStr}${dlcStr}${dataStr}`;
    } else {
        const idStr = id.toString(16).padStart(3, '0').toUpperCase();
        cmd = `t${idStr}${dlcStr}${dataStr}`;
    }

    await this.writeRaw(cmd);

    // Notify local subscribers of TX for UI loopback
    this.notifySubscribers({
        timestamp: Date.now(),
        id,
        extended: useExtended,
        dlc: data.length,
        data,
        direction: 'tx'
    });
  }

  public subscribe(callback: CanDataCallback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(s => s !== callback);
    };
  }

  private async writeRaw(data: string) {
    if (!this.rxChar) return;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data + '\r');
    try {
        await this.rxChar.writeValue(bytes);
    } catch (e) {
        console.error("CAN Write Failed", e);
    }
  }

  private handleNotification(event: Event) {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;

    const decoder = new TextDecoder();
    const text = decoder.decode(value);
    
    // Simple buffer handling - implies packets usually arrive complete or delimited by \r
    const lines = text.split('\r');
    
    lines.forEach(line => {
        if (line.length === 0) return;
        this.parseSlcanLine(line);
    });
  }

  /**
   * Parses slcan format: tiiildd...
   * t = standard, T = extended
   * iii = id
   * l = length
   * dd = data bytes
   */
  private parseSlcanLine(line: string) {
      const type = line.charAt(0);
      if (type !== 't' && type !== 'T') return; // Ignore non-frame responses (z, OK, etc)

      const extended = type === 'T';
      const idLen = extended ? 8 : 3;
      
      if (line.length < 1 + idLen + 1) return;

      const idHex = line.substr(1, idLen);
      const id = parseInt(idHex, 16);
      
      const dlcHex = line.substr(1 + idLen, 1);
      const dlc = parseInt(dlcHex, 10);
      
      const dataHexStr = line.substr(1 + idLen + 1);
      const data: number[] = [];
      for (let i = 0; i < dataHexStr.length; i += 2) {
          data.push(parseInt(dataHexStr.substr(i, 2), 16));
      }

      const frame: CanFrame = {
          timestamp: Date.now(),
          id,
          extended,
          dlc,
          data,
          direction: 'rx'
      };

      this.notifySubscribers(frame);
  }

  private notifySubscribers(frame: CanFrame) {
      this.subscribers.forEach(cb => cb(frame));
  }

  private onDisconnected() {
      this.isConnected = false;
      console.log("CAN Hardware Disconnected");
  }
}

export const canService = new CanService();