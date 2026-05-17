/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PPE {
  id: string;
  name: string;
  icon: string;
}

export interface Task {
  id: string;
  name: string;
  requiredGear: string[];
  baseRisk: 'Low' | 'Medium' | 'High' | 'Extreme';
  description: string;
}

export const GEAR: Record<string, PPE> = {
  helmet: { id: 'helmet', name: 'Hard Hat', icon: 'HardHat' },
  gloves: { id: 'gloves', name: 'Safety Gloves', icon: 'Grip' },
  boots: { id: 'boots', name: 'Steel Toe Boots', icon: 'Footprints' },
  goggles: { id: 'goggles', name: 'Safety Goggles', icon: 'Glasses' },
  harness: { id: 'harness', name: 'Safety Harness', icon: 'Umbrella' },
  vest: { id: 'vest', name: 'Reflective Vest', icon: 'Shirt' },
  apron: { id: 'apron', name: 'Welding Apron', icon: 'Shield' },
  mask: { id: 'mask', name: 'Welding Mask', icon: 'Aperture' },
  earmuffs: { id: 'earmuffs', name: 'Hearing Protection', icon: 'Headphones' },
};

export const TASKS: Task[] = [
  {
    id: 'welding',
    name: 'Industrial Welding',
    requiredGear: ['helmet', 'mask', 'gloves', 'apron', 'boots'],
    baseRisk: 'High',
    description: 'High heat, sparks, and intense UV radiation.',
  },
  {
    id: 'height',
    name: 'Work at Height',
    requiredGear: ['helmet', 'harness', 'boots', 'gloves'],
    baseRisk: 'Extreme',
    description: 'Structural assembly or maintenance above 2 meters.',
  },
  {
    id: 'excavation',
    name: 'Excavation / Digging',
    requiredGear: ['helmet', 'vest', 'boots', 'earmuffs'],
    baseRisk: 'Medium',
    description: 'Trench digging and heavy machinery operation.',
  },
  {
    id: 'electrical',
    name: 'Electrical Maintenance',
    requiredGear: ['helmet', 'gloves', 'boots', 'goggles'], // Note: specifically insulated
    baseRisk: 'High',
    description: 'Live circuit handling and panel inspection.',
  },
];
