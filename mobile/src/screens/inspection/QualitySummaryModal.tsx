import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useInspectionStore } from '../../stores/inspectionStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'QualitySummaryModal'>;

export const QualitySummaryModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { metrics, detections } = useInspectionStore();

  const score = metrics?.qualityScore ?? 84.5;
  const totalGrains = metrics?.totalGrains ?? detections.length;

  const getGradeInfo = (val: number) => {
    if (val >= 80) {
      return {
        grade: 'GRADE A (PREMIUM)',
        badgeBg: 'bg-emerald-100',
        badgeText: 'text-emerald-800',
        badgeBorder: 'border-emerald-300',
        desc: 'Low chalkiness & broken grain ratio. Well within milling procurement standards.',
      };
    } else if (val >= 60) {
      return {
        grade: 'GRADE B (COMMERCIAL)',
        badgeBg: 'bg-amber-100',
        badgeText: 'text-amber-800',
        badgeBorder: 'border-amber-300',
        desc: 'Moderate broken / chalky grains. Standard procurement rate with minor deductions.',
      };
    } else {
      return {
        grade: 'GRADE C (SUB-STANDARD)',
        badgeBg: 'bg-rose-100',
        badgeText: 'text-rose-800',
        badgeBorder: 'border-rose-300',
        desc: 'High defect proportion detected. Requires renegotiation or rejection determination.',
      };
    }
  };

  const gradeInfo = getGradeInfo(score);

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="pt-14 pb-4 px-5 bg-white border-b border-slate-200 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center border border-slate-200 active:scale-95"
        >
          <Text className="text-slate-700 text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-sm font-black text-slate-800 uppercase tracking-widest">
          Quality Assessment
        </Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('QualityReportPDFModal')}
          className="w-10 h-10 rounded-full bg-emerald-50 items-center justify-center border border-emerald-200 active:scale-95"
        >
          <Text className="text-base">📄</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-5" contentContainerStyle={{ paddingBottom: 50 }}>
        {/* Main Score & Grade Hero Card */}
        <View className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm mb-4 items-center">
          <View className="px-3.5 py-1 rounded-full border mb-3 bg-emerald-50 border-emerald-200">
            <Text className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">
              Estimate for Procurement Decision Support
            </Text>
          </View>

          {/* Numerical Score Big Display */}
          <View className="flex-row items-baseline my-1">
            <Text className="text-6xl font-black text-slate-900 tracking-tight">
              {score.toFixed(1)}
            </Text>
            <Text className="text-xl font-bold text-slate-400 ml-1">/ 100</Text>
          </View>

          {/* Grade Badge */}
          <View className={`px-4 py-1.5 rounded-full border my-2 ${gradeInfo.badgeBg} ${gradeInfo.badgeBorder}`}>
            <Text className={`text-xs font-black tracking-wider ${gradeInfo.badgeText}`}>
              {gradeInfo.grade}
            </Text>
          </View>

          <Text className="text-xs text-slate-500 text-center max-w-xs mt-1 leading-relaxed">
            {gradeInfo.desc}
          </Text>
        </View>

        {/* Real-world Disclaimer Banner */}
        <View className="bg-amber-50 p-4 rounded-2xl border border-amber-200/80 mb-5">
          <View className="flex-row items-center space-x-2 mb-1">
            <Text className="text-sm">⚠️</Text>
            <Text className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Advisory Decision Support Notice
            </Text>
          </View>
          <Text className="text-xs text-amber-800/90 leading-relaxed">
            Derived strictly from computer vision defect distribution. This does NOT constitute an officially accredited statutory grade or legal guarantee.
          </Text>
        </View>

        {/* Defect Quick Matrix */}
        <View className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm mb-5">
          <View className="flex-row items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <Text className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Sample Summary
            </Text>
            <Text className="text-xs font-semibold text-slate-500">
              {totalGrains} grains evaluated
            </Text>
          </View>

          <View className="space-y-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center space-x-2">
                <View className="w-3 h-3 rounded-full bg-emerald-500" />
                <Text className="text-xs font-semibold text-slate-700">Sound / Normal</Text>
              </View>
              <Text className="text-xs font-bold text-slate-900">
                {metrics?.soundPct ?? 78.2}% ({metrics?.soundCount ?? 111} grains)
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center space-x-2">
                <View className="w-3 h-3 rounded-full bg-amber-500" />
                <Text className="text-xs font-semibold text-slate-700">Broken Grains</Text>
              </View>
              <Text className="text-xs font-bold text-slate-900">
                {metrics?.brokenPct ?? 12.7}% ({metrics?.brokenCount ?? 18} grains)
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center space-x-2">
                <View className="w-3 h-3 rounded-full bg-blue-500" />
                <Text className="text-xs font-semibold text-slate-700">Chalky Grains</Text>
              </View>
              <Text className="text-xs font-bold text-slate-900">
                {metrics?.chalkyPct ?? 6.3}% ({metrics?.chalkyCount ?? 9} grains)
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center space-x-2">
                <View className="w-3 h-3 rounded-full bg-rose-500" />
                <Text className="text-xs font-semibold text-slate-700">Unsound / Foreign</Text>
              </View>
              <Text className="text-xs font-bold text-slate-900">
                {metrics?.discoloredPct ?? 2.8}% ({metrics?.discoloredCount ?? 4} grains)
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="space-y-3">
          <TouchableOpacity
            onPress={() => navigation.navigate('SellerSelectionModal')}
            className="bg-brand-600 py-4 px-6 rounded-2xl items-center shadow-lg shadow-emerald-700/25 active:scale-98"
          >
            <Text className="text-white font-black text-base tracking-wide">
              Continue to Lot Details & Pricing →
            </Text>
          </TouchableOpacity>

          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={() => navigation.navigate('DefectBreakdownModal')}
              className="flex-1 bg-white py-3.5 px-4 rounded-2xl items-center border border-slate-300 shadow-sm active:scale-98"
            >
              <Text className="text-slate-700 font-bold text-xs">
                📊 Detailed Breakdown
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('QualityReportPDFModal')}
              className="flex-1 bg-white py-3.5 px-4 rounded-2xl items-center border border-slate-300 shadow-sm active:scale-98"
            >
              <Text className="text-slate-700 font-bold text-xs">
                📄 Generate PDF Report
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};
