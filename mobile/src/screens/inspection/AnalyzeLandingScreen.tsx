import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../../navigation/types';
import { useInspectionStore } from '../../stores/inspectionStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const AnalyzeLandingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const setCapturedImage = useInspectionStore((state) => state.setCapturedImage);

  const handlePickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setCapturedImage(asset.uri, asset.width || 1080, asset.height || 1920);
        navigation.navigate('ImageValidationModal');
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err?.message || 'Could not pick image from gallery.');
    }
  };

  const handleUsePresetSample = () => {
    setCapturedImage('https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1080', 1080, 1920);
    navigation.navigate('ImageValidationModal');
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 50 }}>
      {/* Top Banner Header */}
      <View className="bg-brand-950 pt-14 pb-8 px-5 rounded-b-[32px] shadow-lg shadow-emerald-950/20">
        <View className="flex-row items-center space-x-2 mb-2">
          <View className="w-8 h-8 rounded-full bg-emerald-500/20 items-center justify-center border border-emerald-400/30">
            <Text className="text-base">📸</Text>
          </View>
          <Text className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
            Quality Inspection Pipeline
          </Text>
        </View>

        <Text className="text-2xl font-black text-white mb-2">
          Capture & Analyze Grain Sample
        </Text>
        <Text className="text-xs text-slate-300 leading-relaxed">
          Align 100-200 grains under uniform illumination. Our trained YOLOv8n edge model segments individual grains and extracts commercial defect ratios.
        </Text>
      </View>

      <View className="p-5 -mt-3">
        {/* Main Camera Launch Card */}
        <View className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-4 items-center">
          <View className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-300 items-center justify-center mb-4">
            <Text className="text-4xl">📷</Text>
          </View>

          <Text className="text-lg font-black text-slate-900 mb-1 text-center">
            Live Viewfinder Scanner
          </Text>
          <Text className="text-xs text-slate-500 text-center mb-5 max-w-xs leading-4">
            Use native camera with real-time target reticle and autofocus guides.
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('CameraCaptureModal')}
            className="w-full bg-brand-600 py-4 rounded-2xl items-center shadow-lg shadow-emerald-800/25 active:scale-98"
          >
            <Text className="text-white font-black text-base tracking-wide">
              📸 Launch Camera Viewfinder
            </Text>
          </TouchableOpacity>
        </View>

        {/* Secondary Capture Channels */}
        <View className="flex-row space-x-3 mb-5">
          <TouchableOpacity
            onPress={handlePickFromGallery}
            className="flex-1 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm items-center active:scale-98"
          >
            <Text className="text-2xl mb-1">📁</Text>
            <Text className="text-xs font-bold text-slate-800">Upload Gallery</Text>
            <Text className="text-[10px] text-slate-400 mt-0.5">Pre-captured photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleUsePresetSample}
            className="flex-1 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm items-center active:scale-98"
          >
            <Text className="text-2xl mb-1">🌾</Text>
            <Text className="text-xs font-bold text-slate-800">Load Swarna Test</Text>
            <Text className="text-[10px] text-slate-400 mt-0.5">Demo sample image</Text>
          </TouchableOpacity>
        </View>

        {/* Defect Taxonomy Reference Card */}
        <View className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm">
          <Text className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3">
            Supported Defect Taxonomy (YOLOv8n)
          </Text>

          <View className="space-y-2.5">
            <View className="flex-row items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <View className="flex-row items-center space-x-2.5">
                <View className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
                <Text className="text-xs font-bold text-slate-800">Normal / Sound Grains</Text>
              </View>
              <Text className="text-[10px] font-semibold text-emerald-700">Priority #1 · 100% Wt</Text>
            </View>

            <View className="flex-row items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <View className="flex-row items-center space-x-2.5">
                <View className="w-3.5 h-3.5 rounded-full bg-blue-500" />
                <Text className="text-xs font-bold text-slate-800">Whole Chalky Grains</Text>
              </View>
              <Text className="text-[10px] font-semibold text-blue-700">Priority #2 · 85% Wt</Text>
            </View>

            <View className="flex-row items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <View className="flex-row items-center space-x-2.5">
                <View className="w-3.5 h-3.5 rounded-full bg-amber-500" />
                <Text className="text-xs font-bold text-slate-800">Broken Grains (Clear / Chalky)</Text>
              </View>
              <Text className="text-[10px] font-semibold text-amber-700">Priority #3 · 71% Wt</Text>
            </View>

            <View className="flex-row items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <View className="flex-row items-center space-x-2.5">
                <View className="w-3.5 h-3.5 rounded-full bg-rose-500" />
                <Text className="text-xs font-bold text-slate-800">Unsound / Foreign Matter</Text>
              </View>
              <Text className="text-[10px] font-semibold text-rose-700">Priority #4 · 42% Wt</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
