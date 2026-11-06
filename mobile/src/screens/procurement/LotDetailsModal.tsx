import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useLotStore } from '../../stores/lotStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'LotDetailsModal'>;

const RICE_VARIETIES = [
  'Swarna (MTU 7029)',
  'BPT 5204 (Samba Mahsuri)',
  'IR64 Paddy',
  'PR106 Common',
  'RNR 15048 (Telangana Sona)',
  'MTU 1010',
];

export const LotDetailsModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { activeLotId, selectedSeller, variety, setVariety, moisturePercentage, setMoisture } = useLotStore();

  const [selectedVar, setSelectedVar] = useState(variety || RICE_VARIETIES[0]);
  const [moisture, setLocalMoisture] = useState(String(moisturePercentage || 14.0));
  const [remarks, setRemarks] = useState('Standard intake sample verified via YOLO edge detection.');

  const todayDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const handleProceed = () => {
    setVariety(selectedVar);
    const parsedMoisture = parseFloat(moisture);
    if (!isNaN(parsedMoisture)) setMoisture(parsedMoisture);
    navigation.navigate('LotWeightModal');
  };

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
          Lot Intake Details
        </Text>
        <View className="w-10" />
      </View>

      <View className="p-5">
        {/* Selected Farmer Info Card */}
        <View className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm mb-5">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Assigned Farmer
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SellerSelectionModal')}>
              <Text className="text-xs font-bold text-brand-600">Change ✎</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center space-x-3">
            <View className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 items-center justify-center">
              <Text className="text-xl">👨‍🌾</Text>
            </View>
            <View>
              <Text className="text-base font-black text-slate-900">
                {selectedSeller?.name || 'Unassigned Farmer'}
              </Text>
              <Text className="text-xs text-slate-500">
                {selectedSeller?.phone} · {selectedSeller?.location}
              </Text>
            </View>
          </View>
        </View>

        {/* Lot Metadata Block */}
        <View className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm mb-5 space-y-4">
          <View className="flex-row items-center justify-between pb-3 border-b border-slate-100">
            <View>
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Auto-Generated Lot ID</Text>
              <Text className="text-base font-black text-brand-950 mt-0.5">{activeLotId}</Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] font-bold text-slate-400 uppercase">Intake Date</Text>
              <Text className="text-xs font-bold text-slate-700 mt-0.5">{todayDate}</Text>
            </View>
          </View>

          {/* Rice Variety Selector */}
          <View>
            <Text className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Select Rice / Paddy Variety *
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {RICE_VARIETIES.map((v) => {
                const isSelected = selectedVar === v;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => setSelectedVar(v)}
                    className={`px-3 py-2 rounded-xl border ${
                      isSelected ? 'bg-emerald-600 border-emerald-600' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                      {v}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Moisture Content % Input */}
          <View className="pt-2">
            <View className="flex-row items-center justify-between mb-1.5">
              <Text className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Moisture Content (%)
              </Text>
              <Text className="text-[10px] text-emerald-700 font-bold">Standard: 14.0%</Text>
            </View>
            <TextInput
              value={moisture}
              onChangeText={setLocalMoisture}
              placeholder="14.0"
              keyboardType="decimal-pad"
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 font-bold"
            />
          </View>

          {/* Inspector Remarks */}
          <View className="pt-2">
            <Text className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Inspector Field Remarks
            </Text>
            <TextInput
              value={remarks}
              onChangeText={setRemarks}
              placeholder="Enter remarks..."
              multiline
              numberOfLines={3}
              className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 leading-relaxed text-top"
            />
          </View>
        </View>

        {/* Next Action Button */}
        <TouchableOpacity
          onPress={handleProceed}
          className="bg-brand-600 py-4 rounded-2xl items-center shadow-lg shadow-emerald-700/25 active:scale-98"
        >
          <Text className="text-white font-black text-base tracking-wide">
            Proceed to Weight Entry →
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
