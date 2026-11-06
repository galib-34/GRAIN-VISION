import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const ProfileTabScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { user, logout, measurementUnit, setMeasurementUnit } = useAuthStore();

  const [useMandiApi, setUseMandiApi] = useState(true);
  const [moistureAlerts, setMoistureAlerts] = useState(true);
  const [moistureThreshold, setMoistureThreshold] = useState('14.0%');

  const handleLogout = () => {
    Alert.alert(
      'Confirm Sign Out',
      'Are you sure you want to sign out of this procurement terminal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            logout();
            navigation.reset({
              index: 0,
              routes: [{ name: 'AuthWelcome' }],
            });
          },
        },
      ]
    );
  };

  const showAboutApp = () => {
    Alert.alert(
      '🌾 GRAIN-VISION Mobile',
      'Version 2.0.0 (Expo SDK 51)\n\nEdge AI rice quality inspection & procurement decision support system.\n\nModel: YOLOv8n (train2.pt)\nDefect Classes: Sound, Broken-clear, Broken-chalky, Whole-chalky, Unsound, Foreign, Stone, Plastic.',
      [{ text: 'OK' }]
    );
  };

  const showStatutoryNotice = () => {
    Alert.alert(
      '⚠️ Statutory Disclaimer',
      'All calculated Quality Scores, Priority Schedules, and Estimated Prices are advisory decision-support metrics derived strictly from computer vision defect distribution.\n\nThey do NOT constitute an officially accredited statutory grade or legal guarantee.',
      [{ text: 'Understood' }]
    );
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 50 }}>
      {/* Top Header & Officer Profile Card */}
      <View className="bg-brand-950 pt-14 pb-8 px-5 rounded-b-[32px] shadow-lg shadow-emerald-950/20">
        <Text className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">
          Inspector Profile & Terminal
        </Text>

        <View className="flex-row items-center space-x-4">
          <View className="w-16 h-16 rounded-3xl bg-brand-900 border-2 border-emerald-400/30 items-center justify-center">
            <Text className="text-3xl">👤</Text>
          </View>

          <View className="flex-1">
            <Text className="text-xl font-black text-white">
              {user?.fullName || 'Procurement Officer'}
            </Text>
            <Text className="text-xs text-emerald-300 font-semibold mt-0.5">
              ID: {user?.username || 'officer'} · {user?.role || 'Agricultural Inspector'}
            </Text>
            <Text className="text-[11px] text-slate-400 mt-0.5">
              📍 {user?.orgName || 'Andhra Pradesh Civil Supplies Corp'}
            </Text>
          </View>
        </View>
      </View>

      <View className="p-5 -mt-3 space-y-4">
        {/* Section 1: Measurement & Pricing Preferences */}
        <View className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3.5">
          <Text className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Procurement Preferences
          </Text>

          {/* Unit Toggle Preference */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
            <View>
              <Text className="text-xs font-bold text-slate-800">Default Lot Unit</Text>
              <Text className="text-[10px] text-slate-400">Kilograms vs. Quintals</Text>
            </View>

            <View className="flex-row bg-slate-100 p-1 rounded-xl">
              <TouchableOpacity
                onPress={() => setMeasurementUnit('kg')}
                className={`px-3 py-1.5 rounded-lg ${measurementUnit === 'kg' ? 'bg-white shadow-sm' : ''}`}
              >
                <Text className={`text-xs font-bold ${measurementUnit === 'kg' ? 'text-brand-950' : 'text-slate-500'}`}>
                  kg
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMeasurementUnit('quintal')}
                className={`px-3 py-1.5 rounded-lg ${measurementUnit === 'quintal' ? 'bg-white shadow-sm' : ''}`}
              >
                <Text className={`text-xs font-bold ${measurementUnit === 'quintal' ? 'text-brand-950' : 'text-slate-500'}`}>
                  Quintals
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Mandi API Baseline Toggle */}
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-bold text-slate-800">Auto Mandi API Benchmark</Text>
              <Text className="text-[10px] text-slate-400">Fetch daily AGMARKNET modal quotes automatically</Text>
            </View>
            <Switch
              value={useMandiApi}
              onValueChange={setUseMandiApi}
              trackColor={{ false: '#cbd5e1', true: '#10b981' }}
              thumbColor="#ffffff"
            />
          </View>

          {/* Moisture Alerts */}
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-bold text-slate-800">Moisture Warning Guard</Text>
              <Text className="text-[10px] text-slate-400">Alert inspector if sample moisture exceeds {moistureThreshold}</Text>
            </View>
            <Switch
              value={moistureAlerts}
              onValueChange={setMoistureAlerts}
              trackColor={{ false: '#cbd5e1', true: '#10b981' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Section 2: Yard & Organization Details */}
        <View className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
          <Text className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Intake Yard Configuration
          </Text>

          <View className="flex-row justify-between pb-2 border-b border-slate-100">
            <Text className="text-xs text-slate-600">Assigned Mandi Yard</Text>
            <Text className="text-xs font-bold text-slate-900">Kakinada Market Yard (AP)</Text>
          </View>

          <View className="flex-row justify-between pb-2 border-b border-slate-100">
            <Text className="text-xs text-slate-600">Commodity</Text>
            <Text className="text-xs font-bold text-slate-900">Paddy (Common / Grade A)</Text>
          </View>

          <View className="flex-row justify-between">
            <Text className="text-xs text-slate-600">AI Inference Engine</Text>
            <Text className="text-xs font-bold text-emerald-700">YOLOv8n Edge Model (Active)</Text>
          </View>
        </View>

        {/* Section 3: Statutory Disclaimers & App Info */}
        <View className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-3">
          <Text className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Information & Support
          </Text>

          <TouchableOpacity
            onPress={showStatutoryNotice}
            className="flex-row items-center justify-between py-1.5 border-b border-slate-100 active:scale-98"
          >
            <Text className="text-xs font-semibold text-slate-700">⚠️ Statutory Decision Support Notice</Text>
            <Text className="text-xs font-bold text-slate-400">→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={showAboutApp}
            className="flex-row items-center justify-between py-1.5 active:scale-98"
          >
            <Text className="text-xs font-semibold text-slate-700">🌾 About GRAIN-VISION v2.0</Text>
            <Text className="text-xs font-bold text-slate-400">→</Text>
          </TouchableOpacity>
        </View>

        {/* Section 4: Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="bg-rose-50 border border-rose-200 p-4 rounded-2xl items-center active:scale-98 mt-2"
        >
          <Text className="text-xs font-black text-rose-700 uppercase tracking-wider">
            Sign Out of Terminal
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
