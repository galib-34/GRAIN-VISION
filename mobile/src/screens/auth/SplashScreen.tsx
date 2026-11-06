import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AuthSplash'>;

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        navigation.replace('MainTabs', { screen: 'HomeTab' });
      } else {
        navigation.replace('AuthWelcome');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [isAuthenticated, navigation]);

  return (
    <View className="flex-1 bg-brand-950 items-center justify-between py-16 px-6">
      {/* Top spacer */}
      <View />

      {/* Center Branding Block */}
      <View className="items-center">
        <View className="w-24 h-24 rounded-3xl bg-brand-900 border-2 border-emerald-500/30 items-center justify-center mb-6 shadow-2xl shadow-emerald-950">
          <Text className="text-5xl">🌾</Text>
        </View>

        <Text className="text-3xl font-black text-white tracking-wider mb-2">
          GRAIN-VISION
        </Text>

        <View className="bg-emerald-500/20 px-3.5 py-1 rounded-full border border-emerald-400/30 mb-4">
          <Text className="text-xs font-bold text-emerald-300 tracking-widest uppercase">
            Smart Grain Procurement
          </Text>
        </View>

        <Text className="text-sm text-slate-400 text-center max-w-xs leading-5">
          AI-Powered Rice Quality Assessment, Defect Extraction & Fair Price Estimation
        </Text>
      </View>

      {/* Bottom Loading Indicator & Footnote */}
      <View className="items-center">
        <ActivityIndicator size="small" color="#10b981" className="mb-3" />
        <Text className="text-xs text-slate-500">
          Procurement Decision Support System
        </Text>
      </View>
    </View>
  );
};
