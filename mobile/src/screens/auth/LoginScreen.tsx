import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../stores/authStore';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'AuthLogin'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const login = useAuthStore((state) => state.login);

  const [username, setUsername] = useState('officer');
  const [password, setPassword] = useState('grainvision2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Required Fields', 'Please enter your officer username and password.');
      return;
    }

    setLoading(true);
    try {
      const success = await login(username.trim(), password);
      if (success) {
        navigation.replace('MainTabs', { screen: 'HomeTab' });
      } else {
        Alert.alert('Authentication Failed', 'Invalid username or password.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Login request failed.');
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
          Procurement Sign In
        </Text>
        <View className="w-10" />
      </View>

      <View className="p-6 flex-1 justify-between">
        <View>
          <View className="mb-6">
            <Text className="text-2xl font-black text-slate-900 mb-1">
              Welcome back, Officer
            </Text>
            <Text className="text-xs text-slate-500 leading-relaxed">
              Enter your authorized credentials to access your designated mandi intake ledger.
            </Text>
          </View>

          {/* Form Inputs */}
          <View className="space-y-4">
            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Username / Officer ID
              </Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Enter username"
                autoCapitalize="none"
                autoCorrect={false}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 focus:border-brand-600 focus:bg-white"
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Password
              </Text>
              <View className="relative justify-center">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 focus:border-brand-600 focus:bg-white pr-12"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5"
                >
                  <Text className="text-xs font-bold text-slate-500">
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Demo Credential Fill Button */}
            <TouchableOpacity
              onPress={() => {
                setUsername('officer');
                setPassword('grainvision2026');
              }}
              className="bg-emerald-50 border border-emerald-200/80 p-3 rounded-xl flex-row items-center justify-between active:scale-98"
            >
              <View className="flex-row items-center space-x-2">
                <Text className="text-sm">🔑</Text>
                <Text className="text-xs font-semibold text-emerald-800">
                  Fill Demo: <Text className="font-bold">officer / grainvision2026</Text>
                </Text>
              </View>
              <Text className="text-xs text-emerald-600 font-bold">Auto-fill</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Actions */}
        <View className="pt-8 pb-4 space-y-3">
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            className="bg-brand-600 py-4 rounded-xl items-center shadow-md shadow-emerald-700/20 active:scale-98"
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text className="text-white font-bold text-base">Sign In to Dashboard</Text>
            )}
          </TouchableOpacity>

          <View className="flex-row items-center justify-center space-x-1 pt-2">
            <Text className="text-xs text-slate-500">Need an inspector account?</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AuthRegister')}>
              <Text className="text-xs font-bold text-brand-600 underline">
                Register Profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};
