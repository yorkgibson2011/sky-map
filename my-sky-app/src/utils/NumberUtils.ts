// src/utils/NumberUtils.ts

export interface HMSCoordinates {
  hours?: number;
  degrees?: number;
  minutes: number;
  seconds: number;
  string: string;
}

export const NumberUtils = {
  fixedLengthDecimal(num: number, decimalPlaces: number): number {
    if (num === undefined || decimalPlaces === undefined) {
      console.warn(`You must pass both parameters: num = ${num}, decimalPlaces = ${decimalPlaces}`);
      return num || 0;
    }
    return Math.round(num * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces);
  },

  decimalToBinaryString(d: number, bits?: number): string {
    const b: number[] = [];
    while (d > 0) {
      b.unshift(d % 2);
      d >>= 1;
    }
    if (bits) {
      while (b.length < bits) {
        b.unshift(0);
      }
    }
    return b.join("");
  },

  binaryStringToDecimal(b: string): number {
    const ba = b.split("");
    let n = 1;
    let r = 0;
    // Iterate backwards since binary places increase from right to left
    for (let i = ba.length - 1; i >= 0; i--) {
      r += n * parseInt(ba[i], 10);
      n *= 2;
    }
    return r;
  },

  // Type-guarded to handle both numbers and objects full of degrees
  normaliseDegrees(degrees: number | Record<string, number>): any {
    if (typeof degrees !== "number") {
      for (const i in degrees) {
        degrees[i] %= 360;
        if (degrees[i] < 0) {
          degrees[i] += 360;
        }
      }
      return degrees;
    } else {
      let norm = degrees;
      while (norm < 0) {
        norm += 360;
      }
      while (norm >= 360) {
        norm -= 360;
      }
      return norm;
    }
  },

  normaliseHours(hours: number): number {
    let norm = hours;
    while (norm < 0) {
      norm += 24;
    }
    while (norm >= 24) {
      norm -= 24;
    }
    return norm;
  },

  degreesRightAscensionToHMS(degrees: number): HMSCoordinates {
    const decimalHours = (degrees / 360) * 24;
    const hours = Math.floor(decimalHours);
    const minutes = Math.floor((decimalHours - hours) * 60);
    const seconds = Math.floor((((decimalHours - hours) * 60) - minutes) * 60) + 1;
    return {
      hours,
      minutes,
      seconds,
      string: `${hours}h ${minutes}m ${seconds}s`
    };
  },

  degreesToHMS(degrees: number): HMSCoordinates {
    const degree = Math.floor(degrees);
    const minutes = (degrees - degree) * 60;
    const seconds = Math.floor(60 * (minutes - Math.floor(minutes)));
    return {
      degrees: degree,
      minutes,
      seconds,
      string: `${degree}h ${Math.floor(minutes)}m ${seconds}s`
    };
  },

  degreesDeclinationToHMS(degrees: number): HMSCoordinates {
    const degree = Math.floor(degrees);
    let minutes = (degrees - degree) * 60;
    minutes = this.fixedLengthDecimal(this.abs(minutes), 2);
    
    let seconds = Math.floor((((degrees - degree) * 60) - minutes) * 60) + 1;
    seconds = this.abs(seconds);
    
    return {
      degrees: degree,
      minutes,
      seconds,
      string: `${degree}° ${minutes}' `
    };
  },

  abs(n: number): number {
    return n < 0 ? -n : n;
  },

  sinD(degrees: number): number {
    return Math.sin((degrees * Math.PI) / 180);
  },

  cosD(degrees: number): number {
    return Math.cos((degrees * Math.PI) / 180);
  },

  tanD(degrees: number): number {
    return Math.tan((degrees * Math.PI) / 180);
  },

  atan2D(y: number, x: number): number {
    return (Math.atan2(y, x) * 180) / Math.PI;
  },

  // Fixed: Inverse trig functions take ratios and output degrees
  atanD(ratio: number): number {
    return (Math.atan(ratio) * 180) / Math.PI;
  },

  // Fixed: Inverse trig functions take ratios and output degrees
  asinD(ratio: number): number {
    return (Math.asin(ratio) * 180) / Math.PI;
  }
};