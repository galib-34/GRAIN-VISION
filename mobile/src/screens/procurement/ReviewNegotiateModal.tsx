import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useLotStore } from '../../stores/lotStore';
import { useInspectionStore } from '../../stores/inspectionStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ReviewNegotiateModal'>;

export const ReviewNegotiateModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    activeLotId,
    selectedSeller,
    variety,
    moisturePercentage,
    weightKg,
    pricing,
    calculateLotPricing,
  } = useLotStore();
  const metrics = useInspectionStore((state) => state.metrics);

  const initialRate = pricing?.estimatedRatePerKg ?? 23.66;
  const [agreedRateStr, setAgreedRateStr] = useState(String(pricing?.agreedRatePerKg ?? initialRate));
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [negotiationNotes, setNegotiationNotes] = useState('');

  const currentAgreedRate = parseFloat(agreedRateStr) || initialRate;
  const finalPayout = currentAgreedRate * weightKg;
  const diffFromEstimated = (currentAgreedRate - initialRate) * weightKg;

  const handleApplyNegotiation = () => {
    if (currentAgreedRate <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid agreed price per kg.');
      return;
    }
    setIsEditingRate(false);
    calculateLotPricing(metrics?.qualityScore ?? 84.5, pricing?.source ?? 'api', currentAgreedRate);
  };

  const handleProceedToConfirmation = () => {
    calculateLotPricing(metrics?.qualityScore ?? 84.5, pricing?.source ?? 'api', currentAgreedRate);
    navigation.navigate('ConfirmationModal');
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 50 }}>
      {/* Top Header */}
      <View className="pt-14 pb-4 px-5 bg-white border-b border-slate-200 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center border border-slate-200 active:scale-95"
        >
          <Text className="text-slate-700 text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-sm font-black text-slate-800 uppercase tracking-widest">
          Review & Negotiate
        </Text>
        <View className="w-10" />
      </View>

      <View className="p-5">
        <View className="mb-4">
          <Text className="text-xl font-black text-slate-900 mb-1">
            Procurement Review
          </Text>
          <Text className="text-xs text-slate-500 leading-relaxed">
            Verify farmer details, quality grade, and negotiated payout rate before recording final lot acceptance.
          </Text>
        </View>

        {/* Farmer & Lot Summary Header Card */}
        <View className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-4">
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <View>
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Lot ID</Text>
              <Text className="text-sm font-black text-slate-900">{activeLotId}</Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Variety</Text>
              <Text className="text-xs font-black text-emerald-700">{variety}</Text>
            </View>
          </View>

          <View className="flex-row items-center space-x-3">
            <View className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 items-center justify-center">
              <Text className="text-2xl">👨‍🌾</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-black text-slate-900">
                {selectedSeller?.name || 'Unassigned Farmer'}
              </Text>
              <Text className="text-xs text-slate-500">
                {selectedSeller?.phone} · {selectedSeller?.location}
              </Text>
            </View>
          </View>
        </View>

        {/* Engine Recommendation Pill */}
        {pricing?.recommendation && (
          <View
            className={`p-4 rounded-2xl mb-4 border flex-row items-center justify-between ${
              pricing.recommendation === 'BUY'
                ? 'bg-emerald-50 border-emerald-200'
                : pricing.recommendation === 'REJECT'
                ? 'bg-rose-50 border-rose-200'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            <View>
              <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Procurement Recommendation
              </Text>
              <Text
                className={`text-base font-black mt-0.5 ${
                  pricing.recommendation === 'BUY'
                    ? 'text-emerald-800'
                    : pricing.recommendation === 'REJECT'
                    ? 'text-rose-800'
                    : 'text-amber-800'
                }`}
              >
                {pricing.recommendation === 'BUY'
                  ? '✅ BUY (Quality Meets Standard)'
                  : pricing.recommendation === 'REJECT'
                  ? '❌ REJECT (Exceeds Defect Limit)'
                  : '⚠️ NEGOTIATE (Slab Deductions Apply)'}
              </Text>
            </View>
            <View className="px-3 py-1 rounded-full bg-white border border-slate-200">
              <Text className="text-[10px] font-bold text-slate-700">
                {pricing.recommendation}
              </Text>
            </View>
          </View>
        )}

        {/* Quality & Weight Quick Spec Grid */}
        <View className="flex-row justify-between mb-4">
          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <Text className="text-[10px] font-bold text-slate-400 uppercase mb-1">Quality Score</Text>
            <Text className="text-xl font-black text-emerald-800">
              {(metrics?.qualityScore ?? 84.5).toFixed(1)} / 100
            </Text>
            <Text className="text-[10px] text-slate-500 mt-0.5">Grade A (Premium)</Text>
          </View>

          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <Text className="text-[10px] font-bold text-slate-400 uppercase mb-1">Lot Weight</Text>
            <Text className="text-xl font-black text-slate-900">
              {weightKg.toLocaleString('en-IN')} kg
            </Text>
            <Text className="text-[10px] text-slate-500 mt-0.5">
              {(weightKg / 100).toFixed(2)} quintals · {moisturePercentage}% moisture
            </Text>
          </View>
        </View>

        {/* Negotiation & Payout Adjustment Card */}
        <View className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-5">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Negotiated Settlement Rate
            </Text>
            <TouchableOpacity
              onPress={() => setIsEditingRate(!isEditingRate)}
              className="bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 active:scale-95"
            >
              <Text className="text-xs font-bold text-emerald-700">
                {isEditingRate ? 'Cancel ✕' : 'Negotiate Rate ✎'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Price Override Input (When Editing) */}
          {isEditingRate ? (
            <View className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-300 mb-3">
              <Text className="text-[11px] font-bold text-emerald-900 mb-1.5 uppercase">
                Enter Agreed Final Rate (₹ / kg)
              </Text>
              <View className="flex-row items-center space-x-2">
                <TextInput
                  value={agreedRateStr}
                  onChangeText={setAgreedRateStr}
                  keyboardType="decimal-pad"
                  className="flex-1 bg-white border border-emerald-300 rounded-xl px-4 py-2.5 text-lg font-black text-slate-900"
                />
                <TouchableOpacity
                  onPress={handleApplyNegotiation}
                  className="bg-emerald-600 px-4 py-3 rounded-xl active:scale-95"
                >
                  <Text className="text-white font-bold text-xs">Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {/* Rate Comparison Details */}
          <View className="space-y-2 py-2 border-b border-slate-100">
            <View className="flex-row justify-between">
              <Text className="text-xs text-slate-600">Calculated Model Rate:</Text>
              <Text className="text-xs font-bold text-slate-700">₹{initialRate.toFixed(2)} / kg</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-slate-600">Agreed Settlement Rate:</Text>
              <Text className="text-xs font-black text-brand-600">₹{currentAgreedRate.toFixed(2)} / kg</Text>
            </View>
            {diffFromEstimated !== 0 && (
              <View className="flex-row justify-between">
                <Text className="text-[11px] text-slate-500">Negotiation Variance:</Text>
                <Text className={`text-[11px] font-bold ${diffFromEstimated > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {diffFromEstimated > 0 ? `+₹${diffFromEstimated.toFixed(2)}` : `-₹${Math.abs(diffFromEstimated).toFixed(2)}`}
                </Text>
              </View>
            )}
          </View>

          {/* Total Payout Big Block */}
          <View className="pt-3 items-center">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total Final Lot Payout
            </Text>
            <Text className="text-3xl font-black text-brand-950 my-1">
              ₹{Math.round(finalPayout).toLocaleString('en-IN')}
            </Text>
          </View>

          {/* Negotiation Notes Input */}
          <View className="pt-3 border-t border-slate-100 mt-2">
            <Text className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Settlement Rationale / Agreement Notes
            </Text>
            <TextInput
              value={negotiationNotes}
              onChangeText={setNegotiationNotes}
              placeholder="e.g. Agreed to premium due to exceptional moisture control and early season delivery."
              multiline
              numberOfLines={2}
              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800"
            />
          </View>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleProceedToConfirmation}
          className="bg-brand-600 py-4 rounded-2xl items-center shadow-lg shadow-emerald-700/25 active:scale-98"
        >
          <Text className="text-white font-black text-base tracking-wide">
            Proceed to Determination (Accept / Reject) →
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
