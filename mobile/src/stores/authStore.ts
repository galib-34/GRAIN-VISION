import { create } from 'zustand';
import { UserProfile } from '../types';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  measurementUnit: 'kg' | 'quintal';
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, fullName: string) => Promise<boolean>;
  logout: () => void;
  setMeasurementUnit: (unit: 'kg' | 'quintal') => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: {
    id: 'u-1',
    username: 'officer',
    fullName: 'Procurement Officer',
    role: 'Lead Agricultural Inspector',
    orgName: 'Andhra Pradesh Civil Supplies Corp',
    phone: '+91 98490 12345',
  },
  isAuthenticated: true, // Default authenticated for frictionless preview
  measurementUnit: 'kg',

  login: async (username, password) => {
    // Mock login verification
    await new Promise((resolve) => setTimeout(resolve, 600));
    set({
      isAuthenticated: true,
      user: {
        id: `u-${Date.now()}`,
        username,
        fullName: username === 'officer' ? 'Procurement Officer' : username,
        role: 'Agricultural Inspector',
        orgName: 'Regional Grain Procurement Yard',
      },
    });
    return true;
  },

  register: async (username, password, fullName) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    set({
      isAuthenticated: true,
      user: {
        id: `u-${Date.now()}`,
        username,
        fullName,
        role: 'Procurement Officer',
        orgName: 'Regional Grain Procurement Yard',
      },
    });
    return true;
  },

  logout: () => {
    set({ isAuthenticated: false, user: null });
  },

  setMeasurementUnit: (unit) => {
    set({ measurementUnit: unit });
  },
}));
