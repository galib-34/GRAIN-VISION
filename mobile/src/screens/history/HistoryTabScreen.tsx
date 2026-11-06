import React from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useLotStore } from '../../stores/lotStore';
import { LotRecord } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const HistoryTabScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const lots = useLotStore((state) => state.lots);

  // Completed transactions (accepted and rejected history)
  const completedLots = lots.filter((l) => l.status === 'accepted' || l.status === 'rejected');

  const totalVolumeKg = completedLots
    .filter((l) => l.status === 'accepted')
    .reduce((sum, l) => sum + (l.weightKg || 0), 0);

  const totalPayout = completedLots
    .filter((l) => l.status === 'accepted')
    .reduce((sum, l) => sum + (l.pricing?.totalEstimatedPrice || 0), 0);

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top Header */}
      <View className="bg-brand-950 pt-14 pb-6 px-5 rounded-b-[28px] shadow-lg shadow-emerald-950/20">
        <Text className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
          Historical Audit Records
        </Text>
        <Text className="text-xl font-black text-white mb-4">Procurement History</Text>

        {/* Cumulative Intake Summary Card */}
        <View className="bg-brand-900/90 p-4 rounded-2xl border border-emerald-500/20 flex-row justify-between">
          <View>
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Total Settled Value</Text>
            <Text className="text-xl font-black text-white mt-0.5">
              ₹{(totalPayout / 100000).toFixed(2)} L
            </Text>
            <Text className="text-[10px] text-emerald-400 mt-0.5">
              ₹{Math.round(totalPayout).toLocaleString('en-IN')}
            </Text>
          </View>

          <View className="items-end">
            <Text className="text-[10px] font-bold text-slate-400 uppercase">Volume Procured</Text>
            <Text className="text-xl font-black text-white mt-0.5">
              {(totalVolumeKg / 100).toFixed(1)} qtl
            </Text>
            <Text className="text-[10px] text-slate-300 mt-0.5">
              {(totalVolumeKg / 1000).toFixed(2)} metric tons
            </Text>
          </View>
        </View>
      </View>

      {/* History List */}
      <FlatList
        data={completedLots}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
        renderItem={({ item }) => {
          const isAccepted = item.status === 'accepted';
          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('TransactionDetailsModal', { lotId: item.id })}
              className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm mb-3.5 active:scale-98"
            >
              <View className="flex-row items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <View className="flex-row items-center space-x-2">
                  <Text className="text-base">{isAccepted ? '✅' : '❌'}</Text>
                  <Text className="text-xs font-black text-slate-900">{item.lotId}</Text>
                </View>
                <Text className="text-[10px] font-bold text-slate-400">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent'}
                </Text>
              </View>

              <View className="flex-row justify-between items-center mb-2">
                <View>
                  <Text className="text-sm font-black text-slate-800">
                    {item.seller?.name || 'Unassigned Farmer'}
                  </Text>
                  <Text className="text-xs text-slate-500">
                    {item.variety} · {item.weightKg} kg · Score: {item.qualityScore}/100
                  </Text>
                </View>

                <View className="items-end">
                  <Text className="text-base font-black text-brand-950">
                    ₹{Math.round(item.pricing?.totalEstimatedPrice || 0).toLocaleString('en-IN')}
                  </Text>
                  <Text className="text-[10px] font-bold text-emerald-700">
                    ₹{item.pricing?.agreedRatePerKg || item.pricing?.estimatedRatePerKg} / kg
                  </Text>
                </View>
              </View>

              <View className="bg-slate-50 px-3 py-1.5 rounded-xl flex-row items-center justify-between">
                <Text className="text-[10px] text-slate-500">
                  Status: <Text className={`font-bold ${isAccepted ? 'text-emerald-700' : 'text-rose-700'}`}>{item.status.toUpperCase()}</Text>
                </Text>
                <Text className="text-[10px] font-bold text-slate-600">
                  View Certificate & Audit →
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View className="bg-white p-8 rounded-3xl border border-slate-200 items-center mt-6">
            <Text className="text-4xl mb-2">📜</Text>
            <Text className="text-base font-black text-slate-800">No completed history</Text>
            <Text className="text-xs text-slate-500 text-center max-w-xs mt-1">
              Completed and settled lot procurement records will automatically appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
};
