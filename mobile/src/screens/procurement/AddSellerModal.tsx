import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useLotStore } from '../../stores/lotStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AddSellerModal'>;

export const AddSellerModal: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const createSeller = useLotStore((state) => state.createSeller);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [location, setLocation] = useState('East Godavari, AP');
  const [sellerCode, setSellerCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field', "Please enter the farmer's full name.");
      return;
    }
    if (!phone.trim() || phone.trim().length < 10) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Required Field', 'Please enter the farmer village or mandi location.');
      return;
    }

    setSubmitting(true);
    try {
      await createSeller({
        name: name.trim(),
        phone: phone.trim(),
        location: location.trim(),
        sellerCode: sellerCode.trim() || `AP-ID-${Date.now().toString().slice(-4)}`,
      });

      Alert.alert('Farmer Profile Created', `${name} has been added and selected for this procurement lot.`, [
        {
          text: 'Continue to Lot Setup',
          onPress: () => navigation.navigate('LotDetailsModal'),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Save Error', err?.message || 'Could not save farmer profile.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ flexGrow: 1 }}>
      {/* Top Header */}
      <View className="pt-14 pb-4 px-5 bg-slate-50 border-b border-slate-200 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-white items-center justify-center border border-slate-200 active:scale-95"
        >
          <Text className="text-slate-700 text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-sm font-black text-slate-800 uppercase tracking-widest">
          New Farmer Profile
        </Text>
        <View className="w-10" />
      </View>

      <View className="p-5 flex-1 justify-between">
        <View>
          <View className="mb-5">
            <Text className="text-xl font-black text-slate-900 mb-1">
              Farmer Registration
            </Text>
            <Text className="text-xs text-slate-500 leading-relaxed">
              Register contact and location details. This profile is reusable for future procurement lots.
            </Text>
          </View>

          {/* Form Inputs */}
          <View className="space-y-4">
            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Farmer Full Name *
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Ramesh Naidu"
                placeholderTextColor="#94a3b8"
                autoCapitalize="words"
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 focus:border-brand-600 focus:bg-white"
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Mobile Number *
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g. 9848022338"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={13}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 focus:border-brand-600 focus:bg-white"
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Alternate Contact (Optional)
              </Text>
              <TextInput
                value={altPhone}
                onChangeText={setAltPhone}
                placeholder="e.g. 9440155672"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 focus:border-brand-600 focus:bg-white"
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Village / Mandi Location *
              </Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. East Godavari, AP"
                placeholderTextColor="#94a3b8"
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 focus:border-brand-600 focus:bg-white"
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Farmer ID / Pattadar Passbook No.
              </Text>
              <TextInput
                value={sellerCode}
                onChangeText={setSellerCode}
                placeholder="e.g. AP-EG-0104 (Optional)"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 focus:border-brand-600 focus:bg-white"
              />
            </View>
          </View>
        </View>

        {/* Action Button */}
        <View className="pt-8 pb-4">
          <TouchableOpacity
            onPress={handleSave}
            disabled={submitting}
            className="bg-brand-600 py-4 rounded-2xl items-center shadow-md shadow-emerald-700/25 active:scale-98"
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-white font-black text-base tracking-wide">
                Save & Select Farmer →
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};
