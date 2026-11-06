import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AuthWelcome'>;

export const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const login = useAuthStore((state) => state.login);

  const handleQuickDemo = async () => {
    await login('officer', 'grainvision2026');
    navigation.replace('MainTabs', { screen: 'HomeTab' });
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ flexGrow: 1 }}>
      {/* Top Hero Section */}
      <View className="bg-brand-950 pt-16 pb-12 px-6 rounded-b-[36px] shadow-lg shadow-emerald-950/20">
        <View className="flex-row items-center space-x-2 mb-4">
          <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center border border-emerald-400/30">
            <Text className="text-base">🌾</Text>
          </View>
          <Text className="text-xs font-bold text-emerald-400 tracking-wider uppercase">
            Mandi Intake & Procurement
          </Text>
        </View>

        <Text className="text-3xl font-black text-white leading-tight mb-3">
          Instant Rice Quality Assessment in seconds.
        </Text>
        <Text className="text-sm text-slate-300 leading-relaxed">
          AI-driven edge defect extraction, transparent mandi-linked pricing, and digital lot ledger built for millers, inspectors, and farmers.
        </Text>
      </View>

      {/* Feature Highlights Grid */}
      <View className="p-6 space-y-3.5 flex-1 justify-center">
        <View className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex-row items-center space-x-4">
          <View className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 items-center justify-center">
            <Text className="text-xl">⚡</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-slate-900 mb-0.5">YOLOv8n Defect Analysis</Text>
            <Text className="text-xs text-slate-500">
              Detects Normal, Broken, Chalky, and Discolored grains with bounding-box precision.
            </Text>
          </View>
        </View>

        <View className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex-row items-center space-x-4">
          <View className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 items-center justify-center">
            <Text className="text-xl">⚖️</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-slate-900 mb-0.5">Fair Pricing Engine</Text>
            <Text className="text-xs text-slate-500">
              Connects to AGMARKNET modal mandi baseline with explainable quality deductions.
            </Text>
          </View>
        </View>

        <View className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex-row items-center space-x-4">
          <View className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 items-center justify-center">
            <Text className="text-xl">📋</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-slate-900 mb-0.5">Farmer & Lot Ledger</Text>
            <Text className="text-xs text-slate-500">
              Reuses saved farmer profiles and tracks accepted, negotiated, and rejected lots.
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons Section */}
      <View className="p-6 pt-2 pb-10 space-y-3">
        <TouchableOpacity
          onPress={() => navigation.navigate('AuthLogin')}
          className="bg-brand-600 py-4 px-6 rounded-2xl items-center shadow-md shadow-emerald-700/30 active:scale-98"
        >
          <Text className="text-white font-bold text-base tracking-wide">
            Sign In as Officer
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('AuthRegister')}
          className="bg-white py-3.5 px-6 rounded-2xl items-center border border-slate-300 active:scale-98"
        >
          <Text className="text-slate-700 font-semibold text-sm">
            Register New Inspector Profile
          </Text>
        </TouchableOpacity>

        {/* 1-Click Demo Shortcut */}
        <TouchableOpacity
          onPress={handleQuickDemo}
          className="bg-emerald-50 py-3 px-4 rounded-xl items-center border border-emerald-200 active:scale-98"
        >
          <Text className="text-xs font-bold text-emerald-800">
            🚀 Quick Demo Access (1-Click Officer Sign In)
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
