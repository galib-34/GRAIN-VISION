import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLotStore } from '../../stores/lotStore';

export const ActivityFeedModal: React.FC = () => {
  const navigation = useNavigation<any>();
  const lots = useLotStore((state) => state.lots);

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
        <Text className="text-base font-black text-slate-800">Procurement Activity Feed</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 p-5">
        <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
          Intake & Quality Milestones
        </Text>

        <View className="space-y-4">
          {lots.map((lot, idx) => (
            <View key={lot.id} className="flex-row space-x-3">
              <View className="items-center">
                <View className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-300 items-center justify-center">
                  <Text className="text-xs font-bold text-emerald-800">
                    {lot.status === 'accepted' ? '✓' : lot.status === 'rejected' ? '✕' : '⏳'}
                  </Text>
                </View>
                {idx < lots.length - 1 && <View className="w-0.5 flex-1 bg-slate-200 my-1" />}
              </View>

              <TouchableOpacity
                onPress={() => navigation.navigate('TransactionDetailsModal', { lotId: lot.id })}
                className="flex-1 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 mb-2 active:scale-98"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs font-black text-slate-900">{lot.lotId}</Text>
                  <Text className="text-[10px] text-slate-400">
                    {lot.createdAt ? new Date(lot.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                  </Text>
                </View>

                <Text className="text-xs text-slate-700 font-medium">
                  {lot.status === 'accepted' ? 'Procurement Lot Approved' : lot.status === 'rejected' ? 'Lot Declined' : 'Lot Under Assessment'}
                </Text>

                <Text className="text-[11px] text-slate-500 mt-0.5">
                  Farmer: <Text className="font-bold text-slate-800">{lot.seller?.name}</Text> · {lot.weightKg} kg · Score: {lot.qualityScore}/100
                </Text>

                {lot.pricing && (
                  <Text className="text-[11px] font-black text-emerald-700 mt-1">
                    Valuation: ₹{Math.round(lot.pricing.totalEstimatedPrice).toLocaleString('en-IN')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};
