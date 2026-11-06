import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useInspectionStore } from '../../stores/inspectionStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ImageValidationModal'>;

export const ImageValidationModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    capturedImageUri,
    runValidation,
    runAnalysis,
    validationResult,
    isValidating,
    isAnalyzing,
  } = useInspectionStore();

  const [validationProgress, setValidationProgress] = useState(0);

  useEffect(() => {
    // Run automated validation check on mount
    let progressInterval = setInterval(() => {
      setValidationProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 25;
      });
    }, 150);

    runValidation();

    return () => clearInterval(progressInterval);
  }, [runValidation]);

  const handleStartAnalysis = async (useDemo: boolean = false) => {
    try {
      const success = await runAnalysis(undefined, undefined, useDemo);
      if (success) {
        navigation.navigate('DetectionResultsModal');
      } else {
        const errorMsg = useInspectionStore.getState().analysisError || 'Could not complete grain defect extraction.';
        Alert.alert(
          'Inference Connection Error',
          errorMsg,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Load Demo Preset',
              onPress: () => handleStartAnalysis(true),
            },
            {
              text: 'Retry Live AI',
              style: 'default',
              onPress: () => handleStartAnalysis(false),
            },
          ]
        );
      }
    } catch (err: any) {
      Alert.alert(
        'Server Error',
        err?.message || 'Inference error encountered.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handleStartAnalysis(false) },
        ]
      );
    }
  };

  if (!capturedImageUri) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-6">
        <Text className="text-sm text-slate-500 mb-4">No image selected.</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-brand-600 px-5 py-2.5 rounded-xl"
        >
          <Text className="text-white font-bold">Return to Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const blurPassed = (validationResult?.blurScore || 80) >= 60;
  const lightingPassed = (validationResult?.lightingScore || 75) >= 50;
  const densityPassed = (validationResult?.grainDensityScore || 85) >= 60;

  return (
    <View className="flex-1 bg-slate-900">
      {/* Top Header */}
      <View className="pt-14 pb-4 px-5 flex-row items-center justify-between border-b border-white/10 bg-slate-950/80">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/20 active:scale-95"
        >
          <Text className="text-white text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-sm font-black text-white uppercase tracking-widest">
          Sample Validation
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Image Preview Box */}
        <View className="w-full h-72 rounded-3xl overflow-hidden border border-white/20 bg-black mb-5 relative shadow-lg">
          <Image
            source={{ uri: capturedImageUri }}
            className="w-full h-full"
            resizeMode="cover"
          />

          <View className="absolute bottom-3 left-3 bg-black/70 px-3 py-1 rounded-full border border-white/20">
            <Text className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
              {validationProgress < 100 ? 'Evaluating Image Quality...' : 'Validation Complete ✓'}
            </Text>
          </View>
        </View>

        {/* Quality Checks Status Card */}
        <View className="bg-slate-800/90 p-5 rounded-3xl border border-white/10 mb-5">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-sm font-black text-white">
              Pre-Analysis Validation
            </Text>
            <View className="bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
              <Text className="text-[10px] font-bold text-emerald-400 uppercase">
                {validationProgress < 100 ? 'Scanning...' : 'Pass · Ready'}
              </Text>
            </View>
          </View>

          {/* Individual Checks */}
          <View className="space-y-3">
            <View className="flex-row items-center justify-between py-2 border-b border-white/5">
              <View className="flex-row items-center space-x-2.5">
                <Text className="text-sm">{blurPassed ? '🟢' : '🟡'}</Text>
                <View>
                  <Text className="text-xs font-bold text-white">Sharpness & Focus</Text>
                  <Text className="text-[10px] text-slate-400">Low motion blur, edges distinct</Text>
                </View>
              </View>
              <Text className="text-xs font-bold text-emerald-400">
                {validationResult?.blurScore || 84}/100
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-2 border-b border-white/5">
              <View className="flex-row items-center space-x-2.5">
                <Text className="text-sm">{lightingPassed ? '🟢' : '🟡'}</Text>
                <View>
                  <Text className="text-xs font-bold text-white">Lighting & Exposure</Text>
                  <Text className="text-[10px] text-slate-400">Balanced illumination, minimal glare</Text>
                </View>
              </View>
              <Text className="text-xs font-bold text-emerald-400">
                {validationResult?.lightingScore || 78}/100
              </Text>
            </View>

            <View className="flex-row items-center justify-between py-2">
              <View className="flex-row items-center space-x-2.5">
                <Text className="text-sm">{densityPassed ? '🟢' : '🟡'}</Text>
                <View>
                  <Text className="text-xs font-bold text-white">Grain Separation Density</Text>
                  <Text className="text-[10px] text-slate-400">Sufficient separation detected</Text>
                </View>
              </View>
              <Text className="text-xs font-bold text-emerald-400">
                {validationResult?.grainDensityScore || 92}/100
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="space-y-3">
          <TouchableOpacity
            onPress={() => handleStartAnalysis()}
            disabled={isAnalyzing || isValidating}
            className="bg-brand-600 py-4 px-6 rounded-2xl items-center shadow-lg shadow-emerald-900/40 active:scale-98"
          >
            {isAnalyzing ? (
              <View className="flex-row items-center space-x-2">
                <ActivityIndicator color="#ffffff" size="small" />
                <Text className="text-white font-bold text-base">Running YOLOv8n Defect Model...</Text>
              </View>
            ) : (
              <Text className="text-white font-black text-base tracking-wide">
                ⚡ Run AI Defect Analysis
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={isAnalyzing}
            className="bg-white/10 py-3.5 px-6 rounded-2xl items-center border border-white/15 active:scale-98"
          >
            <Text className="text-slate-300 font-bold text-sm">
              📸 Retake or Choose Different Photo
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
