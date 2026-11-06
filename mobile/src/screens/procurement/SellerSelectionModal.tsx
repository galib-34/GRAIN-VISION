import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useLotStore } from '../../stores/lotStore';
import { SellerProfile } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SellerSelectionModal'>;

export const SellerSelectionModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { sellers, selectedSeller, selectSeller } = useLotStore();
  const [search, setSearch] = useState('');

  const filteredSellers = sellers.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.location.toLowerCase().includes(q) ||
      (s.sellerCode && s.sellerCode.toLowerCase().includes(q))
    );
  });

  const handleSelectSeller = (seller: SellerProfile) => {
    selectSeller(seller);
    navigation.navigate('LotDetailsModal');
  };

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
          Select Farmer / Seller
        </Text>
        <View className="w-10" />
      </View>

      <View className="p-5 flex-1">
        {/* Search Input Bar */}
        <View className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex-row items-center space-x-2.5 mb-4 shadow-sm">
          <Text className="text-base text-slate-400">🔍</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by farmer name, phone, or location..."
            placeholderTextColor="#94a3b8"
            className="flex-1 text-sm text-slate-900"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text className="text-xs text-slate-400 font-bold">✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Add New Farmer Quick Action Card */}
        <TouchableOpacity
          onPress={() => navigation.navigate('AddSellerModal')}
          className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-2xl mb-4 flex-row items-center justify-between active:scale-98"
        >
          <View className="flex-row items-center space-x-3">
            <View className="w-10 h-10 rounded-xl bg-emerald-600 items-center justify-center">
              <Text className="text-white text-lg font-bold">＋</Text>
            </View>
            <View>
              <Text className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Unregistered Farmer?
              </Text>
              <Text className="text-xs text-emerald-700 font-semibold">
                Add New Farmer Profile
              </Text>
            </View>
          </View>
          <Text className="text-xs font-bold text-emerald-700">Create →</Text>
        </TouchableOpacity>

        {/* Registered Sellers List */}
        <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
          Registered Farmers ({filteredSellers.length})
        </Text>

        <FlatList
          data={filteredSellers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 30 }}
          renderItem={({ item }) => {
            const isSelected = selectedSeller?.id === item.id;
            return (
              <TouchableOpacity
                onPress={() => handleSelectSeller(item)}
                className={`p-4 rounded-2xl border mb-3 flex-row items-center justify-between active:scale-98 ${
                  isSelected ? 'bg-emerald-50/80 border-emerald-500 shadow-sm' : 'bg-white border-slate-200'
                }`}
              >
                <View className="flex-1 pr-3">
                  <View className="flex-row items-center space-x-2 mb-1">
                    <Text className="text-sm font-black text-slate-900">{item.name}</Text>
                    {item.sellerCode && (
                      <View className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        <Text className="text-[10px] font-bold text-slate-600">{item.sellerCode}</Text>
                      </View>
                    )}
                  </View>

                  <Text className="text-xs text-slate-600">{item.phone}</Text>
                  <Text className="text-[11px] text-slate-400 mt-0.5">
                    📍 {item.location} · {item.totalLotsCount ?? 0} lots assessed
                  </Text>
                </View>

                <View className="items-center">
                  <View
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                    }`}
                  >
                    {isSelected && <Text className="text-white text-xs font-bold">✓</Text>}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View className="bg-white p-8 rounded-2xl border border-slate-200 items-center mt-4">
              <Text className="text-3xl mb-2">🌾</Text>
              <Text className="text-sm font-bold text-slate-700">No matching farmers found</Text>
              <Text className="text-xs text-slate-400 mt-1 mb-4 text-center">
                Search term did not match any registered profiles.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('AddSellerModal')}
                className="bg-brand-600 px-4 py-2 rounded-xl"
              >
                <Text className="text-white font-bold text-xs">Register This Farmer</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>
    </View>
  );
};
