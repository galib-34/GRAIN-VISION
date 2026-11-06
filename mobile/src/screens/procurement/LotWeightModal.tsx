import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useLotStore } from '../../stores/lotStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'LotWeightModal'>;

export const LotWeightModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { weightKg, setLotWeight, weightUnit } = useLotStore();

  const [activeUnit, setActiveUnit] = useState<'kg' | 'quintal'>(weightUnit || 'kg');
  // Initialize input string based on current unit
  const [valStr, setValStr] = useState(
    activeUnit === 'quintal' ? String((weightKg / 100).toFixed(1)) : String(weightKg || 500)
  );

  const numericVal = parseFloat(valStr) || 0;
  const currentKg = activeUnit === 'quintal' ? numericVal * 100 : numericVal;
  const currentQuintals = activeUnit === 'quintal' ? numericVal : numericVal / 100;

  const handleKeyPress = (char: string) => {
    if (char === '⌫') {
      setValStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (char === '.') {
      if (!valStr.includes('.')) setValStr((prev) => prev + '.');
    } else {
      setValStr((prev) => (prev === '0' ? char : prev + char));
    }
  };

  const handleQuickAdd = (amount: number) => {
    setValStr((prev) => {
      const curr = parseFloat(prev) || 0;
      return String(curr + amount);
    });
  };

  const handleUnitToggle = (unit: 'kg' | 'quintal') => {
    if (unit === activeUnit) return;
    if (unit === 'quintal') {
      setValStr(String((currentKg / 100).toFixed(2)));
    } else {
      setValStr(String(Math.round(currentQuintals * 100)));
    }
    setActiveUnit(unit);
  };

  const handleProceed = () => {
    if (currentKg <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid procurement lot quantity.');
      return;
    }

    setLotWeight(currentKg, activeUnit);
    navigation.navigate('PriceSourceModal');
  };

  return (
    <View className="flex-1 bg-slate-50 justify-between">
      {/* Top Header */}
      <View className="pt-14 pb-4 px-5 bg-white border-b border-slate-200 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-slate-100 items-center justify-center border border-slate-200 active:scale-95"
        >
          <Text className="text-slate-700 text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-sm font-black text-slate-800 uppercase tracking-widest">
          Lot Quantity & Weight
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 p-5" contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }}>
        <View>
          {/* Unit Toggle Pill Bar */}
          <View className="flex-row bg-slate-200 p-1.5 rounded-2xl mb-5 self-center">
            <TouchableOpacity
              onPress={() => handleUnitToggle('kg')}
              className={`px-6 py-2.5 rounded-xl ${activeUnit === 'kg' ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`text-xs font-bold ${activeUnit === 'kg' ? 'text-brand-950 font-black' : 'text-slate-600'}`}>
                Kilograms (kg)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleUnitToggle('quintal')}
              className={`px-6 py-2.5 rounded-xl ${activeUnit === 'quintal' ? 'bg-white shadow-sm' : ''}`}
            >
              <Text className={`text-xs font-bold ${activeUnit === 'quintal' ? 'text-brand-950 font-black' : 'text-slate-600'}`}>
                Quintals (qtl)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Weight Big Display Card */}
          <View className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-4 items-center">
            <Text className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Entered Procurement Volume
            </Text>

            <View className="flex-row items-baseline my-1">
              <Text className="text-5xl font-black text-brand-950 tracking-tight">
                {valStr}
              </Text>
              <Text className="text-2xl font-bold text-emerald-600 ml-2">
                {activeUnit === 'quintal' ? 'qtl' : 'kg'}
              </Text>
            </View>

            {/* Equivalent Unit Subtext */}
            <View className="bg-slate-50 px-4 py-1.5 rounded-full border border-slate-200 mt-2">
              <Text className="text-xs font-semibold text-slate-600">
                Equivalent: <Text className="font-bold text-slate-900">{currentKg.toLocaleString('en-IN')} kg</Text> ({currentQuintals.toFixed(2)} quintals)
              </Text>
            </View>
          </View>

          {/* Quick Increment Adders */}
          <View className="flex-row justify-between mb-5">
            {[
              activeUnit === 'quintal' ? 1 : 50,
              activeUnit === 'quintal' ? 5 : 100,
              activeUnit === 'quintal' ? 10 : 500,
            ].map((inc) => (
              <TouchableOpacity
                key={inc}
                onPress={() => handleQuickAdd(inc)}
                className="bg-emerald-50 px-4 py-2.5 rounded-xl border border-emerald-200 active:scale-95"
              >
                <Text className="text-xs font-bold text-emerald-800">
                  +{inc} {activeUnit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Touch-Optimized Numeric Keypad */}
        <View className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm mb-4">
          <View className="flex-row flex-wrap justify-between">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
              <TouchableOpacity
                key={k}
                onPress={() => handleKeyPress(k)}
                className="w-[30%] py-3.5 mb-2 rounded-2xl bg-slate-50 items-center justify-center border border-slate-100 active:bg-slate-200 active:scale-95"
              >
                <Text className="text-xl font-bold text-slate-800">{k}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Next Action Button */}
        <TouchableOpacity
          onPress={handleProceed}
          className="bg-brand-600 py-4 rounded-2xl items-center shadow-lg shadow-emerald-700/25 active:scale-98"
        >
          <Text className="text-white font-black text-base tracking-wide">
            Proceed to Pricing & Deductions →
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};
