import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { RootStackParamList } from '../../navigation/types';
import { useInspectionStore } from '../../stores/inspectionStore';
import { GrainCategory } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'DetectionResultsModal'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 40;
const CANVAS_HEIGHT = Math.round(CANVAS_WIDTH * 1.35);

const CATEGORY_COLORS: Record<GrainCategory, string> = {
  normal: '#10b981',    // Emerald
  broken: '#f59e0b',    // Amber
  chalky: '#3b82f6',    // Blue
  discolored: '#ef4444', // Red
};

export const DetectionResultsModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { capturedImageUri, detections, metrics } = useInspectionStore();
  const [activeFilter, setActiveFilter] = useState<'all' | GrainCategory>('all');

  const filteredDetections = activeFilter === 'all'
    ? detections
    : detections.filter((d) => d.category === activeFilter);

  const normalCount = metrics?.soundCount ?? detections.filter((d) => d.category === 'normal').length;
  const brokenCount = metrics?.brokenCount ?? detections.filter((d) => d.category === 'broken').length;
  const chalkyCount = metrics?.chalkyCount ?? detections.filter((d) => d.category === 'chalky').length;
  const discoloredCount = metrics?.discoloredCount ?? detections.filter((d) => d.category === 'discolored').length;
  const totalCount = metrics?.totalGrains ?? detections.length;

  return (
    <View className="flex-1 bg-slate-900">
      {/* Top Header */}
      <View className="pt-14 pb-4 px-5 flex-row items-center justify-between border-b border-white/10 bg-slate-950/90">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/20 active:scale-95"
        >
          <Text className="text-white text-lg">←</Text>
        </TouchableOpacity>
        <View className="items-center">
          <Text className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
            YOLOv8n Analysis
          </Text>
          <Text className="text-sm font-black text-white">Detection Overlay</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('ComparisonSliderModal')}
          className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 active:scale-95"
        >
          <Text className="text-xs font-bold text-emerald-300">Compare ⤢</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 50 }}>
        {/* Interactive Defect Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row space-x-2 mb-4"
        >
          <TouchableOpacity
            onPress={() => setActiveFilter('all')}
            className={`px-3.5 py-1.5 rounded-full border ${activeFilter === 'all' ? 'bg-white border-white' : 'bg-slate-800 border-white/15'}`}
          >
            <Text className={`text-xs font-bold ${activeFilter === 'all' ? 'text-slate-950' : 'text-slate-300'}`}>
              All Grains ({totalCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('normal')}
            className={`px-3.5 py-1.5 rounded-full border ${activeFilter === 'normal' ? 'bg-emerald-500 border-emerald-300' : 'bg-slate-800 border-emerald-500/30'}`}
          >
            <Text className={`text-xs font-bold ${activeFilter === 'normal' ? 'text-white' : 'text-emerald-400'}`}>
              🟢 Normal ({normalCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('broken')}
            className={`px-3.5 py-1.5 rounded-full border ${activeFilter === 'broken' ? 'bg-amber-500 border-amber-300' : 'bg-slate-800 border-amber-500/30'}`}
          >
            <Text className={`text-xs font-bold ${activeFilter === 'broken' ? 'text-white' : 'text-amber-400'}`}>
              🟡 Broken ({brokenCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('chalky')}
            className={`px-3.5 py-1.5 rounded-full border ${activeFilter === 'chalky' ? 'bg-blue-500 border-blue-300' : 'bg-slate-800 border-blue-500/30'}`}
          >
            <Text className={`text-xs font-bold ${activeFilter === 'chalky' ? 'text-white' : 'text-blue-400'}`}>
              🔵 Chalky ({chalkyCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveFilter('discolored')}
            className={`px-3.5 py-1.5 rounded-full border ${activeFilter === 'discolored' ? 'bg-rose-500 border-rose-300' : 'bg-slate-800 border-rose-500/30'}`}
          >
            <Text className={`text-xs font-bold ${activeFilter === 'discolored' ? 'text-white' : 'text-rose-400'}`}>
              🔴 Discolored ({discoloredCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* High-Contrast Image + SVG Canvas Overlay Container */}
        <View
          style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
          className="rounded-3xl overflow-hidden border border-white/20 bg-black relative shadow-2xl mb-4 self-center"
        >
          {capturedImageUri && (
            <Image
              source={{ uri: capturedImageUri }}
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
              resizeMode="cover"
            />
          )}

          {/* SVG Overlay Layer */}
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox="0 0 360 486" // Scaled viewBox mapped to standard portrait ratio
          >
            {filteredDetections.map((det) => {
              const color = CATEGORY_COLORS[det.category] || '#10b981';
              const boxW = Math.max(12, det.box.x2 - det.box.x1);
              const boxH = Math.max(16, det.box.y2 - det.box.y1);

              return (
                <React.Fragment key={det.id}>
                  {/* Bounding box rectangle */}
                  <Rect
                    x={det.box.x1}
                    y={det.box.y1}
                    width={boxW}
                    height={boxH}
                    stroke={color}
                    strokeWidth={2}
                    fill={color + '33'} // Translucent fill for visibility
                    rx={4}
                  />

                  {/* Micro label pill */}
                  <Rect
                    x={det.box.x1}
                    y={Math.max(2, det.box.y1 - 12)}
                    width={Math.max(28, det.category.length * 6 + 6)}
                    height={11}
                    fill={color}
                    rx={2}
                  />

                  <SvgText
                    x={det.box.x1 + 3}
                    y={Math.max(10, det.box.y1 - 3)}
                    fill="#ffffff"
                    fontSize={7.5}
                    fontWeight="bold"
                  >
                    {det.category.toUpperCase()}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>

          <View className="absolute bottom-3 right-3 bg-black/75 px-3 py-1 rounded-full border border-white/20">
            <Text className="text-[10px] font-bold text-slate-200">
              Showing {filteredDetections.length} of {detections.length} grains
            </Text>
          </View>
        </View>

        {/* Quick Defect Distribution Summary Strip */}
        <View className="bg-slate-800/90 p-4 rounded-2xl border border-white/10 mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-bold text-white uppercase tracking-wider">
              Defect Distribution
            </Text>
            <Text className="text-xs font-bold text-emerald-400">
              Score: {metrics?.qualityScore ?? 82.5} / 100
            </Text>
          </View>

          <View className="flex-row justify-between">
            <View className="items-center">
              <Text className="text-xs font-bold text-emerald-400">
                {metrics?.soundPct ?? 78.2}%
              </Text>
              <Text className="text-[10px] text-slate-400">Sound</Text>
            </View>
            <View className="items-center">
              <Text className="text-xs font-bold text-amber-400">
                {metrics?.brokenPct ?? 12.7}%
              </Text>
              <Text className="text-[10px] text-slate-400">Broken</Text>
            </View>
            <View className="items-center">
              <Text className="text-xs font-bold text-blue-400">
                {metrics?.chalkyPct ?? 6.3}%
              </Text>
              <Text className="text-[10px] text-slate-400">Chalky</Text>
            </View>
            <View className="items-center">
              <Text className="text-xs font-bold text-rose-400">
                {metrics?.discoloredPct ?? 2.8}%
              </Text>
              <Text className="text-[10px] text-slate-400">Unsound</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="space-y-3">
          <TouchableOpacity
            onPress={() => navigation.navigate('QualitySummaryModal')}
            className="bg-brand-600 py-4 px-6 rounded-2xl items-center shadow-lg shadow-emerald-950/40 active:scale-98"
          >
            <Text className="text-white font-black text-base tracking-wide">
              View Quality Summary & Grade →
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('ComparisonSliderModal')}
            className="bg-white/10 py-3.5 px-6 rounded-2xl items-center border border-white/15 active:scale-98"
          >
            <Text className="text-slate-300 font-bold text-sm">
              🔍 Inspect Side-by-Side Comparison
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};
