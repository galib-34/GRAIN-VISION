import './global.css';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { useLotStore } from './src/stores/lotStore';

export default function App() {
  const loadInitialData = useLotStore((state) => state.loadInitialData);

  useEffect(() => {
    // Preload sellers and mandi baseline data on startup
    loadInitialData();
  }, [loadInitialData]);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" backgroundColor="#ffffff" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
