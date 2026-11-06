import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useLotStore } from '../../stores/lotStore';
import { LotRecord, LotStatus } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const FILTER_TABS: { label: string; value: LotStatus | 'all' }[] = [
  { label: 'All Lots', value: 'all' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Pending', value: 'pending' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Draft', value: 'draft' },
];

export const LotsTabScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { lots, filterStatus, setFilterStatus } = useLotStore();
  const [search, setSearch] = useState('');

  const filteredLots = lots.filter((lot) => {
    // Status filter
    if (filterStatus !== 'all' && lot.status !== filterStatus) return false;

    // Search query filter
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchesId = lot.lotId.toLowerCase().includes(q);
    const matchesVariety = lot.variety.toLowerCase().includes(q);
    const matchesSeller = (lot.seller?.name || '').toLowerCase().includes(q);
    const matchesLocation = (lot.seller?.location || '').toLowerCase().includes(q);

    return matchesId || matchesVariety || matchesSeller || matchesLocation;
  });

  const getStatusBadge = (status: LotStatus) => {
    switch (status) {
      case 'accepted':
        return { text: 'ACCEPTED', bg: 'bg-emerald-100', textCol: 'text-emerald-800', border: 'border-emerald-300' };
      case 'rejected':
        return { text: 'REJECTED', bg: 'bg-rose-100', textCol: 'text-rose-800', border: 'border-rose-300' };
      case 'draft':
        return { text: 'DRAFT', bg: 'bg-slate-100', textCol: 'text-slate-700', border: 'border-slate-300' };
      default:
        return { text: 'PENDING', bg: 'bg-amber-100', textCol: 'text-amber-800', border: 'border-amber-300' };
    }
  };

  const getGradePill = (score: number) => {
    if (score >= 80) return { label: 'Grade A', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    if (score >= 60) return { label: 'Grade B', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    return { label: 'Grade C', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top Header Bar */}
      <View className="bg-brand-950 pt-14 pb-5 px-5 rounded-b-[28px] shadow-lg shadow-emerald-950/20">
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Procurement Ledger
            </Text>
            <Text className="text-xl font-black text-white">Lots Management</Text>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('CameraCaptureModal')}
            className="bg-emerald-600 px-3.5 py-2 rounded-xl flex-row items-center space-x-1.5 active:scale-95"
          >
            <Text className="text-xs text-white">＋</Text>
            <Text className="text-xs font-bold text-white">New Lot</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar Input */}
        <View className="bg-white/10 rounded-2xl border border-white/15 px-3.5 py-2.5 flex-row items-center space-x-2">
          <Text className="text-sm text-slate-300">🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by lot ID, variety, or farmer..."
            placeholderTextColor="#94a3b8"
            className="flex-1 text-xs text-white"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text className="text-xs text-slate-300 font-bold">✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs Horizontal Bar */}
      <View className="py-3 px-5 border-b border-slate-200 bg-white">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row space-x-2">
          {FILTER_TABS.map((tab) => {
            const isActive = filterStatus === tab.value;
            const count = tab.value === 'all'
              ? lots.length
              : lots.filter((l) => l.status === tab.value).length;

            return (
              <TouchableOpacity
                key={tab.value}
                onPress={() => setFilterStatus(tab.value)}
                className={`px-3.5 py-1.5 rounded-full border ${
                  isActive ? 'bg-emerald-600 border-emerald-600 shadow-sm' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <Text className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-600'}`}>
                  {tab.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Lots List Feed */}
      <FlatList
        data={filteredLots}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
        renderItem={({ item }) => {
          const badge = getStatusBadge(item.status);
          const grade = getGradePill(item.qualityScore);
          const totalValuation = item.pricing?.totalEstimatedPrice ?? 0;

          return (
            <TouchableOpacity
              onPress={() => navigation.navigate('TransactionDetailsModal', { lotId: item.id })}
              className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm mb-3.5 active:scale-98"
            >
              {/* Card Header Row */}
              <View className="flex-row items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                <View className="flex-row items-center space-x-2">
                  <Text className="text-sm font-black text-slate-900">{item.lotId}</Text>
                  <View className={`px-2 py-0.5 rounded-md border ${grade.bg} ${grade.border}`}>
                    <Text className={`text-[9px] font-black ${grade.text}`}>{grade.label}</Text>
                  </View>
                </View>

                <View className={`px-2 py-0.5 rounded-full border ${badge.bg} ${badge.border}`}>
                  <Text className={`text-[9px] font-black ${badge.textCol}`}>{badge.text}</Text>
                </View>
              </View>

              {/* Farmer & Variety Info */}
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1 pr-2">
                  <Text className="text-xs font-black text-slate-800">
                    {item.seller?.name || 'Unassigned Farmer'}
                  </Text>
                  <Text className="text-[11px] text-slate-500 mt-0.5">
                    📍 {item.seller?.location} · Variety: {item.variety}
                  </Text>
                  {item.rejectionReason && (
                    <Text className="text-[10px] text-rose-700 font-semibold mt-1">
                      ⚠️ Reason: {item.rejectionReason}
                    </Text>
                  )}
                </View>

                <View className="items-end">
                  <Text className="text-base font-black text-brand-950">
                    ₹{Math.round(totalValuation).toLocaleString('en-IN')}
                  </Text>
                  <Text className="text-[10px] text-slate-500 font-medium">
                    {item.weightKg.toLocaleString('en-IN')} kg ({item.weightQuintals} qtl)
                  </Text>
                </View>
              </View>

              {/* Sub Details Footer */}
              <View className="bg-slate-50 px-3 py-2 rounded-xl flex-row items-center justify-between">
                <Text className="text-[10px] text-slate-500 font-medium">
                  {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Today'} · Score: {item.qualityScore}/100
                </Text>
                <Text className="text-[10px] font-bold text-emerald-700">
                  Inspect Audit Details →
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View className="bg-white p-8 rounded-3xl border border-slate-200 items-center mt-6">
            <Text className="text-4xl mb-2">📦</Text>
            <Text className="text-base font-black text-slate-800">No lots found</Text>
            <Text className="text-xs text-slate-500 text-center max-w-xs mt-1 mb-5 leading-relaxed">
              No procurement lots match your current search and status filter criteria.
            </Text>
            <TouchableOpacity
              onPress={() => setFilterStatus('all')}
              className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-200"
            >
              <Text className="text-xs font-bold text-emerald-800">Clear Filter</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};
