import { Platform } from 'react-native';

// In development, Android emulator connects to host machine via 10.0.2.2
// iOS simulator connects via localhost:8000. Real devices connect via Wi-Fi IP or hosted URL.
export const DEFAULT_API_BASE_URL = Platform.select({
  android: 'http://172.22.16.1',
  ios: 'http://localhost:8000',
  default: 'http://localhost:8000',
});

export const API_CONFIG = {
  baseUrl: DEFAULT_API_BASE_URL,
  timeoutMs: 12000,
  enableMockFallback: true, // Seamless offline testing
};
