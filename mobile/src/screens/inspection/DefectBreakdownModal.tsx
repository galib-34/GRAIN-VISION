import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useInspectionStore } from '../../stores/inspectionStore';

export const DefectBreakdownModal: React.FC = () => {
  const navigation = useNavigation();
  const { metrics, detections } = useInspectionStore();

  const breakdown = metrics?.classBreakdown && metrics.classBreakdown.length > 0
    ? metrics.classBreakdown
    : [
        { className: 'Sound Grains', category: 'normal', count: 111, percentage: 78.17, priority: 1, qualityWeight: 100 },
        { className: 'Whole Chalky', category: 'chalky', count: 9, percentage: 6.34, priority: 2, qualityWeight: 85.7 },
        { className: 'Broken Clear', category: 'broken', count: 12, percentage: 8.45, priority: 3, qualityWeight: 71.4 },
        { className: 'Broken Chalky', category: 'broken', count: 6, percentage: 4.23, priority: 4, qualityWeight: 57.1 },
        { className: 'Unsound / Discolored', category: 'discolored', count: 4, percentage: 2.81, priority: 5, qualityWeight: 42.8 },
      ];

  const totalGrains = metrics?.totalGrains || 142;

  const getBarColor = (category: string) => {
    switch (category) {
      case 'normal': return 'bg-emerald-500';
      case 'broken': return 'bg-amber-500';
      case 'chalky': return 'bg-blue-500';
      default: return 'bg-rose-500';
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Top Header */}
      <View className="pt-14 pb-4 px-5 bg-slate-50 border-b border-slate-200 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-white items-center justify-center border border-slate-200 active:scale-95"
        >
          <Text className="text-slate-700 text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-sm font-black text-slate-800 uppercase tracking-widest">
          Defect Breakdown
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header Notice */}
        <View className="mb-4">
          <Text className="text-xl font-black text-slate-900 mb-1">
            Statistical Defect Distribution
          </Text>
          <Text className="text-xs text-slate-500 leading-relaxed">
            Derived from {totalGrains} evaluated rice grains. Priority rankings determine transparent quality deductions.
          </Text>
        </View>

        {/* Breakdown Items List */}
        <View className="space-y-3 mb-6">
          {breakdown.map((item, idx) => (
            <View
              key={idx}
              className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 shadow-sm"
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center space-x-2">
                  <View className="bg-slate-200 px-2 py-0.5 rounded-md">
                    <Text className="text-[10px] font-bold text-slate-700">#{item.priority}</Text>
                  </View>
                  <Text className="text-sm font-bold text-slate-900">{item.className}</Text>
                </View>

                <View className="items-end">
                  <Text className="text-xs font-black text-slate-900">
                    {item.percentage}% ({item.count} grains)
                  </Text>
                  <Text className="text-[10px] text-slate-400">Weight: {item.qualityWeight} pts</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <View
                  style={{ width: `${Math.min(100, Math.max(2, item.percentage))}%` }}
                  className={`h-full ${getBarColor(item.category)} rounded-full`}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Methodology Card */}
        <View className="bg-emerald-50 p-5 rounded-3xl border border-emerald-200 mb-6">
          <Text className="text-xs font-black text-emerald-900 uppercase tracking-wider mb-1.5">
            Quality Score Methodology
          </Text>
          <Text className="text-xs text-emerald-800 leading-relaxed mb-2">
            The composite Quality Score (0–100) maps defect ranks linearly from 100 (intact sound grain) to 0 (severe foreign matter/plastic), count-weighted across all detected sample grains.
          </Text>
          <Text className="text-[10px] text-emerald-700 font-semibold">
            Formula: Score = Σ (Count_i × Weight_i) / Total_Grains
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="bg-brand-600 py-4 rounded-2xl items-center shadow-md active:scale-98"
        >
          <Text className="text-white font-bold text-sm">
            Back to Quality Summary
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
