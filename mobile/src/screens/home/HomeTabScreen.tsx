import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';
import { useLotStore } from '../../stores/lotStore';
import { MOCK_MANDI_REFERENCE } from '../../services/mockData';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const HomeTabScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);
  const lots = useLotStore((state) => state.lots);

  // Compute live dashboard metrics from lots store
  const totalLots = lots.length;
  const acceptedLots = lots.filter((l) => l.status === 'accepted').length;
  const rejectedLots = lots.filter((l) => l.status === 'rejected').length;
  const pendingLots = lots.filter((l) => l.status === 'pending' || l.status === 'draft').length;

  const totalProcuredValue = lots
    .filter((l) => l.status === 'accepted')
    .reduce((sum, l) => sum + (l.pricing?.totalEstimatedPrice || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return { text: 'ACCEPTED', bg: 'bg-emerald-100', textCol: 'text-emerald-800', border: 'border-emerald-300' };
      case 'rejected':
        return { text: 'REJECTED', bg: 'bg-rose-100', textCol: 'text-rose-800', border: 'border-rose-300' };
      default:
        return { text: 'PENDING', bg: 'bg-amber-100', textCol: 'text-amber-800', border: 'border-amber-300' };
    }
  };

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Top Officer Header */}
      <View className="bg-brand-950 pt-14 pb-8 px-5 rounded-b-[32px] shadow-lg shadow-emerald-950/20">
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center space-x-3">
            <View className="w-12 h-12 rounded-2xl bg-brand-900 border border-emerald-400/30 items-center justify-center">
              <Text className="text-2xl">🌾</Text>
            </View>
            <View>
              <Text className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
                {user?.orgName || 'Mandi Intake Yard'}
              </Text>
              <Text className="text-lg font-black text-white">
                {user?.fullName || 'Procurement Officer'}
              </Text>
            </View>
          </View>

          {/* Quick Header Notification Actions */}
          <View className="flex-row items-center space-x-2">
            <TouchableOpacity
              onPress={() => navigation.navigate('ActivityFeedModal')}
              className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/15 active:scale-95"
            >
              <Text className="text-base">📊</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('NotificationsModal')}
              className="w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/15 active:scale-95 relative"
            >
              <Text className="text-base">🔔</Text>
              <View className="w-2.5 h-2.5 rounded-full bg-rose-500 absolute top-2 right-2 border border-brand-950" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Mandi Reference Market Strip */}
        <View className="bg-brand-900/90 border border-emerald-500/20 p-3.5 rounded-2xl flex-row items-center justify-between">
          <View>
            <View className="flex-row items-center space-x-1.5 mb-0.5">
              <Text className="text-xs font-bold text-emerald-300 uppercase">Mandi Baseline (AP)</Text>
              <Text className="text-[10px] text-slate-400 font-medium">· AGMARKNET</Text>
            </View>
            <Text className="text-xs text-slate-300">
              {MOCK_MANDI_REFERENCE.market}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-base font-black text-white">
              ₹{MOCK_MANDI_REFERENCE.modal_price_per_quintal.toLocaleString('en-IN')}
            </Text>
            <Text className="text-[10px] text-emerald-400 font-bold">per quintal</Text>
          </View>
        </View>

        <Text className="text-[10px] text-slate-400 mt-2 text-center">
          ⚠️ Decision Support Baseline · Sourced from data.gov.in · Non-statutory offer
        </Text>
      </View>

      {/* Main Content Body */}
      <View className="px-5 -mt-4">
        {/* Stats Grid (4 Cards) */}
        <View className="flex-row flex-wrap justify-between">
          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200/80 mb-3 shadow-sm">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Lots Assessed
            </Text>
            <Text className="text-2xl font-black text-slate-900">{totalLots}</Text>
            <Text className="text-[10px] text-slate-400 mt-0.5">Active season intake</Text>
          </View>

          <View className="w-[48%] bg-white p-4 rounded-2xl border border-emerald-200 mb-3 shadow-sm bg-emerald-50/40">
            <Text className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
              Accepted Lots
            </Text>
            <Text className="text-2xl font-black text-emerald-800">{acceptedLots}</Text>
            <Text className="text-[10px] text-emerald-600 mt-0.5">
              {totalLots ? Math.round((acceptedLots / totalLots) * 100) : 0}% acceptance rate
            </Text>
          </View>

          <View className="w-[48%] bg-white p-4 rounded-2xl border border-rose-200 mb-3 shadow-sm bg-rose-50/40">
            <Text className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">
              Rejected Lots
            </Text>
            <Text className="text-2xl font-black text-rose-800">{rejectedLots}</Text>
            <Text className="text-[10px] text-rose-600 mt-0.5">Defect threshold declined</Text>
          </View>

          <View className="w-[48%] bg-white p-4 rounded-2xl border border-slate-200/80 mb-3 shadow-sm">
            <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Procured Value
            </Text>
            <Text className="text-xl font-black text-slate-900">
              ₹{(totalProcuredValue / 1000).toFixed(1)}k
            </Text>
            <Text className="text-[10px] text-slate-400 mt-0.5">
              ₹{Math.round(totalProcuredValue).toLocaleString('en-IN')} total
            </Text>
          </View>
        </View>

        {/* Hero Action Launcher */}
        <View className="bg-gradient-to-r from-emerald-700 to-brand-900 rounded-3xl p-5 my-3 shadow-md shadow-emerald-800/30">
          <View className="flex-row items-center justify-between mb-3">
            <View className="bg-white/20 px-2.5 py-0.5 rounded-md">
              <Text className="text-[10px] font-black text-white uppercase tracking-wider">
                YOLOv8n AI Vision
              </Text>
            </View>
            <Text className="text-xs text-emerald-200 font-semibold">Swarna · BPT 5204</Text>
          </View>

          <Text className="text-xl font-black text-white mb-1">
            New Rice Lot Intake
          </Text>
          <Text className="text-xs text-emerald-100 mb-4 leading-4">
            Snap grain sample, detect broken/chalky defects, and calculate procurement price.
          </Text>

          <TouchableOpacity
            onPress={() => navigation.navigate('CameraCaptureModal')}
            className="bg-white py-3.5 px-5 rounded-2xl flex-row items-center justify-center space-x-2 shadow-sm active:scale-98"
          >
            <Text className="text-lg">📸</Text>
            <Text className="text-brand-950 font-black text-sm tracking-wide">
              Start Sample Analysis
            </Text>
          </TouchableOpacity>

          {/* Sub Actions */}
          <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-white/10">
            <TouchableOpacity
              onPress={() => navigation.navigate('AddSellerModal')}
              className="flex-row items-center space-x-1"
            >
              <Text className="text-xs text-white">➕</Text>
              <Text className="text-xs text-emerald-100 font-semibold underline">
                Add Farmer Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('LotsTab' as any)}
              className="flex-row items-center space-x-1"
            >
              <Text className="text-xs text-emerald-100 font-semibold underline">
                Browse All Lots ({totalLots}) →
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Lots Activity Feed */}
        <View className="mt-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-base font-black text-slate-900">
              Recent Lot Activity
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('LotsTab' as any)}>
              <Text className="text-xs font-bold text-brand-600">View All</Text>
            </TouchableOpacity>
          </View>

          <View className="space-y-2.5">
            {lots.slice(0, 5).map((lot) => {
              const badge = getStatusBadge(lot.status);
              return (
                <TouchableOpacity
                  key={lot.id}
                  onPress={() => navigation.navigate('TransactionDetailsModal', { lotId: lot.id })}
                  className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex-row items-center justify-between active:scale-98"
                >
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center space-x-2 mb-1">
                      <Text className="text-xs font-black text-slate-900">{lot.lotId}</Text>
                      <View className={`px-2 py-0.5 rounded-full border ${badge.bg} ${badge.border}`}>
                        <Text className={`text-[9px] font-black ${badge.textCol}`}>
                          {badge.text}
                        </Text>
                      </View>
                    </View>

                    <Text className="text-xs font-semibold text-slate-700">
                      {lot.seller?.name || 'Unassigned Farmer'}
                    </Text>

                    <Text className="text-[10px] text-slate-400 mt-0.5">
                      {lot.variety} · {lot.weightKg} kg · Score: {lot.qualityScore}/100
                    </Text>
                  </View>

                  <View className="items-end">
                    <Text className="text-sm font-black text-slate-900">
                      ₹{Math.round(lot.pricing?.totalEstimatedPrice || 0).toLocaleString('en-IN')}
                    </Text>
                    <Text className="text-[10px] text-slate-500 font-medium">
                      ₹{lot.pricing?.agreedRatePerKg || lot.pricing?.estimatedRatePerKg}/kg
                    </Text>
                    <Text className="text-[10px] text-emerald-600 font-bold mt-1">
                      View →
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
