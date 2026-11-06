import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useLotStore } from '../../stores/lotStore';
import { useInspectionStore } from '../../stores/inspectionStore';
import { LotRecord } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ConfirmationModal'>;

const REJECTION_REASONS = [
  'Excessive Broken Grains (> 20%)',
  'High Chalkiness (> 15%)',
  'Foreign Objects / Stones / Plastic Detected',
  'High Moisture Content (> 15%)',
  'Farmer Declined Negotiated Rate',
  'Other Quality Non-Conformance',
];

export const ConfirmationModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { commitLotDecision, activeLotId, selectedSeller, weightKg, pricing } = useLotStore();
  const { metrics, capturedImageUri, resetInspection } = useInspectionStore();

  const [confirmedLot, setConfirmedLot] = useState<LotRecord | null>(null);
  const [decisionState, setDecisionState] = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [selectedRejectReason, setSelectedRejectReason] = useState(REJECTION_REASONS[0]);

  const fallbackMetrics = metrics || {
    totalGrains: 142,
    soundCount: 111,
    brokenCount: 18,
    chalkyCount: 9,
    discoloredCount: 4,
    soundPct: 78.2,
    brokenPct: 12.7,
    chalkyPct: 6.3,
    discoloredPct: 2.8,
    qualityScore: 84.5,
    classBreakdown: [],
  };

  const handleAccept = () => {
    const lot = commitLotDecision(
      'accepted',
      fallbackMetrics,
      capturedImageUri || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1080',
      undefined,
      'Procurement approved by officer.'
    );
    setConfirmedLot(lot);
    setDecisionState('accepted');
    resetInspection();
  };

  const handleConfirmRejection = () => {
    const lot = commitLotDecision(
      'rejected',
      fallbackMetrics,
      capturedImageUri || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=1080',
      selectedRejectReason,
      `Lot rejected: ${selectedRejectReason}`
    );
    setConfirmedLot(lot);
    setDecisionState('rejected');
    setShowRejectForm(false);
    resetInspection();
  };

  const handleReturnHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs', params: { screen: 'HomeTab' } }],
    });
  };

  const handleViewTransaction = () => {
    if (confirmedLot) {
      navigation.navigate('TransactionDetailsModal', { lotId: confirmedLot.id });
    } else {
      handleReturnHome();
    }
  };

  // State 2: Confirmation Receipt View (Once Accepted or Rejected)
  if (decisionState !== 'pending') {
    const isAccepted = decisionState === 'accepted';
    return (
      <View className="flex-1 bg-white items-center justify-between p-6 pt-20 pb-10">
        <View className="items-center w-full">
          <View
            className={`w-24 h-24 rounded-full items-center justify-center mb-5 ${
              isAccepted ? 'bg-emerald-100 border-4 border-emerald-500' : 'bg-rose-100 border-4 border-rose-500'
            }`}
          >
            <Text className="text-4xl">{isAccepted ? '✅' : '❌'}</Text>
          </View>

          <Text className="text-2xl font-black text-slate-900 text-center mb-1">
            {isAccepted ? 'Procurement Confirmed!' : 'Lot Procurement Declined'}
          </Text>

          <Text className="text-xs text-slate-500 text-center max-w-xs mb-6">
            {isAccepted
              ? 'The lot has been successfully added to your active procurement ledger.'
              : `The lot assessment was recorded as rejected (${confirmedLot?.rejectionReason}).`}
          </Text>

          {/* Receipt Card */}
          <View className="w-full bg-slate-50 p-5 rounded-3xl border border-slate-200/90 mb-6 space-y-2.5">
            <View className="flex-row justify-between pb-2 border-b border-slate-200">
              <Text className="text-xs text-slate-500">Lot ID:</Text>
              <Text className="text-xs font-bold text-slate-900">{confirmedLot?.lotId || activeLotId}</Text>
            </View>
            <View className="flex-row justify-between pb-2 border-b border-slate-200">
              <Text className="text-xs text-slate-500">Farmer:</Text>
              <Text className="text-xs font-bold text-slate-900">{confirmedLot?.seller?.name || selectedSeller?.name}</Text>
            </View>
            <View className="flex-row justify-between pb-2 border-b border-slate-200">
              <Text className="text-xs text-slate-500">Quantity:</Text>
              <Text className="text-xs font-bold text-slate-900">{confirmedLot?.weightKg || weightKg} kg</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-slate-500">Final Payout:</Text>
              <Text className="text-sm font-black text-brand-600">
                ₹{Math.round(confirmedLot?.pricing?.totalEstimatedPrice || pricing?.totalEstimatedPrice || 0).toLocaleString('en-IN')}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="w-full space-y-3">
          <TouchableOpacity
            onPress={handleViewTransaction}
            className="w-full bg-brand-600 py-4 rounded-2xl items-center shadow-lg shadow-emerald-700/25 active:scale-98"
          >
            <Text className="text-white font-black text-base tracking-wide">
              View Detailed Lot Record →
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReturnHome}
            className="w-full bg-slate-100 py-3.5 rounded-2xl items-center border border-slate-200 active:scale-98"
          >
            <Text className="text-slate-700 font-bold text-sm">
              Return to Dashboard
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // State 1: Active Determination Decision View
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
          Final Determination
        </Text>
        <View className="w-10" />
      </View>

      <View className="p-5">
        <View className="mb-5">
          <Text className="text-xl font-black text-slate-900 mb-1">
            Accept or Decline Lot
          </Text>
          <Text className="text-xs text-slate-500 leading-relaxed">
            Record your official procurement determination for {activeLotId}. Acceptance commits this transaction to the ledger.
          </Text>
        </View>

        {/* Payout Summary Glance */}
        <View className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-6 items-center">
          <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Confirmed Payout To Farmer
          </Text>
          <Text className="text-4xl font-black text-slate-900 my-1">
            ₹{Math.round(pricing?.totalEstimatedPrice || 11830).toLocaleString('en-IN')}
          </Text>
          <Text className="text-xs font-semibold text-emerald-700">
            {selectedSeller?.name} · {weightKg} kg @ ₹{pricing?.agreedRatePerKg || 23.66}/kg
          </Text>
        </View>

        {/* Rejection Form Drawer (If Triggered) */}
        {showRejectForm ? (
          <View className="bg-rose-50 p-5 rounded-3xl border border-rose-200 mb-6 space-y-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-black text-rose-900 uppercase tracking-wider">
                Specify Rejection Reason *
              </Text>
              <TouchableOpacity onPress={() => setShowRejectForm(false)}>
                <Text className="text-xs font-bold text-rose-700">Cancel ✕</Text>
              </TouchableOpacity>
            </View>

            <View className="space-y-2">
              {REJECTION_REASONS.map((reason) => {
                const isSelected = selectedRejectReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    onPress={() => setSelectedRejectReason(reason)}
                    className={`p-3 rounded-xl border flex-row items-center justify-between ${
                      isSelected ? 'bg-rose-200/60 border-rose-400' : 'bg-white border-rose-100'
                    }`}
                  >
                    <Text className="text-xs font-medium text-slate-800">{reason}</Text>
                    {isSelected && <Text className="text-xs font-bold text-rose-800">✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={handleConfirmRejection}
              className="bg-rose-600 py-3.5 rounded-xl items-center shadow-md active:scale-98"
            >
              <Text className="text-white font-bold text-sm">
                Confirm Rejection Determination
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Primary Decision Buttons */
          <View className="space-y-4">
            <TouchableOpacity
              onPress={handleAccept}
              className="bg-emerald-600 py-4 px-6 rounded-2xl items-center shadow-lg shadow-emerald-700/30 active:scale-98"
            >
              <View className="flex-row items-center space-x-2">
                <Text className="text-xl">✅</Text>
                <Text className="text-white font-black text-base tracking-wide">
                  Accept Lot & Commit to Ledger
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowRejectForm(true)}
              className="bg-rose-50 py-3.5 px-6 rounded-2xl items-center border border-rose-200 active:scale-98"
            >
              <View className="flex-row items-center space-x-2">
                <Text className="text-lg">❌</Text>
                <Text className="text-rose-700 font-bold text-sm">
                  Decline / Reject This Lot
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};
