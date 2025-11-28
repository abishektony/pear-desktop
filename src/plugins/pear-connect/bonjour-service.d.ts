declare module 'bonjour-service' {
  export interface BonjourService {
    publish(options: {
      name: string;
      type: string;
      port: number;
      txt?: Record<string, string>;
    }): Service;
    
    destroy(): void;
  }

  export interface Service {
    stop(): void;
  }

  export default class Bonjour implements BonjourService {
    constructor();
    publish(options: {
      name: string;
      type: string;
      port: number;
      txt?: Record<string, string>;
    }): Service;
    destroy(): void;
  }
}
