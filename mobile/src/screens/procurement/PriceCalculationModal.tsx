import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useLotStore } from '../../stores/lotStore';
import { useInspectionStore } from '../../stores/inspectionStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PriceCalculationModal'>;

export const PriceCalculationModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { pricing, weightKg } = useLotStore();
  const metrics = useInspectionStore((state) => state.metrics);

  const baseRatePerKg = pricing?.baseRatePerKg ?? 23.20;
  const baseRatePerQtl = pricing?.baseRatePerQuintal ?? 2320.0;
  const score = metrics?.qualityScore ?? 84.5;
  const adjPct = pricing?.adjustmentPercentage ?? 2.0;
  const effectiveRate = pricing?.estimatedRatePerKg ?? 23.66;
  const totalPayout = pricing?.totalEstimatedPrice ?? (effectiveRate * weightKg);

  // Transparent line-item quality breakdown
  const brokenPct = metrics?.brokenPct ?? 12.7;
  const chalkyPct = metrics?.chalkyPct ?? 6.3;
  const unsoundPct = metrics?.discoloredPct ?? 2.8;

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Top Header */}
      <View className="pt-14 pb-4 px-5 bg-white border-b border-slate-200 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center border border-slate-200 active:scale-95"
        >
          <Text className="text-slate-700 text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-sm font-black text-slate-800 uppercase tracking-widest">
          Price Calculation
        </Text>
        <View className="w-10" />
      </View>

      <View className="p-5">
        <View className="mb-4">
          <Text className="text-xl font-black text-slate-900 mb-1">
            Automated Quality Valuation
          </Text>
          <Text className="text-xs text-slate-500 leading-relaxed">
            Transparent breakdown deriving net procurement rate from baseline price and computer vision defect ratios.
          </Text>
        </View>

        {/* Total Valuation Hero Card */}
        <View className="bg-brand-950 p-6 rounded-3xl border border-emerald-500/30 shadow-lg shadow-emerald-950/20 mb-5 items-center">
          <Text className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
            Estimated Total Lot Payout
          </Text>
          <Text className="text-4xl font-black text-white tracking-tight my-1">
            ₹{Math.round(totalPayout).toLocaleString('en-IN')}
          </Text>
          <View className="bg-emerald-500/20 px-3.5 py-1 rounded-full border border-emerald-400/30 mt-2">
            <Text className="text-xs font-bold text-emerald-300">
              ₹{effectiveRate.toFixed(2)} / kg ({weightKg} kg lot)
            </Text>
          </View>
        </View>

        {/* Explainable Line-Item Calculation Card */}
        <View className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-5">
          <Text className="text-xs font-black text-slate-900 uppercase tracking-wider mb-3 pb-2 border-b border-slate-100">
            Valuation Line Items
          </Text>

          <View className="space-y-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold text-slate-800">Mandi Baseline Rate</Text>
                <Text className="text-[10px] text-slate-400">Standard intake benchmark</Text>
              </View>
              <Text className="text-xs font-black text-slate-900">
                ₹{baseRatePerKg.toFixed(2)} / kg (₹{baseRatePerQtl.toFixed(0)}/qtl)
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold text-slate-800">Sample Quality Score</Text>
                <Text className="text-[10px] text-slate-400">Derived from YOLOv8n defect metrics</Text>
              </View>
              <Text className="text-xs font-black text-emerald-700">
                {score.toFixed(1)} / 100
              </Text>
            </View>

            {/* Individual Defect Proportions */}
            <View className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1.5 my-1">
              <View className="flex-row justify-between">
                <Text className="text-[11px] text-slate-600">• Broken Grain Ratio ({brokenPct}%)</Text>
                <Text className="text-[11px] font-bold text-slate-700">
                  {brokenPct > 10 ? `-₹${((brokenPct - 10) * 0.04).toFixed(2)}` : 'Standard'}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[11px] text-slate-600">• Chalkiness Ratio ({chalkyPct}%)</Text>
                <Text className="text-[11px] font-bold text-slate-700">
                  {chalkyPct > 5 ? `-₹${((chalkyPct - 5) * 0.05).toFixed(2)}` : 'Standard'}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[11px] text-slate-600">• Unsound / Foreign ({unsoundPct}%)</Text>
                <Text className="text-[11px] font-bold text-slate-700">
                  {unsoundPct > 2 ? `-₹${((unsoundPct - 2) * 0.10).toFixed(2)}` : 'Minimal'}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between pt-1">
              <View>
                <Text className="text-xs font-bold text-slate-800">Net Quality Adjustment</Text>
                <Text className="text-[10px] text-slate-400">Score vs. grade baseline</Text>
              </View>
              <Text className={`text-xs font-black ${adjPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {adjPct >= 0 ? `+${adjPct}% (Premium)` : `${adjPct}% (Deduction)`}
              </Text>
            </View>

            <View className="flex-row items-center justify-between pt-2 border-t border-slate-100">
              <View>
                <Text className="text-xs font-black text-slate-900">Effective Net Rate</Text>
                <Text className="text-[10px] text-slate-400">Final estimated unit rate</Text>
              </View>
              <Text className="text-base font-black text-brand-600">
                ₹{effectiveRate.toFixed(2)} / kg
              </Text>
            </View>

            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-bold text-slate-800">Procurement Quantity</Text>
                <Text className="text-[10px] text-slate-400">Confirmed lot weight</Text>
              </View>
              <Text className="text-xs font-black text-slate-900">
                {weightKg.toLocaleString('en-IN')} kg ({(weightKg / 100).toFixed(2)} qtl)
              </Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('ReviewNegotiateModal')}
          className="bg-brand-600 py-4 rounded-2xl items-center shadow-lg shadow-emerald-700/25 active:scale-98"
        >
          <Text className="text-white font-black text-base tracking-wide">
            Review & Finalize Negotiation →
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
