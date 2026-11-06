import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useLotStore } from '../../stores/lotStore';
import { useInspectionStore } from '../../stores/inspectionStore';
import { procurementService } from '../../services/procurementService';
import { PricingSource } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PriceSourceModal'>;

export const PriceSourceModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const calculateLotPricing = useLotStore((state) => state.calculateLotPricing);
  const metrics = useInspectionStore((state) => state.metrics);

  const [source, setSource] = useState<PricingSource>('api');
  const [mandiPrice, setMandiPrice] = useState<number>(2320.0);
  const [mandiMarket, setMandiMarket] = useState<string>('Kakinada Market Yard');
  const [mandiDate, setMandiDate] = useState<string>('2026-10-25');
  const [customRate, setCustomRate] = useState<string>('2350.0');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadMandiData() {
      setLoading(true);
      try {
        const data = await procurementService.fetchMandiPrice();
        setMandiPrice(data.baseRatePerQuintal);
        setMandiMarket(data.market);
        setMandiDate(data.date);
      } catch (err) {
        console.warn('Could not load live mandi quote:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMandiData();
  }, []);

  const handleProceed = async () => {
    const qualityScore = metrics?.qualityScore ?? 84.5;
    const baseRate = source === 'api' ? mandiPrice : parseFloat(customRate) || 2320.0;

    await calculateLotPricing(qualityScore, source);
    navigation.navigate('PriceCalculationModal');
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
          Price Benchmark Source
        </Text>
        <View className="w-10" />
      </View>

      <View className="p-5">
        <View className="mb-4">
          <Text className="text-xl font-black text-slate-900 mb-1">
            Baseline Reference Rate
          </Text>
          <Text className="text-xs text-slate-500 leading-relaxed">
            Select the reference price source for Swarna paddy before applying AI defect-based quality adjustments.
          </Text>
        </View>

        {/* Source Toggle Cards */}
        <View className="space-y-3.5 mb-5">
          {/* Option 1: Live AGMARKNET Mandi API */}
          <TouchableOpacity
            onPress={() => setSource('api')}
            className={`p-5 rounded-3xl border ${
              source === 'api' ? 'bg-emerald-50/70 border-emerald-500 shadow-sm' : 'bg-white border-slate-200'
            } active:scale-98`}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center space-x-2">
                <Text className="text-lg">🌐</Text>
                <Text className="text-sm font-black text-slate-900">
                  Government Mandi Reference (API)
                </Text>
              </View>
              <View
                className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                  source === 'api' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                }`}
              >
                {source === 'api' && <Text className="text-white text-[10px] font-bold">✓</Text>}
              </View>
            </View>

            <Text className="text-xs text-slate-500 mb-3 leading-relaxed">
              Live daily modal benchmark from AGMARKNET via Government of India Open Data Platform.
            </Text>

            {loading ? (
              <ActivityIndicator color="#059669" size="small" />
            ) : (
              <View className="bg-white p-3 rounded-2xl border border-slate-100 flex-row items-center justify-between">
                <View>
                  <Text className="text-[10px] font-bold text-slate-400 uppercase">
                    {mandiMarket} · {mandiDate}
                  </Text>
                  <Text className="text-base font-black text-brand-950">
                    ₹{mandiPrice.toFixed(2)} / quintal
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] font-bold text-emerald-700">
                    ₹{(mandiPrice / 100).toFixed(2)} / kg
                  </Text>
                  <Text className="text-[9px] text-slate-400">Modal price</Text>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* Option 2: Custom Manual Rate Entry */}
          <TouchableOpacity
            onPress={() => setSource('manual')}
            className={`p-5 rounded-3xl border ${
              source === 'manual' ? 'bg-emerald-50/70 border-emerald-500 shadow-sm' : 'bg-white border-slate-200'
            } active:scale-98`}
          >
            <View className="flex-row items-center justify-between mb-2">
              <View className="flex-row items-center space-x-2">
                <Text className="text-lg">✍️</Text>
                <Text className="text-sm font-black text-slate-900">
                  Manual Custom Baseline Entry
                </Text>
              </View>
              <View
                className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                  source === 'manual' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                }`}
              >
                {source === 'manual' && <Text className="text-white text-[10px] font-bold">✓</Text>}
              </View>
            </View>

            <Text className="text-xs text-slate-500 mb-3 leading-relaxed">
              Override government benchmark with an agreed regional base price or private procurement schedule.
            </Text>

            {source === 'manual' && (
              <View className="bg-white p-3 rounded-2xl border border-emerald-200">
                <Text className="text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Enter Custom Base Rate (₹ / quintal)
                </Text>
                <TextInput
                  value={customRate}
                  onChangeText={setCustomRate}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 2350.0"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-base font-black text-slate-900"
                />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Informational Baseline Notice */}
        <View className="bg-slate-100 p-4 rounded-2xl border border-slate-200/90 mb-5">
          <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Informational Baseline Notice
          </Text>
          <Text className="text-[11px] text-slate-500 leading-relaxed">
            The mandi modal price represents standard commercial grade intake. Defect adjustments will automatically calculate in the next step based on your sample's quality score.
          </Text>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleProceed}
          className="bg-brand-600 py-4 rounded-2xl items-center shadow-lg shadow-emerald-700/25 active:scale-98"
        >
          <Text className="text-white font-black text-base tracking-wide">
            Calculate Quality-Adjusted Price →
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
