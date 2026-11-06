import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useInspectionStore } from '../../stores/inspectionStore';
import { GrainCategory } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_WIDTH = SCREEN_WIDTH - 40;
const PREVIEW_HEIGHT = Math.round(PREVIEW_WIDTH * 1.25);

const CATEGORY_COLORS: Record<GrainCategory, string> = {
  normal: '#10b981',
  broken: '#f59e0b',
  chalky: '#3b82f6',
  discolored: '#ef4444',
};

export const ComparisonSliderModal: React.FC = () => {
  const navigation = useNavigation();
  const { capturedImageUri, detections } = useInspectionStore();
  const [viewMode, setViewMode] = useState<'overlay' | 'raw' | 'split'>('overlay');

  return (
    <View className="flex-1 bg-slate-950">
      {/* Top Header */}
      <View className="pt-14 pb-4 px-5 flex-row items-center justify-between border-b border-white/10 bg-black/80">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/20 active:scale-95"
        >
          <Text className="text-white text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-sm font-black text-white uppercase tracking-widest">
          Grain Comparison Viewer
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Mode Selector Segmented Controls */}
        <View className="flex-row bg-slate-800 p-1.5 rounded-2xl mb-5 border border-white/10">
          <TouchableOpacity
            onPress={() => setViewMode('overlay')}
            className={`flex-1 py-2 rounded-xl items-center ${viewMode === 'overlay' ? 'bg-emerald-600' : ''}`}
          >
            <Text className={`text-xs font-bold ${viewMode === 'overlay' ? 'text-white' : 'text-slate-400'}`}>
              AI Overlay
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setViewMode('split')}
            className={`flex-1 py-2 rounded-xl items-center ${viewMode === 'split' ? 'bg-emerald-600' : ''}`}
          >
            <Text className={`text-xs font-bold ${viewMode === 'split' ? 'text-white' : 'text-slate-400'}`}>
              Split View
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setViewMode('raw')}
            className={`flex-1 py-2 rounded-xl items-center ${viewMode === 'raw' ? 'bg-emerald-600' : ''}`}
          >
            <Text className={`text-xs font-bold ${viewMode === 'raw' ? 'text-white' : 'text-slate-400'}`}>
              Raw Sample
            </Text>
          </TouchableOpacity>
        </View>

        {/* View Mode 1 & 2: Single Canvas (Overlay or Raw) */}
        {viewMode !== 'split' && (
          <View
            style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
            className="rounded-3xl overflow-hidden border border-white/20 bg-black relative shadow-2xl mb-4 self-center"
          >
            {capturedImageUri && (
              <Image
                source={{ uri: capturedImageUri }}
                style={{ width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT }}
                resizeMode="cover"
              />
            )}

            {viewMode === 'overlay' && (
              <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 450">
                {detections.map((det) => {
                  const color = CATEGORY_COLORS[det.category] || '#10b981';
                  const boxW = Math.max(12, det.box.x2 - det.box.x1);
                  const boxH = Math.max(16, det.box.y2 - det.box.y1);

                  return (
                    <React.Fragment key={det.id}>
                      <Rect
                        x={det.box.x1}
                        y={det.box.y1}
                        width={boxW}
                        height={boxH}
                        stroke={color}
                        strokeWidth={2}
                        fill={color + '33'}
                        rx={3}
                      />
                      <SvgText
                        x={det.box.x1 + 2}
                        y={Math.max(10, det.box.y1 - 2)}
                        fill="#ffffff"
                        fontSize={8}
                        fontWeight="bold"
                      >
                        {det.category.charAt(0).toUpperCase()}
                      </SvgText>
                    </React.Fragment>
                  );
                })}
              </Svg>
            )}

            <View className="absolute bottom-3 left-3 bg-black/80 px-3 py-1 rounded-full border border-white/20">
              <Text className="text-[10px] font-bold text-slate-200">
                {viewMode === 'overlay' ? 'AI Annotated View' : 'Original Unprocessed Sample'}
              </Text>
            </View>
          </View>
        )}

        {/* View Mode 3: Split Comparison */}
        {viewMode === 'split' && (
          <View className="space-y-4 mb-4">
            {/* Raw Half */}
            <View className="space-y-1">
              <Text className="text-xs font-bold text-slate-400">1. Original Capture (Raw)</Text>
              <View
                style={{ width: PREVIEW_WIDTH, height: Math.round(PREVIEW_HEIGHT * 0.6) }}
                className="rounded-2xl overflow-hidden border border-white/20 bg-black relative"
              >
                {capturedImageUri && (
                  <Image
                    source={{ uri: capturedImageUri }}
                    style={{ width: PREVIEW_WIDTH, height: Math.round(PREVIEW_HEIGHT * 0.6) }}
                    resizeMode="cover"
                  />
                )}
              </View>
            </View>

            {/* Annotated Half */}
            <View className="space-y-1">
              <Text className="text-xs font-bold text-emerald-400">2. YOLOv8n Bounding Box Overlay</Text>
              <View
                style={{ width: PREVIEW_WIDTH, height: Math.round(PREVIEW_HEIGHT * 0.6) }}
                className="rounded-2xl overflow-hidden border border-emerald-500/40 bg-black relative"
              >
                {capturedImageUri && (
                  <Image
                    source={{ uri: capturedImageUri }}
                    style={{ width: PREVIEW_WIDTH, height: Math.round(PREVIEW_HEIGHT * 0.6) }}
                    resizeMode="cover"
                  />
                )}
                <Svg style={StyleSheet.absoluteFill} viewBox="0 0 360 270">
                  {detections.map((det) => {
                    const color = CATEGORY_COLORS[det.category] || '#10b981';
                    return (
                      <Rect
                        key={det.id}
                        x={det.box.x1}
                        y={det.box.y1 * 0.6}
                        width={det.box.x2 - det.box.x1}
                        height={(det.box.y2 - det.box.y1) * 0.6}
                        stroke={color}
                        strokeWidth={2}
                        fill={color + '33'}
                        rx={2}
                      />
                    );
                  })}
                </Svg>
              </View>
            </View>
          </View>
        )}

        {/* Legend Card */}
        <View className="bg-slate-900 p-4 rounded-2xl border border-white/10 mb-5 flex-row justify-around">
          <View className="flex-row items-center space-x-1.5">
            <View className="w-3 h-3 rounded-full bg-emerald-500" />
            <Text className="text-xs font-bold text-slate-300">Normal</Text>
          </View>
          <View className="flex-row items-center space-x-1.5">
            <View className="w-3 h-3 rounded-full bg-amber-500" />
            <Text className="text-xs font-bold text-slate-300">Broken</Text>
          </View>
          <View className="flex-row items-center space-x-1.5">
            <View className="w-3 h-3 rounded-full bg-blue-500" />
            <Text className="text-xs font-bold text-slate-300">Chalky</Text>
          </View>
          <View className="flex-row items-center space-x-1.5">
            <View className="w-3 h-3 rounded-full bg-rose-500" />
            <Text className="text-xs font-bold text-slate-300">Discolored</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-brand-600 py-3.5 rounded-2xl items-center active:scale-98"
        >
          <Text className="text-white font-bold text-sm">Close Viewer</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
