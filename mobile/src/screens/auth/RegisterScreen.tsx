import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AuthRegister'>;

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const register = useAuthStore((state) => state.register);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [orgName, setOrgName] = useState('Andhra Pradesh Mandi Intake Yard');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !username.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please complete all required fields.');
      return;
    }

    setLoading(true);
    try {
      const success = await register(username.trim(), password, fullName.trim());
      if (success) {
        navigation.replace('MainTabs', { screen: 'HomeTab' });
      } else {
        Alert.alert('Registration Failed', 'Could not create profile.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Registration request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ flexGrow: 1 }}>
      {/* Top Header Bar */}
      <View className="pt-14 pb-6 px-6 bg-slate-50 border-b border-slate-100 flex-row items-center justify-between">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-10 h-10 rounded-full bg-white items-center justify-center border border-slate-200 active:scale-95"
        >
          <Text className="text-slate-700 text-lg">←</Text>
        </TouchableOpacity>
        <Text className="text-sm font-bold text-slate-700 uppercase tracking-widest">
          Inspector Registration
        </Text>
        <View className="w-10" />
      </View>

      <View className="p-6 flex-1 justify-between">
        <View>
          <View className="mb-6">
            <Text className="text-2xl font-black text-slate-900 mb-1">
              Create Officer Profile
            </Text>
            <Text className="text-xs text-slate-500 leading-relaxed">
              Register your inspector profile to manage rice lot assessments, quality reports, and seller payments.
            </Text>
          </View>

          {/* Form Fields */}
          <View className="space-y-4">
            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Full Name *
              </Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="e.g. A. Venkata Rao"
                autoCapitalize="words"
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 focus:border-brand-600 focus:bg-white"
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Username / Officer ID *
              </Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="e.g. venkat_rao"
                autoCapitalize="none"
                autoCorrect={false}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 focus:border-brand-600 focus:bg-white"
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Procurement Yard / Mandi Location
              </Text>
              <TextInput
                value={orgName}
                onChangeText={setOrgName}
                placeholder="e.g. East Godavari Mandi Yard"
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 focus:border-brand-600 focus:bg-white"
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Password *
              </Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Create secure password (min 6 characters)"
                secureTextEntry
                autoCapitalize="none"
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 focus:border-brand-600 focus:bg-white"
              />
            </View>
          </View>
        </View>

        {/* Footer Actions */}
        <View className="pt-8 pb-4 space-y-3">
          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading}
            className="bg-brand-600 py-4 rounded-xl items-center shadow-md shadow-emerald-700/20 active:scale-98"
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-white font-bold text-base">Register Profile</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center justify-center space-x-1 pt-2">
            <Text className="text-xs text-slate-500">Already registered?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AuthLogin')}>
              <Text className="text-xs font-bold text-brand-600 underline">
                Sign In
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
