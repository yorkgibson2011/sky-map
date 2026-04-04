// src/utils/PlanetaryPositions.ts

import { NumberUtils } from './NumberUtils';

export interface OrbitalElements {
  name?: string;
  N: number;
  i: number;
  w: number;
  a: number;
  e: number;
  M: number;
  ecl: number;
  days: number;
  date: Date;
}

export interface PositionData {
  lonsun?: number;
  moonPhase?: number;
  lonecl?: number;
  latecl?: number;
  r?: number;
  RA?: number;
  Dec?: number;
  LST?: number;
  HA?: number;
  azimuth?: number;
  altitude?: number;
  RightAscension?: string;
  Declination?: string;
}

export const PlanetaryPositions = {
  epoch: new Date(1999, 11, 31, 0, 0, 0, 0),
  YEAR_DAYS: 365.256898326,
  // Pluto has been officially retired from the array
  PLANET_NAMES: ["mercury", "venus", "earth", "moon", "mars", "jupiter", "saturn", "uranus", "neptune"],

  MOON_SYNODIC_PERIOD: 29.5306,
  MOON_SIDEREAL_PERIOD: 27.32121599478479,

  simple: false,
  lastDate: new Date(),
  lastSunDate: new Date(),
  lastSun: null as PositionData | null,
  lastLST: 0,
  lastLon: -2.583,
  longitude: -2.583,
  latitude: 51.467,

  // --- CELESTIAL BODY CALCULATIONS ---

  sun(date: Date): PositionData {
    const d = Math.floor(this.getDays(date));
    const w = NumberUtils.normaliseDegrees(282.9404 + 4.70935E-5 * d);
    const a = 1.000000;
    const e = 0.016709 - 1.151E-9 * d;
    const M = NumberUtils.normaliseDegrees(356.0470 + 0.9856002585 * d);
    const ecl = 23.4393 - (3.563E-7 * d);
    const E = this.getE(M, e, false);
    const rv = this.planetDistanceAndTrueAnomaly(E, e, a);
    const lonsun = rv.v + w;

    if (!this.simple) {
      const xs = rv.r * NumberUtils.cosD(lonsun);
      const ys = rv.r * NumberUtils.sinD(lonsun);
      const xe = xs;
      const ye = ys * NumberUtils.cosD(ecl);
      const ze = ys * NumberUtils.sinD(ecl);
      const RA = NumberUtils.normaliseDegrees(NumberUtils.atan2D(ye, xe));
      const Dec = NumberUtils.atan2D(ze, Math.sqrt(xe * xe + ye * ye));
      
      let LST = 0;
      if (this.lastSunDate.getTime() !== date.getTime() || !this.lastLST || this.lastLon !== this.longitude) {
        this.lastSunDate = date;
        this.lastLon = this.longitude; // Store the new longitude
        this.lastLST = this.localSiderealTime(date, lonsun);
        this.lastSun = this.sun(date); 
      }
      LST = this.lastLST;
      const HA = NumberUtils.normaliseDegrees(LST * 15 - RA);

      const aax = NumberUtils.cosD(HA) * NumberUtils.cosD(Dec);
      const aay = NumberUtils.sinD(HA) * NumberUtils.cosD(Dec);
      const aaz = NumberUtils.sinD(Dec);

      const xhor = aax * NumberUtils.sinD(this.latitude) - aaz * NumberUtils.cosD(this.latitude);
      const yhor = aay;
      const zhor = aax * NumberUtils.cosD(this.latitude) + aaz * NumberUtils.sinD(this.latitude);

      const azimuth = NumberUtils.atan2D(yhor, xhor) + 180;
      const altitude = NumberUtils.atan2D(zhor, Math.sqrt(xhor * xhor + yhor * yhor));

      return {
        r: rv.r,
        lonsun: lonsun,
        RA: RA,
        Dec: Dec,
        LST: LST,
        HA: HA,
        azimuth: azimuth,
        altitude: altitude,
        RightAscension: NumberUtils.degreesRightAscensionToHMS(NumberUtils.normaliseDegrees(RA)).string,
        Declination: NumberUtils.degreesDeclinationToHMS(Dec).string
      };
    } else {
      return { lonsun: lonsun };
    }
  },

  mercury(date: Date): PositionData {
    const d = this.getDays(date);
    const oe: OrbitalElements = {
      N: 48.3313 + 3.24587E-5 * d,
      i: 7.0047 + 5.00E-8 * d,
      w: NumberUtils.normaliseDegrees(29.1241 + 1.01444E-5 * d),
      a: 0.387098,
      e: 0.205635 + 5.59E-10 * d,
      M: NumberUtils.normaliseDegrees(168.6562 + 4.0923344368 * d),
      ecl: 23.4393 - (3.563E-7 * d),
      days: d,
      date: date
    };
    return this.getPosition(oe);
  },

  venus(date: Date): PositionData {
    const d = this.getDays(date);
    const oe: OrbitalElements = {
      N: NumberUtils.normaliseDegrees(76.6799 + 2.46590E-5 * d),
      i: 3.3946 + 2.75E-8 * d,
      w: NumberUtils.normaliseDegrees(54.8910 + 1.38374E-5 * d),
      a: 0.723330,
      e: 0.006773 - 1.302E-9 * d,
      M: NumberUtils.normaliseDegrees(48.0052 + 1.6021302244 * d),
      ecl: 23.4393 - (3.563E-7 * d),
      days: d,
      date: date
    };
    return this.getPosition(oe);
  },

  earth(date: Date): PositionData {
    const d = this.getDays(date);
    const oe: OrbitalElements = {
      N: 0.0,
      i: 0.0,
      w: NumberUtils.normaliseDegrees(282.9404 + 4.70935E-5 * d),
      a: 1.000000,
      e: 0.016709 - 1.151E-9 * d,
      M: NumberUtils.normaliseDegrees(356.0470 + 0.9856002585 * d),
      ecl: 23.4393 - (3.563E-7 * d),
      days: d,
      date: date
    };
    const ro = this.getPosition(oe);
    if (ro.lonecl !== undefined) {
      ro.lonecl = NumberUtils.normaliseDegrees(ro.lonecl + 180);
    }
    return ro;
  },

  moon(date: Date): PositionData {
    const d = this.getDays(date);
    const oe: OrbitalElements = {
      N: NumberUtils.normaliseDegrees(125.1228 - 0.0529538083 * d),
      i: 5.1454,
      w: NumberUtils.normaliseDegrees(318.0634 + 0.1643573223 * d),
      a: 60.2666,
      e: 0.054900,
      M: NumberUtils.normaliseDegrees(115.3654 + 13.0649929509 * d),
      ecl: 23.4393 - (3.563E-7 * d),
      days: d,
      date: date
    };
    return this.getPosition(oe, "moon");
  },

  mars(date: Date): PositionData {
    const d = this.getDays(date);
    const oe: OrbitalElements = {
      N: NumberUtils.normaliseDegrees(49.5574 + 2.11081E-5 * d),
      i: 1.8497 - 1.78E-8 * d,
      w: NumberUtils.normaliseDegrees(286.5016 + 2.92961E-5 * d),
      a: 1.523688,
      e: 0.093405 + 2.516E-9 * d,
      M: NumberUtils.normaliseDegrees(18.6021 + 0.5240207766 * d),
      ecl: 23.4393 - (3.563E-7 * d),
      days: d,
      date: date
    };
    return this.getPosition(oe);
  },

  jupiter(date: Date): PositionData {
    const d = this.getDays(date);
    const oe: OrbitalElements = {
      N: NumberUtils.normaliseDegrees(100.4542 + 2.76854E-5 * d),
      i: 1.3030 - 1.557E-7 * d,
      w: NumberUtils.normaliseDegrees(273.8777 + 1.64505E-5 * d),
      a: 5.20256,
      e: 0.048498 + 4.469E-9 * d,
      M: NumberUtils.normaliseDegrees(19.8950 + 0.0830853001 * d),
      ecl: 23.4393 - (3.563E-7 * d),
      days: d,
      date: date
    };
    return this.getPosition(oe);
  },

  saturn(date: Date): PositionData {
    const d = this.getDays(date);
    const oe: OrbitalElements = {
      N: NumberUtils.normaliseDegrees(113.6634 + 2.38980E-5 * d),
      i: 2.4886 - 1.081E-7 * d,
      w: NumberUtils.normaliseDegrees(339.3939 + 2.97661E-5 * d),
      a: 9.55475,
      e: 0.055546 - 9.499E-9 * d,
      M: NumberUtils.normaliseDegrees(316.9670 + 0.0334442282 * d),
      ecl: 23.4393 - (3.563E-7 * d),
      days: d,
      date: date
    };
    return this.getPosition(oe);
  },

  uranus(date: Date): PositionData {
    const d = this.getDays(date);
    const oe: OrbitalElements = {
      N: NumberUtils.normaliseDegrees(74.0005 + 1.3978E-5 * d),
      i: 0.7733 + 1.9E-8 * d,
      w: NumberUtils.normaliseDegrees(96.6612 + 3.0565E-5 * d),
      a: NumberUtils.normaliseDegrees(19.18171 - 1.55E-8 * d),
      e: 0.047318 + 7.45E-9 * d,
      M: NumberUtils.normaliseDegrees(142.5905 + 0.011725806 * d),
      ecl: 23.4393 - (3.563E-7 * d),
      days: d,
      date: date
    };
    return this.getPosition(oe);
  },

  neptune(date: Date): PositionData {
    const d = this.getDays(date);
    const oe: OrbitalElements = {
      N: NumberUtils.normaliseDegrees(131.7806 + 3.0173E-5 * d),
      i: 1.7700 - 2.55E-7 * d,
      w: NumberUtils.normaliseDegrees(272.8461 - 6.027E-6 * d),
      a: NumberUtils.normaliseDegrees(30.05826 + 3.313E-8 * d),
      e: 0.008606 + 2.15E-9 * d,
      M: NumberUtils.normaliseDegrees(260.2471 + 0.005995147 * d),
      ecl: 23.4393 - (3.563E-7 * d),
      days: d,
      date: date
    };
    return this.getPosition(oe);
  },

  // --- CORE MATH HELPER METHODS ---

  getDays(date: Date): number {
    const Y = date.getFullYear();
    const M = date.getUTCMonth() + 1;
    const D = date.getUTCDate();
    const altD = ((date.getTime() - this.epoch.getTime()) / (1000 * 60 * 60 * 24));
    return altD;
  },

  localSiderealTime(date: Date, lonsun: number): number {
    const GMST0 = NumberUtils.normaliseDegrees(lonsun + 180) / 15;
    const UT = date.getUTCHours() + ((date.getUTCMinutes() / 60) + (date.getUTCSeconds() / 3600));
    return NumberUtils.normaliseHours(GMST0 + UT + (this.longitude / 15));
  },

  planetDistanceAndTrueAnomaly(E: number, e: number, a: number): { r: number; v: number } {
    const xv = a * (NumberUtils.cosD(E) - e);
    const yv = a * (Math.sqrt(1.0 - e * e) * NumberUtils.sinD(E));
    const v = NumberUtils.atan2D(yv, xv);
    const r = Math.sqrt(xv * xv + yv * yv);
    return { r, v };
  },

  planetHeliocentricPosition(N: number, w: number, i: number, rv: { r: number; v: number }): { lonecl: number; latecl: number } {
    const xh = rv.r * (NumberUtils.cosD(N) * NumberUtils.cosD(rv.v + w) - NumberUtils.sinD(N) * NumberUtils.sinD(rv.v + w) * NumberUtils.cosD(i));
    const yh = rv.r * (NumberUtils.sinD(N) * NumberUtils.cosD(rv.v + w) + NumberUtils.cosD(N) * NumberUtils.sinD(rv.v + w) * NumberUtils.cosD(i));
    const zh = rv.r * (NumberUtils.sinD(rv.v + w) * NumberUtils.sinD(i));
    const lonecl = NumberUtils.atan2D(yh, xh);
    const latecl = NumberUtils.atan2D(zh, Math.sqrt(xh * xh + yh * yh));
    return { lonecl, latecl };
  },

  getE(M: number, e: number, isPlanet: boolean): number {
    let rE = M + e * (180 / Math.PI) * NumberUtils.sinD(M) * (1 + e * NumberUtils.cosD(M));
    if (isPlanet && e > 0.06) {
      let E0 = rE;
      let E1 = E0 - (E0 - (180 / Math.PI) * e * NumberUtils.sinD(E0) - M) / (1 - e * NumberUtils.cosD(E0));
      while (Math.abs(E1 - E0) > 5E-3) {
        E0 = E1;
        E1 = E0 - (E0 - (180 / Math.PI) * e * NumberUtils.sinD(E0) - M) / (1 - e * NumberUtils.cosD(E0));
      }
      rE = E1;
    }
    return rE;
  },

  azimuthAltitude(RA: number, Dec: number, date: Date): { azimuth: number; altitude: number; LST: number; HA: number } {
    if (this.lastDate.getTime() !== date.getTime() || !this.lastSun) {
      this.lastDate = date;
      this.lastSun = this.sun(date);
    }
    const sun = this.lastSun as PositionData;
    const lonsun = sun.lonsun!;
    
    if (this.lastDate.getTime() !== date.getTime() || !this.lastLST || this.lastLon !== this.longitude) {
      this.lastDate = date;
      this.lastLon = this.longitude; // Store the new longitude
      this.lastLST = this.localSiderealTime(date, lonsun);
    }
    const LST = this.lastLST;
    const HA = NumberUtils.normaliseDegrees(LST * 15 - RA * 15);

    const aax = NumberUtils.cosD(HA) * NumberUtils.cosD(Dec);
    const aay = NumberUtils.sinD(HA) * NumberUtils.cosD(Dec);
    const aaz = NumberUtils.sinD(Dec);

    const xhor = aax * NumberUtils.sinD(this.latitude) - aaz * NumberUtils.cosD(this.latitude);
    const yhor = aay;
    const zhor = aax * NumberUtils.cosD(this.latitude) + aaz * NumberUtils.sinD(this.latitude);

    const azimuth = NumberUtils.atan2D(yhor, xhor) + 180;
    const altitude = NumberUtils.atan2D(zhor, Math.sqrt(xhor * xhor + yhor * yhor));
    
    return { azimuth, altitude, LST, HA };
  },

  getPosition(oe: OrbitalElements, special?: string): PositionData {
    const { N, i, w, a, e, M, ecl, date } = oe;
    const E = this.getE(M, e, true);
    
    const rv = this.planetDistanceAndTrueAnomaly(E, e, a);
    const hp = this.planetHeliocentricPosition(N, w, i, rv);

    if (this.simple) {
      return { lonecl: hp.lonecl };
    }

    const xh = rv.r * NumberUtils.cosD(hp.lonecl) * NumberUtils.cosD(hp.latecl);
    const yh = rv.r * NumberUtils.sinD(hp.lonecl) * NumberUtils.cosD(hp.latecl);
    const zh = rv.r * NumberUtils.sinD(hp.latecl);

    if (this.lastDate.getTime() !== date.getTime() || !this.lastSun) {
      this.lastDate = date;
      this.lastSun = this.sun(date);
    }
    
    const sun = this.lastSun as PositionData;
    const rs = sun.r!;
    const lonsun = sun.lonsun!;

    const xs = rs * NumberUtils.cosD(lonsun);
    const ys = rs * NumberUtils.sinD(lonsun);
    
    let xg = xh + xs;
    let yg = yh + ys;
    const zg = zh;

    if (special === "moon") {
      xg = xh;
      yg = yh;
    } 

    const xe = xg;
    const ye = yg * NumberUtils.cosD(ecl) - zg * NumberUtils.sinD(ecl);
    const ze = yg * NumberUtils.sinD(ecl) + zg * NumberUtils.cosD(ecl);

    let RA = NumberUtils.normaliseDegrees(NumberUtils.atan2D(ye, xe)) / 15;
    let Dec = NumberUtils.atan2D(ze, Math.sqrt(xe * xe + ye * ye));
    const rg = Math.sqrt(xe * xe + ye * ye + ze * ze);
    
    const aa = this.azimuthAltitude(RA, Dec, date);
    let moonPhase = 0;

    if (special === "moon") {
      const mpar = NumberUtils.asinD(1 / rg);
      const gclat = this.latitude - 0.1924 * NumberUtils.sinD(2 * this.latitude);
      const rho = 0.99833 + 0.00167 * NumberUtils.cosD(2 * this.latitude);
      const g = NumberUtils.atanD(NumberUtils.tanD(gclat) / NumberUtils.cosD(aa.HA));
      
      RA = RA - mpar * rho * NumberUtils.cosD(gclat) * NumberUtils.sinD(aa.HA) / NumberUtils.cosD(Dec);
      Dec = Dec - mpar * rho * NumberUtils.sinD(gclat) * NumberUtils.sinD(g - Dec) / NumberUtils.sinD(g);
      
      const moonSunAngle = NumberUtils.normaliseDegrees(360 - (aa.HA - sun.HA!)) / (360 / this.MOON_SYNODIC_PERIOD);
      moonPhase = Math.round(moonSunAngle);
    }

    return {
      moonPhase,
      lonecl: hp.lonecl,
      latecl: hp.latecl,
      r: rg,
      RA,
      Dec,
      LST: aa.LST,
      HA: aa.HA,
      azimuth: aa.azimuth,
      altitude: aa.altitude,
      RightAscension: NumberUtils.degreesRightAscensionToHMS(RA).string,
      Declination: NumberUtils.degreesDeclinationToHMS(Dec).string
    };
  }
};